import { describe, it, expect } from 'vitest';
import { calculateExamResults, calculateSubjectRank } from './analysisEngine';
import { Student, ClassStream, Subject, Mark, Grade } from '../types';

describe('Learner Portal & Report Card Marks Matching and Provisional Status Resolution', () => {
  const mockClass: ClassStream = {
    id: 'class-g9-red',
    class_name: 'Grade 9',
    stream: 'Red',
    stream_id: 'class-g9-red',
    education_level: 'Junior School',
    allocated_subject_ids: ['sub-math-uuid', 'sub-eng-uuid'],
  };

  const mockSubjects: Subject[] = [
    {
      id: 'sub-math-uuid',
      subject_name: 'Mathematics',
      subject_code: 'MATH',
      category: 'Core',
      education_level: 'Junior School',
    },
    {
      id: 'sub-eng-uuid',
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      education_level: 'Junior School',
    },
  ];

  const mockGrades: Grade[] = [
    { id: 'g-ee1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 80, maximum_score: 100, points: 8, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'g-me1', grade_code: 'ME1', performance_level: 'ME', minimum_score: 60, maximum_score: 79, points: 6, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
    { id: 'g-ae1', grade_code: 'AE1', performance_level: 'AE', minimum_score: 40, maximum_score: 59, points: 4, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
    { id: 'g-be1', grade_code: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 39, points: 2, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  ];

  const studentMarcus: Student = {
    id: '4901f465-a1b2-c3d4-e5f6-7890abcdef12', // Valid UUID
    admission_number: '230',
    full_name: 'Marcus Jordan',
    gender: 'M',
    class_id: 'class-g9-red',
    stream_id: 'class-g9-red',
    grade: 'Grade 9',
    active: true,
  };

  it('correctly associates marks stored with admission number to a student identified by UUID', () => {
    // Marks stored with student_id = '230' (admission number)
    const marksWithAdmNumber: Mark[] = [
      {
        id: 'mark-1',
        student_id: '230',
        subject_id: 'sub-math-uuid',
        exam_id: 'exam-opener-1',
        marks: 85,
        raw_score: 85,
        out_of: 100,
      },
      {
        id: 'mark-2',
        student_id: '230',
        subject_id: 'sub-eng-uuid',
        exam_id: 'exam-opener-1',
        marks: 90,
        raw_score: 90,
        out_of: 100,
      },
    ];

    const results = calculateExamResults(
      'exam-opener-1',
      [studentMarcus],
      marksWithAdmNumber,
      mockGrades,
      [mockClass],
      mockSubjects
    );

    expect(results.length).toBe(1);
    const marcusResult = results[0];
    expect(marcusResult.student_id).toBe(studentMarcus.id);
    expect(marcusResult.is_complete).toBe(true);
    expect(marcusResult.total_marks).toBe(175);
    expect(marcusResult.average).toBe(87.5);
    expect(marcusResult.performance_level).toBe('EE');
  });

  it('correctly associates marks stored with student UUID to student and calculates subject rank', () => {
    // Marks stored with student_id = Marcus UUID
    const marksWithUuid: Mark[] = [
      {
        id: 'mark-1',
        student_id: '4901f465-a1b2-c3d4-e5f6-7890abcdef12',
        subject_id: 'sub-math-uuid',
        exam_id: 'exam-opener-1',
        marks: 85,
        raw_score: 85,
        out_of: 100,
      },
      {
        id: 'mark-2',
        student_id: '4901f465-a1b2-c3d4-e5f6-7890abcdef12',
        subject_id: 'sub-eng-uuid',
        exam_id: 'exam-opener-1',
        marks: 90,
        raw_score: 90,
        out_of: 100,
      },
    ];

    const results = calculateExamResults(
      'exam-opener-1',
      [studentMarcus],
      marksWithUuid,
      mockGrades,
      [mockClass],
      mockSubjects
    );

    expect(results.length).toBe(1);
    const marcusResult = results[0];
    expect(marcusResult.is_complete).toBe(true);
    expect(marcusResult.performance_level).toBe('EE');

    const mathRank = calculateSubjectRank(
      studentMarcus,
      'sub-math-uuid',
      'exam-opener-1',
      [studentMarcus],
      [mockClass],
      marksWithUuid
    );
    expect(mathRank).toBe('1/1');
  });

  it('correctly handles subject rank when marks use admission number', () => {
    const marksWithAdmNumber: Mark[] = [
      {
        id: 'mark-1',
        student_id: '230',
        subject_id: 'sub-math-uuid',
        exam_id: 'exam-opener-1',
        marks: 85,
        raw_score: 85,
        out_of: 100,
      },
    ];

    const mathRank = calculateSubjectRank(
      studentMarcus,
      'sub-math-uuid',
      'exam-opener-1',
      [studentMarcus],
      [mockClass],
      marksWithAdmNumber
    );
    expect(mathRank).toBe('1/1');
  });
});
