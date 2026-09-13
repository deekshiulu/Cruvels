import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

const CreateEventSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).default(''),
  eventType: z.enum(['meeting', 'shift', 'holiday', 'event']).default('meeting'),
  startTime: z.string().min(10),
  endTime: z.string().min(10),
  location: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireActiveUser(req);
    const events = await dataStore.getScheduleEvents();
    return NextResponse.json({ success: true, events });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parseRes = CreateEventSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: 'Invalid event data.', success: false }, { status: 400 });
    }

    const { title, description, eventType, startTime, endTime, location } = parseRes.data;
    const event = await dataStore.createScheduleEvent({
      title,
      description,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
      location: location || 'Cruvels Office',
      attendee_ids: [user.id],
      created_by: user.id,
    });

    return NextResponse.json({ success: true, event });
  } catch (err) {
    return handleApiError(err);
  }
}
