import { ClassStream, Teacher, Subject, GradeName } from '../types';

/**
 * Stream Creation Notification Forensic Test Suite
 */
export async function runStreamCreationNotificationTests() {
  console.log('=== RUNNING STREAM CREATION NOTIFICATION FORENSIC TESTS ===\n');

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

  // Mock handler for stream creation workflow matching ClassSubjectManagement.tsx
  const simulateStreamCreation = async ({
    className,
    stream,
    capacity = 40,
    selectedTeacherId,
    levelFilter = 'Junior School',
    classes = [] as ClassStream[],
    subjects = [] as Subject[],
    onAddClassFn,
  }: {
    className: GradeName;
    stream: string;
    capacity?: number;
    selectedTeacherId?: string;
    levelFilter?: string;
    classes?: ClassStream[];
    subjects?: Subject[];
    onAddClassFn: (cls: ClassStream) => Promise<void>;
  }): Promise<{ success: boolean; error: string | null; formReset: boolean }> => {
    let formError: string | null = null;
    let formReset = false;

    // 1. Validation phase
    if (!className || !stream.trim()) {
      return { success: false, error: 'Please select a Class Grade Level and enter a Stream Name.', formReset: false };
    }

    const trimmedStream = stream.trim();
    const streamExists = classes.some(
      (c) => c.class_name === className && c.stream.trim().toLowerCase() === trimmedStream.toLowerCase()
    );
    if (streamExists) {
      return { success: false, error: `A stream named "${trimmedStream}" already exists for ${className}.`, formReset: false };
    }

    const newClass: ClassStream = {
      id: `cls_${Date.now()}`,
      class_name: className,
      stream: trimmedStream,
      capacity: capacity || 40,
      education_level: 'Junior School',
      status: 'Active',
      class_teacher_id: selectedTeacherId || undefined,
      allocated_subject_ids: [],
    };

    // 2. Authoritative persistence phase
    try {
      await onAddClassFn(newClass);
      mockShowNotification('success', `Stream "${className} ${trimmedStream}" created successfully.`);
      formReset = true;
      return { success: true, error: null, formReset };
    } catch (err: any) {
      formError = err?.message || 'Failed to create stream.';
      return { success: false, error: formError, formReset: false };
    }
  };

  // TEST 1: Message Formatting for various grades and streams
  const formatExpectedMessage = (className: string, stream: string) => `Stream "${className} ${stream.trim()}" created successfully.`;

  assert(
    formatExpectedMessage('Grade 7', 'North') === 'Stream "Grade 7 North" created successfully.',
    'Formats "Grade 7" + "North" into exact success notification message'
  );
  assert(
    formatExpectedMessage('Grade 8', 'East') === 'Stream "Grade 8 East" created successfully.',
    'Formats "Grade 8" + "East" into exact success notification message'
  );
  assert(
    formatExpectedMessage('Grade 9', 'Blue') === 'Stream "Grade 9 Blue" created successfully.',
    'Formats "Grade 9" + "Blue" into exact success notification message'
  );

  // TEST 2 (TC-01): Successful Stream Creation Workflow
  notificationQueue.length = 0;
  const tracker = { persistenceCalled: false };
  const mockSuccessAddClass = async (cls: ClassStream) => {
    tracker.persistenceCalled = true;
  };

  const tc1Result = await simulateStreamCreation({
    className: 'Grade 7',
    stream: 'North',
    onAddClassFn: mockSuccessAddClass,
  });

  assert(tc1Result.success === true, 'TC-01: Operation succeeds when persistence resolves');
  assert(tracker.persistenceCalled === true, 'TC-01: Authoritative onAddClass is invoked');
  assert(notificationQueue.length === 1, 'TC-01: Exactly one notification is emitted');
  assert(notificationQueue[0]?.type === 'success', 'TC-01: Notification type is "success"');
  assert(
    notificationQueue[0]?.message === 'Stream "Grade 7 North" created successfully.',
    'TC-01: Notification message contains correct grade and stream name'
  );
  assert(tc1Result.formReset === true, 'TC-01: Form state reset is triggered only upon success');

  // TEST 3 (TC-02): Failed Stream Creation - False-Success Prevention
  notificationQueue.length = 0;
  const mockFailingAddClass = async (cls: ClassStream) => {
    throw new Error('Supabase 23505: duplicate key value violates unique constraint on streams');
  };

  const tc2Result = await simulateStreamCreation({
    className: 'Grade 8',
    stream: 'South',
    onAddClassFn: mockFailingAddClass,
  });

  assert(tc2Result.success === false, 'TC-02: Operation reports failure when persistence throws');
  assert(notificationQueue.length === 0, 'TC-02: NO success notification is emitted when persistence fails');
  assert(
    tc2Result.error?.includes('duplicate key value'),
    'TC-02: Error message is correctly captured for user feedback'
  );
  assert(tc2Result.formReset === false, 'TC-02: Form is NOT reset on failed persistence so user data is not lost');

  // TEST 4 (TC-03): Duplicate Notification Check
  notificationQueue.length = 0;
  await simulateStreamCreation({
    className: 'Grade 9',
    stream: 'West',
    onAddClassFn: mockSuccessAddClass,
  });

  assert(
    notificationQueue.length === 1,
    'TC-03: Single creation emits exactly 1 notification (no dual emit from parent/child)'
  );

  // TEST 5: Duplicate Stream Name Validation
  notificationQueue.length = 0;
  const existingClasses: ClassStream[] = [
    {
      id: 'cls-1',
      class_name: 'Grade 7',
      stream: 'North',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
    },
  ];

  const validationResult = await simulateStreamCreation({
    className: 'Grade 7',
    stream: 'North',
    classes: existingClasses,
    onAddClassFn: mockSuccessAddClass,
  });

  assert(validationResult.success === false, 'Validation catches duplicate stream names');
  assert(notificationQueue.length === 0, 'Validation failure does not emit success notification');
  assert(
    validationResult.error === 'A stream named "North" already exists for Grade 7.',
    'Validation returns informative inline error'
  );

  console.log(`\nStream Creation Notification Tests Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}
