'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Clock,
  ShieldCheck,
  CheckSquare,
  FileCheck,
  Megaphone,
  Calendar,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

export type AdminSectionId =
  | 'overview'
  | 'workforce'
  | 'attendance'
  | 'compliance'
  | 'tasks'
  | 'acknowledgements'
  | 'notices'
  | 'calendar'
  | 'audit'
  | 'settings';

export interface AdminNavSection {
  id: AdminSectionId;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
  isExternalPath?: boolean;
}

export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'System health & KPI telemetry',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    id: 'workforce',
    label: 'Workforce',
    description: 'Accounts, roles & provisioning',
    href: '/admin?tab=workforce',
    icon: Users,
  },
  {
    id: 'attendance',
    label: 'Attendance Logs',
    description: 'Daily punches & timeline',
    href: '/attendance',
    icon: Clock,
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Rules, ratings & corrections',
    href: '/admin/attendance-compliance',
    icon: ShieldCheck,
    badge: 'Rules',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    isExternalPath: true,
  },
  {
    id: 'tasks',
    label: 'Tasks & Workload',
    description: 'Cross-squad kanban board',
    href: '/tasks',
    icon: CheckSquare,
  },
  {
    id: 'acknowledgements',
    label: 'Acknowledgements',
    description: 'Mandatory sign-offs & overdue tracking',
    href: '/admin/acknowledgements',
    icon: FileCheck,
    badge: 'Universal',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    isExternalPath: true,
  },
  {
    id: 'notices',
    label: 'Notices',
    description: 'Broadcasts & squad memos',
    href: '/notices',
    icon: Megaphone,
  },
  {
    id: 'calendar',
    label: 'Calendar & Holidays',
    description: 'Events & holiday schedules',
    href: '/schedule',
    icon: Calendar,
  },
  {
    id: 'audit',
    label: 'Security & Audit',
    description: 'Zero-trust audit trails',
    href: '/admin?tab=audit',
    icon: ShieldAlert,
  },
  {
    id: 'settings',
    label: 'System Settings',
    description: 'Dynamic rules & intervals',
    href: '/admin/settings',
    icon: Sliders,
    badge: 'Dynamic',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    isExternalPath: true,
  },
];

interface AdminNavRailProps {
  currentTab?: AdminSectionId;
  onTabChange?: (tab: AdminSectionId) => void;
}

function AdminNavRailContent({ currentTab, onTabChange }: AdminNavRailProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Determine active section
  let activeId: AdminSectionId = 'overview';
  if (currentTab) {
    activeId = currentTab;
  } else if (pathname === '/admin/attendance-compliance') {
    activeId = 'compliance';
  } else if (pathname === '/admin/acknowledgements') {
    activeId = 'acknowledgements';
  } else if (pathname === '/admin/settings') {
    activeId = 'settings';
  } else if (pathname === '/admin') {
    const tabParam = searchParams.get('tab') as AdminSectionId | null;
    if (tabParam && ['workforce', 'audit'].includes(tabParam)) {
      activeId = tabParam;
    } else {
      activeId = 'overview';
    }
  }

  const handleNavClick = (section: AdminNavSection, e: React.MouseEvent) => {
    if (onTabChange && !section.isExternalPath && pathname === '/admin') {
      e.preventDefault();
      onTabChange(section.id);
      if (section.id === 'overview') {
        router.push('/admin');
      } else {
        router.push(`/admin?tab=${section.id}`);
      }
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-1.5 mb-6 relative">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeId === section.id;

          return (
            <Link
              key={section.id}
              href={section.href}
              onClick={(e) => handleNavClick(section, e)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 select-none ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs font-bold scale-[1.01]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              title={section.description}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>{section.label}</span>
              {section.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider border ${
                    isActive ? 'bg-purple-700/80 text-purple-100 border-purple-500' : section.badgeColor
                  }`}
                >
                  {section.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminNavRail(props: AdminNavRailProps) {
  return (
    <React.Suspense
      fallback={
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 mb-6 h-14 animate-pulse" />
      }
    >
      <AdminNavRailContent {...props} />
    </React.Suspense>
  );
}
