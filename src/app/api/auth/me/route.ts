import { dataStore } from '@/lib/db/store';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const dbUser = await dataStore.getUserById(user.id);
    const mustChangePassword = dbUser ? Boolean(dbUser.must_change_password) : Boolean(user.mustChangePassword);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: dbUser?.name || user.name,
        username: dbUser?.username || user.username,
        role: dbUser?.role || user.role,
        status: dbUser?.status || user.status,
        assignedAliases: user.assignedAliases,
        primaryAlias: user.primaryAlias,
        employeeId: user.employeeId || null,
        groupId: user.groupId || null,
        isGroupLeader: Boolean(user.isGroupLeader),
        mustChangePassword,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
