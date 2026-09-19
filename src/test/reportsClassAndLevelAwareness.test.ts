import { describe, it, expect } from 'vitest';
import { isClassInExamScope, isLearnerInExamScope, getFilteredStudents } from '../utils/filterUtils';
import { ClassStream, Examination, Student, getEducationLevelForGrade } from '../types';

describe('Reports & Merit Lists: Class-Aware & Level-Aware Scoping', () => {
  const classes: ClassStream[] = [
    { id: 'c1', class_name: 'Grade 9', stream: 'East', stream_id: 's1', education_level: 'Junior School' },
    { id: 'c2', class_name: 'Grade 9', stream: 'West', stream_id: 's2', education_level: 'Junior School' },
    { id: 'c3', class_name: 'Grade 8', stream: 'North', stream_id: 's3', education_level: 'Junior School' },
    { id: 'c4', class_name: 'Grade 6', stream: 'Blue', stream_id: 's4', education_level: 'Upper Primary' },
    { id: 'c5', class_name: 'Grade 3', stream: 'Red', stream_id: 's5', education_level: 'Lower Primary' },
    { id: 'c6', class_name: 'PP2', stream: 'Yellow', stream_id: 's6', education_level: 'Pre-Primary' },
  ];

  const students: Student[] = [
    { id: 'st1', full_name: 'Alice G9', admission_number: 'ADM01', class_id: 'c1', stream_id: 's1', gender: 'F', active: true },
    { id: 'st2', full_name: 'Bob G9', admission_number: 'ADM02', class_id: 'c2', stream_id: 's2', gender: 'M', active: true },
    { id: 'st3', full_name: 'Charlie G8', admission_number: 'ADM03', class_id: 'c3', stream_id: 's3', gender: 'M', active: true },
    { id: 'st4', full_name: 'David G6', admission_number: 'ADM04', class_id: 'c4', stream_id: 's4', gender: 'M', active: true },
    { id: 'st5', full_name: 'Eve G3', admission_number: 'ADM05', class_id: 'c5', stream_id: 's5', gender: 'F', active: true },
    { id: 'st6', full_name: 'Frank PP2', admission_number: 'ADM06', class_id: 'c6', stream_id: 's6', gender: 'M', active: true },
  ];

  const grade9ExamAllStreams: Examination = {
    id: 'exam-g9-all',
    exam_name: 'Grade 9 Mid Term Assessment',
    term: 'Term 1',
    year: 2026,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
    education_level: 'Junior School',
    class_id: 'Grade 9', // Scoped to Grade 9 across all streams
  };

  const grade9ExamSpecificStream: Examination = {
    id: 'exam-g9-stream',
    exam_name: 'Grade 9 East Mid Term Assessment',
    term: 'Term 1',
    year: 2026,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
    education_level: 'Junior School',
    class_id: 'c1', // Specific to Grade 9 East
  };

  const jsLevelExam: Examination = {
    id: 'exam-js',
    exam_name: 'Junior School End Term Assessment',
    term: 'Term 1',
    year: 2026,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
    education_level: 'Junior School',
  };

  const upLevelExam: Examination = {
    id: 'exam-up',
    exam_name: 'Upper Primary Opener Assessment',
    term: 'Term 1',
    year: 2026,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
    education_level: 'Upper Primary',
  };

  const schoolWideExam: Examination = {
    id: 'exam-all',
    exam_name: 'All School Diagnostic Assessment',
    term: 'Term 1',
    year: 2026,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
    education_level: 'All Levels' as any,
  };

  it('1. Correctly scopes classes for Grade 9 grade-wide and stream-specific assessments', () => {
    const inScopeGrade = classes.filter((c) => isClassInExamScope(c, grade9ExamAllStreams));
    expect(inScopeGrade.map((c) => c.class_name)).toEqual(['Grade 9', 'Grade 9']);
    expect(inScopeGrade.some((c) => c.class_name === 'Grade 8')).toBe(false);

    const inScopeStream = classes.filter((c) => isClassInExamScope(c, grade9ExamSpecificStream));
    expect(inScopeStream.map((c) => c.id)).toEqual(['c1']);
  });

  it('2. Correctly scopes classes for Junior School level-wide assessment', () => {
    const inScope = classes.filter((c) => isClassInExamScope(c, jsLevelExam));
    const distinctGrades = Array.from(new Set(inScope.map((c) => c.class_name)));
    expect(distinctGrades).toEqual(['Grade 9', 'Grade 8']);
    expect(inScope.some((c) => c.class_name === 'Grade 6')).toBe(false);
    expect(inScope.some((c) => c.class_name === 'Grade 3')).toBe(false);
  });

  it('3. Correctly scopes classes for Upper Primary level-wide assessment', () => {
    const inScope = classes.filter((c) => isClassInExamScope(c, upLevelExam));
    expect(inScope.map((c) => c.class_name)).toEqual(['Grade 6']);
  });

  it('4. Correctly scopes all classes for School-Wide assessment', () => {
    const inScope = classes.filter((c) => isClassInExamScope(c, schoolWideExam));
    expect(inScope.length).toBe(classes.length);
  });

  it('5. Filters students correctly when class and stream are selected with exam scope', () => {
    // When Grade 9 is selected for JS Exam
    const g9Students = getFilteredStudents(students, classes, 'Grade 9', 'all', jsLevelExam);
    expect(g9Students.map((s) => s.full_name)).toEqual(['Alice G9', 'Bob G9']);

    // When specific stream is selected
    const g9EastStudents = getFilteredStudents(students, classes, 'Grade 9', 's1', jsLevelExam);
    expect(g9EastStudents.map((s) => s.full_name)).toEqual(['Alice G9']);
  });

  it('6. Maps education level correctly across all CBE grades', () => {
    expect(getEducationLevelForGrade('Grade 9')).toBe('Junior School');
    expect(getEducationLevelForGrade('Grade 8')).toBe('Junior School');
    expect(getEducationLevelForGrade('Grade 7')).toBe('Junior School');
    expect(getEducationLevelForGrade('Grade 6')).toBe('Upper Primary');
    expect(getEducationLevelForGrade('Grade 5')).toBe('Upper Primary');
    expect(getEducationLevelForGrade('Grade 4')).toBe('Upper Primary');
    expect(getEducationLevelForGrade('Grade 3')).toBe('Lower Primary');
    expect(getEducationLevelForGrade('Grade 2')).toBe('Lower Primary');
    expect(getEducationLevelForGrade('Grade 1')).toBe('Lower Primary');
    expect(getEducationLevelForGrade('PP2')).toBe('Pre-Primary');
    expect(getEducationLevelForGrade('PP1')).toBe('Pre-Primary');
  });
});
