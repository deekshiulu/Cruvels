'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import {
  Bell,
  Mail,
  Smartphone,
  CheckSquare,
  Megaphone,
  Shield,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
} from 'lucide-react';
import { NotificationPreference } from '@/lib/db/types';

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/profile/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.preferences) {
          setPrefs(data.preferences);
        }
      })
      .catch(() => {
        setFeedback({ type: 'error', text: 'Failed to load preferences.' });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleToggle = (key: keyof NotificationPreference) => {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      [key]: !prefs[key],
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefs || saving) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal_notifications: prefs.portal_notifications,
          email_notifications: prefs.email_notifications,
          push_notifications: prefs.push_notifications,
          task_reminders: prefs.task_reminders,
          announcements: prefs.announcements,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update preferences.');
      }

      setPrefs(data.preferences);
      setFeedback({ type: 'success', text: 'Notification preferences saved successfully!' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="border-b border-border pb-5">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Profile</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Bell className="w-7 h-7 text-primary-600" />
            <span>Notification & Alert Preferences</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Configure how and where you receive notifications across Cruvels Workplace OS (§ 11).
          </p>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Loading your alert preferences...
          </div>
        ) : prefs ? (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Delivery Channels */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <span>Delivery Channels</span>
              </h2>

              <div className="divide-y divide-border">
                <div className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary-500/10 text-primary-600 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">In-Portal Bell Notifications</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Receive real-time drop-down alerts, action cards, and status dots inside the portal.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.portal_notifications}
                    onChange={() => handleToggle('portal_notifications')}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-border"
                  />
                </div>

                <div className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Email Notifications</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Receive email summaries for task assignments, meeting invites, and notices.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.email_notifications}
                    onChange={() => handleToggle('email_notifications')}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-border"
                  />
                </div>

                <div className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 mt-0.5">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Web Push Alerts</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Instant native device notifications on supported mobile or desktop browsers.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.push_notifications}
                    onChange={() => handleToggle('push_notifications')}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-border"
                  />
                </div>
              </div>
            </div>

            {/* Category Preferences */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Operational Categories
              </h2>

              <div className="divide-y divide-border">
                <div className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 mt-0.5">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Task & Workload Reminders</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Alerts for task assignments, approaching deadlines (24h/4h), and blocked dependencies.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.task_reminders}
                    onChange={() => handleToggle('task_reminders')}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-border"
                  />
                </div>

                <div className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 mt-0.5">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">General Announcements</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Broadcasts, company events, and general town hall publications.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.announcements}
                    onChange={() => handleToggle('announcements')}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-border"
                  />
                </div>
              </div>
            </div>

            {/* Immutable Compliance Lock (§ 11) */}
            <div className="p-6 rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-indigo-500/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-sm">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Mandatory Compliance & Security Locks</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                  <Lock className="w-3 h-3" />
                  <span>LOCKED BY POLICY</span>
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                As mandated by the Cruvels Operating Policy (§ 11), critical operations and security notices
                cannot be muted or disabled to guarantee workforce compliance and infrastructure security.
              </p>

              <div className="divide-y divide-indigo-200/40 dark:divide-indigo-900/40 pt-2">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Attendance Compliance Reminders</div>
                    <div className="text-[11px] text-muted-foreground">
                      Daily morning reminder (9:30 AM), deadline warning (10:00 AM), and missing punch alerts.
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                    Always On
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Security & Credential Alerts</div>
                    <div className="text-[11px] text-muted-foreground">
                      Password reset requests, unauthorized login warnings, and security session revocations.
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                    Always On
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Mandatory Policy Acknowledgements</div>
                    <div className="text-[11px] text-muted-foreground">
                      Escalations for unacknowledged company notices, sprint charters, and compliance documents.
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                    Always On
                  </span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Preferences...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
