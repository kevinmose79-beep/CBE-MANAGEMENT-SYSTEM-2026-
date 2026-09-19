import './setupLocalStorage';
import { describe, it, expect, beforeEach } from 'vitest';
import { api, setStorage, getStorage, KEYS } from '../lib/storage';
import { Examination, User, SchoolTerm, AcademicYear, Mark, EducationLevel } from '../types';

describe('Assessment Setup — Editable Target Level Suite', () => {
  const ayUuid = '44444444-5555-6666-7777-888888888888';
  const termUuid = '99999999-aaaa-bbbb-cccc-dddddddddddd';
  const examUuid = 'eeeeeeee-ffff-0000-1111-222222222222';

  const mockAy: AcademicYear = {
    id: ayUuid,
    year: 2026,
    status: 'Active',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  };

  const mockTerm: SchoolTerm = {
    id: termUuid,
    academic_year_id: ayUuid,
    year: 2026,
    term_name: 'Term 3',
    status: 'Active',
    opening_date: '2026-09-01',
    closing_date: '2026-11-30',
  };

  const adminUser: User = {
    id: 'usr-admin-edit',
    name: 'Admin User',
    role: 'admin',
    email: 'admin@school.com',
    status: 'Active',
    username: 'admin',
  };

  const teacherUser: User = {
    id: 'usr-teacher-edit',
    name: 'Teacher User',
    role: 'subject_teacher',
    email: 'teacher@school.com',
    status: 'Active',
    username: 'teacher',
  };

  const sampleDraftExam: Examination = {
    id: examUuid,
    exam_name: 'Opener Assessment Term 3',
    term: 'Term 3',
    year: 2026,
    academic_year_id: ayUuid,
    term_id: termUuid,
    status: 'Draft',
    exam_type: 'Opener',
    max_marks: 100,
    education_level: undefined, // All Levels
    created_at: '2026-08-31T14:17:00Z',
  };

  let mockSupabaseUpdatePayload: any = null;

  beforeEach(() => {
    localStorage.clear();
    mockSupabaseUpdatePayload = null;

    setStorage(KEYS.ACADEMIC_YEARS, [mockAy]);
    setStorage(KEYS.SCHOOL_TERMS, [mockTerm]);
    setStorage(KEYS.EXAMS, [sampleDraftExam]);

    // Mock global test supabase client
    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => {
        if (table === 'examinations') {
          return {
            update: (payload: any) => {
              mockSupabaseUpdatePayload = payload;
              return {
                eq: (col: string, val: any) => {
                  return {
                    select: () => ({
                      maybeSingle: async () => ({
                        data: { ...payload, id: val, updated_at: '2026-09-08T15:00:00Z' },
                        error: null,
                      }),
                    }),
                  };
                },
              };
            },
          };
        }
        return {
          select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        };
      },
    };
  });

  it('Test 1 — All Levels → Junior School', async () => {
    // Before: education_level is undefined (representing All Levels)
    expect(sampleDraftExam.education_level).toBeUndefined();

    // Action: update Target Level to 'Junior School'
    const result = await api.updateExamination(
      {
        ...sampleDraftExam,
        education_level: 'Junior School',
      },
      adminUser
    );

    // Expected: Supabase payload has education_level = 'Junior School'
    expect(mockSupabaseUpdatePayload.education_level).toBe('Junior School');
    // Result and cache have 'Junior School'
    expect(result.education_level).toBe('Junior School');
    const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(stored[0].education_level).toBe('Junior School');
  });

  it('Test 2 — Junior School → All Levels', async () => {
    // Before: education_level is 'Junior School'
    const examWithLevel: Examination = {
      ...sampleDraftExam,
      education_level: 'Junior School',
    };
    setStorage(KEYS.EXAMS, [examWithLevel]);

    // Action: set Target Level to 'All Levels' (represented as undefined)
    const result = await api.updateExamination(
      {
        ...examWithLevel,
        education_level: undefined,
      },
      adminUser
    );

    // Expected: Supabase payload has education_level = null
    expect(mockSupabaseUpdatePayload.education_level).toBeNull();
    // Result and cache have undefined (canonical representation of All Levels)
    expect(result.education_level).toBeUndefined();
    const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(stored[0].education_level).toBeUndefined();
  });

  it('Test 3 — All specific levels can be persisted', async () => {
    const levels: EducationLevel[] = ['Pre-Primary', 'Lower Primary', 'Upper Primary', 'Junior School'];

    for (const lvl of levels) {
      const result = await api.updateExamination(
        {
          ...sampleDraftExam,
          education_level: lvl,
        },
        adminUser
      );

      expect(mockSupabaseUpdatePayload.education_level).toBe(lvl);
      expect(result.education_level).toBe(lvl);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      expect(stored[0].education_level).toBe(lvl);
    }
  });

  it('Test 4 — UUID preservation: assessment.id does not change', async () => {
    const result = await api.updateExamination(
      {
        ...sampleDraftExam,
        education_level: 'Upper Primary',
      },
      adminUser
    );

    expect(result.id).toBe(examUuid);
    const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(stored[0].id).toBe(examUuid);
  });

  it('Test 5 — Foreign-key preservation: academic_year_id and term_id remain unchanged', async () => {
    const result = await api.updateExamination(
      {
        ...sampleDraftExam,
        education_level: 'Lower Primary',
      },
      adminUser
    );

    expect(result.academic_year_id).toBe(ayUuid);
    expect(result.term_id).toBe(termUuid);
    expect(result.term).toBe('Term 3');
    expect(result.year).toBe(2026);
  });

  it('Test 6 — Marks preservation: existing learner marks remain untouched and linked', async () => {
    const markUuid = 'mmmmmmmm-1111-2222-3333-444444444444';
    const sampleMark: Mark = {
      id: markUuid,
      exam_id: examUuid,
      student_id: 'std-101',
      subject_id: 'sub-math',
      score: 88,
      updated_at: '2026-09-01T10:00:00Z',
    };
    setStorage(KEYS.MARKS, [sampleMark]);

    // Update target level
    await api.updateExamination(
      {
        ...sampleDraftExam,
        education_level: 'Junior School',
      },
      adminUser
    );

    // Verify marks table was untouched
    const storedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    expect(storedMarks).toHaveLength(1);
    expect(storedMarks[0].id).toBe(markUuid);
    expect(storedMarks[0].exam_id).toBe(examUuid);
    expect(storedMarks[0].score).toBe(88);
  });

  it('Test 7 — RBAC: non-admin cannot update Target Level', async () => {
    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          education_level: 'Junior School',
        },
        teacherUser
      )
    ).rejects.toThrow('Unauthorized: Only administrators can modify assessment setup.');
  });

  it('Test 8 — Approved assessment: Target Level cannot be changed when status is Approved', async () => {
    const approvedExam: Examination = {
      ...sampleDraftExam,
      status: 'Approved',
    };
    setStorage(KEYS.EXAMS, [approvedExam]);

    await expect(
      api.updateExamination(
        {
          ...approvedExam,
          education_level: 'Junior School',
        },
        adminUser
      )
    ).rejects.toThrow('Approved examinations are locked and cannot be edited.');
  });

  it('Test 9 — Archived assessment: Target Level cannot be changed when status is Archived', async () => {
    const archivedExam: Examination = {
      ...sampleDraftExam,
      status: 'Archived' as any,
    };
    setStorage(KEYS.EXAMS, [archivedExam]);

    await expect(
      api.updateExamination(
        {
          ...archivedExam,
          education_level: 'Junior School',
        },
        adminUser
      )
    ).rejects.toThrow('Archived examinations cannot be modified');
  });

  it('Test 10 — Closed/Locked term: term governance prevents update', async () => {
    const closedTerm: SchoolTerm = {
      ...mockTerm,
      status: 'Closed',
    };
    setStorage(KEYS.SCHOOL_TERMS, [closedTerm]);

    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          education_level: 'Junior School',
        },
        adminUser
      )
    ).rejects.toThrow('The academic term "Term 3 2026" is Closed.');
  });
});
