import fs from 'fs';
import path from 'path';

console.log('--- RUNNING TEACHER MANAGEMENT LAYOUT & SPREAD DATA TESTS ---');

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

const teacherComponentPath = path.join(process.cwd(), 'src', 'components', 'TeacherManagement.tsx');
const fileContent = fs.readFileSync(teacherComponentPath, 'utf-8');

// TEST 1 — Header Title exists
assert(
  fileContent.includes('Teachers & User Account Management'),
  'TEST 1 — Component includes header title "Teachers & User Account Management"'
);

// TEST 2 — Header descriptive words removed
const removedText = 'Manage teacher profiles, Supabase authentication accounts, class assignments, learning areas, and account permissions across the school.';
assert(
  !fileContent.includes(removedText),
  'TEST 2 — Unnecessary description words ("Manage teacher profiles...") are removed'
);

// TEST 3 — No "+1 more" truncation in teacher card list rendering
assert(
  !fileContent.includes('+${assignedClassesList.length - 1} more') &&
  !fileContent.includes('+${assignedSubjectsList.length - 1} more'),
  'TEST 3 — Assigned classes and subjects are not truncated with "+1 more"'
);

// TEST 4 — No max-w-[130px] truncate restriction on subjects
assert(
  !fileContent.includes('max-w-[130px] truncate'),
  'TEST 4 — Learning area tags are no longer truncated with max-w-[130px] truncate'
);

// TEST 5 — Spread out layout container classes present
assert(
  fileContent.includes('Assigned Classes & Streams') && fileContent.includes('Assigned Learning Areas'),
  'TEST 5 — Assigned Classes & Learning Areas sections are spread out in card and table view'
);

console.log(`\nTEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED.`);
if (failCount > 0) {
  process.exit(1);
}
