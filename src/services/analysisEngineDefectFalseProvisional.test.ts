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
import { calculateExamResults, getLearnerReportSubjects } from './analysisEngine';
import { Student, ClassStream, Subject, Grade, Mark, Examination } from '../types';

console.log('=== RUNNING DEFECT TEST SUITE — FALSE PROVISIONAL / INCOMPLETE STATUS ===\n');

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

// Global Fixtures setup
const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE1', minimum_score: 90, maximum_score: 100, points: 8, performance_level: 'EE', remarks: 'Outstanding', descriptor: 'Exceeding Expectations' },
  { id: 'g2', grade_code: 'EE2', minimum_score: 75, maximum_score: 89, points: 7, performance_level: 'EE', remarks: 'Excellent', descriptor: 'Exceeding Expectations' },
  { id: 'g3', grade_code: 'ME1', minimum_score: 58, maximum_score: 74, points: 6, performance_level: 'ME', remarks: 'Good', descriptor: 'Meeting Expectations' },
  { id: 'g4', grade_code: 'ME2', minimum_score: 41, maximum_score: 57, points: 5, performance_level: 'ME', remarks: 'Satisfactory', descriptor: 'Meeting Expectations' },
  { id: 'g5', grade_code: 'AE1', minimum_score: 31, maximum_score: 40, points: 4, performance_level: 'AE', remarks: 'Developing', descriptor: 'Approaching Expectations' },
  { id: 'g6', grade_code: 'AE2', minimum_score: 21, maximum_score: 30, points: 3, performance_level: 'AE', remarks: 'Needs Support', descriptor: 'Approaching Expectations' },
  { id: 'g7', grade_code: 'BE1', minimum_score: 11, maximum_score: 20, points: 2, performance_level: 'BE', remarks: 'Intervention Required', descriptor: 'Below Expectations' },
  { id: 'g8', grade_code: 'BE2', minimum_score: 0, maximum_score: 10, points: 1, performance_level: 'BE', remarks: 'Immediate Support', descriptor: 'Below Expectations' },
];

