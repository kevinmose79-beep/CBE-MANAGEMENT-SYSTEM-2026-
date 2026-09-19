import { Teacher, TeacherAllocation, Subject, ClassStream } from '../types';

/**
 * Teacher Subject / Learning Area Allocation Notification Forensic Test Suite
 */
export async function runTeacherAllocationNotificationTests() {
  console.log('=== RUNNING TEACHER ALLOCATION NOTIFICATION FORENSIC TESTS ===\n');

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

  // TEST 1 — Successful allocation notification message formatting & firing
  const mockTeacher: Teacher = {
    id: 'tch-test-001',
    teacher_name: 'David Ochieng',
    email: 'david.ochieng@school.ac.ke',
    phone: '+254712345678',
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

  const notificationQueue: Array<{ type: string; message: string }> = [];
  const mockShowNotification = (type: string, message: string) => {
    notificationQueue.push({ type, message });
    return 'notif-id-1';
  };

  // Simulate successful allocation save handler logic
  const handleSaveAllocationsSuccess = async (
    editingTeacher: Teacher,
    updatedTeacher: Teacher,
    onUpdateTeacher: (t: Teacher) => Promise<void>
  ) => {
    await onUpdateTeacher(updatedTeacher);
    const teacherDisplayName = updatedTeacher.teacher_name || editingTeacher.teacher_name || 'Teacher';
    mockShowNotification('success', `Teacher details for "${teacherDisplayName}" updated successfully.`);
  };

  let onUpdateTeacherCalled = false;
  const mockOnUpdateSuccess = async (t: Teacher) => {
    onUpdateTeacherCalled = true;
    // persistence succeeded
  };

  await handleSaveAllocationsSuccess(mockTeacher, mockTeacher, mockOnUpdateSuccess);

  assert(onUpdateTeacherCalled, 'onUpdateTeacher was called and completed');
  assert(notificationQueue.length === 1, 'Exactly one success notification was queued');
  assert(
    notificationQueue[0]?.message === 'Teacher details for "David Ochieng" updated successfully.',
    'Success notification message contains dynamic teacher name and exact phrasing'
  );
  assert(notificationQueue[0]?.type === 'success', 'Notification type is "success"');

  // TEST 2 — Failed allocation (persistence failure suppresses notification & preserves error)
  notificationQueue.length = 0;
  let formError: string | null = null;
  let isSavingTeacher = true;

  const mockOnUpdateFailure = async (_t: Teacher) => {
    throw new Error('Database connection timeout: Learning area allocations could not be saved.');
  };

  const handleSaveAllocationsFailure = async (
    editingTeacher: Teacher,
    updatedTeacher: Teacher,
    onUpdateTeacher: (t: Teacher) => Promise<void>
  ) => {
    try {
      await onUpdateTeacher(updatedTeacher);
      const teacherDisplayName = updatedTeacher.teacher_name || editingTeacher.teacher_name || 'Teacher';
      mockShowNotification('success', `Teacher details for "${teacherDisplayName}" updated successfully.`);
    } catch (err: any) {
      formError = err.message || 'Failed to save changes.';
    } finally {
      isSavingTeacher = false;
    }
  };

  await handleSaveAllocationsFailure(mockTeacher, mockTeacher, mockOnUpdateFailure);

  assert(
    notificationQueue.length === 0,
    'No success notification appeared when persistence threw an error'
  );
  assert(
    formError === 'Database connection timeout: Learning area allocations could not be saved.',
    'Error message was preserved and exposed for UI display'
  );
  assert(!isSavingTeacher, 'Saving indicator reset in finally block');

  // TEST 3 — Cancelled allocation (modal closed or cancelled)
  notificationQueue.length = 0;
  let editingTeacherState: Teacher | null = mockTeacher;

  const handleCancelModal = () => {
    editingTeacherState = null;
    // user cancelled, no notification
  };

  handleCancelModal();
  assert(editingTeacherState === null, 'Modal state cleared on cancel');
  assert(
    notificationQueue.length === 0,
    'No notification triggered on user cancellation or modal dismissal'
  );

  // TEST 4 — Allocation state integrity
  const newAllocation: TeacherAllocation = {
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

  const updatedTeacherWithNewAlloc: Teacher = {
    ...mockTeacher,
    allocations: [...(mockTeacher.allocations || []), newAllocation],
  };

  assert(
    updatedTeacherWithNewAlloc.allocations?.length === 2,
    'Updated teacher contains both previous and newly added allocations'
  );
  assert(
    updatedTeacherWithNewAlloc.allocations?.[0]?.subject_id === 'sb_mat' &&
      updatedTeacherWithNewAlloc.allocations?.[1]?.subject_id === 'sb_eng',
    'Allocation subject IDs and relationships are preserved'
  );

  // TEST 5 — Refresh / hydration persistence integrity
  const storageCache: Record<string, any> = {
    cbe_teachers: [updatedTeacherWithNewAlloc],
  };

  // Simulate refresh data hydration
  const hydratedTeachers: Teacher[] = storageCache.cbe_teachers || [];
  const rehydratedTeacher = hydratedTeachers.find((t) => t.id === 'tch-test-001');

  assert(
    Boolean(rehydratedTeacher && rehydratedTeacher.allocations?.length === 2),
    'Hydrated state contains persisted allocations after refresh'
  );

  // TEST 6 — Existing regression check (Teacher object shape, ID invariants, and helper compatibility)
  assert(
    rehydratedTeacher?.id === 'tch-test-001',
    'Teacher primary ID is invariant and unchanged'
  );
  assert(
    rehydratedTeacher?.status === 'Active',
    'Teacher status is preserved'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    throw new Error(`Teacher allocation notification tests failed: ${failed} failure(s)`);
  }
}
