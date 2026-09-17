'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Timeout safety fallback: never let user get stuck on loading screen (generous 10s for dev cold compile)
    const timer = setTimeout(() => {
      if (mounted) router.replace('/login');
    }, 10000);

    fetch('/api/auth/me')
      .then((res) => {
        if (!mounted) return;
        clearTimeout(timer);
        if (res.ok) {
          router.replace('/dashboard');
        } else if (res.status === 401) {
          router.replace('/login');
        }
      })
      .catch(() => {
        if (!mounted) return;
        clearTimeout(timer);
        // Do not immediately bounce on transient network hiccup
      });

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
