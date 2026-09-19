import { describe, it, expect } from 'vitest';
import {
  getShortCbeCode,
  getMeritListDisplayCode,
  sortSubjectsByStandardOrder,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  Subject,
  ClassStream,
} from '../types';
import { getLearnerReportSubjects } from '../services/analysisEngine';
import { initialSubjects, initialClasses } from '../data/seedData';

describe('Upper Primary Subject Completeness & Junior School Preservation', () => {
  it('correctly maps short CBE code for Upper Primary COMP and INSHA without collapsing to ENG or KIS', () => {
    expect(getShortCbeCode('COMP', 'English Composition')).toBe('COMP');
    expect(getShortCbeCode('INSHA', 'Kiswahili Insha')).toBe('INSHA');
    expect(getShortCbeCode('ENG', 'English')).toBe('ENG');
    expect(getShortCbeCode('KIS', 'Kiswahili')).toBe('KIS');

    expect(getMeritListDisplayCode('COMP', 'English Composition', 'Upper Primary')).toBe('COMP');
    expect(getMeritListDisplayCode('INSHA', 'Kiswahili Insha', 'Upper Primary')).toBe('INSHA');
    expect(getMeritListDisplayCode('ENG', 'English', 'Upper Primary')).toBe('ENG');
    expect(getMeritListDisplayCode('KIS', 'Kiswahili', 'Upper Primary')).toBe('KIS');
  });

  it('preserves all 8 Upper Primary learning areas in getApplicableSubjectsForGrade for Grade 4, 5, 6', () => {
    for (const grade of ['Grade 4', 'Grade 5', 'Grade 6']) {
      const subs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subs.map((s) => s.subject_code);

      expect(subs.length).toBe(8);
      expect(codes).toEqual(['ENG', 'COMP', 'KIS', 'INSHA', 'MATH', 'INT-SCI', 'CAS', 'SS&CRE']);
    }
  });

  it('getAllocatedSubjectsForClass returns all 8 subjects for Grade 6 Blue', () => {
    const g6Class = initialClasses.find((c) => c.id === 'cls_g6_b');
    expect(g6Class).toBeDefined();

    const allocated = getAllocatedSubjectsForClass(g6Class, initialSubjects);
    const codes = allocated.map((s) => s.subject_code);

    expect(allocated.length).toBe(8);
    expect(codes).toEqual(['ENG', 'COMP', 'KIS', 'INSHA', 'MATH', 'INT-SCI', 'CAS', 'SS&CRE']);
  });

  it('getLearnerReportSubjects returns all 8 subjects for an Upper Primary learner', () => {
    const g6Class: ClassStream = {
      id: 'cls_g6_r',
      class_name: 'Grade 6',
      stream: 'Red',
      capacity: 40,
      education_level: 'Upper Primary',
      status: 'Active',
      allocated_subject_ids: [
        'sb_up_eng',
        'sb_up_comp',
        'sb_up_kis',
        'sb_up_insha',
        'sb_up_mat',
        'sb_sci',
        'sb_up_cas',
        'sb_up_ss_cre',
      ],
    };

    const student = {
      id: 'std_01',
      admission_number: 'ADM001',
      first_name: 'Jane',
      last_name: 'Muthoni',
      gender: 'F' as const,
      class_id: 'cls_g6_r',
      active: true,
      grade: 'Grade 6',
    };

    const reportSubjects = getLearnerReportSubjects(student as any, g6Class, initialSubjects);
    const codes = reportSubjects.map((s) => s.subject_code);

    expect(reportSubjects.length).toBe(8);
    expect(codes).toEqual(['ENG', 'COMP', 'KIS', 'INSHA', 'MATH', 'INT-SCI', 'CAS', 'SS&CRE']);
  });

  it('preserves Junior School subjects and ordering completely untouched', () => {
    for (const grade of ['Grade 7', 'Grade 8', 'Grade 9']) {
      const jsSubs = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = jsSubs.map((s) => s.subject_code);

      // Junior School must not have COMP or INSHA
      expect(codes).not.toContain('COMP');
      expect(codes).not.toContain('INSHA');

      // Junior School must contain its standard 9 subjects in correct relative sequence
      expect(codes).toEqual(['ENG', 'KIS', 'MATH', 'INT-SCI', 'CAS', 'SST', 'CRE', 'AGN', 'PRE-TECH']);
    }

    const jsClass = initialClasses.find((c) => c.id === 'cls_7e');
    expect(jsClass).toBeDefined();

    const jsAllocated = getAllocatedSubjectsForClass(jsClass, initialSubjects);
    const jsCodes = jsAllocated.map((s) => s.subject_code);

    expect(jsCodes).not.toContain('COMP');
    expect(jsCodes).not.toContain('INSHA');
    expect(jsCodes).toEqual(['ENG', 'KIS', 'MATH', 'INT-SCI', 'CAS', 'SST', 'CRE', 'AGN', 'PRE-TECH']);
  });
});
