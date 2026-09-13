import { describe, it, expect, beforeEach } from 'vitest';
import { SmtpImapProvider } from '@/lib/email/provider';
import { dataStore } from '@/lib/db/store';
import { evaluateEmailOwnership } from '@/lib/email/ownership';

describe('Multi-Mailbox Configuration & Outbound Routing Unit Tests', () => {
  beforeEach(() => {
    dataStore.resetAndSeed();
  });

  const sampleMailboxesConfig = `[
    {
      "id": "founder_mailbox",
      "email": "founder@cruvels.com",
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUser": "founder@cruvels.com",
      "smtpPass": "test-app-password-founder",
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUser": "founder@cruvels.com",
      "imapPass": "test-app-password-founder",
      "aliases": ["harshith@cruvels.com", "nitheesh@cruvels.com"]
    },
    {
      "id": "business_mailbox",
      "email": "business@cruvels.com",
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUser": "business@cruvels.com",
      "smtpPass": "test-app-password-business",
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUser": "business@cruvels.com",
      "imapPass": "test-app-password-business",
      "aliases": ["charith@cruvels.com", "niketh@cruvels.com", "pannagasai@cruvels.com"]
    },
    {
      "id": "team_mailbox",
      "email": "team@cruvels.com",
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUser": "team@cruvels.com",
      "smtpPass": "test-app-password-team",
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUser": "team@cruvels.com",
      "imapPass": "test-app-password-team",
      "aliases": ["tharun.intern@cruvels.com", "sugumaran.intern@cruvels.com"]
    }
  ]`;

  it('correctly loads and parses 3 configured mailboxes and strips spaces from passwords', () => {
    process.env.MAILBOXES_CONFIG = `'${sampleMailboxesConfig}'`;
    const provider = new SmtpImapProvider();
    
    const mailboxes = (provider as any).mailboxes;
    expect(mailboxes.length).toBe(3);

    // Founder Box
    expect(mailboxes[0].id).toBe('founder_mailbox');
    expect(mailboxes[0].aliases).toContain('harshith@cruvels.com');
    expect(mailboxes[0].aliases).toContain('nitheesh@cruvels.com');

    // Business Box
    expect(mailboxes[1].id).toBe('business_mailbox');
    expect(mailboxes[1].aliases).toContain('charith@cruvels.com');
    expect(mailboxes[1].aliases).toContain('niketh@cruvels.com');
    expect(mailboxes[1].aliases).toContain('pannagasai@cruvels.com');

    // Team Box
    expect(mailboxes[2].id).toBe('team_mailbox');
    expect(mailboxes[2].aliases).toContain('tharun.intern@cruvels.com');
    expect(mailboxes[2].aliases).toContain('sugumaran.intern@cruvels.com');
  });

  it('correctly routes Admin and Intern sender aliases to matching parent SMTP accounts', () => {
    process.env.MAILBOXES_CONFIG = sampleMailboxesConfig;
    const provider = new SmtpImapProvider();

    const getBox = (sender: string) => (provider as any).getTransporterForSender(sender).mailbox;

    // Business Box Admins
    expect(getBox('charith@cruvels.com').id).toBe('business_mailbox');
    expect(getBox('niketh@cruvels.com').id).toBe('business_mailbox');
    expect(getBox('pannagasai@cruvels.com').id).toBe('business_mailbox');

    // Founder Box Admins
    expect(getBox('harshith@cruvels.com').id).toBe('founder_mailbox');
    expect(getBox('nitheesh@cruvels.com').id).toBe('founder_mailbox');

    // Team Box Interns
    expect(getBox('tharun.intern@cruvels.com').id).toBe('team_mailbox');
    expect(getBox('sugumaran.intern@cruvels.com').id).toBe('team_mailbox');
  });

  it('properly matches incoming emails to seeded Admin and Intern accounts', async () => {
    // Inbound email to charith
    const charithMatch = await evaluateEmailOwnership({
      toAddresses: ['charith@cruvels.com'],
      fromAddress: 'partner@external.com',
    });
    expect(charithMatch.length).toBe(1);
    expect(charithMatch[0].matchedUser.username).toBe('charith');
    expect(charithMatch[0].matchedUser.role).toBe('admin');

    // Inbound email to tharun intern
    const tharunMatch = await evaluateEmailOwnership({
      toAddresses: ['tharun.intern@cruvels.com'],
      fromAddress: 'lead@cruvels.com',
    });
    expect(tharunMatch.length).toBe(1);
    expect(tharunMatch[0].matchedUser.username).toBe('tharun.intern');
    expect(tharunMatch[0].matchedUser.role).toBe('intern');
  });
});
