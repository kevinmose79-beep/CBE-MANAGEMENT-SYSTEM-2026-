import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { api, createSupabaseClient, generateUUID, syncFromSupabase } from '../lib/storage';
import { ClassStream, Teacher, Student } from '../types';

console.log('=== RUNNING CLASS vs STREAM IDENTITY SEPARATION TESTS ===');

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
  api.setCurrentUser({ id: 'admin_test', name: 'Admin Test', role: 'admin', email: 'admin@test.com' });

  const parentClassId = generateUUID();
  const streamEastId = generateUUID();
  const streamWestId = generateUUID();

  // Setup test environment in Supabase / Local storage
  // Create Grade 7 parent class with 2 streams: Grade 7 East and Grade 7 West
  if (client) {
    // Insert parent class into public.classes
    const { error: cErr } = await client.from('classes').insert([
      {
        id: parentClassId,
        class_name: 'Grade 7 Test',
        grade_level: 7,
        capacity: 40,
      },
    ]);
    if (cErr) console.warn('Supabase class insert notice:', cErr.message);

    // Insert streams into public.streams
    const { error: s1Err } = await client.from('streams').insert([
      {
        id: streamEastId,
        class_id: parentClassId,
        stream_name: 'East',
        capacity: 40,
      },
      {
        id: streamWestId,
        class_id: parentClassId,
        stream_name: 'West',
        capacity: 40,
      },
    ]);
    if (s1Err) console.warn('Supabase stream insert notice:', s1Err.message);

    await syncFromSupabase();
  }

  // TEST A: DELETE STREAM
  await test('Test A — Delete Stream "Grade 7 West" deletes only West stream, preserving Grade 7, East stream, and learners', async () => {
    // Verify both East and West exist locally
    const classesBefore = api.getClasses();
    const eastBefore = classesBefore.find((c) => c.stream_id === streamEastId);
    const westBefore = classesBefore.find((c) => c.stream_id === streamWestId);

    assert(eastBefore, 'Grade 7 East stream should exist initially');
    assert(westBefore, 'Grade 7 West stream should exist initially');

    // Execute deleteStream on West stream only
    await api.deleteStream(streamWestId);

    // Local checks
    const classesAfter = api.getClasses();
    const eastAfter = classesAfter.find((c) => c.stream_id === streamEastId);
    const westAfter = classesAfter.find((c) => c.stream_id === streamWestId);
    const parentClassExists = classesAfter.some((c) => c.id === parentClassId);

    assert(!westAfter, 'Grade 7 West stream must be deleted from local storage');
    assert(eastAfter, 'Grade 7 East stream must be preserved in local storage');
    assert(parentClassExists, 'Grade 7 parent class must remain in local storage for East stream');

    // Supabase checks
    if (client) {
      const { data: westDb } = await client.from('streams').select('*').eq('id', streamWestId);
      assert.strictEqual(westDb?.length || 0, 0, 'West stream row must be deleted from Supabase streams table');

      const { data: eastDb } = await client.from('streams').select('*').eq('id', streamEastId);
      assert.strictEqual(eastDb?.length || 0, 1, 'East stream row must remain in Supabase streams table');

      const { data: classDb } = await client.from('classes').select('*').eq('id', parentClassId);
      assert.strictEqual(classDb?.length || 0, 1, 'Parent class row must remain in Supabase classes table');
    }
  });

  // TEST C: ID SAFETY — Passing Stream ID to deleteClass must NOT delete parent class
  await test('Test C — Passing a Stream ID to deleteClass() throws or fails safely and does NOT delete parent class', async () => {
    // Attempting to pass streamEastId to deleteClass
    // Since streamEastId is NOT a parent class ID, deleteClass should not match c.id or delete parent class
    await api.deleteClass(streamEastId);

    if (client) {
      const { data: classDb } = await client.from('classes').select('*').eq('id', parentClassId);
      assert.strictEqual(classDb?.length || 0, 1, 'Parent class must NOT be deleted when stream ID is passed to deleteClass');

      const { data: eastDb } = await client.from('streams').select('*').eq('id', streamEastId);
      assert.strictEqual(eastDb?.length || 0, 1, 'Stream must NOT be deleted when stream ID is passed to deleteClass');
    }
  });

  // TEST D: MISSING STREAM ID — Attempting to delete a stream without valid stream_id fails safely
  await test('Test D — Attempting to delete a stream with invalid/missing stream_id fails safely without deleting parent class', async () => {
    let errorCaught = false;
    try {
      await api.deleteStream('');
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('valid, non-empty streamId'), 'Error message should clearly state invalid streamId requirement');
    }
    assert(errorCaught, 'deleteStream must throw error on empty streamId');

    let nullErrorCaught = false;
    try {
      await api.deleteStream(null as any);
    } catch (err: any) {
      nullErrorCaught = true;
    }
    assert(nullErrorCaught, 'deleteStream must throw error on null streamId');

    // Ensure parent class and remaining streams were untouched
    if (client) {
      const { data: classDb } = await client.from('classes').select('*').eq('id', parentClassId);
      assert.strictEqual(classDb?.length || 0, 1, 'Parent class must remain intact');
    }
  });

  // TEST B: DELETE CLASS — Deleting parent class intentionally removes parent class and all streams
  await test('Test B — Deleting parent class Grade 7 via deleteClass(parentClassId) removes class and streams', async () => {
    await api.deleteClass(parentClassId);

    // Local checks
    const classesAfter = api.getClasses();
    const remainingClass = classesAfter.find((c) => c.id === parentClassId || c.stream_id === streamEastId);
    assert(!remainingClass, 'Parent class and all its streams must be removed locally');

    // Supabase checks
    if (client) {
      const { data: classDb } = await client.from('classes').select('*').eq('id', parentClassId);
      assert.strictEqual(classDb?.length || 0, 0, 'Parent class row must be deleted from Supabase');

      const { data: streamDb } = await client.from('streams').select('*').eq('class_id', parentClassId);
      assert.strictEqual(streamDb?.length || 0, 0, 'All streams under parent class must be deleted from Supabase');
    }
  });

  // TEST E: APPLICATION SEARCH — Verify no ambiguous stream deletion paths passing parent class ID
  await test('Test E — Verify codebase has no stream-deletion calls passing parent class ID (c.id)', async () => {
    const compContent = fs.readFileSync(path.join(process.cwd(), 'src/components/ClassSubjectManagement.tsx'), 'utf8');

    // Check that stream delete button in modal uses deletingClass.stream_id, not deletingClass.id
    assert(
      compContent.includes('onDeleteStream(deletingClass.stream_id)') || compContent.includes('api.deleteStream(deletingClass.stream_id)'),
      'Stream deletion must explicitly pass stream_id'
    );
    assert(
      !compContent.includes('onDeleteClass(deletingClass.id)') || !compContent.includes('Delete Class Stream'),
      'Stream deletion modal must not call onDeleteClass with deletingClass.id'
    );

    const storageContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/storage.ts'), 'utf8');
    assert(storageContent.includes('deleteStream: async (streamId: string)'), 'storage.ts must expose dedicated deleteStream function');
    assert(
      !storageContent.includes('c.id === id || c.stream_id === id') && !storageContent.includes('c.id !== id && c.stream_id !== id'),
      'storage.ts must not blur class ID and stream ID in deletion functions'
    );
  });

  console.log(`\nCLASS vs STREAM IDENTITY SEPARATION SUMMARY: ${passed}/${total} PASSED`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
