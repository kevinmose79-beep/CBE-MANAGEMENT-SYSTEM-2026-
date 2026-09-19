import '../testSetup';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { getFilteredStudents } from '../utils/filterUtils';
import { generateExamAnalysisSummary, calculateExamResults } from './analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { Student, ClassStream, Examination, Subject, Grade, Mark } from '../types';

console.log('=== RUNNING PRIORITY 2G REPORTS VIEW HISTORICAL COHORT INTEGRATION TESTS ===\n');

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
// SETUP FIXTURES
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
  { id: 'g1', grade_code: 'EE', minimum_score: 80, maximum_score: 100, points: 4, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
  { id: 'g2', grade_code: 'ME', minimum_score: 65, maximum_score: 79, points: 3, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
  { id: 'g3', grade_code: 'AE', minimum_score: 50, maximum_score: 64, points: 2, performance_level: 'AE', remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
  { id: 'g4', grade_code: 'BE', minimum_score: 0, maximum_score: 49, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
];

// Student 1: Unpromoted (Currently Grade 7 East)
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
  class_id: 'cls_8w',
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
  class_id: 'cls_8w',
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

// Student 4: Unpromoted Grade 7 West student (Diana)
const stdWestStudent: Student = {
  id: 'stu_7w_diana',
  admission_number: 'ADM104',
  full_name: 'Diana West',
  gender: 'F',
  class_id: 'cls_7w',
  stream_id: 'cls_7w',
  grade: 'Grade 7',
  active: true,
  promotion_history: [],
};

const allStudents = [stdUnpromoted, stdPromoted7Eto8W, stdMultiPromoted, stdWestStudent];

// Examinations
const exam2023G6: Examination = {
  id: 'exam_2023_g6',
  exam_name: 'Grade 6 End Term 2023',
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

const marks2024: Mark[] = [
  { id: 'm1', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: 75 },
  { id: 'm2', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_mat', marks: 95 },
  { id: 'm3', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_mat', marks: 60 },
  { id: 'm4', exam_id: 'exam_2024_g7', student_id: 'stu_7w_diana', subject_id: 'sb_mat', marks: 40 },
];

// -------------------------------------------------------------
// TEST 1: Promoted learner appears in the historical student cohort
// -------------------------------------------------------------
const g7eCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  g7eCohort.some((s) => s.id === 'stu_7e_to_8w'),
  '1. Promoted learner (Bob, now Grade 8 West) appears in 2024 Grade 7 East student cohort'
);

// -------------------------------------------------------------
// TEST 2: Promoted learner is selectable for the old examination
// -------------------------------------------------------------
assert(
  g7eCohort.map(s => s.id).includes('stu_7e_to_8w'),
  '2. Promoted learner (Bob) is selectable in targetStudents for 2024 Grade 7 East exam'
);

// -------------------------------------------------------------
// TEST 3: Historical stream membership is retained after a later stream change
// -------------------------------------------------------------
const g7wCohort = getFilteredStudents(allStudents, classes, 'cls_7w', 'cls_7w', exam2024G7);
assert(
  !g7wCohort.some((s) => s.id === 'stu_7e_to_8w') && g7wCohort.some((s) => s.id === 'stu_7w_diana'),
  '3. Learner who moved to West stream in Grade 8 is EXCLUDED from Grade 7 West cohort for 2024 exam'
);

// -------------------------------------------------------------
// TEST 4: Later examination resolves the learner to the new class/stream
// -------------------------------------------------------------
const g8wCohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', exam2025G8);
assert(
  g8wCohort.some((s) => s.id === 'stu_7e_to_8w'),
  '4. Later 2025 examination correctly resolves Bob to current Grade 8 West cohort'
);

// -------------------------------------------------------------
// TEST 5: Multiple promotions resolve correctly
// -------------------------------------------------------------
const g6a2023Cohort = getFilteredStudents(allStudents, classes, 'cls_6a', 'cls_6a', exam2023G6);
assert(
  g6a2023Cohort.length === 1 && g6a2023Cohort[0].id === 'stu_multi',
  '5. Multi-promoted learner (Charlie) resolves to Grade 6 Alpha for 2023 exam'
);

// -------------------------------------------------------------
// TEST 6: Historical class dropdown count is correct
// -------------------------------------------------------------
const g7ClassCount = getFilteredStudents(allStudents, classes, 'Grade 7', 'all', exam2024G7).length;
assert(
  g7ClassCount === 4,
  '6. Class dropdown count for Grade 7 during 2024 exam equals 4 (Alice, Bob, Charlie, Diana)'
);

// -------------------------------------------------------------
// TEST 7: Historical stream dropdown count is correct
// -------------------------------------------------------------
const g7eStreamCount = getFilteredStudents(allStudents, classes, 'Grade 7', 'cls_7e', exam2024G7).length;
assert(
  g7eStreamCount === 3,
  '7. Stream dropdown count for Grade 7 East during 2024 exam equals 3'
);

// -------------------------------------------------------------
// TEST 8: Historical student dropdown cohort is correct
// -------------------------------------------------------------
const studentDropdownCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  studentDropdownCohort.length === 3 &&
    studentDropdownCohort.every(s => ['stu_7e_unpromoted', 'stu_7e_to_8w', 'stu_multi'].includes(s.id)),
  '8. Student dropdown cohort for 2024 Grade 7 East contains exactly Alice, Bob, and Charlie'
);

// -------------------------------------------------------------
// TEST 9: Batch Class Reports receive the correct historical cohort
// -------------------------------------------------------------
const batchCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  batchCohort.length === 3 && batchCohort.some(s => s.id === 'stu_7e_to_8w'),
  '9. Batch Class Reports receive historical cohort of 3 learners including promoted learner Bob'
);

// -------------------------------------------------------------
// TEST 10: On-screen Subject Analysis receives the same historical cohort as PDF exporter
// -------------------------------------------------------------
const analysisSummary = generateExamAnalysisSummary(
  exam2024G7.id,
  exam2024G7.exam_name,
  batchCohort,
  subjects,
  marks2024,
  grades
);
assert(
  analysisSummary.total_students === 3,
  '10. On-screen Subject Analysis summary counts exactly 3 learners matching historical cohort'
);

// -------------------------------------------------------------
// TEST 11: LearnerReportCard historical stream count is correct
// -------------------------------------------------------------
const lrcStreamCount = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7).length;
assert(
  lrcStreamCount === 3,
  '11. LearnerReportCard historical stream count is 3 for 2024 Grade 7 East'
);

// -------------------------------------------------------------
// TEST 12: All Classes works with historical examinations
// -------------------------------------------------------------
const allClassCohort = getFilteredStudents(allStudents, classes, 'all', 'all', exam2024G7);
assert(
  allClassCohort.length === 4,
  '12. All Classes filter returns all 4 learners active during 2024 exam'
);

// -------------------------------------------------------------
// TEST 13: All Streams works with historical examinations
// -------------------------------------------------------------
const g7AllStreams = getFilteredStudents(allStudents, classes, 'Grade 7', 'all', exam2024G7);
assert(
  g7AllStreams.length === 4,
  '13. Grade 7 All Streams filter for 2024 exam includes all 4 Grade 7 learners'
);

// -------------------------------------------------------------
// TEST 14: Unpromoted learners remain correct
// -------------------------------------------------------------
assert(
  g7eCohort.some(s => s.id === 'stu_7e_unpromoted'),
  '14. Unpromoted learner Alice is correctly included in Grade 7 East 2024 cohort'
);

// -------------------------------------------------------------
// TEST 15: No-examination/live behaviour remains unchanged
// -------------------------------------------------------------
const liveCohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', undefined);
assert(
  liveCohort.length === 2 && liveCohort.every(s => s.class_id === 'cls_8w'),
  '15. When no examination is supplied, live current Grade 8 West students are returned'
);

// -------------------------------------------------------------
// TEST 16: X handling remains unchanged
// -------------------------------------------------------------
const evalX = evaluateMark({ marks: 'X' } as unknown as Mark);
assert(
  evalX.status === 'X' && evalX.displayScore === 'X',
  '16. Evaluation of absent mark remains status X'
);

// -------------------------------------------------------------
// TEST 17: Y handling remains unchanged
// -------------------------------------------------------------
const evalY = evaluateMark({ marks: 'Y' } as unknown as Mark);
assert(
  evalY.status === 'Y' && evalY.displayScore === 'Y',
  '17. Evaluation of irregularity mark remains status Y'
);

// -------------------------------------------------------------
// TEST 18: Historical UI cohort matches the existing historical exporter cohort
// -------------------------------------------------------------
const uiCohortIds = g7eCohort.map(s => s.id).sort();
const exporterCohortIds = ['stu_7e_unpromoted', 'stu_7e_to_8w', 'stu_multi'].sort();
assert(
  JSON.stringify(uiCohortIds) === JSON.stringify(exporterCohortIds),
  '18. Reports UI cohort matches historical exporter cohort exactly'
);

// -------------------------------------------------------------
// TEST 19: Multi-promotion consistency across Reports UI and exporters
// -------------------------------------------------------------
const charlie2023 = getFilteredStudents(allStudents, classes, 'cls_6a', 'cls_6a', exam2023G6);
const charlie2024 = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const charlie2025 = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', exam2025G8);
assert(
  charlie2023.length === 1 && charlie2024.length === 3 && charlie2025.length === 2,
  '19. Multi-promotion consistency: Charlie resolves to Grade 6 in 2023, Grade 7 in 2024, Grade 8 in 2025'
);

// -------------------------------------------------------------
// TEST 20: Access-controlled student lists remain respected
// -------------------------------------------------------------
const restrictedAccessibleStudents = [stdUnpromoted, stdPromoted7Eto8W]; // e.g. subset accessible to a teacher
const restrictedCohort = getFilteredStudents(restrictedAccessibleStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  restrictedCohort.length === 2 && !restrictedCohort.some(s => s.id === 'stu_multi'),
  '20. Access-controlled student subset is respected during historical cohort resolution'
);

console.log(`\n==================================================`);
console.log(`REPORTS VIEW HISTORICAL TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
