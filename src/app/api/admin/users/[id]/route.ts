import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/session';
import { getPasswordPolicyError } from '@/lib/auth/password-policy';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['admin', 'manager', 'team_lead', 'employee', 'intern']).optional(),
  status: z.enum(['active', 'disabled', 'suspended']).optional(),
  password: z.string().min(10, 'Password must be at least 10 characters long').optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await context.params;

    const user = await dataStore.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found.', success: false }, { status: 404 });
    }

    const body = await req.json();
    const parseRes = UpdateUserSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: parseRes.error.errors[0]?.message || 'Invalid update parameters.', success: false },
        { status: 400 }
      );
    }

    // Safety check: Prevent self-lockout or self-demotion if last admin
    if (admin.id === user.id && parseRes.data.status === 'disabled') {
      return NextResponse.json(
        { error: 'Security safeguard: Administrators cannot disable their own account.', success: false },
        { status: 400 }
      );
    }

    if (admin.id === user.id && parseRes.data.role && parseRes.data.role !== 'admin') {
      const allUsers = await dataStore.listUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin' && u.status === 'active').length;
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Security safeguard: Cannot demote the only active administrator.', success: false },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {};
    if (parseRes.data.name) updates.name = parseRes.data.name;
    if (parseRes.data.role) {
      updates.role = parseRes.data.role;
      await logAuditEvent({
        userId: admin.id,
        action: 'ADMIN_CHANGE_ROLE',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { previousRole: user.role, newRole: parseRes.data.role, username: user.username },
        req,
      });
    }

    if (parseRes.data.status) {
      updates.status = parseRes.data.status;
      await logAuditEvent({
        userId: admin.id,
        action: parseRes.data.status === 'disabled' ? 'ADMIN_DISABLE_USER' : 'ADMIN_ENABLE_USER',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { previousStatus: user.status, newStatus: parseRes.data.status },
        req,
      });
    }

    if (parseRes.data.password) {
      const policyError = getPasswordPolicyError(parseRes.data.password);
      if (policyError) {
        return NextResponse.json({ error: policyError, success: false }, { status: 400 });
      }
      updates.password_hash = hashPassword(parseRes.data.password);
      updates.must_change_password = true;
      await logAuditEvent({
        userId: admin.id,
        action: 'ADMIN_RESET_ACCESS',
        resourceType: 'USER',
        resourceId: user.id,
        metadata: { username: user.username },
        req,
      });
    }

    const updatedUser = await dataStore.updateUser(user.id, updates);

    // If role or name changed, sync employee record
    if (parseRes.data.name || parseRes.data.role) {
      const emp = await dataStore.getEmployeeByUserId(user.id);
      if (emp) {
        await dataStore.updateEmployee(emp.id, {
          ...(parseRes.data.name ? { name: parseRes.data.name } : {}),
          ...(parseRes.data.role === 'admin' || parseRes.data.role === 'manager' || parseRes.data.role === 'team_lead'
            ? { is_group_leader: true }
            : {}),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully.',
      user: {
        id: updatedUser?.id,
        name: updatedUser?.name,
        username: updatedUser?.username,
        role: updatedUser?.role,
        status: updatedUser?.status,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
