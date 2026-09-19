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
import { generateExamAnalysisSummary } from './analysisEngine';
import { Student, ClassStream, Examination, Subject, Grade, Mark, School } from '../types';

console.log('=== RUNNING PRIORITY 2F PROVISIONAL APPROVAL HISTORICAL COHORT INTEGRATION TESTS ===\n');

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

// Marks for 2024 Exam
const marks2024: Mark[] = [
  { id: 'm1', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: 75 },
  { id: 'm2', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_mat', marks: 95 },
  { id: 'm3', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_mat', marks: 60 },
  { id: 'm4', exam_id: 'exam_2024_g7', student_id: 'stu_7w_diana', subject_id: 'sb_mat', marks: 40 },
  { id: 'm5', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_eng', marks: 'X' as any },
  { id: 'm6', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_eng', marks: 'Y' as any },
];

// -------------------------------------------------------------
// TEST 1: Promoted learner retained in an old historical class
// -------------------------------------------------------------
const g7eCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  g7eCohort.some((s) => s.id === 'stu_7e_to_8w'),
  '1. Promoted learner (Bob, now Grade 8 West) is retained in 2024 Grade 7 East provisional approval cohort'
);

// -------------------------------------------------------------
// TEST 2: Historical stream retained after a later stream change
// -------------------------------------------------------------
const g7wCohort = getFilteredStudents(allStudents, classes, 'cls_7w', 'cls_7w', exam2024G7);
assert(
  !g7wCohort.some((s) => s.id === 'stu_7e_to_8w') && g7wCohort.some((s) => s.id === 'stu_7w_diana'),
  '2. Learner who moved to West stream in Grade 8 is EXCLUDED from Grade 7 West for 2024 exam'
);

// -------------------------------------------------------------
// TEST 3: Later examination resolves the learner to the new class/stream
// -------------------------------------------------------------
const g8wCohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', exam2025G8);
assert(
  g8wCohort.some((s) => s.id === 'stu_7e_to_8w'),
  '3. Later 2025 examination correctly resolves Bob to current Grade 8 West cohort'
);

// -------------------------------------------------------------
// TEST 4: Multiple promotions resolve correctly for each examination
// -------------------------------------------------------------
const g6a2023Cohort = getFilteredStudents(allStudents, classes, 'cls_6a', 'cls_6a', exam2023G6);
assert(
  g6a2023Cohort.length === 1 && g6a2023Cohort[0].id === 'stu_multi',
  '4. Multi-promoted learner (Charlie) resolves to Grade 6 Alpha for 2023 exam'
);

// -------------------------------------------------------------
// TEST 5: All Classes historical filtering
// -------------------------------------------------------------
const allClass2024Cohort = getFilteredStudents(allStudents, classes, 'all', 'all', exam2024G7);
assert(
  allClass2024Cohort.length === 4,
  '5. All Classes filter returns all 4 learners active during 2024 exam'
);

// -------------------------------------------------------------
// TEST 6: All Streams historical filtering
// -------------------------------------------------------------
const g7AllStreamsCohort = getFilteredStudents(allStudents, classes, 'Grade 7', 'all', exam2024G7);
assert(
  g7AllStreamsCohort.length === 4 &&
    g7AllStreamsCohort.every((s) => ['stu_7e_unpromoted', 'stu_7e_to_8w', 'stu_multi', 'stu_7w_diana'].includes(s.id)),
  '6. Grade 7 All Streams filter returns all 4 learners who were in Grade 7 during 2024 exam'
);

// -------------------------------------------------------------
// TEST 7: Specific historical class filtering
// -------------------------------------------------------------
const g7SpecificClassCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  g7SpecificClassCohort.length === 3 &&
    g7SpecificClassCohort.every((s) => ['stu_7e_unpromoted', 'stu_7e_to_8w', 'stu_multi'].includes(s.id)),
  '7. Specific historical class and stream (cls_7e) correctly filters to the 3 Grade 7 East learners'
);

// -------------------------------------------------------------
// TEST 8: Specific historical stream filtering
// -------------------------------------------------------------
assert(
  g7eCohort.length === 3 && !g7eCohort.some((s) => s.id === 'stu_7w_diana'),
  '8. Specific historical stream (cls_7e) excludes Diana (Grade 7 West)'
);

// -------------------------------------------------------------
// TEST 9: Aggregate performance summary uses the historical cohort
// -------------------------------------------------------------
const summary = generateExamAnalysisSummary(
  exam2024G7.id,
  exam2024G7.exam_name,
  g7eCohort,
  subjects,
  marks2024,
  grades
);
assert(
  summary.total_students === 3,
  '9. Aggregate performance summary counts exactly 3 historical Grade 7 East candidates'
);

// -------------------------------------------------------------
// TEST 10: X / Absent handling remains unchanged
// -------------------------------------------------------------
const evalX = evaluateMark({ marks: 'X' } as unknown as Mark);
assert(
  evalX.status === 'X' && evalX.displayScore === 'X',
  '10. Evaluation of absent mark remains status X'
);

// -------------------------------------------------------------
// TEST 11: Y / Irregularity handling remains unchanged
// -------------------------------------------------------------
const evalY = evaluateMark({ marks: 'Y' } as unknown as Mark);
assert(
  evalY.status === 'Y' && evalY.displayScore === 'Y',
  '11. Evaluation of irregularity mark remains status Y'
);

// -------------------------------------------------------------
// TEST 12: Unpromoted learner behaviour remains unchanged
// -------------------------------------------------------------
assert(
  g7eCohort.some((s) => s.id === 'stu_7e_unpromoted'),
  '12. Unpromoted learner Alice remains correctly included in Grade 7 East cohort'
);

// -------------------------------------------------------------
// TEST 13: Current/live examination behaviour remains unchanged
// -------------------------------------------------------------
const liveCohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', undefined);
assert(
  liveCohort.length === 2 && liveCohort.every((s) => s.class_id === 'cls_8w'),
  '13. When no examination is supplied, getFilteredStudents returns live current Grade 8 West students'
);

// -------------------------------------------------------------
// TEST 14: Historical candidate count matches the examination-time cohort
// -------------------------------------------------------------
assert(
  g7eCohort.length === 3,
  '14. Historical candidate count for 2024 Grade 7 East is exactly 3'
);

console.log(`\n==================================================`);
console.log(`PROVISIONAL APPROVAL HISTORICAL TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
