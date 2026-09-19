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

import { calculateSchoolAnalytics, compareExaminations } from './schoolAnalyticsEngine';
import { evaluateMark } from '../utils/markUtils';
import { Student, ClassStream, Examination, Subject, Grade, Mark } from '../types';

console.log('=== RUNNING PRIORITY 2E SCHOOL ANALYTICS HISTORICAL COHORT INTEGRATION TESTS ===\n');

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
  { id: 'sb_mat_up', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Upper Primary', category: 'Core' },
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_int', subject_code: 'INT', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_soc', subject_code: 'SOC', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_cre', subject_code: 'CRE', subject_name: 'CRE', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_pre', subject_code: 'PRE', subject_name: 'Pre-Technical', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_agr', subject_code: 'AGR', subject_name: 'Agriculture', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_phe', subject_code: 'PHE', subject_name: 'Physical Education', education_level: 'Junior School', category: 'Core' },
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

// Student 4: Unpromoted Grade 7 West learner
const std7West: Student = {
  id: 'stu_7w_unpromoted',
  admission_number: 'ADM104',
  full_name: 'Diana West',
  gender: 'F',
  class_id: 'cls_7w',
  stream_id: 'cls_7w',
  grade: 'Grade 7',
  active: true,
  promotion_history: [],
};

const allStudents = [stdUnpromoted, stdPromoted7Eto8W, stdMultiPromoted, std7West];

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

const allExams = [exam2023G6, exam2024G7, exam2025G8];

