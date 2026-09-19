import assert from 'assert';
process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { api, createSupabaseClient, syncFromSupabase, getStorage, setStorage, KEYS } from '../lib/storage';
import { Teacher, User, ClassStream } from '../types';

console.log('=== RUNNING PHASE 7: SUPABASE SYNCHRONISATION AUDIT TESTS ===');

async function runTests() {
  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✓ PASS: ${name}`);
    } catch (err: any) {
      console.error(`✕ FAIL: ${name}`, err);
    }
  }

  const url = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  const client = (url && serviceKey)
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : (createSupabaseClient() || createClient(url, anonKey));
  assert(client, 'Supabase client must be available');

  // Provide client to storage.ts test hook
  (globalThis as any).__TEST_SUPABASE_CLIENT__ = client;

  // TEST 1: Verify PostgreSQL public.teachers does NOT have class_teacher_of_id column
  await test('TEST 1 — PostgreSQL public.teachers does NOT have class_teacher_of_id column', async () => {
    const { error } = await client.from('teachers').select('class_teacher_of_id').limit(1);
    assert(error, 'Querying class_teacher_of_id from teachers table must fail/return error because column does not exist');
    assert(
      error.message.includes('does not exist') || error.code === '42703',
      `Expected column does not exist error (42703), got: ${error.message}`
    );
  });

  // TEST 2: Sync derives class_teacher_of_id from streams.class_teacher_id === teacher.id
  await test('TEST 2 — syncFromSupabase derives class_teacher_of_id strictly from streams.class_teacher_id', async () => {
    // Fetch live streams and teachers from Supabase
    const { data: dbStreams } = await client.from('streams').select('*');
    const { data: dbTeachers } = await client.from('teachers').select('*');

    assert(dbStreams && dbStreams.length > 0, 'Must have streams in database');
    assert(dbTeachers && dbTeachers.length > 0, 'Must have teachers in database');

    await syncFromSupabase({ force: true });
    const localTeachers = api.getTeachers();

    for (const lt of localTeachers) {
      const matchingStream = dbStreams.find((s: any) => s.class_teacher_id && s.class_teacher_id === lt.id);
      if (matchingStream) {
        assert.strictEqual(
          lt.class_teacher_of_id,
          matchingStream.id,
          `Teacher ${lt.teacher_name} must have class_teacher_of_id equal to matching stream ID ${matchingStream.id}`
        );
        assert.strictEqual(
          lt.is_class_teacher,
          true,
          `Teacher ${lt.teacher_name} must have is_class_teacher = true`
        );
      } else {
        assert.strictEqual(
          lt.class_teacher_of_id,
          undefined,
          `Teacher ${lt.teacher_name} with no assigned stream must have class_teacher_of_id = undefined`
        );
        assert.strictEqual(
          lt.is_class_teacher,
          false,
          `Teacher ${lt.teacher_name} with no assigned stream must have is_class_teacher = false`
        );
      }
    }
  });

  // TEST 3: Stale LocalStorage class-teacher assignment CANNOT resurrect after sync
  await test('TEST 3 — Stale LocalStorage class-teacher assignment is overwritten by database truth', async () => {
    const localTeachers = api.getTeachers();
    assert(localTeachers.length > 0, 'Teachers must exist');

    // Find a teacher that is NOT assigned to any stream in Supabase
    const { data: dbStreams } = await client.from('streams').select('*');
    const unassignedTeacher = localTeachers.find(
      (t) => !dbStreams?.some((s: any) => s.class_teacher_id && s.class_teacher_id === t.id)
    );

    if (unassignedTeacher) {
      // Artificially corrupt local storage with a fake/stale assignment
      const fakeStreamId = '00000000-0000-0000-0000-000000000099';
      const corruptedTeachers = localTeachers.map((t) => {
        if (t.id === unassignedTeacher.id) {
          return {
            ...t,
            is_class_teacher: true,
            class_teacher_of_id: fakeStreamId,
          };
        }
        return t;
      });
      setStorage(KEYS.TEACHERS, corruptedTeachers);

      // Verify it was written to local storage
      const corruptedLocal = api.getTeachers().find((t) => t.id === unassignedTeacher.id);
      assert.strictEqual(corruptedLocal?.class_teacher_of_id, fakeStreamId);

      // Now perform authoritative syncFromSupabase()
      await syncFromSupabase({ force: true });

      // Verify the stale assignment was wiped clean because Supabase has no such assignment
      const restoredTeacher = api.getTeachers().find((t) => t.id === unassignedTeacher.id);
      assert.strictEqual(
        restoredTeacher?.class_teacher_of_id,
        undefined,
        'Stale LocalStorage class_teacher_of_id must be cleared by syncFromSupabase()'
      );
      assert.strictEqual(
        restoredTeacher?.is_class_teacher,
        false,
        'Stale LocalStorage is_class_teacher must be cleared by syncFromSupabase()'
      );
    }
  });

  // TEST 3B: Stale LocalStorage CLASSES cache cannot resurrect class-teacher assignment
  await test('TEST 3B — Stale LocalStorage CLASSES cache cannot resurrect class-teacher assignment', async () => {
    const localTeachers = api.getTeachers();
    const { data: dbStreams } = await client.from('streams').select('*');
    const unassignedTeacher = localTeachers.find(
      (t) => !dbStreams?.some((s: any) => s.class_teacher_id && s.class_teacher_id === t.id)
    );

    if (unassignedTeacher) {
      // Corrupt CLASSES in local storage with stale class_teacher_id pointing to unassigned teacher
      const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      const corruptedClasses = currentClasses.map((c, idx) => {
        if (idx === 0) {
          return {
            ...c,
            class_teacher_id: unassignedTeacher.id,
          };
        }
        return c;
      });
      setStorage(KEYS.CLASSES, corruptedClasses);

      // Now sync from Supabase
      await syncFromSupabase({ force: true });

      // Teacher must remain unassigned because Supabase streams is the sole source of truth
      const verifiedTeacher = api.getTeachers().find((t) => t.id === unassignedTeacher.id);
      assert.strictEqual(
        verifiedTeacher?.class_teacher_of_id,
        undefined,
        'Stale CLASSES cache must not resurrect class_teacher_of_id'
      );
      assert.strictEqual(
        verifiedTeacher?.is_class_teacher,
        false,
        'Stale CLASSES cache must not resurrect is_class_teacher'
      );
    }
  });

  // TEST 4: Consistency chain: streams.class_teacher_id -> teachers.is_class_teacher -> users.role
  await test('TEST 4 — Consistency: streams.class_teacher_id -> teachers.is_class_teacher -> users.role', async () => {
    await syncFromSupabase({ force: true });
    const teachers = api.getTeachers();
    const users = api.getUsers();

    for (const t of teachers) {
      const user = users.find(
        (u) => (u.teacher_id && u.teacher_id === t.id) || (u.email && t.email && u.email.toLowerCase() === t.email.toLowerCase())
      );
      if (user && user.role !== 'admin' && user.role !== 'learner') {
        if (t.is_class_teacher && t.class_teacher_of_id) {
          assert.strictEqual(
            user.role,
            'class_teacher',
            `User for teacher ${t.teacher_name} with stream assignment must have role 'class_teacher'`
          );
        } else {
          assert.strictEqual(
            user.role,
            'subject_teacher',
            `User for teacher ${t.teacher_name} without stream assignment must have role 'subject_teacher'`
          );
        }
      }
    }
  });

  // TEST 5: Subject allocations remain untouched during class teacher stream derivation
  await test('TEST 5 — Subject allocations (teacher_subjects) remain untouched', async () => {
    const { data: dbTS } = await client.from('teacher_subjects').select('*');
    assert(dbTS, 'teacher_subjects query must succeed');

    const teachers = api.getTeachers();
    for (const t of teachers) {
      const expectedAllocationsCount = dbTS.filter((ts: any) => ts.teacher_id === t.id).length;
      if (expectedAllocationsCount > 0) {
        assert.strictEqual(
          (t.allocations || []).length,
          expectedAllocationsCount,
          `Teacher ${t.teacher_name} allocations count must match database teacher_subjects count`
        );
      }
    }
  });

  console.log(`\n=== PHASE 7 TEST SUMMARY: ${passed}/${total} PASSED ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
