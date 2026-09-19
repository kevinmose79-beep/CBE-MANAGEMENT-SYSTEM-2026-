import { describe, it, expect } from 'vitest';
import {
  SUPABASE_PART1,
  SUPABASE_PART4,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_QUICK_MIGRATIONS,
} from '../lib/supabaseSql';

describe('Phase 2 — Academic Year & School Term Database Provisioning Schema Audit', () => {
  it('1. Verifies public.academic_years table definition in SUPABASE_PART1 and SUPABASE_SQL_SCHEMA', () => {
    expect(SUPABASE_PART1).toContain('CREATE TABLE IF NOT EXISTS public.academic_years');
    expect(SUPABASE_PART1).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(SUPABASE_PART1).toContain('year INTEGER NOT NULL UNIQUE');
    expect(SUPABASE_PART1).toContain("status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Closed', 'Archived', 'Upcoming'))");
    expect(SUPABASE_PART1).toContain('start_date DATE');
    expect(SUPABASE_PART1).toContain('end_date DATE');
    expect(SUPABASE_PART1).toContain("created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL");
    expect(SUPABASE_PART1).toContain("updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL");

    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.academic_years');
  });

  it('2. Verifies public.school_terms table definition and ON DELETE RESTRICT in SUPABASE_PART1 and SUPABASE_SQL_SCHEMA', () => {
    expect(SUPABASE_PART1).toContain('CREATE TABLE IF NOT EXISTS public.school_terms');
    expect(SUPABASE_PART1).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(SUPABASE_PART1).toContain('academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT');
    expect(SUPABASE_PART1).toContain('year INTEGER NOT NULL');
    expect(SUPABASE_PART1).toContain("term_name TEXT NOT NULL CHECK (term_name IN ('Term 1', 'Term 2', 'Term 3'))");
    expect(SUPABASE_PART1).toContain('term_number INTEGER NOT NULL CHECK (term_number IN (1, 2, 3))');
    expect(SUPABASE_PART1).toContain("status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active', 'Closed', 'Archived', 'Upcoming'))");
    expect(SUPABASE_PART1).toContain('opening_date DATE NOT NULL');
    expect(SUPABASE_PART1).toContain('closing_date DATE NOT NULL');
    expect(SUPABASE_PART1).toContain('mid_term_opening_date DATE');
    expect(SUPABASE_PART1).toContain('mid_term_closing_date DATE');
    expect(SUPABASE_PART1).toContain('CONSTRAINT school_terms_year_term_unique UNIQUE (academic_year_id, term_name)');

    expect(SUPABASE_SQL_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS public.school_terms');
  });

  it('3. Verifies high-performance indexes and partial unique single-active indexes in SUPABASE_PART4', () => {
    expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_academic_years_year ON public.academic_years(year);');
    expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_academic_years_status ON public.academic_years(status);');
    expect(SUPABASE_PART4).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_single_active ON public.academic_years(status) WHERE (status = 'Active');");

    expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_school_terms_academic_year_id ON public.school_terms(academic_year_id);');
    expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_school_terms_status ON public.school_terms(status);');
    expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_school_terms_year_term ON public.school_terms(year, term_name);');
    expect(SUPABASE_PART4).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_school_terms_single_active_per_year ON public.school_terms(academic_year_id) WHERE (status = 'Active');");
  });

  it('4. Verifies RLS enablement and base role permissions in SUPABASE_PART4', () => {
    expect(SUPABASE_PART4).toContain('ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;');
    expect(SUPABASE_PART4).toContain('ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;');

    expect(SUPABASE_PART4).toContain('GRANT SELECT ON public.academic_years TO anon;');
    expect(SUPABASE_PART4).toContain('GRANT SELECT ON public.school_terms TO anon;');
    expect(SUPABASE_PART4).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;');
    expect(SUPABASE_PART4).toContain('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;');
  });

  it('5. Verifies RLS security policies for academic_years and school_terms', () => {
    // academic_years policies
    expect(SUPABASE_PART4).toContain('CREATE POLICY "Academic_years select policy" ON public.academic_years FOR SELECT TO authenticated USING (true);');
    expect(SUPABASE_PART4).toContain('CREATE POLICY "Academic_years insert policy" ON public.academic_years FOR INSERT TO authenticated WITH CHECK (public.is_admin());');
    expect(SUPABASE_PART4).toContain('CREATE POLICY "Academic_years update policy" ON public.academic_years FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());');
    expect(SUPABASE_PART4).toContain('CREATE POLICY "Academic_years delete policy" ON public.academic_years FOR DELETE TO authenticated USING (public.is_admin());');

    // school_terms policies
    expect(SUPABASE_PART4).toContain('CREATE POLICY "School_terms select policy" ON public.school_terms FOR SELECT TO authenticated USING (true);');
    expect(SUPABASE_PART4).toContain('CREATE POLICY "School_terms insert policy" ON public.school_terms FOR INSERT TO authenticated WITH CHECK (public.is_admin());');
    expect(SUPABASE_PART4).toContain('CREATE POLICY "School_terms update policy" ON public.school_terms FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());');
    expect(SUPABASE_PART4).toContain('CREATE POLICY "School_terms delete policy" ON public.school_terms FOR DELETE TO authenticated USING (public.is_admin());');
  });

  it('6. Verifies SUPABASE_QUICK_MIGRATIONS contains all Phase 2 DDL and RLS statements', () => {
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('CREATE TABLE IF NOT EXISTS public.academic_years');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('CREATE TABLE IF NOT EXISTS public.school_terms');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('ON DELETE RESTRICT');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('idx_academic_years_single_active');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('idx_school_terms_single_active_per_year');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('CREATE POLICY "Academic_years select policy" ON public.academic_years');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('CREATE POLICY "School_terms select policy" ON public.school_terms');
  });
});
