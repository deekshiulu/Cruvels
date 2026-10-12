/**
 * Native-feeling enterprise toast notification helper for Cruvels Workplace OS.
 * Dispatches custom events to the AppShell floating toast engine.
 */

export type ToastType = 'info' | 'success' | 'error';

export function showToast(message: string, type: ToastType = 'info'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: { type, message },
    })
  );
}

export function showSuccess(message: string): void {
  showToast(message, 'success');
}

export function showError(message: string): void {
  showToast(message, 'error');
}

export function showInfo(message: string): void {
  showToast(message, 'info');
}
