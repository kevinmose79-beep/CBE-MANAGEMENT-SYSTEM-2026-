import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import {
  buildLearnerTrajectory,
  extractTermSequence,
  deriveMilestoneShortLabel,
  sortMilestonesChronologically,
  calculateProgressionSlope,
} from '../services/learnerTrajectoryEngine';
import {
  drawPerformanceProgressionGraph,
  createReportCardPDFDoc,
  PDFReportData,
} from '../services/pdfReportGenerator';
import { getDisplayExamName, getDisplayExamType, getDisplayMilestoneLabel } from '../utils/examDisplayUtils';
import { Student, Examination, Mark, Subject, Grade, School, ClassStream, Teacher } from '../types';

describe('Learner Performance Progression Graph — Verification Suite (Cases A–K)', () => {
  const mockSchool: School = {
    id: 'school-1',
    school_name: 'St. Jude Academy',
    principal_name: 'Dr. Margaret Muthoni',
    address: 'P.O. Box 1234, Nairobi',
    phone: '+254700000000',
    email: 'info@stjude.ac.ke',
    county: 'Nairobi',
    sub_county: 'Westlands',
  };

  const mockGrades: Grade[] = [
    { id: 'g1', grade_code: 'EE1', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceeding Expectations', performance_level: 'EE', descriptor: 'Exceeding Expectations' },
    { id: 'g2', grade_code: 'EE2', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Exceeding Expectations', performance_level: 'EE', descriptor: 'Exceeding Expectations' },
    { id: 'g3', grade_code: 'ME1', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Meeting Expectations', performance_level: 'ME', descriptor: 'Meeting Expectations' },
    { id: 'g4', grade_code: 'ME2', minimum_score: 41, maximum_score: 57, points: 5, remarks: 'Meeting Expectations', performance_level: 'ME', descriptor: 'Meeting Expectations' },
    { id: 'g5', grade_code: 'AE1', minimum_score: 31, maximum_score: 40, points: 4, remarks: 'Approaching Expectations', performance_level: 'AE', descriptor: 'Approaching Expectations' },
    { id: 'g6', grade_code: 'AE2', minimum_score: 21, maximum_score: 30, points: 3, remarks: 'Approaching Expectations', performance_level: 'AE', descriptor: 'Approaching Expectations' },
    { id: 'g7', grade_code: 'BE1', minimum_score: 11, maximum_score: 20, points: 2, remarks: 'Below Expectations', performance_level: 'BE', descriptor: 'Below Expectations' },
    { id: 'g8', grade_code: 'BE2', minimum_score: 0, maximum_score: 10, points: 1, remarks: 'Below Expectations', performance_level: 'BE', descriptor: 'Below Expectations' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub-eng', subject_name: 'English Language', subject_code: 'ENG', category: 'Core' },
    { id: 'sub-kis', subject_name: 'Kiswahili Language', subject_code: 'KIS', category: 'Core' },
    { id: 'sub-mat', subject_name: 'Mathematics Activities', subject_code: 'MAT', category: 'Core' },
  ];

  const mockClass: ClassStream = {
    id: 'class-g4',
    class_name: 'Grade 4',
    stream: 'East',
    education_level: 'Upper Primary',
  };

  const mockStudent: Student = {
    id: 'std-101',
    admission_number: 'ADM-101',
    full_name: 'Faith Mwangi',
    first_name: 'Faith',
    last_name: 'Mwangi',
    grade: 'Grade 4',
    class_id: 'class-g4',
    stream_id: 'stream-east',
    gender: 'F',
    active: true,
  };

  const mockExams: Examination[] = [
    {
      id: 'ex-1',
      exam_name: 'Term 1 Opener 2026',
      exam_type: 'CAT',
      term: 'Term 1',
      year: 2026,
      start_date: '2026-01-10',
      status: 'Published',
      max_marks: 100,
    },
    {
      id: 'ex-2',
      exam_name: 'Term 1 Mid-Term 2026',
      exam_type: 'Mid-Term',
      term: 'Term 1',
      year: 2026,
      start_date: '2026-02-20',
      status: 'Published',
      max_marks: 100,
    },
    {
      id: 'ex-3',
      exam_name: 'Term 1 End Term 2026',
      exam_type: 'End-Term',
      term: 'Term 1',
      year: 2026,
      start_date: '2026-03-30',
      status: 'Published',
      max_marks: 100,
    },
  ];

  const mockMarks: Mark[] = [
    // Exam 1: Avg = (70 + 65 + 75)/3 = 70.0 -> ME1
    { id: 'm1', student_id: 'std-101', exam_id: 'ex-1', subject_id: 'sub-eng', marks: 70, special_status: 'Normal' },
    { id: 'm2', student_id: 'std-101', exam_id: 'ex-1', subject_id: 'sub-kis', marks: 65, special_status: 'Normal' },
    { id: 'm3', student_id: 'std-101', exam_id: 'ex-1', subject_id: 'sub-mat', marks: 75, special_status: 'Normal' },
    // Exam 2: Avg = (80 + 78 + 82)/3 = 80.0 -> EE2
    { id: 'm4', student_id: 'std-101', exam_id: 'ex-2', subject_id: 'sub-eng', marks: 80, special_status: 'Normal' },
    { id: 'm5', student_id: 'std-101', exam_id: 'ex-2', subject_id: 'sub-kis', marks: 78, special_status: 'Normal' },
    { id: 'm6', student_id: 'std-101', exam_id: 'ex-2', subject_id: 'sub-mat', marks: 82, special_status: 'Normal' },
    // Exam 3: Avg = (88 + 84 + 92)/3 = 88.0 -> EE2
    { id: 'm7', student_id: 'std-101', exam_id: 'ex-3', subject_id: 'sub-eng', marks: 88, special_status: 'Normal' },
    { id: 'm8', student_id: 'std-101', exam_id: 'ex-3', subject_id: 'sub-kis', marks: 84, special_status: 'Normal' },
    { id: 'm9', student_id: 'std-101', exam_id: 'ex-3', subject_id: 'sub-mat', marks: 92, special_status: 'Normal' },
  ];

  it('Test A: Guarantees single-page (1 page) layout constraint across Lower, Upper Primary and Junior School', async () => {
    const reportDataUpper: PDFReportData = {
      student: mockStudent,
      school: mockSchool,
      exam: mockExams[2],
      allExams: mockExams,
      classes: [mockClass],
      subjects: mockSubjects,
      marks: mockMarks,
      grades: mockGrades,
      teachers: [],
      allStudents: [mockStudent],
      nextTermOpeningDate: '2026-05-04',
    };

    const docUpper = await createReportCardPDFDoc(reportDataUpper);
    expect(docUpper.getNumberOfPages()).toBe(1);

    const docLower = await createReportCardPDFDoc({
      ...reportDataUpper,
      student: { ...mockStudent, grade: 'Grade 2' },
      classes: [{ ...mockClass, class_name: 'Grade 2', education_level: 'Lower Primary' }],
    });
    expect(docLower.getNumberOfPages()).toBe(1);

    const docJunior = await createReportCardPDFDoc({
      ...reportDataUpper,
      student: { ...mockStudent, grade: 'Grade 7' },
      classes: [{ ...mockClass, class_name: 'Grade 7', education_level: 'Junior School' }],
    });
    expect(docJunior.getNumberOfPages()).toBe(1);
  });

  it('Test B: Handles 0 or 1 milestone gracefully with insufficient data notice without exceeding page boundary', async () => {
    const singleExamReport: PDFReportData = {
      student: mockStudent,
      school: mockSchool,
      exam: mockExams[0],
      allExams: [mockExams[0]],
      classes: [mockClass],
      subjects: mockSubjects,
      marks: mockMarks.slice(0, 3),
      grades: mockGrades,
      teachers: [],
      allStudents: [mockStudent],
      nextTermOpeningDate: '2026-05-04',
    };

    const doc = await createReportCardPDFDoc(singleExamReport);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('Test C: Computes accurate chronological trajectory milestones for >= 2 assessments', () => {
    const trajectory = buildLearnerTrajectory(
      mockStudent,
      mockExams,
      mockMarks,
      mockSubjects,
      mockGrades,
      [mockClass]
    );

    expect(trajectory.usable_milestones.length).toBe(3);
    expect(trajectory.usable_milestones[0].average_percentage).toBe(70); // (70+65+75)/3 = 70
    expect(trajectory.usable_milestones[1].average_percentage).toBe(80); // (80+78+82)/3 = 80
    expect(trajectory.usable_milestones[2].average_percentage).toBe(88); // (88+84+92)/3 = 88
    expect(trajectory.trend).toBe('improving');
  });

  it('Test D: Verifies CBE display normalisation for milestone examination labels', () => {
    expect(getDisplayExamName('CAT 1 Assessment')).toBe('Assessment 1');
    expect(getDisplayExamName('CAT 2')).toBe('Assessment 2');
    expect(getDisplayExamType('CAT')).toBe('Assessment');
    expect(getDisplayExamType('Mid-Term')).toBe('Mid-Term Assessment');
    expect(getDisplayMilestoneLabel('CAT 1')).toBe('Assessment 1');
  });

  it('Test E: Properly excludes or handles special status assessment marks (X/Y)', () => {
    const marksWithSpecial: Mark[] = [
      { id: 'm-s1', student_id: 'std-101', exam_id: 'ex-1', subject_id: 'sub-eng', marks: 70, special_status: 'Normal' },
      { id: 'm-s2', student_id: 'std-101', exam_id: 'ex-1', subject_id: 'sub-kis', marks: 0, special_status: 'X' },
      { id: 'm-s3', student_id: 'std-101', exam_id: 'ex-1', subject_id: 'sub-mat', marks: 80, special_status: 'Normal' },
    ];

    const trajectory = buildLearnerTrajectory(
      mockStudent,
      [mockExams[0], mockExams[1]],
      [...marksWithSpecial, ...mockMarks.slice(3, 6)],
      mockSubjects,
      mockGrades,
      [mockClass]
    );

    expect(trajectory.usable_milestones.length).toBe(2);
    // Excluded X status from mean average calculation: (70 + 80)/2 = 75
    expect(trajectory.usable_milestones[0].average_percentage).toBe(75);
  });

  it('Test F: Orders progression milestones strictly chronologically', () => {
    const unsortedExams: Examination[] = [
      { id: 'ex-c', exam_name: 'Term 2 Opener 2026', exam_type: 'CAT', term: 'Term 2', year: 2026, start_date: '2026-05-10', status: 'Published', max_marks: 100 },
      { id: 'ex-a', exam_name: 'Term 1 Opener 2026', exam_type: 'CAT', term: 'Term 1', year: 2026, start_date: '2026-01-10', status: 'Published', max_marks: 100 },
      { id: 'ex-b', exam_name: 'Term 1 End Term 2026', exam_type: 'End-Term', term: 'Term 1', year: 2026, start_date: '2026-03-30', status: 'Published', max_marks: 100 },
    ];

    const trajectory = buildLearnerTrajectory(
      mockStudent,
      unsortedExams,
      [
        { id: 'm-a', student_id: 'std-101', exam_id: 'ex-a', subject_id: 'sub-eng', marks: 60, special_status: 'Normal' },
        { id: 'm-b', student_id: 'std-101', exam_id: 'ex-b', subject_id: 'sub-eng', marks: 70, special_status: 'Normal' },
        { id: 'm-c', student_id: 'std-101', exam_id: 'ex-c', subject_id: 'sub-eng', marks: 80, special_status: 'Normal' },
      ],
      mockSubjects,
      mockGrades,
      [mockClass]
    );

    expect(trajectory.usable_milestones.map((t) => t.exam_id)).toEqual(['ex-a', 'ex-b', 'ex-c']);
  });

  it('Test G & H: Aggregates multiple learning areas and accurately identifies achievement levels', () => {
    const trajectory = buildLearnerTrajectory(
      mockStudent,
      mockExams,
      mockMarks,
      mockSubjects,
      mockGrades,
      [mockClass]
    );

    // Score 70 -> ME1, 80 -> EE2, 88 -> EE2
    expect(trajectory.usable_milestones[0].grade_code).toBe('ME1');
    expect(trajectory.usable_milestones[1].grade_code).toBe('EE2');
    expect(trajectory.usable_milestones[2].grade_code).toBe('EE2');
  });

  it('Test I: Regression slope calculation is accurate and robust', () => {
    const slope = calculateProgressionSlope([70, 80, 88]);
    expect(slope).toBe(9); // slope of progression points
  });

  it('Test J & K: drawPerformanceProgressionGraph does not exceed page boundaries and returns accurate next currentY', () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const contentWidth = 194;
    const marginX = 8;
    const initialY = 130;

    const nextY = drawPerformanceProgressionGraph(
      doc,
      {
        student: mockStudent,
        school: mockSchool,
        exam: mockExams[2],
        allExams: mockExams,
        classes: [mockClass],
        subjects: mockSubjects,
        marks: mockMarks,
        grades: mockGrades,
        teachers: [],
        allStudents: [mockStudent],
      },
      initialY,
      contentWidth,
      marginX
    );

    expect(nextY).toBeGreaterThan(initialY);
    expect(nextY).toBeLessThan(180); // Leaves ample space for remarks, grading scale key, signatures and footer
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
