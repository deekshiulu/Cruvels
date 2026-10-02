import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/security/authorization';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';
import { AcknowledgementItemType } from '@/lib/db/types';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const itemType = searchParams.get('itemType') as AcknowledgementItemType | null;
    const itemId = searchParams.get('itemId');

    if (itemType && itemId) {
      const summary = await acknowledgementService.getItemSummary(itemType, itemId);
      return NextResponse.json({ success: true, summary });
    }

    const metrics = await acknowledgementService.getGlobalMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (err) {
    return handleApiError(err);
  }
}
