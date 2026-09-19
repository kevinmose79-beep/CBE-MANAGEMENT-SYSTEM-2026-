import { describe, it, expect } from 'vitest';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';

describe('Calculation Validation UX Error Message Translation Tests', () => {
  const primaryDefectError =
    'Calculation Engine Validation Failed:\n' +
    'Student result 30 (9c188d60-598c-4cb7-bcdb-45f80c9abf64): total marks obtained (133) exceeds maximum (130).\n' +
    'Student result 32 (7eb41e04-858c-482f-9fdc-7cdec737192c): total marks obtained (70) exceeds maximum (30).\n' +
    'Student result 40 (930636ad-3677-414f-b88a-f935f24532e3): total marks obtained (133) exceeds maximum (130).';

  it('Primary Defect: translates technical validation failure into plain English without UUIDs', () => {
    const userMsg = getUserFriendlyErrorMessage(primaryDefectError);

    // Must contain plain English header and guidance
    expect(userMsg).toContain('Some marks need to be checked.');
    expect(userMsg).toContain('The following learners have marks above the maximum allowed:');
    expect(userMsg).toContain('Please review the affected marks before continuing.');

    // Must contain bullet points for each learner result
    expect(userMsg).toContain('• Learner 30 — 133 marks entered; maximum allowed is 130.');
    expect(userMsg).toContain('• Learner 32 — 70 marks entered; maximum allowed is 30.');
    expect(userMsg).toContain('• Learner 40 — 133 marks entered; maximum allowed is 130.');

    // MUST NOT expose raw UUIDs
    expect(userMsg).not.toContain('9c188d60-598c-4cb7-bcdb-45f80c9abf64');
    expect(userMsg).not.toContain('7eb41e04-858c-482f-9fdc-7cdec737192c');
    expect(userMsg).not.toContain('930636ad-3677-414f-b88a-f935f24532e3');
    expect(userMsg).not.toContain('Calculation Engine Validation Failed');
  });

  it('Translates with student display names when student roster is provided', () => {
    const students = [
      { id: '9c188d60-598c-4cb7-bcdb-45f80c9abf64', first_name: 'John', last_name: 'Doe' },
      { id: '7eb41e04-858c-482f-9fdc-7cdec737192c', first_name: 'Jane', last_name: 'Smith' },
      { id: '930636ad-3677-414f-b88a-f935f24532e3', first_name: 'Alex', last_name: 'Kip' },
    ];

    const userMsg = getUserFriendlyErrorMessage(primaryDefectError, undefined, { students });

    expect(userMsg).toContain('• John Doe — 133 marks entered; maximum allowed is 130.');
    expect(userMsg).toContain('• Jane Smith — 70 marks entered; maximum allowed is 30.');
    expect(userMsg).toContain('• Alex Kip — 133 marks entered; maximum allowed is 130.');
  });

  it('Sanitizes generic technical messages containing UUIDs to fallback message', () => {
    const rawWithUuid = 'Error updating row in table students with ID 9c188d60-598c-4cb7-bcdb-45f80c9abf64: internal query failure';
    const userMsg = getUserFriendlyErrorMessage(rawWithUuid, 'Unable to update student. Please try again.');

    expect(userMsg).toBe('Unable to update student. Please try again.');
    expect(userMsg).not.toContain('9c188d60-598c-4cb7-bcdb-45f80c9abf64');
  });
});
