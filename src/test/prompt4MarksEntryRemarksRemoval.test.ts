import { describe, it, expect } from 'vitest';
import { getGradeForMark } from '../services/analysisEngine';
import { initialGrades } from '../data/seedData';

describe('Prompt 4: Surgical Removal of Assessment Remarks from Marks Entry', () => {
  it('Score, %, Level and Points calculate accurately using CBE Grade scale', () => {
    // Test 1: 40/100 -> 40% -> AE1 -> 4 points
    const grade40 = getGradeForMark(40, initialGrades);
    expect(grade40).toBeDefined();
    expect(grade40?.performance_level).toBe('AE');
    expect(grade40?.grade_code).toBe('AE1');
    expect(grade40?.points).toBe(4);
    // Underlying remark calculation remains intact for other workflows
    expect(grade40?.remarks).toBe('Developing Competency');

    // Test 2: 95/100 -> 95% -> EE1 -> 8 points
    const grade95 = getGradeForMark(95, initialGrades);
    expect(grade95?.performance_level).toBe('EE');
    expect(grade95?.grade_code).toBe('EE1');
    expect(grade95?.points).toBe(8);

    // Test 3: 85/100 -> 85% -> EE2 -> 7 points
    const grade85 = getGradeForMark(85, initialGrades);
    expect(grade85?.performance_level).toBe('EE');
    expect(grade85?.grade_code).toBe('EE2');
    expect(grade85?.points).toBe(7);

    // Test 4: 65/100 -> 65% -> ME1 -> 6 points
    const grade65 = getGradeForMark(65, initialGrades);
    expect(grade65?.performance_level).toBe('ME');
    expect(grade65?.grade_code).toBe('ME1');
    expect(grade65?.points).toBe(6);
  });
});
