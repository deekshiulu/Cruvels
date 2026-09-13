'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Building2,
  CheckSquare,
  Calendar,
  StickyNote,
  Megaphone,
  Inbox,
  Send,
  PenSquare,
  Shield,
  User as UserIcon,
  LogOut,
  RefreshCw,
  Search,
  Lock,
  ChevronRight,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Bell,
  Check,
  Volume2,
  FileText,
} from 'lucide-react';
import { AuthSessionUser, AppNotification } from '@/lib/db/types';
import { playNotificationSound, unlockAudioContext } from '@/lib/utils/sound';
import { clientCache } from '@/lib/cache/clientCache';

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time Notification Engine State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<string>('all');
  const [devicePermission, setDevicePermission] = useState<'default' | 'granted' | 'denied'>('default');
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=25');
      if (res.ok) {
        const data = await res.json();
        const incoming: AppNotification[] = data.notifications || [];
        setNotifications(incoming);
        setNotifUnreadCount(data.unreadCount || 0);

        if (isInitialLoadRef.current) {
          incoming.forEach((n) => knownNotifIdsRef.current.add(n.id));
          isInitialLoadRef.current = false;
        } else {
          // Detect newly arrived notifications
          const newItems = incoming.filter((n) => !knownNotifIdsRef.current.has(n.id) && !n.is_read);
          if (newItems.length > 0) {
            // Play audio alert chime
            playNotificationSound();

            // Show native OS / device notification if permitted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const latest = newItems[0];
              try {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: latest.title,
                    message: latest.message,
                    url: latest.link_url || '/dashboard',
                  });
                } else {
                  new Notification(latest.title, {
                    body: latest.message,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                  });
                }
              } catch {}
            }
          }
          incoming.forEach((n) => knownNotifIdsRef.current.add(n.id));
        }
      }
    } catch {
      // Background non-fatal
    }
  };

  const fetchSessionAndUnread = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/auth/me', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      setUser(data.user);
      if (data.user?.id) {
        clientCache.setUserScope(data.user.id);
      }

      // Fetch unread emails and notifications in background
      fetch('/api/mail/inbox?limit=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((inboxData) => {
          if (inboxData?.unreadCount !== undefined) {
            setUnreadCount(inboxData.unreadCount);
          }
        })
        .catch(() => {});

      fetchNotifications();
    } catch {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/profile') {
      router.replace('/profile?force=password');
    }
  }, [user, pathname, router]);

  useEffect(() => {
    fetchSessionAndUnread();

    // Check browser notification permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDevicePermission(Notification.permission);
    }

    // Live notifications via SSE; fallback poll only if the stream drops
    let eventSource: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const startFallbackPoll = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        fetchNotifications();
        fetch('/api/mail/inbox?limit=1')
          .then((r) => (r.ok ? r.json() : null))
          .then((inboxData) => {
            if (inboxData?.unreadCount !== undefined) {
              setUnreadCount(inboxData.unreadCount);
            }
          })
          .catch(() => {});
      }, 20000);
    };

    startFallbackPoll();

    try {
      eventSource = new EventSource('/api/notifications/stream');
      eventSource.addEventListener('notification', (ev) => {
        try {
          const incoming = JSON.parse((ev as MessageEvent).data) as AppNotification;
          knownNotifIdsRef.current.add(incoming.id);
          setNotifications((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)].slice(0, 25));
          if (!incoming.is_read) {
            setNotifUnreadCount((c) => c + 1);
            playNotificationSound();
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(incoming.title, {
                body: incoming.message,
                icon: '/favicon.ico',
              });
            }
          }
          if (incoming.type === 'mail') {
            clientCache.invalidate('inbox');
            clientCache.invalidate('sent');
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mail-synced'));
            }
            fetch('/api/mail/inbox?limit=1')
              .then((r) => (r.ok ? r.json() : null))
              .then((inboxData) => {
                if (inboxData?.unreadCount !== undefined) setUnreadCount(inboxData.unreadCount);
              })
              .catch(() => {});
          }
        } catch {}
      });
      eventSource.onerror = () => {
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          startFallbackPoll();
        }
      };
    } catch {
      startFallbackPoll();
    }

    const handleMailRead = () => {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    window.addEventListener('mail-read', handleMailRead);

    return () => {
      eventSource?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
      window.removeEventListener('mail-read', handleMailRead);
    };
  }, []);

  // Request native browser/device notification permission
  const requestDeviceNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Browser notifications are not supported on this device/browser.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setDevicePermission(perm);
      unlockAudioContext();
      if (perm === 'granted') {
        playNotificationSound();

        // Register Service Worker if supported
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            const vapidRes = await fetch('/api/notifications/vapid');
            const vapidData = vapidRes.ok ? await vapidRes.json() : null;
            if (vapidData?.publicKey && reg.pushManager) {
              const existing = await reg.pushManager.getSubscription();
              const subscription =
                existing ||
                (await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
                }));
              const rawKey = subscription.getKey('p256dh');
              const rawAuth = subscription.getKey('auth');
              if (rawKey && rawAuth) {
                await fetch('/api/notifications/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                      p256dh: btoa(String.fromCharCode(...new Uint8Array(rawKey))),
                      auth: btoa(String.fromCharCode(...new Uint8Array(rawAuth))),
                    },
                    deviceName: navigator.userAgent.slice(0, 60),
                  }),
                });
              }
            }
          } catch {
            // SW / push optional
          }
        }

        // Send confirmation device notification
        new Notification('Cruvels Internal Portal', {
          body: 'Device linked. You will receive alerts even when this tab is in the background.',
          icon: '/favicon.ico',
        });
      }
    } catch (err) {
      console.error('Device notification request failed', err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      }).catch(() => {});
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      setNotifUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setNotifDropdownOpen(false);
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clientCache.invalidate();
      clientCache.setUserScope('');
      router.push('/login');
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/mail/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const count = data.data?.ingestedCount || 0;
        setSyncMessage(`Synced ${count} new items`);
        clientCache.invalidate('inbox');
        clientCache.invalidate('sent');
        window.dispatchEvent(new CustomEvent('mail-synced'));
        fetchSessionAndUnread();
      } else {
        setSyncMessage(data.error || 'Sync failed.');
      }
    } catch {
      setSyncMessage('Network error.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (pathname.startsWith('/mail')) {
      router.push(`/mail/inbox?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push(`/employees?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium tracking-wide">Loading Cruvels Internal Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isNavActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  const isMailActive = (path: string) => {
    return pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-slate-900 antialiased font-sans">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 justify-between select-none shadow-sm transition-transform duration-200 md:static md:flex ${
          mobileMenuOpen ? 'flex translate-x-0' : 'hidden -translate-x-full md:flex md:translate-x-0'
        }`}
      >
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-md shadow-blue-500/20">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="truncate min-w-0">
                <div className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                  Cruvels Portal
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 uppercase tracking-wider border border-blue-200">
                    {user.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate font-mono mt-0.5" title={user.primaryAlias}>
                  {user.primaryAlias}
                </div>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-700 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Section 1: Workforce Operations */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Workforce Operations
            </div>

            <button
              onClick={() => {
                router.push('/dashboard');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/dashboard')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className={`h-4 w-4 ${isNavActive('/dashboard') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Dashboard</span>
              </div>
            </button>

            {(user.role === 'admin' || user.role === 'manager' || user.role === 'team_lead') && (
              <button
                onClick={() => {
                  router.push('/employees');
                  setMobileMenuOpen(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isNavActive('/employees')
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className={`h-4 w-4 ${isNavActive('/employees') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                  <span>Employee Directory</span>
                </div>
              </button>
            )}

            <button
              onClick={() => {
                router.push('/attendance');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/attendance')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className={`h-4 w-4 ${isNavActive('/attendance') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Attendance</span>
              </div>
            </button>

            <button
              onClick={() => {
                router.push('/leaves');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/leaves')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className={`h-4 w-4 ${isNavActive('/leaves') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Time Off & Leaves</span>
              </div>
            </button>

            <button
              onClick={() => {
                router.push('/departments');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/departments')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className={`h-4 w-4 ${isNavActive('/departments') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>{user.role === 'admin' ? 'Departments & Squads' : 'Company Departments'}</span>
              </div>
            </button>
          </div>

          {/* Navigation Section 2: Productivity Suite */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Productivity & Team
            </div>

            <button
              onClick={() => {
                router.push('/tasks');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/tasks')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className={`h-4 w-4 ${isNavActive('/tasks') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Tasks (Kanban)</span>
              </div>
            </button>

            <button
              onClick={() => {
                router.push('/schedule');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/schedule')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className={`h-4 w-4 ${isNavActive('/schedule') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Schedule & Shifts</span>
              </div>
            </button>

            <button
              onClick={() => {
                router.push('/notes');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/notes')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <StickyNote className={`h-4 w-4 ${isNavActive('/notes') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Personal Notes</span>
              </div>
            </button>

            <button
              onClick={() => {
                router.push('/notices');
                setMobileMenuOpen(false);
              }}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isNavActive('/notices')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Megaphone className={`h-4 w-4 ${isNavActive('/notices') ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>Notice Board</span>
              </div>
            </button>
          </div>

          {/* Navigation Section 3: Admin Center */}
          {user.role === 'admin' && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-1.5 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                <span>Administration</span>
              </div>

              <button
                onClick={() => {
                  router.push('/admin');
                  setMobileMenuOpen(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  pathname.startsWith('/admin')
                    ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
                    : 'text-purple-700 hover:bg-purple-50/60 hover:text-purple-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-purple-600" />
                  <span>Admin Center & Logs</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-purple-500 opacity-60 group-hover:opacity-100" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer Status */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-2.5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-slate-700">Zero-Trust Active</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">v1.2</span>
          </div>
        </div>
      </aside>

      {/* Main Content Body with Topbar */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#F8FAFC]">
        {/* Top Omnibar Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6 bg-white/95 backdrop-blur-xl z-30 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-64 md:w-72 hidden sm:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search portal..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </form>
          </div>

          {/* Center / Right: Top Bar Mail Navigation & User Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Top Bar Mail Quick Access Group */}
            <div className="flex items-center rounded-2xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
              <button
                onClick={() => router.push('/mail/inbox')}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 transition-all ${
                  isMailActive('/mail/inbox')
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mail Inbox"
              >
                <Inbox className="h-3.5 w-3.5 text-blue-600" />
                <span className="hidden sm:inline">Inbox</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/mail/sent')}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 transition-all ${
                  isMailActive('/mail/sent')
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sent Mail"
              >
                <Send className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Sent</span>
              </button>

              <button
                onClick={() => router.push('/mail/drafts')}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 transition-all ${
                  isMailActive('/mail/drafts')
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Drafts"
              >
                <FileText className="h-3.5 w-3.5 text-purple-600" />
                <span className="hidden sm:inline">Drafts</span>
              </button>

              <button
                onClick={() => router.push('/mail/compose')}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 transition-all ${
                  isMailActive('/mail/compose')
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-600/90 text-white hover:bg-blue-600 shadow-xs'
                }`}
                title="Compose Email"
              >
                <PenSquare className="h-3.5 w-3.5 text-white" />
                <span className="hidden md:inline">Compose</span>
              </button>
            </div>

            {/* Manual Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-all"
              title="Sync Inbox & Feeds"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span className="hidden lg:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Real-time Notification Bell Popover */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative flex items-center justify-center h-9 w-9 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-all"
                title="Notifications & Alerts"
              >
                <Bell className="h-4 w-4 text-slate-600" />
                {notifUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-extrabold text-white shadow-xs animate-pulse">
                    {notifUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification Center Popover */}
              {notifDropdownOpen && (
                <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-24px)] sm:w-96 rounded-3xl bg-white shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-600" />
                      <h3 className="text-xs font-bold text-slate-900">Notifications</h3>
                      {notifUnreadCount > 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                          {notifUnreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          unlockAudioContext();
                          playNotificationSound();
                        }}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer shadow-2xs"
                        title="Play notification sound test"
                      >
                        <Volume2 className="h-3 w-3 text-blue-600" />
                        <span>Test Sound</span>
                      </button>
                      {notifUnreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotifsRead}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Device Notification Link Banner */}
                  {devicePermission !== 'granted' && (
                    <div className="border-b border-amber-200 bg-amber-50/80 p-3 text-xs flex items-center justify-between gap-2">
                      <div className="text-[11px] text-amber-900 font-medium leading-tight">
                        Receive instant alerts on this device for emails and tasks.
                      </div>
                      <button
                        onClick={requestDeviceNotifications}
                        className="shrink-0 rounded-xl bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-amber-700 transition-all"
                      >
                        Link Device
                      </button>
                    </div>
                  )}

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 border-b border-slate-100 p-2 overflow-x-auto text-[11px]">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'mail', label: 'Emails' },
                      { id: 'task', label: 'Tasks' },
                      { id: 'notice', label: 'Notices' },
                      { id: 'leave', label: 'Leaves' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setNotifCategoryFilter(tab.id)}
                        className={`rounded-xl px-2.5 py-1 font-semibold transition-all whitespace-nowrap ${
                          notifCategoryFilter === tab.id
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.filter((n) => {
                      if (notifCategoryFilter === 'all') return true;
                      if (notifCategoryFilter === 'leave') return n.type.startsWith('leave');
                      return n.type === notifCategoryFilter;
                    }).length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <Bell className="mx-auto h-6 w-6 text-slate-300 mb-2" />
                        No notifications in this category.
                      </div>
                    ) : (
                      notifications
                        .filter((n) => {
                          if (notifCategoryFilter === 'all') return true;
                          if (notifCategoryFilter === 'leave') return n.type.startsWith('leave');
                          return n.type === notifCategoryFilter;
                        })
                        .map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`flex items-start gap-3 p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                              !notif.is_read ? 'bg-blue-50/40' : 'bg-white'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0 rounded-xl bg-slate-100 p-2 border border-slate-200">
                              {notif.type === 'mail' ? (
                                <Inbox className="h-4 w-4 text-blue-600" />
                              ) : notif.type === 'task' ? (
                                <CheckSquare className="h-4 w-4 text-amber-600" />
                              ) : notif.type === 'notice' ? (
                                <Megaphone className="h-4 w-4 text-purple-600" />
                              ) : notif.type.startsWith('leave') ? (
                                <CalendarDays className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Bell className="h-4 w-4 text-indigo-600" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-bold truncate ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {notif.title}
                                </span>
                                {!notif.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                                {notif.message}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                                {new Date(notif.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Account Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 pr-2.5 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs transition-all text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate leading-tight flex items-center gap-1">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate font-mono">{user.primaryAlias}</div>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-3xl bg-white p-2.5 shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user.name}</p>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{user.primaryAlias}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider border border-blue-200">
                        {user.role}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5 text-xs">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        router.push('/profile');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <UserIcon className="h-4 w-4 text-slate-500" />
                      <span>Edit My Profile</span>
                    </button>

                    {user.role === 'admin' && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          router.push('/admin');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-medium text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        <Shield className="h-4 w-4 text-purple-600" />
                        <span>Admin Maintenance</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Sync Notification Banner */}
        {syncMessage && (
          <div className="bg-blue-600 px-4 py-1.5 text-center text-xs font-medium text-white shadow-inner animate-in fade-in">
            {syncMessage}
          </div>
        )}

        {/* Main Routed Page Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
