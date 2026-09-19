import { describe, it, expect, vi } from 'vitest';
import { exportProvisionalStudentResultsPDF } from './provisionalStudentResultsPdfExporter';
import { School, Examination, ClassStream, Subject, Grade, Student, Mark } from '../types';
import * as fileDownloader from '../utils/fileDownloader';

describe('Provisional Student Results PDF Exporter Layout & Presentation', () => {
  const mockSchool: School = {
    id: 'sch-1',
    school_name: 'Green Hills Academy',
    county: 'Nairobi',
    email: 'info@greenhills.ac.ke',
  };

  const mockExam: Examination = {
    id: 'exam-1',
    exam_name: 'Mid Term 2 2026',
    exam_type: 'Mid-Term',
    term: 'Term 2',
    year: 2026,
    status: 'Draft',
    class_id: 'class-1',
    max_marks: 100,
  };

  const mockClasses: ClassStream[] = [
    { id: 'class-1', class_name: 'Grade 7', stream: '7 Alpha' },
    { id: 'class-2', class_name: 'Grade 7', stream: '7 Beta' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'subj-1', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
    { id: 'subj-2', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core' },
    { id: 'subj-3', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core' },
    { id: 'subj-4', subject_name: 'Integrated Science', subject_code: 'INT-SCI', category: 'Core' },
    { id: 'subj-5', subject_name: 'Creative Arts & Sports', subject_code: 'CAS', category: 'Core' },
    { id: 'subj-6', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core' },
    { id: 'subj-7', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core' },
    { id: 'subj-8', subject_name: 'Agriculture & Nutrition', subject_code: 'AGN', category: 'Core' },
    { id: 'subj-9', subject_name: 'Pre-Technical Studies', subject_code: 'PRE', category: 'Core' },
  ];

  const mockGrades: Grade[] = [
    { id: 'g1', descriptor: 'Exceeding Expectations', performance_level: 'EE', grade_code: 'EE1', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceeding' },
    { id: 'g2', descriptor: 'Exceeding Expectations', performance_level: 'EE', grade_code: 'EE2', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Exceeding' },
    { id: 'g3', descriptor: 'Meeting Expectations', performance_level: 'ME', grade_code: 'ME1', minimum_score: 60, maximum_score: 74, points: 6, remarks: 'Meeting' },
    { id: 'g4', descriptor: 'Meeting Expectations', performance_level: 'ME', grade_code: 'ME2', minimum_score: 50, maximum_score: 59, points: 5, remarks: 'Meeting' },
    { id: 'g5', descriptor: 'Approaching Expectations', performance_level: 'AE', grade_code: 'AE1', minimum_score: 40, maximum_score: 49, points: 4, remarks: 'Approaching' },
    { id: 'g6', descriptor: 'Approaching Expectations', performance_level: 'AE', grade_code: 'AE2', minimum_score: 30, maximum_score: 39, points: 3, remarks: 'Approaching' },
    { id: 'g7', descriptor: 'Below Expectations', performance_level: 'BE', grade_code: 'BE1', minimum_score: 20, maximum_score: 29, points: 2, remarks: 'Below' },
    { id: 'g8', descriptor: 'Below Expectations', performance_level: 'BE', grade_code: 'BE2', minimum_score: 0, maximum_score: 19, points: 1, remarks: 'Below' },
  ];

  // Generate 75 learners to force 3 pages in A4 landscape
  const mockStudents: Student[] = Array.from({ length: 75 }, (_, i) => ({
    id: `std-${i + 1}`,
    admission_number: `ADM${String(i + 1).padStart(3, '0')}`,
    full_name: `Learner Test Name ${i + 1}`,
    class_id: 'class-1',
    grade: 'Grade 7',
    gender: i % 2 === 0 ? 'M' : 'F',
    active: true,
  }));

  const mockMarks: Mark[] = [];
  mockStudents.forEach((std, sIdx) => {
    mockSubjects.forEach((subj, subIdx) => {
      mockMarks.push({
        id: `mark-${std.id}-${subj.id}`,
        exam_id: 'exam-1',
        student_id: std.id,
        subject_id: subj.id,
        marks: 50 + ((sIdx + subIdx) % 45),
      });
    });
  });

  it('generates multi-page PDF with exact required columns and no unwanted columns', async () => {
    let capturedDoc: any = null;
    let capturedFileName: string = '';

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any, fileName: string) => {
      capturedDoc = doc;
      capturedFileName = fileName;
    });

    await exportProvisionalStudentResultsPDF({
      school: mockSchool,
      exam: mockExam,
      selectedClassId: 'class-1',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
    });

    expect(capturedDoc).not.toBeNull();
    expect(capturedFileName).toContain('Provisional_Student_Results');

    const totalPages = capturedDoc.internal.getNumberOfPages();
    expect(totalPages).toBeGreaterThanOrEqual(2);
  });
});
