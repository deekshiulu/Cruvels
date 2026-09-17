'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid username/email or password.');
        setLoading(false);
        return;
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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 sm:p-6 overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-gradient-to-tr from-blue-200/40 via-indigo-200/30 to-purple-200/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-48 right-10 h-[450px] w-[550px] rounded-full bg-emerald-200/25 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      <div className="relative w-full max-w-[440px] z-10 py-8">
        {/* Brand Header */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 ring-4 ring-blue-50">
            <Building2 className="h-7 w-7 text-white drop-shadow" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Cruvels <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Internal Portal</span>
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 font-medium">
            Enterprise Internal Operations, Employee Directory & Workplace Management
          </p>
        </div>

        {/* Main Authentication Card */}
        <div className="rounded-3xl bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/70 border border-slate-200/80">
          {/* Error Notification */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Username or Company Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="name@cruvels.com or username"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-10 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glow-btn-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white tracking-wide disabled:opacity-50 mt-3 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Sign In to Internal Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Test Credentials Helper */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
              Quick Test Accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail('admin');
                  setPassword('Password123!');
                  setError(null);
                }}
                className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <span className="font-bold">Admin</span>
                <span className="text-[10px] text-slate-400 font-mono">admin</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsernameOrEmail('rahul');
                  setPassword('Password123!');
                  setError(null);
                }}
                className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <span className="font-bold">Intern</span>
                <span className="text-[10px] text-slate-400 font-mono">rahul</span>
              </button>
            </div>
          </div>

          {/* Support / Help footer */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-[11px] text-slate-400">
              Need assistance? Contact your system administrator.
            </p>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            Zero-Trust Access
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Server className="h-3.5 w-3.5 text-emerald-600" />
            TLS 1.3 Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
