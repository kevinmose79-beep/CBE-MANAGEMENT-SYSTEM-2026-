import { describe, it, expect, beforeEach } from 'vitest';
import { api, isUUID, setStorage, KEYS } from '../lib/storage';
import { Examination, AcademicYear, SchoolTerm } from '../types';

describe('Phase 5 — Priority 1: Examination Relational Integrity & UUID Resolution', () => {
  const EXPECTED_2026_AY_UUID = '69ebb4c9-8f38-43ec-81c1-bb41d7488363';
  const EXPECTED_2026_T2_UUID = 'b1b46b17-c979-4824-aad7-31545b5ef212';

  beforeEach(() => {
    // Ensure authoritative academic years and school terms are available in storage
    const authoritativeYears: AcademicYear[] = [
      {
        id: EXPECTED_2026_AY_UUID,
        year: 2026,
        status: 'Active',
      },
    ];

    const authoritativeTerms: SchoolTerm[] = [
      {
        id: EXPECTED_2026_T2_UUID,
        academic_year_id: EXPECTED_2026_AY_UUID,
        year: 2026,
        term_name: 'Term 2',
        opening_date: '2026-05-04',
        closing_date: '2026-08-07',
        status: 'Active',
      },
    ];

    setStorage(KEYS.ACADEMIC_YEARS, authoritativeYears);
    setStorage(KEYS.SCHOOL_TERMS, authoritativeTerms);
  });

  it('TEST 1: Legacy ID must resolve to authoritative UUID', async () => {
    const legacyExamInput: Examination = {
      id: 'reg-test-exam-legacy-uuid-01',
      exam_name: 'PHASE5-P1-REGRESSION-LEGACY-ID-TEST',
      academic_year_id: 'ay_2026',
      term_id: 't_2026_2',
      year: 2026,
      term: 'Term 2',
      date_created: '2026-08-20',
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 100,
    };

    const created = await api.addExamination(legacyExamInput);

    // 1. api.addExamination() accepts the legacy identifiers and returns the created record
    expect(created).toBeDefined();

    // 2. The legacy academic-year identifier is resolved to authoritative UUID
    expect(created.academic_year_id).toBe(EXPECTED_2026_AY_UUID);
    expect(isUUID(created.academic_year_id!)).toBe(true);

    // 3. The legacy term identifier is resolved to authoritative UUID
    expect(created.term_id).toBe(EXPECTED_2026_T2_UUID);
    expect(isUUID(created.term_id!)).toBe(true);

    // 4. Verification that term_id is NOT NULL
    expect(created.term_id).not.toBeNull();
    expect(created.term_id).not.toBe('t_2026_2');
    expect(created.academic_year_id).not.toBe('ay_2026');

    // 5. Check relational consistency
    const matchingTerm = api.getSchoolTerms().find((t) => t.id === created.term_id);
    expect(matchingTerm).toBeDefined();
    expect(matchingTerm?.academic_year_id).toBe(created.academic_year_id);
  });

  it('TEST 2: Unresolvable term must abort without inserting', async () => {
    const invalidExamInput: Examination = {
      id: 'reg-test-exam-invalid-uuid-02',
      exam_name: 'PHASE5-P1-REGRESSION-INVALID-RELATION-TEST',
      academic_year_id: 'nonexistent-academic-year',
      term_id: 'nonexistent-term',
      year: 2099,
      term: 'Term 99' as any,
      date_created: '2026-08-20',
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 100,
    };

    const existingExamsBefore = api.getExaminations();

    // Attempting to add an unresolvable examination must throw an explicit actionable error
    await expect(api.addExamination(invalidExamInput)).rejects.toThrowError(
      /Unable to resolve authoritative relational UUID/
    );

    // Verify no new examination row was stored locally or in persistent state
    const existingExamsAfter = api.getExaminations();
    const insertedExam = existingExamsAfter.find(
      (e) => e.exam_name === 'PHASE5-P1-REGRESSION-INVALID-RELATION-TEST'
    );

    expect(insertedExam).toBeUndefined();
    expect(existingExamsAfter.length).toBe(existingExamsBefore.length);

    // Verify no record with NULL term_id was created
    const nullTermExams = existingExamsAfter.filter(
      (e) => e.exam_name === 'PHASE5-P1-REGRESSION-INVALID-RELATION-TEST' && !e.term_id
    );
    expect(nullTermExams.length).toBe(0);
  });
});
