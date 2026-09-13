import { jwtVerify } from 'jose';

/**
 * Edge-safe JWT helpers. Do not import Node APIs, the data store, or crypto here —
 * middleware runs on the Edge runtime.
 */
export const AUTH_COOKIE_NAME = 'cruvels_session';

export function getJwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'FATAL SECURITY CONFIGURATION: JWT_SECRET must be set and at least 32 characters long in production.'
      );
    }
    return new TextEncoder().encode(secret);
  }
  return new TextEncoder().encode(secret || 'cruvels-dev-only-jwt-secret-not-for-production-use');
}

export type EdgeSessionPayload = {
  sub?: string;
  fprint?: string;
  user?: {
    id?: string;
    status?: string;
    role?: string;
    username?: string;
  };
};

export async function verifySignedSessionJwt(token: string): Promise<EdgeSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes(), {
      algorithms: ['HS256'],
    });
    return payload as EdgeSessionPayload;
  } catch {
    return null;
  }
}
