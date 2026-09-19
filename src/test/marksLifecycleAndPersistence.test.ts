import { test, assert } from 'vitest';
import { api, setStorage, getStorage, syncFromSupabase, KEYS } from '../lib/storage';
import { calculateExamResults } from '../services/analysisEngine';
import { calculateSchoolAnalytics } from '../services/schoolAnalyticsEngine';
import { Student, Examination, Subject, ClassStream, Mark, User } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

// Fixed UUIDs for test entities
const testExamId = '11111111-1111-4111-8111-111111111111';
const testStd1Id = '22222222-2222-4222-8222-222222222221';
const testStd2Id = '22222222-2222-4222-8222-222222222222';
const testSub1Id = '33333333-3333-4333-8333-333333333331';
const testSub2Id = '33333333-3333-4333-8333-333333333332';
const testClassId = '44444444-4444-4444-8444-444444444444';

const testExam: Examination = {
  id: testExamId,
  exam_name: 'Mid Term 1 Examination 2026',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'End-Term',
  max_marks: 100,
};

const testClass: ClassStream = {
  id: testClassId,
  class_name: 'Grade 8',
  stream: 'Alpha',
  education_level: 'Junior School',
  allocated_subject_ids: [testSub1Id, testSub2Id],
};

const testStudent1: Student = {
  id: testStd1Id,
  admission_number: 'ADM-1001',
  full_name: 'David Otieno',
  gender: 'M',
  class_id: testClassId,
  stream_id: testClassId,
  active: true,
  grade: 'Grade 8',
  education_level: 'Junior School',
};

const testStudent2: Student = {
  id: testStd2Id,
  admission_number: 'ADM-1002',
  full_name: 'Faith Chebet',
  gender: 'F',
  class_id: testClassId,
  stream_id: testClassId,
  active: true,
  grade: 'Grade 8',
  education_level: 'Junior School',
};

const testSubject1: Subject = {
  id: testSub1Id,
  subject_code: 'MAT',
  subject_name: 'Mathematics',
  education_level: 'Junior School',
  category: 'Core',
};

const testSubject2: Subject = {
  id: testSub2Id,
  subject_code: 'ENG',
  subject_name: 'English',
  education_level: 'Junior School',
  category: 'Core',
};

const teacherUser: User = {
  id: 'usr_teacher_01',
  name: 'Mr. James Mwangi',
  email: 'james@school.ac.ke',
  role: 'subject_teacher',
};

const adminUser: User = {
  id: 'usr_admin_01',
  name: 'Administrator',
  email: 'admin@school.ac.ke',
  role: 'admin',
};

function setupTestEnvironment() {
  (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
    from: (_table: string) => ({
      upsert: async (payloads: any[]) => ({ data: payloads, error: null }),
      update: (_payloads: any) => ({
        eq: async () => ({ data: null, error: null }),
      }),
      insert: async (payloads: any[]) => ({ data: payloads, error: null }),
      select: () => ({ limit: () => ({ data: [], error: null }), eq: () => ({ data: [], error: null }) }),
    }),
  };

  // Populate local storage with test fixtures
  const currentExams = api.getExaminations();
  setStorage(KEYS.EXAMS, [testExam, ...currentExams.filter((e) => e.id !== testExamId)]);

  const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
  setStorage(KEYS.CLASSES, [testClass, ...currentClasses.filter((c: any) => c.id !== testClassId)]);

  const currentStudents = api.getStudents();
  setStorage(KEYS.STUDENTS, [testStudent1, testStudent2, ...currentStudents.filter((s) => s.id !== testStd1Id && s.id !== testStd2Id)]);

  const currentSubjects = api.getSubjects();
  setStorage(KEYS.SUBJECTS, [testSubject1, testSubject2, ...currentSubjects.filter((s) => s.id !== testSub1Id && s.id !== testSub2Id)]);
}

test('MARKS LIFECYCLE 1 — Marks Entry & Persistence in Memory/Storage', async () => {
  setupTestEnvironment();

  // Save Marks (Simulating Marks Entry Table)
  const entryMarks: Mark[] = [
    {
      id: `mk_${testStd1Id}_${testSub1Id}_${testExamId}`,
      student_id: testStd1Id,
      subject_id: testSub1Id,
      exam_id: testExamId,
      marks: 90, // 45/50 = 90%
      raw_score: 45,
      out_of: 50,
      special_status: 'Normal',
      updated_at: new Date().toISOString(),
    },
    {
      id: `mk_${testStd1Id}_${testSub2Id}_${testExamId}`,
      student_id: testStd1Id,
      subject_id: testSub2Id,
      exam_id: testExamId,
      marks: 80, // 40/50 = 80%
      raw_score: 40,
      out_of: 50,
      special_status: 'Normal',
      updated_at: new Date().toISOString(),
    },
    {
      id: `mk_${testStd2Id}_${testSub1Id}_${testExamId}`,
      student_id: testStd2Id,
      subject_id: testSub1Id,
      exam_id: testExamId,
      marks: 0,
      raw_score: null,
      out_of: 50,
      special_status: 'X', // Absent
      updated_at: new Date().toISOString(),
    },
    {
      id: `mk_${testStd2Id}_${testSub2Id}_${testExamId}`,
      student_id: testStd2Id,
      subject_id: testSub2Id,
      exam_id: testExamId,
      marks: 70, // 35/50 = 70%
      raw_score: 35,
      out_of: 50,
      special_status: 'Normal',
      updated_at: new Date().toISOString(),
    },
  ];

  await api.saveBulkMarks(entryMarks, teacherUser);

  const savedMarks = api.getMarks();
  const matchStd1Math = savedMarks.find(
    (m) => m.student_id === testStd1Id && m.subject_id === testSub1Id && m.exam_id === testExamId
  );
  assert(matchStd1Math !== undefined, 'Saved mark for Student 1 Mathematics exists in storage');
  assert.strictEqual(matchStd1Math?.raw_score, 45, 'Raw score 45 preserved');
  assert.strictEqual(matchStd1Math?.out_of, 50, 'Max score 50 preserved');
  assert.strictEqual(matchStd1Math?.marks, 90, 'Percentage score 90 preserved');

  const matchStd2Math = savedMarks.find(
    (m) => m.student_id === testStd2Id && m.subject_id === testSub1Id && m.exam_id === testExamId
  );
  assert(matchStd2Math !== undefined, 'Saved mark for Student 2 Mathematics exists');
  assert.strictEqual(matchStd2Math?.special_status, 'X', 'Special status X preserved for absent learner');
});

