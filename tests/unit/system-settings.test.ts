import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { dataStore } from '@/lib/db/store';
import { GET as getSettingsRoute, PATCH as patchSettingsRoute, POST as postSettingsRoute } from '@/app/api/admin/settings/route';
import { createSessionToken } from '@/lib/auth/session';
import { DEFAULT_SYSTEM_SETTINGS, DEFAULT_ATTENDANCE_RULES } from '@/lib/db/types';

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

describe('Phase 6: Dynamic System Settings & Admin Control Center (§§ 14, 15)', () => {
  let adminToken: string;
  let internToken: string;
  let adminUser: any;
  let internUser: any;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    adminUser = await dataStore.getUserByUsername('admin');
    internUser = await dataStore.getUserByUsername('rahul');

    adminToken = await createSessionToken(adminUser, ['admin@cruvels.com']);
    internToken = await createSessionToken(internUser, ['rahul@cruvels.com']);
  });

  describe('1. Store System Settings Lifecycle & Parity', () => {
    it('initializes with default system settings', async () => {
      const settings = await dataStore.getSystemSettings();
      expect(settings.portalName).toBe('Cruvels Workplace OS');
      expect(settings.attendanceRules.markingDeadline).toBe(DEFAULT_ATTENDANCE_RULES.markingDeadline);
      expect(settings.attendanceRules.gracePeriodMinutes).toBe(30);
      expect(settings.reminderTiming.first_reminder).toBe('09:30');
      expect(settings.taskReminderIntervals.unacknowledged_hours).toBe(24);
      expect(settings.holidays.length).toBeGreaterThan(0);
    });

    it('updates attendance rules and synchronizes with attendanceRules collection', async () => {
      await dataStore.updateSystemSettings({
        attendanceRules: {
          markingDeadline: '10:30',
          gracePeriodMinutes: 45,
          workingDays: [1, 2, 3, 4, 5, 6],
          checkInCheckOutRequired: true,
          lateMarkingAllowed: true,
          allowSelfEditAfterSubmission: false,
          correctionApproverRole: 'group_leader',
          reminderTimes: ['10:00', '10:30'],
        },
      });

      const updatedSettings = await dataStore.getSystemSettings();
      expect(updatedSettings.attendanceRules.markingDeadline).toBe('10:30');
      expect(updatedSettings.attendanceRules.gracePeriodMinutes).toBe(45);

      const rulesDirect = await dataStore.getAttendanceRules();
      expect(rulesDirect.markingDeadline).toBe('10:30');
      expect(rulesDirect.gracePeriodMinutes).toBe(45);
      expect(rulesDirect.correctionApproverRole).toBe('group_leader');
    });

    it('allows adding and deleting public holidays', async () => {
      const newHoliday = {
        name: 'Cruvels Hackathon Day',
        date: '2026-10-15',
        type: 'company' as const,
        description: 'Annual corporate innovation hackathon',
      };

      const updatedList = await dataStore.addHoliday(newHoliday);
      expect(updatedList.some((h) => h.name === 'Cruvels Hackathon Day')).toBe(true);

      const afterDelete = await dataStore.deleteHoliday('2026-10-15', 'Cruvels Hackathon Day');
      expect(afterDelete.some((h) => h.name === 'Cruvels Hackathon Day')).toBe(false);
    });
  });

  describe('2. Zero-Trust Access Control & Security Boundaries (§ 14, § 15, § 17)', () => {
    it('prevents regular interns from reading system configuration', async () => {
      const req = makeAuthRequest('/api/admin/settings', {
        method: 'GET',
        token: internToken,
      });

      const res = await getSettingsRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('prevents regular interns from patching system configuration', async () => {
      const req = makeAuthRequest('/api/admin/settings', {
        method: 'PATCH',
        token: internToken,
        body: {
          attendanceRules: { markingDeadline: '12:00' },
        },
      });

      const res = await patchSettingsRoute(req);
      expect(res.status).toBe(403);
    });

    it('allows administrators to fetch system configuration', async () => {
      const req = makeAuthRequest('/api/admin/settings', {
        method: 'GET',
        token: adminToken,
      });

      const res = await getSettingsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.settings).toBeDefined();
      expect(json.settings.portalName).toBe('Cruvels Workplace OS');
    });
  });

  describe('3. Dynamic Configuration Validation & Audit Logging (§ 15, § 16)', () => {
    it('successfully patches settings and creates audit trail', async () => {
      const req = makeAuthRequest('/api/admin/settings', {
        method: 'PATCH',
        token: adminToken,
        body: {
          attendanceRules: {
            markingDeadline: '10:15',
            gracePeriodMinutes: 20,
          },
          reminderTiming: {
            first_reminder: '09:45',
            second_reminder: '10:15',
            deadline_warning: true,
          },
          taskReminderIntervals: {
            unacknowledged_hours: 48,
          },
        },
      });

      const res = await patchSettingsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.settings.attendanceRules.markingDeadline).toBe('10:15');
      expect(json.settings.attendanceRules.gracePeriodMinutes).toBe(20);
      expect(json.settings.reminderTiming.first_reminder).toBe('09:45');
      expect(json.settings.taskReminderIntervals.unacknowledged_hours).toBe(48);

      // Verify audit log
      const audits = await dataStore.listAuditLogs();
      const settingLog = audits.find((a) => a.action === 'SETTINGS_UPDATED');
      expect(settingLog).toBeDefined();
      expect(settingLog?.user_id).toBe(adminUser.id);
    });

    it('rejects invalid time formats with 400 status', async () => {
      const req = makeAuthRequest('/api/admin/settings', {
        method: 'PATCH',
        token: adminToken,
        body: {
          attendanceRules: {
            markingDeadline: '25:99', // Invalid 24h time
          },
        },
      });

      const res = await patchSettingsRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid format');
    });

    it('rejects invalid grace period outside allowable range', async () => {
      const req = makeAuthRequest('/api/admin/settings', {
        method: 'PATCH',
        token: adminToken,
        body: {
          attendanceRules: {
            gracePeriodMinutes: -10,
          },
        },
      });

      const res = await patchSettingsRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('handles add_holiday, delete_holiday, and reset_defaults via POST', async () => {
      // 1. Add holiday via POST
      const addReq = makeAuthRequest('/api/admin/settings', {
        method: 'POST',
        token: adminToken,
        body: {
          action: 'add_holiday',
          holiday: {
            name: 'Cruvels Foundation Day',
            date: '2026-11-15',
            type: 'company',
            description: 'Cruvels founding anniversary',
          },
        },
      });
      const addRes = await postSettingsRoute(addReq);
      expect(addRes.status).toBe(200);
      const addJson = await addRes.json();
      expect(addJson.success).toBe(true);
      expect(addJson.holidays.some((h: any) => h.name === 'Cruvels Foundation Day')).toBe(true);

      // 2. Delete holiday via POST
      const delReq = makeAuthRequest('/api/admin/settings', {
        method: 'POST',
        token: adminToken,
        body: {
          action: 'delete_holiday',
          date: '2026-11-15',
          name: 'Cruvels Foundation Day',
        },
      });
      const delRes = await postSettingsRoute(delReq);
      expect(delRes.status).toBe(200);

      // 3. Reset to defaults
      const resetReq = makeAuthRequest('/api/admin/settings', {
        method: 'POST',
        token: adminToken,
        body: {
          action: 'reset_defaults',
        },
      });
      const resetRes = await postSettingsRoute(resetReq);
      expect(resetRes.status).toBe(200);
      const resetJson = await resetRes.json();
      expect(resetJson.success).toBe(true);
      expect(resetJson.settings.attendanceRules.markingDeadline).toBe('10:00');
    });
  });
});
