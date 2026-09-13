import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { connect as imapConnect, ImapSimple } from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { sanitizeEmailHtml, extractSnippet } from '../security/sanitize';
import { generateRfcMessageId, normalizeRfcMessageId, wrapRfcMessageId } from './rfc';

export interface ProviderMessageItem {
  id: string;
  threadId: string;
  historyId?: string;
  rfcMessageId?: string;
  from: string;
  fromName?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  deliveredTo?: string;
  folder?: 'inbox' | 'sent';
  subject: string;
  bodyText: string;
  bodyHtml: string;
  snippet: string;
  date: string;
  hasAttachments: boolean;
  mailboxId?: string;
  imapUid?: string;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    data?: string; // base64
  }[];
}

export interface SendEmailOptions {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  replyToMessageId?: string;
  messageId?: string;
  threadId?: string;
  attachments?: {
    filename: string;
    mimeType: string;
    data: string; // base64
  }[];
}

export interface SendEmailResult {
  providerMessageId: string;
  threadId: string;
  rfcMessageId?: string;
}

export interface EmailProvider {
  name: string;
  fetchRecentMessages(sinceHistoryId?: string, limit?: number): Promise<{
    messages: ProviderMessageItem[];
    newHistoryId?: string;
  }>;
  getMessageDetails(providerMessageId: string): Promise<ProviderMessageItem | null>;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  applyMessageAction?(
    providerMessageId: string,
    action: 'read' | 'unread' | 'star' | 'unstar' | 'trash' | 'delete',
    metadata?: Record<string, any>
  ): Promise<void>;
  fetchAttachment?(
    providerMessageId: string,
    filename: string,
    metadata?: Record<string, any>
  ): Promise<{ data: string; mimeType: string } | null>;
}

export interface MailboxConfig {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  aliases?: string[];
}

// -------------------------------------------------------------
// 1. MOCK / SIMULATED EMAIL PROVIDER (FOR LOCAL DEV & CI TESTS)
// -------------------------------------------------------------
export class MockEmailProvider implements EmailProvider {
  public name = 'MockEmailProvider';
  private simulatedInboundPool: ProviderMessageItem[] = [];

  constructor() {
    this.seedMockMailbox();
  }

  public seedMockMailbox() {
    this.simulatedInboundPool = [
      {
        id: 'mock_provider_msg_rahul_101',
        threadId: 'mock_thread_rahul_101',
        from: 'hr@cruvels.com',
        fromName: 'Cruvels HR Team',
        to: ['rahul@cruvels.com'],
        cc: [],
        bcc: [],
        subject: 'Weekly Timesheet Submission & Attendance Policy',
        bodyText: 'Hi Rahul, please remember to log your weekly internship hours every Friday before 5 PM IST.',
        bodyHtml: '<p>Hi Rahul,</p><p>Please remember to log your <strong>weekly internship hours</strong> every Friday before 5 PM IST.</p>',
        snippet: 'Hi Rahul, please remember to log your weekly internship hours...',
        date: new Date(Date.now() - 3600000).toISOString(),
        hasAttachments: false,
        attachments: [],
      },
      {
        id: 'mock_provider_msg_priya_201',
        threadId: 'mock_thread_priya_201',
        from: 'design-lead@cruvels.com',
        fromName: 'Design Systems Lead',
        to: ['priya@cruvels.com'],
        cc: [],
        bcc: [],
        subject: 'Figma Components & UI Token Guidelines for Interns',
        bodyText: 'Hey Priya, here are the updated design tokens for your dashboard audit.',
        bodyHtml: '<p>Hey Priya,</p><p>Here are the updated <em>design tokens</em> for your dashboard audit.</p>',
        snippet: 'Hey Priya, here are the updated design tokens for your dashboard audit.',
        date: new Date(Date.now() - 7200000).toISOString(),
        hasAttachments: true,
        attachments: [
          {
            id: 'mock_att_priya_201_1',
            filename: 'cruvels_design_system_v2.pdf',
            mimeType: 'application/pdf',
            size: 1572864,
            data: Buffer.from('Mock PDF Content for Priya Design Tokens').toString('base64'),
          },
        ],
      },
      {
        id: 'mock_provider_msg_general_301',
        threadId: 'mock_thread_general_301',
        from: 'announcements@cruvels.com',
        fromName: 'Cruvels All Hands',
        to: ['company@cruvels.com'],
        cc: [],
        bcc: [],
        subject: 'Company-wide All Hands & Financial Overview [Confidential]',
        bodyText: 'Quarterly financial confidential review for executives.',
        bodyHtml: '<p>Quarterly financial confidential review for executives.</p>',
        snippet: 'Quarterly financial confidential review for executives.',
        date: new Date(Date.now() - 10800000).toISOString(),
        hasAttachments: false,
        attachments: [],
      },
    ];
  }

