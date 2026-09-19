import { describe, it, expect } from 'vitest';
import { isStudentExamApproved } from '../utils/examLockUtils';
import { evaluateMark } from '../utils/markUtils';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Examination, ClassStream, Student, Mark, Subject } from '../types';

describe('PHASE 6: Learner Summative Report Card Rollout & Gate Verification', () => {
  const mockClassGrade7: ClassStream = {
    id: 'class-g7-east',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-math-g7', 'sub-eng-g7', 'sub-kisw-g7', 'sub-sci-g7'],
  };

  const mockSubjects: Subject[] = [
    { id: 'sub-math-g7', subject_name: 'Mathematics', subject_code: 'MATH-07', category: 'Core' },
    { id: 'sub-eng-g7', subject_name: 'English', subject_code: 'ENG-07', category: 'Core' },
    { id: 'sub-kisw-g7', subject_name: 'Kiswahili', subject_code: 'KISW-07', category: 'Core' },
    { id: 'sub-sci-g7', subject_name: 'Integrated Science', subject_code: 'SCI-07', category: 'Core' },
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
    full_name: 'Bob Kipchoge',
    gender: 'M',
    class_id: 'class-g7-east',
    stream_id: 'class-g7-east',
    active: true,
  };

  const examApprovedReleased: Examination = {
    id: 'exam-approved-001',
    exam_name: 'End of Term 1 Summative Assessment 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'End-Term',
    status: 'Approved',
    approved_classes: ['class-g7-east'],
    max_marks: 100,
  };

  const examDraftUnapproved: Examination = {
    id: 'exam-draft-002',
    exam_name: 'Mid Term 2 Continuous Assessment',
    term: 'Term 2',
    year: 2026,
    exam_type: 'Mid-Term',
    status: 'Draft',
    approved_classes: [],
    max_marks: 100,
  };

  const marks: Mark[] = [
    { id: 'm-1', student_id: 'student-alice-uuid-001', exam_id: 'exam-approved-001', subject_id: 'sub-math-g7', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
    { id: 'm-2', student_id: 'student-alice-uuid-001', exam_id: 'exam-approved-001', subject_id: 'sub-eng-g7', marks: 92, raw_score: 92, out_of: 100, special_status: 'Normal' },
    { id: 'm-3', student_id: 'student-alice-uuid-001', exam_id: 'exam-approved-001', subject_id: 'sub-kisw-g7', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm-4', student_id: 'student-alice-uuid-001', exam_id: 'exam-approved-001', subject_id: 'sub-sci-g7', marks: 84, raw_score: 84, out_of: 100, special_status: 'Normal' },
    // Bob's marks for ranking computation
    { id: 'm-5', student_id: 'student-bob-uuid-002', exam_id: 'exam-approved-001', subject_id: 'sub-math-g7', marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
    { id: 'm-6', student_id: 'student-bob-uuid-002', exam_id: 'exam-approved-001', subject_id: 'sub-eng-g7', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
    { id: 'm-7', student_id: 'student-bob-uuid-002', exam_id: 'exam-approved-001', subject_id: 'sub-kisw-g7', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    { id: 'm-8', student_id: 'student-bob-uuid-002', exam_id: 'exam-approved-001', subject_id: 'sub-sci-g7', marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },
  ];

  it('1. Verifies that isStudentExamApproved accurately filters released vs unreleased assessments for Phase 6', () => {
    const isApprovedAlice = isStudentExamApproved(examApprovedReleased, studentAlice.stream_id || studentAlice.class_id, [mockClassGrade7]);
    expect(isApprovedAlice).toBe(true);

    const isDraftAlice = isStudentExamApproved(examDraftUnapproved, studentAlice.stream_id || studentAlice.class_id, [mockClassGrade7]);
    expect(isDraftAlice).toBe(false);
  });

  it('2. Verifies that calculateExamResults correctly computes aggregate metrics and ranks for the learner', () => {
    const results = calculateExamResults(
      examApprovedReleased.id,
      [studentAlice, studentBob],
      marks,
      CBE_8_POINT_GRADES,
      [mockClassGrade7],
      mockSubjects
    );

    const aliceResult = results.find((r) => r.student_id === studentAlice.id);
    expect(aliceResult).toBeDefined();
    expect(aliceResult?.total_marks).toBe(342); // 88 + 92 + 78 + 84
    expect(aliceResult?.average).toBe(85.5);
    expect(aliceResult?.position).toBe(1);
    expect(aliceResult?.class_position).toBe(1);

    const bobResult = results.find((r) => r.student_id === studentBob.id);
    expect(bobResult).toBeDefined();
    expect(bobResult?.position).toBe(2);
    expect(bobResult?.class_position).toBe(2);
  });

  it('3. Verifies that evaluateMark maps CBE score and percentage accurately', () => {
    const markMath = marks.find((m) => m.id === 'm-1')!;
    const evalMath = evaluateMark(markMath);

    expect(evalMath.percentage).toBe(88);
    expect(evalMath.rawScore).toBe(88);
    expect(evalMath.outOf).toBe(100);
    expect(evalMath.status).toBe('Normal');
  });
});
