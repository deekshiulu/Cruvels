# Cruvels Internal Portal — Portal Gap & Bug Report & Deliverable Assessment

This document fulfills the requirements of **Section 8 (Stage 1 — Portal Foundation Audit)**, **Section 19 (Initial Task for the Intern)**, and **Section 20 (Expected First Submission)** of the *Cruvels Internal Workplace Portal — Intern Development Assignment*.

---

## 1. Setup Notes & Environment Verification

### 1.1 Local Environment Requirements
- **Runtime**: Node.js (v18.18.0 or higher recommended, tested on Node v20+)
- **Package Manager**: `npm` (v10+ or v11+)
- **Operating System**: Windows / Linux / macOS compatible
- **Database Options**:
  1. PostgreSQL / Supabase instance via `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  2. Local zero-dependency persistent JSON store (`data/cruvels_db.json`) with atomic write locking for offline development and self-contained testing.

### 1.2 Execution Commands
```bash
# 1. Install dependencies
npm install

# 2. Run local development server (starts on port 3005 per configuration)
npm run dev

# 3. Execute comprehensive Vitest test suite
npm test

# 4. Strict TypeScript type check
npx tsc --noEmit

# 5. Production build validation
npm run build
```

### 1.3 Setup Observations
- **Port Selection**: Default dev script explicitly binds to port `3005` to avoid port conflicts with standard Next.js apps on `3000`.
- **Offline / Local Fallback**: When Supabase environment variables are omitted or unreachable, `dataStore` transparently utilizes the local JSON datastore, enabling full offline development, deterministic unit testing, and instant bootstrapping.

---

## 2. System Architecture Notes

The portal implements an enterprise zero-trust model separating untrusted client inputs from isolated data structures.

```
[ Browser / Next.js Client ]
             │  (HTTP-Only JWT Cookie + Bearer Token)
             ▼
[ Edge Middleware (src/middleware.ts) ]
             ├── Public route bypass (/login, /api/auth/login, /sw.js)
             ├── JWT signature verification (HMAC SHA-256 via jose)
             ├── Immediate account status check (Disabled/Suspended -> 401 & cookie clearance)
             ├── Mandatory password rotation redirect (/profile?force=password)
             └── Edge Role-Based Guard (/admin, /api/admin restricted strictly to 'admin')
             │
             ▼
