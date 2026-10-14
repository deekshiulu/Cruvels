import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dataStore } from '@/lib/db/store';
import { verifySessionToken, applySessionCookie, createSessionToken } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logAuditEvent } from '@/lib/audit/logger';

const MpinLoginSchema = z.object({
  token: z.string().min(10, 'Valid session token is required').optional(),
  userId: z.string().optional(),
  usernameOrEmail: z.string().optional(),
  pin: z.string().regex(/^\d{4}$/, 'MPIN must be exactly 4 digits').optional(),
});

export async function POST(req: NextRequest) {
  const rawIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const isIpValid = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]+$/.test(rawIp);
  const ip = isIpValid ? rawIp : '127.0.0.1';

  // 1. IP-level Rate Limiting (15 attempts per minute)
  const rateCheck = await checkRateLimit(`mpin-login:${ip}`, 15, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many unlock attempts. Please try again in ${rateCheck.resetInSec} seconds.`, success: false },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parseRes = MpinLoginSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: 'Invalid unlock payload format. Token or 4-digit PIN is required.', success: false },
        { status: 400 }
      );
    }

    const { token, userId, usernameOrEmail, pin } = parseRes.data;

    if (!token && !pin) {
      return NextResponse.json(
        { error: 'Either valid session token or 4-digit MPIN must be provided.', success: false },
        { status: 400 }
      );
    }

    // Determine target user if provided
    let targetUser = userId ? await dataStore.getUserById(userId) : null;
    if (!targetUser && usernameOrEmail) {
      const clean = usernameOrEmail.trim().toLowerCase();
      targetUser = (await dataStore.getUserByUsername(clean)) || (await dataStore.getUserByEmail(clean));
    }

    const effectiveUserId = targetUser?.id || userId;

    // 1b. User-level Rate Limiting Check (5 attempts per 5 minutes per user account)
    if (effectiveUserId) {
      const userRateCheck = await checkRateLimit(`mpin-user:${effectiveUserId}`, 5, 300);
      if (!userRateCheck.allowed) {
        return NextResponse.json(
          {
            error: `Too many failed MPIN attempts for this account. Session locked. Please sign in with your email and password.`,
            success: false,
            requiresPasswordLogin: true,
          },
          { status: 429 }
        );
      }
    }

    // 2. Direct MPIN verification against database if pin is supplied
    if (pin && targetUser) {
      const isPinValid = await dataStore.verifyUserMpin(targetUser.id, pin);
      if (!isPinValid) {
        return NextResponse.json(
          {
            error: 'Incorrect MPIN. Please try again.',
            success: false,
          },
          { status: 401 }
        );
      }
    }

    // 3. Cryptographic Session Token Verification if token is provided
    let sessionUser: any = null;
    if (token) {
      sessionUser = await verifySessionToken(token);
      if (!sessionUser && !pin) {
        return NextResponse.json(
          {
            error: 'Your saved session has expired or your password was changed. Please sign in with your email and password.',
            success: false,
            requiresPasswordLogin: true,
          },
          { status: 401 }
        );
      }
      if (userId && sessionUser && sessionUser.id !== userId) {
        return NextResponse.json(
          { error: 'Identity verification mismatch. Please sign in again.', success: false },
          { status: 401 }
        );
      }
    }

    // 4. Resolve authenticated database user
    const dbUserId = sessionUser?.id || targetUser?.id;
    if (!dbUserId) {
      return NextResponse.json(
        { error: 'Unable to identify user account.', success: false },
        { status: 400 }
      );
    }

    const dbUser = await dataStore.getUserById(dbUserId);
    if (!dbUser || dbUser.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is disabled or inactive. Contact administrator.', success: false },
        { status: 403 }
      );
    }

    // 5. Update last_login_at
    await dataStore.updateUser(dbUser.id, { last_login_at: new Date().toISOString() });

    // 6. Fetch enriched details (group, department, designation, aliases)
    const aliases = await dataStore.getAliasesByUserId(dbUser.id);
    const activeAliases = aliases.filter((a) => a.is_active).map((a) => a.email_address);
    const employee = await dataStore.getEmployeeByUserId(dbUser.id);
    const group = employee?.group_id ? await dataStore.getGroupById(employee.group_id) : null;
    const department = employee?.department_id ? await dataStore.getDepartmentById(employee.department_id) : null;

    // Generate or refresh active session token
    const activeToken = token && sessionUser ? token : await createSessionToken(dbUser, activeAliases);

    await logAuditEvent({
      userId: dbUser.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      metadata: { method: 'MPIN_QUICK_UNLOCK', role: dbUser.role },
      req,
    });

    const response = NextResponse.json({
      success: true,
      token: activeToken,
      mustChangePassword: Boolean(dbUser.must_change_password),
      user: {
        id: dbUser.id,
        name: dbUser.name,
        username: dbUser.username,
        role: dbUser.role,
        status: dbUser.status,
        hasMpin: Boolean(dbUser.mpin_hash),
        assignedAliases: activeAliases,
        primaryAlias: activeAliases[0] || `${dbUser.username}@cruvels.com`,
        mustChangePassword: Boolean(dbUser.must_change_password),
        employeeId: employee?.id || null,
        designation: employee?.designation || null,
        squad: group?.name || null,
        department: department?.name || null,
      },
    });

    // Apply persistent session cookie (30-day remember-me)
    applySessionCookie(response, activeToken, true);

    return response;
  } catch (err: any) {
    console.error('[MPIN LOGIN ERROR]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying MPIN.', success: false },
      { status: 500 }
    );
  }
}
