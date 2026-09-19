// CBE GENERATOR SYSTEM - SPLIT POSTGRESQL SCHEMAS

// Part 1: Base Core Entities
export const SUPABASE_PART1 = `-- PART 1: EXTENSIONS & BASE ENTITIES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SCHOOL PROFILE
CREATE TABLE IF NOT EXISTS public.school_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name TEXT NOT NULL,
  county TEXT NOT NULL,
  address TEXT,
  email TEXT,
  motto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'class_teacher', 'subject_teacher', 'learner')),
  teacher_id UUID,
  student_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ADMINISTRATORS
CREATE TABLE IF NOT EXISTS public.administrators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  designation TEXT DEFAULT 'Administrator',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT NOT NULL,
  grade_level INTEGER NOT NULL DEFAULT 7,
  capacity INTEGER DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4.1. ACADEMIC YEARS
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Closed', 'Archived', 'Upcoming')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4.2. SCHOOL TERMS
CREATE TABLE IF NOT EXISTS public.school_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  year INTEGER NOT NULL,
  term_name TEXT NOT NULL CHECK (term_name IN ('Term 1', 'Term 2', 'Term 3')),
  term_number INTEGER NOT NULL CHECK (term_number IN (1, 2, 3)),
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Closed', 'Archived', 'Upcoming')),
  opening_date DATE NOT NULL,
  closing_date DATE NOT NULL,
  mid_term_opening_date DATE,
  mid_term_closing_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT school_terms_year_term_unique UNIQUE (academic_year_id, term_name)
);`;

// Part 2: Staff, Students, Streams & Subjects
export const SUPABASE_PART2 = `-- PART 2: STAFF, ACADEMIC STRUCTURE & STUDENTS

-- 5. TEACHERS
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  teacher_name TEXT NOT NULL,
  tsc_number TEXT UNIQUE,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  is_class_teacher BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. STREAMS
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_name TEXT NOT NULL,
  class_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  capacity INTEGER DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender CHAR(1) CHECK (gender IN ('M', 'F')),
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  dob DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7b. STUDENT PROMOTIONS (Authoritative historical progression records)
CREATE TABLE IF NOT EXISTS public.student_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_grade TEXT NOT NULL,
  to_grade TEXT NOT NULL,
  from_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  to_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  from_stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  to_stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  from_year INTEGER,
  from_term TEXT,
  to_year INTEGER,
  to_term TEXT,
  date_promoted TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  promoted_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_promotions_student_id ON public.student_promotions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_date_promoted ON public.student_promotions(date_promoted);
CREATE INDEX IF NOT EXISTS idx_student_promotions_academic_year_id ON public.student_promotions(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_from_class_id ON public.student_promotions(from_class_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_to_class_id ON public.student_promotions(to_class_id);

-- 8. SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_name TEXT NOT NULL,
  subject_code TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'Core',
  department TEXT,
  learning_area TEXT,
  education_level TEXT,
  applicable_grades TEXT[],
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TEACHER SUBJECTS
CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(teacher_id, subject_id, class_id, stream_id)
);`;

// Part 3: Examinations, Marks & Report Cards
export const SUPABASE_PART3 = `-- PART 3: EXAMINATIONS, MARKS & REPORT CARDS

-- 10. EXAMINATIONS
CREATE TABLE IF NOT EXISTS public.examinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_name TEXT NOT NULL,
  term TEXT NOT NULL,
  year INTEGER DEFAULT 2026,
  academic_year_id UUID,
  term_id UUID,
  class_id UUID,
  education_level TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Provisional', 'Approved', 'Archived')),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('CAT', 'Mid-Term', 'End-Term', 'Custom')),
  max_marks INTEGER DEFAULT 100,
  weightage NUMERIC(5,2) DEFAULT 100.0,
  approved_levels TEXT[] DEFAULT '{}',
  approved_classes TEXT[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Schema Migration: Ensure all columns exist if the examinations table was previously created
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_levels TEXT[] DEFAULT '{}';
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_classes TEXT[] DEFAULT '{}';
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2026;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS academic_year_id UUID;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS term_id UUID;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS class_id UUID;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS education_level TEXT;

-- 11. EXAMINATION SUBJECTS
CREATE TABLE IF NOT EXISTS public.examination_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  max_score NUMERIC(5,2) DEFAULT 100.0,
  pass_mark NUMERIC(5,2) DEFAULT 40.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(exam_id, subject_id)
);

-- 12. MARKS
CREATE TABLE IF NOT EXISTS public.marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  marks NUMERIC(5,2) CHECK (marks >= 0 AND marks <= 100),
  entered_by_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, subject_id, exam_id)
);

-- 12B. MARK RESOLUTIONS (T-11 Authorised Y Resolution Provenance)
CREATE TABLE IF NOT EXISTS public.mark_resolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mark_id UUID NOT NULL REFERENCES public.marks(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  exam_id UUID NOT NULL REFERENCES public.examinations(id) ON DELETE RESTRICT,
  original_status TEXT NOT NULL DEFAULT 'Y' CHECK (original_status = 'Y'),
  original_irregularity_reason TEXT NOT NULL,
  original_raw_score NUMERIC(5,2),
  replacement_score NUMERIC(5,2) NOT NULL CHECK (replacement_score >= 0),
  out_of NUMERIC(5,2) NOT NULL CHECK (out_of > 0),
  replacement_percentage NUMERIC(5,2) NOT NULL CHECK (replacement_percentage >= 0 AND replacement_percentage <= 100),
  resolution_reason TEXT NOT NULL,
  resolved_by TEXT NOT NULL,
  resolved_by_user_id UUID NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(mark_id)
);

CREATE INDEX IF NOT EXISTS idx_mark_resolutions_mark_id ON public.mark_resolutions(mark_id);
CREATE INDEX IF NOT EXISTS idx_mark_resolutions_student_exam ON public.mark_resolutions(student_id, exam_id);

-- Automatic server-side updated_at trigger for public.marks (Issue 7 Realtime Prerequisite)
CREATE OR REPLACE FUNCTION public.update_cbe_marks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cbe_marks_updated_at ON public.marks;

CREATE TRIGGER trigger_update_cbe_marks_updated_at
BEFORE UPDATE ON public.marks
FOR EACH ROW
EXECUTE FUNCTION public.update_cbe_marks_updated_at();

-- Realtime Publication and Replica Identity Configuration for public.marks (Issue 7 Realtime Prerequisite)
ALTER TABLE public.marks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marks;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 13. REPORT CARDS
CREATE TABLE IF NOT EXISTS public.report_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  total_marks NUMERIC(7,2) NOT NULL,
  average_mark NUMERIC(5,2) NOT NULL,
  overall_grade TEXT NOT NULL,
  mean_grade_code TEXT,
  total_points INTEGER DEFAULT 0,
  class_rank INTEGER,
  stream_rank INTEGER,
  class_teacher_remarks TEXT,
  principal_remarks TEXT,
  attendance_present INTEGER DEFAULT 0,
  attendance_total INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, exam_id)
);`;

