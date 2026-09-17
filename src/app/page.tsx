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
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        <p className="text-xs text-slate-500 font-medium tracking-wide">Loading Cruvels Internal Portal...</p>
      </div>
    </div>
  );
}
