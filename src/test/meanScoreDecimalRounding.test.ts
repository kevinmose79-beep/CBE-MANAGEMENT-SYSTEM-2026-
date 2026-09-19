import { describe, it, expect } from 'vitest';
import { formatTwoDecimalAverage } from '../utils/markUtils';

describe('Mean Decimals Display Precision (0.01)', () => {
  it('correctly rounds raw recurring decimals to 2 decimal places (0.01 precision)', () => {
    // 661 / 9 = 73.44444444444444
    expect(formatTwoDecimalAverage(661 / 9)).toBe('73.44');

    // 619 / 9 = 68.77777777777777
    expect(formatTwoDecimalAverage(619 / 9)).toBe('68.78');

    // 640 / 9 = 71.11111111111111
    expect(formatTwoDecimalAverage(640 / 9)).toBe('71.11');

    // Single decimal cases
    expect(formatTwoDecimalAverage(85.5)).toBe('85.50');
    expect(formatTwoDecimalAverage(70)).toBe('70.00');

    // Zero / null / undefined / empty cases
    expect(formatTwoDecimalAverage(0)).toBe('0.00');
    expect(formatTwoDecimalAverage(null)).toBe('-');
    expect(formatTwoDecimalAverage(undefined)).toBe('-');
    expect(formatTwoDecimalAverage('')).toBe('-');
  });

  it('formats correctly with % suffix for screen display', () => {
    const rawVal = 73.44444444444444;
    const formatted = `${formatTwoDecimalAverage(rawVal)}%`;
    expect(formatted).toBe('73.44%');

    const rawVal2 = 68.77777777777777;
    const formatted2 = `${formatTwoDecimalAverage(rawVal2)}%`;
    expect(formatted2).toBe('68.78%');
  });
});
