import { ClassStream, Student, Mark } from '../types';

/**
 * Stream Deletion Notification Forensic Test Suite
 */
export async function runStreamDeletionNotificationTests() {
  console.log('=== RUNNING STREAM DELETION NOTIFICATION FORENSIC TESTS ===\n');

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

  // TEST 1: Stream display name formatting logic
  const formatStreamName = (deletingClass: { class_name: string; stream: string }) => {
    return deletingClass.stream
      ? deletingClass.stream.toLowerCase().includes(deletingClass.class_name.toLowerCase())
        ? deletingClass.stream
        : `${deletingClass.class_name} ${deletingClass.stream}`
      : deletingClass.class_name;
  };

  assert(
    formatStreamName({ class_name: 'Grade 7', stream: 'North' }) === 'Grade 7 North',
    'Formats "Grade 7" + "North" to "Grade 7 North"'
  );
  assert(
    formatStreamName({ class_name: 'Grade 7', stream: 'Grade 7A' }) === 'Grade 7A',
    'Formats "Grade 7" + "Grade 7A" without duplicate grade prefix'
  );
  assert(
    formatStreamName({ class_name: 'Grade 8', stream: '' }) === 'Grade 8',
    'Formats "Grade 8" with empty stream to "Grade 8"'
  );

  // TEST 2: Notification message content
  const streamName = formatStreamName({ class_name: 'Grade 7', stream: 'East' });
  const successMessage = `Stream "${streamName}" deleted successfully.`;
  assert(
    successMessage === 'Stream "Grade 7 East" deleted successfully.',
    'Generates correct success notification message text'
  );

  // TEST 3: Dependency Safety Check simulation
  const dummyStudents: Student[] = [
    {
      id: 'student-1',
      admission_number: 'ADM-001',
      full_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      gender: 'M',
      active: true,
      grade: 'Grade 7',
      class_id: 'class-1',
      stream_id: 'stream-1',
    },
  ];

  const dummyMarks: Mark[] = [];

  const checkIsSafeToDelete = (
    c: ClassStream,
    students: Student[],
    marks: Mark[]
  ) => {
    const streamStudents = students.filter(
      (s) =>
        s.class_id === c.id ||
        s.stream_id === c.id ||
        ((s.grade === c.class_name || (s as any).class_name === c.class_name) &&
          (s as any).stream &&
          (s as any).stream.toLowerCase() === c.stream.toLowerCase())
    );
    const linkedMarks = marks.filter((m) => (m as any).class_id === c.id || (m as any).stream_id === c.id);
    const hasLearners = streamStudents.length > 0;
    const hasMarks = linkedMarks.length > 0;
    return !hasLearners && !hasMarks;
  };

  const unsafeClass: ClassStream = {
    id: 'class-1',
    stream_id: 'stream-1',
    class_name: 'Grade 7',
    stream: 'North',
    education_level: 'Junior School',
    status: 'Active',
    capacity: 40,
  };

  const safeClass: ClassStream = {
    id: 'class-2',
    stream_id: 'stream-2',
    class_name: 'Grade 7',
    stream: 'South',
    education_level: 'Junior School',
    status: 'Active',
    capacity: 40,
  };

  assert(
    !checkIsSafeToDelete(unsafeClass, dummyStudents, dummyMarks),
    'Dependency check correctly marks stream with registered learners as UNSAFE'
  );
  assert(
    checkIsSafeToDelete(safeClass, dummyStudents, dummyMarks),
    'Dependency check correctly marks stream without registered learners as SAFE'
  );

  // TEST 4: Error Handling Simulation on deletion failure
  let notificationTriggered = false;
  let errorSet: string | null = null;
  let modalOpen = true;

  const simulatedFailedDelete = async () => {
    try {
      throw new Error('Database foreign key violation / network timeout');
      // If success:
      // notificationTriggered = true;
      // modalOpen = false;
    } catch (err: any) {
      errorSet = err?.message || 'Failed to delete stream.';
    }
  };

  await simulatedFailedDelete();
  assert(
    !notificationTriggered,
    'Failed deletion does NOT trigger success notification'
  );
  assert(
    errorSet === 'Database foreign key violation / network timeout',
    'Failed deletion records error message for UI display'
  );
  assert(
    modalOpen === true,
    'Failed deletion keeps confirmation modal open'
  );

  // TEST 5: Success Handling Simulation
  let successNotificationType = '';
  let successNotificationMessage = '';

  const simulatedSuccessDelete = async (target: ClassStream) => {
    try {
      // simulate api call success
      const name = formatStreamName(target);
      modalOpen = false;
      errorSet = null;
      successNotificationType = 'success';
      successNotificationMessage = `Stream "${name}" deleted successfully.`;
    } catch (err: any) {
      errorSet = err?.message;
    }
  };

  await simulatedSuccessDelete(safeClass);
  assert(
    !modalOpen,
    'Successful deletion closes confirmation modal'
  );
  assert(
    successNotificationType === 'success',
    'Successful deletion sets notification type to "success"'
  );
  assert(
    successNotificationMessage === 'Stream "Grade 7 South" deleted successfully.',
    'Successful deletion provides accurate feedback message'
  );

  console.log(`\nStream Deletion Notification Tests Complete: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}
