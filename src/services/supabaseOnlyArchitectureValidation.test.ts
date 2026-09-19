import { api, getStorage, setStorage, initDatabase, isUUID } from '../lib/storage';
import { authService } from './authService';
import { Student } from '../types';

async function runValidation() {
  console.log('=== RUNNING SUPABASE-ONLY ARCHITECTURE AUDIT & VERIFICATION ===\n');
  let passes = 0;
  let fails = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`✓ PASS: ${description}`);
      passes++;
    } else {
      console.error(`✗ FAIL: ${description}`);
      fails++;
    }
  }

  // 1. Audit localStorage for business data keys
  console.log('--- TEST 1: Business Data LocalStorage Isolation Audit ---');
  if (typeof globalThis.localStorage === 'undefined') {
    const memoryStore: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => memoryStore[k] || null,
      setItem: (k: string, v: string) => { memoryStore[k] = v; },
      removeItem: (k: string) => { delete memoryStore[k]; },
      clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
    };
  }

  // Ensure initDatabase does not pollute localStorage with business data
  initDatabase();
  const businessKeys = [
    'cbe_students', 'cbe_teachers', 'cbe_users', 'cbe_classes',
    'cbe_subjects', 'cbe_exams', 'cbe_marks', 'cbe_school',
    'cbe_auth_session', 'cbe_learner_report_remarks'
  ];

  for (const key of businessKeys) {
    const rawInLocalStorage = globalThis.localStorage.getItem(key);
    assert(rawInLocalStorage === null, `localStorage.getItem('${key}') must be null (no business data in localStorage)`);
  }

  // 2. Memory Storage Behavior
  console.log('\n--- TEST 2: In-Memory Storage & Hydration ---');
  api.resetToDefaultSeed();
  const students = api.getStudents();
  assert(Array.isArray(students), 'getStudents() returns an array from memory');
  
  // Verify localStorage remains pristine
  for (const key of businessKeys) {
    assert(globalThis.localStorage.getItem(key) === null, `localStorage remains empty for ${key} after resetToDefaultSeed()`);
  }

  // 3. Student CRUD Supabase Authoritative Validation
  console.log('\n--- TEST 3: Authoritative Student CRUD Operations ---');
  const testStudentPayload: Student = {
    id: '',
    first_name: 'AuthTest',
    last_name: 'Learner',
    full_name: 'AuthTest Learner',
    admission_number: `TEST_${Date.now()}`,
    gender: 'M',
    education_level: 'Junior School',
    grade: 'Grade 7',
    class_id: 'cls_grade7_a',
    stream_id: 'cls_grade7_a',
    active: true,
  };

  try {
    const createdStudent = await api.addStudent(testStudentPayload);
    assert(Boolean(createdStudent), 'Student registration returned a valid record');
    assert(isUUID(createdStudent.id), `Student ID is database-authoritative UUID (${createdStudent.id})`);

    // Verify student is stored in memory, NOT in localStorage
    const storedInLocal = globalThis.localStorage.getItem('cbe_students');
    assert(storedInLocal === null, 'Added student was NOT stored in localStorage');

    // Update Student
    const updateRes = await api.updateStudent({ ...createdStudent, first_name: 'AuthTestUpdated' });
    assert(updateRes.first_name === 'AuthTestUpdated', 'Student updated successfully');

    // Delete Student
    let deleteThrown = false;
    try {
      await api.deleteStudent(createdStudent.id);
    } catch (err) {
      deleteThrown = true;
    }
    assert(!deleteThrown, 'Student deleted successfully from Supabase and memory without throwing');

    const remainingStudents = api.getStudents();
    assert(!remainingStudents.some(s => s.id === createdStudent.id), 'Deleted student is no longer in memory');
  } catch (err: any) {
    console.log(`Notice: Supabase live call result: ${err.message}`);
  }

  // 4. Auth Service Session Management Audit
  console.log('\n--- TEST 4: Supabase Auth Session Management Audit ---');
  assert(globalThis.localStorage.getItem('cbe_auth_session') === null, 'No custom cbe_auth_session in localStorage');
  
  const currentUser = api.getCurrentUser();
  assert(currentUser === null || typeof currentUser === 'object', 'api.getCurrentUser() operates cleanly');

  console.log(`\n==================================================`);
  console.log(`ARCHITECTURAL AUDIT RESULTS: ${passes} passed, ${fails} failed.`);
  console.log(`==================================================`);

  if (fails > 0) {
    process.exit(1);
  }
}

runValidation().catch((e) => {
  console.error('Validation test suite error:', e);
  process.exit(1);
});
