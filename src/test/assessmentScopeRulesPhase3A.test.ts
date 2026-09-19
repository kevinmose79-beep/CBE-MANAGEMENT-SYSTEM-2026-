import { describe, it, expect } from 'vitest';
import { isClassInExamScope, isLearnerInExamScope } from '../utils/filterUtils';
import { ClassStream, Examination } from '../types';
import { LearnerExamContext } from '../services/historicalContextResolver';

describe('Phase 3A Assessment Scope Rules', () => {
  // Test Fixtures
  const g7EastClass: ClassStream = {
    id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7e',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const g7WestClass: ClassStream = {
    id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7w',
    class_name: 'Grade 7',
    stream: 'West',
    education_level: 'Junior School',
    status: 'Active',
  };

  const g8EastClass: ClassStream = {
    id: 'cls_uuid_g8',
    stream_id: 'strm_uuid_g8e',
    class_name: 'Grade 8',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const g6Class: ClassStream = {
    id: 'cls_uuid_g6',
    stream_id: 'strm_uuid_g6',
    class_name: 'Grade 6',
    stream: 'Main',
    education_level: 'Upper Primary',
    status: 'Active',
  };

  const imposterG7Class: ClassStream = {
    id: 'cls_uuid_imposter_g7',
    stream_id: 'strm_uuid_imposter',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const allClasses = [g7EastClass, g7WestClass, g8EastClass, g6Class, imposterG7Class];

  // Examinations
  const schoolWideExam: Examination = {
    id: 'exam_school_wide',
    exam_name: 'End of Term 1 School Wide',
    education_level: null as any,
    class_id: null as any,
    term: 'Term 1',
    year: 2025,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 50,
  };

  const levelWideExam: Examination = {
    id: 'exam_level_wide',
    exam_name: 'Junior School Assessment',
    education_level: 'Junior School',
    class_id: null as any,
    term: 'Term 1',
    year: 2025,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 50,
  };

  const classWideExam: Examination = {
    id: 'exam_class_wide',
    exam_name: 'Grade 7 Mid Term Assessment',
    education_level: 'Junior School',
    class_id: 'cls_uuid_g7',
    term: 'Term 1',
    year: 2025,
    status: 'Published',
    exam_type: 'Mid-Term',
    max_marks: 50,
  };

  // --- CLASS SCOPE TESTS ---

  describe('Class Scope Rules (isClassInExamScope)', () => {
    it('1. School-Wide accepts an eligible class', () => {
      expect(isClassInExamScope(g7EastClass, schoolWideExam)).toBe(true);
      expect(isClassInExamScope(g6Class, schoolWideExam)).toBe(true);
      expect(isClassInExamScope(g7EastClass, null)).toBe(true);
      expect(isClassInExamScope(g7EastClass, undefined)).toBe(true);
    });

    it('2. Level-Wide accepts a class in the target education level', () => {
      expect(isClassInExamScope(g7EastClass, levelWideExam)).toBe(true);
      expect(isClassInExamScope(g8EastClass, levelWideExam)).toBe(true);
    });

    it('3. Level-Wide rejects a class from another education level', () => {
      expect(isClassInExamScope(g6Class, levelWideExam)).toBe(false);
    });

    it('4. Grade/Class-Wide accepts the exact target class UUID', () => {
      // Both streams of Grade 7 share the same parent class ID (cls_uuid_g7)
      expect(isClassInExamScope(g7EastClass, classWideExam)).toBe(true);
      expect(isClassInExamScope(g7WestClass, classWideExam)).toBe(true);
    });

    it('5. Grade/Class-Wide rejects another class UUID', () => {
      expect(isClassInExamScope(g8EastClass, classWideExam)).toBe(false);
      expect(isClassInExamScope(g6Class, classWideExam)).toBe(false);
    });

    it('6. An imposter class with the same display name but a different UUID is rejected', () => {
      expect(isClassInExamScope(imposterG7Class, classWideExam)).toBe(false);
    });

    it('7. A Stream UUID cannot satisfy a Class UUID comparison', () => {
      // If an exam has class_id pointing to a stream UUID, comparing classStream.id against it returns false
      const invalidStreamTargetExam: Examination = {
        id: 'exam_corrupt',
        exam_name: 'Corrupt Stream Target',
        education_level: 'Junior School',
        class_id: 'strm_uuid_g7e', // Stream UUID incorrectly passed as class_id
        term: 'Term 1',
        year: 2025,
        status: 'Published',
        exam_type: 'Mid-Term',
        max_marks: 50,
      };
      expect(isClassInExamScope(g7EastClass, invalidStreamTargetExam)).toBe(false);
    });

    it('8. Missing/orphaned target class fails closed', () => {
      const orphanedExam: Examination = {
        id: 'exam_orphaned',
        exam_name: 'Orphaned Target',
        education_level: 'Junior School',
        class_id: 'non_existent_uuid',
        term: 'Term 1',
        year: 2025,
        status: 'Published',
        exam_type: 'Mid-Term',
        max_marks: 50,
      };
      expect(isClassInExamScope(g7EastClass, orphanedExam)).toBe(false);
      expect(isClassInExamScope(g8EastClass, orphanedExam)).toBe(false);
    });
  });

  // --- LEARNER SCOPE TESTS ---

  describe('Learner Scope Rules (isLearnerInExamScope)', () => {
    const learnerG7Context: LearnerExamContext = {
      class_id: 'cls_uuid_g7',
      stream_id: 'strm_uuid_g7e',
      grade: 'Grade 7',
      class_name: 'Grade 7',
      stream_name: 'East',
      full_class_name: 'Grade 7 East',
      is_historical: true,
      historical_context_resolved: true,
      resolution_source: 'promotion_history_date',
    };

    const learnerG8Context: LearnerExamContext = {
      class_id: 'cls_uuid_g8',
      stream_id: 'strm_uuid_g8e',
      grade: 'Grade 8',
      class_name: 'Grade 8',
      stream_name: 'East',
      full_class_name: 'Grade 8 East',
      is_historical: false,
      historical_context_resolved: true,
      resolution_source: 'live_current',
    };

    const learnerG6Context: LearnerExamContext = {
      class_id: 'cls_uuid_g6',
      stream_id: 'strm_uuid_g6',
      grade: 'Grade 6',
      class_name: 'Grade 6',
      stream_name: 'Main',
      full_class_name: 'Grade 6',
      is_historical: false,
      historical_context_resolved: true,
      resolution_source: 'live_current',
    };

    const learnerImposterG7Context: LearnerExamContext = {
      class_id: 'cls_uuid_imposter_g7',
      stream_id: 'strm_uuid_imposter',
      grade: 'Grade 7',
      class_name: 'Grade 7',
      stream_name: 'East',
      full_class_name: 'Grade 7 East',
      is_historical: false,
      historical_context_resolved: true,
      resolution_source: 'live_current',
    };

    it('9. School-Wide behaviour remains valid', () => {
      expect(isLearnerInExamScope(learnerG7Context, schoolWideExam, allClasses)).toBe(true);
      expect(isLearnerInExamScope(learnerG8Context, schoolWideExam, allClasses)).toBe(true);
      expect(isLearnerInExamScope(learnerG6Context, schoolWideExam, allClasses)).toBe(true);
      expect(isLearnerInExamScope(learnerG7Context, null, allClasses)).toBe(true);
    });

    it('10. Level-Wide accepts a learner whose resolved class belongs to the target education level', () => {
      expect(isLearnerInExamScope(learnerG7Context, levelWideExam, allClasses)).toBe(true);
      expect(isLearnerInExamScope(learnerG8Context, levelWideExam, allClasses)).toBe(true);
    });

    it('11. Level-Wide rejects a learner whose resolved class belongs to another education level', () => {
      expect(isLearnerInExamScope(learnerG6Context, levelWideExam, allClasses)).toBe(false);
    });

    it('12. Grade/Class-Wide accepts a learner whose context.class_id equals exam.class_id', () => {
      expect(isLearnerInExamScope(learnerG7Context, classWideExam, allClasses)).toBe(true);
    });

    it('13. Grade/Class-Wide rejects a learner whose context.class_id differs', () => {
      expect(isLearnerInExamScope(learnerG8Context, classWideExam, allClasses)).toBe(false);
      expect(isLearnerInExamScope(learnerG6Context, classWideExam, allClasses)).toBe(false);
    });

    it('14. A learner with a matching stream UUID but non-matching class UUID is rejected', () => {
      const learnerMismatch: LearnerExamContext = {
        class_id: 'cls_uuid_g8',
        stream_id: 'cls_uuid_g7', // Stream ID happens to equal target exam.class_id
        grade: 'Grade 8',
        class_name: 'Grade 8',
        stream_name: 'East',
        full_class_name: 'Grade 8 East',
        is_historical: false,
        historical_context_resolved: true,
        resolution_source: 'live_current',
      };
      // Must be rejected because exam.class_id is a Class UUID, not a Stream UUID
      expect(isLearnerInExamScope(learnerMismatch, classWideExam, allClasses)).toBe(false);
    });

    it('15. Historical learner context is evaluated through the existing resolved LearnerExamContext', () => {
      // Historical learner who was in Grade 7 during 2024 is accepted for Grade 7 exam
      expect(learnerG7Context.is_historical).toBe(true);
      expect(isLearnerInExamScope(learnerG7Context, classWideExam, allClasses)).toBe(true);
    });
  });

  // --- INTEGRITY TESTS ---

  describe('Entity Selection Integrity', () => {
    it('16. Imposter learner context with matching name but different UUID is rejected', () => {
      const learnerImposter: LearnerExamContext = {
        class_id: 'cls_uuid_imposter_g7',
        stream_id: 'strm_uuid_imposter',
        grade: 'Grade 7',
        class_name: 'Grade 7',
        stream_name: 'East',
        full_class_name: 'Grade 7 East',
        is_historical: false,
        historical_context_resolved: true,
        resolution_source: 'live_current',
      };
      expect(isLearnerInExamScope(learnerImposter, classWideExam, allClasses)).toBe(false);
    });

    it('17. Missing context class_id on Class-Wide exam fails closed', () => {
      const emptyContext: LearnerExamContext = {
        class_id: '',
        stream_id: '',
        grade: '',
        class_name: '',
        stream_name: '',
        full_class_name: '',
        is_historical: false,
        historical_context_resolved: false,
        resolution_source: 'unresolved_historical',
      };
      expect(isLearnerInExamScope(emptyContext, classWideExam, allClasses)).toBe(false);
      expect(isLearnerInExamScope(emptyContext, levelWideExam, allClasses)).toBe(false);
    });

    it('18. Level-Wide falls back to getEducationLevelForGrade only when class record not in classes array', () => {
      const unlistedClassContext: LearnerExamContext = {
        class_id: 'unlisted_uuid',
        stream_id: 'unlisted_stream',
        grade: 'Grade 8',
        class_name: 'Grade 8',
        stream_name: 'North',
        full_class_name: 'Grade 8 North',
        is_historical: true,
        historical_context_resolved: true,
        resolution_source: 'promotion_history_year',
      };
      // Classes array does not contain 'unlisted_uuid', but class_name is 'Grade 8' (Junior School)
      expect(isLearnerInExamScope(unlistedClassContext, levelWideExam, allClasses)).toBe(true);

      const unlistedPrimaryContext: LearnerExamContext = {
        class_id: 'unlisted_p_uuid',
        stream_id: 'unlisted_stream_p',
        grade: 'Grade 2',
        class_name: 'Grade 2',
        stream_name: 'North',
        full_class_name: 'Grade 2 North',
        is_historical: true,
        historical_context_resolved: true,
        resolution_source: 'promotion_history_year',
      };
      expect(isLearnerInExamScope(unlistedPrimaryContext, levelWideExam, allClasses)).toBe(false);
    });
  });
});
