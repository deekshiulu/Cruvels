'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Laptop,
  Sparkles,
} from 'lucide-react';

interface MailReminderModalProps {
  messageId: string;
  messageSubject: string;
  onClose: () => void;
  onReminderSet?: (remindAt: string) => void;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function MailReminderModal({
  messageId,
  messageSubject,
  onClose,
  onReminderSet,
}: MailReminderModalProps) {
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [requestingPerm, setRequestingPerm] = useState(false);
  const [permMessage, setPermMessage] = useState<string | null>(null);

  // Preset or custom time selection
  const [preset, setPreset] = useState<'1h' | 'tomorrow' | '2d' | 'custom'>('1h');
  const [customDateTime, setCustomDateTime] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermMessage('Push notifications are not supported in this browser environment.');
      return;
    }

    setRequestingPerm(true);
    setPermMessage(null);
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);

      if (perm === 'granted') {
        setPermMessage('Notification permission granted! Registering background push service...');
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const vapidRes = await fetch('/api/notifications/vapid');
          if (vapidRes.ok) {
            const { publicKey } = await vapidRes.json();
            if (publicKey) {
              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
              });

              const p256dh = sub.getKey('p256dh');
              const auth = sub.getKey('auth');

              if (p256dh && auth) {
                const p256dhStr = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dh))));
                const authStr = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(auth))));

                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                await fetch('/api/notifications/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    endpoint: sub.endpoint,
                    keys: { p256dh: p256dhStr, auth: authStr },
                    deviceName: isMobile ? 'Mobile Smartphone' : 'Desktop Workstation',
                  }),
                });
                setPermMessage('Desktop & mobile push alerts active! You will be alerted when reminders fire.');
              }
            }
          }
        }
      } else if (perm === 'denied') {
        setPermMessage('Notifications blocked in browser settings. Please allow notifications in site permissions.');
      }
    } catch (e: any) {
      setPermMessage('Could not register push service: ' + (e?.message || 'Unknown error'));
    } finally {
      setRequestingPerm(false);
    }
  };

  const calculateTargetTime = (): Date => {
    const now = new Date();
    if (preset === '1h') {
      return new Date(now.getTime() + 60 * 60 * 1000);
    }
    if (preset === 'tomorrow') {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      tom.setHours(9, 0, 0, 0); // 9:00 AM tomorrow
      return tom;
    }
    if (preset === '2d') {
      const d2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      d2.setHours(9, 0, 0, 0);
      return d2;
    }
    if (preset === 'custom' && customDateTime) {
      return new Date(customDateTime);
    }
    return new Date(now.getTime() + 60 * 60 * 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const targetTime = calculateTargetTime();
      if (isNaN(targetTime.getTime()) || targetTime.getTime() <= Date.now()) {
        setError('Please select a reminder time in the future.');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/mail/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          messageSubject,
          remindAt: targetTime.toISOString(),
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to schedule reminder');
        return;
      }

      if (onReminderSet) {
        onReminderSet(targetTime.toISOString());
      }
      onClose();
    } catch {
      setError('Network error while scheduling reminder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in"
      style={{ background: 'rgba(10, 20, 25, 0.65)', backdropFilter: 'blur(5px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl"
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          color: 'var(--ink, #0f172a)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--line-soft, #f1f5f9)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                Set Email Reminder & Snooze
              </h3>
              <p className="text-[11px] truncate max-w-xs" style={{ color: 'var(--muted)' }}>{messageSubject}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors opacity-70 hover:opacity-100"
            style={{ color: 'var(--ink)' }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Permission Banner (Desktop & Mobile Push) */}
        {notificationPermission !== 'granted' ? (
          <div
            className="rounded-xl p-3.5 space-y-2.5 text-xs"
            style={{
              background: 'rgba(14, 165, 233, 0.1)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <Bell className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block" style={{ color: 'var(--ink)' }}>
                  Enable Desktop & Mobile Push Alerts
                </span>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Allow Cruvels to notify your desktop or phone when this email reminder triggers, even if your browser is closed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
                <Laptop className="h-3.5 w-3.5 text-sky-500" />
                <span>Desktop</span>
                <span>•</span>
                <Smartphone className="h-3.5 w-3.5 text-sky-500" />
                <span>Mobile PWA</span>
              </div>
              <button
                type="button"
                onClick={handleRequestPushPermission}
                disabled={requestingPerm}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs"
                style={{ background: '#0284c7' }}
              >
                {requestingPerm ? 'Requesting...' : '🔔 Allow Notifications'}
              </button>
            </div>

            {permMessage && (
              <p className="text-[10px] font-semibold pt-1 border-t border-sky-500/20" style={{ color: 'var(--ink)' }}>
                {permMessage}
              </p>
            )}
          </div>
        ) : (
          <div
            className="flex items-center gap-2 rounded-xl p-2.5 text-xs"
            style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--ink)' }}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-medium">
              Push alerts enabled on this device. You will receive an instant notification when this reminder is due.
            </span>
          </div>
        )}

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl p-3 text-xs"
            style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Preset Buttons */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              When should we remind you?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPreset('1h')}
                className="p-2.5 rounded-xl border text-center transition-all cursor-pointer"
                style={{
                  background: preset === '1h' ? 'rgba(37, 99, 235, 0.12)' : 'var(--surface-2)',
                  borderColor: preset === '1h' ? '#2563eb' : 'var(--line)',
                  color: preset === '1h' ? '#2563eb' : 'var(--ink)',
                  fontWeight: preset === '1h' ? 'bold' : 'normal',
                }}
              >
                <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <span className="block text-xs">In 1 Hour</span>
                <span className="block text-[10px]" style={{ color: 'var(--muted)' }}>Quick Snooze</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('tomorrow')}
                className="p-2.5 rounded-xl border text-center transition-all cursor-pointer"
                style={{
                  background: preset === 'tomorrow' ? 'rgba(37, 99, 235, 0.12)' : 'var(--surface-2)',
                  borderColor: preset === 'tomorrow' ? '#2563eb' : 'var(--line)',
                  color: preset === 'tomorrow' ? '#2563eb' : 'var(--ink)',
                  fontWeight: preset === 'tomorrow' ? 'bold' : 'normal',
                }}
              >
                <Sparkles className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <span className="block text-xs">Tomorrow</span>
                <span className="block text-[10px]" style={{ color: 'var(--muted)' }}>9:00 AM IST</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('2d')}
                className="p-2.5 rounded-xl border text-center transition-all cursor-pointer"
                style={{
                  background: preset === '2d' ? 'rgba(37, 99, 235, 0.12)' : 'var(--surface-2)',
                  borderColor: preset === '2d' ? '#2563eb' : 'var(--line)',
                  color: preset === '2d' ? '#2563eb' : 'var(--ink)',
                  fontWeight: preset === '2d' ? 'bold' : 'normal',
                }}
              >
                <Calendar className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <span className="block text-xs">In 2 Days</span>
                <span className="block text-[10px]" style={{ color: 'var(--muted)' }}>Follow-up</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('custom')}
                className="p-2.5 rounded-xl border text-center transition-all cursor-pointer"
                style={{
                  background: preset === 'custom' ? 'rgba(37, 99, 235, 0.12)' : 'var(--surface-2)',
                  borderColor: preset === 'custom' ? '#2563eb' : 'var(--line)',
                  color: preset === 'custom' ? '#2563eb' : 'var(--ink)',
                  fontWeight: preset === 'custom' ? 'bold' : 'normal',
                }}
              >
                <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <span className="block text-xs">Custom</span>
                <span className="block text-[10px]" style={{ color: 'var(--muted)' }}>Pick time</span>
              </button>
            </div>
          </div>

          {/* Custom Date Time Input */}
          {preset === 'custom' && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="block text-[11px] font-bold" style={{ color: 'var(--ink)' }}>Select Date & Time</label>
              <input
                type="datetime-local"
                required
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-xl border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                }}
              />
            </div>
          )}

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold" style={{ color: 'var(--ink)' }}>
              Reminder Note / Action (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Reply to client regarding contract deliverables"
              maxLength={200}
              className="w-full rounded-xl border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--line)',
                color: 'var(--ink)',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95 bg-blue-600 hover:bg-blue-500 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Bell className="h-3.5 w-3.5" />
                  <span>Set Reminder</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
