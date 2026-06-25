-- =========================================================
-- Testera — Migration 002: Exam-level access code
-- =========================================================

-- Add a single shared access code per exam
ALTER TABLE exams ADD COLUMN IF NOT EXISTS access_code TEXT;

-- Students no longer need individual access codes (exam code is shared)
-- Make the column nullable so existing rows are unaffected
ALTER TABLE students ALTER COLUMN access_code DROP NOT NULL;
ALTER TABLE students ALTER COLUMN access_code SET DEFAULT NULL;

-- Index for fast lookup by exam access code at login time
CREATE INDEX IF NOT EXISTS idx_exams_access_code ON exams(access_code);
