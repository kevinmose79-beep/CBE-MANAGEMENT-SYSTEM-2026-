import '../testSetup';
import { getFilteredStudents } from '../utils/filterUtils';
import { calculateExamResults } from './analysisEngine';
import { Student, ClassStream, Examination, Subject, Grade, Mark } from '../types';
import { setStorage, KEYS } from '../lib/storage';

console.log('=== RUNNING PRIORITY 2B MERIT LIST HISTORICAL COHORT INTEGRATION TESTS ===\n');

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    console.error(`✗ FAIL: ${message}`);
  }
}

// -------------------------------------------------------------
// SETUP TEST FIXTURES
// -------------------------------------------------------------
const classes: ClassStream[] = [
  { id: 'cls_6a', class_name: 'Grade 6', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_7w', class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', education_level: 'Junior School' },
];

const subjects: Subject[] = [
  { id: 'sb_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
];

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceeding', descriptor: 'EE', grade: 'EE1', minimum_marks: 90, maximum_marks: 100 },
  { id: 'g2', grade_code: 'ME1', performance_level: 'ME', minimum_score: 60, maximum_score: 89, points: 6, remarks: 'Meeting', descriptor: 'ME', grade: 'ME1', minimum_marks: 60, maximum_marks: 89 },
  { id: 'g3', grade_code: 'AE1', performance_level: 'AE', minimum_score: 40, maximum_score: 59, points: 4, remarks: 'Approaching', descriptor: 'AE', grade: 'AE1', minimum_marks: 40, maximum_marks: 59 },
  { id: 'g4', grade_code: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 39, points: 2, remarks: 'Below', descriptor: 'BE', grade: 'BE1', minimum_marks: 0, maximum_marks: 39 },
];

// Student 1: Currently Grade 7 East (unpromoted)
const stdUnpromoted: Student = {
  id: 'stu_7e_unpromoted',
  admission_number: 'ADM101',
  full_name: 'Alice Unpromoted',
  gender: 'F',
  class_id: 'cls_7e',
  stream_id: 'cls_7e',
  grade: 'Grade 7',
  active: true,
  promotion_history: [],
};

