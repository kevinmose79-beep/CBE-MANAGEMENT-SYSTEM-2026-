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

import { calculateSchoolAnalytics } from './schoolAnalyticsEngine';
import { Student, ClassStream, Subject, Grade, Mark, Examination } from '../types';
import { evaluateMark } from '../utils/markUtils';

console.log('=== RUNNING DEFECT 2 SCHOOL ANALYTICS ENGINE SPECIAL MARK TESTS ===\n');

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

// 1. Explicit semantic check for Normal 0 vs X vs Y
const normZeroEval = evaluateMark({ id: 'm_test1', student_id: 's2', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' });
const xEval = evaluateMark({ id: 'm_test2', student_id: 's3', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: null, out_of: 100, special_status: 'X' });
const yEval = evaluateMark({ id: 'm_test3', student_id: 's4', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' });

assert(normZeroEval.status === 'Normal' && normZeroEval.percentage === 0, 'Normal 0 evaluates to status Normal with percentage 0 (assessed)');
assert(xEval.status === 'X' && xEval.percentage === null, 'X evaluates to status X with percentage null (not assessed)');
assert(yEval.status === 'Y' && yEval.percentage === null, 'Y evaluates to status Y with percentage null (not assessed)');

// Fixtures
const students: Student[] = [
  { id: 's1', full_name: 'Learner A (Normal 80)', admission_number: 'ADM001', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
  { id: 's2', full_name: 'Learner B (Normal 0)', admission_number: 'ADM002', class_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true },
  { id: 's3', full_name: 'Learner C (X - Absent)', admission_number: 'ADM003', class_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true },
  { id: 's4', full_name: 'Learner D (Y - Irregularity)', admission_number: 'ADM004', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
  { id: 's5', full_name: 'Learner E (Blank)', admission_number: 'ADM005', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
];

const classes: ClassStream[] = [
  { id: 'cls_7a', class_name: 'Grade 7', stream: 'Alpha', education_level: 'Junior School' },
];

const subjects: Subject[] = [
  { id: 'sb_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
];

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE', minimum_score: 80, maximum_score: 100, points: 4, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
  { id: 'g2', grade_code: 'ME', minimum_score: 65, maximum_score: 79, points: 3, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
  { id: 'g3', grade_code: 'AE', minimum_score: 50, maximum_score: 64, points: 2, performance_level: 'AE', remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
  { id: 'g4', grade_code: 'BE1', minimum_score: 30, maximum_score: 49, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  { id: 'g5', grade_code: 'BE2', minimum_score: 0, maximum_score: 29, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
];

const exam: Examination = {
  id: 'ex1',
  exam_name: 'Term 1 Exam',
  term: 'Term 1',
  year: 2025,
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

const marks: Mark[] = [
  { id: 'm1', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 's2', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 's3', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: null, out_of: 100, special_status: 'X' },
  { id: 'm4', student_id: 's4', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' },
];

const analytics = calculateSchoolAnalytics(
  'ex1',
  [exam],
  students,
  classes,
  subjects,
  marks,
  grades,
  'Junior School'
);

// 1. AREA 1: Subject Performance Rankings
const matRanking = analytics.subject_rankings.find((s) => s.subject_id === 'sb_mat');
assert(matRanking !== undefined, 'Mathematics ranking entry present');
assert(matRanking?.total_candidates === 2, `Subject candidate count is 2 (got ${matRanking?.total_candidates}) - includes only A (80) and B (0)`);
assert(matRanking?.mean_marks === 40, `Subject mean score is 40.0 (got ${matRanking?.mean_marks}) - (80 + 0) / 2`);
assert(matRanking?.mean_points === 2.5, `Subject mean points is 2.5 (got ${matRanking?.mean_points}) - (4 + 1) / 2, X and Y give no points`);

// 2. AREA 2: Class Subject Analysis
const grade7ClassAnalysis = analytics.class_subject_analysis.find((c) => c.class_name === 'Grade 7');
const matClassSubj = grade7ClassAnalysis?.subjects.find((s) => s.subject_id === 'sb_mat');
assert(matClassSubj !== undefined, 'Class subject analysis entry present for Grade 7 Mathematics');
assert(matClassSubj?.candidates_count === 2, `Class subject candidates count is 2 (got ${matClassSubj?.candidates_count})`);
assert(matClassSubj?.mean_marks === 40, `Class subject mean marks is 40.0 (got ${matClassSubj?.mean_marks})`);
assert(matClassSubj?.mean_points === 2.5, `Class subject mean points is 2.5 (got ${matClassSubj?.mean_points})`);

// 3. AREA 3: Best Subject Performers
const matBestPerformers = analytics.best_subject_performers.find((s) => s.subject_id === 'sb_mat');
assert(matBestPerformers !== undefined, 'Best subject performers entry present for Mathematics');
assert(matBestPerformers?.top_learners.length === 2, `Top performers length is 2 (got ${matBestPerformers?.top_learners.length})`);
assert(matBestPerformers?.top_learners[0].student_id === 's1', 'Top performer #1 is Learner A (80%)');
assert(matBestPerformers?.top_learners[1].student_id === 's2', 'Top performer #2 is Learner B (0%)');
const xInTop = matBestPerformers?.top_learners.some((l) => l.student_id === 's3');
const yInTop = matBestPerformers?.top_learners.some((l) => l.student_id === 's4');
assert(!xInTop && !yInTop, 'X and Y learners do NOT appear as top subject performers');

console.log(`\n==================================================`);
console.log(`DEFECT 2 TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
