# Cruvels Intern Mail Portal — Internal Architecture & Design Specification

## 1. Executive Summary & Problem Context
Cruvels utilizes a common Google Workspace / Gmail mailbox with alias distribution (e.g. `rahul@cruvels.com`, `priya@cruvels.com`, `team@cruvels.com`). Allowing interns direct credentials to the master mailbox introduces severe privacy violations, data leakage risks, inadvertent deletion or response hazards, and compliance non-conformance.

The **Cruvels Intern Mail Portal** provides an isolated, enterprise-grade intermediary layer. Interns authenticate into their dedicated Cruvels portal account where they can view, compose, reply, search, and download attachments strictly belonging to their assigned company email alias. Interns never receive Google Workspace credentials, and all actions are authorization-controlled, validated, and logged to an immutable audit trail.

---

## 2. Current vs. Proposed Architecture

### 2.1 Current Architecture (Vulnerable Direct Access)
```
[ Intern A ] ───┐
                ├─── (Shared Credentials) ───> [ Master Google Workspace Inbox ]
[ Intern B ] ───┘                               (Full Access: Interns see all emails)
```

### 2.2 Proposed Architecture (Zero-Trust Isolated Portal)
```
┌─────────────────┐       ┌─────────────────────────────────────────────────────────────┐
│  Google Cloud   │       │                     Cruvels Mail Portal                     │
│  (Gmail / API)  │ <───> │  [Email Sync Engine / Sender Service (Server-side Auth)]    │
└─────────────────┘       └──────────────────────────────┬──────────────────────────────┘
                                                         │
                                           ┌─────────────┴─────────────┐
                                           │                           │
                                           ▼                           ▼
                           ┌───────────────────────────┐ ┌───────────────────────────┐
                           │   Supabase / PostgreSQL   │ │   Next.js API & Web UI    │
                           │ - Row Level Security (RLS)│ │ - Centralized Auth Guard  │
                           │ - Scoped Data Isolation   │ │ - HTML Email Sanitizer    │
                           │ - Audit Trail & Logs      │ │ - Rate Limiting & CSP     │
                           └───────────────────────────┘ └─────────────┬─────────────┘
                                                                       │
                                                       ┌───────────────┴───────────────┐
                                                       │                               │
                                                       ▼                               ▼
                                              ┌─────────────────┐             ┌─────────────────┐
                                              │  Intern Portal  │             │   Admin Portal  │
                                              │ (Strict Alias)  │             │ (User / Alias)  │
                                              └─────────────────┘             └─────────────────┘
```

---

## 3. Strict Security Model & Invariants

### 3.1 Absolute Zero-Trust Ownership Invariants
1. **Never Trust Client-Supplied Identifiers**: The backend strictly derives the user's permitted email aliases from the cryptographically verified session token (`userId -> user -> active aliases`). Any client query parameter or body payload attempting to set `from`, `alias`, or `ownerUserId` is ignored or rejected with `403 Forbidden`.
2. **Strict Message Access Control**: A message is viewable by user $U$ if and only if:
   $$\text{owner\_user\_id} = U.\text{id} \quad \lor \quad \text{assigned\_alias} \in \{\text{to\_addresses}, \text{cc\_addresses}, \text{bcc\_addresses}, \text{from\_address}\}$$
3. **Sent Mail Isolation**: The `/mail/sent` query is locked server-side to emails where `from_address` equals the user's active assigned alias. Intern A cannot see Intern B's sent items.
4. **Isolated Attachment Streaming**: Attachments are retrieved via `/api/messages/:messageId/attachments/:attachmentId`. Direct public URLs are never stored or exposed. The endpoint enforces message ownership before streaming with strict `Content-Disposition: attachment; filename="..."` and sanitized MIME types.
5. **Sender Spoofing Prevention**: Outgoing emails constructed via `/api/mail/compose` and `/api/mail/reply` automatically inject the authenticated user's assigned alias as the `From:` header. Interns cannot forge headers.
6. **HTML Email Sanitization & Iframe Sandboxing**: Inbound HTML emails are sanitized server-side (and client-side via DOMPurify with strict allowlists) to strip all `<script>`, inline event handlers (`onclick`, `onload`), `<object>`, `<embed>`, `<form>`, and tracking vectors. Email bodies are rendered within sandboxed iframe containers.
7. **Rate Limiting & Brute Force Defense**: Rate limiting is applied across login attempts, password resets, email sending, search queries, and attachment downloads.
8. **Account Disablement Invalidation**: When an admin sets `user.status = 'disabled'`, any active session tokens and incoming requests are immediately invalidated.

