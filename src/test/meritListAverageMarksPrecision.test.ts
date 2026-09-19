import { describe, it, expect } from 'vitest';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { formatAverageMark, formatTwoDecimalAverage } from '../utils/markUtils';
import { Student, Mark, Subject, ClassStream } from '../types';

describe('Merit List Average Marks Calculation and Presentation Precision Tests', () => {
  // Test 1: Probe values with formatAverageMark
  it('formats all required probe values to exactly one decimal place', () => {
    // 619 ÷ 9 = 68.77777777777777 -> 68.8
    expect(formatAverageMark(619 / 9)).toBe('68.8');
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
    expect(formatAverageMark('')).toBe('-');

    // Provisional formatted value
    expect(`${formatAverageMark(619 / 9)} (P)`).toBe('68.8 (P)');
  });

  // Test 2: Calculate exam results with exact 9 assessed subjects: 88, 67, 67, 60, 65, 78, 76, 78, 40 -> 619
  it('retains fractional average (68.777...) for 619/9 and preserves total marks 619, points, CBE level, and rank', () => {
    const student1: Student = {
      id: 'std_01',
      admission_number: 'ADM-001',
      full_name: 'John Doe',
      gender: 'M',
      class_id: 'cls_8_blue',
      stream_id: 'cls_8_blue',
      active: true,
      grade: 'Grade 8',
      education_level: 'Junior School',
    };

    const student2: Student = {
      id: 'std_02',
      admission_number: 'ADM-002',
      full_name: 'Jane Smith',
      gender: 'F',
      class_id: 'cls_8_blue',
      stream_id: 'cls_8_blue',
      active: true,
      grade: 'Grade 8',
      education_level: 'Junior School',
    };

    const subjects: Subject[] = [
      { id: 'sb_1', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
      { id: 'sb_2', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core' },
      { id: 'sb_3', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core' },
      { id: 'sb_4', subject_name: 'Integrated Science', subject_code: 'INT SCI', category: 'Core' },
      { id: 'sb_5', subject_name: 'Creative Arts & Sports', subject_code: 'CAS', category: 'Core' },
      { id: 'sb_6', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core' },
      { id: 'sb_7', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core' },
      { id: 'sb_8', subject_name: 'Agriculture', subject_code: 'AGRI', category: 'Core' },
      { id: 'sb_9', subject_name: 'Pre-Technical Studies', subject_code: 'PRE-TECH', category: 'Core' },
    ];

    // Marks for student 1: 88, 67, 67, 60, 65, 78, 76, 78, 40 = 619
    const marks1: Mark[] = [
      { id: 'm1', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_1', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_2', marks: 67, raw_score: 67, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_3', marks: 67, raw_score: 67, out_of: 100, special_status: 'Normal' },
      { id: 'm4', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_4', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_5', marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
      { id: 'm6', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_6', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
      { id: 'm7', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_7', marks: 76, raw_score: 76, out_of: 100, special_status: 'Normal' },
      { id: 'm8', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_8', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
      { id: 'm9', student_id: 'std_01', exam_id: 'ex1', subject_id: 'sb_9', marks: 40, raw_score: 40, out_of: 100, special_status: 'Normal' },
    ];

    // Marks for student 2: 70 on all 9 subjects = 630
    const marks2: Mark[] = subjects.map((sb, i) => ({
      id: `m2_${i}`,
      student_id: 'std_02',
      exam_id: 'ex1',
      subject_id: sb.id,
      marks: 70,
      raw_score: 70,
      out_of: 100,
      special_status: 'Normal',
    }));

    const classes: ClassStream[] = [
      { id: 'cls_8_blue', class_name: 'Grade 8', stream: 'Blue' },
    ];

    const results = calculateExamResults('ex1', [student1, student2], [...marks1, ...marks2], CBE_8_POINT_GRADES, classes, subjects);

    const res1 = results.find((r) => r.student_id === 'std_01');
    expect(res1).toBeDefined();
    expect(res1?.total_marks).toBe(619);
    expect(res1?.subject_count).toBe(9);
    // Exact fractional average: 619 / 9 = 68.77777777777777
    expect(res1?.average).toBeCloseTo(68.77777777777777, 5);
    // Display formatting gives 68.8
    expect(formatAverageMark(res1?.average)).toBe('68.8');
    // Total points: EE2 (7) + ME1 (6) + ME1 (6) + ME1 (6) + ME1 (6) + EE2 (7) + EE2 (7) + EE2 (7) + AE1 (4) = 56
    expect(res1?.total_points).toBe(56);
    expect(res1?.average_points).toBeCloseTo(56 / 9, 2);
    // Grade and level
    expect(res1?.grade_code).toBe('ME1');
    expect(res1?.performance_level).toBe('ME');
    // Ranking: student 2 has 630, student 1 has 619
    expect(res1?.position).toBe(2);
  });

  // Test 3: Provisional and Unassessed learners
  it('handles unassessed and provisional learners properly with one decimal place', () => {
    const studentUnassessed: Student = {
      id: 'std_un',
      admission_number: 'ADM-003',
      full_name: 'Unassessed Learner',
      gender: 'M',
      class_id: 'cls_8_blue',
      stream_id: 'cls_8_blue',
      active: true,
      grade: 'Grade 8',
      education_level: 'Junior School',
    };

    const studentProvisional: Student = {
      id: 'std_prov',
      admission_number: 'ADM-004',
      full_name: 'Provisional Learner',
      gender: 'F',
      class_id: 'cls_8_blue',
      stream_id: 'cls_8_blue',
      active: true,
      grade: 'Grade 8',
      education_level: 'Junior School',
    };

    const subjects: Subject[] = [
      { id: 'sb_1', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
      { id: 'sb_2', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core' },
      { id: 'sb_3', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core' },
    ];

    // Marks for provisional learner: 2 out of 3 subjects entered (77 and 60 -> total 137 / 2 = 68.5)
    const provMarks: Mark[] = [
      { id: 'mp1', student_id: 'std_prov', exam_id: 'ex1', subject_id: 'sb_1', marks: 77, raw_score: 77, out_of: 100, special_status: 'Normal' },
      { id: 'mp2', student_id: 'std_prov', exam_id: 'ex1', subject_id: 'sb_2', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
      { id: 'mp3', student_id: 'std_prov', exam_id: 'ex1', subject_id: 'sb_3', marks: 0, raw_score: null, out_of: 100, special_status: 'X' },
    ];

    const classes: ClassStream[] = [
      { id: 'cls_8_blue', class_name: 'Grade 8', stream: 'Blue' },
    ];

    const results = calculateExamResults('ex1', [studentUnassessed, studentProvisional], provMarks, CBE_8_POINT_GRADES, classes, subjects);

    const resUn = results.find((r) => r.student_id === 'std_un');
    expect(resUn).toBeDefined();
    expect(resUn?.is_complete).toBe(false);
    expect(resUn?.subject_count).toBe(0);
    expect(formatAverageMark(resUn?.subject_count === 0 ? null : resUn?.average)).toBe('-');

    const resProv = results.find((r) => r.student_id === 'std_prov');
    expect(resProv).toBeDefined();
    expect(resProv?.is_complete).toBe(false);
    expect(resProv?.subject_count).toBe(2);
    expect(resProv?.total_marks).toBe(137);
    expect(resProv?.average).toBe(68.5);
    expect(`${formatAverageMark(resProv?.average)} (P)`).toBe('68.5 (P)');
  });

  // Tests 4-8: Class Average Marks PDF 2-Decimal Precision Probes
  describe('CLASS AVERAGE MARKS PDF Banner 2-Decimal Precision Probes', () => {
    it('formats whole number Class Average Marks (567) to exactly two decimal places (567.00)', () => {
      const avg = 567;
      expect(formatTwoDecimalAverage(avg)).toBe('567.00');
    });

    it('formats single decimal Class Average Marks (567.7) to exactly two decimal places (567.70) without whole-number rounding', () => {
      const avg = 567.7;
      expect(formatTwoDecimalAverage(avg)).toBe('567.70');
      // Verify difference against old Math.round whole-number behaviour (568)
      expect(String(Math.round(avg))).toBe('568');
      expect(formatTwoDecimalAverage(avg)).not.toBe(String(Math.round(avg)));
    });

    it('preserves two decimal Class Average Marks (567.89)', () => {
      const avg = 567.89;
      expect(formatTwoDecimalAverage(avg)).toBe('567.89');
    });

    it('formats recurring/multi-decimal Class Average Marks (670.894736...) to exactly two decimal places (670.89)', () => {
      const avg = 670.8947368421053;
      expect(formatTwoDecimalAverage(avg)).toBe('670.89');
    });

    it('correctly rounds at two-decimal boundary (516.864 -> 516.86, 516.865 -> 516.87, 516.866 -> 516.87)', () => {
      expect(formatTwoDecimalAverage(516.864)).toBe('516.86');
      expect(formatTwoDecimalAverage(516.865)).toBe('516.87');
      expect(formatTwoDecimalAverage(516.866)).toBe('516.87');
    });

    it('verifies that formatting does not alter the underlying numeric value', () => {
      const rawAvg = 567.7;
      const formatted = formatTwoDecimalAverage(rawAvg);
      expect(formatted).toBe('567.70');
      expect(rawAvg).toBe(567.7);
      expect(typeof rawAvg).toBe('number');
      expect(typeof formatted).toBe('string');
    });

    it('generates the exact CLASS AVERAGE MARKS banner text with 2-decimal precision and out-of total marks', () => {
      const avgTotalObtainedVal = 567.7;
      const classAvgMarksValStr = formatTwoDecimalAverage(avgTotalObtainedVal);
      const avgTotalMaxVal = 900;
      const outOfText = avgTotalMaxVal > 0 ? ` (OUT OF ${avgTotalMaxVal})` : '';
      const bannerText = `CLASS AVERAGE MARKS: ${classAvgMarksValStr}${outOfText}`;
      expect(bannerText).toBe('CLASS AVERAGE MARKS: 567.70 (OUT OF 900)');
      expect(bannerText).not.toBe('CLASS AVERAGE MARKS: 568 (OUT OF 900)');
    });
  });
});
