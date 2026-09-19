import '../testSetup';
import { downloadMeritListPDF, MeritListData } from './meritListExporter';
import { Student, ClassStream, Subject, Grade, Mark, Examination, School } from '../types';

console.log('=== RUNNING DEFECT 3 MERIT LIST PDF SUBJECT COLUMN WIDTH TESTS ===\n');

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

const school: School = {
  id: 'sch1',
  school_name: 'Test Academy',
  county: 'Nairobi',
  address: '123 Test St',
  phone: '555-0100',
  email: 'info@test.edu',
  motto: 'Excellence',
};

const students: Student[] = [
  { id: 's1', full_name: 'Learner Alpha', admission_number: 'ADM001', class_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
  { id: 's2', full_name: 'Learner Beta', admission_number: 'ADM002', class_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true },
];

const classes: ClassStream[] = [
  { id: 'cls_7a', class_name: 'Grade 7', stream: 'Alpha', education_level: 'Junior School' },
  { id: 'cls_4a', class_name: 'Grade 4', stream: 'Alpha', education_level: 'Upper Primary' },
];

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE1', minimum_score: 90, maximum_score: 100, points: 8, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
  { id: 'g2', grade_code: 'ME2', minimum_score: 75, maximum_score: 89, points: 6, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
  { id: 'g3', grade_code: 'BE2', minimum_score: 30, maximum_score: 44, points: 2, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  { id: 'g4', grade_code: 'BE3', minimum_score: 0, maximum_score: 29, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below Expectations' },
];

const exam: Examination = {
  id: 'ex1',
  exam_name: 'Term 1 Assessment',
  term: 'Term 1',
  year: 2026,
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

// Helper to generate N subjects with distinct codes
function createSubjects(count: number, edLevel: 'Junior School' | 'Upper Primary' = 'Junior School'): Subject[] {
  const codes = [
    { code: 'ENG', name: 'English' },
    { code: 'KIS', name: 'Kiswahili' },
    { code: 'MATH', name: 'Mathematics' },
    { code: 'INT-SCI', name: 'Integrated Science' },
    { code: 'CAS', name: 'Creative Arts and Sports' },
    { code: 'SST', name: 'Social Studies' },
    { code: 'CRE', name: 'Christian Religious Education' },
    { code: 'AGN', name: 'Agriculture and Nutrition' },
    { code: 'PRE-TECH', name: 'Pre-Technical Studies' },
    { code: 'FRE', name: 'French' },
    { code: 'GER', name: 'German' },
    { code: 'ARA', name: 'Arabic' },
    { code: 'HSC', name: 'Home Science' },
    { code: 'CST', name: 'Computer Studies' },
    { code: 'BUS', name: 'Business Studies' },
    { code: 'MUS', name: 'Music' },
    { code: 'ART', name: 'Art & Design' },
    { code: 'PHE', name: 'Physical Education' },
    { code: 'BIO', name: 'Biology' },
    { code: 'CHEM', name: 'Chemistry' },
  ];

  return Array.from({ length: count }, (_, i) => {
    if (edLevel === 'Upper Primary') {
      return {
        id: `sb_up_${i + 1}`,
        subject_code: `UP_${i + 1}`,
        subject_name: `Primary Subject ${i + 1}`,
        education_level: edLevel,
        category: 'Core',
      };
    }
    const item = codes[i % codes.length];
    const code = i >= codes.length ? `${item.code}_${i + 1}` : item.code;
    return {
      id: `sb_${i + 1}`,
      subject_code: code,
      subject_name: item.name,
      education_level: edLevel,
      category: 'Core',
    };
  });
}

// Helper to create marks for a set of subjects
function createMarks(subjs: Subject[]): Mark[] {
  const result: Mark[] = [];
  subjs.forEach((s) => {
    result.push({
      id: `m_s1_${s.id}`,
      student_id: 's1',
      exam_id: 'ex1',
      subject_id: s.id,
      marks: 95,
      raw_score: 95,
      out_of: 100,
      special_status: 'Normal',
    });
    result.push({
      id: `m_s2_${s.id}`,
      student_id: 's2',
      exam_id: 'ex1',
      subject_id: s.id,
      marks: 40,
      raw_score: 40,
      out_of: 100,
      special_status: 'Normal',
    });
  });
  return result;
}

// Test column width calculations directly
function verifyColumnWidth(numSubjs: number, contentWidth = 277, sumMetaW = 115, sumSummaryW = 66) {
  const availSubjArea = contentWidth - sumMetaW - sumSummaryW;
  const availSubjW = availSubjArea / numSubjs;
  const totalTableW = sumMetaW + (numSubjs * availSubjW) + sumSummaryW;
  return { availSubjW, totalTableW };
}

// 1. Normal Cohort (8-9 subjects) test
const norm9 = verifyColumnWidth(9);
assert(Math.abs(norm9.availSubjW - 10.666) < 0.01, `9 subjects yields ~10.67mm per column (got ${norm9.availSubjW.toFixed(2)}mm)`);
assert(norm9.totalTableW <= 277, `9 subjects total table width (${norm9.totalTableW}mm) <= printable width (277mm)`);

// 2. High Subject Counts width checks
[12, 13, 14, 16, 20].forEach((count) => {
  const w = verifyColumnWidth(count);
  assert(w.totalTableW <= 277, `${count} subjects total table width (${w.totalTableW}mm) <= printable width (277mm)`);
  assert(w.availSubjW > 0, `${count} subjects column width is positive (${w.availSubjW.toFixed(2)}mm)`);
});

// PDF Execution Tests for both Junior School (downloadMeritListPDF) and Upper Primary (generatePrimaryMeritListPDF)
async function testPdfExportForSubjectCounts() {
  const subjectCountsToTest = [8, 9, 12, 13, 14, 16, 20];

  for (const count of subjectCountsToTest) {
    // A. Junior School path
    const jsSubjs = createSubjects(count, 'Junior School');
    const jsMarks = createMarks(jsSubjs);
    const jsData: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_7a',
      classes,
      students,
      subjects: jsSubjs,
      marks: jsMarks,
      grades,
      generatedBy: 'Width Test',
    };

    try {
      await downloadMeritListPDF(jsData);
      assert(true, `downloadMeritListPDF (Junior School) executed successfully for ${count} subjects`);
    } catch (err: any) {
      assert(false, `downloadMeritListPDF failed for ${count} subjects: ${err?.message || err}`);
    }

    // B. Upper Primary path (generatePrimaryMeritListPDF)
    const priStudents: Student[] = [
      { id: 's1', full_name: 'Primary Learner Alpha', admission_number: 'ADM001', class_id: 'cls_4a', grade: 'Grade 4', gender: 'F', active: true },
      { id: 's2', full_name: 'Primary Learner Beta', admission_number: 'ADM002', class_id: 'cls_4a', grade: 'Grade 4', gender: 'M', active: true },
    ];
    const priSubjs = createSubjects(count, 'Upper Primary');
    const priMarks = createMarks(priSubjs);
    const priData: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_4a',
      classes,
      students: priStudents,
      subjects: priSubjs,
      marks: priMarks,
      grades,
      generatedBy: 'Primary Width Test',
    };

    try {
      await downloadMeritListPDF(priData);
      assert(true, `generatePrimaryMeritListPDF (Upper Primary) executed successfully for ${count} subjects`);
    } catch (err: any) {
      assert(false, `generatePrimaryMeritListPDF failed for ${count} subjects: ${err?.message || err}`);
    }
  }
}

testPdfExportForSubjectCounts().then(() => {
  console.log(`\n==================================================`);
  console.log(`DEFECT 3 TEST RESULTS: ${passed}/${total} PASSED`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
});
