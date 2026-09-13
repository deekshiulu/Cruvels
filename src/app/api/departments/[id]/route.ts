import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(10).optional(),
  head_name: z.string().min(2).max(100).optional(),
  head_id: z.string().optional(),
  description: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const department = await dataStore.getDepartmentById(id);
    if (!department) {
      return NextResponse.json({ error: 'Department not found.', success: false }, { status: 404 });
    }
    if (user.role !== 'admin' && user.role !== 'manager') {
      const emp = await dataStore.getEmployeeByUserId(user.id);
      if (!emp || emp.department_id !== department.id) {
        return NextResponse.json({ error: 'Access denied to this department.', success: false }, { status: 403 });
      }
    }
    return NextResponse.json({ success: true, department });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await context.params;
    const body = await req.json();

    const parseRes = UpdateDepartmentSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid department data.', success: false }, { status: 400 });
    }

    const updated = await dataStore.updateDepartment(id, parseRes.data);
    if (!updated) {
      return NextResponse.json({ error: 'Department not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: admin.id,
      action: 'DEPARTMENT_UPDATED',
      resourceType: 'DEPARTMENT',
      resourceId: id,
      metadata: { name: updated.name, code: updated.code },
      req,
    });

    return NextResponse.json({ success: true, department: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await context.params;

    const deleted = await dataStore.deleteDepartment(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Department not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: admin.id,
      action: 'DEPARTMENT_DELETED',
      resourceType: 'DEPARTMENT',
      resourceId: id,
      req,
    });

    return NextResponse.json({ success: true, message: 'Department deleted successfully.' });
  } catch (err: any) {
    return handleApiError(err);
  }
}
