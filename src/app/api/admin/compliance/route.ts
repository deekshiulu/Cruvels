import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { complianceService } from '@/lib/services/compliance-service';
import { dataStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const month = searchParams.get('month') || undefined; // e.g. "2026-09"

    const isManager = isCompanyManager(user);
    const myEmp = await dataStore.getEmployeeByUserId(user.id);

    // If requesting individual monthly drilldown (§ 2.1)
    if (employeeId) {
      if (!isManager && myEmp?.id !== employeeId) {
        // If not manager, can only view if group leader of that employee's squad
        const targetEmp = await dataStore.getEmployeeById(employeeId);
        if (!myEmp?.is_group_leader || myEmp.group_id !== targetEmp?.group_id) {
          return NextResponse.json({ error: 'Unauthorized to view this employee compliance history.', success: false }, { status: 403 });
        }
      }

      const history = await complianceService.getIndividualComplianceHistory(employeeId, month);
      return NextResponse.json({ success: true, history });
    }

    // Otherwise return aggregate dashboard data (§ 2, § 2.2)
    const daily = await complianceService.evaluateDailyCompliance(date);
    let teamSummaries = await complianceService.getTeamCompliance(date);

    // Enforce squad scoping if user is Group Leader
    if (!isManager) {
      if (myEmp?.is_group_leader && myEmp.group_id) {
        teamSummaries = teamSummaries.filter((t) => t.groupId === myEmp.group_id);
        daily.details = daily.details.filter((d) => d.groupId === myEmp.group_id);
      } else {
        return NextResponse.json({ error: 'Forbidden: Admin or Group Leader access required.', success: false }, { status: 403 });
      }
    }

    // Fetch pending corrections for review queue
    const allPendingCorrections = await dataStore.getAttendanceCorrections({ status: 'PENDING' });
    const pendingCorrections = isManager
      ? allPendingCorrections
      : allPendingCorrections.filter((c) => c.group_id === myEmp?.group_id);

    return NextResponse.json({
      success: true,
      summary: daily.summary,
      teams: teamSummaries,
      details: daily.details,
      pendingCorrections,
      isWorkingDay: daily.isWorkingDay,
      isHoliday: daily.isHoliday,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
