import { Examination, ExamType, Student, Subject, Grade, ClassStream, Mark } from '../types';
import { formatStandardExamCode } from '../utils/filterUtils';
import { buildLearnerTrajectory, extractTermSequence, deriveMilestoneShortLabel } from '../services/learnerTrajectoryEngine';
import { getDisplayExamName, getDisplayExamType, getDisplayMilestoneLabel } from '../utils/examDisplayUtils';

console.log('=== RUNNING CAT TERMINOLOGY CLEANUP & DISAMBIGUATION TESTS ===\n');

let total = 0;
let passed = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    console.error(`✗ FAIL: ${message}`);
  }
}

// 1. FILTER UTILS / EXAM CODE GENERATION TESTS
console.log('--- 1. EXAM CODE GENERATION TESTS ---');

const openerExam: Examination = {
  id: 'ex_opn',
  exam_name: 'Opener Assessment - Term 1 2026',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'Custom',
  max_marks: 100,
};
assert(
  formatStandardExamCode('Grade 7', openerExam) === 'G7-T1-2026-OPN',
  `Opener assessment produces G7-T1-2026-OPN (got: ${formatStandardExamCode('Grade 7', openerExam)})`
);

const midTermExam: Examination = {
  id: 'ex_mt',
  exam_name: 'Mid-Term Assessment - Term 2 2026',
  term: 'Term 2',
  year: 2026,
  status: 'Draft',
  exam_type: 'Mid-Term',
  max_marks: 100,
};
assert(
  formatStandardExamCode('Grade 8', midTermExam) === 'G8-T2-2026-MT2',
  `Mid-Term assessment produces G8-T2-2026-MT2 (got: ${formatStandardExamCode('Grade 8', midTermExam)})`
);

const endTermExam: Examination = {
  id: 'ex_et',
  exam_name: 'End-Term Examination - Term 3 2026',
  term: 'Term 3',
  year: 2026,
  status: 'Draft',
  exam_type: 'End-Term',
  max_marks: 100,
};
assert(
  formatStandardExamCode('Grade 9', endTermExam) === 'G9-T3-2026-ET3',
  `End-Term examination produces G9-T3-2026-ET3 (got: ${formatStandardExamCode('Grade 9', endTermExam)})`
);

const historicalCatExam: Examination = {
  id: 'ex_cat',
  exam_name: 'CAT 1 - Term 1 2026',
  term: 'Term 1',
  year: 2026,
  status: 'Approved',
  exam_type: 'CAT',
  max_marks: 100,
};
assert(
  formatStandardExamCode('Grade 7', historicalCatExam) === 'G7-T1-2026-CAT1',
  `Historical CAT examination preserves G7-T1-2026-CAT1 for backward compatibility (got: ${formatStandardExamCode('Grade 7', historicalCatExam)})`
);

const customSpecialExam: Examination = {
  id: 'ex_custom',
  exam_name: 'Special Evaluation Assessment',
  term: 'Term 2',
  year: 2026,
  status: 'Draft',
  exam_type: 'Custom',
  max_marks: 100,
};
const customCode = formatStandardExamCode('Grade 7', customSpecialExam);
assert(
  !customCode.includes('CAT') && (customCode.includes('SEA') || customCode.includes('ASM2')),
  `Custom assessment does not force CAT prefix (got: ${customCode})`
);

// 2. PERFORMANCE PROGRESSION MILESTONE LABEL DISAMBIGUATION
console.log('\n--- 2. PERFORMANCE PROGRESSION MILESTONE LABEL TESTS ---');

const student: Student = {
  id: 'std_01',
  admission_number: 'ADM-101',
  full_name: 'Sarah Mwangi',
  gender: 'F',
  class_id: 'cls_8e',
  stream_id: 'cls_8e',
  active: true,
  education_level: 'Junior School',
  grade: 'Grade 8',
};

const classes: ClassStream[] = [
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
];

const subjects: Subject[] = [
  { id: 'sb_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
];

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE1', minimum_score: 90, maximum_score: 100, points: 4, performance_level: 'EE', remarks: 'Exceeding', descriptor: 'Exceeding Expectations' },
  { id: 'g3', grade_code: 'ME1', minimum_score: 70, maximum_score: 79, points: 3, performance_level: 'ME', remarks: 'Meeting', descriptor: 'Meeting Expectations' },
  { id: 'g5', grade_code: 'AE1', minimum_score: 50, maximum_score: 59, points: 2, performance_level: 'AE', remarks: 'Approaching', descriptor: 'Approaching Expectations' },
  { id: 'g7', grade_code: 'BE1', minimum_score: 20, maximum_score: 39, points: 1, performance_level: 'BE', remarks: 'Below', descriptor: 'Below Expectations' },
];

