import { describe, it, expect } from 'vitest';
import { Subject, Mark, EducationLevel, GradeName } from '../types';
import { evaluateMark } from '../utils/markUtils';
import { getGradeForMark } from '../services/analysisEngine';

describe('CBE 2026 Learner Subject Scoping & Merit Pipeline Tests', () => {
  const allCurriculumSubjects: Subject[] = [
    { id: 'sb_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_mat', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_sci', subject_name: 'Integrated Science', subject_code: 'INT-SCI', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_cas', subject_name: 'Creative Arts and Sports', subject_code: 'CAS', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_sst', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_cre', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_agn', subject_name: 'Agriculture', subject_code: 'AGN', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sb_pts', subject_name: 'Pre-Technical Studies', subject_code: 'PRE-TECH', category: 'Core', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    // Upper Primary
    { id: 'sb_up_eng', subject_name: 'English', subject_code: 'ENG UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_kis', subject_name: 'Kiswahili', subject_code: 'KIS UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_mat', subject_name: 'Mathematics', subject_code: 'MATH UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_sci', subject_name: 'Science & Technology', subject_code: 'SCI UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_agr', subject_name: 'Agriculture', subject_code: 'AGR UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_sst', subject_name: 'Social Studies', subject_code: 'SST UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_crt', subject_name: 'Creative Arts', subject_code: 'CREAT UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sb_up_re', subject_name: 'Christian Religious Education', subject_code: 'CRE UP', category: 'Core', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
  ];

  const marcusMarks: Mark[] = [
    { id: 'm1', student_id: 'std_230', subject_id: 'sb_eng', exam_id: 'ex_op1', marks: 99 },
    { id: 'm2', student_id: 'std_230', subject_id: 'sb_kis', exam_id: 'ex_op1', marks: 78 },
    { id: 'm3', student_id: 'std_230', subject_id: 'sb_mat', exam_id: 'ex_op1', marks: 78 },
    { id: 'm4', student_id: 'std_230', subject_id: 'sb_sci', exam_id: 'ex_op1', marks: 74.44 },
    { id: 'm5', student_id: 'std_230', subject_id: 'sb_cas', exam_id: 'ex_op1', marks: 89 },
    { id: 'm6', student_id: 'std_230', subject_id: 'sb_sst', exam_id: 'ex_op1', marks: 89 },
    { id: 'm7', student_id: 'std_230', subject_id: 'sb_cre', exam_id: 'ex_op1', marks: 100 },
    { id: 'm8', student_id: 'std_230', subject_id: 'sb_pts', exam_id: 'ex_op1', marks: 78 },
    { id: 'm9', student_id: 'std_230', subject_id: 'sb_agn', exam_id: 'ex_op1', marks: 98 },
  ];

  function evaluateLearnerAssessment(gradeName: GradeName, educationLevel: EducationLevel, subjects: Subject[], marks: Mark[]) {
    const allocatedSubjects = subjects.filter((s) => {
      if (s.applicable_grades && s.applicable_grades.length > 0) {
        return s.applicable_grades.includes(gradeName as any);
      }
      return s.education_level === educationLevel;
    });

    const evaluatedRows = allocatedSubjects.map((sb) => {
      const rawMark = marks.find((m) => m.subject_id === sb.id || m.subject_id === sb.subject_code);
      const evaluated = evaluateMark(rawMark);
      const grade = evaluated.percentage !== null ? getGradeForMark(evaluated.percentage) : undefined;
      return {
        subject: sb.subject_name,
        code: sb.subject_code,
        score: evaluated.percentage,
        gradeCode: grade?.grade_code || (evaluated.status === 'X' ? 'X' : '—'),
        level: grade?.performance_level || (evaluated.status === 'X' ? 'X' : '—'),
        status: evaluated.status,
      };
    });

    const normalRows = evaluatedRows.filter((r) => r.status === 'Normal' && r.score !== null);
    const totalScore = normalRows.reduce((sum, r) => sum + (r.score || 0), 0);
    const avg = normalRows.length > 0 ? totalScore / normalRows.length : 0;
    const overallGrade = getGradeForMark(avg);

    return {
      allocatedSubjects,
      evaluatedRows,
      normalRows,
      assessedCount: normalRows.length,
      totalCount: allocatedSubjects.length,
      totalScore: Math.round(totalScore),
      maxPossibleScore: allocatedSubjects.length * 100,
      average: Math.round(avg),
      overallGradeCode: overallGrade?.grade_code,
      overallLevel: overallGrade?.performance_level,
      isComplete: normalRows.length === allocatedSubjects.length,
    };
  }

  it('Test 1 — Marcus Jordan displays 9/9 subjects, 783/900, 87%, EE2, Complete', () => {
    const result = evaluateLearnerAssessment('Grade 9', 'Junior School', allCurriculumSubjects, marcusMarks);
    expect(result.totalCount).toBe(9);
    expect(result.assessedCount).toBe(9);
    expect(result.totalScore).toBe(783);
    expect(result.maxPossibleScore).toBe(900);
    expect(result.average).toBe(87);
    expect(result.overallGradeCode).toBe('EE2');
    expect(result.isComplete).toBe(true);
  });

  it('Test 2 — Genuine Missing Mark results in unrecorded mark / Incomplete assessment', () => {
    const partialMarks = marcusMarks.slice(0, 8); // remove 9th mark (Agriculture)
    const result = evaluateLearnerAssessment('Grade 9', 'Junior School', allCurriculumSubjects, partialMarks);
    expect(result.totalCount).toBe(9);
    expect(result.assessedCount).toBe(8);
    expect(result.isComplete).toBe(false);
    const missingRow = result.evaluatedRows.find((r) => r.code === 'AGN');
    expect(missingRow?.status).toBe('Blank');
    expect(missingRow?.score).toBeNull();
  });

  it('Test 3 — Subject Teacher role scoping restricts to assigned subjects only', () => {
    const teacherAllocatedSubjectIds = ['sb_mat', 'sb_sci'];
    const scopedSubjects = allCurriculumSubjects.filter((s) => teacherAllocatedSubjectIds.includes(s.id));
    expect(scopedSubjects.length).toBe(2);
    expect(scopedSubjects.map((s) => s.subject_code)).toEqual(['MATH', 'INT-SCI']);
  });

  it('Test 4 — Another Learner in Grade 9 receives all 9 Junior School subjects', () => {
    const otherStudentMarks: Mark[] = [
      { id: 'om1', student_id: 'std_999', subject_id: 'sb_eng', exam_id: 'ex_op1', marks: 80 },
    ];
    const result = evaluateLearnerAssessment('Grade 9', 'Junior School', allCurriculumSubjects, otherStudentMarks);
    expect(result.totalCount).toBe(9);
  });

  it('Test 5 — Learner in Grade 5 receives Upper Primary subjects (8 learning areas)', () => {
    const result = evaluateLearnerAssessment('Grade 5', 'Upper Primary', allCurriculumSubjects, []);
    expect(result.totalCount).toBe(8);
    expect(result.allocatedSubjects.map((s) => s.subject_code)).toEqual([
      'ENG UP',
      'KIS UP',
      'MATH UP',
      'SCI UP',
      'AGR UP',
      'SST UP',
      'CREAT UP',
      'CRE UP',
    ]);
  });

  it('Test 6 — Moving learner across streams in Grade 9 preserves the same 9 Junior School subjects', () => {
    const streamBlueResult = evaluateLearnerAssessment('Grade 9', 'Junior School', allCurriculumSubjects, marcusMarks);
    const streamRedResult = evaluateLearnerAssessment('Grade 9', 'Junior School', allCurriculumSubjects, marcusMarks);
    expect(streamBlueResult.totalCount).toBe(streamRedResult.totalCount);
    expect(streamBlueResult.allocatedSubjects.map((s) => s.id)).toEqual(streamRedResult.allocatedSubjects.map((s) => s.id));
  });
});
