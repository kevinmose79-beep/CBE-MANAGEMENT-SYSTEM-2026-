import { describe, it, expect } from 'vitest';
import {
  isClassInExamScope,
  isLearnerInExamScope,
  resolveAuthoritativeClass,
  getFilteredStudents,
} from '../utils/filterUtils';
import { ClassStream, Examination, Student, EducationLevel, ALL_EDUCATION_LEVELS, getEducationLevelForGrade } from '../types';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';

describe('Phase 3C — Assessment Analyser Scope Integrity & Entity Selection Integrity', () => {
  // Test Fixtures: Distinct classes across levels
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

  const inactiveG7: ClassStream = {
    id: 'cls_uuid_g7_inactive',
    stream_id: 'strm_uuid_g7_inact',
    class_name: 'Grade 7',
    stream: 'South',
    education_level: 'Junior School',
    status: 'Inactive',
  };

  const imposterG7: ClassStream = {
    id: 'cls_uuid_imposter_g7',
    stream_id: 'strm_uuid_imposter_east',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const allClasses: ClassStream[] = [g1East, g4North, g7East, g7West, g8East, inactiveG7];

  // Students
  const s1: Student = {
    id: '00000000-0000-0000-0000-000000000001',
    admission_number: 'ADM-001',
      full_name: 'Alice', first_name: 'Alice',
    last_name: 'One',
    gender: 'F',
    class_id: 'cls_uuid_g1',
    stream_id: 'strm_uuid_g1e',
    active: true,
  };

  const s4: Student = {
    id: '00000000-0000-0000-0000-000000000004',
    admission_number: 'ADM-004',
      full_name: 'Bob', first_name: 'Bob',
    last_name: 'Four',
    gender: 'M',
    class_id: 'cls_uuid_g4',
    stream_id: 'strm_uuid_g4n',
    active: true,
  };

  const s7e: Student = {
    id: '00000000-0000-0000-0000-000000000007',
    admission_number: 'ADM-007',
      full_name: 'Charlie', first_name: 'Charlie',
    last_name: 'Seven',
    gender: 'M',
    class_id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7e',
    active: true,
  };

  const s7w: Student = {
    id: '00000000-0000-0000-0000-000000000008',
    admission_number: 'ADM-008',
      full_name: 'David', first_name: 'David',
    last_name: 'Eight',
    gender: 'M',
    class_id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7w',
    active: true,
  };

  const s7Inactive: Student = {
    id: '00000000-0000-0000-0000-000000000009',
    admission_number: 'ADM-009',
      full_name: 'Eve', first_name: 'Eve',
    last_name: 'Nine',
    gender: 'F',
    class_id: 'cls_uuid_g7',
    stream_id: 'strm_uuid_g7e',
    active: false,
  };

  const allStudents: Student[] = [s1, s4, s7e, s7w, s7Inactive];

  // Helper simulating Analyser's inScopeClasses logic
  function computeInScopeClasses(activeExam: Examination | null, availableClasses: ClassStream[]) {
    const baseList = (availableClasses || []).filter((c) => c.status !== 'Inactive');
    if (!activeExam) return baseList;
    return baseList.filter((c) => isClassInExamScope(c, activeExam));
  }

  // Helper simulating Analyser's availableLevels logic
  function computeAvailableLevels(activeExam: Examination | null, inScopeClasses: ClassStream[]) {
    if (!activeExam) return ALL_EDUCATION_LEVELS;
    if (activeExam.education_level) {
      return [activeExam.education_level as EducationLevel];
    }
    if (activeExam.class_id && activeExam.class_id !== 'all') {
      const target = allClasses.find((c) => c.id === activeExam.class_id);
      if (target) {
        const lvl = target.education_level || getEducationLevelForGrade(target.class_name);
        if (lvl) return [lvl as EducationLevel];
      }
    }
    const levelSet = new Set<EducationLevel>();
    inScopeClasses.forEach((c) => {
      const lvl = c.education_level || getEducationLevelForGrade(c.class_name);
      if (lvl) levelSet.add(lvl as EducationLevel);
    });
    const presentLevels = ALL_EDUCATION_LEVELS.filter((l) => levelSet.has(l));
    return presentLevels.length > 0 ? presentLevels : ALL_EDUCATION_LEVELS;
  }

  // Helper simulating Analyser's selectedStudents logic
  function computeSelectedStudents(
    selectedClassId: string,
    selectedStreamId: string,
    activeExam: Examination | null,
    inScopeClasses: ClassStream[],
    students: Student[],
    classes: ClassStream[]
  ) {
    const res = resolveAuthoritativeClass(selectedClassId, inScopeClasses);
    if (!selectedClassId || res.status !== 'resolved') return [];
    const lookupClass = res.className || selectedClassId;
    const filtered = getFilteredStudents(students, classes, lookupClass, selectedStreamId, activeExam);
    return filtered.filter((std) => {
      if (std.active === false) return false;
      if (!activeExam) return true;
      const context = getLearnerClassAtExamTime(std, activeExam, classes);
      return isLearnerInExamScope(context, activeExam, classes);
    });
  }

  describe('1. School-Wide Assessment', () => {
    const schoolWideExam: Examination = {
      id: 'exam_sw_1',
      exam_name: 'School-Wide Assessment Term 1',
      term: 'Term 1',
      year: 2026,
      exam_type: 'End-Term',
      status: 'Published', max_marks: 100,
      education_level: null,
      class_id: null,
    };

    it('includes all active classes across levels in inScopeClasses', () => {
      const inScope = computeInScopeClasses(schoolWideExam, allClasses);
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g1');
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g4');
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g7');
      expect(inScope.map((c) => c.id)).toContain('cls_uuid_g8');
      expect(inScope.map((c) => c.id)).not.toContain('cls_uuid_g7_inactive');
    });

    it('computes availableLevels containing all levels present in active classes', () => {
      const inScope = computeInScopeClasses(schoolWideExam, allClasses);
      const levels = computeAvailableLevels(schoolWideExam, inScope);
      expect(levels).toContain('Lower Primary');
      expect(levels).toContain('Upper Primary');
      expect(levels).toContain('Junior School');
    });

    it('populates selectedStudents for Grade 7 East correctly', () => {
      const inScope = computeInScopeClasses(schoolWideExam, allClasses);
      const students = computeSelectedStudents('cls_uuid_g7', 'strm_uuid_g7e', schoolWideExam, inScope, allStudents, allClasses);
      expect(students).toHaveLength(1);
      expect(students[0].id).toBe(s7e.id);
      expect(students[0].first_name).toBe('Charlie');
    });
  });

  describe('2. Level-Wide Assessment (Junior School)', () => {
    const juniorSchoolExam: Examination = {
      id: 'exam_js_1',
      exam_name: 'Junior School Mid-Term',
      term: 'Term 1',
      year: 2026,
      exam_type: 'Mid-Term',
      status: 'Published', max_marks: 100,
      education_level: 'Junior School',
      class_id: null,
    };

    it('restricts availableLevels to strictly Junior School', () => {
      const inScope = computeInScopeClasses(juniorSchoolExam, allClasses);
      const levels = computeAvailableLevels(juniorSchoolExam, inScope);
      expect(levels).toEqual(['Junior School']);
    });

    it('excludes Lower and Upper Primary classes from inScopeClasses', () => {
      const inScope = computeInScopeClasses(juniorSchoolExam, allClasses);
      const classIds = inScope.map((c) => c.id);
      expect(classIds).toContain('cls_uuid_g7');
      expect(classIds).toContain('cls_uuid_g8');
      expect(classIds).not.toContain('cls_uuid_g1');
      expect(classIds).not.toContain('cls_uuid_g4');
    });

    it('fails closed when an out-of-level class (Grade 1) is selected', () => {
      const inScope = computeInScopeClasses(juniorSchoolExam, allClasses);
      const res = resolveAuthoritativeClass('cls_uuid_g1', inScope);
      expect(res.status).toBe('not_found');
      const students = computeSelectedStudents('cls_uuid_g1', '', juniorSchoolExam, inScope, allStudents, allClasses);
      expect(students).toHaveLength(0);
    });

    it('correctly scopes learners within Junior School (Grade 7 all streams)', () => {
      const inScope = computeInScopeClasses(juniorSchoolExam, allClasses);
      const students = computeSelectedStudents('cls_uuid_g7', 'all', juniorSchoolExam, inScope, allStudents, allClasses);
      expect(students).toHaveLength(2);
      expect(students.map((s) => s.id)).toEqual(expect.arrayContaining([s7e.id, s7w.id]));
      expect(students.map((s) => s.id)).not.toContain(s7Inactive.id);
    });
  });

  describe('3. Grade/Class-Wide Assessment (Grade 7)', () => {
    const grade7Exam: Examination = {
      id: 'exam_g7_1',
      exam_name: 'Grade 7 CAT 1',
      term: 'Term 1',
      year: 2026,
      exam_type: 'CAT',
      status: 'Published', max_marks: 100,
      education_level: 'Junior School',
      class_id: 'cls_uuid_g7',
    };

    it('restricts inScopeClasses exclusively to Grade 7 streams', () => {
      const inScope = computeInScopeClasses(grade7Exam, allClasses);
      const classIds = inScope.map((c) => c.id);
      expect(classIds).toContain('cls_uuid_g7');
      expect(classIds).not.toContain('cls_uuid_g8');
      expect(classIds).not.toContain('cls_uuid_g1');
    });

    it('rejects an imposter class sharing name "Grade 7" but with different UUID', () => {
      const classesWithImposter = [...allClasses, imposterG7];
      const inScope = computeInScopeClasses(grade7Exam, classesWithImposter);
      expect(inScope.map((c) => c.id)).not.toContain('cls_uuid_imposter_g7');

      // Attempting to resolve imposter UUID against inScopeClasses fails closed
      const res = resolveAuthoritativeClass('cls_uuid_imposter_g7', inScope);
      expect(res.status).toBe('not_found');
    });

    it('resolves Grade 7 authoritatively by UUID', () => {
      const inScope = computeInScopeClasses(grade7Exam, allClasses);
      const res = resolveAuthoritativeClass('cls_uuid_g7', inScope);
      expect(res.status).toBe('resolved');
      expect(res.classId).toBe('cls_uuid_g7');
      expect(res.className).toBe('Grade 7');
    });

    it('filters students strictly for Grade 7 West stream', () => {
      const inScope = computeInScopeClasses(grade7Exam, allClasses);
      const students = computeSelectedStudents('cls_uuid_g7', 'strm_uuid_g7w', grade7Exam, inScope, allStudents, allClasses);
      expect(students).toHaveLength(1);
      expect(students[0].id).toBe(s7w.id);
      expect(students[0].first_name).toBe('David');
    });
  });

  describe('4. Entity Selection Invalidation & Fail-Closed Safety', () => {
    it('invalidates class when switching from School-Wide to Grade 7 exam if Grade 1 was selected', () => {
      const grade7Exam: Examination = {
        id: 'exam_g7_1',
        exam_name: 'Grade 7 CAT 1',
        term: 'Term 1',
        year: 2026,
        exam_type: 'CAT',
        status: 'Published', max_marks: 100,
        education_level: 'Junior School',
        class_id: 'cls_uuid_g7',
      };

      const inScope = computeInScopeClasses(grade7Exam, allClasses);
      const res = resolveAuthoritativeClass('cls_uuid_g1', inScope);
      expect(res.status).toBe('not_found');
    });

    it('invalidates stream when streamId does not match available streams of resolved class', () => {
      const inScope = computeInScopeClasses(null, allClasses);
      const res = resolveAuthoritativeClass('cls_uuid_g7', inScope);
      expect(res.status).toBe('resolved');

      const matchingStreams = inScope.filter((c) => c.id === res.classId);
      const streamMap = new Map<string, ClassStream>();
      matchingStreams.forEach((c) => {
        const sKey = c.stream ? c.stream.trim() : 'General';
        if (!streamMap.has(sKey)) streamMap.set(sKey, c);
      });
      const availableStreams = Array.from(streamMap.values());

      // Foreign stream from Grade 4
      const foreignStreamId = 'strm_uuid_g4n';
      const isStreamValid = availableStreams.some((c) => c.stream_id === foreignStreamId || c.id === foreignStreamId);
      expect(isStreamValid).toBe(false);
    });
  });
});
