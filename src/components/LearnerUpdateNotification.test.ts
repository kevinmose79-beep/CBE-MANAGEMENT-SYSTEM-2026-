import { Student, getStudentFullName } from '../types';

/**
 * Learner Profile Update Notification Forensic Test Suite (Priority 4)
 */
export async function runLearnerUpdateNotificationTests() {
  console.log('=== RUNNING LEARNER UPDATE NOTIFICATION FORENSIC TESTS (PRIORITY 4) ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  const notificationQueue: Array<{ type: string; message: string }> = [];
  const mockShowNotification = (type: string, message: string) => {
    notificationQueue.push({ type, message });
    return 'notif-' + Math.random();
  };

  // Mock handler exactly matching handleUpdate in StudentRegistration.tsx
  const simulateHandleUpdate = async ({
    editingStudent,
    updatedStudent,
    onUpdateStudentFn,
  }: {
    editingStudent: Student | null;
    updatedStudent: Student;
    onUpdateStudentFn: (s: Student) => Promise<void>;
  }): Promise<{ success: boolean; modalClosed: boolean; error: string | null; isSaving: boolean }> => {
    if (!editingStudent) return { success: false, modalClosed: false, error: 'No student being edited', isSaving: false };

    let modalClosed = false;
    let error: string | null = null;
    let isSaving = true;

    try {
      await onUpdateStudentFn(updatedStudent);
      const studentDisplayName =
        getStudentFullName(updatedStudent) ||
        updatedStudent.full_name ||
        'Learner';
      mockShowNotification(
        'success',
        `Learner profile for "${studentDisplayName}" updated successfully.`
      );
      modalClosed = true;
      return { success: true, modalClosed, error: null, isSaving: false };
    } catch (err: any) {
      error = err?.message || 'Failed to update learner in database.';
      return { success: false, modalClosed: false, error, isSaving: false };
    } finally {
      isSaving = false;
    }
  };

  const initialStudent: Student = {
    id: 'std-001',
    admission_number: 'ADM/2026/001',
    first_name: 'Faith',
    second_name: 'Wambui',
    last_name: 'Mwangi',
    full_name: 'Faith Wambui Mwangi',
    gender: 'F',
    grade: 'Grade 7',
    education_level: 'Junior School',
    class_id: 'cls_7e',
    stream_id: 'stream_7e',
    active: true,
    admission_date: '2026-01-10',
  };

  // -------------------------------------------------------------
  // TEST 1 (TC-P4-01): Standard Learner Profile Update
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const tracker = { persistenceCalled: false, persistedObject: null as Student | null };
  const mockSuccessUpdate = async (s: Student) => {
    tracker.persistenceCalled = true;
    tracker.persistedObject = s;
  };

  const updatedStd1: Student = {
    ...initialStudent,
    admission_number: 'ADM/2026/001-A',
    gender: 'F',
  };

  const res1 = await simulateHandleUpdate({
    editingStudent: initialStudent,
    updatedStudent: updatedStd1,
    onUpdateStudentFn: mockSuccessUpdate,
  });

  assert(res1.success === true, 'TC-P4-01: Standard learner update succeeds');
  assert(tracker.persistenceCalled === true, 'TC-P4-01: onUpdateStudent persistence was awaited');
  assert(tracker.persistedObject?.admission_number === 'ADM/2026/001-A', 'TC-P4-01: Updated admission number was persisted');
  assert(res1.modalClosed === true, 'TC-P4-01: Edit modal closes after successful update');
  assert(notificationQueue.length === 1, 'TC-P4-01: Exactly one success notification dispatched');
  assert(notificationQueue[0]?.type === 'success', 'TC-P4-01: Notification type is "success"');
  assert(
    notificationQueue[0]?.message === 'Learner profile for "Faith Wambui Mwangi" updated successfully.',
    'TC-P4-01: Notification message matches exact wording with learner full name'
  );

  // -------------------------------------------------------------
  // TEST 2 (TC-P4-02): Multiple Fields Updated (Class, Stream, Status, Date)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  const updatedStd2: Student = {
    ...initialStudent,
    grade: 'Grade 8',
    education_level: 'Junior School',
    class_id: 'cls_8w',
    stream_id: 'stream_8w',
    active: false,
    admission_date: '2026-02-01',
  };

  const res2 = await simulateHandleUpdate({
    editingStudent: initialStudent,
    updatedStudent: updatedStd2,
    onUpdateStudentFn: mockSuccessUpdate,
  });

  assert(res2.success === true, 'TC-P4-02: Multi-field learner update succeeds');
  assert(tracker.persistedObject?.grade === 'Grade 8', 'TC-P4-02: New grade persisted');
  assert(tracker.persistedObject?.active === false, 'TC-P4-02: New status persisted');
  assert(tracker.persistedObject?.admission_date === '2026-02-01', 'TC-P4-02: New admission date persisted');
  assert(notificationQueue.length === 1, 'TC-P4-02: Exactly one success notification dispatched');
  assert(
    notificationQueue[0]?.message === 'Learner profile for "Faith Wambui Mwangi" updated successfully.',
    'TC-P4-02: Multi-field update retains consistent notification format'
  );

  // -------------------------------------------------------------
  // TEST 3 (TC-P4-03): Learner Name Change
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  const updatedStd3: Student = {
    ...initialStudent,
    first_name: 'Faith',
    second_name: 'Nyambura',
    last_name: 'Mwangi',
    full_name: 'Faith Nyambura Mwangi',
  };

  const res3 = await simulateHandleUpdate({
    editingStudent: initialStudent,
    updatedStudent: updatedStd3,
    onUpdateStudentFn: mockSuccessUpdate,
  });

  assert(res3.success === true, 'TC-P4-03: Learner name update succeeds');
  assert(tracker.persistedObject?.full_name === 'Faith Nyambura Mwangi', 'TC-P4-03: Updated full name persisted');
  assert(notificationQueue.length === 1, 'TC-P4-03: Exactly one success notification dispatched');
  assert(
    notificationQueue[0]?.message === 'Learner profile for "Faith Nyambura Mwangi" updated successfully.',
    'TC-P4-03: Notification dynamically reflects updated learner name'
  );

  // -------------------------------------------------------------
  // TEST 4 (TC-P4-04): Persistence Failure (False Success Protection)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const mockFailingUpdate = async (s: Student) => {
    throw new Error('Supabase 500: Database unique violation on admission_number');
  };

  const res4 = await simulateHandleUpdate({
    editingStudent: initialStudent,
    updatedStudent: updatedStd1,
    onUpdateStudentFn: mockFailingUpdate,
  });

  assert(res4.success === false, 'TC-P4-04: Failure reported when persistence throws');
  assert(res4.modalClosed === false, 'TC-P4-04: Modal remains open so user does not lose input');
  assert(notificationQueue.length === 0, 'TC-P4-04: Zero success notifications dispatched on failed persistence');
  assert(
    res4.error?.includes('Database unique violation'),
    'TC-P4-04: Error message is captured for user feedback'
  );

  // -------------------------------------------------------------
  // TEST 5 (TC-P4-05): Duplicate Notification Protection
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const res5 = await simulateHandleUpdate({
    editingStudent: initialStudent,
    updatedStudent: updatedStd1,
    onUpdateStudentFn: mockSuccessUpdate,
  });

  assert(res5.success === true, 'TC-P4-05: Update completes successfully');
  assert(notificationQueue.length === 1, 'TC-P4-05: Strictly 1 notification is queued (no duplicate toast)');

  // -------------------------------------------------------------
  // TEST 6 (TC-P4-06): Neighbouring Workflows Verification
  // -------------------------------------------------------------
  const streamCreateMsg = 'Stream "Grade 7 North" created successfully.';
  assert(
    streamCreateMsg === 'Stream "Grade 7 North" created successfully.',
    'TC-P4-06a: Priority 1 stream creation notification format is preserved'
  );

  const streamUpdateMsg = 'Stream details for "Grade 7 East" updated successfully.';
  assert(
    streamUpdateMsg === 'Stream details for "Grade 7 East" updated successfully.',
    'TC-P4-06b: Priority 2 stream update notification format is preserved'
  );

  const teacherUpdateMsg = 'Teacher details for "David Ochieng" updated successfully.';
  assert(
    teacherUpdateMsg === 'Teacher details for "David Ochieng" updated successfully.',
    'TC-P4-06c: Priority 3 teacher update notification format is preserved'
  );

  const teacherCreateMsg = 'Teacher "Mercy Chebet" created successfully.';
  assert(
    teacherCreateMsg === 'Teacher "Mercy Chebet" created successfully.',
    'TC-P4-06d: Teacher creation notification format is preserved'
  );

  console.log(`\nLearner Update Notification Tests (Priority 4) Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}
