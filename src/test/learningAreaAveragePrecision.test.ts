import './setupLocalStorage';
import { describe, it, expect } from 'vitest';
import { formatAverageMark, formatTwoDecimalAverage } from '../utils/markUtils';
import { getGradeForMark, CBE_8_POINT_GRADES } from '../services/analysisEngine';

describe('Learning Area vs Learner Average Marks Precision', () => {
  it('formats learning-area averages to exactly two decimal places', () => {
    // 85.666... -> 85.67
    expect(formatTwoDecimalAverage(85.66666666666667)).toBe('85.67');
    expect(formatTwoDecimalAverage('85.66666666666667')).toBe('85.67');

    // 75 -> 75.00
    expect(formatTwoDecimalAverage(75)).toBe('75.00');
    expect(formatTwoDecimalAverage('75')).toBe('75.00');

    // 59.4 -> 59.40
    expect(formatTwoDecimalAverage(59.4)).toBe('59.40');
    expect(formatTwoDecimalAverage('59.4')).toBe('59.40');

    // 68.125 -> 68.13 (.005 boundary test)
    expect(formatTwoDecimalAverage(68.125)).toBe('68.13');

    // 71.456 -> 71.46
    expect(formatTwoDecimalAverage(71.456)).toBe('71.46');

    // 80 -> 80.00
    expect(formatTwoDecimalAverage(80)).toBe('80.00');

    // 48.333... -> 48.33
    expect(formatTwoDecimalAverage(48.333333333333336)).toBe('48.33');
  });

  it('handles null, undefined, empty, and invalid inputs gracefully', () => {
    expect(formatTwoDecimalAverage(null)).toBe('-');
    expect(formatTwoDecimalAverage(undefined)).toBe('-');
    expect(formatTwoDecimalAverage('')).toBe('-');
    expect(formatTwoDecimalAverage('N/A')).toBe('-');
    expect(formatTwoDecimalAverage(NaN)).toBe('-');
    expect(formatTwoDecimalAverage(null, '0.00')).toBe('0.00');
  });

  it('preserves learner-row average marks at exactly one decimal place', () => {
    // 68.777... -> 68.8
    expect(formatAverageMark(68.77777777777777)).toBe('68.8');
    // 78 -> 78.0
    expect(formatAverageMark(78)).toBe('78.0');
    // 91.24 -> 91.2
    expect(formatAverageMark(91.24)).toBe('91.2');
    // 100 -> 100.0
    expect(formatAverageMark(100)).toBe('100.0');
    // null -> '-'
    expect(formatAverageMark(null)).toBe('-');
    expect(formatAverageMark(undefined)).toBe('-');
  });

  it('verifies that unrounded learning-area mean maintains deterministic CBE grade code mapping', () => {
    // 85.666... vs 86
    const gradeFromFloat = getGradeForMark(85.66666666666667, CBE_8_POINT_GRADES);
    const gradeFromInteger = getGradeForMark(86, CBE_8_POINT_GRADES);
    expect(gradeFromFloat.grade_code).toBe(gradeFromInteger.grade_code);
    expect(gradeFromFloat.points).toBe(gradeFromInteger.points);
    expect(gradeFromFloat.performance_level).toBe(gradeFromInteger.performance_level);

    // 59.4 vs 59
    const grade59_4 = getGradeForMark(59.4, CBE_8_POINT_GRADES);
    const grade59 = getGradeForMark(59, CBE_8_POINT_GRADES);
    expect(grade59_4.grade_code).toBe(grade59.grade_code);
    expect(grade59_4.points).toBe(grade59.points);
  });
});
