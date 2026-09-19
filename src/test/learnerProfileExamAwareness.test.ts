import { describe, it, expect } from 'vitest';
import { Student, Examination, ClassStream, Subject, Grade } from '../types';
import { buildLearnerTrajectory } from '../services/learnerTrajectoryEngine';

describe('Learner Profile Exam-Aware Scope Filtering', () => {
  const classes: ClassStream[] = [
    { id: 'cls_g6', class_name: 'Grade 6', stream: 'Blue', education_level: 'Upper Primary' },
    { id: 'cls_g9', class_name: 'Grade 9', stream: 'Blue', education_level: 'Junior School' },
  ];

  const studentGrade9: Student = {
    id: 'std_g9',
    full_name: 'Catherine Mwihaki',
    admission_number: 'ADM-168',
    class_id: 'cls_g9',
    grade: 'Grade 9',
    gender: 'F',
    active: true,
  };

  const exams: Examination[] = [
    {
      id: 'ex_g9_opener',
      exam_name: 'Grade 9 Opener Assessment Term 3 2026',
      year: 2026,
      term: 'Term 3',
      status: 'Published',
      class_id: 'cls_g9',
      exam_type: 'End-Term',
      max_marks: 100,
    },
    {
      id: 'ex_g6_kpsea',
      exam_name: 'GRADE 6 KPSEA SECOND TRIAL TERM 3 2026',
      year: 2026,
      term: 'Term 3',
      status: 'Published',
      class_id: 'cls_g6',
      exam_type: 'End-Term',
      max_marks: 100,
    },
    {
      id: 'ex_g6_opener',
      exam_name: 'Grade 6 Opener Assessment Term 3 2026',
      year: 2026,
      term: 'Term 3',
      status: 'Published',
      class_id: 'cls_g6',
      exam_type: 'End-Term',
      max_marks: 100,
    },
    {
      id: 'ex_g9_kjsea',
      exam_name: 'GRADE 9 KJSEA SECOND TRIAL TERM 3 2026',
      year: 2026,
      term: 'Term 3',
      status: 'Published',
      class_id: 'cls_g9',
      exam_type: 'End-Term',
      max_marks: 100,
    },
  ];

  it('filters out Grade 6 examinations for a Grade 9 learner when building trajectory', () => {
    const trajectory = buildLearnerTrajectory(studentGrade9, exams, [], [], [], classes);
    const inScopeExamIds = trajectory.all_milestones.map((m) => m.exam_id);

    expect(inScopeExamIds).toContain('ex_g9_opener');
    expect(inScopeExamIds).toContain('ex_g9_kjsea');
    expect(inScopeExamIds).not.toContain('ex_g6_kpsea');
    expect(inScopeExamIds).not.toContain('ex_g6_opener');
  });
});
