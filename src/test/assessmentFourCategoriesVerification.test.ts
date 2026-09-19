import { Examination, ExamType } from '../types';
import { getDisplayExamName, getDisplayExamType } from '../utils/examDisplayUtils';
import { formatStandardExamCode } from '../utils/filterUtils';

console.log('=== RUNNING ASSESSMENT FOUR CATEGORIES VERIFICATION TESTS ===\n');

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

// 1. Check getDisplayExamType for all four categories
console.log('--- 1. getDisplayExamType FORMATTING TESTS ---');
assert(getDisplayExamType('Opener') === 'Opener Assessment', 'Opener maps to "Opener Assessment"');
assert(getDisplayExamType('Mid-Term') === 'Mid-Term Assessment', 'Mid-Term maps to "Mid-Term Assessment"');
assert(getDisplayExamType('End-Term') === 'End-Term Assessment', 'End-Term maps to "End-Term Assessment"');
assert(getDisplayExamType('Custom') === 'Custom Assessment', 'Custom maps to "Custom Assessment"');
assert(getDisplayExamType('CAT') === 'Assessment', 'Historical CAT maps to "Assessment"');

// 2. Examination object formatting
console.log('\n--- 2. EXAMINATION OBJECT DISPLAY TESTS ---');
const openerExam: Examination = {
  id: 'ex_1',
  exam_name: 'Opener Assessment - Term 1 2026',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'Opener',
  max_marks: 100,
};
assert(getDisplayExamType(openerExam) === 'Opener Assessment', 'openerExam displays "Opener Assessment"');
assert(formatStandardExamCode('Grade 7', openerExam) === 'G7-T1-2026-OPN', 'openerExam generates G7-T1-2026-OPN');

const midTermExam: Examination = {
  id: 'ex_2',
  exam_name: 'Mid-Term Assessment - Term 1 2026',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'Mid-Term',
  max_marks: 100,
};
assert(getDisplayExamType(midTermExam) === 'Mid-Term Assessment', 'midTermExam displays "Mid-Term Assessment"');
assert(formatStandardExamCode('Grade 7', midTermExam) === 'G7-T1-2026-MT1', 'midTermExam generates G7-T1-2026-MT1');

const endTermExam: Examination = {
  id: 'ex_3',
  exam_name: 'End-Term Assessment - Term 1 2026',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'End-Term',
  max_marks: 100,
};
assert(getDisplayExamType(endTermExam) === 'End-Term Assessment', 'endTermExam displays "End-Term Assessment"');
assert(formatStandardExamCode('Grade 7', endTermExam) === 'G7-T1-2026-ET1', 'endTermExam generates G7-T1-2026-ET1');

const customExam: Examination = {
  id: 'ex_4',
  exam_name: 'Special Practical Assessment',
  term: 'Term 1',
  year: 2026,
  status: 'Draft',
  exam_type: 'Custom',
  max_marks: 100,
};
assert(getDisplayExamType(customExam) === 'Custom Assessment', 'customExam displays "Custom Assessment"');

console.log(`\n==================================================`);
console.log(`TOTAL TESTS: ${total}, PASSED: ${passed}, FAILED: ${total - passed}`);
console.log(`==================================================`);

if (passed !== total) {
  process.exit(1);
}
