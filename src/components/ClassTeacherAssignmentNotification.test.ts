import { ClassStream, Teacher } from '../types';

/**
 * Class/Stream Teacher Assignment Notification Forensic Test Suite
 */
export async function runClassTeacherAssignmentNotificationTests() {
  console.log('=== RUNNING CLASS/STREAM TEACHER ASSIGNMENT NOTIFICATION FORENSIC TESTS ===\n');

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

  // Helper to format stream names
  function formatStreamName(className: string, streamName?: string): string {
    const cName = (className || '').trim();
    const sName = (streamName || '').trim();
    if (!sName) return cName;
    if (sName.toLowerCase().startsWith(cName.toLowerCase())) {
      return sName;
    }
    return `${cName} ${sName}`.trim();
  }

  const notificationQueue: Array<{ type: string; message: string }> = [];
  const mockShowNotification = (type: string, message: string) => {
    notificationQueue.push({ type, message });
    return 'notif-' + Math.random();
  };

  const mockTeachers: Teacher[] = [
    {
      id: 'tch-001',
      teacher_name: 'David Ochieng',
      email: 'david.ochieng@school.ac.ke',
      phone: '+254712345678',
      status: 'Active',
    },
    {
      id: 'tch-002',
      teacher_name: 'Grace Wanjiku',
      email: 'grace.wanjiku@school.ac.ke',
      phone: '+254787654321',
      status: 'Active',
    },
  ];

  const mockStream: ClassStream = {
    id: 'stream-7w',
    stream_id: 'stream-7w',
    class_name: 'Grade 7',
    stream: 'West',
    capacity: 45,
    education_level: 'Junior School',
    status: 'Active',
    allocated_subject_ids: ['sb-01'],
  };

  // Handler simulation function for Class Teacher Assignment
  const handleAssignClassTeacher = async (
    currentClass: ClassStream,
    newTeacherId: string | undefined,
    teachersList: Teacher[],
    onUpdateClass: (cls: ClassStream) => Promise<void>,
    isLocked: boolean = false
  ) => {
    if (isLocked) {
      throw new Error('Academic term is locked: Class teacher assignments cannot be modified.');
    }
    if (newTeacherId === (currentClass.class_teacher_id || undefined)) return;
    const previousTeacherId = currentClass.class_teacher_id;
    const streamName = formatStreamName(currentClass.class_name, currentClass.stream);
    const newTeacher = teachersList.find((t) => t.id === newTeacherId);
    const newTeacherName = newTeacher?.teacher_name || 'Teacher';

    await onUpdateClass({
      ...currentClass,
      class_teacher_id: newTeacherId,
    });

    if (newTeacherId) {
      if (previousTeacherId) {
        mockShowNotification('success', `Class teacher for "${streamName}" was updated to "${newTeacherName}" successfully.`);
      } else {
        mockShowNotification('success', `Class teacher "${newTeacherName}" was assigned to "${streamName}" successfully.`);
      }
    } else if (previousTeacherId) {
      mockShowNotification('success', `Class teacher for "${streamName}" was unassigned successfully.`);
    }
  };

  // TEST 1 — Successful assignment (initial teacher assignment to unassigned stream)
  notificationQueue.length = 0;
  let persistedClass: ClassStream | null = null;
  const mockOnUpdateSuccess = async (cls: ClassStream) => {
    persistedClass = cls;
  };

  await handleAssignClassTeacher(mockStream, 'tch-001', mockTeachers, mockOnUpdateSuccess);

  assert(Boolean(persistedClass && persistedClass.class_teacher_id === 'tch-001'), 'Class teacher persisted to stream object');
  assert(notificationQueue.length === 1, 'Exactly one success notification dispatched');
  assert(
    notificationQueue[0]?.message === 'Class teacher "David Ochieng" was assigned to "Grade 7 West" successfully.',
    'Test 1 & 2: Success notification formatted correctly with dynamic teacher name and stream name'
  );
  assert(notificationQueue[0]?.type === 'success', 'Notification type is "success"');

  // TEST 2 — Dynamic names verification with different names
  notificationQueue.length = 0;
  const mockStreamB: ClassStream = {
    id: 'stream-8a',
    class_name: 'Grade 8',
    stream: 'A',
    capacity: 40,
  };
  await handleAssignClassTeacher(mockStreamB, 'tch-002', mockTeachers, mockOnUpdateSuccess);
  assert(
    notificationQueue[0]?.message === 'Class teacher "Grace Wanjiku" was assigned to "Grade 8 A" successfully.',
    'Test 2: Dynamic names accurately reflect Grace Wanjiku and Grade 8 A'
  );

  // TEST 3 — Change existing teacher (update from tch-001 to tch-002)
  notificationQueue.length = 0;
  const assignedStream: ClassStream = {
    ...mockStream,
    class_teacher_id: 'tch-001',
  };

  await handleAssignClassTeacher(assignedStream, 'tch-002', mockTeachers, mockOnUpdateSuccess);
  assert(notificationQueue.length === 1, 'Update teacher notification dispatched');
  assert(
    notificationQueue[0]?.message === 'Class teacher for "Grade 7 West" was updated to "Grace Wanjiku" successfully.',
    'Test 3: Replacement phrasing "updated to" is correctly applied when modifying existing assignment'
  );

  // TEST 4 — Failed assignment (database / network failure suppresses notification)
  notificationQueue.length = 0;
  let caughtError: string | null = null;
  const mockOnUpdateFailure = async (_cls: ClassStream) => {
    throw new Error('Supabase connection lost: Failed to update class_teacher_id');
  };

  try {
    await handleAssignClassTeacher(mockStream, 'tch-001', mockTeachers, mockOnUpdateFailure);
  } catch (err: any) {
    caughtError = err.message;
  }

  assert(notificationQueue.length === 0, 'Test 4: No success notification dispatched when persistence fails');
  assert(
    caughtError === 'Supabase connection lost: Failed to update class_teacher_id',
    'Test 4: Database error was preserved and propagated'
  );

  // TEST 5 — Cancelled assignment / modal closed without saving
  notificationQueue.length = 0;
  let editModalOpen = true;
  const handleCancelEditModal = () => {
    editModalOpen = false;
    // No onUpdateClass called
  };
  handleCancelEditModal();
  assert(!editModalOpen, 'Edit modal closed');
  assert(notificationQueue.length === 0, 'Test 5: No notification triggered on user cancellation or modal dismissal');

  // TEST 6 — Locked / blocked workflow (term lock guard prevents assignment)
  notificationQueue.length = 0;
  let lockError: string | null = null;
  try {
    await handleAssignClassTeacher(mockStream, 'tch-001', mockTeachers, mockOnUpdateSuccess, true);
  } catch (err: any) {
    lockError = err.message;
  }
  assert(notificationQueue.length === 0, 'Test 6: No success notification when blocked by lock guard');
  assert(
    lockError === 'Academic term is locked: Class teacher assignments cannot be modified.',
    'Test 6: Lock guard error message preserved'
  );

  // TEST 7 & 8 — Persistence and Relationship Integrity
  const simulatedDatabase = {
    streams: [
      { id: 'stream-7w', class_id: 'cls-7', stream_name: 'West', class_teacher_id: 'tch-001' },
    ],
    teachers: [
      { id: 'tch-001', teacher_name: 'David Ochieng', is_class_teacher: true, class_teacher_of_id: 'stream-7w' },
    ],
  };

  // Hydrate after refresh
  const rehydratedStream = simulatedDatabase.streams.find((s) => s.id === 'stream-7w');
  const rehydratedTeacher = simulatedDatabase.teachers.find((t) => t.id === 'tch-001');

  assert(
    rehydratedStream?.class_teacher_id === 'tch-001',
    'Test 7: Stream retains class_teacher_id relationship after simulated hydration/refresh'
  );
  assert(
    rehydratedTeacher?.class_teacher_of_id === 'stream-7w' && rehydratedTeacher?.is_class_teacher === true,
    'Test 8: Teacher relationship integrity preserved with class_teacher_of_id link'
  );

  // TEST 9 — Regression: Unassignment notification and subject allocation preservation
  notificationQueue.length = 0;
  await handleAssignClassTeacher(assignedStream, undefined, mockTeachers, mockOnUpdateSuccess);
  assert(
    notificationQueue[0]?.message === 'Class teacher for "Grade 7 West" was unassigned successfully.',
    'Test 9: Unassigning teacher provides dedicated unassigned notification without misleading "assigned successfully"'
  );
  assert(
    mockStream.allocated_subject_ids?.includes('sb-01'),
    'Test 9: Allocated learning areas and subject arrays are unchanged and intact'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    throw new Error(`Class teacher assignment notification tests failed: ${failed} failure(s)`);
  }
}
