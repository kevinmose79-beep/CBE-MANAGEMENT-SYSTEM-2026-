import { test } from 'vitest';
import '../testSetup';
import { db, getStorage, setStorage, KEYS } from '../lib/storage';
import { Student, ClassStream } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

export async function runPromotionPersistenceTruthTests() {
  console.log('--- RUNNING PROMOTION PERSISTENCE TRUTH TESTS ---\n');

  const g7ClassId = 'c0000000-0000-4000-8000-000000000007';
  const g7StreamEastId = 's0000000-0000-4000-8000-000000000071';
  const g8ClassId = 'c0000000-0000-4000-8000-000000000008';
  const g8StreamEastId = 's0000000-0000-4000-8000-000000000081';

  const testClasses: ClassStream[] = [
    {
      id: g7ClassId,
      class_name: 'Grade 7',
      stream: 'East',
      stream_id: g7StreamEastId,
      education_level: 'Junior School',
    },
    {
      id: g8ClassId,
      class_name: 'Grade 8',
      stream: 'East',
      stream_id: g8StreamEastId,
      education_level: 'Junior School',
    },
  ];

  const student1Id = 'e0000000-0000-4000-8000-000000000101';
  const student2Id = 'e0000000-0000-4000-8000-000000000102';

  const initialStudents: Student[] = [
    {
      id: student1Id,
      admission_number: 'ADM-PRM-101',
      full_name: 'Faith Chebet',
      gender: 'F',
      class_id: g7ClassId,
      stream_id: g7StreamEastId,
      active: true,
      grade: 'Grade 7',
      education_level: 'Junior School',
      promotion_history: [],
    },
    {
      id: student2Id,
      admission_number: 'ADM-PRM-102',
      full_name: 'Emmanuel Ochieng',
      gender: 'M',
      class_id: g7ClassId,
      stream_id: g7StreamEastId,
      active: true,
      grade: 'Grade 7',
      education_level: 'Junior School',
      promotion_history: [],
    },
  ];

  setStorage(KEYS.CLASSES, testClasses);
  setStorage(KEYS.STUDENTS, initialStudents);

  // TEST 1 — Promotion correctly executes and updates local cache when database succeeds
  {
    const promoted = await db.promoteStudents(
      [student1Id],
      'Grade 8',
      g8StreamEastId,
      'Headteacher',
      2025,
      'Term 3',
      2026,
      'Term 1'
    );

    assert(promoted.length === 1, 'TEST 1: 1 student promoted');
    const pStd = promoted[0];
    assert(pStd.id === student1Id, 'TEST 1: Student UUID is strictly preserved');
    assert(pStd.admission_number === 'ADM-PRM-101', 'TEST 1: Admission number strictly preserved');
    assert(pStd.grade === 'Grade 8', 'TEST 1: Grade updated to Grade 8');
    assert(pStd.class_id === g8ClassId, 'TEST 1: class_id updated to Grade 8 UUID');
    assert(pStd.stream_id === g8StreamEastId, 'TEST 1: stream_id updated to Grade 8 East UUID');
    assert((pStd.promotion_history?.length || 0) === 1, 'TEST 1: Promotion history entry recorded');
    assert(pStd.promotion_history![0].from_grade === 'Grade 7', 'TEST 1: from_grade is Grade 7');
    assert(pStd.promotion_history![0].to_grade === 'Grade 8', 'TEST 1: to_grade is Grade 8');
    assert(pStd.promotion_history![0].from_year === 2025, 'TEST 1: from_year is 2025');
    assert(pStd.promotion_history![0].to_year === 2026, 'TEST 1: to_year is 2026');

    // Confirm local cache matches
    const cacheStudents = getStorage<Student[]>(KEYS.STUDENTS, []);
    const cached1 = cacheStudents.find((s) => s.id === student1Id);
    assert(cached1?.grade === 'Grade 8', 'TEST 1: Local cache reflects Grade 8');
    assert(cached1?.class_id === g8ClassId, 'TEST 1: Local cache reflects Grade 8 class_id');
  }

  // TEST 2 — Preserving student identity and unpromoted peers
  {
    const cacheStudents = getStorage<Student[]>(KEYS.STUDENTS, []);
    const cached2 = cacheStudents.find((s) => s.id === student2Id);
    assert(cached2?.id === student2Id, 'TEST 2: Unpromoted peer ID unchanged');
    assert(cached2?.grade === 'Grade 7', 'TEST 2: Unpromoted peer remains in Grade 7');
    assert(cached2?.class_id === g7ClassId, 'TEST 2: Unpromoted peer remains in Grade 7 class_id');
  }

  // TEST 3 — Batch promotion of multiple learners
  {
    const batchPromoted = await db.promoteStudents(
      [student1Id, student2Id],
      'Grade 8',
      undefined, // Keep existing stream name ("East")
      'Headteacher',
      2026,
      'Term 3',
      2027,
      'Term 1'
    );

    assert(batchPromoted.length === 2, 'TEST 3: Batch promoted 2 learners');
    const s1 = batchPromoted.find((s) => s.id === student1Id);
    const s2 = batchPromoted.find((s) => s.id === student2Id);
    assert(s1?.grade === 'Grade 8', 'TEST 3: Learner 1 in Grade 8');
    assert(s2?.grade === 'Grade 8', 'TEST 3: Learner 2 in Grade 8');
    assert((s1?.promotion_history?.length || 0) === 2, 'TEST 3: Learner 1 has two cumulative promotion records');
    assert((s2?.promotion_history?.length || 0) === 1, 'TEST 3: Learner 2 has one promotion record');
  }

  console.log('✓ All Promotion Persistence Truth tests passed successfully.\n');
}

test('Promotion Persistence Truth Suite', async () => {
  await runPromotionPersistenceTruthTests();
});

