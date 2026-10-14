'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  Database, 
  MapPin, 
  Mail, 
  FileText, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Server
} from 'lucide-react';

export default function PrivacyPolicyPage() {
  const lastUpdated = 'October 14, 2026';

  const sections = [
    {
      id: 'collection',
      icon: <Database className="w-5 h-5 text-indigo-500" />,
      title: '1. Information We Collect',
      content: (
        <>
          <p className="text-[var(--ink-secondary)] text-sm leading-relaxed mb-3">
            Cruvels Workplace OS collects and processes specific telemetry, identity, and operational data necessary for organizational workflow governance and communication. We adhere strictly to the principle of data minimization:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[var(--ink-secondary)]">
            <li>
              <strong className="text-[var(--ink)]">Corporate Identity & Directory Data:</strong> Primary email address (e.g., <code className="px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] text-xs">@cruvels.com</code>), user full name, employee identification number, department, reporting manager hierarchy, and assigned role privileges.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Authentication & Security Credentials:</strong> Cryptographically salted and hashed passwords (Argon2 / bcrypt), 4-to-6 digit Mobile Personal Identification Numbers (MPIN), multi-factor authorization tokens, and IP session access logs.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Communication & Mail Telemetry:</strong> Inbound/outbound RFC-822 email metadata (envelope sender, recipients, timestamps, message subjects), IMAP synchronization states, threading indices, and attachment metadata.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Attendance & Geolocation Verification:</strong> Precise or coarse GPS coordinates, Wi-Fi BSSID network telemetry, and device timestamps captured exclusively during explicit clock-in and clock-out submissions to prevent attendance spoofing.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'processing',
      icon: <Server className="w-5 h-5 text-emerald-500" />,
      title: '2. Purpose and Legal Basis for Processing',
      content: (
        <>
          <p className="text-[var(--ink-secondary)] text-sm leading-relaxed mb-3">
            Cruvels acts as the Data Fiduciary/Controller regarding your workplace account. Processing is conducted under legitimate business interests, contractual employment necessity, and regulatory compliance:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500 block mb-1">Access Control & Identity</span>
              <p className="text-xs text-[var(--ink-secondary)]">Ensuring zero-trust verification, preventing credential sharing, and isolating multi-tenant departmental data.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500 block mb-1">Mail & Communications</span>
              <p className="text-xs text-[var(--ink-secondary)]">Synchronizing official emails via IMAP/SMTP, managing organizational calendars, and enforcing audit compliance.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500 block mb-1">Workforce Management</span>
              <p className="text-xs text-[var(--ink-secondary)]">Recording attendance logs, shift verification, overtime calculation, and compliance with local statutory labor regulations.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500 block mb-1">Threat Mitigation & Audit</span>
              <p className="text-xs text-[var(--ink-secondary)]">Monitoring suspicious anomalous logins, brute-force attempts, unauthorized alias impersonation, and perimeter defense.</p>
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'security',
      icon: <Lock className="w-5 h-5 text-amber-500" />,
      title: '3. Data Security & Cryptographic Safeguards',
      content: (
        <>
          <p className="text-[var(--ink-secondary)] text-sm leading-relaxed mb-3">
            Cruvels utilizes defense-in-depth architecture to secure sensitive operational and organizational data:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[var(--ink-secondary)]">
            <li>
              <strong className="text-[var(--ink)]">Encryption in Transit:</strong> Strict Transport Security (TLS 1.3 / HSTS) across all API endpoints, IMAPS (port 993), and SMTPS (port 465). Plaintext connections are refused.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Sender-Lock Enforcement:</strong> Automated platform checks verify that outgoing email headers match authenticated session identities, preventing cross-tenant forgery or spoofing.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Restricted Access & Least Privilege:</strong> Direct database records and audit vaults are inaccessible to unauthorized staff, guarded by granular RBAC (SuperAdmin, Admin, Employee).
            </li>
            <li>
              <strong className="text-[var(--ink)]">Zero-Trust MPIN Protection:</strong> Critical workflows (financial approvals, profile modifications, shift handovers) require dual-factor MPIN validation.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'retention',
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      title: '4. Data Retention & Deletion Lifecycle',
      content: (
        <>
          <p className="text-[var(--ink-secondary)] text-sm leading-relaxed mb-3">
            In accordance with enterprise governance, information is preserved only for designated operational lifecycles:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[var(--ink-secondary)]">
            <li>
              <strong className="text-[var(--ink)]">Email Messages & Trash Retention:</strong> Deleted messages moved to the Trash mailbox undergo a strict 30-day quarantine lifecycle, after which purge tasks permanently erase records unless an active Legal Hold is enacted.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Attendance & Shift Records:</strong> Archived for statutory periods (minimum 36 months) as mandated by corporate compliance and employment regulations.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Session & Security Audit Logs:</strong> Stored for 90 days in rolling log aggregators for real-time forensics and security intrusion detection.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'rights',
      icon: <EyeOff className="w-5 h-5 text-purple-500" />,
      title: '5. User Rights & Data Privacy Disclosures',
      content: (
        <>
          <p className="text-[var(--ink-secondary)] text-sm leading-relaxed mb-3">
            Depending on your jurisdiction and employment agreements, you hold specific privileges regarding your personal workplace records:
          </p>
          <div className="space-y-2.5 text-sm text-[var(--ink-secondary)]">
            <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--line)]">
              <strong className="text-[var(--ink)]">Right to Rectification:</strong> If profile details or department mappings are incorrect, employees may update non-critical attributes in their profile settings or submit a correction ticket to System Administrators.
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--line)]">
              <strong className="text-[var(--ink)]">Right to Access:</strong> Authorized personnel may request exportable copies of their personal activity logs, attendance summaries, and communications history.
            </div>
            <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--line)]">
              <strong className="text-[var(--ink)]">No Sale of Personal Data:</strong> Cruvels never sells, rents, monetizes, or shares employee data or communication history with third-party advertisers or external marketing brokers.
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'contact',
      icon: <Mail className="w-5 h-5 text-rose-500" />,
      title: '6. Governance & Data Protection Officer Contact',
      content: (
        <>
          <p className="text-[var(--ink-secondary)] text-sm leading-relaxed mb-3">
            If you have questions, inquiries, or incident reports regarding the Cruvels Privacy Framework or internal data processing standards, contact:
          </p>
          <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] text-sm space-y-1.5">
            <p className="font-semibold text-[var(--ink)]">Cruvels Information Security & Compliance Office</p>
            <p className="text-[var(--ink-secondary)]">Attention: Data Protection & Legal Governance</p>
            <p className="text-[var(--ink-secondary)]">
              Official Email: <a href="mailto:privacy@cruvels.com" className="text-indigo-500 hover:underline">privacy@cruvels.com</a> / <a href="mailto:admin@cruvels.com" className="text-indigo-500 hover:underline">admin@cruvels.com</a>
            </p>
            <p className="text-xs text-[var(--ink-secondary)] pt-1">Cruvels Enterprise Technology Group &bull; Corporate Headquarters</p>
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation / Back link */}
        <div className="mb-8">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors p-2 rounded-lg hover:bg-[var(--surface)]"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </div>

        {/* Page Header */}
        <div className="border-b border-[var(--line)] pb-8 mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Governance & Security</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                Cruvels Privacy Policy
              </h1>
            </div>
          </div>
          <p className="text-sm text-[var(--ink-secondary)] max-w-2xl mt-2 leading-relaxed">
            This enterprise policy outlines how personal and corporate data is ingested, protected, encrypted, and governed across the Cruvels Workplace Operating System.
          </p>
          <div className="flex items-center gap-4 mt-4 text-xs text-[var(--ink-secondary)]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Effective: {lastUpdated}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Version 2.4.0 (Enterprise)
            </span>
          </div>
        </div>

        {/* Sections List */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div 
              key={section.id} 
              id={section.id}
              className="p-6 sm:p-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm backdrop-blur-md transition-all hover:border-[var(--line-strong)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--line)]">
                  {section.icon}
                </div>
                <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
                  {section.title}
                </h2>
              </div>
              <div>{section.content}</div>
            </div>
          ))}
        </div>

        {/* Footer info & Links */}
        <div className="mt-12 pt-8 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--ink-secondary)]">
          <p>&copy; {new Date().getFullYear()} Cruvels Inc. All enterprise rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[var(--ink)] transition-colors underline-offset-4 hover:underline">
              Terms & Conditions
            </Link>
            <span>&bull;</span>
            <Link href="/login" className="hover:text-[var(--ink)] transition-colors underline-offset-4 hover:underline">
              Portal Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
