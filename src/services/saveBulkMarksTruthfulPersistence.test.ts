import { api, setStorage, getStorage, KEYS } from '../lib/storage';
import { Mark, Student, Subject, Examination, Teacher } from '../types';

console.log('=== RUNNING SAVEBULKMARKS TRUTHFUL PERSISTENCE REGRESSION TESTS ===');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

// In-memory localStorage mock if not available
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

const testStudentId = 'a1111111-1111-4111-8111-111111111111';
const testSubjectId = 'b2222222-2222-4222-8222-222222222222';
const testExamId = 'c3333333-3333-4333-8333-333333333333';
const testTeacherId = 'd4444444-4444-4444-8444-444444444444';

const initialStudent: Student = {
  id: testStudentId,
  admission_number: 'ADM-001',
  full_name: 'John Doe',
  gender: 'M',
  class_id: 'class-1',
  active: true,
};

const initialSubject: Subject = {
  id: testSubjectId,
  subject_code: 'MAT',
  subject_name: 'Mathematics',
  category: 'Core',
  department: 'Sciences',
  status: 'Active',
};

const initialExam: Examination = {
  id: testExamId,
  exam_name: 'Term 1 Exam',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'End-Term',
  max_marks: 100,
};

const initialTeacher: Teacher = {
  id: testTeacherId,
  tsc_number: 'TSC-12345',
  teacher_name: 'Teacher Jane',
  phone: '0700000000',
  email: 'jane@school.ac.ke',
  status: 'Active',
};

function setupInitialState() {
  setStorage(KEYS.STUDENTS, [initialStudent]);
  setStorage(KEYS.SUBJECTS, [initialSubject]);
  setStorage(KEYS.EXAMS, [initialExam]);
  setStorage(KEYS.TEACHERS, [initialTeacher]);
  setStorage(KEYS.MARKS, [
    {
      id: 'existing-mark-1',
      student_id: testStudentId,
      subject_id: testSubjectId,
      exam_id: testExamId,
      marks: 75,
      raw_score: 75,
      out_of: 100,
    },
  ]);
}

