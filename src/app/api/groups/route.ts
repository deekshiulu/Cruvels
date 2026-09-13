import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateGroupSchema = z.object({
  name: z.string().min(2, 'Group name is required').max(100),
  department_id: z.string().min(1, 'Department is required'),
  leader_id: z.string().min(1, 'Group Leader is required'),
  member_ids: z.array(z.string()).optional().default([]),
  description: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId') || undefined;

    let groups = await dataStore.getGroups(departmentId);
    const allEmployees = await dataStore.getEmployees();

    if (user.role !== 'admin' && user.role !== 'manager') {
      const emp = await dataStore.getEmployeeByUserId(user.id);
      if (emp) {
        groups = groups.filter((g) => {
          const isMember = (g.member_ids || []).includes(emp.id);
          const isLeader = g.leader_id === emp.id;
          const isSameGroup = emp.group_id === g.id;
          const isCreator = g.created_by_id === user.id;
          return isMember || isLeader || isSameGroup || isCreator;
        });
      }
    }

    // Attach full squad member directory with company email, designation, phone & GL status
    const groupsWithMembers = groups.map((grp) => {
      const memberIdSet = new Set(grp.member_ids || []);
      if (grp.leader_id) memberIdSet.add(grp.leader_id);

      const members = allEmployees
        .filter((e) => memberIdSet.has(e.id) || e.group_id === grp.id || (e.group_name && e.group_name.toLowerCase() === grp.name.toLowerCase()))
        .map((e) => ({
          id: e.id,
          name: e.name,
          employee_code: e.employee_code,
          email: e.email,
          phone: e.phone,
          designation: e.designation,
          is_group_leader: e.id === grp.leader_id || e.is_group_leader,
          status: e.status,
        }));

      return {
        ...grp,
        members,
        member_count: members.length,
      };
    });

    return NextResponse.json({ success: true, groups: groupsWithMembers });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Administrative or managerial privileges required to create a group.', success: false },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid group data.', success: false },
        { status: 400 }
      );
    }

    const newGroup = await dataStore.createGroup({ ...parsed.data, created_by_id: user.id });

    await logAuditEvent({
      userId: user.id,
      action: 'GROUP_CREATED',
      resourceType: 'GROUP',
      resourceId: newGroup.id,
      metadata: { name: newGroup.name, leader: newGroup.leader_name },
      req,
    });

    return NextResponse.json({ success: true, group: newGroup });
  } catch (err) {
    return handleApiError(err);
  }
}
