import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { PATCH as updateRulesRoute, GET as getRulesRoute } from '@/app/api/compliance/rules/route';
import { GET as getCorrectionsRoute, POST as createCorrectionRoute } from '@/app/api/attendance/corrections/route';
import { PATCH as reviewCorrectionRoute } from '@/app/api/attendance/corrections/[id]/route';
import { GET as getAdminComplianceRoute } from '@/app/api/admin/compliance/route';
import { createSessionToken } from '@/lib/auth/session';

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

describe('Phase 1: Compliance Zero-Trust Authorization & Scoping (§ 1.1, § 3, § 17, § 18)', () => {
  let adminToken: string;
  let leadToken: string;
  let internToken: string;
  let otherInternToken: string;

  let adminUser: any;
  let leadUser: any;
  let internUser: any;
  let otherInternUser: any;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    adminUser = await dataStore.getUserByUsername('admin');
    const charithDb = await dataStore.getUserByUsername('charith');
    if (charithDb) {
      await dataStore.updateUser(charithDb.id, { role: 'team_lead' });
      leadUser = await dataStore.getUserById(charithDb.id);
    }
    internUser = await dataStore.getUserByUsername('rahul');
    otherInternUser = await dataStore.getUserByUsername('sales.intern');

    adminToken = await createSessionToken(adminUser!, ['admin@cruvels.com']);
    leadToken = await createSessionToken(leadUser!, ['charith@cruvels.com']);
    internToken = await createSessionToken(internUser!, ['rahul@cruvels.com']);
    otherInternToken = await createSessionToken(otherInternUser!, ['sales.intern@cruvels.com']);
  });

  describe('Rules Configuration Endpoint Authorization', () => {
    it('DENIES regular interns from modifying attendance compliance rules', async () => {
      const req = makeAuthRequest('/api/compliance/rules', {
        method: 'PATCH',
        token: internToken,
        body: { markingDeadline: '11:00' },
      });

      const res = await updateRulesRoute(req);
      expect(res.status).toBe(403);
    });

    it('ALLOWS company admin to modify attendance compliance rules', async () => {
      const req = makeAuthRequest('/api/compliance/rules', {
        method: 'PATCH',
        token: adminToken,
        body: { markingDeadline: '10:30' },
      });

      const res = await updateRulesRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rules.markingDeadline).toBe('10:30');
    });
  });

  describe('Attendance Correction Submission & Scoping (§ 3, § 18)', () => {
    it('ALLOWS an intern to create a correction request for themselves', async () => {
      const req = makeAuthRequest('/api/attendance/corrections', {
        method: 'POST',
        token: internToken,
        body: {
          date: '2026-09-15',
          requested_status: 'PRESENT',
          reason: 'Forgot to punch attendance before daily standup.',
        },
      });

      const res = await createCorrectionRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.correction.status).toBe('PENDING');
      expect(data.correction.employee_name).toBe(internUser.name);
    });

    it('SCOPES correction list so peers cannot see each other requests', async () => {
      // Intern A creates a request
      await createCorrectionRoute(
        makeAuthRequest('/api/attendance/corrections', {
          method: 'POST',
          token: internToken,
          body: {
            date: '2026-09-15',
            requested_status: 'PRESENT',
            reason: 'Forgot to punch attendance.',
          },
        })
      );

      // Intern B lists corrections -> should be empty
      const listReq = makeAuthRequest('/api/attendance/corrections', { token: otherInternToken });
      const res = await getCorrectionsRoute(listReq);
      const data = await res.json();
      expect(data.corrections.length).toBe(0);

      // Admin lists corrections -> sees Intern A request
      const adminReq = makeAuthRequest('/api/attendance/corrections', { token: adminToken });
      const adminRes = await getCorrectionsRoute(adminReq);
      const adminData = await adminRes.json();
      expect(adminData.corrections.length).toBe(1);
    });
  });

  describe('Attendance Correction Review & Approval Boundaries (§ 3, § 17)', () => {
    it('DENIES regular intern from approving or rejecting correction requests', async () => {
      // Create request by Intern A
      const createRes = await createCorrectionRoute(
        makeAuthRequest('/api/attendance/corrections', {
          method: 'POST',
          token: internToken,
          body: {
            date: '2026-09-15',
            requested_status: 'PRESENT',
            reason: 'Forgot to punch attendance.',
          },
        })
      );
      const { correction } = await createRes.json();

      // Intern B tries to approve Intern A's request -> 403 Forbidden
      const reviewReq = makeAuthRequest(`/api/attendance/corrections/${correction.id}`, {
        method: 'PATCH',
        token: otherInternToken,
        body: { status: 'APPROVED' },
      });

      const reviewRes = await reviewCorrectionRoute(reviewReq, { params: Promise.resolve({ id: correction.id }) });
      expect(reviewRes.status).toBe(403);
    });

    it('ALLOWS squad leader to review correction request of their squad member', async () => {
      const createRes = await createCorrectionRoute(
        makeAuthRequest('/api/attendance/corrections', {
          method: 'POST',
          token: internToken,
          body: {
            date: '2026-09-15',
            requested_status: 'PRESENT',
            reason: 'Standup ran late.',
          },
        })
      );
      const { correction } = await createRes.json();

      // Sarah is group leader of grp-core-platform (Rahul's squad)
      const reviewReq = makeAuthRequest(`/api/attendance/corrections/${correction.id}`, {
        method: 'PATCH',
        token: leadToken,
        body: { status: 'APPROVED', review_notes: 'Confirmed in squad meeting.' },
      });

      const reviewRes = await reviewCorrectionRoute(reviewReq, { params: Promise.resolve({ id: correction.id }) });
      expect(reviewRes.status).toBe(200);
      const data = await reviewRes.json();
      expect(data.correction.status).toBe('APPROVED');
    });

    it('DENIES group leader from approving their own correction request (conflict of interest)', async () => {
      // Leader creates a correction request
      const createRes = await createCorrectionRoute(
        makeAuthRequest('/api/attendance/corrections', {
          method: 'POST',
          token: leadToken,
          body: {
            date: '2026-09-15',
            requested_status: 'PRESENT',
            reason: 'Traveling for conference.',
          },
        })
      );
      const { correction } = await createRes.json();

      // Leader tries to approve their own request -> 403
      const reviewReq = makeAuthRequest(`/api/attendance/corrections/${correction.id}`, {
        method: 'PATCH',
        token: leadToken,
        body: { status: 'APPROVED' },
      });

      const reviewRes = await reviewCorrectionRoute(reviewReq, { params: Promise.resolve({ id: correction.id }) });
      expect(reviewRes.status).toBe(403);

      // Admin CAN approve leader's request
      const adminReviewReq = makeAuthRequest(`/api/attendance/corrections/${correction.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED', review_notes: 'Approved by admin.' },
      });
      const adminReviewRes = await reviewCorrectionRoute(adminReviewReq, { params: Promise.resolve({ id: correction.id }) });
      expect(adminReviewRes.status).toBe(200);
    });
  });

  describe('Admin Compliance Dashboard Endpoint Scoping (§ 2, § 18)', () => {
    it('BLOCKS unauthorized interns from accessing the compliance admin dashboard', async () => {
      const req = makeAuthRequest('/api/admin/compliance', { token: internToken });
      const res = await getAdminComplianceRoute(req);
      expect(res.status).toBe(403);
    });

    it('ALLOWS Group Leaders to view compliance metrics scoped strictly to their squad', async () => {
      const req = makeAuthRequest('/api/admin/compliance', { token: leadToken });
      const res = await getAdminComplianceRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teams.length).toBe(1);
      expect(data.teams[0].groupId).toBe('grp-001');
    });

    it('ALLOWS Admins to view compliance metrics across all company squads', async () => {
      const req = makeAuthRequest('/api/admin/compliance', { token: adminToken });
      const res = await getAdminComplianceRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teams.length).toBeGreaterThanOrEqual(2);
    });
  });
});
