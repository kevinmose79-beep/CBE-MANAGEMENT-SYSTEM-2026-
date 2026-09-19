import '../testSetup';
import assert from 'assert';
import { createRequire } from 'node:module';
import type { School, Examination, ClassStream, Subject, Mark, Grade, Student, Teacher } from '../types';

const require = createRequire(import.meta.url);

let capturedBlob: Blob | null = null;
let capturedFileName = '';

// Intercept file-saver via require.cache BEFORE importing meritListExporter
const fileSaverPath = require.resolve('file-saver');
const mockSaveAs = (blob: Blob, name: string) => {
  capturedFileName = name;
  capturedBlob = blob;
};

// Create a callable mock function with saveAs property attached
const mockFileSaverModule = Object.assign(
  function (blob: Blob, name: string) {
    mockSaveAs(blob, name);
  },
  { saveAs: mockSaveAs }
);

require.cache[fileSaverPath] = {
  id: fileSaverPath,
  filename: fileSaverPath,
  loaded: true,
  exports: mockFileSaverModule,
} as any;

async function getCapturedCsvText(): Promise<string> {
  if (!capturedBlob) return '';
  if (typeof (capturedBlob as any).text === 'function') {
    return await (capturedBlob as any).text();
  }
  return '';
}

console.log('=== RUNNING DEF-PDF-02 CSV TOTAL MARKS FORMATTING TESTS ===');

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

// Helper to split CSV line safely respecting quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

