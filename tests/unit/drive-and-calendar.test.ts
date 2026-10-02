import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { GET as getDriveRoute, POST as postDriveRoute } from '@/app/api/drive/route';
import { DELETE as deleteDriveRoute } from '@/app/api/drive/[id]/route';
import { POST as createScheduleRoute } from '@/app/api/schedule/route';
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

describe('Phase 5: Google Drive & Calendar Enhancements (§§ 12, 13)', () => {
  let adminUser: any;
  let internUser: any;
  let peerUser: any;

  let adminToken: string;
  let internToken: string;
  let peerToken: string;

  let internEmp: any;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    adminUser = await dataStore.getUserByUsername('admin');
    internUser = await dataStore.getUserByUsername('rahul');
    peerUser = await dataStore.getUserByUsername('priya');

    internEmp = await dataStore.getEmployeeByUserId(internUser.id);

    adminToken = await createSessionToken(adminUser, ['admin@cruvels.com']);
    internToken = await createSessionToken(internUser, ['rahul@cruvels.com']);
    peerToken = await createSessionToken(peerUser, ['priya@cruvels.com']);
  });

  describe('Google Drive Integration (§ 12)', () => {
    it('seeds official company resources and squad project files', async () => {
      const allResources = await dataStore.getDriveResources({ isAdmin: true });
      expect(allResources.length).toBeGreaterThanOrEqual(4);

      const companyResources = allResources.filter((r) => r.section === 'company_resources');
      expect(companyResources.length).toBeGreaterThanOrEqual(4);
      expect(companyResources.some((r) => r.name.includes('Brand Guidelines'))).toBe(true);
      expect(companyResources.some((r) => r.name.includes('Handbook'))).toBe(true);
    });

    it('enforces section and squad scoping for regular interns', async () => {
      // Create a private deliverable for Intern A
      const privateFile = await dataStore.createDriveResource({
        name: 'Rahul Private Notes',
        section: 'my_files',
        file_type: 'doc',
        external_url: 'https://docs.google.com/document/d/private-rahul/edit',
        owner_user_id: internUser.id,
        owner_name: internUser.name,
      });

      // Query as Intern A
      const rahulFiles = await dataStore.getDriveResources({
        userId: internUser.id,
        groupId: internEmp?.group_id,
        isAdmin: false,
      });
      expect(rahulFiles.some((f) => f.id === privateFile.id)).toBe(true);

      // Query as Peer Intern B
      const peerEmp = await dataStore.getEmployeeByUserId(peerUser.id);
      const priyaFiles = await dataStore.getDriveResources({
        userId: peerUser.id,
        groupId: peerEmp?.group_id || undefined,
        isAdmin: false,
      });
      expect(priyaFiles.some((f) => f.id === privateFile.id)).toBe(false);
    });

    it('POST /api/drive links a resource and GET /api/drive retrieves it', async () => {
      const req = makeAuthRequest('/api/drive', {
        method: 'POST',
        token: internToken,
        body: {
          name: 'Q3 Intern Deliverable RFC',
          description: 'Design doc for internal tools',
          section: 'my_files',
          fileType: 'doc',
          externalUrl: 'https://docs.google.com/document/d/1deliverable-rfc/preview',
        },
      });

      const res = await postDriveRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.resource.name).toBe('Q3 Intern Deliverable RFC');

      // Verify GET returns it
      const getReq = makeAuthRequest('/api/drive?section=my_files', {
        method: 'GET',
        token: internToken,
      });
      const getRes = await getDriveRoute(getReq);
      const getJson = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getJson.resources.some((r: any) => r.id === json.resource.id)).toBe(true);
    });

    it('DENIES regular interns from publishing to company_resources', async () => {
      const req = makeAuthRequest('/api/drive', {
        method: 'POST',
        token: internToken,
        body: {
          name: 'Unauthorized Policy Document',
          section: 'company_resources',
          fileType: 'doc',
          externalUrl: 'https://docs.google.com/document/d/unauth/preview',
        },
      });

      const res = await postDriveRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('DELETE /api/drive/[id] allows owner or admin to unlink, denies other interns', async () => {
      const file = await dataStore.createDriveResource({
        name: 'Rahul Shared Draft',
        section: 'shared_files',
        file_type: 'doc',
        external_url: 'https://docs.google.com/document/d/shared/preview',
        owner_user_id: internUser.id,
        owner_name: internUser.name,
      });

      // Priya tries to delete Rahul's file
      const denyReq = makeAuthRequest(`/api/drive/${file.id}`, {
        method: 'DELETE',
        token: peerToken,
      });
      const denyRes = await deleteDriveRoute(denyReq, { params: Promise.resolve({ id: file.id }) });
      expect(denyRes.status).toBe(403);

      // Rahul deletes his own file
      const allowReq = makeAuthRequest(`/api/drive/${file.id}`, {
        method: 'DELETE',
        token: internToken,
      });
      const allowRes = await deleteDriveRoute(allowReq, { params: Promise.resolve({ id: file.id }) });
      expect(allowRes.status).toBe(200);
    });
  });

  describe('Calendar & Scheduling Enhancements (§ 13)', () => {
    it('detects meeting overlaps and approved leaves during scheduling', async () => {
      // 1. Create existing meeting
      await dataStore.createScheduleEvent({
        title: 'Core Platform Standup',
        description: 'Daily sync',
        event_type: 'meeting',
        start_time: '2026-10-15T10:00:00.000Z',
        end_time: '2026-10-15T11:00:00.000Z',
        attendee_ids: [internUser.id],
        created_by: adminUser.id,
      });

      // 2. Schedule overlapping meeting with Intern A
      const req = makeAuthRequest('/api/schedule', {
        method: 'POST',
        token: adminToken,
        body: {
          title: 'Emergency RFC Review',
          eventType: 'meeting',
          startTime: '2026-10-15T10:30:00.000Z',
          endTime: '2026-10-15T11:30:00.000Z',
          meetingLink: 'https://meet.google.com/abc-defg-hij',
          attendeeIds: [internUser.id],
        },
      });

      const res = await createScheduleRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.warnings.length).toBeGreaterThanOrEqual(1);
      expect(json.warnings.some((w: string) => w.includes('Overlap with'))).toBe(true);
      expect(json.event.meeting_platform).toBe('google_meet');
    });

    it('flags warning if an attendee has approved leave on event date', async () => {
      // Intern A takes leave on 2026-10-20
      await dataStore.createLeaveRequest({
        employee_id: internEmp.id,
        employee_name: internEmp.name,
        employee_code: internEmp.employee_code || 'EMP001',
        department_name: internEmp.department_name || 'Engineering',
        leave_type: 'CASUAL',
        start_date: '2026-10-20',
        end_date: '2026-10-20',
        days_count: 1,
        reason: 'Personal errands',
        status: 'APPROVED',
      });

      const req = makeAuthRequest('/api/schedule', {
        method: 'POST',
        token: adminToken,
        body: {
          title: 'Sprint Retrospective',
          eventType: 'meeting',
          startTime: '2026-10-20T14:00:00.000Z',
          endTime: '2026-10-20T15:00:00.000Z',
          meetingLink: 'https://zoom.us/j/1234567890',
          attendeeIds: [internUser.id],
        },
      });

      const res = await createScheduleRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.warnings.some((w: string) => w.includes('approved leave'))).toBe(true);
      expect(json.event.meeting_platform).toBe('zoom');
    });
  });
});
