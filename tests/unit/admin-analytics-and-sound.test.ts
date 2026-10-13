import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dataStore } from '@/lib/db/store';
import { createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { GET as analyticsRoute } from '@/app/api/admin/analytics/route';
import { NextRequest } from 'next/server';
import {
  getCustomSound,
  setCustomSound,
  removeCustomSound,
} from '@/lib/utils/sound';

describe('Admin Analytics Pipeline & Custom Sound Unit Tests', () => {
  beforeEach(async () => {
    dataStore.resetAndSeed();
  });

  describe('GET /api/admin/analytics', () => {
    it('rejects unauthorized requests with 401 when no session is present', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/analytics');
      const res = await analyticsRoute(req);
      expect(res.status).toBe(401);
    });

    it('rejects non-admin role with 403 Forbidden', async () => {
      const allUsers = Array.from((dataStore as any).users.values()) as any[];
      const intern = allUsers.find((u) => u.role === 'intern');
      expect(intern).toBeDefined();

      const token = await createSessionToken(intern!, ['rahul@cruvels.com']);

      const req = new NextRequest('http://localhost:3000/api/admin/analytics', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/Administrative privileges/);
    });

    it('returns comprehensive workplace analytics for Admin Supervisor', async () => {
      const allUsers = Array.from((dataStore as any).users.values()) as any[];
      const admin = allUsers.find((u) => u.role === 'admin');
      expect(admin).toBeDefined();

      const token = await createSessionToken(admin!, ['admin@cruvels.com']);

      const req = new NextRequest('http://localhost:3000/api/admin/analytics?days=14', {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await analyticsRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.timeframeDays).toBe(14);
      expect(data.summary).toBeDefined();
      expect(typeof data.summary.avgPresenceRate).toBe('number');
      expect(typeof data.summary.taskCompletionRate).toBe('number');
      expect(typeof data.summary.overallProductivityScore).toBe('number');

      // Daily trends metrics
      expect(Array.isArray(data.dailyTrends)).toBe(true);
      expect(data.dailyTrends.length).toBe(14);
      const firstTrend = data.dailyTrends[0];
      expect(firstTrend).toHaveProperty('date');
      expect(firstTrend).toHaveProperty('present');
      expect(firstTrend).toHaveProperty('presenceRate');
      expect(firstTrend).toHaveProperty('tasksCreated');
      expect(firstTrend).toHaveProperty('tasksCompleted');

      // Task status breakdown & squad analytics
      expect(data.taskStatusCounts).toBeDefined();
      expect(data.taskStatusCounts).toHaveProperty('done');
      expect(Array.isArray(data.squadAnalytics)).toBe(true);
    });
  });

  describe('Custom Notification Sound Engine', () => {
    let mockStorage: Record<string, string> = {};
    const originalWindow = (global as any).window;
    const originalLocalStorage = (global as any).localStorage;

    beforeEach(() => {
      mockStorage = {};
      (global as any).window = global;
      (global as any).localStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          mockStorage = {};
        },
      };
    });

    afterEach(() => {
      (global as any).window = originalWindow;
      (global as any).localStorage = originalLocalStorage;
    });

    it('returns null when no custom sound has been saved', () => {
      expect(getCustomSound()).toBeNull();
    });

    it('stores and retrieves custom audio data URL in preferences', () => {
      const sampleAudioData = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAOAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA';
      setCustomSound('subtle-chime.mp3', sampleAudioData);

      const pref = getCustomSound();
      expect(pref).not.toBeNull();
      expect(pref?.name).toBe('subtle-chime.mp3');
      expect(pref?.dataUrl).toBe(sampleAudioData);
      expect(pref?.updatedAt).toBeGreaterThan(0);
    });

    it('clears custom sound and restores default', () => {
      setCustomSound('alert.wav', 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA');
      expect(getCustomSound()).not.toBeNull();

      removeCustomSound();
      expect(getCustomSound()).toBeNull();
    });
  });
});
