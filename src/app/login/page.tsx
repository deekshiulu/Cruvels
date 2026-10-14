'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
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
  Delete,
  Fingerprint,
  RotateCcw,
  Smartphone,
} from 'lucide-react';

import { markTabSessionActive, validateTabSession } from '@/lib/auth/client-session';
import { clientCache } from '@/lib/cache/clientCache';
import {
  MpinDeviceRecord,
  MpinStoredUser,
  getStoredMpinRecord,
  saveMpinRecord,
  clearStoredMpin,
  updateMpinLastLogin,
  encryptMpinSession,
  decryptMpinSession,
  incrementMpinFailedAttempts,
  resetMpinFailedAttempts,
  MAX_MPIN_ATTEMPTS,
} from '@/lib/auth/mpin-crypto';

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

  // MPIN Unlock Screen State
  const [savedMpinRecord, setSavedMpinRecord] = useState<MpinDeviceRecord | null>(() => {
    if (typeof window !== 'undefined') {
      return getStoredMpinRecord();
    }
    return null;
  });

  // Mode: 'mpin' | 'login' | 'mpin-setup' | 'forgot'
  const [view, setView] = useState<'mpin' | 'login' | 'mpin-setup' | 'forgot'>(() => {
    if (typeof window !== 'undefined') {
      const record = getStoredMpinRecord();
      const params = new URLSearchParams(window.location.search);
      const forcePassword = params.get('mode') === 'password' || params.get('action') === 'switch_account';
      if (record && !forcePassword) return 'mpin';
    }
    return 'login';
  });

  const [mpinInput, setMpinInput] = useState('');
  const [mpinError, setMpinError] = useState<string | null>(null);
  const [mpinLoading, setMpinLoading] = useState(false);
  const [mpinShake, setMpinShake] = useState(false);

  // MPIN Setup State (Prompted upon first login)
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupShake, setSetupShake] = useState(false);
  const [tempSessionPayload, setTempSessionPayload] = useState<{ token: string; user: MpinStoredUser } | null>(null);
  const [isAccountMpinAlreadySet, setIsAccountMpinAlreadySet] = useState(false);

  // Login form state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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

  // Detect saved MPIN on initial device mount
  useEffect(() => {
    const record = getStoredMpinRecord();
    const forcePassword = searchParams.get('mode') === 'password' || searchParams.get('action') === 'switch_account';
    if (record && !forcePassword) {
      setSavedMpinRecord(record);
      setView('mpin');
    }
  }, [searchParams]);

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
          setWarmupStatus('ready');
          setWarmedCount(WARMUP_ROUTES.length);
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

  // Session validation - only auto-navigate if active session and NOT viewing MPIN lock screen
  useEffect(() => {
    let mounted = true;
    validateTabSession().then((isActive) => {
      if (!mounted || !isActive) return;
      const record = getStoredMpinRecord();
      const forcePassword = searchParams.get('mode') === 'password' || searchParams.get('action') === 'switch_account';
      // If user has an active MPIN configured on device, NEVER auto-redirect past the lock screen!
      if (record && !forcePassword) return;

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
  }, [searchParams]);

  /* ──────────────────────────────────────────────────────────────────────────
     MPIN UNLOCK LOGIC (Subsequent Logins)
     ────────────────────────────────────────────────────────────────────────── */
  const handleUnlockWithPin = async (pin: string) => {
    if (!savedMpinRecord) return;
    setMpinLoading(true);
    setMpinError(null);

    try {
      // 1. Decrypt token using Web Crypto API (PBKDF2 + AES-GCM)
      let decrypted: { token: string; user: MpinStoredUser };
      try {
        decrypted = await decryptMpinSession(pin, savedMpinRecord);
      } catch {
        const attempts = incrementMpinFailedAttempts();
        setMpinShake(true);
        setTimeout(() => setMpinShake(false), 500);
        setMpinInput('');
        setMpinLoading(false);

        if (attempts >= MAX_MPIN_ATTEMPTS) {
          clearStoredMpin();
          setSavedMpinRecord(null);
          setMpinError('MPIN Locked: 5 incorrect attempts entered. For security, your session has been cleared. Please log in with your email and password.');
          setTimeout(() => {
            setView('login');
            setUsernameOrEmail(savedMpinRecord.user.username || savedMpinRecord.user.primaryAlias || '');
          }, 2500);
          return;
        }

        setMpinError(`Incorrect MPIN (${attempts}/${MAX_MPIN_ATTEMPTS} attempts). Please try again.`);
        return;
      }

      // Reset failed attempts upon successful decryption
      resetMpinFailedAttempts();

      // 2. Validate token and establish persistent session cookie
      const res = await fetch('/api/auth/mpin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: decrypted.token,
          userId: savedMpinRecord.user.id,
          pin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.requiresPasswordLogin) {
          setMpinError('Saved session expired. Please sign in with your password.');
          setTimeout(() => {
            setView('login');
            setUsernameOrEmail(savedMpinRecord.user.username || savedMpinRecord.user.primaryAlias || '');
          }, 1500);
          setMpinLoading(false);
          return;
        }
        setMpinShake(true);
        setTimeout(() => setMpinShake(false), 500);
        setMpinError(data.error || 'Failed to authenticate with MPIN.');
        setMpinInput('');
        setMpinLoading(false);
        return;
      }

      // 3. Mark session active and update local state
      markTabSessionActive(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cruvels_mpin_unlocked', 'true');
      }
      updateMpinLastLogin();

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
      setMpinError('Network or verification error. Please try again.');
      setMpinLoading(false);
    }
  };

  const handleMpinKeyClick = (digit: string) => {
    if (mpinLoading) return;
    if (digit === 'backspace') {
      setMpinInput((prev) => prev.slice(0, -1));
      setMpinError(null);
      return;
    }
    if (digit === 'clear') {
      setMpinInput('');
      setMpinError(null);
      return;
    }

    if (mpinInput.length < 4) {
      const next = mpinInput + digit;
      setMpinInput(next);
      setMpinError(null);
      if (next.length === 4) {
        handleUnlockWithPin(next);
      }
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     MPIN SETUP LOGIC (First Login Flow)
     ────────────────────────────────────────────────────────────────────────── */
  const handleVerifyExistingMpin = async (pin: string) => {
    if (!tempSessionPayload) {
      window.location.href = '/dashboard';
      return;
    }

    setSetupLoading(true);
    setSetupError(null);

    try {
      const res = await fetch('/api/auth/mpin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'verify_existing',
          pin,
          token: tempSessionPayload.token,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSetupShake(true);
        setTimeout(() => setSetupShake(false), 500);
        setSetupError(data.error || 'Incorrect Account MPIN. Please enter your existing 4-digit PIN.');
        setSetupPin('');
        setSetupLoading(false);
        return;
      }

      // Bind the existing verified account MPIN to this device
      const record = await encryptMpinSession(pin, {
        token: data.token || tempSessionPayload.token,
        user: data.user || tempSessionPayload.user,
      });
      saveMpinRecord(record);
      setSavedMpinRecord(record);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cruvels_mpin_unlocked', 'true');
      }

      if (tempSessionPayload.user?.mustChangePassword) {
        window.location.href = '/profile?force=password';
      } else if (tempSessionPayload.user?.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setSetupError('Network error while verifying MPIN.');
      setSetupLoading(false);
    }
  };

  const handleSetupKeyClick = (digit: string) => {
    if (setupLoading) return;
    if (digit === 'backspace') {
      if (isAccountMpinAlreadySet || setupStep === 'enter') {
        setSetupPin((prev) => prev.slice(0, -1));
      } else {
        setSetupConfirmPin((prev) => prev.slice(0, -1));
      }
      setSetupError(null);
      return;
    }
    if (digit === 'clear') {
      setSetupPin('');
      setSetupConfirmPin('');
      setSetupError(null);
      return;
    }

    if (isAccountMpinAlreadySet) {
      if (setupPin.length < 4) {
        const next = setupPin + digit;
        setSetupPin(next);
        setSetupError(null);
        if (next.length === 4) {
          handleVerifyExistingMpin(next);
        }
      }
      return;
    }

    if (setupStep === 'enter') {
      if (setupPin.length < 4) {
        const next = setupPin + digit;
        setSetupPin(next);
        setSetupError(null);
        if (next.length === 4) {
          setTimeout(() => {
            setSetupStep('confirm');
          }, 200);
        }
      }
    } else {
      if (setupConfirmPin.length < 4) {
        const next = setupConfirmPin + digit;
        setSetupConfirmPin(next);
        setSetupError(null);
        if (next.length === 4) {
          handleFinishSetup(setupPin, next);
        }
      }
    }
  };

  const handleFinishSetup = async (pin: string, confirmed: string) => {
    if (pin !== confirmed) {
      setSetupShake(true);
      setTimeout(() => setSetupShake(false), 500);
      setSetupError('PINs do not match. Please re-enter your 4-digit PIN.');
      setSetupConfirmPin('');
      setSetupPin('');
      setSetupStep('enter');
      return;
    }

    if (!tempSessionPayload) {
      window.location.href = '/dashboard';
      return;
    }

    setSetupLoading(true);
    setSetupError(null);

    try {
      // 1. Save MPIN permanently into the database
      const saveRes = await fetch('/api/auth/mpin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          token: tempSessionPayload.token,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        setSetupShake(true);
        setTimeout(() => setSetupShake(false), 500);
        setSetupError(saveData.error || 'Failed to save MPIN to database.');
        setSetupLoading(false);
        return;
      }

      // 2. Encrypt and save device record
      const record = await encryptMpinSession(pin, {
        token: saveData.token || tempSessionPayload.token,
        user: saveData.user || tempSessionPayload.user,
      });
      saveMpinRecord(record);
      setSavedMpinRecord(record);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cruvels_mpin_unlocked', 'true');
      }

      if (tempSessionPayload.user?.mustChangePassword) {
        window.location.href = '/profile?force=password';
      } else if (tempSessionPayload.user?.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setSetupError('Unable to save MPIN. Proceeding to workspace.');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    }
  };

  const handleSkipMpinSetup = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('cruvels_mpin_unlocked', 'true');
    }
    if (tempSessionPayload?.user?.mustChangePassword) {
      window.location.href = '/profile?force=password';
    } else if (tempSessionPayload?.user?.role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/dashboard';
    }
  };

  // Keyboard navigation support for PIN entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view === 'mpin') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleMpinKeyClick(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleMpinKeyClick('backspace');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleMpinKeyClick('clear');
        }
      } else if (view === 'mpin-setup') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleSetupKeyClick(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleSetupKeyClick('backspace');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleSetupKeyClick('clear');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, mpinInput, mpinLoading, setupStep, setupPin, setupConfirmPin, setupLoading, savedMpinRecord, tempSessionPayload]);

  /* ──────────────────────────────────────────────────────────────────────────
     CREDENTIALS LOGIN (First Login or Manual Fallback)
     ────────────────────────────────────────────────────────────────────────── */
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

      // Check if MPIN is already configured for this user on this device
      const existing = getStoredMpinRecord();
      const hasAccountMpin = Boolean(data.user?.hasMpin);

      if (!existing || existing.user.id !== data.user?.id) {
        // Prompt user to link existing account MPIN or create one
        setTempSessionPayload({
          token: data.token,
          user: {
            id: data.user.id,
            name: data.user.name,
            username: data.user.username,
            role: data.user.role,
            status: data.user.status,
            primaryAlias: data.user.primaryAlias,
            designation: data.user.designation,
            squad: data.user.squad,
            department: data.user.department,
          },
        });
        setIsAccountMpinAlreadySet(hasAccountMpin);
        setSetupStep('enter');
        setSetupPin('');
        setSetupConfirmPin('');
        setView('mpin-setup');
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cruvels_mpin_unlocked', 'true');
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
    setForgotSuccess(false);
    setForgotResult(null);
    setForgotError(null);
  };

  const handleSwitchAccount = () => {
    setView('login');
    setUsernameOrEmail('');
    setPassword('');
    setError(null);
  };

  const handleResetSavedMpin = () => {
    clearStoredMpin();
    setSavedMpinRecord(null);
    setView('login');
    setUsernameOrEmail('');
    setPassword('');
    setError(null);
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
              VIEW 1: MPIN UNLOCK SCREEN (Returning Device User)
             ═══════════════════════════════════════════════════════════ */}
          {view === 'mpin' && savedMpinRecord ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              {/* User Details Header */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative mb-3">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 shadow-lg flex items-center justify-center text-2xl font-black text-white border-2 border-white/20">
                    {savedMpinRecord.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" title="Active Trusted Device">
                    <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                  </span>
                </div>

                <span className="text-[11px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                  Welcome Back
                </span>
                <h2
                  className="text-xl sm:text-2xl font-black tracking-tight mt-0.5"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  {savedMpinRecord.user.name}
                </h2>

                <div className="flex items-center gap-1.5 flex-wrap justify-center mt-1.5">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{ background: 'var(--teal-wash)', color: 'var(--teal-ink)', border: '1px solid var(--line)' }}
                  >
                    {savedMpinRecord.user.role.toUpperCase()}
                  </span>
                  {(savedMpinRecord.user.squad || savedMpinRecord.user.designation) && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--line)' }}
                    >
                      {savedMpinRecord.user.squad ? `Squad: ${savedMpinRecord.user.squad}` : savedMpinRecord.user.designation}
                    </span>
                  )}
                </div>

                <p className="text-[11px] mt-2 font-medium" style={{ color: 'var(--muted)' }}>
                  Enter your 4-digit MPIN to unlock your workspace
                </p>
              </div>

              {/* 4 PIN Dots */}
              <div className={`flex items-center justify-center gap-4 my-4 ${mpinShake ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = mpinInput.length > idx;
                  const isCurrent = mpinInput.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-full transition-all duration-200 ${
                        isFilled
                          ? 'bg-blue-600 scale-125 shadow-[0_0_12px_rgba(37,99,235,0.6)]'
                          : isCurrent
                          ? 'border-2 border-blue-500 bg-transparent scale-110'
                          : 'border-2 border-[var(--line)] bg-[var(--surface-2)]'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Error / Loading Feedback */}
              {mpinError && (
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-rose-500 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{mpinError}</span>
                </div>
              )}

              {mpinLoading && (
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span>Decrypting session & unlocking...</span>
                </div>
              )}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[290px] mx-auto select-none mt-4">
                {[
                  { num: '1', letters: '' },
                  { num: '2', letters: 'ABC' },
                  { num: '3', letters: 'DEF' },
                  { num: '4', letters: 'GHI' },
                  { num: '5', letters: 'JKL' },
                  { num: '6', letters: 'MNO' },
                  { num: '7', letters: 'PQRS' },
                  { num: '8', letters: 'TUV' },
                  { num: '9', letters: 'WXYZ' },
                ].map((k) => (
                  <button
                    key={k.num}
                    type="button"
                    onClick={() => handleMpinKeyClick(k.num)}
                    disabled={mpinLoading}
                    className="flex flex-col items-center justify-center h-14 rounded-2xl border transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs cursor-pointer"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--line)',
                      color: 'var(--ink)',
                    }}
                  >
                    <span className="text-xl font-bold leading-none">{k.num}</span>
                    {k.letters && <span className="text-[9px] font-semibold text-[var(--muted)] tracking-wider mt-0.5">{k.letters}</span>}
                  </button>
                ))}
                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleMpinKeyClick('clear')}
                  disabled={mpinLoading}
                  className="flex items-center justify-center h-14 rounded-2xl border text-xs font-bold transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs text-[var(--muted)] cursor-pointer"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--line)',
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleMpinKeyClick('0')}
                  disabled={mpinLoading}
                  className="flex flex-col items-center justify-center h-14 rounded-2xl border transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs cursor-pointer"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                  }}
                >
                  <span className="text-xl font-bold leading-none">0</span>
                  <span className="text-[9px] font-semibold text-[var(--muted)] tracking-wider mt-0.5">+</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMpinKeyClick('backspace')}
                  disabled={mpinLoading}
                  className="flex items-center justify-center h-14 rounded-2xl border transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs cursor-pointer"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                  }}
                  aria-label="Backspace"
                >
                  <Delete className="h-5 w-5 text-[var(--muted)]" />
                </button>
              </div>

              {/* Alternative Actions */}
              <div className="mt-6 flex flex-col items-center gap-2 pt-4 border-t border-[var(--line-soft)]">
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="text-xs font-bold transition-colors hover:underline text-blue-600 dark:text-blue-400 cursor-pointer"
                >
                  Forgot MPIN? Sign in with password
                </button>

                <div className="flex items-center gap-3 text-[11px] text-[var(--muted)] mt-1">
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="hover:underline cursor-pointer"
                  >
                    Switch Account
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleResetSavedMpin}
                    className="hover:underline text-rose-500 cursor-pointer"
                  >
                    Reset Saved PIN
                  </button>
                </div>
              </div>
            </div>
          ) : view === 'mpin-setup' ? (
            /* ═══════════════════════════════════════════════════════════
               VIEW 2: SET UP 4-DIGIT MPIN (First Login Flow)
               ═══════════════════════════════════════════════════════════ */
            <div className="animate-in fade-in zoom-in-95 duration-200">
              {/* Setup Header */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 mb-3 shadow-xs">
                  <KeyRound className="h-6 w-6" />
                </div>

                <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                  {isAccountMpinAlreadySet
                    ? 'Account MPIN Detected'
                    : setupStep === 'enter'
                    ? 'Step 1 of 2: Create MPIN'
                    : 'Step 2 of 2: Confirm MPIN'}
                </span>

                <h2
                  className="text-xl font-black tracking-tight mt-1"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  {isAccountMpinAlreadySet
                    ? 'Enter Account MPIN'
                    : setupStep === 'enter'
                    ? 'Set Up 4-Digit Quick MPIN'
                    : 'Confirm Your 4-Digit MPIN'}
                </h2>

                <p className="text-[11px] mt-1 max-w-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {isAccountMpinAlreadySet
                    ? 'Enter your single 4-digit Account MPIN to enable quick unlock on this device. Your MPIN is saved in the database across all your devices.'
                    : setupStep === 'enter'
                    ? 'Create a 4-digit MPIN for instant, one-tap unlocking across your devices without re-entering your full password.'
                    : 'Re-enter your 4-digit PIN to verify and lock it to this device.'}
                </p>
              </div>

              {/* 4 PIN Setup Dots */}
              <div className={`flex items-center justify-center gap-4 my-4 ${setupShake ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => {
                  const currentPin = isAccountMpinAlreadySet || setupStep === 'enter' ? setupPin : setupConfirmPin;
                  const isFilled = currentPin.length > idx;
                  const isCurrent = currentPin.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-full transition-all duration-200 ${
                        isFilled
                          ? 'bg-blue-600 scale-125 shadow-[0_0_12px_rgba(37,99,235,0.6)]'
                          : isCurrent
                          ? 'border-2 border-blue-500 bg-transparent scale-110'
                          : 'border-2 border-[var(--line)] bg-[var(--surface-2)]'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Error / Loading Feedback */}
              {setupError && (
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-rose-500 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}

              {setupLoading && (
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span>{isAccountMpinAlreadySet ? 'Verifying Account MPIN with database...' : 'Saving MPIN to database & binding to device...'}</span>
                </div>
              )}

              {/* Numeric Keypad for Setup */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[290px] mx-auto select-none mt-4">
                {[
                  { num: '1', letters: '' },
                  { num: '2', letters: 'ABC' },
                  { num: '3', letters: 'DEF' },
                  { num: '4', letters: 'GHI' },
                  { num: '5', letters: 'JKL' },
                  { num: '6', letters: 'MNO' },
                  { num: '7', letters: 'PQRS' },
                  { num: '8', letters: 'TUV' },
                  { num: '9', letters: 'WXYZ' },
                ].map((k) => (
                  <button
                    key={k.num}
                    type="button"
                    onClick={() => handleSetupKeyClick(k.num)}
                    disabled={setupLoading}
                    className="flex flex-col items-center justify-center h-14 rounded-2xl border transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs cursor-pointer"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--line)',
                      color: 'var(--ink)',
                    }}
                  >
                    <span className="text-xl font-bold leading-none">{k.num}</span>
                    {k.letters && <span className="text-[9px] font-semibold text-[var(--muted)] tracking-wider mt-0.5">{k.letters}</span>}
                  </button>
                ))}
                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleSetupKeyClick('clear')}
                  disabled={setupLoading}
                  className="flex items-center justify-center h-14 rounded-2xl border text-xs font-bold transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs text-[var(--muted)] cursor-pointer"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--line)',
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleSetupKeyClick('0')}
                  disabled={setupLoading}
                  className="flex flex-col items-center justify-center h-14 rounded-2xl border transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs cursor-pointer"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                  }}
                >
                  <span className="text-xl font-bold leading-none">0</span>
                  <span className="text-[9px] font-semibold text-[var(--muted)] tracking-wider mt-0.5">+</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetupKeyClick('backspace')}
                  disabled={setupLoading}
                  className="flex items-center justify-center h-14 rounded-2xl border transition-all active:scale-95 touch-manipulation hover:bg-[var(--surface-hover)] shadow-xs cursor-pointer"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                  }}
                  aria-label="Backspace"
                >
                  <Delete className="h-5 w-5 text-[var(--muted)]" />
                </button>
              </div>

              {/* Skip option */}
              <div className="mt-6 flex justify-center pt-4 border-t border-[var(--line-soft)]">
                <button
                  type="button"
                  onClick={handleSkipMpinSetup}
                  className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  Skip for now, continue to workspace →
                </button>
              </div>
            </div>
          ) : view === 'login' ? (
            /* ═══════════════════════════════════════════════════════════
               VIEW 3: STANDARD EMAIL/PASSWORD LOGIN
               ═══════════════════════════════════════════════════════════ */
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
                    color: '#b45309',
                  }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="leading-relaxed font-semibold">{infoMessage}</div>
                </div>
              )}

              {/* Form Title & Switch to MPIN if available */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2
                    className="text-lg font-bold tracking-tight"
                    style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                  >
                    Sign In to Cruvels
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Enter company credentials to continue
                  </p>
                </div>

                {savedMpinRecord && (
                  <button
                    type="button"
                    onClick={() => {
                      setView('mpin');
                      setMpinInput('');
                      setMpinError(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Use Quick PIN</span>
                  </button>
                )}
              </div>

              {/* Error Message */}
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
                  <div className="leading-relaxed font-semibold">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username or Email Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="usernameOrEmail"
                    className="block text-xs font-bold tracking-wide"
                    style={{ color: 'var(--ink)' }}
                  >
                    Username or Company Email
                  </label>
                  <div className="relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
                      style={{ color: 'var(--muted)' }}
                    >
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="usernameOrEmail"
                      type="text"
                      autoComplete="username"
                      required
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder="e.g. john or john@cruvels.com"
                      className="w-full rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium placeholder:text-[var(--muted)] border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
                      style={{
                        background: 'var(--paper)',
                        borderColor: 'var(--line)',
                        color: 'var(--ink)',
                      }}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-xs font-bold tracking-wide"
                      style={{ color: 'var(--ink)' }}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-[11px] font-semibold transition-colors hover:underline cursor-pointer"
                      style={{ color: 'var(--teal)' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
                      style={{ color: 'var(--muted)' }}
                    >
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      className="w-full rounded-xl py-2.5 pl-10 pr-10 text-xs font-medium placeholder:text-[var(--muted)] border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
                      style={{
                        background: 'var(--paper)',
                        borderColor: 'var(--line)',
                        color: 'var(--ink)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors cursor-pointer"
                      style={{ color: 'var(--muted)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Device Checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-[var(--teal)] cursor-pointer"
                    />
                    <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                      Keep me signed in on this device
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="glow-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer mt-4"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Authenticating Identity...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Portal</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Pre-compilation status indicator */}
                <div
                  className="flex items-center justify-center gap-2 text-[10px] font-semibold text-center mt-3 pt-2 border-t border-[var(--line-soft)]"
                  style={{ color: 'var(--muted)' }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
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
               VIEW 4: FORGOT PASSWORD & HIGHER OFFICIALS ESCALATION
               ═══════════════════════════════════════════════════════════ */
            <div className="animate-in fade-in slide-in-from-right-3 duration-200">
              {/* Back to Login Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setView(savedMpinRecord ? 'mpin' : 'login');
                    resetForgotState();
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold transition-all hover:opacity-80 cursor-pointer"
                  style={{ color: 'var(--teal)' }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to {savedMpinRecord ? 'Quick PIN' : 'Sign In'}</span>
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
                      <div className="flex justify-between items-center">
                        <span className="font-semibold" style={{ color: 'var(--muted)' }}>Escalated To:</span>
                        <span className="font-semibold">{forgotResult?.officialsSummary || 'Higher Officials'}</span>
                      </div>
                    </div>
                  </div>

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
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="forgotEmail"
                      className="block text-xs font-bold tracking-wide"
                      style={{ color: 'var(--ink)' }}
                    >
                      Registered Email or Username
                    </label>
                    <div className="relative">
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
                        style={{ color: 'var(--muted)' }}
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        id="forgotEmail"
                        type="text"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. employee@cruvels.com"
                        className="w-full rounded-xl py-2 pl-10 pr-4 text-xs font-medium placeholder:text-[var(--muted)] border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
                        style={{
                          background: 'var(--paper)',
                          borderColor: 'var(--line)',
                          color: 'var(--ink)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="forgotRole"
                      className="block text-xs font-bold tracking-wide"
                      style={{ color: 'var(--ink)' }}
                    >
                      Your Organizational Role
                    </label>
                    <div className="relative">
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
                        style={{ color: 'var(--muted)' }}
                      >
                        <Users className="h-4 w-4" />
                      </div>
                      <select
                        id="forgotRole"
                        value={forgotRole}
                        onChange={(e) => setForgotRole(e.target.value as any)}
                        className="w-full rounded-xl py-2 pl-10 pr-4 text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--teal)] cursor-pointer"
                        style={{
                          background: 'var(--paper)',
                          borderColor: 'var(--line)',
                          color: 'var(--ink)',
                        }}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label} ({opt.badge}) → {opt.escalatesTo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="forgotReason"
                      className="block text-xs font-bold tracking-wide"
                      style={{ color: 'var(--ink)' }}
                    >
                      Reason for Reset Request <span className="font-normal text-[var(--muted)]">(Optional)</span>
                    </label>
                    <textarea
                      id="forgotReason"
                      rows={2}
                      value={forgotReason}
                      onChange={(e) => setForgotReason(e.target.value)}
                      placeholder="e.g. Lost temporary credentials, locked out after vacation..."
                      className="w-full rounded-xl p-2.5 text-xs font-medium placeholder:text-[var(--muted)] border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--teal)] resize-none"
                      style={{
                        background: 'var(--paper)',
                        borderColor: 'var(--line)',
                        color: 'var(--ink)',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="glow-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer mt-2"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Dispatching Security Escalation...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Escalate to Higher Officials</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
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
            <Smartphone className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
            Device-Bound MPIN
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Server className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
            AES-256 Encrypted
          </span>
        </div>

        {/* Legal Links */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-[var(--muted)]">
          <Link href="/terms" className="hover:text-[var(--ink)] hover:underline transition-colors">
            Terms & Conditions
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-[var(--ink)] hover:underline transition-colors">
            Privacy Policy
          </Link>
        </div>

        {/* Footer Copyright */}
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
          Cruvels Workplace OS • Zero-Trust Mobile Platform © 2026
        </p>
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
