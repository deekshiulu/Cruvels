import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { applySessionCookie, AUTH_COOKIE_NAME } from '@/lib/auth/session';
import {
  validateTabSession,
  markTabSessionActive,
  clearTabSession,
  TAB_SESSION_KEY,
  REMEMBER_ME_KEY,
  TAB_CHANNEL_NAME,
} from '@/lib/auth/client-session';

describe('Tab-Scoped Authentication & Session Persistence', () => {
  let mockSessionStorage: Record<string, string> = {};
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    mockSessionStorage = {};
    mockLocalStorage = {};

    const mockSession = {
      getItem: (key: string) => mockSessionStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        mockSessionStorage = {};
      },
    };

    const mockLocal = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
    };

    const mockWindow = {
      sessionStorage: mockSession,
      localStorage: mockLocal,
    };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('sessionStorage', mockSession);
    vi.stubGlobal('localStorage', mockLocal);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Server Cookie Policy (applySessionCookie)', () => {
    it('applies a browser session cookie (no maxAge) when rememberMe is false', () => {
      const response = NextResponse.json({ success: true });
      applySessionCookie(response, 'mock-jwt-token', false);

      const cookie = response.cookies.get(AUTH_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('mock-jwt-token');
      // When maxAge is omitted, cookie is transient browser session cookie
      expect(cookie?.maxAge).toBeUndefined();
    });

    it('applies a 30-day persistent cookie with maxAge when rememberMe is true', () => {
      const response = NextResponse.json({ success: true });
      applySessionCookie(response, 'mock-jwt-token', true);

      const cookie = response.cookies.get(AUTH_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('mock-jwt-token');
      expect(cookie?.maxAge).toBe(60 * 60 * 24 * 30);
    });
  });

  describe('Client Tab Session State Management', () => {
    it('marks tab session active and removes remember_me when rememberMe is false', () => {
      mockLocalStorage[REMEMBER_ME_KEY] = 'true';
      markTabSessionActive(false);

      expect(mockSessionStorage[TAB_SESSION_KEY]).toBe('active');
      expect(mockLocalStorage[REMEMBER_ME_KEY]).toBeUndefined();
    });

    it('marks tab session active and sets remember_me when rememberMe is true', () => {
      markTabSessionActive(true);

      expect(mockSessionStorage[TAB_SESSION_KEY]).toBe('active');
      expect(mockLocalStorage[REMEMBER_ME_KEY]).toBe('true');
    });

    it('clears both tab session and remember_me on logout', () => {
      mockSessionStorage[TAB_SESSION_KEY] = 'active';
      mockLocalStorage[REMEMBER_ME_KEY] = 'true';

      clearTabSession();

      expect(mockSessionStorage[TAB_SESSION_KEY]).toBeUndefined();
      expect(mockLocalStorage[REMEMBER_ME_KEY]).toBeUndefined();
    });
  });

  describe('Tab Session Validation (validateTabSession)', () => {
    it('resolves true immediately when remember_me is set in localStorage', async () => {
      mockLocalStorage[REMEMBER_ME_KEY] = 'true';
      const isValid = await validateTabSession();

      expect(isValid).toBe(true);
      expect(mockSessionStorage[TAB_SESSION_KEY]).toBe('active');
    });

    it('resolves true immediately when tab session is already active in sessionStorage', async () => {
      mockSessionStorage[TAB_SESSION_KEY] = 'active';
      const isValid = await validateTabSession();

      expect(isValid).toBe(true);
    });

    it('resolves false when tab was closed (sessionStorage empty) and rememberMe was not chosen', async () => {
      // Mock BroadcastChannel with no peer responding
      class MockBroadcastChannel {
        name: string;
        onmessage: ((ev: any) => void) | null = null;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(_msg: any) {
          // No peers open
        }
        close() {}
      }
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

      const isValid = await validateTabSession();
      expect(isValid).toBe(false);
    });

    it('resolves true when another tab responds with PONG_TAB_SESSION', async () => {
      class MockBroadcastChannel {
        name: string;
        onmessage: ((ev: any) => void) | null = null;
        constructor(name: string) {
          this.name = name;
        }
        postMessage(msg: any) {
          if (msg?.type === 'PING_TAB_SESSION') {
            // Simulate another open tab replying
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage({ data: { type: 'PONG_TAB_SESSION' } });
              }
            }, 10);
          }
        }
        close() {}
      }
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

      const isValid = await validateTabSession();
      expect(isValid).toBe(true);
      expect(mockSessionStorage[TAB_SESSION_KEY]).toBe('active');
    });
  });
});
