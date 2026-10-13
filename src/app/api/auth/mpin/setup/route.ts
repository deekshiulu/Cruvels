import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { createSessionToken } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const dbUser = await dataStore.getUserById(user.id);
    if (!dbUser || dbUser.status !== 'active') {
      return NextResponse.json({ error: 'User is inactive or disabled', success: false }, { status: 403 });
    }

    const aliases = await dataStore.getAliasesByUserId(user.id);
    const activeAliases = aliases.filter((a) => a.is_active).map((a) => a.email_address);
    const sessionToken = await createSessionToken(dbUser, activeAliases);

    const employee = await dataStore.getEmployeeByUserId(user.id);
    const group = employee?.group_id ? await dataStore.getGroupById(employee.group_id) : null;
    const department = employee?.department_id ? await dataStore.getDepartmentById(employee.department_id) : null;

    return NextResponse.json({
      success: true,
      token: sessionToken,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        username: dbUser.username,
        role: dbUser.role,
        status: dbUser.status,
        primaryAlias: activeAliases[0] || `${dbUser.username}@cruvels.com`,
        designation: employee?.designation || null,
        squad: group?.name || null,
        department: department?.name || null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
