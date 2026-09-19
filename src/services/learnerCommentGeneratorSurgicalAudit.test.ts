import { describe, it, expect } from 'vitest';
import { generatePersonalizedLearnerComment } from './learnerCommentGenerator';
import { Student, Subject, Mark, Examination } from '../types';
import { CBE_8_POINT_GRADES } from './analysisEngine';

const mockSubjects: Subject[] = [
  { id: 'subj-math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core' },
  { id: 'subj-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
  { id: 'subj-sci', subject_name: 'Integrated Science', subject_code: 'SCI', category: 'Core' },
  { id: 'subj-ss', subject_name: 'Social Studies', subject_code: 'SS', category: 'Core' },
  { id: 'subj-cre', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core' },
  { id: 'subj-agr', subject_name: 'Agriculture', subject_code: 'AGR', category: 'Core' },
  { id: 'subj-pts', subject_name: 'Pre-Technical Studies', subject_code: 'PTS', category: 'Core' },
];

const mockExam1: Examination = {
  id: 'exam-term1',
  exam_name: 'Term 1 Assessment',
  term: 'Term 1',
  year: 2026,
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

const studentAlice: Student = {
  id: 'std-alice-uuid-001',
  admission_number: 'ADM/2026/001',
  full_name: 'Alice Wanjiku Mwangi',
  first_name: 'Alice',
  second_name: 'Wanjiku',
  last_name: 'Mwangi',
  gender: 'F',
  class_id: 'cls-7',
  active: true,
};

const studentBob: Student = {
  id: 'std-bob-uuid-002',
  admission_number: 'ADM/2026/002',
  full_name: 'Bob Kiprop Cheruiyot',
  first_name: 'Bob',
  second_name: 'Kiprop',
  last_name: 'Cheruiyot',
  gender: 'M',
  class_id: 'cls-7',
  active: true,
};

const forbiddenBehaviouralTerms = [
  'discipline',
  'disciplined',
  'behaviour',
  'behavior',
  'attitude',
  'attendance',
  'character',
  'participation',
  'conduct',
  'leadership in classroom',
];

describe('Surgical Audit Verification: Learner Comment Generator', () => {
  it('1. Verifies that learner full name, first name, and admission number never appear in generated comments', () => {
    const marksAlice: Mark[] = mockSubjects.map((s, idx) => ({
      id: `mark-${idx}`,
      student_id: studentAlice.id,
      subject_id: s.id,
      exam_id: mockExam1.id,
      marks: 80,
      out_of: 100,
      special_status: 'Normal',
    }));

    for (const commentType of ['class_teacher', 'hoi'] as const) {
      const comment = generatePersonalizedLearnerComment({
        student: studentAlice,
        examId: mockExam1.id,
        marks: marksAlice,
        subjects: mockSubjects,
        grades: CBE_8_POINT_GRADES,
        commentType,
      });

      expect(comment.toLowerCase()).not.toContain('alice');
      expect(comment.toLowerCase()).not.toContain('wanjiku');
      expect(comment.toLowerCase()).not.toContain('mwangi');
      expect(comment).not.toContain('ADM/2026/001');
      expect(comment).not.toContain(studentAlice.id);
    }
  });

  it('2. Verifies that generated comments are strictly free of unsupported behavioural claims', () => {
    const scoreProfiles = [88, 76, 68, 55, 42, 30];
    const students = [studentAlice, studentBob];

    for (const std of students) {
      for (const score of scoreProfiles) {
        const marks: Mark[] = mockSubjects.map((s, idx) => ({
          id: `mark-${std.id}-${idx}`,
          student_id: std.id,
          subject_id: s.id,
          exam_id: mockExam1.id,
          marks: Math.max(10, Math.min(100, score + (idx % 2 === 0 ? 8 : -8))),
          out_of: 100,
          special_status: 'Normal',
        }));

        for (const commentType of ['class_teacher', 'hoi'] as const) {
          const comment = generatePersonalizedLearnerComment({
            student: std,
            examId: mockExam1.id,
            marks,
            subjects: mockSubjects,
            grades: CBE_8_POINT_GRADES,
            commentType,
          });

          for (const term of forbiddenBehaviouralTerms) {
            expect(comment.toLowerCase()).not.toContain(term.toLowerCase());
          }
        }
      }
    }
  });

  it('3. Verifies that Class Teacher and Head of Institution comments have distinct pedagogical vs institutional tones', () => {
    const marks: Mark[] = mockSubjects.map((s, idx) => ({
      id: `mark-${idx}`,
      student_id: studentAlice.id,
      subject_id: s.id,
      exam_id: mockExam1.id,
      marks: idx === 0 ? 92 : 60,
      out_of: 100,
      special_status: 'Normal',
    }));

    const ctComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'class_teacher',
    });

    const hoiComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'hoi',
    });

    expect(ctComment).not.toEqual(hoiComment);
    expect(ctComment).toMatch(/Mathematics|revision|learning areas|curriculum|progress/);
    expect(hoiComment).toMatch(/Approved|Official|approval|distinction|progression|advancement/);
  });

  it('4. Verifies word count and length constraints for physical PDF space', () => {
    const marks: Mark[] = mockSubjects.map((s, idx) => ({
      id: `mark-${idx}`,
      student_id: studentAlice.id,
      subject_id: s.id,
      exam_id: mockExam1.id,
      marks: 72,
      out_of: 100,
      special_status: 'Normal',
    }));

    const ctComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'class_teacher',
    });

    const hoiComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'hoi',
    });

    const ctWords = ctComment.trim().split(/\s+/).length;
    const hoiWords = hoiComment.trim().split(/\s+/).length;

    expect(ctWords).toBeGreaterThanOrEqual(18);
    expect(ctWords).toBeLessThanOrEqual(38);
    expect(ctComment.length).toBeLessThanOrEqual(220);

    expect(hoiWords).toBeGreaterThanOrEqual(12);
    expect(hoiWords).toBeLessThanOrEqual(30);
    expect(hoiComment.length).toBeLessThanOrEqual(220);
  });

  it('5. Verifies deterministic stability for the same learner and academic data', () => {
    const marks: Mark[] = mockSubjects.map((s, idx) => ({
      id: `mark-${idx}`,
      student_id: studentAlice.id,
      subject_id: s.id,
      exam_id: mockExam1.id,
      marks: 65,
      out_of: 100,
      special_status: 'Normal',
    }));

    const run1 = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'class_teacher',
    });

    const run2 = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'class_teacher',
    });

    expect(run1).toEqual(run2);
  });

  it('6. Verifies variation distribution across different learner seeds', () => {
    const commentsSet = new Set<string>();

    for (let i = 1; i <= 20; i++) {
      const mockStudent: Student = {
        id: `std-test-${i}`,
        admission_number: `ADM/${1000 + i}`,
        full_name: `Learner Test ${i}`,
        gender: 'M',
        class_id: 'cls-7',
        active: true,
      };

      const marks: Mark[] = mockSubjects.map((s, idx) => ({
        id: `mark-${mockStudent.id}-${idx}`,
        student_id: mockStudent.id,
        subject_id: s.id,
        exam_id: mockExam1.id,
        marks: 85,
        out_of: 100,
        special_status: 'Normal',
      }));

      const comment = generatePersonalizedLearnerComment({
        student: mockStudent,
        examId: mockExam1.id,
        marks,
        subjects: mockSubjects,
        grades: CBE_8_POINT_GRADES,
        commentType: 'hoi',
      });

      commentsSet.add(comment);
    }

    expect(commentsSet.size).toBeGreaterThanOrEqual(4);
  });

  it('7. Verifies incomplete / missing mark provisional comments are correctly emitted', () => {
    const incompleteMarks: Mark[] = mockSubjects.slice(0, 3).map((s, idx) => ({
      id: `mark-${idx}`,
      student_id: studentAlice.id,
      subject_id: s.id,
      exam_id: mockExam1.id,
      marks: 70,
      out_of: 100,
      special_status: 'Normal',
    }));

    const ctProv = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks: incompleteMarks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'class_teacher',
    });

    expect(ctProv).toMatch(/incomplete|pending|provisional|outstanding/i);

    const hoiProv = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks: incompleteMarks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'hoi',
    });

    expect(hoiProv).toMatch(/provisional|interim|pending|outstanding|approval/i);
  });

  it('8. Verifies subject contrast (strongest vs weakest) interpolation', () => {
    const marks: Mark[] = mockSubjects.map((s) => {
      let score = 55;
      if (s.subject_code === 'MATH') score = 78;
      if (s.subject_code === 'ENG') score = 42;
      return {
        id: `mark-${s.id}`,
        student_id: studentAlice.id,
        subject_id: s.id,
        exam_id: mockExam1.id,
        marks: score,
        out_of: 100,
        special_status: 'Normal',
      };
    });

    const ctComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam1.id,
      marks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      commentType: 'class_teacher',
    });

    expect(ctComment).toContain('Mathematics');
    expect(ctComment).toContain('English');
  });
});
