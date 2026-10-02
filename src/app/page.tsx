'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { validateTabSession, clearTabSession } from '@/lib/auth/client-session';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Timeout safety fallback: never let user get stuck on loading screen (generous 10s for dev cold compile)
    const timer = setTimeout(() => {
      if (mounted) router.replace('/login');
    }, 10000);

    const checkAuth = async () => {
      const isTabActive = await validateTabSession();
      if (!mounted) return;

      if (!isTabActive) {
        clearTimeout(timer);
        clearTabSession();
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        if (mounted) router.replace('/login');
        return;
      }

      fetch('/api/auth/me')
        .then((res) => {
          if (!mounted) return;
          clearTimeout(timer);
          if (res.ok) {
            return res.json().then((data) => {
              if (!mounted) return;
              if (data.user?.mustChangePassword) {
                router.replace('/profile?force=password');
              } else if (data.user?.role === 'admin') {
                router.replace('/admin');
              } else {
                router.replace('/dashboard');
              }
            });
          } else if (res.status === 401) {
            clearTabSession();
            router.replace('/login');
          }
        })
        .catch(() => {
          if (!mounted) return;
          clearTimeout(timer);
        });
    };

    checkAuth();

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl p-2.5 shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <img src="/cruvels-logo-transparent.png" alt="Cruvels Logo" className="h-12 w-12 object-contain animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--teal)] border-t-transparent" />
          <p className="text-xs font-semibold" style={{ color: 'var(--muted)', fontFamily: 'Archivo, sans-serif' }}>
            Loading Cruvels Workplace OS...
          </p>
        </div>
      </div>
    </div>
  );
}
