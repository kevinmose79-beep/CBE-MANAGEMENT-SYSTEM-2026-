import './setupLocalStorage';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Student, Subject, Mark, ClassStream, Result } from '../types';

console.log('--- PRIMARY SCHOOL MERIT LIST TOTAL MARKS RANKING ORDER TESTS ---');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    failCount++;
  }
}

// 8 Primary Subjects
const primarySubjects: Subject[] = [
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_math', subject_code: 'MATH', subject_name: 'Mathematics', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_sci', subject_code: 'SCI', subject_name: 'Science & Tech', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_agr', subject_code: 'AGR', subject_name: 'Agriculture', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_sst', subject_code: 'SST', subject_name: 'Social Studies', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_cre', subject_code: 'CRE', subject_name: 'CRE', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
  { id: 'sb_ca', subject_code: 'CA', subject_name: 'Creative Arts', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 6'], status: 'Active' },
];

const mockClass6: ClassStream = {
  id: 'cls_6a',
  class_name: 'Grade 6',
  stream: 'North',
  allocated_subject_ids: primarySubjects.map(s => s.id),
};

const students: Student[] = [
  { id: 'std_A', admission_number: 'ADM-001', full_name: 'Learner A (Higher Total Marks)', grade: 'Grade 6', class_id: 'cls_6a', gender: 'M', active: true },
  { id: 'std_B', admission_number: 'ADM-002', full_name: 'Learner B (Higher Avg Points)', grade: 'Grade 6', class_id: 'cls_6a', gender: 'F', active: true },
  { id: 'std_C_tie', admission_number: 'ADM-003', full_name: 'Learner C (Tied with D)', grade: 'Grade 6', class_id: 'cls_6a', gender: 'M', active: true },
  { id: 'std_D_tie', admission_number: 'ADM-004', full_name: 'Learner D (Tied with C)', grade: 'Grade 6', class_id: 'cls_6a', gender: 'F', active: true },
  { id: 'std_E', admission_number: 'ADM-005', full_name: 'Learner E (Lower Total)', grade: 'Grade 6', class_id: 'cls_6a', gender: 'M', active: true },
  { id: 'std_Incomplete', admission_number: 'ADM-006', full_name: 'Learner Incomplete', grade: 'Grade 6', class_id: 'cls_6a', gender: 'F', active: true },
];

// Marks setup:
// Learner A: 8 subjects with 84.5% each -> Total Marks = 676, Average Points = 3.50 (all EE2)
// Learner B: 8 subjects with 70% each -> Total Marks = 560, Average Points = 4.00 (all ME1)
// Learner C: Total Marks = 600
// Learner D: Total Marks = 600 (Tied with C)
// Learner E: Total Marks = 500
// Learner Incomplete: 3 subjects with 95% each -> Total Marks = 285, Average Points = 4.00, is_complete = false
const marks: Mark[] = [
  // Learner A (8 subjects @ 84.5 / 100 -> rounded 85 each, total = 676 or 680)
  ...primarySubjects.map((s, idx) => ({
    id: `mA_${idx}`,
    exam_id: 'exam_p1',
    student_id: 'std_A',
    subject_id: s.id,
    marks: 84.5,
    raw_score: 84.5,
    out_of: 100,
  })),
  // Learner B (8 subjects @ 70 / 100 -> total = 560)
  ...primarySubjects.map((s, idx) => ({
    id: `mB_${idx}`,
    exam_id: 'exam_p1',
    student_id: 'std_B',
    subject_id: s.id,
    marks: 70,
    raw_score: 70,
    out_of: 100,
  })),
  // Learner C (8 subjects @ 75 / 100 -> total = 600)
  ...primarySubjects.map((s, idx) => ({
    id: `mC_${idx}`,
    exam_id: 'exam_p1',
    student_id: 'std_C_tie',
    subject_id: s.id,
    marks: 75,
    raw_score: 75,
    out_of: 100,
  })),
  // Learner D (8 subjects @ 75 / 100 -> total = 600)
  ...primarySubjects.map((s, idx) => ({
    id: `mD_${idx}`,
    exam_id: 'exam_p1',
    student_id: 'std_D_tie',
    subject_id: s.id,
    marks: 75,
    raw_score: 75,
    out_of: 100,
  })),
  // Learner E (8 subjects @ 62.5 / 100 -> total = 500)
  ...primarySubjects.map((s, idx) => ({
    id: `mE_${idx}`,
    exam_id: 'exam_p1',
    student_id: 'std_E',
    subject_id: s.id,
    marks: 62.5,
    raw_score: 62.5,
    out_of: 100,
  })),
  // Learner Incomplete (only 3 subjects @ 95 / 100)
  { id: 'mInc_0', exam_id: 'exam_p1', student_id: 'std_Incomplete', subject_id: primarySubjects[0].id, marks: 95, raw_score: 95, out_of: 100 },
  { id: 'mInc_1', exam_id: 'exam_p1', student_id: 'std_Incomplete', subject_id: primarySubjects[1].id, marks: 95, raw_score: 95, out_of: 100 },
  { id: 'mInc_2', exam_id: 'exam_p1', student_id: 'std_Incomplete', subject_id: primarySubjects[2].id, marks: 95, raw_score: 95, out_of: 100 },
];

const rawResults = calculateExamResults('exam_p1', students, marks, CBE_8_POINT_GRADES, [mockClass6], primarySubjects);

// Simulation of UI & Exporter sorting rule
const displaySorted = [...rawResults].sort(
  (a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0)
);

// TEST 1: Learner A (Higher Total Marks) is Position 1
const resA = displaySorted.find(r => r.student_id === 'std_A');
const resB = displaySorted.find(r => r.student_id === 'std_B');
assert(resA?.position === 1, 'TEST 1: Learner A has Position 1', `Got ${resA?.position}`);
assert(displaySorted[0].student_id === 'std_A', 'TEST 1: Learner A appears on row 1 of the Merit List');

// TEST 2: Learner A appears above Learner B regardless of Average Points
const indexA = displaySorted.findIndex(r => r.student_id === 'std_A');
const indexB = displaySorted.findIndex(r => r.student_id === 'std_B');
assert(indexA < indexB, 'TEST 2: Learner A is rendered above Learner B in display order');

// TEST 3: Competition ties (Learners C & D both have Total Marks 600)
const resC = displaySorted.find(r => r.student_id === 'std_C_tie');
const resD = displaySorted.find(r => r.student_id === 'std_D_tie');
assert(resC?.position === 2 && resD?.position === 2, 'TEST 3: Tied learners C and D both have Position 2', `C: ${resC?.position}, D: ${resD?.position}`);

// TEST 4: Next learner after tie receives Position 4 (1, 2, 2, 4 pattern)
assert(resB?.position === 4, 'TEST 4: Learner B receives Position 4 (competition skip)', `Got ${resB?.position}`);

// TEST 5: Learner E receives Position 5
const resE = displaySorted.find(r => r.student_id === 'std_E');
assert(resE?.position === 5, 'TEST 5: Learner E receives Position 5', `Got ${resE?.position}`);

// TEST 6: Incomplete learner has position 0 and is sorted to the very bottom
const resInc = displaySorted.find(r => r.student_id === 'std_Incomplete');
assert(resInc?.position === 0, 'TEST 6: Incomplete learner has Position 0', `Got ${resInc?.position}`);
assert(displaySorted[displaySorted.length - 1].student_id === 'std_Incomplete', 'TEST 6: Incomplete learner appears at the end of the Merit List');

console.log(`\nTEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED.`);
if (failCount > 0) {
  process.exit(1);
}
