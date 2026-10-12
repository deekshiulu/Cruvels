import { describe, it, expect } from 'vitest';
import { POST as notifyRoute } from '@/app/api/notify/route';

describe('Instant High-Priority FCM Push Notification Route', () => {
  it('rejects requests missing required deviceToken or title with 400', async () => {
    const req = new Request('http://localhost:3000/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await notifyRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('deviceToken and title are required');
  });

  it('gracefully returns 503 error if Firebase Admin environment variables are unset', async () => {
    const req = new Request('http://localhost:3000/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: 'test-fcm-token-12345',
        title: 'Task Assigned',
        body: 'You have been assigned to sprint planning.',
      }),
    });

    const res = await notifyRoute(req);
    const data = await res.json();

    // In local dev without credentials, it returns 503 explaining missing configuration
    if (!process.env.FIREBASE_PROJECT_ID) {
      expect(res.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Firebase Admin SDK is not initialized');
    }
  });
});
