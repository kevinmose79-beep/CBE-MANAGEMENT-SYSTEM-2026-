import '../testSetup';
import assert from 'assert';
import type { School, Examination, ClassStream, Subject, Mark, Grade, Student, Teacher } from '../types';
import { downloadMeritListPDF } from './meritListExporter';
import { CBE_8_POINT_GRADES } from './analysisEngine';

console.log('=== RUNNING JUNIOR SCHOOL MERIT LIST PDF CLASS SUMMARY TESTS ===');

let passed = 0;
let total = 0;

async function runTest(description: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`✓ PASS: ${description}`);
  } catch (err: any) {
    console.error(`✗ FAIL: ${description}`, err?.stack || err?.message || err);
  }
}

(async () => {
  const school: School = {
    id: 'sch1',
    school_name: 'Muchorwe Junior Secondary School',
    county: 'Nakuru',
    address: 'P.O. Box 100',
    phone: '0712345678',
    email: 'info@muchorwejs.sc.ke',
  };

  const exam: Examination = {
    id: 'ex_js_7',
    exam_name: 'End Term 2 Exam 2026',
    year: 2026,
    academic_year_id: 'ay2026',
    term: 'Term 2',
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const classes: ClassStream[] = [
    {
      id: 'cls_g7a',
      class_name: 'Grade 7',
      stream: 'Alpha',
      education_level: 'Junior School',
      class_teacher_id: 'tch1',
      allocated_subject_ids: ['sb1', 'sb2', 'sb3', 'sb4', 'sb5', 'sb6', 'sb7', 'sb8', 'sb9'],
    },
  ];

  const teachers: Teacher[] = [
    {
      id: 'tch1',
      teacher_name: 'Mr. Maina',
      email: 'maina@muchorwe.edu',
      phone: '0722000111',
      allocations: [],
      is_class_teacher: true,
      class_teacher_of_id: 'cls_g7a',
    },
  ];

  const subjects: Subject[] = [
    { id: 'sb1', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sb2', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sb3', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb4', subject_code: 'INT SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
    { id: 'sb5', subject_code: 'CAS', subject_name: 'Creative Arts & Sports', education_level: 'Junior School', category: 'Core' },
    { id: 'sb6', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
    { id: 'sb7', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Junior School', category: 'Core' },
    { id: 'sb8', subject_code: 'AGRI', subject_name: 'Agriculture and Nutrition', education_level: 'Junior School', category: 'Core' },
    { id: 'sb9', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core' },
  ];

  const grades: Grade[] = CBE_8_POINT_GRADES;

  const students: Student[] = [
    { id: 'st1', full_name: 'Wanjiku Kamau', admission_number: '7001', class_id: 'cls_g7a', stream_id: 'cls_g7a', grade: 'Grade 7', gender: 'F', active: true },
    { id: 'st2', full_name: 'Ochieng Odhiambo', admission_number: '7002', class_id: 'cls_g7a', stream_id: 'cls_g7a', grade: 'Grade 7', gender: 'M', active: true },
  ];

  const marks: Mark[] = [
    // st1
    { id: 'm1_1', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb1', marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
    { id: 'm1_2', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb2', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    { id: 'm1_3', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb3', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
    { id: 'm1_4', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb4', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
    { id: 'm1_5', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb5', marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
    { id: 'm1_6', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb6', marks: 55, raw_score: 55, out_of: 100, special_status: 'Normal' },
    { id: 'm1_7', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb7', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
    { id: 'm1_8', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb8', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm1_9', student_id: 'st1', exam_id: 'ex_js_7', subject_id: 'sb9', marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },
    // st2
    { id: 'm2_1', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb1', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
    { id: 'm2_2', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb2', marks: 50, raw_score: 50, out_of: 100, special_status: 'Normal' },
    { id: 'm2_3', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb3', marks: 40, raw_score: 40, out_of: 100, special_status: 'Normal' },
    { id: 'm2_4', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb4', marks: 55, raw_score: 55, out_of: 100, special_status: 'Normal' },
    { id: 'm2_5', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb5', marks: 45, raw_score: 45, out_of: 100, special_status: 'Normal' },
    { id: 'm2_6', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb6', marks: 30, raw_score: 30, out_of: 100, special_status: 'Normal' },
    { id: 'm2_7', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb7', marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
    { id: 'm2_8', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb8', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    { id: 'm2_9', student_id: 'st2', exam_id: 'ex_js_7', subject_id: 'sb9', marks: 50, raw_score: 50, out_of: 100, special_status: 'Normal' },
  ];

  const data = {
    school,
    exam,
    selectedClassId: 'cls_g7a',
    selectedStreamId: 'all',
    classes,
    teachers,
    students,
    subjects,
    marks,
    grades,
  };

  await runTest('Junior School Merit List PDF exports without errors', async () => {
    await downloadMeritListPDF(data);
    assert(true);
  });

  await runTest('Subject cell formatting tests (Tests 1-12)', async () => {
    const testCases = [
      { rawScore: 48, outOf: 50, pct: 96, expected: '96 EE1' },
      { rawScore: 54, outOf: 65, pct: 83.0769, expectedDisplayPct: 83, expectedGrade: 'EE2', expected: '83 EE2' },
      { rawScore: 89.1, outOf: 100, pct: 89.1, expectedDisplayPct: 89, expectedGrade: 'EE2', expected: '89 EE2' },
      { rawScore: 90, outOf: 100, pct: 90, expected: '90 EE1' },
      { rawScore: 75, outOf: 100, pct: 75, expected: '75 EE2' },
      { rawScore: 58, outOf: 100, pct: 58, expected: '58 ME1' },
      { rawScore: 41, outOf: 100, pct: 41, expected: '41 ME2' },
      { rawScore: 31, outOf: 100, pct: 31, expected: '31 AE1' },
      { rawScore: 21, outOf: 100, pct: 21, expected: '21 AE2' },
      { rawScore: 11, outOf: 100, pct: 11, expected: '11 BE1' },
      { rawScore: 10, outOf: 100, pct: 10, expected: '10 BE2' },
      { rawScore: 100, outOf: 100, pct: 100, expected: '100 EE1' },
    ];

    const { evaluateMark } = await import('../utils/markUtils');
    const { getGradeForMark } = await import('./analysisEngine');

    for (const tc of testCases) {
      const dummyMark: Mark = {
        id: 'tm',
        student_id: 's',
        exam_id: 'e',
        subject_id: 'sub',
        marks: tc.rawScore,
        raw_score: tc.rawScore,
        out_of: tc.outOf,
        special_status: 'Normal',
      };
      const info = evaluateMark(dummyMark);
      assert.strictEqual(info.status, 'Normal');
      const displayedPct = Math.round(info.percentage!);
      if (tc.expectedDisplayPct !== undefined) {
        assert.strictEqual(displayedPct, tc.expectedDisplayPct, `Display pct mismatch for raw=${tc.rawScore}/${tc.outOf}`);
      }
      const gr = getGradeForMark(info.percentage!, grades);
      if (tc.expectedGrade) {
        assert.strictEqual(gr.grade_code, tc.expectedGrade, `Grade mismatch for pct=${info.percentage}`);
      }
      const cellStr = `${displayedPct} ${gr.grade_code || 'ME1'}`;
      assert.strictEqual(cellStr, tc.expected, `Cell string mismatch for raw=${tc.rawScore}/${tc.outOf}: got ${cellStr}, expected ${tc.expected}`);
    }
  });

  console.log(`\nJUNIOR SCHOOL MERIT LIST CLASS SUMMARY TESTS: ${passed}/${total} PASSED\n`);
  if (passed < total) process.exit(1);
})();
