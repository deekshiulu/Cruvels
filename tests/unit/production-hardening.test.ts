import { describe, it, expect } from 'vitest';
import { getPasswordPolicyError } from '../../src/lib/auth/password-policy';
import { allowJsonFileStore, assertProductionDataBackend } from '../../src/lib/db/backend';
import { verifySignedSessionJwt } from '../../src/lib/auth/jwt-edge';
import { createSessionToken } from '../../src/lib/auth/session';
import { dataStore } from '../../src/lib/db/store';

describe('password policy', () => {
  it('rejects the shared seed password', () => {
    expect(getPasswordPolicyError('Password123!')).toBeTruthy();
  });

  it('accepts a unique strong password', () => {
    expect(getPasswordPolicyError('HarbourKite9x')).toBeNull();
  });
});

describe('production backend guard', () => {
  it('allows the JSON store under Vitest', () => {
    expect(allowJsonFileStore()).toBe(true);
    expect(() => assertProductionDataBackend()).not.toThrow();
  });
});

describe('forced password rotation', () => {
  it('seeds users with must_change_password', async () => {
    const admin = await dataStore.getUserByUsername('admin');
    expect(admin?.must_change_password).toBe(true);
  });

  it('clears the flag after a successful password change', async () => {
    const admin = await dataStore.getUserByUsername('admin');
    const result = await dataStore.changeUserPassword(admin!.id, 'Password123!', 'HarbourKite9x');
    expect(result.success).toBe(true);
    const updated = await dataStore.getUserById(admin!.id);
    expect(updated?.must_change_password).toBe(false);
  });
});

describe('edge JWT verification', () => {
  it('rejects garbage cookies', async () => {
    expect(await verifySignedSessionJwt('not-a-jwt')).toBeNull();
  });

  it('accepts a signed session token', async () => {
    const user = await dataStore.getUserByUsername('rahul');
    const token = await createSessionToken(user!, ['rahul@cruvels.com']);
    const payload = await verifySignedSessionJwt(token);
    expect(payload?.user?.id).toBe(user!.id);
  });
});
