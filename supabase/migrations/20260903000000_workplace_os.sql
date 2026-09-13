-- Cruvels Workplace OS — full schema on top of the original mail tables.
-- Idempotent. Service-role access from the Next.js API and the mail worker.
-- Anon/authenticated have no table grants; the portal uses its own JWT.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Widen role beyond the original admin|intern enum
ALTER TABLE IF EXISTS users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE IF EXISTS users ALTER COLUMN role TYPE TEXT USING role::text;
ALTER TABLE IF EXISTS users ALTER COLUMN role SET DEFAULT 'intern';
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE IF EXISTS users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'team_lead', 'employee', 'intern'));

ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS rfc_message_id TEXT
  GENERATED ALWAYS AS (lower(provider_metadata->>'rfcMessageId')) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_rfc_message_id ON messages (owner_user_id, rfc_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_provider_owner ON messages (owner_user_id, provider_message_id);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_group ON employees(group_id);

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
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

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
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leave_requests(employee_id, status);

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
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

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
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to_id);

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
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

-- Sync lock helper: steal a stale running lock after 2 minutes
ALTER TABLE IF EXISTS sync_checkpoints ADD COLUMN IF NOT EXISTS last_history_id TEXT;
ALTER TABLE IF EXISTS sync_checkpoints ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- RLS on for every table; service_role bypasses RLS. Anon gets nothing.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','mail_aliases','messages','attachments','audit_logs','sync_checkpoints',
    'app_settings','departments','groups','employees','attendance_records','leave_requests',
    'notices','schedule_events','notes','tasks','notifications','push_subscriptions'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', t);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;
