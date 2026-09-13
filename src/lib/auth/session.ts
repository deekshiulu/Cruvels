import { SignJWT } from 'jose';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { AuthSessionUser, User } from '../db/types';
import { dataStore } from '../db/store';
import { hashPassword, verifyPassword } from './password';
import { AUTH_COOKIE_NAME, getJwtSecretBytes, verifySignedSessionJwt } from './jwt-edge';

export { hashPassword, verifyPassword, AUTH_COOKIE_NAME };
const SESSION_MAX_AGE_SEC = 60 * 60 * 24;

function getJwtSecret(): Uint8Array {
  return getJwtSecretBytes();
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function createSessionToken(user: User, assignedAliases: string[]): Promise<string> {
  const primaryAlias = assignedAliases[0] || `${user.username}@cruvels.com`;

  const payload: AuthSessionUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
    assignedAliases,
    primaryAlias,
  };

  const pwdFingerprint = crypto.createHash('sha256').update(user.password_hash + user.status).digest('hex').substring(0, 16);

  const jwt = await new SignJWT({
    user: payload,
    fprint: pwdFingerprint,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject(user.id)
    .setExpirationTime(process.env.SESSION_EXPIRY_HOURS ? `${process.env.SESSION_EXPIRY_HOURS}h` : '24h')
    .sign(getJwtSecret());

  return jwt;
}

export async function verifySessionToken(token: string): Promise<AuthSessionUser | null> {
  try {
    const payload = await verifySignedSessionJwt(token);
    if (!payload?.user) return null;
    const sessionUser = payload.user as AuthSessionUser;

    const dbUser = await dataStore.getUserById(sessionUser.id);
    if (!dbUser || dbUser.status !== 'active') {
      return null;
    }

    const expectedFingerprint = crypto.createHash('sha256').update(dbUser.password_hash + dbUser.status).digest('hex').substring(0, 16);
    if (typeof payload.fprint !== 'string' || payload.fprint !== expectedFingerprint) {
      return null;
    }

    const currentAliases = await dataStore.getAliasesByUserId(dbUser.id);
    const activeAliases = currentAliases.filter((a) => a.is_active).map((a) => a.email_address);
    const employee = await dataStore.getEmployeeByUserId(dbUser.id);

    return {
      id: dbUser.id,
      name: dbUser.name,
      username: dbUser.username,
      role: dbUser.role,
      status: dbUser.status,
      assignedAliases: activeAliases,
      primaryAlias: activeAliases[0] || `${dbUser.username}@cruvels.com`,
      employeeId: employee?.id || null,
      groupId: employee?.group_id || null,
      isGroupLeader: Boolean(employee?.is_group_leader),
      mustChangePassword: Boolean(dbUser.must_change_password),
    };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    const value = parts.slice(1).join('=').trim();
    if (name) {
      list[name] = decodeURIComponent(value);
    }
  });
  return list;
}
