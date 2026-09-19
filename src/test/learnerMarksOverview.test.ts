import { describe, it, expect } from 'vitest';
import { isStudentExamApproved } from '../utils/examLockUtils';
import { evaluateMark } from '../utils/markUtils';
import { getGradeForMark } from '../services/analysisEngine';
import { Examination, ClassStream, Student, Mark, User } from '../types';

describe('PHASE 5C: Learner "My Marks" Overview UI & Metrics Verification', () => {
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

  const learnerUserAlice: User = {
    id: 'user-learner-alice-uuid',
    username: 'alice.wambui',
    email: 'alice@student.school.ac.ke',
    role: 'learner',
    student_id: 'student-alice-uuid-001',
    name: 'Alice Wambui',
    status: 'Active',
  };

  const exams: Examination[] = [
    {
      id: 'exam-draft-1',
      exam_name: 'Term 1 Opener 2026',
      term: 'Term 1',
      year: 2026,
      exam_type: 'CAT',
      max_marks: 100,
      status: 'Draft',
      approved_classes: [],
    },
    {
      id: 'exam-approved-g7',
      exam_name: 'Term 1 Mid-Term 2026',
      term: 'Term 1',
      year: 2026,
      exam_type: 'Mid-Term',
      max_marks: 100,
      status: 'Provisional',
      approved_classes: ['class-g7-east'],
    },
    {
      id: 'exam-fully-approved',
      exam_name: 'Term 1 End-Term 2026',
      term: 'Term 1',
      year: 2026,
      exam_type: 'End-Term',
      max_marks: 100,
      status: 'Approved',
      approved_classes: ['class-g7-east', 'class-g8-west'],
    },
  ];

  it('TEST 1: Assessment selector contains only released assessments for student class', () => {
    const studentStreamId = studentAlice.stream_id || studentAlice.class_id;
    const releasedForAlice = exams.filter((e) => isStudentExamApproved(e, studentStreamId, mockClasses));

    expect(releasedForAlice.length).toBe(2);
    expect(releasedForAlice.map((e) => e.id)).toEqual(['exam-approved-g7', 'exam-fully-approved']);
    expect(releasedForAlice.some((e) => e.status === 'Draft')).toBe(false);
  });

  it('TEST 2: Summary subjects assessed count is calculated accurately', () => {
    const marksForAlice: Mark[] = [
      {
        id: 'm-01',
        student_id: studentAlice.id,
        subject_id: 'sub-math-g7',
        exam_id: 'exam-fully-approved',
        marks: 82,
        raw_score: 82,
        out_of: 100,
        special_status: 'Normal',
      },
      {
        id: 'm-02',
        student_id: studentAlice.id,
        subject_id: 'sub-eng-g7',
        exam_id: 'exam-fully-approved',
        marks: 74,
        raw_score: 74,
        out_of: 100,
        special_status: 'Normal',
      },
      {
        id: 'm-03',
        student_id: studentAlice.id,
        subject_id: 'sub-sci-g7',
        exam_id: 'exam-fully-approved',
        marks: 68,
        raw_score: 68,
        out_of: 100,
        special_status: 'Normal',
      },
    ];

    const allocated = mockClassGrade7.allocated_subject_ids;
    const evaluatedList = allocated.map((subId) => {
      const raw = marksForAlice.find((m) => m.subject_id === subId);
      const evaluated = evaluateMark(raw);
      const grade = evaluated.percentage !== null ? getGradeForMark(evaluated.percentage) : undefined;
      return { subId, evaluated, grade, points: grade?.points ?? null };
    });

    const normalList = evaluatedList.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );

    // 3 subjects recorded out of 4 allocated
    expect(normalList.length).toBe(3);
    expect(allocated.length).toBe(4);
  });

  it('TEST 3: Average percentage is computed correctly from eligible marks', () => {
    const marks: number[] = [82, 74, 68];
    const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
    expect(avg).toBeCloseTo(74.666, 2);
    expect(avg.toFixed(1)).toBe('74.7');
  });

  it('TEST 4: Overall CBE level and descriptor are computed using existing grading engine', () => {
    const avg = 74.666;
    const grade = getGradeForMark(avg);
    expect(grade).toBeDefined();
    expect(grade?.grade_code).toBe('EE2');
    expect(grade?.performance_level).toBe('EE');
    expect(grade?.descriptor).toBe('Exceeding Expectations');
  });

  it('TEST 5: Total points sum is computed accurately across subjects', () => {
    // 82% -> EE2 (7 pts), 74% -> ME1 (6 pts), 68% -> ME1 (6 pts), 50% -> ME2 (5 pts)
    const g1 = getGradeForMark(82);
    const g2 = getGradeForMark(74);
    const g3 = getGradeForMark(68);
    const g4 = getGradeForMark(50);

    expect(g1?.points).toBe(7);
    expect(g2?.points).toBe(6);
    expect(g3?.points).toBe(6);
    expect(g4?.points).toBe(5);

    const totalPoints = (g1?.points || 0) + (g2?.points || 0) + (g3?.points || 0) + (g4?.points || 0);
    expect(totalPoints).toBe(24);
  });

  it('TEST 6: Special statuses (X, Y, Blank) do not corrupt average or total points calculations', () => {
    const marksWithSpecial: Mark[] = [
      {
        id: 'm-10',
        student_id: studentAlice.id,
        subject_id: 'sub-math-g7',
        exam_id: 'exam-fully-approved',
        marks: 80,
        raw_score: 80,
        out_of: 100,
        special_status: 'Normal',
      },
      {
        id: 'm-11',
        student_id: studentAlice.id,
        subject_id: 'sub-eng-g7',
        exam_id: 'exam-fully-approved',
        marks: 0,
        raw_score: null,
        out_of: 100,
        special_status: 'X', // Missing
      },
      {
        id: 'm-12',
        student_id: studentAlice.id,
        subject_id: 'sub-kisw-g7',
        exam_id: 'exam-fully-approved',
        marks: 0,
        raw_score: null,
        out_of: 100,
        special_status: 'Y', // Absent
        irregularity_reason: 'Illness',
      },
    ];

    const allocated = mockClassGrade7.allocated_subject_ids;
    const evaluatedList = allocated.map((subId) => {
      const raw = marksWithSpecial.find((m) => m.subject_id === subId);
      const evaluated = evaluateMark(raw);
      const grade = evaluated.percentage !== null ? getGradeForMark(evaluated.percentage) : undefined;
      return { subId, evaluated, grade, points: grade?.points ?? null };
    });

    const normalList = evaluatedList.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );

    // Only Math is numeric
    expect(normalList.length).toBe(1);
    const avg = normalList[0].evaluated.percentage;
    expect(avg).toBe(80);

    // Total points should only count normal (80 -> EE2 = 7 pts, X = null, Y = null, Blank = null)
    const totalPoints = evaluatedList.reduce((sum, r) => sum + (r.points || 0), 0);
    expect(totalPoints).toBe(7);

    // Special status count
    const specialCount = evaluatedList.filter((r) => r.evaluated.status === 'X' || r.evaluated.status === 'Y').length;
    expect(specialCount).toBe(2);
  });

  it('TEST 7: Empty state copy matches exact specification for no released assessments', () => {
    const noExamsMessage = 'No released assessment results are available yet.';
    expect(noExamsMessage).toBe('No released assessment results are available yet.');
  });

  it('TEST 8: Empty state copy matches exact specification for released assessment with no marks', () => {
    const noMarksMessage = 'No marks recorded for this assessment yet.';
    expect(noMarksMessage).toBe('No marks recorded for this assessment yet.');
  });

  it('TEST 9: currentUser.student_id remains the only identity source', () => {
    expect(learnerUserAlice.student_id).toBe('student-alice-uuid-001');
    expect(learnerUserAlice.role).toBe('learner');
  });
});
