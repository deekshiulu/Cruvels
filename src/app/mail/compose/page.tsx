'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Paperclip,
  X,
  Lock,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  User,
  Sparkles,
  Building2,
  Check,
  Clock,
} from 'lucide-react';
import { AuthSessionUser } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

interface StagedAttachment {
  filename: string;
  mimeType: string;
  size: number;
  data: string; // base64
}

interface ContactSuggestion {
  name: string;
  email: string;
  designation?: string;
  department?: string;
  isCompany: boolean;
  frequency: number;
  lastInteractedAt?: string | null;
}

export default function ComposePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthSessionUser | null>(null);

  const [to, setTo] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState('');
  const [showBcc, setShowBcc] = useState(false);
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Contacts Memory & Autocomplete State
  const [allContacts, setAllContacts] = useState<ContactSuggestion[]>([]);
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [activeQuery, setActiveQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Fetch current user
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => router.replace('/login'));

    // 2. Fetch frequent & recent contacts memory
    fetch('/api/mail/contacts')
      .then((res) => res.json())
      .then((data) => {
        if (data.contacts) setAllContacts(data.contacts);
      })
      .catch((err) => console.error('Failed to load contacts memory:', err));

    // 3. Pre-fill ?to= query parameter from URL (e.g., from Squad or GL Email button)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const toParam = params.get('to');
      if (toParam) {
        setTo(toParam.trim());
      }
      const subjectParam = params.get('subject');
      if (subjectParam) {
        setSubject(subjectParam.trim());
      }
    }
  }, [router]);

  // Extract currently typed token from comma-separated string
  const getCurrentToken = (value: string): string => {
    const parts = value.split(',');
    return (parts[parts.length - 1] || '').trim();
  };

  const handleInputChange = (
    field: 'to' | 'cc' | 'bcc',
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setter(value);
    setActiveField(field);
    const token = getCurrentToken(value);
    setActiveQuery(token);
    setHighlightedIndex(0);
  };

  // Filter suggestions based on active query
  const filteredSuggestions = React.useMemo(() => {
    if (!activeField) return [];
    const q = activeQuery.toLowerCase().trim();
    if (!q) {
      // Return top 5 frequent/recent contacts when field is focused but empty
      return allContacts.slice(0, 6);
    }
    return allContacts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.designation && c.designation.toLowerCase().includes(q)) ||
          (c.department && c.department.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [allContacts, activeField, activeQuery]);

  const selectContact = (contact: ContactSuggestion) => {
    let currentVal = '';
    let setter: React.Dispatch<React.SetStateAction<string>> = setTo;

    if (activeField === 'to') {
      currentVal = to;
      setter = setTo;
    } else if (activeField === 'cc') {
      currentVal = cc;
      setter = setCc;
    } else if (activeField === 'bcc') {
      currentVal = bcc;
      setter = setBcc;
    }

    const parts = currentVal.split(',').map((s) => s.trim()).filter(Boolean);
    // Remove the partial token if any
    if (parts.length > 0 && !currentVal.trim().endsWith(',')) {
      parts.pop();
    }
    // Prevent duplicate in the same field
    if (!parts.includes(contact.email)) {
      parts.push(contact.email);
    }

    setter(parts.join(', ') + (parts.length > 0 ? ', ' : ''));
    setActiveField(null);
    setActiveQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeField || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredSuggestions[highlightedIndex]) {
        e.preventDefault();
        selectContact(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds maximum allowed size (25MB).`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      setError('Please provide at least one recipient (To).');
      return;
    }

    setError(null);
    setSending(true);

    const toList = to.split(',').map((s) => s.trim()).filter(Boolean);
    const ccList = cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const bccList = bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const idempotencyKey = `send_${user?.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const bodyHtml = bodyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    try {
      const res = await fetch('/api/mail/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject,
          bodyText,
          bodyHtml,
          idempotencyKey,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to send email.');
        setSending(false);
        return;
      }

      setSuccess(true);
      clientCache.invalidate('inbox');
      clientCache.invalidate('sent');
      clientCache.invalidate('drafts');
      setTimeout(() => {
        router.push('/mail/sent');
      }, 1000);
    } catch {
      setError('Network error while dispatching email.');
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    setError(null);
    setSending(true);

    const toList = to.split(',').map((s) => s.trim()).filter(Boolean);
    const ccList = cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const bccList = bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : [];

    try {
      const res = await fetch('/api/mail/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject,
          bodyText,
          bodyHtml: bodyText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>'),
          isDraft: true,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save draft.');
      } else {
        setSuccess(true);
        clientCache.invalidate('drafts');
        setTimeout(() => {
          router.push('/mail/drafts');
        }, 1000);
      }
    } catch {
      setError('Network error while saving draft.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Cancel & Discard</span>
        </button>

        <h1 className="text-base font-bold text-slate-900 tracking-tight">New Message</h1>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={sending || success}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          Save Draft
        </button>
      </div>

      {/* Main Composer Panel */}
      <form
        onSubmit={handleSend}
        className="flex-1 overflow-y-visible rounded-3xl bg-white p-6 sm:p-7 shadow-sm flex flex-col space-y-4 border border-slate-200 relative"
      >
        {/* Error / Success Notifications */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">Action completed successfully! Redirecting...</span>
          </div>
        )}

        {/* Server-Locked "From" Address Bar */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="font-bold text-slate-500">From:</span>
            <span className="font-bold text-slate-900">{user?.name}</span>
            <span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-mono font-bold text-blue-700">
              {user?.primaryAlias || 'Resolving...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
            <Lock className="h-3 w-3 text-emerald-600" />
            <span>Server Locked Alias</span>
          </div>
        </div>

        {/* Recipient Inputs with Intelligent Autocomplete */}
        <div className="space-y-2 text-xs relative">
          {/* TO Field */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <span className="w-12 font-bold text-slate-500">To:</span>
              <input
                type="text"
                value={to}
                onFocus={() => {
                  setActiveField('to');
                  setActiveQuery(getCurrentToken(to));
                }}
                onChange={(e) => handleInputChange('to', e.target.value, setTo)}
                onKeyDown={handleKeyDown}
                placeholder="Type name or email address... (e.g. rahul@cruvels.com)"
                className="flex-1 bg-transparent text-slate-900 font-medium placeholder-slate-400 focus:outline-none text-xs"
              />
              <div className="flex items-center gap-2 text-slate-400 font-semibold text-[11px]">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    CC
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    BCC
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CC Field */}
          {showCc && (
            <div className="relative">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 focus-within:border-blue-500 focus-within:bg-white transition-all animate-in fade-in">
                <span className="w-12 font-bold text-slate-500">CC:</span>
                <input
                  type="text"
                  value={cc}
                  onFocus={() => {
                    setActiveField('cc');
                    setActiveQuery(getCurrentToken(cc));
                  }}
                  onChange={(e) => handleInputChange('cc', e.target.value, setCc)}
                  onKeyDown={handleKeyDown}
                  placeholder="Comma separated CC addresses"
                  className="flex-1 bg-transparent text-slate-900 font-medium placeholder-slate-400 focus:outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCc(false);
                    setCc('');
                    if (activeField === 'cc') setActiveField(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <div className="relative">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 focus-within:border-blue-500 focus-within:bg-white transition-all animate-in fade-in">
                <span className="w-12 font-bold text-slate-500">BCC:</span>
                <input
                  type="text"
                  value={bcc}
                  onFocus={() => {
                    setActiveField('bcc');
                    setActiveQuery(getCurrentToken(bcc));
                  }}
                  onChange={(e) => handleInputChange('bcc', e.target.value, setBcc)}
                  onKeyDown={handleKeyDown}
                  placeholder="Comma separated BCC addresses"
                  className="flex-1 bg-transparent text-slate-900 font-medium placeholder-slate-400 focus:outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowBcc(false);
                    setBcc('');
                    if (activeField === 'bcc') setActiveField(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Gmail-Style Autocomplete Floating Dropdown */}
          {activeField && filteredSuggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-xl divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1"
            >
              <div className="px-3.5 py-1.5 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Suggested Contacts & Colleagues</span>
                <span className="text-[9px] font-medium text-slate-400">Press ↵ or Tab to select</span>
              </div>
              {filteredSuggestions.map((contact, idx) => {
                const isSelected = idx === highlightedIndex;
                const initials = contact.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={contact.email}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur
                      selectContact(contact);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${
                          contact.isCompany
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {initials || <User className="h-4 w-4" />}
                      </div>

                      {/* Name & Email */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs truncate">
                          <span>{contact.name}</span>
                          {contact.isCompany && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700">
                              Cruvels
                            </span>
                          )}
                          {contact.frequency > 3 && (
                            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                              Frequent
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          {contact.email}
                        </div>
                      </div>
                    </div>

                    {/* Department / Designation */}
                    <div className="text-right shrink-0">
                      {contact.designation && (
                        <div className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]">
                          {contact.designation}
                        </div>
                      )}
                      {contact.department && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {contact.department}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Subject Field */}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 focus-within:border-blue-500 focus-within:bg-white transition-all">
            <span className="w-12 font-bold text-slate-500">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="flex-1 bg-transparent text-slate-900 font-semibold placeholder-slate-400 focus:outline-none text-xs"
            />
          </div>
        </div>

        {/* Textarea Composer */}
        <div className="flex-1 min-h-[240px]">
          <textarea
            required
            rows={10}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Type your message here..."
            className="w-full h-full rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all leading-relaxed"
          />
        </div>

        {/* Staged Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600">Attached Files:</div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-900 border border-slate-200 shadow-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 text-blue-600" />
                  <span className="truncate max-w-[200px] font-medium">{att.filename}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({Math.round(att.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 cursor-pointer shadow-sm transition-all">
            <Paperclip className="h-4 w-4 text-blue-600" />
            <span>Attach Files (Max 25MB)</span>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={sending || success}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={sending || success}
              className="glow-btn-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white tracking-wide disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
