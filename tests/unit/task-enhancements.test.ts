import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { POST as createTaskRoute, GET as getTasksRoute } from '@/app/api/tasks/route';
import { PUT as updateTaskRoute } from '@/app/api/tasks/[id]/route';
import { POST as commentTaskRoute } from '@/app/api/tasks/[id]/comments/route';
import { POST as acknowledgeTaskRoute } from '@/app/api/tasks/[id]/acknowledge/route';
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

describe('Phase 4: Tasks Module Improvements (§ 9)', () => {
  let adminUser: any;
  let leadUser: any;
  let internUser: any;
  let peerUser: any;

  let adminToken: string;
  let leadToken: string;
  let internToken: string;
  let peerToken: string;

  let internEmp: any;
  let leadEmp: any;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    adminUser = await dataStore.getUserByUsername('admin');
    internUser = await dataStore.getUserByUsername('rahul');
    peerUser = await dataStore.getUserByUsername('priya');

    internEmp = await dataStore.getEmployeeByUserId(internUser.id);

    // Ensure we have a lead employee
    const charithDb = await dataStore.getUserByUsername('charith');
    if (charithDb) {
      await dataStore.updateUser(charithDb.id, { role: 'team_lead' });
      leadUser = await dataStore.getUserById(charithDb.id);
      leadEmp = await dataStore.getEmployeeByUserId(leadUser.id);
    }

    adminToken = await createSessionToken(adminUser, ['admin@cruvels.com']);
    internToken = await createSessionToken(internUser, ['rahul@cruvels.com']);
    peerToken = await createSessionToken(peerUser, ['priya@cruvels.com']);
    leadToken = await createSessionToken(leadUser, ['charith@cruvels.com']);
  });

  describe('Store Layer: Status flow, Comments, and Acknowledgement', () => {
    it('supports 5-stage workflow including blocked status and POC assignment', async () => {
      const task = await dataStore.createTask({
        title: 'API Gateway Rate-Limiter',
        description: 'Implement distributed token bucket',
        status: 'blocked',
        priority: 'urgent',
        due_date: '2026-10-30',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
        assigned_poc_id: leadEmp?.id || adminUser.id,
        assigned_poc_name: leadEmp?.name || adminUser.name,
        requires_acknowledgement: true,
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe('blocked');
      expect(task.assigned_poc_name).toBeDefined();
      expect(task.requires_acknowledgement).toBe(true);
      expect(task.comments).toEqual([]);
    });

    it('adds task comment and appends activity entry', async () => {
      const task = await dataStore.createTask({
        title: 'Dockerizing Next.js',
        description: 'Multi-stage Dockerfile setup',
        status: 'in_progress',
        priority: 'medium',
        due_date: '2026-10-25',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
      });

      const updated = await dataStore.addTaskComment(task.id, {
        author_id: internUser.id,
        author_name: internUser.name,
        content: 'Encountered alpine glibc compatibility issue.',
      });

      expect(updated).toBeDefined();
      expect(updated?.comments).toHaveLength(1);
      expect(updated?.comments?.[0].content).toBe('Encountered alpine glibc compatibility issue.');
      expect(updated?.comments?.[0].author_name).toBe(internUser.name);

      const hasActivity = updated?.activity.some((a) => a.action === 'commented');
      expect(hasActivity).toBe(true);
    });

    it('records task receipt acknowledgement', async () => {
      const task = await dataStore.createTask({
        title: 'Cruvels Security Audit',
        description: 'Verify CSP headers',
        status: 'todo',
        priority: 'high',
        due_date: '2026-10-20',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
        requires_acknowledgement: true,
      });

      expect(task.acknowledged_at).toBeUndefined();

      const acked = await dataStore.acknowledgeTaskReceipt(task.id, internUser.id, internUser.name);
      expect(acked).toBeDefined();
      expect(acked?.acknowledged_at).toBeDefined();
      expect(acked?.acknowledged_by_id).toBe(internUser.id);
      expect(acked?.activity.some((a) => a.action === 'acknowledged receipt')).toBe(true);
    });
  });

  describe('API Endpoints: Tasks, Comments, and Notifications', () => {
    it('creates task requiring acknowledgement and registers universal requirement', async () => {
      const req = makeAuthRequest('/api/tasks', {
        method: 'POST',
        token: adminToken,
        body: {
          title: 'Implement OAuth Token Refresh',
          description: 'Ensure token rotation works seamlessly',
          status: 'todo',
          priority: 'high',
          dueDate: '2026-10-15',
          assignedToId: internEmp.id,
          assignedPocId: leadEmp?.id,
          requiresAcknowledgement: true,
        },
      });

      const res = await createTaskRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.task.requires_acknowledgement).toBe(true);

      // Verify notification sent to assignee with action_required
      const notifs = await dataStore.getNotifications(internUser.id, { state: 'action_required' });
      expect(notifs.some((n) => n.title.includes('Implement OAuth Token Refresh'))).toBe(true);
    });

    it('notifies POC when task status is updated to blocked', async () => {
      const task = await dataStore.createTask({
        title: 'Database Schema Optimization',
        description: 'Index high-frequency columns',
        status: 'in_progress',
        priority: 'high',
        due_date: '2026-10-18',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
        assigned_poc_id: leadUser.id,
      });

      const req = makeAuthRequest(`/api/tasks/${task.id}`, {
        method: 'PUT',
        token: internToken,
        body: { status: 'blocked' },
      });

      const res = await updateTaskRoute(req, {
        params: Promise.resolve({ id: task.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.task.status).toBe('blocked');

      // Check lead received blocked notification
      const leadNotifs = await dataStore.getNotifications(leadUser.id);
      expect(leadNotifs.some((n) => n.title.includes('Task Blocked'))).toBe(true);
    });

    it('allows assignee to add comment and stakeholders to read it', async () => {
      const task = await dataStore.createTask({
        title: 'Redis Pub/Sub Setup',
        description: 'Setup Redis adapter',
        status: 'in_progress',
        priority: 'medium',
        due_date: '2026-10-22',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
      });

      const req = makeAuthRequest(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        token: internToken,
        body: { content: 'Redis cluster configured on port 6379.' },
      });

      const res = await commentTaskRoute(req, {
        params: Promise.resolve({ id: task.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.task.comments).toHaveLength(1);
      expect(json.task.comments[0].content).toBe('Redis cluster configured on port 6379.');
    });

    it('allows assignee to acknowledge task receipt', async () => {
      const task = await dataStore.createTask({
        title: 'Security Compliance Verification',
        description: 'Verify zero-trust policies',
        status: 'todo',
        priority: 'urgent',
        due_date: '2026-10-10',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
        requires_acknowledgement: true,
      });

      const req = makeAuthRequest(`/api/tasks/${task.id}/acknowledge`, {
        method: 'POST',
        token: internToken,
      });

      const res = await acknowledgeTaskRoute(req, {
        params: Promise.resolve({ id: task.id }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.task.acknowledged_at).toBeDefined();
    });

    it('DENIES peer interns from acknowledging a task assigned to someone else', async () => {
      const task = await dataStore.createTask({
        title: 'Private Core Task',
        description: 'Confidential feature',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-10-12',
        assigned_to_id: internEmp.id,
        assigned_to_name: internEmp.name,
        created_by_id: adminUser.id,
        created_by_name: adminUser.name,
        requires_acknowledgement: true,
      });

      const req = makeAuthRequest(`/api/tasks/${task.id}/acknowledge`, {
        method: 'POST',
        token: peerToken,
      });

      const res = await acknowledgeTaskRoute(req, {
        params: Promise.resolve({ id: task.id }),
      });

      // Since peer is not assignee, creator, or admin
      expect([403, 404]).toContain(res.status);
    });
  });
});
