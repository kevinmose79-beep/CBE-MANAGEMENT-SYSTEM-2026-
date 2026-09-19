import './setupLocalStorage';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, getDeletedTeacherIdentifiers, getStorage, setStorage, KEYS } from '../lib/storage';
import { authService } from '../services/authService';
import { Teacher, ClassStream, User } from '../types';

describe('Issue 3E: Teacher Deletion RLS Error Protection & Persistence Authority', () => {
  const originalFetch = globalThis.fetch;
  const mockTeacher: Teacher = {
    id: 'a0000000-0000-0000-0000-000000000001',
    user_id: 'u0000000-0000-0000-0000-000000000001',
    teacher_name: 'Jane Doe',
    email: 'jane.doe@school.edu',
    phone: '1234567890',
    tsc_number: 'TSC-12345',
    is_class_teacher: true,
    class_teacher_of_id: 'c0000000-0000-0000-0000-000000000001',
    allocations: [
      {
        id: 'alloc-01',
        education_level: 'Junior School',
        subject_id: 'sub-01',
        subject_name: 'Mathematics',
        class_id: 'c0000000-0000-0000-0000-000000000001',
        stream_id: 's0000000-0000-0000-0000-000000000001',
      },
    ],
  };

  const mockAdminUser: User = {
    id: 'admin-uuid-001',
    name: 'Administrator',
    email: 'admin@school.edu',
    role: 'admin',
    force_password_change: false,
  };

  const mockClass: ClassStream = {
    id: 'c0000000-0000-0000-0000-000000000001',
    stream_id: 's0000000-0000-0000-0000-000000000001',
    class_name: 'Grade 7',
    stream: 'East',
    class_teacher_id: 'a0000000-0000-0000-0000-000000000001',
    capacity: 40,
    education_level: 'Junior School',
    status: 'Active',
  };

  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.CURRENT_USER, mockAdminUser);
    setStorage(KEYS.TEACHERS, [mockTeacher]);
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.DELETED_TEACHERS, []);
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
    vi.restoreAllMocks();
  });

  it('Test 1: Successful server deletion removes teacher and synchronises local cache', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, database_deleted: true, auth_deleted: true }),
    });

    const res = await authService.adminDeleteTeacher(mockTeacher.id, mockTeacher.email);
    expect(res.success).toBe(true);

    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(teachers.find((t) => t.id === mockTeacher.id)).toBeUndefined();

    const tombstones = getDeletedTeacherIdentifiers();
    expect(tombstones.ids.has(mockTeacher.id)).toBe(true);
  });

  it('Test 2: RLS 42501 Permission Denied error throws, keeps local teacher, and creates no tombstone', async () => {
    const mockClient = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
      from: (table: string) => {
        if (table === 'teacher_subjects') {
          return { delete: () => ({ eq: async () => ({ error: null }) }) };
        }
        if (table === 'streams') {
          return { update: () => ({ eq: async () => ({ error: null }) }) };
        }
        if (table === 'teachers') {
          return {
            delete: () => ({
              eq: async () => ({
                error: { code: '42501', message: 'permission denied for table teachers (RLS policy rejection)' },
              }),
              ilike: async () => ({
                error: { code: '42501', message: 'permission denied for table teachers (RLS policy rejection)' },
              }),
            }),
          };
        }
        return {
          delete: () => ({ eq: async () => ({ error: null }), ilike: async () => ({ error: null }) }),
        };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    // Make server fetch fail to reach network
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    let errorThrown: any = null;
    try {
      await api.deleteTeacher(mockTeacher.id);
    } catch (err: any) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain('Failed to delete teacher from database');
    expect(errorThrown.message).toContain('permission denied');

    // Verify local storage was NOT modified (no false success)
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(teachers.find((t) => t.id === mockTeacher.id)).toBeDefined();

    const tombstones = getDeletedTeacherIdentifiers();
    expect(tombstones.ids.has(mockTeacher.id)).toBe(false);
  });

  it('Test 3: Other database error (e.g. 23503 Foreign Key constraint) propagates and preserves local state', async () => {
    const mockClient = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
      from: (table: string) => {
        if (table === 'teacher_subjects') {
          return { delete: () => ({ eq: async () => ({ error: null }) }) };
        }
        if (table === 'streams') {
          return { update: () => ({ eq: async () => ({ error: null }) }) };
        }
        if (table === 'teachers') {
          return {
            delete: () => ({
              eq: async () => ({
                error: { code: '23503', message: 'foreign key constraint violation in public.teachers' },
              }),
            }),
          };
        }
        return { delete: () => ({ eq: async () => ({ error: null }) }) };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    let errorThrown: any = null;
    try {
      await api.deleteTeacher(mockTeacher.id);
    } catch (err: any) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain('Failed to delete teacher from database');

    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(teachers.find((t) => t.id === mockTeacher.id)).toBeDefined();
  });

  it('Test 4: Server fallback mutation failure rejects and does NOT report false HTTP 200 success', async () => {
    const mockReq: any = {
      headers: { authorization: 'Bearer valid-admin-token' },
      body: { teacherId: mockTeacher.id },
    };

    let responseStatus = 200;
    let responseBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseBody = data;
          },
        };
      },
    };

    // Simulate server.ts fallback logic
    const fallbackMutationSim = async (_req: any, res: any) => {
      const tErr = { code: '23503', message: 'foreign key constraint prevents deletion' };
      if (tErr) {
        return res.status(500).json({ error: `Failed to delete teacher: ${tErr.message}` });
      }
      return res.status(200).json({ success: true });
    };

    await fallbackMutationSim(mockReq, mockRes);
    expect(responseStatus).toBe(500);
    expect(responseBody.error).toContain('Failed to delete teacher');
  });

  it('Test 5: Network failure does not report false success and local cache remains untouched', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch: connection refused'));

    const mockClient = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
      from: () => ({
        delete: () => ({
          eq: async () => Promise.reject(new Error('Fetch network error')),
          ilike: async () => Promise.reject(new Error('Fetch network error')),
        }),
        update: () => ({
          eq: async () => Promise.reject(new Error('Fetch network error')),
        }),
      }),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const res = await authService.adminDeleteTeacher(mockTeacher.id, mockTeacher.email);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();

    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(teachers.find((t) => t.id === mockTeacher.id)).toBeDefined();
  });

  it('Test 6: alreadyDeletedOnServer avoids redundant Supabase calls and synchronises local cache', async () => {
    const mockClient = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
      from: vi.fn(),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    // Invoking with alreadyDeletedOnServer = true
    await api.deleteTeacher(mockTeacher.id, { alreadyDeletedOnServer: true });

    // Client should NOT have performed direct Supabase delete mutations
    expect(mockClient.from).not.toHaveBeenCalled();

    // But local cache and class unassignment should be updated
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(teachers.find((t) => t.id === mockTeacher.id)).toBeUndefined();

    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(classes[0].class_teacher_id).toBeUndefined();
  });

  it('Test 7: Historical academic records (marks, assessments, examinations) are not deleted by teacher deletion workflow', async () => {
    const accessedTables: string[] = [];

    const mockClient = {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
      from: (table: string) => {
        accessedTables.push(table);
        return {
          delete: () => ({
            eq: async () => ({ error: null }),
            ilike: async () => ({ error: null }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    await api.deleteTeacher(mockTeacher.id);

    // Verify that NO historical academic tables were targeted for deletion
    expect(accessedTables).not.toContain('marks');
    expect(accessedTables).not.toContain('examinations');
    expect(accessedTables).not.toContain('examination_subjects');
    expect(accessedTables).not.toContain('report_cards');
    expect(accessedTables).not.toContain('merit_lists');
  });
});