// Part 4: Rankings, Attendance, Audits, Indexes & RLS
export const SUPABASE_PART4 = `-- PART 4: MERIT LISTS, ATTENDANCE, AUDIT LOGS, INDEXES & RLS

-- 14. MERIT LISTS
CREATE TABLE IF NOT EXISTS public.merit_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  total_score NUMERIC(7,2) NOT NULL,
  average_score NUMERIC(5,2) NOT NULL,
  overall_grade TEXT NOT NULL,
  overall_points INTEGER DEFAULT 0,
  rank_position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(exam_id, student_id)
);

-- 15. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Excused')),
  remarks TEXT,
  recorded_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, attendance_date)
);

-- 16. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_email TEXT,
  action_type TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. CBE GRADES CONFIGURATION
CREATE TABLE IF NOT EXISTS public.cbe_grades (
  id TEXT PRIMARY KEY,
  grade_code TEXT NOT NULL,
  performance_level TEXT NOT NULL,
  minimum_score NUMERIC(5,2) NOT NULL,
  maximum_score NUMERIC(5,2) NOT NULL,
  minimum_marks NUMERIC(5,2),
  maximum_marks NUMERIC(5,2),
  points INTEGER NOT NULL,
  descriptor TEXT,
  remarks TEXT,
  grade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_stream ON public.students(stream_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_exam ON public.marks(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON public.marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_student_exam ON public.report_cards(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_merit_lists_exam ON public.merit_lists(exam_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cbe_grades_points ON public.cbe_grades(points DESC);
CREATE INDEX IF NOT EXISTS idx_academic_years_year ON public.academic_years(year);
CREATE INDEX IF NOT EXISTS idx_academic_years_status ON public.academic_years(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_single_active ON public.academic_years(status) WHERE (status = 'Active');
CREATE INDEX IF NOT EXISTS idx_school_terms_academic_year_id ON public.school_terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_school_terms_status ON public.school_terms(status);
CREATE INDEX IF NOT EXISTS idx_school_terms_year_term ON public.school_terms(year, term_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_terms_single_active_per_year ON public.school_terms(academic_year_id) WHERE (status = 'Active');

-- GRANT SCHEMA AND TABLE PERMISSIONS (REMEDIATED BASE PRIVILEGES)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Anon role: Allow reading public school profile & CBE grades configuration
GRANT SELECT ON public.school_profile TO anon;
GRANT SELECT ON public.cbe_grades TO anon;
GRANT SELECT ON public.academic_years TO anon;
GRANT SELECT ON public.school_terms TO anon;

-- Authenticated role: Specific DML table and sequence permissions for logged-in users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Service Role: Full administrative backend access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.school_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merit_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbe_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS FOR SAFE RLS EVALUATION (SECURITY DEFINER to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE(auth.jwt()->>'role', '') = 'admin'
    OR COALESCE(auth.jwt()->>'user_metadata', '')::jsonb->>'role' = 'admin'
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE (id = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', '')))
      AND role = 'admin'
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_id
  FROM public.users
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_teacher_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_id() TO authenticated, service_role;

-- ATOMIC TEACHER DELETION RPC FUNCTION
CREATE OR REPLACE FUNCTION public.delete_teacher_atomic(
  p_teacher_id TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID := NULL;
  v_user_id UUID := NULL;
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_found_teacher_id UUID;
  v_found_user_id UUID;
  v_found_email TEXT;
BEGIN
  IF p_teacher_id IS NOT NULL AND p_teacher_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_teacher_id := p_teacher_id::UUID;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_user_id := p_user_id::UUID;
  END IF;

  -- 1. Locate teacher and user records
  IF v_teacher_id IS NOT NULL THEN
    SELECT id, user_id, email INTO v_found_teacher_id, v_found_user_id, v_found_email
    FROM public.teachers
    WHERE id = v_teacher_id;
  END IF;

  IF v_found_teacher_id IS NULL AND v_email <> '' THEN
    SELECT id, user_id, email INTO v_found_teacher_id, v_found_user_id, v_found_email
    FROM public.teachers
    WHERE LOWER(email) = v_email;
  END IF;

  IF v_found_teacher_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id, user_id, email INTO v_found_teacher_id, v_found_user_id, v_found_email
    FROM public.teachers
    WHERE user_id = v_user_id;
  END IF;

  IF v_found_user_id IS NULL AND v_found_teacher_id IS NOT NULL THEN
    SELECT id, email INTO v_found_user_id, v_found_email
    FROM public.users
    WHERE teacher_id = v_found_teacher_id;
  END IF;

  IF v_found_user_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id, email INTO v_found_user_id, v_found_email
    FROM public.users
    WHERE id = v_user_id;
  END IF;

  IF v_found_user_id IS NULL AND v_email <> '' THEN
    SELECT id, email INTO v_found_user_id, v_found_email
    FROM public.users
    WHERE LOWER(email) = v_email;
  END IF;

  -- Idempotency check: if no record is found in teachers or users
  IF v_found_teacher_id IS NULL AND v_found_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_deleted', true,
      'message', 'Teacher account already deleted or does not exist.'
    );
  END IF;

  -- 2. Delete teacher_subjects allocations
  IF v_found_teacher_id IS NOT NULL THEN
    DELETE FROM public.teacher_subjects WHERE teacher_id = v_found_teacher_id;
  END IF;

  -- 3. Clear class_teacher_id on streams
  IF v_found_teacher_id IS NOT NULL THEN
    UPDATE public.streams SET class_teacher_id = NULL WHERE class_teacher_id = v_found_teacher_id;
  END IF;

  -- 4. Delete from public.teachers
  IF v_found_teacher_id IS NOT NULL THEN
    DELETE FROM public.teachers WHERE id = v_found_teacher_id;
  END IF;
  IF v_found_email IS NOT NULL AND v_found_email <> '' THEN
    DELETE FROM public.teachers WHERE LOWER(email) = v_found_email;
  END IF;

  -- 5. Delete from public.users
  IF v_found_user_id IS NOT NULL THEN
    DELETE FROM public.users WHERE id = v_found_user_id;
  END IF;
  IF v_found_teacher_id IS NOT NULL THEN
    DELETE FROM public.users WHERE teacher_id = v_found_teacher_id;
  END IF;
  IF v_found_email IS NOT NULL AND v_found_email <> '' THEN
    DELETE FROM public.users WHERE LOWER(email) = v_found_email;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_deleted', false,
    'teacher_id', v_found_teacher_id,
    'user_id', v_found_user_id,
    'email', COALESCE(v_found_email, v_email)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_teacher_atomic(TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_teacher_atomic(TEXT, TEXT, TEXT) TO service_role;

-- ATOMIC TEACHER ALLOCATION UPDATE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.update_teacher_allocations_atomic(
  p_teacher_id TEXT,
  p_allocations JSONB DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_inserted_count INT := 0;
BEGIN
  -- 0. Server-side/Database-level RBAC check: only administrators or service_role can update teacher allocations
  IF NOT (
    public.is_admin() OR
    (auth.role() = 'service_role') OR
    (COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role')
  ) THEN
    RAISE EXCEPTION 'Access denied: Only administrators can update teacher subject allocations.';
  END IF;

  -- 1. Validate p_teacher_id UUID format
  IF p_teacher_id IS NULL OR NOT (p_teacher_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Invalid teacher_id UUID format: %', p_teacher_id;
  END IF;

  v_teacher_id := p_teacher_id::UUID;

  -- 2. Verify teacher exists
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
    RAISE EXCEPTION 'Teacher with ID % does not exist.', v_teacher_id;
  END IF;

  -- 3. Delete existing allocations for this teacher
  DELETE FROM public.teacher_subjects WHERE teacher_id = v_teacher_id;

  -- 4. Insert complete replacement allocation set if provided
  IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) = 'array' AND jsonb_array_length(p_allocations) > 0 THEN
    INSERT INTO public.teacher_subjects (teacher_id, subject_id, class_id, stream_id)
    SELECT DISTINCT
      v_teacher_id,
      (elem->>'subject_id')::UUID,
      CASE WHEN (elem->>'class_id') IS NOT NULL AND (elem->>'class_id') <> '' THEN (elem->>'class_id')::UUID ELSE NULL END,
      CASE WHEN (elem->>'stream_id') IS NOT NULL AND (elem->>'stream_id') <> '' THEN (elem->>'stream_id')::UUID ELSE NULL END
    FROM jsonb_array_elements(p_allocations) AS elem;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_teacher_id,
    'inserted_count', v_inserted_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_teacher_allocations_atomic(TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_allocations_atomic(TEXT, JSONB) TO service_role, authenticated;

-- PERMISSIVE RLS POLICIES FOR FULL SYSTEM OPERATION
DROP POLICY IF EXISTS "Full access school_profile" ON public.school_profile;
CREATE POLICY "Public read school_profile" ON public.school_profile FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Admin write school_profile" ON public.school_profile FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access users" ON public.users;
DROP POLICY IF EXISTS "Users select policy" ON public.users;
DROP POLICY IF EXISTS "Users insert policy" ON public.users;
DROP POLICY IF EXISTS "Users update policy" ON public.users;
DROP POLICY IF EXISTS "Users delete policy" ON public.users;

CREATE POLICY "Users select policy" ON public.users FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "Users insert policy" ON public.users FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
  OR (id = auth.uid() AND role != 'admin')
);

CREATE POLICY "Users update policy" ON public.users FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR id = auth.uid()
) WITH CHECK (
  public.is_admin()
  OR (
    id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND (teacher_id IS NOT DISTINCT FROM (SELECT teacher_id FROM public.users WHERE id = auth.uid()))
    AND (student_id IS NOT DISTINCT FROM (SELECT student_id FROM public.users WHERE id = auth.uid()))
  )
);

CREATE POLICY "Users delete policy" ON public.users FOR DELETE TO authenticated USING (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access administrators" ON public.administrators;
DROP POLICY IF EXISTS "Administrators select policy" ON public.administrators;
DROP POLICY IF EXISTS "Administrators write policy" ON public.administrators;

CREATE POLICY "Administrators select policy" ON public.administrators FOR SELECT TO authenticated USING (
  public.is_admin()
);
CREATE POLICY "Administrators write policy" ON public.administrators FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers select policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers insert policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers update policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers delete policy" ON public.teachers;

CREATE POLICY "Teachers select policy" ON public.teachers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers insert policy" ON public.teachers FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Teachers update policy" ON public.teachers FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR user_id = auth.uid()
) WITH CHECK (
  public.is_admin()
  OR (
    user_id = auth.uid()
    AND is_class_teacher = (SELECT is_class_teacher FROM public.teachers WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Teachers delete policy" ON public.teachers FOR DELETE TO authenticated USING (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access students" ON public.students;
DROP POLICY IF EXISTS "Admin full access students" ON public.students;
DROP POLICY IF EXISTS "Teacher select assigned students" ON public.students;
DROP POLICY IF EXISTS "Teacher insert primary students" ON public.students;
DROP POLICY IF EXISTS "Teacher update primary students" ON public.students;
DROP POLICY IF EXISTS "Teacher delete primary students" ON public.students;

CREATE POLICY "Admin full access students" ON public.students FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Class Teacher select roster" ON public.students FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
        OR st.class_id = students.class_id
        OR EXISTS (SELECT 1 FROM public.streams other_st WHERE other_st.id = students.stream_id AND other_st.class_id = st.class_id)
      )
    )
  )
);

CREATE POLICY "Class Teacher insert roster" ON public.students FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
);

CREATE POLICY "Class Teacher update roster" ON public.students FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
);

CREATE POLICY "Teacher select assigned students" ON public.students FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
    WHERE u.id = auth.uid() AND (
      (ts.class_id = students.class_id AND ts.stream_id IS NULL) OR 
      (ts.stream_id = students.stream_id AND ts.class_id IS NULL) OR
      (ts.class_id = students.class_id AND ts.stream_id = students.stream_id)
    )
  )
);

DROP POLICY IF EXISTS "Learner select own record" ON public.students;
CREATE POLICY "Learner select own record" ON public.students FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'learner'
      AND u.student_id = students.id
  )
);

-- Secure view for subject teachers to access their allocated students for marks entry
CREATE OR REPLACE VIEW public.allocated_students WITH (security_invoker = true) AS
SELECT s.id, s.admission_number, s.full_name, s.gender, s.class_id, s.stream_id, s.active, s.education_level, s.grade, s.dob
FROM public.students s
WHERE EXISTS (
  SELECT 1 FROM public.teachers t
  JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
  JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
  WHERE u.id = auth.uid() AND (u.role = 'subject_teacher' OR u.role = 'class_teacher')
  AND (
    (ts.class_id = s.class_id AND ts.stream_id IS NULL) OR 
    (ts.stream_id = s.stream_id AND ts.class_id IS NULL) OR
    (ts.class_id = s.class_id AND ts.stream_id = s.stream_id)
  )
);

GRANT SELECT ON public.allocated_students TO authenticated;

DROP POLICY IF EXISTS "Full access classes" ON public.classes;
DROP POLICY IF EXISTS "Classes select policy" ON public.classes;
DROP POLICY IF EXISTS "Classes write policy" ON public.classes;
CREATE POLICY "Classes select policy" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Classes write policy" ON public.classes FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access student_promotions" ON public.student_promotions;
DROP POLICY IF EXISTS "Allow authenticated read student_promotions" ON public.student_promotions;
DROP POLICY IF EXISTS "Public read student_promotions" ON public.student_promotions;
DROP POLICY IF EXISTS "Admin write student_promotions" ON public.student_promotions;

CREATE POLICY "Allow authenticated read student_promotions" ON public.student_promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read student_promotions" ON public.student_promotions FOR SELECT TO anon, public USING (true);
CREATE POLICY "Admin write student_promotions" ON public.student_promotions FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access streams" ON public.streams;
DROP POLICY IF EXISTS "Streams select policy" ON public.streams;
DROP POLICY IF EXISTS "Streams write policy" ON public.streams;
CREATE POLICY "Streams select policy" ON public.streams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Streams write policy" ON public.streams FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access subjects" ON public.subjects;
DROP POLICY IF EXISTS "Subjects select policy" ON public.subjects;
DROP POLICY IF EXISTS "Subjects write policy" ON public.subjects;
CREATE POLICY "Subjects select policy" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Subjects write policy" ON public.subjects FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access teacher_subjects" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Teacher_subjects select policy" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Teacher_subjects write policy" ON public.teacher_subjects;
CREATE POLICY "Teacher_subjects select policy" ON public.teacher_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teacher_subjects write policy" ON public.teacher_subjects FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access examinations" ON public.examinations;
DROP POLICY IF EXISTS "Examinations select policy" ON public.examinations;
DROP POLICY IF EXISTS "Examinations write policy" ON public.examinations;
DROP POLICY IF EXISTS "Examinations insert policy" ON public.examinations;
DROP POLICY IF EXISTS "Examinations update policy" ON public.examinations;
DROP POLICY IF EXISTS "Examinations delete policy" ON public.examinations;

CREATE POLICY "Examinations select policy" ON public.examinations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Examinations insert policy" ON public.examinations FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Examinations update policy" ON public.examinations FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.teachers t ON (t.user_id = u.id OR u.teacher_id = t.id)
    JOIN public.streams st ON st.class_teacher_id = t.id
    WHERE u.id = auth.uid() AND u.role = 'class_teacher'
  )
) WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.teachers t ON (t.user_id = u.id OR u.teacher_id = t.id)
    JOIN public.streams st ON st.class_teacher_id = t.id
    WHERE u.id = auth.uid() AND u.role = 'class_teacher'
  )
);

CREATE POLICY "Examinations delete policy" ON public.examinations FOR DELETE TO authenticated USING (
  public.is_admin()
);

-- Defense-in-Depth Database Trigger for Class Teacher Examination Stream Approval
CREATE OR REPLACE FUNCTION public.enforce_examination_class_teacher_stream_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_assigned_stream_ids TEXT[];
  v_added_streams TEXT[];
  v_removed_streams TEXT[];
BEGIN
  -- 1. Administrators and service_role have full authority
  IF public.is_admin()
     OR auth.role() = 'service_role'
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 2. Resolve authenticated class teacher
  SELECT t.id INTO v_teacher_id
  FROM public.users u
  JOIN public.teachers t ON (t.user_id = u.id OR u.teacher_id = t.id)
  WHERE u.id = auth.uid() AND u.role = 'class_teacher';

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only administrators and designated class teachers can modify examination approvals.';
  END IF;

  -- 3. Resolve all streams assigned to this teacher
  SELECT COALESCE(ARRAY_AGG(st.id::text), '{}'::TEXT[]) INTO v_assigned_stream_ids
  FROM public.streams st
  WHERE st.class_teacher_id = v_teacher_id;

  -- 4. Calculate added and removed stream delta
  SELECT COALESCE(ARRAY_AGG(elem), '{}'::TEXT[]) INTO v_added_streams
  FROM UNNEST(COALESCE(NEW.approved_classes, '{}'::TEXT[])) AS elem
  WHERE elem IS NOT NULL AND elem <> '' AND NOT (elem = ANY(COALESCE(OLD.approved_classes, '{}'::TEXT[])));

  SELECT COALESCE(ARRAY_AGG(elem), '{}'::TEXT[]) INTO v_removed_streams
  FROM UNNEST(COALESCE(OLD.approved_classes, '{}'::TEXT[])) AS elem
  WHERE elem IS NOT NULL AND elem <> '' AND NOT (elem = ANY(COALESCE(NEW.approved_classes, '{}'::TEXT[])));

  -- 5. Verify added streams belong to assigned streams
  IF array_length(v_added_streams, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM UNNEST(v_added_streams) AS stream_id
      WHERE NOT (stream_id = ANY(v_assigned_stream_ids))
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Class teachers may only approve examination streams currently assigned to them.';
    END IF;
  END IF;

  -- 6. Verify removed streams belong to assigned streams
  IF array_length(v_removed_streams, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM UNNEST(v_removed_streams) AS stream_id
      WHERE NOT (stream_id = ANY(v_assigned_stream_ids))
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Class teachers may only revoke approval for examination streams currently assigned to them.';
    END IF;
  END IF;

  -- 7. Ensure core examination properties are immutable for non-admin updates
  IF NEW.exam_name IS DISTINCT FROM OLD.exam_name
     OR NEW.term IS DISTINCT FROM OLD.term
     OR NEW.year IS DISTINCT FROM OLD.year
     OR NEW.academic_year_id IS DISTINCT FROM OLD.academic_year_id
     OR NEW.term_id IS DISTINCT FROM OLD.term_id
     OR NEW.class_id IS DISTINCT FROM OLD.class_id
     OR NEW.education_level IS DISTINCT FROM OLD.education_level
     OR NEW.exam_type IS DISTINCT FROM OLD.exam_type
     OR NEW.max_marks IS DISTINCT FROM OLD.max_marks
     OR NEW.weightage IS DISTINCT FROM OLD.weightage
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Class teachers are not permitted to modify core examination metadata.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_examination_class_teacher_stream_approval ON public.examinations;

CREATE TRIGGER trigger_enforce_examination_class_teacher_stream_approval
BEFORE UPDATE ON public.examinations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_examination_class_teacher_stream_approval();

DROP POLICY IF EXISTS "Full access examination_subjects" ON public.examination_subjects;
DROP POLICY IF EXISTS "Examination_subjects select policy" ON public.examination_subjects;
DROP POLICY IF EXISTS "Examination_subjects write policy" ON public.examination_subjects;

CREATE POLICY "Examination_subjects select policy" ON public.examination_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Examination_subjects write policy" ON public.examination_subjects FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access marks" ON public.marks;
DROP POLICY IF EXISTS "Marks select policy" ON public.marks;
DROP POLICY IF EXISTS "Marks write policy" ON public.marks;
DROP POLICY IF EXISTS "Marks insert policy" ON public.marks;
DROP POLICY IF EXISTS "Marks update policy" ON public.marks;
DROP POLICY IF EXISTS "Marks delete policy" ON public.marks;

CREATE POLICY "Marks select policy" ON public.marks FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
    JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
    WHERE s.id = marks.student_id
      AND ts.subject_id = marks.subject_id
      AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
      AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
    JOIN public.streams st ON (
      st.class_teacher_id = t.id
      AND (
        st.id = s.stream_id
        OR (s.stream_id IS NULL AND st.class_id = s.class_id)
        OR st.class_id = s.class_id
        OR EXISTS (SELECT 1 FROM public.streams other_st WHERE other_st.id = s.stream_id AND other_st.class_id = st.class_id)
      )
    )
    WHERE s.id = marks.student_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'learner'
      AND u.student_id = marks.student_id
  )
);

CREATE POLICY "Marks insert policy" ON public.marks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.examinations e
      WHERE e.id = marks.exam_id
        AND e.status NOT IN ('Approved', 'Archived')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
        JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
        WHERE s.id = marks.student_id
          AND ts.subject_id = marks.subject_id
          AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
          AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.streams st ON st.id = s.stream_id
        JOIN public.teachers t ON st.class_teacher_id = t.id
        WHERE s.id = marks.student_id
          AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
      )
    )
  )
);

CREATE POLICY "Marks update policy" ON public.marks FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.examinations e
      WHERE e.id = marks.exam_id
        AND e.status NOT IN ('Approved', 'Archived')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
        JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
        WHERE s.id = marks.student_id
          AND ts.subject_id = marks.subject_id
          AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
          AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.streams st ON st.id = s.stream_id
        JOIN public.teachers t ON st.class_teacher_id = t.id
        WHERE s.id = marks.student_id
          AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.examinations e
      WHERE e.id = marks.exam_id
        AND e.status NOT IN ('Approved', 'Archived')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
        JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
        WHERE s.id = marks.student_id
          AND ts.subject_id = marks.subject_id
          AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
          AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.streams st ON st.id = s.stream_id
        JOIN public.teachers t ON st.class_teacher_id = t.id
        WHERE s.id = marks.student_id
          AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
      )
    )
  )
);

CREATE POLICY "Marks delete policy" ON public.marks FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.examinations e
      WHERE e.id = marks.exam_id
        AND e.status NOT IN ('Approved', 'Archived')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
        JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
        WHERE s.id = marks.student_id
          AND ts.subject_id = marks.subject_id
          AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
          AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.streams st ON st.id = s.stream_id
        JOIN public.teachers t ON st.class_teacher_id = t.id
        WHERE s.id = marks.student_id
          AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
      )
    )
  )
);

DROP POLICY IF EXISTS "Full access report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Report_cards select policy" ON public.report_cards;
DROP POLICY IF EXISTS "Report_cards write policy" ON public.report_cards;

CREATE POLICY "Report_cards select policy" ON public.report_cards FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = report_cards.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);
CREATE POLICY "Report_cards write policy" ON public.report_cards FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = report_cards.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = report_cards.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Full access merit_lists" ON public.merit_lists;
DROP POLICY IF EXISTS "Merit_lists select policy" ON public.merit_lists;
DROP POLICY IF EXISTS "Merit_lists write policy" ON public.merit_lists;

CREATE POLICY "Merit_lists select policy" ON public.merit_lists FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = merit_lists.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);
CREATE POLICY "Merit_lists write policy" ON public.merit_lists FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Full access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Attendance select policy" ON public.attendance;
DROP POLICY IF EXISTS "Attendance write policy" ON public.attendance;

CREATE POLICY "Attendance select policy" ON public.attendance FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = attendance.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = attendance.recorded_by
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);
CREATE POLICY "Attendance write policy" ON public.attendance FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = attendance.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = attendance.recorded_by
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = attendance.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = attendance.recorded_by
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Full access audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit_logs select policy" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit_logs insert policy" ON public.audit_logs;

CREATE POLICY "Audit_logs select policy" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.is_admin()
);
CREATE POLICY "Audit_logs insert policy" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Full access cbe_grades" ON public.cbe_grades;
DROP POLICY IF EXISTS "Cbe_grades select policy" ON public.cbe_grades;
DROP POLICY IF EXISTS "Cbe_grades write policy" ON public.cbe_grades;

CREATE POLICY "Cbe_grades select policy" ON public.cbe_grades FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Cbe_grades write policy" ON public.cbe_grades FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

-- RLS POLICIES FOR ACADEMIC YEARS & SCHOOL TERMS (Phase 2 Architecture)
DROP POLICY IF EXISTS "Full access academic_years" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years select policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years write policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years insert policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years update policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years delete policy" ON public.academic_years;

CREATE POLICY "Academic_years select policy" ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Academic_years insert policy" ON public.academic_years FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Academic_years update policy" ON public.academic_years FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Academic_years delete policy" ON public.academic_years FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Full access school_terms" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms select policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms write policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms insert policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms update policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms delete policy" ON public.school_terms;

CREATE POLICY "School_terms select policy" ON public.school_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "School_terms insert policy" ON public.school_terms FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "School_terms update policy" ON public.school_terms FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "School_terms delete policy" ON public.school_terms FOR DELETE TO authenticated USING (public.is_admin());

-- INITIAL ACADEMIC YEARS & SCHOOL TERMS SEED DATA
INSERT INTO public.academic_years (year, status, start_date, end_date)
VALUES 
  (2025, 'Archived', '2025-01-01', '2025-12-31'),
  (2026, 'Active', '2026-01-01', '2026-12-31'),
  (2027, 'Upcoming', '2027-01-01', '2027-12-31')
ON CONFLICT (year) DO UPDATE SET
  status = EXCLUDED.status,
  start_date = COALESCE(EXCLUDED.start_date, public.academic_years.start_date),
  end_date = COALESCE(EXCLUDED.end_date, public.academic_years.end_date),
  updated_at = timezone('utc'::text, now());

INSERT INTO public.school_terms (
  academic_year_id,
  year,
  term_name,
  term_number,
  status,
  opening_date,
  closing_date,
  mid_term_opening_date,
  mid_term_closing_date
)
SELECT 
  ay.id,
  v.year,
  v.term_name,
  v.term_number,
  v.status,
  v.opening_date::date,
  v.closing_date::date,
  v.mid_term_opening_date::date,
  v.mid_term_closing_date::date
FROM (
  VALUES
    (2025, 'Term 1', 1, 'Archived', '2025-01-08', '2025-04-11', NULL, NULL),
    (2025, 'Term 2', 2, 'Archived', '2025-05-05', '2025-08-08', NULL, NULL),
    (2025, 'Term 3', 3, 'Archived', '2025-09-01', '2025-11-21', NULL, NULL),
    (2026, 'Term 1', 1, 'Closed', '2026-01-06', '2026-04-02', '2026-02-25', '2026-03-01'),
    (2026, 'Term 2', 2, 'Active', '2026-04-27', '2026-07-31', '2026-06-24', '2026-06-28'),
    (2026, 'Term 3', 3, 'Upcoming', '2026-08-24', '2026-10-23', NULL, NULL)
) AS v(year, term_name, term_number, status, opening_date, closing_date, mid_term_opening_date, mid_term_closing_date)
JOIN public.academic_years ay ON ay.year = v.year
ON CONFLICT (academic_year_id, term_name) DO UPDATE SET
  status = EXCLUDED.status,
  opening_date = EXCLUDED.opening_date,
  closing_date = EXCLUDED.closing_date,
  mid_term_opening_date = EXCLUDED.mid_term_opening_date,
  mid_term_closing_date = EXCLUDED.mid_term_closing_date,
  term_number = EXCLUDED.term_number,
  updated_at = timezone('utc'::text, now());

-- ==============================================================================
-- PHASE 3: OTA RELEASE AUTHORITY (app_releases & Supabase Storage)
-- ==============================================================================

-- 1. Create app_releases table
CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_version TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'production' CHECK (channel IN ('production', 'staging')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'DISABLED')),
  storage_bucket TEXT NOT NULL DEFAULT 'ota-releases' CHECK (length(trim(storage_bucket)) > 0),
  storage_path TEXT NOT NULL CHECK (length(trim(storage_path)) > 0),
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  bundle_size_bytes BIGINT NOT NULL CHECK (bundle_size_bytes > 0),
  min_native_version_code INTEGER NOT NULL DEFAULT 1 CHECK (min_native_version_code >= 1),
  max_native_version_code INTEGER CHECK (max_native_version_code IS NULL OR max_native_version_code >= min_native_version_code),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  release_notes TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_bundle_version_nonempty CHECK (length(trim(bundle_version)) > 0),
  CONSTRAINT app_releases_channel_version_unique UNIQUE (channel, bundle_version),
  CONSTRAINT check_published_metadata CHECK (
    status != 'PUBLISHED' OR (
      published_at IS NOT NULL AND
      length(trim(checksum_sha256)) = 64 AND
      bundle_size_bytes > 0 AND
      length(trim(storage_path)) > 0
    )
  )
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_app_releases_channel_status ON public.app_releases(channel, status);
CREATE INDEX IF NOT EXISTS idx_app_releases_bundle_version ON public.app_releases(bundle_version);
CREATE INDEX IF NOT EXISTS idx_app_releases_created_at ON public.app_releases(created_at DESC);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_app_releases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_releases_updated_at ON public.app_releases;
CREATE TRIGGER trg_app_releases_updated_at
  BEFORE UPDATE ON public.app_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_releases_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- 5. Revoke public/anonymous access
REVOKE ALL ON public.app_releases FROM PUBLIC, anon;

-- 6. Grant SELECT to authenticated, ALL to service_role
GRANT SELECT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

-- 7. RLS Policies on app_releases
DROP POLICY IF EXISTS "Authenticated read app_releases" ON public.app_releases;
CREATE POLICY "Authenticated read app_releases" ON public.app_releases
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin write app_releases" ON public.app_releases;
CREATE POLICY "Admin write app_releases" ON public.app_releases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. Storage bucket definition (ota-releases)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ota-releases',
  'ota-releases',
  false,
  104857600,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false;

-- 9. Storage object RLS policies
DROP POLICY IF EXISTS "Authenticated read ota-releases" ON storage.objects;
CREATE POLICY "Authenticated read ota-releases" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ota-releases');

DROP POLICY IF EXISTS "Admin write ota-releases" ON storage.objects;
CREATE POLICY "Admin write ota-releases" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ota-releases' AND public.is_admin())
  WITH CHECK (bucket_id = 'ota-releases' AND public.is_admin());

-- Final privileges grant for all created tables and sequences (REMEDIATED)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.school_profile TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
`;

