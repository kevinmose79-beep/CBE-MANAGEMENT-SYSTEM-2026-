import { describe, it, expect } from 'vitest';
import {
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  ClassStream,
  Teacher,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
  getShortCbeCode,
} from '../types';
import { calculateExamResults, getLearnerReportSubjects, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { sortSubjectsByStandardOrder } from '../services/meritListExporter';
import { getFilteredStudents } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';

describe('CBE Merit List Rendering Resolution & Calculation Audit', () => {
  const mockClasses: ClassStream[] = [
    {
      id: 'class_g9_a',
      class_name: 'Grade 9',
      stream: 'North',
      stream_id: 'stream_g9_north',
      education_level: 'Junior School',
    },
    {
      id: 'class_g9_b',
      class_name: 'Grade 9',
      stream: 'South',
      stream_id: 'stream_g9_south',
      education_level: 'Junior School',
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub_math', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_kisw', subject_code: 'KISW', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_sci', subject_code: 'INT-SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_agri', subject_code: 'AGRI', subject_name: 'Agriculture and Nutrition', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_pretech', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_cre', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_ss', subject_code: 'SS', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
    { id: 'sub_ca', subject_code: 'CA', subject_name: 'Creative Arts and Sports', education_level: 'Junior School', category: 'Core', applicable_grades: ['Grade 9'] },
  ];

  const mockGrades: Grade[] = CBE_8_POINT_GRADES;

  const mockExam: Examination = {
    id: 'exam_term1_2026',
    exam_name: 'Term 1 End Term Assessment',
    exam_type: 'End-Term',
    term: 'Term 1',
    year: 2026,
    max_marks: 100,
    status: 'Approved',
    approved_levels: ['Junior School'],
  };

  const mockStudents: Student[] = [
    { id: 'std_1', admission_number: 'ADM001', full_name: 'Learner One (North)', grade: 'Grade 9', class_id: 'class_g9_a', gender: 'F', active: true },
    { id: 'std_2', admission_number: 'ADM002', full_name: 'Learner Two (North)', grade: 'Grade 9', class_id: 'class_g9_a', gender: 'M', active: true },
    { id: 'std_3', admission_number: 'ADM003', full_name: 'Learner Three (South)', grade: 'Grade 9', class_id: 'class_g9_b', gender: 'F', active: true },
    { id: 'std_unassessed', admission_number: 'ADM004', full_name: 'Learner Unassessed (South)', grade: 'Grade 9', class_id: 'class_g9_b', gender: 'M', active: true },
  ];

  const mockMarks: Mark[] = [
    // std_1 marks (all 9 subjects)
    ...mockSubjects.map((s) => ({
      id: `mark_std1_${s.id}`,
      exam_id: 'exam_term1_2026',
      student_id: 'std_1',
      subject_id: s.id,
      score: 80,
    })),
    // std_2 marks (all 9 subjects)
    ...mockSubjects.map((s) => ({
      id: `mark_std2_${s.id}`,
      exam_id: 'exam_term1_2026',
      student_id: 'std_2',
      subject_id: s.id,
      score: 65,
    })),
    // std_3 marks (all 9 subjects)
    ...mockSubjects.map((s) => ({
      id: `mark_std3_${s.id}`,
      exam_id: 'exam_term1_2026',
      student_id: 'std_3',
      subject_id: s.id,
      score: 55,
    })),
  ];

  /**
   * Helper duplicating the robust resolution logic in CbeMeritListReport.tsx
   */
  function resolveCohortAndSubjects({
    selectedClassId,
    selectedStreamId,
    classes,
    students,
    subjects,
    teachers,
    exam,
  }: {
    selectedClassId?: string;
    selectedStreamId?: string;
    classes: ClassStream[];
    students: Student[];
    subjects: Subject[];
    teachers: Teacher[];
    exam: Examination;
  }) {
    const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);
    const firstTargetStudent = targetStudents[0];
    const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;

    let targetClass: ClassStream | undefined = undefined;
    if (selectedStreamId && selectedStreamId !== 'all') {
      targetClass = classes.find(
        (c) => (c.stream_id && c.stream_id === selectedStreamId) || c.id === selectedStreamId
      );
    }
    if (!targetClass && selectedClassId && selectedClassId !== 'all') {
      targetClass = classes.find(
        (c) =>
          c.id === selectedClassId ||
          (c.stream_id && c.stream_id === selectedClassId) ||
          (c.class_name && c.class_name.toLowerCase() === selectedClassId.toLowerCase())
      );
    }
    if (!targetClass) {
      const fallbackClassId = firstHistCtx?.class_id || firstTargetStudent?.class_id;
      if (fallbackClassId) {
        targetClass = classes.find((c) => c.id === fallbackClassId);
      }
      if (!targetClass && firstHistCtx?.class_name) {
        targetClass = classes.find(
          (c) => c.class_name && c.class_name.toLowerCase() === firstHistCtx.class_name.toLowerCase()
        );
      }
    }

    const targetGrade =
      targetClass?.class_name ||
      (selectedClassId && selectedClassId !== 'all' && selectedClassId.startsWith('Grade') ? selectedClassId : '') ||
      firstHistCtx?.class_name ||
      firstHistCtx?.grade ||
      firstTargetStudent?.grade ||
      '';

    let rawActiveSubjects = targetClass
      ? getLearnerReportSubjects(firstTargetStudent || ({} as any), targetClass, subjects, teachers)
      : [];
    if (rawActiveSubjects.length === 0 && targetGrade) {
      rawActiveSubjects = getApplicableSubjectsForGrade(targetGrade, subjects);
    }
    const activeSubjects = sortSubjectsByStandardOrder(rawActiveSubjects);
    const eduLevel = targetClass?.education_level || getEducationLevelForGrade(targetGrade);

    return { targetStudents, targetClass, targetGrade, activeSubjects, eduLevel };
  }

  function findStudentMark(
    studentIdOrObj: string | Student | undefined,
    subject: Subject | undefined,
    examIdToMatch: string,
    marks: Mark[],
    students: Student[],
    subjects: Subject[],
    eduLevel: string
  ): Mark | undefined {
    if (!subject || !examIdToMatch) return undefined;
    const stdObj = typeof studentIdOrObj === 'object' && studentIdOrObj ? studentIdOrObj : students.find((s) => s.id === studentIdOrObj);
    const stdId = typeof studentIdOrObj === 'string' ? studentIdOrObj : stdObj?.id;
    const admNo = stdObj?.admission_number;
    const stdCode = (stdObj as any)?.student_code;

    return marks.find((m) => {
      if (String(m.exam_id) !== String(examIdToMatch)) return false;
      const mStdId = String(m.student_id);
      const matchesStudent =
        (stdId && mStdId === String(stdId)) ||
        (admNo && mStdId === String(admNo)) ||
        (stdCode && mStdId === String(stdCode));
      if (!matchesStudent) return false;

      const mSubId = String(m.subject_id);
      const matchesSubject =
        mSubId === String(subject.id) ||
        (subject.subject_code && mSubId === String(subject.subject_code)) ||
        (subject.subject_code && getShortCbeCode(mSubId, '', eduLevel) === getShortCbeCode(subject.subject_code, subject.subject_name, eduLevel)) ||
        (subject.subject_name && mSubId.toLowerCase() === subject.subject_name.toLowerCase()) ||
        subjects.some((s) => s.id === m.subject_id && (s.id === subject.id || (s.subject_code && subject.subject_code && getShortCbeCode(s.subject_code, s.subject_name, eduLevel) === getShortCbeCode(subject.subject_code, subject.subject_name, eduLevel))));

      return matchesSubject;
    });
  }

  it('1. Grade 9 class-level selection resolves 9 active subjects and correctly renders assessed rows', () => {
    const { targetStudents, targetGrade, activeSubjects, eduLevel } = resolveCohortAndSubjects({
      selectedClassId: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      teachers: [],
      exam: mockExam,
    });

    expect(targetGrade).toBe('Grade 9');
    expect(eduLevel).toBe('Junior School');
    expect(activeSubjects.length).toBe(9);
    expect(targetStudents.length).toBe(4);

    const results = calculateExamResults(mockExam.id, targetStudents, mockMarks, mockGrades, mockClasses, activeSubjects);
    expect(results.length).toBe(4);

    // std_1 check
    const r1 = results.find((r) => r.student_id === 'std_1')!;
    expect(r1).toBeDefined();
    expect(r1.total_marks).toBe(720); // 9 * 80
    expect(r1.average).toBe(80);
    expect(r1.performance_level).toBe('EE');

    const subEntryCount1 = activeSubjects.filter((sb) => {
      const stdMark = findStudentMark('std_1', sb, mockExam.id, mockMarks, mockStudents, mockSubjects, eduLevel);
      const markInfo = evaluateMark(stdMark, { subject: sb, educationLevel: eduLevel });
      return markInfo.status === 'Normal' && markInfo.percentage !== null;
    }).length;
    expect(subEntryCount1).toBe(9);

    const isAssessed1 = (r1.subject_count || 0) > 0 || subEntryCount1 > 0;
    expect(isAssessed1).toBe(true);
  });

  it('2. Stream-specific filtering (North stream) selects only North stream learners and retains calculation metrics', () => {
    const { targetStudents, activeSubjects, eduLevel } = resolveCohortAndSubjects({
      selectedClassId: 'Grade 9',
      selectedStreamId: 'stream_g9_north',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      teachers: [],
      exam: mockExam,
    });

    expect(targetStudents.length).toBe(2);
    expect(targetStudents.map((s) => s.id)).toEqual(['std_1', 'std_2']);
    expect(activeSubjects.length).toBe(9);

    const results = calculateExamResults(mockExam.id, targetStudents, mockMarks, mockGrades, mockClasses, activeSubjects);
    expect(results.length).toBe(2);

    const r2 = results.find((r) => r.student_id === 'std_2')!;
    expect(r2.total_marks).toBe(585); // 9 * 65
    expect(r2.average).toBe(65);
    expect(r2.performance_level).toBe('ME');
  });

  it('3. Unassessed learner displays "-" without crashing cohort calculations or corrupting assessed rows', () => {
    const { targetStudents, activeSubjects, eduLevel } = resolveCohortAndSubjects({
      selectedClassId: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      teachers: [],
      exam: mockExam,
    });

    const results = calculateExamResults(mockExam.id, targetStudents, mockMarks, mockGrades, mockClasses, activeSubjects);
    const unassessedR = results.find((r) => r.student_id === 'std_unassessed')!;
    expect(unassessedR).toBeDefined();

    const subEntryCount = activeSubjects.filter((sb) => {
      const stdMark = findStudentMark('std_unassessed', sb, mockExam.id, mockMarks, mockStudents, mockSubjects, eduLevel);
      const markInfo = evaluateMark(stdMark, { subject: sb, educationLevel: eduLevel });
      return markInfo.status === 'Normal' && markInfo.percentage !== null;
    }).length;
    expect(subEntryCount).toBe(0);

    const isAssessed = (unassessedR.subject_count || 0) > 0 || subEntryCount > 0;
    expect(isAssessed).toBe(false);

    // Unassessed display values
    const entryDisplay = isAssessed ? (subEntryCount > 0 ? subEntryCount : (unassessedR.subject_count || 0)) : '-';
    const totalDisplay = isAssessed ? Math.round(unassessedR.total_marks) : '-';
    const avgDisplay = isAssessed ? unassessedR.average : '-';
    const totalPtsDisplay = isAssessed ? unassessedR.total_points : '-';
    const cbeLevelDisplay = isAssessed ? 'EE' : '-';

    expect(entryDisplay).toBe('-');
    expect(totalDisplay).toBe('-');
    expect(avgDisplay).toBe('-');
    expect(totalPtsDisplay).toBe('-');
    expect(cbeLevelDisplay).toBe('-');
  });
});
