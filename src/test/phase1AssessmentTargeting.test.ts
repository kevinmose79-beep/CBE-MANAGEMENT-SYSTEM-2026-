import { describe, it, expect, beforeEach } from 'vitest';

// Node environment localStorage polyfill for vitest
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

import { api, getStorage, setStorage, KEYS } from '../lib/storage';
import { Examination, ClassStream, EducationLevel, getEducationLevelForGrade } from '../types';

describe('Phase 1: Assessment Targeting UI & Persistence Verification', () => {
  const mockClasses: ClassStream[] = [
    {
      id: 'cls-pp1',
      class_name: 'PP1',
      education_level: 'Pre-Primary',
      stream: 'East',
      stream_id: 'st-pp1-e',
      capacity: 40,
      status: 'Active',
      allocated_subject_ids: [],
    },
    {
      id: 'cls-g1',
      class_name: 'Grade 1',
      education_level: 'Lower Primary',
      stream: 'North',
      stream_id: 'st-g1-n',
      capacity: 40,
      status: 'Active',
      allocated_subject_ids: [],
    },
    {
      id: 'cls-g4',
      class_name: 'Grade 4',
      education_level: 'Upper Primary',
      stream: 'A',
      stream_id: 'st-g4-a',
      capacity: 40,
      status: 'Active',
      allocated_subject_ids: [],
    },
    {
      id: 'cls-g7',
      class_name: 'Grade 7',
      education_level: 'Junior School',
      stream: 'East',
      stream_id: 'st-g7-e',
      capacity: 45,
      status: 'Active',
      allocated_subject_ids: [],
    },
    {
      id: 'cls-g7',
      class_name: 'Grade 7',
      education_level: 'Junior School',
      stream: 'West',
      stream_id: 'st-g7-w',
      capacity: 45,
      status: 'Active',
      allocated_subject_ids: [],
    },
    {
      id: 'cls-g8',
      class_name: 'Grade 8',
      education_level: 'Junior School',
      stream: 'Alpha',
      stream_id: 'st-g8-a',
      capacity: 45,
      status: 'Active',
      allocated_subject_ids: [],
    },
  ];

  const mockAcademicYearId = '550e8400-e29b-41d4-a716-446655440001';
  const mockTermId = '550e8400-e29b-41d4-a716-446655440002';

  let lastInsertedExamPayload: any = null;
  let lastUpdatedExamPayload: any = null;

  beforeEach(() => {
    localStorage.clear();
    lastInsertedExamPayload = null;
    lastUpdatedExamPayload = null;

    setStorage(KEYS.ACADEMIC_YEARS, [
      {
        id: mockAcademicYearId,
        year: 2026,
        is_current: true,
      },
    ]);
    setStorage(KEYS.SCHOOL_TERMS, [
      {
        id: mockTermId,
        academic_year_id: mockAcademicYearId,
        term_name: 'Term 1',
        year: 2026,
        status: 'Active',
        is_active: true,
      },
    ]);

    const mockClient: any = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: (rows: any[]) => {
          lastInsertedExamPayload = rows[0];
          return {
            select: () => ({
              maybeSingle: async () => ({ data: rows[0], error: null }),
            }),
          };
        },
        update: (payload: any) => {
          lastUpdatedExamPayload = payload;
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: payload, error: null }),
              }),
            }),
          };
        },
      }),
    };
    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;
  });

  describe('1. Parent-Child Relationship and Deduplication Logic', () => {
    it('deduplicates classes by class id (UUID)', () => {
      const seen = new Map<string, { id: string; className: string; educationLevel: EducationLevel }>();
      mockClasses.forEach((c) => {
        if (!c.id) return;
        if (!seen.has(c.id)) {
          const level = c.education_level || getEducationLevelForGrade(c.class_name) || 'Junior School';
          seen.set(c.id, {
            id: c.id,
            className: c.class_name,
            educationLevel: level as EducationLevel,
          });
        }
      });
      const distinct = Array.from(seen.values());

      // Grade 7 appeared twice in mockClasses (different streams), but should only appear once in distinct classes
      expect(distinct.length).toBe(5);
      const grade7Matches = distinct.filter((c) => c.className === 'Grade 7');
      expect(grade7Matches.length).toBe(1);
      expect(grade7Matches[0].id).toBe('cls-g7');
      expect(grade7Matches[0].educationLevel).toBe('Junior School');
    });

    it('filters classes strictly by education level', () => {
      const seen = new Map<string, { id: string; className: string; educationLevel: EducationLevel }>();
      mockClasses.forEach((c) => {
        if (!c.id) return;
        if (!seen.has(c.id)) {
          const level = c.education_level || getEducationLevelForGrade(c.class_name) || 'Junior School';
          seen.set(c.id, {
            id: c.id,
            className: c.class_name,
            educationLevel: level as EducationLevel,
          });
        }
      });
      const distinct = Array.from(seen.values());

      const juniorSchoolClasses = distinct.filter((c) => c.educationLevel === 'Junior School');
      expect(juniorSchoolClasses.map((c) => c.className)).toEqual(['Grade 7', 'Grade 8']);

      const lowerPrimaryClasses = distinct.filter((c) => c.educationLevel === 'Lower Primary');
      expect(lowerPrimaryClasses.map((c) => c.className)).toEqual(['Grade 1']);
    });

    it('enforces parent-child integrity: switching level invalidates classes outside that level', () => {
      let selectedLevel: string = 'Junior School';
      let selectedClassId: string = 'cls-g7';

      // Switch to Lower Primary
      const newLevel = 'Lower Primary';
      const distinctClasses = [
        { id: 'cls-g1', className: 'Grade 1', educationLevel: 'Lower Primary' as EducationLevel },
        { id: 'cls-g7', className: 'Grade 7', educationLevel: 'Junior School' as EducationLevel },
      ];

      // Simulate handleEducationLevelChange
      const matched = distinctClasses.find((c) => c.id === selectedClassId);
      if (!matched || matched.educationLevel !== newLevel) {
        selectedClassId = 'all';
      }
      selectedLevel = newLevel;

      expect(selectedLevel).toBe('Lower Primary');
      expect(selectedClassId).toBe('all');
    });
  });

  describe('2. addExamination Persistence', () => {
    it('creates a School-Wide assessment with null/undefined level and class', async () => {
      const examData: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        exam_name: 'School Wide CAT 1',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: undefined,
        class_id: undefined,
      };

      await api.addExamination(examData);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const created = stored.find((e) => e.exam_name === 'School Wide CAT 1');

      expect(created).toBeDefined();
      expect(created?.education_level).toBeUndefined();
      expect(created?.class_id).toBeUndefined();

      // Verify payload sent to Supabase
      expect(lastInsertedExamPayload).toBeDefined();
      expect(lastInsertedExamPayload.education_level).toBeNull();
      expect(lastInsertedExamPayload.class_id).toBeNull();
    });

    it('creates a Level-Wide assessment with education_level set and class_id undefined', async () => {
      const examData: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        exam_name: 'Junior School Mid-Term',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Mid-Term',
        education_level: 'Junior School',
        class_id: undefined,
      };

      await api.addExamination(examData);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const created = stored.find((e) => e.exam_name === 'Junior School Mid-Term');

      expect(created).toBeDefined();
      expect(created?.education_level).toBe('Junior School');
      expect(created?.class_id).toBeUndefined();

      // Verify payload sent to Supabase
      expect(lastInsertedExamPayload).toBeDefined();
      expect(lastInsertedExamPayload.education_level).toBe('Junior School');
      expect(lastInsertedExamPayload.class_id).toBeNull();
    });

    it('creates a Class-Specific assessment with both education_level and class_id set', async () => {
      const examData: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440030',
        exam_name: 'Grade 7 Diagnostic Test',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Custom',
        education_level: 'Junior School',
        class_id: 'cls-g7',
      };

      await api.addExamination(examData);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const created = stored.find((e) => e.exam_name === 'Grade 7 Diagnostic Test');

      expect(created).toBeDefined();
      expect(created?.education_level).toBe('Junior School');
      expect(created?.class_id).toBe('cls-g7');

      // Verify payload sent to Supabase
      expect(lastInsertedExamPayload).toBeDefined();
      expect(lastInsertedExamPayload.education_level).toBe('Junior School');
      expect(lastInsertedExamPayload.class_id).toBe('cls-g7');
    });

    it('sanitizes "All Levels" and "all" to undefined in cache and NULL in DB payload', async () => {
      const examData: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440040',
        exam_name: 'Sanitized Assessment',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: 'All Levels' as any,
        class_id: 'all',
      };

      await api.addExamination(examData);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const created = stored.find((e) => e.exam_name === 'Sanitized Assessment');

      expect(created).toBeDefined();
      expect(created?.education_level).toBeUndefined();
      expect(created?.class_id).toBeUndefined();

      // Verify payload sent to Supabase
      expect(lastInsertedExamPayload).toBeDefined();
      expect(lastInsertedExamPayload.education_level).toBeNull();
      expect(lastInsertedExamPayload.class_id).toBeNull();
    });
  });

  describe('3. updateExamination Persistence', () => {
    it('updates targeting from School-Wide to Level-Wide', async () => {
      const initialExam: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440050',
        exam_name: 'Initial Exam',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: undefined,
        class_id: undefined,
      };
      setStorage(KEYS.EXAMS, [initialExam]);

      const updatedExam: Examination = {
        ...initialExam,
        education_level: 'Upper Primary',
        class_id: undefined,
      };

      await api.updateExamination(updatedExam);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const found = stored.find((e) => e.id === '550e8400-e29b-41d4-a716-446655440050');

      expect(found?.education_level).toBe('Upper Primary');
      expect(found?.class_id).toBeUndefined();

      // Verify payload sent to Supabase
      expect(lastUpdatedExamPayload).toBeDefined();
      expect(lastUpdatedExamPayload.education_level).toBe('Upper Primary');
      expect(lastUpdatedExamPayload.class_id).toBeNull();
    });

    it('updates targeting to a specific class_id', async () => {
      const initialExam: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440060',
        exam_name: 'Initial Exam 2',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: 'Upper Primary',
        class_id: undefined,
      };
      setStorage(KEYS.EXAMS, [initialExam]);

      const updatedExam: Examination = {
        ...initialExam,
        education_level: 'Upper Primary',
        class_id: 'cls-g4',
      };

      await api.updateExamination(updatedExam);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const found = stored.find((e) => e.id === '550e8400-e29b-41d4-a716-446655440060');

      expect(found?.education_level).toBe('Upper Primary');
      expect(found?.class_id).toBe('cls-g4');

      // Verify payload sent to Supabase
      expect(lastUpdatedExamPayload).toBeDefined();
      expect(lastUpdatedExamPayload.education_level).toBe('Upper Primary');
      expect(lastUpdatedExamPayload.class_id).toBe('cls-g4');
    });

    it('resets targeting back to School-Wide when set to All Levels and all', async () => {
      const initialExam: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440070',
        exam_name: 'Initial Exam 3',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: 'Junior School',
        class_id: 'cls-g7',
      };
      setStorage(KEYS.EXAMS, [initialExam]);

      const updatedExam: Examination = {
        ...initialExam,
        education_level: undefined,
        class_id: undefined,
      };

      await api.updateExamination(updatedExam);
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const found = stored.find((e) => e.id === '550e8400-e29b-41d4-a716-446655440070');

      expect(found?.education_level).toBeUndefined();
      expect(found?.class_id).toBeUndefined();

      // Verify payload sent to Supabase
      expect(lastUpdatedExamPayload).toBeDefined();
      expect(lastUpdatedExamPayload.education_level).toBeNull();
      expect(lastUpdatedExamPayload.class_id).toBeNull();
    });
  });

  describe('4. Backward Compatibility for Existing Assessments', () => {
    it('seamlessly preserves existing examinations with null or undefined education_level and class_id', () => {
      const legacyExams: Examination[] = [
        {
          id: 'legacy-ex-1',
          exam_name: 'CAT 1 - Term 1 2026',
          term: 'Term 1',
          year: 2026,
          status: 'Approved',
          exam_type: 'CAT',
          max_marks: 100,
        },
        {
          id: 'legacy-ex-2',
          exam_name: 'MID-TERM EXAM - Term 1 2026',
          term: 'Term 1',
          year: 2026,
          status: 'Provisional',
          exam_type: 'Mid-Term',
          max_marks: 100,
        },
      ];
      setStorage(KEYS.EXAMS, legacyExams);

      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      expect(stored.length).toBe(2);
      expect(stored[0].education_level).toBeUndefined();
      expect(stored[0].class_id).toBeUndefined();
      expect(stored[1].education_level).toBeUndefined();
      expect(stored[1].class_id).toBeUndefined();
    });
  });

  describe('5. Surgical Remediation Tests (Findings 1 - 4)', () => {
    it('Test 1 — All Levels clears stale class_id in update persistence', async () => {
      // Given: education_level = null, class_id = 'stale-class-id'
      const malformedExam: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440088',
        exam_name: 'Malformed Legacy Exam',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: undefined,
        class_id: 'stale-class-id',
      };
      setStorage(KEYS.EXAMS, [malformedExam]);

      // When saving as All Levels ('All Levels' or undefined and 'all' or undefined)
      const savePayload: Examination = {
        ...malformedExam,
        education_level: undefined,
        class_id: undefined,
      };

      await api.updateExamination(savePayload);

      // Verify payload sent to Supabase has class_id: null and education_level: null
      expect(lastUpdatedExamPayload).toBeDefined();
      expect(lastUpdatedExamPayload.education_level).toBeNull();
      expect(lastUpdatedExamPayload.class_id).toBeNull();

      // Verify local cache has undefined
      const stored = getStorage<Examination[]>(KEYS.EXAMS, []);
      const found = stored.find((e) => e.id === malformedExam.id);
      expect(found?.education_level).toBeUndefined();
      expect(found?.class_id).toBeUndefined();
    });

    it('Test 2 — Failed Supabase insert does not update local storage', async () => {
      // Mock Supabase insert to fail
      const failingClient: any = {
        from: (table: string) => ({
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: 'Network failure or DB rejection', code: '500' },
              }),
            }),
          }),
        }),
      };
      (globalThis as any).__TEST_SUPABASE_CLIENT__ = failingClient;

      const initialExams = getStorage<Examination[]>(KEYS.EXAMS, []);
      const initialCount = initialExams.length;

      const newExam: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440099',
        exam_name: 'Failed Insert Exam',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
      };

      // Expect the API call to throw
      await expect(api.addExamination(newExam)).rejects.toThrow('Failed to create examination in database');

      // Verify local storage was NOT updated with the failed record
      const afterExams = getStorage<Examination[]>(KEYS.EXAMS, []);
      expect(afterExams.length).toBe(initialCount);
      expect(afterExams.find((e) => e.id === newExam.id)).toBeUndefined();
    });

    it('Test 3 — Foreign-key error violates examinations_class_id_fkey is propagated and NOT swallowed or converted to School-Wide', async () => {
      let insertAttempts = 0;
      let lastInsertPayload: any = null;

      const fkFailingClient: any = {
        from: (table: string) => ({
          insert: (rows: any[]) => {
            insertAttempts++;
            lastInsertPayload = rows[0];
            return {
              select: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: {
                    message: 'insert or update on table "examinations" violates foreign key constraint "examinations_class_id_fkey"',
                    code: '23503',
                  },
                }),
              }),
            };
          },
          update: (payload: any) => {
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: {
                      message: 'insert or update on table "examinations" violates foreign key constraint "examinations_class_id_fkey"',
                      code: '23503',
                    },
                  }),
                }),
              }),
            };
          },
        }),
      };
      (globalThis as any).__TEST_SUPABASE_CLIENT__ = fkFailingClient;

      const examWithBadFk: Examination = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        exam_name: 'Invalid FK Exam',
        academic_year_id: mockAcademicYearId,
        term_id: mockTermId,
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        max_marks: 100,
        exam_type: 'Opener',
        education_level: 'Junior School',
        class_id: 'non-existent-class-uuid',
      };

      // 1. In addExamination: should throw foreign key error and NOT retry by deleting class_id
      await expect(api.addExamination(examWithBadFk)).rejects.toThrow('examinations_class_id_fkey');
      expect(insertAttempts).toBe(1); // exactly 1 attempt, no retry!
      expect(lastInsertPayload.class_id).toBe('non-existent-class-uuid'); // did NOT strip class_id!

      // 2. In updateExamination: should throw foreign key error as well
      setStorage(KEYS.EXAMS, [{ ...examWithBadFk, class_id: undefined }]);
      await expect(api.updateExamination(examWithBadFk)).rejects.toThrow('examinations_class_id_fkey');
    });

    it('Test 4 — Orphaned class_id resolution invariant: never disguised as School-Wide or All Classes', () => {
      const distinctClasses = [
        { id: 'cls-1', className: 'Grade 7', educationLevel: 'Junior School' },
      ];

      const examWithOrphanedClass: Examination = {
        id: 'ex-orphan',
        exam_name: 'Orphaned Class Assessment',
        term: 'Term 1',
        year: 2026,
        status: 'Draft',
        exam_type: 'Opener',
        max_marks: 100,
        education_level: 'Junior School',
        class_id: 'deleted-class-uuid',
      };

      // Render simulation matching ExaminationManagement badge logic
      const targetClass = examWithOrphanedClass.class_id
        ? distinctClasses.find((c) => c.id === examWithOrphanedClass.class_id)
        : null;

      let badgeText = '';
      if (examWithOrphanedClass.class_id && targetClass) {
        badgeText = `${examWithOrphanedClass.education_level ? `${examWithOrphanedClass.education_level} • ` : ''}${targetClass.className}`;
      } else if (examWithOrphanedClass.class_id && !targetClass) {
        badgeText = `${examWithOrphanedClass.education_level ? `${examWithOrphanedClass.education_level} • ` : ''}Class: Unavailable`;
      } else if (examWithOrphanedClass.education_level) {
        badgeText = `${examWithOrphanedClass.education_level} (All Classes)`;
      } else {
        badgeText = 'School-Wide';
      }

      expect(badgeText).toBe('Junior School • Class: Unavailable');
      expect(badgeText).not.toContain('School-Wide');
      expect(badgeText).not.toContain('All Classes');
    });
  });
});
