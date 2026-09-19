import { api, getStorage, setStorage, KEYS } from '../lib/storage';
import { authService } from './authService';
import type { Teacher, Student, User, ClassStream } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
    throw new Error(`Test failed: ${testName}`);
  }
}

export async function runDeletionAuthorityTests() {
  console.log('=== RUNNING LEARNER & TEACHER DELETION AUTHORITY VERIFICATION TESTS ===\n');

  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = globalThis;

  try {
    // ---------------------------------------------------------------------------
    // SECTION 1: LEARNER DELETION INVARIANT
    // ---------------------------------------------------------------------------
    console.log('--- SECTION 1: LEARNER DELETION AUTHORITY ---');

    const testStudent: Student = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      admission_number: 'ADM-DEL-001',
      full_name: 'Test Delete Learner',
      grade: 'Grade 7',
      class_id: 'cls_01',
      stream_id: 'st_01',
      gender: 'M',
      enrolment_status: 'active',
      active: true,
    };

    // 1.1 Add student to storage
    setStorage(KEYS.STUDENTS, [testStudent]);
    assert(api.getStudents().some(s => s.id === testStudent.id), 'Learner initialized in local storage');

    // 1.2 Simulate Server Deletion Failure (e.g. 500 error or RLS blocked)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-learner')) {
        return new Response(JSON.stringify({ success: false, error: 'Database constraint / RLS rejection' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(url);
    };

    let caughtLearnerErr = false;
    try {
      await api.deleteStudent(testStudent.id);
    } catch (e: any) {
      caughtLearnerErr = true;
      assert(e.message.includes('Database constraint / RLS rejection'), 'Learner delete error message propagated from server');
    }
    assert(caughtLearnerErr, 'api.deleteStudent threw error upon server failure');

    // INVARIANT: Cache MUST NOT be modified when server deletion fails
    const studentsAfterFailedDelete = api.getStudents();
    assert(studentsAfterFailedDelete.some(s => s.id === testStudent.id), 'INVARIANT: Learner remains in local cache when Supabase deletion fails');

    // 1.3 Simulate Server Deletion Success (200 OK)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-learner')) {
        return new Response(JSON.stringify({ success: true, message: 'Deleted from database' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(url);
    };

    await api.deleteStudent(testStudent.id);
    const studentsAfterSuccessDelete = api.getStudents();
    assert(!studentsAfterSuccessDelete.some(s => s.id === testStudent.id), 'INVARIANT: Learner removed from cache only after confirmed Supabase deletion');

    // ---------------------------------------------------------------------------
    // SECTION 2: TEACHER DELETION INVARIANT
    // ---------------------------------------------------------------------------
    console.log('\n--- SECTION 2: TEACHER DELETION AUTHORITY ---');

    const testTeacher: Teacher = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      user_id: '770e8400-e29b-41d4-a716-446655440002',
      teacher_name: 'Test Delete Authority Teacher',
      tsc_number: 'TSC-DEL-999',
      phone: '+254 700 999 888',
      email: 'teacher.del.auth@school.ac.ke',
      username: 'teacher.del.auth',
      is_class_teacher: true,
      status: 'Active',
      allocations: [],
    };

    const testClass: ClassStream = {
      id: 'cls_test_01',
      class_name: 'Grade 8',
      stream: 'East',
      class_teacher_id: testTeacher.id,
      capacity: 40,
    };

    const testUser: User = {
      id: testTeacher.user_id!,
      name: testTeacher.teacher_name,
      email: testTeacher.email,
      username: testTeacher.username,
      role: 'class_teacher',
      status: 'Active',
      teacher_id: testTeacher.id,
    };

    // 2.1 Set up local state
    setStorage(KEYS.TEACHERS, [testTeacher]);
    setStorage(KEYS.CLASSES, [testClass]);
    setStorage(KEYS.USERS, [testUser]);

    assert(api.getTeachers().some(t => t.id === testTeacher.id), 'Teacher initialized in local storage');
    assert(api.getClasses().find(c => c.id === testClass.id)?.class_teacher_id === testTeacher.id, 'Class teacher linked in storage');

    // 2.2 Simulate Server Deletion Failure
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response(JSON.stringify({ success: false, error: 'Database atomic teacher deletion failed: foreign key' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(url);
    };

    let caughtTeacherErr = false;
    try {
      await api.deleteTeacher(testTeacher.id);
    } catch (e: any) {
      caughtTeacherErr = true;
      assert(e.message.includes('Database atomic teacher deletion failed'), 'Teacher delete error message propagated from server');
    }
    assert(caughtTeacherErr, 'api.deleteTeacher threw error upon server failure');

    // INVARIANT: Cache, users, classes MUST NOT be modified when server deletion fails
    const teachersAfterFailedDelete = api.getTeachers();
    assert(teachersAfterFailedDelete.some(t => t.id === testTeacher.id), 'INVARIANT: Teacher remains in local cache when Supabase deletion fails');
    const classesAfterFailedDelete = api.getClasses();
    assert(classesAfterFailedDelete.find(c => c.id === testClass.id)?.class_teacher_id === testTeacher.id, 'INVARIANT: Class teacher link preserved when deletion fails');

    // 2.3 Simulate Server Deletion Success
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response(JSON.stringify({ success: true, message: 'Teacher deleted successfully from Supabase' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(url);
    };

    await api.deleteTeacher(testTeacher.id);
    const teachersAfterSuccessDelete = api.getTeachers();
    assert(!teachersAfterSuccessDelete.some(t => t.id === testTeacher.id), 'INVARIANT: Teacher removed from cache after confirmed Supabase deletion');
    const classesAfterSuccessDelete = api.getClasses();
    assert(classesAfterSuccessDelete.find(c => c.id === testClass.id)?.class_teacher_id === undefined, 'INVARIANT: Class teacher link cleared after confirmed deletion');

  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
  }

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`==================================================`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed.`);
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('learnerAndTeacherDeletionAuthority')) {
  runDeletionAuthorityTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
