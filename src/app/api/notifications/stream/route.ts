import { NextRequest } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { subscribeToUser, subscribeToUserEvents } from '@/lib/realtime/hub';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        send('ready', { ok: true });
        const unsubscribe = subscribeToUser(user.id, (notification) => {
          send('notification', notification);
        });
        const unsubscribeEvents = subscribeToUserEvents(user.id, (event, data) => {
          send(event, data);
        });

        const heartbeat = setInterval(() => {
          try {
            send('ping', { t: Date.now() });
          } catch {
            clearInterval(heartbeat);
            unsubscribe();
            unsubscribeEvents();
          }
        }, 25000);

        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          unsubscribe();
          unsubscribeEvents();
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
