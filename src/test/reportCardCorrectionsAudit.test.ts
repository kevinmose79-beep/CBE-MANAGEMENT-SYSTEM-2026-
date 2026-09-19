import { describe, it, expect } from 'vitest';
import { stripSurroundingQuotes } from '../utils/filterUtils';
import {
  PDF_COLORS,
  resolveNextTermOpeningDate,
  createReportCardPDFDoc,
  generatePrePrimaryReportPDF,
  generateLowerPrimaryReportPDF,
  generateUpperPrimaryReportPDF,
  generateJuniorSchoolReportPDF,
  PDFReportData,
} from '../services/pdfReportGenerator';
import { School, Student, Examination, ClassStream, Subject, Mark, Grade } from '../types';

describe('Report Card Surgical Corrections Forensic Verification', () => {
  const mockSchool: School = {
    id: 'sch-001',
    school_name: 'Hillcrest International Academy',
    motto: '"Strive for Excellence"',
    county: 'Nairobi',
    email: 'info@hillcrest.edu',
    phone: '0700000000',
  };

  const mockPrePrimaryStudent: Student = {
    id: 'std-pp1',
    admission_number: 'PP001',
    full_name: 'Jane Doe',
    gender: 'F',
    grade: 'PP1',
    class_id: 'cls-pp1',
    stream_id: 'stm-pp1-a',
    active: true,
  };

  const mockLowerPrimaryStudent: Student = {
    id: 'std-lp1',
    admission_number: 'LP001',
    full_name: 'John Doe',
    gender: 'M',
    grade: 'Grade 2',
    class_id: 'cls-g2',
    stream_id: 'stm-g2-a',
    active: true,
  };

  const mockUpperPrimaryStudent: Student = {
    id: 'std-up1',
    admission_number: 'UP001',
    full_name: 'Mary Smith',
    gender: 'F',
    grade: 'Grade 5',
    class_id: 'cls-g5',
    stream_id: 'stm-g5-a',
    active: true,
  };

  const mockJuniorSchoolStudent: Student = {
    id: 'std-js1',
    admission_number: 'JS001',
    full_name: 'Alex Johnson',
    gender: 'M',
    grade: 'Grade 8',
    class_id: 'cls-g8',
    stream_id: 'stm-g8-a',
    active: true,
  };

  const mockExam: Examination = {
    id: 'ex-01',
    exam_name: 'Term 2 End-Term Assessment 2026',
    term: 'Term 2',
    year: 2026,
    academic_year_id: 'ay-2026',
    education_level: 'Junior School',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const mockClasses: ClassStream[] = [
    { id: 'cls-pp1', class_name: 'PP1', stream: 'A', education_level: 'Pre-Primary' },
    { id: 'cls-g2', class_name: 'Grade 2', stream: 'A', education_level: 'Lower Primary' },
    { id: 'cls-g5', class_name: 'Grade 5', stream: 'A', education_level: 'Upper Primary' },
    { id: 'cls-g8', class_name: 'Grade 8', stream: 'A', education_level: 'Junior School' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sb-01', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-02', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
  ];

  const mockMarks: Mark[] = [
    { id: 'mk-01', student_id: 'std-js1', subject_id: 'sb-01', exam_id: 'ex-01', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
    { id: 'mk-02', student_id: 'std-js1', subject_id: 'sb-02', exam_id: 'ex-01', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
  ];

  const mockGrades: Grade[] = [
    { id: 'gr-01', grade: 'EE1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Outstanding', descriptor: 'Exceeding Expectations' },
    { id: 'gr-02', grade: 'EE2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Excellent', descriptor: 'Exceeding Expectations' },
    { id: 'gr-03', grade: 'ME1', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Good', descriptor: 'Meeting Expectations' },
    { id: 'gr-04', grade: 'ME2', grade_code: 'ME2', performance_level: 'ME', minimum_score: 41, maximum_score: 57, points: 5, remarks: 'Satisfactory', descriptor: 'Meeting Expectations' },
    { id: 'gr-05', grade: 'AE1', grade_code: 'AE1', performance_level: 'AE', minimum_score: 31, maximum_score: 40, points: 4, remarks: 'Developing', descriptor: 'Approaching Expectations' },
    { id: 'gr-06', grade: 'AE2', grade_code: 'AE2', performance_level: 'AE', minimum_score: 21, maximum_score: 30, points: 3, remarks: 'Needs Practice', descriptor: 'Approaching Expectations' },
    { id: 'gr-07', grade: 'BE1', grade_code: 'BE1', performance_level: 'BE', minimum_score: 11, maximum_score: 20, points: 2, remarks: 'Intervention', descriptor: 'Below Expectations' },
    { id: 'gr-08', grade: 'BE2', grade_code: 'BE2', performance_level: 'BE', minimum_score: 0, maximum_score: 10, points: 1, remarks: 'Immediate Support', descriptor: 'Below Expectations' },
  ];

  // 1. Report Form Colours
  it('1. Centralized PDF_COLORS contains all required color palettes', () => {
    expect(PDF_COLORS.NAVY_DARK).toEqual([6, 78, 59]);
    expect(PDF_COLORS.SLATE_HEADER).toEqual([6, 78, 59]);
    expect(PDF_COLORS.SLATE_MUTED).toEqual([71, 85, 105]);
    expect(PDF_COLORS.EE).toEqual([4, 120, 87]);
    expect(PDF_COLORS.ME).toEqual([30, 64, 175]);
    expect(PDF_COLORS.AE).toEqual([180, 83, 9]);
    expect(PDF_COLORS.BE).toEqual([190, 18, 60]);
  });

  // 2. School Motto Quotation Removal
  it('2. stripSurroundingQuotes removes wrapping quotation marks from motto correctly', () => {
    expect(stripSurroundingQuotes('"Strive for Excellence"')).toBe('Strive for Excellence');
    expect(stripSurroundingQuotes('“Strive for Excellence”')).toBe('Strive for Excellence');
    expect(stripSurroundingQuotes('\'Strive for Excellence\'')).toBe('Strive for Excellence');
    expect(stripSurroundingQuotes('Strive for Excellence')).toBe('Strive for Excellence');
    expect(stripSurroundingQuotes('  "Learn to Lead"  ')).toBe('Learn to Lead');
  });

  // 3. No Hardcoded Date & Dynamic Resolver
  it('3. Throws when nextTermOpeningDate is absent (no hardcoded fallback "12th September 2026")', () => {
    const reportData: PDFReportData = {
      student: mockJuniorSchoolStudent,
      school: mockSchool,
      exam: mockExam,
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      allStudents: [mockJuniorSchoolStudent],
    };

    expect(() => resolveNextTermOpeningDate(reportData)).toThrow(
      'Next Term Opening Date is required for official report card PDF generation'
    );
  });

  // 4. Generate all 4 level PDFs successfully with confirmed next term date
  it('4. Successfully generates PDF documents for all 4 educational levels', async () => {
    const confirmedDate = '15th September 2026';

    const ppDoc = await generatePrePrimaryReportPDF({
      student: mockPrePrimaryStudent,
      school: mockSchool,
      exam: { ...mockExam, education_level: 'Pre-Primary' },
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      allStudents: [mockPrePrimaryStudent],
      nextTermOpeningDate: confirmedDate,
    });
    expect(ppDoc).toBeDefined();

    const lpDoc = await generateLowerPrimaryReportPDF({
      student: mockLowerPrimaryStudent,
      school: mockSchool,
      exam: { ...mockExam, education_level: 'Lower Primary' },
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      allStudents: [mockLowerPrimaryStudent],
      nextTermOpeningDate: confirmedDate,
    });
    expect(lpDoc).toBeDefined();

    const upDoc = await generateUpperPrimaryReportPDF({
      student: mockUpperPrimaryStudent,
      school: mockSchool,
      exam: { ...mockExam, education_level: 'Upper Primary' },
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      allStudents: [mockUpperPrimaryStudent],
      nextTermOpeningDate: confirmedDate,
    });
    expect(upDoc).toBeDefined();

    const jsDoc = await generateJuniorSchoolReportPDF({
      student: mockJuniorSchoolStudent,
      school: mockSchool,
      exam: mockExam,
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      allStudents: [mockJuniorSchoolStudent],
      nextTermOpeningDate: confirmedDate,
    });
    expect(jsDoc).toBeDefined();
  });

  // 5. Entry point dispatcher routing
  it('5. createReportCardPDFDoc dispatches appropriately for any grade', async () => {
    const confirmedDate = '15th September 2026';
    const doc = await createReportCardPDFDoc({
      student: mockJuniorSchoolStudent,
      school: mockSchool,
      exam: mockExam,
      classes: mockClasses,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      allStudents: [mockJuniorSchoolStudent],
      nextTermOpeningDate: confirmedDate,
    });
    expect(doc).toBeDefined();
  });
});
