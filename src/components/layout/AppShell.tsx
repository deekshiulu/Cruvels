'use client';

import React, { useEffect, useState, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import MobileBottomNav from './MobileBottomNav';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ShieldAlert,
  Trash2,
  Settings,
  ArrowUpRight,
  HardDrive,
} from 'lucide-react';
import { AuthSessionUser, AppNotification } from '@/lib/db/types';
import { playNotificationSound, unlockAudioContext } from '@/lib/utils/sound';
import { clientCache } from '@/lib/cache/clientCache';
import { validateTabSession, clearTabSession, TAB_CHANNEL_NAME, TAB_SESSION_KEY } from '@/lib/auth/client-session';

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


// Module-level cache to eliminate re-renders and full-screen loading on navigation
let cachedUser: AuthSessionUser | null = null;
let cachedUnreadCount = 0;
let cachedPendingTaskCount = 0;
let lastSessionCheckTime = 0;
let lastBadgesCheckTime = 0;
let cachedNotifications: AppNotification[] = [];
let cachedNotifUnreadCount = 0;


const warmedRoutes = new Set<string>();
const isProd = process.env.NODE_ENV === 'production';

export function warmRoute(path: string, _apis?: string[], routerInstance?: any) {
  if (warmedRoutes.has(path)) return;
  warmedRoutes.add(path);

  if (routerInstance) {
    try {
      routerInstance.prefetch(path);
    } catch {}
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthSessionUser | null>(() => {
    if (cachedUser) return cachedUser;
    if (typeof window !== 'undefined') {
      return clientCache.get<AuthSessionUser>('session_user') || null;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (cachedUser) return false;
    if (typeof window !== 'undefined' && clientCache.get<AuthSessionUser>('session_user')) {
      return false;
    }
    return true;
  });
  const [unreadCount, setUnreadCount] = useState(() => cachedUnreadCount);
  const [pendingTaskCount, setPendingTaskCount] = useState(() => cachedPendingTaskCount);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time Notification Engine State
  const [notifications, setNotifications] = useState<AppNotification[]>(() => cachedNotifications);
  const [notifUnreadCount, setNotifUnreadCount] = useState(() => cachedNotifUnreadCount);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<string>('all');
  const [devicePermission, setDevicePermission] = useState<'default' | 'granted' | 'denied'>('default');
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=25');
      if (res.status === 401) {
        cachedUser = null;
        clearTabSession();
        clientCache.clear();
        router.replace('/login?reason=password_reset');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const incoming: AppNotification[] = data.notifications || [];
        cachedNotifications = incoming;
        cachedNotifUnreadCount = data.unreadCount || 0;
        setNotifications(incoming);
        setNotifUnreadCount(data.unreadCount || 0);

        if (isInitialLoadRef.current) {
          incoming.forEach((n) => knownNotifIdsRef.current.add(n.id));
          isInitialLoadRef.current = false;
        } else {
          // Detect newly arrived notifications
          const newItems = incoming.filter((n) => !knownNotifIdsRef.current.has(n.id) && !n.is_read);
          if (newItems.length > 0) {
            playNotificationSound();

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

  const fetchSessionAndUnread = async (force = false) => {
    const now = Date.now();
    // Fast path: if session was validated within the last 30 seconds, avoid blocking navigation with redundant API calls
    if (!force && cachedUser && now - lastSessionCheckTime < 30000) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        cachedUser = null;
        lastSessionCheckTime = 0;
        clearTabSession();
        clientCache.clear();
        router.replace('/login?reason=password_reset');
        return;
      }
      if (!res.ok) {
        // Server compilation or transient error — preserve session
        return;
      }
      const data = await res.json();
      if (data.user) {
        cachedUser = data.user;
        lastSessionCheckTime = Date.now();
        setUser(data.user);
        clientCache.setUserScope(data.user.id);
        clientCache.set('session_user', undefined, data.user);
      }

      // Fetch unread emails and task count in background (non-blocking, non-fatal)
      fetch('/api/mail/inbox?limit=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((inboxData) => {
          if (inboxData?.unreadCount !== undefined) {
            cachedUnreadCount = inboxData.unreadCount;
            setUnreadCount(inboxData.unreadCount);
          }
        })
        .catch(() => {});

      fetch('/api/tasks')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.tasks) {
            const pending = d.tasks.filter((t: any) => t.status === 'todo' || t.status === 'in_progress').length;
            cachedPendingTaskCount = pending;
            setPendingTaskCount(pending);
          }
        })
        .catch(() => {});

      fetchNotifications();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      // Network hiccup — keep current user in UI, do not kick to login
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/profile') {
      router.replace('/profile?force=password');
    }
  }, [user, pathname, router]);

  const navigateTo = (path: string) => {
    if (user?.mustChangePassword) {
      if (pathname !== '/profile') {
        router.replace('/profile?force=password');
      }
      return;
    }
    router.push(path);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    let mounted = true;
    let tabChannel: BroadcastChannel | null = null;

    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        tabChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
        tabChannel.onmessage = (ev) => {
          if (ev.data?.type === 'PING_TAB_SESSION') {
            if (sessionStorage.getItem(TAB_SESSION_KEY) === 'active') {
              tabChannel?.postMessage({ type: 'PONG_TAB_SESSION' });
            }
          } else if (ev.data?.type === 'TAB_LOGOUT') {
            clearTabSession();
            router.replace('/login');
          }
        };
      } catch {}
    }

    validateTabSession().then((isTabValid) => {
      if (!mounted) return;
      if (!isTabValid) {
        clearTabSession();
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          if (mounted) router.replace('/login');
        });
        return;
      }
      fetchSessionAndUnread();
    });

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
            if (inboxData?.unreadCount !== undefined) setUnreadCount(inboxData.unreadCount);
          })
          .catch(() => {});
        fetch('/api/tasks')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.tasks) {
              const pending = d.tasks.filter((t: any) => t.status === 'todo' || t.status === 'in_progress').length;
              setPendingTaskCount(pending);
            }
          })
          .catch(() => {});
      }, 20000);
    };

    startFallbackPoll();

    try {
      eventSource = new EventSource('/api/notifications/stream');
      
      // Handle immediate admin-triggered session termination
      eventSource.addEventListener('FORCE_LOGOUT', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          cachedUser = null;
          lastSessionCheckTime = 0;
          clearTabSession();
          clientCache.clear();
          fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
            window.location.href = `/login?reason=${encodeURIComponent(data?.reason || 'password_reset')}`;
          });
        } catch {
          window.location.href = '/login?reason=password_reset';
        }
      });

      eventSource.addEventListener('notification', (ev) => {
        try {
          const incoming = JSON.parse((ev as MessageEvent).data) as AppNotification;
          knownNotifIdsRef.current.add(incoming.id);
          setNotifications((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)].slice(0, 25));
          if (!incoming.is_read) {
            setNotifUnreadCount((c) => c + 1);
            playNotificationSound();

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: incoming.title,
                    message: incoming.message,
                    url: incoming.link_url || '/dashboard',
                  });
                } else {
                  new Notification(incoming.title, {
                    body: incoming.message,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                  });
                }
              } catch {}
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
      mounted = false;
      tabChannel?.close();
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
    clearTabSession();
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(TAB_CHANNEL_NAME);
        ch.postMessage({ type: 'TAB_LOGOUT' });
        ch.close();
      } catch {}
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      cachedUser = null;
      cachedUnreadCount = 0;
      cachedPendingTaskCount = 0;
      lastSessionCheckTime = 0;
      cachedNotifications = [];
      cachedNotifUnreadCount = 0;
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
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--teal)] border-t-transparent" />
          <p className="text-xs font-medium" style={{ color: 'var(--muted)', fontFamily: 'Archivo, sans-serif' }}>Loading Cruvels Workplace OS...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (user.mustChangePassword && pathname !== '/profile') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--amber)] border-t-transparent" />
          <p className="text-xs font-medium" style={{ color: 'var(--amber)', fontFamily: 'Archivo, sans-serif' }}>
            Password update required. Redirecting to profile setup...
          </p>
        </div>
      </div>
    );
  }

  const isNavActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  const isMailActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const getNavStyle = (active: boolean) => {
    if (active) {
      return {
        background: 'var(--teal-wash)',
        color: 'var(--teal-ink)',
        fontWeight: 700,
        border: '1px solid var(--line)',
        boxShadow: '0 2px 8px -2px rgba(10,25,47,0.08)',
      };
    }
    if (user.mustChangePassword) {
      return { opacity: 0.45, pointerEvents: 'none' as const };
    }
    return {};
  };

  const getNavIconStyle = (active: boolean) => {
    return active ? { color: 'var(--teal)' } : {};
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden antialiased" style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'Archivo, sans-serif' }}>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col p-4 justify-between transition-transform duration-200 md:static md:flex ${
          mobileMenuOpen ? 'flex translate-x-0' : 'hidden -translate-x-full md:flex md:translate-x-0'
        }`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--line)' }}
      >
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-1 shadow-xs bg-[#0A192F] border border-[#1E3A5F]/60">
                <img src="/cruvels-logo-transparent.png" alt="Cruvels Logo" className="h-8 w-8 object-contain" />
              </div>
              <div className="truncate min-w-0">
                <div className="text-sm tracking-tight flex items-center gap-1.5 font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                  Cruvels OS
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold bg-blue-950/80 text-blue-300 border border-blue-500/40 shadow-xs">
                    {user.role === 'admin' ? 'Admin' : user.role}
                  </span>
                </div>
                <div className="text-[11px] truncate mt-0.5 font-mono" style={{ color: 'var(--muted)' }} title={user.primaryAlias}>
                  {user.primaryAlias}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-2 md:hidden cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: 'var(--muted)' }}
              aria-label="Close mobile navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Password Required Notice Banner */}
          {user.mustChangePassword && (
            <div className="rounded-lg p-3 text-xs" style={{ border: '1px solid var(--amber)', background: 'var(--amber-dim)', color: 'var(--ink)' }}>
              <div className="flex items-center gap-1.5 font-bold">
                <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--amber)' }} />
                <span>Password Setup Required</span>
              </div>
              <p className="mt-1 text-[11px] leading-tight" style={{ color: 'var(--muted)' }}>
                Workspace modules are locked until you create a new password.
              </p>
            </div>
          )}

          {/* Navigation: Today */}
          <div className="space-y-0.5">
            <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Archivo, sans-serif' }}>Today</div>
            {([
              { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, apis: ['/api/dashboard/stats'] },
              { path: '/schedule',  label: 'Schedule',  Icon: Calendar,        apis: ['/api/schedule'] },
            ] as { path: string; label: string; Icon: React.ElementType; apis?: string[] }[]).map(({ path, label, Icon, apis }) => (
              <Link key={path} href={user.mustChangePassword ? '/profile?force=password' : path} prefetch={isProd} onMouseEnter={() => warmRoute(path, apis, router)} onTouchStart={() => warmRoute(path, apis, router)} onClick={() => setMobileMenuOpen(false)} className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
                style={getNavStyle(isNavActive(path))}>
                <Icon className="h-4 w-4 shrink-0" style={getNavIconStyle(isNavActive(path))} />
                <span className="flex-1 truncate">{label}</span>
                {user.mustChangePassword && <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />}
              </Link>
            ))}
          </div>

          {/* Navigation: Work */}
          <div className="space-y-0.5">
            <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Archivo, sans-serif' }}>Work</div>

            <Link href={user.mustChangePassword ? '/profile?force=password' : '/tasks'} prefetch={isProd} onMouseEnter={() => warmRoute('/tasks', ['/api/tasks', '/api/employees'], router)} onTouchStart={() => warmRoute('/tasks', ['/api/tasks', '/api/employees'], router)} onClick={() => setMobileMenuOpen(false)} className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
              style={getNavStyle(isNavActive('/tasks'))}>
              <CheckSquare className="h-4 w-4 shrink-0" style={getNavIconStyle(isNavActive('/tasks'))} />
              <span className="flex-1 truncate">Tasks</span>
              {pendingTaskCount > 0 && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold bg-blue-950/80 text-blue-300 border border-blue-500/30">
                  {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
                </span>
              )}
              {user.mustChangePassword && <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />}
            </Link>

            <Link href={user.mustChangePassword ? '/profile?force=password' : '/mail/inbox'} prefetch={isProd} onMouseEnter={() => warmRoute('/mail/inbox', ['/api/mail/inbox?limit=40'], router)} onTouchStart={() => warmRoute('/mail/inbox', ['/api/mail/inbox?limit=40'], router)} onClick={() => setMobileMenuOpen(false)} className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
              style={getNavStyle(isNavActive('/mail'))}>
              <Inbox className="h-4 w-4 shrink-0" style={getNavIconStyle(isNavActive('/mail'))} />
              <span className="flex-1 truncate">Mailbox</span>
              {unreadCount > 0 && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold bg-blue-950/80 text-blue-300 border border-blue-500/30">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {user.mustChangePassword && <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />}
            </Link>

            {([
              { path: '/notes',   label: 'Notes',         Icon: StickyNote, apis: ['/api/notes'] },
              { path: '/drive',   label: 'Google Drive',  Icon: HardDrive,  apis: ['/api/drive'] },
            ] as { path: string; label: string; Icon: React.ElementType; apis?: string[] }[]).map(({ path, label, Icon, apis }) => (
              <Link key={path} href={user.mustChangePassword ? '/profile?force=password' : path} prefetch={isProd} onMouseEnter={() => warmRoute(path, apis, router)} onTouchStart={() => warmRoute(path, apis, router)} onClick={() => setMobileMenuOpen(false)} className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
                style={getNavStyle(isNavActive(path))}>
                <Icon className="h-4 w-4 shrink-0" style={getNavIconStyle(isNavActive(path))} />
                <span className="flex-1 truncate">{label}</span>
                {user.mustChangePassword && <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />}
              </Link>
            ))}
          </div>

          {/* Navigation: People */}
          <div className="space-y-0.5">
            <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Archivo, sans-serif' }}>People</div>
            {([
              ...(user.role === 'admin' || user.role === 'manager' || user.role === 'team_lead'
                ? [{ path: '/employees', label: 'Directory', Icon: Users, apis: ['/api/employees', '/api/departments'] }]
                : []),
              { path: '/attendance',  label: 'Attendance',           Icon: Clock,        apis: ['/api/attendance', '/api/leaves'] },
              { path: '/leaves',      label: 'Time Off',              Icon: CalendarDays, apis: ['/api/leaves'] },
              { path: '/departments', label: 'Departments',          Icon: Building2,    apis: ['/api/departments'] },
            ] as { path: string; label: string; Icon: React.ElementType; apis?: string[] }[]).map(({ path, label, Icon, apis }) => (
              <Link key={path} href={user.mustChangePassword ? '/profile?force=password' : path} prefetch={isProd} onMouseEnter={() => warmRoute(path, apis, router)} onTouchStart={() => warmRoute(path, apis, router)} onClick={() => setMobileMenuOpen(false)} className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
                style={getNavStyle(isNavActive(path))}>
                <Icon className="h-4 w-4 shrink-0" style={getNavIconStyle(isNavActive(path))} />
                <span className="flex-1 truncate">{label}</span>
                {user.mustChangePassword && <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />}
              </Link>
            ))}
          </div>

          {/* Notices */}
          <div className="space-y-0.5">
            <Link href={user.mustChangePassword ? '/profile?force=password' : '/notices'} prefetch={isProd} onMouseEnter={() => warmRoute('/notices', ['/api/notices'], router)} onTouchStart={() => warmRoute('/notices', ['/api/notices'], router)} onClick={() => setMobileMenuOpen(false)} className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
              style={getNavStyle(isNavActive('/notices'))}>
              <Megaphone className="h-4 w-4 shrink-0" style={getNavIconStyle(isNavActive('/notices'))} />
              <span className="flex-1 truncate">Notices</span>
              {user.mustChangePassword && <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />}
            </Link>
          </div>

          {/* Navigation Section 3: Admin Center */}
          {user.role === 'admin' && (
            <div className="space-y-0.5">
              <div className="px-2 mb-2 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5" style={{ color: 'var(--muted)', fontFamily: 'Archivo, sans-serif' }}>
                <Shield className="h-3 w-3" />
                <span>Administration</span>
              </div>

              <Link
                href={user.mustChangePassword ? '/profile?force=password' : '/admin'}
                prefetch={isProd}
                onMouseEnter={() => warmRoute('/admin', ['/api/admin/stats', '/api/admin/audit-logs'], router)}
                onTouchStart={() => warmRoute('/admin', ['/api/admin/stats', '/api/admin/audit-logs'], router)}
                onClick={() => setMobileMenuOpen(false)}
                className="rail-item w-full text-left flex items-center gap-3 transition-all rounded-xl"
                style={getNavStyle(pathname.startsWith('/admin'))}
              >
                <Shield className="h-4 w-4 shrink-0" style={getNavIconStyle(pathname.startsWith('/admin'))} />
                <span className="flex-1">Admin Center & Logs</span>
                {user.mustChangePassword ? (
                  <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--muted)' }} />
                )}
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar Footer Status */}
        <div className="pt-3" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="relative overflow-hidden rounded-xl p-3 border transition-colors" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" preserveAspectRatio="none">
              <path d="M-20,40 Q50,10 120,50 T240,30" fill="none" stroke="var(--teal)" strokeWidth="1.5" />
              <path d="M-20,60 Q60,30 140,70 T240,50" fill="none" stroke="var(--teal)" strokeWidth="1" opacity="0.6" />
            </svg>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--teal)' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2 shadow-xs" style={{ background: 'var(--teal)' }} />
                </span>
                <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--teal)' }}>Zero-Trust Active</span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>v1.2</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Body with Topbar */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
        {/* Top Omnibar Header */}
        <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 z-30" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center justify-center rounded-xl p-2 md:hidden touch-manipulation min-h-[40px] min-w-[40px] cursor-pointer active:scale-95 transition-transform"
              style={{ border: '1px solid var(--line)', color: 'var(--ink)', background: 'var(--surface)' }}
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile Brand Logo */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg p-0.5 shadow-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                <img src="/cruvels-logo-transparent.png" alt="Cruvels" className="h-5 w-5 object-contain" />
              </div>
              <span className="text-sm font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                Cruvels OS
              </span>
            </div>

            {/* Global Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative w-56 sm:w-80 md:w-96 hidden sm:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" style={{ color: 'var(--muted)' }}>
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anything... (e.g. users, mailboxes, tasks)"
                style={{
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  fontFamily: 'Archivo, sans-serif',
                }}
                className="w-full rounded-xl py-1.5 pl-8 pr-3 text-xs font-medium placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)] transition-all"
              />
            </form>
          </div>

          {/* Center / Right: Global Actions (Sync, Theme Changer, Notifications, Profile) */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Manual Sync Button */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all touch-manipulation cursor-pointer active:scale-95 min-h-[38px]"
              style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
              title="Sync Inbox & Feeds"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} style={{ color: syncing ? 'var(--teal)' : 'var(--muted)' }} />
              <span className="hidden lg:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Real-time Notification Bell Popover */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                type="button"
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl transition-all touch-manipulation cursor-pointer active:scale-95"
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
                title="Notifications & Alerts"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notifUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white animate-pulse" style={{ background: 'var(--amber)' }}>
                    {notifUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification Center Popover */}
              {notifDropdownOpen && (
                <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-24px)] sm:w-96 rounded-xl z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 8px 32px -4px rgba(18,32,42,0.16)' }}>
                  {/* Popover Header */}
                  <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--line)' }}>
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                      <h3 className="text-xs font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>Notifications</h3>
                      {notifUnreadCount > 0 && (
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>
                          {notifUnreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifDropdownOpen(false);
                          navigateTo('/profile/preferences');
                        }}
                        className="p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ color: 'var(--muted)' }}
                        title="Notification & Alert Preferences"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          unlockAudioContext();
                          playNotificationSound();
                        }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer transition-colors"
                        style={{ background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--line)' }}
                        title="Play notification sound test"
                      >
                        <Volume2 className="h-3 w-3" />
                        <span>Test</span>
                      </button>

                      {notifUnreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotifsRead}
                          className="text-[11px] font-semibold transition-colors cursor-pointer"
                          style={{ color: 'var(--teal)' }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Device Notification Link Banner */}
                  {devicePermission !== 'granted' && (
                    <div className="p-3 text-xs flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--line)', background: 'var(--amber-dim)' }}>
                      <div className="text-[11px] font-medium leading-tight" style={{ color: 'var(--ink)' }}>
                        Receive instant alerts on this device for emails and tasks.
                      </div>
                      <button
                        onClick={requestDeviceNotifications}
                        className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold text-white transition-all"
                        style={{ background: 'var(--amber)' }}
                      >
                        Link Device
                      </button>
                    </div>
                  )}

                  {/* Quick Filter Tabs (§ 10.3) */}
                  <div className="flex items-center gap-1 p-2 overflow-x-auto text-[11px]" style={{ borderBottom: '1px solid var(--line)' }}>
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'unread', label: 'Unread' },
                      { id: 'action', label: 'Action Needed' },
                      { id: 'compliance', label: 'Compliance' },
                      { id: 'task', label: 'Tasks' },
                      { id: 'mail', label: 'Emails' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setNotifCategoryFilter(tab.id)}
                        className="rounded-md px-2.5 py-1 font-medium transition-all whitespace-nowrap"
                        style={notifCategoryFilter === tab.id ? { background: 'var(--teal-dim)', color: 'var(--teal)', fontWeight: 600 } : { color: 'var(--muted)' }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.filter((n) => {
                      if (notifCategoryFilter === 'all') return true;
                      if (notifCategoryFilter === 'unread') return !n.is_read;
                      if (notifCategoryFilter === 'action') {
                        return n.state === 'action_required' || Boolean(n.action_url) || n.category?.includes('action') || n.category?.includes('acknowledgement');
                      }
                      if (notifCategoryFilter === 'compliance') {
                        return n.category?.includes('attendance') || n.category?.includes('compliance') || n.category?.includes('acknowledgement');
                      }
                      if (notifCategoryFilter === 'task') return n.type === 'task';
                      if (notifCategoryFilter === 'mail') return n.type === 'mail';
                      if (notifCategoryFilter === 'notice') return n.type === 'notice';
                      if (notifCategoryFilter === 'leave') return n.type.startsWith('leave');
                      return true;
                    }).length === 0 ? (
                      <div className="p-8 text-center text-xs" style={{ color: 'var(--muted)' }}>
                        <Bell className="mx-auto h-6 w-6 mb-2" style={{ color: 'var(--line)' }} />
                        No notifications in this category.
                      </div>
                    ) : (
                      notifications
                        .filter((n) => {
                          if (notifCategoryFilter === 'all') return true;
                          if (notifCategoryFilter === 'unread') return !n.is_read;
                          if (notifCategoryFilter === 'action') {
                            return n.state === 'action_required' || Boolean(n.action_url) || n.category?.includes('action') || n.category?.includes('acknowledgement');
                          }
                          if (notifCategoryFilter === 'compliance') {
                            return n.category?.includes('attendance') || n.category?.includes('compliance') || n.category?.includes('acknowledgement');
                          }
                          if (notifCategoryFilter === 'task') return n.type === 'task';
                          if (notifCategoryFilter === 'mail') return n.type === 'mail';
                          if (notifCategoryFilter === 'notice') return n.type === 'notice';
                          if (notifCategoryFilter === 'leave') return n.type.startsWith('leave');
                          return true;
                        })
                        .map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className="flex items-start gap-3 p-3.5 cursor-pointer transition-colors"
                            style={{ background: !notif.is_read ? 'var(--teal-dim)' : 'transparent', borderBottom: '1px solid var(--line)' }}
                          >
                            <div className="mt-0.5 shrink-0 rounded-lg p-2" style={{ background: 'var(--surface-hover)', border: '1px solid var(--line)' }}>
                              {notif.type === 'mail' ? (
                                <Inbox className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                              ) : notif.type === 'task' ? (
                                <CheckSquare className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                              ) : notif.type === 'notice' ? (
                                <Megaphone className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                              ) : notif.type.startsWith('leave') ? (
                                <CalendarDays className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                              ) : (
                                <Bell className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold truncate" style={{ color: 'var(--ink)', fontFamily: 'Archivo, sans-serif' }}>
                                  {notif.title}
                                </span>
                                {!notif.is_read && (
                                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--teal)' }} />
                                )}
                              </div>
                              <p className="text-[11px] line-clamp-2 mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                                {notif.message}
                              </p>

                              {/* Direct Action Button on Notification Card (§ 10.2) */}
                              {(notif.action_url || notif.link_url || notif.state === 'action_required') && (
                                <div className="mt-2.5 flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-black/10 dark:border-white/10">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      notif.state === 'action_required'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                        : notif.state === 'acknowledged'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                        : 'text-muted'
                                    }`}
                                  >
                                    {notif.state === 'action_required' ? 'Action Required' : notif.state === 'acknowledged' ? '✓ Acknowledged' : 'Update Available'}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNotificationClick(notif);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white shadow-xs transition"
                                    style={{ background: 'var(--teal)' }}
                                  >
                                    <span>{notif.action_label || 'View'}</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <span className="text-[10px] mt-1.5 block" style={{ color: 'var(--muted)', fontFamily: 'Archivo, sans-serif' }}>
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
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 rounded-xl p-1.5 pr-2.5 transition-all text-left touch-manipulation cursor-pointer active:scale-95 min-h-[40px]"
                style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
                aria-label="User Account Menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shrink-0" style={{ background: 'var(--teal)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--ink)', fontFamily: 'Archivo, sans-serif' }}>
                    {user.name}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--muted)', fontFamily: 'Archivo, sans-serif' }}>{user.primaryAlias}</div>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform shrink-0 ${profileDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--muted)' }} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 8px 24px -4px rgba(18,32,42,0.14)' }}>
                  <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{user.name}</p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--muted)', fontFamily: 'Archivo, sans-serif' }}>{user.primaryAlias}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>
                        {user.role}
                      </span>
                      <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        router.push('/profile');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors touch-manipulation cursor-pointer min-h-[38px]"
                      style={{ color: 'var(--ink)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <UserIcon className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                      <span>Edit My Profile</span>
                    </button>

                    {user.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          router.push('/admin');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors touch-manipulation cursor-pointer min-h-[38px]"
                        style={{ color: 'var(--amber)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--amber-dim)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin Maintenance</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-1" style={{ borderTop: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors touch-manipulation cursor-pointer min-h-[38px]"
                      style={{ color: '#e05252' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(224,82,82,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut className="h-4 w-4" />
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
          <div className="px-4 py-1.5 text-center text-xs font-medium text-white animate-in fade-in" style={{ background: 'var(--teal)' }}>
            {syncMessage}
          </div>
        )}

        {/* Main Routed Page Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-8" style={{ background: 'var(--paper)' }}>{children}</main>

        {/* Mobile Bottom Navigation Bar (Roadmap § 26) */}
        <MobileBottomNav unreadCount={unreadCount} pendingTaskCount={pendingTaskCount} />
      </div>
    </div>
  );
}
