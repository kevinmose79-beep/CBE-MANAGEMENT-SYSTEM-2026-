import { describe, it, expect } from 'vitest';
import { generateClassPerformanceComparison } from './classComparisonEngine';
import { Student, ClassStream, Examination, Subject, Mark, Grade, Teacher } from '../types';

describe('classComparisonEngine', () => {
  const mockGrades: Grade[] = [
    { id: '1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceptional', descriptor: 'Exceeding Expectations' },
    { id: '2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Very Good', descriptor: 'Exceeding Expectations' },
    { id: '3', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Good', descriptor: 'Meeting Expectations' },
    { id: '4', grade_code: 'ME2', performance_level: 'ME', minimum_score: 41, maximum_score: 57, points: 5, remarks: 'Fair', descriptor: 'Meeting Expectations' },
    { id: '5', grade_code: 'AE1', performance_level: 'AE', minimum_score: 31, maximum_score: 40, points: 4, remarks: 'Approaching', descriptor: 'Approaching Expectations' },
    { id: '6', grade_code: 'AE2', performance_level: 'AE', minimum_score: 21, maximum_score: 30, points: 3, remarks: 'Weak', descriptor: 'Approaching Expectations' },
    { id: '7', grade_code: 'BE1', performance_level: 'BE', minimum_score: 11, maximum_score: 20, points: 2, remarks: 'Poor', descriptor: 'Below Expectations' },
    { id: '8', grade_code: 'BE2', performance_level: 'BE', minimum_score: 0, maximum_score: 10, points: 1, remarks: 'Very Poor', descriptor: 'Below Expectations' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub_eng', subject_code: 'ENG', subject_name: 'English', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_mat', subject_code: 'MAT', subject_name: 'Mathematics', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_sci', subject_code: 'SCI', subject_name: 'Integrated Science', category: 'Core', education_level: 'Junior School' },
  ];

  const mockExam: Examination = {
    id: 'exam_2026_t1',
    exam_name: 'End Term 1 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
    start_date: '2026-03-20',
    end_date: '2026-03-27',
  };

  it('Scenario 4: Unequal stream sizes must calculate true weighted Grade Overall Mean (not average of stream averages)', () => {
    // 40 learners in Blue with 50% in English
    // 20 learners in Red with 70% in English
    // Correct Grade Overall: (40*50 + 20*70) / 60 = 3400 / 60 = 56.666...% (56.67%)
    // WRONG (unweighted average): (50 + 70) / 2 = 60.00%
    const classes: ClassStream[] = [
      { id: 'cls_g9_b', stream_id: 'strm_b', class_name: 'Grade 9', stream: 'Blue' },
      { id: 'cls_g9_r', stream_id: 'strm_r', class_name: 'Grade 9', stream: 'Red' },
    ];

    const students: Student[] = [];
    const marks: Mark[] = [];

    // 40 Blue learners
    for (let i = 1; i <= 40; i++) {
      const sId = `std_blue_${i}`;
      students.push({
        id: sId,
        admission_number: `B${i}`,
        full_name: `Blue Learner ${i}`,
        class_id: 'cls_g9_b',
        stream_id: 'strm_b',
        grade: 'Grade 9',
        gender: 'M',
        active: true,
      });
      marks.push({
        id: `m_eng_b_${i}`,
        exam_id: mockExam.id,
        student_id: sId,
        subject_id: 'sub_eng',
        score: 50,
      });
    }

    // 20 Red learners
    for (let i = 1; i <= 20; i++) {
      const sId = `std_red_${i}`;
      students.push({
        id: sId,
        admission_number: `R${i}`,
        full_name: `Red Learner ${i}`,
        class_id: 'cls_g9_r',
        stream_id: 'strm_r',
        grade: 'Grade 9',
        gender: 'F',
        active: true,
      });
      marks.push({
        id: `m_eng_r_${i}`,
        exam_id: mockExam.id,
        student_id: sId,
        subject_id: 'sub_eng',
        score: 70,
      });
    }

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 9',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng');
    expect(engRow).toBeDefined();

    // Verify Blue mean is exactly 50
    expect(engRow!.stream_means['blue'].mean_percentage).toBe(50);
    expect(engRow!.stream_means['blue'].assessed_count).toBe(40);

    // Verify Red mean is exactly 70
    expect(engRow!.stream_means['red'].mean_percentage).toBe(70);
    expect(engRow!.stream_means['red'].assessed_count).toBe(20);

    // Verify Grade Overall is 56.6667%, NOT 60%
    expect(engRow!.total_assessed).toBe(60);
    expect(engRow!.grade_overall_mean).toBeCloseTo(56.6667, 3);
    expect(engRow!.grade_overall_mean).not.toBe(60);

    // Verify differences
    expect(engRow!.stream_means['blue'].difference_from_grade).toBeCloseTo(50 - 56.6667, 3);
    expect(engRow!.stream_means['red'].difference_from_grade).toBeCloseTo(70 - 56.6667, 3);
    expect(engRow!.highest_stream_name).toBe('Red');
  });

  it('Scenario 1 & 21: Single stream grade handles comparison gracefully without breaking', () => {
    const classes: ClassStream[] = [
      { id: 'cls_g6_m', stream_id: 'strm_m', class_name: 'Grade 6', stream: 'Main' },
    ];

    const students: Student[] = [
      {
        id: 'std_g6_1',
        admission_number: 'G6_1',
        full_name: 'Grade 6 Learner',
        class_id: 'cls_g6_m',
        stream_id: 'strm_m',
        grade: 'Grade 6',
        gender: 'M',
        active: true,
      },
    ];

    const marks: Mark[] = [
      {
        id: 'm_g6_eng',
        exam_id: mockExam.id,
        student_id: 'std_g6_1',
        subject_id: 'sub_eng',
        score: 58,
      },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 6',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    expect(result.isSingleStream).toBe(true);
    expect(result.streams.length).toBe(1);
    expect(result.rows[0].grade_overall_mean).toBeCloseTo(58, 2);
    expect(result.rows[0].stream_means['main'].mean_percentage).toBeCloseTo(58, 2);
  });

  it('Scenario 3: Supports dynamic number of streams with arbitrary names', () => {
    const classes: ClassStream[] = [
      { id: 'cls_n', stream_id: 's_n', class_name: 'Grade 8', stream: 'North' },
      { id: 'cls_s', stream_id: 's_s', class_name: 'Grade 8', stream: 'South' },
      { id: 'cls_e', stream_id: 's_e', class_name: 'Grade 8', stream: 'East' },
      { id: 'cls_w', stream_id: 's_w', class_name: 'Grade 8', stream: 'West' },
    ];

    const students: Student[] = [
      { id: 'std_n', admission_number: 'N1', full_name: 'North S', class_id: 'cls_n', stream_id: 's_n', grade: 'Grade 8', gender: 'M', active: true },
      { id: 'std_s', admission_number: 'S1', full_name: 'South S', class_id: 'cls_s', stream_id: 's_s', grade: 'Grade 8', gender: 'F', active: true },
      { id: 'std_e', admission_number: 'E1', full_name: 'East S', class_id: 'cls_e', stream_id: 's_e', grade: 'Grade 8', gender: 'M', active: true },
      { id: 'std_w', admission_number: 'W1', full_name: 'West S', class_id: 'cls_w', stream_id: 's_w', grade: 'Grade 8', gender: 'F', active: true },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      [],
      mockGrades
    );

    expect(result.isSingleStream).toBe(false);
    expect(result.streams.length).toBe(4);
    const names = result.streams.map((s) => s.name);
    expect(names).toContain('North');
    expect(names).toContain('South');
    expect(names).toContain('East');
    expect(names).toContain('West');
  });

  it('Scenario 5 & 6: Excludes X (absent), Y (irregularity), and unassessed learners from percentage means', () => {
    const classes: ClassStream[] = [
      { id: 'cls_g7_b', stream_id: 'strm_b', class_name: 'Grade 7', stream: 'Blue' },
    ];

    const students: Student[] = [
      { id: 's1', admission_number: 'A1', full_name: 'Student 1', class_id: 'cls_g7_b', stream_id: 'strm_b', grade: 'Grade 7', gender: 'M', active: true },
      { id: 's2', admission_number: 'A2', full_name: 'Student 2', class_id: 'cls_g7_b', stream_id: 'strm_b', grade: 'Grade 7', gender: 'F', active: true },
      { id: 's3', admission_number: 'A3', full_name: 'Student 3', class_id: 'cls_g7_b', stream_id: 'strm_b', grade: 'Grade 7', gender: 'M', active: true },
    ];

    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_mat', score: 60 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_mat', score: null, special_status: 'X' }, // Absent
      { id: 'm3', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_mat', score: null, special_status: 'Y' }, // Disqualified
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 7',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const matRow = result.rows.find((r) => r.subject_id === 'sub_mat')!;
    // Only student 1 is valid (60%). The absent (X) and disqualified (Y) must NOT be counted as 0%
    expect(matRow.total_assessed).toBe(1);
    expect(matRow.grade_overall_mean).toBe(60);
    expect(matRow.stream_means['blue'].assessed_count).toBe(1);
    expect(matRow.stream_means['blue'].mean_percentage).toBe(60);
  });

  it('Scenario 7: Returns null for unassessed learning areas (never false 0.00%)', () => {
    const classes: ClassStream[] = [
      { id: 'cls_g7_b', stream_id: 'strm_b', class_name: 'Grade 7', stream: 'Blue' },
    ];

    const students: Student[] = [
      { id: 's1', admission_number: 'A1', full_name: 'Student 1', class_id: 'cls_g7_b', stream_id: 'strm_b', grade: 'Grade 7', gender: 'M', active: true },
    ];

    // No marks entered for SCI
    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 7',
      students,
      classes,
      mockSubjects,
      [],
      mockGrades
    );

    const sciRow = result.rows.find((r) => r.subject_id === 'sub_sci')!;
    expect(sciRow.total_assessed).toBe(0);
    expect(sciRow.grade_overall_mean).toBeNull();
    expect(sciRow.stream_means['blue'].mean_percentage).toBeNull();
    expect(sciRow.stream_means['blue'].difference_from_grade).toBeNull();
  });

  it('Scenario 8 & 9: Respects historical examination cohort promotion context', () => {
    const classes: ClassStream[] = [
      { id: 'cls_g7_b', stream_id: 'strm_7b', class_name: 'Grade 7', stream: 'Blue' },
      { id: 'cls_g8_r', stream_id: 'strm_8r', class_name: 'Grade 8', stream: 'Red' },
    ];

    // Student was in Grade 7 Blue during 2025 exam, now promoted to Grade 8 Red in 2026
    const historicalExam: Examination = {
      id: 'exam_2025_t3',
      exam_name: 'End Term 3 2025',
      term: 'Term 3',
      year: 2025,
      status: 'Approved',
      exam_type: 'End-Term',
      max_marks: 100,
      start_date: '2025-11-10',
      end_date: '2025-11-20',
    };

    const promotedStudent: Student = {
      id: 'std_promoted',
      admission_number: 'P01',
      full_name: 'Promoted Learner',
      class_id: 'cls_g8_r',
      stream_id: 'strm_8r',
      grade: 'Grade 8',
      gender: 'M',
      active: true,
      promotion_history: [
        {
          id: 'promo_1',
          student_id: 'std_promoted',
          from_grade: 'Grade 7',
          to_grade: 'Grade 8',
          from_class_id: 'cls_g7_b',
          to_class_id: 'cls_g8_r',
          date_promoted: '2026-01-05',
          academic_year_id: 'ay_2026',
        },
      ],
    };

    const mark: Mark = {
      id: 'm_hist',
      exam_id: historicalExam.id,
      student_id: 'std_promoted',
      subject_id: 'sub_eng',
      score: 64,
    };

    // When viewing historical exam for Grade 7:
    const g7Result = generateClassPerformanceComparison(
      historicalExam,
      'Grade 7',
      [promotedStudent],
      classes,
      mockSubjects,
      [mark],
      mockGrades
    );

    // Learner must be included in Grade 7 Blue for this 2025 exam!
    expect(g7Result.gradeTotalLearners).toBe(1);
    const engRow = g7Result.rows.find((r) => r.subject_id === 'sub_eng')!;
    expect(engRow.total_assessed).toBe(1);
    expect(engRow.grade_overall_mean).toBe(64);
    expect(engRow.stream_means['blue'].mean_percentage).toBe(64);

    // When viewing historical exam for Grade 8:
    const g8Result = generateClassPerformanceComparison(
      historicalExam,
      'Grade 8',
      [promotedStudent],
      classes,
      mockSubjects,
      [mark],
      mockGrades
    );
    // In 2025, learner was NOT in Grade 8, so Grade 8 must have 0 learners
    expect(g8Result.gradeTotalLearners).toBe(0);
  });

  it('Section One vs Section Two: Strictly preserves distinction between aggregate Class Average Marks and Learning Area Mean %', () => {
    const classes: ClassStream[] = [
      { id: 'cls_g9_b', stream_id: 'strm_b', class_name: 'Grade 9', stream: 'Blue' },
      { id: 'cls_g9_r', stream_id: 'strm_r', class_name: 'Grade 9', stream: 'Red' },
    ];

    // Learner 1 in Blue: ENG 40, MAT 60, SCI 50 => Total 150 marks
    // Learner 2 in Red:  ENG 80, MAT 80, SCI 80 => Total 240 marks
    const students: Student[] = [
      { id: 's_b1', admission_number: 'B1', full_name: 'Blue 1', class_id: 'cls_g9_b', stream_id: 'strm_b', grade: 'Grade 9', gender: 'M', active: true },
      { id: 's_r1', admission_number: 'R1', full_name: 'Red 1', class_id: 'cls_g9_r', stream_id: 'strm_r', grade: 'Grade 9', gender: 'F', active: true },
    ];

    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_eng', score: 40 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_mat', score: 60 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_sci', score: 50 },

      { id: 'm4', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_eng', score: 80 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_mat', score: 80 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_sci', score: 80 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 9',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    // SECTION ONE: Class Average Marks (aggregate marks, NOT percentage)
    // Blue Total Marks = 150 / 1 assessed = 150
    // Red Total Marks = 240 / 1 assessed = 240
    // Grade Overall Class Average Marks = (150 + 240) / 2 = 195
    const agg = result.aggregateComparison;
    expect(agg.stream_averages['blue'].average_marks).toBe(150);
    expect(agg.stream_averages['red'].average_marks).toBe(240);
    expect(agg.grade_overall_average_marks).toBe(195);
    expect(agg.grade_total_assessed).toBe(2);
    expect(agg.highest_stream_name).toBe('Red');

    // SECTION TWO: Learning Area Mean Percentage (percentage scores, e.g. 40%, 80%, 60%)
    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng')!;
    expect(engRow.stream_means['blue'].mean_percentage).toBe(40);
    expect(engRow.stream_means['red'].mean_percentage).toBe(80);
    expect(engRow.grade_overall_mean).toBe(60); // (40 + 80) / 2 = 60%
    // Verify that Class Average Marks (195) is completely distinct from English Mean % (60%)
    expect(agg.grade_overall_average_marks).not.toBe(engRow.grade_overall_mean);
  });

  it('Feature 1: Learning Area ranking within stream assigns competition ranking (1, 1, 3)', () => {
    const classes: ClassStream[] = [
      { id: 'cls_1', stream_id: 'strm_blue', class_name: 'Grade 8', stream: 'Blue' },
    ];
    const students: Student[] = [
      { id: 's1', admission_number: 'B1', full_name: 'Alice', class_id: 'cls_1', stream_id: 'strm_blue', grade: 'Grade 8', gender: 'F', active: true },
    ];
    // Alice scores: ENG 80, MAT 80, SCI 60
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 80 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_mat', score: 80 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_sci', score: 60 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng')!;
    const matRow = result.rows.find((r) => r.subject_id === 'sub_mat')!;
    const sciRow = result.rows.find((r) => r.subject_id === 'sub_sci')!;

    // ENG and MAT tied for 1st in Blue => rank 1
    // SCI should be rank 3 (standard competition ranking: 1, 1, 3)
    expect(engRow.stream_means['blue'].stream_rank).toBe(1);
    expect(matRow.stream_means['blue'].stream_rank).toBe(1);
    expect(sciRow.stream_means['blue'].stream_rank).toBe(3);
  });

  it('Feature 1: Unassessed subjects in a stream receive null stream_rank and do not affect ranking', () => {
    const classes: ClassStream[] = [
      { id: 'cls_1', stream_id: 'strm_blue', class_name: 'Grade 8', stream: 'Blue' },
    ];
    const students: Student[] = [
      { id: 's1', admission_number: 'B1', full_name: 'Alice', class_id: 'cls_1', stream_id: 'strm_blue', grade: 'Grade 8', gender: 'F', active: true },
    ];
    // Alice scores in ENG and MAT, but SCI has no marks
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 70 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_mat', score: 85 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng')!;
    const matRow = result.rows.find((r) => r.subject_id === 'sub_mat')!;
    const sciRow = result.rows.find((r) => r.subject_id === 'sub_sci')!;

    expect(matRow.stream_means['blue'].stream_rank).toBe(1);
    expect(engRow.stream_means['blue'].stream_rank).toBe(2);
    expect(sciRow.stream_means['blue'].stream_rank).toBeNull();
  });

  it('Feature 2: Learning Area ranking for Grade overall ranks across all subjects by grade_overall_mean', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 7', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 7', stream: 'Red' },
    ];
    const students: Student[] = [
      { id: 's_b', admission_number: 'B1', full_name: 'B1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 7', gender: 'M', active: true },
      { id: 's_r', admission_number: 'R1', full_name: 'R1', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 7', gender: 'F', active: true },
    ];
    // Overall Means:
    // MAT: (90 + 80) / 2 = 85% -> Rank 1
    // ENG: (70 + 70) / 2 = 70% -> Rank 2
    // SCI: (50 + 60) / 2 = 55% -> Rank 3
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_mat', score: 90 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_mat', score: 80 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_eng', score: 70 },
      { id: 'm4', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_eng', score: 70 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_sci', score: 50 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_sci', score: 60 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 7',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const matRow = result.rows.find((r) => r.subject_id === 'sub_mat')!;
    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng')!;
    const sciRow = result.rows.find((r) => r.subject_id === 'sub_sci')!;

    expect(matRow.grade_overall_rank).toBe(1);
    expect(engRow.grade_overall_rank).toBe(2);
    expect(sciRow.grade_overall_rank).toBe(3);
  });

  it('Feature 2: Grade overall ranking handles tied subjects with competition ranking (1, 1, 3)', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 7', stream: 'Blue' },
    ];
    const students: Student[] = [
      { id: 's_b', admission_number: 'B1', full_name: 'B1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 7', gender: 'M', active: true },
    ];
    // MAT: 75%, ENG: 75%, SCI: 50%
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_mat', score: 75 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_eng', score: 75 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_sci', score: 50 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 7',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const matRow = result.rows.find((r) => r.subject_id === 'sub_mat')!;
    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng')!;
    const sciRow = result.rows.find((r) => r.subject_id === 'sub_sci')!;

    expect(matRow.grade_overall_rank).toBe(1);
    expect(engRow.grade_overall_rank).toBe(1);
    expect(sciRow.grade_overall_rank).toBe(3);
  });

  it('Feature 3: Stream Performance Ranking ranks streams by Class Average Marks using competition ranking', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 8', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 8', stream: 'Red' },
      { id: 'cls_g', stream_id: 'strm_g', class_name: 'Grade 8', stream: 'Green' },
    ];
    const students: Student[] = [
      { id: 's_b', admission_number: 'B1', full_name: 'Blue 1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
      { id: 's_r', admission_number: 'R1', full_name: 'Red 1', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 8', gender: 'F', active: true },
      { id: 's_g', admission_number: 'G1', full_name: 'Green 1', class_id: 'cls_g', stream_id: 'strm_g', grade: 'Grade 8', gender: 'M', active: true },
    ];
    // Red: total 250 marks (ENG 90, MAT 80, SCI 80) => Avg marks 250
    // Blue: total 200 marks (ENG 70, MAT 70, SCI 60) => Avg marks 200
    // Green: total 150 marks (ENG 50, MAT 50, SCI 50) => Avg marks 150
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_eng', score: 90 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_mat', score: 80 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_sci', score: 80 },

      { id: 'm4', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_eng', score: 70 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_mat', score: 70 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_sci', score: 60 },

      { id: 'm7', exam_id: mockExam.id, student_id: 's_g', subject_id: 'sub_eng', score: 50 },
      { id: 'm8', exam_id: mockExam.id, student_id: 's_g', subject_id: 'sub_mat', score: 50 },
      { id: 'm9', exam_id: mockExam.id, student_id: 's_g', subject_id: 'sub_sci', score: 50 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const rankings = result.aggregateComparison.stream_rankings;
    expect(rankings).toHaveLength(3);

    // Sorted order: Red (250), Blue (200), Green (150)
    expect(rankings[0].stream_name).toBe('Red');
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].average_marks).toBe(250);

    expect(rankings[1].stream_name).toBe('Blue');
    expect(rankings[1].rank).toBe(2);
    expect(rankings[1].average_marks).toBe(200);

    expect(rankings[2].stream_name).toBe('Green');
    expect(rankings[2].rank).toBe(3);
    expect(rankings[2].average_marks).toBe(150);
  });

  it('Feature 3: Stream Performance Ranking handles tied stream averages (1, 1, 3)', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 6', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 6', stream: 'Red' },
      { id: 'cls_g', stream_id: 'strm_g', class_name: 'Grade 6', stream: 'Green' },
    ];
    const students: Student[] = [
      { id: 's_b', admission_number: 'B1', full_name: 'Blue 1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 6', gender: 'M', active: true },
      { id: 's_r', admission_number: 'R1', full_name: 'Red 1', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 6', gender: 'F', active: true },
      { id: 's_g', admission_number: 'G1', full_name: 'Green 1', class_id: 'cls_g', stream_id: 'strm_g', grade: 'Grade 6', gender: 'M', active: true },
    ];
    // Blue & Red both have avg marks = 200
    // Green has avg marks = 100
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_eng', score: 100 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_mat', score: 100 },

      { id: 'm3', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_eng', score: 100 },
      { id: 'm4', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_mat', score: 100 },

      { id: 'm5', exam_id: mockExam.id, student_id: 's_g', subject_id: 'sub_eng', score: 50 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's_g', subject_id: 'sub_mat', score: 50 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 6',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const rankings = result.aggregateComparison.stream_rankings;
    const blueRank = rankings.find((r) => r.stream_id === 'blue')!;
    const redRank = rankings.find((r) => r.stream_id === 'red')!;
    const greenRank = rankings.find((r) => r.stream_id === 'green')!;

    expect(blueRank.rank).toBe(1);
    expect(redRank.rank).toBe(1);
    expect(greenRank.rank).toBe(3); // Competition tie skip: 1, 1, 3
  });

  it('Feature 3: Resolves class teacher name correctly from teachers array', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 5', stream: 'Blue', class_teacher_id: 'tch_omondi' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 5', stream: 'Red' }, // no teacher assigned
    ];
    const teachers: Teacher[] = [
      { id: 'tch_omondi', teacher_name: 'Mr. David Omondi', email: 'omondi@test.com', phone: '0712345678', status: 'Active' },
    ];
    const students: Student[] = [
      { id: 's_b', admission_number: 'B1', full_name: 'Blue 1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 5', gender: 'M', active: true },
      { id: 's_r', admission_number: 'R1', full_name: 'Red 1', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 5', gender: 'F', active: true },
    ];
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_b', subject_id: 'sub_eng', score: 80 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_r', subject_id: 'sub_eng', score: 70 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 5',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades,
      teachers
    );

    const blueRank = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'blue')!;
    const redRank = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'red')!;

    expect(blueRank.class_teacher_name).toBe('Mr. David Omondi');
    expect(redRank.class_teacher_name).toBeNull();
  });

  it('Feature 3: Resolves class teacher correctly when multiple grades share identical stream names', () => {
    // Grade 2 Blue & Red are unassigned and appear first in classes list
    // Grade 9 Blue & Red have assigned teachers
    const classes: ClassStream[] = [
      { id: 'cls_g2', stream_id: 'strm_g2_b', class_name: 'Grade 2', stream: 'Blue' },
      { id: 'cls_g2', stream_id: 'strm_g2_r', class_name: 'Grade 2', stream: 'Red' },
      { id: 'cls_g9', stream_id: 'strm_g9_b', class_name: 'Grade 9', stream: 'Blue', class_teacher_id: 'tch_maina' },
      { id: 'cls_g9', stream_id: 'strm_g9_r', class_name: 'Grade 9', stream: 'Red', class_teacher_id: 'tch_vivian' },
    ];
    const teachers: Teacher[] = [
      { id: 'tch_maina', teacher_name: 'Mr Maina', email: 'maina@school.ac.ke', phone: '0712345678', status: 'Active' },
      { id: 'tch_vivian', teacher_name: 'Madam Vivian', email: 'vivian@school.ac.ke', phone: '0712345679', status: 'Active' },
    ];
    const students: Student[] = [
      { id: 's_g9_b', admission_number: 'B1', full_name: 'Blue 1', class_id: 'cls_g9', stream_id: 'strm_g9_b', grade: 'Grade 9', gender: 'M', active: true },
      { id: 's_g9_r', admission_number: 'R1', full_name: 'Red 1', class_id: 'cls_g9', stream_id: 'strm_g9_r', grade: 'Grade 9', gender: 'F', active: true },
    ];
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_g9_b', subject_id: 'sub_eng', score: 85 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_g9_r', subject_id: 'sub_eng', score: 75 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 9',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades,
      teachers
    );

    const blueRank = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'blue')!;
    const redRank = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'red')!;

    expect(blueRank.class_teacher_name).toBe('Mr Maina');
    expect(redRank.class_teacher_name).toBe('Madam Vivian');
  });

  it('Feature 4: Top 3 Learners per stream extracts top 3 with competition ranking', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 8', stream: 'Blue' },
    ];
    // 5 learners with distinct scores: 280, 260, 240, 220, 200
    const students: Student[] = [
      { id: 's1', admission_number: 'ADM1', full_name: 'Learner 1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
      { id: 's2', admission_number: 'ADM2', full_name: 'Learner 2', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'F', active: true },
      { id: 's3', admission_number: 'ADM3', full_name: 'Learner 3', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
      { id: 's4', admission_number: 'ADM4', full_name: 'Learner 4', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'F', active: true },
      { id: 's5', admission_number: 'ADM5', full_name: 'Learner 5', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
    ];
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 90 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_mat', score: 90 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_sci', score: 100 }, // 280

      { id: 'm4', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_eng', score: 90 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_mat', score: 90 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_sci', score: 80 },  // 260

      { id: 'm7', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_eng', score: 80 },
      { id: 'm8', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_mat', score: 80 },
      { id: 'm9', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_sci', score: 80 },  // 240

      { id: 'm10', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_eng', score: 70 },
      { id: 'm11', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_mat', score: 70 },
      { id: 'm12', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_sci', score: 80 }, // 220

      { id: 'm13', exam_id: mockExam.id, student_id: 's5', subject_id: 'sub_eng', score: 60 },
      { id: 'm14', exam_id: mockExam.id, student_id: 's5', subject_id: 'sub_mat', score: 70 },
      { id: 'm15', exam_id: mockExam.id, student_id: 's5', subject_id: 'sub_sci', score: 70 }, // 200
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const blueStream = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'blue')!;
    const topLearners = blueStream.topLearners;

    expect(topLearners).toHaveLength(3);
    expect(topLearners[0].student_id).toBe('s1');
    expect(topLearners[0].position).toBe(1);
    expect(topLearners[0].total_marks).toBe(280);

    expect(topLearners[1].student_id).toBe('s2');
    expect(topLearners[1].position).toBe(2);
    expect(topLearners[1].total_marks).toBe(260);

    expect(topLearners[2].student_id).toBe('s3');
    expect(topLearners[2].position).toBe(3);
    expect(topLearners[2].total_marks).toBe(240);
  });

  it('Feature 4: Top 3 Learners includes all tied learners when rank <= 3', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 8', stream: 'Blue' },
    ];
    // 4 learners tied for 1st place with 300 marks
    const students: Student[] = [
      { id: 's1', admission_number: 'B1', full_name: 'Learner 1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
      { id: 's2', admission_number: 'B2', full_name: 'Learner 2', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'F', active: true },
      { id: 's3', admission_number: 'B3', full_name: 'Learner 3', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
      { id: 's4', admission_number: 'B4', full_name: 'Learner 4', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'F', active: true },
    ];
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 100 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_mat', score: 100 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_sci', score: 100 },

      { id: 'm4', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_eng', score: 100 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_mat', score: 100 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_sci', score: 100 },

      { id: 'm7', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_eng', score: 100 },
      { id: 'm8', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_mat', score: 100 },
      { id: 'm9', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_sci', score: 100 },

      { id: 'm10', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_eng', score: 100 },
      { id: 'm11', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_mat', score: 100 },
      { id: 'm12', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_sci', score: 100 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const blueStream = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'blue')!;
    // All 4 have position 1, so all 4 must be included!
    expect(blueStream.topLearners).toHaveLength(4);
    blueStream.topLearners.forEach((tl) => {
      expect(tl.position).toBe(1);
      expect(tl.total_marks).toBe(300);
    });
  });

  it('Feature 4: Excludes disqualified or unassessed learners from Top 3', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 8', stream: 'Blue' },
    ];
    const students: Student[] = [
      { id: 's1', admission_number: 'B1', full_name: 'Valid Learner', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'M', active: true },
      { id: 's2', admission_number: 'B2', full_name: 'Absent Learner', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 8', gender: 'F', active: true },
    ];
    // Learner 1 has valid mark 80
    // Learner 2 has special_status 'X' (absent)
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 80 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_eng', score: 0, special_status: 'X' },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 8',
      students,
      classes,
      [mockSubjects[0]],
      marks,
      mockGrades
    );

    const blueStream = result.aggregateComparison.stream_rankings.find((r) => r.stream_id === 'blue')!;
    expect(blueStream.topLearners).toHaveLength(1);
    expect(blueStream.topLearners[0].student_id).toBe('s1');
  });

  it('Feature 5: Top 3 Learners Overall in Grade extracts top learners across all streams with stream_name', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 9', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 9', stream: 'Red' },
    ];
    const students: Student[] = [
      { id: 's_b1', admission_number: 'B1', full_name: 'Blue Top', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 9', gender: 'M', active: true },
      { id: 's_b2', admission_number: 'B2', full_name: 'Blue Second', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 9', gender: 'F', active: true },
      { id: 's_r1', admission_number: 'R1', full_name: 'Red Champion', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 9', gender: 'F', active: true },
      { id: 's_r2', admission_number: 'R2', full_name: 'Red Third', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 9', gender: 'M', active: true },
    ];
    // Scores:
    // Red Champion: 290
    // Blue Top: 270
    // Red Third: 250
    // Blue Second: 220
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_eng', score: 100 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_mat', score: 95 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_sci', score: 95 },

      { id: 'm4', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_eng', score: 90 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_mat', score: 90 },
      { id: 'm6', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_sci', score: 90 },

      { id: 'm7', exam_id: mockExam.id, student_id: 's_r2', subject_id: 'sub_eng', score: 80 },
      { id: 'm8', exam_id: mockExam.id, student_id: 's_r2', subject_id: 'sub_mat', score: 85 },
      { id: 'm9', exam_id: mockExam.id, student_id: 's_r2', subject_id: 'sub_sci', score: 85 },

      { id: 'm10', exam_id: mockExam.id, student_id: 's_b2', subject_id: 'sub_eng', score: 70 },
      { id: 'm11', exam_id: mockExam.id, student_id: 's_b2', subject_id: 'sub_mat', score: 75 },
      { id: 'm12', exam_id: mockExam.id, student_id: 's_b2', subject_id: 'sub_sci', score: 75 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 9',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    const topOverall = result.topLearnersOverall;
    expect(topOverall).toHaveLength(3);

    expect(topOverall[0].student_name).toBe('Red Champion');
    expect(topOverall[0].position).toBe(1);
    expect(topOverall[0].stream_name).toBe('Red');
    expect(topOverall[0].total_marks).toBe(290);

    expect(topOverall[1].student_name).toBe('Blue Top');
    expect(topOverall[1].position).toBe(2);
    expect(topOverall[1].stream_name).toBe('Blue');
    expect(topOverall[1].total_marks).toBe(270);

    expect(topOverall[2].student_name).toBe('Red Third');
    expect(topOverall[2].position).toBe(3);
    expect(topOverall[2].stream_name).toBe('Red');
    expect(topOverall[2].total_marks).toBe(250);
  });

  it('Feature 5: Top 3 Learners Overall includes ties spanning beyond index 2 if rank <= 3', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 9', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 9', stream: 'Red' },
    ];
    // 1st: L1 (100)
    // 2nd: L2 (90)
    // 3rd: L3 (80), L4 (80), L5 (80) -> 3 tied at rank 3
    const students: Student[] = [
      { id: 's1', admission_number: 'B1', full_name: 'L1', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 9', gender: 'M', active: true },
      { id: 's2', admission_number: 'B2', full_name: 'L2', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 9', gender: 'F', active: true },
      { id: 's3', admission_number: 'R1', full_name: 'L3', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 9', gender: 'F', active: true },
      { id: 's4', admission_number: 'R2', full_name: 'L4', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 9', gender: 'M', active: true },
      { id: 's5', admission_number: 'R3', full_name: 'L5', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 9', gender: 'F', active: true },
    ];
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 100 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's2', subject_id: 'sub_eng', score: 90 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's3', subject_id: 'sub_eng', score: 80 },
      { id: 'm4', exam_id: mockExam.id, student_id: 's4', subject_id: 'sub_eng', score: 80 },
      { id: 'm5', exam_id: mockExam.id, student_id: 's5', subject_id: 'sub_eng', score: 80 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 9',
      students,
      classes,
      [mockSubjects[0]],
      marks,
      mockGrades
    );

    const topOverall = result.topLearnersOverall;
    // L1 (rank 1), L2 (rank 2), L3 (rank 3), L4 (rank 3), L5 (rank 3) => all 5 have rank <= 3
    expect(topOverall).toHaveLength(5);
    expect(topOverall[0].position).toBe(1);
    expect(topOverall[1].position).toBe(2);
    expect(topOverall[2].position).toBe(3);
    expect(topOverall[3].position).toBe(3);
    expect(topOverall[4].position).toBe(3);
  });

  it('Feature 6: Single-stream class cohort computes rankings and top learners correctly', () => {
    const classes: ClassStream[] = [
      { id: 'cls_single', stream_id: 'strm_only', class_name: 'Grade 4', stream: 'Main' },
    ];
    const students: Student[] = [
      { id: 's1', admission_number: 'M1', full_name: 'Solo Top', class_id: 'cls_single', stream_id: 'strm_only', grade: 'Grade 4', gender: 'M', active: true },
    ];
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_eng', score: 85 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's1', subject_id: 'sub_mat', score: 95 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 4',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    expect(result.isSingleStream).toBe(true);
    expect(result.aggregateComparison.stream_rankings).toHaveLength(1);
    expect(result.aggregateComparison.stream_rankings[0].rank).toBe(1);
    expect(result.aggregateComparison.stream_rankings[0].topLearners).toHaveLength(1);
    expect(result.topLearnersOverall).toHaveLength(1);
    expect(result.topLearnersOverall[0].student_name).toBe('Solo Top');

    // Subject ranking
    const engRow = result.rows.find((r) => r.subject_id === 'sub_eng')!;
    const matRow = result.rows.find((r) => r.subject_id === 'sub_mat')!;
    expect(matRow.grade_overall_rank).toBe(1);
    expect(engRow.grade_overall_rank).toBe(2);
  });

  it('Feature 6: Completely unassessed class handles zero assessed learners gracefully', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 3', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 3', stream: 'Red' },
    ];
    const students: Student[] = [
      { id: 's1', admission_number: 'B1', full_name: 'Learner B', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 3', gender: 'M', active: true },
      { id: 's2', admission_number: 'R1', full_name: 'Learner R', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 3', gender: 'F', active: true },
    ];
    // No marks entered at all
    const marks: Mark[] = [];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 3',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    expect(result.hasAnyAssessed).toBe(false);
    expect(result.topLearnersOverall).toHaveLength(0);

    const rankings = result.aggregateComparison.stream_rankings;
    expect(rankings).toHaveLength(2);
    expect(rankings[0].rank).toBeNull();
    expect(rankings[1].rank).toBeNull();
    expect(rankings[0].topLearners).toHaveLength(0);
    expect(rankings[1].topLearners).toHaveLength(0);

    result.rows.forEach((row) => {
      expect(row.grade_overall_rank).toBeNull();
      Object.values(row.stream_means).forEach((sm) => {
        expect(sm.stream_rank).toBeNull();
      });
    });
  });

  it('Feature 7: Correctly computes Top 3 Learners per Stream and Overall in provisional/in-progress assessments', () => {
    const classes: ClassStream[] = [
      { id: 'cls_b', stream_id: 'strm_b', class_name: 'Grade 6', stream: 'Blue' },
      { id: 'cls_r', stream_id: 'strm_r', class_name: 'Grade 6', stream: 'Red' },
    ];
    // 4 learners with partial/provisional marks (only 1 or 2 subjects out of whole curriculum entered)
    const students: Student[] = [
      { id: 's_b1', admission_number: 'B1', full_name: 'Blue Star', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 6', gender: 'M', active: true },
      { id: 's_b2', admission_number: 'B2', full_name: 'Blue Runner', class_id: 'cls_b', stream_id: 'strm_b', grade: 'Grade 6', gender: 'F', active: true },
      { id: 's_r1', admission_number: 'R1', full_name: 'Red Champion', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 6', gender: 'M', active: true },
      { id: 's_r2', admission_number: 'R2', full_name: 'Red Second', class_id: 'cls_r', stream_id: 'strm_r', grade: 'Grade 6', gender: 'F', active: true },
    ];
    // Provisional marks entered for Mathematics only:
    // Red Champion: 95
    // Blue Star: 90
    // Red Second: 85
    // Blue Runner: 80
    const marks: Mark[] = [
      { id: 'm1', exam_id: mockExam.id, student_id: 's_r1', subject_id: 'sub_mat', score: 95 },
      { id: 'm2', exam_id: mockExam.id, student_id: 's_b1', subject_id: 'sub_mat', score: 90 },
      { id: 'm3', exam_id: mockExam.id, student_id: 's_r2', subject_id: 'sub_mat', score: 85 },
      { id: 'm4', exam_id: mockExam.id, student_id: 's_b2', subject_id: 'sub_mat', score: 80 },
    ];

    const result = generateClassPerformanceComparison(
      mockExam,
      'Grade 6',
      students,
      classes,
      mockSubjects,
      marks,
      mockGrades
    );

    expect(result.topLearnersOverall).toHaveLength(3);
    expect(result.topLearnersOverall[0].student_name).toBe('Red Champion');
    expect(result.topLearnersOverall[0].position).toBe(1);
    expect(result.topLearnersOverall[0].total_marks).toBe(95);

    expect(result.topLearnersOverall[1].student_name).toBe('Blue Star');
    expect(result.topLearnersOverall[1].position).toBe(2);
    expect(result.topLearnersOverall[1].total_marks).toBe(90);

    expect(result.topLearnersOverall[2].student_name).toBe('Red Second');
    expect(result.topLearnersOverall[2].position).toBe(3);
    expect(result.topLearnersOverall[2].total_marks).toBe(85);

    const blueRankings = result.aggregateComparison.stream_rankings.find((r) => r.stream_name === 'Blue')!;
    expect(blueRankings.topLearners).toHaveLength(2);
    expect(blueRankings.topLearners[0].student_name).toBe('Blue Star');
    expect(blueRankings.topLearners[0].position).toBe(1);
  });
});
