import { test } from 'vitest';
import '../testSetup';
import { db } from '../lib/storage';
import { Student } from '../types';

export async function runStudentPromotionYearTermTests() {
  console.log('--- RUNNING STUDENT PROMOTION YEAR & TERM TESTS ---\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // Helper setup: Create sample students in storage
  const sampleStudent: Student = {
    id: 'e0000000-0000-4000-8000-000000000001',
    admission_number: 'ADM-PROMO-9001',
    full_name: 'Cynthia Mwangi',
    gender: 'F',
    class_id: 'cls_8a',
    stream_id: 'cls_8a',
    active: true,
    grade: 'Grade 8',
    education_level: 'Junior School',
    promotion_history: [],
  };

  const sampleStudent2: Student = {
    id: 'e0000000-0000-4000-8000-000000000002',
    admission_number: 'ADM-PROMO-9002',
    full_name: 'David Otieno',
    gender: 'M',
    class_id: 'cls_8a',
    stream_id: 'cls_8a',
    active: true,
    grade: 'Grade 8',
    education_level: 'Junior School',
    promotion_history: [],
  };

  try {
    // Add test students to storage
    await db.batchAddStudents([sampleStudent, sampleStudent2]);

    // TEST 1 — Promotion to a new year (Grade 8 -> Grade 9, 2026 Term 3 -> 2027 Term 1)
    {
      const promoted = await db.promoteStudents(
        ['e0000000-0000-4000-8000-000000000001'],
        'Grade 9',
        'cls_9a',
        'Admin',
        2026,
        'Term 3',
        2027,
        'Term 1'
      );

      assert(promoted.length === 1, 'TEST 1: Returned one promoted student');
      const std = promoted[0];
      assert(std.id === 'e0000000-0000-4000-8000-000000000001', 'TEST 1: Learner ID preserved');
      assert(std.grade === 'Grade 9', 'TEST 1: Grade updated to Grade 9');

      const lastRec = std.promotion_history?.[std.promotion_history.length - 1];
      assert(lastRec !== undefined, 'TEST 1: Promotion record created');
      assert(lastRec?.from_grade === 'Grade 8', 'TEST 1: from_grade is Grade 8');
      assert(lastRec?.to_grade === 'Grade 9', 'TEST 1: to_grade is Grade 9');
      assert(lastRec?.from_year === 2026, 'TEST 1: from_year is 2026');
      assert(lastRec?.from_term === 'Term 3', 'TEST 1: from_term is Term 3');
      assert(lastRec?.to_year === 2027, 'TEST 1: to_year is 2027');
      assert(lastRec?.to_term === 'Term 1', 'TEST 1: to_term is Term 1');
    }

    // TEST 2 — Promotion to another term (e.g., Destination Term 2)
    {
      const promoted = await db.promoteStudents(
        ['e0000000-0000-4000-8000-000000000001'],
        'Grade 9',
        'cls_9a',
        'Admin',
        2027,
        'Term 1',
        2027,
        'Term 2'
      );
      const lastRec = promoted[0].promotion_history?.[promoted[0].promotion_history.length - 1];
      assert(lastRec?.to_term === 'Term 2', 'TEST 2: Destination term correctly set to Term 2');
      assert(lastRec?.to_year === 2027, 'TEST 2: Destination year set to 2027');
    }

    // TEST 3 — Historical promotion preservation across sequential promotions
    {
      const std = db.getStudents().find((s) => s.id === 'e0000000-0000-4000-8000-000000000001');
      assert((std?.promotion_history?.length || 0) === 2, 'TEST 3: Student has two promotion records');

      const rec1 = std?.promotion_history?.[0];
      assert(rec1?.from_year === 2026 && rec1?.from_term === 'Term 3', 'TEST 3: Event 1 from_year/from_term preserved');
      assert(rec1?.to_year === 2027 && rec1?.to_term === 'Term 1', 'TEST 3: Event 1 to_year/to_term preserved');
      assert(rec1?.from_grade === 'Grade 8' && rec1?.to_grade === 'Grade 9', 'TEST 3: Event 1 grades preserved');
    }

    // TEST 4 — Existing learner identity
    {
      const std = db.getStudents().find((s) => s.id === 'e0000000-0000-4000-8000-000000000001');
      assert(std?.id === 'e0000000-0000-4000-8000-000000000001', 'TEST 4: Student ID is unchanged');
      assert(std?.admission_number === 'ADM-PROMO-9001', 'TEST 4: Admission number is unchanged');
      assert(std?.full_name === 'Cynthia Mwangi', 'TEST 4: Full name is unchanged');
    }

    // TEST 5 — Existing promotion behaviour (omitting optional year/term uses sensible defaults)
    {
      const promoted = await db.promoteStudents(['e0000000-0000-4000-8000-000000000002'], 'Grade 9', 'cls_9a', 'Admin');
      const lastRec = promoted[0].promotion_history?.[0];
      assert(lastRec !== undefined, 'TEST 5: Standard promotion call creates promo record');
      assert(lastRec?.from_grade === 'Grade 8', 'TEST 5: from_grade correct');
      assert(lastRec?.to_grade === 'Grade 9', 'TEST 5: to_grade correct');
      assert(typeof lastRec?.from_year === 'number', 'TEST 5: from_year populated automatically');
      assert(typeof lastRec?.to_year === 'number', 'TEST 5: to_year populated automatically');
    }

    // TEST 6 — Multiple learners batch promotion
    {
      const batchPromoted = await db.promoteStudents(
        ['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002'],
        'Grade 9',
        'cls_9a',
        'Admin',
        2027,
        'Term 2',
        2028,
        'Term 1'
      );

      assert(batchPromoted.length === 2, 'TEST 6: Batch promotion promoted 2 learners');
      const std1Rec = batchPromoted.find((s) => s.id === 'e0000000-0000-4000-8000-000000000001')?.promotion_history?.slice(-1)[0];
      const std2Rec = batchPromoted.find((s) => s.id === 'e0000000-0000-4000-8000-000000000002')?.promotion_history?.slice(-1)[0];

      assert(std1Rec?.to_year === 2028 && std1Rec?.to_term === 'Term 1', 'TEST 6: Learner 1 received correct year/term');
      assert(std2Rec?.to_year === 2028 && std2Rec?.to_term === 'Term 1', 'TEST 6: Learner 2 received correct year/term');
    }
  } finally {
    try {
      await db.deleteStudent('e0000000-0000-4000-8000-000000000001');
      await db.deleteStudent('e0000000-0000-4000-8000-000000000002');
    } catch {
      // Ignore cleanup error
    }
  }

  console.log(`\nResult: ${passed}/${total} tests passed.\n`);
}

// Run if executed directly
test('Student Promotion Year and Term', async () => {
  await runStudentPromotionYearTermTests();
});
