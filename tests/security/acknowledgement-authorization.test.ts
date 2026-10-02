import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { GET as getAcksRoute, POST as postAcksRoute } from '@/app/api/acknowledgements/route';
import { POST as acknowledgeRoute } from '@/app/api/acknowledgements/acknowledge/route';
import { POST as remindRoute } from '@/app/api/acknowledgements/remind/route';
import { GET as adminAcksRoute } from '@/app/api/admin/acknowledgements/route';
import { createSessionToken } from '@/lib/auth/session';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';

function makeAuthRequest(path: string, options: { method?: string; body?: any; token?: string }) {
  const headers = new Headers();
  headers.set('host', 'localhost:3005');
  headers.set('Content-Type', 'application/json');
  if (options.token) {
    headers.set('cookie', `cruvels_session=${options.token}`);
  }

  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  return new NextRequest(`http://localhost:3005${path}`, init as any);
}

describe('Phase 2: Universal Acknowledgement Authorization & Security Tests (§§ 5, 6, 8, 17, 18)', () => {
  let adminToken: string;
  let leadToken: string;
  let internToken: string;

  let adminUser: any;
  let leadUser: any;
  let internUser: any;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    adminUser = await dataStore.getUserByUsername('admin');
    const charithDb = await dataStore.getUserByUsername('charith');
    if (charithDb) {
      await dataStore.updateUser(charithDb.id, { role: 'team_lead' });
      leadUser = await dataStore.getUserById(charithDb.id);
    }
    internUser = await dataStore.getUserByUsername('rahul');

    adminToken = await createSessionToken(adminUser!, ['admin@cruvels.com']);
    leadToken = await createSessionToken(leadUser!, ['charith@cruvels.com']);
    internToken = await createSessionToken(internUser!, ['rahul@cruvels.com']);
  });

  it('DENIES regular interns from registering mandatory acknowledgement requirements', async () => {
    const req = makeAuthRequest('/api/acknowledgements', {
      method: 'POST',
      token: internToken,
      body: {
        itemType: 'notice',
        itemId: 'not-hack-1',
        itemTitle: 'Unauthorized Requirement',
      },
    });

    const res = await postAcksRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Only administrators, managers, or group leaders');
  });

  it('ALLOWS admins to register mandatory acknowledgement requirements across the organization', async () => {
    const req = makeAuthRequest('/api/acknowledgements', {
      method: 'POST',
      token: adminToken,
      body: {
        itemType: 'policy',
        itemId: 'pol-infosec-01',
        itemTitle: 'Mandatory InfoSec 2026 Policy',
        targetAudience: 'all',
      },
    });

    const res = await postAcksRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThan(0);
  });

  it('SCOPES group leader requirement registration strictly to their own squad members', async () => {
    const req = makeAuthRequest('/api/acknowledgements', {
      method: 'POST',
      token: leadToken,
      body: {
        itemType: 'document',
        itemId: 'squad-doc-1',
        itemTitle: 'Core Platform Sprint Charter',
        targetAudience: 'all', // Lead tries 'all', should automatically be coerced to squad
      },
    });

    const res = await postAcksRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // All created acknowledgements must belong to Charith's squad ('grp-001')
    const acks = await dataStore.getAcknowledgements({ itemType: 'document', itemId: 'squad-doc-1' });
    expect(acks.every((a) => a.group_id === 'grp-001')).toBe(true);
  });

  it('ALLOWS an intern to acknowledge their assigned item and prevents tampering with recipient identity', async () => {
    // 1. Admin registers requirement
    await acknowledgementService.registerRequirement({
      itemType: 'notice',
      itemId: 'notice-tamper-check',
      itemTitle: 'Town Hall Meeting Notes',
      targetAudience: 'interns',
    });

    // 2. Intern submits acknowledgement
    const req = makeAuthRequest('/api/acknowledgements/acknowledge', {
      method: 'POST',
      token: internToken,
      body: {
        itemType: 'notice',
        itemId: 'notice-tamper-check',
        notes: 'Read during lunch break.',
      },
    });

    const res = await acknowledgeRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.acknowledgement.recipient_user_id).toBe(internUser.id);
    expect(data.acknowledgement.status).toBe('acknowledged');
  });

  it('DENIES unauthenticated callers from acknowledging items', async () => {
    const req = makeAuthRequest('/api/acknowledgements/acknowledge', {
      method: 'POST',
      body: {
        itemType: 'notice',
        itemId: 'notice-test',
      },
    });

    const res = await acknowledgeRoute(req);
    expect(res.status).toBe(401);
  });

  it('DENIES regular interns from triggering global reminder loops', async () => {
    const req = makeAuthRequest('/api/acknowledgements/remind', {
      method: 'POST',
      token: internToken,
      body: {},
    });

    const res = await remindRoute(req);
    expect(res.status).toBe(403);
  });

  it('ALLOWS admins to trigger reminders and view the admin acknowledgement console', async () => {
    // 1. Remind route
    const remindReq = makeAuthRequest('/api/acknowledgements/remind', {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    const remindRes = await remindRoute(remindReq);
    expect(remindRes.status).toBe(200);

    // 2. Admin Telemetry route
    const adminReq = makeAuthRequest('/api/admin/acknowledgements', {
      token: adminToken,
    });
    const adminRes = await adminAcksRoute(adminReq);
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();
    expect(adminData.success).toBe(true);
    expect(adminData.metrics).toBeDefined();
  });

  it('BLOCKS regular interns from accessing the admin acknowledgement console', async () => {
    const req = makeAuthRequest('/api/admin/acknowledgements', {
      token: internToken,
    });

    const res = await adminAcksRoute(req);
    expect(res.status).toBe(403);
  });
});
