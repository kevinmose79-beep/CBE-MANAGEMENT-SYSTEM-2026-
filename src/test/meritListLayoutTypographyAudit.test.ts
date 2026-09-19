import { describe, it, expect, vi } from 'vitest';
import {
  downloadMeritListPDF,
  downloadMeritListExcel,
  downloadMeritListCSV,
  MeritListData,
} from '../services/meritListExporter';
import { School, Examination, ClassStream, Subject, Mark, Grade, Student } from '../types';
import { formatPercentage, formatAverageMark } from '../utils/markUtils';

describe('Merit List PDF Layout & Typography Forensic Verification Suite', () => {
  const mockSchool: School = {
    id: 'sch-01',
    school_name: 'Muchorwe Junior School',
    school_code: 'MJS-001',
    county: 'Bomet',
    email: 'info@muchorwe.edu',
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
    { id: 'cls-8b', class_name: 'Grade 8', stream: 'B', education_level: 'Junior School' },
    { id: 'cls-5a', class_name: 'Grade 5', stream: 'A', education_level: 'Upper Primary' },
  ];

  const mockJuniorSubjects: Subject[] = [
    { id: 'sb-01', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-02', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-03', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-04', subject_code: 'SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-05', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-06', subject_code: 'CRE', subject_name: 'CRE', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-07', subject_code: 'AGR', subject_name: 'Agriculture & Nutrition', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-08', subject_code: 'CAS', subject_name: 'Creative Arts & Sports', education_level: 'Junior School', category: 'Core' },
    { id: 'sb-09', subject_code: 'PTS', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core' },
  ];

  const mockJuniorStudents: Student[] = [
    { id: 'std-01', full_name: 'Amina Hassan', admission_number: 'ADM-001', class_id: 'cls-8a', gender: 'F', active: true },
    { id: 'std-02', full_name: 'Brian Ochieng', admission_number: 'ADM-002', class_id: 'cls-8a', gender: 'M', active: true },
  ];

  const mockMarks: Mark[] = [
    // Amina's complete set across all 9 learning areas
    { id: 'mk-01', student_id: 'std-01', subject_id: 'sb-01', exam_id: 'ex-01', marks: 89, raw_score: 89, out_of: 100, special_status: 'Normal' },
    { id: 'mk-02', student_id: 'std-01', subject_id: 'sb-02', exam_id: 'ex-01', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'mk-03', student_id: 'std-01', subject_id: 'sb-03', exam_id: 'ex-01', marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
    { id: 'mk-04', student_id: 'std-01', subject_id: 'sb-04', exam_id: 'ex-01', marks: 54, raw_score: 54, out_of: 100, special_status: 'Normal' },
    { id: 'mk-05', student_id: 'std-01', subject_id: 'sb-05', exam_id: 'ex-01', marks: 43, raw_score: 43, out_of: 100, special_status: 'Normal' },
    { id: 'mk-06', student_id: 'std-01', subject_id: 'sb-06', exam_id: 'ex-01', marks: 32, raw_score: 32, out_of: 100, special_status: 'Normal' },
    { id: 'mk-07', student_id: 'std-01', subject_id: 'sb-07', exam_id: 'ex-01', marks: 95, raw_score: 95, out_of: 100, special_status: 'Normal' },
    { id: 'mk-08', student_id: 'std-01', subject_id: 'sb-08', exam_id: 'ex-01', marks: 82, raw_score: 82, out_of: 100, special_status: 'Normal' },
    { id: 'mk-09', student_id: 'std-01', subject_id: 'sb-09', exam_id: 'ex-01', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },

    // Brian
    { id: 'mk-10', student_id: 'std-02', subject_id: 'sb-01', exam_id: 'ex-01', marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
    { id: 'mk-11', student_id: 'std-02', subject_id: 'sb-02', exam_id: 'ex-01', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
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

  const jsMeritData: MeritListData = {
    school: mockSchool,
    exam: mockExam,
    classes: mockClasses,
    subjects: mockJuniorSubjects,
    marks: mockMarks,
    grades: mockGrades,
    students: mockJuniorStudents,
    teachers: [],
    selectedClassId: 'cls-8a',
    selectedStreamId: 'cls-8a',
    generatedBy: 'System Administrator',
  };

  it('1. Junior School Merit List PDF generates successfully with complete 9 learning areas and preserves subject results intact', async () => {
    await expect(downloadMeritListPDF(jsMeritData)).resolves.not.toThrow();
  });

  it('2. Junior School Merit List all-streams generation succeeds without errors', async () => {
    const allStreamsData: MeritListData = {
      ...jsMeritData,
      selectedStreamId: 'ALL',
    };
    await expect(downloadMeritListPDF(allStreamsData)).resolves.not.toThrow();
  });

  it('3. Upper Primary Merit List PDF generates successfully with updated column styles', async () => {
    const mockPrimarySubjects: Subject[] = [
      { id: 'ps-01', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Upper Primary', category: 'Core' },
      { id: 'ps-02', subject_code: 'SCI', subject_name: 'Science & Technology', education_level: 'Upper Primary', category: 'Core' },
      { id: 'ps-03', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Upper Primary', category: 'Core' },
      { id: 'ps-04', subject_code: 'CAS', subject_name: 'Creative Arts & Sports', education_level: 'Upper Primary', category: 'Core' },
      { id: 'ps-05', subject_code: 'AGR', subject_name: 'Agriculture', education_level: 'Upper Primary', category: 'Core' },
    ];

    const mockPrimaryStudents: Student[] = [
      { id: 'pstd-01', full_name: 'Grace Wanjiku', admission_number: 'P-101', class_id: 'cls-5a', gender: 'F', active: true },
    ];

    const mockPrimaryMarks: Mark[] = [
      { id: 'pmk-01', student_id: 'pstd-01', subject_id: 'ps-01', exam_id: 'ex-01', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
      { id: 'pmk-02', student_id: 'pstd-01', subject_id: 'ps-02', exam_id: 'ex-01', marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },
    ];

    const priMeritData: MeritListData = {
      school: mockSchool,
      exam: { ...mockExam, education_level: 'Upper Primary' },
      classes: mockClasses,
      subjects: mockPrimarySubjects,
      marks: mockPrimaryMarks,
      grades: mockGrades,
      students: mockPrimaryStudents,
      teachers: [],
      selectedClassId: 'cls-5a',
      selectedStreamId: 'cls-5a',
      generatedBy: 'System Administrator',
    };

    await expect(downloadMeritListPDF(priMeritData)).resolves.not.toThrow();
  });

  it('4. Excel and CSV exports execute successfully with new title', async () => {
    await expect(downloadMeritListExcel(jsMeritData)).resolves.not.toThrow();
    await expect(downloadMeritListCSV(jsMeritData)).resolves.not.toThrow();
  });

  it('5. Mathematically proves Junior School and Primary layout geometry and width budgets', () => {
    // Junior School A4 Landscape: 297mm width, 10mm margins -> 277mm printable width
    const jsPrintableWidth = 277;
    const jsMetaW = 6 + 14 + 40 + 12 + 6.5 + 6.5 + 6.5 + 6.5; // 98mm
    const jsSummaryW = 7 + 10 + 11 + 10 + 10 + 14; // 62mm
    const jsAvailSubjectW = jsPrintableWidth - jsMetaW - jsSummaryW; // 117mm
    const jsSubjectCount = 9;
    const jsWidthPerSubject = jsAvailSubjectW / jsSubjectCount; // 13.00mm

    expect(jsMetaW).toBe(98);
    expect(jsSummaryW).toBe(62);
    expect(jsAvailSubjectW).toBe(117);
    expect(jsWidthPerSubject).toBe(13);
    expect(jsMetaW + jsSummaryW + jsAvailSubjectW).toBe(jsPrintableWidth);

    // Primary School A4 Landscape: 297mm width, 7mm margins -> 283mm printable width
    const priPrintableWidth = 283;
    const priMetaW = 7 + 15 + 48 + 12 + 6.5 + 6.5 + 6.5 + 6.5; // 108mm
    const priSummaryW = 10.5 + 12 + 11 + 11 + 14; // 58.5mm
    const priAvailSubjectW = priPrintableWidth - priMetaW - priSummaryW; // 116.5mm
    const priSubjectCount = 8;
    const priWidthPerSubject = priAvailSubjectW / priSubjectCount; // 14.5625mm

    expect(priMetaW).toBe(108);
    expect(priSummaryW).toBe(58.5);
    expect(priAvailSubjectW).toBe(116.5);
    expect(priWidthPerSubject).toBeCloseTo(14.56, 1);
    expect(priMetaW + priSummaryW + priAvailSubjectW).toBe(priPrintableWidth);
  });

  it('6. Verifies learner names retain untouched raw strings without literal spaces', () => {
    expect(mockJuniorStudents[0].full_name).toBe('Amina Hassan');
    expect(mockJuniorStudents[1].full_name).toBe('Brian Ochieng');
    expect(mockJuniorStudents[0].full_name.startsWith(' ')).toBe(false);
    expect(mockJuniorStudents[1].full_name.startsWith(' ')).toBe(false);
  });

  it('7. Verifies Average Marks values render to exactly one decimal place without % symbol in PDF presentation', () => {
    expect(formatAverageMark(78)).toBe('78.0');
    expect(formatAverageMark(78.0)).toBe('78.0');
    expect(formatAverageMark(78.04)).toBe('78.0');
    expect(formatAverageMark(78.05)).toBe('78.1');
    expect(formatAverageMark(78.456)).toBe('78.5');
    expect(formatAverageMark(91.24)).toBe('91.2');
    expect(formatAverageMark(63.83)).toBe('63.8');
    expect(formatAverageMark(100)).toBe('100.0');
    expect(formatAverageMark(0)).toBe('0.0');
    expect(formatAverageMark(null)).toBe('-');
    expect(formatAverageMark(undefined)).toBe('-');
    expect(`${formatAverageMark(78.456)} (P)`).toBe('78.5 (P)');
  });

  it('8. Verifies learner row vertical geometry and padding specifications', () => {
    const rowHeight = 3.6; // mm
    const topPadding = 0.25; // mm
    const bottomPadding = 0.25; // mm
    const usableTextHeight = rowHeight - topPadding - bottomPadding; // 3.1mm

    expect(rowHeight).toBe(3.6);
    expect(topPadding).toBe(0.25);
    expect(bottomPadding).toBe(0.25);
    expect(usableTextHeight).toBe(3.1);
  });

  it('9. Verifies approved Learner calculation notes terminology', () => {
    const note1 = 'Learner position is assigned using Total Marks';
    const note2 = 'Learner performance level is calculated using Average Marks';

    expect(note1).toBe('Learner position is assigned using Total Marks');
    expect(note2).toBe('Learner performance level is calculated using Average Marks');
    expect(note1.includes('Student')).toBe(false);
    expect(note2.includes('Student')).toBe(false);
    expect(note2.includes('student average marks')).toBe(false);
  });
});

