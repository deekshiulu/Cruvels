import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, getTaskAccessLevel } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const CommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
});

export async function POST(
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

    const body = await req.json();
    const parsed = CommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid comment payload.', success: false },
        { status: 400 }
      );
    }

    const updated = await dataStore.addTaskComment(id, {
      author_id: user.id,
      author_name: user.name,
      content: parsed.data.content.trim(),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to add comment.', success: false }, { status: 500 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'TASK_COMMENT_ADDED',
      resourceType: 'TASK',
      resourceId: id,
      metadata: { taskTitle: task.title },
      req,
    });

    // Notify task stakeholders (assignee, creator, POC) excluding the commenter
    const recipientUserIds = new Set<string>();
    if (task.created_by_id && task.created_by_id !== user.id) {
      recipientUserIds.add(task.created_by_id);
    }
    if (task.assigned_to_id) {
      const assigneeEmp = await dataStore.getEmployeeById(task.assigned_to_id);
      if (assigneeEmp?.user_id && assigneeEmp.user_id !== user.id) {
        recipientUserIds.add(assigneeEmp.user_id);
      }
    }
    if (task.assigned_poc_id) {
      const pocEmp = await dataStore.getEmployeeById(task.assigned_poc_id);
      if (pocEmp?.user_id && pocEmp.user_id !== user.id) {
        recipientUserIds.add(pocEmp.user_id);
      }
      const pocUser = await dataStore.getUserById(task.assigned_poc_id);
      if (pocUser && pocUser.id !== user.id) {
        recipientUserIds.add(pocUser.id);
      }
    }

    for (const recipientId of recipientUserIds) {
      await dataStore.createNotification({
        user_id: recipientId,
        type: 'task',
        title: `New Comment on: ${task.title}`,
        message: `${user.name}: "${parsed.data.content.slice(0, 80)}${parsed.data.content.length > 80 ? '...' : ''}"`,
        link_url: '/tasks',
        category: 'task',
      });
    }

    return NextResponse.json({ success: true, task: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
