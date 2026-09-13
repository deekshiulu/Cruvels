import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required').max(150),
  description: z.string().max(1000).optional().default(''),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().min(10, 'Due date is required'),
  assignedToId: z.string().min(1, 'Assignee is required'),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    let tasks = await dataStore.getTasks({ status });
    const emp = await dataStore.getEmployeeByUserId(user.id);

    if (user.role !== 'admin') {
      if (emp?.is_group_leader && emp?.group_id) {
        // Group Leader can see all tasks assigned to members of their group
        const groupMembers = await dataStore.getEmployees({ groupId: emp.group_id });
        const memberIds = new Set(groupMembers.map((m) => m.id));
        tasks = tasks.filter((t) => memberIds.has(t.assigned_to_id) || t.created_by_id === user.id);
      } else if (emp) {
        // Regular employee/intern sees ONLY their own tasks
        tasks = tasks.filter((t) => t.assigned_to_id === emp.id || t.created_by_id === user.id);
      } else {
        tasks = tasks.filter((t) => t.created_by_id === user.id);
      }
    }

    return NextResponse.json({ success: true, tasks });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parseRes = CreateTaskSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid task parameters.', success: false }, { status: 400 });
    }

    const { title, description, status, priority, dueDate, assignedToId } = parseRes.data;
    const assignee = await dataStore.getEmployeeById(assignedToId);

    const task = await dataStore.createTask({
      title,
      description: description || '',
      status,
      priority,
      due_date: dueDate,
      assigned_to_id: assignedToId,
      assigned_to_name: assignee ? assignee.name : user.name,
      created_by_id: user.id,
      created_by_name: user.name,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'TASK_CREATED',
      resourceType: 'TASK',
      resourceId: task.id,
      metadata: { title: task.title, assignedTo: task.assigned_to_name },
      req,
    });

    // Notify assigned employee if linked to an active user
    if (assignee && assignee.user_id && assignee.user_id !== user.id) {
      await dataStore.createNotification({
        user_id: assignee.user_id,
        type: 'task',
        title: `Task Assigned: ${task.title}`,
        message: `Assigned by ${user.name} • Priority: ${task.priority.toUpperCase()} • Due: ${task.due_date}`,
        link_url: '/tasks',
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (err) {
    return handleApiError(err);
  }
}
