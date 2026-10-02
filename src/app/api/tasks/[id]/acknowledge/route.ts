import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError, getTaskAccessLevel } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';

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

    // Verify user is assignee or admin/creator
    const emp = await dataStore.getEmployeeByUserId(user.id);
    const isAssignee = (emp && emp.id === task.assigned_to_id) || task.assigned_to_id === user.id;

    if (!isAssignee && user.role !== 'admin' && task.created_by_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the assigned owner can acknowledge task receipt.', success: false },
        { status: 403 }
      );
    }

    const updated = await dataStore.acknowledgeTaskReceipt(id, user.id, user.name);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to acknowledge task.', success: false }, { status: 500 });
    }

    // Record in Universal Acknowledgement System if requirement exists
    try {
      await acknowledgementService.acknowledge({
        itemType: 'task',
        itemId: id,
        userId: user.id,
        notes: 'Task receipt confirmed',
      });
    } catch {
      // Non-blocking if not registered as universal requirement
    }

    await logAuditEvent({
      userId: user.id,
      action: 'TASK_RECEIPT_ACKNOWLEDGED',
      resourceType: 'TASK',
      resourceId: id,
      metadata: { taskTitle: task.title },
      req,
    });

    // Notify creator / POC that task was acknowledged
    if (task.created_by_id && task.created_by_id !== user.id) {
      await dataStore.createNotification({
        user_id: task.created_by_id,
        type: 'task',
        title: `Task Acknowledged: ${task.title}`,
        message: `${user.name} acknowledged receipt and reviewed task requirements.`,
        link_url: '/tasks',
        category: 'task',
      });
    }

    return NextResponse.json({ success: true, task: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
