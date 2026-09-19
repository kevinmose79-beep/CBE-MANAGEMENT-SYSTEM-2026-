import { ClassStream, Teacher, GradeName } from '../types';

/**
 * Stream Name/Capacity Update Notification Forensic Test Suite (Priority 2)
 */
export async function runStreamUpdateNotificationTests() {
  console.log('=== RUNNING STREAM UPDATE NOTIFICATION FORENSIC TESTS (PRIORITY 2) ===\n');

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

  // Mock handler simulating handleSaveEditClass from ClassSubjectManagement.tsx
  const simulateSaveEditClass = async ({
    editingClass,
    classes,
    teachers,
    onUpdateClassFn,
  }: {
    editingClass: ClassStream | null;
    classes: ClassStream[];
    teachers: Teacher[];
    onUpdateClassFn?: (cls: ClassStream) => Promise<void>;
  }): Promise<{ success: boolean; modalClosed: boolean; error: string | null }> => {
    if (!editingClass) return { success: false, modalClosed: false, error: 'No class being edited' };

    const updated: ClassStream = {
      ...editingClass,
      stream: editingClass.stream.trim(),
      education_level: 'Junior School',
    };

    const originalClass = classes.find((cls) => cls.id === editingClass.id);
    const previousTeacherId = originalClass?.class_teacher_id;
    const newTeacherId = updated.class_teacher_id;
    const teacherChanged = previousTeacherId !== newTeacherId;
    const streamName = updated.stream
      ? (updated.stream.toLowerCase().startsWith(updated.class_name.toLowerCase())
          ? updated.stream
          : `${updated.class_name} ${updated.stream}`.trim())
      : updated.class_name;
    const newTeacher = teachers.find((t) => t.id === newTeacherId);
    const newTeacherName = newTeacher?.teacher_name || 'Teacher';

    let modalClosed = false;
    try {
      if (onUpdateClassFn) {
        await onUpdateClassFn(updated);
      }
      if (teacherChanged) {
        if (newTeacherId) {
          if (previousTeacherId) {
            mockShowNotification('success', `Class teacher for "${streamName}" was updated to "${newTeacherName}" successfully.`);
          } else {
            mockShowNotification('success', `Class teacher "${newTeacherName}" was assigned to "${streamName}" successfully.`);
          }
        } else if (previousTeacherId) {
          mockShowNotification('success', `Class teacher for "${streamName}" was unassigned successfully.`);
        }
      } else {
        mockShowNotification('success', `Stream details for "${streamName}" updated successfully.`);
      }
      modalClosed = true;
      return { success: true, modalClosed, error: null };
    } catch (err: any) {
      mockShowNotification('error', err?.message || 'Failed to update stream details.');
      return { success: false, modalClosed: false, error: err?.message || 'Failed to update stream details.' };
    }
  };

  const initialTeachers: Teacher[] = [
    {
      id: 'tch-1',
      teacher_name: 'Grace Wanjiku',
      email: 'grace@school.edu',
      phone: '0711000111',
      tsc_number: 'TSC10001',
      status: 'Active',
      allocations: [],
    },
    {
      id: 'tch-2',
      teacher_name: 'Peter Omondi',
      email: 'peter@school.edu',
      phone: '0711000222',
      tsc_number: 'TSC10002',
      status: 'Active',
      allocations: [],
    },
  ];

  const initialClasses: ClassStream[] = [
    {
      id: 'cls-grade7-north',
      class_name: 'Grade 7',
      stream: 'North',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
      class_teacher_id: 'tch-1',
      allocated_subject_ids: [],
    },
    {
      id: 'cls-grade8-blue',
      class_name: 'Grade 8',
      stream: 'Blue',
      capacity: 45,
      education_level: 'Junior School',
      status: 'Active',
      class_teacher_id: undefined,
      allocated_subject_ids: [],
    },
  ];

  // -------------------------------------------------------------
  // TEST 1 (TC-P2-01): Stream Name Update (Teacher Unchanged)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const tracker = { persistenceCalled: false, persistedObject: null as ClassStream | null };
  const mockSuccessUpdate = async (cls: ClassStream) => {
    tracker.persistenceCalled = true;
    tracker.persistedObject = cls;
  };

  const editedNameOnly: ClassStream = {
    ...initialClasses[0],
    stream: 'East', // Changed from North to East
  };

  const resultP2_01 = await simulateSaveEditClass({
    editingClass: editedNameOnly,
    classes: initialClasses,
    teachers: initialTeachers,
    onUpdateClassFn: mockSuccessUpdate,
  });

  assert(resultP2_01.success === true, 'TC-P2-01: Operation succeeds when persistence resolves');
  assert(tracker.persistenceCalled === true, 'TC-P2-01: Authoritative onUpdateClass is invoked');
  assert(tracker.persistedObject?.stream === 'East', 'TC-P2-01: Updated stream name was persisted');
  assert(notificationQueue.length === 1, 'TC-P2-01: Exactly one notification is dispatched');
  assert(notificationQueue[0]?.type === 'success', 'TC-P2-01: Notification type is "success"');
  assert(
    notificationQueue[0]?.message === 'Stream details for "Grade 7 East" updated successfully.',
    'TC-P2-01: Notification message contains updated stream name and correct wording'
  );
  assert(resultP2_01.modalClosed === true, 'TC-P2-01: Modal is closed on success');

  // -------------------------------------------------------------
  // TEST 2 (TC-P2-02): Capacity Update (Teacher Unchanged)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  const editedCapacityOnly: ClassStream = {
    ...initialClasses[0],
    capacity: 55, // Changed from 40 to 55
  };

  const resultP2_02 = await simulateSaveEditClass({
    editingClass: editedCapacityOnly,
    classes: initialClasses,
    teachers: initialTeachers,
    onUpdateClassFn: mockSuccessUpdate,
  });

  assert(resultP2_02.success === true, 'TC-P2-02: Capacity update succeeds');
  assert(tracker.persistedObject?.capacity === 55, 'TC-P2-02: Updated capacity was persisted');
  assert(notificationQueue.length === 1, 'TC-P2-02: Exactly one notification is dispatched');
  assert(
    notificationQueue[0]?.message === 'Stream details for "Grade 7 North" updated successfully.',
    'TC-P2-02: Notification fires with correct stream details message'
  );

  // -------------------------------------------------------------
  // TEST 3 (TC-P2-03): Stream Name + Capacity Update (Teacher Unchanged)
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  const editedNameAndCapacity: ClassStream = {
    ...initialClasses[1],
    stream: 'Red', // Blue -> Red
    capacity: 50, // 45 -> 50
  };

  const resultP2_03 = await simulateSaveEditClass({
    editingClass: editedNameAndCapacity,
    classes: initialClasses,
    teachers: initialTeachers,
    onUpdateClassFn: mockSuccessUpdate,
  });

  assert(resultP2_03.success === true, 'TC-P2-03: Combined name and capacity update succeeds');
  assert(tracker.persistedObject?.stream === 'Red', 'TC-P2-03: New stream name persisted');
  assert(tracker.persistedObject?.capacity === 50, 'TC-P2-03: New capacity persisted');
  assert(notificationQueue.length === 1, 'TC-P2-03: Exactly one notification dispatched (no duplicate)');
  assert(
    notificationQueue[0]?.message === 'Stream details for "Grade 8 Red" updated successfully.',
    'TC-P2-03: Correct notification message for Grade 8 Red'
  );

  // -------------------------------------------------------------
  // TEST 4 (TC-P2-04): Teacher + Stream Details Changed Together
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  tracker.persistenceCalled = false;
  tracker.persistedObject = null;

  // Grade 7 North had tch-1 (Grace). Now change teacher to tch-2 (Peter) AND change stream to West.
  const editedTeacherAndStream: ClassStream = {
    ...initialClasses[0],
    stream: 'West',
    class_teacher_id: 'tch-2',
  };

  const resultP2_04 = await simulateSaveEditClass({
    editingClass: editedTeacherAndStream,
    classes: initialClasses,
    teachers: initialTeachers,
    onUpdateClassFn: mockSuccessUpdate,
  });

  assert(resultP2_04.success === true, 'TC-P2-04: Simultaneous teacher and stream update succeeds');
  assert(notificationQueue.length === 1, 'TC-P2-04: Exactly one notification is dispatched (no dual toasts)');
  assert(
    notificationQueue[0]?.message === 'Class teacher for "Grade 7 West" was updated to "Peter Omondi" successfully.',
    'TC-P2-04: Specific teacher update toast is shown, generic stream details toast is suppressed'
  );

  // -------------------------------------------------------------
  // TEST 5 (TC-P2-05): Persistence Failure - False Success Prevention
  // -------------------------------------------------------------
  notificationQueue.length = 0;
  const mockFailingUpdate = async (cls: ClassStream) => {
    throw new Error('Supabase 23503: foreign key violation on class stream update');
  };

  const resultP2_05 = await simulateSaveEditClass({
    editingClass: editedNameOnly,
    classes: initialClasses,
    teachers: initialTeachers,
    onUpdateClassFn: mockFailingUpdate,
  });

  assert(resultP2_05.success === false, 'TC-P2-05: Failure reported when persistence throws');
  assert(resultP2_05.modalClosed === false, 'TC-P2-05: Modal remains open so user does not lose input');
  assert(notificationQueue.length === 1, 'TC-P2-05: Error notification is dispatched');
  assert(notificationQueue[0]?.type === 'error', 'TC-P2-05: Notification type is "error"');
  assert(
    notificationQueue[0]?.message.includes('foreign key violation'),
    'TC-P2-05: Error message contains authoritative failure details'
  );
  assert(
    !notificationQueue.some((n) => n.type === 'success'),
    'TC-P2-05: Zero success notifications dispatched on failed persistence'
  );

  console.log(`\nStream Update Notification Tests (Priority 2) Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}
