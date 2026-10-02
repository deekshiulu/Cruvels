import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, requireAdmin, handleApiError, canViewEmployeeDirectory, canViewEmployee360 } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateEmployeeSchema = z.object({
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  phone: z.string().min(5).max(20).optional(),
  department_id: z.string().min(1).optional(),
  group_id: z.string().nullable().optional(),
  designation: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  is_group_leader: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const employee = await dataStore.getEmployeeById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found.', success: false }, { status: 404 });
    }
    if (!(await canViewEmployeeDirectory(user, id))) {
      return NextResponse.json({ error: 'Access denied to this employee profile.', success: false }, { status: 403 });
    }

    const show360 = canViewEmployee360(user, employee);
    if (!show360) {
      const { leave_balances: _balances, phone: _phone, personal_email: _pEmail, ...directoryEmployee } = employee;
      return NextResponse.json({
        success: true,
        employee: {
          ...directoryEmployee,
          phone: null,
          personal_email: null,
        },
        attendance: { summary: null, recent: [] },
        tasks: { summary: null, list: [] },
        leaves: { balances: null, history: [] },
        meetings: { summary: null, list: [] },
        user: null,
        restricted: true,
      });
    }

    // Fetch full 360 profile telemetry
    const [attendanceRecords, tasks, leaves, linkedUser, allEvents] = await Promise.all([
      dataStore.getAttendanceRecords({ employeeId: employee.id }),
      dataStore.getTasks({ assignedToId: employee.id }),
      dataStore.getLeaveRequests({ employeeId: employee.id }),
      employee.user_id ? dataStore.getUserById(employee.user_id) : null,
      dataStore.getScheduleEvents(),
    ]);

    const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const halfDayCount = attendanceRecords.filter((r) => r.status === 'HALF_DAY').length;
    const onLeaveCount = attendanceRecords.filter((r) => r.status === 'ON_LEAVE').length;
    const absentCount = attendanceRecords.filter((r) => r.status === 'ABSENT').length;
    const complianceRate = attendanceRecords.length > 0
      ? Math.round(((presentCount + halfDayCount * 0.5) / attendanceRecords.length) * 100)
      : 100;

    const attendanceSummary = {
      totalRecords: attendanceRecords.length,
      present: presentCount,
      halfDay: halfDayCount,
      onLeave: onLeaveCount,
      absent: absentCount,
      complianceRate,
    };

    const taskSummary = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'done').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      pending: tasks.filter((t) => t.status === 'todo').length,
    };

    // Filter relevant meetings & video calls
    const employeeMeetings = allEvents.filter((e) => {
      const isAttendee =
        (employee.user_id && e.attendee_ids.includes(employee.user_id)) ||
        e.attendee_ids.includes(employee.id) ||
        (employee.user_id && e.created_by === employee.user_id);
      const isCompanyMeeting = e.event_type === 'company_event' || (e.event_type === 'meeting' && e.attendee_ids.length === 0);
      return (isAttendee || isCompanyMeeting) && (e.event_type === 'meeting' || Boolean(e.meeting_link));
    }).sort((a, b) => b.start_time.localeCompare(a.start_time));

    const googleMeetCount = employeeMeetings.filter(
      (m) => m.meeting_link?.includes('meet.google.com') || m.meeting_platform === 'google_meet'
    ).length;

    const teamsCount = employeeMeetings.filter(
      (m) => m.meeting_link?.includes('teams.') || m.meeting_platform === 'teams'
    ).length;

    const upcomingMeets = employeeMeetings.filter(
      (m) => new Date(m.start_time).getTime() >= Date.now()
    ).length;

    const meetingSummary = {
      totalMeets: employeeMeetings.length,
      googleMeetCount,
      teamsCount,
      upcomingCount: upcomingMeets,
    };

    return NextResponse.json({
      success: true,
      employee,
      attendance: {
        summary: attendanceSummary,
        recent: attendanceRecords.slice(0, 15),
      },
      tasks: {
        summary: taskSummary,
        list: tasks,
      },
      leaves: {
        balances: employee.leave_balances || { casual: 0, sick: 0, annual: 0, unpaid: 0 },
        history: leaves,
      },
      meetings: {
        summary: meetingSummary,
        list: employeeMeetings,
      },
      user: linkedUser
        ? {
            id: linkedUser.id,
            username: linkedUser.username,
            role: linkedUser.role,
            status: linkedUser.status,
            lastLoginAt: linkedUser.last_login_at,
          }
        : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await context.params;
    const body = await req.json();

    const parseRes = UpdateEmployeeSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: parseRes.error.errors[0]?.message || 'Invalid parameters', success: false }, { status: 400 });
    }

    const updates: Record<string, any> = { ...parseRes.data };

    if (parseRes.data.department_id) {
      const dept = await dataStore.getDepartmentById(parseRes.data.department_id);
      if (dept) updates.department_name = dept.name;
    }

    if (parseRes.data.group_id !== undefined) {
      if (parseRes.data.group_id) {
        const grp = await dataStore.getGroupById(parseRes.data.group_id);
        if (grp) updates.group_name = grp.name;
      } else {
        updates.group_name = null;
      }
    }

    if (parseRes.data.first_name || parseRes.data.last_name) {
      const existing = await dataStore.getEmployeeById(id);
      const fn = parseRes.data.first_name || existing?.first_name || '';
      const ln = parseRes.data.last_name || existing?.last_name || '';
      updates.name = `${fn} ${ln}`.trim();
    }

    const updated = await dataStore.updateEmployee(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Employee not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: admin.id,
      action: 'EMPLOYEE_UPDATED',
      resourceType: 'EMPLOYEE',
      resourceId: id,
      metadata: { name: updated.name, updates },
      req,
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
