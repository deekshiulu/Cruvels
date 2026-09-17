# Cruvels Internal Workplace & Mail Portal

An enterprise-grade, zero-trust workplace management platform and isolated email gateway built for **Cruvels**. Designed to manage workforce operations, employee directories, attendance, task workflows, and company mail with defense-in-depth authorization boundaries.

---

## 🚀 Key Highlights & Architecture

### 1. Enterprise Workforce Operations (Stage 2)
- **Employee Directory & PII Masking**: Role-based telemetry access where sensitive fields (personal phone, private email, leave balance allocations) are masked from peer interns and only visible to self and authorized Administrators.
- **IST Attendance Engine**: Timezone-accurate (Indian Standard Time) attendance calculations with single-punch enforcement per calendar day and automated conflict prevention against approved leaves.
- **Leave Management & Approval Hierarchy**: Tiered leave balance tracking (`Casual`, `Sick`, `Annual`, `Unpaid`) with approval governance restricted strictly to designated Group Leaders for their respective squad members, and Admins.
- **Department & Squad Scoping**: Multi-tier organizational structure grouping employees by department and squad with automatic leadership synchronization.

### 2. Work & Productivity Suite (Stage 3)
- **Task Management (Kanban)**: Granular access control boundaries distinguishing task creators (full editing rights), assignees (status-only progression), and team members, with squad-level reassignment enforcement.
- **Personal Notes (Strict Multi-Tenancy)**: Zero-trust private notes with cryptographically scoped data boundaries preventing cross-tenant viewing, editing, or deletion.
- **Notice Board & Company Broadcasts**: Role-restricted announcement publishing for Managers and Admins, visible company-wide as an authoritative read-only bulletin board.
- **Schedule & Shifts**: Shift planning and team calendars with creator/admin deletion protection.

### 3. Zero-Trust Email Gateway
- **Zero-Trust Access Control**: Staff and interns access company email strictly through assigned aliases (`rahul@cruvels.com`, `priya@cruvels.com`). Master mailbox credentials are never exposed to clients.
- **Strict IDOR / BOLA Prevention**: Centralized authorization layer on all mail routes. Requests cannot query messages or attachments belonging to other mailboxes.
- **Server-Enforced Sender Lock**: Outbound dispatches strictly enforce the authenticated alias as the `From:` header, eliminating email spoofing risks.
- **HTML Email Sanitization**: Inbound emails are sanitized using strict DOM security rules to neutralize XSS vectors (`<script>`, inline event handlers, `<iframe>`, `javascript:` URI schemes).
- **Comprehensive Audit Trail**: Security events (`LOGIN`, `READ_MESSAGE`, `SEND_MESSAGE`, `DOWNLOAD_ATTACHMENT`, `EMPLOYEE_PROVISIONED`, etc.) logged with redacted sensitive data.

### 4. Edge Runtime Security & Auth Hardening (Stage 1)
- **Edge Middleware Route Protection**: Next.js Edge middleware enforcing role checks on `/admin` and `/api/admin/*` before server execution.
- **Mandatory First-Time Password Change**: Users with default seed credentials are automatically intercepted by Edge middleware and guided to `/profile?force=password`, with sidebar navigation locked until a unique password is configured.
- **Anti-Brute-Force Rate Limiting**: Multi-tier rate limiting by IP (10 req/min) and account identifier (15 req/5 min) to prevent credential stuffing attacks.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router, Server Components, React 19)
- **Language**: TypeScript (Strict Mode, 0 compile errors)
- **Styling**: Vanilla CSS / Tailwind CSS with custom dark theme glassmorphism
- **Database & Storage**: PostgreSQL / Supabase with Row-Level Security (RLS) + In-Memory JSON store fallback
- **Security & Cryptography**: Jose (Signed Edge JWTs), Node `crypto` PBKDF2 (100,000 iterations), sanitize-html
- **Testing**: Vitest (Unit, Security Hardening, and E2E Test Suites)

---

## 💻 Quick Start & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Run Automated Tests
```bash
# Run all 11 test suites (77/77 tests passing)
npm test

# Run type check (0 errors)
npx tsc --noEmit
```

### 4. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3005](http://localhost:3005) in your browser.

---

## 👥 Default Test Personas (Pre-seeded)

| Role | Username | Assigned Alias | Default Password | Redirect Destination |
|---|---|---|---|---|
| **Admin** | `admin` | `admin@cruvels.com` | `Password123!` | `/admin` |
| **Intern A** | `rahul` | `rahul@cruvels.com` | `Password123!` | `/dashboard` |
| **Intern B** | `priya` | `priya@cruvels.com` | `Password123!` | `/dashboard` |

> [!NOTE]
> All default accounts require setting a new password upon first login to enforce security hygiene before accessing dashboard modules.

---

## 🧪 Test Suite Overview

| Test Suite | Coverage Area | Tests | Status |
|---|---|---|---|
| `stage2-workplace-modules.test.ts` | PII Masking, IST Attendance, Leaves Approval Hierarchy | 9 | ✅ Passed |
| `stage3-work-management.test.ts` | Tasks Permissions, Notes Multi-Tenancy, Notices | 7 | ✅ Passed |
| `authorization-hardening.test.ts` | Task Assignment Boundaries, Schedule Event Ownership, Rate Limiting | 7 | ✅ Passed |
| `idor-isolation.test.ts` | Zero-Trust IDOR/BOLA Protection, Sender Locks, Salted Hashes | 14 | ✅ Passed |
| `workflow.test.ts` | Full Intern & Admin E2E Workflows | 2 | ✅ Passed |
| `production-simulation.test.ts` | Seeded Accounts Verification, Outbound SMTP Dispatch | 7 | ✅ Passed |
| `sanitizer.test.ts` | HTML Email XSS & Script Tag Stripping | 6 | ✅ Passed |
| `ownership.test.ts` | Recipient Alias Routing & Mailbox Isolation | 9 | ✅ Passed |
| `employee-management.test.ts` | Squad Scoping, Employee Records CRUD | 6 | ✅ Passed |
| `production-hardening.test.ts` | Edge Middleware, Rate Limiter Boundaries | 7 | ✅ Passed |
| `multi-mailbox.test.ts` | Multi-Tenant Mailbox Separation | 3 | ✅ Passed |
| **Total** | **Full System Verification** | **77** | **100% Passed** |

---

## 📖 Documentation Index
- [Architecture Guide](docs/architecture.md)
- [Security Model & Threat Mitigations](docs/security.md)
- [Database Schema & Migrations](docs/database.md)
- [Deployment Guide](docs/deployment.md)
- [Administrator User Guide](docs/admin-guide.md)
- [Intern User Guide](docs/intern-guide.md)

