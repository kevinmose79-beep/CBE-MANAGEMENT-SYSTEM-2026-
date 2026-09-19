import { test, assert } from 'vitest';
import { resolveStudentClassAndStreamUuids } from '../lib/storage';
import { Student, ClassStream } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

test('AUDIT 1 — Stream UUID resolution: Passing a Stream UUID directly resolves parent class_id and stream_id', async () => {
  const mockClassId = '11111111-1111-1111-1111-111111111111';
  const mockStreamBlueId = '22222222-2222-2222-2222-222222222222';
  const mockStreamRedId = '33333333-3333-3333-3333-333333333333';

  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          maybeSingle: async () => {
            if (table === 'streams' && col === 'id') {
              if (val === mockStreamBlueId) {
                return { data: { id: mockStreamBlueId, class_id: mockClassId } };
              }
              if (val === mockStreamRedId) {
                return { data: { id: mockStreamRedId, class_id: mockClassId } };
              }
            }
            if (table === 'classes' && col === 'id') {
              if (val === mockClassId) {
                return { data: { id: mockClassId } };
              }
            }
            return { data: null };
          },
        }),
      }),
    }),
  };

  // Test resolving with Blue stream UUID
  const blueResult = await resolveStudentClassAndStreamUuids(mockStreamBlueId, mockClient);
  assert.strictEqual(blueResult.class_id, mockClassId, 'class_id must match parent class UUID');
  assert.strictEqual(blueResult.stream_id, mockStreamBlueId, 'stream_id must match Blue stream UUID');

  // Test resolving with Red stream UUID
  const redResult = await resolveStudentClassAndStreamUuids(mockStreamRedId, mockClient);
  assert.strictEqual(redResult.class_id, mockClassId, 'class_id must match parent class UUID');
  assert.strictEqual(redResult.stream_id, mockStreamRedId, 'stream_id must match Red stream UUID');
});

test('AUDIT 2 — Class UUID with Stream hint: Passing Class UUID and stream hint "Blue" routes to Blue stream, not Red', async () => {
  const mockClassId = '11111111-1111-1111-1111-111111111111';
  const mockStreamBlueId = '22222222-2222-2222-2222-222222222222';
  const mockStreamRedId = '33333333-3333-3333-3333-333333333333';

  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => {
          if (table === 'streams' && col === 'id') {
            return {
              maybeSingle: async () => ({ data: null }),
            };
          }
          if (table === 'classes' && col === 'id') {
            return {
              maybeSingle: async () => (val === mockClassId ? { data: { id: mockClassId } } : { data: null }),
            };
          }
          if (table === 'streams' && col === 'class_id') {
            return {
              ilike: (nameCol: string, nameVal: string) => ({
                maybeSingle: async () => {
                  if (nameVal.toLowerCase() === 'blue') {
                    return { data: { id: mockStreamBlueId } };
                  }
                  if (nameVal.toLowerCase() === 'red') {
                    return { data: { id: mockStreamRedId } };
                  }
                  return { data: null };
                },
              }),
              limit: (n: number) => ({
                data: [{ id: mockStreamRedId }], // Default stream in db
              }),
            };
          }
          return { maybeSingle: async () => ({ data: null }) };
        },
      }),
    }),
  };

  // Resolving with Class UUID and "Blue" stream hint
  const blueResolved = await resolveStudentClassAndStreamUuids(mockClassId, mockClient, 'Blue');
  assert.strictEqual(blueResolved.class_id, mockClassId, 'Parent class UUID resolved');
  assert.strictEqual(blueResolved.stream_id, mockStreamBlueId, 'Must resolve to Blue stream UUID (not default Red)');

  // Resolving with Class UUID and "Red" stream hint
  const redResolved = await resolveStudentClassAndStreamUuids(mockClassId, mockClient, 'Red');
  assert.strictEqual(redResolved.class_id, mockClassId, 'Parent class UUID resolved');
  assert.strictEqual(redResolved.stream_id, mockStreamRedId, 'Must resolve to Red stream UUID');
});

test('AUDIT 3 — Batch learner stream separation: Batch array preserves individual learner stream assignments', () => {
  const sampleClasses: ClassStream[] = [
    {
      id: 'class-uuid-grade-7',
      stream_id: 'stream-uuid-grade-7-blue',
      class_name: 'Grade 7',
      stream: 'Blue',
      education_level: 'Junior School',
    },
    {
      id: 'class-uuid-grade-7',
      stream_id: 'stream-uuid-grade-7-red',
      class_name: 'Grade 7',
      stream: 'Red',
      education_level: 'Junior School',
    },
  ];

  const csvRows = [
    { 'Admission Number': '276', 'First Name': 'Kelvin', 'Last Name': 'Kipkurui', Gender: 'M', Stream: 'Blue' },
    { 'Admission Number': '278', 'First Name': 'Daisy', 'Last Name': 'Muthoni', Gender: 'F', Stream: 'Red' },
    { 'Admission Number': '279', 'First Name': 'Sammy', 'Last Name': 'Kinuthia', Gender: 'M' }, // uses dropdown default
  ];

  const importClassName = 'Grade 7';
  const importStream = 'Blue';

  const targetClassStream = sampleClasses.find((c) => c.class_name === importClassName && c.stream === importStream)!;
  assert(targetClassStream, 'Target default class stream must exist');

  const processedLearners: Student[] = [];

  csvRows.forEach((row, idx) => {
    const rowClassRaw = (row as any)['Class'] || '';
    const rowStreamRaw = (row as any)['Stream'] || '';
    const targetGradeName = rowClassRaw || importClassName;
    let resolvedClassStream = targetClassStream;

    if (rowClassRaw || rowStreamRaw) {
      const foundExact = sampleClasses.find(
        (c) =>
          c.class_name.toLowerCase() === targetGradeName.toLowerCase() &&
          (rowStreamRaw
            ? c.stream && c.stream.trim().toLowerCase() === rowStreamRaw.toLowerCase()
            : c.stream === importStream || (!importStream && !c.stream))
      );
      if (foundExact) {
        resolvedClassStream = foundExact;
      }
    }

    processedLearners.push({
      id: `std_${idx}`,
      admission_number: row['Admission Number'],
      full_name: `${row['First Name']} ${row['Last Name']}`,
      gender: row.Gender as 'M' | 'F',
      class_id: resolvedClassStream.id,
      stream_id: resolvedClassStream.stream_id || resolvedClassStream.id,
      grade: resolvedClassStream.class_name as any,
      education_level: resolvedClassStream.education_level,
      active: true,
    });
  });

  // Learner 1 (Kelvin): Explicit Blue stream
  assert.strictEqual(processedLearners[0].admission_number, '276');
  assert.strictEqual(processedLearners[0].class_id, 'class-uuid-grade-7');
  assert.strictEqual(processedLearners[0].stream_id, 'stream-uuid-grade-7-blue');

  // Learner 2 (Daisy): Explicit Red stream
  assert.strictEqual(processedLearners[1].admission_number, '278');
  assert.strictEqual(processedLearners[1].class_id, 'class-uuid-grade-7');
  assert.strictEqual(processedLearners[1].stream_id, 'stream-uuid-grade-7-red');

  // Learner 3 (Sammy): Dropdown default Blue stream
  assert.strictEqual(processedLearners[2].admission_number, '279');
  assert.strictEqual(processedLearners[2].class_id, 'class-uuid-grade-7');
  assert.strictEqual(processedLearners[2].stream_id, 'stream-uuid-grade-7-blue');
});
