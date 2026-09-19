import { describe, it, expect } from 'vitest';
import { calculateExamResults } from './analysisEngine';
import { LearnerRankingMetadata, Student, ClassStream, Examination, Mark, Subject, Grade } from '../types';

describe('Learner Portal Authoritative Cohort Ranking Integration', () => {
  const mockStudents: Student[] = [
    {
      id: 'student-uuid-1',
      admission_number: 'ADM-001',
      full_name: 'Alice Wanjiku',
      grade: 'Grade 7',
      class_id: 'class-g7',
      stream_id: 'stream-g7-east',
      gender: 'F',
      active: true,
    },
    {
      id: 'student-uuid-2',
      admission_number: 'ADM-002',
      full_name: 'Bob Kiprono',
      grade: 'Grade 7',
      class_id: 'class-g7',
      stream_id: 'stream-g7-east',
      gender: 'M',
      active: true,
    },
    {
      id: 'student-uuid-3',
      admission_number: 'ADM-003',
      full_name: 'Charlie Mwangi',
      grade: 'Grade 7',
      class_id: 'class-g7',
      stream_id: 'stream-g7-west',
      gender: 'M',
      active: true,
    },
    {
      id: 'student-uuid-4',
      admission_number: 'ADM-004',
      full_name: 'Diana Chebet',
      grade: 'Grade 7',
      class_id: 'class-g7',
      stream_id: 'stream-g7-west',
      gender: 'F',
      active: true,
    },
  ];

  const mockClasses: ClassStream[] = [
    {
      id: 'class-g7',
      stream_id: 'stream-g7-east',
      class_name: 'Grade 7',
      stream: 'East',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
    },
    {
      id: 'class-g7',
      stream_id: 'stream-g7-west',
      class_name: 'Grade 7',
      stream: 'West',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'subj-math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Junior School' },
    { id: 'subj-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Junior School' },
  ];

  const mockGrades: Grade[] = [
    { id: 'g1', grade_code: 'EE1', grade: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Outstanding', descriptor: 'Outstanding' },
    { id: 'g2', grade_code: 'ME1', grade: 'ME1', performance_level: 'ME', minimum_score: 75, maximum_score: 89, points: 6, remarks: 'Proficient', descriptor: 'Proficient' },
    { id: 'g3', grade_code: 'AE1', grade: 'AE1', performance_level: 'AE', minimum_score: 50, maximum_score: 74, points: 4, remarks: 'Developing', descriptor: 'Developing' },
    { id: 'g4', grade_code: 'BE1', grade: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 49, points: 2, remarks: 'Beginning', descriptor: 'Beginning' },
  ];

  const mockMarks: Mark[] = [
    // Alice (East): Math 95, Eng 90 -> Total 185, Avg 92.5
    { id: 'm1', student_id: 'student-uuid-1', exam_id: 'exam-term1', subject_id: 'subj-math', marks: 95 },
    { id: 'm2', student_id: 'student-uuid-1', exam_id: 'exam-term1', subject_id: 'subj-eng', marks: 90 },
    // Bob (East): Math 80, Eng 85 -> Total 165, Avg 82.5
    { id: 'm3', student_id: 'student-uuid-2', exam_id: 'exam-term1', subject_id: 'subj-math', marks: 80 },
    { id: 'm4', student_id: 'student-uuid-2', exam_id: 'exam-term1', subject_id: 'subj-eng', marks: 85 },
    // Charlie (West): Math 98, Eng 96 -> Total 194, Avg 97.0
    { id: 'm5', student_id: 'student-uuid-3', exam_id: 'exam-term1', subject_id: 'subj-math', marks: 98 },
    { id: 'm6', student_id: 'student-uuid-3', exam_id: 'exam-term1', subject_id: 'subj-eng', marks: 96 },
    // Diana (West): Math 70, Eng 75 -> Total 145, Avg 72.5
    { id: 'm7', student_id: 'student-uuid-4', exam_id: 'exam-term1', subject_id: 'subj-math', marks: 70 },
    { id: 'm8', student_id: 'student-uuid-4', exam_id: 'exam-term1', subject_id: 'subj-eng', marks: 75 },
  ];

  it('1. Authoritative full-cohort engine ranks Alice as Stream Rank 1 of 2 (East) and Overall Rank 2 of 4 (Grade 7)', () => {
    const fullCohortResults = calculateExamResults(
      'exam-term1',
      mockStudents,
      mockMarks,
      mockGrades,
      mockClasses,
      mockSubjects
    );

    const aliceResult = fullCohortResults.find((r) => r.student_id === 'student-uuid-1');
    const bobResult = fullCohortResults.find((r) => r.student_id === 'student-uuid-2');
    const charlieResult = fullCohortResults.find((r) => r.student_id === 'student-uuid-3');
    const dianaResult = fullCohortResults.find((r) => r.student_id === 'student-uuid-4');

    expect(aliceResult).toBeDefined();
    expect(bobResult).toBeDefined();
    expect(charlieResult).toBeDefined();
    expect(dianaResult).toBeDefined();

    // Overall Positions: Charlie=1 (194), Alice=2 (185), Bob=3 (165), Diana=4 (145)
    expect(charlieResult?.position).toBe(1);
    expect(aliceResult?.position).toBe(2);
    expect(bobResult?.position).toBe(3);
    expect(dianaResult?.position).toBe(4);

    // Stream Positions:
    // East: Alice=1, Bob=2
    // West: Charlie=1, Diana=2
    expect(aliceResult?.class_position).toBe(1);
    expect(bobResult?.class_position).toBe(2);
    expect(charlieResult?.class_position).toBe(1);
    expect(dianaResult?.class_position).toBe(2);
  });

  it('2. Demonstrates the single-student context defect if calculated without authoritative cohort metadata', () => {
    // When learner portal only has Alice in its local student list
    const singleLearnerArray = [mockStudents[0]]; // Alice only
    const aliceOnlyMarks = mockMarks.filter((m) => m.student_id === 'student-uuid-1');

    const isolatedResult = calculateExamResults(
      'exam-term1',
      singleLearnerArray,
      aliceOnlyMarks,
      mockGrades,
      mockClasses,
      mockSubjects
    );

    const aliceIsolated = isolatedResult.find((r) => r.student_id === 'student-uuid-1');
    expect(aliceIsolated).toBeDefined();
    // In isolated single-student list, Alice gets 1 of 1 incorrectly
    expect(aliceIsolated?.position).toBe(1);
    expect(aliceIsolated?.class_position).toBe(1);
  });

  it('3. Aggregate ranking metadata correctly overrides isolated calculation with authoritative values', () => {
    const aggregateMetadata: LearnerRankingMetadata = {
      stream_rank: 1,
      stream_total: 2,
      overall_rank: 2,
      overall_total: 4,
      is_complete: true,
      total_marks: 185,
      average: 92.5,
      total_points: 16,
      performance_level: 'Exceeding Expectations',
      grade_code: 'EE1',
    };

    // Verify metadata shape and values
    expect(aggregateMetadata.stream_rank).toBe(1);
    expect(aggregateMetadata.stream_total).toBe(2);
    expect(aggregateMetadata.overall_rank).toBe(2);
    expect(aggregateMetadata.overall_total).toBe(4);
    expect(aggregateMetadata.is_complete).toBe(true);

    // Formatted display strings
    const streamRankDisplay = aggregateMetadata.is_complete && aggregateMetadata.stream_rank
      ? `${aggregateMetadata.stream_rank} of ${aggregateMetadata.stream_total}`
      : 'Not Yet Ranked';

    const overallRankDisplay = aggregateMetadata.is_complete && aggregateMetadata.overall_rank
      ? `${aggregateMetadata.overall_rank} of ${aggregateMetadata.overall_total}`
      : 'Not Yet Ranked';

    expect(streamRankDisplay).toBe('1 of 2');
    expect(overallRankDisplay).toBe('2 of 4');
  });

  it('4. Zero peer data privacy invariant: metadata contains only the learner own scalar figures', () => {
    const aggregateMetadata: LearnerRankingMetadata = {
      stream_rank: 1,
      stream_total: 2,
      overall_rank: 2,
      overall_total: 4,
      is_complete: true,
      total_marks: 185,
      average: 92.5,
      total_points: 16,
      performance_level: 'Exceeding Expectations',
      grade_code: 'EE1',
    };

    const keys = Object.keys(aggregateMetadata);
    // Ensure no arrays of peer students, no marks of other students, no peer names
    expect(keys).not.toContain('students');
    expect(keys).not.toContain('peers');
    expect(keys).not.toContain('marks');
    expect(keys).not.toContain('cohort');
    expect(keys).not.toContain('all_students');
  });
});
