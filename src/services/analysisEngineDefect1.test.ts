if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import '../testSetup';
import { generateExamAnalysisSummary, calculateExamResults } from './analysisEngine';
import { Student, ClassStream, Subject, Grade, Mark } from '../types';

console.log('=== RUNNING DEFECT 1 EXAM ANALYSIS SUMMARY SPECIAL MARK TESTS ===\n');

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

// Fixtures
const students: Student[] = [
  { id: 's1', full_name: 'Alice Normal', admission_number: 'ADM001', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
  { id: 's2', full_name: 'Bob Zero', admission_number: 'ADM002', class_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true },
  { id: 's3', full_name: 'Charlie Absent', admission_number: 'ADM003', class_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true },
  { id: 's4', full_name: 'Diana Irregular', admission_number: 'ADM004', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
  { id: 's5', full_name: 'Eve Blank', admission_number: 'ADM005', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
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

// Marks containing:
// 1. Genuine positive numerical mark: 80% (Alice)
// 2. Genuine numerical 0: 0% (Bob)
// 3. X - Absent: special_status 'X', marks 0 (Charlie)
// 4. Y - Irregularity: special_status 'Y', marks 0 (Diana)
// 5. Blank/unentered: (Eve has no mark record)
const marks: Mark[] = [
  { id: 'm1', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 's2', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 's3', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: null, out_of: 100, special_status: 'X' },
  { id: 'm4', student_id: 's4', exam_id: 'ex1', subject_id: 'sb_mat', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' },
];

const summary = generateExamAnalysisSummary(
  'ex1',
  'Mid-Term Exam',
  students,
  subjects,
  marks,
  grades
);

const matSummary = summary.subject_summaries.find((s) => s.subject_id === 'sb_mat');

// 1. Subject mean calculation checks
// Evaluated assessed candidates should be ONLY Alice (80) and Bob (0).
// Sum = 80 + 0 = 80.
// Count = 2.
// Mean score = 80 / 2 = 40.0.
assert(matSummary !== undefined, 'Mathematics subject summary generated');
assert(matSummary?.mean_score === 40, `Subject mean score is 40.0 (got ${matSummary?.mean_score}) - X and Y excluded from denominator`);

// 2. Subject mean points checks
// Points: Alice (80% => EE => 4 points), Bob (0% => BE2 => 1 point).
// Total points = 5. Count = 2. Mean points = 5 / 2 = 2.5.
assert(matSummary?.mean_points === 2.5, `Subject mean points is 2.5 (got ${matSummary?.mean_points}) - X/Y did not contribute BE2 points`);

// 3. Highest and Lowest
assert(matSummary?.highest === 80, `Highest score is 80 (got ${matSummary?.highest})`);
assert(matSummary?.lowest === 0, `Lowest score is 0 (got ${matSummary?.lowest}) - Genuine 0 is retained as lowest score`);

// 4. Pass rate check
// Candidates >= 41%: Alice (80 >= 41) = 1 pass.
// Total assessed candidates = 2.
// Pass rate = (1 / 2) * 100 = 50%.
assert(matSummary?.pass_rate === 50, `Pass rate is 50% (got ${matSummary?.pass_rate}) - X and Y excluded from pass rate denominator`);

// 5. Learner-level ranking check
// Verify calculateExamResults produces correct ranking without regression
const results = calculateExamResults('ex1', students, marks, grades, classes, subjects);
assert(results.length === 5, '5 learner results generated');
const aliceRes = results.find((r) => r.student_id === 's1');
const bobRes = results.find((r) => r.student_id === 's2');
const charlieRes = results.find((r) => r.student_id === 's3');
const dianaRes = results.find((r) => r.student_id === 's4');

assert(aliceRes?.position === 1, 'Alice with 80% ranks #1');
assert(bobRes?.position === 2, 'Bob with genuine 0% ranks #2');
assert(charlieRes?.is_complete === false, 'Charlie (X) is marked incomplete/provisional');
assert(dianaRes?.is_complete === false, 'Diana (Y) is marked incomplete/provisional');

console.log(`\n==================================================`);
console.log(`DEFECT 1 TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
