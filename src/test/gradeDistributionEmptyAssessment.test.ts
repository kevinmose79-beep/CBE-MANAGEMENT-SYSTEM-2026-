import { describe, it, expect } from 'vitest';
import { generateExamAnalysisSummary } from '../services/analysisEngine';
import { Student, Mark, Examination, Subject, Grade } from '../types';

describe('Grade Distribution Analysis — Assessment With No Marks vs Valid Marks', () => {
  const mockExam: Examination = {
    id: 'exam_term2_mid',
    exam_name: 'Midterm 2',
    term: 'Term 2',
    year: 2026,
    status: 'Provisional',
    exam_type: 'Mid-Term',
    max_marks: 100,
  };

  const mockStudents: Student[] = [
    {
      id: 'std_01',
      admission_number: 'ADM001',
      full_name: 'Brian Ochieng',
      grade: 'Grade 9',
      class_id: 'cls_g9_red',
      stream_id: 'stream_g9_red',
      active: true,
      gender: 'M',
    },
    {
      id: 'std_02',
      admission_number: 'ADM002',
      full_name: 'Amina Ali',
      grade: 'Grade 9',
      class_id: 'cls_g9_red',
      stream_id: 'stream_g9_red',
      active: true,
      gender: 'F',
    },
    {
      id: 'std_03',
      admission_number: 'ADM003',
      full_name: 'John Kamau',
      grade: 'Grade 9',
      class_id: 'cls_g9_red',
      stream_id: 'stream_g9_red',
      active: true,
      gender: 'M',
    },
  ];

  const mockSubjects: Subject[] = [
    {
      id: 'sub_mat',
      subject_name: 'Mathematics',
      subject_code: 'MAT',
      department: 'Sciences',
      education_level: 'Junior School',
      category: 'Core',
    },
    {
      id: 'sub_eng',
      subject_name: 'English',
      subject_code: 'ENG',
      department: 'Languages',
      education_level: 'Junior School',
      category: 'Core',
    },
  ];

  const mockGrades: Grade[] = [
    {
      id: 'grd_ee1',
      grade: 'EE1',
      grade_code: 'EE1',
      descriptor: 'Exceeding Expectations (High)',
      remarks: 'Outstanding Performance',
      minimum_score: 90,
      maximum_score: 100,
      points: 8,
      performance_level: 'EE',
    },
    {
      id: 'grd_ee2',
      grade: 'EE2',
      grade_code: 'EE2',
      descriptor: 'Exceeding Expectations',
      remarks: 'Excellent Performance',
      minimum_score: 80,
      maximum_score: 89,
      points: 7,
      performance_level: 'EE',
    },
    {
      id: 'grd_me1',
      grade: 'ME1',
      grade_code: 'ME1',
      descriptor: 'Meeting Expectations (High)',
      remarks: 'Very Good Performance',
      minimum_score: 72,
      maximum_score: 79,
      points: 6,
      performance_level: 'ME',
    },
    {
      id: 'grd_me2',
      grade: 'ME2',
      grade_code: 'ME2',
      descriptor: 'Meeting Expectations',
      remarks: 'Good Performance',
      minimum_score: 65,
      maximum_score: 71,
      points: 5,
      performance_level: 'ME',
    },
    {
      id: 'grd_ae1',
      grade: 'AE1',
      grade_code: 'AE1',
      descriptor: 'Approaching Expectations (High)',
      remarks: 'Fair Performance',
      minimum_score: 58,
      maximum_score: 64,
      points: 4,
      performance_level: 'AE',
    },
    {
      id: 'grd_ae2',
      grade: 'AE2',
      grade_code: 'AE2',
      descriptor: 'Approaching Expectations',
      remarks: 'Average Performance',
      minimum_score: 50,
      maximum_score: 57,
      points: 3,
      performance_level: 'AE',
    },
    {
      id: 'grd_be1',
      grade: 'BE1',
      grade_code: 'BE1',
      descriptor: 'Below Expectations (High)',
      remarks: 'Requires Support',
      minimum_score: 35,
      maximum_score: 49,
      points: 2,
      performance_level: 'BE',
    },
    {
      id: 'grd_be2',
      grade: 'BE2',
      grade_code: 'BE2',
      descriptor: 'Below Expectations',
      remarks: 'Immediate Support Required',
      minimum_score: 0,
      maximum_score: 34,
      points: 1,
      performance_level: 'BE',
    },
  ];

  it('Test A: When no marks exist for the assessment, all grade & level counts are 0 (no bar graph data)', () => {
    const emptyMarks: Mark[] = [];

    const summary = generateExamAnalysisSummary(
      mockExam.id,
      mockExam.exam_name,
      mockStudents,
      mockSubjects,
      emptyMarks,
      mockGrades
    );

    // Level counts should all be 0 (no artificial BE or ME assigned to unassessed learners)
    expect(summary.level_counts.EE).toBe(0);
    expect(summary.level_counts.ME).toBe(0);
    expect(summary.level_counts.AE).toBe(0);
    expect(summary.level_counts.BE).toBe(0);

    // Grade counts should all be 0
    Object.values(summary.grade_counts).forEach((count) => {
      expect(count).toBe(0);
    });

    // ChartWrapper hasData checks for Teacher & Admin Dashboard
    const teacherPerformanceData = [
      { level: 'EE', count: summary.level_counts.EE },
      { level: 'ME', count: summary.level_counts.ME },
      { level: 'AE', count: summary.level_counts.AE },
      { level: 'BE', count: summary.level_counts.BE },
    ];
    const hasTeacherChartData = teacherPerformanceData.some((d) => d.count > 0);
    expect(hasTeacherChartData).toBe(false);

    const adminChartData = mockGrades.map((g) => ({
      grade: g.grade_code || g.grade,
      count: summary.grade_counts[g.grade_code || g.grade] || 0,
    }));
    const hasAdminChartData = adminChartData.some((d) => d.count > 0);
    expect(hasAdminChartData).toBe(false);
  });

  it('Test B: When one valid mark exists, distribution is calculated only for the assessed student', () => {
    const singleMark: Mark[] = [
      {
        id: 'mrk_01',
        exam_id: 'exam_term2_mid',
        student_id: 'std_01',
        subject_id: 'sub_mat',
        marks: 85,
        raw_score: 85,
        out_of: 100,
      },
    ];

    const summary = generateExamAnalysisSummary(
      mockExam.id,
      mockExam.exam_name,
      mockStudents,
      mockSubjects,
      singleMark,
      mockGrades
    );

    expect(summary.level_counts.EE).toBe(1); // 85% is EE2 -> EE
    expect(summary.level_counts.ME).toBe(0);
    expect(summary.level_counts.AE).toBe(0);
    expect(summary.level_counts.BE).toBe(0); // The 2 unassessed students are NOT placed into BE

    expect(summary.grade_counts['EE2']).toBe(1);
    expect(summary.grade_counts['BE2']).toBe(0);

    const hasData = [
      summary.level_counts.EE,
      summary.level_counts.ME,
      summary.level_counts.AE,
      summary.level_counts.BE,
    ].some((c) => c > 0);
    expect(hasData).toBe(true);
  });

  it('Test C: Multiple students with marks distribute into their respective performance levels', () => {
    const marks: Mark[] = [
      { id: 'm1', exam_id: 'exam_term2_mid', student_id: 'std_01', subject_id: 'sub_mat', marks: 92, raw_score: 92, out_of: 100 }, // EE1 (EE)
      { id: 'm2', exam_id: 'exam_term2_mid', student_id: 'std_02', subject_id: 'sub_mat', marks: 68, raw_score: 68, out_of: 100 }, // ME2 (ME)
      { id: 'm3', exam_id: 'exam_term2_mid', student_id: 'std_03', subject_id: 'sub_mat', marks: 54, raw_score: 54, out_of: 100 }, // AE2 (AE)
    ];

    const summary = generateExamAnalysisSummary(
      mockExam.id,
      mockExam.exam_name,
      mockStudents,
      mockSubjects,
      marks,
      mockGrades
    );

    expect(summary.level_counts.EE).toBe(1);
    expect(summary.level_counts.ME).toBe(1);
    expect(summary.level_counts.AE).toBe(1);
    expect(summary.level_counts.BE).toBe(0);
  });

  it('Test D & E: Distinguishes between legitimate 0 mark (assessed, BE) and missing mark (unassessed, not counted)', () => {
    const marks: Mark[] = [
      // std_01 got a genuine 0 on Mathematics
      { id: 'm1', exam_id: 'exam_term2_mid', student_id: 'std_01', subject_id: 'sub_mat', marks: 0, raw_score: 0, out_of: 100 },
      // std_02 got 80 on Mathematics
      { id: 'm2', exam_id: 'exam_term2_mid', student_id: 'std_02', subject_id: 'sub_mat', marks: 80, raw_score: 80, out_of: 100 },
      // std_03 has NO marks entered (missing)
    ];

    const summary = generateExamAnalysisSummary(
      mockExam.id,
      mockExam.exam_name,
      mockStudents,
      mockSubjects,
      marks,
      mockGrades
    );

    // std_02 is EE, std_01 with score 0 is BE
    expect(summary.level_counts.EE).toBe(1);
    expect(summary.level_counts.BE).toBe(1); // std_01 is counted
    expect(summary.level_counts.ME).toBe(0);
    expect(summary.level_counts.AE).toBe(0);

    // std_03 is NOT counted, so BE total is 1, not 2
    expect(summary.level_counts.BE).toBe(1);
    expect(summary.grade_counts['BE2']).toBe(1);
  });

  it('Test F: Switching between an exam with marks and an exam without marks updates hasData correctly', () => {
    const examWithMarks: Examination = {
      id: 'exam_1',
      exam_name: 'Opener Exam',
      term: 'Term 1',
      year: 2026,
      status: 'Published',
      exam_type: 'Mid-Term',
      max_marks: 100,
    };
    const examWithoutMarks: Examination = {
      id: 'exam_2',
      exam_name: 'End Term Exam',
      term: 'Term 1',
      year: 2026,
      status: 'Provisional',
      exam_type: 'Mid-Term',
      max_marks: 100,
    };

    const marksForExam1: Mark[] = [
      { id: 'm1', exam_id: 'exam_1', student_id: 'std_01', subject_id: 'sub_mat', marks: 75, raw_score: 75, out_of: 100 },
    ];

    // 1. Evaluate Exam 1 (has marks)
    const summary1 = generateExamAnalysisSummary(
      examWithMarks.id,
      examWithMarks.exam_name,
      mockStudents,
      mockSubjects,
      marksForExam1,
      mockGrades
    );
    const hasData1 = Object.values(summary1.level_counts).some((c) => c > 0);
    expect(hasData1).toBe(true);

    // 2. Evaluate Exam 2 (no marks)
    const summary2 = generateExamAnalysisSummary(
      examWithoutMarks.id,
      examWithoutMarks.exam_name,
      mockStudents,
      mockSubjects,
      marksForExam1, // passed global marks array, but no marks match exam_2
      mockGrades
    );
    const hasData2 = Object.values(summary2.level_counts).some((c) => c > 0);
    expect(hasData2).toBe(false);
    expect(summary2.level_counts.BE).toBe(0);
    expect(summary2.grade_counts['BE2'] || 0).toBe(0);
  });
});
