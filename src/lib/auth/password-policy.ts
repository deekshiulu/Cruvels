const BLOCKED_PASSWORDS = new Set([
  'Password123!',
  'password123',
  'Password123',
  'admin123',
  'Cruvels123!',
  'Welcome123!',
]);

export function getPasswordPolicyError(password: string): string | null {
  if (!password || password.length < 10) {
    return 'Password must be at least 10 characters.';
  }
  if (password.length > 100) {
    return 'Password must be at most 100 characters.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include uppercase, lowercase, and a number.';
  }
  if (BLOCKED_PASSWORDS.has(password) || /password123/i.test(password)) {
    return 'This password is not allowed. Choose a unique password that is not shared across accounts.';
  }
  return null;
}
