import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { syncCalendarIntegration } from '@/lib/calendar/sync-service';

const CreateIntegrationSchema = z.object({
  provider: z.enum(['google', 'microsoft']),
  accountEmail: z.string().email().optional().or(z.literal('')),
  feedUrl: z.string().min(5, 'Feed URL is required').max(1000),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const integrations = await dataStore.getUserCalendarIntegrations(user.id);
    return NextResponse.json({ success: true, integrations });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parseRes = CreateIntegrationSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: parseRes.error.errors[0]?.message || 'Invalid calendar integration details.', success: false },
        { status: 400 }
      );
    }

    const { provider, accountEmail, feedUrl } = parseRes.data;

    const integration = await dataStore.saveUserCalendarIntegration({
      userId: user.id,
      provider,
      accountEmail: accountEmail || undefined,
      feedUrl,
    });

    // Attempt immediate initial sync
    const syncRes = await syncCalendarIntegration(integration, user.id);

    return NextResponse.json({
      success: true,
      integration,
      syncResult: syncRes,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Integration ID is required.', success: false }, { status: 400 });
    }

    const removed = await dataStore.deleteUserCalendarIntegration(id, user.id);
    if (!removed) {
      return NextResponse.json({ error: 'Calendar integration not found.', success: false }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Calendar integration disconnected successfully.' });
  } catch (err) {
    return handleApiError(err);
  }
}
