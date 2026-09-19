import { describe, it, expect, vi } from 'vitest';
import autoTable from 'jspdf-autotable';
import { downloadMeritListPDF, MeritListData } from '../services/meritListExporter';
import { School, Examination, ClassStream, Subject, Mark, Grade, Student } from '../types';

let capturedAutoTableConfigs: any[] = [];

// Intercept autoTable to capture the table config and didDrawCell callback
vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn((doc: any, config: any) => {
      doc.lastAutoTable = { finalY: 100 };
      capturedAutoTableConfigs.push({ doc, config });
    }),
  };
});

// Mock file downloader so PDF generation doesn't trigger file saving in Node environment
vi.mock('../utils/fileDownloader', () => ({
  savePdf: vi.fn(),
  saveFile: vi.fn(),
}));

describe('Merit List Red Bold X Forensic Verification Suite', () => {
  const mockSchool: School = {
    id: 'sch-01',
    school_name: 'ST. TERESA CBE ACADEMY',
    school_code: 'ST-001',
    county: 'Nairobi',
    email: 'info@st-teresa.edu',
  };

  const mockExam: Examination = {
    id: 'ex-01',
    exam_name: 'Term 2 End-Term Examination',
    term: 'Term 2',
    year: 2026,
    education_level: 'Junior School',
    academic_year_id: 'ay-2026',
    term_id: 'term-2',
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const mockClasses: ClassStream[] = [
    { id: 'cls-8a', class_name: 'Grade 8', stream: 'A', education_level: 'Junior School' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sb-01', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-02', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
  ];

  const mockStudents: Student[] = [
    { id: 'std-01', full_name: 'Amina Hassan', admission_number: 'ADM-001', class_id: 'cls-8a', gender: 'F', active: true },
    { id: 'std-02', full_name: 'Susan Wangari', admission_number: 'ADM-002', class_id: 'cls-8a', gender: 'F', active: true },
  ];

  const mockMarks: Mark[] = [
    // Amina has normal marks
    { id: 'mk-01', student_id: 'std-01', subject_id: 'sb-01', exam_id: 'ex-01', marks: 89, raw_score: 89, out_of: 100, special_status: 'Normal' },
    { id: 'mk-02', student_id: 'std-01', subject_id: 'sb-02', exam_id: 'ex-01', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    // Susan has X in Maths, normal in English
    { id: 'mk-03', student_id: 'std-02', subject_id: 'sb-01', exam_id: 'ex-01', marks: null, raw_score: null, out_of: 100, special_status: 'X' },
    { id: 'mk-04', student_id: 'std-02', subject_id: 'sb-02', exam_id: 'ex-01', marks: 82, raw_score: 82, out_of: 100, special_status: 'Normal' },
  ];

  const mockGrades: Grade[] = [
    { id: 'gr-01', grade: 'EE1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Outstanding', descriptor: 'Exceeding Expectations' },
    { id: 'gr-02', grade: 'EE2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Excellent', descriptor: 'Exceeding Expectations' },
    { id: 'gr-03', grade: 'ME1', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Good', descriptor: 'Meeting Expectations' },
  ];

  it('verifies that didDrawCell executes with bold font and red (220, 38, 38) text color for X', async () => {
    capturedAutoTableConfigs = [];

    const meritData: MeritListData = {
      school: mockSchool,
      exam: mockExam,
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      students: mockStudents,
      teachers: [],
      selectedClassId: 'cls-8a',
      selectedStreamId: 'cls-8a',
      generatedBy: 'System Admin',
    };

    await downloadMeritListPDF(meritData);

    expect(capturedAutoTableConfigs.length).toBeGreaterThan(0);
    const mainTable = capturedAutoTableConfigs[0];
    const { doc, config } = mainTable;
    expect(config.didDrawCell).toBeDefined();

    // Find the row index for Susan Wangari
    const susanRowIdx = config.body.findIndex((row: any[]) => String(row[2]).toUpperCase().includes('SUSAN WANGARI'));
    expect(susanRowIdx).toBeGreaterThanOrEqual(0);

    // Subject columns:
    // Headers: # (0), ADM (1), NAME (2), G (3), STR (4), STR POS (5), OVR POS (6), PRV STR (7), PRV OVR (8), MAT (9), ENG (10)...
    const mathsColIdx = 9;
    expect(config.body[susanRowIdx][mathsColIdx]).toBe('X');

    // Track mock doc calls during didDrawCell
    const fontCalls: Array<{ fontName: string; fontStyle?: string }> = [];
    const colorCalls: Array<{ r: number; g: number; b: number }> = [];
    const textCalls: Array<{ text: string; x: number; y: number; options?: any }> = [];

    const mockDoc = {
      setFont: (name: string, style?: string) => fontCalls.push({ fontName: name, fontStyle: style }),
      setFontSize: vi.fn(),
      setTextColor: (r: number, g: number, b: number) => colorCalls.push({ r, g, b }),
      getTextWidth: () => 3.5,
      text: (text: string, x: number, y: number, options?: any) => textCalls.push({ text, x, y, options }),
    };

    // Execute didDrawCell for Susan's Maths cell (containing 'X')
    const cellData = {
      section: 'body',
      column: { index: mathsColIdx },
      row: { index: susanRowIdx },
      cell: { x: 100, y: 50, width: 12, height: 4 },
      doc: mockDoc,
    };

    // Assign mockDoc to doc or closure
    // In meritListExporter, `doc` from the outer closure is used directly.
    // Let's spy on the actual doc that meritListExporter created:
    const origSetFont = doc.setFont;
    const origSetTextColor = doc.setTextColor;
    const origText = doc.text;

    doc.setFont = (name: string, style?: string) => {
      fontCalls.push({ fontName: name, fontStyle: style });
      if (origSetFont) origSetFont.call(doc, name, style);
    };
    doc.setTextColor = (r: number, g: number, b: number) => {
      colorCalls.push({ r, g, b });
      if (origSetTextColor) origSetTextColor.call(doc, r, g, b);
    };
    doc.text = (text: string, x: number, y: number, options?: any) => {
      textCalls.push({ text, x, y, options });
      if (origText) origText.call(doc, text, x, y, options);
    };

    try {
      config.didDrawCell(cellData);

      // Verify that 'X' was printed
      expect(textCalls).toContainEqual(expect.objectContaining({ text: 'X' }));

      // Verify that setFont('helvetica', 'bold') was called for 'X'
      expect(fontCalls).toContainEqual({ fontName: 'helvetica', fontStyle: 'bold' });

      // Verify that setTextColor(220, 38, 38) was called for 'X'
      expect(colorCalls).toContainEqual({ r: 220, g: 38, b: 38 });
    } finally {
      doc.setFont = origSetFont;
      doc.setTextColor = origSetTextColor;
      doc.text = origText;
    }
  });

  it('verifies that normal marks are drawn in normal font weight and black text', async () => {
    const mainTable = capturedAutoTableConfigs[0];
    const { doc, config } = mainTable;

    // Amina's Maths cell has score 89 -> '89 EE2'
    const aminaRowIdx = config.body.findIndex((row: any[]) => String(row[2]).toUpperCase().includes('AMINA HASSAN'));
    const mathsColIdx = 9;
    expect(config.body[aminaRowIdx][mathsColIdx]).toBe('89 EE2');

    const fontCalls: Array<{ fontName: string; fontStyle?: string }> = [];
    const colorCalls: Array<{ r: number; g: number; b: number }> = [];
    const textCalls: Array<{ text: string; x: number; y: number; options?: any }> = [];

    const origSetFont = doc.setFont;
    const origSetTextColor = doc.setTextColor;
    const origText = doc.text;

    doc.setFont = (name: string, style?: string) => {
      fontCalls.push({ fontName: name, fontStyle: style });
      if (origSetFont) origSetFont.call(doc, name, style);
    };
    doc.setTextColor = (r: number, g: number, b: number) => {
      colorCalls.push({ r, g, b });
      if (origSetTextColor) origSetTextColor.call(doc, r, g, b);
    };
    doc.text = (text: string, x: number, y: number, options?: any) => {
      textCalls.push({ text, x, y, options });
      if (origText) origText.call(doc, text, x, y, options);
    };

    try {
      const cellData = {
        section: 'body',
        column: { index: mathsColIdx },
        row: { index: aminaRowIdx },
        cell: { x: 100, y: 50, width: 12, height: 4 },
        doc,
      };
      config.didDrawCell(cellData);

      // Normal mark: font is 'helvetica', 'normal'
      expect(fontCalls).toContainEqual({ fontName: 'helvetica', fontStyle: 'normal' });

      // Normal mark text color is black (0, 0, 0)
      expect(colorCalls).toContainEqual({ r: 0, g: 0, b: 0 });

      // It must NOT have called red (220, 38, 38)
      expect(colorCalls).not.toContainEqual({ r: 220, g: 38, b: 38 });
    } finally {
      doc.setFont = origSetFont;
      doc.setTextColor = origSetTextColor;
      doc.text = origText;
    }
  });
});
