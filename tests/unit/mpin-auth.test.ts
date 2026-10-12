import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptMpinSession,
  decryptMpinSession,
  getStoredMpinRecord,
  saveMpinRecord,
  clearStoredMpin,
  MpinStoredUser,
} from '@/lib/auth/mpin-crypto';
import { dataStore } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';
import { POST as mpinLoginRoute } from '@/app/api/auth/mpin/route';
import { NextRequest } from 'next/server';

describe('Zero-Trust MPIN Persistent Device Authentication Suite', () => {
  const dummyUser: MpinStoredUser = {
    id: 'user-mpin-test-1',
    name: 'Jane Doe',
    username: 'janedoe',
    role: 'employee',
    primaryAlias: 'janedoe@cruvels.com',
    designation: 'Senior Frontend Engineer',
    squad: 'Alpha',
  };

  const sampleSessionPayload = {
    token: 'header.jwt_encrypted_token_payload_sample.signature',
    user: dummyUser,
  };

  it('encrypts session payload using 4-digit PIN and successfully decrypts with correct PIN', async () => {
    const pin = '4826';
    const record = await encryptMpinSession(pin, sampleSessionPayload);

    expect(record.version).toBe(1);
    expect(record.user.name).toBe('Jane Doe');
    expect(record.ciphertextHex).toBeDefined();
    expect(record.saltHex).toBeDefined();
    expect(record.ivHex).toBeDefined();
    expect(record.pinHashHex).toBeDefined();

    const decrypted = await decryptMpinSession(pin, record);
    expect(decrypted.token).toBe(sampleSessionPayload.token);
    expect(decrypted.user.username).toBe('janedoe');
    expect(decrypted.user.designation).toBe('Senior Frontend Engineer');
  });

  it('rejects decryption when an incorrect MPIN is entered', async () => {
    const correctPin = '1234';
    const wrongPin = '9999';
    const record = await encryptMpinSession(correctPin, sampleSessionPayload);

    await expect(decryptMpinSession(wrongPin, record)).rejects.toThrow(
      'Incorrect MPIN. Please try again.'
    );
  });

  it('enforces 4-digit numeric constraints', async () => {
    await expect(encryptMpinSession('123', sampleSessionPayload)).rejects.toThrow(
      'MPIN must be exactly 4 numeric digits.'
    );
    await expect(encryptMpinSession('12345', sampleSessionPayload)).rejects.toThrow(
      'MPIN must be exactly 4 numeric digits.'
    );
    await expect(encryptMpinSession('abcd', sampleSessionPayload)).rejects.toThrow(
      'MPIN must be exactly 4 numeric digits.'
    );
  });

  it('authenticates valid session token through POST /api/auth/mpin and returns enriched user', async () => {
    // 1. Ensure user exists in dataStore
    let user = await dataStore.getUserByUsername('intern.test');
    if (!user) {
      const users = await dataStore.listUsers();
      user = users[0];
    }
    expect(user).toBeDefined();

    const aliases = await dataStore.getAliasesByUserId(user!.id);
    const token = await createSessionToken(user!, aliases.map((a) => a.email_address));

    // 2. Call MPIN login API
    const req = new NextRequest('http://localhost:3000/api/auth/mpin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId: user!.id }),
    });

    const res = await mpinLoginRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.id).toBe(user!.id);
    expect(data.user.name).toBe(user!.name);

    // Verify session cookie was applied
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('cruvels_session=');
  });

  it('rejects expired or forged tokens in /api/auth/mpin', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
    const req = new NextRequest('http://localhost:3000/api/auth/mpin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fakeToken }),
    });

    const res = await mpinLoginRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.requiresPasswordLogin).toBe(true);
  });

  it('triggers 5-attempt bruteforce lockout and automatically clears stored credentials', async () => {
    const {
      incrementMpinFailedAttempts,
      resetMpinFailedAttempts,
      getMpinFailedAttempts,
      saveMpinRecord,
      getStoredMpinRecord,
      MAX_MPIN_ATTEMPTS,
    } = await import('@/lib/auth/mpin-crypto');

    resetMpinFailedAttempts();
    expect(getMpinFailedAttempts()).toBe(0);

    const record = await encryptMpinSession('1234', sampleSessionPayload);
    saveMpinRecord(record);
    expect(getStoredMpinRecord()).not.toBeNull();

    // 4 failed attempts: counter increments, record persists
    for (let i = 1; i < MAX_MPIN_ATTEMPTS; i++) {
      const count = incrementMpinFailedAttempts();
      expect(count).toBe(i);
      expect(getStoredMpinRecord()).not.toBeNull();
    }

    // 5th failed attempt: reaches threshold, triggers wipeout
    const finalCount = incrementMpinFailedAttempts();
    expect(finalCount).toBe(MAX_MPIN_ATTEMPTS);
    expect(getStoredMpinRecord()).toBeNull();
  });
});
