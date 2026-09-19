import { describe, it, expect, vi, beforeEach } from 'vitest';
import jsPDF from 'jspdf';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Teacher,
} from '../types';
import { CBE_8_POINT_GRADES } from './analysisEngine';
import { generateClassPerformanceComparison } from './classComparisonEngine';
import {
  exportClassPerformanceComparisonPDF,
  ClassComparisonPdfOptions,
} from './classComparisonPdfExporter';
import * as fileDownloader from '../utils/fileDownloader';

describe('Class Performance Comparison PDF Exporter', () => {
  let capturedDoc: jsPDF | null = null;
  let capturedFileName = '';

  beforeEach(() => {
    capturedDoc = null;
    capturedFileName = '';
    vi.restoreAllMocks();
    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: jsPDF, fileName: string) => {
      capturedDoc = doc;
      capturedFileName = fileName;
    });
  });

  const mockSchool: School = {
    id: 'sch_muchorwe',
    school_name: 'Muchorwe Comprehensive School',
    motto: 'Excellence and Integrity in CBE',
    county: 'Nandi',
    address: 'P.O. Box 240',
    email: 'principal@muchorwe.ac.ke',
    phone: '+254712345678',
    principal_name: 'Dr. Kipchoge Keino',
  };

  const mockExam: Examination = {
    id: 'exam_term1_2026',
    exam_name: 'End Term 1 Assessment',
    exam_type: 'End-Term',
    term: 'Term 1',
    year: 2026,
    max_marks: 100,
    start_date: '2026-03-20',
    end_date: '2026-03-28',
    status: 'Published',
  };

  const mockSubjects: Subject[] = [
    { id: 'subj_math', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core', department: 'Sciences' },
    { id: 'subj_eng', subject_code: 'ENG', subject_name: 'English Language', education_level: 'Junior School', category: 'Core', department: 'Languages' },
    { id: 'subj_kisw', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core', department: 'Languages' },
    { id: 'subj_int_sci', subject_code: 'INT_SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core', department: 'Sciences' },
  ];

  const mockTeachers: Teacher[] = [
    { id: 'tch_01', teacher_name: 'Mr. David Sang', email: 'sang@muchorwe.ac.ke', phone: '+254712000001', is_class_teacher: true },
    { id: 'tch_02', teacher_name: 'Ms. Faith Cherono', email: 'cherono@muchorwe.ac.ke', phone: '+254712000002', is_class_teacher: true },
  ];

  it('generates a multi-page A4 landscape PDF for multi-stream grade', async () => {
    const classes: ClassStream[] = [
      { id: 'cls_8_blue', class_name: 'Grade 8', stream: 'Blue', capacity: 45, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_01' },
      { id: 'cls_8_red', class_name: 'Grade 8', stream: 'Red', capacity: 45, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_02' },
    ];

    const students: Student[] = [
      // Blue stream
      { id: 'std_01', admission_number: 'ADM-101', full_name: 'Brian Kiprop', gender: 'M', class_id: 'cls_8_blue', stream_id: 'cls_8_blue', active: true, grade: 'Grade 8', education_level: 'Junior School' },
      { id: 'std_02', admission_number: 'ADM-102', full_name: 'Mercy Jebet', gender: 'F', class_id: 'cls_8_blue', stream_id: 'cls_8_blue', active: true, grade: 'Grade 8', education_level: 'Junior School' },
      // Red stream
      { id: 'std_03', admission_number: 'ADM-103', full_name: 'Kevin Otieno', gender: 'M', class_id: 'cls_8_red', stream_id: 'cls_8_red', active: true, grade: 'Grade 8', education_level: 'Junior School' },
      { id: 'std_04', admission_number: 'ADM-104', full_name: 'Diana Chelangat', gender: 'F', class_id: 'cls_8_red', stream_id: 'cls_8_red', active: true, grade: 'Grade 8', education_level: 'Junior School' },
    ];

    const marks: Mark[] = [
      // Brian (Blue)
      { id: 'm_01', exam_id: 'exam_term1_2026', student_id: 'std_01', subject_id: 'subj_math', score: 85 },
      { id: 'm_02', exam_id: 'exam_term1_2026', student_id: 'std_01', subject_id: 'subj_eng', score: 78 },
      // Mercy (Blue)
      { id: 'm_03', exam_id: 'exam_term1_2026', student_id: 'std_02', subject_id: 'subj_math', score: 90 },
      { id: 'm_04', exam_id: 'exam_term1_2026', student_id: 'std_02', subject_id: 'subj_eng', score: 82 },
      // Kevin (Red)
      { id: 'm_05', exam_id: 'exam_term1_2026', student_id: 'std_03', subject_id: 'subj_math', score: 65 },
      { id: 'm_06', exam_id: 'exam_term1_2026', student_id: 'std_03', subject_id: 'subj_eng', score: 70 },
      // Diana (Red)
      { id: 'm_07', exam_id: 'exam_term1_2026', student_id: 'std_04', subject_id: 'subj_math', score: 72 },
      { id: 'm_08', exam_id: 'exam_term1_2026', student_id: 'std_04', subject_id: 'subj_eng', score: 74 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      marks,
      CBE_8_POINT_GRADES,
      mockTeachers
    );

    expect(result.className).toBe('Grade 8');
    expect(result.isSingleStream).toBe(false);
    expect(result.streams).toHaveLength(2);
    expect(result.aggregateComparison.grade_total_assessed).toBe(4);

    await exportClassPerformanceComparisonPDF({
      result,
      school: mockSchool,
      examination: mockExam,
      teachers: mockTeachers,
    });

    expect(capturedDoc).toBeDefined();
    expect(capturedFileName).toContain('Class_Performance_Comparison_Grade_8');

    // Landscape orientation checks (A4 landscape is 297mm x 210mm)
    const width = capturedDoc!.internal.pageSize.getWidth();
    const height = capturedDoc!.internal.pageSize.getHeight();
    expect(Math.round(width)).toBe(297);
    expect(Math.round(height)).toBe(210);

    // Multi-page document generated (Page 1: Overview & Stream Ranking, Page 2: Matrix, Page 3: Grade Top & Signatures)
    expect(capturedDoc!.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it('handles single-stream grade gracefully without crashing or phantom columns', async () => {
    const classes: ClassStream[] = [
      { id: 'cls_7_main', class_name: 'Grade 7', stream: 'Main', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_01' },
    ];

    const students: Student[] = [
      { id: 'std_701', admission_number: 'ADM-701', full_name: 'Sammy Koech', gender: 'M', class_id: 'cls_7_main', stream_id: 'cls_7_main', active: true, grade: 'Grade 7', education_level: 'Junior School' },
      { id: 'std_702', admission_number: 'ADM-702', full_name: 'Brenda Jerotich', gender: 'F', class_id: 'cls_7_main', stream_id: 'cls_7_main', active: true, grade: 'Grade 7', education_level: 'Junior School' },
    ];

    const marks: Mark[] = [
      { id: 'm_701', exam_id: 'exam_term1_2026', student_id: 'std_701', subject_id: 'subj_math', score: 80 },
      { id: 'm_702', exam_id: 'exam_term1_2026', student_id: 'std_702', subject_id: 'subj_math', score: 84 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 7',
      students,
      classes,
      mockSubjects,
      marks,
      CBE_8_POINT_GRADES,
      mockTeachers
    );

    expect(result.isSingleStream).toBe(true);
    expect(result.streams).toHaveLength(1);

    await exportClassPerformanceComparisonPDF({
      result,
      school: mockSchool,
      examination: mockExam,
      teachers: mockTeachers,
    });

    expect(capturedDoc).toBeDefined();
    expect(capturedFileName).toContain('Class_Performance_Comparison_Grade_7');
    expect(capturedDoc!.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it('handles competition ranking ties and unassessed subjects properly', async () => {
    const classes: ClassStream[] = [
      { id: 'cls_9_east', class_name: 'Grade 9', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active' },
      { id: 'cls_9_west', class_name: 'Grade 9', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active' },
    ];

    const students: Student[] = [
      { id: 'std_901', admission_number: 'ADM-901', full_name: 'Alice Wanjiku', gender: 'F', class_id: 'cls_9_east', stream_id: 'cls_9_east', active: true, grade: 'Grade 9', education_level: 'Junior School' },
      { id: 'std_902', admission_number: 'ADM-902', full_name: 'Bob Kiprono', gender: 'M', class_id: 'cls_9_west', stream_id: 'cls_9_west', active: true, grade: 'Grade 9', education_level: 'Junior School' },
    ];

    // Tied scores on Mathematics, unassessed on English and Integrated Science
    const marks: Mark[] = [
      { id: 'm_901', exam_id: 'exam_term1_2026', student_id: 'std_901', subject_id: 'subj_math', score: 75 },
      { id: 'm_902', exam_id: 'exam_term1_2026', student_id: 'std_902', subject_id: 'subj_math', score: 75 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 9',
      students,
      classes,
      mockSubjects,
      marks,
      CBE_8_POINT_GRADES,
      mockTeachers
    );

    // Both streams have exactly 75.00 average marks -> tie
    expect(result.aggregateComparison.is_tie).toBe(true);
    expect(result.aggregateComparison.stream_rankings[0].rank).toBe(1);
    expect(result.aggregateComparison.stream_rankings[1].rank).toBe(1);

    // Unassessed subject row check
    const engRow = result.rows.find((r) => r.subject_code === 'ENG');
    expect(engRow?.grade_overall_mean).toBeNull();

    await exportClassPerformanceComparisonPDF({
      result,
      school: mockSchool,
      examination: mockExam,
      teachers: mockTeachers,
    });

    expect(capturedDoc).toBeDefined();
    expect(capturedFileName).toContain('Class_Performance_Comparison_Grade_9');
  });

  it('renders clean empty state document when no learners have assessed marks', async () => {
    const classes: ClassStream[] = [
      { id: 'cls_6_a', class_name: 'Grade 6', stream: 'Alpha', capacity: 35, education_level: 'Upper Primary', status: 'Active' },
    ];

    const students: Student[] = [
      { id: 'std_601', admission_number: 'ADM-601', full_name: 'Collins Kipchumba', gender: 'M', class_id: 'cls_6_a', stream_id: 'cls_6_a', active: true, grade: 'Grade 6', education_level: 'Upper Primary' },
    ];

    // Zero marks entered
    const marks: Mark[] = [];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 6',
      students,
      classes,
      mockSubjects,
      marks,
      CBE_8_POINT_GRADES,
      mockTeachers
    );

    expect(result.hasAnyAssessed).toBe(false);

    await exportClassPerformanceComparisonPDF({
      result,
      school: mockSchool,
      examination: mockExam,
    });

    expect(capturedDoc).toBeDefined();
    // In empty state, single notification page is rendered
    expect(capturedDoc!.getNumberOfPages()).toBe(1);
    expect(capturedFileName).toContain('Class_Performance_Comparison_Grade_6');
  });
});