---

## 4. Database Model (PostgreSQL / Supabase)

### 4.1 Tables & Schema
- `users`:
  - `id` (UUID, Primary Key)
  - `auth_user_id` (UUID, nullable for Supabase auth integration)
  - `name` (TEXT, NOT NULL)
  - `username` (TEXT, UNIQUE, NOT NULL)
  - `role` (ENUM: `'admin'`, `'intern'`)
  - `status` (ENUM: `'active'`, `'disabled'`, `'suspended'`)
  - `password_hash` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())
  - `updated_at` (TIMESTAMPTZ, DEFAULT NOW())
  - `last_login_at` (TIMESTAMPTZ)

- `mail_aliases`:
  - `id` (UUID, Primary Key)
  - `user_id` (UUID, REFERENCES `users(id)` ON DELETE CASCADE)
  - `email_address` (TEXT, UNIQUE, NOT NULL, Lowercase)
  - `is_active` (BOOLEAN, DEFAULT TRUE)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())
  - `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

- `messages`:
  - `id` (UUID, Primary Key)
  - `provider_message_id` (TEXT, UNIQUE, NOT NULL)
  - `thread_id` (TEXT, NOT NULL)
  - `owner_user_id` (UUID, REFERENCES `users(id)` ON DELETE CASCADE)
  - `owner_alias_id` (UUID, REFERENCES `mail_aliases(id)` ON DELETE SET NULL)
  - `from_address` (TEXT, NOT NULL)
  - `from_name` (TEXT)
  - `to_addresses` (JSONB / TEXT[], NOT NULL)
  - `cc_addresses` (JSONB / TEXT[])
  - `bcc_addresses` (JSONB / TEXT[])
  - `subject` (TEXT, NOT NULL)
  - `body_text` (TEXT)
  - `body_html` (TEXT)
  - `snippet` (TEXT)
  - `received_at` (TIMESTAMPTZ)
  - `sent_at` (TIMESTAMPTZ)
  - `folder` (ENUM: `'inbox'`, `'sent'`, `'drafts'`, `'trash'`, `'archive'`)
  - `is_read` (BOOLEAN, DEFAULT FALSE)
  - `is_starred` (BOOLEAN, DEFAULT FALSE)
  - `has_attachments` (BOOLEAN, DEFAULT FALSE)
  - `provider_metadata` (JSONB)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())
  - `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

- `attachments`:
  - `id` (UUID, Primary Key)
  - `message_id` (UUID, REFERENCES `messages(id)` ON DELETE CASCADE)
  - `provider_attachment_id` (TEXT)
  - `filename` (TEXT, NOT NULL)
  - `mime_type` (TEXT, NOT NULL)
  - `size` (BIGINT, NOT NULL)
  - `storage_path` (TEXT, NOT NULL)
  - `content_data` (BYTEA / Base64 for localized storage)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())

- `audit_logs`:
  - `id` (UUID, Primary Key)
  - `user_id` (UUID, REFERENCES `users(id)` ON DELETE SET NULL)
  - `action` (TEXT, NOT NULL - e.g. `LOGIN`, `READ_MESSAGE`, `SEND_MESSAGE`, `DOWNLOAD_ATTACHMENT`, `ADMIN_CREATE_USER`, `ADMIN_DISABLE_USER`, `ADMIN_ASSIGN_ALIAS`)
  - `resource_type` (TEXT)
  - `resource_id` (TEXT)
  - `metadata` (JSONB)
  - `ip_address` (TEXT)
  - `user_agent` (TEXT)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())

- `sync_checkpoints`:
  - `id` (UUID, Primary Key)
  - `provider` (TEXT, NOT NULL)
  - `last_history_id` (TEXT)
  - `last_synced_at` (TIMESTAMPTZ)
  - `status` (TEXT)
  - `error_message` (TEXT)

---

## 5. Google Workspace / Email Integration Approach

