import { calculateSchoolAnalytics } from './schoolAnalyticsEngine';
import { Examination, Student, ClassStream, Subject, Mark, Grade } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

const exam: Examination = {
  id: 'ex1',
  exam_name: 'End Term 1 2026',
  term: 'Term 1',
  year: 2026,
  exam_type: 'End-Term',
  status: 'Published',
  max_marks: 100,
};

// Students in two different education levels: Lower Primary (Grade 2) and Junior School (Grade 7)
const students: Student[] = [
  { id: 's_lp1', admission_number: 'ADM001', full_name: 'LP Student 1', class_id: 'c_g2', gender: 'M', active: true },
  { id: 's_js1', admission_number: 'ADM002', full_name: 'JS Student 1', class_id: 'c_g7', gender: 'F', active: true },
];

const classes: ClassStream[] = [
  { id: 'c_g2', class_name: 'Grade 2', stream: 'East' },
  { id: 'c_g7', class_name: 'Grade 7', stream: 'East' },
];

const subjects: Subject[] = [
  { id: 'sb_lp_math', subject_name: 'Mathematics Activities', subject_code: 'MAT_LP', category: 'Core', applicable_grades: ['Grade 2'] },
  { id: 'sb_lp_eng', subject_name: 'English Language', subject_code: 'ENG_LP', category: 'Core', applicable_grades: ['Grade 2'] },
  { id: 'sb_js_math', subject_name: 'Mathematics', subject_code: 'MAT_JS', category: 'Core', applicable_grades: ['Grade 7'] },
  { id: 'sb_js_kisw', subject_name: 'Kiswahili', subject_code: 'KISW_JS', category: 'Core', applicable_grades: ['Grade 7'] },
];

const marks: Mark[] = [
  // Lower Primary student
  { id: 'm1', student_id: 's_lp1', exam_id: 'ex1', subject_id: 'sb_lp_math', marks: 80, raw_score: 80, out_of: 100 },
  { id: 'm2', student_id: 's_lp1', exam_id: 'ex1', subject_id: 'sb_lp_eng', marks: 90, raw_score: 90, out_of: 100 },
  // Junior School student
  { id: 'm3', student_id: 's_js1', exam_id: 'ex1', subject_id: 'sb_js_math', marks: 70, raw_score: 70, out_of: 100 },
  { id: 'm4', student_id: 's_js1', exam_id: 'ex1', subject_id: 'sb_js_kisw', marks: 85, raw_score: 85, out_of: 100 },
];

const grades: Grade[] = [
  { id: 'g1', minimum_score: 80, maximum_score: 100, grade_code: 'EE', points: 4, performance_level: 'EE', remarks: 'Exceeding', descriptor: 'Exceeding' },
  { id: 'g2', minimum_score: 65, maximum_score: 79, grade_code: 'ME', points: 3, performance_level: 'ME', remarks: 'Meeting', descriptor: 'Meeting' },
  { id: 'g3', minimum_score: 50, maximum_score: 64, grade_code: 'AE', points: 2, performance_level: 'AE', remarks: 'Approaching', descriptor: 'Approaching' },
  { id: 'g4', minimum_score: 0, maximum_score: 49, grade_code: 'BE', points: 1, performance_level: 'BE', remarks: 'Below', descriptor: 'Below' },
];

console.log(`\n=== RUNNING SUBJECT RANKING EDU LEVEL TEST ===`);

const lpAnalytics = calculateSchoolAnalytics('ex1', [exam], students, classes, subjects, marks, grades, 'Lower Primary');
const jsAnalytics = calculateSchoolAnalytics('ex1', [exam], students, classes, subjects, marks, grades, 'Junior School');

const lpRankings = lpAnalytics.subject_rankings;
const jsRankings = jsAnalytics.subject_rankings;

assert(lpRankings.length === 2, `Lower Primary subject rankings count is 2 (got ${lpRankings.length})`);
assert(jsRankings.length === 2, `Junior School subject rankings count is 2 (got ${jsRankings.length})`);

// Rank 1 for Lower Primary should be English (90%)
assert(lpRankings[0].subject_id === 'sb_lp_eng', `Lower Primary #1 subject is English (got ${lpRankings[0].subject_name})`);
assert(lpRankings[0].rank === 1, `Lower Primary #1 rank is 1 (got ${lpRankings[0].rank})`);
assert(lpRankings[1].rank === 2, `Lower Primary #2 rank is 2 (got ${lpRankings[1].rank})`);

// Rank 1 for Junior School should be Kiswahili (85%)
assert(jsRankings[0].subject_id === 'sb_js_kisw', `Junior School #1 subject is Kiswahili (got ${jsRankings[0].subject_name})`);
assert(jsRankings[0].rank === 1, `Junior School #1 rank is 1 (got ${jsRankings[0].rank})`);
assert(jsRankings[1].rank === 2, `Junior School #2 rank is 2 (got ${jsRankings[1].rank})`);

console.log(`\n==================================================`);
console.log(`ALL SUBJECT RANKING EDU LEVEL TESTS PASSED!`);
console.log(`==================================================\n`);
