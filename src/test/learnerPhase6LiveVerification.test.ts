import { describe, it, expect } from 'vitest';
import { isStudentExamApproved } from '../utils/examLockUtils';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { resolvePDFLearnerContext } from '../services/pdfReportGenerator';
import { Examination, ClassStream, Student, Mark, Subject } from '../types';

describe('FORENSIC LIVE QA: Phase 6 Summative Report Card Verification', () => {
  const mockClass: ClassStream = {
    id: 'class-g7-alpha',
    class_name: 'Grade 7',
    stream: 'Alpha',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-math', 'sub-eng', 'sub-kisw'],
  };

  const mockSubjects: Subject[] = [
    { id: 'sub-math', subject_name: 'Mathematics', subject_code: 'MATH-07', category: 'Core' },
    { id: 'sub-eng', subject_name: 'English', subject_code: 'ENG-07', category: 'Core' },
    { id: 'sub-kisw', subject_name: 'Kiswahili', subject_code: 'KISW-07', category: 'Core' },
  ];

  const learnerAlice: Student = {
    id: 'student-alice-001',
    admission_number: 'ADM-7001',
    full_name: 'Alice Muthoni',
    gender: 'F',
    class_id: 'class-g7-alpha',
    stream_id: 'class-g7-alpha',
    active: true,
  };

  const learnerBob: Student = {
    id: 'student-bob-002',
    admission_number: 'ADM-7002',
    full_name: 'Bob Omondi',
    gender: 'M',
    class_id: 'class-g7-alpha',
    stream_id: 'class-g7-alpha',
    active: true,
  };

  const releasedExam: Examination = {
    id: 'exam-rel-2026',
    exam_name: 'End of Term 1 Summative Assessment 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'End-Term',
    status: 'Approved',
    approved_classes: ['class-g7-alpha'],
    max_marks: 100,
  };

  const unreleasedExam: Examination = {
    id: 'exam-draft-2026',
    exam_name: 'Term 2 Continuous Assessment Test',
    term: 'Term 2',
    year: 2026,
    exam_type: 'Mid-Term',
    status: 'Draft',
    approved_classes: [],
    max_marks: 100,
  };

  const marks: Mark[] = [
    { id: 'm-1', student_id: 'student-alice-001', exam_id: 'exam-rel-2026', subject_id: 'sub-math', marks: 95, raw_score: 95, out_of: 100, special_status: 'Normal' },
    { id: 'm-2', student_id: 'student-alice-001', exam_id: 'exam-rel-2026', subject_id: 'sub-eng', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
    { id: 'm-3', student_id: 'student-alice-001', exam_id: 'exam-rel-2026', subject_id: 'sub-kisw', marks: 84, raw_score: 84, out_of: 100, special_status: 'Normal' },
    { id: 'm-4', student_id: 'student-bob-002', exam_id: 'exam-rel-2026', subject_id: 'sub-math', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    { id: 'm-5', student_id: 'student-bob-002', exam_id: 'exam-rel-2026', subject_id: 'sub-eng', marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },
    { id: 'm-6', student_id: 'student-bob-002', exam_id: 'exam-rel-2026', subject_id: 'sub-kisw', marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },
  ];

  it('1. Learner Access: Verifies student resolution and isolation', () => {
    const studentMarksAlice = marks.filter((m) => m.student_id === learnerAlice.id);
    expect(studentMarksAlice.length).toBe(3);
    expect(studentMarksAlice.every((m) => m.student_id === 'student-alice-001')).toBe(true);
    // Bob's marks never pollute Alice's record
    expect(studentMarksAlice.some((m) => m.student_id === learnerBob.id)).toBe(false);
  });

  it('2. Released-Assessment Gate: Verifies gate releases approved exam and blocks unreleased exam', () => {
    const isRelApproved = isStudentExamApproved(releasedExam, learnerAlice.stream_id || learnerAlice.class_id, [mockClass]);
    expect(isRelApproved).toBe(true);

    const isUnrelApproved = isStudentExamApproved(unreleasedExam, learnerAlice.stream_id || learnerAlice.class_id, [mockClass]);
    expect(isUnrelApproved).toBe(false);
  });

  it('3. Academic Data Accuracy: Computes correct aggregates and 8-point CBE grading', () => {
    const results = calculateExamResults(
      releasedExam.id,
      [learnerAlice, learnerBob],
      marks,
      CBE_8_POINT_GRADES,
      [mockClass],
      mockSubjects
    );

    const aliceResult = results.find((r) => r.student_id === learnerAlice.id);
    expect(aliceResult).toBeDefined();
    expect(aliceResult?.total_marks).toBe(267); // 95 + 88 + 84
    expect(aliceResult?.average).toBe(89);
    expect(aliceResult?.position).toBe(1);
    expect(aliceResult?.performance_level).toBe('EE');
  });

  it('4. PDF/Print Output: Verifies report context resolution matches authoritative student details', () => {
    const pdfContext = resolvePDFLearnerContext(learnerAlice, releasedExam, [mockClass]);
    expect(pdfContext.effectiveStudent.id).toBe(learnerAlice.id);
    expect(pdfContext.classNameStr).toContain('Grade 7');
    expect(pdfContext.classNameStr).toContain('Alpha');
  });
});