[ API Route Handlers (src/app/api/*) ]
             ├── Zod Schema Validation (input constraints, CRLF sanitization)
             ├── requireActiveUser & requireAdmin assertions
             ├── IDOR / BOLA Centralized Guard (src/lib/security/authorization.ts)
             │      ├── assertMessageOwnership(user, messageId)
             │      └── assertAttachmentOwnership(user, messageId, attId)
             ├── Rate Limiting (anti-brute force, email dispatch, sync throttling)
             └── Sanitization Engine (sanitize-html, DOMPurify)
             │
             ▼
[ Persistent Storage Layer (PostgreSQL / Supabase / JSON Store) ]
             ├── Users, Employees, Departments, Groups (Squads)
             ├── Attendance Records (IST normalized, duplicate punch prevention)
             ├── Leave Applications & Group Leader Approvals
             ├── Kanban Tasks (Activity logs, Assignee status-only permissions)
             ├── Personal Notes (Multi-tenant scoped isolation)
             ├── Notices & RFC 5545 Schedules (Google Meet & Teams integration)
             ├── Mailboxes (Inbox, Sent, Drafts, Spam, Trash, Starred)
             └── Immutable Audit Trail (/api/admin/audit-logs)
```

---

## 3. Module Status Matrix

| Module | Route / API | Initial Baseline Status | Hardened & Production Status | Notes & Verification |
|:---|:---|:---:|:---:|:---|
| **Authentication** | `/login`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` | Partial | **Working (100%)** | PBKDF2 hashing, rate limiting, tab synchronization via BroadcastChannel, session cookie protection. |
| **Edge Protection** | `src/middleware.ts` | Partial | **Working (100%)** | Edge JWT validation, force password change gate, admin perimeter protection. |
| **Employees** | `/employees`, `/api/employees` | Working | **Working (100%)** | Full CRUD, squad filters, PII masking for non-managers, Profile 360 privacy. |
| **Departments** | `/departments`, `/api/departments` | Working | **Working (100%)** | Department creation, manager assignments, employee association integrity. |
| **Squads / Groups** | `/departments`, `/api/groups` | Partial | **Working (100%)** | Squad leader assignment, member management, peer squad visibility. |
| **Attendance** | `/attendance`, `/api/attendance` | Partial | **Working (100%)** | Indian Standard Time (IST) normalization, duplicate punch blocking, approved leave conflict detection. |
| **Leave Management**| `/leaves`, `/api/leaves`, `/api/leaves/approvals` | Broken | **Working (100%)** | Hierarchical approval workflow: Group Leaders approve squad leaves, Admin approves all, peer intern approval blocked. |
| **Tasks (Kanban)** | `/tasks`, `/api/tasks` | Partial | **Working (100%)** | Drag-and-drop Kanban, assignee status-only editing, full audit history tracking. |
| **Notes** | `/notes`, `/api/notes` | Partial | **Working (100%)** | Multi-tenant user isolation. User A cannot read, edit, or delete User B notes. |
| **Notices** | `/notices`, `/api/notices` | Partial | **Working (100%)** | Role-based publishing (Admin/Manager only), pinned announcements, organizational broadcast. |
| **Schedule** | `/schedule`, `/api/schedule`, `/api/calendar/*` | Partial | **Working (100%)** | Event creation, strict time range validation (`end > start`), attendee recording, Google Meet & MS Teams sync. |
| **Mail Gateway** | `/mail/*`, `/api/mail/*`, `/api/messages/*` | Partial | **Working (100%)** | Zero-trust mailbox isolation, sender lock (`From:` primary alias), HTML XSS sanitization, Spam quarantine, dedicated Trash with restore/purge. |
| **Notifications** | `/notifications`, `/api/notifications/*` | Partial | **Working (100%)** | Server-Sent Events (SSE) streaming, Web Push VAPID key exchange, category filtering, unread badges. |
| **Admin Area** | `/admin`, `/api/admin/*` | Partial | **Working (100%)** | User provisioning, alias reassignment with uniqueness checks, account disablement, system statistics, immutable audit logs. |

---

## 4. Portal Gap & Bug Report (Audit & Resolutions)

Prioritized by severity level (Critical, High, Medium, Low):

### Issue 1: Missing Mail Trash Mailbox & Restore Workflow [CRITICAL]
- **Module**: Internal Mail Gateway (`/mail/trash`, `/api/mail/trash`)
- **Severity**: **Critical**
- **Reproduction**: Users moving messages to trash could not browse a dedicated trash mailbox, restore accidentally discarded communications, or permanently purge them.
- **Expected Behavior**: A standard `/mail/trash` route must exist allowing users to view trashed emails, restore them to Inbox, or permanently delete them with server-enforced ownership checks.
- **Resolution Implemented**: Created `src/app/api/mail/trash/route.ts` with `GET` (list trashed items), `POST` (soft-delete / restore toggle), and `DELETE` (permanent purge). Built `/mail/trash` UI view.

### Issue 2: Cross-User IDOR Vulnerability in Direct Message / Attachment Access [CRITICAL]
- **Module**: Mail Security (`/api/messages/[id]`, `/api/messages/[id]/attachments/[attId]`)
- **Severity**: **Critical**
- **Reproduction**: Changing the message UUID in client URL parameters could allow reading messages belonging to another intern or downloading unauthorized attachments.
- **Expected Behavior**: Server must verify that the authenticated user is either the recipient (assigned alias) or the sender of the message before returning data or streaming attachment buffers.
- **Resolution Implemented**: Implemented `assertMessageOwnership` and `assertAttachmentOwnership` in `src/lib/security/authorization.ts`. Logs `UNAUTHORIZED_MESSAGE_ACCESS_ATTEMPT` audit event and rejects with `403 Forbidden`. Tested in `tests/security/idor-isolation.test.ts`.

### Issue 3: Duplicate Attendance Punching on the Same Date & Timezone Drift [HIGH]
- **Module**: Attendance Module (`/api/attendance/punch`)
- **Severity**: **High**
- **Reproduction**: Submitting multiple attendance punches on the same calendar day created duplicate rows; UTC server dates caused dates to drift for Indian employees.
- **Expected Behavior**: Only one attendance record per employee per calendar date; date calculation must be normalized to Indian Standard Time (IST, UTC+5:30). Punches must also be blocked if the employee is on approved leave for that day.
- **Resolution Implemented**: Enforced IST date formatting (`Asia/Kolkata`) in `src/app/api/attendance/punch/route.ts`, checked against existing punch records for that date, and checked active approved leaves.

### Issue 4: Unauthorized Leave Approval by Peer Interns [HIGH]
- **Module**: Leave Management (`/api/leaves/approvals`)
- **Severity**: **High**
- **Reproduction**: Interns could send approval PUT requests approving leave requests submitted by other interns.
- **Expected Behavior**: Leave approvals must follow company hierarchy: Group Leaders approve squad members, Managers/Admins approve department requests; peer interns must be forbidden.
- **Resolution Implemented**: Implemented `canReviewLeave` and `isGroupLeaderFor` checks in data store and API handlers. Returns `403 Forbidden` for peer approvals. Tested in `tests/unit/stage2-workplace-modules.test.ts`.

### Issue 5: Missing Schedule Event Time Range Validation [MEDIUM]
- **Module**: Work Management / Schedule (`/api/schedule`)
- **Severity**: **Medium**
- **Reproduction**: Creating a schedule event with `endTime <= startTime` was accepted by API validation.
- **Expected Behavior**: End time must be strictly greater than start time (`end > start`), with invalid ranges rejected with 400 Bad Request.
- **Resolution Implemented**: Added chronological timestamp validation and attendee management support in `src/app/api/schedule/route.ts`. Verified in `tests/unit/calendar-sync-protocols.test.ts`.

### Issue 6: Visible Demo Credentials on Public Login Page [MEDIUM]
- **Module**: Authentication (`/login`)
- **Severity**: **Medium**
- **Reproduction**: "Quick Test Accounts" widget on the login page exposed demo passwords and pre-fill buttons to any public visitor.
- **Expected Behavior**: Enterprise authentication form should require entering valid credentials without visual disclosure of internal test accounts.
- **Resolution Implemented**: Removed the demo credentials widget from `src/app/login/page.tsx` and purged temporary test accounts (`deekshit`, `alex`) while retaining all 12 original Cruvels seed accounts.

---

## 5. Test Baseline & Regression Verification

### 5.1 Test Suites Overview
All 16 test suites pass with **100% green status (112 tests passing, 0 failing)**:

| Test File | Tests | Focus Area | Status |
|:---|:---:|:---|:---:|
| `tests/unit/employee-management.test.ts` | 6 | Employee CRUD, search, department associations | ✅ Passed |
| `tests/unit/stage2-workplace-modules.test.ts` | 9 | Profile 360, IST attendance, leave conflicts, approvals | ✅ Passed |
| `tests/unit/stage3-work-management.test.ts` | 7 | Kanban tasks, personal notes isolation, notice publishing | ✅ Passed |
| `tests/unit/calendar-sync-protocols.test.ts` | 9 | Schedule validation, RFC 5545, Google Meet & Teams sync | ✅ Passed |
| `tests/security/authorization-hardening.test.ts` | 7 | Task assignment rules, event deletion auth, login rate-limiting | ✅ Passed |
| `tests/security/idor-isolation.test.ts` | 14 | Mailbox IDOR, attachment BOLA, sender lock, XSS sanitization | ✅ Passed |
| `tests/unit/multi-mailbox.test.ts` | 3 | Multi-alias routing, deduplication | ✅ Passed |
| `tests/unit/ownership.test.ts` | 9 | Zero-trust ownership invariants, sent isolation | ✅ Passed |
| `tests/unit/sanitizer.test.ts` | 6 | Email HTML sanitization, script stripping, CSS positioning | ✅ Passed |
| `tests/unit/stage4-attendance-mail-enhancements.test.ts` | 6 | Threaded replies, spam quarantine, telemetry calculation | ✅ Passed |
| `tests/unit/session-tab-persistence.test.ts` | 9 | BroadcastChannel tab sync, multi-tab logout, token verification | ✅ Passed |
| `tests/unit/stage6-notifications.test.ts` | 6 | SSE streaming, VAPID key exchange, category filters | ✅ Passed |
| `tests/unit/stage7-admin-controls.test.ts` | 5 | User provisioning, alias uniqueness, account lifecycle | ✅ Passed |
| `tests/unit/production-hardening.test.ts` | 7 | Password rotation, rate limiter bounds, timing attacks | ✅ Passed |
| `tests/e2e/workflow.test.ts` | 2 | End-to-end intern and administrator lifecycles | ✅ Passed |
| `tests/e2e/production-simulation.test.ts` | 7 | Seed data integrity, SMTP transporter mapping | ✅ Passed |
| **Total** | **112** | **Full Assignment Coverage** | **100% Green** |

---

## 6. Definition of Done Compliance Matrix

Per **Section 18** of the assignment:

| Item | Requirement | Audit Result | Verification |
|:---:|:---|:---:|:---|
| 1 | Requirement implemented | **Compliant** | All Stages 0–8 implemented. |
| 2 | UI works in normal, empty, loading and error states | **Compliant** | Empty and error fallbacks tested across all views. |
| 3 | Server-side authorization is enforced | **Compliant** | Zero client trust; all APIs derive user from session. |
| 4 | Input validation is implemented | **Compliant** | Zod schemas validate all request bodies and query params. |
| 5 | Database persistence is verified | **Compliant** | Supabase store and local JSON store validated. |
| 6 | Relevant audit logging is present | **Compliant** | All sensitive actions logged to immutable audit trail. |
| 7 | Tests are added/updated and passing | **Compliant** | 16 test files / 112 tests green. |
| 8 | No existing feature is unintentionally broken | **Compliant** | Full regression pass succeeded without errors. |
| 9 | No secrets or sensitive information are exposed | **Compliant** | Public demo credentials removed; server secrets protected. |
| 10 | Documentation is updated where behavior changed | **Compliant** | `architecture.md`, `security.md`, `deployment.md`, and report updated. |