// Three separate assessments in the EXACT same term (2026 Term 2)
const sameTermExams: Examination[] = [
  {
    id: 'ex_t2_opn',
    exam_name: 'Opener Assessment - Term 2 2026',
    year: 2026,
    term: 'Term 2',
    status: 'Approved',
    exam_type: 'Custom',
    max_marks: 100,
    start_date: '2026-05-05',
  },
  {
    id: 'ex_t2_mid',
    exam_name: 'Mid-Term Assessment - Term 2 2026',
    year: 2026,
    term: 'Term 2',
    status: 'Approved',
    exam_type: 'Mid-Term',
    max_marks: 100,
    start_date: '2026-06-15',
  },
  {
    id: 'ex_t2_end',
    exam_name: 'End-Term Assessment - Term 2 2026',
    year: 2026,
    term: 'Term 2',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
    start_date: '2026-07-25',
  },
];

const marks: Mark[] = [
  { id: 'm1', student_id: 'std_01', exam_id: 'ex_t2_opn', subject_id: 'sb_mat', marks: 72, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'std_01', exam_id: 'ex_t2_opn', subject_id: 'sb_eng', marks: 68, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 'std_01', exam_id: 'ex_t2_mid', subject_id: 'sb_mat', marks: 78, out_of: 100, special_status: 'Normal' },
  { id: 'm4', student_id: 'std_01', exam_id: 'ex_t2_mid', subject_id: 'sb_eng', marks: 74, out_of: 100, special_status: 'Normal' },
  { id: 'm5', student_id: 'std_01', exam_id: 'ex_t2_end', subject_id: 'sb_mat', marks: 85, out_of: 100, special_status: 'Normal' },
  { id: 'm6', student_id: 'std_01', exam_id: 'ex_t2_end', subject_id: 'sb_eng', marks: 81, out_of: 100, special_status: 'Normal' },
];

const trajectory = buildLearnerTrajectory(
  student,
  sameTermExams,
  marks,
  subjects,
  grades,
  classes
);

assert(trajectory.usable_milestones.length === 3, 'All 3 same-term milestones derived');

const labels = trajectory.usable_milestones.map((m) => m.display_label);
console.log('Generated Milestone Display Labels:', labels);

assert(
  labels[0] !== labels[1] && labels[1] !== labels[2] && labels[0] !== labels[2],
  `Milestones in same term are NOT identical (got: ${JSON.stringify(labels)})`
);
assert(
  labels[0].includes('Opener') && labels[1].includes('Mid-Term') && labels[2].includes('End-Term'),
  'Milestone labels clearly identify Opener, Mid-Term, and End-Term assessments'
);

// 3. HISTORICAL CAT COMPATIBILITY IN TRAJECTORY
console.log('\n--- 3. HISTORICAL CAT COMPATIBILITY IN TRAJECTORY ---');

const mixedExams: Examination[] = [
  historicalCatExam,
  midTermExam,
];

const mixedMarks: Mark[] = [
  { id: 'mm1', student_id: 'std_01', exam_id: 'ex_cat', subject_id: 'sb_mat', marks: 70, out_of: 100, special_status: 'Normal' },
  { id: 'mm2', student_id: 'std_01', exam_id: 'ex_mt', subject_id: 'sb_mat', marks: 75, out_of: 100, special_status: 'Normal' },
];

const mixedTrajectory = buildLearnerTrajectory(
  student,
  mixedExams,
  mixedMarks,
  subjects,
  grades,
  classes
);

assert(mixedTrajectory.usable_milestones.length === 2, 'Historical CAT and modern Mid-Term milestones both loaded');
assert(
  mixedTrajectory.usable_milestones[0].display_label.includes('Assessment 1') &&
    !mixedTrajectory.usable_milestones[0].display_label.includes('CAT'),
  `Historical CAT milestone displays normalized Assessment 1 label without user-facing CAT (got: ${mixedTrajectory.usable_milestones[0].display_label})`
);
assert(
  historicalCatExam.exam_type === 'CAT',
  'Historical underlying exam_type = "CAT" preserved without mutation'
);
assert(
  historicalCatExam.exam_name === 'CAT 1 - Term 1 2026',
  'Historical underlying exam_name = "CAT 1 - Term 1 2026" preserved without mutation'
);
assert(
  getDisplayExamName(historicalCatExam.exam_name) === 'Assessment 1 - Term 1 2026',
  'getDisplayExamName correctly normalizes historical CAT name'
);
assert(
  getDisplayExamType(historicalCatExam.exam_type) === 'Assessment',
  'getDisplayExamType correctly normalizes historical CAT type'
);

// 4. TYPE SYSTEM COMPATIBILITY TEST
console.log('\n--- 4. TYPE SYSTEM & VALUE COMPATIBILITY ---');

const allowedTypes: ExamType[] = ['CAT', 'Mid-Term', 'End-Term', 'Custom'];
assert(allowedTypes.includes('CAT'), 'ExamType union retains CAT for backward compatibility');
assert(allowedTypes.includes('Mid-Term'), 'ExamType union supports Mid-Term');
assert(allowedTypes.includes('End-Term'), 'ExamType union supports End-Term');
assert(allowedTypes.includes('Custom'), 'ExamType union supports Custom');

console.log(`\n==================================================`);
console.log(`TOTAL TESTS: ${total}, PASSED: ${passed}, FAILED: ${total - passed}`);
console.log(`==================================================\n`);

if (total !== passed) {
  process.exit(1);
}
