import './setupLocalStorage';
import { describe, it, expect, beforeEach } from 'vitest';
import { SUPABASE_PART3, SUPABASE_QUICK_MIGRATIONS, SUPABASE_SQL_SCHEMA } from '../lib/supabaseSql';
import { api, setStorage, KEYS, getStorage } from '../lib/storage';
import { Examination, User } from '../types';

describe('Examination Approved Levels Schema & Persistence Test', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('verifies that SUPABASE_PART3 contains approved_levels and approved_classes column definitions', () => {
    expect(SUPABASE_PART3).toContain('approved_levels TEXT[] DEFAULT \'{}\'');
    expect(SUPABASE_PART3).toContain('approved_classes TEXT[] DEFAULT \'{}\'');
    expect(SUPABASE_PART3).toContain('ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_levels TEXT[] DEFAULT \'{}\';');
  });

  it('verifies that SUPABASE_QUICK_MIGRATIONS includes ALTER TABLE commands for examinations table', () => {
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_levels TEXT[] DEFAULT \'{}\';');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS approved_classes TEXT[] DEFAULT \'{}\';');
    expect(SUPABASE_QUICK_MIGRATIONS).toContain('NOTIFY pgrst, \'reload schema\';');
  });

  it('updates examination level approval correctly in application state and audit logs', async () => {
    const adminUser: User = {
      id: 'admin_1',
      name: 'System Admin',
      email: 'admin@school.ac.ke',
      role: 'admin',
    };

    const initialExam: Examination = {
      id: 'exam_test_01',
      exam_name: 'Term 1 Mid-Term 2026',
      term: 'Term 1',
      year: 2026,
      status: 'Draft',
      exam_type: 'Mid-Term',
      max_marks: 100,
      approved_levels: [],
    };

    setStorage(KEYS.EXAMS, [initialExam]);

    // 1. Approve Junior School Level
    const updated1 = await api.updateExaminationLevelApproval('exam_test_01', 'Junior School', true, adminUser);
    expect(updated1.approved_levels).toContain('Junior School');
    expect(updated1.status).toBe('Provisional');

    // 2. Approve Upper Primary Level
    const updated2 = await api.updateExaminationLevelApproval('exam_test_01', 'Upper Primary', true, adminUser);
    expect(updated2.approved_levels).toContain('Junior School');
    expect(updated2.approved_levels).toContain('Upper Primary');

    // 3. Reopen Junior School Level
    const updated3 = await api.updateExaminationLevelApproval('exam_test_01', 'Junior School', false, adminUser);
    expect(updated3.approved_levels).not.toContain('Junior School');
    expect(updated3.approved_levels).toContain('Upper Primary');

    // Verify storage persistence
    const savedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const found = savedExams.find((e) => e.id === 'exam_test_01');
    expect(found?.approved_levels).toEqual(['Upper Primary']);
  });

  it('rejects level approval by non-administrator with clear error message', async () => {
    const teacherUser: User = {
      id: 'teacher_1',
      name: 'Teacher Jane',
      email: 'jane@school.ac.ke',
      role: 'subject_teacher',
    };

    const initialExam: Examination = {
      id: 'exam_test_02',
      exam_name: 'End Term Assessment',
      term: 'Term 2',
      year: 2026,
      status: 'Draft',
      exam_type: 'End-Term',
      max_marks: 100,
      approved_levels: [],
    };

    setStorage(KEYS.EXAMS, [initialExam]);

    await expect(
      api.updateExaminationLevelApproval('exam_test_02', 'Lower Primary', true, teacherUser)
    ).rejects.toThrow(/Only an Administrator/);
  });
});
