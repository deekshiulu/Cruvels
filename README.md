# Cruvels Intern Mail Portal

An enterprise-grade, zero-trust isolated mail management gateway designed for Cruvels interns.

## 🚀 Key Highlights & Security Features
- **Zero-Trust Access Control**: Interns access company email strictly through their assigned alias (`rahul@cruvels.com`, `priya@cruvels.com`). They never receive master Google Workspace / Gmail mailbox credentials.
- **Strict IDOR / BOLA Prevention**: Centralized authorization layer on all endpoints. Requests cannot access or query messages or attachments belonging to other interns.
- **Server-Enforced Sender Lock**: Outbound emails strictly force the authenticated user's assigned alias as the `From:` header. Interns cannot forge or spoof sender addresses.
- **HTML Email Sanitization**: Inbound emails are sanitized to eliminate XSS vectors (`<script>`, inline handlers, `<object>`, `<embed>`, `<iframe>`, `javascript:` URIs).
- **Comprehensive Audit Trail**: Every security event (`LOGIN`, `READ_MESSAGE`, `SEND_MESSAGE`, `DOWNLOAD_ATTACHMENT`, `ADMIN_CREATE_USER`, `ADMIN_DISABLE_USER`, etc.) is logged with redacted sensitive data.
- **Synchronized Mailbox Worker**: Incremental synchronization engine with deduplication against `provider_message_id`. Supports Google Workspace Gmail API (OAuth2 & Service Account delegation) as well as offline simulated test providers.
- **Administrative Control Center**: User provisioning, alias assignment, real-time account disablement, password resets, and live security telemetry.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router, Server Actions, React 19)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + Custom Dark Theme Glassmorphism
- **Database & Auth**: PostgreSQL / Supabase with Row Level Security (RLS) + In-Memory Fallback
- **Security & Validation**: Zod, DOMPurify, sanitize-html, jose (Signed JWT Cookies)
- **Email Providers**: Google Workspace API (`googleapis`), Nodemailer, Mock Provider
- **Testing**: Vitest (Unit, Security IDOR/BOLA, and End-to-End Test Suites)

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
# Run all unit, security, and e2e test suites
npm test

# Run IDOR security isolation tests specifically
npm run test:security
```

### 4. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 Default Test Personas (Pre-seeded)

| Role | Username | Assigned Alias | Default Password | Status |
|---|---|---|---|---|
| **Admin** | `admin` | `admin@cruvels.com` | `Password123!` | Active |
| **Intern A** | `rahul` | `rahul@cruvels.com` | `Password123!` | Active |
| **Intern B** | `priya` | `priya@cruvels.com` | `Password123!` | Active |
| **Intern C** | `karan` | `karan@cruvels.com` | `Password123!` | Disabled |

---

## 📖 Documentation Index
- [Architecture Guide](docs/architecture.md)
- [Security Model & Threat Mitigations](docs/security.md)
- [Database Schema & Migrations](docs/database.md)
- [Email Integration & Google Workspace Setup](docs/email-integration.md)
- [Deployment Guide](docs/deployment.md)
- [Administrator User Guide](docs/admin-guide.md)
- [Intern User Guide](docs/intern-guide.md)
- [Troubleshooting & FAQs](docs/troubleshooting.md)
