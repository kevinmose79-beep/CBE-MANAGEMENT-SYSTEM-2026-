import './setupLocalStorage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, setStorage, getStorage, KEYS } from '../lib/storage';
import { Examination, User, SchoolTerm, AcademicYear, Mark } from '../types';

describe('Examination Edit Surgical Audit Suite', () => {
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

  it('1. Successfully updates assessment name, type, and max_marks in Supabase and local cache', async () => {
    const updated = await api.updateExamination(
      {
        ...sampleDraftExam,
        exam_name: 'Term 3 Opener Assessment (Revised)',
        exam_type: 'Custom',
        max_marks: 50,
      },
      adminUser
    );

    expect(updated.id).toBe(examUuid);
    expect(updated.exam_name).toBe('Term 3 Opener Assessment (Revised)');
    expect(updated.max_marks).toBe(50);
    expect(updated.exam_type).toBe('Custom');

    // Verify Supabase payload
    expect(mockSupabaseUpdatePayload).not.toBeNull();
    expect(mockSupabaseUpdatePayload.exam_name).toBe('Term 3 Opener Assessment (Revised)');
    expect(mockSupabaseUpdatePayload.max_marks).toBe(50);

    // Verify local cache sync
    const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
    const found = stored.find((e) => e.id === examUuid);
    expect(found?.exam_name).toBe('Term 3 Opener Assessment (Revised)');
    expect(found?.max_marks).toBe(50);
  });

  it('2. Preserves assessment UUID and foreign keys during update', async () => {
    const updated = await api.updateExamination(
      {
        ...sampleDraftExam,
        exam_name: 'Updated Name Only',
      },
      adminUser
    );

    expect(updated.id).toBe(examUuid);
    expect(updated.academic_year_id).toBe(ayUuid);
    expect(updated.term_id).toBe(termUuid);
    expect(updated.term).toBe('Term 3');
    expect(updated.year).toBe(2026);
  });

  it('3. Enforces RBAC: blocks non-administrators from editing assessments', async () => {
    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          exam_name: 'Hacked Title',
        },
        teacherUser
      )
    ).rejects.toThrow(/Unauthorized: Only administrators/i);
  });

  it('4. Enforces lock governance: blocks editing Approved (Locked) assessments', async () => {
    const approvedExam: Examination = {
      ...sampleDraftExam,
      id: 'approved-exam-id-1234',
      status: 'Approved',
    };
    setStorage(KEYS.EXAMS, [approvedExam]);

    await expect(
      api.updateExamination(
        {
          ...approvedExam,
          exam_name: 'Attempted Edit on Locked Exam',
        },
        adminUser
      )
    ).rejects.toThrow(/Approved examinations are locked and cannot be edited/i);
  });

  it('5. Enforces lock governance: blocks editing Archived assessments', async () => {
    const archivedExam: Examination = {
      ...sampleDraftExam,
      id: 'archived-exam-id-5678',
      status: 'Archived' as any,
    };
    setStorage(KEYS.EXAMS, [archivedExam]);

    await expect(
      api.updateExamination(
        {
          ...archivedExam,
          exam_name: 'Attempted Edit on Archived Exam',
        },
        adminUser
      )
    ).rejects.toThrow(/Archived examinations cannot be modified/i);
  });

  it('6. Validates inputs: rejects empty title or invalid maximum marks', async () => {
    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          exam_name: '   ',
        },
        adminUser
      )
    ).rejects.toThrow(/Assessment title cannot be empty/i);

    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          max_marks: 0,
        },
        adminUser
      )
    ).rejects.toThrow(/Maximum score must be a positive number/i);

    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          max_marks: -25,
        },
        adminUser
      )
    ).rejects.toThrow(/Maximum score must be a positive number/i);
  });

  it('7. Enforces term modifiability: blocks modification when term is Closed or Locked', async () => {
    const closedTerm: SchoolTerm = {
      ...mockTerm,
      status: 'Closed',
    };
    setStorage(KEYS.SCHOOL_TERMS, [closedTerm]);

    await expect(
      api.updateExamination(
        {
          ...sampleDraftExam,
          exam_name: 'Edit During Closed Term',
        },
        adminUser
      )
    ).rejects.toThrow(/Cannot modify assessment.*Closed/i);
  });

  it('8. Ensures existing student marks for this exam remain intact and preserved', async () => {
    const existingMark: Mark = {
      id: 'mark-test-uuid-1111',
      student_id: 'student-uuid-9999',
      exam_id: examUuid,
      subject_id: 'subj-uuid-math',
      score: 85,
    };
    setStorage(KEYS.MARKS, [existingMark]);

    await api.updateExamination(
      {
        ...sampleDraftExam,
        exam_name: 'Updated Opener Exam Title',
        max_marks: 100,
      },
      adminUser
    );

    const preservedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    expect(preservedMarks).toHaveLength(1);
    expect(preservedMarks[0].id).toBe('mark-test-uuid-1111');
    expect(preservedMarks[0].exam_id).toBe(examUuid);
    expect(preservedMarks[0].score).toBe(85);
  });
});
