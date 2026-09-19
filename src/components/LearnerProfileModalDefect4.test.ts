if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { Student, Mark, Examination, Subject, Grade, ClassStream } from '../types';
import { getGradeForMark } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { stripSurroundingQuotes } from '../utils/filterUtils';

console.log('=== RUNNING DEFECT 4 LEARNER PROFILE MODAL SPECIAL MARK TESTS ===\n');

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

// 1. Explicit semantic check for evaluateMark
const normEightyEval = evaluateMark({ id: 'm1', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' });
const normZeroEval = evaluateMark({ id: 'm2', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_eng', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' });
const xEval = evaluateMark({ id: 'm3', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_sci', marks: 0, raw_score: null, out_of: 100, special_status: 'X' });
const yEval = evaluateMark({ id: 'm4', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_kis', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' });
const blankEval = evaluateMark(null);

assert(normEightyEval.status === 'Normal' && normEightyEval.percentage === 80, 'Normal 80 evaluates to Normal with 80%');
assert(normZeroEval.status === 'Normal' && normZeroEval.percentage === 0, 'Normal 0 evaluates to Normal with 0%');
assert(xEval.status === 'X' && xEval.percentage === null, 'X evaluates to status X with null percentage');
assert(yEval.status === 'Y' && yEval.percentage === null, 'Y evaluates to status Y with null percentage');
assert(blankEval.status === 'Blank' && blankEval.percentage === null, 'Blank evaluates to status Blank with null percentage');

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE', minimum_score: 80, maximum_score: 100, points: 4, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
  { id: 'g2', grade_code: 'ME', minimum_score: 65, maximum_score: 79, points: 3, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
  { id: 'g3', grade_code: 'AE', minimum_score: 50, maximum_score: 64, points: 2, performance_level: 'AE', remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
  { id: 'g4', grade_code: 'BE1', minimum_score: 30, maximum_score: 49, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  { id: 'g5', grade_code: 'BE2', minimum_score: 0, maximum_score: 29, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
];

const student: Student = {
  id: 's1',
  full_name: 'Test Student',
  admission_number: 'ADM001',
  class_id: 'cls_7a',
  grade: 'Grade 7',
  gender: 'M',
  active: true,
};

const subjects: Subject[] = [
  { id: 'sb_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_sci', subject_code: 'SCI', subject_name: 'Science', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
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

const studentMarks: Mark[] = [
  { id: 'm1', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_eng', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_sci', marks: 0, raw_score: null, out_of: 100, special_status: 'X' },
  { id: 'm4', student_id: 's1', exam_id: 'ex1', subject_id: 'sb_kis', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' },
];

// Test the breakdown logic matching LearnerProfileModal.tsx
const eMarks = studentMarks.filter((m) => m.exam_id === exam.id);
const subjectDetails = eMarks.map((m) => {
  const subObj = subjects.find((s) => s.id === m.subject_id);
  const ev = evaluateMark(m);
  const isAssessed = ev.status === 'Normal' && ev.percentage !== null;
  const gradeObj = isAssessed ? getGradeForMark(ev.percentage!, grades) : null;

  let remarks = 'Not Assessed';
  if (isAssessed && gradeObj) {
    remarks = stripSurroundingQuotes(gradeObj.remarks);
  } else if (ev.status === 'X') {
    remarks = 'Missing Assessment (X)';
  } else if (ev.status === 'Y') {
    remarks = ev.irregularityReason ? `Irregularity (${ev.irregularityReason})` : 'Examination Irregularity (Y)';
  }

  return {
    subject_name: subObj?.subject_name || 'Subject',
    subject_code: subObj?.subject_code || 'SUB',
    marks: m.marks,
    ev,
    isAssessed,
    percentage: ev.percentage,
    gradeObj,
    remarks,
  };
});

const assessedDetails = subjectDetails.filter((sd) => sd.isAssessed && sd.percentage !== null && sd.gradeObj !== null);
const totalMarks = assessedDetails.reduce((sum, item) => sum + item.percentage!, 0);
const count = assessedDetails.length;
const avg = count > 0 ? Math.round((totalMarks / count) * 10) / 10 : 0;
const totalPoints = assessedDetails.reduce((sum, item) => sum + item.gradeObj!.points, 0);
const avgPoints = count > 0 ? Math.round((totalPoints / count) * 100) / 100 : 0;
const overallGrade = count > 0 ? getGradeForMark(avg, grades) : null;

assert(count === 2, `Assessed subject count is 2 (got ${count}) - includes only Math (80) and Eng (0)`);
assert(totalMarks === 80, `Total assessed marks is 80 (got ${totalMarks}) - 80 + 0`);
assert(avg === 40, `Average percentage is 40.0% (got ${avg}%) - NOT 20%`);
assert(totalPoints === 5, `Total assessed points is 5 (got ${totalPoints}) - 4 + 1`);
assert(avgPoints === 2.5, `Average points is 2.5 (got ${avgPoints})`);
assert(overallGrade?.grade_code === 'BE1', `Overall grade is BE1 (40.0%)`);

// Verify individual subject rows
const mathSd = subjectDetails.find((s) => s.subject_code === 'MAT')!;
const engSd = subjectDetails.find((s) => s.subject_code === 'ENG')!;
const sciSd = subjectDetails.find((s) => s.subject_code === 'SCI')!;
const kisSd = subjectDetails.find((s) => s.subject_code === 'KIS')!;

assert(mathSd.isAssessed === true && mathSd.percentage === 80 && mathSd.gradeObj?.grade_code === 'EE', 'Math (Normal 80) is assessed with EE');
assert(engSd.isAssessed === true && engSd.percentage === 0 && engSd.gradeObj?.grade_code === 'BE2', 'Eng (Normal 0) is assessed with BE2');
assert(sciSd.isAssessed === false && sciSd.ev.status === 'X' && sciSd.gradeObj === null, 'Sci (X) is NOT assessed, gradeObj is null');
assert(kisSd.isAssessed === false && kisSd.ev.status === 'Y' && kisSd.gradeObj === null, 'Kis (Y) is NOT assessed, gradeObj is null');

console.log(`\n==================================================`);
console.log(`DEFECT 4 TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
