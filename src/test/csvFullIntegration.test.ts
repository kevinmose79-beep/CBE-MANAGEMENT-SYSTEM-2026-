import { describe, it, expect } from 'vitest';
import { parseLearnersCsv } from '../utils/csvLearnerParser';

describe('CSV Full Integration Pipeline Audit', () => {
  it('1. Upload / Paste Flow: Separate name columns produce complete full name and metadata', async () => {
    const rawCsv = `Admission Number,First Name,Second Name,Last Name,Gender
ADM-2026-001,Mercy,Chebet,Kipkemoi,F
ADM-2026-002,Peter,,Kamau,M`;

    const result = await parseLearnersCsv(rawCsv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);

    // Verify row mapping
    const row1 = result.data[0];
    expect(row1['Admission Number']).toBe('ADM-2026-001');
    expect(row1['First Name']).toBe('Mercy');
    expect(row1['Second Name']).toBe('Chebet');
    expect(row1['Last Name']).toBe('Kipkemoi');
    expect(row1['Gender']).toBe('F');
  });

  it('2. Excel UTF-8 BOM Flow: Removes BOM prefix from Admission Number header', async () => {
    const bomCsv = '\uFEFFAdmission Number,Full Name,Gender\nADM-2026-099,Faith Kerubo,F';
    const result = await parseLearnersCsv(bomCsv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]['Admission Number']).toBe('ADM-2026-099');
    expect(result.data[0]['Full Name']).toBe('Faith Kerubo');
  });

  it('3. Quoted Commas: Correctly parses names like "Otieno, Brian" without column misalignment', async () => {
    const quotedCsv = `Admission Number,Full Name,Gender
ADM-101,"Otieno, Brian",M
ADM-102,"Kamau, Mercy Chebet",F`;

    const result = await parseLearnersCsv(quotedCsv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Full Name']).toBe('Otieno, Brian');
    expect(result.data[0]['Gender']).toBe('M');
  });

  it('4. Delimiter Warning vs Fatal Error: Single column triggers non-fatal notice', async () => {
    const singleCol = 'Admission Number\nADM-001\nADM-002';
    const result = await parseLearnersCsv(singleCol);
    expect(result.errors).toHaveLength(0); // MUST NOT be treated as fatal
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
  });

  it('5. Fatal Error: Unclosed quoted string is flagged in errors', async () => {
    const malformed = 'Admission Number,Full Name,Gender\nADM-001,"Unclosed quote without end,M';
    const result = await parseLearnersCsv(malformed);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('6. Empty or Whitespace Input: Flags validation error cleanly', async () => {
    const empty = '   \n   \n';
    const result = await parseLearnersCsv(empty);
    expect(result.data).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('7. Stream Column Flow: Preserves Stream header data (e.g., "Blue", "Red") for per-row stream assignment', async () => {
    const streamCsv = `Admission Number,Full Name,Gender,Stream
ADM-2026-101,Kevin Mwangi,M,Blue
ADM-2026-102,Stacy Wanjiku,F,Red`;

    const result = await parseLearnersCsv(streamCsv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Stream']).toBe('Blue');
    expect(result.data[1]['Stream']).toBe('Red');
  });
});
