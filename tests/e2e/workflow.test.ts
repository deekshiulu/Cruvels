import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../../src/lib/db/store';
import {
  createSessionToken,
  verifySessionToken,
  verifyPassword,
  hashPassword,
} from '../../src/lib/auth/session';
import { runIncrementalEmailSync } from '../../src/lib/email/sync';
import { sendAuthorizedEmail } from '../../src/lib/email/sender';
import { assertMessageOwnership } from '../../src/lib/security/authorization';

describe('End-to-End Mail Portal Workflow & Administration Tests', () => {
  beforeEach(async () => {
    dataStore.resetAndSeed();

    // Create user Rahul for workflow tests
    const user = await dataStore.createUser({
      name: 'Rahul Sharma',
      username: 'rahul',
      role: 'intern',
      status: 'active',
      password_hash: hashPassword('Password123!'),
    });
    await dataStore.createAlias(user.id, 'rahul@cruvels.com');
  });

  it('executes full intern workflow: login, sync, read, reply, send, and sent mail validation', async () => {
    // 1. Authenticate Intern A (Rahul)
    const user = await dataStore.getUserByUsername('rahul');
    expect(user).toBeDefined();
    expect(verifyPassword('Password123!', user!.password_hash)).toBe(true);

    const aliases = (await dataStore.getAliasesByUserId(user!.id)).map((a) => a.email_address);
    const token = await createSessionToken(user!, aliases);
    expect(token).toBeDefined();

    const session = await verifySessionToken(token);
    expect(session).toBeDefined();
    expect(session!.username).toBe('rahul');
    expect(session!.primaryAlias).toBe('rahul@cruvels.com');

    // 2. Incremental Email Sync
    const syncRes = await runIncrementalEmailSync();
    expect(syncRes.success).toBe(true);
    expect(syncRes.ingestedCount).toBeGreaterThanOrEqual(1);

    // 3. Query Inbox
    const inbox = await dataStore.getMessagesByOwner(session!.id, { folder: 'inbox' });
    expect(inbox.total).toBeGreaterThan(0);
    const firstMsg = inbox.messages[0];

    // 4. Assert Ownership and Read Message
    const msg = await assertMessageOwnership(session!, firstMsg.id);
    expect(msg.owner_user_id).toBe(session!.id);

    // Mark as read
    await dataStore.updateMessage(msg.id, { is_read: true });
    const updatedMsg = await dataStore.getMessageById(msg.id);
    expect(updatedMsg?.is_read).toBe(true);

    // 5. Send Authorized Reply
    const replyRes = await sendAuthorizedEmail(session!, {
      to: [firstMsg.from_address],
      subject: `Re: ${firstMsg.subject}`,
      bodyText: 'Acknowledged, starting work on this immediately.',
      replyToMessageId: firstMsg.id,
    });
    expect(replyRes.success).toBe(true);
    expect(replyRes.from).toBe('rahul@cruvels.com');

    // 6. Verify Sent Box contains reply
    const sentBox = await dataStore.getMessagesByOwner(session!.id, { folder: 'sent' });
    expect(sentBox.total).toBeGreaterThanOrEqual(1);
    expect(sentBox.messages.some((m) => m.id === replyRes.messageId)).toBe(true);
  });

  it('executes administrator workflow: create intern, assign alias, disable account, and verify immediate session revocation', async () => {
    // 1. Admin creates new Intern
    const newIntern = await dataStore.createUser({
      name: 'Suresh Kumar',
      username: 'suresh',
      role: 'intern',
      status: 'active',
      password_hash: hashPassword('Password123!'),
    });

    const newAlias = await dataStore.createAlias(newIntern.id, 'suresh@cruvels.com');
    expect(newAlias.email_address).toBe('suresh@cruvels.com');

    // 2. Suresh logs in and gets token
    const token = await createSessionToken(newIntern, [newAlias.email_address]);
    const validSession = await verifySessionToken(token);
    expect(validSession).toBeDefined();
    expect(validSession!.username).toBe('suresh');

    // 3. Admin disables Suresh's account
    await dataStore.updateUser(newIntern.id, { status: 'disabled' });

    // 4. Immediate Session Invalidation: Token is now rejected
    const revokedSession = await verifySessionToken(token);
    expect(revokedSession).toBeNull();
  });
});
