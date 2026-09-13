import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeEmail, extractEmailList, evaluateEmailOwnership } from '../../src/lib/email/ownership';
import { dataStore } from '../../src/lib/db/store';
import { hashPassword } from '../../src/lib/auth/session';

describe('Email Ownership & Recipient Parsing Unit Tests', () => {
  beforeEach(async () => {
    dataStore.resetAndSeed();

    // Create disabled user Karan for negative authorization test
    const karan = await dataStore.createUser({
      name: 'Karan Mehra',
      username: 'karan',
      password_hash: hashPassword('Password123!'),
      role: 'intern',
      status: 'disabled',
    });
    await dataStore.createAlias(karan.id, 'karan@cruvels.com');
  });

  it('correctly normalizes email addresses', () => {
    expect(normalizeEmail('Rahul Sharma <rahul@cruvels.com>')).toBe('rahul@cruvels.com');
    expect(normalizeEmail('  PRIYA@CRUVELS.COM ')).toBe('priya@cruvels.com');
    expect(normalizeEmail('<karan@cruvels.com>')).toBe('karan@cruvels.com');
  });

  it('extracts unique email lists from header strings', () => {
    const header = 'rahul@cruvels.com, "Priya Patel" <priya@cruvels.com>, rahul@cruvels.com';
    const list = extractEmailList(header);
    expect(list).toEqual(['rahul@cruvels.com', 'priya@cruvels.com']);
  });

  it('Case 1: Email To: internA matches Intern A only', async () => {
    const matches = await evaluateEmailOwnership({
      toAddresses: ['rahul@cruvels.com'],
      fromAddress: 'manager@cruvels.com',
    });

    expect(matches.length).toBe(1);
    expect(matches[0].matchedUser.username).toBe('rahul');
    expect(matches[0].matchedAlias.email_address).toBe('rahul@cruvels.com');
    expect(matches[0].recipientType).toBe('to');
  });

  it('Case 2: Email To: internB matches Intern B, NOT Intern A', async () => {
    const matches = await evaluateEmailOwnership({
      toAddresses: ['priya@cruvels.com'],
      fromAddress: 'client@example.com',
    });

    expect(matches.length).toBe(1);
    expect(matches[0].matchedUser.username).toBe('priya');
    expect(matches.some((m) => m.matchedUser.username === 'rahul')).toBe(false);
  });

  it('Case 3: Email To: company@cruvels.com without intern alias is NOT exposed to interns', async () => {
    const matches = await evaluateEmailOwnership({
      toAddresses: ['company@cruvels.com', 'all-hands@cruvels.com'],
      fromAddress: 'executive@cruvels.com',
    });

    expect(matches.length).toBe(0);
  });

  it('Case 4: Email with CC to internA matches Intern A', async () => {
    const matches = await evaluateEmailOwnership({
      toAddresses: ['team@external.com'],
      ccAddresses: ['rahul@cruvels.com'],
      fromAddress: 'lead@cruvels.com',
    });

    expect(matches.length).toBe(1);
    expect(matches[0].matchedUser.username).toBe('rahul');
    expect(matches[0].recipientType).toBe('cc');
  });

  it('does not route incoming email to disabled accounts', async () => {
    const matches = await evaluateEmailOwnership({
      toAddresses: ['karan@cruvels.com'], // Karan is disabled
      fromAddress: 'admin@cruvels.com',
    });

    expect(matches.length).toBe(0);
  });

  it('Case 5: Delivered-To header does NOT leak private email to mailbox owner when explicit alias matches', async () => {
    const matches = await evaluateEmailOwnership({
      toAddresses: ['rahul@cruvels.com'],
      fromAddress: 'client@example.com',
      deliveredTo: 'founder@cruvels.com',
    });

    expect(matches.length).toBe(1);
    expect(matches[0].matchedUser.username).toBe('rahul');
    expect(matches.some((m) => m.matchedUser.username === 'admin')).toBe(false);
  });

  it('Case 6: Organizational company mailbox emails route to all active admins', async () => {
    process.env.MAILBOXES_CONFIG = JSON.stringify([
      { id: 'box_founder', email: 'founder@cruvels.com' },
      { id: 'box_business', email: 'business@cruvels.com' }
    ]);

    const matches = await evaluateEmailOwnership({
      toAddresses: ['business@cruvels.com'],
      fromAddress: 'vendor@external.com',
    });

    // Should route to active admins, not to interns
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.matchedUser.role === 'admin')).toBe(true);
    expect(matches.some((m) => m.matchedUser.username === 'rahul')).toBe(false);
    expect(matches.some((m) => m.matchedUser.username === 'priya')).toBe(false);
  });
});