### 5.1 Provider Architecture
1. **Google Workspace Service Account with Domain-Wide Delegation** (Production Preferred):
   - Authenticates as the common mailbox (`mail@cruvels.com` / `admin@cruvels.com`).
   - Uses `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.send`.
2. **Google OAuth 2.0 Client / Refresh Token**:
   - Stores server-side `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`.
3. **Simulated / Mock Email Provider Layer (For Autonomous Local Dev & CI/CD Testing)**:
   - Includes a deterministic mock mailbox simulator providing full email parsing, threading, attachment staging, and recipient routing.
   - Allows 100% offline development, test suite execution, and reproducible CI tests without external rate-limit or downtime risks.

---

## 6. Email Ownership & Routing Logic

When an email arrives:
1. Extract all recipient addresses from `To`, `Cc`, `Bcc`, and `Delivered-To` headers.
2. Query active aliases in `mail_aliases`.
3. For each matching alias:
   - Route message to the associated `user_id`.
   - If multiple interns share an alias (or are CC'd), create distinct message ownership records to ensure separate read/unread states and independent lifecycle tracking.
4. If an email is sent only to generic `company@cruvels.com` without an intern alias or CC, it is NOT ingested into intern inboxes, preserving corporate confidentiality.

---

## 7. API Structure

### 7.1 Authentication Endpoints
- `POST /api/auth/login` (Username/Email + Password, returns secure HTTP-Only JWT Cookie)
- `POST /api/auth/logout` (Clears auth cookie, records audit log)
- `GET /api/auth/me` (Returns authenticated user profile, active alias, role, and permissions)
- `POST /api/auth/reset-password` (Admin password reset)

### 7.2 Intern Mail Endpoints
- `GET /api/mail/inbox?page=1&limit=25&q=...` (Scoped inbox messages)
- `GET /api/mail/sent?page=1&limit=25&q=...` (Scoped sent messages)
- `GET /api/messages/:id` (Message details + marks as read + ownership assertion)
- `GET /api/messages/:id/attachments/:attachmentId` (Authorized attachment download stream)
- `POST /api/mail/compose` (Send email, server enforced `from`, idempotency support)
- `POST /api/mail/reply` (Reply to email, headers auto-threaded)
- `POST /api/mail/sync` (Trigger incremental sync)

### 7.3 Admin Management Endpoints
- `GET /api/admin/users` (List interns, roles, statuses, assigned aliases)
- `POST /api/admin/users` (Create new intern, provision initial alias)
- `PATCH /api/admin/users/:id` (Update status: active/disabled, reset password)
- `POST /api/admin/users/:id/alias` (Assign/update email alias)
- `GET /api/admin/audit-logs` (Filtered audit trail with pagination)
- `GET /api/admin/stats` (Portal overview KPIs)

---

## 8. Deployment Model
- **Frontend & Web API**: Next.js App Router deployed to Vercel (or Node.js container).
- **Database & Storage**: Supabase (PostgreSQL with RLS) + Supabase Storage / encrypted object storage for attachments.
- **Synchronization Engine**:
  - Incremental cron/webhook handler via Next.js Edge/Node API (`/api/mail/sync`) triggered by Vercel Cron or Cloudflare Worker Cron.
  - Standalone Node.js sync worker daemon (`scripts/sync-worker.ts`) for continuous polling or Gmail Push Notifications (Cloud Pub/Sub).

---

## 9. Known Risks & Mitigations
- **IDOR / Parameter Tampering**: Mitigated via centralized authorization helper `assertMessageOwnership(user, messageId)` in every endpoint.
- **XSS via Malicious Email HTML**: Mitigated via dual sanitization (server-side `sanitize-html` and client-side `DOMPurify`) and iframe `sandbox="allow-popups"` container.
- **CRLF Header Injection**: Mitigated via strict regex validation on recipient addresses and subject headers.
- **Accidental Mass Deletions**: Portal soft-deletes or archives messages locally without impacting the master Google Workspace archive unless explicitly configured.

---

## 10. External Dependencies & Configuration Required for Production
1. `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` (or Service Account JSON credentials)
3. `JWT_SECRET` for cryptographically signed session tokens
4. `NEXT_PUBLIC_APP_URL`