// 12 subjects in school database
const all12Subjects: Subject[] = [
  { id: 's1', subject_code: 'MAT', subject_name: 'Mathematics', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's2', subject_code: 'ENG', subject_name: 'English', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's3', subject_code: 'KIS', subject_name: 'Kiswahili', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's4', subject_code: 'INT', subject_name: 'Integrated Science', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's5', subject_code: 'SST', subject_name: 'Social Studies', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's6', subject_code: 'CRE', subject_name: 'CRE', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's7', subject_code: 'AGR', subject_name: 'Agriculture', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's8', subject_code: 'CST', subject_name: 'Computer Studies', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  { id: 's9', subject_code: 'PHE', subject_name: 'Physical Education', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7'] },
  // 3 Subjects belonging to other grades (unallocated to Grade 7 class)
  { id: 's10', subject_code: 'FRE', subject_name: 'French (Grade 8)', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 8'] },
  { id: 's11', subject_code: 'GER', subject_name: 'German (Grade 8)', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 8'] },
  { id: 's12', subject_code: 'MUS', subject_name: 'Music (Grade 8)', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 8'] },
];

const allocated9SubjectIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];

const classes: ClassStream[] = [
  { id: 'cls_g7a', class_name: 'Grade 7', stream: 'Alpha', education_level: 'Junior School', allocated_subject_ids: allocated9SubjectIds },
  { id: 'cls_g8a', class_name: 'Grade 8', stream: 'Alpha', education_level: 'Junior School', allocated_subject_ids: ['s10', 's11', 's12'] },
];

const learner1: Student = {
  id: 'std_01',
  full_name: 'John Complete',
  admission_number: 'ADM100',
  class_id: 'cls_g7a',
  grade: 'Grade 7',
  gender: 'M',
  active: true,
};

// ==========================================
// TEST 1 — COMPLETE LEARNER WITH UNALLOCATED SCHOOL SUBJECTS
// ==========================================
console.log('--- TEST 1 — COMPLETE LEARNER WITH UNALLOCATED SCHOOL SUBJECTS ---');
const validMarks9: Mark[] = allocated9SubjectIds.map((sid, idx) => ({
  id: `m_${sid}`,
  student_id: 'std_01',
  exam_id: 'ex_t1',
  subject_id: sid,
  marks: 70 + idx,
  raw_score: 70 + idx,
  out_of: 100,
  special_status: 'Normal',
}));

const resTest1 = calculateExamResults('ex_t1', [learner1], validMarks9, grades, classes, all12Subjects);
assert(resTest1.length === 1, 'Test 1: Result generated for 1 student');
const r1 = resTest1[0];
assert(r1.is_complete === true, 'Test 1: is_complete is strictly true');
assert(r1.status === 'Complete', 'Test 1: status is "Complete"');
assert(r1.position === 1, 'Test 1: learner receives position 1');
assert(r1.class_position === 1, 'Test 1: learner receives stream position 1');
assert(Boolean(r1.grade_code), 'Test 1: learner receives calculated CBE level grade code');
assert(r1.missing_subjects_count === 0, 'Test 1: missing_subjects_count is 0 (unallocated subjects ignored)');

// ==========================================
// TEST 2 — GENUINE MISSING ALLOCATED SUBJECT
// ==========================================
console.log('\n--- TEST 2 — GENUINE MISSING ALLOCATED SUBJECT ---');
// 8 valid marks out of 9 allocated subjects (s9 is missing)
const marks8Only = validMarks9.slice(0, 8);
const resTest2 = calculateExamResults('ex_t1', [learner1], marks8Only, grades, classes, all12Subjects);
const r2 = resTest2[0];
assert(r2.is_complete === false, 'Test 2: is_complete is strictly false');
assert(r2.status === 'Provisional', 'Test 2: status is "Provisional"');
assert(r2.position === 0, 'Test 2: ranking is withheld (position 0)');
assert(r2.missing_subjects_count === 1, 'Test 2: missing_subjects_count === 1');

// ==========================================
// TEST 3 — X ON ALLOCATED SUBJECT
// ==========================================
console.log('\n--- TEST 3 — X ON ALLOCATED SUBJECT ---');
const marksWithX = [
  ...validMarks9.slice(0, 8),
  { id: 'm_s9_x', student_id: 'std_01', exam_id: 'ex_t1', subject_id: 's9', marks: 0, raw_score: null, out_of: 100, special_status: 'X' as const },
];
const resTest3 = calculateExamResults('ex_t1', [learner1], marksWithX, grades, classes, all12Subjects);
const r3 = resTest3[0];
assert(r3.is_complete === false, 'Test 3: X mark causes is_complete === false');
assert(r3.status === 'Provisional', 'Test 3: X mark causes status === "Provisional"');
assert(r3.position === 0, 'Test 3: position is withheld (0)');

// ==========================================
// TEST 4 — Y ON ALLOCATED SUBJECT
// ==========================================
console.log('\n--- TEST 4 — Y ON ALLOCATED SUBJECT ---');
const marksWithY = [
  ...validMarks9.slice(0, 8),
  { id: 'm_s9_y', student_id: 'std_01', exam_id: 'ex_t1', subject_id: 's9', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' as const },
];
const resTest4 = calculateExamResults('ex_t1', [learner1], marksWithY, grades, classes, all12Subjects);
const r4 = resTest4[0];
assert(r4.is_complete === false, 'Test 4: Y irregularity causes is_complete === false');
assert(r4.status === 'Provisional', 'Test 4: status === "Provisional"');

// ==========================================
// TEST 5 — ZERO MARK
// ==========================================
console.log('\n--- TEST 5 — ZERO MARK ---');
const marksWithZero = [
  ...validMarks9.slice(0, 8),
  { id: 'm_s9_zero', student_id: 'std_01', exam_id: 'ex_t1', subject_id: 's9', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' as const },
];
const resTest5 = calculateExamResults('ex_t1', [learner1], marksWithZero, grades, classes, all12Subjects);
const r5 = resTest5[0];
assert(r5.is_complete === true, 'Test 5: Valid assessed 0 mark is complete');
assert(r5.status === 'Complete', 'Test 5: Valid assessed 0 mark gives status "Complete"');
assert(r5.position === 1, 'Test 5: Learner with assessed 0 receives position');

// ==========================================
// TEST 6 — NON-100 MAXIMUM (AGN 54/65)
// ==========================================
console.log('\n--- TEST 6 — NON-100 MAXIMUM ---');
const marksWithNon100Max = [
  ...validMarks9.slice(0, 8),
  { id: 'm_s9_agn', student_id: 'std_01', exam_id: 'ex_t1', subject_id: 's9', marks: 54, raw_score: 54, out_of: 65, special_status: 'Normal' as const },
];
const resTest6 = calculateExamResults('ex_t1', [learner1], marksWithNon100Max, grades, classes, all12Subjects);
const r6 = resTest6[0];
assert(r6.is_complete === true, 'Test 6: 54/65 mark is complete and assessed');
assert(r6.status === 'Complete', 'Test 6: status === "Complete"');
// 54/65 = 83.0769%
assert(r6.missing_subjects_count === 0, 'Test 6: 54/65 does not contribute to missing_subjects_count');

// ==========================================
// TEST 7 — HISTORICAL EXAMINATION CONTEXT
// ==========================================
console.log('\n--- TEST 7 — HISTORICAL EXAMINATION CONTEXT ---');
// Learner is promoted to Grade 8 today (std_promoted), but took exam when in Grade 7 (cls_g7a)
const learnerPromoted: Student = {
  id: 'std_promoted',
  full_name: 'Alice Promoted',
  admission_number: 'ADM101',
  class_id: 'cls_g8a', // currently Grade 8
  grade: 'Grade 8',
  gender: 'F',
  active: true,
  promotion_history: [
    {
      id: 'pr_1',
      student_id: 'std_promoted',
      from_class_id: 'cls_g7a',
      from_grade: 'Grade 7',
      to_class_id: 'cls_g8a',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

const historicalExam: Examination = {
  id: 'ex_2024_g7',
  exam_name: '2024 Grade 7 End Term',
  exam_type: 'End-Term',
  max_marks: 100,
  year: 2024,
  term: 'Term 3',
  academic_year_id: 'ay_2024',
  class_id: 'cls_g7a',
  status: 'Published',
  start_date: '2024-11-01T00:00:00.000Z',
};

import { setStorage, KEYS } from '../lib/storage';

setStorage(KEYS.EXAMS, [historicalExam]);

const histMarks: Mark[] = allocated9SubjectIds.map((sid) => ({
  id: `hm_${sid}`,
  student_id: 'std_promoted',
  exam_id: 'ex_2024_g7',
  subject_id: sid,
  marks: 85,
  raw_score: 85,
  out_of: 100,
  special_status: 'Normal',
}));

const resTest7 = calculateExamResults('ex_2024_g7', [learnerPromoted], histMarks, grades, classes, all12Subjects);
const r7 = resTest7[0];
assert(r7 !== undefined, 'Test 7: Result produced for promoted learner in historical exam');
assert(r7.is_complete === true, 'Test 7: Promoted learner assessed against historical Grade 7 subjects is complete');
assert(r7.status === 'Complete', 'Test 7: Status is "Complete"');
assert(r7.missing_subjects_count === 0, 'Test 7: No missing subjects from Grade 8 curriculum');

console.log(`\n==================================================`);
console.log(`DEFECT DEF-FALSE-PROVISIONAL TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
