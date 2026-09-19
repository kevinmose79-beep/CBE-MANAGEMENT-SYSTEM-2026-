import { describe, it, expect } from 'vitest';
import { initialAcademicYears, initialTerms } from '../data/seedData';
import {
  SUPABASE_PART4,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_QUICK_MIGRATIONS,
} from '../lib/supabaseSql';
import { api } from '../lib/storage';

describe('Phase 3 — Initial Academic Year & School Term Seed Migration Audit', () => {
  it('1. Verifies exact Academic Year seed definitions in seedData.ts and migration SQL', () => {
    // 2025: Archived
    const ay2025 = initialAcademicYears.find((y) => y.year === 2025);
    expect(ay2025).toBeDefined();
    expect(ay2025?.status).toBe('Archived');

    // 2026: Active
    const ay2026 = initialAcademicYears.find((y) => y.year === 2026);
    expect(ay2026).toBeDefined();
    expect(ay2026?.status).toBe('Active');

    // 2027: Upcoming
    const ay2027 = initialAcademicYears.find((y) => y.year === 2027);
    expect(ay2027).toBeDefined();
    expect(ay2027?.status).toBe('Upcoming');

    // Verify SQL contains exact Academic Year insertions
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("INSERT INTO public.academic_years (year, status, start_date, end_date)");
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("(2025, 'Archived', '2025-01-01', '2025-12-31')");
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("(2026, 'Active', '2026-01-01', '2026-12-31')");
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("(2027, 'Upcoming', '2027-01-01', '2027-12-31')");
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("ON CONFLICT (year) DO UPDATE SET");
  });

  it('2. Verifies exact School Term seed definitions in seedData.ts and migration SQL', () => {
    // Check 2025 terms
    const t2025_1 = initialTerms.find((t) => t.year === 2025 && t.term_name === 'Term 1');
    expect(t2025_1).toBeDefined();
    expect(t2025_1?.status).toBe('Archived');
    expect(t2025_1?.opening_date).toBe('2025-01-08');
    expect(t2025_1?.closing_date).toBe('2025-04-11');

    const t2025_2 = initialTerms.find((t) => t.year === 2025 && t.term_name === 'Term 2');
    expect(t2025_2).toBeDefined();
    expect(t2025_2?.status).toBe('Archived');
    expect(t2025_2?.opening_date).toBe('2025-05-05');
    expect(t2025_2?.closing_date).toBe('2025-08-08');

    const t2025_3 = initialTerms.find((t) => t.year === 2025 && t.term_name === 'Term 3');
    expect(t2025_3).toBeDefined();
    expect(t2025_3?.status).toBe('Archived');
    expect(t2025_3?.opening_date).toBe('2025-09-01');
    expect(t2025_3?.closing_date).toBe('2025-11-21');

    // Check 2026 terms
    const t2026_1 = initialTerms.find((t) => t.year === 2026 && t.term_name === 'Term 1');
    expect(t2026_1).toBeDefined();
    expect(t2026_1?.status).toBe('Closed');
    expect(t2026_1?.opening_date).toBe('2026-01-06');
    expect(t2026_1?.closing_date).toBe('2026-04-02');
    expect(t2026_1?.mid_term_opening_date).toBe('2026-02-25');
    expect(t2026_1?.mid_term_closing_date).toBe('2026-03-01');

    const t2026_2 = initialTerms.find((t) => t.year === 2026 && t.term_name === 'Term 2');
    expect(t2026_2).toBeDefined();
    expect(t2026_2?.status).toBe('Active');
    expect(t2026_2?.opening_date).toBe('2026-04-27');
    expect(t2026_2?.closing_date).toBe('2026-07-31');
    expect(t2026_2?.mid_term_opening_date).toBe('2026-06-24');
    expect(t2026_2?.mid_term_closing_date).toBe('2026-06-28');

    const t2026_3 = initialTerms.find((t) => t.year === 2026 && t.term_name === 'Term 3');
    expect(t2026_3).toBeDefined();
    expect(t2026_3?.status).toBe('Upcoming');
    expect(t2026_3?.opening_date).toBe('2026-08-24');
    expect(t2026_3?.closing_date).toBe('2026-10-23');

    // Verify SQL migration handles referential mapping to academic_years.id
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("INSERT INTO public.school_terms");
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("JOIN public.academic_years ay ON ay.year = v.year");
    expect(SUPABASE_QUICK_MIGRATIONS).toContain("ON CONFLICT (academic_year_id, term_name) DO UPDATE SET");
  });

  it('3. Verifies idempotency and status invariants in SUPABASE_SQL_SCHEMA', () => {
    expect(SUPABASE_SQL_SCHEMA).toContain("ON CONFLICT (year) DO UPDATE SET");
    expect(SUPABASE_SQL_SCHEMA).toContain("ON CONFLICT (academic_year_id, term_name) DO UPDATE SET");
    expect(SUPABASE_SQL_SCHEMA).toContain("(2026, 'Active', '2026-01-01', '2026-12-31')");
    expect(SUPABASE_SQL_SCHEMA).toContain("(2026, 'Term 2', 2, 'Active'");
  });

  it('4. Verifies read-only compatibility with existing storage layer api functions', () => {
    const years = api.getAcademicYears();
    expect(Array.isArray(years)).toBe(true);
    expect(years.length).toBeGreaterThanOrEqual(3);
    expect(years.map((y) => y.year)).toContain(2025);
    expect(years.map((y) => y.year)).toContain(2026);
    expect(years.map((y) => y.year)).toContain(2027);

    const terms = api.getSchoolTerms();
    expect(Array.isArray(terms)).toBe(true);
    expect(terms.length).toBeGreaterThanOrEqual(6);
    expect(terms.some((t) => t.year === 2026 && t.status === 'Active')).toBe(true);
  });

  it('5. Verifies existing examinations and marks remain intact and untouched', () => {
    const exams = api.getExaminations();
    expect(Array.isArray(exams)).toBe(true);
    exams.forEach((exam) => {
      expect(exam.id).toBeDefined();
      expect(typeof exam.year).toBe('number');
      expect(typeof exam.term).toBe('string');
    });

    const marks = api.getMarks();
    expect(Array.isArray(marks)).toBe(true);
    marks.forEach((mark) => {
      expect(mark.id).toBeDefined();
      expect(mark.exam_id).toBeDefined();
      expect(mark.student_id).toBeDefined();
    });
  });
});
