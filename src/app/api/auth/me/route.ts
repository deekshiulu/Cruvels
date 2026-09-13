import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
        assignedAliases: user.assignedAliases,
        primaryAlias: user.primaryAlias,
        employeeId: user.employeeId || null,
        groupId: user.groupId || null,
        isGroupLeader: Boolean(user.isGroupLeader),
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
