import { describe, it, expect } from 'vitest';
import {
  initialSubjects,
  initialClasses,
} from '../data/seedData';
import {
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  getShortCbeCode,
  getMeritListDisplayCode,
  sortSubjectsByStandardOrder,
  ClassStream,
  Subject,
} from '../types';
import { getLearnerReportSubjects } from '../services/analysisEngine';
import { sanitizeSubject } from '../lib/storage';

describe('Lower Primary Restructuring Verification', () => {
  it('1. Lower Primary (Grade 1 - 3) returns exactly 3 learning areas: ENG, KIS, ILA', () => {
    for (const grade of ['Grade 1', 'Grade 2', 'Grade 3']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);
      const names = subs.map((s) => s.subject_name);

      expect(subs.length).toBe(3);
      expect(codes).toEqual(['ENG', 'KIS', 'ILA']);
      expect(names).toEqual(['English', 'Kiswahili', 'Integrated Learning Area']);
    }
  });

  it('2. ENG and KIS are consistent subject codes across Grades 1–9', () => {
    const g1 = getApplicableSubjectsForGrade('Grade 1', initialSubjects);
    const g5 = getApplicableSubjectsForGrade('Grade 5', initialSubjects);
    const g8 = getApplicableSubjectsForGrade('Grade 8', initialSubjects);

    const g1Codes = g1.map(s => s.subject_code);
    const g5Codes = g5.map(s => s.subject_code);
    const g8Codes = g8.map(s => s.subject_code);

    expect(g1Codes).toContain('ENG');
    expect(g1Codes).toContain('KIS');
    expect(g5Codes).toContain('ENG');
    expect(g5Codes).toContain('KIS');
    expect(g8Codes).toContain('ENG');
    expect(g8Codes).toContain('KIS');
  });

  it('3. Integrated Learning Area (ILA) exists ONLY in Lower Primary', () => {
    const g1 = getApplicableSubjectsForGrade('Grade 1', initialSubjects);
    const g5 = getApplicableSubjectsForGrade('Grade 5', initialSubjects);
    const g8 = getApplicableSubjectsForGrade('Grade 8', initialSubjects);
    const pp1 = getApplicableSubjectsForGrade('PP1', initialSubjects);

    expect(g1.map(s => s.subject_code)).toContain('ILA');
    expect(g5.map(s => s.subject_code)).not.toContain('ILA');
    expect(g8.map(s => s.subject_code)).not.toContain('ILA');
    expect(pp1.map(s => s.subject_code)).not.toContain('ILA');
  });

  it('4. Upper Primary (Grades 4-6) learning areas preserve the 8 core subjects alongside SST/CRE components', () => {
    for (const grade of ['Grade 4', 'Grade 5', 'Grade 6']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);

      const coreSubjects = codes.filter((c) => c !== 'SST' && c !== 'CRE');
      expect(coreSubjects.length).toBe(8);
      expect(coreSubjects).toEqual(['ENG', 'COMP', 'KIS', 'INSHA', 'MATH', 'INT-SCI', 'CAS', 'SS&CRE']);
      expect(codes).toContain('SST');
      expect(codes).toContain('CRE');
    }
  });

  it('5. Junior School (Grades 7-9) learning areas remain strictly 9 subjects', () => {
    for (const grade of ['Grade 7', 'Grade 8', 'Grade 9']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);

      expect(subs.length).toBe(9);
      expect(codes).toEqual(['ENG', 'KIS', 'MATH', 'INT-SCI', 'CAS', 'SST', 'CRE', 'AGN', 'PRE-TECH']);
    }
  });

  it('6. Legacy Lower Primary activity codes sanitize gracefully to ENG, KIS, or ILA', () => {
    const legacyLit = sanitizeSubject({ id: 's1', subject_code: 'LP-LIT', subject_name: 'Literacy Activities' } as Subject);
    expect(legacyLit.subject_code).toBe('ENG');

    const legacyKsl = sanitizeSubject({ id: 's2', subject_code: 'LP-KSL', subject_name: 'Kiswahili Activities' } as Subject);
    expect(legacyKsl.subject_code).toBe('KIS');

    const legacyMath = sanitizeSubject({ id: 's3', subject_code: 'LP-MATH', subject_name: 'Mathematical Activities' } as Subject);
    expect(legacyMath.subject_code).toBe('ILA');

    const legacyEnv = sanitizeSubject({ id: 's4', subject_code: 'LP-ENV', subject_name: 'Environmental Activities' } as Subject);
    expect(legacyEnv.subject_code).toBe('ILA');

    const legacyHn = sanitizeSubject({ id: 's5', subject_code: 'LP-HN', subject_name: 'Hygiene and Nutrition Activities' } as Subject);
    expect(legacyHn.subject_code).toBe('ILA');

    const legacyMca = sanitizeSubject({ id: 's6', subject_code: 'LP-MCA', subject_name: 'Movement and Creative Activities' } as Subject);
    expect(legacyMca.subject_code).toBe('ILA');

    const legacyCre = sanitizeSubject({ id: 's7', subject_code: 'LP-CRE', subject_name: 'Christian Religious Education Activities' } as Subject);
    expect(legacyCre.subject_code).toBe('ILA');

    const legacyMatLp = sanitizeSubject({ id: 's8', subject_code: 'MAT LP', subject_name: 'Mathematical Activities' } as Subject);
    expect(legacyMatLp.subject_code).toBe('ILA');

    const legacyEngLp = sanitizeSubject({ id: 's9', subject_code: 'ENG LP', subject_name: 'English' } as Subject);
    expect(legacyEngLp.subject_code).toBe('ENG');

    const legacyKisLp = sanitizeSubject({ id: 's10', subject_code: 'KIS LP', subject_name: 'Kiswahili' } as Subject);
    expect(legacyKisLp.subject_code).toBe('KIS');
  });

  it('7. Initial class allocations for Lower Primary classes contain sb_lp_eng, sb_lp_kis, sb_lp_ila', () => {
    const g1Class = initialClasses.find(c => c.class_name === 'Grade 1');
    expect(g1Class).toBeDefined();

    const allocated = getAllocatedSubjectsForClass(g1Class, initialSubjects);
    const codes = allocated.map(s => s.subject_code);

    expect(allocated.length).toBe(3);
    expect(codes).toEqual(['ENG', 'KIS', 'ILA']);
  });

  it('8. getShortCbeCode and getMeritListDisplayCode resolve Lower Primary subjects to ENG, KIS, ILA', () => {
    expect(getShortCbeCode('ENG', 'English', 'Lower Primary')).toBe('ENG');
    expect(getShortCbeCode('LP-ENG', 'English', 'Lower Primary')).toBe('ENG');
    expect(getShortCbeCode('LP-LIT', 'Literacy Activities', 'Lower Primary')).toBe('ENG');

    expect(getShortCbeCode('KIS', 'Kiswahili', 'Lower Primary')).toBe('KIS');
    expect(getShortCbeCode('LP-KSL', 'Kiswahili Activities', 'Lower Primary')).toBe('KIS');

    expect(getShortCbeCode('ILA', 'Integrated Learning Area', 'Lower Primary')).toBe('ILA');
    expect(getShortCbeCode('LP-ILA', 'Integrated Learning Area', 'Lower Primary')).toBe('ILA');
    expect(getShortCbeCode('LP-MATH', 'Mathematical Activities', 'Lower Primary')).toBe('ILA');
    expect(getShortCbeCode('LP-ENV', 'Environmental Activities', 'Lower Primary')).toBe('ILA');

    expect(getMeritListDisplayCode('ENG', 'English', 'Lower Primary')).toBe('ENG');
    expect(getMeritListDisplayCode('LP-ENG', 'English', 'Lower Primary')).toBe('ENG');
    expect(getMeritListDisplayCode('KIS', 'Kiswahili', 'Lower Primary')).toBe('KIS');
    expect(getMeritListDisplayCode('LP-KSL', 'Kiswahili', 'Lower Primary')).toBe('KIS');
    expect(getMeritListDisplayCode('ILA', 'Integrated Learning Area', 'Lower Primary')).toBe('ILA');
    expect(getMeritListDisplayCode('LP-ILA', 'Integrated Learning Area', 'Lower Primary')).toBe('ILA');
    expect(getMeritListDisplayCode('LP-MATH', 'Mathematical Activities', 'Lower Primary')).toBe('ILA');
  });

  it('9. Lower Primary uses the 4-point scale: EE=4, ME=3, AE=2, BE=1', async () => {
    const { getGradeForMark } = await import('../services/analysisEngine');
    const { initialGrades } = await import('../data/seedData');

    const eeGrade = getGradeForMark(85, initialGrades, 'Lower Primary', 'Grade 2');
    expect(eeGrade.performance_level).toBe('EE');
    expect(eeGrade.points).toBe(4);

    const meGrade = getGradeForMark(65, initialGrades, 'Lower Primary', 'Grade 2');
    expect(meGrade.performance_level).toBe('ME');
    expect(meGrade.points).toBe(3);

    const aeGrade = getGradeForMark(35, initialGrades, 'Lower Primary', 'Grade 2');
    expect(aeGrade.performance_level).toBe('AE');
    expect(aeGrade.points).toBe(2);

    const beGrade = getGradeForMark(15, initialGrades, 'Lower Primary', 'Grade 2');
    expect(beGrade.performance_level).toBe('BE');
    expect(beGrade.points).toBe(1);
  });

  it('10. Upper Primary and Junior School grading rules remain strictly untouched', async () => {
    const { getGradeForMark } = await import('../services/analysisEngine');
    const { initialGrades } = await import('../data/seedData');

    const upEe = getGradeForMark(95, initialGrades, 'Upper Primary', 'Grade 5');
    expect(upEe.grade_code).toBe('EE');
    expect(upEe.points).toBe(4);

    const jsEe1 = getGradeForMark(95, initialGrades, 'Junior School', 'Grade 7');
    expect(jsEe1.grade_code).toBe('EE1');
    expect(jsEe1.points).toBe(8);
  });
});
