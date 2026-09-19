import { api, getDeletedTeacherIdentifiers, recordDeletedTeacherIdentifier } from '../lib/storage';
import type { Teacher } from '../types';

// Mock localStorage for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

export async function runTeacherDeletionPersistenceTests() {
  console.log('=== RUNNING TEACHER DELETION & PERSISTENCE TESTS ===\n');
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

  try {
    // Test 1: Record deletion in tombstone store and ensure getTeachers filters it out
    const teacherId = 'tch_test_del_123';
    const teacherEmail = 'testdelete@school.ac.ke';
    const testTeacher: Teacher = {
      id: teacherId,
      user_id: 'usr_test_del_123',
      teacher_name: 'Test Delete Teacher',
      tsc_number: 'TSC-99999',
      phone: '+254 712 345 678',
      email: teacherEmail,
      username: 'testdelete',
      is_class_teacher: false,
      status: 'Active',
      allocations: [],
    };

    api.addTeacher(testTeacher);
    let teachers = api.getTeachers();
    assert(teachers.some(t => t.id === teacherId), 'Teacher successfully added to storage');

    await api.deleteTeacher(teacherId, { alreadyDeletedOnServer: true });
    const tombstone = getDeletedTeacherIdentifiers();
    assert(tombstone.ids.has(teacherId), 'Deleted teacher ID recorded in tombstone store');
    assert(tombstone.emails.has(teacherEmail.toLowerCase()), 'Deleted teacher email recorded in tombstone store');

    teachers = api.getTeachers();
    assert(!teachers.some(t => t.id === teacherId || t.email === teacherEmail), 'getTeachers() filters out deleted teacher');

    // Test 2: Re-adding teacher clears tombstone entry
    const newTeacher: Teacher = {
      ...testTeacher,
      teacher_name: 'Re-added Teacher',
    };
    api.addTeacher(newTeacher);

    const updatedTombstone = getDeletedTeacherIdentifiers();
    assert(!updatedTombstone.ids.has(teacherId), 'Re-adding teacher clears ID tombstone');
    assert(!updatedTombstone.emails.has(teacherEmail.toLowerCase()), 'Re-adding teacher clears email tombstone');

    teachers = api.getTeachers();
    assert(teachers.some(t => t.id === teacherId), 'Re-added teacher present in getTeachers()');

    // Clean up
    await api.deleteTeacher(teacherId, { alreadyDeletedOnServer: true });

  } catch (err: any) {
    console.error('Test suite exception:', err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed.`);
  }
}

// Run tests if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('teacherDeletionPersistence')) {
  runTeacherDeletionPersistenceTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
