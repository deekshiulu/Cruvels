'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Inbox,
  HardDrive,
} from 'lucide-react';

interface MobileBottomNavProps {
  unreadCount?: number;
  pendingTaskCount?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  matchPrefix?: boolean;
}

export default function MobileBottomNav({
  unreadCount = 0,
  pendingTaskCount = 0,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Tasks',
      href: '/tasks',
      icon: CheckSquare,
      badge: pendingTaskCount,
    },
    {
      label: 'Attendance',
      href: '/attendance',
      icon: Clock,
      matchPrefix: true,
    },
    {
      label: 'Mail',
      href: '/mail',
      icon: Inbox,
      badge: unreadCount,
      matchPrefix: true,
    },
    {
      label: 'Drive',
      href: '/drive',
      icon: HardDrive,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] touch-manipulation"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPrefix
            ? pathname.startsWith(item.href)
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center min-h-[48px] py-1 transition-transform touch-manipulation cursor-pointer active:scale-90 group"
              style={{
                color: isActive ? 'var(--teal)' : 'var(--muted)',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {/* Active top indicator pill */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'var(--teal)' }}
                />
              )}

              <div className="relative">
                <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : 'group-active:scale-95'}`} />

                {/* Badge Counter */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white shadow-xs animate-in zoom-in-75"
                    title={`${item.badge} pending`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] mt-1 tracking-tight leading-none truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
