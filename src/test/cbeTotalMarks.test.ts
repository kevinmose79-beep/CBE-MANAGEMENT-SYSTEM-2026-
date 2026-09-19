import './setupLocalStorage';
import { calculateExamResults, getGradeForMark, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Student, Subject, Mark, Grade, ClassStream } from '../types';

console.log('--- RUNNING JUNIOR SCHOOL MERIT LIST TOTAL MARKS TESTS ---');

const mockSubjects: Subject[] = [
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_math', subject_code: 'MATH', subject_name: 'Mathematics', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_sci', subject_code: 'INT SCI', subject_name: 'Integrated Science', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_cas', subject_code: 'CAS', subject_name: 'Creative Arts and Sports', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_sst', subject_code: 'SST', subject_name: 'Social Studies', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_cre', subject_code: 'CRE', subject_name: 'Christian Religious Education', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_agn', subject_code: 'AGN', subject_name: 'Agriculture and Nutrition', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
  { id: 'sb_pts', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'], status: 'Active' },
];

const mockClass: ClassStream = {
  id: 'cls_7a',
  class_name: 'Grade 7',
  stream: 'East',
  allocated_subject_ids: mockSubjects.map(s => s.id),
};

const mockStudents: Student[] = [
  {
    id: 'std_1',
    admission_number: 'ADM-001',
    full_name: 'Jane Doe',
    grade: 'Grade 7',
    class_id: 'cls_7a',
    gender: 'F',
    active: true,
  },
];

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

// TEST 1 — Percentage Total (99, 96, 96, 98, 75, 94, 78, 97, 95 -> 828, SUB ENTRY=9, AVG=92)
const marksTest1: Mark[] = [
  { id: 'm1', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_eng', marks: 49.5, raw_score: 49.5, out_of: 50 },
  { id: 'm2', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_kis', marks: 48, raw_score: 48, out_of: 50 },
  { id: 'm3', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_math', marks: 48, raw_score: 48, out_of: 50 },
  { id: 'm4', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_sci', marks: 49, raw_score: 49, out_of: 50 },
  { id: 'm5', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_cas', marks: 37.5, raw_score: 37.5, out_of: 50 },
  { id: 'm6', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_sst', marks: 47, raw_score: 47, out_of: 50 },
  { id: 'm7', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_cre', marks: 39, raw_score: 39, out_of: 50 },
  { id: 'm8', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_agn', marks: 48.5, raw_score: 48.5, out_of: 50 },
  { id: 'm9', exam_id: 'ex1', student_id: 'std_1', subject_id: 'sb_pts', marks: 47.5, raw_score: 47.5, out_of: 50 },
];

const resultsTest1 = calculateExamResults('ex1', mockStudents, marksTest1, CBE_8_POINT_GRADES, [mockClass], mockSubjects);
const res1 = resultsTest1[0];

assert(res1.total_marks === 828, 'TEST 1 — TOTAL MARKS equals sum of percentages (828)', `Got ${res1?.total_marks}`);
assert(res1.subject_count === 9, 'TEST 1 — SUB. ENTRY equals 9', `Got ${res1?.subject_count}`);
assert(res1.average === 92, 'TEST 1 — AVG MARKS equals 92%', `Got ${res1?.average}`);

// TEST 2 — 48/50 -> 96 EE1, contributes 96 to TOTAL MARKS
const pct48_50 = (48 / 50) * 100;
const gr48_50 = getGradeForMark(pct48_50, CBE_8_POINT_GRADES);
assert(Math.round(pct48_50) === 96 && gr48_50.grade_code === 'EE1', 'TEST 2 — 48/50 displays as 96 EE1');

// TEST 3 — 54/65 -> 83 EE2, contributes 83 to TOTAL MARKS
const pct54_65 = (54 / 65) * 100; // 83.0769...
const gr54_65 = getGradeForMark(pct54_65, CBE_8_POINT_GRADES);
assert(Math.round(pct54_65) === 83 && gr54_65.grade_code === 'EE2', 'TEST 3 — 54/65 displays as 83 EE2');

// TEST 4 — 89.1% -> 89 EE2 (below 90% boundary)
const gr89_1 = getGradeForMark(89.1, CBE_8_POINT_GRADES);
assert(Math.round(89.1) === 89 && gr89_1.grade_code === 'EE2', 'TEST 4 — 89.1% displays as 89 EE2');

// TEST 5 — 90% -> 90 EE1 (EE1 boundary)
const gr90 = getGradeForMark(90, CBE_8_POINT_GRADES);
assert(Math.round(90) === 90 && gr90.grade_code === 'EE1', 'TEST 5 — 90% displays as 90 EE1');

// TEST 6 — Mixed Maximum Marks (50, 65, 100 out_of)
const marksMixed: Mark[] = [
  { id: 'mm1', exam_id: 'ex2', student_id: 'std_1', subject_id: 'sb_eng', marks: 48, raw_score: 48, out_of: 50 },  // 96% -> 96
  { id: 'mm2', exam_id: 'ex2', student_id: 'std_1', subject_id: 'sb_kis', marks: 54, raw_score: 54, out_of: 65 },  // 83.076% -> 83
  { id: 'mm3', exam_id: 'ex2', student_id: 'std_1', subject_id: 'sb_math', marks: 90, raw_score: 90, out_of: 100 }, // 90% -> 90
];
const resultsMixed = calculateExamResults('ex2', mockStudents, marksMixed, CBE_8_POINT_GRADES, [mockClass], [mockSubjects[0], mockSubjects[1], mockSubjects[2]]);
const resMixed = resultsMixed[0];
assert(resMixed.total_marks === 96 + 83 + 90, 'TEST 6 — Mixed out_of sums percentage scores (96+83+90 = 269)', `Got ${resMixed?.total_marks}`);

console.log(`\nTEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED.`);
if (failCount > 0) {
  process.exit(1);
}
