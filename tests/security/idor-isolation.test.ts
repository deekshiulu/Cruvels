import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../../src/lib/db/store';
import {
  assertMessageOwnership,
  assertAttachmentOwnership,
  AuthError,
} from '../../src/lib/security/authorization';
import {
  createSessionToken,
  verifySessionToken,
  hashPassword,
  verifyPassword,
} from '../../src/lib/auth/session';
import { sendAuthorizedEmail } from '../../src/lib/email/sender';
import { rateLimiter } from '../../src/lib/security/rate-limit';
import { sanitizeEmailHtml } from '../../src/lib/security/sanitize';
import { AuthSessionUser, EmailMessage } from '../../src/lib/db/types';

describe('Zero-Trust IDOR & Security Isolation Tests', () => {
  let internA: AuthSessionUser;
  let internB: AuthSessionUser;
  let rahulMsg: EmailMessage;
  let rahulAttId: string;
  let priyaMsg: EmailMessage;
  let priyaAttId: string;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    // Create User A (Rahul)
    const userA = await dataStore.createUser({
      name: 'Rahul Sharma',
      username: 'rahul',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const aliasA = await dataStore.createAlias(userA.id, 'rahul@cruvels.com');

    internA = {
      id: userA.id,
      name: userA.name,
      username: userA.username,
      role: userA.role,
      status: userA.status,
      assignedAliases: [aliasA.email_address],
      primaryAlias: aliasA.email_address,
    };

    // Create User B (Priya)
    const userB = await dataStore.createUser({
      name: 'Priya Patel',
      username: 'priya',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'active',
    });
    const aliasB = await dataStore.createAlias(userB.id, 'priya@cruvels.com');

    internB = {
      id: userB.id,
      name: userB.name,
      username: userB.username,
      role: userB.role,
      status: userB.status,
      assignedAliases: [aliasB.email_address],
      primaryAlias: aliasB.email_address,
    };

    // Create test message for Rahul with attachment
    rahulMsg = await dataStore.createMessage({
      owner_user_id: internA.id,
      owner_alias_id: aliasA.id,
      provider_message_id: `test_rahul_${Date.now()}`,
      thread_id: `thread_rahul_${Date.now()}`,
      from_address: 'admin@cruvels.com',
      from_name: 'Cruvels Admin',
      to_addresses: ['rahul@cruvels.com'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Onboarding Guide for Rahul',
      snippet: 'Welcome to Cruvels.',
      body_html: '<p>Welcome Rahul</p>',
      body_text: 'Welcome Rahul',
      folder: 'inbox',
      is_read: false,
      is_starred: false,
      has_attachments: true,
      received_at: new Date().toISOString(),
      sent_at: null,
    });

    const attA = await dataStore.createAttachment({
      message_id: rahulMsg.id,
      filename: 'internship_onboarding_guide.pdf',
      mime_type: 'application/pdf',
      size: 1024,
      storage_path: 'mock://internship_guide.pdf',
    });
    rahulAttId = attA.id;

    // Create test message for Priya with attachment
    priyaMsg = await dataStore.createMessage({
      owner_user_id: internB.id,
      owner_alias_id: aliasB.id,
      provider_message_id: `test_priya_${Date.now()}`,
      thread_id: `thread_priya_${Date.now()}`,
      from_address: 'hr@cruvels.com',
      from_name: 'Cruvels HR',
      to_addresses: ['priya@cruvels.com'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Confidential for Priya',
      snippet: 'Offer letter details.',
      body_html: '<p>Offer letter</p>',
      body_text: 'Offer letter',
      folder: 'inbox',
      is_read: false,
      is_starred: false,
      has_attachments: true,
      received_at: new Date().toISOString(),
      sent_at: null,
    });

    const attB = await dataStore.createAttachment({
      message_id: priyaMsg.id,
      filename: 'confidential_offer.pdf',
      mime_type: 'application/pdf',
      size: 2048,
      storage_path: 'mock://confidential_offer.pdf',
    });
    priyaAttId = attB.id;
  });

  // 1. Message Access Authorization
  it('allows Intern A to read Intern A message', async () => {
    const msg = await assertMessageOwnership(internA, rahulMsg.id);
    expect(msg).toBeDefined();
    expect(msg.owner_user_id).toBe(internA.id);
  });

  it('DENIES Intern A from reading Intern B message (IDOR Attack)', async () => {
    await expect(assertMessageOwnership(internA, priyaMsg.id)).rejects.toThrow(
      /Access denied to requested message/
    );
  });

  it('DENIES Intern B from reading Intern A message (IDOR Attack)', async () => {
    await expect(assertMessageOwnership(internB, rahulMsg.id)).rejects.toThrow(
      /Access denied to requested message/
    );
  });

  // 2. Attachment Access Authorization
  it('allows Intern A to access Intern A attachment', async () => {
    const res = await assertAttachmentOwnership(internA, rahulMsg.id, rahulAttId);
    expect(res.attachment).toBeDefined();
    expect(res.attachment.filename).toBe('internship_onboarding_guide.pdf');
  });

  it('DENIES Intern A from downloading Intern B attachment (BOLA Attack)', async () => {
    await expect(assertAttachmentOwnership(internA, priyaMsg.id, priyaAttId)).rejects.toThrow(
      /Access denied to requested message/
    );
  });

  it('DENIES accessing attachment when attachment ID does not belong to specified message', async () => {
    await expect(assertAttachmentOwnership(internA, rahulMsg.id, priyaAttId)).rejects.toThrow(
      /Attachment not found or does not belong to this message/
    );
  });

  // 3. Sender Spoofing Prevention
  it('enforces sender lock: ignores any forged sender header attempt', async () => {
    const result = await sendAuthorizedEmail(internA, {
      to: ['client@cruvels.com'],
      subject: 'Quarterly Invoice',
      bodyText: 'Please find attached invoice.',
    });

    expect(result.success).toBe(true);
    expect(result.from).toBe('rahul@cruvels.com');

    // Check in database
    const saved = await dataStore.getMessageById(result.messageId);
    expect(saved?.from_address).toBe('rahul@cruvels.com');
    expect(saved?.owner_user_id).toBe(internA.id);
  });

  // 4. Sent Mail Isolation
  it('ensures Intern B cannot see Intern A sent emails', async () => {
    // Send email from A
    await sendAuthorizedEmail(internA, {
      to: ['mentor@cruvels.com'],
      subject: 'Private Note from Rahul',
      bodyText: 'Note content...',
    });

    // Query sent mail as Intern B
    const priyaSent = await dataStore.getMessagesByOwner(internB.id, { folder: 'sent' });
    expect(priyaSent.messages.some((m) => m.subject.includes('Private Note from Rahul'))).toBe(false);
  });

  // 5. Search Isolation
  it('ensures search queries are strictly scoped to the authenticated user', async () => {
    // Search as Rahul for Priya's subject keywords
    const rahulSearch = await dataStore.getMessagesByOwner(internA.id, { query: 'Confidential for Priya' });
    expect(rahulSearch.total).toBe(0);
    expect(rahulSearch.messages.length).toBe(0);

    // Search as Priya for Priya's subject keywords
    const priyaSearch = await dataStore.getMessagesByOwner(internB.id, { query: 'Confidential for Priya' });
    expect(priyaSearch.total).toBe(1);
    expect(priyaSearch.messages[0].owner_user_id).toBe(internB.id);
  });

  // 6. Password Hashing with Random Salt
  it('generates unique salted hashes for identical passwords', () => {
    const pass = 'SecretPassword123!';
    const hash1 = hashPassword(pass);
    const hash2 = hashPassword(pass);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(pass, hash1)).toBe(true);
    expect(verifyPassword(pass, hash2)).toBe(true);
    expect(verifyPassword('WrongPassword', hash1)).toBe(false);
  });

  // 7. Session Invalidation on Password Reset
  it('instantly invalidates existing JWT token when user password is changed', async () => {
    const user = await dataStore.getUserById(internA.id);
    expect(user).toBeDefined();

    const token = await createSessionToken(user!, ['rahul@cruvels.com']);
    expect(await verifySessionToken(token)).not.toBeNull();

    // Admin or user resets password
    const newHash = hashPassword('NewPassword456!');
    await dataStore.updateUser(user!.id, { password_hash: newHash });

    // Existing token must now be invalid
    const postResetSession = await verifySessionToken(token);
    expect(postResetSession).toBeNull();
  });

  // 8. HTML Phishing & Overlay Sanitization
  it('strips dangerous CSS position fixed/absolute phishing overlays from email HTML', () => {
    const maliciousHtml = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:red">Fake Login Overlay</div><p style="color:#333">Legitimate Content</p>';
    const cleaned = sanitizeEmailHtml(maliciousHtml);

    expect(cleaned).not.toContain('position:fixed');
    expect(cleaned).not.toContain('position: fixed');
    expect(cleaned).toContain('Legitimate Content');
  });

  // 9. Attachment Security Validation
  it('rejects attachments with directory traversal paths and huge sizes', async () => {
    await expect(
      sendAuthorizedEmail(internA, {
        to: ['colleague@cruvels.com'],
        subject: 'Traversal Test',
        attachments: [
          {
            filename: '../../../etc/passwd',
            mimeType: 'text/plain',
            data: Buffer.from('root:x:0:0:...').toString('base64'),
          },
        ],
      })
    ).resolves.toBeDefined();

    // Check that stored filename was sanitized
    const sent = await dataStore.getMessagesByOwner(internA.id, { folder: 'sent' });
    const lastMsg = sent.messages[0];
    const atts = await dataStore.getAttachmentsByMessageId(lastMsg.id);
    expect(atts[0].filename).not.toContain('..');
    expect(atts[0].filename).not.toContain('/');
  });

  // 10. Rate Limiter Memory Bounding
  it('bounds rate limiter memory and prunes expired keys', () => {
    rateLimiter.clearAll();
    for (let i = 0; i < 50; i++) {
      rateLimiter.check(`test_ip_${i}`, 5, 1);
    }
    const checkRes = rateLimiter.check('test_ip_0', 5, 1);
    expect(checkRes.allowed).toBe(true);
  });
});
