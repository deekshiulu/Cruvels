import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dataStore } from '@/lib/db/store';
import { createSessionToken, verifyPassword, hashPassword, applySessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logAuditEvent } from '@/lib/audit/logger';

const LoginSchema = z.object({
  usernameOrEmail: z.string().optional(),
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required').max(100),
}).refine((data) => Boolean(data.usernameOrEmail || data.username || data.email), {
  message: 'Username or email is required',
});

const DUMMY_HASH = '$pbkdf2$100000$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export async function POST(req: NextRequest) {
  const rawIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const isIpValid = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]+$/.test(rawIp);
  const ip = isIpValid ? rawIp : '127.0.0.1';
  
  // 1. Rate Limiting Check (10 attempts per minute per IP)
  const rateCheck = await checkRateLimit(`login:${ip}`, 10, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Please try again in ${rateCheck.resetInSec} seconds.`, success: false },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parseRes = LoginSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: parseRes.error.errors[0]?.message || 'Invalid login credentials format.', success: false },
        { status: 400 }
      );
    }

    const { usernameOrEmail, username, email, password } = parseRes.data;
    const cleanInput = (usernameOrEmail || username || email || '').trim();

    // 1b. Identifier-level Rate Limiting Check (15 attempts per 5 minutes per account/alias)
    const identCheck = await checkRateLimit(`login:ident:${cleanInput.toLowerCase()}`, 15, 300);
    if (!identCheck.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts for this account. Please try again in ${identCheck.resetInSec} seconds.`, success: false },
        { status: 429 }
      );
    }

    // 2. Find user by username or assigned alias
    let user = await dataStore.getUserByUsername(cleanInput);
    if (!user) {
      user = await dataStore.getUserByEmail(cleanInput);
    }

    if (!user) {
      // Execute dummy constant-time verification to prevent timing attack enumeration
      verifyPassword(password, DUMMY_HASH);
      
      await logAuditEvent({
        action: 'LOGIN_FAILED',
        resourceType: 'AUTH',
        metadata: { attemptedIdentifier: cleanInput, reason: 'User not found' },
        req,
      });
      return NextResponse.json(
        { error: 'Invalid username/email or password.', success: false },
        { status: 401 }
      );
    }

    // 3. Check Account Status
    if (user.status === 'disabled' || user.status === 'suspended') {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_BLOCKED_DISABLED',
        resourceType: 'AUTH',
        metadata: { status: user.status },
        req,
      });
      return NextResponse.json(
        { error: 'Access denied. Your account is disabled. Please contact your administrator.', success: false },
        { status: 403 }
      );
    }

    // 4. Verify Password
    const passwordMatch = verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resourceType: 'AUTH',
        metadata: { reason: 'Incorrect password' },
        req,
      });
      return NextResponse.json(
        { error: 'Invalid username/email or password.', success: false },
        { status: 401 }
      );
    }

    if (!user.password_hash.startsWith('$pbkdf2$100000$')) {
      await dataStore.updateUser(user.id, { password_hash: hashPassword(password) });
      user = (await dataStore.getUserById(user.id)) || user;
    }

    // 5. Fetch assigned aliases
    const aliases = await dataStore.getAliasesByUserId(user.id);
    const activeAliases = aliases.filter((a) => a.is_active).map((a) => a.email_address);

    // 6. Generate Session Token
    const sessionToken = await createSessionToken(user, activeAliases);

    // Update last_login_at
    await dataStore.updateUser(user.id, { last_login_at: new Date().toISOString() });

    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      metadata: { role: user.role },
      req,
    });

    const mustChangePassword = Boolean(user.must_change_password);
    const response = NextResponse.json({
      success: true,
      mustChangePassword,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
        assignedAliases: activeAliases,
        primaryAlias: activeAliases[0] || `${user.username}@cruvels.com`,
        mustChangePassword,
      },
    });

    applySessionCookie(response, sessionToken);

    return response;
  } catch (err: any) {
    console.error('[LOGIN API ERROR]', err);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred.', success: false },
      { status: 500 }
    );
  }
}
