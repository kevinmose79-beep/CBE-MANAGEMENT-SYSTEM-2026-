import { describe, it, expect } from 'vitest';
import { calculateSchoolAnalytics } from '../services/schoolAnalyticsEngine';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Examination, Student, ClassStream, Subject, Mark } from '../types';

describe('Analytics Class & Stream Ranking Presentation & Consistency Test', () => {
  const dummyExam: Examination = {
    id: 'exam-1',
    exam_name: 'Opener Exam',
    term: 'Term 1',
    year: 2026,
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
    created_at: '2026-01-10T00:00:00Z',
  };

  const dummyClasses: ClassStream[] = [
    { id: 'c1', stream_id: 's1', class_name: 'Grade 8', stream: 'Blue', capacity: 45 },
    { id: 'c2', stream_id: 's2', class_name: 'Grade 7', stream: 'Red', capacity: 45 },
  ];

  const dummySubjects: Subject[] = [
    { id: 'sub-1', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Junior School' },
    { id: 'sub-2', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Junior School' },
    { id: 'sub-3', subject_name: 'Integrated Science', subject_code: 'INT-SCI', category: 'Core', education_level: 'Junior School' },
  ];

  const dummyStudents: Student[] = [
    { id: 'std-1', admission_number: 'ADM-001', full_name: 'Learner One', gender: 'M', grade: 'Grade 8', class_id: 'c1', stream_id: 's1', active: true },
    { id: 'std-2', admission_number: 'ADM-002', full_name: 'Learner Two', gender: 'F', grade: 'Grade 8', class_id: 'c1', stream_id: 's1', active: true },
    { id: 'std-3', admission_number: 'ADM-003', full_name: 'Learner Three', gender: 'M', grade: 'Grade 7', class_id: 'c2', stream_id: 's2', active: true },
  ];

  const dummyMarks: Mark[] = [
    // Learner One in Grade 8 Blue: 80, 80, 80 => tot=240, avg=80
    { id: 'm1', exam_id: 'exam-1', student_id: 'std-1', subject_id: 'sub-1', marks: 80 },
    { id: 'm2', exam_id: 'exam-1', student_id: 'std-1', subject_id: 'sub-2', marks: 80 },
    { id: 'm3', exam_id: 'exam-1', student_id: 'std-1', subject_id: 'sub-3', marks: 80 },
    // Learner Two in Grade 8 Blue: 60, 60, 60 => tot=180, avg=60
    { id: 'm4', exam_id: 'exam-1', student_id: 'std-2', subject_id: 'sub-1', marks: 60 },
    { id: 'm5', exam_id: 'exam-1', student_id: 'std-2', subject_id: 'sub-2', marks: 60 },
    { id: 'm6', exam_id: 'exam-1', student_id: 'std-2', subject_id: 'sub-3', marks: 60 },
    // Learner Three in Grade 7 Red: 70, 70, 70 => tot=210, avg=70
    { id: 'm7', exam_id: 'exam-1', student_id: 'std-3', subject_id: 'sub-1', marks: 70 },
    { id: 'm8', exam_id: 'exam-1', student_id: 'std-3', subject_id: 'sub-2', marks: 70 },
    { id: 'm9', exam_id: 'exam-1', student_id: 'std-3', subject_id: 'sub-3', marks: 70 },
  ];

  it('calculates class and stream rankings correctly with Class Average Marks', () => {
    const analytics = calculateSchoolAnalytics(
      'exam-1',
      [dummyExam],
      dummyStudents,
      dummyClasses,
      dummySubjects,
      dummyMarks,
      CBE_8_POINT_GRADES,
      'Junior School'
    );

    expect(analytics).not.toBeNull();
    expect(analytics?.class_rankings).toHaveLength(2);
    expect(analytics?.stream_rankings).toHaveLength(2);

    // Grade 8: Learner 1 (240) + Learner 2 (180) = Total 420.
    // Count = 2. Class Average Marks = 420 / 2 = 210.
    const g8Class = analytics?.class_rankings.find((c) => c.class_name === 'Grade 8');
    expect(g8Class).toBeDefined();
    expect(g8Class?.learners_count).toBe(2);
    expect(g8Class?.total_marks).toBe(420);
    expect(g8Class?.mean_marks).toBe(210); // Class Average Marks
    expect(g8Class?.mean_percentage).toBe(70);

    // Grade 8 Blue Stream:
    const g8Stream = analytics?.stream_rankings.find((st) => st.class_name === 'Grade 8');
    expect(g8Stream).toBeDefined();
    expect(g8Stream?.learners_count).toBe(2);
    expect(g8Stream?.total_marks).toBe(420);
    expect(g8Stream?.mean_marks).toBe(210); // Class Average Marks
    expect(g8Stream?.mean_percentage).toBe(70);

    // Grade 7: Learner 3 = Total 210. Count = 1. Class Average Marks = 210.
    const g7Class = analytics?.class_rankings.find((c) => c.class_name === 'Grade 7');
    expect(g7Class).toBeDefined();
    expect(g7Class?.learners_count).toBe(1);
    expect(g7Class?.total_marks).toBe(210);
    expect(g7Class?.mean_marks).toBe(210);
    expect(g7Class?.mean_percentage).toBe(70);
  });

  it('correctly handles unassessed students in a class so they do not dilute class average marks', () => {
    // Add 8 unassessed students to Grade 8 (making total 10 students in Grade 8)
    const expandedStudents = [...dummyStudents];
    for (let i = 4; i <= 11; i++) {
      expandedStudents.push({
        id: `std-${i}`,
        admission_number: `ADM-00${i}`,
        full_name: `Unassessed Learner ${i}`,
        gender: 'M',
        grade: 'Grade 8',
        class_id: 'c1',
        stream_id: 's1',
        active: true,
      });
    }

    const analytics = calculateSchoolAnalytics(
      'exam-1',
      [dummyExam],
      expandedStudents,
      dummyClasses,
      dummySubjects,
      dummyMarks,
      CBE_8_POINT_GRADES,
      'Junior School'
    );

    expect(analytics).not.toBeNull();
    const g8Class = analytics?.class_rankings.find((c) => c.class_name === 'Grade 8');
    expect(g8Class).toBeDefined();
    // Only 2 assessed learners in Grade 8
    expect(g8Class?.learners_count).toBe(2);
    expect(g8Class?.total_marks).toBe(420);
    expect(g8Class?.mean_marks).toBe(210); // Class Average Marks matches 420 / 2, not 420 / 10
    expect(g8Class?.mean_percentage).toBe(70); // 70%, not 7%
    expect(g8Class?.overall_level).toBe('ME');
  });
});
