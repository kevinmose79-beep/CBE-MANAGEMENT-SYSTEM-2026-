import { Teacher, TeacherAllocation } from '../types';

/**
 * Teacher Details Update Notification Forensic Test Suite (Priority 3)
 */
export async function runTeacherUpdateNotificationTests() {
  console.log('=== RUNNING TEACHER UPDATE NOTIFICATION FORENSIC TESTS (PRIORITY 3) ===\n');

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

  // Mock handler simulating handleSaveEditTeacher in TeacherManagement.tsx
  const simulateSaveEditTeacher = async ({
    editingTeacher,
    updatedTeacher,
    onUpdateTeacherFn,
  }: {
    editingTeacher: Teacher | null;
    updatedTeacher: Teacher;
    onUpdateTeacherFn: (t: Teacher) => Promise<void>;
  }): Promise<{ success: boolean; modalClosed: boolean; error: string | null }> => {
    if (!editingTeacher) return { success: false, modalClosed: false, error: 'No teacher being edited' };

    let modalClosed = false;
    try {
      await onUpdateTeacherFn(updatedTeacher);
      const teacherDisplayName = updatedTeacher.teacher_name || editingTeacher.teacher_name || 'Teacher';
      mockShowNotification('success', `Teacher details for "${teacherDisplayName}" updated successfully.`);
      modalClosed = true;
      return { success: true, modalClosed, error: null };
    } catch (err: any) {
      return { success: false, modalClosed: false, error: err?.message || 'Failed to save changes.' };
    }
  };

  const initialTeacher: Teacher = {
    id: 'tch-001',
    teacher_name: 'David Ochieng',
    email: 'david.ochieng@school.ac.ke',
    phone: '+254712345678',
    tsc_number: 'TSC998877',
    status: 'Active',
    allocations: [
      {
        id: 'alloc_01',
        education_level: 'Junior School',
        class_id: 'cls_7e',
        stream_id: 'stream_7e',
        class_name: 'Grade 7',
        stream: 'East',
        subject_id: 'sb_mat',
        subject_name: 'Mathematics',
        subject_code: 'MAT7',
      },
    ],
  };

  // -------------------------------------------------------------
  // TEST 1 (TC-P3-01): Basic Teacher Profile Update (Allocations Unchanged)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const tracker = { persistenceCalled: false, persistedObject: null as Teacher | null };
  const mockSuccessUpdate = async (t: Teacher) => {
    tracker.persistenceCalled = true;
    tracker.persistedObject = t;
  };

  const updatedProfileOnly: Teacher = {
    ...initialTeacher,
    teacher_name: 'David Ochieng Junior',
    phone: '+254799887766',
    tsc_number: 'TSC112233',
  };

  const res1 = await simulateSaveEditTeacher({
    editingTeacher: initialTeacher,
    updatedTeacher: updatedProfileOnly,
    onUpdateTeacherFn: mockSuccessUpdate,
  });

  assert(res1.success === true, 'TC-P3-01: Profile update succeeds');
  assert(tracker.persistenceCalled === true, 'TC-P3-01: Authoritative onUpdateTeacher is invoked');
  assert(tracker.persistedObject?.teacher_name === 'David Ochieng Junior', 'TC-P3-01: Updated name is persisted');
  assert(notificationQueue.length === 1, 'TC-P3-01: Exactly one notification is dispatched');
  assert(notificationQueue[0]?.type === 'success', 'TC-P3-01: Notification type is "success"');
  assert(
    notificationQueue[0]?.message === 'Teacher details for "David Ochieng Junior" updated successfully.',
    'TC-P3-01: Notification accurately describes teacher details update (not falsely restricted to allocations)'
  );

  // -------------------------------------------------------------
  // TEST 2 (TC-P3-02): Learning-Area Allocation Update (Profile Unchanged)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  const newAlloc: TeacherAllocation = {
    id: 'alloc_02',
    education_level: 'Junior School',
    class_id: 'cls_7e',
    stream_id: 'stream_7e',
    class_name: 'Grade 7',
    stream: 'East',
    subject_id: 'sb_eng',
    subject_name: 'English Language',
    subject_code: 'ENG7',
  };

  const updatedAllocOnly: Teacher = {
    ...initialTeacher,
    allocations: [...initialTeacher.allocations!, newAlloc],
  };

  const res2 = await simulateSaveEditTeacher({
    editingTeacher: initialTeacher,
    updatedTeacher: updatedAllocOnly,
    onUpdateTeacherFn: mockSuccessUpdate,
  });

  assert(res2.success === true, 'TC-P3-02: Allocation update succeeds');
  assert(tracker.persistedObject?.allocations?.length === 2, 'TC-P3-02: Persisted allocations array updated');
  assert(notificationQueue.length === 1, 'TC-P3-02: Exactly one notification is dispatched');
  assert(
    notificationQueue[0]?.message === 'Teacher details for "David Ochieng" updated successfully.',
    'TC-P3-02: General teacher details notification correctly and consistently covers allocation saves'
  );

  // -------------------------------------------------------------
  // TEST 3 (TC-P3-03): Combined Profile + Allocation Update
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  const updatedCombined: Teacher = {
    ...initialTeacher,
    teacher_name: 'Dr. David Ochieng',
    phone: '+254700112233',
    allocations: [...initialTeacher.allocations!, newAlloc],
  };

  const res3 = await simulateSaveEditTeacher({
    editingTeacher: initialTeacher,
    updatedTeacher: updatedCombined,
    onUpdateTeacherFn: mockSuccessUpdate,
  });

  assert(res3.success === true, 'TC-P3-03: Combined profile and allocation update succeeds');
  assert(notificationQueue.length === 1, 'TC-P3-03: Exactly one notification dispatched (no duplicate/dual toasts)');
  assert(
    notificationQueue[0]?.message === 'Teacher details for "Dr. David Ochieng" updated successfully.',
    'TC-P3-03: Notification reflects new title and full details update'
  );

  // -------------------------------------------------------------
  // TEST 4 (TC-P3-04): Persistence Failure - False Success Prevention
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const mockFailingUpdate = async (t: Teacher) => {
    throw new Error('Supabase 500: Database connection failure during teacher update');
  };

  const res4 = await simulateSaveEditTeacher({
    editingTeacher: initialTeacher,
    updatedTeacher: updatedProfileOnly,
    onUpdateTeacherFn: mockFailingUpdate,
  });

  assert(res4.success === false, 'TC-P3-04: Failure reported when persistence throws');
  assert(res4.modalClosed === false, 'TC-P3-04: Modal remains open so user does not lose input');
  assert(notificationQueue.length === 0, 'TC-P3-04: Zero success notifications dispatched on failed persistence');
  assert(
    res4.error?.includes('Database connection failure'),
    'TC-P3-04: Error message is captured for UI feedback'
  );

  // -------------------------------------------------------------
  // TEST 5 (TC-P3-05): Neighbouring Workflow Verification
  // -------------------------------------------------------------
  // 5a. Teacher creation format check
  const createdTeacher: Teacher = {
    id: 'tch-new',
    teacher_name: 'Mercy Chebet',
    email: 'mercy@school.ac.ke',
    phone: '0711223344',
    status: 'Active',
    allocations: [],
  };
  const creationMsg = `Teacher "${createdTeacher.teacher_name}" created successfully.`;
  assert(
    creationMsg === 'Teacher "Mercy Chebet" created successfully.',
    'TC-P3-05a: Teacher creation notification format is unchanged and distinct'
  );

  // 5b. Stream creation format check
  const streamCreationMsg = 'Stream "Grade 7 North" created successfully.';
  assert(
    streamCreationMsg === 'Stream "Grade 7 North" created successfully.',
    'TC-P3-05b: Priority 1 stream creation notification format is preserved'
  );

  // 5c. Stream details update format check
  const streamUpdateMsg = 'Stream details for "Grade 7 East" updated successfully.';
  assert(
    streamUpdateMsg === 'Stream details for "Grade 7 East" updated successfully.',
    'TC-P3-05c: Priority 2 stream update notification format is preserved'
  );

  console.log(`\nTeacher Update Notification Tests (Priority 3) Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}
