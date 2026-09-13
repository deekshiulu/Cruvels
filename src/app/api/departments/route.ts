import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name is required').max(100),
  code: z.string().min(2, 'Department code is required').max(10),
  head_name: z.string().min(2, 'Department head name is required').max(100),
  head_id: z.string().optional(),
  description: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    let departments = await dataStore.getDepartments();

    if (user.role !== 'admin' && user.role !== 'manager') {
      const emp = await dataStore.getEmployeeByUserId(user.id);
      if (emp && emp.department_id) {
        departments = departments.filter(
          (d) => d.id === emp.department_id || d.name.toLowerCase() === (emp.department_name || '').toLowerCase()
        );
      } else {
        departments = [];
      }
    }

    // Attach full member directory with company email and squad
    const allEmployees = await dataStore.getEmployees();
    const departmentsWithMembers = departments.map((dep) => {
      const members = allEmployees
        .filter((e) => e.department_id === dep.id || e.department_name?.toLowerCase() === dep.name.toLowerCase())
        .map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          designation: e.designation,
          group_name: e.group_name,
          is_group_leader: e.is_group_leader,
          status: e.status,
        }));
      return {
        ...dep,
        members,
        member_count: members.length,
      };
    });

    return NextResponse.json({ success: true, departments: departmentsWithMembers });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const parseRes = CreateDepartmentSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid department data.', success: false }, { status: 400 });
    }

    const dep = await dataStore.createDepartment(parseRes.data);

    await logAuditEvent({
      userId: admin.id,
      action: 'DEPARTMENT_CREATED',
      resourceType: 'DEPARTMENT',
      resourceId: dep.id,
      metadata: { name: dep.name, code: dep.code },
      req,
    });

    return NextResponse.json({ success: true, department: dep });
  } catch (err) {
    return handleApiError(err);
  }
}
