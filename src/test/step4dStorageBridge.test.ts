import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, assignClassTeacher, KEYS, getStorage, setStorage } from '../lib/storage';
import { ClassStream, Teacher } from '../types';

describe('STEP 4D — Storage Bridge: Authoritative Class Teacher Assignment', () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  const validStreamId = '11111111-2222-3333-4444-555555555555';
  const parentClassId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const validTeacherId = '99999999-8888-7777-6666-555555555555';
  const oldTeacherId = '88888888-7777-6666-5555-444444444444';

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: () => null,
    } as any;

    // Seed mock local storage
    const initialClasses: ClassStream[] = [
      {
        id: parentClassId,
        stream_id: validStreamId,
        class_name: 'Grade 7',
        stream: 'East',
        capacity: 45,
        class_teacher_id: oldTeacherId,
      },
    ];
    setStorage(KEYS.CLASSES, initialClasses);

    const initialTeachers: Teacher[] = [
      {
        id: oldTeacherId,
        first_name: 'David',
        last_name: 'Kariuki',
        is_class_teacher: true,
        class_teacher_of_id: validStreamId,
        allocations: [],
      } as any,
      {
        id: validTeacherId,
        first_name: 'Sarah',
        last_name: 'Omondi',
        is_class_teacher: false,
        class_teacher_of_id: undefined,
        allocations: [],
      } as any,
    ];
    setStorage(KEYS.TEACHERS, initialTeachers);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  it('Requirement 1: assignClassTeacher strictly rejects parent class ID or non-UUID stream_id', async () => {
    // Attempting to pass parent class ID or invalid UUID must throw immediately without network call
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    await expect(assignClassTeacher(parentClassId + '-invalid', validTeacherId)).rejects.toThrow(
      /stream_id must be a valid stream UUID/i
    );
    await expect(assignClassTeacher('', validTeacherId)).rejects.toThrow(
      /stream_id must be a valid stream UUID/i
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Requirement 2: API Failure prevents LocalStorage mutation (Failure -> NO LocalStorage mutation)', async () => {
    // Mock API returning 400 Bad Request error
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Database update affected 0 rows' }),
    });

    await expect(assignClassTeacher(validStreamId, validTeacherId)).rejects.toThrow(
      'Database update affected 0 rows'
    );

    // Verify LocalStorage was NOT mutated
    const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(storedClasses[0].class_teacher_id).toBe(oldTeacherId);

    const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const oldT = storedTeachers.find((t) => t.id === oldTeacherId);
    const newT = storedTeachers.find((t) => t.id === validTeacherId);
    expect(oldT?.is_class_teacher).toBe(true);
    expect(oldT?.class_teacher_of_id).toBe(validStreamId);
    expect(newT?.is_class_teacher).toBe(false);
    expect(newT?.class_teacher_of_id).toBeUndefined();
  });

  it('Requirement 3: API Network failure prevents LocalStorage mutation', async () => {
    // Mock Network failure
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection dropped'));

    await expect(assignClassTeacher(validStreamId, validTeacherId)).rejects.toThrow(
      'Network connection dropped'
    );

    // Verify LocalStorage was NOT mutated
    const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(storedClasses[0].class_teacher_id).toBe(oldTeacherId);

    const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    expect(storedTeachers.find((t) => t.id === oldTeacherId)?.is_class_teacher).toBe(true);
    expect(storedTeachers.find((t) => t.id === validTeacherId)?.is_class_teacher).toBe(false);
  });

  it('Requirement 4: API Success updates LocalStorage with confirmed server result', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        stream: { id: validStreamId, stream_name: 'East', class_teacher_id: validTeacherId },
        teacher_id: validTeacherId,
      }),
    });
    globalThis.fetch = fetchSpy;

    const result = await assignClassTeacher(validStreamId, validTeacherId);
    expect(result.success).toBe(true);

    // Verify correct URL and payload were sent
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/assign-class-teacher'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          stream_id: validStreamId,
          teacher_id: validTeacherId,
        }),
      })
    );

    // Verify LocalStorage WAS updated after server confirmation
    const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(storedClasses[0].class_teacher_id).toBe(validTeacherId);

    const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const oldT = storedTeachers.find((t) => t.id === oldTeacherId);
    const newT = storedTeachers.find((t) => t.id === validTeacherId);
    expect(oldT?.is_class_teacher).toBe(false);
    expect(oldT?.class_teacher_of_id).toBeUndefined();
    expect(newT?.is_class_teacher).toBe(true);
    expect(newT?.class_teacher_of_id).toBe(validStreamId);
  });

  it('Requirement 5: Unassigning class teacher via API updates LocalStorage cleanly', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        stream: { id: validStreamId, stream_name: 'East', class_teacher_id: null },
        teacher_id: null,
      }),
    });
    globalThis.fetch = fetchSpy;

    const result = await assignClassTeacher(validStreamId, null);
    expect(result.success).toBe(true);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/assign-class-teacher'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          stream_id: validStreamId,
          teacher_id: null,
        }),
      })
    );

    // Verify LocalStorage has teacher unassigned
    const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(storedClasses[0].class_teacher_id).toBeUndefined();

    const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const oldT = storedTeachers.find((t) => t.id === oldTeacherId);
    expect(oldT?.is_class_teacher).toBe(false);
    expect(oldT?.class_teacher_of_id).toBeUndefined();
  });

  it('Requirement 6: updateClass bridges class teacher updates through assignClassTeacher and rejects parent class id', async () => {
    // If updateClass is called without stream_id to assign teacher, it must reject
    const invalidClass: ClassStream = {
      id: parentClassId,
      class_name: 'Grade 7',
      stream: 'East',
      class_teacher_id: validTeacherId,
    };

    await expect(api.updateClass(invalidClass)).rejects.toThrow(
      /Class teacher assignment requires a valid stream_id/i
    );

    // Verify local storage was unchanged
    const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    expect(storedClasses[0].class_teacher_id).toBe(oldTeacherId);
  });
});
