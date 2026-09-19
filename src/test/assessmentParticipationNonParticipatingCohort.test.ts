import { describe, it, expect } from 'vitest';
import {
  isExamEligibleForTerminal,
  filterEligibleTerminalAssessments,
} from '../services/terminalAssessmentDiscovery';
import {
  calculateExamResults,
  generateExamAnalysisSummary,
} from '../services/analysisEngine';
import { Examination, Student, Mark, ClassStream, Subject, Grade } from '../types';

describe('Assessment Participation & Non-Participating Cohort Surgical Healing', () => {
  const academicYear = '2026';
  const term = 'Term 1';

  // School-wide examination (class_id: 'all', no grade targeting)
  const schoolWideExam: Examination = {
    id: 'exam-end-term-t1',
    exam_name: 'End-Term Examination 2026',
    exam_type: 'End-Term',
    term: 'Term 1',
    year: 2026,
    status: 'Approved',
    max_marks: 100,
    class_id: 'all',
  };

  const grade9Class: ClassStream = {
    id: 'class-g9',
    class_name: 'Grade 9',
    stream: 'East',
    education_level: 'Junior School',
  };

  const grade8Class: ClassStream = {
    id: 'class-g8',
    class_name: 'Grade 8',
    stream: 'East',
    education_level: 'Junior School',
  };

  const grade7Class: ClassStream = {
    id: 'class-g7',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
  };

  const allStudents: Student[] = [
    // Grade 9 students
    { id: 's-g9-1', admission_number: 'ADM-901', full_name: 'G9 Student 1', class_id: 'class-g9', grade: 'Grade 9', gender: 'M', active: true },
    { id: 's-g9-2', admission_number: 'ADM-902', full_name: 'G9 Student 2', class_id: 'class-g9', grade: 'Grade 9', gender: 'F', active: true },
    // Grade 8 students
    { id: 's-g8-1', admission_number: 'ADM-801', full_name: 'G8 Student 1', class_id: 'class-g8', grade: 'Grade 8', gender: 'M', active: true },
    { id: 's-g8-2', admission_number: 'ADM-802', full_name: 'G8 Student 2', class_id: 'class-g8', grade: 'Grade 8', gender: 'F', active: true },
    // Grade 7 students
    { id: 's-g7-1', admission_number: 'ADM-701', full_name: 'G7 Student 1', class_id: 'class-g7', grade: 'Grade 7', gender: 'M', active: true },
    { id: 's-g7-2', admission_number: 'ADM-702', full_name: 'G7 Student 2', class_id: 'class-g7', grade: 'Grade 7', gender: 'F', active: true },
  ];

  const subjects: Subject[] = [
    { id: 'sub-eng', subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School', category: 'Core' },
    { id: 'sub-mat', subject_name: 'Mathematics', subject_code: 'MAT', education_level: 'Junior School', category: 'Core' },
  ];

  // Only Grade 9 has marks for this exam
  const marksOnlyGrade9: Mark[] = [
    { id: 'm1', student_id: 's-g9-1', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 85 },
    { id: 'm2', student_id: 's-g9-1', subject_id: 'sub-mat', exam_id: 'exam-end-term-t1', score: 90 },
    { id: 'm3', student_id: 's-g9-2', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 78 },
    { id: 'm4', student_id: 's-g9-2', subject_id: 'sub-mat', exam_id: 'exam-end-term-t1', score: 82 },
  ];

  const gradingSystem: Grade[] = [
    { id: 'g1', grade_code: 'EE1', minimum_score: 80, maximum_score: 100, points: 8, performance_level: 'EE', remarks: 'Exceptional', descriptor: 'Exceeding Expectations' },
    { id: 'g2', grade_code: 'ME1', minimum_score: 65, maximum_score: 79, points: 6, performance_level: 'ME', remarks: 'Good', descriptor: 'Meeting Expectations' },
    { id: 'g3', grade_code: 'AE1', minimum_score: 50, maximum_score: 64, points: 4, performance_level: 'AE', remarks: 'Needs Support', descriptor: 'Approaching Expectations' },
    { id: 'g4', grade_code: 'BE1', minimum_score: 0, maximum_score: 49, points: 2, performance_level: 'BE', remarks: 'Intervention Required', descriptor: 'Below Expectations' },
  ];

  describe('1. Terminal Assessment Discovery - Cohort Isolation', () => {
    it('discovers the school-wide exam as eligible for Grade 9 (cohort sat the exam)', () => {
      const g9Student = allStudents[0]; // Grade 9
      const isEligible = isExamEligibleForTerminal(schoolWideExam, {
        academicYearId: academicYear,
        termId: term,
        student: g9Student,
        classStream: grade9Class,
        allMarks: marksOnlyGrade9,
        students: allStudents,
      });
      expect(isEligible).toBe(true);

      const contributing = filterEligibleTerminalAssessments(
        [schoolWideExam],
        {
          academicYearId: academicYear,
          termId: term,
          student: g9Student,
          classStream: grade9Class,
          allMarks: marksOnlyGrade9,
          students: allStudents,
        }
      );

      expect(contributing).toHaveLength(1);
      expect(contributing[0].id).toBe('exam-end-term-t1');
    });

    it('excludes the school-wide exam for Grade 8 (cohort did not sit the exam, 0 marks)', () => {
      const g8Student = allStudents[2]; // Grade 8
      const isEligible = isExamEligibleForTerminal(schoolWideExam, {
        academicYearId: academicYear,
        termId: term,
        student: g8Student,
        classStream: grade8Class,
        allMarks: marksOnlyGrade9,
        students: allStudents,
      });
      expect(isEligible).toBe(false);

      const contributing = filterEligibleTerminalAssessments(
        [schoolWideExam],
        {
          academicYearId: academicYear,
          termId: term,
          student: g8Student,
          classStream: grade8Class,
          allMarks: marksOnlyGrade9,
          students: allStudents,
        }
      );

      expect(contributing).toHaveLength(0);
    });

    it('excludes the school-wide exam for Grade 7 (cohort did not sit the exam, 0 marks)', () => {
      const g7Student = allStudents[4]; // Grade 7
      const isEligible = isExamEligibleForTerminal(schoolWideExam, {
        academicYearId: academicYear,
        termId: term,
        student: g7Student,
        classStream: grade7Class,
        allMarks: marksOnlyGrade9,
        students: allStudents,
      });
      expect(isEligible).toBe(false);

      const contributing = filterEligibleTerminalAssessments(
        [schoolWideExam],
        {
          academicYearId: academicYear,
          termId: term,
          student: g7Student,
          classStream: grade7Class,
          allMarks: marksOnlyGrade9,
          students: allStudents,
        }
      );

      expect(contributing).toHaveLength(0);
    });
  });

  describe('2. Scenario D: Accidental or Isolated Mark Entry Quorum Check', () => {
    // 15 learners in Grade 7 cohort
    const largeCohortStudents: Student[] = Array.from({ length: 15 }, (_, i) => ({
      id: `s-g7-${i + 1}`,
      admission_number: `ADM-7${String(i + 1).padStart(2, '0')}`,
      full_name: `G7 Student ${i + 1}`,
      class_id: 'class-g7',
      grade: 'Grade 7',
      gender: 'M',
      active: true,
    }));

    it('rejects participation if cohort has >= 10 learners and only 1 student has marks (accidental mark)', () => {
      const accidentalMark: Mark[] = [
        { id: 'acc1', student_id: 's-g7-1', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 60 },
      ];

      const isEligible = isExamEligibleForTerminal(schoolWideExam, {
        academicYearId: academicYear,
        termId: term,
        student: largeCohortStudents[0],
        classStream: grade7Class,
        allMarks: accidentalMark,
        students: largeCohortStudents,
      });

      // Quorum failed: 1 student < 3 students, and 1/15 (6.7%) < 10%
      expect(isEligible).toBe(false);
    });

    it('accepts participation if cohort has >= 10 learners and at least 3 students have marks (genuine cohort participation)', () => {
      const genuineMarks: Mark[] = [
        { id: 'm1', student_id: 's-g7-1', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 60 },
        { id: 'm2', student_id: 's-g7-2', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 65 },
        { id: 'm3', student_id: 's-g7-3', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 70 },
      ];

      const isEligible = isExamEligibleForTerminal(schoolWideExam, {
        academicYearId: academicYear,
        termId: term,
        student: largeCohortStudents[0],
        classStream: grade7Class,
        allMarks: genuineMarks,
        students: largeCohortStudents,
      });

      expect(isEligible).toBe(true);
    });
  });

  describe('3. Analysis Engine - Non-Participating Cohort Calculations', () => {
    it('calculates exam results for Grade 9 with actual scores', () => {
      const g9Students = allStudents.filter((s) => s.grade === 'Grade 9');
      const results = calculateExamResults(
        schoolWideExam.id,
        g9Students,
        marksOnlyGrade9,
        gradingSystem,
        [grade9Class],
        subjects
      );

      expect(results).toHaveLength(2);
      expect(results[0].average).toBeGreaterThan(0);
      expect(results[1].average).toBeGreaterThan(0);
    });

    it('excludes Grade 8 learners from results when assessment was not administered to their cohort', () => {
      const g8Students = allStudents.filter((s) => s.grade === 'Grade 8');
      const results = calculateExamResults(
        schoolWideExam.id,
        g8Students,
        marksOnlyGrade9,
        gradingSystem,
        [grade8Class],
        subjects
      );

      // No results generated: Grade 8 learners are not penalised with 0s or BE grades
      expect(results).toHaveLength(0);
    });

    it('returns not_administered: true with dash grades in generateExamAnalysisSummary when cohort did not sit', () => {
      const emptyStudents: Student[] = [];
      const analysis = generateExamAnalysisSummary(
        schoolWideExam.id,
        schoolWideExam.exam_name,
        emptyStudents,
        subjects,
        [],
        gradingSystem
      );

      expect(analysis.not_administered).toBe(true);
      expect(analysis.mean_grade_code).toBe('-');
      expect(analysis.mean_performance_level).toBe('-');
      expect(analysis.mean_score).toBe(0);
      expect(analysis.total_students).toBe(0);
    });
  });

  describe('4. Multi-Exam Terminal Discovery (Opener for all, End-Term for Grade 9 only)', () => {
    const openerExam: Examination = {
      id: 'exam-opener-t1',
      exam_name: 'Opener Examination 2026',
      exam_type: 'Opener',
      term: 'Term 1',
      year: 2026,
      status: 'Approved',
      max_marks: 100,
      class_id: 'all',
    };

    const multiExamMarks: Mark[] = [
      // Grade 9 has Opener and End-Term
      { id: 'm-g9-op', student_id: 's-g9-1', subject_id: 'sub-eng', exam_id: 'exam-opener-t1', score: 80 },
      { id: 'm-g9-et', student_id: 's-g9-1', subject_id: 'sub-eng', exam_id: 'exam-end-term-t1', score: 85 },
      // Grade 8 has Opener ONLY
      { id: 'm-g8-op', student_id: 's-g8-1', subject_id: 'sub-eng', exam_id: 'exam-opener-t1', score: 75 },
    ];

    it('discovers BOTH Opener and End-Term for Grade 9', () => {
      const g9Contributing = filterEligibleTerminalAssessments(
        [openerExam, schoolWideExam],
        {
          academicYearId: academicYear,
          termId: term,
          student: allStudents[0], // Grade 9
          classStream: grade9Class,
          allMarks: multiExamMarks,
          students: allStudents,
        }
      );

      expect(g9Contributing).toHaveLength(2);
      expect(g9Contributing.map((e) => e.id)).toContain('exam-opener-t1');
      expect(g9Contributing.map((e) => e.id)).toContain('exam-end-term-t1');
    });

    it('discovers ONLY Opener for Grade 8, cleanly excluding End-Term without penalisation', () => {
      const g8Contributing = filterEligibleTerminalAssessments(
        [openerExam, schoolWideExam],
        {
          academicYearId: academicYear,
          termId: term,
          student: allStudents[2], // Grade 8
          classStream: grade8Class,
          allMarks: multiExamMarks,
          students: allStudents,
        }
      );

      expect(g8Contributing).toHaveLength(1);
      expect(g8Contributing[0].id).toBe('exam-opener-t1');
      // End-Term is completely excluded from Grade 8's contributing assessments
      expect(g8Contributing.some((e) => e.id === 'exam-end-term-t1')).toBe(false);
    });
  });
});

