import { describe, it, expect } from 'vitest';
import { parseLearnersCsv } from '../utils/csvLearnerParser';

describe('Forensic CSV Parser Audit & Verification Suite', () => {
  it('1. Parses standard Comma-Separated Values (CSV)', async () => {
    const csv = 'Admission Number,First Name,Second Name,Last Name,Gender\nADM-001,Mercy,Chebet,Kipkemoi,F\nADM-002,Peter,,Kamau,M\n';
    const result = await parseLearnersCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
    expect(result.data[0]['First Name']).toBe('Mercy');
    expect(result.data[0]['Gender']).toBe('F');
    expect(result.meta.delimiter).toBe(',');
  });

  it('2. Parses Semicolon-Separated Values (European / Excel locale format)', async () => {
    const csv = 'Admission Number;First Name;Last Name;Gender\nADM-001;Mercy;Chebet;F\nADM-002;Peter;Kamau;M\n';
    const result = await parseLearnersCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
    expect(result.data[0]['First Name']).toBe('Mercy');
    expect(result.meta.delimiter).toBe(';');
  });

  it('3. Parses Tab-Separated Values (TSV / copied from spreadsheets)', async () => {
    const tsvData = 'Admission Number\tFull Name\tGender\nADM-001\tFaith Kerubo\tF\nADM-002\tBrian Otieno\tM\n';
    const result = await parseLearnersCsv(tsvData);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
    expect(result.data[0]['Full Name']).toBe('Faith Kerubo');
    expect(result.meta.delimiter).toBe('\t');
  });

  it('4. Handles Empty CSV safely', async () => {
    const emptyCsv = '';
    const result = await parseLearnersCsv(emptyCsv);
    expect(result.data).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('5. Handles CSV containing only headers', async () => {
    const headerOnly = 'Admission Number,First Name,Last Name,Gender\n';
    const result不易 = await parseLearnersCsv(headerOnly);
    expect(result不易.errors).toHaveLength(0);
    expect(result不易.data).toHaveLength(0);
  });

  it('6. Handles CSV with missing values in optional fields', async () => {
    const csv = 'Admission Number,First Name,Second Name,Last Name,Gender\nADM-001,Mercy,,Kipkemoi,F\nADM-002,Peter,Kamau,,M\n';
    const result = await parseLearnersCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Second Name']).toBe('');
    expect(result.data[1]['Last Name']).toBe('');
  });

  it('7. Handles CSV with extra unexpected columns', async () => {
    const csv = 'Admission Number,Full Name,Gender,ExtraInfo,Notes\nADM-001,Mercy Chebet,F,Hostel 1,Prefect\n';
    const result = await parseLearnersCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
    expect(result.data[0]['ExtraInfo']).toBe('Hostel 1');
  });

  it('8. Handles Commas inside quoted strings properly (e.g. "Otieno, Brian")', async () => {
    const csv = 'Admission Number,Full Name,Gender\nADM-001,"Otieno, Brian",M\nADM-002,"Kamau, Mercy Chebet",F\n';
    const result = await parseLearnersCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Full Name']).toBe('Otieno, Brian');
    expect(result.data[0]['Gender']).toBe('M');
  });

  it('9. Handles Inconsistent column counts without crashing or blocking valid data', async () => {
    const csv = 'Admission Number,First Name,Last Name,Gender\nADM-001,Mercy,Chebet,F\nADM-002,Peter,Kamau\n';
    const result = await parseLearnersCsv(csv);
    // Should record row warning rather than aborting the entire batch
    expect(result.data).toHaveLength(2);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
    expect(result.data[1]['Admission Number']).toBe('ADM-002');
  });

  it('10. Handles Windows CRLF line endings (\\r\\n)', async () => {
    const csv = 'Admission Number,First Name,Last Name,Gender\r\nADM-001,Mercy,Chebet,F\r\nADM-002,Peter,Kamau,M\r\n';
    const result = await parseLearnersCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[1]['First Name']).toBe('Peter');
  });

  it('11. Handles UTF-8 with BOM (Byte Order Mark \\uFEFF) from Excel exports', async () => {
    const csvWithBom有很多 = '\uFEFFAdmission Number,First Name,Last Name,Gender\nADM-001,Mercy,Chebet,F\n';
    const result = await parseLearnersCsv(csvWithBom有很多);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    // Header should be cleaned without BOM prefix
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
  });

  it('12. Handles single-column input without fatal failure on auto-detect delimiting warning', async () => {
    // This exact condition generated: "CSV Error: Unable to auto-detect delimiting character; defaulted to ','"
    const singleCol = 'Admission Number\nADM-001\nADM-002\nADM-003\n';
    const result = await parseLearnersCsv(singleCol);
    expect(result.errors).toHaveLength(0); // Should NOT have fatal errors
    expect(result.warnings.length).toBeGreaterThanOrEqual(1); // Warning recorded cleanly
    expect(result.data).toHaveLength(3);
    expect(result.data[0]['Admission Number']).toBe('ADM-001');
    expect(result.data[1]['Admission Number']).toBe('ADM-002');
    expect(result.data[2]['Admission Number']).toBe('ADM-003');
  });
});
