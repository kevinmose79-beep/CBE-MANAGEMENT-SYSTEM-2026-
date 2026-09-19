import { test } from 'vitest';
import '../testSetup';
import {
  getLearnerClassAtExamTime,
  getStreamCohortStudentIds,
  LearnerExamContext,
} from './historicalContextResolver';
import { Student, Examination, ClassStream, LearnerPromotionRecord, GradeName } from '../types';

// Mock ClassStreams
const mockClasses: ClassStream[] = [
  { id: 'cls_6a', class_name: 'Grade 6', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_7w', class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_9a', class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
];

function runTests() {
  console.log('--- RUNNING HISTORICAL CONTEXT RESOLVER TESTS ---\n');
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

  // TEST 1: Unpromoted student returns current class
  const unpromotedStudent: Student = {
    id: 'std_01',
    admission_number: 'ADM-001',
    full_name: 'John Doe',
    gender: 'M',
    class_id: 'cls_7e',
    stream_id: 'cls_7e',
    grade: 'Grade 7',
    active: true,
  };

  const exam2024: Examination = {
    id: 'ex_2024_1',
    exam_name: 'Term 1 Exam 2024',
    term: 'Term 1',
    year: 2024,
    start_date: '2024-03-15T08:00:00Z',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const res1 = getLearnerClassAtExamTime(unpromotedStudent, exam2024, mockClasses);
  assert(res1.class_id === 'cls_7e', 'Unpromoted student resolves to current class_id');
  assert(res1.grade === 'Grade 7', 'Unpromoted student resolves to current grade');
  assert(res1.stream_name === 'East', 'Unpromoted student resolves to current stream name');
  assert(res1.is_historical === false, 'Unpromoted student is_historical is false');
  assert(res1.historical_context_resolved === true, 'Unpromoted student historical_context_resolved is true');
  assert(res1.resolution_source === 'live_current', 'Resolution source is live_current');

  // TEST 2: Student promoted once (Grade 7 -> Grade 8 in Jan 2025)
  const singlePromotedStudent: Student = {
    id: 'std_02',
    admission_number: 'ADM-002',
    full_name: 'Jane Smith',
    gender: 'F',
    class_id: 'cls_8e', // Current post-promotion class
    stream_id: 'cls_8e',
    grade: 'Grade 8',
    active: true,
    promotion_history: [
      {
        id: 'promo_1',
        student_id: 'std_02',
        from_grade: 'Grade 7',
        to_grade: 'Grade 8',
        from_class_id: 'cls_7e',
        to_class_id: 'cls_8e',
        date_promoted: '2025-01-05T00:00:00Z',
      },
    ],
  };

  // Exam taken in 2024 (BEFORE promotion)
  const examPrePromo: Examination = {
    id: 'ex_2024_end',
    exam_name: 'End Term 3 2024',
    term: 'Term 3',
    year: 2024,
    start_date: '2024-11-20T08:00:00Z',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const resPre = getLearnerClassAtExamTime(singlePromotedStudent, examPrePromo, mockClasses);
  assert(resPre.class_id === 'cls_7e', 'Pre-promotion exam resolves to historical class_id (cls_7e)');
  assert(resPre.grade === 'Grade 7', 'Pre-promotion exam resolves to historical grade (Grade 7)');
  assert(resPre.stream_name === 'East', 'Pre-promotion exam resolves to historical stream (East)');
  assert(resPre.is_historical === true, 'Pre-promotion exam is_historical is true');
  assert(resPre.historical_context_resolved === true, 'Pre-promotion exam historical_context_resolved is true');
  assert(resPre.resolution_source === 'promotion_history_date', 'Resolution source is promotion_history_date');

  // Exam taken in 2025 (AFTER promotion)
  const examPostPromo: Examination = {
    id: 'ex_2025_t1',
    exam_name: 'Term 1 Exam 2025',
    term: 'Term 1',
    year: 2025,
    start_date: '2025-03-10T08:00:00Z',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const resPost = getLearnerClassAtExamTime(singlePromotedStudent, examPostPromo, mockClasses);
  assert(resPost.class_id === 'cls_8e', 'Post-promotion exam resolves to post-promo class_id (cls_8e)');
  assert(resPost.grade === 'Grade 8', 'Post-promotion exam resolves to post-promo grade (Grade 8)');

  // TEST 3: Student promoted twice (Grade 6 -> Grade 7 in Jan 2024, Grade 7 -> Grade 8 in Jan 2025)
  const multiPromotedStudent: Student = {
    id: 'std_03',
    admission_number: 'ADM-003',
    full_name: 'Alice Johnson',
    gender: 'F',
    class_id: 'cls_8e',
    grade: 'Grade 8',
    active: true,
    promotion_history: [
      {
        id: 'promo_1',
        student_id: 'std_03',
        from_grade: 'Grade 6',
        to_grade: 'Grade 7',
        from_class_id: 'cls_6a',
        to_class_id: 'cls_7e',
        date_promoted: '2024-01-05T00:00:00Z',
      },
      {
        id: 'promo_2',
        student_id: 'std_03',
        from_grade: 'Grade 7',
        to_grade: 'Grade 8',
        from_class_id: 'cls_7e',
        to_class_id: 'cls_8e',
        date_promoted: '2025-01-05T00:00:00Z',
      },
    ],
  };

  // Exam 2023 (Before first promo)
  const exam2023: Examination = {
    id: 'ex_2023',
    exam_name: 'End Term 2023',
    term: 'Term 3',
    year: 2023,
    start_date: '2023-11-15T00:00:00Z',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };
  const res2023 = getLearnerClassAtExamTime(multiPromotedStudent, exam2023, mockClasses);
  assert(res2023.class_id === 'cls_6a', 'Multi-promoted 2023 exam resolves to Grade 6 (cls_6a)');
  assert(res2023.grade === 'Grade 6', 'Multi-promoted 2023 exam resolves to Grade 6');
  assert(res2023.stream_name === 'Alpha', 'Multi-promoted 2023 exam resolves to stream Alpha');

  // Exam 2024 (Between first & second promo)
  const exam2024Mid: Examination = {
    id: 'ex_2024_mid',
    exam_name: 'Mid Term 2024',
    term: 'Term 2',
    year: 2024,
    start_date: '2024-06-10T00:00:00Z',
    status: 'Approved',
    exam_type: 'Mid-Term',
    max_marks: 100,
  };
  const res2024Mid = getLearnerClassAtExamTime(multiPromotedStudent, exam2024Mid, mockClasses);
  assert(res2024Mid.class_id === 'cls_7e', 'Multi-promoted 2024 exam resolves to Grade 7 (cls_7e)');
  assert(res2024Mid.grade === 'Grade 7', 'Multi-promoted 2024 exam resolves to Grade 7');

  // TEST 4: Year fallback when start_date is missing
  const examNoDate: Examination = {
    id: 'ex_nodate',
    exam_name: 'Exam 2023 No Date',
    term: 'Term 1',
    year: 2023,
    status: 'Approved',
    exam_type: 'CAT',
    max_marks: 100,
  };
  const resNoDate = getLearnerClassAtExamTime(multiPromotedStudent, examNoDate, mockClasses);
  assert(resNoDate.class_id === 'cls_6a', 'Exam without start_date uses year fallback to Grade 6');

  // TEST 5 (ISSUE 1): Date precedence over academic_year_id match
  const studentMidYearPromo: Student = {
    id: 'std_04',
    admission_number: 'ADM-004',
    full_name: 'Bob Miller',
    gender: 'M',
    class_id: 'cls_8e',
    grade: 'Grade 8',
    active: true,
    promotion_history: [
      {
        id: 'promo_mid',
        student_id: 'std_04',
        from_grade: 'Grade 7',
        to_grade: 'Grade 8',
        from_class_id: 'cls_7e',
        to_class_id: 'cls_8e',
        academic_year_id: 'ay_2025',
        date_promoted: '2025-06-01T00:00:00Z', // Promoted mid-year 2025
      },
    ],
  };

  const examEarly2025: Examination = {
    id: 'ex_early_2025',
    exam_name: 'Term 1 Exam 2025',
    term: 'Term 1',
    year: 2025,
    academic_year_id: 'ay_2025', // Shares academic_year_id with promo_mid!
    start_date: '2025-03-01T00:00:00Z', // BEFORE promotion date (June 2025)
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const resEarly2025 = getLearnerClassAtExamTime(studentMidYearPromo, examEarly2025, mockClasses);
  assert(resEarly2025.class_id === 'cls_7e', 'Exam before mid-year promotion date resolves to Grade 7 despite sharing academic_year_id');
  assert(resEarly2025.resolution_source === 'promotion_history_date', 'Resolution source is promotion_history_date');

  const examLate2025: Examination = {
    id: 'ex_late_2025',
    exam_name: 'Term 3 Exam 2025',
    term: 'Term 3',
    year: 2025,
    academic_year_id: 'ay_2025',
    start_date: '2025-10-01T00:00:00Z', // AFTER promotion date (June 2025)
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const resLate2025 = getLearnerClassAtExamTime(studentMidYearPromo, examLate2025, mockClasses);
  assert(resLate2025.class_id === 'cls_8e', 'Exam after mid-year promotion date resolves to Grade 8');

  // TEST 6 (ISSUE 2): Legacy from_grade without from_class_id and multiple streams (NO stream guessing)
  const studentLegacyPromoMultiStream: Student = {
    id: 'std_05',
    admission_number: 'ADM-005',
    full_name: 'Charlie Brown',
    gender: 'M',
    class_id: 'cls_8e',
    grade: 'Grade 8',
    active: true,
    promotion_history: [
      {
        id: 'promo_legacy',
        student_id: 'std_05',
        from_grade: 'Grade 7', // Multiple streams (cls_7e, cls_7w) exist for Grade 7 in mockClasses!
        to_grade: 'Grade 8',
        // from_class_id is missing!
        date_promoted: '2025-01-05T00:00:00Z',
      },
    ],
  };

  const examLegacy: Examination = {
    id: 'ex_legacy_2024',
    exam_name: 'Term 3 2024 Exam',
    term: 'Term 3',
    year: 2024,
    start_date: '2024-11-10T00:00:00Z',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const resLegacy = getLearnerClassAtExamTime(studentLegacyPromoMultiStream, examLegacy, mockClasses);
  assert(resLegacy.grade === 'Grade 7', 'Legacy exam resolves grade to Grade 7');
  assert(resLegacy.stream_name === '', 'Legacy exam with multiple streams does NOT guess a stream name (stream_name is empty)');
  assert(resLegacy.stream_id === '', 'Legacy exam with multiple streams does NOT guess stream_id (stream_id is empty)');
  assert(resLegacy.historical_context_resolved === false, 'Stream resolution flagged as unresolved when ambiguous');

  // TEST 7 (ISSUE 3): Prevent silent live-current leakage for invalid historical promo record
  const studentCorruptHistory: Student = {
    id: 'std_06',
    admission_number: 'ADM-006',
    full_name: 'David Lee',
    gender: 'M',
    class_id: 'cls_9a', // Live post-promotion class is Grade 9
    grade: 'Grade 9',
    active: true,
    promotion_history: [
      {
        id: 'promo_corrupt',
        student_id: 'std_06',
        from_grade: 'Invalid Grade' as GradeName, // Invalid grade & invalid class_id
        to_grade: 'Grade 9',
        from_class_id: 'invalid_cls_id',
        date_promoted: '2025-01-05T00:00:00Z',
      },
    ],
  };

  const examCorruptPromo: Examination = {
    id: 'ex_corrupt',
    exam_name: 'Old Exam',
    term: 'Term 1',
    year: 2024,
    start_date: '2024-03-01T00:00:00Z',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const resCorrupt = getLearnerClassAtExamTime(studentCorruptHistory, examCorruptPromo, mockClasses);
  assert(resCorrupt.class_id !== 'cls_9a', 'Historical exam with invalid promo does NOT silently leak current class_id (cls_9a)');
  assert(resCorrupt.is_historical === true, 'Flagged as historical');
  assert(resCorrupt.historical_context_resolved === false, 'Flagged as unresolved historical context');
  assert(resCorrupt.resolution_source === 'promotion_history_date', 'Resolution source remains promotion_history_date');

  // TEST 8: Stream cohort separation — Quinn Taylor (Grade 9 Blue) vs Alpha learner (Grade 9 Alpha)
  const quinnTaylor: Student = {
    id: 'std_quinn',
    admission_number: '300',
    full_name: 'Quinn Taylor',
    gender: 'F',
    class_id: 'cls_grade9_parent',
    stream_id: 'cls_9b',
    grade: 'Grade 9',
    active: true,
  };

  const alphaLearner: Student = {
    id: 'std_alpha',
    admission_number: '301',
    full_name: 'Alpha Learner',
    gender: 'M',
    class_id: 'cls_grade9_parent',
    stream_id: 'cls_9a',
    grade: 'Grade 9',
    active: true,
  };

  const grade8EastLearner: Student = {
    id: 'std_g8_1',
    admission_number: '201',
    full_name: 'Grade 8 East One',
    gender: 'M',
    class_id: 'cls_8e',
    stream_id: 'cls_8e',
    grade: 'Grade 8',
    active: true,
  };

  const grade8EastLearnerTwo: Student = {
    id: 'std_g8_2',
    admission_number: '202',
    full_name: 'Grade 8 East Two',
    gender: 'F',
    class_id: 'cls_8e',
    stream_id: 'cls_8e',
    grade: 'Grade 8',
    active: true,
  };

  const testClasses: ClassStream[] = [
    ...mockClasses,
    { id: 'cls_9b', class_name: 'Grade 9', stream: 'Blue', stream_id: 'cls_9b', education_level: 'Junior School' },
    { id: 'cls_9a', class_name: 'Grade 9', stream: 'Alpha', stream_id: 'cls_9a', education_level: 'Junior School' },
  ];

  const allTestStudents = [quinnTaylor, alphaLearner, grade8EastLearner, grade8EastLearnerTwo];

  const quinnCohort = getStreamCohortStudentIds(quinnTaylor, allTestStudents, undefined, testClasses);
  assert(quinnCohort.size === 1, 'Quinn stream cohort contains exactly 1 learner');
  assert(quinnCohort.has('std_quinn'), 'Quinn stream cohort contains Quinn');
  assert(!quinnCohort.has('std_alpha'), 'Quinn stream cohort does NOT contain sibling stream Alpha learner');

  const alphaCohort = getStreamCohortStudentIds(alphaLearner, allTestStudents, undefined, testClasses);
  assert(alphaCohort.size === 1, 'Alpha stream cohort contains exactly 1 learner');
  assert(alphaCohort.has('std_alpha'), 'Alpha stream cohort contains Alpha learner');
  assert(!alphaCohort.has('std_quinn'), 'Alpha stream cohort does NOT contain sibling stream Blue learner (Quinn)');

  const g8EastCohort = getStreamCohortStudentIds(grade8EastLearner, allTestStudents, undefined, testClasses);
  assert(g8EastCohort.size === 2, 'Grade 8 East stream cohort contains both East learners (size 2)');
  assert(g8EastCohort.has('std_g8_1') && g8EastCohort.has('std_g8_2'), 'Grade 8 East cohort contains both g8_1 and g8_2');
  assert(!g8EastCohort.has('std_quinn') && !g8EastCohort.has('std_alpha'), 'Grade 8 East cohort does not contain Grade 9 learners');

  console.log(`\nTEST RESULTS: ${passed}/${total} passed.`);
  if (passed !== total) {
    throw new Error(`Test suite failed: ${total - passed} assertion(s) failed.`);
  }
}

test('Historical Context Resolver', () => {
  runTests();
});

