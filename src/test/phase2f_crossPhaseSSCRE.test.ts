import { describe, it, expect } from 'vitest';
import { initialSubjects } from '../data/seedData';
import {
  getApplicableSubjectsForGrade,
  deduplicateSubjectsForGradeLevel,
  sortSubjectsByStandardOrder,
  Subject,
  Mark,
  Examination,
} from '../types';
import {
  getUpperPrimaryCompositeSubjectMarks,
  getSSCREComponentMaxMarks,
  isSocialStudies,
  isChristianReligiousEducation,
  isDirectSSCRE,
} from '../utils/markUtils';

describe('Phase 2F: Cross-Phase SST/CRE + Upper Primary SS&CRE Composite Architecture', () => {
  it('verifies that sb_sst and sb_cre have cross-phase applicability in seedData', () => {
    const sst = initialSubjects.find((s) => s.id === 'sb_sst');
    const cre = initialSubjects.find((s) => s.id === 'sb_cre');

    expect(sst).toBeDefined();
    expect(cre).toBeDefined();

    expect(sst?.education_level).toBe('Grade 4–9');
    expect(sst?.applicable_grades).toContain('Grade 4');
    expect(sst?.applicable_grades).toContain('Grade 7');

    expect(cre?.education_level).toBe('Grade 4–9');
    expect(cre?.applicable_grades).toContain('Grade 4');
    expect(cre?.applicable_grades).toContain('Grade 7');
    expect(cre?.applicable_grades).not.toContain('PP1');
    expect(cre?.applicable_grades).not.toContain('PP2');
    expect(cre?.applicable_grades).not.toContain('Grade 1');
    expect(cre?.applicable_grades).not.toContain('Grade 2');
    expect(cre?.applicable_grades).not.toContain('Grade 3');
  });

  it('resolves Upper Primary subjects, preserving SST and CRE components alongside SS&CRE for component hierarchy', () => {
    for (const grade of ['Grade 4', 'Grade 5', 'Grade 6']) {
      const subjects = getApplicableSubjectsForGrade(grade, initialSubjects);
      const codes = subjects.map((s) => s.subject_code);
      expect(codes).toContain('SST');
      expect(codes).toContain('CRE');
      expect(codes).toContain('SS&CRE');
    }
  });

  it('preserves exactly 9 Junior School subjects without merging SST and CRE', () => {
    for (const grade of ['Grade 7', 'Grade 8', 'Grade 9']) {
      const subjects = getApplicableSubjectsForGrade(grade, initialSubjects);
      expect(subjects.length).toBe(9);
      const codes = subjects.map((s) => s.subject_code);
      expect(codes).toEqual(['ENG', 'KIS', 'MATH', 'INT-SCI', 'CAS', 'SST', 'CRE', 'AGN', 'PRE-TECH']);
    }
  });

  it('correctly calculates component max scores for Structures A, B, and C', () => {
    expect(getSSCREComponentMaxMarks('A')).toEqual({ sstMax: 30, creMax: 20, ssCreMax: 50 });
    expect(getSSCREComponentMaxMarks('B')).toEqual({ sstMax: 10, creMax: 10, ssCreMax: 20 });
    expect(getSSCREComponentMaxMarks('C')).toEqual({ sstMax: 20, creMax: 30, ssCreMax: 50 });
  });

  it('synthesizes SS&CRE composite mark correctly under Structure A (30/20 -> 50)', () => {
    const exam: Examination = {
      id: 'exam_up_1',
      exam_name: 'Mid Term 1 2026',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay_2026',
      education_level: 'Upper Primary',
      status: 'Open',
      exam_type: 'Regular' as any,
      max_marks: 100,
      ss_cre_structure: 'A',
    };

    const studentMarks: Mark[] = [
      {
        id: 'm_sst_1',
        student_id: 'std_1',
        subject_id: 'sb_sst',
        exam_id: 'exam_up_1',
        score: 24, // 24/30
        out_of: 30,
        percentage: 80,
      },
      {
        id: 'm_cre_1',
        student_id: 'std_1',
        subject_id: 'sb_cre',
        exam_id: 'exam_up_1',
        score: 16, // 16/20
        out_of: 20,
        percentage: 80,
      },
    ];

    const applicableSubs = getApplicableSubjectsForGrade('Grade 4', initialSubjects);
    const result = getUpperPrimaryCompositeSubjectMarks(studentMarks, applicableSubs, 'Upper Primary', exam);

    const syntheticMarks = result.processedMarks.filter((m) => m.is_synthetic);
    expect(syntheticMarks.length).toBe(1);

    const ssCreMark = syntheticMarks[0];
    expect(ssCreMark.subject_id).toBe('sb_up_ss_cre');
    expect(ssCreMark.score).toBe(40); // 24 + 16 = 40
    expect(ssCreMark.out_of).toBe(50); // 30 + 20 = 50
    expect(ssCreMark.percentage).toBe(80); // (40/50)*100 = 80%
    expect(ssCreMark.special_status).toBeUndefined();
  });

  it('handles partial attendance: if one component is X and other has score, overall mark is raw score over totalMax, NOT absent', () => {
    const exam: Examination = {
      id: 'exam_up_2',
      exam_name: 'End Term 1 2026',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay_2026',
      education_level: 'Upper Primary',
      status: 'Open',
      exam_type: 'Regular' as any,
      max_marks: 100,
      ss_cre_structure: 'A', // 30 + 20 = 50
    };

    const studentMarks: Mark[] = [
      {
        id: 'm_sst_2',
        student_id: 'std_2',
        subject_id: 'sb_sst',
        exam_id: 'exam_up_2',
        score: 21, // 21/30
        out_of: 30,
        percentage: 70,
      },
      {
        id: 'm_cre_2',
        student_id: 'std_2',
        subject_id: 'sb_cre',
        exam_id: 'exam_up_2',
        score: 0,
        out_of: 20,
        percentage: 0,
        special_status: 'X', // Absent for CRE
      },
    ];

    const applicableSubs = getApplicableSubjectsForGrade('Grade 5', initialSubjects);
    const result = getUpperPrimaryCompositeSubjectMarks(studentMarks, applicableSubs, 'Upper Primary', exam);

    const syntheticMarks = result.processedMarks.filter((m) => m.is_synthetic);
    expect(syntheticMarks.length).toBe(1);
    const ssCreMark = syntheticMarks[0];
    expect(ssCreMark.score).toBe(21); // Raw score from SST
    expect(ssCreMark.out_of).toBe(50); // Evaluated out of combined max
    expect(ssCreMark.percentage).toBe(42); // (21/50)*100 = 42%
    expect(ssCreMark.special_status).toBeUndefined(); // NOT absent because learner sat for SST
  });

  it('marks composite as X if BOTH SST and CRE are absent', () => {
    const exam: Examination = {
      id: 'exam_up_3',
      exam_name: 'End Term 1 2026',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay_2026',
      education_level: 'Upper Primary',
      status: 'Open',
      exam_type: 'Regular' as any,
      max_marks: 100,
      ss_cre_structure: 'B', // 10 + 10 = 20
    };

    const studentMarks: Mark[] = [
      {
        id: 'm_sst_3',
        student_id: 'std_3',
        subject_id: 'sb_sst',
        exam_id: 'exam_up_3',
        score: 0,
        out_of: 10,
        percentage: 0,
        special_status: 'X',
      },
      {
        id: 'm_cre_3',
        student_id: 'std_3',
        subject_id: 'sb_cre',
        exam_id: 'exam_up_3',
        score: 0,
        out_of: 10,
        percentage: 0,
        special_status: 'X',
      },
    ];

    const applicableSubs = getApplicableSubjectsForGrade('Grade 6', initialSubjects);
    const result = getUpperPrimaryCompositeSubjectMarks(studentMarks, applicableSubs, 'Upper Primary', exam);

    const syntheticMarks = result.processedMarks.filter((m) => m.is_synthetic);
    expect(syntheticMarks.length).toBe(1);
    expect(syntheticMarks[0].special_status).toBe('X');
  });

  it('marks composite as Y (irregularity) if either component has Y', () => {
    const exam: Examination = {
      id: 'exam_up_4',
      exam_name: 'End Term 1 2026',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay_2026',
      education_level: 'Upper Primary',
      status: 'Open',
      exam_type: 'Regular' as any,
      max_marks: 100,
      ss_cre_structure: 'C',
    };

    const studentMarks: Mark[] = [
      {
        id: 'm_sst_4',
        student_id: 'std_4',
        subject_id: 'sb_sst',
        exam_id: 'exam_up_4',
        score: 18,
        out_of: 20,
        percentage: 90,
      },
      {
        id: 'm_cre_4',
        student_id: 'std_4',
        subject_id: 'sb_cre',
        exam_id: 'exam_up_4',
        score: 0,
        out_of: 30,
        percentage: 0,
        special_status: 'Y', // Irregularity
      },
    ];

    const applicableSubs = getApplicableSubjectsForGrade('Grade 6', initialSubjects);
    const result = getUpperPrimaryCompositeSubjectMarks(studentMarks, applicableSubs, 'Upper Primary', exam);

    const syntheticMarks = result.processedMarks.filter((m) => m.is_synthetic);
    expect(syntheticMarks.length).toBe(1);
    expect(syntheticMarks[0].special_status).toBe('Y');
  });

  it('CRITICAL CONFLICT RULE: flags conflict as Y when both direct SS&CRE mark and component SST/CRE marks exist', () => {
    const exam: Examination = {
      id: 'exam_up_5',
      exam_name: 'Conflict Test Exam',
      term: 'Term 1',
      year: 2026,
      academic_year_id: 'ay_2026',
      education_level: 'Upper Primary',
      status: 'Open',
      exam_type: 'Regular' as any,
      max_marks: 100,
      ss_cre_structure: 'A',
    };

    const studentMarks: Mark[] = [
      // Direct historical mark
      {
        id: 'm_direct_sscre',
        student_id: 'std_5',
        subject_id: 'sb_up_ss_cre',
        exam_id: 'exam_up_5',
        score: 75,
        out_of: 100,
        percentage: 75,
      },
      // Component marks entered concurrently
      {
        id: 'm_sst_5',
        student_id: 'std_5',
        subject_id: 'sb_sst',
        exam_id: 'exam_up_5',
        score: 25,
        out_of: 30,
        percentage: 83.33,
      },
      {
        id: 'm_cre_5',
        student_id: 'std_5',
        subject_id: 'sb_cre',
        exam_id: 'exam_up_5',
        score: 18,
        out_of: 20,
        percentage: 90,
      },
    ];

    const applicableSubs = getApplicableSubjectsForGrade('Grade 4', initialSubjects);
    const result = getUpperPrimaryCompositeSubjectMarks(studentMarks, applicableSubs, 'Upper Primary', exam);

    const ssCreMarks = result.processedMarks.filter((m) => m.subject_id === 'sb_up_ss_cre');
    expect(ssCreMarks.length).toBe(1);
    // Must be flagged as Y to prevent silent corruption of either dataset
    expect(ssCreMarks[0].special_status).toBe('Y');
  });

  it('HISTORICAL DATA PRESERVATION: direct SS&CRE marks for exams without ss_cre_structure pass through intact', () => {
    const historicalExam: Examination = {
      id: 'exam_historical_1',
      exam_name: 'Past Exam 2025',
      term: 'Term 3',
      year: 2025,
      academic_year_id: 'ay_2025',
      education_level: 'Upper Primary',
      status: 'Approved',
      exam_type: 'Regular' as any,
      max_marks: 100,
      // No ss_cre_structure
    };

    const studentMarks: Mark[] = [
      {
        id: 'm_hist_1',
        student_id: 'std_6',
        subject_id: 'sb_up_ss_cre',
        exam_id: 'exam_historical_1',
        score: 82,
        out_of: 100,
        percentage: 82,
      },
    ];

    const applicableSubs = getApplicableSubjectsForGrade('Grade 4', initialSubjects);
    const result = getUpperPrimaryCompositeSubjectMarks(studentMarks, applicableSubs, 'Upper Primary', historicalExam);

    const ssCreMark = result.processedMarks.find((m) => m.subject_id === 'sb_up_ss_cre');
    expect(ssCreMark).toBeDefined();
    expect(ssCreMark?.score).toBe(82);
    expect(ssCreMark?.out_of).toBe(100);
    expect(ssCreMark?.percentage).toBe(82);
    expect(ssCreMark?.is_synthetic).toBeFalsy();
  });
});