(async () => {
  // Dynamically import meritListExporter after require.cache mock is in place
  const { downloadMeritListCSV } = await import('./meritListExporter');

  const school: School = {
    id: 'sch1',
    school_name: 'Test Academy',
    county: 'Nairobi',
    address: '123 Test St',
    phone: '0700000000',
    email: 'test@academy.sc.ke',
  };

  const exam: Examination = {
    id: 'ex1',
    exam_name: 'End Term 1 2026',
    year: 2026,
    academic_year_id: 'ay1',
    term: 'Term 1',
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const classes: ClassStream[] = [
    { id: 'cls_7a', class_name: 'Grade 7', stream: 'Alpha', education_level: 'Junior School', class_teacher_id: 'tch1', allocated_subject_ids: ['sb1', 'sb2', 'sb3', 'sb4', 'sb5'] },
  ];

  const teachers: Teacher[] = [
    { id: 'tch1', teacher_name: 'Mr. Teacher', email: 'teacher@test.edu', phone: '0700000000', allocations: [], is_class_teacher: true, class_teacher_of_id: 'cls_7a' },
  ];

  const subjects: Subject[] = [
    { id: 'sb1', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb2', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sb3', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sb4', subject_code: 'SCI', subject_name: 'Science', education_level: 'Junior School', category: 'Core' },
    { id: 'sb5', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
  ];

  const grades: Grade[] = [
    { id: 'g1', grade_code: 'EE', performance_level: 'EE', minimum_score: 80, maximum_score: 100, points: 4, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'g2', grade_code: 'ME', performance_level: 'ME', minimum_score: 50, maximum_score: 79, points: 3, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
    { id: 'g3', grade_code: 'AE', performance_level: 'AE', minimum_score: 30, maximum_score: 49, points: 2, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
    { id: 'g4', grade_code: 'BE', performance_level: 'BE', minimum_score: 0, maximum_score: 29, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  ];

  // Test 1: Integer total (450 -> CSV contains "450")
  await runTest('Integer total: 450 total marks serialises strictly as "450" in CSV', async () => {
    const student: Student = { id: 'st1', full_name: 'John Integer', admission_number: 'ADM001', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true };
    const marks: Mark[] = [
      { id: 'm1', student_id: 'st1', exam_id: 'ex1', subject_id: 'sb1', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'st1', exam_id: 'ex1', subject_id: 'sb2', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'st1', exam_id: 'ex1', subject_id: 'sb3', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'st1', exam_id: 'ex1', subject_id: 'sb4', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'st1', exam_id: 'ex1', subject_id: 'sb5', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
    ];

    const data: any = { school, exam, selectedClassId: 'cls_7a', classes, teachers, students: [student], subjects, marks, grades };
    capturedBlob = null;
    downloadMeritListCSV(data);
    const capturedCsvContent = await getCapturedCsvText();

    assert(capturedCsvContent.length > 0, 'CSV content was generated');
    const lines = capturedCsvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const studentRowLine = lines.find((l) => l.includes('JOHN INTEGER'));
    assert(studentRowLine, 'Student row found in CSV');
    const cells = parseCsvLine(studentRowLine!);
    // Columns: SERIAL, ADM NO, NAME, STREAM, STR POS, OVR POS, PRV STR POS, PRV OVR POS, ENG, KIS, MATH, INT-SCI, SST, TOTAL MARKS
    const totalMarksCell = cells[13];
    assert.strictEqual(totalMarksCell, '450', `Total marks cell should be "450", got "${totalMarksCell}"`);
  });

  // Test 2: Floating-point total round-down (456.3333333333333 -> "456")
  await runTest('Floating-point total: 456.3333333333333 rounds down to "456" in CSV', async () => {
    const student: Student = { id: 'st2', full_name: 'Alice FloatDown', admission_number: 'ADM002', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true };
    const val = 456.3333333333333 / 5;
    const marks: Mark[] = [
      { id: 'm1', student_id: 'st2', exam_id: 'ex1', subject_id: 'sb1', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'st2', exam_id: 'ex1', subject_id: 'sb2', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'st2', exam_id: 'ex1', subject_id: 'sb3', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'st2', exam_id: 'ex1', subject_id: 'sb4', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'st2', exam_id: 'ex1', subject_id: 'sb5', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
    ];

    const data: any = { school, exam, selectedClassId: 'cls_7a', classes, teachers, students: [student], subjects, marks, grades };
    capturedBlob = null;
    downloadMeritListCSV(data);
    const capturedCsvContent = await getCapturedCsvText();

    const lines = capturedCsvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const studentRowLine = lines.find((l) => l.includes('ALICE FLOATDOWN'));
    assert(studentRowLine, 'Student row found in CSV');
    const cells = parseCsvLine(studentRowLine!);
    const totalMarksCell = cells[13];
    assert.strictEqual(totalMarksCell, '455', `Total marks cell should be "455", got "${totalMarksCell}"`);
  });

  // Test 3: Floating-point total round-up (456.67 / 5 = 91.334 -> 91 per subject -> 455)
  await runTest('Round-up: 456.67 total marks rounds subject percentage to 91 in CSV', async () => {
    const student: Student = { id: 'st3', full_name: 'Bob FloatUp', admission_number: 'ADM003', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true };
    const val = 456.67 / 5;
    const marks: Mark[] = [
      { id: 'm1', student_id: 'st3', exam_id: 'ex1', subject_id: 'sb1', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'st3', exam_id: 'ex1', subject_id: 'sb2', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'st3', exam_id: 'ex1', subject_id: 'sb3', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'st3', exam_id: 'ex1', subject_id: 'sb4', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'st3', exam_id: 'ex1', subject_id: 'sb5', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
    ];

    const data: any = { school, exam, selectedClassId: 'cls_7a', classes, teachers, students: [student], subjects, marks, grades };
    capturedBlob = null;
    downloadMeritListCSV(data);
    const capturedCsvContent = await getCapturedCsvText();

    const lines = capturedCsvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const studentRowLine = lines.find((l) => l.includes('BOB FLOATUP'));
    assert(studentRowLine, 'Student row found in CSV');
    const cells = parseCsvLine(studentRowLine!);
    const totalMarksCell = cells[13];
    assert.strictEqual(totalMarksCell, '455', `Total marks cell should be "455", got "${totalMarksCell}"`);
  });

  // Test 4: Average percentage precision matches totalMarks / subEntry (e.g. 56% for 56 * 5 / 5)
  await runTest('Average percentage precision matches percentage total average', async () => {
    const student: Student = { id: 'st4', full_name: 'Carol DecimalAvg', admission_number: 'ADM004', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true };
    const val = 56.3333;
    const marks: Mark[] = [
      { id: 'm1', student_id: 'st4', exam_id: 'ex1', subject_id: 'sb1', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'st4', exam_id: 'ex1', subject_id: 'sb2', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'st4', exam_id: 'ex1', subject_id: 'sb3', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'st4', exam_id: 'ex1', subject_id: 'sb4', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'st4', exam_id: 'ex1', subject_id: 'sb5', marks: val, raw_score: val, out_of: 100, special_status: 'Normal' },
    ];

    const data: any = { school, exam, selectedClassId: 'cls_7a', classes, teachers, students: [student], subjects, marks, grades };
    capturedBlob = null;
    downloadMeritListCSV(data);
    const capturedCsvContent = await getCapturedCsvText();

    const lines = capturedCsvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const studentRowLine = lines.find((l) => l.includes('CAROL DECIMALAVG'));
    assert(studentRowLine, 'Student row found in CSV');
    const cells = parseCsvLine(studentRowLine!);
    const avgPctCell = cells[14];
    assert(avgPctCell.includes('56%'), `Average percentage cell should show "56%", got "${avgPctCell}"`);
  });

  // Test 5: Average points precision remains unchanged (e.g. formatted with 2 decimal places)
  await runTest('Average points precision remains unchanged with 2 decimal places', async () => {
    const student: Student = { id: 'st5', full_name: 'David PointsAvg', admission_number: 'ADM005', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true };
    const marks: Mark[] = [
      { id: 'm1', student_id: 'st5', exam_id: 'ex1', subject_id: 'sb1', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'st5', exam_id: 'ex1', subject_id: 'sb2', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'st5', exam_id: 'ex1', subject_id: 'sb3', marks: 40, raw_score: 40, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'st5', exam_id: 'ex1', subject_id: 'sb4', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'st5', exam_id: 'ex1', subject_id: 'sb5', marks: 20, raw_score: 20, out_of: 100, special_status: 'Normal' },
    ];

    const data: any = { school, exam, selectedClassId: 'cls_7a', classes, teachers, students: [student], subjects, marks, grades };
    capturedBlob = null;
    downloadMeritListCSV(data);
    const capturedCsvContent = await getCapturedCsvText();

    const lines = capturedCsvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const studentRowLine = lines.find((l) => l.includes('DAVID POINTSAVG'));
    assert(studentRowLine, 'Student row found in CSV');
    const cells = parseCsvLine(studentRowLine!);
    const avgPtsCell = cells[16];
    assert(/^\d+\.\d{2}$/.test(avgPtsCell), `Average points cell should be formatted with 2 decimal places, got "${avgPtsCell}"`);
  });

  // Test 6: Existing CSV column order remains unchanged
  await runTest('Existing CSV column header structure and order remains intact', async () => {
    const student: Student = { id: 'st6', full_name: 'Eve OrderCheck', admission_number: 'ADM006', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true };
    const marks: Mark[] = [
      { id: 'm1', student_id: 'st6', exam_id: 'ex1', subject_id: 'sb1', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'st6', exam_id: 'ex1', subject_id: 'sb2', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'st6', exam_id: 'ex1', subject_id: 'sb3', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'st6', exam_id: 'ex1', subject_id: 'sb4', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'st6', exam_id: 'ex1', subject_id: 'sb5', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    ];

    const data: any = { school, exam, selectedClassId: 'cls_7a', classes, teachers, students: [student], subjects, marks, grades };
    capturedBlob = null;
    downloadMeritListCSV(data);
    const capturedCsvContent = await getCapturedCsvText();

    const lines = capturedCsvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const headerLine = lines.find((l) => l.includes('SERIAL NO'));
    assert(headerLine, 'Header row found in CSV');
    const headers = parseCsvLine(headerLine!);

    // Standard subject order puts ENG, KIS before MATH, INT-SCI
    const expectedHeaders = [
      'SERIAL NO', 'ADM NO', 'LEARNER NAME', 'STREAM',
      'STR. POS.', 'OVR POS', 'PRV STR POS', 'PRV OVR POS',
      'ENG', 'KIS', 'MATH', 'INT-SCI', 'SST',
      'TOTAL MARKS', 'AVG %', 'TOTAL PTS', 'AVG PTS', 'CBE LEVEL', 'GRADE CODE'
    ];

    assert.strictEqual(headers.length, expectedHeaders.length, `Expected ${expectedHeaders.length} headers, got ${headers.length}`);
    for (let i = 0; i < expectedHeaders.length; i++) {
      assert.strictEqual(headers[i], expectedHeaders[i], `Header at index ${i} should be "${expectedHeaders[i]}", got "${headers[i]}"`);
    }
  });

  console.log(`\nDEF-PDF-02 TEST SUMMARY: ${passed}/${total} tests passed.\n`);
  if (passed < total) {
    process.exit(1);
  }
})();
