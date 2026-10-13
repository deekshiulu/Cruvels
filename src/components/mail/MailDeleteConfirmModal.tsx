'use client';

import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X, Mail } from 'lucide-react';

interface MailDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  subject?: string;
  sender?: string;
  confirmText?: string;
  isPermanent?: boolean;
  loading?: boolean;
}

export default function MailDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Move this message to trash?',
  description = 'This message will be moved to your Trash folder. You can recover it within 30 days before it is permanently purged.',
  subject,
  sender,
  confirmText = 'Move to Trash',
  isPermanent = false,
  loading = false,
}: MailDeleteConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{
        background: 'rgba(5, 12, 22, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all animate-in zoom-in-95 duration-200 relative overflow-hidden"
        style={{
          background: 'var(--surface, #0D192B)',
          borderColor: 'var(--line, #1A2F4C)',
          color: 'var(--ink, #FFFFFF)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Subtle top danger accent gradient line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500" />

        {/* Header row with Icon and Close Button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
                isPermanent
                  ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                  : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
              }`}
            >
              {isPermanent ? (
                <AlertTriangle className="h-6 w-6 animate-pulse text-red-500" />
              ) : (
                <Trash2 className="h-6 w-6 text-rose-500" />
              )}
            </div>
            <div>
              <h3
                className="text-base sm:text-lg font-bold tracking-tight"
                style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
              >
                {title}
              </h3>
              <span
                className={`inline-block text-[10px] font-semibold uppercase tracking-wider rounded-md px-2 py-0.5 mt-0.5 ${
                  isPermanent
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {isPermanent ? 'Permanent Action' : 'Recoverable in Trash'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 transition-all opacity-70 hover:opacity-100 hover:bg-slate-500/10 active:scale-95 disabled:opacity-30 cursor-pointer"
            style={{ color: 'var(--muted)' }}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mt-3.5 text-xs sm:text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          {description}
        </p>

        {/* Message Preview Context Card (if subject or sender provided) */}
        {(subject || sender) && (
          <div
            className="mt-4 rounded-2xl p-3.5 border transition-all text-xs space-y-1.5"
            style={{
              background: 'var(--surface-2, rgba(19, 35, 59, 0.6))',
              borderColor: 'var(--line-soft, #14243B)',
            }}
          >
            <div className="flex items-center gap-2 font-semibold truncate" style={{ color: 'var(--ink)' }}>
              <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{subject || '(No Subject)'}</span>
            </div>
            {sender && (
              <div className="text-[11px] truncate flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                <span>From:</span>
                <span className="font-medium text-slate-300 truncate">{sender}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions Button Group */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer disabled:opacity-40"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={async () => {
              if (loading) return;
              await onConfirm();
            }}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/25"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
