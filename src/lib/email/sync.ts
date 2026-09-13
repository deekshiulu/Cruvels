import { getEmailProvider, resetMailboxCircuitBreaker } from './provider';
import { evaluateEmailOwnership, normalizeEmail, InboundEmailMatch, getConfiguredMailboxEmails } from './ownership';
import { dataStore } from '../db/store';
import { sanitizeEmailHtml, extractSnippet } from '../security/sanitize';
import { logAuditEvent } from '../audit/logger';
import { normalizeRfcMessageId } from './rfc';

export interface SyncResult {
  success: boolean;
  provider: string;
  fetchedCount: number;
  ingestedCount: number;
  matchedUsersCount: number;
  error?: string;
}

let isSyncRunning = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 20000;

export async function runIncrementalEmailSync(force: boolean = false): Promise<SyncResult> {
  const now = Date.now();
  if (force) {
    resetMailboxCircuitBreaker();
  }

  if (isSyncRunning) {
    return {
      success: true,
      provider: 'SyncLock',
      fetchedCount: 0,
      ingestedCount: 0,
      matchedUsersCount: 0,
    };
  }

  if (!force && now - lastSyncTime < SYNC_COOLDOWN_MS) {
    return {
      success: true,
      provider: 'Cooldown',
      fetchedCount: 0,
      ingestedCount: 0,
      matchedUsersCount: 0,
    };
  }

  const provider = getEmailProvider();
  const providerName = provider.name;
  const locked = await dataStore.tryAcquireSyncLock(providerName);
  if (!locked) {
    return {
      success: true,
      provider: 'SyncLock',
      fetchedCount: 0,
      ingestedCount: 0,
      matchedUsersCount: 0,
    };
  }

  isSyncRunning = true;
  lastSyncTime = now;

  const checkpoint = await dataStore.getCheckpoint(providerName);

  try {
    // 1. Load checkpoint
    const sinceHistoryId = checkpoint?.history_id || undefined;

    // Update status to running
    await dataStore.saveCheckpoint(providerName, {
      id: checkpoint?.id || 'chk_001',
      provider: providerName,
      history_id: sinceHistoryId || null,
      last_sync_timestamp: checkpoint?.last_sync_timestamp || new Date().toISOString(),
      status: 'running',
      error_message: null,
      updated_at: new Date().toISOString(),
    });

    // 2. Fetch new messages from provider (both INBOX and Sent Mail)
    const { messages: rawMessages, newHistoryId } = await provider.fetchRecentMessages(sinceHistoryId, 50);

    let ingestedCount = 0;
    const matchedUserSet = new Set<string>();
    const allAliases = await dataStore.listAllAliases();

    // 3. Process each message with strict alias attribution
    for (const raw of rawMessages) {
      let matches: InboundEmailMatch[] = [];

      if (raw.folder === 'sent') {
        // Sent mail: attribute strictly to the sender alias owner
        const cleanFrom = normalizeEmail(raw.from);
        const matchedAlias = allAliases.find(
          (a) => a.is_active && normalizeEmail(a.email_address) === cleanFrom
        );
        if (matchedAlias) {
          const user = await dataStore.getUserById(matchedAlias.user_id);
          if (user && user.status === 'active') {
            matches.push({
              matchedUser: user,
              matchedAlias,
              recipientType: 'to',
            });
          }
        } else {
          // If sent from any configured organizational mailbox, attribute to all active Admins
          const configuredEmails = getConfiguredMailboxEmails();
          if (configuredEmails.includes(cleanFrom)) {
            const allUsers = await dataStore.listUsers();
            const adminUsers = allUsers.filter((u) => u.role === 'admin' && u.status === 'active');
            for (const adminUser of adminUsers) {
              const adminAlias = allAliases.find((a) => a.user_id === adminUser.id) || {
                id: `alias_admin_${adminUser.username}`,
                user_id: adminUser.id,
                email_address: `${adminUser.username}@cruvels.com`,
                is_primary: true,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              matches.push({
                matchedUser: adminUser,
                matchedAlias: adminAlias,
                recipientType: 'to',
              });
            }
          }
        }
      } else {
        // Inbound inbox mail: strictly match recipient alias (To, CC, BCC, Delivered-To)
        matches = await evaluateEmailOwnership({
          toAddresses: raw.to,
          ccAddresses: raw.cc,
          bccAddresses: raw.bcc,
          fromAddress: raw.from,
          deliveredTo: raw.deliveredTo,
        });
      }

      if (matches.length === 0) {
        continue;
      }

      for (const match of matches) {
        matchedUserSet.add(match.matchedUser.id);

        const isSent = raw.folder === 'sent';
        const folder = isSent ? 'sent' : 'inbox';
        const receivedAt = isSent ? null : (raw.date || new Date().toISOString());
        const sentAt = isSent ? (raw.date || new Date().toISOString()) : null;

        // Check if message already ingested for this specific user in this folder
        const existing = await dataStore.getMessageByProviderAndOwner(raw.id, match.matchedUser.id);
        if (existing && existing.folder === folder) {
          continue;
        }

        const rfcId = normalizeRfcMessageId(raw.rfcMessageId);
        if (rfcId) {
          const existingByRfc = await dataStore.findMessageByRfcId(match.matchedUser.id, rfcId, folder);
          if (existingByRfc) {
            await dataStore.updateMessage(existingByRfc.id, {
              provider_message_id: raw.id,
              provider_metadata: {
                ...(existingByRfc.provider_metadata || {}),
                historyId: raw.historyId,
                folder,
                mailboxId: raw.mailboxId,
                imapUid: raw.imapUid,
                rfcMessageId: rfcId,
              },
            });
            continue;
          }
        }

        // Sanitize body HTML
        const safeHtml = sanitizeEmailHtml(raw.bodyHtml);
        const snippet = raw.snippet || extractSnippet(raw.bodyText || safeHtml);

        const createdMsg = await dataStore.createMessage({
          provider_message_id: raw.id,
          thread_id: raw.threadId || raw.id,
          owner_user_id: match.matchedUser.id,
          owner_alias_id: match.matchedAlias.id,
          from_address: raw.from,
          from_name: raw.fromName || null,
          to_addresses: raw.to,
          cc_addresses: raw.cc || [],
          bcc_addresses: raw.bcc || [],
          subject: raw.subject || '(No Subject)',
          body_text: raw.bodyText || '',
          body_html: safeHtml || null,
          snippet,
          received_at: receivedAt,
          sent_at: sentAt,
          folder,
          is_read: isSent ? true : false,
          is_starred: false,
          has_attachments: Boolean(raw.attachments && raw.attachments.length > 0),
          provider_metadata: {
            historyId: raw.historyId,
            folder,
            mailboxId: raw.mailboxId,
            imapUid: raw.imapUid,
            rfcMessageId: rfcId || undefined,
          },
        });

        // Ingest lightweight attachment metadata without database bloating
        if (raw.attachments && raw.attachments.length > 0) {
          for (const att of raw.attachments) {
            await dataStore.createAttachment({
              message_id: createdMsg.id,
              filename: att.filename,
              mime_type: att.mimeType,
              size: att.size,
              storage_path: `${folder}-attachments/${match.matchedUser.username}/${att.filename}`,
              content_data: att.data,
            });
          }
        }

        // Trigger notification for new inbound messages
        if (folder === 'inbox') {
          await dataStore.createNotification({
            user_id: match.matchedUser.id,
            type: 'mail',
            title: `New Email: ${raw.subject || '(No Subject)'}`,
            message: `From ${raw.from} - ${snippet.slice(0, 80)}`,
            link_url: `/mail/${createdMsg.id}`,
          });
        }

        ingestedCount++;
      }
    }

    // 4. Update checkpoint
    await dataStore.saveCheckpoint(providerName, {
      id: checkpoint?.id || 'chk_001',
      provider: providerName,
      history_id: newHistoryId || sinceHistoryId || null,
      last_sync_timestamp: new Date().toISOString(),
      status: 'idle',
      error_message: null,
      updated_at: new Date().toISOString(),
    });

    await logAuditEvent({
      action: 'EMAIL_SYNC_COMPLETED',
      resourceType: 'SYNC_WORKER',
      metadata: {
        provider: providerName,
        fetched: rawMessages.length,
        ingested: ingestedCount,
        matchedUsers: matchedUserSet.size,
      },
    });

    return {
      success: true,
      provider: providerName,
      fetchedCount: rawMessages.length,
      ingestedCount,
      matchedUsersCount: matchedUserSet.size,
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Sync worker encountered an unexpected error.';
    console.error('[EMAIL SYNC FAILED]', err);

    await dataStore.saveCheckpoint(providerName, {
      id: checkpoint?.id || 'chk_001',
      provider: providerName,
      history_id: checkpoint?.history_id || null,
      last_sync_timestamp: checkpoint?.last_sync_timestamp || new Date().toISOString(),
      status: 'error',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    });

    await logAuditEvent({
      action: 'EMAIL_SYNC_FAILED',
      resourceType: 'SYNC_WORKER',
      metadata: { error: errorMessage },
    });

    return {
      success: false,
      provider: providerName,
      fetchedCount: 0,
      ingestedCount: 0,
      matchedUsersCount: 0,
      error: errorMessage,
    };
  } finally {
    isSyncRunning = false;
  }
}
