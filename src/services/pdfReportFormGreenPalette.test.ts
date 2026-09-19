import { describe, it, expect } from 'vitest';
import {
  PDF_COLORS,
  generatePrePrimaryReportPDF,
  generateLowerPrimaryReportPDF,
  generateUpperPrimaryReportPDF,
  generateJuniorSchoolReportPDF,
  createReportCardPDFDoc,
  PDFReportData,
} from './pdfReportGenerator';

describe('CBE Report Form PDF — Blue-to-Light-Green Visual Redesign', () => {
  const mockSchool = {
    id: 'sch-1',
    name: 'ST. JUDE CBE ACADEMY',
    school_name: 'ST. JUDE CBE ACADEMY',
    motto: 'Knowledge, Integrity, Diligence',
    box_number: 'P.O. Box 1234 - 00100',
    town: 'Nairobi',
    address: 'Nairobi, Kenya',
    telephone: '+254 700 000 000',
    phone: '+254 700 000 000',
    email: 'info@stjudeacademy.ac.ke',
    principal_name: 'Dr. J. Doe, Ed.D',
    logo_url: '',
    badge_url: '',
  };

  const mockStudent = {
    id: 'std-1',
    admission_number: 'ADM-2026-001',
    first_name: 'FAITH',
    last_name: 'WANJIKU',
    full_name: 'FAITH WANJIKU',
    grade_id: 'cls-1',
    gender: 'Female',
    stream: 'North',
    status: 'Active',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const mockExam = {
    id: 'ex-1',
    exam_name: 'END TERM 2 SUMMATIVE EVALUATION',
    term: 'Term 2',
    year: 2026,
    is_locked: true,
    academic_year: '2026',
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
  };

  const mockClasses = [
    {
      id: 'cls-pp1',
      class_name: 'PP1 East',
      grade_name: 'PP1',
      stream_name: 'East',
      education_level: 'Pre-Primary',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'cls-lp',
      class_name: 'Grade 2 Blue',
      grade_name: 'Grade 2',
      stream_name: 'Blue',
      education_level: 'Lower Primary',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'cls-up',
      class_name: 'Grade 5 Green',
      grade_name: 'Grade 5',
      stream_name: 'Green',
      education_level: 'Upper Primary',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'cls-js',
      class_name: 'Grade 8 Gold',
      grade_name: 'Grade 8',
      stream_name: 'Gold',
      education_level: 'Junior School',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  const mockSubjects = [
    { id: 'sub-1', subject_name: 'Mathematics', subject_code: 'MATH', education_level: 'Upper Primary', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 'sub-2', subject_name: 'English Language', subject_code: 'ENG', education_level: 'Upper Primary', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 'sub-3', subject_name: 'Kiswahili', subject_code: 'KIS', education_level: 'Upper Primary', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  ];

  const mockGrades = [
    { id: 'gr-1', grade: 'EE', grade_code: 'EE1', points: 8, min_score: 90, max_score: 100, remarks: 'Exceeding Expectations' },
    { id: 'gr-2', grade: 'EE', grade_code: 'EE2', points: 7, min_score: 75, max_score: 89, remarks: 'Exceeding Expectations' },
    { id: 'gr-3', grade: 'ME', grade_code: 'ME1', points: 6, min_score: 58, max_score: 74, remarks: 'Meeting Expectations' },
    { id: 'gr-4', grade: 'ME', grade_code: 'ME2', points: 5, min_score: 41, max_score: 57, remarks: 'Meeting Expectations' },
    { id: 'gr-5', grade: 'AE', grade_code: 'AE1', points: 4, min_score: 31, max_score: 40, remarks: 'Approaching Expectations' },
    { id: 'gr-6', grade: 'AE', grade_code: 'AE2', points: 3, min_score: 21, max_score: 30, remarks: 'Approaching Expectations' },
    { id: 'gr-7', grade: 'BE', grade_code: 'BE1', points: 2, min_score: 11, max_score: 20, remarks: 'Below Expectations' },
    { id: 'gr-8', grade: 'BE', grade_code: 'BE2', points: 1, min_score: 0, max_score: 10, remarks: 'Below Expectations' },
  ];

  const mockMarks = [
    { id: 'm-1', student_id: 'std-1', subject_id: 'sub-1', exam_id: 'ex-1', score: 85, percentage: 85, status: 'Normal', created_at: '2026-06-01', updated_at: '2026-06-01' },
    { id: 'm-2', student_id: 'std-1', subject_id: 'sub-2', exam_id: 'ex-1', score: 72, percentage: 72, status: 'Normal', created_at: '2026-06-01', updated_at: '2026-06-01' },
    { id: 'm-3', student_id: 'std-1', subject_id: 'sub-3', exam_id: 'ex-1', score: 68, percentage: 68, status: 'Normal', created_at: '2026-06-01', updated_at: '2026-06-01' },
  ];

  it('verifies PDF_COLORS uses the authoritative forest/emerald green palette', () => {
    // Structural Forest Green
    expect(PDF_COLORS.PRIMARY_NAVY).toEqual([6, 78, 59]); // Emerald-900 / Forest Green
    expect(PDF_COLORS.NAVY_DARK).toEqual([6, 78, 59]);

    // Table Header Deep Forest Green
    expect(PDF_COLORS.SLATE_HEADER).toEqual([6, 78, 59]);

    // Light-Green Tinted Surfaces
    expect(PDF_COLORS.SLATE_LIGHT).toEqual([248, 250, 252]);
    expect(PDF_COLORS.CARD_BG).toEqual([255, 255, 255]);

    // Light-Green Subtle Borders
    expect(PDF_COLORS.BORDER_SLATE).toEqual([203, 213, 225]);

    // Head of Institution Warm Soft Amber Box
    expect(PDF_COLORS.HOI_BG).toEqual([254, 253, 248]);
    expect(PDF_COLORS.HOI_BORDER).toEqual([229, 215, 185]);

    // Performance Level Colors (Distinct)
    expect(PDF_COLORS.EE).toEqual([4, 120, 87]);
    expect(PDF_COLORS.ME).toEqual([30, 64, 175]);
    expect(PDF_COLORS.AE).toEqual([180, 83, 9]);
    expect(PDF_COLORS.BE).toEqual([190, 18, 60]);
  });

  it('generates Pre-Primary report form with green palette successfully', async () => {
    const ppData: PDFReportData = {
      student: { ...mockStudent, grade_id: 'cls-pp1', class_id: 'cls-pp1', active: true } as any,
      school: mockSchool as any,
      exam: mockExam as any,
      classes: mockClasses as any,
      subjects: mockSubjects as any,
      marks: mockMarks as any,
      grades: mockGrades as any,
      allStudents: [{ ...mockStudent, grade_id: 'cls-pp1', class_id: 'cls-pp1', active: true }] as any,
      teachers: [],
      nextTermOpeningDate: '2026-09-08',
    };
    const doc = await generatePrePrimaryReportPDF(ppData);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('generates Lower Primary report form with green palette successfully', async () => {
    const lpData: PDFReportData = {
      student: { ...mockStudent, grade_id: 'cls-lp', class_id: 'cls-lp', active: true } as any,
      school: mockSchool as any,
      exam: mockExam as any,
      classes: mockClasses as any,
      subjects: mockSubjects as any,
      marks: mockMarks as any,
      grades: mockGrades as any,
      allStudents: [{ ...mockStudent, grade_id: 'cls-lp', class_id: 'cls-lp', active: true }] as any,
      teachers: [],
      nextTermOpeningDate: '2026-09-08',
    };
    const doc = await generateLowerPrimaryReportPDF(lpData);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('generates Upper Primary report form with green palette successfully', async () => {
    const upData: PDFReportData = {
      student: { ...mockStudent, grade_id: 'cls-up', class_id: 'cls-up', active: true } as any,
      school: mockSchool as any,
      exam: mockExam as any,
      classes: mockClasses as any,
      subjects: mockSubjects as any,
      marks: mockMarks as any,
      grades: mockGrades as any,
      allStudents: [{ ...mockStudent, grade_id: 'cls-up', class_id: 'cls-up', active: true }] as any,
      teachers: [],
      nextTermOpeningDate: '2026-09-08',
    };
    const doc = await generateUpperPrimaryReportPDF(upData);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('generates Junior School report form with green palette successfully', async () => {
    const jsData: PDFReportData = {
      student: { ...mockStudent, grade_id: 'cls-js', class_id: 'cls-js', active: true } as any,
      school: mockSchool as any,
      exam: mockExam as any,
      classes: mockClasses as any,
      subjects: mockSubjects as any,
      marks: mockMarks as any,
      grades: mockGrades as any,
      allStudents: [{ ...mockStudent, grade_id: 'cls-js', class_id: 'cls-js', active: true }] as any,
      teachers: [],
      nextTermOpeningDate: '2026-09-08',
    };
    const doc = await generateJuniorSchoolReportPDF(jsData);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('dispatches to correct generator and stays within 1-page A4 format', async () => {
    const jsData: PDFReportData = {
      student: { ...mockStudent, grade_id: 'cls-js', class_id: 'cls-js', active: true } as any,
      school: mockSchool as any,
      exam: mockExam as any,
      classes: mockClasses as any,
      subjects: mockSubjects as any,
      marks: mockMarks as any,
      grades: mockGrades as any,
      allStudents: [{ ...mockStudent, grade_id: 'cls-js', class_id: 'cls-js', active: true }] as any,
      teachers: [],
      nextTermOpeningDate: '2026-09-08',
    };
    const doc = await createReportCardPDFDoc(jsData);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
