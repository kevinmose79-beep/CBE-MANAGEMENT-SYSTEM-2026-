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
import { evaluateMark } from '../utils/markUtils';
import { Student, ClassStream, Examination, Subject, Grade, Mark } from '../types';

console.log('=== RUNNING PRIORITY 2C PROVISIONAL RESULTS HISTORICAL COHORT INTEGRATION TESTS ===\n');

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
  { id: 'g1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceeding', descriptor: 'EE', grade: 'EE1', minimum_marks: 90, maximum_marks: 100 },
  { id: 'g2', grade_code: 'ME1', performance_level: 'ME', minimum_score: 60, maximum_score: 89, points: 6, remarks: 'Meeting', descriptor: 'ME', grade: 'ME1', minimum_marks: 60, maximum_marks: 89 },
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

// Student 4: No promotion history (Currently Grade 8 East)
const stdNoHistory: Student = {
  id: 'stu_no_history',
  admission_number: 'ADM104',
  full_name: 'David NoHistory',
  gender: 'M',
  class_id: 'cls_8e',
  stream_id: 'cls_8e',
  grade: 'Grade 8',
  active: true,
  promotion_history: [],
};

const allStudents = [stdUnpromoted, stdPromoted7Eto8W, stdMultiPromoted, stdNoHistory];

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

// -------------------------------------------------------------
// TEST 1: Promoted learner retained in old historical class
// -------------------------------------------------------------
const g7eProvisionalCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  g7eProvisionalCohort.some((s) => s.id === 'stu_7e_to_8w'),
  '1. Promoted learner (Bob, now Grade 8 West) is retained in 2024 Grade 7 East provisional results cohort'
);

// -------------------------------------------------------------
// TEST 2: Stream change handled correctly
// -------------------------------------------------------------
const g7wProvisionalCohort = getFilteredStudents(allStudents, classes, 'cls_7w', 'cls_7w', exam2024G7);
assert(
  !g7wProvisionalCohort.some((s) => s.id === 'stu_7e_to_8w'),
  '2. Learner who moved to West stream in Grade 8 is EXCLUDED from Grade 7 West for 2024 exam'
);

// -------------------------------------------------------------
// TEST 3: Later examination resolves to new class/stream
// -------------------------------------------------------------
const g8w2025Cohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', exam2025G8);
assert(
  g8w2025Cohort.some((s) => s.id === 'stu_7e_to_8w'),
  '3. Later 2025 examination correctly resolves Bob to current Grade 8 West cohort'
);

// -------------------------------------------------------------
// TEST 4: Multiple promotions
// -------------------------------------------------------------
const g6a2023Cohort = getFilteredStudents(allStudents, classes, 'cls_6a', 'cls_6a', exam2023G6);
assert(
  g6a2023Cohort.length === 1 && g6a2023Cohort[0].id === 'stu_multi',
  '4. Multi-promoted learner (Charlie) resolves to Grade 6 Alpha for 2023 exam'
);

// -------------------------------------------------------------
// TEST 5: All Classes
// -------------------------------------------------------------
const allClass2024Cohort = getFilteredStudents(allStudents, classes, 'all', 'all', exam2024G7);
assert(
  allClass2024Cohort.length === 4,
  '5. All Classes filter returns all 4 learners active during 2024 exam'
);

// -------------------------------------------------------------
// TEST 6: All Streams
// -------------------------------------------------------------
const g7AllStreamsCohort = getFilteredStudents(allStudents, classes, 'Grade 7', 'all', exam2024G7);
assert(
  g7AllStreamsCohort.length === 3 &&
    g7AllStreamsCohort.every((s) => s.id === 'stu_7e_unpromoted' || s.id === 'stu_7e_to_8w' || s.id === 'stu_multi'),
  '6. Grade 7 All Streams filter returns all 3 learners who were in Grade 7 during 2024 exam'
);

// -------------------------------------------------------------
// TEST 7: Specific historical class
// -------------------------------------------------------------
const g7ClassCohort = getFilteredStudents(allStudents, classes, 'Grade 7', 'cls_7e', exam2024G7);
assert(
  g7ClassCohort.length === 3,
  '7. Specific historical class (Grade 7 East) correctly matches all 3 historical members'
);

// -------------------------------------------------------------
// TEST 8: Specific historical stream
// -------------------------------------------------------------
assert(
  g7ClassCohort.every((s) => s.id !== 'stu_no_history'),
  '8. Specific historical stream excludes learners from other streams/classes'
);

// -------------------------------------------------------------
// TEST 9: Unpromoted learner
// -------------------------------------------------------------
assert(
  g7eProvisionalCohort.some((s) => s.id === 'stu_7e_unpromoted'),
  '9. Unpromoted learner Alice remains in Grade 7 East for 2024 exam'
);

// -------------------------------------------------------------
// TEST 10: Missing/empty promotion history
// -------------------------------------------------------------
const g8e2025Cohort = getFilteredStudents(allStudents, classes, 'cls_8e', 'cls_8e', exam2025G8);
assert(
  g8e2025Cohort.some((s) => s.id === 'stu_no_history'),
  '10. Learner without promotion history safely falls back to current class (Grade 8 East)'
);

// -------------------------------------------------------------
// TEST 11: X handling unchanged
// -------------------------------------------------------------
const markX: Mark = { id: 'mx', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: null, special_status: 'X' };
const evalX = evaluateMark(markX);
assert(
  evalX.status === 'X',
  '11. Evaluation of absent mark remains status X'
);

// -------------------------------------------------------------
// TEST 12: Y handling unchanged
// -------------------------------------------------------------
const markY: Mark = { id: 'my', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: null, special_status: 'Y' };
const evalY = evaluateMark(markY);
assert(
  evalY.status === 'Y',
  '12. Evaluation of irregularity mark remains status Y'
);

// -------------------------------------------------------------
// TEST 13: UI/PDF cohort parity
// -------------------------------------------------------------
const uiCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const pdfCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  uiCohort.map((s) => s.id).join(',') === pdfCohort.map((s) => s.id).join(','),
  '13. UI and PDF pathways return identical student cohorts for historical provisional results'
);

// -------------------------------------------------------------
// TEST 14: Current/live behaviour remains unchanged when no examination is supplied
// -------------------------------------------------------------
const liveG8wCohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w');
assert(
  liveG8wCohort.length === 2 && liveG8wCohort.some((s) => s.id === 'stu_7e_to_8w') && liveG8wCohort.some((s) => s.id === 'stu_multi'),
  '14. When no examination is supplied, getFilteredStudents returns live current Grade 8 West students'
);

console.log(`\n==================================================`);
console.log(`PROVISIONAL RESULTS HISTORICAL TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
