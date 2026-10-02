import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/forgot-password/route';
import { dataStore } from '@/lib/db/store';

describe('Forgot Password & Higher Official Escalation Protocol', () => {
  beforeEach(async () => {
    // Reset dataStore to clean state
    dataStore.resetAndSeed();
  });

  it('rejects requests with missing email or invalid role', async () => {
    const req = new NextRequest('http://localhost:3005/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '',
        role: 'invalid_role',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('routes intern password reset request to higher officials (Admins and Leads)', async () => {
    // Rahul is an intern
    const req = new NextRequest('http://localhost:3005/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rahul@cruvels.com',
        role: 'intern',
        reason: 'Lost access to my device',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.officialsNotifiedCount).toBeGreaterThan(0);
    expect(body.message).toContain('dispatched to your higher officials');

    // Verify notifications were delivered to admin(s)
    const adminUser = await dataStore.getUserByUsername('admin');
    expect(adminUser).toBeDefined();

    const adminNotifications = await dataStore.getNotifications(adminUser!.id);
    const resetNotif = adminNotifications.find((n) => n.title.includes('Password Reset Request'));
    expect(resetNotif).toBeDefined();
    expect(resetNotif?.category).toBe('action_required');
    expect(resetNotif?.message).toContain('Rahul');

    // Verify internal security email was placed in the admin inbox
    const { messages: adminMessages } = await dataStore.getMessagesByOwner(adminUser!.id, {
      folder: 'inbox',
    });
    const resetEmail = adminMessages.find((m) => m.subject.includes('Password Reset Request'));
    expect(resetEmail).toBeDefined();
    expect(resetEmail?.body_text).toContain('Lost access to my device');
  });

  it('routes manager password reset request strictly to admins', async () => {
    const req = new NextRequest('http://localhost:3005/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'charith@cruvels.com',
        role: 'manager',
        reason: 'Routine credential refresh',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.officialsNotifiedCount).toBeGreaterThan(0);
  });
});
