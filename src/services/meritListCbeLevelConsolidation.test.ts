import { describe, it, expect, vi } from 'vitest';
import type { School, Examination, ClassStream, Subject, Teacher, Student, Mark } from '../types';
import { downloadMeritListPDF } from './meritListExporter';
import { CBE_8_POINT_GRADES } from './analysisEngine';
import * as fileDownloader from '../utils/fileDownloader';

describe('Merit List PDF - CBE Level & Grade Code Column Consolidation', () => {
  const mockSchool: School = {
    id: 'sch-1',
    school_name: 'Muchorwe Junior School',
    school_code: 'MJS001',
    principal_name: 'Mr. Principal',
    county: 'Nakuru',
    email: 'info@school.ac.ke',
  };

  const mockExam: Examination = {
    id: 'ex-1',
    exam_name: 'Term 2 Exam',
    academic_year_id: 'ay2024',
    term: 'Term 2',
    status: 'Published',
    year: 2024,
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const mockClasses: ClassStream[] = [
    { id: 'cls-1', class_name: 'Grade 8', stream: 'Alpha', education_level: 'Junior School' },
    { id: 'cls-2', class_name: 'Grade 4', stream: 'North', education_level: 'Upper Primary' },
  ];

  const mockTeachers: Teacher[] = [
    { id: 'tch-1', teacher_name: 'Teacher One', email: 't1@school.com', phone: '0711000000' },
  ];

  const mockJuniorSubjects: Subject[] = [
    { id: 'sub-1', subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School', category: 'Core' },
    { id: 'sub-2', subject_name: 'Mathematics', subject_code: 'MAT', education_level: 'Junior School', category: 'Core' },
  ];

  const mockJuniorStudents: Student[] = [
    { id: 'std-1', admission_number: 'ADM001', full_name: 'John Doe', class_id: 'cls-1', stream_id: 'cls-1', grade: 'Grade 8', gender: 'M', active: true },
  ];

  const mockJuniorMarks: Mark[] = [
    { id: 'm1', student_id: 'std-1', subject_id: 'sub-1', exam_id: 'ex-1', marks: 85, out_of: 100, special_status: 'Normal' },
    { id: 'm2', student_id: 'std-1', subject_id: 'sub-2', exam_id: 'ex-1', marks: 81, out_of: 100, special_status: 'Normal' },
  ];

  it('Junior School Merit List PDF exports with single consolidated CBE LEVEL column displaying gradeCode', async () => {
    let capturedDoc: any = null;

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
      capturedDoc = doc;
    });

    await downloadMeritListPDF({
      school: mockSchool,
      exam: mockExam,
      selectedClassId: 'cls-1',
      selectedStreamId: 'all',
      classes: mockClasses,
      teachers: mockTeachers,
      students: mockJuniorStudents,
      subjects: mockJuniorSubjects,
      marks: mockJuniorMarks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(capturedDoc).not.toBeNull();
    const pdfOutput = capturedDoc.output('datauristring');
    expect(pdfOutput).toBeDefined();

    // Check raw page stream content
    const page1 = capturedDoc.internal.pages[1];
    const pageText = Array.isArray(page1) ? page1.join('\n') : String(page1);

    // Confirm CBE LEVEL is rendered
    expect(pageText).toContain('CBE LEVEL');
    // Confirm GRADE CODE column title is NOT in the PDF
    expect(pageText).not.toContain('GRADE CODE');
    // Confirm Grade Code 'EE2' is rendered in the PDF table
    expect(pageText).toContain('EE2');
  });

  it('Primary / Pre-Primary Merit List PDF exports with single consolidated CBE LEVEL column displaying gradeCode', async () => {
    let capturedDoc: any = null;

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
      capturedDoc = doc;
    });

    const mockPrimarySubjects: Subject[] = [
      { id: 'sub-10', subject_name: 'English Language', subject_code: 'ENG', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sub-20', subject_name: 'Mathematics Activities', subject_code: 'MAT', education_level: 'Upper Primary', category: 'Core' },
    ];

    const mockPrimaryStudents: Student[] = [
      { id: 'std-2', admission_number: 'ADM002', full_name: 'Jane Smith', class_id: 'cls-2', stream_id: 'cls-2', grade: 'Grade 4', gender: 'F', active: true },
    ];

    const mockPrimaryMarks: Mark[] = [
      { id: 'm10', student_id: 'std-2', subject_id: 'sub-10', exam_id: 'ex-1', marks: 72, out_of: 100, special_status: 'Normal' },
      { id: 'm20', student_id: 'std-2', subject_id: 'sub-20', exam_id: 'ex-1', marks: 68, out_of: 100, special_status: 'Normal' },
    ];

    await downloadMeritListPDF({
      school: mockSchool,
      exam: mockExam,
      selectedClassId: 'cls-2',
      selectedStreamId: 'all',
      classes: mockClasses,
      teachers: mockTeachers,
      students: mockPrimaryStudents,
      subjects: mockPrimarySubjects,
      marks: mockPrimaryMarks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(capturedDoc).not.toBeNull();
    const page1 = capturedDoc.internal.pages[1];
    const pageText = Array.isArray(page1) ? page1.join('\n') : String(page1);

    expect(pageText).toContain('CBE LEVEL');
    expect(pageText).not.toContain('GRADE CODE');
    // For 70% average, ME grade code is rendered (Upper Primary 4-point scale)
    expect(pageText).toContain('ME');
  });
});



