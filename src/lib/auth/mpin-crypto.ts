/**
 * Cruvels Workplace OS - Zero-Trust Device MPIN Security Engine
 *
 * Provides client-side Web Crypto AES-GCM (256-bit) encryption using PBKDF2
 * key derivation from a 4-digit MPIN + cryptographic salt.
 * Enables persistent, secure, passwordless device unlock within WebViews and mobile browsers.
 */

export interface MpinStoredUser {
  id: string;
  name: string;
  username: string;
  role: string;
  status?: string;
  primaryAlias?: string;
  avatar?: string | null;
  designation?: string | null;
  squad?: string | null;
  department?: string | null;
  mustChangePassword?: boolean;
}

export interface MpinDeviceRecord {
  version: 1;
  user: MpinStoredUser;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
  pinHashHex: string;
  createdAt: string;
  lastLoginAt: string;
}

const STORAGE_KEY = 'cruvels_device_mpin_v1';
const PBKDF2_ITERATIONS = 100_000;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
    return (globalThis as any).crypto.subtle;
  }
  throw new Error('Web Crypto API is not supported in this runtime environment.');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.getRandomValues) {
    return (globalThis as any).crypto.getRandomValues(array);
  }
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
}

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const len = cleanHex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM key from a 4-digit PIN using PBKDF2 (SHA-256)
 */
async function deriveMpinKey(pin: string, salt: Uint8Array, subtle: SubtleCrypto): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    enc.encode(pin) as any,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes a verification hash of PIN + salt for fast local check
 */
async function computePinHash(pin: string, saltHex: string, subtle: SubtleCrypto): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${pin}:${saltHex}:cruvels_mpin_salt`);
  const hashBuffer = await subtle.digest('SHA-256', data as any);
  return bufferToHex(hashBuffer);
}

/**
 * Encrypts persistent session credentials using a 4-digit PIN
 */
export async function encryptMpinSession(
  pin: string,
  sessionPayload: { token: string; user: MpinStoredUser }
): Promise<MpinDeviceRecord> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('MPIN must be exactly 4 numeric digits.');
  }

  const subtle = getSubtleCrypto();
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  const key = await deriveMpinKey(pin, salt, subtle);
  const saltHex = bufferToHex(salt);
  const ivHex = bufferToHex(iv);
  const pinHashHex = await computePinHash(pin, saltHex, subtle);

  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(sessionPayload));

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    plaintext as any
  );

  const record: MpinDeviceRecord = {
    version: 1,
    user: sessionPayload.user,
    saltHex,
    ivHex,
    ciphertextHex: bufferToHex(new Uint8Array(ciphertext)),
    pinHashHex,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  return record;
}

/**
 * Decrypts the persistent session payload given the entered 4-digit PIN
 */
export async function decryptMpinSession(
  pin: string,
  record: MpinDeviceRecord
): Promise<{ token: string; user: MpinStoredUser }> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('Invalid PIN format. Must be 4 digits.');
  }

  const subtle = getSubtleCrypto();
  const salt = hexToBuffer(record.saltHex);
  const iv = hexToBuffer(record.ivHex);

  // Fast verify hash before expensive PBKDF2/AES-GCM
  const checkHash = await computePinHash(pin, record.saltHex, subtle);
  if (checkHash !== record.pinHashHex) {
    throw new Error('Incorrect MPIN. Please try again.');
  }

  try {
    const key = await deriveMpinKey(pin, salt, subtle);
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      hexToBuffer(record.ciphertextHex) as any
    );

    const dec = new TextDecoder();
    const parsed = JSON.parse(dec.decode(decryptedBuffer));
    return parsed;
  } catch {
    throw new Error('Incorrect MPIN. Please try again.');
  }
}

/**
 * Local storage management helpers
 */
const memoryStore: Record<string, string> = {};

function getStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (k: string) => memoryStore[k] || null,
    setItem: (k: string, v: string) => { memoryStore[k] = v; },
    removeItem: (k: string) => { delete memoryStore[k]; },
  };
}

export function getStoredMpinRecord(): MpinDeviceRecord | null {
  try {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MpinDeviceRecord;
    if (parsed && parsed.version === 1 && parsed.ciphertextHex && parsed.user?.name) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveMpinRecord(record: MpinDeviceRecord): void {
  try {
    const storage = getStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    console.warn('[MPIN] Unable to persist record', err);
  }
}

export function clearStoredMpin(): void {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEY);
  } catch {}
}

export function updateMpinLastLogin(): void {
  const record = getStoredMpinRecord();
  if (record) {
    record.lastLoginAt = new Date().toISOString();
    saveMpinRecord(record);
  }
}

export const MAX_MPIN_ATTEMPTS = 5;
const ATTEMPTS_KEY = 'cruvels_mpin_failed_attempts_v1';

export function getMpinFailedAttempts(): number {
  try {
    const storage = getStorage();
    const raw = storage.getItem(ATTEMPTS_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function incrementMpinFailedAttempts(): number {
  try {
    const storage = getStorage();
    const count = getMpinFailedAttempts() + 1;
    storage.setItem(ATTEMPTS_KEY, String(count));
    if (count >= MAX_MPIN_ATTEMPTS) {
      // Automatic bruteforce wipe: purge stored credentials
      clearStoredMpin();
      resetMpinFailedAttempts();
    }
    return count;
  } catch {
    return 0;
  }
}

export function resetMpinFailedAttempts(): void {
  try {
    const storage = getStorage();
    storage.removeItem(ATTEMPTS_KEY);
  } catch {}
}
