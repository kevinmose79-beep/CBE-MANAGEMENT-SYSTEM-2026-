import { describe, it, expect } from 'vitest';
import { computeExamReadiness } from '../utils/examReadinessUtils';
import { Examination, ClassStream, Student, Subject, Mark } from '../types';

describe('Phase 2: Assessment Readiness Scope Engine (computeExamReadiness)', () => {
  // Setup standard fixtures representing a multi-level school:
  // Pre-Primary: PP1 (1 stream)
  // Lower Primary: Grade 3 (1 stream)
  // Upper Primary: Grade 6 (1 stream)
  // Junior School: Grade 7 (1 stream), Grade 8 (1 stream), Grade 9 (2 streams: North & South)
  const mockClasses: ClassStream[] = [
    { id: 'cls-pp1', stream_id: 'st-pp1', class_name: 'PP1', stream: 'Joy', education_level: 'Pre-Primary', status: 'Active' },
    { id: 'cls-g3', stream_id: 'st-g3', class_name: 'Grade 3', stream: 'Faith', education_level: 'Lower Primary', status: 'Active' },
    { id: 'cls-g6', stream_id: 'st-g6', class_name: 'Grade 6', stream: 'Peace', education_level: 'Upper Primary', status: 'Active' },
    { id: 'cls-g7', stream_id: 'st-g7', class_name: 'Grade 7', stream: 'A', education_level: 'Junior School', status: 'Active' },
    { id: 'cls-g8', stream_id: 'st-g8', class_name: 'Grade 8', stream: 'A', education_level: 'Junior School', status: 'Active' },
    { id: 'cls-g9', stream_id: 'st-g9-north', class_name: 'Grade 9', stream: 'North', education_level: 'Junior School', status: 'Active' },
    { id: 'cls-g9', stream_id: 'st-g9-south', class_name: 'Grade 9', stream: 'South', education_level: 'Junior School', status: 'Active' },
    { id: 'cls-inactive', stream_id: 'st-inactive', class_name: 'Grade 9', stream: 'Legacy', education_level: 'Junior School', status: 'Inactive' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub-math', subject_name: 'Mathematics', subject_code: 'MATH', education_level: 'Junior School', category: 'Core' },
    { id: 'sub-eng', subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School', category: 'Core' },
  ];

  // Students in Grade 9
  const mockStudents: Student[] = [
    { id: 'std-g9-1', full_name: 'Alice Wambui', class_id: 'cls-g9', stream_id: 'st-g9-north', admission_number: 'ADM001', active: true, gender: 'F' },
    { id: 'std-g9-2', full_name: 'Bob Kiprono', class_id: 'cls-g9', stream_id: 'st-g9-south', admission_number: 'ADM002', active: true, gender: 'M' },
    // Student in Grade 8 (has 0 marks)
    { id: 'std-g8-1', full_name: 'Charlie Otieno', class_id: 'cls-g8', stream_id: 'st-g8', admission_number: 'ADM003', active: true, gender: 'M' },
    // Student in Grade 7 (has 0 marks)
    { id: 'std-g7-1', full_name: 'David Mwangi', class_id: 'cls-g7', stream_id: 'st-g7', admission_number: 'ADM004', active: true, gender: 'M' },
  ];

  describe('Test A: School-Wide Assessment', () => {
    it('evaluates all active eligible streams across the whole school when education_level and class_id are null', () => {
      const schoolWideExam: Examination = {
        id: 'exam-school-wide',
        exam_name: 'End of Year General Assessment',
        term: 'Term 3',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'End-Term',
        education_level: undefined,
        class_id: undefined,
      };

      const readiness = computeExamReadiness(schoolWideExam, mockClasses, mockStudents, mockSubjects, []);

      // Total active streams: PP1, Grade 3, Grade 6, Grade 7, Grade 8, Grade 9 North, Grade 9 South = 7 streams
      // (Inactive stream 'Legacy' excluded)
      expect(readiness.totalStreamsCount).toBe(7);
      expect(readiness.levelGroups['Pre-Primary'].totalStreams).toBe(1);
      expect(readiness.levelGroups['Lower Primary'].totalStreams).toBe(1);
      expect(readiness.levelGroups['Upper Primary'].totalStreams).toBe(1);
      expect(readiness.levelGroups['Junior School'].totalStreams).toBe(4);
    });
  });

  describe('Test B: Level-Wide Assessment', () => {
    it('evaluates ONLY streams within the targeted education level', () => {
      const juniorSchoolExam: Examination = {
        id: 'exam-js-level',
        exam_name: 'Junior School Joint Mock',
        term: 'Term 2',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'Mid-Term',
        education_level: 'Junior School',
        class_id: undefined,
      };

      const readiness = computeExamReadiness(juniorSchoolExam, mockClasses, mockStudents, mockSubjects, []);

      // Only Grade 7, Grade 8, Grade 9 North, Grade 9 South = 4 streams
      expect(readiness.totalStreamsCount).toBe(4);
      expect(readiness.levelGroups['Junior School'].totalStreams).toBe(4);
      expect(readiness.levelGroups['Pre-Primary'].totalStreams).toBe(0);
      expect(readiness.levelGroups['Lower Primary'].totalStreams).toBe(0);
      expect(readiness.levelGroups['Upper Primary'].totalStreams).toBe(0);
    });
  });

  describe('Test C: Grade/Class-Wide Assessment', () => {
    it('evaluates ONLY streams belonging to the targeted class (Grade 9)', () => {
      const grade9Exam: Examination = {
        id: 'exam-g9-only',
        exam_name: 'Grade 9 KJSEA Simulation',
        term: 'Term 2',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'Mid-Term',
        education_level: 'Junior School',
        class_id: 'cls-g9',
      };

      const readiness = computeExamReadiness(grade9Exam, mockClasses, mockStudents, mockSubjects, []);

      // Only Grade 9 North and Grade 9 South = 2 streams
      // Grade 7, Grade 8, PP1, Grade 3, Grade 6 must NOT participate!
      expect(readiness.totalStreamsCount).toBe(2);
      expect(readiness.levelGroups['Junior School'].totalStreams).toBe(2);
      expect(readiness.levelGroups['Junior School'].grades['Grade 9'].totalStreams).toBe(2);
      expect(readiness.levelGroups['Junior School'].grades['Grade 8']).toBeUndefined();
      expect(readiness.levelGroups['Junior School'].grades['Grade 7']).toBeUndefined();
      expect(readiness.levelGroups['Pre-Primary'].totalStreams).toBe(0);
      expect(readiness.levelGroups['Lower Primary'].totalStreams).toBe(0);
      expect(readiness.levelGroups['Upper Primary'].totalStreams).toBe(0);
    });
  });

  describe('Critical Negative Test: Grade 9 Assessment with 100% Marks Entered', () => {
    it('marks Grade 9 assessment 100% READY and ready for approval even when Grade 7, Grade 8, and Grade 6 have 0% marks', () => {
      const grade9Exam: Examination = {
        id: 'exam-g9-test',
        exam_name: 'Grade 9 Special Exam',
        term: 'Term 1',
        year: 2026,
        max_marks: 100,
        status: 'Draft',
        exam_type: 'End-Term',
        education_level: 'Junior School',
        class_id: 'cls-g9',
      };

      // Both Grade 9 students (Alice in North, Bob in South) have all marks entered for Math and Eng
      const grade9CompleteMarks: Mark[] = [
        {
          id: 'mk-1',
          exam_id: 'exam-g9-test',
          student_id: 'std-g9-1',
          subject_id: 'sub-math',
          score: 85,
        },
        {
          id: 'mk-2',
          exam_id: 'exam-g9-test',
          student_id: 'std-g9-1',
          subject_id: 'sub-eng',
          score: 78,
        },
        {
          id: 'mk-3',
          exam_id: 'exam-g9-test',
          student_id: 'std-g9-2',
          subject_id: 'sub-math',
          score: 90,
        },
        {
          id: 'mk-4',
          exam_id: 'exam-g9-test',
          student_id: 'std-g9-2',
          subject_id: 'sub-eng',
          score: 82,
        },
      ];

      // Charlie (Grade 8) and David (Grade 7) have ZERO marks!
      // In the old un-scoped logic, this would cause incompleteStreamsCount > 0 and block approval.
      const readiness = computeExamReadiness(
        grade9Exam,
        mockClasses,
        mockStudents,
        mockSubjects,
        grade9CompleteMarks
      );

      // Verify the assessment is fully ready!
      expect(readiness.totalStreamsCount).toBe(2);
      expect(readiness.readyStreamsCount).toBe(2);
      expect(readiness.incompleteStreamsCount).toBe(0);
      expect(readiness.isExamReady).toBe(true);
      expect(readiness.allIncompleteStreams).toHaveLength(0);

      // Level group for Junior School must also be ready
      const jsGroup = readiness.levelGroups['Junior School'];
      expect(jsGroup.totalStreams).toBe(2);
      expect(jsGroup.readyCount).toBe(2);
      expect(jsGroup.incompleteCount).toBe(0);
      expect(jsGroup.isLevelReady).toBe(true);
      expect(jsGroup.incompleteStreams).toHaveLength(0);
    });
  });

  describe('Historical Learner Placement Preservation', () => {
    it('correctly resolves learner placement at exam time', () => {
      const historicalExam: Examination = {
        id: 'exam-2025-g9',
        exam_name: 'Grade 9 2025 Exam',
        term: 'Term 3',
        year: 2025,
        max_marks: 100,
        status: 'Published',
        exam_type: 'End-Term',
        education_level: 'Junior School',
        class_id: 'cls-g9',
      };

      // Student has historical placement in Grade 9 in 2025 (promoted in 2026 to Grade 10)
      const studentWithHistory: Student = {
        id: 'std-hist-1',
        full_name: 'Grace Achieng',
        gender: 'F',
        class_id: 'cls-other',
        stream_id: 'st-other',
        admission_number: 'ADM999',
        active: true,
        promotion_history: [
          {
            id: 'promo-1',
            student_id: 'std-hist-1',
            from_class_id: 'st-g9-north',
            to_class_id: 'cls-other',
            from_grade: 'Grade 9',
            to_grade: 'Grade 1',
            date_promoted: '2026-01-05',
          },
        ],
      };

      const readiness = computeExamReadiness(
        historicalExam,
        mockClasses,
        [studentWithHistory],
        mockSubjects,
        []
      );

      // Stream st-g9-north should find Grace Achieng based on 2025 historical record
      const g9NorthStream = readiness.levelGroups['Junior School'].allStreams.find(
        (st) => st.streamId === 'st-g9-north'
      );
      expect(g9NorthStream).toBeDefined();
      expect(g9NorthStream?.totalLearners).toBe(1);
    });
  });

  describe('Edge Cases and Approval Roll-up', () => {
    it('handles class_id="all" with education_level="Junior School" by including all Junior School streams', () => {
      const examAllInJS: Examination = {
        id: 'exam-all-js',
        exam_name: 'Junior School Assessment',
        term: 'Term 1',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'End-Term',
        education_level: 'Junior School',
        class_id: 'all',
      };

      const readiness = computeExamReadiness(examAllInJS, mockClasses, mockStudents, mockSubjects, []);
      expect(readiness.totalStreamsCount).toBe(4); // Grade 7, 8, 9 North, 9 South
    });

    it('handles null/undefined exam gracefully by returning all active streams', () => {
      const readiness = computeExamReadiness(null, mockClasses, mockStudents, mockSubjects, []);
      expect(readiness.totalStreamsCount).toBe(7);
    });

    it('handles approval rollups correctly when all scoped streams are approved', () => {
      const grade9Exam: Examination = {
        id: 'exam-g9-approved',
        exam_name: 'Grade 9 Approved Exam',
        term: 'Term 1',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'End-Term',
        education_level: 'Junior School',
        class_id: 'cls-g9',
        approved_classes: ['st-g9-north', 'st-g9-south'],
      };

      const readiness = computeExamReadiness(grade9Exam, mockClasses, mockStudents, mockSubjects, []);

      expect(readiness.totalStreamsCount).toBe(2);
      expect(readiness.approvedStreamsCount).toBe(2);
      expect(readiness.incompleteStreamsCount).toBe(0);
      expect(readiness.isExamApproved).toBe(true);
      expect(readiness.isExamReady).toBe(true);
      expect(readiness.levelGroups['Junior School'].isLevelApproved).toBe(true);
      expect(readiness.levelGroups['Junior School'].statusText).toContain('Level Fully Approved');
    });

    it('ensures un-scoped streams with 0 streams have "No streams in scope" status', () => {
      const grade9Exam: Examination = {
        id: 'exam-g9-status',
        exam_name: 'Grade 9 Status Exam',
        term: 'Term 1',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'End-Term',
        education_level: 'Junior School',
        class_id: 'cls-g9',
      };

      const readiness = computeExamReadiness(grade9Exam, mockClasses, mockStudents, mockSubjects, []);

      expect(readiness.levelGroups['Pre-Primary'].statusText).toBe('No streams in scope');
      expect(readiness.levelGroups['Lower Primary'].statusText).toBe('No streams in scope');
      expect(readiness.levelGroups['Upper Primary'].statusText).toBe('No streams in scope');
    });

    it('Test G: Rejects non-authoritative name matching when another class has class_name="Grade 9" but a different UUID', () => {
      // Create a class fixture that has an imposter/stale stream with class_name="Grade 9" but a different c.id
      const classesWithDuplicateName: ClassStream[] = [
        ...mockClasses,
        {
          id: 'cls-g9-stale-different-uuid',
          stream_id: 'st-g9-imposter',
          class_name: 'Grade 9',
          stream: 'West',
          education_level: 'Junior School',
          status: 'Active',
        },
      ];

      const grade9Exam: Examination = {
        id: 'exam-g9-strict-uuid',
        exam_name: 'Grade 9 Strict UUID Exam',
        term: 'Term 1',
        year: 2026,
        max_marks: 100,
        status: 'Published',
        exam_type: 'End-Term',
        education_level: 'Junior School',
        class_id: 'cls-g9', // Exact UUID of the authentic Grade 9 class
      };

      const readiness = computeExamReadiness(grade9Exam, classesWithDuplicateName, mockStudents, mockSubjects, []);

      // Total streams MUST strictly be 2 (st-g9-north and st-g9-south), NOT 3!
      // The stream with id 'cls-g9-stale-different-uuid' must NOT be matched by name inference.
      expect(readiness.totalStreamsCount).toBe(2);
      const streamIds = readiness.levelGroups['Junior School'].allStreams.map((s) => s.streamId);
      expect(streamIds).toContain('st-g9-north');
      expect(streamIds).toContain('st-g9-south');
      expect(streamIds).not.toContain('st-g9-imposter');
    });
  });
});
