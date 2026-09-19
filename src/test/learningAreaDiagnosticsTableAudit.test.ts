import { test, assert } from 'vitest';
import fs from 'fs';
import path from 'path';

test('LearningAreaDiagnosticsTable uses canonical subject_name and subject_code properties', () => {
  const filePath = path.resolve(process.cwd(), 'src/components/analysis-validation/LearningAreaDiagnosticsTable.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Verify canonical property usage
  assert(
    fileContent.includes('item.subject.subject_name'),
    'Component must access item.subject.subject_name'
  );
  assert(
    fileContent.includes('item.subject.subject_code'),
    'Component must access item.subject.subject_code'
  );

  // Verify that deprecated item.subject.name and item.subject.code do NOT exist
  assert(
    !fileContent.includes('item.subject.name'),
    'Component must NOT contain item.subject.name'
  );
  assert(
    !fileContent.includes('item.subject.code\n') && !fileContent.includes('item.subject.code.'),
    'Component must NOT contain item.subject.code'
  );
});
