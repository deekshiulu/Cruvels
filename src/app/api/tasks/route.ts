import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';

const CreateTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required').max(150),
  description: z.string().max(1000).optional().default(''),
  status: z.enum(['todo', 'in_progress', 'blocked', 'in_review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().min(10, 'Due date is required'),
  assignedToId: z.string().min(1, 'Assignee is required'),
  assignedPocId: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional().default(false),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    size_bytes: z.number().optional(),
    uploaded_at: z.string(),
  })).optional(),
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
        tasks = tasks.filter((t) => memberIds.has(t.assigned_to_id) || t.created_by_id === user.id || t.assigned_poc_id === user.id || (emp && t.assigned_poc_id === emp.id));
      } else if (emp) {
        // Regular employee/intern sees their own tasks or tasks where they are POC/creator
        tasks = tasks.filter((t) => t.assigned_to_id === emp.id || t.created_by_id === user.id || t.assigned_poc_id === user.id || t.assigned_poc_id === emp.id);
      } else {
        tasks = tasks.filter((t) => t.created_by_id === user.id || t.assigned_poc_id === user.id);
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

    const { title, description, status, priority, dueDate, assignedToId, assignedPocId, requiresAcknowledgement, attachments } = parseRes.data;
    const assignee = await dataStore.getEmployeeById(assignedToId);
    if (!assignee) {
      return NextResponse.json({ error: 'Assignee employee record not found.', success: false }, { status: 404 });
    }

    // Resolve POC employee if assigned
    let assignedPocName: string | undefined = undefined;
    let assignedPocUser: any = null;
    if (assignedPocId) {
      const pocEmp = await dataStore.getEmployeeById(assignedPocId);
      if (pocEmp) {
        assignedPocName = pocEmp.name;
        if (pocEmp.user_id) {
          assignedPocUser = await dataStore.getUserById(pocEmp.user_id);
        }
      } else {
        // Maybe user id was passed directly
        const pocUser = await dataStore.getUserById(assignedPocId);
        if (pocUser) {
          assignedPocName = pocUser.name;
          assignedPocUser = pocUser;
        }
      }
    }

    // Authorization Boundary (BOLA protection):
    // Admin and Manager can assign tasks to anyone.
    // Employees and Interns can only assign tasks to themselves or members in their own squad.
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
      assigned_poc_id: assignedPocId,
      assigned_poc_name: assignedPocName,
      requires_acknowledgement: Boolean(requiresAcknowledgement),
      attachments: attachments || [],
      comments: [],
    });

    await logAuditEvent({
      userId: user.id,
      action: 'TASK_CREATED',
      resourceType: 'TASK',
      resourceId: task.id,
      metadata: { title: task.title, assignedTo: task.assigned_to_name, poc: task.assigned_poc_name },
      req,
    });

    // Universal Acknowledgement Registration if required (§ 5.1, § 8, § 9.3)
    if (requiresAcknowledgement && assignee && assignee.user_id) {
      await acknowledgementService.registerRequirement({
        itemType: 'task',
        itemId: task.id,
        itemTitle: task.title,
        targetAudience: 'custom',
        specificUserIds: [assignee.user_id],
        dueAt: task.due_date,
        metadata: { priority: task.priority, action_url: '/tasks' },
        registeredByUserId: user.id,
      });
    }

    // Notify assigned employee if linked to an active user
    if (assignee && assignee.user_id && assignee.user_id !== user.id) {
      await dataStore.createNotification({
        user_id: assignee.user_id,
        type: 'task',
        title: requiresAcknowledgement ? `Task Assigned (Acknowledgement Required): ${task.title}` : `Task Assigned: ${task.title}`,
        message: `Assigned by ${user.name} • Priority: ${task.priority.toUpperCase()} • Due: ${task.due_date}`,
        link_url: '/tasks',
        state: requiresAcknowledgement ? 'action_required' : 'unread',
        category: requiresAcknowledgement ? 'acknowledgement_required' : 'task',
        action_label: requiresAcknowledgement ? 'Acknowledge Task' : 'View Task',
        action_url: '/tasks',
      });
    }

    // Notify POC if designated
    if (assignedPocUser && assignedPocUser.id !== user.id && (!assignee || assignedPocUser.id !== assignee.user_id)) {
      await dataStore.createNotification({
        user_id: assignedPocUser.id,
        type: 'task',
        title: `Task Review Assigned: ${task.title}`,
        message: `You are designated as POC for task assigned to ${task.assigned_to_name} (Due: ${task.due_date}).`,
        link_url: '/tasks',
        category: 'task',
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (err) {
    return handleApiError(err);
  }
}
