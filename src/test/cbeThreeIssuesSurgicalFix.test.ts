import fs from 'fs';
import path from 'path';

console.log('=== RUNNING CBE THREE ISSUES SURGICAL FIX VERIFICATION ===\n');

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

// ==========================================
// TEST 1: Teacher Allocations (TeacherManagement.tsx)
// ==========================================
const teacherMgmtPath = path.resolve('src/components/TeacherManagement.tsx');
const teacherMgmtContent = fs.readFileSync(teacherMgmtPath, 'utf8');

assert(
  teacherMgmtContent.includes('class_id: assignedClassObj?.id || assignedStreamId') &&
  teacherMgmtContent.includes('stream_id: assignedClassObj?.stream_id || assignedStreamId'),
  'TeacherManagement: Class teacher default allocations explicitly populate both class_id and stream_id'
);

assert(
  !teacherMgmtContent.includes('class_id: assignedStreamId,\n          class_name: assignedClassObj?.class_name'),
  'TeacherManagement: Removed assigning stream UUID into class_id without stream_id'
);

// ==========================================
// TEST 2: Marks Entry Dropdown & Badge (MarksEntryTable.tsx)
// ==========================================
const marksEntryPath = path.resolve('src/components/MarksEntryTable.tsx');
const marksEntryContent = fs.readFileSync(marksEntryPath, 'utf8');

assert(
  marksEntryContent.includes('Class & Stream *</label>'),
  'MarksEntryTable: Dropdown label uses truthful "Class & Stream *"'
);

assert(
  marksEntryContent.includes('<option value="">Select Class & Stream</option>'),
  'MarksEntryTable: Dropdown placeholder uses truthful "Select Class & Stream"'
);

assert(
  marksEntryContent.includes('<span>Class & Stream: {selectedClass ? `${selectedClass.class_name} ${selectedClass.stream}` : \'Select Class & Stream\'}</span>'),
  'MarksEntryTable: Status badge specifies "Class & Stream:"'
);

// ==========================================
// TEST 3: Stream Deletion Modal (ClassSubjectManagement.tsx)
// ==========================================
const classSubPath = path.resolve('src/components/ClassSubjectManagement.tsx');
const classSubContent = fs.readFileSync(classSubPath, 'utf8');

assert(
  classSubContent.includes('<h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Stream</h3>'),
  'ClassSubjectManagement: Modal title clearly and truthfully says "Delete Stream"'
);

assert(
  !classSubContent.includes('<h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Class Stream</h3>'),
  'ClassSubjectManagement: Removed ambiguous "Delete Class Stream" title'
);

assert(
  classSubContent.includes('Confirm Delete Stream'),
  'ClassSubjectManagement: Confirmation button specifically states "Confirm Delete Stream"'
);

assert(
  classSubContent.includes('onDeleteStream(deletingClass.stream_id)') || classSubContent.includes('api.deleteStream(deletingClass.stream_id)'),
  'ClassSubjectManagement: Deletion strictly invokes stream deletion via deletingClass.stream_id'
);

console.log(`\n==================================================`);
console.log(`TOTAL TESTS: ${total}, PASSED: ${passed}, FAILED: ${total - passed}`);
console.log(`==================================================`);

if (passed !== total) {
  process.exit(1);
}
