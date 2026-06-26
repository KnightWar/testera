-- =========================================================
-- Testera — Migration 003: Master Students & Group Management
-- =========================================================

-- Create Master Students table
CREATE TABLE IF NOT EXISTS master_students (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no      TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  group_name   TEXT NOT NULL DEFAULT 'General',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) on master_students
ALTER TABLE master_students ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for master_students
DROP POLICY IF EXISTS "admin_all_master_students" ON master_students;
CREATE POLICY "admin_all_master_students" ON master_students 
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "anon_read_master_students" ON master_students;
CREATE POLICY "anon_read_master_students" ON master_students 
  FOR SELECT TO anon USING (true);

-- Add group_name column to the existing students table to track groups within exams
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Update existing students to default to 'General' group if not set
UPDATE students SET group_name = 'General' WHERE group_name IS NULL;
