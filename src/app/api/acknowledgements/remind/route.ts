import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';
import { dataStore } from '@/lib/db/store';

const RemindSchema = z.object({
  itemType: z.enum(['task', 'notice', 'policy', 'document', 'notification', 'communication']).optional(),
  itemId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const myEmp = await dataStore.getEmployeeByUserId(user.id);

    if (!isCompanyManager(user) && !myEmp?.is_group_leader) {
      return NextResponse.json(
        { success: false, error: 'Only administrators, managers, or group leaders can trigger reminders.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RemindSchema.safeParse(body);
    const itemType = parsed.success ? parsed.data.itemType : undefined;
    const itemId = parsed.success ? parsed.data.itemId : undefined;

    const result = await acknowledgementService.processReminders({ itemType, itemId });

    return NextResponse.json({
      success: true,
      remindersSent: result.remindersSent,
      message: `Dispatched ${result.remindersSent} reminder notification(s).`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
