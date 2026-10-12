import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dataStore } from '@/lib/db/store';
import { verifySessionToken, applySessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logAuditEvent } from '@/lib/audit/logger';

const MpinLoginSchema = z.object({
  token: z.string().min(10, 'Valid session token is required'),
  userId: z.string().optional(),
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
        { error: 'Invalid unlock payload format.', success: false },
        { status: 400 }
      );
    }

    const { token, userId } = parseRes.data;

    // 2. Cryptographic Session Token Verification
    const sessionUser = await verifySessionToken(token);
    if (!sessionUser) {
      return NextResponse.json(
        {
          error: 'Your saved session has expired or your password was changed. Please sign in with your email and password.',
          success: false,
          requiresPasswordLogin: true,
        },
        { status: 401 }
      );
    }

    if (userId && sessionUser.id !== userId) {
      return NextResponse.json(
        { error: 'Identity verification mismatch. Please sign in again.', success: false },
        { status: 401 }
      );
    }

    // 3. User status check
    const dbUser = await dataStore.getUserById(sessionUser.id);
    if (!dbUser || dbUser.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is disabled or inactive. Contact administrator.', success: false },
        { status: 403 }
      );
    }

    // 4. Update last_login_at
    await dataStore.updateUser(dbUser.id, { last_login_at: new Date().toISOString() });

    // 5. Fetch enriched details (group, department, designation)
    const employee = await dataStore.getEmployeeByUserId(dbUser.id);
    const group = employee?.group_id ? await dataStore.getGroupById(employee.group_id) : null;
    const department = employee?.department_id ? await dataStore.getDepartmentById(employee.department_id) : null;

    await logAuditEvent({
      userId: dbUser.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      metadata: { method: 'MPIN_QUICK_UNLOCK', role: dbUser.role },
      req,
    });

    const response = NextResponse.json({
      success: true,
      mustChangePassword: Boolean(dbUser.must_change_password),
      user: {
        id: dbUser.id,
        name: dbUser.name,
        username: dbUser.username,
        role: dbUser.role,
        status: dbUser.status,
        assignedAliases: sessionUser.assignedAliases,
        primaryAlias: sessionUser.primaryAlias,
        mustChangePassword: Boolean(dbUser.must_change_password),
        employeeId: employee?.id || null,
        designation: employee?.designation || null,
        squad: group?.name || null,
        department: department?.name || null,
      },
    });

    // Apply persistent session cookie (30-day remember-me)
    applySessionCookie(response, token, true);

    return response;
  } catch (err: any) {
    console.error('[MPIN LOGIN ERROR]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying MPIN.', success: false },
      { status: 500 }
    );
  }
}
