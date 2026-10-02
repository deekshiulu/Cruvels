'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Server,
  Building2,
  Sun,
  Moon,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  Users,
  Send,
  Sparkles,
  Shield,
  Check,
} from 'lucide-react';

import { markTabSessionActive, validateTabSession } from '@/lib/auth/client-session';
import { clientCache } from '@/lib/cache/clientCache';

const WARMUP_ROUTES = [
  '/dashboard',
  '/employees',
  '/attendance',
  '/mail',
  '/tasks',
  '/schedule',
  '/leaves',
  '/notices',
  '/notes',
  '/profile',
  '/departments',
  '/admin',
];

const ROLE_OPTIONS = [
  {
    id: 'intern',
    label: 'Intern',
    escalatesTo: 'Squad Lead & Admin Team',
    badge: 'Level 1',
  },
  {
    id: 'employee',
    label: 'Full-time Member',
    escalatesTo: 'Squad Lead, Manager & Admin',
    badge: 'Level 2',
  },
  {
    id: 'team_lead',
    label: 'Team / Squad Lead',
    escalatesTo: 'Department Manager & Admin',
    badge: 'Level 3',
  },
  {
    id: 'manager',
    label: 'Department Manager',
    escalatesTo: 'Executive Admin Team',
    badge: 'Level 4',
  },
  {
    id: 'admin',
    label: 'System Admin',
    escalatesTo: 'Master Admin Supervisor',
    badge: 'Level 5',
  },
] as const;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: 'login' | 'forgot'
  const [view, setView] = useState<'login' | 'forgot'>('login');

  // Login form state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(() => {
    return searchParams.get('message') === 'password_updated'
      ? 'Password updated successfully! Please sign in with your new credentials.'
      : null;
  });
  const [infoMessage, setInfoMessage] = useState<string | null>(() => {
    return searchParams.get('reason') === 'password_reset'
      ? 'Your password was reset by an administrator. Please sign in with your temporary password.'
      : null;
  });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [warmupStatus, setWarmupStatus] = useState<'idle' | 'warming' | 'ready'>('idle');
  const [warmedCount, setWarmedCount] = useState(0);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotRole, setForgotRole] = useState<'intern' | 'employee' | 'team_lead' | 'manager' | 'admin'>('intern');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotResult, setForgotResult] = useState<{
    requesterName?: string;
    declaredRole?: string;
    officialsSummary?: string;
    timestamp?: string;
  } | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Read current theme on mount
  useEffect(() => {
    const stored = localStorage.getItem('cruvels-theme');
    if (stored === 'dark') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cruvels-theme', next);
      document.cookie = `cruvels-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
      return next;
    });
  };

  // Background Route Pre-Compilation Engine
  useEffect(() => {
    let isCancelled = false;

    const runWarmup = async () => {
      setWarmupStatus('warming');

      if (process.env.NODE_ENV === 'development') {
        try {
          router.prefetch('/dashboard');
        } catch {}
        if (!isCancelled) {
          setWarmedCount(1);
          setWarmupStatus('ready');
        }
        return;
      }

      for (let i = 0; i < WARMUP_ROUTES.length; i++) {
        if (isCancelled) break;
        const route = WARMUP_ROUTES[i];
        try {
          router.prefetch(route);
        } catch {}
        if (!isCancelled) {
          setWarmedCount(i + 1);
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!isCancelled) {
        setWarmupStatus('ready');
      }
    };

    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => runWarmup());
      } else {
        runWarmup();
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  // Session validation
  useEffect(() => {
    let mounted = true;
    validateTabSession().then((isActive) => {
      if (!mounted || !isActive) return;
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!mounted || !data?.user) return;
          if (data.user.mustChangePassword) {
            window.location.href = '/profile?force=password';
          } else if (data.user.role === 'admin') {
            window.location.href = '/admin';
          } else {
            window.location.href = '/dashboard';
          }
        })
        .catch(() => {});
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = usernameOrEmail.trim();
    if (!cleanIdent || !password) {
      setError('Please enter both your username or company email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: cleanIdent,
          password,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid username/email or password.');
        setLoading(false);
        return;
      }

      markTabSessionActive(rememberMe);

      if (data.user) {
        clientCache.setUserScope(data.user.id);
        clientCache.set('session_user', undefined, data.user);
      }

      if (data.user?.mustChangePassword) {
        window.location.href = '/profile?force=password';
        return;
      }
      if (data.user?.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Network connection error. Please verify your connection and try again.');
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      setForgotError('Please enter your company email or username.');
      return;
    }

    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          role: forgotRole,
          reason: forgotReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data.error || 'Failed to dispatch password reset request. Please contact your manager directly.');
        setForgotLoading(false);
        return;
      }

      setForgotSuccess(true);
      setForgotResult(data.data || { officialsSummary: 'Supervising Higher Officials' });
      setForgotLoading(false);
    } catch {
      setForgotError('Network error while dispatching request. Please check your connection.');
      setForgotLoading(false);
    }
  };

  const resetForgotState = () => {
    setForgotEmail('');
    setForgotRole('intern');
    setForgotReason('');
    setForgotError(null);
    setForgotSuccess(false);
    setForgotResult(null);
  };

  return (
    <div
      className="relative flex min-h-screen min-h-[100dvh] items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'Archivo, sans-serif' }}
    >
      {/* ─── Ambient Glow Orbs ────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 h-[600px] w-[950px] rounded-full blur-[140px] opacity-70 transition-all duration-700"
        style={{ background: theme === 'dark' ? 'rgba(59,130,246,0.18)' : 'rgba(10,54,157,0.14)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-56 right-6 h-[500px] w-[650px] rounded-full blur-[130px] opacity-60 transition-all duration-700"
        style={{ background: theme === 'dark' ? 'rgba(245,158,11,0.12)' : 'rgba(217,119,6,0.08)' }}
      />

      {/* ─── Geometric Dot Matrix Background ─────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage: `radial-gradient(var(--line) 1.25px, transparent 1.25px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 65% 60% at 50% 50%, #000 70%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 60% at 50% 50%, #000 70%, transparent 100%)',
        }}
      />

      {/* ─── Top Theme Switcher ────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 sm:top-7 sm:right-7 z-20 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          id="login-theme-toggle"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
            backdropFilter: 'blur(10px)',
          }}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400 animate-spin-slow" />
              <span className="hidden sm:inline text-[11px] font-mono">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline text-[11px] font-mono">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* ─── Main Interactive Card Area ──────────────────────────────── */}
      <div className="relative w-full max-w-[450px] z-10 py-6 my-auto">
        {/* Brand Header */}
        <div className="mb-6 text-center flex flex-col items-center">
          {/* Live Operational Status Pill */}
          <div
            className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide border shadow-2xs transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line-soft)',
              color: 'var(--ink)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Zero-Trust Gateway • Active</span>
          </div>

          {/* Logo Card with Ambient Glow */}
          <div
            className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl p-2.5 shadow-md transition-transform duration-300 hover:scale-105 group"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
            }}
          >
            <img
              src="/cruvels-logo-transparent.png"
              alt="Cruvels Logo"
              className="h-11 w-11 object-contain transition-transform group-hover:scale-110"
            />
          </div>

          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight"
            style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
          >
            Cruvels{' '}
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400"
            >
              Workplace OS
            </span>
          </h1>
          <p className="mt-1 text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Enterprise Internal Operations & Identity Verification
          </p>
        </div>

        {/* ─── Form Card Container ───────────────────────────────────── */}
        <div
          className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 border shadow-xl transition-all overflow-hidden"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          {/* Top Decorative Rim Gradient */}
          <div
            className="absolute top-0 left-0 right-0 h-[2.5px]"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, var(--teal) 50%, transparent 100%)',
            }}
          />

          {/* ═══════════════════════════════════════════════════════════
              VIEW 1: SIGN IN FORM
             ═══════════════════════════════════════════════════════════ */}
          {view === 'login' ? (
            <>
              {/* Password Updated Success Notification */}
              {successMessage && (
                <div
                  className="mb-5 flex items-start gap-3 rounded-xl p-3.5 text-xs animate-in fade-in slide-in-from-top-1 border"
                  style={{
                    borderColor: 'rgba(16,185,129,0.4)',
                    background: 'rgba(16,185,129,0.08)',
                    color: '#059669',
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div className="leading-relaxed font-semibold">{successMessage}</div>
                </div>
              )}

              {/* Admin Reset Info Notification */}
              {infoMessage && (
                <div
                  className="mb-5 flex items-start gap-3 rounded-xl p-3.5 text-xs animate-in fade-in slide-in-from-top-1 border"
                  style={{
                    borderColor: 'rgba(217,154,31,0.4)',
                    background: 'rgba(217,154,31,0.08)',
                    color: '#d97706',
                  }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="leading-relaxed font-medium">{infoMessage}</div>
                </div>
              )}

              {/* Error Notification */}
              {error && (
                <div
                  className="mb-5 flex items-start gap-3 rounded-xl p-3.5 text-xs animate-in fade-in slide-in-from-top-1 border"
                  style={{
                    borderColor: 'rgba(224,82,82,0.4)',
                    background: 'rgba(224,82,82,0.08)',
                    color: '#e05252',
                  }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{error}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username / Email field */}
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--muted)' }}
                  >
                    Username or Company Email
                  </label>
                  <div className="relative group">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors group-focus-within:text-blue-600"
                      style={{ color: 'var(--muted)' }}
                    >
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      id="login-username"
                      autoComplete="username"
                      required
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder="name@cruvels.com or username"
                      style={{
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink)',
                        fontFamily: 'Archivo, sans-serif',
                      }}
                      className="w-full rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <div className="mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--muted)' }}
                    >
                      Password
                    </label>
                  </div>

                  <div className="relative group">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors group-focus-within:text-blue-600"
                      style={{ color: 'var(--muted)' }}
                    >
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="login-password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink)',
                        fontFamily: 'Archivo, sans-serif',
                      }}
                      className="w-full rounded-xl py-2.5 pl-10 pr-10 text-xs font-medium placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)] focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors hover:opacity-80 cursor-pointer"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me & Forgot Password Link with Key Icon */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 rounded cursor-pointer transition-all"
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                      Remember credentials
                    </span>
                  </label>

                  {/* Forgot Password Action Link with Key design and hover effect */}
                  <button
                    type="button"
                    id="forgot-password-btn"
                    onClick={() => {
                      setView('forgot');
                      setError(null);
                      setSuccessMessage(null);
                      setInfoMessage(null);
                      if (usernameOrEmail.trim()) {
                        setForgotEmail(usernameOrEmail.trim());
                      }
                    }}
                    className="text-xs font-bold transition-all hover:underline cursor-pointer flex items-center gap-1 group py-0.5 px-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: 'var(--teal)' }}
                  >
                    <KeyRound className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                    <span>Forgot password?</span>
                  </button>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  id="login-submit"
                  disabled={loading}
                  className="glow-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer mt-4"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Sign In to Workplace OS</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* System Warmup Indicator */}
                <div
                  className="mt-2 pt-2 flex items-center justify-center gap-2 text-[10px] font-medium select-none"
                  style={{ color: 'var(--muted)' }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full transition-all duration-300 shrink-0"
                    style={{
                      background:
                        warmupStatus === 'ready'
                          ? 'var(--teal)'
                          : warmupStatus === 'warming'
                          ? 'var(--amber)'
                          : 'var(--line)',
                      boxShadow:
                        warmupStatus === 'warming'
                          ? '0 0 8px var(--amber)'
                          : warmupStatus === 'ready'
                          ? '0 0 8px var(--teal)'
                          : 'none',
                    }}
                  />
                  <span>
                    {warmupStatus === 'ready'
                      ? 'All workspace modules pre-warmed & ready for instant launch'
                      : warmupStatus === 'warming'
                      ? `Pre-compiling workspace modules (${warmedCount}/${WARMUP_ROUTES.length})...`
                      : 'Zero-Trust Identity Gateway Ready'}
                  </span>
                </div>
              </form>
            </>
          ) : (
            /* ═══════════════════════════════════════════════════════════
               VIEW 2: FORGOT PASSWORD & HIGHER OFFICIALS ESCALATION
               ═══════════════════════════════════════════════════════════ */
            <div className="animate-in fade-in slide-in-from-right-3 duration-200">
              {/* Back to Login Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    resetForgotState();
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold transition-all hover:opacity-80 cursor-pointer"
                  style={{ color: 'var(--teal)' }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>

              {/* Title & Escalation Banner */}
              <div className="mb-5 space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal)' }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <h2
                    className="text-base font-black tracking-tight"
                    style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                  >
                    Reset Credentials Escalation
                  </h2>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Provide your registered email and role. The Zero-Trust gateway will escalate your password reset request directly to the higher officials overseeing your squad.
                </p>
              </div>

              {/* Error Message */}
              {forgotError && (
                <div
                  className="mb-4 flex items-start gap-2.5 rounded-xl p-3 text-xs border"
                  style={{
                    borderColor: 'rgba(224,82,82,0.4)',
                    background: 'rgba(224,82,82,0.08)',
                    color: '#e05252',
                  }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{forgotError}</div>
                </div>
              )}

              {/* Success Receipt State */}
              {forgotSuccess ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  <div
                    className="rounded-2xl p-4 border text-center space-y-2.5"
                    style={{
                      background: 'rgba(16,185,129,0.06)',
                      borderColor: 'rgba(16,185,129,0.3)',
                    }}
                  >
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                      <Check className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        Escalation Dispatched Successfully
                      </h3>
                      <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90 mt-0.5 leading-relaxed">
                        High-priority alerts and internal security emails have been delivered to your supervising officials.
                      </p>
                    </div>

                    <div
                      className="text-left rounded-xl p-3 text-[11px] space-y-1.5 border"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--line-soft)',
                        color: 'var(--ink)',
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold" style={{ color: 'var(--muted)' }}>Requester:</span>
                        <span className="font-bold">{forgotResult?.requesterName || forgotEmail}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold" style={{ color: 'var(--muted)' }}>Declared Role:</span>
                        <span className="font-mono font-bold" style={{ color: 'var(--teal)' }}>
                          {forgotResult?.declaredRole || forgotRole.toUpperCase()}
                        </span>
                      </div>
                      <div className="pt-1 border-t" style={{ borderColor: 'var(--line-soft)' }}>
                        <span className="font-semibold block mb-0.5" style={{ color: 'var(--muted)' }}>
                          Notified Higher Officials:
                        </span>
                        <span className="font-medium text-[11px] leading-relaxed">
                          {forgotResult?.officialsSummary || 'Supervising Manager & Admin Team'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
                    Once your supervisor approves and resets your temporary password, you may sign in.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      resetForgotState();
                    }}
                    className="glow-btn-primary w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                /* Forgot Password Form */
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
                      style={{ color: 'var(--muted)' }}
                    >
                      Registered Email or Username
                    </label>
                    <div className="relative group">
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors group-focus-within:text-blue-600"
                        style={{ color: 'var(--muted)' }}
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        id="forgot-email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. rahul@cruvels.com or rahul"
                        style={{
                          border: '1px solid var(--line)',
                          background: 'var(--surface-2)',
                          color: 'var(--ink)',
                          fontFamily: 'Archivo, sans-serif',
                        }}
                        className="w-full rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                        Your Organizational Role
                      </label>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
                        Determines supervisory route
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 max-h-[190px] overflow-y-auto pr-1">
                      {ROLE_OPTIONS.map((opt) => {
                        const isSelected = forgotRole === opt.id;
                        return (
                          <button
                            type="button"
                            key={opt.id}
                            onClick={() => setForgotRole(opt.id as any)}
                            className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all w-full text-left touch-manipulation min-h-[44px]"
                            style={{
                              background: isSelected ? 'var(--teal-wash)' : 'var(--surface-2)',
                              borderColor: isSelected ? 'var(--teal)' : 'var(--line-soft)',
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors"
                                style={{
                                  background: isSelected ? 'var(--teal)' : 'transparent',
                                  borderColor: isSelected ? 'var(--teal)' : 'var(--line)',
                                }}
                              >
                                {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                              </div>
                              <div className="truncate min-w-0">
                                <div className="text-xs font-bold leading-tight" style={{ color: isSelected ? 'var(--teal-ink)' : 'var(--ink)' }}>
                                  {opt.label}
                                </div>
                                <div className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
                                  Escalates to: {opt.escalatesTo}
                                </div>
                              </div>
                            </div>

                            <span
                              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 border"
                              style={{
                                background: isSelected ? 'var(--surface)' : 'var(--paper)',
                                borderColor: 'var(--line-soft)',
                                color: isSelected ? 'var(--teal-ink)' : 'var(--muted)',
                              }}
                            >
                              {opt.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Reason / Notes */}
                  <div>
                    <label
                      htmlFor="forgot-reason"
                      className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
                      style={{ color: 'var(--muted)' }}
                    >
                      Reason / Context <span className="font-normal lowercase opacity-75">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="forgot-reason"
                      value={forgotReason}
                      onChange={(e) => setForgotReason(e.target.value)}
                      placeholder="e.g. Lost device, locked out of authenticator..."
                      style={{
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink)',
                        fontFamily: 'Archivo, sans-serif',
                      }}
                      className="w-full rounded-xl py-2 px-3 text-xs font-medium placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Submit Escalation Button */}
                  <button
                    type="submit"
                    id="forgot-submit-btn"
                    disabled={forgotLoading}
                    className="glow-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer mt-2"
                  >
                    {forgotLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Request to Higher Officials</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Support footer */}
          <div
            className="mt-6 pt-4 text-center border-t"
            style={{ borderColor: 'var(--line-soft)' }}
          >
            <p className="text-[11px] flex items-center justify-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Shield className="h-3 w-3 text-blue-600" />
              <span>Assistance & Emergency Access: Contact Cruvels Security Desk</span>
            </p>
          </div>
        </div>

        {/* Security Badges */}
        <div
          className="mt-5 flex items-center justify-center flex-wrap gap-4 text-[11px] font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
            Zero-Trust Access
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Server className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
            TLS 1.3 Encrypted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
            Cruvels Enterprise
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--paper)' }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--teal)] border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
