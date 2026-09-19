import { describe, it, expect, vi } from 'vitest';
import {
  discoverTerminalAssessments,
  isExamEligibleForTerminal,
  validateAndExtractMaxMarks,
} from '../services/terminalAssessmentDiscovery';
import {
  calculateLearnerTerminalResults,
  calculateLearningAreaTerminalResult,
  ContributingAssessmentRef,
  LearningAreaTerminalResult,
} from '../services/terminalResultsEngine';
import { Examination, Mark, Student, ClassStream, MarkResolution, Grade } from '../types';

describe('T-13 Terminal Results UI & Orchestration Layer — Forensic Verification Probe', () => {
  const mockAcademicYearId = 'year-uuid-2026';
  const mockTermId = 'term-uuid-1';

  const mockClass: ClassStream = {
    id: 'class-uuid-g7',
    stream_id: 'stream-uuid-7a',
    class_name: 'Grade 7',
    stream: '7A',
    education_level: 'Junior School',
  };

  const mockStudent: Student = {
    id: 'student-uuid-alice',
    admission_number: 'ADM-001',
    full_name: 'Alice Wanjiku',
    first_name: 'Alice',
    last_name: 'Wanjiku',
    class_id: 'class-uuid-g7',
    stream_id: 'stream-uuid-7a',
    gender: 'F',
    active: true,
    enrolment_status: 'active',
    created_at: '2026-01-05T08:00:00.000Z',
  } as any;

  const mockExams: Examination[] = [
    {
      id: 'exam-op-1',
      exam_name: 'Opener Assessment',
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      year: 2026,
      term: 'Term 1',
      exam_type: 'Opener',
      status: 'Approved',
      approved_classes: ['stream-uuid-7a'],
      max_marks: 50,
      start_date: '2026-01-15',
    },
    {
      id: 'exam-mid-2',
      exam_name: 'Mid-Term Assessment',
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      year: 2026,
      term: 'Term 1',
      exam_type: 'Mid-Term',
      status: 'Approved',
      approved_classes: ['stream-uuid-7a'],
      max_marks: 50,
      start_date: '2026-02-20',
    },
    {
      id: 'exam-end-3',
      exam_name: 'End-Term Assessment',
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      year: 2026,
      term: 'Term 1',
      exam_type: 'End-Term',
      status: 'Approved',
      approved_classes: ['stream-uuid-7a'],
      max_marks: 100,
      start_date: '2026-03-25',
    },
  ];

  const standardGrades: Grade[] = [
    { id: '1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 80, maximum_score: 100, points: 4, remarks: 'Exceeding', descriptor: 'Exceeding' },
    { id: '2', grade_code: 'ME1', performance_level: 'ME', minimum_score: 65, maximum_score: 79, points: 3, remarks: 'Meeting', descriptor: 'Meeting' },
    { id: '3', grade_code: 'AE1', performance_level: 'AE', minimum_score: 50, maximum_score: 64, points: 2, remarks: 'Approaching', descriptor: 'Approaching' },
    { id: '4', grade_code: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 49, points: 1, remarks: 'Below', descriptor: 'Below' },
  ];

  it('Probe 1: Discovery Invocation with known session, learner, class/stream', async () => {
    const discovery = await discoverTerminalAssessments({
      academicYearId: mockAcademicYearId,
      termId: mockTermId,
      student: mockStudent,
      classStream: mockClass,
      examinations: mockExams,
      marks: [],
    });

    // Verify assessment count and list
    expect(discovery.assessmentCount).toBe(3);
    expect(discovery.contributingAssessments).toHaveLength(3);
    expect(discovery.contributingAssessments[0].exam_name).toBe('Opener Assessment');
    expect(discovery.contributingAssessments[0].max_marks).toBe(50);
    expect(discovery.contributingAssessments[1].exam_name).toBe('Mid-Term Assessment');
    expect(discovery.contributingAssessments[1].max_marks).toBe(50);
    expect(discovery.contributingAssessments[2].exam_name).toBe('End-Term Assessment');
    expect(discovery.contributingAssessments[2].max_marks).toBe(100);

    // Verify max marks preservation without defaulting to 100
    expect(discovery.contributingAssessments[0].out_of).toBe(50);
    expect(discovery.contributingAssessments[2].out_of).toBe(100);
  });

  it('Probe 2: Engine Invocation passing discovered assessments directly to calculation engine', async () => {
    // Marks:
    // Math: Opener 40/50 (80%), Mid-Term 45/50 (90%), End-Term 85/100 (85%)
    // Arithmetic Mean: (80 + 90 + 85) / 3 = 85.0% -> EE1, 4 points
    // Science: Opener 35/50 (70%), Mid-Term X, End-Term 70/100 -> INCOMPLETE (X)
    // English: Opener 40/50 (80%), Mid-Term Y, End-Term 80/100 -> INCOMPLETE (Y)
    // Kiswahili: Opener 0/50 (0%), Mid-Term 0/50 (0%), End-Term 0/100 (0%) -> Genuine 0%, BE1, 1 pt
    const mockMarks: Mark[] = [
      // Math
      { id: 'm1', student_id: mockStudent.id, exam_id: 'exam-op-1', subject_id: 'sub-math', raw_score: 40, marks: 40, status: 'Normal' },
      { id: 'm2', student_id: mockStudent.id, exam_id: 'exam-mid-2', subject_id: 'sub-math', raw_score: 45, marks: 45, status: 'Normal' },
      { id: 'm3', student_id: mockStudent.id, exam_id: 'exam-end-3', subject_id: 'sub-math', raw_score: 85, marks: 85, status: 'Normal' },
      // Science
      { id: 'm4', student_id: mockStudent.id, exam_id: 'exam-op-1', subject_id: 'sub-sci', raw_score: 35, marks: 35, status: 'Normal' },
      { id: 'm5', student_id: mockStudent.id, exam_id: 'exam-mid-2', subject_id: 'sub-sci', raw_score: null, marks: 0, status: 'X', special_status: 'X' },
      { id: 'm6', student_id: mockStudent.id, exam_id: 'exam-end-3', subject_id: 'sub-sci', raw_score: 70, marks: 70, status: 'Normal' },
      // English
      { id: 'm7', student_id: mockStudent.id, exam_id: 'exam-op-1', subject_id: 'sub-eng', raw_score: 40, marks: 40, status: 'Normal' },
      { id: 'm8', student_id: mockStudent.id, exam_id: 'exam-mid-2', subject_id: 'sub-eng', raw_score: null, marks: 0, status: 'Y', special_status: 'Y' },
      { id: 'm9', student_id: mockStudent.id, exam_id: 'exam-end-3', subject_id: 'sub-eng', raw_score: 80, marks: 80, status: 'Normal' },
      // Kiswahili (Genuine 0)
      { id: 'm10', student_id: mockStudent.id, exam_id: 'exam-op-1', subject_id: 'sub-kis', raw_score: 0, marks: 0, status: 'Normal' },
      { id: 'm11', student_id: mockStudent.id, exam_id: 'exam-mid-2', subject_id: 'sub-kis', raw_score: 0, marks: 0, status: 'Normal' },
      { id: 'm12', student_id: mockStudent.id, exam_id: 'exam-end-3', subject_id: 'sub-kis', raw_score: 0, marks: 0, status: 'Normal' },
    ];

    const discovery = await discoverTerminalAssessments({
      academicYearId: mockAcademicYearId,
      termId: mockTermId,
      student: mockStudent,
      classStream: mockClass,
      examinations: mockExams,
      marks: mockMarks,
    });

    const resultsMap = calculateLearnerTerminalResults({
      learnerId: mockStudent.id,
      subjectIds: ['sub-math', 'sub-sci', 'sub-eng', 'sub-kis'],
      contributingAssessments: discovery.contributingAssessments,
      marks: discovery.marks,
      grades: standardGrades,
    });

    // 1. Math complete evaluation
    const math = resultsMap.get('sub-math')!;
    expect(math.status).toBe('Complete');
    expect(math.isComplete).toBe(true);
    expect(math.terminalPercentage).toBe(85);
    expect(math.cbePerformanceLevel).toBe('EE1');
    expect(math.points).toBe(4);
    expect(math.assessmentTrail).toHaveLength(3);
    expect(math.assessmentTrail[0].percentage).toBe(80);
    expect(math.assessmentTrail[1].percentage).toBe(90);
    expect(math.assessmentTrail[2].percentage).toBe(85);

    // 2. Science X handling
    const sci = resultsMap.get('sub-sci')!;
    expect(sci.status).toBe('INCOMPLETE (X)');
    expect(sci.isComplete).toBe(false);
    expect(sci.terminalPercentage).toBeNull();
    expect(sci.cbePerformanceLevel).toBeNull();
    expect(sci.points).toBeNull();
    expect(sci.assessmentTrail[1].status).toBe('X');

    // 3. English Y handling
    const eng = resultsMap.get('sub-eng')!;
    expect(eng.status).toBe('INCOMPLETE (Y)');
    expect(eng.isComplete).toBe(false);
    expect(eng.terminalPercentage).toBeNull();
    expect(eng.cbePerformanceLevel).toBeNull();
    expect(eng.points).toBeNull();
    expect(eng.assessmentTrail[1].status).toBe('Y');

    // 4. Kiswahili Genuine 0 handling
    const kis = resultsMap.get('sub-kis')!;
    expect(kis.status).toBe('Complete');
    expect(kis.isComplete).toBe(true);
    expect(kis.terminalPercentage).toBe(0);
    expect(kis.cbePerformanceLevel).toBe('BE1');
    expect(kis.points).toBe(1);
    expect(kis.assessmentTrail[0].status).toBe('Normal');
    expect(kis.assessmentTrail[0].percentage).toBe(0);
  });

  it('Probe 3: Y-Resolution Flow from resolution provenance to Complete status', async () => {
    // English with a resolved Y in Mid-Term:
    // Opener: 40/50 (80%)
    // Mid-Term: Y resolved to 30/50 (60%) with resolution provenance
    // End-Term: 70/100 (70%)
    // Arithmetic Mean: (80 + 60 + 70) / 3 = 70.0% -> ME1, 3 points, Complete
    const mockResolution: MarkResolution = {
      id: 'res-uuid-1',
      mark_id: 'm-eng-mid',
      student_id: mockStudent.id,
      exam_id: 'exam-mid-2',
      original_status: 'Y',
      resolved_score: 30,
      replacement_score: 30,
      resolution_reason: 'Medical certificate approved by Academic Committee',
      resolved_by: 'Principal Okonjo',
      resolved_at: '2026-03-01T10:00:00Z',
    };

    const mockMarksWithY: Mark[] = [
      { id: 'm-eng-op', student_id: mockStudent.id, exam_id: 'exam-op-1', subject_id: 'sub-eng', raw_score: 40, marks: 40, status: 'Normal' },
      { id: 'm-eng-mid', student_id: mockStudent.id, exam_id: 'exam-mid-2', subject_id: 'sub-eng', raw_score: 30, marks: 30, status: 'Y', special_status: 'Y' },
      { id: 'm-eng-end', student_id: mockStudent.id, exam_id: 'exam-end-3', subject_id: 'sub-eng', raw_score: 70, marks: 70, status: 'Normal' },
    ];

    const discovery = await discoverTerminalAssessments({
      academicYearId: mockAcademicYearId,
      termId: mockTermId,
      student: mockStudent,
      classStream: mockClass,
      examinations: mockExams,
      marks: mockMarksWithY,
      resolutions: [mockResolution],
    });

    const resultsMap = calculateLearnerTerminalResults({
      learnerId: mockStudent.id,
      subjectIds: ['sub-eng'],
      contributingAssessments: discovery.contributingAssessments,
      marks: discovery.marks,
      grades: standardGrades,
    });

    const eng = resultsMap.get('sub-eng')!;
    expect(eng.status).toBe('Complete');
    expect(eng.isComplete).toBe(true);
    expect(eng.terminalPercentage).toBe(70);
    expect(eng.cbePerformanceLevel).toBe('ME1');
    expect(eng.points).toBe(3);

    // Verify trail score & status
    const midTrail = eng.assessmentTrail[1];
    expect(midTrail.status).toBe('Normal');
    expect(midTrail.percentage).toBe(60);
    // Note: Engine currently resolves status to Normal and score to 60/100, but does not copy resolution object to trail entry yet
  });
});
