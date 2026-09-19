import rawJsPDF from 'jspdf';
const jsPDF = (rawJsPDF as any).jsPDF || rawJsPDF;
import type { MeritListData } from './meritListExporter';

console.log('=== RUNNING UPPER PRIMARY HEADER VERIFICATION TESTS ===');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✓ PASS: ${msg}`);
    passCount++;
  } else {
    console.error(`✗ FAIL: ${msg}`);
    failCount++;
  }
}

// Intercept jsPDF instance methods to audit lines, rects, and text in the header area
const OriginalJsPDF = (rawJsPDF as any).jsPDF || rawJsPDF;

const drawnRects: Array<{ x: number; y: number; w: number; h: number }> = [];
const drawnLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
const renderedTexts: Array<{ text: string; x: number; y: number }> = [];

function WrappedJsPDF(...args: any[]) {
  const instance = new OriginalJsPDF(...args);
  const origRect = instance.rect.bind(instance);
  instance.rect = function (...rArgs: any[]) {
    drawnRects.push({ x: rArgs[0], y: rArgs[1], w: rArgs[2], h: rArgs[3] });
    return origRect(...rArgs);
  };
  const origLine = instance.line.bind(instance);
  instance.line = function (...lArgs: any[]) {
    drawnLines.push({ x1: lArgs[0], y1: lArgs[1], x2: lArgs[2], y2: lArgs[3] });
    return origLine(...lArgs);
  };
  const origText = instance.text.bind(instance);
  instance.text = function (...tArgs: any[]) {
    const t = tArgs[0];
    if (typeof t === 'string') {
      renderedTexts.push({ text: t, x: tArgs[1], y: tArgs[2] });
    } else if (Array.isArray(t)) {
      renderedTexts.push({ text: t.join(' '), x: tArgs[1], y: tArgs[2] });
    }
    return origText(...tArgs);
  };
  return instance;
}
WrappedJsPDF.prototype = OriginalJsPDF.prototype;
(rawJsPDF as any).jsPDF = WrappedJsPDF;
(rawJsPDF as any).default = WrappedJsPDF;

// Mock mockUpperPrimaryData
const mockData: MeritListData = {
  school: { school_name: 'Muchorwe Comprehensive School' } as any,
  exam: {
    id: 'exam_up_1',
    exam_name: 'GRADE 6 OPENER ASSESSMENT TERM 3 2026',
    term: 'Term 3',
    year: 2026,
  } as any,
  classes: [
    { id: 'cls_g6_b', class_name: 'Grade 6', stream: 'Blue', education_level: 'Upper Primary' },
    { id: 'cls_g6_r', class_name: 'Grade 6', stream: 'Red', education_level: 'Upper Primary' },
  ] as any,
  teachers: [],
  students: [
    { id: 's1', full_name: 'Samuel Kuria', admission_number: 'ADM001', class_id: 'cls_g6_b', active: true },
  ] as any,
  marks: [],
  grades: [],
  subjects: [
    { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sub_comp', subject_name: 'English Composition', subject_code: 'COMP', education_level: 'Upper Primary', category: 'Core' },
  ] as any,
  selectedClassId: 'cls_g6_b',
  selectedStreamId: '',
};

async function runTests() {
  const { downloadMeritListPDF } = await import('./meritListExporter');
  drawnRects.length = 0;
  drawnLines.length = 0;
  renderedTexts.length = 0;

  // Execute Upper Primary export
  await (downloadMeritListPDF as any)(mockData);

  // Check header region: Y < 26mm
  const headerRects = drawnRects.filter((r) => r.y < 26);
  const headerLines = drawnLines.filter((l) => l.y1 < 26 || l.y2 < 26);

  assert(headerRects.length === 0, `Upper Primary header has NO rect/boxes/borders (found: ${headerRects.length})`);
  assert(headerLines.length === 0, `Upper Primary header has NO dividing lines or underlines (found: ${headerLines.length})`);

  const schoolNameTexts = renderedTexts.filter((t) => t.text.includes('MUCHORWE COMPREHENSIVE SCHOOL'));
  assert(schoolNameTexts.length > 0, `School name is present in header (found: ${schoolNameTexts.length})`);

  const reportTitleTexts = renderedTexts.filter((t) => t.text.includes("REPORT: LEARNERS' PERFORMANCE MERIT LIST"));
  assert(reportTitleTexts.length > 0, `Report title is present in header (found: ${reportTitleTexts.length})`);

  const classTeacherTexts = renderedTexts.filter((t) => t.text.includes('CLASS TEACHERS: '));
  assert(classTeacherTexts.length > 0, `Class teachers label is present in header (found: ${classTeacherTexts.length})`);

  console.log('==================================================');
  console.log(`UPPER PRIMARY HEADER TESTS: ${passCount}/${passCount + failCount} PASSED`);
  console.log('==================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test crashed:', e);
  process.exit(1);
});