  public injectIncomingMessage(item: ProviderMessageItem) {
    this.simulatedInboundPool.unshift(item);
  }

  public async fetchRecentMessages(sinceHistoryId?: string, limit = 50): Promise<{
    messages: ProviderMessageItem[];
    newHistoryId?: string;
  }> {
    const list = this.simulatedInboundPool.slice(0, limit);
    return {
      messages: list,
      newHistoryId: String(Date.now()),
    };
  }

  public async getMessageDetails(providerMessageId: string): Promise<ProviderMessageItem | null> {
    return this.simulatedInboundPool.find((m) => m.id === providerMessageId) || null;
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const rfcMessageId = options.messageId || generateRfcMessageId(options.from);
    const providerMessageId = `mock_sent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const threadId = options.threadId || `mock_thread_${Date.now()}`;
    return { providerMessageId, threadId, rfcMessageId };
  }
}

// -------------------------------------------------------------
// 2. STANDARD SMTP & IMAP PROVIDER (MULTI-MAILBOX SUPPORT)
// -------------------------------------------------------------
const failedMailboxCircuitBreaker = new Map<string, number>();
const CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown after a connection failure

export function resetMailboxCircuitBreaker() {
  failedMailboxCircuitBreaker.clear();
}

export class SmtpImapProvider implements EmailProvider {
  public name = 'SmtpImapProvider';
  private mailboxes: MailboxConfig[] = [];
  private transporters: Map<string, nodemailer.Transporter> = new Map();

  constructor() {
    this.loadMailboxConfigurations();
  }

  private loadMailboxConfigurations() {
    this.mailboxes = [];

    // Priority 1: Multi-mailbox JSON in MAILBOXES_CONFIG
    if (process.env.MAILBOXES_CONFIG) {
      try {
        let raw = process.env.MAILBOXES_CONFIG.trim();
        while ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
          raw = raw.slice(1, -1).trim();
        }
        if (raw.startsWith("'")) raw = raw.slice(1);
        if (raw.endsWith("'")) raw = raw.slice(0, -1);
        raw = raw.trim();

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.mailboxes = parsed.map((m: any, idx: number) => ({
            id: m.id || `mailbox_${idx + 1}`,
            email: m.email || m.smtpUser || m.imapUser || '',
            smtpHost: m.smtpHost || 'smtp.gmail.com',
            smtpPort: parseInt(String(m.smtpPort || '587'), 10),
            smtpUser: m.smtpUser || m.email || '',
            smtpPass: (m.smtpPass || '').replace(/\s+/g, ''),
            imapHost: m.imapHost || 'imap.gmail.com',
            imapPort: parseInt(String(m.imapPort || '993'), 10),
            imapUser: m.imapUser || m.email || '',
            imapPass: (m.imapPass || '').replace(/\s+/g, ''),
            aliases: Array.isArray(m.aliases) ? m.aliases : [],
          }));
          return;
        }
      } catch (err) {
        console.error('[MAILBOXES_CONFIG PARSE ERROR]', err);
      }
    }

    // Priority 2: Fallback to single SMTP / IMAP env configuration
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.IMAP_USER || '';
    const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASS || '').replace(/\s+/g, '');

    const imapHost = process.env.IMAP_HOST || 'imap.gmail.com';
    const imapPort = parseInt(process.env.IMAP_PORT || '993', 10);
    const imapUser = process.env.IMAP_USER || process.env.GMAIL_USER || smtpUser;
    const imapPass = (process.env.IMAP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || smtpPass).replace(/\s+/g, '');

    if ((smtpUser && smtpPass) || (imapUser && imapPass)) {
      this.mailboxes.push({
        id: 'primary_mailbox',
        email: smtpUser || imapUser,
        smtpHost,
        smtpPort,
        smtpUser: smtpUser || imapUser,
        smtpPass: smtpPass || imapPass,
        imapHost,
        imapPort,
        imapUser: imapUser || smtpUser,
        imapPass: imapPass || smtpPass,
        aliases: [],
      });
    }
  }

  private getTransporterForSender(fromAddress: string): { transporter: nodemailer.Transporter; mailbox: MailboxConfig } {
    this.loadMailboxConfigurations();
    if (this.mailboxes.length === 0) {
      throw new Error('No SMTP mailboxes configured. Please set SMTP_USER and SMTP_PASS or MAILBOXES_CONFIG in .env');
    }

    // Find matching mailbox by alias or email
    let matchingBox = this.mailboxes.find(
      (m) =>
        m.email.toLowerCase() === fromAddress.toLowerCase() ||
        (m.aliases && m.aliases.some((a) => a.toLowerCase() === fromAddress.toLowerCase()))
    );

    if (!matchingBox) {
      // Default to the first configured mailbox
      matchingBox = this.mailboxes[0];
    }

    if (!this.transporters.has(matchingBox.id)) {
      const cleanPass = (matchingBox.smtpPass || '').replace(/\s+/g, '');
      const transporter = nodemailer.createTransport({
        host: matchingBox.smtpHost,
        port: matchingBox.smtpPort,
        secure: matchingBox.smtpPort === 465,
        auth: {
          user: matchingBox.smtpUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.transporters.set(matchingBox.id, transporter);
    }

    return {
      transporter: this.transporters.get(matchingBox.id)!,
      mailbox: matchingBox,
    };
  }

  private formatFromHeader(from: string, fromName?: string): string {
    const safeName = (fromName || '').replace(/[\r\n"]/g, '').trim();
    return safeName ? `"${safeName}" <${from}>` : from;
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { transporter, mailbox } = this.getTransporterForSender(options.from);
    const rfcMessageId = options.messageId || generateRfcMessageId(options.from);
    const inReplyTo = wrapRfcMessageId(options.replyToMessageId);
    const envelopeTo = [...options.to, ...(options.cc || []), ...(options.bcc || [])];

    const attachments = options.attachments?.map((att) => ({
      filename: att.filename,
      contentType: att.mimeType,
      content: Buffer.from(att.data, 'base64'),
    }));

    const mailPayload = {
      from: this.formatFromHeader(options.from, options.fromName),
      replyTo: options.from,
      envelope: {
        from: mailbox.smtpUser,
        to: envelopeTo,
      },
      to: options.to.join(', '),
      cc: options.cc && options.cc.length ? options.cc.join(', ') : undefined,
      bcc: options.bcc && options.bcc.length ? options.bcc.join(', ') : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      attachments,
      messageId: wrapRfcMessageId(rfcMessageId),
      inReplyTo,
      references: inReplyTo,
    };

    try {
      try {
        const info = await transporter.sendMail(mailPayload);
        return {
          providerMessageId: info.messageId || wrapRfcMessageId(rfcMessageId) || `smtp_${Date.now()}`,
          threadId: options.threadId || `thread_${Date.now()}`,
          rfcMessageId,
        };
      } catch (aliasErr: any) {
        const msg = String(aliasErr?.message || aliasErr);
        const aliasRejected =
          msg.includes('553') ||
          msg.includes('550') ||
          /not allowed to send|sender address rejected|from address/i.test(msg);
        if (!aliasRejected || mailbox.email.toLowerCase() === options.from.toLowerCase()) {
          throw aliasErr;
        }
        const retryInfo = await transporter.sendMail({
          ...mailPayload,
          from: this.formatFromHeader(mailbox.email, options.fromName),
          replyTo: options.from,
        });
        return {
          providerMessageId: retryInfo.messageId || wrapRfcMessageId(rfcMessageId) || `smtp_${Date.now()}`,
          threadId: options.threadId || `thread_${Date.now()}`,
          rfcMessageId,
        };
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('535') || msg.includes('BadCredentials') || msg.includes('Username and Password not accepted')) {
        throw new Error(
          `Google SMTP Authentication Error (535 BadCredentials) for ${mailbox.email}: Gmail requires a 16-character App Password (not your personal Google account password). Please generate an App Password in your Google Account > Security > 2-Step Verification > App Passwords, and paste it into .env (MAILBOXES_CONFIG).`
        );
      }
      throw err;
    }
  }

  private mapParsedMail(
    parsed: ParsedMail,
    box: MailboxConfig,
    folderType: 'inbox' | 'sent',
    uid: string
  ): ProviderMessageItem {
    const fromAddress = parsed.from?.value[0]?.address || '';
    const fromName = parsed.from?.value[0]?.name || fromAddress;
    const toAddresses = parsed.to
      ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t) => t.value.map((v) => v.address || ''))
      : [];
    const ccAddresses = parsed.cc
      ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((c) => c.value.map((v) => v.address || ''))
      : [];
    const bccAddresses = parsed.bcc
      ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]).flatMap((b) => b.value.map((v) => v.address || ''))
      : [];

    const rawDelivered = parsed.headers.get('delivered-to') || parsed.headers.get('x-original-to');
    let deliveredTo: string | undefined = undefined;
    if (typeof rawDelivered === 'string') {
      deliveredTo = rawDelivered;
    } else if (Array.isArray(rawDelivered)) {
      deliveredTo = String(rawDelivered[0] || '');
    } else if (rawDelivered && typeof rawDelivered === 'object') {
      deliveredTo = (rawDelivered as any).value || (rawDelivered as any).text || (rawDelivered as any).address || String(rawDelivered);
    }

    const bodyHtml = parsed.html || parsed.textAsHtml || parsed.text || '';
    const bodyText = parsed.text || '';
    const snippet = extractSnippet(bodyText || bodyHtml);
    const rfcMessageId = parsed.messageId ? normalizeRfcMessageId(String(parsed.messageId)) : undefined;

    const attachments = (parsed.attachments || []).map((att, idx) => ({
      id: `att_${box.id}_${folderType}_${uid}_${idx}`,
      filename: att.filename || `attachment_${idx}`,
      mimeType: att.contentType,
      size: att.size,
      data: att.content ? att.content.toString('base64') : undefined,
    }));

    return {
      id: `imap_${box.id}_${folderType}_${uid}`,
      threadId: rfcMessageId || `thread_imap_${box.id}_${folderType}_${uid}`,
      rfcMessageId,
      historyId: uid,
      mailboxId: box.id,
      imapUid: uid,
      from: fromAddress,
      fromName,
      to: toAddresses.filter(Boolean),
      cc: ccAddresses.filter(Boolean),
      bcc: bccAddresses.filter(Boolean),
      deliveredTo,
      folder: folderType,
      subject: parsed.subject || '(No Subject)',
      bodyText,
      bodyHtml: sanitizeEmailHtml(bodyHtml),
      snippet,
      date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
      hasAttachments: attachments.length > 0,
      attachments,
    };
  }

  private async connectMailbox(box: MailboxConfig): Promise<ImapSimple> {
    const cleanImapPass = (box.imapPass || '').replace(/\s+/g, '');
    return imapConnect({
      imap: {
        user: box.imapUser,
        password: cleanImapPass,
        host: box.imapHost,
        port: box.imapPort,
        tls: box.imapPort === 993,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 8000,
        connTimeout: 8000,
      },
    });
  }

  private async openMailFolder(connection: ImapSimple, folderType: 'inbox' | 'sent'): Promise<boolean> {
    const folderName = folderType === 'sent' ? '[Gmail]/Sent Mail' : 'INBOX';
    try {
      await connection.openBox(folderName);
      return true;
    } catch {
      if (folderType === 'sent') {
        try {
          await connection.openBox('Sent');
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  public async fetchRecentMessages(sinceHistoryId?: string, limit = 50): Promise<{
    messages: ProviderMessageItem[];
    newHistoryId?: string;
  }> {
    this.loadMailboxConfigurations();
    if (this.mailboxes.length === 0) {
      return { messages: [], newHistoryId: sinceHistoryId };
    }

    let cursor: { folders: Record<string, { lastUid: number; uidvalidity?: number }> } = { folders: {} };
    if (sinceHistoryId) {
      try {
        const parsed = JSON.parse(sinceHistoryId);
        if (parsed?.folders) cursor = parsed;
      } catch {
        // Legacy timestamp checkpoints are ignored — bootstrap from last 7 days
      }
    }

    const allMessages: ProviderMessageItem[] = [];
    const seenImapUsers = new Set<string>();

    for (const box of this.mailboxes) {
      const imapUserKey = `${box.imapHost}:${box.imapPort}:${box.imapUser.toLowerCase()}`;
      if (seenImapUsers.has(imapUserKey)) continue;
      seenImapUsers.add(imapUserKey);

      const lastFailedAt = failedMailboxCircuitBreaker.get(box.email);
      if (lastFailedAt && Date.now() - lastFailedAt < CIRCUIT_BREAKER_COOLDOWN_MS) {
        continue;
      }

      let connection: ImapSimple | null = null;
      try {
        const cleanImapPass = (box.imapPass || '').replace(/\s+/g, '');
        if (!cleanImapPass || cleanImapPass.includes('placeholder') || cleanImapPass.includes('your_app_password') || cleanImapPass.length < 6) {
          continue;
        }

        connection = await imapConnect({
          imap: {
            user: box.imapUser,
            password: cleanImapPass,
            host: box.imapHost,
            port: box.imapPort,
            tls: box.imapPort === 993,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 8000,
            connTimeout: 8000,
          },
        });

        const foldersToSync: { name: string; folderType: 'inbox' | 'sent' }[] = [
          { name: 'INBOX', folderType: 'inbox' },
          { name: '[Gmail]/Sent Mail', folderType: 'sent' },
        ];

        for (const f of foldersToSync) {
          try {
            await connection.openBox(f.name);
          } catch {
            if (f.folderType === 'sent') {
              try {
                await connection.openBox('Sent');
              } catch {
                continue;
              }
            } else {
              continue;
            }
          }

          const folderKey = `${box.id}:${f.folderType}`;
          const prev = cursor.folders[folderKey];
          const lastUid = prev?.lastUid || 0;
          let criteria: any[];
          if (lastUid > 0) {
            criteria = [['UID', `${lastUid + 1}:*`]];
          } else {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            criteria = [['SINCE', `${since.getDate()}-${months[since.getMonth()]}-${since.getFullYear()}`]];
          }

          let messages: any[] = [];
          try {
            messages = await connection.search(criteria, {
              bodies: [''],
              markSeen: false,
              struct: true,
            });
          } catch {
            continue;
          }

          if (!messages || messages.length === 0) {
            continue;
          }

          if (lastUid === 0 && messages.length > limit) {
            messages = messages.slice(-limit);
          }

          let folderMaxUid = lastUid;
          for (const item of messages) {
            const uidNum = Number(item.attributes.uid);
            if (!Number.isFinite(uidNum)) continue;
            if (lastUid > 0 && uidNum <= lastUid) continue;
            if (uidNum > folderMaxUid) folderMaxUid = uidNum;
            const uid = String(item.attributes.uid);
            const allPart =
              item.parts.find((p: any) => p.which === '' || p.which === 'RFC822' || p.which === 'BODY[]') ||
              item.parts.find((p: any) => p.which === 'TEXT') ||
              item.parts[0];

            const rawSource: any = allPart ? allPart.body : '';
            if (!rawSource) continue;

            let parsed: ParsedMail;
            try {
              parsed = await simpleParser(rawSource);
            } catch (pErr) {
              console.error(`[IMAP PARSER ERROR for uid ${uid}]`, pErr);
              continue;
            }

            const mapped = this.mapParsedMail(parsed, box, f.folderType, uid);
            if (mapped) allMessages.push(mapped);
          }

          cursor.folders[folderKey] = { lastUid: folderMaxUid };
        }
      } catch (boxErr: any) {
        failedMailboxCircuitBreaker.set(box.email, Date.now());
        const isTimeout = String(boxErr?.message || boxErr).toLowerCase().includes('time') || boxErr?.source === 'timeout';
        if (isTimeout) {
          console.warn(`[IMAP Sync Cooldown] Mailbox ${box.email} socket is unreachable. Using cached mail until the next successful sync.`);
        } else {
          console.warn(`[IMAP Sync Warning for ${box.email}]`, boxErr?.message || boxErr);
        }
      } finally {
        if (connection) {
          try {
            connection.end();
          } catch {}
        }
      }
    }

    return {
      messages: allMessages,
      newHistoryId: JSON.stringify(cursor),
    };
  }

  public async applyMessageAction(
    providerMessageId: string,
    action: 'read' | 'unread' | 'star' | 'unstar' | 'trash' | 'delete',
    metadata?: Record<string, any>
  ): Promise<void> {
    this.loadMailboxConfigurations();
    const parsed = providerMessageId.match(/^imap_(.+)_(inbox|sent)_(\d+)$/);
    const mailboxId = metadata?.mailboxId || parsed?.[1];
    const folderType = (metadata?.folder || parsed?.[2]) as 'inbox' | 'sent' | undefined;
    const uid = String(metadata?.imapUid || parsed?.[3] || '');
    if (!mailboxId || !folderType || !uid) return;

    const box = this.mailboxes.find((m) => m.id === mailboxId) || this.mailboxes[0];
    if (!box) return;

    const cleanImapPass = (box.imapPass || '').replace(/\s+/g, '');
    if (!cleanImapPass) return;

    let connection: ImapSimple | null = null;
    try {
      connection = await imapConnect({
        imap: {
          user: box.imapUser,
          password: cleanImapPass,
          host: box.imapHost,
          port: box.imapPort,
          tls: box.imapPort === 993,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 8000,
          connTimeout: 8000,
        },
      });
      const folderName = folderType === 'sent' ? '[Gmail]/Sent Mail' : 'INBOX';
      try {
        await connection.openBox(folderName);
      } catch {
        if (folderType === 'sent') await connection.openBox('Sent');
        else return;
      }

      const uidNum = parseInt(uid, 10);
      if (action === 'read') await (connection as any).addFlags(uidNum, '\\Seen');
      if (action === 'unread') await (connection as any).delFlags(uidNum, '\\Seen');
      if (action === 'star') await (connection as any).addFlags(uidNum, '\\Flagged');
      if (action === 'unstar') await (connection as any).delFlags(uidNum, '\\Flagged');
      if (action === 'trash' || action === 'delete') {
        try {
          await (connection as any).move(uidNum, '[Gmail]/Trash');
        } catch {
          await (connection as any).addFlags(uidNum, '\\Deleted');
        }
      }
    } catch (err) {
      console.warn('[IMAP FLAG SYNC]', err);
    } finally {
      if (connection) {
        try {
          connection.end();
        } catch {}
      }
    }
  }

  public async getMessageDetails(providerMessageId: string): Promise<ProviderMessageItem | null> {
    this.loadMailboxConfigurations();
    const parsedId = providerMessageId.match(/^imap_(.+)_(inbox|sent)_(\d+)$/);
    if (!parsedId) return null;
    const mailboxId = parsedId[1];
    const folderType = parsedId[2] as 'inbox' | 'sent';
    const uid = parsedId[3];
    const box = this.mailboxes.find((m) => m.id === mailboxId) || this.mailboxes[0];
    if (!box) return null;

    let connection: ImapSimple | null = null;
    try {
      connection = await this.connectMailbox(box);
      const opened = await this.openMailFolder(connection, folderType);
      if (!opened) return null;
      const messages = await connection.search([['UID', uid]], {
        bodies: [''],
        markSeen: false,
        struct: true,
      });
      if (!messages?.length) return null;
      const item = messages[0];
      const allPart =
        item.parts.find((p: any) => p.which === '' || p.which === 'RFC822' || p.which === 'BODY[]') ||
        item.parts.find((p: any) => p.which === 'TEXT') ||
        item.parts[0];
      const rawSource: any = allPart ? allPart.body : '';
      if (!rawSource) return null;
      const parsed = await simpleParser(rawSource);
      return this.mapParsedMail(parsed, box, folderType, uid);
    } catch (err) {
      console.warn('[IMAP GET MESSAGE]', err);
      return null;
    } finally {
      if (connection) {
        try {
          connection.end();
        } catch {}
      }
    }
  }

  public async fetchAttachment(
    providerMessageId: string,
    filename: string,
    metadata?: Record<string, any>
  ): Promise<{ data: string; mimeType: string } | null> {
    const details = await this.getMessageDetails(
      providerMessageId.startsWith('imap_')
        ? providerMessageId
        : metadata?.imapUid
          ? `imap_${metadata.mailboxId || 'primary_mailbox'}_${metadata.folder || 'inbox'}_${metadata.imapUid}`
          : providerMessageId
    );
    if (!details?.attachments) return null;
    const att = details.attachments.find((a) => a.filename === filename && a.data);
    if (!att?.data) return null;
    return { data: att.data, mimeType: att.mimeType };
  }
}

// -------------------------------------------------------------
// 3. GOOGLE WORKSPACE / GMAIL REST API PROVIDER (FOR OAUTH)
// -------------------------------------------------------------
export class GoogleWorkspaceProvider implements EmailProvider {
  public name = 'GoogleWorkspaceProvider';
  private gmail: ReturnType<typeof google.gmail> | null = null;

  constructor() {
    this.initGmailClient();
  }

  private initGmailClient() {
    try {
      const mode = process.env.EMAIL_PROVIDER_MODE;
      if (mode === 'google_service_account' && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
          ],
          subject: process.env.GOOGLE_ADMIN_IMPERSONATE_USER || process.env.GOOGLE_COMMON_MAILBOX,
        });
        this.gmail = google.gmail({ version: 'v1', auth });
      } else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
        );
        oauth2Client.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });
        this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      }
    } catch (err) {
      console.warn('[GOOGLE WORKSPACE PROVIDER INIT WARN]', err);
    }
  }

  public async fetchRecentMessages(sinceHistoryId?: string, limit = 50): Promise<{
    messages: ProviderMessageItem[];
    newHistoryId?: string;
  }> {
    if (!this.gmail) {
      throw new Error('Google Workspace Gmail API is not configured with active credentials.');
    }

    const res = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
      q: 'newer_than:7d',
    });

    const messageList = res.data.messages || [];
    const results: ProviderMessageItem[] = [];

    for (const item of messageList) {
      if (!item.id) continue;
      const details = await this.getMessageDetails(item.id);
      if (details) {
        results.push(details);
      }
    }

    return {
      messages: results,
      newHistoryId: res.data.resultSizeEstimate ? String(Date.now()) : sinceHistoryId,
    };
  }

  public async getMessageDetails(providerMessageId: string): Promise<ProviderMessageItem | null> {
    if (!this.gmail) return null;

    try {
      const res = await this.gmail.users.messages.get({
        userId: 'me',
        id: providerMessageId,
        format: 'full',
      });

      const payload = res.data.payload;
      if (!payload) return null;

      const headers = payload.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const to = getHeader('To').split(',').map((s) => s.trim()).filter(Boolean);
      const cc = getHeader('Cc').split(',').map((s) => s.trim()).filter(Boolean);
      const bcc = getHeader('Bcc').split(',').map((s) => s.trim()).filter(Boolean);
      const subject = getHeader('Subject') || '(No Subject)';
      const date = getHeader('Date') || new Date().toISOString();
      const rfcMessageId = normalizeRfcMessageId(getHeader('Message-ID') || getHeader('Message-Id'));

      let bodyText = '';
      let bodyHtml = '';

      const extractParts = (part: any) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }

        if (part.parts && Array.isArray(part.parts)) {
          for (const sub of part.parts) {
            extractParts(sub);
          }
        }
      };

      extractParts(payload);

      const snippet = res.data.snippet || extractSnippet(bodyText || bodyHtml);

      return {
        id: providerMessageId,
        threadId: res.data.threadId || providerMessageId,
        historyId: res.data.historyId || undefined,
        rfcMessageId: rfcMessageId || undefined,
        from,
        to,
        cc,
        bcc,
        subject,
        bodyText,
        bodyHtml: sanitizeEmailHtml(bodyHtml),
        snippet,
        date: new Date(date).toISOString(),
        hasAttachments: false,
      };
    } catch (err) {
      console.error('[GMAIL GET MESSAGE ERROR]', err);
      return null;
    }
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.gmail) {
      throw new Error('Google Workspace Gmail API is not configured.');
    }

    const rfcMessageId = options.messageId || generateRfcMessageId(options.from);
    const inReplyTo = wrapRfcMessageId(options.replyToMessageId);
    const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
    const messageParts = [
      `From: ${options.fromName ? `"${options.fromName.replace(/[\r\n"]/g, '')}" <${options.from}>` : options.from}`,
      `To: ${options.to.join(', ')}`,
      options.cc && options.cc.length ? `Cc: ${options.cc.join(', ')}` : null,
      options.bcc && options.bcc.length ? `Bcc: ${options.bcc.join(', ')}` : null,
      `Reply-To: ${options.from}`,
      `Message-ID: ${wrapRfcMessageId(rfcMessageId)}`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
      inReplyTo ? `References: ${inReplyTo}` : null,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.html || options.text || '',
    ].filter((line) => line !== null);

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: options.threadId,
      },
    });

    return {
      providerMessageId: res.data.id || `gmail_${Date.now()}`,
      threadId: res.data.threadId || options.threadId || `thread_${Date.now()}`,
      rfcMessageId,
    };
  }
}

// Global Provider Instance Singleton
let globalProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (globalProvider) return globalProvider;

  const mode = process.env.EMAIL_PROVIDER_MODE;
  const hasMailboxesJson = Boolean(process.env.MAILBOXES_CONFIG && process.env.MAILBOXES_CONFIG.trim().length > 2);
  const hasImap = Boolean(
    process.env.IMAP_HOST ||
    process.env.IMAP_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_HOST ||
    process.env.SMTP_USER ||
    hasMailboxesJson
  );
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

  if (mode === 'smtp_imap' || mode === 'smtp' || (!mode && hasImap)) {
    globalProvider = new SmtpImapProvider();
  } else if (mode === 'google_oauth' || mode === 'google_service_account' || (!mode && hasGoogle)) {
    globalProvider = new GoogleWorkspaceProvider();
  } else {
    globalProvider = new MockEmailProvider();
  }

  return globalProvider;
}
