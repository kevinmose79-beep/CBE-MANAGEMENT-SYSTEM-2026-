import { describe, it, expect } from 'vitest';
import {
  calculateLearningAreaTerminalResult,
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
} from '../services/terminalResultsEngine';

describe('T-09 Terminal Results Engine — X Handling & Equal Weighting Foundation', () => {
  const assessment1: ContributingAssessmentRef = {
    id: 'exam-1',
    exam_name: 'Assessment 1',
    out_of: 100,
    status: 'Approved',
  };

  const assessment2: ContributingAssessmentRef = {
    id: 'exam-2',
    exam_name: 'Assessment 2',
    out_of: 100,
    status: 'Approved',
  };

  const assessment3: ContributingAssessmentRef = {
    id: 'exam-3',
    exam_name: 'Assessment 3',
    out_of: 100,
    status: 'Approved',
  };

  // --- MANDATORY TESTS A - G ---

  it('TEST A: [80%, 70%, 90%] -> Terminal = 80%, Complete', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: 80, out_of: 100, special_status: 'Normal' },
        { exam_id: 'exam-2', subject_id: 'sub-math', raw_score: 70, out_of: 100, special_status: 'Normal' },
        { exam_id: 'exam-3', subject_id: 'sub-math', raw_score: 90, out_of: 100, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('Complete');
    expect(result.terminalPercentage).toBe(80);
    expect(result.unroundedTerminalPercentage).toBe(80);
    // 80% falls in authoritative 75-89 band (EE2, 7 pts)
    expect(result.cbePerformanceLevel).toBe('EE2');
    expect(result.points).toBe(7);
    expect(result.assessmentTrail.length).toBe(3);
  });

  it('TEST B: [80%, X, 90%] -> INCOMPLETE (X), percentage null, level null, points null', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: 80, out_of: 100, special_status: 'Normal' },
        { exam_id: 'exam-2', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' },
        { exam_id: 'exam-3', subject_id: 'sub-math', raw_score: 90, out_of: 100, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.unroundedTerminalPercentage).toBeNull();
    expect(result.cbePerformanceLevel).toBeNull();
    expect(result.points).toBeNull();

    // Verify assessment trail preserved X
    expect(result.assessmentTrail[0].percentage).toBe(80);
    expect(result.assessmentTrail[1].status).toBe('X');
    expect(result.assessmentTrail[1].percentage).toBeNull();
    expect(result.assessmentTrail[2].percentage).toBe(90);
  });

  it('TEST C: [X, X, 80%] -> INCOMPLETE (X)', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' },
        { exam_id: 'exam-2', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' },
        { exam_id: 'exam-3', subject_id: 'sub-math', raw_score: 80, out_of: 100, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();
  });

  it('TEST D: [0%, 80%] -> 40%, Complete (Genuine numerical 0 is valid and participates)', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1, assessment2],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: 0, out_of: 100, special_status: 'Normal' },
        { exam_id: 'exam-2', subject_id: 'sub-math', raw_score: 80, out_of: 100, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('Complete');
    // (0 + 80) / 2 = 40%
    expect(result.terminalPercentage).toBe(40);
    expect(result.unroundedTerminalPercentage).toBe(40);
    // 40% falls in 31-40 band (AE1)
    expect(result.cbePerformanceLevel).toBe('AE1');
    expect(result.points).toBe(4);
  });

  it('TEST E: [0%, X, 80%] -> INCOMPLETE (X) (X blocks calculation despite genuine 0)', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: 0, out_of: 100, special_status: 'Normal' },
        { exam_id: 'exam-2', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' },
        { exam_id: 'exam-3', subject_id: 'sub-math', raw_score: 80, out_of: 100, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.cbePerformanceLevel).toBeNull();
  });

  it('TEST F: [X only] -> INCOMPLETE (X)', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' },
      ],
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();
  });

  it('TEST G: [40/50, X, 72/80] -> INCOMPLETE (X) with proper percentage normalisation in trail', () => {
    const asst50: ContributingAssessmentRef = { id: 'ex-50', exam_name: 'Asst 50', out_of: 50 };
    const asst100: ContributingAssessmentRef = { id: 'ex-100', exam_name: 'Asst 100', out_of: 100 };
    const asst80: ContributingAssessmentRef = { id: 'ex-80', exam_name: 'Asst 80', out_of: 80 };

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [asst50, asst100, asst80],
      marks: [
        { exam_id: 'ex-50', subject_id: 'sub-math', raw_score: 40, out_of: 50, special_status: 'Normal' },
        { exam_id: 'ex-100', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' },
        { exam_id: 'ex-80', subject_id: 'sub-math', raw_score: 72, out_of: 80, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();

    // Verify trail normalized percentages: 40/50 = 80%, 72/80 = 90%
    expect(result.assessmentTrail[0].percentage).toBe(80);
    expect(result.assessmentTrail[1].percentage).toBeNull();
    expect(result.assessmentTrail[1].status).toBe('X');
    expect(result.assessmentTrail[2].percentage).toBe(90);
  });

  // --- ADDITIONAL ADVERSARIAL TESTS ---

  it('Zero vs X Distinction: Genuine 0 produces 0% (BE2), while X produces null (INCOMPLETE)', () => {
    const resZero = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1],
      marks: [{ exam_id: 'exam-1', subject_id: 'sub-math', raw_score: 0, out_of: 100, special_status: 'Normal' }],
    });
    expect(resZero.isComplete).toBe(true);
    expect(resZero.status).toBe('Complete');
    expect(resZero.terminalPercentage).toBe(0);
    expect(resZero.cbePerformanceLevel).toBe('BE2');

    const resX = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1],
      marks: [{ exam_id: 'exam-1', subject_id: 'sub-math', raw_score: null, out_of: 100, special_status: 'X' }],
    });
    expect(resX.isComplete).toBe(false);
    expect(resX.status).toBe('INCOMPLETE (X)');
    expect(resX.terminalPercentage).toBeNull();
  });

  it('Missing Mark Row: Learner has no mark row for a required assessment -> INCOMPLETE (X)', () => {
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: [assessment1, assessment2],
      marks: [
        // Only exam-1 is present; exam-2 row is completely missing from marks array
        { exam_id: 'exam-1', subject_id: 'sub-math', raw_score: 85, out_of: 100, special_status: 'Normal' },
      ],
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.assessmentTrail[1].status).toBe('Blank');
    expect(result.assessmentTrail[1].percentage).toBeNull();
  });

  it('Dynamic Assessment Count: Supports 1, 2, 3, 4, 5 assessments equally', () => {
    const a1 = { id: 'e1', exam_name: 'E1', out_of: 100 };
    const a2 = { id: 'e2', exam_name: 'E2', out_of: 100 };
    const a3 = { id: 'e3', exam_name: 'E3', out_of: 100 };
    const a4 = { id: 'e4', exam_name: 'E4', out_of: 100 };
    const a5 = { id: 'e5', exam_name: 'E5', out_of: 100 };

    // 1 assessment: 75%
    const r1 = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [a1],
      marks: [{ exam_id: 'e1', subject_id: 'sub-1', raw_score: 75, out_of: 100 }],
    });
    expect(r1.terminalPercentage).toBe(75);

    // 4 assessments: 80, 85, 90, 65 -> mean = 80%
    const r4 = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [a1, a2, a3, a4],
      marks: [
        { exam_id: 'e1', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
        { exam_id: 'e2', subject_id: 'sub-1', raw_score: 85, out_of: 100 },
        { exam_id: 'e3', subject_id: 'sub-1', raw_score: 90, out_of: 100 },
        { exam_id: 'e4', subject_id: 'sub-1', raw_score: 65, out_of: 100 },
      ],
    });
    expect(r4.terminalPercentage).toBe(80);

    // 5 assessments: 60, 70, 80, 90, 100 -> mean = 80%
    const r5 = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [a1, a2, a3, a4, a5],
      marks: [
        { exam_id: 'e1', subject_id: 'sub-1', raw_score: 60, out_of: 100 },
        { exam_id: 'e2', subject_id: 'sub-1', raw_score: 70, out_of: 100 },
        { exam_id: 'e3', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
        { exam_id: 'e4', subject_id: 'sub-1', raw_score: 90, out_of: 100 },
        { exam_id: 'e5', subject_id: 'sub-1', raw_score: 100, out_of: 100 },
      ],
    });
    expect(r5.terminalPercentage).toBe(80);
  });

  it('Different Max Scores: Normalization occurs before averaging', () => {
    // 30/50 = 60%, 60/75 = 80%, 80/100 = 80%
    // Mean = (60 + 80 + 80) / 3 = 220 / 3 = 73.333% -> 73% (ME1)
    const asst50 = { id: 'e1', exam_name: 'E1', out_of: 50 };
    const asst75 = { id: 'e2', exam_name: 'E2', out_of: 75 };
    const asst100 = { id: 'e3', exam_name: 'E3', out_of: 100 };

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sub-sci',
      contributingAssessments: [asst50, asst75, asst100],
      marks: [
        { exam_id: 'e1', subject_id: 'sub-sci', raw_score: 30, out_of: 50 },
        { exam_id: 'e2', subject_id: 'sub-sci', raw_score: 60, out_of: 75 },
        { exam_id: 'e3', subject_id: 'sub-sci', raw_score: 80, out_of: 100 },
      ],
    });

    expect(result.isComplete).toBe(true);
    expect(result.terminalPercentage).toBe(73);
    expect(result.cbePerformanceLevel).toBe('ME1');
  });

  it('X Position Invariance: X at first, middle, or last position produces INCOMPLETE (X)', () => {
    // First
    const rFirst = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-1', special_status: 'X' },
        { exam_id: 'exam-2', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
        { exam_id: 'exam-3', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
      ],
    });
    expect(rFirst.status).toBe('INCOMPLETE (X)');

    // Middle
    const rMiddle = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
        { exam_id: 'exam-2', subject_id: 'sub-1', special_status: 'X' },
        { exam_id: 'exam-3', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
      ],
    });
    expect(rMiddle.status).toBe('INCOMPLETE (X)');

    // Last
    const rLast = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
        { exam_id: 'exam-2', subject_id: 'sub-1', raw_score: 80, out_of: 100 },
        { exam_id: 'exam-3', subject_id: 'sub-1', special_status: 'X' },
      ],
    });
    expect(rLast.status).toBe('INCOMPLETE (X)');
  });

  it('Learning Area Isolation: X in Mathematics does NOT invalidate English', () => {
    const results = calculateLearnerTerminalResults({
      learnerId: 'student-1',
      subjectIds: ['sub-math', 'sub-eng'],
      contributingAssessments: [assessment1, assessment2],
      marks: [
        // Mathematics has X in assessment 2
        { exam_id: 'exam-1', subject_id: 'sub-math', student_id: 'student-1', raw_score: 80, out_of: 100 },
        { exam_id: 'exam-2', subject_id: 'sub-math', student_id: 'student-1', special_status: 'X' },
        // English has complete valid scores
        { exam_id: 'exam-1', subject_id: 'sub-eng', student_id: 'student-1', raw_score: 75, out_of: 100 },
        { exam_id: 'exam-2', subject_id: 'sub-eng', student_id: 'student-1', raw_score: 85, out_of: 100 },
      ],
    });

    const mathResult = results.get('sub-math');
    const engResult = results.get('sub-eng');

    expect(mathResult?.status).toBe('INCOMPLETE (X)');
    expect(mathResult?.terminalPercentage).toBeNull();

    expect(engResult?.status).toBe('Complete');
    expect(engResult?.terminalPercentage).toBe(80);
    expect(engResult?.cbePerformanceLevel).toBe('EE2');
  });

  it('Learner Isolation: Learner A having X does NOT affect Learner B with complete marks', () => {
    const allMarks = [
      // Learner A has X in exam 2
      { exam_id: 'exam-1', subject_id: 'sub-math', student_id: 'std-A', raw_score: 80, out_of: 100 },
      { exam_id: 'exam-2', subject_id: 'sub-math', student_id: 'std-A', special_status: 'X' },
      // Learner B has complete marks
      { exam_id: 'exam-1', subject_id: 'sub-math', student_id: 'std-B', raw_score: 80, out_of: 100 },
      { exam_id: 'exam-2', subject_id: 'sub-math', student_id: 'std-B', raw_score: 90, out_of: 100 },
    ];

    const resultsA = calculateLearnerTerminalResults({
      learnerId: 'std-A',
      subjectIds: ['sub-math'],
      contributingAssessments: [assessment1, assessment2],
      marks: allMarks,
    });

    const resultsB = calculateLearnerTerminalResults({
      learnerId: 'std-B',
      subjectIds: ['sub-math'],
      contributingAssessments: [assessment1, assessment2],
      marks: allMarks,
    });

    expect(resultsA.get('sub-math')?.status).toBe('INCOMPLETE (X)');
    expect(resultsA.get('sub-math')?.terminalPercentage).toBeNull();

    expect(resultsB.get('sub-math')?.status).toBe('Complete');
    expect(resultsB.get('sub-math')?.terminalPercentage).toBe(85);
  });

  it('Rounding Precision: 82.4% -> 82%, 82.5% -> 83%', () => {
    // 82 and 83 on 100 = 82.5% -> rounds to 83%
    const rHalf = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [assessment1, assessment2],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-1', raw_score: 82, out_of: 100 },
        { exam_id: 'exam-2', subject_id: 'sub-1', raw_score: 83, out_of: 100 },
      ],
    });
    expect(rHalf.unroundedTerminalPercentage).toBe(82.5);
    expect(rHalf.terminalPercentage).toBe(83);

    // 82, 82, 83 -> 247 / 3 = 82.333% -> rounds to 82%
    const rDown = calculateLearningAreaTerminalResult({
      subjectId: 'sub-1',
      contributingAssessments: [assessment1, assessment2, assessment3],
      marks: [
        { exam_id: 'exam-1', subject_id: 'sub-1', raw_score: 82, out_of: 100 },
        { exam_id: 'exam-2', subject_id: 'sub-1', raw_score: 82, out_of: 100 },
        { exam_id: 'exam-3', subject_id: 'sub-1', raw_score: 83, out_of: 100 },
      ],
    });
    expect(rDown.terminalPercentage).toBe(82);
  });
});
