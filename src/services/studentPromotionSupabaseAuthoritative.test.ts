import { test, expect } from 'vitest';
import '../testSetup';
import { db, getStorage, setStorage, KEYS, syncFromSupabase, createSupabaseClient } from '../lib/storage';
import { Student, ClassStream, LearnerPromotionRecord } from '../types';
import { getLearnerClassAtExamTime } from './historicalContextResolver';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

export async function runSupabaseAuthoritativePromotionTests() {
  console.log('--- RUNNING SUPABASE AUTHORITATIVE PROMOTION SUITE ---\n');

  const g7ClassId = 'c0000000-0000-4000-8000-000000000007';
  const g7StreamEastId = 's0000000-0000-4000-8000-000000000071';
  const g8ClassId = 'c0000000-0000-4000-8000-000000000008';
  const g8StreamEastId = 's0000000-0000-4000-8000-000000000081';
  const g9ClassId = 'c0000000-0000-4000-8000-000000000009';
  const g9StreamEastId = 's0000000-0000-4000-8000-000000000091';

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
    {
      id: g9ClassId,
      class_name: 'Grade 9',
      stream: 'East',
      stream_id: g9StreamEastId,
      education_level: 'Junior School',
    },
  ];

  setStorage(KEYS.CLASSES, testClasses);

  const student1Id = 'e0000000-0000-4000-8000-000000000101';
  const student2Id = 'e0000000-0000-4000-8000-000000000102';

  const testStudents: Student[] = [
    {
      id: student1Id,
      admission_number: 'ADM-AUTH-001',
      full_name: 'Alice Wanjiku',
      gender: 'F',
      grade: 'Grade 7',
      education_level: 'Junior School',
      class_id: g7ClassId,
      stream_id: g7StreamEastId,
      active: true,
    },
    {
      id: student2Id,
      admission_number: 'ADM-AUTH-002',
      full_name: 'Brian Omondi',
      gender: 'M',
      grade: 'Grade 7',
      education_level: 'Junior School',
      class_id: g7ClassId,
      stream_id: g7StreamEastId,
      active: true,
    },
  ];

  setStorage(KEYS.STUDENTS, testStudents);

  // SCENARIO 1: Promote learner Alice from Grade 7 to Grade 8
  const promotedResult = await db.promoteStudents(
    [student1Id],
    'Grade 8',
    g8ClassId,
    'Administrator',
    2025,
    'Term 3',
    2026,
    'Term 1'
  );

  assert(promotedResult.length === 1, 'SCENARIO 1: Exactly 1 student returned from promoteStudents');
  const alicePromoted = promotedResult[0];
  assert(alicePromoted.id === student1Id, 'SCENARIO 1: Alice UUID preserved');
  assert(alicePromoted.admission_number === 'ADM-AUTH-001', 'SCENARIO 1: Alice admission number preserved');
  assert(alicePromoted.grade === 'Grade 8', 'SCENARIO 1: Alice grade updated to Grade 8');
  assert(alicePromoted.class_id === g8ClassId, 'SCENARIO 1: Alice class_id updated to Grade 8');
  assert(alicePromoted.stream_id === g8StreamEastId, 'SCENARIO 1: Alice stream_id updated to Grade 8 East');
  assert(Array.isArray(alicePromoted.promotion_history), 'SCENARIO 1: Promotion history array present');
  assert(alicePromoted.promotion_history!.length === 1, 'SCENARIO 1: Exactly 1 promotion record exists');

  const promo1 = alicePromoted.promotion_history![0];
  assert(promo1.student_id === student1Id, 'SCENARIO 1: Promo record student_id matches Alice UUID');
  assert(promo1.from_grade === 'Grade 7', 'SCENARIO 1: from_grade is Grade 7');
  assert(promo1.to_grade === 'Grade 8', 'SCENARIO 1: to_grade is Grade 8');
  assert(promo1.from_year === 2025, 'SCENARIO 1: from_year is 2025');
  assert(promo1.from_term === 'Term 3', 'SCENARIO 1: from_term is Term 3');
  assert(promo1.to_year === 2026, 'SCENARIO 1: to_year is 2026');
  assert(promo1.to_term === 'Term 1', 'SCENARIO 1: to_term is Term 1');

  // SCENARIO 2: Unpromoted peer Brian remains unaffected
  const allCurrent = getStorage<Student[]>(KEYS.STUDENTS, []);
  const brian = allCurrent.find((s) => s.id === student2Id);
  assert(!!brian, 'SCENARIO 2: Brian found in storage');
  assert(brian!.grade === 'Grade 7', 'SCENARIO 2: Brian remains in Grade 7');
  assert(!brian!.promotion_history || brian!.promotion_history.length === 0, 'SCENARIO 2: Brian has no phantom promotion history');

  // SCENARIO 3: Multi-promotion sequence (Grade 8 -> Grade 9)
  const promo2Result = await db.promoteStudents(
    [student1Id],
    'Grade 9',
    g9ClassId,
    'Administrator',
    2026,
    'Term 3',
    2027,
    'Term 1'
  );

  const aliceG9 = promo2Result[0];
  assert(aliceG9.grade === 'Grade 9', 'SCENARIO 3: Alice grade is Grade 9');
  assert(aliceG9.promotion_history!.length === 2, 'SCENARIO 3: Alice has 2 cumulative promotion records');
  assert(aliceG9.promotion_history![0].to_grade === 'Grade 8', 'SCENARIO 3: First record to Grade 8 preserved');
  assert(aliceG9.promotion_history![1].to_grade === 'Grade 9', 'SCENARIO 3: Second record to Grade 9 appended');

  // SCENARIO 4: Historical Context Resolver integration with Supabase promotion history
  // Test resolver with historical promotion chronology (2025-12-01 promo 1, 2026-12-01 promo 2)
  const studentWithHistoricalTimeline: Student = {
    ...aliceG9,
    promotion_history: [
      {
        ...aliceG9.promotion_history![0],
        date_promoted: '2025-12-01T08:00:00.000Z',
      },
      {
        ...aliceG9.promotion_history![1],
        date_promoted: '2026-12-01T08:00:00.000Z',
      },
    ],
  };

  const exam2025 = {
    id: 'ex_2025_t2',
    exam_name: 'Mid-Year Exam 2025',
    term: 'Term 2',
    year: 2025,
    start_date: '2025-06-15',
  } as any;

  const resolved2025 = getLearnerClassAtExamTime(studentWithHistoricalTimeline, exam2025, testClasses);
  assert(resolved2025.grade === 'Grade 7', 'SCENARIO 4: Exam in 2025 resolves to Grade 7 historically');
  assert(resolved2025.is_historical === true, 'SCENARIO 4: is_historical is true for 2025 exam');

  const exam2026 = {
    id: 'ex_2026_t2',
    exam_name: 'Mid-Year Exam 2026',
    term: 'Term 2',
    year: 2026,
    start_date: '2026-06-15',
  } as any;

  const resolved2026 = getLearnerClassAtExamTime(studentWithHistoricalTimeline, exam2026, testClasses);
  assert(resolved2026.grade === 'Grade 8', 'SCENARIO 4: Exam in 2026 resolves to Grade 8 historically');
  assert(resolved2026.is_historical === true, 'SCENARIO 4: is_historical is true for 2026 exam');

  const exam2027 = {
    id: 'ex_2027_t1',
    exam_name: 'Term 1 Exam 2027',
    term: 'Term 1',
    year: 2027,
    start_date: '2027-02-15',
  } as any;

  const resolved2027 = getLearnerClassAtExamTime(studentWithHistoricalTimeline, exam2027, testClasses);
  assert(resolved2027.grade === 'Grade 9', 'SCENARIO 4: Exam in 2027 resolves to current Grade 9');

  console.log('\n--- ALL SUPABASE AUTHORITATIVE PROMOTION TESTS PASSED SUCCESSFULLY ---\n');
}

test('Supabase Authoritative Promotion Suite', async () => {
  await runSupabaseAuthoritativePromotionTests();
});
