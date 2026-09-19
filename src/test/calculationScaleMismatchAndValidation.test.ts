import { describe, it, expect } from 'vitest';
import { calculateExamResults, validateCalculationData } from '../services/analysisEngine';
import { Student, Mark, Grade, ClassStream, Subject, Examination } from '../types';
import { CBE_4_POINT_GRADES, CBE_8_POINT_GRADES } from '../services/analysisEngine';

describe('Surgical Verification — Calculation Engine Scale Mismatch & Composite Integrity', () => {
  const dummyGrades: Grade[] = CBE_4_POINT_GRADES;

  const upperPrimaryClass: ClassStream = {
    id: 'class_g4',
    class_name: 'Grade 4',
    stream: 'North',
    stream_id: 'stream_g4_north',
    education_level: 'Upper Primary',
    allocated_subject_ids: ['sub_eng', 'sub_comp', 'sub_sst'],
  };

  const students: Student[] = [
    {
      id: '9c188d60-598c-4cb7-bcdb-45f80c9abf64', // Student 30
      first_name: 'Student',
      last_name: 'Thirty',
      full_name: 'Student Thirty',
      gender: 'M',
      active: true,
      admission_number: '30',
      grade: 'Grade 4',
      class_id: 'class_g4',
      stream_id: 'stream_g4_north',
      enrolment_status: 'active',
    },
    {
      id: '7eb41e04-858c-482f-9fdc-7cdec737192c', // Student 32
      first_name: 'Student',
      last_name: 'ThirtyTwo',
      full_name: 'Student ThirtyTwo',
      gender: 'F',
      active: true,
      admission_number: '32',
      grade: 'Grade 4',
      class_id: 'class_g4',
      stream_id: 'stream_g4_north',
      enrolment_status: 'active',
    },
    {
      id: '930636ad-3677-414f-b88a-f935f24532e3', // Student 40
      first_name: 'Student',
      last_name: 'Forty',
      full_name: 'Student Forty',
      gender: 'M',
      active: true,
      admission_number: '40',
      grade: 'Grade 4',
      class_id: 'class_g4',
      stream_id: 'stream_g4_north',
      enrolment_status: 'active',
    },
  ];

  const subjects: Subject[] = [
    { id: 'sub_eng', subject_code: 'ENG', subject_name: 'English Language', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sub_comp', subject_code: 'COMP', subject_name: 'English Composition', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sub_sst', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Upper Primary', category: 'Core' },
  ];

  it('Case Student 32: single paper out_of 30 results in matching percentage unit total_max_marks (100)', () => {
    // Student 32 has 1 mark: SST score 21 out of 30 (70%)
    const marks: Mark[] = [
      {
        id: 'm32_1',
        student_id: '7eb41e04-858c-482f-9fdc-7cdec737192c',
        exam_id: 'exam_term1',
        subject_id: 'sub_sst',
        marks: 21,
        raw_score: 21,
        out_of: 30,
      },
    ];

    const results = calculateExamResults('exam_term1', students, marks, dummyGrades, [upperPrimaryClass], subjects);
    const res32 = results.find((r) => r.student_id === '7eb41e04-858c-482f-9fdc-7cdec737192c');

    expect(res32).toBeDefined();
    expect(res32?.subject_count).toBe(1);
    expect(res32?.total_marks).toBe(70);
    expect(res32?.total_max_marks).toBe(100); // 1 subject * 100
    expect(res32!.total_marks!).toBeLessThanOrEqual(res32!.total_max_marks!);

    const validation = validateCalculationData(results, marks, dummyGrades, subjects);
    expect(validation.errors).toHaveLength(0);
  });

  it('Case Student 30 & 40: ENG(60) + COMP(40) + SST(30) composite results use uniform percentage scale (200 max)', () => {
    // Student 30: ENG 38/60, COMP 25/40 (Composite ENG = 63%), SST 21/30 (70%) -> total 133, max 200
    const marks: Mark[] = [
      {
        id: 'm30_eng',
        student_id: '9c188d60-598c-4cb7-bcdb-45f80c9abf64',
        exam_id: 'exam_term1',
        subject_id: 'sub_eng',
        marks: 38,
        raw_score: 38,
        out_of: 60,
      },
      {
        id: 'm30_comp',
        student_id: '9c188d60-598c-4cb7-bcdb-45f80c9abf64',
        exam_id: 'exam_term1',
        subject_id: 'sub_comp',
        marks: 25,
        raw_score: 25,
        out_of: 40,
      },
      {
        id: 'm30_sst',
        student_id: '9c188d60-598c-4cb7-bcdb-45f80c9abf64',
        exam_id: 'exam_term1',
        subject_id: 'sub_sst',
        marks: 21,
        raw_score: 21,
        out_of: 30,
      },
      // Student 40 same marks
      {
        id: 'm40_eng',
        student_id: '930636ad-3677-414f-b88a-f935f24532e3',
        exam_id: 'exam_term1',
        subject_id: 'sub_eng',
        marks: 38,
        raw_score: 38,
        out_of: 60,
      },
      {
        id: 'm40_comp',
        student_id: '930636ad-3677-414f-b88a-f935f24532e3',
        exam_id: 'exam_term1',
        subject_id: 'sub_comp',
        marks: 25,
        raw_score: 25,
        out_of: 40,
      },
      {
        id: 'm40_sst',
        student_id: '930636ad-3677-414f-b88a-f935f24532e3',
        exam_id: 'exam_term1',
        subject_id: 'sub_sst',
        marks: 21,
        raw_score: 21,
        out_of: 30,
      },
    ];

    const results = calculateExamResults('exam_term1', students, marks, dummyGrades, [upperPrimaryClass], subjects);

    const res30 = results.find((r) => r.student_id === '9c188d60-598c-4cb7-bcdb-45f80c9abf64');
    expect(res30).toBeDefined();
    // 2 effective subjects: English Composite (1) + SST (1)
    expect(res30?.subject_count).toBe(2);
    expect(res30?.total_marks).toBe(133);
    expect(res30?.total_max_marks).toBe(200); // 2 * 100
    expect(res30!.total_marks!).toBeLessThanOrEqual(res30!.total_max_marks!);

    const res40 = results.find((r) => r.student_id === '930636ad-3677-414f-b88a-f935f24532e3');
    expect(res40).toBeDefined();
    expect(res40?.subject_count).toBe(2);
    expect(res40?.total_marks).toBe(133);
    expect(res40?.total_max_marks).toBe(200);
    expect(res40!.total_marks!).toBeLessThanOrEqual(res40!.total_max_marks!);

    const validation = validateCalculationData(results, marks, dummyGrades, subjects);
    expect(validation.errors).toHaveLength(0);
  });

  it('Validation guard still detects genuine invalid total > total_max_marks', () => {
    const invalidResult = [
      {
        student_id: 'std_invalid',
        total_marks: 250,
        total_max_marks: 200,
        average: 80,
        grade_code: 'ME',
        is_complete: true,
      } as any,
    ];

    const validation = validateCalculationData(invalidResult, [], dummyGrades, subjects);
    expect(validation.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
  });
});
