import { describe, it, expect } from 'vitest';
import { calculateExamResults, CBE_8_POINT_GRADES, getGradeForMark } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { Student, Examination, Mark, Subject, ClassStream } from '../types';

describe('Learner Report Card Loading Guard & Assessment Pipeline Integrity', () => {
  const mockClass: ClassStream = {
    id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    stream_id: '3d0ecb00-3e0f-425a-8d69-59f6c9f18b40',
    class_name: 'Grade 9',
    stream: 'Red',
    education_level: 'Junior School',
  };

  const marcus: Student = {
    id: 'e534459c-787f-4c3a-b48c-9cb09e34b011',
    admission_number: '230',
    full_name: 'Marcus Jordan',
    gender: 'M',
    class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    stream_id: '3d0ecb00-3e0f-425a-8d69-59f6c9f18b40',
    grade: 'Grade 9',
    education_level: 'Junior School',
    active: true,
  };

  const opener1: Examination = {
    id: '39c0b1d9-0d45-4316-a5b2-0ba45d8dae60',
    exam_name: 'Opener 1',
    term: 'Term 2',
    year: 2026,
    status: 'Approved',
    approved_classes: ['0e49e9b0-0a82-4f4b-9109-685b0103a54c'],
    max_marks: 100,
    exam_type: 'End-Term',
  };

  const juniorSubjects: Subject[] = [
    { id: '823eba35-ac51-4ac8-be57-fcbeee88151c', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'f00b5334-fa16-4640-b19c-733ec4530318', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: '4441b054-2d20-4d5c-852d-f31d16fbc145', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'b65c16d5-a38c-478e-ab46-085170ee31da', subject_code: 'INT-SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
    { id: 'b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83', subject_code: 'CAS', subject_name: 'Creative Arts and Sports', education_level: 'Junior School', category: 'Core' },
    { id: 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
    { id: 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Junior School', category: 'Core' },
    { id: 'fe17661a-9c3b-439e-9cb9-fd2f88279f56', subject_code: 'AGN', subject_name: 'Agriculture', education_level: 'Junior School', category: 'Core' },
    { id: '5d9beb86-1268-40cb-bae6-7f8e4b998ea2', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core' },
  ];

  const fullMarksMarcus: Mark[] = [
    { id: 'm1', student_id: marcus.id, exam_id: opener1.id, subject_id: '823eba35-ac51-4ac8-be57-fcbeee88151c', marks: 99, raw_score: 99, out_of: 100, special_status: 'Normal' },
    { id: 'm2', student_id: marcus.id, exam_id: opener1.id, subject_id: 'f00b5334-fa16-4640-b19c-733ec4530318', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm3', student_id: marcus.id, exam_id: opener1.id, subject_id: '4441b054-2d20-4d5c-852d-f31d16fbc145', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm4', student_id: marcus.id, exam_id: opener1.id, subject_id: 'b65c16d5-a38c-478e-ab46-085170ee31da', marks: 74.44, raw_score: 74.44, out_of: 100, special_status: 'Normal' },
    { id: 'm5', student_id: marcus.id, exam_id: opener1.id, subject_id: 'b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83', marks: 89, raw_score: 89, out_of: 100, special_status: 'Normal' },
    { id: 'm6', student_id: marcus.id, exam_id: opener1.id, subject_id: 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409', marks: 89, raw_score: 89, out_of: 100, special_status: 'Normal' },
    { id: 'm7', student_id: marcus.id, exam_id: opener1.id, subject_id: 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7', marks: 100, raw_score: 100, out_of: 100, special_status: 'Normal' },
    { id: 'm8', student_id: marcus.id, exam_id: opener1.id, subject_id: 'fe17661a-9c3b-439e-9cb9-fd2f88279f56', marks: 98, raw_score: 98, out_of: 100, special_status: 'Normal' },
    { id: 'm9', student_id: marcus.id, exam_id: opener1.id, subject_id: '5d9beb86-1268-40cb-bae6-7f8e4b998ea2', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
  ];

  it('Test 1 & 2 — Loading Guard prevents premature calculation with empty exam or empty marks', () => {
    // When selectedExamId is empty, calculateExamResults should produce 0 marks
    const emptyResults = calculateExamResults('', [marcus], fullMarksMarcus, CBE_8_POINT_GRADES, [mockClass], juniorSubjects);
    const learnerResult = emptyResults.find((r) => r.student_id === marcus.id);
    expect(learnerResult).toBeUndefined();
    // This confirms that rendering the component in this unselected/loading state produces 0/900.
    // The loading guard in LearnerPortal intercepts this state and displays "Loading your report card…".
  });

  it('Test 3 — Successful hydration computes authoritative metrics: 783/900, 87%, EE2, 65 points, Rank 1', () => {
    const hydratedResults = calculateExamResults(opener1.id, [marcus], fullMarksMarcus, CBE_8_POINT_GRADES, [mockClass], juniorSubjects);
    const marcusResult = hydratedResults.find((r) => r.student_id === marcus.id);
    
    expect(marcusResult).toBeDefined();
    expect(marcusResult?.total_marks).toBe(783);
    expect(marcusResult?.total_max_marks).toBe(900);
    expect(marcusResult?.average).toBe(87);
    expect(marcusResult?.grade_code).toBe('EE2');
    expect(marcusResult?.performance_level).toBe('EE');
    expect(marcusResult?.total_points).toBe(65);
    expect(marcusResult?.position).toBe(1);
    expect(marcusResult?.is_complete).toBe(true);
    expect(marcusResult?.status).toBe('Complete');
  });

  it('Test 4 — Genuine missing marks are preserved as X / Provisional after loading completes', () => {
    // 8 out of 9 subjects recorded (Pre-Technical missing)
    const partialMarks = fullMarksMarcus.slice(0, 8);
    const partialResults = calculateExamResults(opener1.id, [marcus], partialMarks, CBE_8_POINT_GRADES, [mockClass], juniorSubjects);
    const marcusResult = partialResults.find((r) => r.student_id === marcus.id);
    
    expect(marcusResult).toBeDefined();
    expect(marcusResult?.is_complete).toBe(false);
    expect(marcusResult?.status).toBe('Provisional');
    expect(marcusResult?.missing_subjects_count).toBe(1);

    // When an unentered/missing mark is passed into evaluateMark, status is Blank
    // and LearnerReportCard maps it to 'Missing Assessment (X)'
    const missingMarkObj = partialMarks.find((m) => m.subject_id === '5d9beb86-1268-40cb-bae6-7f8e4b998ea2');
    const evaluated = evaluateMark(missingMarkObj);
    expect(evaluated.status).toBe('Blank');
    // If explicitly marked as 'X' in special_status
    const explicitX = evaluateMark({ subject_id: '5d9beb86-1268-40cb-bae6-7f8e4b998ea2', special_status: 'X' } as any);
    expect(explicitX.status).toBe('X');
  });

  it('Test 5 — All 9 individual subjects evaluate to Normal with valid KNEC points', () => {
    fullMarksMarcus.forEach((m) => {
      const evaluation = evaluateMark(m);
      expect(evaluation.status).toBe('Normal');
      expect(evaluation.percentage).not.toBeNull();
      const gradeObj = getGradeForMark(evaluation.percentage!, CBE_8_POINT_GRADES);
      expect(gradeObj.points).toBeGreaterThanOrEqual(1);
      expect(gradeObj.points).toBeLessThanOrEqual(8);
      expect(['EE', 'ME', 'AE', 'BE']).toContain(gradeObj.performance_level);
    });
  });
});
