import { dataStore } from '../db/store';
import { MailAlias, User } from '../db/types';

export interface ParsedEmailRecipient {
  email: string;
  name?: string;
}

export interface InboundEmailMatch {
  matchedUser: User;
  matchedAlias: MailAlias;
  recipientType: 'to' | 'cc' | 'bcc';
}

/**
 * Normalizes email address to lowercase and strips extraneous spaces/tags.
 */
export function normalizeEmail(email?: any): string {
  if (!email) return '';
  let str = '';
  if (typeof email === 'string') {
    str = email;
  } else if (typeof email === 'object') {
    if (email.address && typeof email.address === 'string') {
      str = email.address;
    } else if (email.value && Array.isArray(email.value) && email.value[0]?.address) {
      str = email.value[0].address;
    } else if (email.text && typeof email.text === 'string') {
      str = email.text;
    } else {
      str = String(email);
    }
  } else {
    str = String(email);
  }

  const match = str.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].toLowerCase().trim();
  }
  return str.toLowerCase().trim();
}

/**
 * Extracts list of clean email strings from a header or list
 */
export function extractEmailList(raw: any): string[] {
  if (!raw) return [];
  const results: string[] = [];

  const addEmail = (val: any) => {
    const clean = normalizeEmail(val);
    if (clean && !results.includes(clean)) {
      results.push(clean);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const parts = item.split(',');
        for (const p of parts) addEmail(p);
      } else if (item && typeof item === 'object') {
        if (item.address) addEmail(item.address);
        else if (item.value) {
          const sub = extractEmailList(item.value);
          for (const s of sub) addEmail(s);
        }
      }
    }
  } else if (typeof raw === 'object') {
    if (raw.value && Array.isArray(raw.value)) {
      return extractEmailList(raw.value);
    }
    if (raw.address) {
      addEmail(raw.address);
    }
    if (raw.text) {
      return extractEmailList(raw.text);
    }
  } else if (typeof raw === 'string') {
    const parts = raw.split(',');
    for (const part of parts) {
      addEmail(part);
    }
  }

  return results;
}

/**
 * Gets all configured organizational mailbox email addresses from env / MAILBOXES_CONFIG.
 */
export function getConfiguredMailboxEmails(): string[] {
  const emails: string[] = [];
  if (process.env.MAILBOXES_CONFIG) {
    try {
      const boxes = JSON.parse(process.env.MAILBOXES_CONFIG);
      if (Array.isArray(boxes)) {
        boxes.forEach((b: any) => {
          if (b.email) emails.push(b.email.toLowerCase().trim());
          if (b.smtpUser && b.smtpUser.includes('@')) emails.push(b.smtpUser.toLowerCase().trim());
          if (b.imapUser && b.imapUser.includes('@')) emails.push(b.imapUser.toLowerCase().trim());
        });
      }
    } catch {}
  }
  ['GMAIL_USER', 'IMAP_USER', 'SMTP_USER', 'GOOGLE_COMMON_MAILBOX'].forEach((envKey) => {
    const val = process.env[envKey];
    if (val) emails.push(val.toLowerCase().trim());
  });
  return Array.from(new Set(emails));
}

/**
 * Evaluates an incoming message's recipients against registered active mail aliases.
 * 1. Prioritizes explicit recipient matching (To, CC, BCC) so users only see emails sent to their personal alias.
 * 2. If no individual personal alias matched, but the email was sent to an organizational company mailbox
 *    (e.g., founder@, business@, team@), routes to all active company administrators.
 */
export async function evaluateEmailOwnership(params: {
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  fromAddress: string;
  deliveredTo?: string;
}): Promise<InboundEmailMatch[]> {
  const allAliases = await dataStore.listAllAliases();
  const activeAliases = allAliases.filter((a) => a.is_active);

  const cleanTo = (params.toAddresses || []).map(normalizeEmail).filter(Boolean);
  const cleanCc = (params.ccAddresses || []).map(normalizeEmail).filter(Boolean);
  const cleanBcc = (params.bccAddresses || []).map(normalizeEmail).filter(Boolean);
  const cleanDelivered = params.deliveredTo ? normalizeEmail(params.deliveredTo) : '';

  const configuredMailboxEmails = getConfiguredMailboxEmails();

  const matches: InboundEmailMatch[] = [];
  const seenUserIds = new Set<string>();

  // 1. Strict explicit recipient matching (To, CC, BCC)
  for (const alias of activeAliases) {
    const aliasEmail = alias.email_address.toLowerCase().trim();

    let matchedType: 'to' | 'cc' | 'bcc' | null = null;
    if (cleanTo.includes(aliasEmail)) {
      matchedType = 'to';
    } else if (cleanCc.includes(aliasEmail)) {
      matchedType = 'cc';
    } else if (cleanBcc.includes(aliasEmail)) {
      matchedType = 'bcc';
    }

    if (matchedType && !seenUserIds.has(alias.user_id)) {
      const user = await dataStore.getUserById(alias.user_id);
      if (user && user.status === 'active') {
        seenUserIds.add(alias.user_id);
        matches.push({
          matchedUser: user,
          matchedAlias: alias,
          recipientType: matchedType,
        });
      }
    }
  }

  // 2. If no individual recipient alias matched, check for company/organizational mailbox routing
  if (matches.length === 0 && configuredMailboxEmails.length > 0) {
    const isCompanyMailbox = configuredMailboxEmails.some(
      (mEmail) =>
        cleanDelivered === mEmail ||
        cleanTo.includes(mEmail) ||
        cleanCc.includes(mEmail) ||
        cleanBcc.includes(mEmail)
    );

    if (isCompanyMailbox) {
      // All-admin company mail routing: Route organizational mailbox communications to all active system administrators
      const allUsers = await dataStore.listUsers();
      const adminUsers = allUsers.filter((u) => u.role === 'admin' && u.status === 'active');
      for (const adminUser of adminUsers) {
        if (!seenUserIds.has(adminUser.id)) {
          seenUserIds.add(adminUser.id);
          const adminAlias = activeAliases.find((a) => a.user_id === adminUser.id) || {
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
  }

  // 3. Fallback for single-alias deliveredTo match if still unmatched
  if (matches.length === 0 && cleanDelivered) {
    const deliveredAlias = activeAliases.find((a) => a.email_address.toLowerCase().trim() === cleanDelivered);
    if (deliveredAlias && !seenUserIds.has(deliveredAlias.user_id)) {
      const user = await dataStore.getUserById(deliveredAlias.user_id);
      if (user && user.status === 'active') {
        matches.push({
          matchedUser: user,
          matchedAlias: deliveredAlias,
          recipientType: 'to',
        });
      }
    }
  }

  return matches;
}
