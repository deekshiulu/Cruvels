'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldCheck, Check } from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  syncPushSubscription,
} from '@/lib/notifications/client-push';

const DISMISS_KEY = 'cruvels_notif_prompt_dismissed';

export default function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [grantedBanner, setGrantedBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const currentPerm = getNotificationPermission();

    // If already granted, ensure push subscription is synced with server
    if (currentPerm === 'granted') {
      syncPushSubscription();
      return;
    }

    // If explicitly denied, browser policy prevents re-prompting
    if (currentPerm === 'denied') {
      return;
    }

    // Check if dismissed in this browser session
    const isDismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
    if (isDismissed) {
      return;
    }

    // Permission is 'default' and not dismissed: Show prompt immediately so user is asked right away
    setShowPrompt(true);

    // Also attempt direct request on mount (succeeds automatically on PWAs, WebViews, and supporting environments)
    try {
      Notification.requestPermission()
        .then((perm) => {
          if (perm === 'granted') {
            syncPushSubscription();
            setShowPrompt(false);
            setGrantedBanner(true);
            setTimeout(() => setGrantedBanner(false), 3500);
          } else if (perm === 'denied') {
            setShowPrompt(false);
          }
        })
        .catch(() => {
          // Browser requires user gesture -> prompt banner remains active
        });
    } catch {
      // Browser requires user gesture -> prompt banner remains active
    }
  }, []);

  const handleAllow = async () => {
    setRequesting(true);
    try {
      const perm = await requestNotificationPermission();
      if (perm === 'granted') {
        setShowPrompt(false);
        setGrantedBanner(true);
        setTimeout(() => setGrantedBanner(false), 3500);
      } else {
        setShowPrompt(false);
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setShowPrompt(false);
  };

  if (grantedBanner) {
    return (
      <aside
        aria-label="Notification access granted"
        className="fixed top-3 inset-x-3 sm:top-5 sm:right-5 sm:left-auto sm:w-[380px] z-50 animate-in fade-in slide-in-from-top-3 duration-300"
      >
        <div
          className="flex items-center gap-3 p-3.5 rounded-2xl shadow-xl backdrop-blur-md border transition-all"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--teal)',
            boxShadow: '0 12px 36px -4px rgba(18, 32, 42, 0.18)',
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
          >
            <Check className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4
              className="text-xs font-bold leading-tight"
              style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}
            >
              Notifications Active
            </h4>
            <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--muted)' }}>
              Real-time punch-in and task alerts are now linked to this device.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <aside
      aria-label="Enable workplace notifications"
      className="fixed top-3 inset-x-3 sm:top-5 sm:right-5 sm:left-auto sm:w-[410px] z-50 animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md border transition-all"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--line)',
          boxShadow: '0 16px 40px -6px rgba(18, 32, 42, 0.22)',
        }}
      >
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-12 -right-12 h-24 w-24 rounded-full blur-2xl opacity-20 pointer-events-none"
          style={{ background: 'var(--teal)' }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
          aria-label="Close notification prompt"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs"
            style={{ background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--line)' }}
          >
            <Bell className="h-5 w-5 animate-pulse" />
            <span
              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--amber)' }}
            />
          </div>

          <div className="flex-1 pr-4">
            <div className="flex items-center gap-1.5">
              <h3
                className="text-sm font-bold tracking-tight"
                style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
              >
                Enable Notifications
              </h3>
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-bold"
                style={{ background: 'var(--surface-2)', color: 'var(--teal)', border: '1px solid var(--line)' }}
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                Real-Time
              </span>
            </div>

            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Get instant alerts for attendance punch-in reminders, pending task assignments, and priority workplace updates.
            </p>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleAllow}
                disabled={requesting}
                className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer active:scale-95 touch-manipulation min-h-[38px]"
                style={{
                  background: 'var(--teal)',
                  opacity: requesting ? 0.7 : 1,
                }}
              >
                <Bell className="h-3.5 w-3.5" />
                <span>{requesting ? 'Enabling...' : 'Allow Notifications'}</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer touch-manipulation hover:bg-black/5 dark:hover:bg-white/5 min-h-[38px]"
                style={{ color: 'var(--muted)' }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
