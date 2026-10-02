import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError, isCompanyManager } from '@/lib/security/authorization';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';
import { dataStore } from '@/lib/db/store';
import { AcknowledgementItemType, AcknowledgementStatus } from '@/lib/db/types';

const RegisterRequirementSchema = z.object({
  itemType: z.enum(['task', 'notice', 'policy', 'document', 'notification', 'communication']),
  itemId: z.string().min(1, 'itemId is required'),
  itemTitle: z.string().min(2, 'itemTitle is required'),
  targetAudience: z.enum(['all', 'interns', 'employees', 'engineering', 'squad', 'custom']).optional(),
  targetGroupId: z.string().optional(),
  targetDepartmentId: z.string().optional(),
  specificUserIds: z.array(z.string()).optional(),
  dueAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const itemType = searchParams.get('itemType') as AcknowledgementItemType | null;
    const itemId = searchParams.get('itemId');
    const status = searchParams.get('status') as AcknowledgementStatus | null;

    // If specific item requested
    if (itemType && itemId) {
      const myEmp = await dataStore.getEmployeeByUserId(user.id);
      const isLead = Boolean(myEmp?.is_group_leader);

      if (isCompanyManager(user) || isLead) {
        const summary = await acknowledgementService.getItemSummary(itemType, itemId);
        return NextResponse.json({ success: true, summary });
      }

      // Regular employee/intern queries their own status for this item
      const userAcks = await dataStore.getAcknowledgements({
        itemType,
        itemId,
        recipientUserId: user.id,
      });

      return NextResponse.json({
        success: true,
        acknowledgement: userAcks[0] || null,
      });
    }

    // Default: List user's assigned acknowledgements
    const myAcks = await acknowledgementService.getUserAcknowledgements(user.id, status || undefined);
    return NextResponse.json({
      success: true,
      acknowledgements: myAcks,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const myEmp = await dataStore.getEmployeeByUserId(user.id);

    // Only Admin, Manager, or Squad Lead can register requirements (§ 5.1, § 8)
    if (!isCompanyManager(user) && !myEmp?.is_group_leader) {
      return NextResponse.json(
        { success: false, error: 'Only administrators, managers, or group leaders can assign mandatory acknowledgements.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = RegisterRequirementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid requirement payload.' },
        { status: 400 }
      );
    }

    // If squad leader, restrict audience to their squad
    let targetAudience = parsed.data.targetAudience || 'all';
    let targetGroupId = parsed.data.targetGroupId;

    if (!isCompanyManager(user) && myEmp?.is_group_leader) {
      targetAudience = 'squad';
      targetGroupId = myEmp.group_id || undefined;
    }

    const result = await acknowledgementService.registerRequirement({
      ...parsed.data,
      targetAudience,
      targetGroupId,
      registeredByUserId: user.id,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      acknowledgements: result.acknowledgements,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
