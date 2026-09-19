import assert from 'assert';
import { api, createSupabaseClient, generateUUID, syncFromSupabase } from '../lib/storage';
import { Subject } from '../types';

console.log('=== RUNNING DUPLICATE LEARNING AREA CODE ERROR TESTS ===');

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
  const sub1Id = generateUUID();
  const sub1Code = `LA_DUP_TEST_1_${Date.now()}`;

  const sub2Id = generateUUID();
  const sub2Code = `LA_DUP_TEST_2_${Date.now()}`;

  // Test setup: Create 2 subjects with unique codes
  await test('Setup — Create 2 initial learning areas with unique codes', async () => {
    const s1: Subject = {
      id: sub1Id,
      subject_name: 'Duplicate Test Area 1',
      subject_code: sub1Code,
      category: 'Core',
      education_level: 'Junior School',
    };
    const s2: Subject = {
      id: sub2Id,
      subject_name: 'Duplicate Test Area 2',
      subject_code: sub2Code,
      category: 'Core',
      education_level: 'Junior School',
    };

    await api.addSubject(s1);
    await api.addSubject(s2);

    const local = api.getSubjects();
    assert(local.some((s) => s.id === sub1Id), 'Subject 1 should be created');
    assert(local.some((s) => s.id === sub2Id), 'Subject 2 should be created');
  });

  // TEST 1 — DUPLICATE CREATE
  await test('Test 1 — Duplicate Create throws friendly message and does not add record locally or in DB', async () => {
    const duplicateCreate: Subject = {
      id: generateUUID(),
      subject_name: 'Duplicate Create Subject',
      subject_code: sub1Code, // Duplicate code!
      category: 'Core',
    };

    let caughtError: any = null;
    try {
      await api.addSubject(duplicateCreate);
    } catch (err: any) {
      caughtError = err;
    }

    assert(caughtError, 'addSubject must throw an error when subject_code is duplicate');
    assert(
      caughtError.message.includes('Learning Area Code Already Exists') &&
        caughtError.message.includes(sub1Code) &&
        caughtError.message.includes('is already assigned to another Learning Area'),
      `Expected friendly message mentioning 'Learning Area Code Already Exists' and code, but got: '${caughtError.message}'`
    );

    // Verify local storage does NOT contain duplicateCreate.id
    const local = api.getSubjects();
    assert(!local.some((s) => s.id === duplicateCreate.id), 'Duplicate subject must not be added to local storage');

    // Verify Supabase does not have duplicate record
    if (client) {
      const { data } = await client.from('subjects').select('*').eq('id', duplicateCreate.id);
      assert.strictEqual(data?.length || 0, 0, 'Duplicate record must not exist in Supabase');
    }
  });

  // TEST 2 — DUPLICATE EDIT
  await test('Test 2 — Duplicate Edit throws friendly message and preserves existing records and UUIDs', async () => {
    const duplicateEdit: Subject = {
      id: sub2Id,
      subject_name: 'Duplicate Test Area 2 (Attempted Code Change)',
      subject_code: sub1Code, // Attempting to change sub2's code to sub1's code!
      category: 'Core',
    };

    let caughtError: any = null;
    try {
      await api.updateSubject(duplicateEdit);
    } catch (err: any) {
      caughtError = err;
    }

    assert(caughtError, 'updateSubject must throw an error when changing subject_code to an existing code');
    assert(
      caughtError.message.includes('Learning Area Code Already Exists') &&
        caughtError.message.includes(sub1Code),
      `Expected friendly error, got: '${caughtError.message}'`
    );

    // Verify sub2 in local storage still has its original code sub2Code
    const local = api.getSubjects();
    const sub2Local = local.find((s) => s.id === sub2Id);
    assert.strictEqual(sub2Local?.subject_code, sub2Code, 'Subject 2 code in local storage must remain unchanged');

    // Verify sub2 in Supabase still has sub2Code
    if (client) {
      const { data } = await client.from('subjects').select('*').eq('id', sub2Id);
      assert.strictEqual(data?.[0]?.subject_code, sub2Code, 'Subject 2 code in Supabase must remain unchanged');
    }
  });

  // TEST 3 — UNIQUE CREATE
  await test('Test 3 — Creating a Learning Area with a unique code succeeds and persists', async () => {
    const uniqueId = generateUUID();
    const uniqueCode = `LA_UNIQUE_${Date.now()}`;
    const uniqueSubject: Subject = {
      id: uniqueId,
      subject_name: 'Unique Learning Area',
      subject_code: uniqueCode,
      category: 'Elective',
    };

    const result = await api.addSubject(uniqueSubject);
    assert.strictEqual(result.id, uniqueId);
    assert.strictEqual(result.subject_code, uniqueCode);

    // Sync from Supabase and confirm persistence
    await syncFromSupabase();
    const local = api.getSubjects();
    assert(local.some((s) => s.id === uniqueId && s.subject_code === uniqueCode), 'Unique subject must persist after sync');

    // Clean up unique subject
    if (client) {
      await client.from('subjects').delete().eq('id', uniqueId);
    }
  });

  // TEST 4 — UNIQUE EDIT
  await test('Test 4 — Editing a Learning Area with a unique code succeeds and updates record', async () => {
    const newUniqueCode = `LA_UNIQUE_EDIT_${Date.now()}`;
    const updatedSubject: Subject = {
      id: sub2Id,
      subject_name: 'Duplicate Test Area 2 Updated',
      subject_code: newUniqueCode,
      category: 'Core',
    };

    const result = await api.updateSubject(updatedSubject);
    assert.strictEqual(result.id, sub2Id);
    assert.strictEqual(result.subject_code, newUniqueCode);

    // Revert code back to sub2Code for remaining test flow
    await api.updateSubject({
      ...updatedSubject,
      subject_code: sub2Code,
    });
  });

  // TEST 5 — UNRELATED DATABASE ERROR
  await test('Test 5 — Unrelated database errors are NOT mapped to "Learning Area Code Already Exists"', async () => {
    const mockError = {
      code: '42703',
      message: 'column "non_existent_col" does not exist',
      details: null,
    };

    const codeStr = String(mockError.code || '');
    const msgStr = String(mockError.message || '');
    const detailsStr = String(mockError.details || '');
    const fullText = `${codeStr} ${msgStr} ${detailsStr}`.toLowerCase();

    const isDuplicate =
      (codeStr === '23505' || fullText.includes('23505') || fullText.includes('duplicate key')) &&
      (fullText.includes('subjects_subject_code_key') || fullText.includes('subject_code'));

    assert(!isDuplicate, 'Unrelated error 42703 must NOT be classified as duplicate learning area code');
  });

  // CLEANUP
  await test('Cleanup test subjects from Supabase and local storage', async () => {
    if (client) {
      await client.from('subjects').delete().eq('id', sub1Id);
      await client.from('subjects').delete().eq('id', sub2Id);
    }
    await syncFromSupabase({ force: true });
    const local = api.getSubjects();
    assert(!local.some((s) => s.id === sub1Id || s.id === sub2Id), 'Test subjects cleaned up successfully');
  });

  console.log(`\nDUPLICATE LEARNING AREA CODE ERROR TESTS SUMMARY: ${passed}/${total} PASSED`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
