-- =========================================================
-- Testera — Proctored Exam Platform
-- Supabase Migration 001: Initial Schema
-- =========================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- EXAMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT NOT NULL,
  description             TEXT,
  duration_mins           INTEGER NOT NULL DEFAULT 60,
  start_at                TIMESTAMPTZ,
  end_at                  TIMESTAMPTZ,
  shuffle_questions       BOOLEAN NOT NULL DEFAULT true,
  show_score_immediately  BOOLEAN NOT NULL DEFAULT false,
  negative_marking        BOOLEAN NOT NULL DEFAULT false,
  negative_fraction       NUMERIC(4,2) DEFAULT 0.25,
  pool_size               INTEGER,   -- if set, serve only this many Qs from the bank
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- QUESTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  q_no            INTEGER NOT NULL,
  question        TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('MCQ','Subjective')),
  option_a        TEXT,
  option_b        TEXT,
  option_c        TEXT,
  option_d        TEXT,
  correct_answer  TEXT CHECK (correct_answer IN ('A','B','C','D') OR correct_answer IS NULL),
  max_marks       NUMERIC(5,2) NOT NULL DEFAULT 1,
  topic           TEXT,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  keywords        JSONB,   -- [{keyword: "CIA triad", marks: 1}, ...]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_id, q_no)
);

-- ─────────────────────────────────────────────
-- STUDENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  roll_no      TEXT NOT NULL,
  name         TEXT NOT NULL,
  access_code  TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_id, roll_no)
);

-- ─────────────────────────────────────────────
-- SESSIONS (one per student per exam)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id             UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_order      UUID[],          -- shuffled question IDs assigned at session start
  started_at          TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT false,
  tab_switches        INTEGER NOT NULL DEFAULT 0,
  fullscreen_exits    INTEGER NOT NULL DEFAULT 0,
  devtools_attempts   INTEGER NOT NULL DEFAULT 0,
  grace_expires_at    TIMESTAMPTZ,     -- crash recovery window
  webcam_consent      BOOLEAN,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, exam_id)
);

-- ─────────────────────────────────────────────
-- ANSWERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text   TEXT,                 -- chosen option letter for MCQ, prose for Subjective
  is_flagged    BOOLEAN NOT NULL DEFAULT false,
  auto_saved_at TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ,
  UNIQUE(session_id, question_id)
);

-- ─────────────────────────────────────────────
-- SCORES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  marks_awarded NUMERIC(5,2) NOT NULL DEFAULT 0,
  graded_by    TEXT NOT NULL DEFAULT 'auto' CHECK (graded_by IN ('auto','admin','ai')),
  ai_feedback  TEXT,
  graded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, question_id)
);

-- ─────────────────────────────────────────────
-- VIOLATION LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS violation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'tab_switch','fullscreen_exit','devtools_open',
    'right_click','copy_paste','keyboard_shortcut','idle','webcam_missing'
  )),
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- WEBCAM SNAPSHOTS (optional, infrastructure only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webcam_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,   -- Supabase Storage path
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- UPDATED_AT trigger helper
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exams_updated_at ON exams;
CREATE TRIGGER exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE exams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE students         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE webcam_snapshots ENABLE ROW LEVEL SECURITY;

-- Admins (authenticated Supabase users) can do everything
DROP POLICY IF EXISTS "admin_all_exams" ON exams;
CREATE POLICY "admin_all_exams"         ON exams            FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_questions" ON questions;
CREATE POLICY "admin_all_questions"     ON questions        FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_students" ON students;
CREATE POLICY "admin_all_students"      ON students         FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_sessions" ON sessions;
CREATE POLICY "admin_all_sessions"      ON sessions         FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_answers" ON answers;
CREATE POLICY "admin_all_answers"       ON answers          FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_scores" ON scores;
CREATE POLICY "admin_all_scores"        ON scores           FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_violations" ON violation_logs;
CREATE POLICY "admin_all_violations"    ON violation_logs   FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_all_webcam" ON webcam_snapshots;
CREATE POLICY "admin_all_webcam"        ON webcam_snapshots FOR ALL USING (auth.role() = 'authenticated');

-- Students (anon role) can read exams, questions, and students
DROP POLICY IF EXISTS "anon_read_exams" ON exams;
CREATE POLICY "anon_read_exams"         ON exams            FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_questions" ON questions;
CREATE POLICY "anon_read_questions"     ON questions        FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_students" ON students;
CREATE POLICY "anon_read_students"      ON students         FOR SELECT TO anon USING (true);

-- Students (anon role) can manage their sessions, answers, and logs
DROP POLICY IF EXISTS "anon_all_sessions" ON sessions;
CREATE POLICY "anon_all_sessions"       ON sessions         FOR ALL TO anon USING (true);

DROP POLICY IF EXISTS "anon_all_answers" ON answers;
CREATE POLICY "anon_all_answers"        ON answers          FOR ALL TO anon USING (true);

DROP POLICY IF EXISTS "anon_all_violations" ON violation_logs;
CREATE POLICY "anon_all_violations"    ON violation_logs   FOR ALL TO anon USING (true);

DROP POLICY IF EXISTS "anon_all_webcam" ON webcam_snapshots;
CREATE POLICY "anon_all_webcam"        ON webcam_snapshots FOR ALL TO anon USING (true);

-- ─────────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_questions_exam_id    ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_students_exam_id     ON students(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_id     ON sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_answers_session_id   ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_session_id    ON scores(session_id);
CREATE INDEX IF NOT EXISTS idx_violations_session   ON violation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_violations_occurred  ON violation_logs(occurred_at DESC);
