import assert from 'assert';
import { api, createSupabaseClient, isUUID, generateUUID, syncFromSupabase } from '../lib/storage';
import { Subject } from '../types';

console.log('=== RUNNING LEARNING AREA CREATE & EDIT PERSISTENCE TESTS ===');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    total++;
    return (async () => {
      try {
        await fn();
        passed++;
        console.log(`✓ PASS: ${name}`);
      } catch (err: any) {
        console.error(`✕ FAIL: ${name}`, err);
      }
    })();
  }

  const client = createSupabaseClient();
  const testSubjectUuid = generateUUID();
  const testSubjectCode = `TEST_LA_${Date.now()}`;

  // TEST 1: CREATE PERSISTENCE
  await test('TEST 1 — api.addSubject creates Learning Area with valid UUID in Supabase and survives syncFromSupabase', async () => {
    const newSubject: Subject = {
      id: testSubjectUuid,
      subject_name: 'Automated Test Learning Area',
      subject_code: testSubjectCode,
      category: 'Elective',
      education_level: 'Junior School',
      status: 'Active',
    };

    const result = await api.addSubject(newSubject);

    // 1. Check returned object
    assert(isUUID(result.id), `Expected valid UUID but got ${result.id}`);
    assert.strictEqual(result.subject_code, testSubjectCode);
    assert.strictEqual(result.subject_name, 'Automated Test Learning Area');

    // 2. Check local storage
    const localSubjects = api.getSubjects();
    const foundInLocal = localSubjects.find((s) => s.id === result.id || s.subject_code === testSubjectCode);
    assert(foundInLocal, 'Newly created subject should be present in local storage');

    // 3. Verify in Supabase directly
    if (client) {
      const { data, error } = await client.from('subjects').select('*').eq('id', result.id);
      assert.ifError(error);
      assert(data && data.length > 0, 'Subject should exist in public.subjects table');
      assert.strictEqual(data[0].subject_code, testSubjectCode);

      // 4. Verify syncFromSupabase does NOT erase the subject
      await syncFromSupabase({ force: true });
      const afterSync = api.getSubjects();
      const foundAfterSync = afterSync.find((s) => s.id === result.id || s.subject_code === testSubjectCode);
      assert(foundAfterSync, 'Newly created subject must persist and remain after syncFromSupabase()');
    }
  });

  // TEST 2: EDIT PERSISTENCE
  await test('TEST 2 — api.updateSubject updates existing Learning Area in Supabase while preserving UUID', async () => {
    const updatedName = 'Automated Test Learning Area (Updated)';
    const subjectToUpdate: Subject = {
      id: testSubjectUuid,
      subject_name: updatedName,
      subject_code: testSubjectCode,
      category: 'Core',
      education_level: 'Junior School',
      status: 'Active',
    };

    const updatedResult = await api.updateSubject(subjectToUpdate);

    // 1. Check returned object
    assert.strictEqual(updatedResult.id, testSubjectUuid, 'UUID must be preserved during update');
    assert.strictEqual(updatedResult.subject_name, updatedName);

    // 2. Check local storage
    const localSubjects = api.getSubjects();
    const foundInLocal = localSubjects.find((s) => s.id === testSubjectUuid);
    assert(foundInLocal, 'Updated subject should be in local storage');
    assert.strictEqual(foundInLocal?.subject_name, updatedName);

    // 3. Verify in Supabase directly
    if (client) {
      const { data, error } = await client.from('subjects').select('*').eq('id', testSubjectUuid);
      assert.ifError(error);
      assert(data && data.length > 0, 'Subject must exist in Supabase');
      assert.strictEqual(data[0].subject_name, updatedName);

      // 4. Verify syncFromSupabase preserves the edited name
      await syncFromSupabase({ force: true });
      const afterSync = api.getSubjects();
      const foundAfterSync = afterSync.find((s) => s.id === testSubjectUuid);
      assert.strictEqual(foundAfterSync?.subject_name, updatedName, 'Updated name must persist after syncFromSupabase()');
    }
  });

  // TEST 3: FAILURE HANDLING ON INVALID UPDATE
  await test('TEST 3 — api.updateSubject throws error on non-UUID or invalid update without corrupting storage', async () => {
    const invalidSubject: Subject = {
      id: 'invalid_non_uuid_123',
      subject_name: 'Invalid ID Test',
      subject_code: 'INVALID_ID',
      category: 'Core',
    };

    let errorThrown = false;
    try {
      await api.updateSubject(invalidSubject);
    } catch (err: any) {
      errorThrown = true;
      assert(err.message.includes('Invalid UUID'), 'Expected error message indicating invalid UUID');
    }
    assert(errorThrown, 'api.updateSubject must throw an error when given an invalid non-UUID ID');
  });

  // TEST 4: CLEANUP TEST DATA
  await test('TEST 4 — Clean up test subject record from Supabase and local storage', async () => {
    if (client) {
      const { error } = await client.from('subjects').delete().eq('id', testSubjectUuid);
      assert.ifError(error);
    }
    await syncFromSupabase({ force: true });
    const finalSubjects = api.getSubjects();
    const found = finalSubjects.find((s) => s.id === testSubjectUuid);
    assert(!found, 'Test subject should be cleaned up successfully');
  });

  console.log(`\nLEARNING AREA PERSISTENCE TESTS SUMMARY: ${passed}/${total} PASSED`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
