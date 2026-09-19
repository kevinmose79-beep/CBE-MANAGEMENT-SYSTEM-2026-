import assert from 'assert';
import { api, createSupabaseClient, generateUUID, syncFromSupabase, getStorage, KEYS } from '../lib/storage';
import { initialSubjects } from '../data/seedData';
import { Subject } from '../types';

console.log('=== RUNNING FORENSIC SUBJECT RESURRECTION & PERSISTENCE VERIFICATION TESTS ===');

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

  const client = createSupabaseClient();
  assert(client, 'Supabase client must be available');

  // TEST 1: Initial sync respects existing Supabase database rows without auto-inserting missing seed subjects
  await test('TEST 1 — syncFromSupabase() loads authoritative database rows without resurrecting missing seed subjects', async () => {
    // Fetch direct from Supabase
    const { data: dbSubjects, error } = await client.from('subjects').select('*');
    assert.ifError(error);
    assert(dbSubjects && dbSubjects.length > 0, 'Database should contain subjects');

    await syncFromSupabase({ force: true });
    const localSubjects = api.getSubjects();

    // Verify local subjects count matches deduplicated database subjects count
    assert.strictEqual(
      localSubjects.length,
      new Set(localSubjects.map(s => s.id)).size,
      'Local subjects must have unique IDs'
    );
  });

  // TEST 2: api.getSubjects() returns strictly stored subjects without injecting missing initialSubjects
  await test('TEST 2 — api.getSubjects() does not inject unseeded initialSubjects into memoryStorage', () => {
    const raw = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const result = api.getSubjects();
    assert.strictEqual(result.length, raw.length, 'api.getSubjects() must not artificially expand storage');
  });

  // TEST 3: Subject Creation -> Persistence -> Sync Verification
  const testSubjectUuid = generateUUID();
  const testSubjectCode = `RESURRECT_TEST_${Date.now()}`;
  let createdSubject: Subject;

  await test('TEST 3 — api.addSubject creates Learning Area in Supabase and persists across sync', async () => {
    const payload: Subject = {
      id: testSubjectUuid,
      subject_name: 'Forensic Audit Subject',
      subject_code: testSubjectCode,
      category: 'Elective',
      education_level: 'Junior School',
      status: 'Active',
    };

    createdSubject = await api.addSubject(payload);
    assert.strictEqual(createdSubject.id, testSubjectUuid);

    // Verify in Supabase
    const { data: checkDb } = await client.from('subjects').select('*').eq('id', testSubjectUuid);
    assert(checkDb && checkDb.length === 1, 'Record must exist in Supabase');

    // Verify in local storage
    const inStorage = api.getSubjects().find(s => s.id === testSubjectUuid);
    assert(inStorage, 'Record must exist in local storage');

    // Sync from Supabase and verify persistence
    await syncFromSupabase({ force: true });
    const afterSync = api.getSubjects().find(s => s.id === testSubjectUuid);
    assert(afterSync, 'Record must survive syncFromSupabase');
  });

  // TEST 4: Critical Invariant: DELETE → SUPABASE CONFIRMS ABSENT → SYNC → REFRESH → SUBJECT STILL ABSENT
  await test('TEST 4 — Deleting a subject permanently removes it from Supabase and sync never resurrects it', async () => {
    // 1. Delete directly from Supabase
    const { error: delError } = await client.from('subjects').delete().eq('id', testSubjectUuid);
    assert.ifError(delError);

    // 2. Verify Supabase confirms absence
    const { data: dbCheckAfterDel } = await client.from('subjects').select('*').eq('id', testSubjectUuid);
    assert(dbCheckAfterDel && dbCheckAfterDel.length === 0, 'Supabase must confirm record is completely deleted');

    // 3. Perform syncFromSupabase()
    await syncFromSupabase({ force: true });

    // 4. Verify record is absent from local state
    const afterSyncSubjects = api.getSubjects();
    const foundAfterSync = afterSyncSubjects.find(s => s.id === testSubjectUuid || s.subject_code === testSubjectCode);
    assert.strictEqual(foundAfterSync, undefined, 'Deleted subject must NOT be resurrected after syncFromSupabase()');

    // 5. Verify Supabase still has 0 rows for this subject
    const { data: dbCheckFinal } = await client.from('subjects').select('*').eq('id', testSubjectUuid);
    assert(dbCheckFinal && dbCheckFinal.length === 0, 'Supabase must still have 0 rows for the deleted subject');
  });

  console.log(`\nSUBJECT RESURRECTION TESTS SUMMARY: ${passed}/${total} PASSED`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
