-- Cruvels Workplace OS — paste this entire file into the Supabase SQL Editor.
-- Do not paste the filename. Run once; it is safe to run again.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'intern' CHECK (role IN ('admin', 'manager', 'team_lead', 'employee', 'intern')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
    password_hash TEXT NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mail_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_active_email_address UNIQUE (email_address)
);

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
    folder TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'drafts', 'trash', 'archive')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_provider_message UNIQUE (owner_user_id, provider_message_id)
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS rfc_message_id TEXT
  GENERATED ALWAYS AS (lower(provider_metadata->>'rfcMessageId')) STORED;

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    provider_attachment_id TEXT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    size BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    content_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  head_id TEXT,
  head_name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  employee_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL DEFAULT '',
  leader_id TEXT NOT NULL,
  leader_name TEXT NOT NULL DEFAULT '',
  member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT DEFAULT '',
  created_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  department_id TEXT NOT NULL,
  department_name TEXT NOT NULL DEFAULT '',
  group_id TEXT,
  group_name TEXT,
  is_group_leader BOOLEAN NOT NULL DEFAULT FALSE,
  designation TEXT NOT NULL,
  tagline TEXT,
  personal_email TEXT,
  joining_date TEXT NOT NULL,
  manager_id TEXT,
  manager_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  leave_balances JSONB NOT NULL DEFAULT '{"casual":12,"sick":10,"annual":15,"unpaid":0}'::jsonb,
  created_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  punch_time TEXT,
  notes TEXT DEFAULT '',
  marked_by_id TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL DEFAULT '',
  department_name TEXT NOT NULL DEFAULT '',
  group_id TEXT,
  group_name TEXT,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days_count INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT 'event',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  attendee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  color TEXT NOT NULL DEFAULT 'slate',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT NOT NULL DEFAULT '',
  assigned_to_id TEXT NOT NULL,
  assigned_to_name TEXT NOT NULL DEFAULT '',
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL DEFAULT '',
  activity JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

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
CREATE INDEX IF NOT EXISTS idx_messages_rfc_message_id ON messages (owner_user_id, rfc_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_provider_owner ON messages (owner_user_id, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_group ON employees(group_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','mail_aliases','messages','attachments','audit_logs','sync_checkpoints',
    'app_settings','departments','groups','employees','attendance_records','leave_requests',
    'notices','schedule_events','notes','tasks','notifications','push_subscriptions','rate_limits'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE %I TO service_role', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

