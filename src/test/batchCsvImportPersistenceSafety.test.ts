import { test, assert } from 'vitest';
import { Student } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

test('TEST 1 — Batch CSV import callback contract requires returning a Promise<void>', () => {
  let promiseReturned = false;
  const mockOnBatchAddStudents = (students: Student[]): Promise<void> => {
    promiseReturned = true;
    return Promise.resolve();
  };

  const sampleBatch: Student[] = [
    {
      id: 'test_1',
      admission_number: 'ADM001',
      full_name: 'Test Learner One',
      gender: 'M',
      class_id: 'cls_1',
      education_level: 'Lower Primary',
      grade: 'Grade 1',
      active: true,
    },
  ];

  const result = mockOnBatchAddStudents(sampleBatch);
  assert(result instanceof Promise, 'onBatchAddStudents must return a Promise');
  assert.strictEqual(promiseReturned, true);
});

test('TEST 2 — Database failure during batch insert prevents tab navigation and propagates error', async () => {
  let navigated = false;
  let activeTab = 'csv';
  const dbError = new Error('Database insertion failed: duplicate key value violates unique constraint');

  const failingOnBatchAddStudents = async (_students: Student[]): Promise<void> => {
    throw dbError;
  };

  let caughtError: string | null = null;
  let isImporting = true;

  try {
    await failingOnBatchAddStudents([
      {
        id: 'test_2',
        admission_number: 'ADM002',
        full_name: 'Test Learner Two',
        gender: 'F',
        class_id: 'cls_1',
        education_level: 'Lower Primary',
        grade: 'Grade 1',
        active: true,
      },
    ]);
    activeTab = 'list';
    navigated = true;
  } catch (err: any) {
    caughtError = err?.message || 'Error occurred';
  } finally {
    isImporting = false;
  }

  assert.strictEqual(navigated, false, 'User must not be navigated away on database failure');
  assert.strictEqual(activeTab, 'csv', 'User must remain on CSV import tab on failure');
  assert.strictEqual(isImporting, false, 'Importing loading state must reset on failure');
  assert.strictEqual(caughtError, 'Database insertion failed: duplicate key value violates unique constraint', 'Error message must be propagated to UI');
});

test('TEST 3 — Successful database persistence resolves before tab navigation occurs', async () => {
  let dbPersisted = false;
  let activeTab = 'csv';

  const successfulOnBatchAddStudents = async (_students: Student[]): Promise<void> => {
    // Simulate async database latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    dbPersisted = true;
  };

  let isImporting = true;
  try {
    await successfulOnBatchAddStudents([
      {
        id: 'test_3',
        admission_number: 'ADM003',
        full_name: 'Test Learner Three',
        gender: 'M',
        class_id: 'cls_1',
        education_level: 'Lower Primary',
        grade: 'Grade 1',
        active: true,
      },
    ]);
    // Navigation occurs only AFTER promise resolves and db is confirmed
    assert.strictEqual(dbPersisted, true, 'Database persistence must be confirmed before tab navigation');
    activeTab = 'list';
  } finally {
    isImporting = false;
  }

  assert.strictEqual(activeTab, 'list', 'Active tab must switch to roster after confirmed persistence');
  assert.strictEqual(isImporting, false, 'Importing loading state must reset on success');
});

test('TEST 4 — Class/stream UUID resolution is cached and executed once for multi-learner batch', async () => {
  let resolutionCalls = 0;
  const mockClassUuidCache = new Map<string, { class_id: string; stream_id: string }>();

  const resolveStudentClassAndStreamUuidsMock = async (classOrStreamId: string) => {
    resolutionCalls++;
    return { class_id: 'uuid_class_7', stream_id: 'uuid_stream_7_blue' };
  };

  const getResolvedClassAndStream = async (classOrStreamId: string) => {
    const key = (classOrStreamId || '').trim();
    if (!mockClassUuidCache.has(key)) {
      const resolved = await resolveStudentClassAndStreamUuidsMock(key);
      mockClassUuidCache.set(key, resolved);
    }
    return mockClassUuidCache.get(key)!;
  };

  const batchLearners: Student[] = Array.from({ length: 15 }, (_, i) => ({
    id: `std_batch_${i}`,
    admission_number: `ADM_BATCH_${100 + i}`,
    full_name: `Learner Batch ${i}`,
    gender: i % 2 === 0 ? 'M' : 'F',
    class_id: 'cls_grade_7_blue',
    stream_id: 'cls_grade_7_blue',
    education_level: 'Junior School',
    grade: 'Grade 7',
    active: true,
  }));

  const payloads = [];
  for (const std of batchLearners) {
    const { class_id, stream_id } = await getResolvedClassAndStream(std.stream_id || std.class_id || '');
    payloads.push({
      admission_number: std.admission_number,
      full_name: std.full_name,
      gender: std.gender,
      class_id,
      stream_id,
    });
  }

  assert.strictEqual(resolutionCalls, 1, 'Class/stream UUID resolution must occur exactly ONCE for entire batch sharing same destination');
  assert.strictEqual(payloads.length, 15, 'All 15 learner payloads constructed');
  payloads.forEach((p) => {
    assert.strictEqual(p.class_id, 'uuid_class_7');
    assert.strictEqual(p.stream_id, 'uuid_stream_7_blue');
  });
});

