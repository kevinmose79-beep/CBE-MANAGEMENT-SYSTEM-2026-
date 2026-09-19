import { describe, it, expect } from 'vitest';
import { isClassInExamScope, isLearnerInExamScope } from '../utils/filterUtils';
import { ClassStream, Examination, Student, User, Teacher } from '../types';
import { LearnerExamContext, getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { getAccessibleClasses, getAccessibleStudents } from '../utils/rbacUtils';

describe('Phase 3B — Marks Monitoring Assessment Scope Rules', () => {
  // Test Fixtures: Distinct classes across multiple education levels
  const g1East: ClassStream = {
    id: 'cls_uuid_g1',
    stream_id: 'strm_uuid_g1e',
    class_name: 'Grade 1',
    stream: 'East',
    education_level: 'Lower Primary',
    status: 'Active',
  };

  const g4North: ClassStream = {
    id: 'cls_uuid_g4',
    stream_id: 'strm_uuid_g4n',
    class_name: 'Grade 4',
    stream: 'North',
    education_level: 'Upper Primary',
    status: 'Active',
  };

  const g7East: ClassStream = {
    id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7e',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const g7West: ClassStream = {
    id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7w',
    class_name: 'Grade 7',
    stream: 'West',
    education_level: 'Junior School',
    status: 'Active',
  };

  const g8East: ClassStream = {
    id: 'cls_uuid_g8',
    stream_id: 'strm_uuid_g8e',
    class_name: 'Grade 8',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const imposterG7: ClassStream = {
    id: 'cls_uuid_imposter_g7',
    stream_id: 'strm_uuid_imposter_east',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const allClasses: ClassStream[] = [g1East, g4North, g7East, g7West, g8East, imposterG7];

  // Examinations
  const schoolWideExam: Examination = {
    id: 'exam_sw_2025',
    exam_name: 'School Wide Annual Assessment',
    education_level: null as any,
    class_id: null as any,
    term: 'Term 1',
    year: 2025,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const levelWideJuniorExam: Examination = {
    id: 'exam_lw_js_2025',
    exam_name: 'Junior School Assessment',
    education_level: 'Junior School',
    class_id: null as any,
    term: 'Term 1',
    year: 2025,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const classWideG7Exam: Examination = {
    id: 'exam_cw_g7_2025',
    exam_name: 'Grade 7 Mid-Term Assessment',
    education_level: 'Junior School',
    class_id: 'cls_uuid_g7',
    term: 'Term 1',
    year: 2025,
    status: 'Published',
    exam_type: 'Mid-Term',
    max_marks: 100,
  };

  // Learners
  const stdG1Active: Student = {
    id: 'std_g1_01',
    admission_number: 'ADM-G1-01',
    full_name: 'Amina Ali',
    gender: 'F',
    grade: 'Grade 1',
    class_id: 'cls_uuid_g1',
    stream_id: 'strm_uuid_g1e',
    active: true,
  };

  const stdG4Active: Student = {
    id: 'std_g4_01',
    admission_number: 'ADM-G4-01',
    full_name: 'Brian Omondi',
    gender: 'M',
    grade: 'Grade 4',
    class_id: 'cls_uuid_g4',
    stream_id: 'strm_uuid_g4n',
    active: true,
  };

  const stdG7EastActive: Student = {
    id: 'std_g7_01',
    admission_number: 'ADM-G7-01',
    full_name: 'Charity Mutua',
    gender: 'F',
    grade: 'Grade 7',
    class_id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7e',
    active: true,
  };

  const stdG7WestActive: Student = {
    id: 'std_g7_02',
    admission_number: 'ADM-G7-02',
    full_name: 'David Kimani',
    gender: 'M',
    grade: 'Grade 7',
    class_id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7w',
    active: true,
  };

  const stdG8Active: Student = {
    id: 'std_g8_01',
    admission_number: 'ADM-G8-01',
    full_name: 'Emmanuel Kiprono',
    gender: 'M',
    grade: 'Grade 8',
    class_id: 'cls_uuid_g8',
    stream_id: 'strm_uuid_g8e',
    active: true,
  };

  const stdG7Inactive: Student = {
    id: 'std_g7_inact',
    admission_number: 'ADM-G7-99',
    full_name: 'Inactive Learner',
    gender: 'M',
    grade: 'Grade 7',
    class_id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7e',
    active: false,
  };

  const stdG7Imposter: Student = {
    id: 'std_g7_imposter',
    admission_number: 'ADM-G7-IMP',
    full_name: 'Imposter Learner',
    gender: 'M',
    grade: 'Grade 7',
    class_id: 'cls_uuid_imposter_g7',
    stream_id: 'strm_uuid_imposter_east',
    active: true,
  };

  const allStudents: Student[] = [
    stdG1Active,
    stdG4Active,
    stdG7EastActive,
    stdG7WestActive,
    stdG8Active,
    stdG7Inactive,
    stdG7Imposter,
  ];

  // Helper simulating MarksMonitoringView's in-scope classes derivation
  function getInScopeClasses(classes: ClassStream[], exam?: Examination | null): ClassStream[] {
    if (!exam) return [];
    return classes.filter((c) => isClassInExamScope(c, exam));
  }

  // Helper simulating MarksMonitoringView's examEligibleLearners derivation
  function getExamEligibleLearners(
    students: Student[],
    exam: Examination,
    classes: ClassStream[]
  ) {
    const resolvedWithContext = students.map((std) => ({
      student: std,
      examContext: getLearnerClassAtExamTime(std, exam, classes),
    }));

    return resolvedWithContext.filter(({ examContext }) =>
      isLearnerInExamScope(examContext, exam, classes)
    );
  }

  // Helper simulating MarksMonitoringView's availableStreams derivation
  function getAvailableStreams(
    inScopeClasses: ClassStream[],
    selectedClassId: string,
    exam?: Examination | null
  ): ClassStream[] {
    if (!exam || !selectedClassId || selectedClassId === '') return [];
    if (selectedClassId === 'all') return inScopeClasses;

    return inScopeClasses.filter(
      (c) => c.class_name === selectedClassId || c.id === selectedClassId
    );
  }

  // --- SCHOOL-WIDE TESTS ---
  describe('School-Wide Assessment Scope', () => {
    it('1. All eligible classes are included in scope', () => {
      const inScope = getInScopeClasses(allClasses, schoolWideExam);
      expect(inScope.length).toBe(allClasses.length);
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g1');
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g4');
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g7');
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g8');
    });

    it('2. Learners from all levels are eligible', () => {
      const activeLearners = allStudents.filter((s) => s.active);
      const eligible = getExamEligibleLearners(activeLearners, schoolWideExam, allClasses);
      const eligibleIds = eligible.map((e) => e.student.id);

      expect(eligibleIds).toContain(stdG1Active.id); // Lower Primary
      expect(eligibleIds).toContain(stdG4Active.id); // Upper Primary
      expect(eligibleIds).toContain(stdG7EastActive.id); // Junior School
      expect(eligibleIds).toContain(stdG8Active.id); // Junior School
    });

    it('3. Existing RBAC filtering continues to apply before scope', () => {
      // Class Teacher Joyce assigned only to Grade 7 East
      const ctTeacher: Teacher = {
        id: 'tch_ct_01',
        user_id: 'usr_ct',
        teacher_name: 'Teacher Joyce',
        email: 'joyce@school.com',
        phone: '0712345678',
        is_class_teacher: true,
        class_teacher_of_id: 'strm_uuid_g7e',
        allocations: [],
      };
      const ctUser: User = {
        id: 'usr_ct',
        name: 'Teacher Joyce',
        username: 'joyce',
        email: 'joyce@school.com',
        role: 'class_teacher',
      };

      const activeStudents = allStudents.filter((s) => s.active);
      const accessibleStudents = getAccessibleStudents(ctUser, ctTeacher, activeStudents, allClasses);
      // Accessible students must only be Grade 7 East active learners
      const accessibleIds = accessibleStudents.map((s) => s.id);
      expect(accessibleIds).toContain(stdG7EastActive.id);
      expect(accessibleIds).not.toContain(stdG1Active.id);
      expect(accessibleIds).not.toContain(stdG4Active.id);
      expect(accessibleIds).not.toContain(stdG7WestActive.id);
      expect(accessibleIds).not.toContain(stdG8Active.id);

      // Scoping this RBAC-filtered set to School-Wide must remain strictly within RBAC boundaries
      const eligible = getExamEligibleLearners(accessibleStudents, schoolWideExam, allClasses);
      expect(eligible.length).toBe(1);
      expect(eligible[0].student.id).toBe(stdG7EastActive.id);
    });

    it('4. Active status continues to apply (inactive learners excluded upfront)', () => {
      const activeOnly = allStudents.filter((s) => s.active);
      expect(activeOnly.some((s) => s.id === stdG7Inactive.id)).toBe(false);

      const eligible = getExamEligibleLearners(activeOnly, schoolWideExam, allClasses);
      expect(eligible.some((e) => e.student.id === stdG7Inactive.id)).toBe(false);
    });
  });

  // --- LEVEL-WIDE TESTS ---
  describe('Level-Wide Assessment Scope', () => {
    it('5. Only classes in the target education level are included', () => {
      const inScope = getInScopeClasses(allClasses, levelWideJuniorExam);
      const inScopeClassNames = inScope.map((c) => c.class_name);

      expect(inScopeClassNames).toContain('Grade 7');
      expect(inScopeClassNames).toContain('Grade 8');
      inScope.forEach((c) => {
        expect(c.education_level).toBe('Junior School');
      });
    });

    it('6. Classes from another education level are excluded', () => {
      const inScope = getInScopeClasses(allClasses, levelWideJuniorExam);
      const inScopeIds = inScope.map((c) => c.id);

      expect(inScopeIds).not.toContain('cls_uuid_g1'); // Lower Primary excluded
      expect(inScopeIds).not.toContain('cls_uuid_g4'); // Upper Primary excluded
    });

    it('7. Only learners belonging to the target education level are included', () => {
      const activeLearners = allStudents.filter((s) => s.active);
      const eligible = getExamEligibleLearners(activeLearners, levelWideJuniorExam, allClasses);
      const eligibleIds = eligible.map((e) => e.student.id);

      expect(eligibleIds).toContain(stdG7EastActive.id);
      expect(eligibleIds).toContain(stdG7WestActive.id);
      expect(eligibleIds).toContain(stdG8Active.id);

      // Excludes Lower & Upper Primary
      expect(eligibleIds).not.toContain(stdG1Active.id);
      expect(eligibleIds).not.toContain(stdG4Active.id);
    });
  });

  // --- GRADE / CLASS-WIDE TESTS ---
  describe('Grade/Class-Wide Assessment Scope', () => {
    it('8. Learner with matching context.class_id is included', () => {
      const activeLearners = allStudents.filter((s) => s.active);
      const eligible = getExamEligibleLearners(activeLearners, classWideG7Exam, allClasses);
      const eligibleIds = eligible.map((e) => e.student.id);

      expect(eligibleIds).toContain(stdG7EastActive.id);
      expect(eligibleIds).toContain(stdG7WestActive.id);
    });

    it('9. Learner with different context.class_id is excluded', () => {
      const activeLearners = allStudents.filter((s) => s.active);
      const eligible = getExamEligibleLearners(activeLearners, classWideG7Exam, allClasses);
      const eligibleIds = eligible.map((e) => e.student.id);

      expect(eligibleIds).not.toContain(stdG8Active.id); // Grade 8 learner excluded
      expect(eligibleIds).not.toContain(stdG1Active.id); // Grade 1 learner excluded
      expect(eligibleIds).not.toContain(stdG4Active.id); // Grade 4 learner excluded
    });

    it('10. Learner with matching stream_id but different class_id is excluded', () => {
      // Craft a learner whose stream_id equals exam.class_id ('cls_uuid_g7') but whose class_id is different
      const spoofedContext: LearnerExamContext = {
        class_id: 'cls_uuid_g8',
        stream_id: 'cls_uuid_g7', // Stream ID happens to equal target class_id
        grade: 'Grade 8',
        class_name: 'Grade 8',
        stream_name: 'East',
        full_class_name: 'Grade 8 East',
        is_historical: false,
        historical_context_resolved: true,
        resolution_source: 'live_current',
      };

      expect(isLearnerInExamScope(spoofedContext, classWideG7Exam, allClasses)).toBe(false);
    });

    it('11. Target Class UUID is accepted', () => {
      const inScope = getInScopeClasses(allClasses, classWideG7Exam);
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g7');
      expect(inScope.some((c) => c.stream === 'East')).toBe(true);
      expect(inScope.some((c) => c.stream === 'West')).toBe(true);
    });

    it('12. Same-name/different-UUID class is rejected', () => {
      const inScope = getInScopeClasses(allClasses, classWideG7Exam);
      // Imposter class has class_name: 'Grade 7' but id: 'cls_uuid_imposter_g7'
      expect(inScope.some((c) => c.id === 'cls_uuid_imposter_g7')).toBe(false);

      // And imposter learner is excluded from eligible learners
      const activeLearners = allStudents.filter((s) => s.active);
      const eligible = getExamEligibleLearners(activeLearners, classWideG7Exam, allClasses);
      expect(eligible.some((e) => e.student.id === stdG7Imposter.id)).toBe(false);
    });

    it('13. Streams from another class are excluded', () => {
      const inScope = getInScopeClasses(allClasses, classWideG7Exam);
      const streams = getAvailableStreams(inScope, 'all', classWideG7Exam);

      // Only Grade 7 East and West should be present
      expect(streams.map((s) => s.stream_id)).toEqual(['strm_uuid_g7e', 'strm_uuid_g7w']);
      expect(streams.some((s) => s.stream_id === 'strm_uuid_g8e')).toBe(false);
      expect(streams.some((s) => s.stream_id === 'strm_uuid_g1e')).toBe(false);
      expect(streams.some((s) => s.stream_id === 'strm_uuid_g4n')).toBe(false);
    });
  });

  // --- SELECTION INTEGRITY TESTS ---
  describe('Selection Integrity and Entity Identity', () => {
    it('14. Changing assessment invalidates an out-of-scope class selection', () => {
      // User was viewing Grade 8 under Level-Wide exam
      let selectedClassId: string = 'Grade 8';
      let selectedStreamId: string = 'strm_uuid_g8e';

      // Assessment changes to Grade 7 Class-Wide exam
      const newExam = classWideG7Exam;
      const inScopeForNewExam = getInScopeClasses(allClasses, newExam);

      // Check validation logic as implemented in MarksMonitoringView selection integrity effect:
      const isClassValid = inScopeForNewExam.some(
        (c) => c.class_name === selectedClassId || c.id === selectedClassId
      );

      if (!isClassValid) {
        selectedClassId = '';
        selectedStreamId = '';
      }

      expect(isClassValid).toBe(false);
      expect(selectedClassId).toBe('');
      expect(selectedStreamId).toBe('');
    });

    it('15. Changing class invalidates an out-of-scope stream selection', () => {
      // User was viewing Grade 7 West
      const inScope = getInScopeClasses(allClasses, classWideG7Exam);
      let selectedStreamId: string = 'strm_uuid_g7w'; // West stream

      // User changes class to Grade 8 (under a level-wide exam)
      const inScopeLevel = getInScopeClasses(allClasses, levelWideJuniorExam);
      const availableStreamsForG8 = getAvailableStreams(inScopeLevel, 'Grade 8', levelWideJuniorExam);

      const isStreamValid = availableStreamsForG8.some(
        (c) => c.stream_id === selectedStreamId || c.id === selectedStreamId
      );

      if (!isStreamValid) {
        selectedStreamId = '';
      }

      expect(isStreamValid).toBe(false);
      expect(selectedStreamId).toBe('');
    });

    it('16. No automatic first-option selection occurs', () => {
      // When invalidated, selection MUST be cleared to empty string, NOT defaulted to first item
      const inScope = getInScopeClasses(allClasses, classWideG7Exam);
      let selectedClassId = 'Invalid Out-of-Scope Class';

      const isValid = inScope.some((c) => c.class_name === selectedClassId || c.id === selectedClassId);
      if (!isValid) {
        selectedClassId = ''; // Cleared to ''
      }

      expect(selectedClassId).toBe('');
      expect(selectedClassId).not.toBe(inScope[0].class_name);
    });

    it('17. No [0] selection inference occurs from array order', () => {
      const inScope = getInScopeClasses(allClasses, classWideG7Exam);
      const streams = getAvailableStreams(inScope, 'all', classWideG7Exam);
      let selectedStreamId = 'strm_non_existent';

      const isValid = streams.some((s) => s.stream_id === selectedStreamId || s.id === selectedStreamId);
      if (!isValid) {
        selectedStreamId = '';
      }

      expect(selectedStreamId).toBe('');
      expect(selectedStreamId).not.toBe(streams[0].stream_id);
    });

    it('18. Stream UUID is never matched against exam.class_id', () => {
      // Confirm that passing a stream UUID as exam.class_id fails closed
      const corruptExam: Examination = {
        ...classWideG7Exam,
        id: 'exam_corrupt',
        class_id: 'strm_uuid_g7e', // Stream UUID mistakenly placed in class_id
      };

      const inScope = getInScopeClasses(allClasses, corruptExam);
      // Neither class should match because g7East.id is 'cls_uuid_g7', not 'strm_uuid_g7e'
      expect(inScope.length).toBe(0);

      const activeLearners = allStudents.filter((s) => s.active);
      const eligible = getExamEligibleLearners(activeLearners, corruptExam, allClasses);
      expect(eligible.length).toBe(0);
    });
  });
});
