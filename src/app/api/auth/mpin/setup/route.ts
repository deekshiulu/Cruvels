import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { createSessionToken, verifySessionToken, applySessionCookie } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let userId: string | null = null;

    // 1. Authenticate user from active session cookie OR passed session token
    const cookieUser = await requireActiveUser(req).catch(() => null);
    if (cookieUser?.id) {
      userId = cookieUser.id;
    } else if (body?.token) {
      const tokenUser = await verifySessionToken(body.token);
      if (tokenUser?.id) {
        userId = tokenUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required to configure MPIN.', success: false },
        { status: 401 }
      );
    }

    const dbUser = await dataStore.getUserById(userId);
    if (!dbUser || dbUser.status !== 'active') {
      return NextResponse.json(
        { error: 'User is inactive or disabled', success: false },
        { status: 403 }
      );
    }

    // 2. Mode 'verify_existing': When linking an additional device with existing account MPIN
    if (body?.mode === 'verify_existing') {
      const pin = String(body?.pin || '').trim();
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { error: 'MPIN must be exactly 4 numeric digits.', success: false },
          { status: 400 }
        );
      }
      const isValid = await dataStore.verifyUserMpin(dbUser.id, pin);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Incorrect Account MPIN. Please enter your existing 4-digit PIN.', success: false },
          { status: 401 }
        );
      }
    } else if (body?.pin) {
      // 3. Setting or updating MPIN in the database
      const pin = String(body.pin).trim();
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { error: 'MPIN must be exactly 4 numeric digits.', success: false },
          { status: 400 }
        );
      }
      const saveRes = await dataStore.setUserMpin(dbUser.id, pin);
      if (!saveRes.success) {
        return NextResponse.json(
          { error: saveRes.error || 'Failed to save MPIN to database.', success: false },
          { status: 400 }
        );
      }

      await logAuditEvent({
        userId: dbUser.id,
        action: 'PROFILE_UPDATED',
        resourceType: 'AUTH',
        metadata: { field: 'mpin_database_synced' },
        req,
      });
    }

    const aliases = await dataStore.getAliasesByUserId(dbUser.id);
    const activeAliases = aliases.filter((a) => a.is_active).map((a) => a.email_address);
    const sessionToken = await createSessionToken(dbUser, activeAliases);

    const employee = await dataStore.getEmployeeByUserId(dbUser.id);
    const group = employee?.group_id ? await dataStore.getGroupById(employee.group_id) : null;
    const department = employee?.department_id ? await dataStore.getDepartmentById(employee.department_id) : null;

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      hasMpin: true,
      message: 'MPIN successfully saved to database.',
      user: {
        id: dbUser.id,
        name: dbUser.name,
        username: dbUser.username,
        role: dbUser.role,
        status: dbUser.status,
        hasMpin: true,
        primaryAlias: activeAliases[0] || `${dbUser.username}@cruvels.com`,
        designation: employee?.designation || null,
        squad: group?.name || null,
        department: department?.name || null,
      },
    });

    applySessionCookie(response, sessionToken, true);
    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