test('MARKS LIFECYCLE 2 — Marks Monitoring & Provisional Results Calculation', () => {
  setupTestEnvironment();
  const currentMarks = api.getMarks().filter((m) => m.exam_id === testExamId);

  // Run calculateExamResults
  const results = calculateExamResults(
    testExamId,
    [testStudent1, testStudent2],
    currentMarks,
    [],
    [testClass],
    [testSubject1, testSubject2]
  );

  assert.strictEqual(results.length, 2, 'Two student result records calculated');

  const resStd1 = results.find((r) => r.student_id === testStd1Id);
  assert(resStd1 !== undefined, 'Result for David Otieno exists');
  assert.strictEqual(resStd1?.is_complete, true, 'David Otieno with 2/2 normal marks is Complete');
  assert.strictEqual(resStd1?.status, 'Complete', 'Status is Complete');
  assert.strictEqual(resStd1?.total_marks, 170, 'Junior school total percentage marks = 90 + 80 = 170');
  assert.strictEqual(resStd1?.average, 85, 'Average marks = 170 / 2 = 85');
  assert.strictEqual(resStd1?.position, 1, 'David Otieno ranked position 1');

  const resStd2 = results.find((r) => r.student_id === testStd2Id);
  assert(resStd2 !== undefined, 'Result for Faith Chebet exists');
  assert.strictEqual(resStd2?.is_complete, false, 'Faith Chebet with missing X mark is Provisional');
  assert.strictEqual(resStd2?.status, 'Provisional', 'Status is Provisional');
  assert.strictEqual(resStd2?.position, 0, 'Provisional learner receives position 0 (Unranked)');
});

test('MARKS LIFECYCLE 3 — Examination Approval & Lock Enforcement', async () => {
  setupTestEnvironment();

  // 1. Approve Examination
  const approvedExam = await api.updateExaminationStatus(testExamId, 'Approved', adminUser);
  assert.strictEqual(approvedExam.status, 'Approved', 'Examination status transitioned to Approved');

  // 2. Attempt to save marks for an Approved examination must fail
  const markAttempt: Mark[] = [
    {
      id: `mk_${testStd1Id}_${testSub1Id}_${testExamId}`,
      student_id: testStd1Id,
      subject_id: testSub1Id,
      exam_id: testExamId,
      marks: 95,
      raw_score: 47,
      out_of: 50,
      special_status: 'Normal',
      updated_at: new Date().toISOString(),
    },
  ];

  let threwLockError = false;
  try {
    await api.saveBulkMarks(markAttempt, teacherUser);
  } catch (err: any) {
    threwLockError = true;
    assert(
      err.message.includes('locked') || err.message.includes('approved'),
      'Error message correctly specifies locked examination constraint'
    );
  }
  assert(threwLockError, 'Saving marks to an approved examination was blocked');

  // 3. Reopening restriction check: Subject teacher cannot reopen approved exam
  let threwRoleError = false;
  try {
    await api.updateExaminationStatus(testExamId, 'Draft', teacherUser);
  } catch (err: any) {
    threwRoleError = true;
    assert(
      err.message.includes('UNAUTHORIZED') || err.message.includes('Administrator'),
      'Error correctly restricts reopening to Administrator'
    );
  }
  assert(threwRoleError, 'Subject teacher was blocked from reopening approved examination');

  // 4. Admin can reopen approved examination
  const reopenedExam = await api.updateExaminationStatus(testExamId, 'Draft', adminUser);
  assert.strictEqual(reopenedExam.status, 'Draft', 'Administrator successfully reopened examination to Draft');
});

test('MARKS LIFECYCLE 4 — School Analytics Integration', () => {
  setupTestEnvironment();
  const currentMarks = api.getMarks().filter((m) => m.exam_id === testExamId);

  const analytics = calculateSchoolAnalytics(
    testExamId,
    [testExam],
    [testStudent1, testStudent2],
    [testClass],
    [testSubject1, testSubject2],
    currentMarks,
    [],
    'Junior School'
  );

  assert(analytics !== null, 'School analytics calculated successfully');
  assert.strictEqual(analytics?.total_students_assessed, 2, 'Analytics includes both assessed learners');
  assert(analytics?.subject_rankings && analytics.subject_rankings.length > 0, 'Subject rankings computed');
  assert(analytics?.best_learners_school && analytics.best_learners_school.length > 0, 'Best learners list computed');
  assert.strictEqual(analytics?.best_learners_school[0]?.name, 'David Otieno', 'Top performing learner is David Otieno');
});
