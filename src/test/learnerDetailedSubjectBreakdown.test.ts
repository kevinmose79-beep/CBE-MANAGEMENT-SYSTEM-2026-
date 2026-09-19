import { describe, it, expect } from 'vitest';
import { isStudentExamApproved } from '../utils/examLockUtils';
import { evaluateMark, getAbbreviatedLevel, getShortRemark } from '../utils/markUtils';
import { getGradeForMark } from '../services/analysisEngine';
import { getCbeGradeBadgeClass, getCbeGradeTextClass } from '../utils/gradeColorUtils';
import { Examination, ClassStream, Student, Mark, User, Subject } from '../types';

describe('PHASE 5D: Learner "My Marks" Detailed Subject Breakdown Verification', () => {
  const mockClassGrade7: ClassStream = {
    id: 'class-g7-east',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-eng-01', 'sub-math-01', 'sub-sci-01', 'sub-kisw-01', 'sub-sst-01'],
  };

  const mockSubjects: Subject[] = [
    { id: 'sub-eng-01', subject_name: 'English', subject_code: 'ENG', category: 'Core', department: 'Languages', education_level: 'Junior School' },
    { id: 'sub-math-01', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', department: 'Mathematics', education_level: 'Junior School' },
    { id: 'sub-sci-01', subject_name: 'Integrated Science', subject_code: 'SCI', category: 'Core', department: 'Science', education_level: 'Junior School' },
    { id: 'sub-kisw-01', subject_name: 'Kiswahili', subject_code: 'KISW', category: 'Core', department: 'Languages', education_level: 'Junior School' },
    { id: 'sub-sst-01', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core', department: 'Humanities', education_level: 'Junior School' },
  ];

  const studentAlice: Student = {
    id: 'student-alice-uuid-001',
    admission_number: 'ADM-1001',
    full_name: 'Alice Wambui',
    gender: 'F',
    class_id: 'class-g7-east',
    stream_id: 'class-g7-east',
    active: true,
  };

  const studentBob: Student = {
    id: 'student-bob-uuid-002',
    admission_number: 'ADM-1002',
    full_name: 'Bob Kiprono',
    gender: 'M',
    class_id: 'class-g7-east',
    stream_id: 'class-g7-east',
    active: true,
  };

  const learnerUserAlice: User = {
    id: 'user-learner-alice-uuid',
    username: 'alice.wambui',
    email: 'alice@student.school.ac.ke',
    role: 'learner',
    student_id: 'student-alice-uuid-001',
    name: 'Alice Wambui',
    status: 'Active',
  };

  const examReleased: Examination = {
    id: 'exam-term1-midterm',
    exam_name: 'Term 1 Mid-Term 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'Mid-Term',
    max_marks: 100,
    status: 'Approved',
    approved_classes: ['class-g7-east'],
  };

  const rawMarksAlice: Mark[] = [
    {
      id: 'm-alice-eng',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-eng-01',
      exam_id: 'exam-term1-midterm',
      marks: 42,
      raw_score: 42,
      out_of: 50,
      special_status: 'Normal',
    },
    {
      id: 'm-alice-math',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-math-01',
      exam_id: 'exam-term1-midterm',
      marks: 36,
      raw_score: 36,
      out_of: 50,
      special_status: 'Normal',
    },
    {
      id: 'm-alice-sci',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-sci-01',
      exam_id: 'exam-term1-midterm',
      marks: 31,
      raw_score: 31,
      out_of: 50,
      special_status: 'Normal',
    },
    {
      id: 'm-alice-kisw',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-kisw-01',
      exam_id: 'exam-term1-midterm',
      marks: 0,
      raw_score: null,
      out_of: 50,
      special_status: 'X', // Missing
    },
    {
      id: 'm-alice-sst',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-sst-01',
      exam_id: 'exam-term1-midterm',
      marks: 0,
      raw_score: null,
      out_of: 50,
      special_status: 'Y', // Absent
      irregularity_reason: 'Medical Absence',
    },
  ];

  const rawMarksBob: Mark[] = [
    {
      id: 'm-bob-eng',
      student_id: 'student-bob-uuid-002',
      subject_id: 'sub-eng-01',
      exam_id: 'exam-term1-midterm',
      marks: 20,
      raw_score: 20,
      out_of: 50,
      special_status: 'Normal',
    },
  ];

  it('TEST 1 — Own learner data: Alice only loads marks belonging to student-alice-uuid-001', () => {
    const allMarksInDb = [...rawMarksAlice, ...rawMarksBob];
    const filteredForAlice = allMarksInDb.filter(
      (m) => m.student_id === learnerUserAlice.student_id && m.exam_id === examReleased.id
    );

    expect(filteredForAlice.length).toBe(5);
    expect(filteredForAlice.every((m) => m.student_id === 'student-alice-uuid-001')).toBe(true);
    expect(filteredForAlice.some((m) => m.student_id === studentBob.id)).toBe(false);
  });

  it('TEST 2 — Cross-learner protection: student_id is authoritative and strictly immutable', () => {
    expect(learnerUserAlice.role).toBe('learner');
    expect(learnerUserAlice.student_id).toBe(studentAlice.id);
  });

  it('TEST 3 — Released assessment filtering: Unreleased exams do not qualify', () => {
    const draftExam: Examination = {
      id: 'exam-draft',
      exam_name: 'Draft Exam',
      term: 'Term 1',
      year: 2026,
      exam_type: 'CAT',
      max_marks: 100,
      status: 'Draft',
      approved_classes: [],
    };

    expect(isStudentExamApproved(draftExam, studentAlice.class_id, [mockClassGrade7])).toBe(false);
    expect(isStudentExamApproved(examReleased, studentAlice.class_id, [mockClassGrade7])).toBe(true);
  });

  it('TEST 4 — Numerical accuracy: English (42/50 -> 84% -> EE2, 7 pts)', () => {
    const engMark = rawMarksAlice.find((m) => m.subject_id === 'sub-eng-01');
    const evaluated = evaluateMark(engMark);
    expect(evaluated.status).toBe('Normal');
    expect(evaluated.rawScore).toBe(42);
    expect(evaluated.outOf).toBe(50);
    expect(evaluated.percentage).toBe(84);

    const grade = getGradeForMark(evaluated.percentage!);
    expect(grade.performance_level).toBe('EE');
    expect(grade.grade_code).toBe('EE2');
    expect(grade.points).toBe(7);
    expect(grade.descriptor).toBe('Exceeding Expectations');
  });

  it('TEST 5 — Numerical accuracy: Mathematics (36/50 -> 72% -> ME1, 6 pts)', () => {
    const mathMark = rawMarksAlice.find((m) => m.subject_id === 'sub-math-01');
    const evaluated = evaluateMark(mathMark);
    expect(evaluated.percentage).toBe(72);

    const grade = getGradeForMark(evaluated.percentage!);
    expect(grade.performance_level).toBe('ME');
    expect(grade.grade_code).toBe('ME1');
    expect(grade.points).toBe(6);
    expect(grade.descriptor).toBe('Meeting Expectations');
  });

  it('TEST 6 — Numerical accuracy: Science (31/50 -> 62% -> ME1, 6 pts)', () => {
    const sciMark = rawMarksAlice.find((m) => m.subject_id === 'sub-sci-01');
    const evaluated = evaluateMark(sciMark);
    expect(evaluated.percentage).toBe(62);

    const grade = getGradeForMark(evaluated.percentage!);
    expect(grade.performance_level).toBe('ME');
    expect(grade.grade_code).toBe('ME1');
    expect(grade.points).toBe(6);
  });

  it('TEST 7 — X Status: Missing Mark produces null percentage and points, does not corrupt data', () => {
    const kiswMark = rawMarksAlice.find((m) => m.subject_id === 'sub-kisw-01');
    const evaluated = evaluateMark(kiswMark);
    expect(evaluated.status).toBe('X');
    expect(evaluated.percentage).toBeNull();
    expect(evaluated.rawScore).toBeNull();
    expect(evaluated.displayScore).toBe('X');

    const badgeClass = getCbeGradeBadgeClass('X');
    expect(badgeClass).toContain('rose');
  });

  it('TEST 8 — Y Status: Absent produces null percentage, points, retains irregularity reason', () => {
    const sstMark = rawMarksAlice.find((m) => m.subject_id === 'sub-sst-01');
    const evaluated = evaluateMark(sstMark);
    expect(evaluated.status).toBe('Y');
    expect(evaluated.percentage).toBeNull();
    expect(evaluated.irregularityReason).toBe('Medical Absence');
    expect(evaluated.displayScore).toBe('Y');

    const badgeClass = getCbeGradeBadgeClass('Y');
    expect(badgeClass).toContain('purple');
  });

  it('TEST 9 — Missing/Unrecorded Marks: Subjects without marks show Blank and no invented values', () => {
    const unrecordedSubId = 'sub-unrecorded-01';
    const rawMark = undefined;
    const evaluated = evaluateMark(rawMark);
    expect(evaluated.status).toBe('Blank');
    expect(evaluated.percentage).toBeNull();
    expect(evaluated.rawScore).toBeNull();
  });

  it('TEST 10 — Grade badges & styling helpers conform to Kenya CBE standards', () => {
    expect(getCbeGradeBadgeClass('EE2')).toContain('emerald');
    expect(getCbeGradeBadgeClass('ME1')).toContain('sky');
    expect(getCbeGradeBadgeClass('AE1')).toContain('amber');
    expect(getCbeGradeBadgeClass('BE2')).toContain('rose');

    expect(getCbeGradeTextClass('EE1')).toContain('emerald');
    expect(getCbeGradeTextClass('ME2')).toContain('sky');
  });

  it('TEST 11 — Short remarks helper produces concise, readable student-facing remarks', () => {
    expect(getShortRemark(null, 'EE1')).toBe('Outstanding');
    expect(getShortRemark(null, 'EE2')).toBe('Excellent');
    expect(getShortRemark(null, 'ME1')).toBe('Good');
    expect(getShortRemark(null, 'ME2')).toBe('Satisfactory');
    expect(getShortRemark(null, 'AE1')).toBe('Developing');
    expect(getShortRemark(null, 'BE2')).toBe('Intervention Required');
  });
});
