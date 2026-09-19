import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * FORENSIC VERIFICATION SUITE:
 * Teacher Management - Elimination of Class ID vs Stream ID Confusion
 */

async function runTeacherClassStreamAudit() {
  console.log('=== RUNNING TEACHER MANAGEMENT CLASS vs STREAM AUDIT ===');

  const url = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  assert(url, 'Supabase URL must be provided');
  assert(serviceKey, 'Supabase Key must be provided');

  const supabase = createClient(url, serviceKey);

  // 1. Fetch live classes, streams, and teachers from Supabase
  const { data: dbClasses, error: clsErr } = await supabase.from('classes').select('*');
  assert(!clsErr && dbClasses, 'Failed to fetch classes from Supabase');

  const { data: dbStreams, error: stmErr } = await supabase.from('streams').select('*');
  assert(!stmErr && dbStreams, 'Failed to fetch streams from Supabase');

  const { data: dbTeachers, error: tchErr } = await supabase.from('teachers').select('*');
  assert(!tchErr && dbTeachers, 'Failed to fetch teachers from Supabase');

  // Build the frontend ClassStream representation exactly as storage.ts generates it
  const classStreams = [];
  for (const c of dbClasses) {
    const matchingStreams = dbStreams.filter((s) => s.class_id === c.id);
    if (matchingStreams.length > 0) {
      for (const st of matchingStreams) {
        classStreams.push({
          id: c.id,                    // Class UUID (e.g. Grade 7)
          stream_id: st.id,            // Stream UUID (e.g. Grade 7 Red)
          class_name: c.class_name,
          stream: st.stream_name,
          education_level: c.education_level,
          class_teacher_id: st.class_teacher_id || undefined,
        });
      }
    } else {
      classStreams.push({
        id: c.id,
        class_name: c.class_name,
        stream: '',
        education_level: c.education_level,
        class_teacher_id: undefined,
      });
    }
  }

  // --- TEST 1: Mr. Gideon (Grade 7 Red - 2nd stream in Grade 7) ---
  console.log('\n--- Test 1: Mr. Gideon (Grade 7 Red) Resolution ---');
  const gideon = dbTeachers.find((t) => t.teacher_name.toLowerCase().includes('gideon'));
  assert(gideon, 'Mr Gideon must exist in database');

  const gideonStream = dbStreams.find((s) => s.class_teacher_id === gideon.id);
  assert(gideonStream, 'Mr Gideon must be assigned to a stream in Supabase');
  assert.strictEqual(gideonStream.stream_name, 'Red', 'Mr Gideon stream must be Red in Supabase');

  // Simulate TeacherManagement openEditTeacherModal matching logic
  const gideonMatchedStream = classStreams.find(
    (c) =>
      c.class_teacher_id === gideon.id ||
      (gideon.class_teacher_of_id &&
        ((c.stream_id && c.stream_id === gideon.class_teacher_of_id) ||
          (!c.stream_id && c.id === gideon.class_teacher_of_id) ||
          (!c.stream && gideon.class_teacher_of_id === c.class_name)))
  );
  assert(gideonMatchedStream, 'Mr Gideon stream must be found');
  assert.strictEqual(gideonMatchedStream.stream, 'Red', 'Matched stream name must be Red');
  assert.strictEqual(gideonMatchedStream.stream_id, gideonStream.id, 'Matched stream_id must equal Supabase stream ID');

  const editClassStreamId = gideonMatchedStream.stream_id || gideonMatchedStream.id;
  assert.strictEqual(editClassStreamId, gideonStream.id, 'editClassStreamId must be stream UUID, NOT parent class UUID');
  assert.notStrictEqual(editClassStreamId, gideonMatchedStream.id, 'editClassStreamId must NOT be parent class UUID');

  // Verify badge rendering lookup
  const badgeStream = classStreams.find(
    (c) => (c.stream_id && c.stream_id === editClassStreamId) || c.id === editClassStreamId
  );
  assert.strictEqual(badgeStream?.stream, 'Red', 'Badge must display "Red", not "Blue"');

  // Verify dropdown selection matching
  const grade7Streams = classStreams.filter((c) => c.class_name === 'Grade 7');
  const dropdownSelected = grade7Streams.find((c) => (c.stream_id || c.id) === editClassStreamId);
  assert.strictEqual(dropdownSelected?.stream, 'Red', 'Dropdown selected option must be Red');
  console.log('✓ PASS: Mr. Gideon resolves to Grade 7 Red with stream UUID');

  // --- TEST 2: Madam Vivian (Grade 9 Red - 2nd stream in Grade 9) ---
  console.log('\n--- Test 2: Madam Vivian (Grade 9 Red) Resolution ---');
  const vivian = dbTeachers.find((t) => t.teacher_name.toLowerCase().includes('vivian'));
  assert(vivian, 'Madam Vivian must exist in database');

  const vivianStream = dbStreams.find((s) => s.class_teacher_id === vivian.id);
  assert(vivianStream, 'Madam Vivian must be assigned to a stream in Supabase');
  assert.strictEqual(vivianStream.stream_name, 'Red', 'Madam Vivian stream must be Red in Supabase');

  const vivianMatchedStream = classStreams.find(
    (c) =>
      c.class_teacher_id === vivian.id ||
      (vivian.class_teacher_of_id &&
        ((c.stream_id && c.stream_id === vivian.class_teacher_of_id) ||
          (!c.stream_id && c.id === vivian.class_teacher_of_id) ||
          (!c.stream && vivian.class_teacher_of_id === c.class_name)))
  );
  assert.strictEqual(vivianMatchedStream?.stream, 'Red');
  const vivianEditStreamId = vivianMatchedStream?.stream_id || vivianMatchedStream?.id;
  assert.strictEqual(vivianEditStreamId, vivianStream.id);
  console.log('✓ PASS: Madam Vivian resolves to Grade 9 Red with stream UUID');

  // --- TEST 3: Madam Caroline (Grade 7 Blue - 1st stream in Grade 7) ---
  console.log('\n--- Test 3: Madam Caroline (Grade 7 Blue) Resolution ---');
  const caroline = dbTeachers.find((t) => t.teacher_name.toLowerCase().includes('caroline'));
  assert(caroline, 'Madam Caroline must exist in database');
  const carolineStream = dbStreams.find((s) => s.class_teacher_id === caroline.id);
  assert(carolineStream, 'Madam Caroline must be assigned to a stream in Supabase');
  assert.strictEqual(carolineStream.stream_name, 'Blue', 'Madam Caroline stream must be Blue in Supabase');

  const carolineMatchedStream = classStreams.find(
    (c) =>
      c.class_teacher_id === caroline.id ||
      (caroline.class_teacher_of_id &&
        ((c.stream_id && c.stream_id === caroline.class_teacher_of_id) ||
          (!c.stream_id && c.id === caroline.class_teacher_of_id) ||
          (!c.stream && caroline.class_teacher_of_id === c.class_name)))
  );
  assert.strictEqual(carolineMatchedStream?.stream, 'Blue');
  assert.strictEqual(carolineMatchedStream?.stream_id, carolineStream.id);
  console.log('✓ PASS: Madam Caroline resolves to Grade 7 Blue with stream UUID');

  // --- TEST 4: Non-interference between streams of same class ---
  console.log('\n--- Test 4: Verify distinct identity for streams sharing the same parent class ---');
  assert.strictEqual(gideonMatchedStream.id, carolineMatchedStream.id, 'Both Grade 7 streams share the same parent class ID');
  assert.notStrictEqual(gideonMatchedStream.stream_id, carolineMatchedStream.stream_id, 'Streams have completely distinct stream IDs');
  console.log(`Parent Class ID: ${gideonMatchedStream.id}`);
  console.log(`Grade 7 Blue Stream ID: ${carolineMatchedStream.stream_id}`);
  console.log(`Grade 7 Red Stream ID:  ${gideonMatchedStream.stream_id}`);
  console.log('✓ PASS: Stream IDs are distinct and never conflated with parent class ID');

  // --- TEST 5: Verify all live class teachers in Supabase ---
  console.log('\n--- Test 5: Verify all live class teachers in Supabase match 100% ---');
  let verifiedCount = 0;
  for (const t of dbTeachers) {
    const st = dbStreams.find((s) => s.class_teacher_id === t.id);
    if (!st) continue;

    const matched = classStreams.find(
      (c) =>
        c.class_teacher_id === t.id ||
        (t.class_teacher_of_id &&
          ((c.stream_id && c.stream_id === t.class_teacher_of_id) ||
            (!c.stream_id && c.id === t.class_teacher_of_id) ||
            (!c.stream && t.class_teacher_of_id === c.class_name)))
    );

    assert(matched, `Teacher ${t.teacher_name} must have a matched class stream`);
    assert.strictEqual(matched.stream_id, st.id, `Teacher ${t.teacher_name} stream_id must match Supabase streams.id`);
    assert.strictEqual(matched.stream, st.stream_name, `Teacher ${t.teacher_name} stream_name must match`);
    verifiedCount++;
  }
  console.log(`✓ PASS: All ${verifiedCount} class teachers in database match their exact assigned stream`);

  console.log('\n=== ALL AUDIT CHECKS PASSED WITH 100% SUCCESS ===');
}

runTeacherClassStreamAudit().catch((err) => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});
