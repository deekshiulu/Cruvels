'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Lock,
  Eye,
  Server,
  UserCheck,
  AlertTriangle,
  Mail,
  Scale,
} from 'lucide-react';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{
        background: 'var(--paper, #0B132B)',
        color: 'var(--ink, #FFFFFF)',
      }}
    >
      {/* Top Navbar */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md transition-all"
        style={{
          background: 'rgba(13, 25, 43, 0.85)',
          borderColor: 'var(--line, #1A2F4C)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all active:scale-95 cursor-pointer"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs">
              C
            </div>
            <span
              className="font-bold text-sm tracking-tight"
              style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}
            >
              Cruvels Workplace OS
            </span>
          </div>

          <Link
            href="/privacy"
            className="text-xs font-semibold hover:underline"
            style={{ color: 'var(--teal, #3B82F6)' }}
          >
            Privacy Policy →
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border mb-4"
          style={{
            background: 'var(--teal-wash, rgba(18, 39, 68, 0.6))',
            borderColor: 'var(--line, #1A2F4C)',
            color: 'var(--teal, #3B82F6)',
          }}
        >
          <Scale className="h-3.5 w-3.5" />
          <span>Enterprise Governance & Acceptable Use</span>
        </div>
        <h1
          className="text-2xl sm:text-4xl font-extrabold tracking-tight"
          style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}
        >
          Terms and Conditions of Use
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Last revised: October 14, 2026 • Cruvels Technologies Private Limited
        </p>
      </div>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 space-y-6">
        {/* Notice Card */}
        <div
          className="rounded-2xl p-5 border shadow-sm flex items-start gap-3 text-xs leading-relaxed"
          style={{
            background: 'var(--surface, #0D192B)',
            borderColor: 'var(--line, #1A2F4C)',
          }}
        >
          <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm" style={{ color: 'var(--ink)' }}>
              Cruvels Internal Workplace Policy & Binding Agreement
            </span>
            <p className="mt-1" style={{ color: 'var(--muted)' }}>
              Access to this internal portal, including its Mailbox, Attendance Engine, Document Drive,
              Schedule, and Administrative Console, is strictly restricted to verified employees, interns,
              and authorized contractors of Cruvels. By logging in or authenticating via MPIN, you accept
              full compliance with these terms.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section
          className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4"
          style={{
            background: 'var(--surface, #0D192B)',
            borderColor: 'var(--line, #1A2F4C)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <UserCheck className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              1. Authorized Access & Identity Verification
            </h2>
          </div>
          <div className="text-xs sm:text-sm space-y-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
            <p>
              1.1. Access credentials, including usernames, passwords, device MPINs, and multi-factor
              tokens, are strictly personal and non-transferable. Sharing credentials with fellow employees,
              external parties, or third-party automated scripts is an immediate compliance violation.
            </p>
            <p>
              1.2. The portal utilizes Zero-Trust Identity Guarding. Every session is cryptographically tied
              to an active device fingerprint. Unauthorized tampering with session cookies or forge attempts
              on API endpoints triggers automatic session termination and forensic audit logging.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section
          className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4"
          style={{
            background: 'var(--surface, #0D192B)',
            borderColor: 'var(--line, #1A2F4C)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Mail className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              2. Corporate Mail Gateway & Communication Standards
            </h2>
          </div>
          <div className="text-xs sm:text-sm space-y-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
            <p>
              2.1. <strong>Sender Verification & Alias Locking:</strong> Emails dispatched through the Cruvels
              Mail Gateway are cryptographically locked to your verified primary company alias (e.g.
              <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-xs">user@cruvels.com</code>).
              Forging outbound headers or masquerading as supervisory officials is strictly blocked and audited.
            </p>
            <p>
              2.2. <strong>Acceptable Communications:</strong> The internal mail system is provided solely for
              company business, squad operations, and professional collaboration. Transmitting discriminatory,
              harassing, confidential client-breaching, or unauthorized commercial material is strictly prohibited.
            </p>
            <p>
              2.3. <strong>Trash & Retention Protocols:</strong> Emails moved to Trash are securely retained for
              a standard 30-day grace period, after which automated system purges permanently scrub message bodies
              and attachments.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section
          className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4"
          style={{
            background: 'var(--surface, #0D192B)',
            borderColor: 'var(--line, #1A2F4C)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              3. Attendance, Geofencing & Work Compliance
            </h2>
          </div>
          <div className="text-xs sm:text-sm space-y-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
            <p>
              3.1. <strong>Mandatory Daily Mark:</strong> Employees and interns are required to punch in by the
              company deadline (10:00 AM IST) on working days. Automatic compliance notices and acknowledgement
              tickets are dispatched upon missed thresholds.
            </p>
            <p>
              3.2. <strong>Proxy Prevention:</strong> Attendance records capture verified time markers under Indian
              Standard Time (IST). Proxy punching, mock GPS manipulation, or falsifying shift records constitutes
              gross misconduct.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section
          className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4"
          style={{
            background: 'var(--surface, #0D192B)',
            borderColor: 'var(--line, #1A2F4C)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Eye className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              4. System Monitoring, Telemetry & Audit Logging
            </h2>
          </div>
          <div className="text-xs sm:text-sm space-y-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
            <p>
              4.1. Cruvels maintains comprehensive, immutable system audit logs recording authentication events,
              permission escalations, document downloads from the Drive, and outbound email deliveries.
            </p>
            <p>
              4.2. Users should have no expectation of privacy concerning proprietary business records, task
              comments, or files stored on company infrastructure. Telemetry is monitored to prevent data
              exfiltration and guarantee SOC-2 / enterprise compliance.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section
          className="rounded-3xl p-6 sm:p-8 border shadow-sm space-y-4"
          style={{
            background: 'var(--surface, #0D192B)',
            borderColor: 'var(--line, #1A2F4C)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              5. Intellectual Property & Work Product
            </h2>
          </div>
          <div className="text-xs sm:text-sm space-y-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
            <p>
              All code, designs, architecture diagrams, product roadmaps, calendar entries, client deliverables,
              and internal documentation generated on or transferred through this platform are the exclusive
              intellectual property of Cruvels Technologies Private Limited.
            </p>
          </div>
        </section>

        {/* Footer info */}
        <div className="text-center pt-8 border-t border-slate-800 text-xs text-slate-500 space-y-2">
          <p>© 2026 Cruvels Technologies Private Limited. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-blue-400 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-blue-400 transition-colors">
              Portal Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
