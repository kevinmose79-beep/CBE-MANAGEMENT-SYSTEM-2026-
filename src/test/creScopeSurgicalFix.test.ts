import { describe, it, expect } from 'vitest';
import { initialSubjects, initialClasses } from '../data/seedData';
import {
  getApplicableSubjectsForGrade,
  LEVEL_TO_GRADES,
  Subject,
} from '../types';
import { sanitizeSubject } from '../lib/storage';

describe('CRE Scope Surgical Fix Verification', () => {
  it('1. Verifies that sb_cre has exact applicable_grades: Grade 4, 5, 6, 7, 8, 9 only', () => {
    const cre = initialSubjects.find((s) => s.id === 'sb_cre');
    expect(cre).toBeDefined();
    expect(cre?.subject_code).toBe('CRE');
    expect(cre?.education_level).toBe('Grade 4–9');
    expect(cre?.applicable_grades).toEqual([
      'Grade 4',
      'Grade 5',
      'Grade 6',
      'Grade 7',
      'Grade 8',
      'Grade 9',
    ]);
  });

  it('2. Verifies CRE does NOT apply to PP1, PP2, Grade 1, Grade 2, Grade 3', () => {
    const cre = initialSubjects.find((s) => s.id === 'sb_cre');
    const invalidGrades = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3'];
    for (const g of invalidGrades) {
      expect(cre?.applicable_grades).not.toContain(g);
    }
  });

  it('3. Lower Primary (Grade 1, Grade 2, Grade 3) resolves strictly to ENG, KIS, ILA (CRE absent)', () => {
    for (const grade of ['Grade 1', 'Grade 2', 'Grade 3']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);
      expect(codes).toEqual(['ENG', 'KIS', 'ILA']);
      expect(codes).not.toContain('CRE');
    }
  });

  it('4. Pre-Primary (PP1, PP2) does NOT receive standalone CRE (sb_cre)', () => {
    for (const grade of ['PP1', 'PP2']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);
      expect(codes).not.toContain('CRE');
      // Pre-primary has PP-CRE (Christian Religious Education Activities), not sb_cre
      const sbCre = subs.find((s) => s.id === 'sb_cre');
      expect(sbCre).toBeUndefined();
    }
  });

  it('5. Upper Primary (Grade 4, 5, 6) preserves existing structure including CRE component', () => {
    for (const grade of ['Grade 4', 'Grade 5', 'Grade 6']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);
      // Upper primary official reporting subjects
      expect(codes).toContain('SS&CRE');
      // Cross-phase component for SST and CRE
      expect(codes).toContain('CRE');
      expect(codes).toContain('SST');
    }
  });

  it('6. Junior School (Grade 7, 8, 9) preserves all 9 subjects with CRE', () => {
    for (const grade of ['Grade 7', 'Grade 8', 'Grade 9']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      expect(subs.length).toBe(9);
      const codes = subs.map((s) => s.subject_code);
      expect(codes).toEqual(['ENG', 'KIS', 'MATH', 'INT-SCI', 'CAS', 'SST', 'CRE', 'AGN', 'PRE-TECH']);
      expect(codes).toContain('CRE');
    }
  });

  it('7. sanitizeSubject idempotently repairs legacy or stale CRE objects to Grade 4–9', () => {
    const staleCre = sanitizeSubject({
      id: 'sb_cre',
      subject_code: 'CRE',
      subject_name: 'Christian Religious Education',
      education_level: 'PP1–Grade 9' as any,
      applicable_grades: ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
    } as Subject);

    expect(staleCre.education_level).toBe('Grade 4–9');
    expect(staleCre.applicable_grades).toEqual([
      'Grade 4',
      'Grade 5',
      'Grade 6',
      'Grade 7',
      'Grade 8',
      'Grade 9',
    ]);
    expect(staleCre.applicable_grades).not.toContain('Grade 1');
    expect(staleCre.applicable_grades).not.toContain('Grade 2');
    expect(staleCre.applicable_grades).not.toContain('Grade 3');
    expect(staleCre.applicable_grades).not.toContain('PP1');
    expect(staleCre.applicable_grades).not.toContain('PP2');
  });

  it('8. Verifies Lower Primary level card filtering logic yields exactly 3 areas', () => {
    const cardLevelGrades = LEVEL_TO_GRADES['Lower Primary'] || [];
    const sanitizedSubjects = initialSubjects.map(sanitizeSubject);

    const levelSubjects = sanitizedSubjects.filter((s) => {
      if (s.status === 'Archived') return false;
      const code = (s.subject_code || '').toUpperCase().trim();
      if (!['ENG', 'KIS', 'ILA'].includes(code)) return false;
      if (s.applicable_grades && s.applicable_grades.length > 0) {
        return s.applicable_grades.some((g) => cardLevelGrades.includes(g));
      }
      return s.education_level === 'Lower Primary';
    });

    expect(levelSubjects.length).toBe(3);
    const codes = levelSubjects.map((s) => s.subject_code);
    expect(codes).toEqual(['ENG', 'KIS', 'ILA']);
    expect(codes).not.toContain('CRE');
  });
});
