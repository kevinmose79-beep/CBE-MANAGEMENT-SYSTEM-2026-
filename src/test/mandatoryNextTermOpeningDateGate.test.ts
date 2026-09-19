import { describe, it, expect } from 'vitest';
import {
  resolveSuggestedNextTermOpeningDate,
  validateNextTermOpeningDate,
  formatDateToKenyaHumanReadable,
} from '../services/nextTermOpeningDateResolver';
import { resolveNextTermOpeningDate, PDFReportData } from '../services/pdfReportGenerator';
import { Examination, SchoolTerm, Student, School } from '../types';

describe('Mandatory Next Term Opening Date Gate & Resolver', () => {
  const mockSchool: School = {
    id: 'sch-001',
    school_name: 'Hillcrest Academy',
    county: 'Nairobi',
    email: 'info@hillcrest.edu',
    address: 'P.O Box 100',
    phone: '0700000000',
  };

  const mockStudent: Student = {
    id: 'std-001',
    admission_number: 'ADM001',
    full_name: 'Quinn Taylor',
    gender: 'F',
    grade: 'Grade 7',
    class_id: 'cls-7',
    stream_id: 'stm-7-east',
    active: true,
  };

  const mockTerms: SchoolTerm[] = [
    {
      id: 'term-2026-1',
      academic_year_id: 'ay-2026',
      year: 2026,
      term_name: 'Term 1',
      opening_date: '2026-01-05',
      closing_date: '2026-04-03',
      status: 'Closed',
    },
    {
      id: 'term-2026-2',
      academic_year_id: 'ay-2026',
      year: 2026,
      term_name: 'Term 2',
      opening_date: '2026-05-04',
      closing_date: '2026-08-07',
      status: 'Active',
    },
    {
      id: 'term-2026-3',
      academic_year_id: 'ay-2026',
      year: 2026,
      term_name: 'Term 3',
      opening_date: '2026-08-31',
      closing_date: '2026-10-30',
      status: 'Upcoming',
    },
    {
      id: 'term-2027-1',
      academic_year_id: 'ay-2027',
      year: 2027,
      term_name: 'Term 1',
      opening_date: '2027-01-04',
      closing_date: '2027-04-02',
      status: 'Upcoming',
    },
  ];

  it('1. Correctly resolves Term 2 opening date for a Term 1 examination', () => {
    const exam: Examination = {
      id: 'ex-01',
      exam_name: 'Term 1 Assessment 2026',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay-2026',
      education_level: 'Junior School',
      status: 'Approved',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    const suggested = resolveSuggestedNextTermOpeningDate(exam, mockTerms);
    expect(suggested).not.toBeNull();
    expect(suggested?.nextTermName).toBe('Term 2');
    expect(suggested?.rawStartDate).toBe('2026-05-04');
    expect(suggested?.formattedDate).toContain('May 2026');
  });

  it('2. Correctly resolves Term 3 opening date for a Term 2 examination', () => {
    const exam: Examination = {
      id: 'ex-02',
      exam_name: 'Term 2 Mid-Term Assessment 2026',
      term: 'Term 2',
      year: 2026,
      academic_year_id: 'ay-2026',
      education_level: 'Junior School',
      status: 'Approved',
      exam_type: 'Mid-Term',
      max_marks: 100,
    };

    const suggested = resolveSuggestedNextTermOpeningDate(exam, mockTerms);
    expect(suggested).not.toBeNull();
    expect(suggested?.nextTermName).toBe('Term 3');
    expect(suggested?.rawStartDate).toBe('2026-08-31');
    expect(suggested?.formattedDate).toContain('August 2026');
  });

  it('3. Correctly resolves next year Term 1 opening date for a Term 3 examination', () => {
    const exam: Examination = {
      id: 'ex-03',
      exam_name: 'End of Year Assessment 2026',
      term: 'Term 3',
      year: 2026,
      academic_year_id: 'ay-2026',
      education_level: 'Junior School',
      status: 'Approved',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    const suggested = resolveSuggestedNextTermOpeningDate(exam, mockTerms);
    expect(suggested).not.toBeNull();
    expect(suggested?.nextTermName).toBe('Term 1');
    expect(suggested?.rawStartDate).toBe('2027-01-04');
    expect(suggested?.formattedDate).toContain('January 2027');
  });

  it('4. Validates manual next term opening date strings', () => {
    expect(validateNextTermOpeningDate('15th January 2027')).toBe(true);
    expect(validateNextTermOpeningDate('2027-01-15')).toBe(true);
    expect(validateNextTermOpeningDate('   ')).toBe(false);
    expect(validateNextTermOpeningDate('')).toBe(false);
    expect(validateNextTermOpeningDate('N/A')).toBe(false);
  });

  it('5. resolveNextTermOpeningDate prioritizes explicit nextTermOpeningDate on PDFReportData', () => {
    const reportData: PDFReportData = {
      student: mockStudent,
      school: mockSchool,
      classes: [],
      subjects: [],
      marks: [],
      grades: [],
      allStudents: [mockStudent],
      nextTermOpeningDate: '4th January 2027',
      savedRemarks: {
        student_id: mockStudent.id,
        exam_id: 'ex-01',
        next_term_opening_date: 'Old Stale Date',
      },
    };

    const resolved = resolveNextTermOpeningDate(reportData);
    expect(resolved).toBe('4 January 2027');
  });

  it('6. resolveNextTermOpeningDate uses savedRemarks when explicit field is absent', () => {
    const reportData: PDFReportData = {
      student: mockStudent,
      school: mockSchool,
      classes: [],
      subjects: [],
      marks: [],
      grades: [],
      allStudents: [mockStudent],
      savedRemarks: {
        student_id: mockStudent.id,
        exam_id: 'ex-01',
        next_term_opening_date: '5th May 2026',
      },
    };

    const resolved = resolveNextTermOpeningDate(reportData);
    expect(resolved).toBe('5 May 2026');
  });

  it('7. resolveNextTermOpeningDate strictly throws when next term opening date is missing (no silent fallback)', () => {
    const exam: Examination = {
      id: 'ex-01',
      exam_name: 'Term 1 Assessment 2026',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay-2026',
      education_level: 'Junior School',
      status: 'Approved',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    const reportData: PDFReportData = {
      student: mockStudent,
      school: mockSchool,
      exam,
      classes: [],
      subjects: [],
      marks: [],
      grades: [],
      allStudents: [mockStudent],
    };

    expect(() => resolveNextTermOpeningDate(reportData)).toThrow(
      'Next Term Opening Date is required for official report card PDF generation'
    );
  });

  it('8. Batch report data list maintains exact confirmed next term date across all learners', () => {
    const students: Student[] = [
      { ...mockStudent, id: 's1', full_name: 'Student One' },
      { ...mockStudent, id: 's2', full_name: 'Student Two' },
      { ...mockStudent, id: 's3', full_name: 'Student Three' },
    ];

    const confirmedDate = '8th September 2026';
    const batchDataList: PDFReportData[] = students.map((std) => ({
      student: std,
      school: mockSchool,
      classes: [],
      subjects: [],
      marks: [],
      grades: [],
      allStudents: students,
      nextTermOpeningDate: confirmedDate,
    }));

    batchDataList.forEach((data) => {
      expect(resolveNextTermOpeningDate(data)).toBe('8 September 2026');
    });
  });

  it('9. Formats dates in Kenya standard human-readable format', () => {
    const formatted = formatDateToKenyaHumanReadable('2026-09-08');
    expect(formatted).toBe('8 September 2026');

    const formatted2 = formatDateToKenyaHumanReadable('2026-01-01');
    expect(formatted2).toBe('1 January 2026');

    const formatted3 = formatDateToKenyaHumanReadable('2026-05-02');
    expect(formatted3).toBe('2 May 2026');

    const formatted4 = formatDateToKenyaHumanReadable('2026-03-03');
    expect(formatted4).toBe('3 March 2026');
  });
});
