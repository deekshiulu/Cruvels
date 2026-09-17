import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, getTaskAccessLevel } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateTaskSchema = z.object({
  title: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().min(10).optional(),
  assigned_to_id: z.string().min(1).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const task = await dataStore.getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.', success: false }, { status: 404 });
    }
    const access = await getTaskAccessLevel(user, task);
    if (access === 'none') {
      return NextResponse.json({ error: 'Access denied to this task.', success: false }, { status: 403 });
    }
    return NextResponse.json({ success: true, task });
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
    const existing = await dataStore.getTaskById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found.', success: false }, { status: 404 });
    }

    const access = await getTaskAccessLevel(user, existing);
    if (access === 'none') {
      return NextResponse.json({ error: 'Access denied to this task.', success: false }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid task updates.', success: false }, { status: 400 });
    }

    if (access === 'status') {
      const statusOnly = parsed.data.status ? { status: parsed.data.status } : {};
      if (!parsed.data.status) {
        return NextResponse.json({ error: 'Assignees can only update task status.', success: false }, { status: 403 });
      }
      const updated = await dataStore.updateTask(id, statusOnly, { id: user.id, name: user.name });
      return NextResponse.json({ success: true, task: updated });
    }

    let assignedToName: string | undefined = undefined;
    if (parsed.data.assigned_to_id) {
      const assignee = await dataStore.getEmployeeById(parsed.data.assigned_to_id);
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee employee record not found.', success: false }, { status: 404 });
      }

      if (user.role !== 'admin' && user.role !== 'manager') {
        const myEmp = await dataStore.getEmployeeByUserId(user.id);
        if (!myEmp) {
          return NextResponse.json({ error: 'No employee record linked to your account.', success: false }, { status: 403 });
        }
        const isSelf = myEmp.id === assignee.id;
        const isSameSquad = Boolean(myEmp.group_id && myEmp.group_id === assignee.group_id);
        if (!isSelf && !isSameSquad) {
          return NextResponse.json({
            error: 'Forbidden. You are only authorized to assign tasks to yourself or members of your squad.',
            success: false,
          }, { status: 403 });
        }
      }

      assignedToName = assignee.name;
    }

    const updated = await dataStore.updateTask(
      id,
      {
        ...parsed.data,
        ...(assignedToName ? { assigned_to_name: assignedToName } : {}),
      },
      { id: user.id, name: user.name }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Task not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'TASK_UPDATED',
      resourceType: 'TASK',
      resourceId: id,
      metadata: { title: updated.title, status: updated.status },
      req,
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const existing = await dataStore.getTaskById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found.', success: false }, { status: 404 });
    }

    const access = await getTaskAccessLevel(user, existing);
    if (access !== 'full') {
      return NextResponse.json({ error: 'Only the task creator or an admin can delete this task.', success: false }, { status: 403 });
    }

    const deleted = await dataStore.deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Task not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'TASK_DELETED',
      resourceType: 'TASK',
      resourceId: id,
      req,
    });

    return NextResponse.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    return handleApiError(err);
  }
}
