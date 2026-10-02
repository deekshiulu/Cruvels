import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';

const AcknowledgeActionSchema = z.object({
  itemType: z.enum(['task', 'notice', 'policy', 'document', 'notification', 'communication']),
  itemId: z.string().min(1, 'itemId is required'),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = AcknowledgeActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid acknowledgement payload.' },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const result = await acknowledgementService.acknowledge({
      itemType: parsed.data.itemType,
      itemId: parsed.data.itemId,
      userId: user.id,
      ip,
      userAgent,
      notes: parsed.data.notes,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Could not record acknowledgement.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      acknowledgement: result,
      message: `Confirmed acknowledgement for ${parsed.data.itemType} on ${result.acknowledged_at}`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
