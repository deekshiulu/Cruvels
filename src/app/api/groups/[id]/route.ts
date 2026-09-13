import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, canManageGroup } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateGroupSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  leader_id: z.string().min(1).optional(),
  member_ids: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const group = await dataStore.getGroupById(id);
    if (!group) {
      return NextResponse.json({ error: 'Group not found.', success: false }, { status: 404 });
    }
    const emp = await dataStore.getEmployeeByUserId(user.id);
    const isMember = emp && (group.member_ids.includes(emp.id) || group.leader_id === emp.id);
    const isCreator = group.created_by_id === user.id;
    if (user.role !== 'admin' && !isMember && !isCreator) {
      return NextResponse.json({ error: 'Access denied to this squad.', success: false }, { status: 403 });
    }
    return NextResponse.json({ success: true, group });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    if (!(await canManageGroup(user, id))) {
      return NextResponse.json(
        { error: 'You can only edit squads you created or lead.', success: false },
        { status: 403 }
      );
    }
    const body = await req.json();
    const parsed = UpdateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid update data.', success: false },
        { status: 400 }
      );
    }

    const updated = await dataStore.updateGroup(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Group not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'GROUP_UPDATED',
      resourceType: 'GROUP',
      resourceId: id,
      metadata: { name: updated.name, leader: updated.leader_name },
      req,
    });

    return NextResponse.json({ success: true, group: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Administrative privileges required to delete a group.', success: false },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const deleted = await dataStore.deleteGroup(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Group not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'GROUP_DELETED',
      resourceType: 'GROUP',
      resourceId: id,
      req,
    });

    return NextResponse.json({ success: true, message: 'Group deleted successfully.' });
  } catch (err) {
    return handleApiError(err);
  }
}
