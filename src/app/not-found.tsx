'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, ArrowLeft, ShieldAlert, Mail } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none"
      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
    >
      <div
        className="w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col items-center space-y-5 animate-in fade-in zoom-in-95 duration-200"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        {/* Brand Icon Badge */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center shadow-inner">
            <img
              src="/cruvels-logo-transparent.png"
              alt="Cruvels Logo"
              className="w-10 h-10 object-contain"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          </div>
        </div>

        {/* Status & Title */}
        <div className="space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Error 404 • Not Found
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight pt-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Page Not Located
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-xs mx-auto">
            The workspace route or resource you requested is missing, moved, or restricted.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-2">
          <Link
            href="/dashboard"
            className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Workspace Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/dashboard';
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border hover:bg-[var(--surface-hover)] active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back to Previous Screen</span>
          </button>
        </div>

        {/* Help & Support */}
        <div className="pt-3 border-t w-full flex items-center justify-center gap-1.5 text-[11px]" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
          <Mail className="w-3.5 h-3.5" />
          <span>Need help?</span>
          <a
            href="mailto:admin@cruvels.com"
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Contact Admin
          </a>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-center text-[11px] text-[var(--muted)]">
        Cruvels Workplace OS • Zero-Trust Mobile Platform © 2026
      </div>
    </div>
  );
}
