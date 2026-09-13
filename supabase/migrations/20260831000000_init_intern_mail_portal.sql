-- CRUVELS INTERN MAIL PORTAL - DATABASE SCHEMA DEFINITION
-- Safe, idempotent migration script with Row Level Security (RLS)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'intern');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'disabled', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE mail_folder AS ENUM ('inbox', 'sent', 'drafts', 'trash', 'archive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'intern',
    status user_status NOT NULL DEFAULT 'active',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- 4. MAIL ALIASES TABLE
CREATE TABLE IF NOT EXISTS mail_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_active_email_address UNIQUE (email_address)
);

-- 5. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_message_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_alias_id UUID REFERENCES mail_aliases(id) ON DELETE SET NULL,
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    cc_addresses JSONB DEFAULT '[]'::jsonb,
    bcc_addresses JSONB DEFAULT '[]'::jsonb,
    subject TEXT NOT NULL DEFAULT '(No Subject)',
    body_text TEXT,
    body_html TEXT,
    snippet TEXT,
    received_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    folder mail_folder NOT NULL DEFAULT 'inbox',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_provider_message UNIQUE (owner_user_id, provider_message_id)
);

-- 6. ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    provider_attachment_id TEXT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    content_data TEXT, -- Base64 encoded payload or URL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SYNC CHECKPOINTS TABLE
CREATE TABLE IF NOT EXISTS sync_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    last_history_id TEXT,
    last_synced_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'idle',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_mail_aliases_user ON mail_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_aliases_email ON mail_aliases(email_address);

CREATE INDEX IF NOT EXISTS idx_messages_owner_folder ON messages(owner_user_id, folder);
CREATE INDEX IF NOT EXISTS idx_messages_owner_read ON messages(owner_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(owner_user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(owner_user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(owner_user_id, from_address);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;

-- Users RLS: Users can only read their own record; Admins can view/manage all
CREATE POLICY user_read_own_profile ON users
    FOR SELECT
    USING (
        id = auth.uid()
        OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

CREATE POLICY admin_manage_users ON users
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

-- Messages RLS: User can only see and update their own messages
CREATE POLICY user_messages_isolation ON messages
    FOR ALL
    USING (owner_user_id = auth.uid())
    WITH CHECK (owner_user_id = auth.uid());

-- Attachments RLS: Can only access attachment if the owning message belongs to user
CREATE POLICY user_attachments_isolation ON attachments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM messages
            WHERE messages.id = attachments.message_id
            AND messages.owner_user_id = auth.uid()
        )
    );

-- Mail aliases RLS: User can view their own alias, Admin can view and manage all
CREATE POLICY user_aliases_isolation ON mail_aliases
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

CREATE POLICY admin_manage_aliases ON mail_aliases
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

-- Audit logs RLS: Only admins can view audit logs; No user can UPDATE/DELETE (immutable)
CREATE POLICY admin_audit_logs_select ON audit_logs
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

CREATE POLICY system_audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Sync Checkpoints RLS: Only admins can view/manage checkpoints
CREATE POLICY admin_sync_checkpoints_isolation ON sync_checkpoints
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );
