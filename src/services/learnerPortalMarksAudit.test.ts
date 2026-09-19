import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, setStorage, KEYS } from '../lib/storage';
import { calculateExamResults } from './analysisEngine';
import { Student, Mark, Examination, Subject, User, ClassStream, Grade } from '../types';

describe('Learner Portal Marks Resolution & Database Query Safety Audit', () => {
  const marcusUuid = '4901f465-a1b2-c3d4-e5f6-7890abcdef12';
  const examUuid = '8901f465-a1b2-c3d4-e5f6-7890abcdef34';

  const mockMarcus: Student = {
    id: marcusUuid,
    admission_number: '230',
    full_name: 'Marcus Jordan',
    first_name: 'Marcus',
    last_name: 'Jordan',
    gender: 'M',
    grade: 'Grade 9',
    class_id: 'class-g9',
    stream_id: 'stream-red',
    active: true,
    enrolment_status: 'active',
  };

  const mockExam: Examination = {
    id: examUuid,
    exam_name: 'Opener 1 — Term 2 2026',
    term: 'Term 2',
    year: 2026,
    academic_year_id: 'ay-2026',
    term_id: 'term-2-2026',
    status: 'Approved',
    exam_type: 'CAT',
    max_marks: 100,
  };

  const mockSubjects: Subject[] = [
    { id: 'subj-1', subject_name: 'Mathematics', subject_code: 'MATH', education_level: 'Junior School', department: 'STEM', category: 'Core', status: 'Active' },
    { id: 'subj-2', subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School', department: 'Languages', category: 'Core', status: 'Active' },
    { id: 'subj-3', subject_name: 'Kiswahili', subject_code: 'KISW', education_level: 'Junior School', department: 'Languages', category: 'Core', status: 'Active' },
    { id: 'subj-4', subject_name: 'Integrated Science', subject_code: 'IS', education_level: 'Junior School', department: 'STEM', category: 'Core', status: 'Active' },
    { id: 'subj-5', subject_name: 'Social Studies', subject_code: 'SS', education_level: 'Junior School', department: 'Humanities', category: 'Core', status: 'Active' },
    { id: 'subj-6', subject_name: 'CRE', subject_code: 'CRE', education_level: 'Junior School', department: 'Humanities', category: 'Core', status: 'Active' },
    { id: 'subj-7', subject_name: 'Pre-Technical Studies', subject_code: 'PTS', education_level: 'Junior School', department: 'Technical', category: 'Core', status: 'Active' },
    { id: 'subj-8', subject_name: 'Agriculture', subject_code: 'AGR', education_level: 'Junior School', department: 'Technical', category: 'Core', status: 'Active' },
    { id: 'subj-9', subject_name: 'Creative Arts & Sports', subject_code: 'CAS', education_level: 'Junior School', department: 'Creative Arts', category: 'Core', status: 'Active' },
  ];

  const mockGrades: Grade[] = [
    { id: 'g-1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 80, maximum_score: 100, descriptor: 'Exceeding Expectations', points: 4, remarks: 'Exceeding Expectations' },
    { id: 'g-2', grade_code: 'ME1', performance_level: 'ME', minimum_score: 60, maximum_score: 79, descriptor: 'Meeting Expectations', points: 3, remarks: 'Meeting Expectations' },
    { id: 'g-3', grade_code: 'AE1', performance_level: 'AE', minimum_score: 40, maximum_score: 59, descriptor: 'Approaching Expectations', points: 2, remarks: 'Approaching Expectations' },
    { id: 'g-4', grade_code: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 39, descriptor: 'Below Expectations', points: 1, remarks: 'Below Expectations' },
  ];

  // 9 subjects, each 87/100 => 783/900 (87%)
  const mockMarks: Mark[] = mockSubjects.map((s, idx) => ({
    id: `mark-${idx + 1}`,
    student_id: marcusUuid,
    subject_id: s.id,
    exam_id: examUuid,
    marks: 87,
    raw_score: 87,
    out_of: 100,
    special_status: 'Normal',
    updated_at: new Date().toISOString(),
  }));

  beforeEach(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      const store = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        length: store.size,
      };
    }
    localStorage.clear();
    setStorage(KEYS.STUDENTS, [mockMarcus]);
    setStorage(KEYS.EXAMS, [mockExam]);
    setStorage(KEYS.SUBJECTS, mockSubjects);
    setStorage(KEYS.MARKS, mockMarks);
    setStorage(KEYS.GRADES, mockGrades);
  });

  it('correctly calculates Marcus Jordan results as 783/900, 87%, EE2 in analysisEngine', () => {
    const results = calculateExamResults(examUuid, [mockMarcus], mockMarks, mockGrades, [], mockSubjects);
    expect(results).toHaveLength(1);
    const marcusResult = results[0];
    expect(marcusResult.student_id).toBe(marcusUuid);
    expect(marcusResult.total_marks).toBe(783);
    expect(marcusResult.average).toBe(87);
    expect(marcusResult.performance_level).toBe('EE');
    expect(marcusResult.is_complete).toBe(true);
  });

  it('matches student marks when mark.student_id is canonical UUID', () => {
    const results = calculateExamResults(
      examUuid,
      [mockMarcus],
      [{ ...mockMarks[0], student_id: marcusUuid }],
      mockGrades,
      [],
      mockSubjects
    );
    expect(results[0].total_marks).toBe(87);
  });

  it('matches student marks when mark.student_id is admission number', () => {
    const results = calculateExamResults(
      examUuid,
      [mockMarcus],
      [{ ...mockMarks[0], student_id: '230' }],
      mockGrades,
      [],
      mockSubjects
    );
    expect(results[0].total_marks).toBe(87);
  });
});
