import fs from 'fs';
import path from 'path';

console.log('=== RUNNING MARKS ENTRY LEARNING AREA TERMINOLOGY TESTS ===\n');

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

const marksEntryPath = path.resolve('src/components/MarksEntryTable.tsx');
const marksEntryContent = fs.readFileSync(marksEntryPath, 'utf8');

// 1. Check Filter Header
assert(
  marksEntryContent.includes('Select Target Assessment, Class, Learning Area & Assessment Out Of Grid'),
  'Filter header uses "Learning Area"'
);
assert(
  !marksEntryContent.includes('Select Target Assessment, Class, Subject & Assessment Out Of Grid'),
  'Old filter header with "Subject" is removed'
);

// 2. Check Input Label
assert(
  marksEntryContent.includes('Learning Area *</label>'),
  'Input label uses "Learning Area *"'
);
assert(
  !marksEntryContent.includes('Subject *</label>'),
  'Old label "Subject *" is removed'
);

// 3. Check Select Option Placeholder
assert(
  marksEntryContent.includes('<option value="">Select Learning Area</option>'),
  'Select option uses "Select Learning Area"'
);
assert(
  !marksEntryContent.includes('<option value="">Select Subject</option>'),
  'Old placeholder "Select Subject" is removed'
);

// 4. Check Selection Prompt description & badge
assert(
  marksEntryContent.includes('Please explicitly select an <strong>Assessment</strong>, <strong>Class/Stream</strong>, <strong>Learning Area</strong>'),
  'Selection prompt uses "Learning Area"'
);
assert(
  marksEntryContent.includes("Learning Area: {selectedSubject ? selectedSubject.subject_name : 'Select Learning Area'}"),
  'Status badge displays "Learning Area: ..."'
);

// 5. Check Export Buttons & Messages
assert(
  marksEntryContent.includes('Raw Marks — All Learning Areas'),
  'Export button uses "Raw Marks — All Learning Areas"'
);
assert(
  marksEntryContent.includes('Please select Assessment, Class, and Learning Area to export learning area performance report.'),
  'Performance export error uses "Learning Area"'
);

console.log(`\n==================================================`);
console.log(`TOTAL TESTS: ${total}, PASSED: ${passed}, FAILED: ${total - passed}`);
console.log(`==================================================`);

if (passed !== total) {
  process.exit(1);
}
