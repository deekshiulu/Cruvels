import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { countInclusiveIstDays } from '@/lib/utils/date';

const CreateLeaveSchema = z.object({
  leaveType: z.enum(['CASUAL', 'SICK', 'ANNUAL', 'UNPAID']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format (YYYY-MM-DD)'),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const emp = await dataStore.getEmployeeByUserId(user.id);
    if (!emp) {
      return NextResponse.json({
        success: true,
        leaves: [],
        balances: { casual: 12, sick: 10, annual: 15, unpaid: 0 },
      });
    }
    const employeeId = emp.id;

    const leaves = await dataStore.getLeaveRequests({ employeeId });
    const balances = emp?.leave_balances || { casual: 12, sick: 10, annual: 15, unpaid: 0 };

    return NextResponse.json({
      success: true,
      leaves,
      balances,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parseRes = CreateLeaveSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid parameters', success: false }, { status: 400 });
    }

    const { leaveType, startDate, endDate, reason } = parseRes.data;

    const emp = await dataStore.getEmployeeByUserId(user.id);
    if (!emp) {
      return NextResponse.json(
        { error: 'No employee record is linked to this account. Ask an admin to provision your profile first.', success: false },
        { status: 400 }
      );
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: 'End date cannot precede start date.', success: false }, { status: 400 });
    }

    const overlap = await dataStore.findOverlappingLeave(emp.id, startDate, endDate);
    if (overlap) {
      return NextResponse.json(
        {
          error: `This range overlaps an existing ${overlap.status.toLowerCase()} leave (${overlap.start_date} to ${overlap.end_date}).`,
          success: false,
        },
        { status: 409 }
      );
    }

    const diffDays = countInclusiveIstDays(startDate, endDate);
    if (diffDays <= 0) {
      return NextResponse.json({ error: 'Invalid leave duration.', success: false }, { status: 400 });
    }

    // Check balance
    const typeKey = leaveType.toLowerCase() as keyof typeof emp.leave_balances;
    const currentBalance = emp.leave_balances[typeKey] || 0;
    if (leaveType !== 'UNPAID' && currentBalance < diffDays) {
      return NextResponse.json(
        { error: `Insufficient ${leaveType} leave balance. Available: ${currentBalance} days, Requested: ${diffDays} days.`, success: false },
        { status: 400 }
      );
    }

    const leave = await dataStore.createLeaveRequest({
      employee_id: emp.id,
      employee_name: emp.name,
      employee_code: emp.employee_code,
      department_name: emp.department_name,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_count: diffDays,
      reason,
      status: 'PENDING',
    });

    await logAuditEvent({
      userId: user.id,
      action: 'LEAVE_REQUEST_SUBMITTED',
      resourceType: 'LEAVE',
      resourceId: leave.id,
      metadata: { daysCount: diffDays, leaveType },
      req,
    });

    // Notify Group Leader (if in squad) and Admins for review
    const allUsers = await dataStore.listUsers();
    const targetReviewers = new Set<string>();

    // If employee is in a group, notify the group leader
    if (emp.group_id) {
      const grp = await dataStore.getGroupById(emp.group_id);
      if (grp) {
        const glEmp = await dataStore.getEmployeeById(grp.leader_id);
        if (glEmp && glEmp.user_id && glEmp.user_id !== user.id) {
          targetReviewers.add(glEmp.user_id);
        }
      }
    }

    // Also notify Admins
    for (const u of allUsers) {
      if (u.role === 'admin' && u.id !== user.id) {
        targetReviewers.add(u.id);
      }
    }

    for (const reviewerId of targetReviewers) {
      await dataStore.createNotification({
        user_id: reviewerId,
        type: 'leave_approval',
        title: `Leave Application: ${emp.name}`,
        message: `${leave.leave_type} leave requested from ${leave.start_date} to ${leave.end_date} (${leave.days_count} days).`,
        link_url: '/leaves',
      });
    }

    return NextResponse.json({ success: true, leave });
  } catch (err) {
    return handleApiError(err);
  }
}

const CancelLeaveSchema = z.object({
  leaveId: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = CancelLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Leave ID is required.', success: false }, { status: 400 });
    }

    const emp = await dataStore.getEmployeeByUserId(user.id);
    if (!emp) {
      return NextResponse.json({ error: 'No employee record linked to this account.', success: false }, { status: 400 });
    }

    const allLeaves = await dataStore.getLeaveRequests({ employeeId: emp.id });
    const target = allLeaves.find((l) => l.id === parsed.data.leaveId);
    if (!target) {
      return NextResponse.json({ error: 'Leave request not found.', success: false }, { status: 404 });
    }
    if (target.status !== 'PENDING' && target.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only pending or approved leave can be cancelled.', success: false }, { status: 400 });
    }

    const updated = await dataStore.updateLeaveStatus(target.id, 'CANCELLED', user.id, user.name);
    await logAuditEvent({
      userId: user.id,
      action: 'LEAVE_REQUEST_CANCELLED',
      resourceType: 'LEAVE',
      resourceId: target.id,
      req,
    });

    return NextResponse.json({ success: true, leave: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
