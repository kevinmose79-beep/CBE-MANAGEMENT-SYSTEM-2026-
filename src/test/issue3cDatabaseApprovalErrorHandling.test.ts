import './setupLocalStorage';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api, setStorage, getStorage, KEYS } from '../lib/storage';
import { Examination, User, ClassStream, Teacher } from '../types';

describe('Issue 3C: Database Error Handling in updateExaminationLevelApproval & updateExaminationClassApproval', () => {
  const testExamId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const testStreamId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  const mockAdminUser: User = {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    name: 'School Principal',
    email: 'admin@school.ac.ke',
    role: 'admin',
  };

  const mockClassTeacherUser: User = {
    id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
    name: 'Mr. Kamau',
    email: 'kamau@school.ac.ke',
    role: 'class_teacher',
    teacher_id: 't_kamau',
  };

  const mockTeacherProfile: Teacher = {
    id: 't_kamau',
    user_id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
    teacher_name: 'Mr. Kamau',
    email: 'kamau@school.ac.ke',
    tsc_number: 'TSC-12345',
    phone: '0712345678',
    status: 'Active',
    class_teacher_of_id: testStreamId,
  };

  const mockClass: ClassStream = {
    id: 'cls_g7',
    stream_id: testStreamId,
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    class_teacher_id: 't_kamau',
    status: 'Active',
  };

  const createInitialExam = (overrides?: Partial<Examination>): Examination => ({
    id: testExamId,
    exam_name: 'End Term 1 Assessment 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Draft',
    exam_type: 'End-Term',
    max_marks: 100,
    approved_levels: [],
    approved_classes: [],
    ...overrides,
  });

  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.TEACHERS, [mockTeacherProfile]);
    setStorage(KEYS.LOGIN_LOGS, []);
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
  });

  afterEach(() => {
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
  });

  // TEST 1: Successful level approval update
  it('1. Level Approval: Supabase succeeds -> local state updates and operation reports success', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    let updateCalledWith: any = null;
    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => {
        expect(table).toBe('examinations');
        return {
          update: (payload: any) => {
            updateCalledWith = payload;
            return {
              eq: (col: string, val: string) => {
                expect(col).toBe('id');
                expect(val).toBe(testExamId);
                return Promise.resolve({ data: [payload], error: null });
              },
            };
          },
        };
      },
    };

    const result = await api.updateExaminationLevelApproval(testExamId, 'Junior School', true, mockAdminUser);

    expect(updateCalledWith).not.toBeNull();
    expect(updateCalledWith.approved_levels).toContain('Junior School');
    expect(result.approved_levels).toContain('Junior School');

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_levels).toContain('Junior School');
  });

  // TEST 2: Level approval database failure
  it('2. Level Approval: Supabase returns error -> throws error, local cache NOT updated, no success log', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: () => ({
          eq: () =>
            Promise.resolve({
              data: null,
              error: { code: '42501', message: 'permission denied for table examinations' },
            }),
        }),
      }),
    };

    await expect(
      api.updateExaminationLevelApproval(testExamId, 'Junior School', true, mockAdminUser)
    ).rejects.toThrow(/Failed to update examination level approval in database.*permission denied/);

    // CRITICAL: Local cache must NOT reflect the failed approval!
    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_levels).toEqual([]);
    expect(storedExams[0].status).toBe('Draft');

    // No success audit log should be saved
    const logs = getStorage<any[]>(KEYS.LOGIN_LOGS, []);
    expect(logs.length).toBe(0);
  });

  // TEST 3: Successful class approval update
  it('3. Class Approval: Supabase succeeds -> local state updates and operation reports success', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    let updatePayloadSent: any = null;
    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: (payload: any) => {
          updatePayloadSent = payload;
          return {
            eq: (col: string, val: string) => {
              expect(col).toBe('id');
              expect(val).toBe(testExamId);
              return Promise.resolve({ data: [payload], error: null });
            },
          };
        },
      }),
    };

    const result = await api.updateExaminationClassApproval(testExamId, testStreamId, true, mockClassTeacherUser);

    expect(updatePayloadSent).not.toBeNull();
    expect(updatePayloadSent.approved_classes).toContain(testStreamId);
    expect(result.approved_classes).toContain(testStreamId);

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_classes).toContain(testStreamId);
  });

  // TEST 4: Class approval database failure
  it('4. Class Approval: Supabase returns error -> throws error, local cache NOT updated, no success log', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: () => ({
          eq: () =>
            Promise.resolve({
              data: null,
              error: { code: '23503', message: 'foreign key constraint violation' },
            }),
        }),
      }),
    };

    await expect(
      api.updateExaminationClassApproval(testExamId, testStreamId, true, mockClassTeacherUser)
    ).rejects.toThrow(/Failed to update examination class approval in database.*foreign key/);

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_classes).toEqual([]);
    expect(storedExams[0].status).toBe('Draft');

    const logs = getStorage<any[]>(KEYS.LOGIN_LOGS, []);
    expect(logs.length).toBe(0);
  });

  // TEST 5: Fallback success when schema column is missing (PGRST204)
  it('5. Fallback Level & Class Approval: Column missing (PGRST204) -> fallback succeeds -> local state updates', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    let fallbackCalled = false;
    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: (payload: any) => ({
          eq: () => {
            if (payload.approved_levels !== undefined) {
              // Primary update fails with PGRST204 column missing
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST204', message: 'Could not find the approved_levels column in schema cache' },
              });
            }
            // Fallback status-only update succeeds
            fallbackCalled = true;
            return Promise.resolve({ data: [payload], error: null });
          },
        }),
      }),
    };

    const result = await api.updateExaminationLevelApproval(testExamId, 'Junior School', true, mockAdminUser);
    expect(fallbackCalled).toBe(true);
    expect(result.approved_levels).toContain('Junior School');

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_levels).toContain('Junior School');
  });

  // TEST 6: Fallback failure when schema column missing AND status update also fails
  it('6. Fallback Failure: PGRST204 on primary update, and fallback ALSO fails -> throws error, local cache NOT updated', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: (payload: any) => ({
          eq: () => {
            if (payload.approved_levels !== undefined) {
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST204', message: 'Could not find the approved_levels column in schema cache' },
              });
            }
            // Fallback update also fails (e.g. database down or RLS)
            return Promise.resolve({
              data: null,
              error: { code: '500', message: 'Database connection failed during fallback' },
            });
          },
        }),
      }),
    };

    await expect(
      api.updateExaminationLevelApproval(testExamId, 'Junior School', true, mockAdminUser)
    ).rejects.toThrow(/Failed to update examination level approval in database.*fallback/);

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_levels).toEqual([]);

    const logs = getStorage<any[]>(KEYS.LOGIN_LOGS, []);
    expect(logs.length).toBe(0);
  });

  // TEST 7: RLS / Permission failure in Class Approval
  it('7. RLS Policy Rejection: Permission denied error is not swallowed and throws immediately', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: () => ({
          eq: () =>
            Promise.resolve({
              data: null,
              error: { code: '42501', message: 'new row violates row-level security policy for table "examinations"' },
            }),
        }),
      }),
    };

    await expect(
      api.updateExaminationClassApproval(testExamId, testStreamId, true, mockClassTeacherUser)
    ).rejects.toThrow(/Failed to update examination class approval in database.*row-level security policy/);

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_classes).toEqual([]);
  });

  // TEST 8: Network / transport error
  it('8. Network / Transport Error: Propagates error and blocks local cache update', async () => {
    const initialExam = createInitialExam();
    setStorage(KEYS.EXAMS, [initialExam]);

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        update: () => ({
          eq: () =>
            Promise.resolve({
              data: null,
              error: { code: 'NETWORK_ERROR', message: 'Failed to fetch: net::ERR_CONNECTION_REFUSED' },
            }),
        }),
      }),
    };

    await expect(
      api.updateExaminationLevelApproval(testExamId, 'Junior School', true, mockAdminUser)
    ).rejects.toThrow(/Failed to update examination level approval in database.*ERR_CONNECTION_REFUSED/);

    const storedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    expect(storedExams[0].approved_levels).toEqual([]);
  });
});
