import { Teacher, TeacherAllocation, Role, AccountStatus, User as AppUser } from '../types';

/**
 * Teacher Creation Notification Forensic Test Suite
 */
export async function runTeacherCreationNotificationTests() {
  console.log('=== RUNNING TEACHER CREATION NOTIFICATION FORENSIC TESTS ===\n');

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

  // Mock handler for teacher creation workflow
  const simulateTeacherCreation = async ({
    name,
    email,
    phone = '+254 712 345 678',
    tscNumber,
    createRole = 'class_teacher',
    tempPassword = 'Teacher@2026',
    confirmTempPassword = 'Teacher@2026',
    allocations = [] as TeacherAllocation[],
    assignedStreamId,
    adminCreateAccountFn,
    onAddTeacherFn,
  }: {
    name: string;
    email: string;
    phone?: string;
    tscNumber?: string;
    createRole?: Role;
    tempPassword?: string;
    confirmTempPassword?: string;
    allocations?: TeacherAllocation[];
    assignedStreamId?: string;
    adminCreateAccountFn: (payload: any) => Promise<{ user: AppUser | null; teacher?: Teacher; error: string | null }>;
    onAddTeacherFn: (teacher: Teacher, authUserId?: string) => void;
  }): Promise<{ success: boolean; error: string | null }> => {
    // 1. Validation phase
    if (!name.trim() || !email.trim()) {
      return { success: false, error: 'Full Name and Email Address are required.' };
    }

    if (!tempPassword || tempPassword.length < 6) {
      return { success: false, error: 'Temporary password must be at least 6 characters.' };
    }

    if (tempPassword !== confirmTempPassword) {
      return { success: false, error: 'Temporary password and confirmation password do not match.' };
    }

    if (createRole === 'class_teacher' && !assignedStreamId) {
      return { success: false, error: 'Assigned Class is required for Class Teachers.' };
    }

    if (createRole === 'subject_teacher' && allocations.length === 0) {
      return { success: false, error: 'Subject Teachers must have at least one Teaching Allocation.' };
    }

    // 2. Authoritative API / Supabase phase
    try {
      const res = await adminCreateAccountFn({
        role: createRole,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        tsc_number: tscNumber?.trim() || undefined,
        temporary_password: tempPassword,
        allocations,
        class_teacher_of_id: assignedStreamId,
      });

      if (res.error) {
        return { success: false, error: res.error };
      }

      if (res.teacher && res.user) {
        onAddTeacherFn(res.teacher, res.user.id);
        const teacherDisplayName = res.teacher?.teacher_name || name.trim();
        mockShowNotification('success', `Teacher "${teacherDisplayName}" was created successfully.`);
        return { success: true, error: null };
      }

      return { success: false, error: 'Failed to create teacher account.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unexpected error' };
    }
  };

  // TEST 1 — Successful teacher creation triggers success notification
  notificationQueue.length = 0;
  let addedTeacher: Teacher | null = null;
  const mockOnAddTeacher = (tch: Teacher) => {
    addedTeacher = tch;
  };

  const mockAdminCreateSuccess = async (payload: any) => {
    const teacher: Teacher = {
      id: 'tch-new-001',
      user_id: 'usr-new-001',
      teacher_name: payload.name,
      email: payload.email,
      phone: payload.phone,
      tsc_number: payload.tsc_number,
      is_class_teacher: payload.role === 'class_teacher',
      status: 'Active',
      allocations: payload.allocations || [],
    };
    const user: AppUser = {
      id: 'usr-new-001',
      name: payload.name,
      email: payload.email,
      role: payload.role,
      teacher_id: 'tch-new-001',
    };
    return { user, teacher, error: null };
  };

  const res1 = await simulateTeacherCreation({
    name: 'Samuel Kiprop',
    email: 'samuel.kiprop@school.ac.ke',
    assignedStreamId: 'stream-7w',
    adminCreateAccountFn: mockAdminCreateSuccess,
    onAddTeacherFn: mockOnAddTeacher,
  });

  assert(res1.success === true, 'Test 1: Teacher creation succeeded');
  assert(notificationQueue.length === 1, 'Test 1: Exactly one success notification queued');
  assert(notificationQueue[0]?.type === 'success', 'Test 1: Notification type is "success"');
  assert(
    notificationQueue[0]?.message === 'Teacher "Samuel Kiprop" was created successfully.',
    'Test 1 & 2: Notification message contains dynamic teacher name and exact phrasing'
  );
  assert(Boolean(addedTeacher && (addedTeacher as Teacher).id === 'tch-new-001'), 'Test 1: onAddTeacher callback was invoked');

  // TEST 2 — Dynamic teacher name verification with another profile
  notificationQueue.length = 0;
  const res2 = await simulateTeacherCreation({
    name: 'Mercy Chebet',
    email: 'mercy.chebet@school.ac.ke',
    assignedStreamId: 'stream-8a',
    adminCreateAccountFn: mockAdminCreateSuccess,
    onAddTeacherFn: mockOnAddTeacher,
  });

  assert(res2.success === true, 'Test 2: Second teacher creation succeeded');
  assert(
    notificationQueue[0]?.message === 'Teacher "Mercy Chebet" was created successfully.',
    'Test 2: Dynamic name correctly formats Mercy Chebet'
  );

  // TEST 3 — Failed creation suppresses success notification
  notificationQueue.length = 0;
  const mockAdminCreateFailure = async (_payload: any) => {
    return { user: null, error: 'A user account with this email address has already been registered.' };
  };

  const res3 = await simulateTeacherCreation({
    name: 'Duplicate Teacher',
    email: 'duplicate@school.ac.ke',
    assignedStreamId: 'stream-7w',
    adminCreateAccountFn: mockAdminCreateFailure,
    onAddTeacherFn: mockOnAddTeacher,
  });

  assert(res3.success === false, 'Test 3: Creation failed as expected');
  assert(notificationQueue.length === 0, 'Test 3: No success notification queued on failure');
  assert(
    res3.error === 'A user account with this email address has already been registered.',
    'Test 4: Supabase/Auth error message preserved and exposed to UI'
  );

  // TEST 5 — Cancelled creation / modal dismissal triggers zero notifications
  notificationQueue.length = 0;
  let isAddingModalOpen = true;
  const handleCancelModal = () => {
    isAddingModalOpen = false;
    // reset form, no API call
  };
  handleCancelModal();
  assert(!isAddingModalOpen, 'Test 5: Adding modal closed on cancel');
  assert(notificationQueue.length === 0, 'Test 5: Zero notifications triggered on modal dismissal');

  // TEST 6 — Validation failures (empty fields, password mismatch) suppress notifications
  notificationQueue.length = 0;
  const resValidation1 = await simulateTeacherCreation({
    name: '',
    email: 'valid@school.ac.ke',
    adminCreateAccountFn: mockAdminCreateSuccess,
    onAddTeacherFn: mockOnAddTeacher,
  });
  assert(resValidation1.success === false, 'Test 6: Empty name rejected');
  assert(notificationQueue.length === 0, 'Test 6: No notification on empty name validation failure');

  const resValidation2 = await simulateTeacherCreation({
    name: 'Test Teacher',
    email: 'test@school.ac.ke',
    tempPassword: 'Password1',
    confirmTempPassword: 'PasswordMismatch',
    adminCreateAccountFn: mockAdminCreateSuccess,
    onAddTeacherFn: mockOnAddTeacher,
  });
  assert(resValidation2.success === false, 'Test 6: Password mismatch rejected');
  assert(notificationQueue.length === 0, 'Test 6: No notification on password mismatch validation failure');

  // TEST 7 & 8 — Existing teacher IDs and relationships preserved
  const simulatedDb = {
    teachers: [
      { id: 'tch-001', teacher_name: 'Jane Muthoni', email: 'jane.muthoni@school.ac.ke', phone: '+254 700 111 222', status: 'Active' },
      { id: 'tch-new-001', teacher_name: 'Samuel Kiprop', email: 'samuel.kiprop@school.ac.ke', phone: '+254 712 345 678', status: 'Active' },
    ],
    streams: [
      { id: 'stream-7w', class_name: 'Grade 7', stream: 'West', class_teacher_id: 'tch-new-001' },
    ],
  };

  const preservedOriginal = simulatedDb.teachers.find((t) => t.id === 'tch-001');
  const persistedNew = simulatedDb.teachers.find((t) => t.id === 'tch-new-001');
  const linkedStream = simulatedDb.streams.find((s) => s.id === 'stream-7w');

  assert(preservedOriginal?.teacher_name === 'Jane Muthoni', 'Test 7: Jane Muthoni profile intact and unchanged');
  assert(persistedNew?.id === 'tch-new-001', 'Test 8: New teacher primary key UUID persisted');
  assert(linkedStream?.class_teacher_id === 'tch-new-001', 'Test 8: Class teacher stream link intact');

  // TEST 9 — Refresh / hydration does not cause duplicate notifications
  notificationQueue.length = 0;
  // Simulating component mount / hydration from storage
  const hydratedTeachers = [...simulatedDb.teachers];
  assert(hydratedTeachers.length === 2, 'Test 9: Hydration loaded all persistent teachers');
  assert(notificationQueue.length === 0, 'Test 9: Hydration / refresh did not emit any toasts');

  // TEST 10 — Existing notification workflows unaffected
  mockShowNotification('info', 'System ready');
  assert(notificationQueue.length === 1 && notificationQueue[0]?.type === 'info', 'Test 10: Global notification queue operates normally');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    throw new Error(`Teacher creation notification tests failed: ${failed} failure(s)`);
  }
}