// Marks for 2024 Exam (Grade 7)
const marks2024: Mark[] = [
  // Alice (7E)
  { id: 'm1', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: 70 },
  { id: 'm2', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_eng', marks: 75 },
  // Bob (7E at exam time, now 8W)
  { id: 'm3', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_mat', marks: 90 },
  { id: 'm4', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_eng', marks: 85 },
  // Charlie (7E at exam time, now 8W)
  { id: 'm5', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_mat', marks: 60 },
  { id: 'm6', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_eng', marks: 65 },
  // Diana (7W)
  { id: 'm7', exam_id: 'exam_2024_g7', student_id: 'stu_7w_unpromoted', subject_id: 'sb_mat', marks: 80 },
  { id: 'm8', exam_id: 'exam_2024_g7', student_id: 'stu_7w_unpromoted', subject_id: 'sb_eng', marks: 82 },
];

// Marks for 2025 Exam (Grade 8)
const marks2025: Mark[] = [
  // Bob (8W)
  { id: 'm25_1', exam_id: 'exam_2025_g8', student_id: 'stu_7e_to_8w', subject_id: 'sb_mat', marks: 95 },
  { id: 'm25_2', exam_id: 'exam_2025_g8', student_id: 'stu_7e_to_8w', subject_id: 'sb_eng', marks: 88 },
  // Charlie (8W)
  { id: 'm25_3', exam_id: 'exam_2025_g8', student_id: 'stu_multi', subject_id: 'sb_mat', marks: 70 },
  { id: 'm25_4', exam_id: 'exam_2025_g8', student_id: 'stu_multi', subject_id: 'sb_eng', marks: 72 },
];

// Marks for 2023 Exam (Grade 6)
const marks2023: Mark[] = [
  // Charlie (6A at 2023)
  { id: 'm23_1', exam_id: 'exam_2023_g6', student_id: 'stu_multi', subject_id: 'sb_mat_up', marks: 88 },
];

const allMarks = [...marks2024, ...marks2025, ...marks2023];

// -------------------------------------------------------------
// RUN SCHOOL ANALYTICS FOR 2024 EXAM
// -------------------------------------------------------------
const analytics2024 = calculateSchoolAnalytics('exam_2024_g7', allExams, allStudents, classes, subjects, allMarks, grades, 'Junior School');

// 1. Promoted learner retained in historical class analytics
assert(
  analytics2024 !== null && analytics2024.total_students_assessed === 4,
  '1. All 4 learners active in Grade 7 during 2024 exam are assessed in 2024 analytics'
);

// 2. Historical stream retained after later stream change
const stream7East = analytics2024?.stream_rankings.find((s) => s.full_name === 'Grade 7 East');
assert(
  stream7East !== undefined && stream7East.learners_count === 3,
  '2. Grade 7 East stream count is 3 for 2024 exam (includes Bob who promoted to Grade 8 West later)'
);

// 3. Later examination resolves to the new class/stream
const analytics2025 = calculateSchoolAnalytics('exam_2025_g8', allExams, allStudents, classes, subjects, allMarks, grades, 'Junior School');
const stream8West2025 = analytics2025?.stream_rankings.find((s) => s.full_name === 'Grade 8 West');
assert(
  stream8West2025 !== undefined && stream8West2025.learners_count === 2,
  '3. Later 2025 exam correctly groups Bob and Charlie into Grade 8 West (count = 2)'
);

// 4. Multiple promotions
const analytics2023 = calculateSchoolAnalytics('exam_2023_g6', allExams, allStudents, classes, subjects, allMarks, grades, 'Upper Primary');
const class6Alpha2023 = analytics2023?.class_rankings.find((c) => c.class_name === 'Grade 6');
assert(
  class6Alpha2023 !== undefined && class6Alpha2023.learners_count === 1,
  '4. Multi-promoted learner Charlie correctly resolves to Grade 6 for 2023 exam'
);

// 5. Historical analytics for Junior School level
const analytics2024All = calculateSchoolAnalytics('exam_2024_g7', allExams, allStudents, classes, subjects, allMarks, grades, 'Junior School');
assert(
  analytics2024All !== null && analytics2024All.total_students_assessed === 4,
  '5. Junior School targetLevel includes all 4 historical Grade 7 learners for 2024 exam'
);

// 6. All Streams historical analytics
assert(
  analytics2024?.stream_rankings.length === 2,
  '6. All Streams in 2024 Junior School analytics returns 2 historical streams (Grade 7 East and Grade 7 West)'
);

// 7. Historical class rankings
const class7Rank = analytics2024?.class_rankings.find((c) => c.class_name === 'Grade 7');
assert(
  class7Rank !== undefined && class7Rank.learners_count === 4,
  '7. Grade 7 class ranking count is 4 for 2024 exam'
);

// 8. Historical stream rankings
const stream7West = analytics2024?.stream_rankings.find((s) => s.full_name === 'Grade 7 West');
assert(
  stream7West !== undefined && stream7West.learners_count === 1,
  '8. Grade 7 West stream count is 1 (Diana) for 2024 exam'
);

// 9. Historical subject analysis by class
const classSubjectAnalysisG7 = analytics2024?.class_subject_analysis.find((c) => c.class_name === 'Grade 7');
const matAnalysis = classSubjectAnalysisG7?.subjects.find((s) => s.subject_id === 'sb_mat');
assert(
  matAnalysis !== undefined && matAnalysis.candidates_count === 4,
  '9. Mathematics analysis for Grade 7 in 2024 exam counts 4 candidates'
);

// 10. Top performers display historical class and stream
const matTopPerformers = analytics2024?.best_subject_performers.find((s) => s.subject_id === 'sb_mat');
const bobTop = matTopPerformers?.top_learners.find((l) => l.student_id === 'stu_7e_to_8w');
assert(
  bobTop !== undefined && bobTop.class_name === 'Grade 7' && bobTop.stream === 'East',
  '10. Top subject performer Bob displays historical class "Grade 7" and stream "East" for 2024 exam'
);

// 11. Historical cohort counts are correct
assert(
  analytics2024?.total_classes_count === 1 && analytics2024?.total_streams_count === 2,
  '11. Historical 2024 analytics cohort counts (1 class, 2 streams) are correct'
);

// 12. X/Absent handling remains unchanged
const markX: Mark = { id: 'mx', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: null, special_status: 'X' };
const evalX = evaluateMark(markX);
assert(
  evalX.status === 'X',
  '12. X (Absent) mark evaluation logic remains status X'
);

// 13. Y/Irregularity handling remains unchanged
const markY: Mark = { id: 'my', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: null, special_status: 'Y' };
const evalY = evaluateMark(markY);
assert(
  evalY.status === 'Y',
  '13. Y (Irregularity) mark evaluation logic remains status Y'
);

// 14. Unpromoted learner compatibility
const aliceInStats = analytics2024?.best_learners_school.find((l) => l.student_id === 'stu_7e_unpromoted');
assert(
  aliceInStats !== undefined && aliceInStats.class_name === 'Grade 7' && aliceInStats.stream === 'East',
  '14. Unpromoted learner Alice is correctly included with class "Grade 7" and stream "East"'
);

// 15. Current/live analytics regression (no exam historical change when student is current)
const stdLiveOnly: Student = {
  id: 'stu_live_only',
  admission_number: 'ADM999',
  full_name: 'Eve Live',
  gender: 'F',
  class_id: 'cls_7e',
  stream_id: 'cls_7e',
  grade: 'Grade 7',
  active: true,
  promotion_history: [],
};
const marksLiveOnly: Mark[] = [
  { id: 'mlive_1', exam_id: 'exam_2024_g7', student_id: 'stu_live_only', subject_id: 'sb_mat', marks: 75 },
];
const analyticsLive = calculateSchoolAnalytics('exam_2024_g7', allExams, [...allStudents, stdLiveOnly], classes, subjects, [...allMarks, ...marksLiveOnly], grades, 'Junior School');
assert(
  analyticsLive?.total_students_assessed === 5,
  '15. Live unpromoted learner Eve is correctly included without regression'
);

// 16. compareExaminations() resolves Exam A independently from Exam B
const compData = compareExaminations('exam_2025_g8', 'exam_2024_g7', allExams, allStudents, classes, subjects, allMarks, grades, 'Junior School');
assert(
  compData !== null && compData.examA.id === 'exam_2025_g8' && compData.examB.id === 'exam_2024_g7',
  '16. compareExaminations() successfully returns comparison data for 2025 and 2024 exams'
);

// 17. A learner changing class between Exam A and Exam B appears in the correct cohort for each examination
const bobDev = compData?.learner_deviations.find((l) => l.id === 'stu_7e_to_8w');
assert(
  bobDev !== undefined && bobDev.name.includes('Grade 8 West'),
  '17. Learner deviation displays current Exam A class "Grade 8 West" for Bob'
);

console.log(`\n==================================================`);
console.log(`SCHOOL ANALYTICS HISTORICAL TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
