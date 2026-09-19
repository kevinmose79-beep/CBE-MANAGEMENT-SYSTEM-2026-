import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { api, KEYS, setStorage, getStorage } from '../lib/storage';
import { ClassStream, Teacher } from '../types';

describe('STEP 4E — Class & Subject Management UI (Phase 5)', () => {
  const componentPath = path.join(process.cwd(), 'src/components/ClassSubjectManagement.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf8');

  it('Static Audit 1: Stream ID Rule — Dropdown enforces c.stream_id and strictly rejects c.id with no fallback', () => {
    // Must check c.stream_id and isUUID(c.stream_id)
    expect(componentContent).toContain('!c.stream_id || !isUUID(c.stream_id)');
    expect(componentContent).toContain('api.assignClassTeacher(c.stream_id');
    // Must NOT use fallback like c.stream_id || c.id
    expect(componentContent).not.toContain('api.assignClassTeacher(c.stream_id || c.id');
    expect(componentContent).not.toContain('api.assignClassTeacher(c.id');
  });

  it('Static Audit 2: UI Safety — Duplicate request protection and loading/disabled state', () => {
    // Must have isAssigning state
    expect(componentContent).toContain('const [isAssigning, setIsAssigning] = useState<boolean>(false);');
    // Must have early return if isAssigning
    expect(componentContent).toContain('if (isAssigning) return;');
    // Must have disabled attribute tied to isAssigning
    expect(componentContent).toContain('disabled={isAssigning}');
  });

  it('Static Audit 3: Confirmed Success Flow — Toast shown only after backend confirms mutation', () => {
    // Verifies result.success before showing success toast
    expect(componentContent).toContain('const result = await api.assignClassTeacher(c.stream_id, targetTeacherId);');
    expect(componentContent).toContain('if (!result || !result.success)');
    // Catches errors, restores previousTeacherId and displays error toast
    expect(componentContent).toContain('setSelectedTeacherId(previousTeacherId);');
    expect(componentContent).toContain("showNotification('error', err?.message");
  });

  describe('Behavioral & Persistence Guarantees', () => {
    const originalFetch = globalThis.fetch;
    const validStreamId = '11111111-2222-3333-4444-555555555555';
    const oldTeacherId = '22222222-3333-4444-5555-666666666666';
    const newTeacherId = '33333333-4444-5555-6666-777777777777';

    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      globalThis.localStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          mockStorage = {};
        },
        length: 0,
        key: () => null,
      } as any;

      const initialClasses: ClassStream[] = [
        {
          id: 'parent-class-id',
          stream_id: validStreamId,
          class_name: 'Grade 7',
          stream: 'East',
          capacity: 40,
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
          id: newTeacherId,
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
      vi.restoreAllMocks();
    });

    it('Flow 1: Confirmed backend success updates LocalStorage and returns success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          stream: { id: validStreamId, stream_name: 'East', class_teacher_id: newTeacherId },
          teacher_id: newTeacherId,
        }),
      });

      const result = await api.assignClassTeacher(validStreamId, newTeacherId);
      expect(result.success).toBe(true);

      const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      expect(storedClasses[0].class_teacher_id).toBe(newTeacherId);

      const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
      expect(storedTeachers.find((t) => t.id === newTeacherId)?.is_class_teacher).toBe(true);
      expect(storedTeachers.find((t) => t.id === oldTeacherId)?.is_class_teacher).toBe(false);
    });

    it('Flow 2: Backend failure or HTTP 200 without confirmed success preserves LocalStorage unchanged', async () => {
      // Server returns 200 but success is false
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          error: 'Zero rows affected during assignment update',
        }),
      });

      await expect(api.assignClassTeacher(validStreamId, newTeacherId)).rejects.toThrow(
        'Zero rows affected during assignment update'
      );

      // LocalStorage MUST NOT be updated
      const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      expect(storedClasses[0].class_teacher_id).toBe(oldTeacherId);

      const storedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
      expect(storedTeachers.find((t) => t.id === oldTeacherId)?.is_class_teacher).toBe(true);
      expect(storedTeachers.find((t) => t.id === newTeacherId)?.is_class_teacher).toBe(false);
    });

    it('Flow 3: Attempting assignment with non-UUID or parent class ID rejects immediately', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      await expect(api.assignClassTeacher('not-a-uuid', newTeacherId)).rejects.toThrow(
        /stream_id must be a valid stream UUID/i
      );
      expect(fetchSpy).not.toHaveBeenCalled();

      // LocalStorage preserved
      const storedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      expect(storedClasses[0].class_teacher_id).toBe(oldTeacherId);
    });
  });
});
