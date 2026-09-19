import './setupLocalStorage';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api, setStorage, KEYS } from '../lib/storage';
import { isClassExamApproved } from '../utils/examLockUtils';
import { Examination, User, ClassStream, AcademicYear, SchoolTerm } from '../types';

describe('Examination Reopen Workflow — Marks Entry Unlocking', () => {
  const ayUuid = '11111111-2222-3333-4444-555555555555';
  const termUuid = '22222222-3333-4444-5555-666666666666';

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
    term_name: 'Term 2',
    status: 'Active',
    opening_date: '2026-05-01',
    closing_date: '2026-08-31',
  };

  const adminUser: User = {
    id: 'usr-admin-test-reopen',
    name: 'Administrator',
    role: 'admin',
    email: 'admin@school.com',
    status: 'Active',
    username: 'admin',
  };

  const teacherUser: User = {
    id: 'usr-teacher-test-reopen',
    name: 'Subject Teacher',
    role: 'subject_teacher',
    email: 'teacher@school.com',
    status: 'Active',
    username: 'teacher',
  };

  const testStream: ClassStream = {
    id: 'cls-test-g9-blue',
    stream_id: 'st-test-g9-blue',
    class_name: 'Grade 9',
    stream: 'Blue',
    status: 'Active',
    education_level: 'Junior School',
  };

  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.ACADEMIC_YEARS, [mockAy]);
    setStorage(KEYS.SCHOOL_TERMS, [mockTerm]);
    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        insert: (p: any) => ({
          select: () => ({
            maybeSingle: () => Promise.resolve({ data: p, error: null }),
            then: (fn: any) => Promise.resolve({ data: [p], error: null }).then(fn),
          }),
        }),
        update: (p: any) => ({
          eq: () => Promise.resolve({ data: [p], error: null }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    };
  });

  afterEach(() => {
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
  });

  it('correctly locks assessment when approved, and completely unlocks it when reopened to Draft', async () => {
    // 1. Create a fresh examination
    const createdExam = await api.addExamination({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
      exam_name: 'Reopen Test Exam',
      term: 'Term 2',
      year: 2026,
      status: 'Draft',
      exam_type: 'End-Term',
      max_marks: 100,
      approved_classes: [testStream.stream_id!],
      approved_levels: ['Junior School'],
    });

    // 2. Since approved_classes contains the stream, it is locked
    expect(isClassExamApproved(createdExam, testStream)).toBe(true);

    // 3. Reopen the examination via Administrator action
    const reopenedExam = await api.updateExaminationStatus(createdExam.id, 'Draft', adminUser);

    // 4. Verify status is Draft and approved_classes / approved_levels are cleared
    expect(reopenedExam.status).toBe('Draft');
    expect(reopenedExam.approved_classes).toEqual([]);
    expect(reopenedExam.approved_levels).toEqual([]);

    // 5. Verify the stream is now unlocked for marks entry
    expect(isClassExamApproved(reopenedExam, testStream)).toBe(false);

    // Clean up
    await api.deleteExamination(createdExam.id, adminUser);
  });

  it('rejects unauthorized reopening by non-admin users', async () => {
    const createdExam = await api.addExamination({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567892',
      exam_name: 'Security Test Exam',
      term: 'Term 2',
      year: 2026,
      status: 'Approved',
      exam_type: 'End-Term',
      max_marks: 100,
      approved_classes: [],
      approved_levels: [],
    });

    // Subject teacher attempts to reopen
    await expect(
      api.updateExaminationStatus(createdExam.id, 'Draft', teacherUser)
    ).rejects.toThrow(/UNAUTHORIZED/i);

    // Clean up: Reopen to draft then delete
    await api.updateExaminationStatus(createdExam.id, 'Draft', adminUser);
    await api.deleteExamination(createdExam.id, adminUser);
  });
});
