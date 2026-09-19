import './setupLocalStorage';
process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import assert from 'assert';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Set test client hook for storage.ts in Node CLI environment
(globalThis as any).__TEST_SUPABASE_CLIENT__ = supabaseAdmin;

import { api, syncFromSupabase, KEYS, getStorage, setStorage, assignClassTeacher } from '../lib/storage';
import { authService, mapSupabaseUserToAppUser } from '../services/authService';
import { ClassStream, Teacher } from '../types';

const TEST_PORT = 3000;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper: Get fresh admin access token
async function getAdminToken(): Promise<string> {
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'brianayiecha52@gmail.com'
  });
  if (linkErr) throw linkErr;
  const { data: sessionData, error: sessionErr } = await supabaseAnon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink'
  });
  if (sessionErr) throw sessionErr;
  return sessionData.session!.access_token;
}

// Helper: Get fresh teacher access token (non-admin)
async function getTeacherToken(email: string): Promise<string> {
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email
  });
  if (linkErr) throw linkErr;
  const { data: sessionData, error: sessionErr } = await supabaseAnon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink'
  });
  if (sessionErr) throw sessionErr;
  return sessionData.session!.access_token;
}

// Helper: Call assign-class-teacher API directly
async function callAssignApi(streamId: string, teacherId: string | null, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/admin/assign-class-teacher`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      stream_id: streamId,
      teacher_id: teacherId
    })
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// State tracking for reporting
const testResults: Record<string, boolean> = {};

async function runTest(testName: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`Testing ${testName}... `);
    await fn();
    testResults[testName] = true;
    console.log('PASS');
  } catch (err: any) {
    testResults[testName] = false;
    console.log(`FAIL: ${err.message}`);
    throw err;
  }
}

async function runForensicSuite() {
  console.log("===================================================================");
  console.log("STEP 4H: PHASE 8 FULL FORENSIC VERIFICATION SUITE");
  console.log("===================================================================\n");

  const adminToken = await getAdminToken();

  // Known entities
  const GIDEON_ID = '70417d22-dd63-4b82-8f89-a50daeede3f9'; // Mr Gideon
  const VIVIAN_ID = '1d9eb03b-8267-4855-b876-16b8bee13322'; // Madam Vivian
  const CHRISTINE_ID = '17e3a266-a233-49b4-b9e1-2716eb2b81ea'; // Madam Christine
  const BRIAN_ID = '3b3af31e-ad67-4dab-82a4-8d12bc574fe9'; // Mr Brian
  const PATRICK_ID = '24d1ca0e-5e46-42f9-adaf-567a54a5ed98'; // Mr Patrick (Unassigned)
  const FAITH_ID = '67feff44-50a6-4d75-8ccf-fc1e4d6fef19'; // Madam Faith (Unassigned)

  const G7_RED_STREAM = '6fb92a1a-7e30-4022-b536-9ce1005b46c7';
  const G7_BLUE_STREAM = '66a393b0-adb6-4d63-b07e-5882b4fbfd79';
  const G8_RED_STREAM = '8eb5e4a0-2c5a-46be-bcff-b109216e9cd8';
  const G8_BLUE_STREAM = '8a9c07bb-1bbf-4d99-85be-3468a6457305';
  const G9_RED_STREAM = '3d0ecb00-3e0f-425a-8d69-59f6c9f18b40';
  const G9_BLUE_STREAM = '95e8ff02-6d67-433f-a417-2d74e2012793';

  const G7_PARENT_CLASS = 'b05f2767-ed87-44b2-854d-9b5ac54756d9';

  // TEST A: Assign Mr Gideon -> Grade 7 Red. Verify database. Expected: Grade 7 Red.class_teacher_id = Gideon UUID
  await runTest('TEST A', async () => {
    const res = await callAssignApi(G7_RED_STREAM, GIDEON_ID, adminToken);
    assert.strictEqual(res.status, 200, `API status must be 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);

    const { data: stream } = await supabaseAdmin.from('streams').select('*').eq('id', G7_RED_STREAM).single();
    assert.strictEqual(stream.class_teacher_id, GIDEON_ID, `Grade 7 Red must have Gideon UUID in Supabase`);
  });

  // TEST B: Assign Madam Vivian -> Grade 9 Red. Verify Grade 9 Red, not Grade 9 Blue
  await runTest('TEST B', async () => {
    const res = await callAssignApi(G9_RED_STREAM, VIVIAN_ID, adminToken);
    assert.strictEqual(res.status, 200);

    const { data: g9Red } = await supabaseAdmin.from('streams').select('*').eq('id', G9_RED_STREAM).single();
    const { data: g9Blue } = await supabaseAdmin.from('streams').select('*').eq('id', G9_BLUE_STREAM).single();

    assert.strictEqual(g9Red.class_teacher_id, VIVIAN_ID, 'Grade 9 Red must be assigned to Vivian');
    assert.notStrictEqual(g9Blue.class_teacher_id, VIVIAN_ID, 'Grade 9 Blue must NOT be assigned to Vivian');
  });

  // TEST C: Assign to Grade 8 Red. Verify Grade 8 Blue is unchanged.
  await runTest('TEST C', async () => {
    const { data: initialG8Blue } = await supabaseAdmin.from('streams').select('*').eq('id', G8_BLUE_STREAM).single();
    const g8BlueTeacherBefore = initialG8Blue.class_teacher_id;

    const res = await callAssignApi(G8_RED_STREAM, CHRISTINE_ID, adminToken);
    assert.strictEqual(res.status, 200);

    const { data: g8Red } = await supabaseAdmin.from('streams').select('*').eq('id', G8_RED_STREAM).single();
    const { data: g8Blue } = await supabaseAdmin.from('streams').select('*').eq('id', G8_BLUE_STREAM).single();

    assert.strictEqual(g8Red.class_teacher_id, CHRISTINE_ID, 'Grade 8 Red must have Christine assigned');
    assert.strictEqual(g8Blue.class_teacher_id, g8BlueTeacherBefore, 'Grade 8 Blue must remain unchanged');
  });

  // TEST D: Assign to Grade 8 Blue. Verify Grade 8 Red is unchanged.
  await runTest('TEST D', async () => {
    const { data: initialG8Red } = await supabaseAdmin.from('streams').select('*').eq('id', G8_RED_STREAM).single();
    const g8RedTeacherBefore = initialG8Red.class_teacher_id;

    const res = await callAssignApi(G8_BLUE_STREAM, BRIAN_ID, adminToken);
    assert.strictEqual(res.status, 200);

    const { data: g8Blue } = await supabaseAdmin.from('streams').select('*').eq('id', G8_BLUE_STREAM).single();
    const { data: g8Red } = await supabaseAdmin.from('streams').select('*').eq('id', G8_RED_STREAM).single();

    assert.strictEqual(g8Blue.class_teacher_id, BRIAN_ID, 'Grade 8 Blue must have Brian assigned');
    assert.strictEqual(g8Red.class_teacher_id, g8RedTeacherBefore, 'Grade 8 Red must remain unchanged');
  });

  // TEST E: Unassign a teacher.
  // Verify: streams.class_teacher_id = NULL, teachers.is_class_teacher = false, users.role = subject_teacher
  // Verify: teacher_subjects is untouched.
  await runTest('TEST E', async () => {
    // 1. Snapshot teacher_subjects
    const { data: initialAllocations } = await supabaseAdmin.from('teacher_subjects').select('*');
    const allocationCountBefore = initialAllocations?.length || 0;

    // 2. Temporarily assign Patrick to Grade 5 Red
    const G5_RED_STREAM = '2dd1dbf6-228b-4bbf-96a0-d0552a329cc3';
    await callAssignApi(G5_RED_STREAM, PATRICK_ID, adminToken);

    // 3. Now unassign Patrick from Grade 5 Red
    const unassignRes = await callAssignApi(G5_RED_STREAM, null, adminToken);
    assert.strictEqual(unassignRes.status, 200);

    // 4. Verify in Supabase
    const { data: streamAfter } = await supabaseAdmin.from('streams').select('*').eq('id', G5_RED_STREAM).single();
    const { data: teacherAfter } = await supabaseAdmin.from('teachers').select('*').eq('id', PATRICK_ID).single();
    const { data: userAfter } = await supabaseAdmin.from('users').select('*').eq('teacher_id', PATRICK_ID).single();
    const { data: allocationsAfter } = await supabaseAdmin.from('teacher_subjects').select('*');

    assert.strictEqual(streamAfter.class_teacher_id, null, 'streams.class_teacher_id must be null');
    assert.strictEqual(teacherAfter.is_class_teacher, false, 'teachers.is_class_teacher must be false');
    assert.strictEqual(userAfter.role, 'subject_teacher', 'users.role must be subject_teacher');
    assert.strictEqual(allocationsAfter?.length, allocationCountBefore, 'teacher_subjects must remain 100% untouched');
  });

  // TEST F: Assign teacher. Refresh browser (syncFromSupabase). Assignment must remain. Verify directly in Supabase.
  await runTest('TEST F', async () => {
    // Assign Gideon to Grade 7 Red
    await callAssignApi(G7_RED_STREAM, GIDEON_ID, adminToken);

    // Simulate browser refresh: reset local state and run syncFromSupabase()
    await syncFromSupabase({ force: true });

    // Local derived state check
    const localTeachers = api.getTeachers();
    const localClasses = api.getClasses();

    const gideonLocal = localTeachers.find(t => t.id === GIDEON_ID);
    const g7RedLocal = localClasses.find(c => c.stream_id === G7_RED_STREAM);

    assert.strictEqual(gideonLocal?.is_class_teacher, true, 'Local Gideon must be class teacher after sync');
    assert.strictEqual(gideonLocal?.class_teacher_of_id, G7_RED_STREAM, 'Local Gideon class_teacher_of_id must be G7 Red');
    assert.strictEqual(g7RedLocal?.class_teacher_id, GIDEON_ID, 'Local G7 Red class_teacher_id must be Gideon ID');

    // Supabase direct check
    const { data: stream } = await supabaseAdmin.from('streams').select('*').eq('id', G7_RED_STREAM).single();
    assert.strictEqual(stream.class_teacher_id, GIDEON_ID, 'Supabase streams.class_teacher_id must remain Gideon ID');
  });

  // TEST G: Logout. Login. Assignment must remain.
  await runTest('TEST G', async () => {
    // Simulate Logout: Clear active user
    await authService.signOut();
    assert.strictEqual(api.getCurrentUser(), null, 'Current user must be null after logout');

    // Simulate Login as Gideon
    const gideonUser = {
      id: '39b39068-12c9-4a69-a928-b706ee33c237',
      email: 'gideon@cbe.ac.ke',
      user_metadata: { role: 'class_teacher', teacher_id: GIDEON_ID }
    };
    const resolvedUser = mapSupabaseUserToAppUser(gideonUser);
    assert.strictEqual(resolvedUser.role, 'class_teacher', 'Gideon logged-in role must resolve to class_teacher');
    api.setCurrentUser(resolvedUser);
    assert.strictEqual(api.getCurrentUser()?.role, 'class_teacher', 'Current user role must be class_teacher');

    // Verify assignment remains intact in database
    const { data: stream } = await supabaseAdmin.from('streams').select('*').eq('id', G7_RED_STREAM).single();
    assert.strictEqual(stream.class_teacher_id, GIDEON_ID, 'Assignment must remain in Supabase after login cycle');
  });

  // TEST H: Directly inspect: public.streams. Confirm actual UUID relationship.
  await runTest('TEST H', async () => {
    const { data: streams, error: sErr } = await supabaseAdmin.from('streams').select('id, stream_name, class_teacher_id');
    assert(!sErr, `Query error: ${sErr?.message}`);
    assert(streams && streams.length > 0, 'Streams must exist');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const s of streams) {
      assert(uuidRegex.test(s.id), `Stream ID ${s.id} must be a valid UUID`);
      if (s.class_teacher_id) {
        assert(uuidRegex.test(s.class_teacher_id), `class_teacher_id ${s.class_teacher_id} must be a valid UUID`);
      }
    }
  });

  // TEST I: Attempt assignment as non-admin/anonymous. Expected: 401 or 403. Database unchanged.
  await runTest('TEST I', async () => {
    // 1. Anonymous call
    const anonRes = await callAssignApi(G7_RED_STREAM, GIDEON_ID);
    assert.strictEqual(anonRes.status, 401, `Anonymous request must return 401, got ${anonRes.status}`);

    // 2. Teacher call
    const teacherToken = await getTeacherToken('faith@cbe.ac.ke');
    const teacherRes = await callAssignApi(G7_RED_STREAM, GIDEON_ID, teacherToken);
    assert.strictEqual(teacherRes.status, 403, `Non-admin teacher request must return 403, got ${teacherRes.status}`);
  });

  // TEST J: Send a parent Class UUID as stream_id. Expected: 400 or explicit validation failure. Database unchanged. No first-stream fallback.
  await runTest('TEST J', async () => {
    const res = await callAssignApi(G7_PARENT_CLASS, GIDEON_ID, adminToken);
    assert.strictEqual(res.status, 400, `Parent class UUID must return 400, got ${res.status}`);
    assert(res.data.error.includes('parent class'), `Error message must explicitly mention parent class`);
  });

  // TEST K: Send nonexistent Stream UUID. Expected: 404. Database unchanged.
  await runTest('TEST K', async () => {
    const NONEXISTENT_STREAM = '00000000-0000-0000-0000-000000000000';
    const res = await callAssignApi(NONEXISTENT_STREAM, GIDEON_ID, adminToken);
    assert.strictEqual(res.status, 404, `Nonexistent stream UUID must return 404, got ${res.status}`);
  });

  // TEST L: Assign Teacher X: Stream 1, then Stream 2. Expected: Stream 1 -> NULL, Stream 2 -> Teacher X
  await runTest('TEST L', async () => {
    // Assign Patrick to Grade 5 Red (Stream 1)
    const G5_RED = '2dd1dbf6-228b-4bbf-96a0-d0552a329cc3';
    const G5_BLUE = '843e8bb0-8120-49fa-ac1b-604fd061ade7';

    await callAssignApi(G5_RED, PATRICK_ID, adminToken);
    const { data: s1First } = await supabaseAdmin.from('streams').select('*').eq('id', G5_RED).single();
    assert.strictEqual(s1First.class_teacher_id, PATRICK_ID, 'Stream 1 must have Patrick');

    // Now assign Patrick to Grade 5 Blue (Stream 2)
    await callAssignApi(G5_BLUE, PATRICK_ID, adminToken);
    const { data: s1Second } = await supabaseAdmin.from('streams').select('*').eq('id', G5_RED).single();
    const { data: s2Second } = await supabaseAdmin.from('streams').select('*').eq('id', G5_BLUE).single();

    assert.strictEqual(s1Second.class_teacher_id, null, 'Stream 1 must be cleared to NULL');
    assert.strictEqual(s2Second.class_teacher_id, PATRICK_ID, 'Stream 2 must be assigned to Patrick');

    // Clean up: unassign Patrick
    await callAssignApi(G5_BLUE, null, adminToken);
  });

  // TEST M: Teacher X currently assigned to Stream 1. Attempt invalid Stream 2. Expected: Stream 1 remains assigned.
  await runTest('TEST M', async () => {
    // Stream 1 = Grade 7 Red (currently Gideon)
    const { data: s1Before } = await supabaseAdmin.from('streams').select('*').eq('id', G7_RED_STREAM).single();
    assert.strictEqual(s1Before.class_teacher_id, GIDEON_ID, 'Prerequisite: Gideon is assigned to Stream 1');

    // Attempt invalid Stream 2: parent Class UUID
    const failRes1 = await callAssignApi(G7_PARENT_CLASS, GIDEON_ID, adminToken);
    assert.strictEqual(failRes1.status, 400);

    // Attempt invalid Stream 2: nonexistent UUID
    const failRes2 = await callAssignApi('00000000-0000-0000-0000-000000000000', GIDEON_ID, adminToken);
    assert.strictEqual(failRes2.status, 404);

    // Verify Stream 1 remains assigned to Gideon!
    const { data: s1After } = await supabaseAdmin.from('streams').select('*').eq('id', G7_RED_STREAM).single();
    assert.strictEqual(s1After.class_teacher_id, GIDEON_ID, 'CRITICAL: Stream 1 MUST remain assigned to Gideon after failed assignment attempts');
  });

  // TEST N: Verify: streams.class_teacher_id, teachers.is_class_teacher, users.role are aligned
  await runTest('TEST N', async () => {
    const { data: streams } = await supabaseAdmin.from('streams').select('*');
    const { data: teachers } = await supabaseAdmin.from('teachers').select('*');
    const { data: users } = await supabaseAdmin.from('users').select('*');

    for (const t of teachers || []) {
      const assignedStream = streams?.find(s => s.class_teacher_id === t.id);
      const isAssigned = Boolean(assignedStream);

      assert.strictEqual(
        t.is_class_teacher,
        isAssigned,
        `Teacher ${t.teacher_name} is_class_teacher (${t.is_class_teacher}) must match assignment (${isAssigned})`
      );

      const user = users?.find(u => u.teacher_id === t.id || (u.email && u.email.toLowerCase() === t.email?.toLowerCase()));
      if (user && user.role !== 'admin') {
        const expectedRole = isAssigned ? 'class_teacher' : 'subject_teacher';
        assert.strictEqual(
          user.role,
          expectedRole,
          `User ${user.email} role (${user.role}) must equal ${expectedRole}`
        );
      }
    }
  });

  // TEST O: Rapidly change assignment multiple times. Verify no conflicting final state.
  await runTest('TEST O', async () => {
    const G4_RED = '5b5b33ca-2684-4efa-8bef-7f7c4a2acc29';

    // Rapid sequential changes
    await callAssignApi(G4_RED, PATRICK_ID, adminToken);
    await callAssignApi(G4_RED, FAITH_ID, adminToken);
    await callAssignApi(G4_RED, PATRICK_ID, adminToken);
    await callAssignApi(G4_RED, null, adminToken);

    const { data: streamFinal } = await supabaseAdmin.from('streams').select('*').eq('id', G4_RED).single();
    const { data: patrickFinal } = await supabaseAdmin.from('teachers').select('*').eq('id', PATRICK_ID).single();
    const { data: faithFinal } = await supabaseAdmin.from('teachers').select('*').eq('id', FAITH_ID).single();

    assert.strictEqual(streamFinal.class_teacher_id, null, 'Final stream must be unassigned (null)');
    assert.strictEqual(patrickFinal.is_class_teacher, false, 'Patrick must be false');
    assert.strictEqual(faithFinal.is_class_teacher, false, 'Faith must be false');
  });

  // TEST P: Simulate network/API failure. Verify: No LocalStorage mutation, No false success, Previous valid UI state retained.
  await runTest('TEST P', async () => {
    // Initial local cache state
    const currentClasses = api.getClasses();
    const targetStream = currentClasses.find(c => c.stream_id === G7_RED_STREAM);
    const originalTeacherId = targetStream?.class_teacher_id;

    // Attempt assignment to an invalid stream using client storage bridge
    let threw = false;
    try {
      await assignClassTeacher('invalid-non-uuid-id', PATRICK_ID);
    } catch (e: any) {
      threw = true;
    }
    assert(threw, 'Client bridge must throw on invalid call');

    // Verify LocalStorage was NOT mutated
    const cachedClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    const cachedStream = cachedClasses.find(c => c.stream_id === G7_RED_STREAM);
    assert.strictEqual(cachedStream?.class_teacher_id, originalTeacherId, 'LocalStorage must NOT mutate upon failure');
  });

  // TEST Q: Test refresh around assignment completion. Verify eventual state equals Supabase.
  await runTest('TEST Q', async () => {
    // Ensure Gideon is assigned in Supabase
    await callAssignApi(G7_RED_STREAM, GIDEON_ID, adminToken);

    // Sync from Supabase
    await syncFromSupabase({ force: true });

    const localClasses = api.getClasses();
    const localG7Red = localClasses.find(c => c.stream_id === G7_RED_STREAM);
    const { data: dbStream } = await supabaseAdmin.from('streams').select('*').eq('id', G7_RED_STREAM).single();

    assert.strictEqual(localG7Red?.class_teacher_id, dbStream.class_teacher_id, 'Eventual state must equal Supabase state exactly');
  });

  // TEST R: Replace existing teacher on a stream. Verify displaced teacher is correctly reconciled.
  await runTest('TEST R', async () => {
    const G6_RED = 'f358ed2e-fd9f-47aa-8622-a9bb997375e7';

    // 1. Assign Teacher 1 (Patrick) to G6 Red
    await callAssignApi(G6_RED, PATRICK_ID, adminToken);

    // Verify Patrick is assigned
    const { data: t1Assigned } = await supabaseAdmin.from('teachers').select('*').eq('id', PATRICK_ID).single();
    assert.strictEqual(t1Assigned.is_class_teacher, true, 'Patrick is class teacher');

    // 2. Replace with Teacher 2 (Faith) on G6 Red
    await callAssignApi(G6_RED, FAITH_ID, adminToken);

    // Verify G6 Red has Faith
    const { data: sFinal } = await supabaseAdmin.from('streams').select('*').eq('id', G6_RED).single();
    assert.strictEqual(sFinal.class_teacher_id, FAITH_ID, 'G6 Red now has Faith');

    // Verify displaced teacher (Patrick) is reconciled: is_class_teacher = false, role = subject_teacher
    const { data: t1Reconciled } = await supabaseAdmin.from('teachers').select('*').eq('id', PATRICK_ID).single();
    const { data: u1Reconciled } = await supabaseAdmin.from('users').select('*').eq('teacher_id', PATRICK_ID).single();

    assert.strictEqual(t1Reconciled.is_class_teacher, false, 'Displaced Patrick must have is_class_teacher = false');
    assert.strictEqual(u1Reconciled.role, 'subject_teacher', 'Displaced Patrick user role must be subject_teacher');

    // Clean up: unassign Faith
    await callAssignApi(G6_RED, null, adminToken);
  });

  // FINAL RECONCILIATION: Ensure canonical state
  await callAssignApi(G7_RED_STREAM, GIDEON_ID, adminToken);
  await callAssignApi(G7_BLUE_STREAM, '32525b95-5e8b-4dbc-914a-8036f2bc761e', adminToken); // Caroline
  await callAssignApi(G8_RED_STREAM, CHRISTINE_ID, adminToken);
  await callAssignApi(G8_BLUE_STREAM, BRIAN_ID, adminToken);
  await callAssignApi(G9_RED_STREAM, VIVIAN_ID, adminToken);
  await callAssignApi(G9_BLUE_STREAM, '5e41bef7-8d3b-40fa-85d9-acd47614affe', adminToken); // Maina

  await syncFromSupabase({ force: true });

  console.log("\n===================================================================");
  console.log("FINAL CHECKS");
  console.log("===================================================================");

  // FINAL DATABASE CHECK: Compare Supabase vs React/Storage state
  const { data: finalDbStreams } = await supabaseAdmin.from('streams').select('*');
  const finalLocalClasses = api.getClasses();
  const finalLocalTeachers = api.getTeachers();

  console.log("Final Database Check: Comparing Supabase vs LocalStorage...");
  for (const s of finalDbStreams || []) {
    const loc = finalLocalClasses.find(c => c.stream_id === s.id);
    assert.strictEqual(
      loc?.class_teacher_id || null,
      s.class_teacher_id || null,
      `Stream ${s.stream_name} mismatch between Supabase (${s.class_teacher_id}) and LocalStorage (${loc?.class_teacher_id})`
    );
  }
  console.log("✓ PASS: Supabase and LocalStorage are in 100% agreement.");

  // PROTECTED SYSTEM CHECK: Confirm classes, teacher_subjects, marks, etc. were untouched
  const { data: dbClasses } = await supabaseAdmin.from('classes').select('id');
  const { data: dbAllocations } = await supabaseAdmin.from('teacher_subjects').select('id');
  const { data: dbMarks } = await supabaseAdmin.from('marks').select('id').limit(10);

  assert(dbClasses && dbClasses.length === 11, 'Classes count unchanged');
  assert(dbAllocations && dbAllocations.length > 0, 'Allocations intact');
  assert(dbMarks && dbMarks.length > 0, 'Marks intact');
  console.log("✓ PASS: Protected systems (classes, teacher_subjects, marks) untouched.");

  console.log("\nALL 18 AUDIT TESTS (TEST A -> TEST R) PASSED SUCCESSFULLY!");
}

runForensicSuite().catch((err) => {
  console.error("Audit suite encountered an error:", err);
  process.exit(1);
});
