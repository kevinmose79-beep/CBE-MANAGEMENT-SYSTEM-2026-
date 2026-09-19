import { getFilteredStudents } from './filterUtils';
import { Student, ClassStream, Examination } from '../types';

console.log('--- RUNNING HISTORICAL COHORT FILTERING TESTS ---');

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

// Setup common mock classes
const classes: ClassStream[] = [
  { id: 'cls_6a', class_name: 'Grade 6', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_7w', class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', education_level: 'Junior School' },
];

// Setup mock students
// Student 1: Unpromoted Grade 7 East student
const studentUnpromoted: Student = {
  id: 'stu_unpromoted',
  admission_number: 'ADM001',
  full_name: 'John Unpromoted',
  gender: 'M',
  class_id: 'cls_7e',
  stream_id: 'cls_7e',
  grade: 'Grade 7',
  active: true,
  promotion_history: [],
};

// Student 2: Single promotion (Grade 7 East -> Grade 8 West)
const studentPromotedOnce: Student = {
  id: 'stu_promoted_1',
  admission_number: 'ADM002',
  full_name: 'Jane Promoted',
  gender: 'F',
  class_id: 'cls_8w', // Currently in Grade 8 West
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'promo_1',
      student_id: 'stu_promoted_1',
      from_class_id: 'cls_7e',
      from_grade: 'Grade 7',
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

// Student 3: Multiple promotions (Grade 6 Alpha -> Grade 7 East -> Grade 8 West)
const studentPromotedMulti: Student = {
  id: 'stu_promoted_multi',
  admission_number: 'ADM003',
  full_name: 'Mark MultiPromoted',
  gender: 'M',
  class_id: 'cls_8w', // Currently Grade 8 West
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'promo_m1',
      student_id: 'stu_promoted_multi',
      from_class_id: 'cls_6a',
      from_grade: 'Grade 6',
      to_class_id: 'cls_7e',
      to_grade: 'Grade 7',
      date_promoted: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'promo_m2',
      student_id: 'stu_promoted_multi',
      from_class_id: 'cls_7e',
      from_grade: 'Grade 7',
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

// Student 4: Promoted learner with ambiguous/unresolved historical stream (no from_class_id, only from_grade: 'Grade 7')
const studentAmbiguousStream: Student = {
  id: 'stu_ambiguous',
  admission_number: 'ADM004',
  full_name: 'Alice Ambiguous',
  gender: 'F',
  class_id: 'cls_8w',
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'promo_amb',
      student_id: 'stu_ambiguous',
      from_grade: 'Grade 7', // No from_class_id provided, multiple Grade 7 streams exist
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

const allTestStudents = [
  studentUnpromoted,
  studentPromotedOnce,
  studentPromotedMulti,
  studentAmbiguousStream,
];

// Setup mock examinations
const oldExam2023: Examination = {
  id: 'exam_2023',
  exam_name: 'Term 2 2023 Exam',
  academic_year_id: 'ay_2023',
  term: 'Term 2',
  year: 2023,
  start_date: '2023-06-15T00:00:00.000Z',
  date_created: '2023-06-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'CAT',
  max_marks: 100,
};

const oldExam2024: Examination = {
  id: 'exam_2024',
  exam_name: 'Term 2 2024 Exam',
  academic_year_id: 'ay_2024',
  term: 'Term 2',
  year: 2024,
  start_date: '2024-06-15T00:00:00.000Z',
  date_created: '2024-06-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'CAT',
  max_marks: 100,
};

const currentExam2025: Examination = {
  id: 'exam_2025',
  exam_name: 'Term 1 2025 Exam',
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
// TEST 1 & TEST 11: Live/Current filtering without examination
// -------------------------------------------------------------
const liveGrade7 = getFilteredStudents(allTestStudents, classes, 'Grade 7', 'all');
assert(
  liveGrade7.length === 1 && liveGrade7[0].id === 'stu_unpromoted',
  'Live filtering for Grade 7 without exam returns only unpromoted student currently in Grade 7'
);

const liveGrade8West = getFilteredStudents(allTestStudents, classes, 'cls_8w', 'cls_8w');
assert(
  liveGrade8West.length === 3 &&
    liveGrade8West.some((s) => s.id === 'stu_promoted_1') &&
    liveGrade8West.some((s) => s.id === 'stu_promoted_multi') &&
    liveGrade8West.some((s) => s.id === 'stu_ambiguous'),
  'Live filtering for Grade 8 West without exam returns 3 students currently in Grade 8 West'
);

// -------------------------------------------------------------
// TEST 2, 4, 5: Promoted learner (Grade 7 East -> Grade 8 West) in 2024 Grade 7 East exam
// -------------------------------------------------------------
const oldExamGrade7East = getFilteredStudents(allTestStudents, classes, 'cls_7e', 'cls_7e', oldExam2024);
assert(
  oldExamGrade7East.some((s) => s.id === 'stu_promoted_1'),
  'Promoted learner (now Grade 8 West) is INCLUDED when filtering old 2024 exam for Grade 7 East'
);
assert(
  oldExamGrade7East.some((s) => s.id === 'stu_unpromoted'),
  'Unpromoted Grade 7 East learner is INCLUDED when filtering old 2024 exam for Grade 7 East'
);
assert(
  oldExamGrade7East.some((s) => s.id === 'stu_promoted_multi'),
  'Multi-promoted learner (who was in Grade 7 East during 2024) is INCLUDED when filtering old 2024 exam for Grade 7 East'
);

// -------------------------------------------------------------
// TEST 6: Old Grade 7 West filter excludes Grade 7 East learners
// -------------------------------------------------------------
const oldExamGrade7West = getFilteredStudents(allTestStudents, classes, 'cls_7w', 'cls_7w', oldExam2024);
assert(
  !oldExamGrade7West.some((s) => s.id === 'stu_promoted_1'),
  'Promoted learner (who was Grade 7 East) is EXCLUDED when filtering old 2024 exam for Grade 7 West'
);

// -------------------------------------------------------------
// TEST 3: Promoted learner in current 2025 Grade 8 West exam
// -------------------------------------------------------------
const currentExamGrade8West = getFilteredStudents(allTestStudents, classes, 'cls_8w', 'cls_8w', currentExam2025);
assert(
  currentExamGrade8West.some((s) => s.id === 'stu_promoted_1'),
  'Promoted learner is INCLUDED when filtering 2025 exam for current class Grade 8 West'
);
assert(
  !currentExamGrade8West.some((s) => s.id === 'stu_unpromoted'),
  'Unpromoted Grade 7 learner is EXCLUDED when filtering 2025 exam for Grade 8 West'
);

// -------------------------------------------------------------
// TEST 7: Multiple promotions (Grade 6 Alpha in 2023)
// -------------------------------------------------------------
const exam2023Grade6Alpha = getFilteredStudents(allTestStudents, classes, 'cls_6a', 'cls_6a', oldExam2023);
assert(
  exam2023Grade6Alpha.length === 1 && exam2023Grade6Alpha[0].id === 'stu_promoted_multi',
  'Multi-promoted learner is INCLUDED when filtering 2023 exam for Grade 6 Alpha'
);

const exam2023Grade8West = getFilteredStudents(allTestStudents, classes, 'cls_8w', 'cls_8w', oldExam2023);
assert(
  !exam2023Grade8West.some((s) => s.id === 'stu_promoted_multi'),
  'Multi-promoted learner is NOT included under Grade 8 West when filtering 2023 exam'
);

// -------------------------------------------------------------
// TEST 8: All Classes filter with examination
// -------------------------------------------------------------
const allClasses2024 = getFilteredStudents(allTestStudents, classes, 'all', 'all', oldExam2024);
assert(
  allClasses2024.length === allTestStudents.length,
  'All Classes and All Streams filter returns all students regardless of exam'
);

// -------------------------------------------------------------
// TEST 9: All Streams within a selected historical class
// -------------------------------------------------------------
const grade7AllStreams2024 = getFilteredStudents(allTestStudents, classes, 'Grade 7', 'all', oldExam2024);
assert(
  grade7AllStreams2024.some((s) => s.id === 'stu_unpromoted') &&
    grade7AllStreams2024.some((s) => s.id === 'stu_promoted_1') &&
    grade7AllStreams2024.some((s) => s.id === 'stu_promoted_multi') &&
    grade7AllStreams2024.some((s) => s.id === 'stu_ambiguous'),
  'Grade 7 All Streams filter for 2024 exam includes all 4 learners who were in Grade 7 at that time'
);

// -------------------------------------------------------------
// TEST 10: Unresolved/ambiguous historical stream does not guess current stream
// -------------------------------------------------------------
const grade7East2024 = getFilteredStudents(allTestStudents, classes, 'cls_7e', 'East', oldExam2024);
assert(
  !grade7East2024.some((s) => s.id === 'stu_ambiguous'),
  'Unresolved/ambiguous stream learner is NOT falsely matched to Grade 7 East based on current stream'
);

console.log(`\nTEST RESULTS: ${passed}/${total} passed.`);
if (passed !== total) {
  process.exit(1);
}
