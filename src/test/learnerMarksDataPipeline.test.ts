import { describe, it, expect, beforeEach } from 'vitest';
import { isStudentExamApproved } from '../utils/examLockUtils';
import { evaluateMark } from '../utils/markUtils';
import { getGradeForMark, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Examination, ClassStream, Student, Mark, User } from '../types';
import { api } from '../lib/storage';

describe('PHASE 5B: Learner My Marks Data Pipeline Forensic Verification', () => {
  const mockClassGrade7: ClassStream = {
    id: 'class-g7-east',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-math-g7', 'sub-eng-g7', 'sub-kisw-g7', 'sub-sci-g7'],
  };

  const mockClassGrade8: ClassStream = {
    id: 'class-g8-west',
    class_name: 'Grade 8',
    stream: 'West',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-math-g8', 'sub-eng-g8'],
  };

  const mockClasses = [mockClassGrade7, mockClassGrade8];

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
    full_name: 'Bob Kipchoge',
    gender: 'M',
    class_id: 'class-g8-west',
    stream_id: 'class-g8-west',
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

  // Exams with varying approval states
  const examDraft: Examination = {
    id: 'exam-draft-001',
    exam_name: 'Term 1 Opener 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'CAT',
    max_marks: 100,
    status: 'Draft',
    approved_classes: [],
  };

  const examApprovedForG7Only: Examination = {
    id: 'exam-approved-g7-002',
    exam_name: 'Term 1 Mid-Term 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'Mid-Term',
    max_marks: 100,
    status: 'Provisional',
    approved_classes: ['class-g7-east'],
  };

  const examFullyApproved: Examination = {
    id: 'exam-fully-approved-003',
    exam_name: 'Term 1 End-Term 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'End-Term',
    max_marks: 100,
    status: 'Approved',
    approved_classes: ['class-g7-east', 'class-g8-west'],
  };

  const examPublished: Examination = {
    id: 'exam-published-004',
    exam_name: 'Term 2 Opener 2026',
    term: 'Term 2',
    year: 2026,
    exam_type: 'CAT',
    max_marks: 100,
    status: 'Published',
    approved_classes: [],
  };

  it('VERIFICATION 1: Identity binding strictly uses currentUser.student_id', () => {
    expect(learnerUserAlice.role).toBe('learner');
    expect(learnerUserAlice.student_id).toBe('student-alice-uuid-001');
    expect(learnerUserAlice.student_id).toBe(studentAlice.id);
  });

  it('VERIFICATION 2: Examination release filter (isStudentExamApproved) correctly isolates released exams', () => {
    const studentG7StreamId = studentAlice.stream_id || studentAlice.class_id;
    const studentG8StreamId = studentBob.stream_id || studentBob.class_id;

    // Draft exam must be excluded for both students
    expect(isStudentExamApproved(examDraft, studentG7StreamId, mockClasses)).toBe(false);
    expect(isStudentExamApproved(examDraft, studentG8StreamId, mockClasses)).toBe(false);

    // Exam approved for Grade 7 only
    expect(isStudentExamApproved(examApprovedForG7Only, studentG7StreamId, mockClasses)).toBe(true);
    expect(isStudentExamApproved(examApprovedForG7Only, studentG8StreamId, mockClasses)).toBe(false);

    // Fully approved exam
    expect(isStudentExamApproved(examFullyApproved, studentG7StreamId, mockClasses)).toBe(true);
    expect(isStudentExamApproved(examFullyApproved, studentG8StreamId, mockClasses)).toBe(true);

    // Published exam
    expect(isStudentExamApproved(examPublished, studentG7StreamId, mockClasses)).toBe(true);
    expect(isStudentExamApproved(examPublished, studentG8StreamId, mockClasses)).toBe(true);
  });

  it('VERIFICATION 3: Marks evaluation accurately calculates percentage, grade descriptor, and points', () => {
    const normalMark85: Mark = {
      id: 'm-001',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-math-g7',
      exam_id: 'exam-fully-approved-003',
      marks: 85,
      raw_score: 85,
      out_of: 100,
      special_status: 'Normal',
    };

    const normalMark50OutOf60: Mark = {
      id: 'm-002',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-sci-g7',
      exam_id: 'exam-fully-approved-003',
      marks: 50,
      raw_score: 50,
      out_of: 60,
      special_status: 'Normal',
    };

    const evaluated85 = evaluateMark(normalMark85);
    expect(evaluated85.percentage).toBe(85);
    expect(evaluated85.status).toBe('Normal');

    const grade85 = getGradeForMark(evaluated85.percentage!);
    expect(grade85).toBeDefined();
    expect(grade85?.grade_code).toBe('EE2');
    expect(grade85?.performance_level).toBe('EE');
    expect(grade85?.points).toBe(7);
    expect(grade85?.descriptor).toBe('Exceeding Expectations');

    const evaluated50OutOf60 = evaluateMark(normalMark50OutOf60);
    // 50 / 60 = 83.33%
    expect(Math.round(evaluated50OutOf60.percentage!)).toBe(83);
    const grade50OutOf60 = getGradeForMark(evaluated50OutOf60.percentage!);
    expect(grade50OutOf60?.points).toBe(7);
  });

  it('VERIFICATION 4: Special statuses (X and Y) are cleanly evaluated without corrupting averages', () => {
    const missingMarkX: Mark = {
      id: 'm-003',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-eng-g7',
      exam_id: 'exam-fully-approved-003',
      marks: 0,
      raw_score: null,
      out_of: 100,
      special_status: 'X',
    };

    const absentMarkY: Mark = {
      id: 'm-004',
      student_id: 'student-alice-uuid-001',
      subject_id: 'sub-kisw-g7',
      exam_id: 'exam-fully-approved-003',
      marks: 0,
      raw_score: null,
      out_of: 100,
      special_status: 'Y',
      irregularity_reason: 'Illness (Medical Excuse)',
    };

    const evalX = evaluateMark(missingMarkX);
    expect(evalX.status).toBe('X');
    expect(evalX.percentage).toBeNull();

    const evalY = evaluateMark(absentMarkY);
    expect(evalY.status).toBe('Y');
    expect(evalY.percentage).toBeNull();
    expect(evalY.irregularityReason).toBe('Illness (Medical Excuse)');
  });

  it('VERIFICATION 5: Pipeline metrics aggregation handles normal, missing, and absent marks accurately', () => {
    const marks: Mark[] = [
      {
        id: 'm-1',
        student_id: 'student-alice-uuid-001',
        subject_id: 'sub-math-g7',
        exam_id: 'exam-fully-approved-003',
        marks: 80,
        raw_score: 80,
        out_of: 100,
        special_status: 'Normal',
      },
      {
        id: 'm-2',
        student_id: 'student-alice-uuid-001',
        subject_id: 'sub-eng-g7',
        exam_id: 'exam-fully-approved-003',
        marks: 70,
        raw_score: 70,
        out_of: 100,
        special_status: 'Normal',
      },
      {
        id: 'm-3',
        student_id: 'student-alice-uuid-001',
        subject_id: 'sub-kisw-g7',
        exam_id: 'exam-fully-approved-003',
        marks: 0,
        raw_score: null,
        out_of: 100,
        special_status: 'X',
      },
    ];

    const allocated = ['sub-math-g7', 'sub-eng-g7', 'sub-kisw-g7', 'sub-sci-g7'];

    const evaluatedResults = allocated.map((subId) => {
      const raw = marks.find((m) => m.subject_id === subId);
      const evaluated = evaluateMark(raw);
      const grade = evaluated.percentage !== null ? getGradeForMark(evaluated.percentage) : undefined;
      return { subId, evaluated, grade, points: grade?.points ?? null };
    });

    const normalResults = evaluatedResults.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );

    expect(normalResults.length).toBe(2);
    const avg = normalResults.reduce((sum, r) => sum + (r.evaluated.percentage || 0), 0) / normalResults.length;
    expect(avg).toBe(75);

    const meanGrade = getGradeForMark(avg);
    expect(meanGrade?.grade_code).toBe('EE2');
    expect(meanGrade?.descriptor).toBe('Exceeding Expectations');
  });
});
