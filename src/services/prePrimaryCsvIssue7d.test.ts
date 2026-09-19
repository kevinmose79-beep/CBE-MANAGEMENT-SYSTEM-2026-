import assert from 'assert';
import { createRequire } from 'node:module';
import type { School, Examination, ClassStream, Subject, Mark, Grade, Student, Teacher } from '../types';

const require = createRequire(process.cwd() + '/dummy.js');

let capturedBlob: any = null;
let capturedFileName = '';

// Intercept file-saver via require.cache BEFORE importing meritListExporter
const fileSaverPath = require.resolve('file-saver');
const mockSaveAs = (blob: any, name: string) => {
  capturedFileName = name;
  capturedBlob = blob;
};

const mockFileSaverModule = Object.assign(
  function (blob: any, name: string) {
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

console.log('=== RUNNING ISSUE 7D: PRE-PRIMARY (PP1/PP2) CSV LEARNING-AREA AUDIT TESTS ===');

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
  const { downloadMeritListCSV } = await import('./meritListExporter');
  const { initialSchool, initialGrades, initialSubjects, initialTeachers, initialExaminations } = await import('../data/seedData');

  const pp1Class: ClassStream = {
    id: 'cls_pp1',
    class_name: 'PP1',
    stream: 'North',
    education_level: 'Pre-Primary',
    status: 'Active',
    allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re']
  };

  const pp2Class: ClassStream = {
    id: 'cls_pp2',
    class_name: 'PP2',
    stream: 'East',
    education_level: 'Pre-Primary',
    status: 'Active',
    allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re']
  };

  const pp1Students: Student[] = [
    { id: 's1', admission_number: 'ADM-01', full_name: 'Alice Wambui', gender: 'F', class_id: pp1Class.id, stream_id: pp1Class.id, grade: 'PP1', active: true },
    { id: 's2', admission_number: 'ADM-02', full_name: 'Bob Kipchoge', gender: 'M', class_id: pp1Class.id, stream_id: pp1Class.id, grade: 'PP1', active: true }
  ];

  const pp1Marks: Mark[] = [
    { id: 'm1', exam_id: 'ex_01', student_id: 's1', subject_id: 'sb_pp_math', marks: 92, raw_score: 92, out_of: 100, special_status: 'Normal' },
    { id: 'm2', exam_id: 'ex_01', student_id: 's1', subject_id: 'sb_pp_psy', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
    { id: 'm3', exam_id: 'ex_01', student_id: 's1', subject_id: 'sb_pp_re', marks: 82, raw_score: 82, out_of: 100, special_status: 'Normal' },
    { id: 'm4', exam_id: 'ex_01', student_id: 's1', subject_id: 'sb_pp_env', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm5', exam_id: 'ex_01', student_id: 's1', subject_id: 'sb_pp_lang', marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },

    { id: 'm6', exam_id: 'ex_01', student_id: 's2', subject_id: 'sb_pp_math', marks: 0, raw_score: 0, out_of: 100, special_status: 'Normal' },
    { id: 'm7', exam_id: 'ex_01', student_id: 's2', subject_id: 'sb_pp_psy', marks: 0, raw_score: 0, out_of: 100, special_status: 'X' },
    { id: 'm8', exam_id: 'ex_01', student_id: 's2', subject_id: 'sb_pp_re', marks: 0, raw_score: 0, out_of: 100, special_status: 'Y' },
  ];

  // TEST 1: PP1 Header contains exact configured learning-area codes in order
  await runTest('PP1 CSV Header contains PP-MATH, PP-PCA, PP-CRE, PP-ENV, PP-LANG in correct order', async () => {
    capturedBlob = null;
    downloadMeritListCSV({
      school: initialSchool,
      exam: initialExaminations[0],
      selectedClassId: pp1Class.id,
      selectedStreamId: 'all',
      classes: [pp1Class],
      teachers: initialTeachers,
      students: pp1Students,
      subjects: initialSubjects,
      marks: pp1Marks,
      grades: initialGrades
    });

    assert(capturedBlob, 'CSV was generated');
    const text = await capturedBlob.text();
    const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
    const headerLine = lines[3]; // 4th line is header
    const headers = parseCsvLine(headerLine);

    const expectedSubjects = ['PP-MATH', 'PP-PCA', 'PP-CRE', 'PP-ENV', 'PP-LANG'];
    const actualSubjectSlice = headers.slice(8, 13);

    assert.deepStrictEqual(actualSubjectSlice, expectedSubjects, `Subject headers should match PP codes in order. Found: ${JSON.stringify(actualSubjectSlice)}`);
  });

  // TEST 2: PP1 Student row contains marks under the exact subject code
  await runTest('PP1 Learner marks are bound to the exact subject columns and special statuses are preserved', async () => {
    const text = await capturedBlob.text();
    const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
    
    // Alice (complete learner)
    const aliceLine = lines.find((l: string) => l.includes('ALICE WAMBUI'));
    assert(aliceLine, 'Alice row exists');
    const aliceCells = parseCsvLine(aliceLine);
    const aliceSubjects = aliceCells.slice(8, 13);

    assert.strictEqual(aliceSubjects[0], 'PP-MATH: 92 EE1', 'PP-MATH score bound correctly');
    assert.strictEqual(aliceSubjects[1], 'PP-PCA: 88 EE2', 'PP-PCA score bound correctly');
    assert.strictEqual(aliceSubjects[2], 'PP-CRE: 82 EE2', 'PP-CRE score bound correctly');
    assert.strictEqual(aliceSubjects[3], 'PP-ENV: 78 EE2', 'PP-ENV score bound correctly');
    assert.strictEqual(aliceSubjects[4], 'PP-LANG: 74 ME1', 'PP-LANG score bound correctly');

    // Bob (special statuses: 0, X, Y, blank)
    const bobLine = lines.find((l: string) => l.includes('BOB KIPCHOGE'));
    assert(bobLine, 'Bob row exists');
    const bobCells = parseCsvLine(bobLine);
    const bobSubjects = bobCells.slice(8, 13);

    assert.strictEqual(bobSubjects[0], 'PP-MATH: 0 BE2', 'Genuine 0 is preserved with grade BE2');
    assert.strictEqual(bobSubjects[1], 'PP-PCA: X', 'Special status X is preserved');
    assert.strictEqual(bobSubjects[2], 'PP-CRE: Y', 'Special status Y is preserved');
    assert.strictEqual(bobSubjects[3], '', 'Unassessed subject is blank');
    assert.strictEqual(bobSubjects[4], '', 'Unassessed subject is blank');
  });

  // TEST 3: PP2 Header and rows contain exact configured learning-area codes
  await runTest('PP2 CSV Header and learner rows faithfully use PP-MATH, PP-PCA, PP-CRE, PP-ENV, PP-LANG', async () => {
    const pp2Students: Student[] = [
      { id: 's3', admission_number: 'ADM-03', full_name: 'Charlie Mwangi', gender: 'M', class_id: pp2Class.id, stream_id: pp2Class.id, grade: 'PP2', active: true }
    ];

    const pp2Marks: Mark[] = [
      { id: 'm10', exam_id: 'ex_01', student_id: 's3', subject_id: 'sb_pp_math', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
      { id: 'm11', exam_id: 'ex_01', student_id: 's3', subject_id: 'sb_pp_psy', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
      { id: 'm12', exam_id: 'ex_01', student_id: 's3', subject_id: 'sb_pp_re', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
      { id: 'm13', exam_id: 'ex_01', student_id: 's3', subject_id: 'sb_pp_env', marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
      { id: 'm14', exam_id: 'ex_01', student_id: 's3', subject_id: 'sb_pp_lang', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
    ];

    capturedBlob = null;
    downloadMeritListCSV({
      school: initialSchool,
      exam: initialExaminations[0],
      selectedClassId: pp2Class.id,
      selectedStreamId: 'all',
      classes: [pp2Class],
      teachers: initialTeachers,
      students: pp2Students,
      subjects: initialSubjects,
      marks: pp2Marks,
      grades: initialGrades
    });

    assert(capturedBlob, 'CSV was generated for PP2');
    const text = await capturedBlob.text();
    const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
    const headerLine = lines[3];
    const headers = parseCsvLine(headerLine);

    const expectedSubjects = ['PP-MATH', 'PP-PCA', 'PP-CRE', 'PP-ENV', 'PP-LANG'];
    const actualSubjectSlice = headers.slice(8, 13);
    assert.deepStrictEqual(actualSubjectSlice, expectedSubjects, `PP2 headers should match. Found: ${JSON.stringify(actualSubjectSlice)}`);

    const charlieLine = lines.find((l: string) => l.includes('CHARLIE MWANGI'));
    assert(charlieLine, 'Charlie row exists');
    const charlieCells = parseCsvLine(charlieLine);
    const charlieSubjects = charlieCells.slice(8, 13);

    assert.strictEqual(charlieSubjects[0], 'PP-MATH: 85 EE2');
    assert.strictEqual(charlieSubjects[1], 'PP-PCA: 90 EE1');
    assert.strictEqual(charlieSubjects[2], 'PP-CRE: 80 EE2');
    assert.strictEqual(charlieSubjects[3], 'PP-ENV: 75 EE2');
    assert.strictEqual(charlieSubjects[4], 'PP-LANG: 88 EE2');
  });

  // TEST 4: Lower Primary, Upper Primary and Junior Secondary regressions
  await runTest('Lower Primary and Junior School CSV column identities remain unaffected', async () => {
    // Junior School (Grade 7)
    const g7Class: ClassStream = {
      id: 'cls_7a',
      class_name: 'Grade 7',
      stream: 'North',
      education_level: 'Junior School',
      status: 'Active',
      allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts']
    };
    const g7Student: Student = {
      id: 's_g7',
      admission_number: 'ADM-G7',
      full_name: 'Junior Learner',
      gender: 'M',
      class_id: g7Class.id,
      stream_id: g7Class.id,
      grade: 'Grade 7',
      active: true
    };
    const g7Marks: Mark[] = [
      { id: 'mg1', exam_id: 'ex_01', student_id: 's_g7', subject_id: 'sb_mat', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' }
    ];

    capturedBlob = null;
    downloadMeritListCSV({
      school: initialSchool,
      exam: initialExaminations[0],
      selectedClassId: g7Class.id,
      selectedStreamId: 'all',
      classes: [g7Class],
      teachers: initialTeachers,
      students: [g7Student],
      subjects: initialSubjects,
      marks: g7Marks,
      grades: initialGrades
    });

    const g7Text = await capturedBlob.text();
    const g7Lines = g7Text.split('\n').filter((l: string) => l.trim().length > 0);
    const g7Headers = parseCsvLine(g7Lines[3]);
    // Should have standard JS CBE codes: ENG, KIS, MATH, INT-SCI, etc.
    assert(g7Headers.includes('ENG'), 'JS contains ENG');
    assert(g7Headers.includes('KIS'), 'JS contains KIS');
    assert(g7Headers.includes('MATH'), 'JS contains MATH');
    assert(!g7Headers.includes('PP-MATH'), 'JS does not contain PP-MATH');
  });

  console.log(`\n=== TEST SUMMARY: ${passed}/${total} PASSED ===`);
  if (passed === total) {
    console.log('ALL PP1/PP2 CSV LEARNING-AREA AUDIT TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
})();
