import crypto from 'crypto';

/**
 * Standard secure PBKDF2 password hashing with cryptographically random salt (100,000 iterations).
 * Format: $pbkdf2$100000$<salt_hex>$<hash_hex>
 */
export function hashPassword(password: string, customSalt?: string): string {
  const iterations = 100000;
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `$pbkdf2$${iterations}$${salt}$${hash}`;
}

/**
 * Constant-time password verification supporting standard salted hashes and legacy seed format.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('$pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length === 5) {
      const iterations = parseInt(parts[2], 10) || 100000;
      const salt = parts[3];
      const expectedHash = parts[4];
      const calculatedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');

      const bufA = Buffer.from(calculatedHash, 'hex');
      const bufB = Buffer.from(expectedHash, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    }
  }

  const legacySalt = 'cruvels_static_salt_for_dev_seed';
  const legacyHash = crypto.pbkdf2Sync(password, legacySalt, 10000, 64, 'sha512').toString('hex');
  const bufA = Buffer.from(legacyHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
    return true;
  }

  return false;
}
