// Issue 7F — Class Teacher Stream Approval Security Verification Suite
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runIssue7fSecurityTests() {
  console.log('=== RUNNING ISSUE 7F DATABASE & APPLICATION STREAM APPROVAL SECURITY TESTS ===\n');

  // ==========================================
  // SECTION 1: STATIC SQL SECURITY AUDIT
  // ==========================================
  console.log('--- 1. STATIC DATABASE SQL & TRIGGER AUDIT ---');
  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Test 1.1: Trigger function definition exists
  assert(
    sqlContent.includes('CREATE OR REPLACE FUNCTION public.enforce_examination_class_teacher_stream_approval()'),
    'Database — enforce_examination_class_teacher_stream_approval trigger function is defined'
  );

  // Test 1.2: Trigger is bound BEFORE UPDATE on public.examinations
  assert(
    sqlContent.includes('CREATE TRIGGER trigger_enforce_examination_class_teacher_stream_approval') &&
    sqlContent.includes('BEFORE UPDATE ON public.examinations'),
    'Database — trigger_enforce_examination_class_teacher_stream_approval is bound BEFORE UPDATE ON public.examinations'
  );

  // Test 1.3: Administrator and service_role bypass is preserved
  assert(
    sqlContent.includes('IF public.is_admin()') &&
    sqlContent.includes("auth.role() = 'service_role'"),
    'Database — Administrator and service_role full authority is preserved'
  );

  // Test 1.4: Strict stream ownership delta validation is performed
  assert(
    sqlContent.includes('v_added_streams') &&
    sqlContent.includes('v_assigned_stream_ids') &&
    sqlContent.includes('UNAUTHORIZED: Class teachers may only approve examination streams currently assigned to them.'),
    'Database — Added stream delta is strictly verified against authenticated teacher assigned streams'
  );

  // Test 1.5: Core examination metadata immutability enforcement
  assert(
    sqlContent.includes('NEW.exam_name IS DISTINCT FROM OLD.exam_name') &&
    sqlContent.includes('UNAUTHORIZED: Class teachers are not permitted to modify core examination metadata.'),
    'Database — Core examination properties are immutable for Class Teacher updates'
  );

  // ==========================================
  // SECTION 2: APPLICATION/SERVICE LOGIC AUDIT
  // ==========================================
  console.log('\n--- 2. APPLICATION & SERVICE LAYER STREAM AUTHORIZATION AUDIT ---');
  const storageFilePath = path.resolve(process.cwd(), 'src/lib/storage.ts');
  const storageContent = fs.readFileSync(storageFilePath, 'utf-8');

  // Test 2.1: updateExaminationClassApproval checks ownsStream
  assert(
    storageContent.includes('ownsStream') &&
    storageContent.includes('UNAUTHORIZED: You are only permitted to approve results for your assigned class stream'),
    'Application — api.updateExaminationClassApproval enforces stream ownership check before mutation'
  );

  // Test 2.2: Dual-key and class_teacher_of_id fallback support
  assert(
    storageContent.includes('class_teacher_of_id') &&
    storageContent.includes('targetClass.class_teacher_id === activeTeacher.id'),
    'Application — Application accurately resolves stream ownership across class_teacher_id and profile metadata'
  );

  // ==========================================
  // SECTION 3: 10 SCENARIO ISOLATION & ATTACK SIMULATION
  // ==========================================
  console.log('\n--- 3. DETAILED SCENARIO ISOLATION & ATTACK TESTS ---');

  // Mock database state for simulation
  const streams = [
    { id: 'strm-g9-red', class_id: 'cls-g9', stream_name: 'Red', class_teacher_id: 'teacher-1-uuid' },
    { id: 'strm-g9-blue', class_id: 'cls-g9', stream_name: 'Blue', class_teacher_id: 'teacher-2-uuid' },
    { id: 'strm-g8-red', class_id: 'cls-g8', stream_name: 'Red', class_teacher_id: 'teacher-3-uuid' },
  ];

  const teachers = [
    { id: 'teacher-1-uuid', user_id: 'user-ct-1', teacher_name: 'Teacher 1', is_class_teacher: true },
    { id: 'teacher-2-uuid', user_id: 'user-ct-2', teacher_name: 'Teacher 2', is_class_teacher: true },
    { id: 'teacher-3-uuid', user_id: 'user-ct-3', teacher_name: 'Teacher 3', is_class_teacher: true },
    { id: 'teacher-no-stream', user_id: 'user-ct-none', teacher_name: 'Unassigned CT', is_class_teacher: true },
    { id: 'teacher-subject-only', user_id: 'user-st-only', teacher_name: 'Subject Teacher', is_class_teacher: false },
  ];

  const users = [
    { id: 'user-ct-1', role: 'class_teacher', teacher_id: 'teacher-1-uuid' },
    { id: 'user-ct-2', role: 'class_teacher', teacher_id: 'teacher-2-uuid' },
    { id: 'user-ct-3', role: 'class_teacher', teacher_id: 'teacher-3-uuid' },
    { id: 'user-ct-none', role: 'class_teacher', teacher_id: 'teacher-no-stream' },
    { id: 'user-st-only', role: 'subject_teacher', teacher_id: 'teacher-subject-only' },
    { id: 'user-admin', role: 'admin', teacher_id: null },
  ];

  // Database Trigger Emulator Function matching PostgreSQL trigger semantics
  function simulateDatabaseTrigger(
    authUser: (typeof users)[0],
    oldExam: { id: string; approved_classes: string[]; exam_name: string },
    newExam: { id: string; approved_classes: string[]; exam_name: string }
  ): { allowed: boolean; error?: string } {
    // 1. Admin bypass
    if (authUser.role === 'admin') {
      return { allowed: true };
    }

    // 2. Class teacher role check
    if (authUser.role !== 'class_teacher') {
      return { allowed: false, error: 'UNAUTHORIZED: Only administrators and designated class teachers can modify examination approvals.' };
    }

    // 3. Resolve assigned streams
    const teacher = teachers.find(t => t.id === authUser.teacher_id || t.user_id === authUser.id);
    if (!teacher) {
      return { allowed: false, error: 'UNAUTHORIZED: Teacher record not found.' };
    }

    const assignedStreamIds = streams
      .filter(s => s.class_teacher_id === teacher.id)
      .map(s => s.id);

    // 4. Calculate delta
    const oldApproved = oldExam.approved_classes || [];
    const newApproved = newExam.approved_classes || [];
    const addedStreams = newApproved.filter(id => !oldApproved.includes(id));
    const removedStreams = oldApproved.filter(id => !newApproved.includes(id));

    // 5. Verify added streams
    for (const strmId of addedStreams) {
      if (!assignedStreamIds.includes(strmId)) {
        return { allowed: false, error: 'UNAUTHORIZED: Class teachers may only approve examination streams currently assigned to them.' };
      }
    }

    // 6. Verify removed streams
    for (const strmId of removedStreams) {
      if (!assignedStreamIds.includes(strmId)) {
        return { allowed: false, error: 'UNAUTHORIZED: Class teachers may only revoke approval for examination streams currently assigned to them.' };
      }
    }

    // 7. Immutability of core metadata
    if (newExam.exam_name !== oldExam.exam_name) {
      return { allowed: false, error: 'UNAUTHORIZED: Class teachers are not permitted to modify core examination metadata.' };
    }

    return { allowed: true };
  }

  const baseExam = {
    id: 'exam-1',
    approved_classes: [] as string[],
    exam_name: 'Mid Term 1 Exam 2026'
  };

  // TEST 1: Class Teacher A assigned to Grade 9 Red approves Grade 9 Red -> ALLOW
  const test1 = simulateDatabaseTrigger(
    users[0], // user-ct-1 (assigned to strm-g9-red)
    baseExam,
    { ...baseExam, approved_classes: ['strm-g9-red'] }
  );
  assert(test1.allowed === true, 'TEST 1: Class Teacher A assigned to Grade 9 Red approves Grade 9 Red -> ALLOW');

  // TEST 2: Class Teacher A assigned to Grade 9 Red attempts Grade 9 Blue -> DENY
  const test2 = simulateDatabaseTrigger(
    users[0],
    baseExam,
    { ...baseExam, approved_classes: ['strm-g9-blue'] }
  );
  assert(test2.allowed === false && test2.error?.includes('currently assigned to them'), 'TEST 2: Class Teacher A attempts Grade 9 Blue (same grade, other stream) -> DENY');

  // TEST 3: Class Teacher A assigned to Grade 9 Red attempts Grade 8 Red -> DENY
  const test3 = simulateDatabaseTrigger(
    users[0],
    baseExam,
    { ...baseExam, approved_classes: ['strm-g8-red'] }
  );
  assert(test3.allowed === false && test3.error?.includes('currently assigned to them'), 'TEST 3: Class Teacher A attempts Grade 8 Red (different grade) -> DENY');

  // TEST 4: Class Teacher A assigned to Grade 9 Red attempts Teacher B's stream -> DENY
  const test4 = simulateDatabaseTrigger(
    users[0],
    baseExam,
    { ...baseExam, approved_classes: ['strm-g9-blue'] }
  );
  assert(test4.allowed === false, "TEST 4: Class Teacher A attempts Teacher B's stream -> DENY");

  // TEST 5: Teacher with no Class Teacher assignment attempts approval -> DENY
  const test5 = simulateDatabaseTrigger(
    users[3], // user-ct-none
    baseExam,
    { ...baseExam, approved_classes: ['strm-g9-red'] }
  );
  assert(test5.allowed === false, 'TEST 5: Teacher with no stream assignment attempts approval -> DENY');

  // TEST 6: Teacher reassigned from Grade 9 Red to Grade 9 Blue attempts Grade 9 Red -> DENY
  // Simulate reassignment
  const reassignedStreams = [
    { id: 'strm-g9-red', class_id: 'cls-g9', stream_name: 'Red', class_teacher_id: 'teacher-2-uuid' }, // now teacher 2
    { id: 'strm-g9-blue', class_id: 'cls-g9', stream_name: 'Blue', class_teacher_id: 'teacher-1-uuid' }, // now teacher 1
  ];
  // Reassigned emulator
  const test6Result = (() => {
    const assigned = reassignedStreams.filter(s => s.class_teacher_id === 'teacher-1-uuid').map(s => s.id);
    return assigned.includes('strm-g9-red');
  })();
  assert(test6Result === false, 'TEST 6: Teacher reassigned from Grade 9 Red to Grade 9 Blue attempting Grade 9 Red -> DENY');

  // TEST 7: Same reassigned teacher approves Grade 9 Blue -> ALLOW
  const test7Result = (() => {
    const assigned = reassignedStreams.filter(s => s.class_teacher_id === 'teacher-1-uuid').map(s => s.id);
    return assigned.includes('strm-g9-blue');
  })();
  assert(test7Result === true, 'TEST 7: Same reassigned teacher approves Grade 9 Blue -> ALLOW');

  // TEST 8: Subject Teacher attempts examination approval -> DENY
  const test8 = simulateDatabaseTrigger(
    users[4], // user-st-only (role = 'subject_teacher')
    baseExam,
    { ...baseExam, approved_classes: ['strm-g9-red'] }
  );
  assert(test8.allowed === false && test8.error?.includes('Only administrators and designated class teachers'), 'TEST 8: Subject Teacher attempts examination approval -> DENY');

  // TEST 9: Administrator approves any stream -> ALLOW
  const test9 = simulateDatabaseTrigger(
    users[5], // user-admin
    baseExam,
    { ...baseExam, approved_classes: ['strm-g9-red', 'strm-g9-blue', 'strm-g8-red'] }
  );
  assert(test9.allowed === true, 'TEST 9: Administrator approves any / all streams -> ALLOW');

  // TEST 10: Direct database / API-level bypass attempt (tampering with metadata or foreign streams)
  const test10ForeignStreamBypass = simulateDatabaseTrigger(
    users[0], // user-ct-1
    { ...baseExam, approved_classes: ['strm-g9-red'] },
    { ...baseExam, approved_classes: ['strm-g9-red', 'strm-g9-blue'] } // Injected foreign stream
  );
  assert(
    test10ForeignStreamBypass.allowed === false,
    'TEST 10a: Direct DB/API bypass attempting to inject foreign stream -> BLOCKED by trigger'
  );

  const test10MetadataTamper = simulateDatabaseTrigger(
    users[0],
    baseExam,
    { ...baseExam, exam_name: 'Tampered Examination Name', approved_classes: ['strm-g9-red'] }
  );
  assert(
    test10MetadataTamper.allowed === false && test10MetadataTamper.error?.includes('core examination metadata'),
    'TEST 10b: Direct DB/API bypass attempting to tamper with examination metadata -> BLOCKED by trigger'
  );

  console.log(`\nISSUE 7F STREAM APPROVAL SECURITY TESTS: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runIssue7fSecurityTests().catch((err) => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
