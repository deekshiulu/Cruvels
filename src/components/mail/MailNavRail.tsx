'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Inbox,
  Send,
  FileText,
  ShieldAlert,
  Trash2,
  Pencil,
  ArrowLeft,
  Mail,
} from 'lucide-react';

export type MailFolderId = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'compose';

interface MailNavRailProps {
  currentFolder?: MailFolderId;
  unreadCount?: number;
}

const MAIL_FOLDERS = [
  { id: 'inbox', label: 'Inbox', href: '/mail/inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', href: '/mail/sent', icon: Send },
  { id: 'drafts', label: 'Drafts', href: '/mail/drafts', icon: FileText },
  { id: 'spam', label: 'Spam', href: '/mail/spam', icon: ShieldAlert },
  { id: 'trash', label: 'Trash', href: '/mail/trash', icon: Trash2 },
] as const;

export default function MailNavRail({ currentFolder, unreadCount }: MailNavRailProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active folder
  let activeId: MailFolderId = 'inbox';
  if (currentFolder) {
    activeId = currentFolder;
  } else if (pathname.includes('/mail/sent')) {
    activeId = 'sent';
  } else if (pathname.includes('/mail/drafts')) {
    activeId = 'drafts';
  } else if (pathname.includes('/mail/spam')) {
    activeId = 'spam';
  } else if (pathname.includes('/mail/trash')) {
    activeId = 'trash';
  } else if (pathname.includes('/mail/compose')) {
    activeId = 'compose';
  }

  const isNotInbox = activeId !== 'inbox';

  return (
    <div
      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-1.5 sm:p-2 mb-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left Side: Back Shortcut & Folder Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {/* Prominent Back to Inbox Shortcut */}
          {isNotInbox && (
            <Link
              href="/mail/inbox"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all shrink-0 select-none mr-1 shadow-2xs"
              title="Return to Inbox / Messages"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Messages</span>
            </Link>
          )}

          {/* Folder Pills */}
          {MAIL_FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeId === folder.id;

            return (
              <Link
                key={folder.id}
                href={folder.href}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-[#0A2540] to-[#1E3A8A] text-white shadow-xs font-bold scale-[1.01] border border-[#1E3A8A]/40'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
                style={{
                  color: isActive ? '#FFFFFF' : 'var(--ink)',
                  border: isActive ? '1px solid rgba(30, 58, 138, 0.4)' : '1px solid transparent',
                }}
              >
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: isActive ? '#FFFFFF' : 'var(--muted)' }}
                />
                <span style={{ color: isActive ? '#FFFFFF' : 'var(--ink)' }}>{folder.label}</span>
                {folder.id === 'inbox' && typeof unreadCount === 'number' && unreadCount > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Side: Primary Compose CTA */}
        <div className="flex items-center justify-end shrink-0 pl-1">
          <Link
            href="/mail/compose"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0A2540] via-[#1E3A8A] to-[#2563EB] px-3 sm:px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all select-none border border-blue-400/20"
            title="Compose Email"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compose</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
