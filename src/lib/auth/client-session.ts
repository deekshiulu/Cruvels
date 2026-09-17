export const TAB_SESSION_KEY = 'cruvels_tab_session';
export const REMEMBER_ME_KEY = 'cruvels_remember_me';
export const TAB_CHANNEL_NAME = 'cruvels_tab_channel';

/**
 * Validates whether the current browser tab has an active session.
 * - If "Remember Me" is active in localStorage, persistent session across tabs/restarts is allowed.
 * - If current tab has sessionStorage marked active, session is allowed (e.g. reload or in-tab navigation).
 * - If neither, broadcasts a ping to check if another tab is currently open and active in this browser.
 * - If another tab answers within 75ms, this tab inherits active tab status.
 * - If no other tab answers, returns false (meaning the user closed all portal tabs and reopened without "Remember Me").
 */
export async function validateTabSession(): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  // 1. Remember Me takes precedence
  if (localStorage.getItem(REMEMBER_ME_KEY) === 'true') {
    sessionStorage.setItem(TAB_SESSION_KEY, 'active');
    return true;
  }

  // 2. Current tab already active (e.g. page refresh or client-side navigation)
  if (sessionStorage.getItem(TAB_SESSION_KEY) === 'active') {
    return true;
  }

  // 3. If BroadcastChannel is unavailable, fallback to false
  if (typeof BroadcastChannel === 'undefined') {
    return false;
  }

  // 4. Query other open tabs in the same browser
  return new Promise<boolean>((resolve) => {
    let resolved = false;
    let channel: BroadcastChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      channel = new BroadcastChannel(TAB_CHANNEL_NAME);
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'PONG_TAB_SESSION' && !resolved) {
          resolved = true;
          if (timer) clearTimeout(timer);
          channel?.close();
          sessionStorage.setItem(TAB_SESSION_KEY, 'active');
          resolve(true);
        }
      };

      channel.postMessage({ type: 'PING_TAB_SESSION' });

      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          channel?.close();
          resolve(false);
        }
      }, 75);
    } catch {
      resolve(false);
    }
  });
}

export function markTabSessionActive(rememberMe = false): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TAB_SESSION_KEY, 'active');
  if (rememberMe) {
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
  } else {
    localStorage.removeItem(REMEMBER_ME_KEY);
  }
}

export function clearTabSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TAB_SESSION_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
}
