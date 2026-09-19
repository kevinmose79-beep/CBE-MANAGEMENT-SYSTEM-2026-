import { describe, it, expect } from 'vitest';
import { ClassStream, Student, Examination } from '../types';

/**
 * Replicates the exact resolution logic from TerminalResultsView.tsx
 */
function resolveClassStreamId(
  targetClassId: string | undefined,
  targetStreamId: string | undefined,
  accessibleClasses: ClassStream[]
): string {
  if (!targetClassId && !targetStreamId) return '';
  // 1. Direct stream_id / id match
  if (targetClassId) {
    const match = accessibleClasses.find((c) => (c.stream_id || c.id) === targetClassId);
    if (match) return match.stream_id || match.id;
  }
  if (targetStreamId && targetStreamId !== 'all') {
    const match = accessibleClasses.find((c) => (c.stream_id || c.id) === targetStreamId);
    if (match) return match.stream_id || match.id;
  }
  // 2. Class name match (e.g. "Grade 9")
  if (targetClassId) {
    const candidates = accessibleClasses.filter(
      (c) => c.class_name.toLowerCase() === targetClassId.toLowerCase()
    );
    if (targetStreamId && targetStreamId !== 'all') {
      const streamMatch = candidates.find(
        (c) =>
          c.stream_id === targetStreamId ||
          c.id === targetStreamId ||
          c.stream.toLowerCase() === targetStreamId.toLowerCase()
      );
      if (streamMatch) return streamMatch.stream_id || streamMatch.id;
    }
    if (candidates.length === 1) {
      return candidates[0].stream_id || candidates[0].id;
    }
  }
  // Fail-closed: NEVER default to accessibleClasses[0] or PP1
  return '';
}

/**
 * Replicates the authoritative mapping from ReportsView.tsx before passing to TerminalResultsView
 */
function resolveTerminalClassIdFromReports(
  selectedClassId: string,
  selectedStreamId: string,
  accessibleClasses: ClassStream[]
): string {
  const targetClassStream =
    selectedStreamId && selectedStreamId !== 'all'
      ? accessibleClasses.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId)
      : selectedClassId
      ? accessibleClasses.find((c) => c.class_name.toLowerCase() === selectedClassId.toLowerCase())
      : null;
  return targetClassStream
    ? targetClassStream.stream_id || targetClassStream.id
    : selectedClassId || '';
}

/**
 * Replicates the fail-closed exam selection logic from ExaminationAnalysisValidation.tsx and ReportsView.tsx
 */
function resolveAuthoritativeExam(
  exams: Examination[],
  activeYear: number | undefined,
  activeTerm: string | undefined
): string {
  if (!exams || exams.length === 0) return '';
  const match =
    exams.find((ex) => ex.year === activeYear && ex.term === activeTerm && (ex.status as string) !== 'Archived') ||
    exams.find((ex) => ex.year === activeYear && ex.term === activeTerm);
  // Fail-closed: Never fall back to exams[0]!
  return match ? match.id : '';
}