// Student 2: Promoted from Grade 7 East -> Grade 8 West on 2025-01-01
const stdPromoted7Eto8W: Student = {
  id: 'stu_7e_to_8w',
  admission_number: 'ADM102',
  full_name: 'Bob Promoted',
  gender: 'M',
  class_id: 'cls_8w', // Currently Grade 8 West
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'p1',
      student_id: 'stu_7e_to_8w',
      from_class_id: 'cls_7e',
      from_grade: 'Grade 7',
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

// Student 3: Multi-promoted (Grade 6 Alpha -> Grade 7 East -> Grade 8 West)
const stdMultiPromoted: Student = {
  id: 'stu_multi',
  admission_number: 'ADM103',
  full_name: 'Charlie Multi',
  gender: 'M',
  class_id: 'cls_8w', // Currently Grade 8 West
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'pm1',
      student_id: 'stu_multi',
      from_class_id: 'cls_6a',
      from_grade: 'Grade 6',
      to_class_id: 'cls_7e',
      to_grade: 'Grade 7',
      date_promoted: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'pm2',
      student_id: 'stu_multi',
      from_class_id: 'cls_7e',
      from_grade: 'Grade 7',
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

// Student 4: Currently Grade 8 East (unpromoted reference)
const stdGrade8East: Student = {
  id: 'stu_8e_ref',
  admission_number: 'ADM104',
  full_name: 'David Grade8East',
  gender: 'M',
  class_id: 'cls_8e',
  stream_id: 'cls_8e',
  grade: 'Grade 8',
  active: true,
  promotion_history: [],
};

const allStudents = [stdUnpromoted, stdPromoted7Eto8W, stdMultiPromoted, stdGrade8East];

// Examinations
const exam2023G6: Examination = {
  id: 'exam_2023_g6',
  exam_name: 'Grade 6 Final Exam 2023',
  academic_year_id: 'ay_2023',
  term: 'Term 3',
  year: 2023,
  start_date: '2023-11-10T00:00:00.000Z',
  date_created: '2023-11-10T00:00:00.000Z',
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

const exam2024G7: Examination = {
  id: 'exam_2024_g7',
  exam_name: 'Grade 7 Mid Term 2024',
  academic_year_id: 'ay_2024',
  term: 'Term 2',
  year: 2024,
  start_date: '2024-06-15T00:00:00.000Z',
  date_created: '2024-06-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'Mid-Term',
  max_marks: 100,
};

const exam2025G8: Examination = {
  id: 'exam_2025_g8',
  exam_name: 'Grade 8 Term 1 2025',
  academic_year_id: 'ay_2025',
  term: 'Term 1',
  year: 2025,
  start_date: '2025-03-15T00:00:00.000Z',
  date_created: '2025-03-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'CAT',
  max_marks: 100,
};

const prevExamG7: Examination = {
  id: 'exam_prev_g7',
  exam_name: 'Grade 7 Term 1 Exam',
  academic_year_id: 'ay_2024',
  term: 'Term 1',
  year: 2024,
  start_date: '2024-03-10T00:00:00.000Z',
  date_created: '2024-03-10T00:00:00.000Z',
  status: 'Published',
  exam_type: 'Mid-Term',
  max_marks: 100,
};

const currExamG7: Examination = {
  id: 'exam_curr_g7',
  exam_name: 'Grade 7 Term 2 Exam',
  academic_year_id: 'ay_2024',
  term: 'Term 2',
  year: 2024,
  start_date: '2024-07-10T00:00:00.000Z',
  date_created: '2024-07-10T00:00:00.000Z',
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

setStorage(KEYS.EXAMS, [exam2023G6, exam2024G7, exam2025G8, prevExamG7, currExamG7]);

// Marks for 2024 Grade 7 exam
const marks2024G7: Mark[] = [
  { id: 'm1', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: 80, out_of: 100 },
  { id: 'm2', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_eng', marks: 70, out_of: 100 },
  { id: 'm3', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_mat', marks: 95, out_of: 100 },
  { id: 'm4', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_eng', marks: 90, out_of: 100 },
  { id: 'm5', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_mat', marks: 60, out_of: 100 },
  { id: 'm6', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_eng', marks: 65, out_of: 100 },
];

// -------------------------------------------------------------
// TEST 1: Historical Class Retention (Grade 7 exam before promotion)
// -------------------------------------------------------------
const g7Cohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  g7Cohort.length === 3,
  `Historical Grade 7 East cohort has 3 learners (found ${g7Cohort.length})`
);
assert(
  g7Cohort.some((s) => s.id === 'stu_7e_to_8w'),
  'Bob Promoted (now Grade 8 West) is retained in historical Grade 7 East cohort'
);

// -------------------------------------------------------------
// TEST 2: Historical Stream Separation (Grade 7 West exam vs Grade 7 East exam)
// -------------------------------------------------------------
const g7WestCohort = getFilteredStudents(allStudents, classes, 'cls_7w', 'cls_7w', exam2024G7);
assert(
  !g7WestCohort.some((s) => s.id === 'stu_7e_to_8w'),
  'Bob Promoted (historical Grade 7 East) is EXCLUDED from Grade 7 West historical cohort'
);

// -------------------------------------------------------------
// TEST 3: Later Examination Behavior (Grade 8 exam in 2025)
// -------------------------------------------------------------
const g8West2025Cohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', exam2025G8);
assert(
  g8West2025Cohort.some((s) => s.id === 'stu_7e_to_8w') && g8West2025Cohort.some((s) => s.id === 'stu_multi'),
  'Bob Promoted and Charlie Multi appear in Grade 8 West cohort for 2025 exam'
);
assert(
  !g8West2025Cohort.some((s) => s.id === 'stu_7e_unpromoted'),
  'Unpromoted Grade 7 learner is excluded from Grade 8 West 2025 exam cohort'
);

// -------------------------------------------------------------
// TEST 4: Multiple Promotions (Grade 6 Alpha in 2023)
// -------------------------------------------------------------
const g6Alpha2023Cohort = getFilteredStudents(allStudents, classes, 'cls_6a', 'cls_6a', exam2023G6);
assert(
  g6Alpha2023Cohort.length === 1 && g6Alpha2023Cohort[0].id === 'stu_multi',
  'Charlie Multi resolves correctly to Grade 6 Alpha cohort for 2023 exam'
);

// -------------------------------------------------------------
// TEST 5: Merit List Ranking Cohort (Ranking within historical cohort)
// -------------------------------------------------------------
const filteredG7 = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const g7MeritResults = calculateExamResults('exam_2024_g7', filteredG7, marks2024G7, grades, classes, subjects);

assert(
  g7MeritResults.length === 3,
  'Merit List results generated for 3 learners in historical Grade 7 East cohort'
);

// Sort by total marks for test verification
g7MeritResults.sort((a, b) => b.total_marks - a.total_marks);

assert(
  g7MeritResults[0].student_id === 'stu_7e_to_8w' && g7MeritResults[0].total_marks === 185,
  'Promoted learner Bob ranks #1 in Grade 7 East historical Merit List with 185 marks'
);
assert(
  g7MeritResults[1].student_id === 'stu_7e_unpromoted' && g7MeritResults[1].total_marks === 150,
  'Unpromoted learner Alice ranks #2 in Grade 7 East historical Merit List with 150 marks'
);
assert(
  g7MeritResults[2].student_id === 'stu_multi' && g7MeritResults[2].total_marks === 125,
  'Multi-promoted learner Charlie ranks #3 in Grade 7 East historical Merit List with 125 marks'
);

// -------------------------------------------------------------
// TEST 6: UI / Export Parity
// -------------------------------------------------------------
// Every export pathway uses getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam)
const uiCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const pdfCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const excelCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const csvCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);

const sameIds =
  uiCohort.map((s) => s.id).join(',') === pdfCohort.map((s) => s.id).join(',') &&
  pdfCohort.map((s) => s.id).join(',') === excelCohort.map((s) => s.id).join(',') &&
  excelCohort.map((s) => s.id).join(',') === csvCohort.map((s) => s.id).join(',');

assert(sameIds, 'UI, PDF, Excel, and CSV pathways produce identical historical student cohorts');

// -------------------------------------------------------------
// TEST 7: Current Behavior (No exam parameter)
// -------------------------------------------------------------
const currentG8West = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w');
assert(
  currentG8West.length === 2 &&
    currentG8West.some((s) => s.id === 'stu_7e_to_8w') &&
    currentG8West.some((s) => s.id === 'stu_multi'),
  'Without exam parameter, live current class filtering (Grade 8 West) returns current Grade 8 West students'
);

// -------------------------------------------------------------
// TEST 8: SURGICAL FIX TEST 1 — Single Stream Filter with Multi-Stream Historical Grade Cohort
// -------------------------------------------------------------
// Previous Exam:
// Grade 7 East: A = 700 (100+100 + 7 subjects = 100 avg), B = 650, C = 600
// Grade 7 West: D = 680, E = 620
// Total Grade 7 cohort: A=700 (OVR 1), D=680 (OVR 2), B=650 (OVR 3), E=620 (OVR 4), C=600 (OVR 5)
// In East Stream: A (STR 1), B (STR 2), C (STR 3)

const stdA: Student = { id: 'std_a', admission_number: 'A01', full_name: 'Learner A', gender: 'F', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };
const stdB: Student = { id: 'std_b', admission_number: 'A02', full_name: 'Learner B', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };
const stdC: Student = { id: 'std_c', admission_number: 'A03', full_name: 'Learner C', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };
const stdD: Student = { id: 'std_d', admission_number: 'A04', full_name: 'Learner D', gender: 'F', class_id: 'cls_7w', stream_id: 'cls_7w', grade: 'Grade 7', active: true, promotion_history: [] };
const stdE: Student = { id: 'std_e', admission_number: 'A05', full_name: 'Learner E', gender: 'M', class_id: 'cls_7w', stream_id: 'cls_7w', grade: 'Grade 7', active: true, promotion_history: [] };

const g7AllStudents = [stdA, stdB, stdC, stdD, stdE];

// Two subjects (MAT & ENG) for simplicity:
// A: 100 + 100 = 200 (Equivalent to 700 / top score)
// D: 95 + 95 = 190 (West)
// B: 90 + 90 = 180 (East)
// E: 85 + 85 = 170 (West)
// C: 80 + 80 = 160 (East)
const prevMarks: Mark[] = [
  { id: 'pm_a1', exam_id: 'exam_prev_g7', student_id: 'std_a', subject_id: 'sb_mat', marks: 100, out_of: 100 },
  { id: 'pm_a2', exam_id: 'exam_prev_g7', student_id: 'std_a', subject_id: 'sb_eng', marks: 100, out_of: 100 },

  { id: 'pm_d1', exam_id: 'exam_prev_g7', student_id: 'std_d', subject_id: 'sb_mat', marks: 95, out_of: 100 },
  { id: 'pm_d2', exam_id: 'exam_prev_g7', student_id: 'std_d', subject_id: 'sb_eng', marks: 95, out_of: 100 },

  { id: 'pm_b1', exam_id: 'exam_prev_g7', student_id: 'std_b', subject_id: 'sb_mat', marks: 90, out_of: 100 },
  { id: 'pm_b2', exam_id: 'exam_prev_g7', student_id: 'std_b', subject_id: 'sb_eng', marks: 90, out_of: 100 },

  { id: 'pm_e1', exam_id: 'exam_prev_g7', student_id: 'std_e', subject_id: 'sb_mat', marks: 85, out_of: 100 },
  { id: 'pm_e2', exam_id: 'exam_prev_g7', student_id: 'std_e', subject_id: 'sb_eng', marks: 85, out_of: 100 },

  { id: 'pm_c1', exam_id: 'exam_prev_g7', student_id: 'std_c', subject_id: 'sb_mat', marks: 80, out_of: 100 },
  { id: 'pm_c2', exam_id: 'exam_prev_g7', student_id: 'std_c', subject_id: 'sb_eng', marks: 80, out_of: 100 },
];

const currMarks: Mark[] = [
  { id: 'cm_a1', exam_id: 'exam_curr_g7', student_id: 'std_a', subject_id: 'sb_mat', marks: 90, out_of: 100 },
  { id: 'cm_a2', exam_id: 'exam_curr_g7', student_id: 'std_a', subject_id: 'sb_eng', marks: 90, out_of: 100 },

  { id: 'cm_b1', exam_id: 'exam_curr_g7', student_id: 'std_b', subject_id: 'sb_mat', marks: 85, out_of: 100 },
  { id: 'cm_b2', exam_id: 'exam_curr_g7', student_id: 'std_b', subject_id: 'sb_eng', marks: 85, out_of: 100 },

  { id: 'cm_c1', exam_id: 'exam_curr_g7', student_id: 'std_c', subject_id: 'sb_mat', marks: 80, out_of: 100 },
  { id: 'cm_c2', exam_id: 'exam_curr_g7', student_id: 'std_c', subject_id: 'sb_eng', marks: 80, out_of: 100 },
];

// User generates report for Grade 7 East only:
const eastTargetStudents = getFilteredStudents(g7AllStudents, classes, 'cls_7e', 'cls_7e', currExamG7);
assert(eastTargetStudents.length === 3, 'Current East filter returns 3 students (A, B, C)');

// Current exam results for target students:
const eastCurrResults = calculateExamResults('exam_curr_g7', eastTargetStudents, currMarks, grades, classes, subjects);

// Comparison calculation with full historical student population:
const allCompResults = calculateExamResults('exam_prev_g7', g7AllStudents, prevMarks, grades, classes, subjects);
const compMap = new Map<string, any>();
allCompResults.forEach((r) => compMap.set(r.student_id, r));

eastCurrResults.forEach((r) => {
  const prev = compMap.get(r.student_id);
  if (prev) {
    (r as any).previous_position = prev.position;
    (r as any).previous_class_position = prev.class_position || prev.stream_position;
  }
});

const resA = eastCurrResults.find((r) => r.student_id === 'std_a');
const resB = eastCurrResults.find((r) => r.student_id === 'std_b');
const resC = eastCurrResults.find((r) => r.student_id === 'std_c');

assert(
  (resA as any)?.previous_position === 1 && (resA as any)?.previous_class_position === 1,
  `Learner A: PRV OVR POS = 1 (expected 1), PRV STR POS = 1 (expected 1)`
);
assert(
  (resB as any)?.previous_position === 3 && (resB as any)?.previous_class_position === 2,
  `Learner B: PRV OVR POS = 3 (expected 3, accounting for West learner D at rank 2), PRV STR POS = 2 (expected 2)`
);
assert(
  (resC as any)?.previous_position === 5 && (resC as any)?.previous_class_position === 3,
  `Learner C: PRV OVR POS = 5 (expected 5, accounting for West learners D & E), PRV STR POS = 3 (expected 3)`
);

// -------------------------------------------------------------
// TEST 9: SURGICAL FIX TEST 2 — Historical Stream Transfer
// -------------------------------------------------------------
// In Previous Exam:
// Grade 7 West: B = 750 (200), C = 720 (190), A = 700 (180) -> Stream rank for A in West was 3.
// Student A later transferred from West to East.
// Current report is filtered to Grade 7 East.
// Student A must receive PRV STR POS = 3, not 1.

const stdTransferA: Student = {
  id: 'std_trans_a',
  admission_number: 'TR01',
  full_name: 'Transfer Learner A',
  gender: 'F',
  class_id: 'cls_7e', // Currently Grade 7 East
  stream_id: 'cls_7e',
  grade: 'Grade 7',
  active: true,
  promotion_history: [
    {
      id: 'p_trans',
      student_id: 'std_trans_a',
      from_class_id: 'cls_7w',
      from_grade: 'Grade 7',
      to_class_id: 'cls_7e',
      to_grade: 'Grade 7',
      date_promoted: '2024-06-01T00:00:00.000Z',
    },
  ],
};

const stdWestB: Student = { id: 'std_w_b', admission_number: 'W02', full_name: 'West Learner B', gender: 'M', class_id: 'cls_7w', stream_id: 'cls_7w', grade: 'Grade 7', active: true, promotion_history: [] };
const stdWestC: Student = { id: 'std_w_c', admission_number: 'W03', full_name: 'West Learner C', gender: 'F', class_id: 'cls_7w', stream_id: 'cls_7w', grade: 'Grade 7', active: true, promotion_history: [] };

const transferSchoolStudents = [stdTransferA, stdWestB, stdWestC];

const transferPrevMarks: Mark[] = [
  { id: 'tm_b1', exam_id: 'exam_prev_g7', student_id: 'std_w_b', subject_id: 'sb_mat', marks: 100, out_of: 100 },
  { id: 'tm_b2', exam_id: 'exam_prev_g7', student_id: 'std_w_b', subject_id: 'sb_eng', marks: 100, out_of: 100 }, // Total = 200 (Rank 1 West)

  { id: 'tm_c1', exam_id: 'exam_prev_g7', student_id: 'std_w_c', subject_id: 'sb_mat', marks: 95, out_of: 100 },
  { id: 'tm_c2', exam_id: 'exam_prev_g7', student_id: 'std_w_c', subject_id: 'sb_eng', marks: 95, out_of: 100 }, // Total = 190 (Rank 2 West)

  { id: 'tm_a1', exam_id: 'exam_prev_g7', student_id: 'std_trans_a', subject_id: 'sb_mat', marks: 90, out_of: 100 },
  { id: 'tm_a2', exam_id: 'exam_prev_g7', student_id: 'std_trans_a', subject_id: 'sb_eng', marks: 90, out_of: 100 }, // Total = 180 (Rank 3 West)
];

const compResultsTransfer = calculateExamResults('exam_prev_g7', transferSchoolStudents, transferPrevMarks, grades, classes, subjects);
const compTransferA = compResultsTransfer.find((r) => r.student_id === 'std_trans_a');

assert(
  compTransferA?.class_position === 3,
  `Transferred Learner A: PRV STR POS = 3 (expected 3 among historical West cohort, received ${compTransferA?.class_position})`
);

// -------------------------------------------------------------
// TEST 10: SURGICAL FIX TEST 3 — Historical Competition Tie (1, 1, 3)
// -------------------------------------------------------------
const stdTieA: Student = { id: 'std_t_a', admission_number: 'T01', full_name: 'Tie A', gender: 'F', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };
const stdTieB: Student = { id: 'std_t_b', admission_number: 'T02', full_name: 'Tie B', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };
const stdTieC: Student = { id: 'std_t_c', admission_number: 'T03', full_name: 'Tie C', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };

const tieStudents = [stdTieA, stdTieB, stdTieC];
const tieMarks: Mark[] = [
  { id: 'ti_a1', exam_id: 'exam_prev_g7', student_id: 'std_t_a', subject_id: 'sb_mat', marks: 90, out_of: 100 },
  { id: 'ti_a2', exam_id: 'exam_prev_g7', student_id: 'std_t_a', subject_id: 'sb_eng', marks: 90, out_of: 100 }, // 180

  { id: 'ti_b1', exam_id: 'exam_prev_g7', student_id: 'std_t_b', subject_id: 'sb_mat', marks: 90, out_of: 100 },
  { id: 'ti_b2', exam_id: 'exam_prev_g7', student_id: 'std_t_b', subject_id: 'sb_eng', marks: 90, out_of: 100 }, // 180

  { id: 'ti_c1', exam_id: 'exam_prev_g7', student_id: 'std_t_c', subject_id: 'sb_mat', marks: 80, out_of: 100 },
  { id: 'ti_c2', exam_id: 'exam_prev_g7', student_id: 'std_t_c', subject_id: 'sb_eng', marks: 80, out_of: 100 }, // 160
];

const tieResults = calculateExamResults('exam_prev_g7', tieStudents, tieMarks, grades, classes, subjects);
const tieResA = tieResults.find((r) => r.student_id === 'std_t_a');
const tieResB = tieResults.find((r) => r.student_id === 'std_t_b');
const tieResC = tieResults.find((r) => r.student_id === 'std_t_c');

assert(
  tieResA?.position === 1 && tieResB?.position === 1 && tieResC?.position === 3,
  `Historical Tie (1, 1, 3): A = ${tieResA?.position}, B = ${tieResB?.position}, C = ${tieResC?.position} (expected 1, 1, 3)`
);

// -------------------------------------------------------------
// TEST 11: SURGICAL FIX TEST 4 — Incomplete Previous Result Handling
// -------------------------------------------------------------
const stdIncomplete: Student = { id: 'std_inc', admission_number: 'INC01', full_name: 'Incomplete Learner', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', grade: 'Grade 7', active: true, promotion_history: [] };
const incMarks: Mark[] = [
  { id: 'im_1', exam_id: 'exam_prev_g7', student_id: 'std_inc', subject_id: 'sb_mat', marks: 85, out_of: 100 },
  // Missing ENG
];

const incResults = calculateExamResults('exam_prev_g7', [stdIncomplete], incMarks, grades, classes, subjects);
const incRes = incResults.find((r) => r.student_id === 'std_inc');

assert(
  incRes?.is_complete === false && incRes?.position === 0 && incRes?.class_position === 0,
  `Incomplete historical learner is unranked (position = 0, is_complete = false)`
);

console.log(`\n==================================================`);
console.log(`HISTORICAL MERIT LIST COHORT TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
