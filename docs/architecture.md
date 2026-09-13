# Cruvels Intern Mail Portal — System Architecture

## 1. Overview
The **Cruvels Intern Mail Portal** provides a zero-trust, isolated email management environment for interns at Cruvels. The core problem addressed is that interns previously accessed a shared Google Workspace/Gmail master inbox using aliases. This led to interns viewing emails belonging to other team members, receiving unrelated corporate communications, losing privacy, and risking accidental data leakage.

The portal acts as a strict authorization barrier between interns and Google Workspace.

```
┌──────────────────────────┐       ┌─────────────────────────────────────────────────────────────┐
│  Google Cloud / Gmail    │       │                     Cruvels Mail Portal                     │
│  (Workspace API / Push)  │ <───> │  [Email Sync Worker / Outbound Sender (Server Auth)]        │
└──────────────────────────┘       └──────────────────────────────┬──────────────────────────────┘
                                                                  │
                                                    ┌─────────────┴─────────────┐
                                                    │                           │
                                                    ▼                           ▼
                                    ┌───────────────────────────┐ ┌───────────────────────────┐
                                    │   Supabase / PostgreSQL   │ │   Next.js API & UI Engine │
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

## 2. Core Architectural Pillars

### 2.1 Zero-Trust Client Model
The frontend client is treated as completely untrusted:
- All database queries, message reads, searches, and downloads are derived strictly from the cryptographically verified user session (`userId`).
- Client-supplied IDs, headers, and query parameters cannot override mailbox boundaries.
- Attempts to access another intern's email or attachment return an authorization error (`403 Forbidden` / non-enumerating `404`).

### 2.2 Server-Enforced Sender Lock
- Outbound emails (both new compositions and replies) strictly enforce the authenticated user's assigned alias as the `From:` header.
- Any attempt from the client to specify a `From` address (such as `ceo@cruvels.com` or another intern's alias) is discarded.

### 2.3 Incremental Email Synchronization
- A background worker polls the email provider (or listens to Gmail Pub/Sub push webhooks) incrementally using checkpoints (`historyId` / timestamps).
- Incoming emails are parsed for all recipients (`To`, `Cc`, `Bcc`, `Delivered-To`).
- Emails are routed only to the specific interns whose assigned aliases match the recipient headers.
- General company emails sent only to `company@cruvels.com` or `all@cruvels.com` without an intern's alias are never exposed in intern inboxes.

### 2.4 HTML Sanitization & Sandboxing
- Inbound email HTML is processed through `sanitize-html` and client-side DOMPurify to strip `<script>`, inline event handlers (`onclick`, `onerror`), `<object>`, `<embed>`, `<iframe>`, and dangerous URIs (`javascript:`, `data:text/html`).
- Email bodies are rendered in isolated containers with strict Content Security Policy headers.

---

## 3. Component Breakdown

| Layer | Technology | Responsibility |
|---|---|---|
| **Web UI & API** | Next.js 15 (App Router, React 19, TypeScript) | Provides responsive desktop/mobile interface and secure REST endpoints. |
| **Auth & Sessions** | `jose` (JWT) + HTTP-Only Secure Cookies | Manages session lifetime, password hashing (PBKDF2/SHA512), and active status check. |
| **Authorization** | `src/lib/security/authorization.ts` | Centralized ownership assertions (`assertMessageOwnership`, `assertAttachmentOwnership`). |
| **Database** | PostgreSQL / Supabase with RLS | Multi-tenant persistent data storage with table-level row security policies. |
| **Sync Worker** | Node.js Worker / Next.js API `/api/mail/sync` | Handles scheduled polling, deduplication, and attachment staging. |
| **Email Provider** | Google Workspace API (`googleapis`) / Mock Provider | Google OAuth2 / Service Account integration with domain-wide delegation. |
