# Cruvels Intern Mail Portal — Database Schema & Data Dictionary

## 1. Schema Overview (PostgreSQL / Supabase)

The database schema is defined in `supabase/migrations/20260831000000_init_intern_mail_portal.sql`.

```
┌────────────────┐          ┌────────────────┐
│     users      │ 1      * │  mail_aliases  │
│────────────────│──────────│────────────────│
│ id (PK)        │          │ id (PK)        │
│ username       │          │ user_id (FK)   │
│ role           │          │ email_address  │
│ status         │          │ is_active      │
└────────────────┘          └────────────────┘
        │ 1
        │
        │ *
┌────────────────┐ 1      * ┌────────────────┐
│    messages    │──────────│  attachments   │
│────────────────│          │────────────────│
│ id (PK)        │          │ id (PK)        │
│ owner_user_id  │          │ message_id(FK) │
│ from_address   │          │ filename       │
│ to_addresses   │          │ mime_type      │
│ folder         │          │ storage_path   │
└────────────────┘          └────────────────┘
```

---

## 2. Table Definitions

### 2.1 `users`
Represents administrators and intern accounts.
- `id` (UUID, Primary Key): Unique internal user identifier.
- `auth_user_id` (UUID, Optional): Link to Supabase Auth user if integrated.
- `name` (TEXT): Full name of the user.
- `username` (TEXT, UNIQUE): Login username.
- `role` (ENUM: `'admin'`, `'intern'`): Access control tier.
- `status` (ENUM: `'active'`, `'disabled'`, `'suspended'`): Account lifecycle state.
- `password_hash` (TEXT): PBKDF2/SHA-512 cryptographic hash.
- `created_at` / `updated_at` (TIMESTAMPTZ): Audit timestamps.
- `last_login_at` (TIMESTAMPTZ): Timestamp of most recent authentication.

### 2.2 `mail_aliases`
Maps company email aliases to specific users.
- `id` (UUID, Primary Key).
- `user_id` (UUID, Foreign Key `users(id)` ON DELETE CASCADE).
- `email_address` (TEXT, UNIQUE): Lowercase email address (e.g. `rahul@cruvels.com`).
- `is_active` (BOOLEAN): Flag determining whether the alias receives and sends mail.

### 2.3 `messages`
Stores message metadata and sanitized body content.
- `id` (UUID, Primary Key).
- `provider_message_id` (TEXT): Unique ID from the email provider (e.g. Gmail Message ID).
- `thread_id` (TEXT): Provider conversation thread ID.
- `owner_user_id` (UUID, Foreign Key `users(id)` ON DELETE CASCADE): User permitted to see this message.
- `owner_alias_id` (UUID, Foreign Key `mail_aliases(id)`).
- `from_address` (TEXT): Sender email address.
- `from_name` (TEXT): Sender display name.
- `to_addresses` (JSONB): Array of recipient strings.
- `cc_addresses` / `bcc_addresses` (JSONB): Array of CC/BCC recipient strings.
- `subject` (TEXT): Cleaned subject line.
- `body_text` / `body_html` (TEXT): Plain text and sanitized HTML contents.
- `snippet` (TEXT): Short summary preview.
- `folder` (ENUM: `'inbox'`, `'sent'`, `'drafts'`, `'trash'`, `'archive'`).
- `is_read` / `is_starred` / `has_attachments` (BOOLEAN).

### 2.4 `attachments`
Stores attachment metadata and secure storage references.
- `id` (UUID, Primary Key).
- `message_id` (UUID, Foreign Key `messages(id)` ON DELETE CASCADE).
- `provider_attachment_id` (TEXT): ID from email provider.
- `filename` (TEXT): Sanitized original file name.
- `mime_type` (TEXT): Content type (e.g. `application/pdf`).
- `size` (BIGINT): File size in bytes.
- `storage_path` (TEXT): Internal storage object key.
- `content_data` (TEXT): Base64 encoded payload for localized storage.

### 2.5 `audit_logs`
Immutable record of security and administrative actions.
- `id` (UUID, Primary Key).
- `user_id` (UUID, Nullable).
- `action` (TEXT): Event name (e.g. `LOGIN`, `READ_MESSAGE`, `ADMIN_CREATE_USER`).
- `resource_type` (TEXT) & `resource_id` (TEXT).
- `metadata` (JSONB): Sanitized context data.
- `ip_address` (TEXT) & `user_agent` (TEXT).
- `created_at` (TIMESTAMPTZ).

### 2.6 `sync_checkpoints`
Tracks provider synchronization markers.
- `id` (UUID, Primary Key).
- `provider` (TEXT, UNIQUE): Provider identifier (e.g. `GoogleWorkspaceProvider`).
- `last_history_id` (TEXT): Gmail historyId bookmark.
- `last_synced_at` (TIMESTAMPTZ).
- `status` (TEXT): `'idle'`, `'syncing'`, `'error'`, `'success'`.
- `error_message` (TEXT, Nullable).