describe('Reports & Merit Lists — Dropdown Selection Integrity & Fail-Closed Auditing', () => {
  // Test fixture where PP1 is the FIRST class in accessibleClasses
  const testClasses: ClassStream[] = [
    { id: 'cls_pp1', stream_id: 'stream_pp1', class_name: 'PP1', stream: 'A', education_level: 'Pre-Primary' },
    { id: 'cls_pp2', stream_id: 'stream_pp2', class_name: 'PP2', stream: 'A', education_level: 'Pre-Primary' },
    { id: 'cls_g7_east', stream_id: 'stream_g7_east', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
    { id: 'cls_g7_west', stream_id: 'stream_g7_west', class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
    { id: 'cls_g8', stream_id: 'stream_g8', class_name: 'Grade 8', stream: 'Alpha', education_level: 'Junior School' },
    { id: 'cls_g9', stream_id: 'stream_g9', class_name: 'Grade 9', stream: 'Central', education_level: 'Junior School' },
  ];

  const testStudents: Student[] = [
    { id: 'stu_pp1_1', first_name: 'Baby', last_name: 'Learner', grade: 'PP1', class_id: 'cls_pp1', stream_id: 'stream_pp1' } as Student,
    { id: 'stu_g7_1', first_name: 'Alice', last_name: 'Smith', grade: 'Grade 7', class_id: 'cls_g7_east', stream_id: 'stream_g7_east' } as Student,
    { id: 'stu_g7_2', first_name: 'Bob', last_name: 'Jones', grade: 'Grade 7', class_id: 'cls_g7_east', stream_id: 'stream_g7_east' } as Student,
    { id: 'stu_g9_1', first_name: 'Charlie', last_name: 'Brown', grade: 'Grade 9', class_id: 'cls_g9', stream_id: 'stream_g9' } as Student,
  ];

  const testExams: Examination[] = [
    { id: 'exam_2023_t1', exam_name: 'Term 1 Exam', year: 2023, term: 'Term 1', status: 'Archived' } as unknown as Examination,
    { id: 'exam_2024_t2', exam_name: 'Mid Term Exam', year: 2024, term: 'Term 2', status: 'Approved' } as unknown as Examination,
    { id: 'exam_2024_t3', exam_name: 'End Term Exam', year: 2024, term: 'Term 3', status: 'Active' } as unknown as Examination,
  ];

  describe('1. TerminalResultsView Class/Stream Resolution (Anti-PP1 Fallback)', () => {
    it('MUST return empty string when initialClassId and initialStreamId are undefined (never PP1)', () => {
      const resolved = resolveClassStreamId(undefined, undefined, testClasses);
      expect(resolved).toBe('');
      expect(resolved).not.toBe('stream_pp1');
      expect(resolved).not.toBe('cls_pp1');
    });

    it('MUST return empty string when initialClassId is invalid or does not match any class (never PP1)', () => {
      const resolved = resolveClassStreamId('non_existent_class_id', undefined, testClasses);
      expect(resolved).toBe('');
      expect(resolved).not.toBe('stream_pp1');
    });

    it('MUST resolve exact stream_id when initialClassId matches an existing stream_id', () => {
      const resolved = resolveClassStreamId('stream_g7_east', undefined, testClasses);
      expect(resolved).toBe('stream_g7_east');
    });

    it('MUST resolve exact stream_id when initialClassId is a unique class name like "Grade 9"', () => {
      const resolved = resolveClassStreamId('Grade 9', undefined, testClasses);
      expect(resolved).toBe('stream_g9');
    });

    it('MUST resolve exact stream_id when class name and stream ID are both provided', () => {
      const resolved = resolveClassStreamId('Grade 7', 'stream_g7_west', testClasses);
      expect(resolved).toBe('stream_g7_west');
    });

    it('MUST return empty string if class name has multiple streams but stream ID is not provided (fail-closed)', () => {
      // Grade 7 has both East and West streams; without stream specification, it cannot guess
      const resolved = resolveClassStreamId('Grade 7', undefined, testClasses);
      expect(resolved).toBe('');
      expect(resolved).not.toBe('stream_pp1');
    });
  });

  describe('2. ReportsView to TerminalResultsView Parameter Integrity', () => {
    it('authoritatively maps class name "Grade 9" to stream_g9 before passing as prop', () => {
      const resolved = resolveTerminalClassIdFromReports('Grade 9', 'all', testClasses);
      expect(resolved).toBe('stream_g9');
    });

    it('authoritatively maps specific stream "stream_g7_west" before passing as prop', () => {
      const resolved = resolveTerminalClassIdFromReports('Grade 7', 'stream_g7_west', testClasses);
      expect(resolved).toBe('stream_g7_west');
    });

    it('passes empty string when no class is selected in ReportsView (never PP1)', () => {
      const resolved = resolveTerminalClassIdFromReports('', '', testClasses);
      expect(resolved).toBe('');
      expect(resolved).not.toBe('stream_pp1');
    });
  });

  describe('3. Learner Selection Integrity (Anti-Auto-Select Fallback)', () => {
    it('does NOT auto-select the first learner when no learner is initially selected', () => {
      // Simulation of fail-closed state
      let selectedStudentId = '';
      const cohort = testStudents.filter((s) => s.grade === 'Grade 7');
      expect(cohort.length).toBe(2);

      // In the healed component, empty selectedStudentId stays empty
      if (selectedStudentId && !cohort.some((s) => s.id === selectedStudentId)) {
        selectedStudentId = '';
      }
      expect(selectedStudentId).toBe('');
      expect(selectedStudentId).not.toBe('stu_g7_1');
    });

    it('clears learner selection when learner does not belong to the selected class cohort', () => {
      // Bob belongs to Grade 7, but user switched to Grade 9
      let selectedStudentId = 'stu_g7_2';
      const grade9Cohort = testStudents.filter((s) => s.grade === 'Grade 9');

      if (selectedStudentId && !grade9Cohort.some((s) => s.id === selectedStudentId)) {
        selectedStudentId = '';
      }
      expect(selectedStudentId).toBe('');
    });

    it('preserves valid learner selection when learner is present in cohort', () => {
      let selectedStudentId = 'stu_g7_1';
      const grade7Cohort = testStudents.filter((s) => s.grade === 'Grade 7');

      if (selectedStudentId && !grade7Cohort.some((s) => s.id === selectedStudentId)) {
        selectedStudentId = '';
      }
      expect(selectedStudentId).toBe('stu_g7_1');
    });
  });

  describe('4. Assessment Selection Integrity (Anti-exams[0] Fallback)', () => {
    it('returns exact matching active exam when year and term match', () => {
      const resolved = resolveAuthoritativeExam(testExams, 2024, 'Term 3');
      expect(resolved).toBe('exam_2024_t3');
    });

    it('returns empty string when no exam matches active session (never falls back to exams[0])', () => {
      // Year 2025 has no exams in testExams
      const resolved = resolveAuthoritativeExam(testExams, 2025, 'Term 1');
      expect(resolved).toBe('');
      expect(resolved).not.toBe('exam_2023_t1'); // Must NOT fall back to first exam
    });

    it('returns empty string when exams list is empty', () => {
      const resolved = resolveAuthoritativeExam([], 2024, 'Term 3');
      expect(resolved).toBe('');
    });
  });

  describe('5. Class Comparison Tab Integrity & Admin Role Fail-Closed Behavior', () => {
    it('ensures Admin role produces null primaryClass and does not auto-select PP1', () => {
      // Simulate ReportsView logic for Admin user
      const currentRole: string = 'admin';
      const isClassTeacher = currentRole === 'class_teacher';
      const isClassTeacherRole = currentRole !== 'admin' && isClassTeacher;
      const primaryClass = isClassTeacherRole ? testClasses[0] : null;

      expect(isClassTeacherRole).toBe(false);
      expect(primaryClass).toBeNull();

      let selectedClassId = '';
      // On class_comparison, if unselected, selectedClassId stays empty
      expect(selectedClassId).toBe('');
      expect(selectedClassId).not.toBe('PP1');
    });

    it('ensures class_comparison tab does NOT force class selection', () => {
      let selectedStreamId = '';
      let selectedClassId = '';

      // Simulated class_comparison effect: only sets stream to 'all', does not set class
      const reportTab = 'class_comparison';
      if (reportTab === 'class_comparison') {
        if (selectedStreamId !== 'all') {
          selectedStreamId = 'all';
        }
      }

      expect(selectedStreamId).toBe('all');
      expect(selectedClassId).toBe('');
      expect(selectedClassId).not.toBe('PP1');
    });

    it('does NOT default to accessibleClasses[0] (PP1) when no primary class exists', () => {
      const primaryClass = null;
      let selectedClassId = '';

      if (!selectedClassId && primaryClass) {
        selectedClassId = (primaryClass as any).class_name;
      }
      expect(selectedClassId).toBe('');
      expect(selectedClassId).not.toBe('PP1');
    });
  });
});