async function runTests() {
  let passed = 0;

  // TEST 1: Successful Supabase Upsert -> local cache updated & function resolves
  {
    setupInitialState();
    let upsertCalled = false;
    let payloadSent: any = null;

    const mockClient: any = {
      from: (table: string) => {
        if (table === 'marks') {
          return {
            upsert: async (payloads: any[]) => {
              upsertCalled = true;
              payloadSent = payloads;
              return { data: payloads, error: null };
            },
          };
        }
        return { select: () => ({ limit: () => ({ data: [], error: null }) }) };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const updatedMarks: Mark[] = [
      {
        id: 'new-mark-1',
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        marks: 88,
        raw_score: 88,
        out_of: 100,
      },
    ];

    await api.saveBulkMarks(updatedMarks);

    assert(upsertCalled, 'TEST 1: Supabase client.from("marks").upsert was called');
    assert(payloadSent?.[0]?.marks === 88, 'TEST 1: Correct marks payload passed to database');

    const storedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    assert(storedMarks.length === 1, 'TEST 1: Local cache contains 1 mark');
    assert(storedMarks[0].marks === 88, 'TEST 1: Local cache updated with confirmed database marks (88)');
    passed++;
  }

  // TEST 2: Foreign Key Failure (23503) -> Throws error & DOES NOT update local cache
  {
    setupInitialState();
    const mockClient: any = {
      from: (table: string) => {
        if (table === 'marks') {
          return {
            upsert: async () => {
              return {
                data: null,
                error: {
                  code: '23503',
                  message: 'insert or update on table "marks" violates foreign key constraint "marks_subject_id_fkey"',
                  details: 'Key (subject_id)=(invalid-uuid) is not present in table "subjects".',
                },
              };
            },
          };
        }
        return { select: () => ({ limit: () => ({ data: [], error: null }) }) };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const failedAttemptMarks: Mark[] = [
      {
        id: 'fail-mark-2',
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        marks: 99,
      },
    ];

    let errorCaught: any = null;
    try {
      await api.saveBulkMarks(failedAttemptMarks);
    } catch (err) {
      errorCaught = err;
    }

    assert(errorCaught !== null, 'TEST 2: Foreign key violation 23503 was not swallowed and threw an error');
    assert(errorCaught.code === '23503', 'TEST 2: Error object preserves PostgreSQL error code 23503');
    assert(errorCaught.message.includes('foreign key constraint'), 'TEST 2: Error message includes diagnostic details');

    const storedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    assert(storedMarks[0].marks === 75, 'TEST 2: Local cache was NOT polluted with failed marks (retains original 75)');
    passed++;
  }

  // TEST 3: NOT NULL Violation (23502) -> Throws error & DOES NOT update local cache
  {
    setupInitialState();
    const mockClient: any = {
      from: (table: string) => {
        if (table === 'marks') {
          return {
            upsert: async () => {
              return {
                data: null,
                error: {
                  code: '23502',
                  message: 'null value in column "marks" of relation "marks" violates not-null constraint',
                  details: 'Failing row contains (null).',
                },
              };
            },
          };
        }
        return { select: () => ({ limit: () => ({ data: [], error: null }) }) };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const failedAttemptMarks: Mark[] = [
      {
        id: 'fail-mark-3',
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        marks: 0,
      },
    ];

    let errorCaught: any = null;
    try {
      await api.saveBulkMarks(failedAttemptMarks);
    } catch (err) {
      errorCaught = err;
    }

    assert(errorCaught !== null, 'TEST 3: NOT NULL violation 23502 threw an error');
    assert(errorCaught.code === '23502', 'TEST 3: Error object preserves code 23502');

    const storedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    assert(storedMarks[0].marks === 75, 'TEST 3: Local cache was NOT updated on 23502 failure');
    passed++;
  }

  // TEST 4: Unique / Conflict Violation (23505) -> Throws error & DOES NOT update local cache
  {
    setupInitialState();
    const mockClient: any = {
      from: (table: string) => {
        if (table === 'marks') {
          return {
            upsert: async () => {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "marks_unique_entry"',
                  details: 'Key already exists.',
                },
              };
            },
          };
        }
        return { select: () => ({ limit: () => ({ data: [], error: null }) }) };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const failedAttemptMarks: Mark[] = [
      {
        id: 'fail-mark-4',
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        marks: 50,
      },
    ];

    let errorCaught: any = null;
    try {
      await api.saveBulkMarks(failedAttemptMarks);
    } catch (err) {
      errorCaught = err;
    }

    assert(errorCaught !== null, 'TEST 4: Unique constraint violation 23505 threw an error');
    assert(errorCaught.code === '23505', 'TEST 4: Error object preserves code 23505');

    const storedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    assert(storedMarks[0].marks === 75, 'TEST 4: Local cache was NOT updated on 23505 failure');
    passed++;
  }

  // TEST 5: Relation Missing (42P01) or RLS Permission Denied (42501) -> Throws & Blocks Local Cache
  {
    setupInitialState();
    const mockClient: any = {
      from: (table: string) => {
        if (table === 'marks') {
          return {
            upsert: async () => {
              return {
                data: null,
                error: {
                  code: '42P01',
                  message: 'relation "marks" does not exist',
                },
              };
            },
          };
        }
        return { select: () => ({ limit: () => ({ data: [], error: null }) }) };
      },
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockClient;

    const failedAttemptMarks: Mark[] = [
      {
        id: 'fail-mark-5',
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        marks: 60,
      },
    ];

    let errorCaught: any = null;
    try {
      await api.saveBulkMarks(failedAttemptMarks);
    } catch (err) {
      errorCaught = err;
    }

    assert(errorCaught !== null, 'TEST 5: Missing table 42P01 threw an error');
    assert(errorCaught.code === '42P01', 'TEST 5: Error object preserves code 42P01');

    const storedMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    assert(storedMarks[0].marks === 75, 'TEST 5: Local cache was NOT updated on 42P01 failure');
    passed++;
  }

  delete (globalThis as any).__TEST_SUPABASE_CLIENT__;

  console.log(`\nALL ${passed}/5 SAVEBULKMARKS TRUTHFUL PERSISTENCE TESTS PASSED.`);
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
