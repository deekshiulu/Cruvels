import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = isNaN(daysParam) || daysParam < 7 ? 30 : Math.min(daysParam, 90);

    // 1. Fetch raw domain datasets
    const employees = await dataStore.getEmployees();
    const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
    const totalWorkforce = activeEmployees.length || employees.length || 1;

    // Calculate dates
    const today = new Date();
    const dateList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateList.push(d.toISOString().slice(0, 10));
    }
    const startDate = dateList[0];
    const endDate = dateList[dateList.length - 1];

    const attendanceRecords = await dataStore.getAttendanceRecords({ startDate, endDate });
    const allTasks = await dataStore.getTasks();
    const groups = await dataStore.getGroups();
    const departments = await dataStore.getDepartments();

    // 2. Aggregate Daily Attendance & Task Trends
    const attendanceByDate = new Map<string, { present: number; wfh: number; halfDay: number; leave: number; absent: number }>();
    attendanceRecords.forEach((r) => {
      const entry = attendanceByDate.get(r.date) || { present: 0, wfh: 0, halfDay: 0, leave: 0, absent: 0 };
      if (r.status === 'PRESENT') entry.present++;
      else if (r.status === 'WORK_FROM_HOME') entry.wfh++;
      else if (r.status === 'HALF_DAY') entry.halfDay++;
      else if (r.status === 'ON_LEAVE') entry.leave++;
      else if (r.status === 'ABSENT') entry.absent++;
      attendanceByDate.set(r.date, entry);
    });

    const tasksByDate = new Map<string, { created: number; completed: number }>();
    allTasks.forEach((t) => {
      const createdDate = (t.created_at || '').slice(0, 10);
      if (createdDate >= startDate && createdDate <= endDate) {
        const entry = tasksByDate.get(createdDate) || { created: 0, completed: 0 };
        entry.created++;
        tasksByDate.set(createdDate, entry);
      }
      if (t.status === 'done' && t.updated_at) {
        const completedDate = t.updated_at.slice(0, 10);
        if (completedDate >= startDate && completedDate <= endDate) {
          const entry = tasksByDate.get(completedDate) || { created: 0, completed: 0 };
          entry.completed++;
          tasksByDate.set(completedDate, entry);
        }
      }
    });

    const dailyTrends = dateList.map((dateStr) => {
      const att = attendanceByDate.get(dateStr) || { present: 0, wfh: 0, halfDay: 0, leave: 0, absent: 0 };
      const tsk = tasksByDate.get(dateStr) || { created: 0, completed: 0 };

      // Calculate daily presence %
      const effectivePresent = att.present + att.wfh + att.halfDay * 0.5;
      const presenceRate = Math.min(100, Math.round((effectivePresent / totalWorkforce) * 100));

      return {
        date: dateStr,
        present: att.present,
        wfh: att.wfh,
        halfDay: att.halfDay,
        onLeave: att.leave,
        absent: att.absent,
        presenceRate,
        tasksCreated: tsk.created,
        tasksCompleted: tsk.completed,
      };
    });

    // 3. Task Status & Priority Breakdown
    const statusCounts = {
      done: allTasks.filter((t) => t.status === 'done').length,
      in_progress: allTasks.filter((t) => t.status === 'in_progress').length,
      in_review: allTasks.filter((t) => t.status === 'in_review').length,
      blocked: allTasks.filter((t) => t.status === 'blocked').length,
      todo: allTasks.filter((t) => t.status === 'todo').length,
    };
    const totalTasks = allTasks.length || 1;
    const taskCompletionRate = Math.round((statusCounts.done / totalTasks) * 100);

    const priorityCounts = {
      urgent: allTasks.filter((t) => t.priority === 'urgent').length,
      high: allTasks.filter((t) => t.priority === 'high').length,
      medium: allTasks.filter((t) => t.priority === 'medium').length,
      low: allTasks.filter((t) => t.priority === 'low').length,
    };

    // 4. Overdue tasks
    const todayStr = today.toISOString().slice(0, 10);
    const overdueTasksCount = allTasks.filter(
      (t) => t.status !== 'done' && t.due_date && t.due_date < todayStr
    ).length;

    // 5. Squad Productivity Breakdown
    const squadAnalytics = groups.map((group) => {
      const squadMemberIds = new Set(group.member_ids || []);
      const squadTasks = allTasks.filter((t) => squadMemberIds.has(t.assigned_to_id));
      const squadDone = squadTasks.filter((t) => t.status === 'done').length;
      const squadRate = squadTasks.length > 0 ? Math.round((squadDone / squadTasks.length) * 100) : 100;
      const department = departments.find((d) => d.id === group.department_id);

      return {
        id: group.id,
        name: group.name,
        departmentName: department?.name || group.department_name || 'Engineering',
        leaderName: group.leader_name || 'Assigned Lead',
        membersCount: squadMemberIds.size,
        totalTasks: squadTasks.length,
        completedTasks: squadDone,
        completionRate: squadRate,
        blockedTasks: squadTasks.filter((t) => t.status === 'blocked').length,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);

    // 6. Overall Telemetry KPI Summary
    const avgPresenceRate = Math.round(
      dailyTrends.reduce((acc, curr) => acc + curr.presenceRate, 0) / (dailyTrends.length || 1)
    );
    const totalPunchesInPeriod = attendanceRecords.length;
    const overallProductivityScore = Math.min(
      100,
      Math.round(taskCompletionRate * 0.55 + avgPresenceRate * 0.45)
    );

    return NextResponse.json({
      success: true,
      timeframeDays: days,
      summary: {
        totalWorkforce,
        overallProductivityScore,
        avgPresenceRate,
        taskCompletionRate,
        totalTasks: allTasks.length,
        completedTasks: statusCounts.done,
        overdueTasksCount,
        totalPunchesInPeriod,
      },
      dailyTrends,
      taskStatusCounts: statusCounts,
      taskPriorityCounts: priorityCounts,
      squadAnalytics,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
