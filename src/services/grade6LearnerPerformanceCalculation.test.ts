import { describe, it, expect } from 'vitest';
import { calculateExamResults, getGradeForMark, validateCalculationData } from './analysisEngine';
import { Student, Mark, Grade, ClassStream, Subject } from '../types';

describe('Grade 6 Learner Performance Calculation Suite', () => {
  // 1. Setup mock Upper Primary (Grade 6) subjects
  const grade6Subjects: Subject[] = [
    { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' } as Subject,
    { id: 'sub_comp', subject_name: 'English Composition', subject_code: 'COMP', category: 'Core' } as Subject,
    { id: 'sub_kisw', subject_name: 'Kiswahili', subject_code: 'KISW', category: 'Core' } as Subject,
    { id: 'sub_insha', subject_name: 'Kiswahili Insha', subject_code: 'INSHA', category: 'Core' } as Subject,
    { id: 'sub_mat', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core' } as Subject,
    { id: 'sub_sci', subject_name: 'Science and Technology', subject_code: 'SCI', category: 'Core' } as Subject,
    { id: 'sub_cas', subject_name: 'Creative Arts', subject_code: 'CAS', category: 'Core' } as Subject,
    { id: 'sub_ss', subject_name: 'Social Studies & CRE', subject_code: 'SS&CRE', category: 'Core' } as Subject,
  ];

  const grade6Class: ClassStream = {
    id: 'cls_g6',
    class_name: 'Grade 6',
    stream: 'East',
    education_level: 'Upper Primary',
  } as ClassStream;

  const samuelKuria: Student = {
    id: 'std_samuel',
    full_name: 'Samuel Kuria',
    admission_number: 'ADM-001',
    class_id: 'cls_g6',
    stream_id: 'cls_g6',
    grade: 'Grade 6',
    active: true,
  } as Student;

  const samuelMarks: Mark[] = [
    { id: 'm1', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_eng', score: 48, marks_obtained: 48 } as Mark,
    { id: 'm2', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_comp', score: 26, marks_obtained: 26 } as Mark,
    { id: 'm3', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_kisw', score: 58, marks_obtained: 58 } as Mark,
    { id: 'm4', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_insha', score: 16, marks_obtained: 16 } as Mark,
    { id: 'm5', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_mat', score: 87, marks_obtained: 87 } as Mark,
    { id: 'm6', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_sci', score: 76, marks_obtained: 76 } as Mark,
    { id: 'm7', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_cas', score: 68, marks_obtained: 68 } as Mark,
    { id: 'm8', student_id: 'std_samuel', exam_id: 'exam_1', subject_id: 'sub_ss', score: 74, marks_obtained: 74 } as Mark,
  ];

  it('calculates Samuel Kuria Grade 6 results accurately according to Upper Primary engine', () => {
    const results = calculateExamResults(
      'exam_1',
      [samuelKuria],
      samuelMarks,
      [], // default grades
      [grade6Class],
      grade6Subjects
    );

    expect(results.length).toBe(1);
    const r = results[0];

    // Standard CBE Percentage mode: total marks = 587 out of 600 total max marks
    expect(r.total_marks).toBe(587);

    // Canonical average: 587 / 8 = 73.375
    expect(r.average).toBe(73.375);
    expect(Math.round(r.average)).toBe(73);

    // Expected CBE level: 4-point scale ME (51-75)
    expect(r.grade_code).toBe('ME');
    expect(r.performance_level).toBe('ME');
    expect(r.points).toBe(3);

    // Total max marks: 800 (8 subjects * 100 percentage points each)
    expect(r.total_max_marks).toBe(800);
    expect(r.subject_count).toBe(8);
    expect(r.is_complete).toBe(true);
  });

  it('strictly enforces Upper Primary 4-point levels in getGradeForMark', () => {
    const gEE = getGradeForMark(85, [], 'Upper Primary', 'Grade 6');
    expect(gEE.grade_code).toBe('EE');
    expect(gEE.points).toBe(4);

    const gME = getGradeForMark(65, [], 'Upper Primary', 'Grade 6');
    expect(gME.grade_code).toBe('ME');
    expect(gME.points).toBe(3);

    const gAE = getGradeForMark(40, [], 'Upper Primary', 'Grade 6');
    expect(gAE.grade_code).toBe('AE');
    expect(gAE.points).toBe(2);

    const gBE = getGradeForMark(20, [], 'Upper Primary', 'Grade 6');
    expect(gBE.grade_code).toBe('BE');
    expect(gBE.points).toBe(1);
  });

  it('strictly enforces Junior School 8-point scale in getGradeForMark', () => {
    const gJS_EE1 = getGradeForMark(90, [], 'Junior School', 'Grade 8');
    expect(gJS_EE1.grade_code).toBe('EE1');
    expect(gJS_EE1.points).toBe(8);

    const gJS_ME1 = getGradeForMark(60, [], 'Junior School', 'Grade 7');
    expect(gJS_ME1.grade_code).toBe('ME1');
    expect(gJS_ME1.points).toBe(6);
  });

  it('passes validateCalculationData with 0 errors', () => {
    const results = calculateExamResults(
      'exam_1',
      [samuelKuria],
      samuelMarks,
      [],
      [grade6Class],
      grade6Subjects
    );
    const validation = validateCalculationData(results, samuelMarks, [], grade6Subjects);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
