import './setupLocalStorage';
import { describe, it, expect, beforeEach } from 'vitest';
import { api, getStorage, setStorage, KEYS, isUUID } from '../lib/storage';
import { ClassStream, Teacher } from '../types';

describe('Issue 3D: Class and Stream Synchronisation Atomicity and Error Protection', () => {
  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.CLASSES, []);
    setStorage(KEYS.TEACHERS, []);
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
  });

  it('Test 1: addClass enforces Supabase-first persistence and does not update local cache if Supabase insert fails', async () => {
    const mockClient = {
      from: (table: string) => {
        if (table === 'classes') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              ilike: async () => ({ data: [], error: null }),
            }),
            insert: () => ({
              select: async () => ({
                data: null,
                error: { message: 'permission denied for table classes', code: '42501' },
              }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const testClass: ClassStream = {
      id: '88888888-4444-4444-8888-111111111111',
      class_name: 'Grade 8',
      stream: 'North',
      capacity: 45,
    };

    // Ensure initial storage is empty
    expect(getStorage<ClassStream[]>(KEYS.CLASSES, [])).toHaveLength(0);

    // addClass must fail and throw the database error
    await expect(api.addClass(testClass)).rejects.toThrow();

    // Verify local storage was NOT modified because Supabase failed
    const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(storedClasses).toHaveLength(0);
  });

  it('Test 2: addClass rolls back orphan class if stream creation fails in Supabase', async () => {
    let classInserted = false;
    let classRolledBack = false;
    const testClassId = '11111111-2222-3333-4444-555555555555';

    const mockClient = {
      from: (table: string) => {
        if (table === 'classes') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              ilike: async () => ({ data: [], error: null }),
            }),
            insert: () => ({
              select: async () => {
                classInserted = true;
                return {
                  data: [{ id: testClassId, class_name: 'Grade 9', grade_level: 9, capacity: 40 }],
                  error: null,
                };
              },
            }),
            delete: () => ({
              eq: async (col: string, val: string) => {
                if (col === 'id' && val === testClassId) {
                  classRolledBack = true;
                }
                return { data: null, error: null };
              },
            }),
          };
        }
        if (table === 'streams') {
          return {
            select: () => ({
              eq: () => ({
                ilike: async () => ({ data: [], error: null }),
              }),
            }),
            insert: () => ({
              select: async () => ({
                data: null,
                error: { message: 'streams insert foreign key violation', code: '23503' },
              }),
            }),
          };
        }
        return {};
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const testClass: ClassStream = {
      id: testClassId,
      class_name: 'Grade 9',
      stream: 'East',
      capacity: 40,
    };

    // addClass must fail due to stream insertion error
    await expect(api.addClass(testClass)).rejects.toThrow();

    // Verify class insert occurred, then was rolled back
    expect(classInserted).toBe(true);
    expect(classRolledBack).toBe(true);

    // Verify local storage is clean
    expect(getStorage<ClassStream[]>(KEYS.CLASSES, [])).toHaveLength(0);
  });

  it('Test 3: updateClass does not mutate local cache or teacher assignments if Supabase stream update fails', async () => {
    const existingClassId = '22222222-3333-4444-5555-666666666666';
    const existingStreamId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
    const teacherId = '99999999-aaaa-bbbb-cccc-dddddddddddd';

    // Seed local cache
    const initialClasses: ClassStream[] = [
      {
        id: existingClassId,
        stream_id: existingStreamId,
        class_name: 'Grade 7',
        stream: 'West',
        capacity: 40,
        class_teacher_id: undefined,
      },
    ];
    setStorage(KEYS.CLASSES, initialClasses);

    const initialTeachers: Teacher[] = [
      {
        id: teacherId,
        first_name: 'John',
        last_name: 'Doe',
        is_class_teacher: false,
        allocations: [],
      } as any,
    ];
    setStorage(KEYS.TEACHERS, initialTeachers);

    const mockClient = {
      from: (table: string) => {
        if (table === 'classes') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: existingClassId, class_name: 'Grade 7', capacity: 40 },
                  error: null,
                }),
              }),
              ilike: async () => ({ data: [{ id: existingClassId }], error: null }),
            }),
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }
        if (table === 'streams') {
          return {
            select: () => ({
              eq: () => async () => ({
                data: [{ id: existingStreamId, stream_name: 'West', class_id: existingClassId }],
                error: null,
              }),
            }),
            update: () => ({
              eq: async () => ({
                data: null,
                error: { message: 'Database connection dropped during stream update', code: '08006' },
              }),
            }),
          };
        }
        return {};
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const updatePayload: ClassStream = {
      id: existingClassId,
      stream_id: existingStreamId,
      class_name: 'Grade 7',
      stream: 'West',
      capacity: 50,
      class_teacher_id: teacherId,
    };

    await expect(api.updateClass(updatePayload)).rejects.toThrow();

    // Verify local classes cache was NOT updated
    const classesAfter = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(classesAfter[0].capacity).toBe(40);
    expect(classesAfter[0].class_teacher_id).toBeUndefined();

    // Verify local teachers cache was NOT updated
    const teachersAfter = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(teachersAfter[0].is_class_teacher).toBe(false);
  });

  it('Test 4: deleteStream aborts and does not delete local cache if Supabase delete fails', async () => {
    const streamId = '33333333-4444-5555-6666-777777777777';
    const initialClasses: ClassStream[] = [
      {
        id: '44444444-5555-6666-7777-888888888888',
        stream_id: streamId,
        class_name: 'Grade 6',
        stream: 'Blue',
        capacity: 40,
      },
    ];
    setStorage(KEYS.CLASSES, initialClasses);

    const mockClient = {
      from: (table: string) => {
        if (table === 'streams') {
          return {
            delete: () => ({
              eq: async () => ({
                data: null,
                error: { message: 'permission denied for table streams', code: '42501' },
              }),
            }),
          };
        }
        return {};
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    await expect(api.deleteStream(streamId)).rejects.toThrow();

    // Verify local cache still contains the stream
    const stored = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(stored).toHaveLength(1);
    expect(stored[0].stream_id).toBe(streamId);
  });

  it('Test 5: deleteClass aborts and does not delete local cache if Supabase delete fails', async () => {
    const parentClassId = '55555555-6666-7777-8888-999999999999';
    const initialClasses: ClassStream[] = [
      {
        id: parentClassId,
        stream_id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        class_name: 'Grade 5',
        stream: 'Red',
        capacity: 35,
      },
      {
        id: parentClassId,
        stream_id: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
        class_name: 'Grade 5',
        stream: 'Green',
        capacity: 35,
      },
    ];
    setStorage(KEYS.CLASSES, initialClasses);

    const mockClient = {
      from: (table: string) => {
        if (table === 'streams') {
          return {
            delete: () => ({
              eq: async () => ({
                data: null,
                error: { message: 'foreign key constraint prevents deletion', code: '23503' },
              }),
            }),
          };
        }
        return {};
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    await expect(api.deleteClass(parentClassId)).rejects.toThrow();

    // Verify local storage retained both streams under the class
    const stored = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(stored).toHaveLength(2);
  });

  it('Test 6: Successful addClass and updateClass accurately synchronizes Supabase and cache with UUID integrity', async () => {
    const parentClassId = 'aaaaaaaa-1111-2222-3333-444444444444';
    const streamId = 'bbbbbbbb-2222-3333-4444-555555555555';
    const teacherId = 'cccccccc-3333-4444-5555-666666666666';

    const dbClasses: any[] = [];
    const dbStreams: any[] = [];

    const mockClient = {
      from: (table: string) => {
        if (table === 'classes') {
          return {
            select: () => ({
              eq: (col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: dbClasses.find((c) => c[col] === val) || null,
                  error: null,
                }),
              }),
              ilike: async (col: string, val: string) => ({
                data: dbClasses.filter((c) => (c[col] || '').toLowerCase() === val.toLowerCase()),
                error: null,
              }),
            }),
            insert: (rows: any[]) => ({
              select: async () => {
                const inserted = rows.map((r) => ({ ...r, id: r.id || parentClassId }));
                dbClasses.push(...inserted);
                return { data: inserted, error: null };
              },
            }),
            update: (payload: any) => ({
              eq: async (col: string, val: string) => {
                const item = dbClasses.find((c) => c[col] === val);
                if (item) Object.assign(item, payload);
                return { data: null, error: null };
              },
            }),
          };
        }
        if (table === 'streams') {
          return {
            select: () => ({
              eq: (col: string, val: string) => ({
                ilike: async (streamCol: string, streamVal: string) => ({
                  data: dbStreams.filter((s) => s[col] === val && (s[streamCol] || '').toLowerCase() === streamVal.toLowerCase()),
                  error: null,
                }),
                then: (resolve: any) => {
                  const res = {
                    data: dbStreams.filter((s) => s[col] === val),
                    error: null,
                  };
                  return Promise.resolve(res).then(resolve);
                },
              }),
            }),
            insert: (rows: any[]) => ({
              select: async () => {
                const inserted = rows.map((r) => ({ ...r, id: r.id || streamId }));
                dbStreams.push(...inserted);
                return { data: inserted, error: null };
              },
            }),
            update: (payload: any) => ({
              eq: async (col: string, val: string) => {
                const item = dbStreams.find((s) => s[col] === val);
                if (item) Object.assign(item, payload);
                return { data: null, error: null };
              },
            }),
          };
        }
        return {};
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const initialTeachers: Teacher[] = [
      {
        id: teacherId,
        first_name: 'Grace',
        last_name: 'Wanjiku',
        is_class_teacher: false,
        allocations: [],
      } as any,
    ];
    setStorage(KEYS.TEACHERS, initialTeachers);

    const newClass: ClassStream = {
      id: parentClassId,
      stream_id: streamId,
      class_name: 'Grade 4',
      stream: 'Yellow',
      capacity: 42,
      class_teacher_id: teacherId,
    };

    const added = await api.addClass(newClass);
    expect(added.id).toBe(parentClassId);
    expect(added.stream_id).toBe(streamId);

    // Verify Supabase state
    expect(dbClasses).toHaveLength(1);
    expect(dbClasses[0].class_name).toBe('Grade 4');
    expect(dbStreams).toHaveLength(1);
    expect(dbStreams[0].stream_name).toBe('Yellow');
    expect(dbStreams[0].class_teacher_id).toBe(teacherId);

    // Verify local cache state
    const stored = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(stored).toHaveLength(1);
    expect(stored[0].stream_id).toBe(streamId);

    const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(storedTeachers[0].is_class_teacher).toBe(true);
    expect(storedTeachers[0].class_teacher_of_id).toBe(streamId);
  });
});
