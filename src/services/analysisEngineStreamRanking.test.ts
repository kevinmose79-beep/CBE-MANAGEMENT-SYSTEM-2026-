import { calculateExamResults } from './analysisEngine';
import { api } from '../lib/storage';
import { Student, ClassStream, Examination, Mark, Grade, Subject } from '../types';

console.log('--- RUNNING STREAM RANKING ARCHITECTURE & HISTORICAL TESTS ---');

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

// 1. Setup Mock Grades
const grades: Grade[] = [
  { id: 'g_ee', grade_code: 'EE', performance_level: 'EE', minimum_score: 80, maximum_score: 100, points: 4, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
  { id: 'g_me', grade_code: 'ME', performance_level: 'ME', minimum_score: 60, maximum_score: 79, points: 3, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
  { id: 'g_ae', grade_code: 'AE', performance_level: 'AE', minimum_score: 40, maximum_score: 59, points: 2, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
  { id: 'g_be', grade_code: 'BE', performance_level: 'BE', minimum_score: 0, maximum_score: 39, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
];

// 2. Setup Mock Subjects
const subjects: Subject[] = [
  { id: 'sub_math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Upper Primary', status: 'Active' },
  { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Upper Primary', status: 'Active' },
];

// 3. Setup Database Classes & Streams
const classes: ClassStream[] = [
  { id: 'cls_grade5', stream_id: 'str_g5_alpha', class_name: 'Grade 5', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_grade5', stream_id: 'str_g5_beta', class_name: 'Grade 5', stream: 'Beta', education_level: 'Upper Primary' },
  { id: 'cls_grade6', stream_id: 'str_g6_alpha', class_name: 'Grade 6', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_grade6', stream_id: 'str_g6_beta', class_name: 'Grade 6', stream: 'Beta', education_level: 'Upper Primary' },
];

// 4. Setup Mock Examinations
const exam2025G5: Examination = {
  id: 'exam_2025_g5',
  exam_name: 'Grade 5 End Term 3 2025',
  academic_year_id: 'ay_2025',
  term: 'Term 3',
  year: 2025,
  start_date: '2025-11-15T00:00:00.000Z',
  date_created: '2025-11-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

const exam2026G5: Examination = {
  id: 'exam_2026_g5',
  exam_name: 'Grade 5 End Term 1 2026',
  academic_year_id: 'ay_2026',
  term: 'Term 1',
  year: 2026,
  start_date: '2026-03-15T00:00:00.000Z',
  date_created: '2026-03-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

// Mock storage api
api.getExaminations = () => [exam2025G5, exam2026G5];
api.getSubjects = () => subjects;
api.getTeachers = () => [];

// 5. Setup Learners with Historical Promotion
// Learner Promoted: In 2025 was in Grade 5 Alpha (str_g5_alpha). In 2026 promoted to Grade 6 Beta (str_g6_beta).
const studentPromoted: Student = {
  id: 'stu_promoted',
  admission_number: 'ADM_PROM',
  full_name: 'Promoted Learner',
  gender: 'F',
  class_id: 'cls_grade6',
  stream_id: 'str_g6_beta',
  grade: 'Grade 6',
  active: true,
  promotion_history: [
    {
      id: 'prom_1',
      student_id: 'stu_promoted',
      from_class_id: 'str_g5_alpha',
      to_class_id: 'str_g6_beta',
      from_grade: 'Grade 5',
      to_grade: 'Grade 6',
      academic_year_id: 'ay_2025',
      date_promoted: '2026-01-05T00:00:00.000Z',
    },
  ],
};

// Learner Stayed: Always in Grade 5 Alpha
const studentStayedG5Alpha: Student = {
  id: 'stu_stayed_g5a',
  admission_number: 'ADM_STAY',
  full_name: 'G5 Alpha Learner',
  gender: 'M',
  class_id: 'cls_grade5',
  stream_id: 'str_g5_alpha',
  grade: 'Grade 5',
  active: true,
};

// Learner Stayed: Always in Grade 5 Beta
const studentStayedG5Beta: Student = {
  id: 'stu_stayed_g5b',
  admission_number: 'ADM_BETA',
  full_name: 'G5 Beta Learner',
  gender: 'M',
  class_id: 'cls_grade5',
  stream_id: 'str_g5_beta',
  grade: 'Grade 5',
  active: true,
};

const historicalCohort = [studentPromoted, studentStayedG5Alpha, studentStayedG5Beta];

const historicalMarks: Mark[] = [
  // 2025 Exam: Promoted Learner (in G5 Alpha at that time) got 80 + 80 = 160
  { id: 'hm_p1', student_id: 'stu_promoted', subject_id: 'sub_math', exam_id: 'exam_2025_g5', marks: 80, raw_score: 80, out_of: 100 },
  { id: 'hm_p2', student_id: 'stu_promoted', subject_id: 'sub_eng', exam_id: 'exam_2025_g5', marks: 80, raw_score: 80, out_of: 100 },

  // 2025 Exam: G5 Beta Learner got 75 + 75 = 150
  { id: 'hm_b1', student_id: 'stu_stayed_g5b', subject_id: 'sub_math', exam_id: 'exam_2025_g5', marks: 75, raw_score: 75, out_of: 100 },
  { id: 'hm_b2', student_id: 'stu_stayed_g5b', subject_id: 'sub_eng', exam_id: 'exam_2025_g5', marks: 75, raw_score: 75, out_of: 100 },

  // 2025 Exam: G5 Alpha Learner got 70 + 70 = 140
  { id: 'hm_a1', student_id: 'stu_stayed_g5a', subject_id: 'sub_math', exam_id: 'exam_2025_g5', marks: 70, raw_score: 70, out_of: 100 },
  { id: 'hm_a2', student_id: 'stu_stayed_g5a', subject_id: 'sub_eng', exam_id: 'exam_2025_g5', marks: 70, raw_score: 70, out_of: 100 },
];

// Calculate 2025 Exam Results
const res2025 = calculateExamResults(exam2025G5.id, historicalCohort, historicalMarks, grades, classes, subjects);

const rProm = res2025.find((r) => r.student_id === 'stu_promoted');
const rG5B = res2025.find((r) => r.student_id === 'stu_stayed_g5b');
const rG5A = res2025.find((r) => r.student_id === 'stu_stayed_g5a');

// Overall Ranks in Grade 5 2025
assert(rProm?.position === 1, `Promoted learner is Overall Rank 1 in Grade 5 2025 (160 marks, got ${rProm?.position})`);
assert(rG5B?.position === 2, `G5 Beta learner is Overall Rank 2 in Grade 5 2025 (150 marks, got ${rG5B?.position})`);
assert(rG5A?.position === 3, `G5 Alpha learner is Overall Rank 3 in Grade 5 2025 (140 marks, got ${rG5A?.position})`);

// Stream Ranks in 2025 (Promoted learner was in Alpha in 2025!)
assert(rProm?.class_position === 1, `Promoted learner has Stream Alpha Rank 1 in 2025 (got ${rProm?.class_position})`);
assert(rG5A?.class_position === 2, `G5 Alpha learner has Stream Alpha Rank 2 in 2025 (got ${rG5A?.class_position})`);
assert(rG5B?.class_position === 1, `G5 Beta learner has Stream Beta Rank 1 in 2025 (got ${rG5B?.class_position})`);

// 6. Multi-stream 2026 Test (Adversarial Data)
// Stream Alpha: A = 140, B = 130
// Stream Beta: C = 150, D = 120
const studentA: Student = { id: 'stu_a', admission_number: 'A', full_name: 'A', gender: 'M', class_id: 'cls_grade5', stream_id: 'str_g5_alpha', grade: 'Grade 5', active: true };
const studentB: Student = { id: 'stu_b', admission_number: 'B', full_name: 'B', gender: 'F', class_id: 'cls_grade5', stream_id: 'str_g5_alpha', grade: 'Grade 5', active: true };
const studentC: Student = { id: 'stu_c', admission_number: 'C', full_name: 'C', gender: 'M', class_id: 'cls_grade5', stream_id: 'str_g5_beta', grade: 'Grade 5', active: true };
const studentD: Student = { id: 'stu_d', admission_number: 'D', full_name: 'D', gender: 'F', class_id: 'cls_grade5', stream_id: 'str_g5_beta', grade: 'Grade 5', active: true };

const multiMarks: Mark[] = [
  { id: 'm1', student_id: 'stu_a', subject_id: 'sub_math', exam_id: 'exam_2026_g5', marks: 70, raw_score: 70, out_of: 100 },
  { id: 'm2', student_id: 'stu_a', subject_id: 'sub_eng', exam_id: 'exam_2026_g5', marks: 70, raw_score: 70, out_of: 100 },

  { id: 'm3', student_id: 'stu_b', subject_id: 'sub_math', exam_id: 'exam_2026_g5', marks: 65, raw_score: 65, out_of: 100 },
  { id: 'm4', student_id: 'stu_b', subject_id: 'sub_eng', exam_id: 'exam_2026_g5', marks: 65, raw_score: 65, out_of: 100 },

  { id: 'm5', student_id: 'stu_c', subject_id: 'sub_math', exam_id: 'exam_2026_g5', marks: 75, raw_score: 75, out_of: 100 },
  { id: 'm6', student_id: 'stu_c', subject_id: 'sub_eng', exam_id: 'exam_2026_g5', marks: 75, raw_score: 75, out_of: 100 },

  { id: 'm7', student_id: 'stu_d', subject_id: 'sub_math', exam_id: 'exam_2026_g5', marks: 60, raw_score: 60, out_of: 100 },
  { id: 'm8', student_id: 'stu_d', subject_id: 'sub_eng', exam_id: 'exam_2026_g5', marks: 60, raw_score: 60, out_of: 100 },
];

const resMulti = calculateExamResults('exam_2026_g5', [studentA, studentB, studentC, studentD], multiMarks, grades, classes, subjects);

const ma = resMulti.find((r) => r.student_id === 'stu_a');
const mb = resMulti.find((r) => r.student_id === 'stu_b');
const mc = resMulti.find((r) => r.student_id === 'stu_c');
const md = resMulti.find((r) => r.student_id === 'stu_d');

assert(mc?.position === 1, 'Learner C: OVR POS 1');
assert(ma?.position === 2, 'Learner A: OVR POS 2');
assert(mb?.position === 3, 'Learner B: OVR POS 3');
assert(md?.position === 4, 'Learner D: OVR POS 4');

assert(ma?.class_position === 1, 'Learner A: STR POS 1 (in Alpha)');
assert(mb?.class_position === 2, 'Learner B: STR POS 2 (in Alpha)');
assert(mc?.class_position === 1, 'Learner C: STR POS 1 (in Beta)');
assert(md?.class_position === 2, 'Learner D: STR POS 2 (in Beta)');

console.log(`\nALL TESTS: ${passed}/${total} passed.`);
if (passed !== total) {
  process.exit(1);
}
