import { describe, it, expect } from 'vitest';
import {
  calculateExamResults,
  getGradeForMark,
  calculateSubjectRank,
  getLearnerReportSubjects,
  CBE_8_POINT_GRADES,
} from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { generatePersonalizedLearnerComment } from '../services/learnerCommentGenerator';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { Student, Mark, Examination, Subject, ClassStream, Teacher, School, Grade } from '../types';

describe('Admin Learner Assessment Summary & PDF Separation Audit', () => {
  const mockSchool: School = {
    id: 'school-001',
    school_name: 'Moi Educational Centre',
    motto: 'Knowledge is Power',
    phone: '+254 700 123456',
    email: 'info@moieducentre.ac.ke',
    principal_name: 'Dr. Jane Muthoni',
    county: 'Nairobi',
  };

  const mockClass7East: ClassStream = {
    id: 'cls-7e',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-math', 'sub-eng', 'sub-kisw', 'sub-sci'],
  };

  const mockSubjects: Subject[] = [
    { id: 'sub-math', subject_code: 'MAT-07', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sub-eng', subject_code: 'ENG-07', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sub-kisw', subject_code: 'KIS-07', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sub-sci', subject_code: 'SCI-07', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
  ];

  const studentAlice: Student = {
    id: 'std-alice-01',
    admission_number: 'ADM-7001',
    full_name: 'Alice Wambui',
    gender: 'F',
    class_id: 'cls-7e',
    stream_id: 'cls-7e',
    grade: 'Grade 7',
    active: true,
  };

  const studentBob: Student = {
    id: 'std-bob-02',
    admission_number: 'ADM-7002',
    full_name: 'Bob Kipchoge',
    gender: 'M',
    class_id: 'cls-7e',
    stream_id: 'cls-7e',
    grade: 'Grade 7',
    active: true,
  };

  const mockExam: Examination = {
    id: 'exam-sum-2026-t1',
    exam_name: 'Term 1 Summative Assessment 2026',
    term: 'Term 1',
    year: 2026,
    exam_type: 'End-Term',
    status: 'Approved',
    approved_classes: ['cls-7e'],
    max_marks: 100,
  };

  const mockMarks: Mark[] = [
    { id: 'm-1', student_id: 'std-alice-01', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-math', marks: 92, raw_score: 92, out_of: 100, special_status: 'Normal' },
    { id: 'm-2', student_id: 'std-alice-01', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-eng', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
    { id: 'm-3', student_id: 'std-alice-01', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-kisw', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm-4', student_id: 'std-alice-01', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-sci', marks: 84, raw_score: 84, out_of: 100, special_status: 'Normal' },

    { id: 'm-5', student_id: 'std-bob-02', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-math', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    { id: 'm-6', student_id: 'std-bob-02', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-eng', marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },
    { id: 'm-7', student_id: 'std-bob-02', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-kisw', marks: 66, raw_score: 66, out_of: 100, special_status: 'Normal' },
    { id: 'm-8', student_id: 'std-bob-02', exam_id: 'exam-sum-2026-t1', subject_id: 'sub-sci', marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },
  ];

  it('1. Verifies that academic metrics match across calculations for Admin assessment summary', () => {
    const examResults = calculateExamResults(
      mockExam.id,
      [studentAlice, studentBob],
      mockMarks,
      CBE_8_POINT_GRADES,
      [mockClass7East],
      mockSubjects
    );

    const aliceResult = examResults.find((r) => r.student_id === studentAlice.id);
    expect(aliceResult).toBeDefined();
    expect(aliceResult?.total_marks).toBe(342); // 92 + 88 + 78 + 84
    expect(aliceResult?.average).toBe(85.5);
    expect(aliceResult?.performance_level).toBe('EE');
    expect(aliceResult?.position).toBe(1);
    expect(aliceResult?.class_position).toBe(1);

    const bobResult = examResults.find((r) => r.student_id === studentBob.id);
    expect(bobResult).toBeDefined();
    expect(bobResult?.total_marks).toBe(282); // 70 + 74 + 66 + 72
    expect(bobResult?.average).toBe(70.5);
    expect(bobResult?.performance_level).toBe('ME');
    expect(bobResult?.position).toBe(2);
    expect(bobResult?.class_position).toBe(2);
  });

  it('2. Verifies that subject-level breakdown and ranking calculations are identical and accurate', () => {
    const mathRankAlice = calculateSubjectRank(
      studentAlice,
      'sub-math',
      mockExam.id,
      [studentAlice, studentBob],
      [mockClass7East],
      mockMarks
    );
    expect(mathRankAlice).toBe('1/2');

    const mathRankBob = calculateSubjectRank(
      studentBob,
      'sub-math',
      mockExam.id,
      [studentAlice, studentBob],
      [mockClass7East],
      mockMarks
    );
    expect(mathRankBob).toBe('2/2');

    const gradeMathAlice = getGradeForMark(92, CBE_8_POINT_GRADES);
    expect(gradeMathAlice.grade_code).toBe('EE1');
    expect(gradeMathAlice.points).toBe(8);
  });

  it('3. Verifies that special mark status (X, Y, 0) is correctly recognized in Admin web summary', () => {
    const markX: Mark = {
      id: 'm-x',
      student_id: 'std-alice-01',
      exam_id: mockExam.id,
      subject_id: 'sub-math',
      marks: 0,
      raw_score: null,
      out_of: 100,
      special_status: 'X',
    };
    const evalX = evaluateMark(markX);
    expect(evalX.status).toBe('X');
    expect(evalX.displayScore).toBe('X');

    const markY: Mark = {
      id: 'm-y',
      student_id: 'std-bob-02',
      exam_id: mockExam.id,
      subject_id: 'sub-math',
      marks: 0,
      raw_score: null,
      out_of: 100,
      special_status: 'Y',
      irregularity_reason: 'Absent with apology',
    };
    const evalY = evaluateMark(markY);
    expect(evalY.status).toBe('Y');
    expect(evalY.displayScore).toBe('Y');
    expect(evalY.irregularityReason).toBe('Absent with apology');
  });

  it('4. Verifies personalized remark generation logic works identically for Class Teacher & HOI', () => {
    const teacherComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam.id,
      marks: mockMarks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      exams: [mockExam],
      averageScore: 85.5,
      averagePoints: 7.5,
      overallLevel: 'EE',
      commentType: 'class_teacher',
      isProvisional: false,
    });
    expect(teacherComment).toBeTruthy();
    expect(typeof teacherComment).toBe('string');
    expect(teacherComment.length).toBeGreaterThan(10);

    const hoiComment = generatePersonalizedLearnerComment({
      student: studentAlice,
      examId: mockExam.id,
      marks: mockMarks,
      subjects: mockSubjects,
      grades: CBE_8_POINT_GRADES,
      exams: [mockExam],
      averageScore: 85.5,
      averagePoints: 7.5,
      overallLevel: 'EE',
      commentType: 'hoi',
      isProvisional: false,
    });
    expect(hoiComment).toBeTruthy();
    expect(typeof hoiComment).toBe('string');
    expect(hoiComment.length).toBeGreaterThan(10);
  });
});
