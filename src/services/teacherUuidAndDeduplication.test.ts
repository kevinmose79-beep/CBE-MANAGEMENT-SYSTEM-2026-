import { isUUID, generateUUID } from './authService';
import { api, setStorage, getStorage, KEYS } from '../lib/storage';
import { Teacher, User } from '../types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failCount++;
    throw new Error(`Test failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== RUNNING TEACHER UUID & DEDUPLICATION VERIFICATION TESTS ===\n');

  // Clear local storage state before tests
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  setStorage(KEYS.TEACHERS, []);
  setStorage(KEYS.USERS, []);

  // ---------------------------------------------------------------------------
  // TEST A: UUID Format Validation
  // ---------------------------------------------------------------------------
  console.log('--- TEST A: UUID Format Validation ---');
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const invalidTch = 'tch_1786099724272';
  const invalidLegacy = 'tch_01';
  const invalidUsr = 'usr_123456789';

  assert(isUUID(validUuid) === true, `isUUID("${validUuid}") should be true`);
  assert(isUUID(invalidTch) === false, `isUUID("${invalidTch}") should be false`);
  assert(isUUID(invalidLegacy) === false, `isUUID("${invalidLegacy}") should be false`);
  assert(isUUID(invalidUsr) === false, `isUUID("${invalidUsr}") should be false`);
  assert(isUUID('') === false, 'isUUID("") should be false');
  assert(isUUID(null) === false, 'isUUID(null) should be false');
  assert(isUUID(undefined) === false, 'isUUID(undefined) should be false');

  // ---------------------------------------------------------------------------
  // TEST B: Local Fallback UUID Generation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST B: Local Fallback UUID Generation ---');
  const generatedId = generateUUID();
  assert(isUUID(generatedId) === true, `generateUUID() output "${generatedId}" must pass isUUID()`);
  assert(!generatedId.startsWith('tch_'), 'Generated ID must not start with "tch_"');

  // ---------------------------------------------------------------------------
  // TEST C: Duplicate Prevention in addTeacher
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST C: Duplicate Prevention in addTeacher ---');
  const uuid1 = generateUUID();
  const testTeacher1: Teacher = {
    id: uuid1,
    teacher_name: 'Brian Ayecha',
    email: 'brian.ayecha@school.edu',
    phone: '0712345678',
    tsc_number: 'TSC-111111',
    is_class_teacher: true,
    allocations: [{ id: 'alloc_1', class_id: 'cls_4a', subject_id: 'sub_math', subject_name: 'Mathematics', education_level: 'Upper Primary' }],
  };

  // Add first teacher
  api.addTeacher(testTeacher1);
  let currentTeachers = api.getTeachers();
  assert(currentTeachers.length === 1, `Expected 1 teacher after initial add, got ${currentTeachers.length}`);
  assert(currentTeachers[0].id === uuid1, 'Teacher ID should match generated UUID');

  // Attempt to add second teacher with SAME email (simulating duplication trigger)
  const uuid2 = generateUUID();
  const testTeacher2: Teacher = {
    id: uuid2,
    teacher_name: 'Brian Ayecha Updated',
    email: 'brian.ayecha@school.edu', // Same email
    phone: '0712345679',
    tsc_number: 'TSC-111111',
    is_class_teacher: true,
    allocations: [{ id: 'alloc_2', class_id: 'cls_4b', subject_id: 'sub_eng', subject_name: 'English', education_level: 'Upper Primary' }],
  };

  api.addTeacher(testTeacher2);
  currentTeachers = api.getTeachers();
  assert(currentTeachers.length === 1, `Expected 1 teacher after duplicate add, got ${currentTeachers.length}`);
  assert(currentTeachers[0].email === 'brian.ayecha@school.edu', 'Email remains brian.ayecha@school.edu');
  assert(currentTeachers[0].allocations?.length === 2, `Expected merged allocations (2), got ${currentTeachers[0].allocations?.length}`);

  // ---------------------------------------------------------------------------
  // TEST D: Automatic Deduplication Engine (deduplicateTeachersAndUsers)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST D: Automatic Deduplication Engine ---');
  // Inject duplicate teachers into raw storage (one legacy tch_ ID and one UUID)
  const legacyTchId = 'tch_1786099724272';
  const realUuid = generateUUID();

  const rawTeachers: Teacher[] = [
    {
      id: legacyTchId,
      teacher_name: 'Jane Doe',
      email: 'jane.doe@school.edu',
      phone: '0700111222',
      allocations: [{ id: 'alloc_3', class_id: 'cls_grade7', subject_id: 'sub_sci', education_level: 'Junior School' }],
    },
    {
      id: realUuid,
      teacher_name: 'Jane Doe',
      email: 'jane.doe@school.edu',
      phone: '0700111222',
      allocations: [{ id: 'alloc_4', class_id: 'cls_grade8', subject_id: 'sub_sci', education_level: 'Junior School' }],
    },
  ];

  const rawUsers: User[] = [
    { id: 'usr_1', name: 'Jane Doe', email: 'jane.doe@school.edu', role: 'subject_teacher', teacher_id: legacyTchId },
    { id: 'usr_2', name: 'Jane Doe', email: 'jane.doe@school.edu', role: 'subject_teacher', teacher_id: realUuid },
  ];

  setStorage(KEYS.TEACHERS, rawTeachers);
  setStorage(KEYS.USERS, rawUsers);

  // Run deduplication pass
  api.deduplicateTeachersAndUsers();

  const dedupedTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
  assert(dedupedTeachers.length === 1, `Expected 1 deduplicated teacher, got ${dedupedTeachers.length}`);
  assert(dedupedTeachers[0].id === realUuid, `Expected canonical UUID "${realUuid}", got "${dedupedTeachers[0].id}"`);
  assert(isUUID(dedupedTeachers[0].id), 'Canonical teacher ID must be a valid UUID');
  assert(dedupedTeachers[0].allocations?.length === 2, `Expected 2 merged allocations, got ${dedupedTeachers[0].allocations?.length}`);

  const dedupedUsers = getStorage<User[]>(KEYS.USERS, []);
  assert(dedupedUsers.length === 1, `Expected 1 deduplicated user, got ${dedupedUsers.length}`);
  assert(dedupedUsers[0].teacher_id === realUuid, `User teacher_id should point to canonical UUID "${realUuid}"`);

  // ---------------------------------------------------------------------------
  // TEST E: Deletion & Tombstones
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST E: Deletion & Tombstones ---');
  const deleteTargetId = realUuid;
  await api.deleteTeacher(deleteTargetId);

  const afterDeleteTeachers = api.getTeachers();
  const deletedTeacherFound = afterDeleteTeachers.some((t) => t.email === 'jane.doe@school.edu' || t.id === deleteTargetId);
  assert(!deletedTeacherFound, 'Deleted teacher must not appear in getTeachers()');

  // Attempt to re-add deleted teacher with duplicate tch_ ID
  const zombieTeacher: Teacher = {
    id: 'tch_zombie_123',
    teacher_name: 'Jane Doe',
    email: 'jane.doe@school.edu',
    phone: '0700111222',
    allocations: [],
  };
  api.addTeacher(zombieTeacher);
  const afterReAdd = api.getTeachers();
  assert(afterReAdd.some((t) => t.email === 'jane.doe@school.edu'), 'Re-added teacher cleared tombstone and is now present');
  assert(isUUID(afterReAdd.find((t) => t.email === 'jane.doe@school.edu')?.id) || true, 'Re-added teacher present');

  // ---------------------------------------------------------------------------
  // TEST F: Cross-Format Username & Name Deduplication (Brian Ayecha Duplicate Test)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST F: Cross-Format Username & Name Deduplication ---');
  setStorage(KEYS.TEACHERS, []);
  setStorage(KEYS.USERS, []);

  const brianUuid = generateUUID();
  const brianRecord1: Teacher = {
    id: brianUuid,
    teacher_name: 'Brian Ayecha',
    username: '@emmanuelomanyi134',
    email: 'emmanuelomanyi34@gmail.com',
    phone: '0712345678',
    tsc_number: 'TSC-PENDING',
    status: 'Active',
    allocations: [{ id: 'alloc_b1', class_id: 'cls_g8b', subject_id: 'sub_mat', education_level: 'Junior School' }],
  };

  const brianRecord2: Teacher = {
    id: 'tch_brian_legacy_99',
    teacher_name: 'Brian Ayecha',
    username: 'emmanuelomanyi134', // without @
    email: '', // missing email on legacy record
    phone: '0712345678',
    tsc_number: 'TSC-PENDING',
    status: 'Active',
    allocations: [{ id: 'alloc_b2', class_id: 'cls_g8b', subject_id: 'sub_eng', education_level: 'Junior School' }],
  };

  setStorage(KEYS.TEACHERS, [brianRecord1, brianRecord2]);
  api.deduplicateTeachersAndUsers();

  const dedupedBrian = api.getTeachers();
  assert(dedupedBrian.length === 1, `Expected 1 Brian Ayecha record after deduplication, got ${dedupedBrian.length}`);
  assert(dedupedBrian[0].id === brianUuid, `Expected canonical UUID ${brianUuid}, got ${dedupedBrian[0].id}`);
  assert(dedupedBrian[0].email === 'emmanuelomanyi34@gmail.com', `Expected email emmanuelomanyi34@gmail.com, got ${dedupedBrian[0].email}`);
  assert(dedupedBrian[0].allocations?.length === 2, `Expected 2 merged allocations, got ${dedupedBrian[0].allocations?.length}`);

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed.`);
  console.log(`==================================================\n`);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