export const SUPABASE_SQL_SCHEMA = `${SUPABASE_PART1}\n\n${SUPABASE_PART2}\n\n${SUPABASE_PART3}\n\n${SUPABASE_PART4}`;

export const SUPABASE_QUICK_MIGRATIONS = `-- QUICK SCHEMA MIGRATIONS / PATCHES
-- Run this in Supabase SQL Editor to ensure all recent columns (e.g. approved_levels) exist in your existing database:

ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_levels TEXT[] DEFAULT '{}';
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_classes TEXT[] DEFAULT '{}';
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2026;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS academic_year_id UUID;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS term_id UUID;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS class_id UUID;
ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS education_level TEXT;

-- Synchronise users_role_check constraint to include 'learner' role
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'class_teacher', 'subject_teacher', 'learner'));

-- Defense-in-Depth Database Trigger for Class Teacher Examination Stream Approval
CREATE OR REPLACE FUNCTION public.enforce_examination_class_teacher_stream_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_assigned_stream_ids TEXT[];
  v_added_streams TEXT[];
  v_removed_streams TEXT[];
BEGIN
  -- 1. Administrators and service_role have full authority
  IF public.is_admin()
     OR auth.role() = 'service_role'
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 2. Resolve authenticated class teacher
  SELECT t.id INTO v_teacher_id
  FROM public.users u
  JOIN public.teachers t ON (t.user_id = u.id OR u.teacher_id = t.id)
  WHERE u.id = auth.uid() AND u.role = 'class_teacher';

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only administrators and designated class teachers can modify examination approvals.';
  END IF;

  -- 3. Resolve all streams assigned to this teacher
  SELECT COALESCE(ARRAY_AGG(st.id::text), '{}'::TEXT[]) INTO v_assigned_stream_ids
  FROM public.streams st
  WHERE st.class_teacher_id = v_teacher_id;

  -- 4. Calculate added and removed stream delta
  SELECT COALESCE(ARRAY_AGG(elem), '{}'::TEXT[]) INTO v_added_streams
  FROM UNNEST(COALESCE(NEW.approved_classes, '{}'::TEXT[])) AS elem
  WHERE elem IS NOT NULL AND elem <> '' AND NOT (elem = ANY(COALESCE(OLD.approved_classes, '{}'::TEXT[])));

  SELECT COALESCE(ARRAY_AGG(elem), '{}'::TEXT[]) INTO v_removed_streams
  FROM UNNEST(COALESCE(OLD.approved_classes, '{}'::TEXT[])) AS elem
  WHERE elem IS NOT NULL AND elem <> '' AND NOT (elem = ANY(COALESCE(OLD.approved_classes, '{}'::TEXT[])));

  -- 5. Verify added streams belong to assigned streams
  IF array_length(v_added_streams, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM UNNEST(v_added_streams) AS stream_id
      WHERE NOT (stream_id = ANY(v_assigned_stream_ids))
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Class teachers may only approve examination streams currently assigned to them.';
    END IF;
  END IF;

  -- 6. Verify removed streams belong to assigned streams
  IF array_length(v_removed_streams, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM UNNEST(v_removed_streams) AS stream_id
      WHERE NOT (stream_id = ANY(v_assigned_stream_ids))
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Class teachers may only revoke approval for examination streams currently assigned to them.';
    END IF;
  END IF;

  -- 7. Ensure core examination properties are immutable for non-admin updates
  IF NEW.exam_name IS DISTINCT FROM OLD.exam_name
     OR NEW.term IS DISTINCT FROM OLD.term
     OR NEW.year IS DISTINCT FROM OLD.year
     OR NEW.academic_year_id IS DISTINCT FROM OLD.academic_year_id
     OR NEW.term_id IS DISTINCT FROM OLD.term_id
     OR NEW.class_id IS DISTINCT FROM OLD.class_id
     OR NEW.education_level IS DISTINCT FROM OLD.education_level
     OR NEW.exam_type IS DISTINCT FROM OLD.exam_type
     OR NEW.max_marks IS DISTINCT FROM OLD.max_marks
     OR NEW.weightage IS DISTINCT FROM OLD.weightage
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Class teachers are not permitted to modify core examination metadata.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_examination_class_teacher_stream_approval ON public.examinations;

CREATE TRIGGER trigger_enforce_examination_class_teacher_stream_approval
BEFORE UPDATE ON public.examinations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_examination_class_teacher_stream_approval();

-- Learner Self-Scoped RLS Policies on Students and Marks
DROP POLICY IF EXISTS "Learner select own record" ON public.students;
CREATE POLICY "Learner select own record" ON public.students FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'learner'
      AND u.student_id = students.id
  )
);

DROP POLICY IF EXISTS "Marks select policy" ON public.marks;
CREATE POLICY "Marks select policy" ON public.marks FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
    JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
    WHERE s.id = marks.student_id
      AND ts.subject_id = marks.subject_id
      AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
      AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
    JOIN public.streams st ON (
      st.class_teacher_id = t.id
      AND (
        st.id = s.stream_id
        OR (s.stream_id IS NULL AND st.class_id = s.class_id)
        OR st.class_id = s.class_id
        OR EXISTS (SELECT 1 FROM public.streams other_st WHERE other_st.id = s.stream_id AND other_st.class_id = st.class_id)
      )
    )
    WHERE s.id = marks.student_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'learner'
      AND u.student_id = marks.student_id
  )
);

-- Ensure general academic metadata is readable by authenticated users (including learners)
DROP POLICY IF EXISTS "Classes select policy" ON public.classes;
CREATE POLICY "Classes select policy" ON public.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Streams select policy" ON public.streams;
CREATE POLICY "Streams select policy" ON public.streams FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Subjects select policy" ON public.subjects;
CREATE POLICY "Subjects select policy" ON public.subjects FOR SELECT TO authenticated USING (true);

-- Learner Self-Scoped RLS for Report Cards
DROP POLICY IF EXISTS "Report_cards select policy" ON public.report_cards;
CREATE POLICY "Report_cards select policy" ON public.report_cards FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = report_cards.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'learner'
      AND u.student_id = report_cards.student_id
  )
);

-- Learner Self-Scoped RLS for Attendance
DROP POLICY IF EXISTS "Attendance select policy" ON public.attendance;
CREATE POLICY "Attendance select policy" ON public.attendance FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = attendance.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = attendance.recorded_by
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'learner'
      AND u.student_id = attendance.student_id
  )
);

-- PHASE 2: ACADEMIC YEARS & SCHOOL TERMS RELATIONAL FOUNDATION
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Closed', 'Archived', 'Upcoming')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.school_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  year INTEGER NOT NULL,
  term_name TEXT NOT NULL CHECK (term_name IN ('Term 1', 'Term 2', 'Term 3')),
  term_number INTEGER NOT NULL CHECK (term_number IN (1, 2, 3)),
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Closed', 'Archived', 'Upcoming')),
  opening_date DATE NOT NULL,
  closing_date DATE NOT NULL,
  mid_term_opening_date DATE,
  mid_term_closing_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT school_terms_year_term_unique UNIQUE (academic_year_id, term_name)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_year ON public.academic_years(year);
CREATE INDEX IF NOT EXISTS idx_academic_years_status ON public.academic_years(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_single_active ON public.academic_years(status) WHERE (status = 'Active');

CREATE INDEX IF NOT EXISTS idx_school_terms_academic_year_id ON public.school_terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_school_terms_status ON public.school_terms(status);
CREATE INDEX IF NOT EXISTS idx_school_terms_year_term ON public.school_terms(year, term_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_terms_single_active_per_year ON public.school_terms(academic_year_id) WHERE (status = 'Active');

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.academic_years TO anon;
GRANT SELECT ON public.school_terms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_terms TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
GRANT ALL ON public.school_terms TO service_role;

DROP POLICY IF EXISTS "Full access academic_years" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years select policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years write policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years insert policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years update policy" ON public.academic_years;
DROP POLICY IF EXISTS "Academic_years delete policy" ON public.academic_years;

CREATE POLICY "Academic_years select policy" ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Academic_years insert policy" ON public.academic_years FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Academic_years update policy" ON public.academic_years FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Academic_years delete policy" ON public.academic_years FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Full access school_terms" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms select policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms write policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms insert policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms update policy" ON public.school_terms;
DROP POLICY IF EXISTS "School_terms delete policy" ON public.school_terms;

CREATE POLICY "School_terms select policy" ON public.school_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "School_terms insert policy" ON public.school_terms FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "School_terms update policy" ON public.school_terms FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "School_terms delete policy" ON public.school_terms FOR DELETE TO authenticated USING (public.is_admin());

-- PHASE 3: INITIAL ACADEMIC YEARS & SCHOOL TERMS SEED MIGRATION
-- 1. Academic Years Seed
INSERT INTO public.academic_years (year, status, start_date, end_date)
VALUES 
  (2025, 'Archived', '2025-01-01', '2025-12-31'),
  (2026, 'Active', '2026-01-01', '2026-12-31'),
  (2027, 'Upcoming', '2027-01-01', '2027-12-31')
ON CONFLICT (year) DO UPDATE SET
  status = EXCLUDED.status,
  start_date = COALESCE(EXCLUDED.start_date, public.academic_years.start_date),
  end_date = COALESCE(EXCLUDED.end_date, public.academic_years.end_date),
  updated_at = timezone('utc'::text, now());

-- 2. School Terms Seed
INSERT INTO public.school_terms (
  academic_year_id,
  year,
  term_name,
  term_number,
  status,
  opening_date,
  closing_date,
  mid_term_opening_date,
  mid_term_closing_date
)
SELECT 
  ay.id,
  v.year,
  v.term_name,
  v.term_number,
  v.status,
  v.opening_date::date,
  v.closing_date::date,
  v.mid_term_opening_date::date,
  v.mid_term_closing_date::date
FROM (
  VALUES
    (2025, 'Term 1', 1, 'Archived', '2025-01-08', '2025-04-11', NULL, NULL),
    (2025, 'Term 2', 2, 'Archived', '2025-05-05', '2025-08-08', NULL, NULL),
    (2025, 'Term 3', 3, 'Archived', '2025-09-01', '2025-11-21', NULL, NULL),
    (2026, 'Term 1', 1, 'Closed', '2026-01-06', '2026-04-02', '2026-02-25', '2026-03-01'),
    (2026, 'Term 2', 2, 'Active', '2026-04-27', '2026-07-31', '2026-06-24', '2026-06-28'),
    (2026, 'Term 3', 3, 'Upcoming', '2026-08-24', '2026-10-23', NULL, NULL)
) AS v(year, term_name, term_number, status, opening_date, closing_date, mid_term_opening_date, mid_term_closing_date)
JOIN public.academic_years ay ON ay.year = v.year
ON CONFLICT (academic_year_id, term_name) DO UPDATE SET
  status = EXCLUDED.status,
  opening_date = EXCLUDED.opening_date,
  closing_date = EXCLUDED.closing_date,
  mid_term_opening_date = EXCLUDED.mid_term_opening_date,
  mid_term_closing_date = EXCLUDED.mid_term_closing_date,
  term_number = EXCLUDED.term_number,
  updated_at = timezone('utc'::text, now());

-- PHASE 4: STUDENT PROMOTIONS TABLE & POLICIES
CREATE TABLE IF NOT EXISTS public.student_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_grade TEXT NOT NULL,
  to_grade TEXT NOT NULL,
  from_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  to_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  from_stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  to_stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  from_year INTEGER,
  from_term TEXT,
  to_year INTEGER,
  to_term TEXT,
  date_promoted TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  promoted_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_promotions_student_id ON public.student_promotions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_date_promoted ON public.student_promotions(date_promoted);
CREATE INDEX IF NOT EXISTS idx_student_promotions_academic_year_id ON public.student_promotions(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_from_class_id ON public.student_promotions(from_class_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_to_class_id ON public.student_promotions(to_class_id);

ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_promotions TO authenticated;
GRANT SELECT ON public.student_promotions TO anon;
GRANT ALL ON public.student_promotions TO service_role;

DROP POLICY IF EXISTS "Full access student_promotions" ON public.student_promotions;
DROP POLICY IF EXISTS "Allow authenticated read student_promotions" ON public.student_promotions;
DROP POLICY IF EXISTS "Public read student_promotions" ON public.student_promotions;
DROP POLICY IF EXISTS "Admin write student_promotions" ON public.student_promotions;

CREATE POLICY "Allow authenticated read student_promotions" ON public.student_promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read student_promotions" ON public.student_promotions FOR SELECT TO anon, public USING (true);
CREATE POLICY "Admin write student_promotions" ON public.student_promotions FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

-- T-11 Mark Resolutions (Authorised Y Resolution Canonical Schema & Hardened Security)
CREATE TABLE IF NOT EXISTS public.mark_resolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mark_id UUID NOT NULL REFERENCES public.marks(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  exam_id UUID NOT NULL REFERENCES public.examinations(id) ON DELETE RESTRICT,
  original_status TEXT NOT NULL DEFAULT 'Y' CHECK (original_status = 'Y'),
  original_irregularity_reason TEXT NOT NULL,
  original_raw_score NUMERIC(5,2),
  replacement_score NUMERIC(5,2) NOT NULL CHECK (replacement_score >= 0),
  out_of NUMERIC(5,2) NOT NULL CHECK (out_of > 0),
  replacement_percentage NUMERIC(5,2) NOT NULL CHECK (replacement_percentage >= 0 AND replacement_percentage <= 100),
  resolution_reason TEXT NOT NULL,
  resolved_by TEXT NOT NULL,
  resolved_by_user_id UUID NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(mark_id)
);

CREATE INDEX IF NOT EXISTS idx_mark_resolutions_mark_id ON public.mark_resolutions(mark_id);
CREATE INDEX IF NOT EXISTS idx_mark_resolutions_student_exam ON public.mark_resolutions(student_id, exam_id);

ALTER TABLE public.mark_resolutions ENABLE ROW LEVEL SECURITY;

-- Revoke all direct write and anonymous access to maintain strictly immutable provenance
REVOKE ALL ON public.mark_resolutions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.mark_resolutions FROM authenticated;

-- Grant read-only access to authenticated users and full access to service_role
GRANT SELECT ON public.mark_resolutions TO authenticated;
GRANT ALL ON public.mark_resolutions TO service_role;

-- Drop obsolete or permissive legacy policies
DROP POLICY IF EXISTS "Allow authenticated read mark_resolutions" ON public.mark_resolutions;
DROP POLICY IF EXISTS "Public read mark_resolutions" ON public.mark_resolutions;
DROP POLICY IF EXISTS "Admin write mark_resolutions" ON public.mark_resolutions;
DROP POLICY IF EXISTS "Authenticated read mark_resolutions" ON public.mark_resolutions;

-- Hardened read policy: authenticated users may inspect resolution provenance
CREATE POLICY "Authenticated read mark_resolutions" ON public.mark_resolutions
  FOR SELECT TO authenticated USING (true);

-- Immutability enforcement on mark_resolutions (append-only provenance)
CREATE OR REPLACE FUNCTION public.prevent_mark_resolution_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Mark resolutions are permanent, immutable audit records and cannot be updated or deleted.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_mark_resolution_update ON public.mark_resolutions;
CREATE TRIGGER trigger_prevent_mark_resolution_update
BEFORE UPDATE OR DELETE ON public.mark_resolutions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_mark_resolution_mutation();

-- Bounds trigger on mark_resolutions
CREATE OR REPLACE FUNCTION public.check_mark_resolution_bounds()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.replacement_score < 0 THEN
    RAISE EXCEPTION 'Replacement score cannot be negative.' USING ERRCODE = '22023';
  END IF;
  IF NEW.out_of <= 0 THEN
    RAISE EXCEPTION 'out_of must be greater than zero.' USING ERRCODE = '22023';
  END IF;
  IF NEW.replacement_score > NEW.out_of THEN
    RAISE EXCEPTION 'Replacement score (%) cannot exceed assessment maximum (%).', NEW.replacement_score, NEW.out_of USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_mark_resolution_bounds ON public.mark_resolutions;
CREATE TRIGGER trigger_check_mark_resolution_bounds
BEFORE INSERT OR UPDATE ON public.mark_resolutions
FOR EACH ROW
EXECUTE FUNCTION public.check_mark_resolution_bounds();

-- Authorised Atomic Y Resolution Stored Procedure
CREATE OR REPLACE FUNCTION public.resolve_y_mark_atomic(
  p_mark_id UUID,
  p_replacement_score NUMERIC,
  p_resolution_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_is_admin BOOLEAN;
  v_mark RECORD;
  v_effective_out_of NUMERIC;
  v_replacement_percentage NUMERIC;
  v_resolver_name TEXT;
  v_resolution_id UUID;
  v_provenance JSONB;
  v_remarks JSONB;
  v_existing_status TEXT;
  v_existing_reason TEXT;
  v_existing_raw NUMERIC;
BEGIN
  -- 1. Authentication & Authorization
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT public.is_admin() INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Access denied. Only authorised administrators can resolve Y marks.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate inputs
  IF p_mark_id IS NULL THEN
    RAISE EXCEPTION 'Mark ID is required.' USING ERRCODE = '22023';
  END IF;

  IF p_replacement_score IS NULL OR p_replacement_score < 0 THEN
    RAISE EXCEPTION 'Replacement score must be a non-negative number.' USING ERRCODE = '22023';
  END IF;

  IF p_resolution_reason IS NULL OR trim(p_resolution_reason) = '' THEN
    RAISE EXCEPTION 'Resolution reason is required.' USING ERRCODE = '22023';
  END IF;

  -- 3. Lock and retrieve target mark
  SELECT * INTO v_mark FROM public.marks WHERE id = p_mark_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment mark not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Parse existing remarks
  BEGIN
    v_remarks := CASE 
      WHEN v_mark.remarks IS NULL OR trim(v_mark.remarks) = '' THEN '{}'::jsonb
      ELSE v_mark.remarks::jsonb
    END;
  EXCEPTION WHEN OTHERS THEN
    v_remarks := '{}'::jsonb;
  END;

  v_existing_status := COALESCE(v_remarks->>'special_status', 'Normal');
  v_existing_reason := COALESCE(v_remarks->>'irregularity_reason', 'Assessment Irregularity');
  v_existing_raw := CASE 
    WHEN (v_remarks->>'raw_score') IS NOT NULL AND (v_remarks->>'raw_score') ~ '^-?[0-9]+(\.[0-9]+)?$' 
    THEN (v_remarks->>'raw_score')::numeric 
    ELSE NULL 
  END;

  IF v_existing_status != 'Y' THEN
    RAISE EXCEPTION 'Target mark does not have an active Y status (current status: %).', v_existing_status USING ERRCODE = 'P0001';
  END IF;

  -- 4. Retrieve examination max marks
  SELECT max_marks INTO v_effective_out_of FROM public.examinations WHERE id = v_mark.exam_id;
  IF v_effective_out_of IS NULL OR v_effective_out_of <= 0 THEN
    RAISE EXCEPTION 'Authoritative assessment scale (max_marks) is missing or invalid for this examination.' USING ERRCODE = 'P0001';
  END IF;

  IF p_replacement_score > v_effective_out_of THEN
    RAISE EXCEPTION 'Replacement score (%) cannot exceed assessment maximum (%).', p_replacement_score, v_effective_out_of USING ERRCODE = '22023';
  END IF;

  v_replacement_percentage := ROUND((p_replacement_score / v_effective_out_of) * 100, 2);

  -- Retrieve resolver display name
  SELECT COALESCE(full_name, email, 'Administrator') INTO v_resolver_name FROM public.users WHERE id = v_uid;
  IF v_resolver_name IS NULL THEN
    v_resolver_name := 'Administrator';
  END IF;

  -- 5. Insert into public.mark_resolutions
  INSERT INTO public.mark_resolutions (
    mark_id,
    student_id,
    subject_id,
    exam_id,
    original_status,
    original_irregularity_reason,
    original_raw_score,
    replacement_score,
    out_of,
    replacement_percentage,
    resolution_reason,
    resolved_by,
    resolved_by_user_id,
    resolved_at,
    created_at
  ) VALUES (
    v_mark.id,
    v_mark.student_id,
    v_mark.subject_id,
    v_mark.exam_id,
    'Y',
    v_existing_reason,
    v_existing_raw,
    p_replacement_score,
    v_effective_out_of,
    v_replacement_percentage,
    trim(p_resolution_reason),
    v_resolver_name,
    v_uid,
    clock_timestamp(),
    clock_timestamp()
  )
  RETURNING id INTO v_resolution_id;

  -- Build provenance json
  v_provenance := jsonb_build_object(
    'id', v_resolution_id,
    'mark_id', v_mark.id,
    'student_id', v_mark.student_id,
    'subject_id', v_mark.subject_id,
    'exam_id', v_mark.exam_id,
    'original_status', 'Y',
    'original_irregularity_reason', v_existing_reason,
    'original_raw_score', v_existing_raw,
    'replacement_score', p_replacement_score,
    'out_of', v_effective_out_of,
    'replacement_percentage', v_replacement_percentage,
    'resolution_reason', trim(p_resolution_reason),
    'resolved_by', v_resolver_name,
    'resolved_by_user_id', v_uid,
    'resolved_at', clock_timestamp()
  );

  -- 6. Update marks
  v_remarks := jsonb_build_object(
    'raw_score', p_replacement_score,
    'out_of', v_effective_out_of,
    'special_status', 'Normal',
    'irregularity_reason', NULL,
    'resolution', v_provenance,
    'entered_by_teacher_id', v_remarks->>'entered_by_teacher_id'
  );

  UPDATE public.marks
  SET
    marks = v_replacement_percentage,
    remarks = v_remarks::text,
    updated_at = clock_timestamp()
  WHERE id = v_mark.id;

  -- 7. Insert audit_logs
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    action_type,
    entity_table,
    entity_id,
    details,
    created_at
  ) VALUES (
    v_uid,
    (SELECT email FROM public.users WHERE id = v_uid),
    'Y_RESOLUTION',
    'marks',
    v_mark.id,
    v_provenance::text,
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'resolution_id', v_resolution_id,
    'mark_id', v_mark.id,
    'replacement_score', p_replacement_score,
    'out_of', v_effective_out_of,
    'replacement_percentage', v_replacement_percentage,
    'provenance', v_provenance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_y_mark_atomic(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_y_mark_atomic(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- ==============================================================================
-- PHASE 3: OTA RELEASE AUTHORITY (app_releases & Supabase Storage)
-- ==============================================================================

-- 1. Create app_releases table
CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_version TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'production' CHECK (channel IN ('production', 'staging')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'DISABLED')),
  storage_bucket TEXT NOT NULL DEFAULT 'ota-releases' CHECK (length(trim(storage_bucket)) > 0),
  storage_path TEXT NOT NULL CHECK (length(trim(storage_path)) > 0),
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  bundle_size_bytes BIGINT NOT NULL CHECK (bundle_size_bytes > 0),
  min_native_version_code INTEGER NOT NULL DEFAULT 1 CHECK (min_native_version_code >= 1),
  max_native_version_code INTEGER CHECK (max_native_version_code IS NULL OR max_native_version_code >= min_native_version_code),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  release_notes TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_bundle_version_nonempty CHECK (length(trim(bundle_version)) > 0),
  CONSTRAINT app_releases_channel_version_unique UNIQUE (channel, bundle_version),
  CONSTRAINT check_published_metadata CHECK (
    status != 'PUBLISHED' OR (
      published_at IS NOT NULL AND
      length(trim(checksum_sha256)) = 64 AND
      bundle_size_bytes > 0 AND
      length(trim(storage_path)) > 0
    )
  )
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_app_releases_channel_status ON public.app_releases(channel, status);
CREATE INDEX IF NOT EXISTS idx_app_releases_bundle_version ON public.app_releases(bundle_version);
CREATE INDEX IF NOT EXISTS idx_app_releases_created_at ON public.app_releases(created_at DESC);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_app_releases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_releases_updated_at ON public.app_releases;
CREATE TRIGGER trg_app_releases_updated_at
  BEFORE UPDATE ON public.app_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_releases_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- 5. Revoke public/anonymous access
REVOKE ALL ON public.app_releases FROM PUBLIC, anon;

-- 6. Grant SELECT to authenticated, ALL to service_role
GRANT SELECT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

-- 7. RLS Policies on app_releases
DROP POLICY IF EXISTS "Authenticated read app_releases" ON public.app_releases;
CREATE POLICY "Authenticated read app_releases" ON public.app_releases
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin write app_releases" ON public.app_releases;
CREATE POLICY "Admin write app_releases" ON public.app_releases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. Storage bucket definition (ota-releases)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ota-releases',
  'ota-releases',
  false,
  104857600,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false;

-- 9. Storage object RLS policies
DROP POLICY IF EXISTS "Authenticated read ota-releases" ON storage.objects;
CREATE POLICY "Authenticated read ota-releases" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ota-releases');

DROP POLICY IF EXISTS "Admin write ota-releases" ON storage.objects;
CREATE POLICY "Admin write ota-releases" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ota-releases' AND public.is_admin())
  WITH CHECK (bucket_id = 'ota-releases' AND public.is_admin());

-- ATOMIC ACADEMIC YEAR ROLLOVER TRANSACTION-SAFE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.perform_academic_year_rollover()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_ay RECORD;
  v_target_ay RECORD;
  v_active_year INT;
  v_target_year INT;
  v_student RECORD;
  v_current_class RECORD;
  v_current_stream RECORD;
  v_target_grade TEXT;
  v_current_stream_name TEXT;
  v_promotions_count INT := 0;
  v_deactivations_count INT := 0;
  v_term1 RECORD;
  v_current_index INT;
  v_grades TEXT[] := ARRAY['Grade 7', 'Grade 8', 'Grade 9'];
  v_matching_stream RECORD;
  v_promo_exists BOOLEAN;
BEGIN
  -- 1. Acquire transaction-level advisory lock to serialize execution across all instances and requests
  PERFORM pg_advisory_xact_lock(20262027);

  -- 2. Fetch the current Active academic year
  SELECT * INTO v_active_ay FROM public.academic_years WHERE status = 'Active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active academic year found. Rollover cannot be performed.');
  END IF;

  v_active_year := v_active_ay.year;
  v_target_year := v_active_year + 1;

  -- 3. Check if target academic year already exists, or create it
  SELECT * INTO v_target_ay FROM public.academic_years WHERE year = v_target_year;
  IF NOT FOUND THEN
    INSERT INTO public.academic_years (year, status, start_date, end_date)
    VALUES (v_target_year, 'Upcoming', (v_target_year || '-01-01')::DATE, (v_target_year || '-12-31')::DATE)
    RETURNING * INTO v_target_ay;
  END IF;

  -- Double check: if target year is already Active, then rollover was already completed!
  IF v_target_ay.status = 'Active' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Academic year rollover to ' || v_target_year || ' was already completed.');
  END IF;

  -- 4. Process each active student
  FOR v_student IN 
    SELECT * FROM public.students WHERE active = true
  LOOP
    -- Fetch student's current class
    SELECT * INTO v_current_class FROM public.classes WHERE id = v_student.class_id;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Fetch current stream
    SELECT * INTO v_current_stream FROM public.streams WHERE id = v_student.stream_id;
    IF FOUND THEN
      v_current_stream_name := v_current_stream.stream_name;
    ELSE
      v_current_stream_name := 'Alpha';
    END IF;

    IF v_current_class.class_name = 'Grade 9' THEN
      -- Grade 9 deactivation
      -- Idempotency check: check if already deactivated or logged to avoid duplicate logging
      SELECT EXISTS(
        SELECT 1 FROM public.audit_logs 
        WHERE action = 'LEARNER_DEACTIVATED' 
        AND (details->>'student_id') = v_student.id::TEXT
        AND (details->>'reason') LIKE '%rollover%'
      ) INTO v_promo_exists;

      IF NOT v_promo_exists THEN
        -- Deactivate student
        UPDATE public.students 
        SET active = false, updated_at = NOW() 
        WHERE id = v_student.id;

        -- Disable associated user account (if any)
        UPDATE public.users 
        SET status = 'Disabled', updated_at = NOW() 
        WHERE student_id = v_student.id;

        -- Write deactivation audit log
        INSERT INTO public.audit_logs (action, details)
        VALUES ('LEARNER_DEACTIVATED', jsonb_build_object(
          'student_id', v_student.id,
          'admission_number', v_student.admission_number,
          'full_name', v_student.full_name,
          'reason', 'Automatic deactivation of final grade learners (Grade 9) at academic year rollover'
        ));

        v_deactivations_count := v_deactivations_count + 1;
      END IF;

    ELSE
      -- Continuing student promotion
      v_current_index := array_position(v_grades, v_current_class.class_name);
      IF v_current_index IS NULL OR v_current_index >= array_length(v_grades, 1) THEN
        CONTINUE;
      END IF;

      v_target_grade := v_grades[v_current_index + 1];

      -- IDEMPOTENCY CHECK: skip if student was already promoted for this transition
      SELECT EXISTS(
        SELECT 1 FROM public.student_promotions 
        WHERE student_id = v_student.id 
        AND from_year = v_active_year 
        AND to_year = v_target_year
      ) INTO v_promo_exists;

      IF v_promo_exists THEN
        CONTINUE;
      END IF;

      -- Find exact destination stream matching the student's current stream name (case-insensitive)
      SELECT s.id AS stream_id, s.class_id AS class_id INTO v_matching_stream
      FROM public.streams s
      JOIN public.classes c ON c.id = s.class_id
      WHERE c.class_name = v_target_grade
      AND LOWER(s.stream_name) = LOWER(v_current_stream_name);

      IF NOT FOUND THEN
        -- Stream fallback is REMOVED. Reject the entire transaction!
        RAISE EXCEPTION 'Promotion Error: Target stream % for grade % does not exist. Promotion is aborted to prevent arbitrary stream assignment.', v_current_stream_name, v_target_grade;
      END IF;

      -- Update student class and stream
      UPDATE public.students 
      SET class_id = v_matching_stream.class_id, 
          stream_id = v_matching_stream.stream_id, 
          updated_at = NOW()
      WHERE id = v_student.id;

      -- Record promotion
      INSERT INTO public.student_promotions (
        student_id, from_grade, to_grade, from_class_id, to_class_id, 
        from_stream_id, to_stream_id, academic_year_id, from_year, 
        from_term, to_year, to_term, promoted_by, date_promoted
      )
      VALUES (
        v_student.id, v_current_class.class_name, v_target_grade, v_student.class_id, v_matching_stream.class_id,
        v_student.stream_id, v_matching_stream.stream_id, v_active_ay.id, v_active_year,
        'Term 3', v_target_year, 'Term 1', 'System Rollover', NOW()
      );

      v_promotions_count := v_promotions_count + 1;
    END IF;
  END LOOP;

  -- 5. Transition Academic Year statuses
  UPDATE public.academic_years 
  SET status = 'Closed', updated_at = NOW() 
  WHERE id = v_active_ay.id;

  UPDATE public.academic_years 
  SET status = 'Active', updated_at = NOW() 
  WHERE id = v_target_ay.id;

  -- 6. Transition School Term statuses
  UPDATE public.school_terms 
  SET status = 'Closed', updated_at = NOW() 
  WHERE academic_year_id = v_active_ay.id 
  AND status = 'Active';

  -- Check if Term 1 already exists for target academic year
  SELECT * INTO v_term1 
  FROM public.school_terms 
  WHERE academic_year_id = v_target_ay.id 
  AND term_name = 'Term 1';

  IF FOUND THEN
    UPDATE public.school_terms 
    SET status = 'Active', updated_at = NOW() 
    WHERE id = v_term1.id;
  ELSE
    INSERT INTO public.school_terms (
      academic_year_id, year, term_name, term_number, status, opening_date, closing_date
    )
    VALUES (
      v_target_ay.id, v_target_year, 'Term 1', 1, 'Active', (v_target_year || '-01-05')::DATE, (v_target_year || '-04-10')::DATE
    );
  END IF;

  -- 7. Log completion
  INSERT INTO public.audit_logs (action, details)
  VALUES ('SYSTEM_ROLLOVER_COMPLETED', jsonb_build_object(
    'from_year', v_active_year,
    'to_year', v_target_year,
    'promotions_count', v_promotions_count,
    'deactivations_count', v_deactivations_count,
    'message', 'Academic Year Rollover completed successfully inside atomic PostgreSQL transaction.'
  ));

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Academic Year Rollover to ' || v_target_year || ' completed successfully. ' || v_promotions_count || ' promoted, ' || v_deactivations_count || ' deactivated.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Database Rollover Failure: %', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.perform_academic_year_rollover() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.perform_academic_year_rollover() TO authenticated, service_role;

-- Notify PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
`;
