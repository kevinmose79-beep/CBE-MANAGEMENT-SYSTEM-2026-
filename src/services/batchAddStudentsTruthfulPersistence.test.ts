import { api, getStorage, setStorage, KEYS } from '../lib/storage';
import { Student, ClassStream } from '../types';

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

function createQueryMock(table: string, onInsert?: (payloads: any[]) => any) {
  return {
    insert: (payloads: any[]) => {
      if (onInsert) {
        return onInsert(payloads);
      }
      return {
        select: (_cols?: string) => Promise.resolve({ data: payloads, error: null }),
      };
    },
    select: (_cols?: string) => ({
      eq: (col: string, val: string) => ({
        maybeSingle: () => {
          if (table === 'streams' && col === 'id') {
            return Promise.resolve({ data: { id: val, class_id: val }, error: null });
          }
          if (table === 'classes' && col === 'id') {
            return Promise.resolve({ data: { id: val }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        limit: () => Promise.resolve({ data: [{ id: val }], error: null }),
      }),
      limit: () => Promise.resolve({ data: [], error: null }),
    }),
  };
}

async function runTests() {
  console.log('=== RUNNING BATCHADDSTUDENTS TRUTHFUL PERSISTENCE REGRESSION TESTS ===');

  const validClassId = 'c0000000-0000-0000-0000-000000000001';
  const initialClasses: ClassStream[] = [
    {
      id: validClassId,
      class_name: 'Grade 1',
      stream: 'East',
      stream_id: validClassId,
      education_level: 'Lower Primary',
    },
  ];

  const initialStudent: Student = {
    id: 's0000000-0000-0000-0000-000000000001',
    admission_number: 'ADM-001',
    full_name: 'Existing Student',
    first_name: 'Existing',
    last_name: 'Student',
    gender: 'M',
    class_id: validClassId,
    stream_id: validClassId,
    active: true,
    enrolment_status: 'active',
  };

  function setupInitialState() {
    setStorage(KEYS.CLASSES, initialClasses);
    setStorage(KEYS.STUDENTS, [initialStudent]);
  }

  // TEST A: Successful batch import
  {
    setupInitialState();
    const batchToImport: Student[] = [
      {
        id: 's0000000-0000-0000-0000-000000000002',
        admission_number: 'ADM-002',
        full_name: 'Alice Wambui',
        gender: 'F',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
        enrolment_status: 'active',
      },
      {
        id: 's0000000-0000-0000-0000-000000000003',
        admission_number: 'ADM-003',
        full_name: 'Brian Kipchoge',
        gender: 'M',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
        enrolment_status: 'active',
      },
    ];

    let insertedPayloads: any[] = [];
    const mockSuccessClient = {
      from: (table: string) => createQueryMock(table, (payloads) => {
        insertedPayloads = payloads;
        return {
          select: (_cols?: string) => Promise.resolve({
            data: payloads.map((p, idx) => ({
              id: p.id || `db-std-${idx + 2}`,
              admission_number: p.admission_number,
              full_name: p.full_name,
              gender: p.gender,
              class_id: p.class_id,
              stream_id: p.stream_id,
              dob: p.dob,
              active: p.active,
            })),
            error: null,
          }),
        };
      }),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockSuccessClient;

    const created = await api.batchAddStudents(batchToImport);
    assert(created.length === 2, 'TEST A: Returns 2 created students');
    assert(insertedPayloads.length === 2, 'TEST A: Passed 2 payloads to Supabase');

    const cache = getStorage<Student[]>(KEYS.STUDENTS, []);
    assert(cache.length === 3, 'TEST A: Local cache now contains 3 students (1 initial + 2 imported)');
    assert(cache.some((s) => s.admission_number === 'ADM-002'), 'TEST A: Cache has ADM-002');
    assert(cache.some((s) => s.admission_number === 'ADM-003'), 'TEST A: Cache has ADM-003');
    console.log('✓ PASS: TEST A: Successful batch import persisted to database and local cache');
  }

  // TEST B: Foreign-key failure "23503"
  {
    setupInitialState();
    const beforeCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    const invalidBatch: Student[] = [
      {
        id: 's0000000-0000-0000-0000-000000000099',
        admission_number: 'ADM-099',
        full_name: 'Invalid FK Learner',
        gender: 'M',
        class_id: 'c0000000-0000-0000-0000-000000000099',
        stream_id: 'c0000000-0000-0000-0000-000000000099',
        active: true,
      },
    ];

    const mockFkErrorClient = {
      from: (table: string) => createQueryMock(table, (_payloads) => ({
        select: (_cols?: string) => Promise.resolve({
          data: null,
          error: {
            code: '23503',
            message: 'insert or update on table "students" violates foreign key constraint "students_class_id_fkey"',
            details: 'Key (class_id)=(c0000000-0000-0000-0000-000000000099) is not present in table "classes".',
            hint: 'Provide a valid class_id.',
          },
        }),
      })),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockFkErrorClient;

    let errorThrown = false;
    let caughtError: any = null;
    try {
      await api.batchAddStudents(invalidBatch);
    } catch (err: any) {
      errorThrown = true;
      caughtError = err;
    }

    assert(errorThrown === true, 'TEST B: Error was thrown on 23503');
    assert(caughtError?.code === '23503', 'TEST B: Preserves PostgreSQL error code 23503');
    assert(caughtError?.message.includes('Foreign key reference error') || caughtError?.message.includes('23503'), 'TEST B: Error message includes diagnostic context');

    const afterCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    assert(afterCache.length === beforeCache.length, 'TEST B: Local cache was NOT polluted with rejected learner');
    assert(!afterCache.some((s) => s.admission_number === 'ADM-099'), 'TEST B: ADM-099 does not exist in local cache');
    console.log('✓ PASS: TEST B: Foreign-key failure 23503 correctly throws and blocks cache corruption');
  }

  // TEST C: NOT NULL failure "23502"
  {
    setupInitialState();
    const beforeCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    const invalidBatch: Student[] = [
      {
        id: 's0000000-0000-0000-0000-000000000088',
        admission_number: 'ADM-088',
        full_name: 'Missing Fields Learner',
        gender: 'F',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
      },
    ];

    const mockNotNullErrorClient = {
      from: (table: string) => createQueryMock(table, (_payloads) => ({
        select: (_cols?: string) => Promise.resolve({
          data: null,
          error: {
            code: '23502',
            message: 'null value in column "gender" of relation "students" violates not-null constraint',
            details: 'Failing row contains (ADM-088, null).',
            hint: null,
          },
        }),
      })),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockNotNullErrorClient;

    let errorThrown = false;
    let caughtError: any = null;
    try {
      await api.batchAddStudents(invalidBatch);
    } catch (err: any) {
      errorThrown = true;
      caughtError = err;
    }

    assert(errorThrown === true, 'TEST C: Error was thrown on 23502');
    assert(caughtError?.code === '23502', 'TEST C: Preserves PostgreSQL error code 23502');

    const afterCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    assert(afterCache.length === beforeCache.length, 'TEST C: Local cache was NOT updated on 23502 failure');
    assert(!afterCache.some((s) => s.admission_number === 'ADM-088'), 'TEST C: ADM-088 not in cache');
    console.log('✓ PASS: TEST C: NOT NULL failure 23502 correctly throws and preserves cache truth');
  }

  // TEST D: Unique constraint / duplicate admission failure "23505"
  {
    setupInitialState();
    const beforeCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    const duplicateBatch: Student[] = [
      {
        id: 's0000000-0000-0000-0000-000000000077',
        admission_number: 'ADM-001', // Already exists in database
        full_name: 'Duplicate Learner',
        gender: 'M',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
      },
    ];

    const mockDuplicateErrorClient = {
      from: (table: string) => createQueryMock(table, (_payloads) => ({
        select: (_cols?: string) => Promise.resolve({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "students_admission_number_key"',
            details: 'Key (admission_number)=(ADM-001) already exists.',
            hint: null,
          },
        }),
      })),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockDuplicateErrorClient;

    let errorThrown = false;
    let caughtError: any = null;
    try {
      await api.batchAddStudents(duplicateBatch);
    } catch (err: any) {
      errorThrown = true;
      caughtError = err;
    }

    assert(errorThrown === true, 'TEST D: Error was thrown on 23505');
    assert(caughtError?.code === '23505', 'TEST D: Preserves PostgreSQL error code 23505');
    assert(caughtError?.message.includes('Duplicate admission number') || caughtError?.message.includes('23505'), 'TEST D: Provides duplicate admission context');

    const afterCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    assert(afterCache.length === beforeCache.length, 'TEST D: Local cache was NOT updated on duplicate 23505 error');
    console.log('✓ PASS: TEST D: Unique constraint violation 23505 throws and prevents false success');
  }

  // TEST E: Missing table / database relation error "42P01"
  {
    setupInitialState();
    const beforeCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    const batch: Student[] = [
      {
        id: 's0000000-0000-0000-0000-000000000066',
        admission_number: 'ADM-066',
        full_name: 'Table Missing Learner',
        gender: 'F',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
      },
    ];

    const mockTableMissingClient = {
      from: (table: string) => createQueryMock(table, (_payloads) => ({
        select: (_cols?: string) => Promise.resolve({
          data: null,
          error: {
            code: '42P01',
            message: 'relation "students" does not exist',
            details: null,
            hint: null,
          },
        }),
      })),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockTableMissingClient;

    let errorThrown = false;
    let caughtError: any = null;
    try {
      await api.batchAddStudents(batch);
    } catch (err: any) {
      errorThrown = true;
      caughtError = err;
    }

    assert(errorThrown === true, 'TEST E: Error was thrown on 42P01');
    assert(caughtError?.code === '42P01', 'TEST E: Preserves code 42P01');

    const afterCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    assert(afterCache.length === beforeCache.length, 'TEST E: Local cache unchanged on 42P01');
    console.log('✓ PASS: TEST E: Missing table 42P01 throws and protects cache');
  }

  // TEST F: Comprehensive Local cache protection test
  {
    setupInitialState();
    const beforeCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    const failedBatch: Student[] = [
      {
        id: 's0000000-0000-0000-0000-000000000055',
        admission_number: 'ADM-FAIL-055',
        full_name: 'Failed Learner 1',
        gender: 'M',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
      },
      {
        id: 's0000000-0000-0000-0000-000000000056',
        admission_number: 'ADM-FAIL-056',
        full_name: 'Failed Learner 2',
        gender: 'F',
        class_id: validClassId,
        stream_id: validClassId,
        active: true,
      },
    ];

    const mockNetworkErrorClient = {
      from: (table: string) => createQueryMock(table, (_payloads) => ({
        select: (_cols?: string) => Promise.resolve({
          data: null,
          error: {
            code: 'PGRST000',
            message: 'Failed to fetch (network disconnect)',
            details: 'Fetch failed',
            hint: null,
          },
        }),
      })),
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = mockNetworkErrorClient;

    let caught = false;
    try {
      await api.batchAddStudents(failedBatch);
    } catch {
      caught = true;
    }

    assert(caught === true, 'TEST F: Network error throws');
    const afterCache = getStorage<Student[]>(KEYS.STUDENTS, []);
    assert(afterCache.length === beforeCache.length, 'TEST F: Zero failed students added to KEYS.STUDENTS');
    assert(!afterCache.some((s) => s.admission_number === 'ADM-FAIL-055'), 'TEST F: ADM-FAIL-055 absent');
    assert(!afterCache.some((s) => s.admission_number === 'ADM-FAIL-056'), 'TEST F: ADM-FAIL-056 absent');
    console.log('✓ PASS: TEST F: Local cache protection verified — no ghost learners in KEYS.STUDENTS');
  }

  // Cleanup test client
  delete (globalThis as any).__TEST_SUPABASE_CLIENT__;

  console.log('ALL 6/6 BATCHADDSTUDENTS TRUTHFUL PERSISTENCE TESTS PASSED.');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
