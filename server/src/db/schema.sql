CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'javascript',
  yjs_state BYTEA,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor',
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS classroom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'assessment',
  language TEXT NOT NULL DEFAULT 'python',
  problem_title TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  starter_code JSONB NOT NULL,
  test_cases JSONB NOT NULL,
  proctoring_enabled BOOLEAN NOT NULL DEFAULT true,
  inactivity_threshold_sec INTEGER NOT NULL DEFAULT 30,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_workspaces (
  id TEXT PRIMARY KEY,
  session_code TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'python',
  code TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  last_active_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  session_code TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  session_code TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  compilation_status TEXT NOT NULL,
  compile_error TEXT,
  passed_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100,
  execution_time_sec REAL NOT NULL,
  test_results JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);
