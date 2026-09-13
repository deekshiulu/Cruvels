import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, requireAdmin, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/session';
import { getPasswordPolicyError } from '@/lib/auth/password-policy';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  username: z.string().min(3, 'Username must be at least 3 chars').max(30),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(5).max(20).optional(),
  departmentId: z.string().min(1, 'Department is required'),
  groupId: z.string().optional(),
  designation: z.string().min(1, 'Designation is required').max(100),
  role: z.enum(['admin', 'manager', 'team_lead', 'employee', 'intern']).default('employee'),
  password: z.string().min(10, 'Password must be at least 10 chars').max(100),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId') || undefined;
    const groupId = searchParams.get('groupId') || undefined;
    const search = searchParams.get('search') || undefined;

    // Admin has full directory visibility
    if (isCompanyManager(user)) {
      const employees = await dataStore.getEmployees({ departmentId, groupId, search });
      return NextResponse.json({ success: true, employees, isSquadOnly: false });
    }

    // Non-admin: Strictly scope to members in their own assigned group/squad
    const myEmp = await dataStore.getEmployeeByUserId(user.id);
    if (!myEmp) {
      return NextResponse.json({ success: true, employees: [], isSquadOnly: true });
    }

    if (myEmp.group_id) {
      const squadMembers = await dataStore.getEmployees({ groupId: myEmp.group_id, search });
      return NextResponse.json({
        success: true,
        employees: squadMembers.map(({ leave_balances, ...emp }) => emp),
        isSquadOnly: true,
        groupName: myEmp.group_name || 'My Squad',
      });
    }

    // If no group assigned, only show their own employee record
    const { leave_balances, ...selfPublic } = myEmp;
    return NextResponse.json({
      success: true,
      employees: [selfPublic],
      isSquadOnly: true,
      groupName: 'Individual Profile',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const parseRes = CreateEmployeeSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid parameters', success: false }, { status: 400 });
    }

    const { firstName, lastName, username, email, phone, departmentId, groupId, designation, role, password } = parseRes.data;

    const policyError = getPasswordPolicyError(password);
    if (policyError) {
      return NextResponse.json({ error: policyError, success: false }, { status: 400 });
    }

    // Check username or email collision
    const existingUser = await dataStore.getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: `Username @${username} is already taken.`, success: false }, { status: 409 });
    }

    const existingEmail = await dataStore.getUserByEmail(email);
    if (existingEmail) {
      return NextResponse.json({ error: `Email ${email} is already registered.`, success: false }, { status: 409 });
    }

    // 1. Create User
    const newUser = await dataStore.createUser({
      name: `${firstName} ${lastName}`,
      username: username.toLowerCase().trim(),
      password_hash: hashPassword(password),
      role,
      status: 'active',
      must_change_password: true,
    });

    // 2. Create Primary Alias
    await dataStore.createAlias(newUser.id, email);

    // 3. Resolve department and group names
    const dept = await dataStore.getDepartmentById(departmentId);
    let groupName: string | undefined = undefined;
    if (groupId) {
      const grp = await dataStore.getGroupById(groupId);
      if (grp) groupName = grp.name;
    }

    // 4. Create Employee Record
    const codeNum = Math.floor(100 + Math.random() * 900);
    const newEmp = await dataStore.createEmployee({
      user_id: newUser.id,
      employee_code: `CRUV-${codeNum}`,
      first_name: firstName,
      last_name: lastName,
      name: `${firstName} ${lastName}`,
      email,
      phone: phone || '+91 90000 00000',
      department_id: departmentId,
      department_name: dept?.name || 'General Operations',
      group_id: groupId || null,
      group_name: groupName || null,
      is_group_leader: role === 'team_lead',
      designation,
      joining_date: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      created_by_id: admin.id,
      leave_balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
    });

    await logAuditEvent({
      userId: admin.id,
      action: 'EMPLOYEE_PROVISIONED',
      resourceType: 'EMPLOYEE',
      resourceId: newEmp.id,
      metadata: { name: newEmp.name, role, department: newEmp.department_name },
      req,
    });

    return NextResponse.json({ success: true, employee: newEmp });
  } catch (err) {
    return handleApiError(err);
  }
}
