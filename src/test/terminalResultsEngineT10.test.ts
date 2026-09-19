import { describe, it, expect } from 'vitest';
import {
  calculateLearningAreaTerminalResult,
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
} from '../services/terminalResultsEngine';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';

describe('T-10 Terminal Results Y Handling Engine Suite', () => {
  // TC-Y01: Single Y in multi-assessment terminal result
  it('TC-Y01: Single Y produces INCOMPLETE (Y), null percentage, null level, null points, isComplete = false', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1', out_of: 100 },
      { id: 'exam2', exam_name: 'CAT 2', out_of: 100 },
    ];
    const marks = [
      { exam_id: 'exam1', marks: 80 },
      { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (Y)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.unroundedTerminalPercentage).toBeNull();
    expect(result.cbePerformanceLevel).toBeNull();
    expect(result.points).toBeNull();
    expect(result.assessmentTrail).toHaveLength(2);
    expect(result.assessmentTrail[0].status).toBe('Normal');
    expect(result.assessmentTrail[0].percentage).toBe(80);
    expect(result.assessmentTrail[1].status).toBe('Y');
    expect(result.assessmentTrail[1].irregularityReason).toBe('Absent');
  });

  // TC-Y02: Multiple Y
  it('TC-Y02: Multiple Y across assessments produces INCOMPLETE (Y)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
    ];
    const marks = [
      { exam_id: 'exam1', special_status: 'Y', irregularity_reason: 'Medical Absence' },
      { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Medical Absence' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'science',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (Y)');
    expect(result.terminalPercentage).toBeNull();
  });

  // TC-Y03: Y is never zero
  it('TC-Y03: Y is never coerced to 0% (does not average [Y, 80] to 40%)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'End Term' },
    ];
    const marks = [
      { exam_id: 'exam1', special_status: 'Y', irregularity_reason: 'Absent' },
      { exam_id: 'exam2', marks: 80 },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.terminalPercentage).not.toBe(40);
    expect(result.terminalPercentage).toBeNull();
    expect(result.status).toBe('INCOMPLETE (Y)');
  });

  // TC-Y04: Y is never silently excluded
  it('TC-Y04: Y is never silently excluded from denominator (does not treat [Y, 80] as 80%)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'End Term' },
    ];
    const marks = [
      { exam_id: 'exam1', special_status: 'Y', irregularity_reason: 'Exempted' },
      { exam_id: 'exam2', marks: 80 },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.terminalPercentage).not.toBe(80);
    expect(result.terminalPercentage).toBeNull();
    expect(result.isComplete).toBe(false);
  });

  // TC-Y05: Mixed X + Y
  it('TC-Y05: Mixed X + Y produces INCOMPLETE (X/Y)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
      { id: 'exam3', exam_name: 'End Term' },
    ];
    const marks = [
      { exam_id: 'exam1', special_status: 'X' },
      { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Examination Malpractice' },
      { exam_id: 'exam3', marks: 80 },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X/Y)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.cbePerformanceLevel).toBeNull();
    expect(result.points).toBeNull();
    // Individual assessment statuses must remain intact
    expect(result.assessmentTrail[0].status).toBe('X');
    expect(result.assessmentTrail[1].status).toBe('Y');
    expect(result.assessmentTrail[1].irregularityReason).toBe('Examination Malpractice');
    expect(result.assessmentTrail[2].status).toBe('Normal');
    expect(result.assessmentTrail[2].percentage).toBe(80);
  });

  // TC-Y06: X + Y position invariance
  it('TC-Y06: Position invariance of X and Y (X, Y, 80 / Y, X, 80 / 80, X, Y all produce INCOMPLETE (X/Y))', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
      { id: 'exam3', exam_name: 'End Term' },
    ];

    // Permutation 1: [X, Y, 80]
    const res1 = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'exam1', special_status: 'X' },
        { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
        { exam_id: 'exam3', marks: 80 },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(res1.status).toBe('INCOMPLETE (X/Y)');

    // Permutation 2: [Y, X, 80]
    const res2 = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'exam1', special_status: 'Y', irregularity_reason: 'Withheld Result' },
        { exam_id: 'exam2', special_status: 'X' },
        { exam_id: 'exam3', marks: 80 },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(res2.status).toBe('INCOMPLETE (X/Y)');

    // Permutation 3: [80, X, Y]
    const res3 = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'exam1', marks: 80 },
        { exam_id: 'exam2', special_status: 'X' },
        { exam_id: 'exam3', special_status: 'Y', irregularity_reason: 'Medical Absence' },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(res3.status).toBe('INCOMPLETE (X/Y)');
  });

  // TC-Y07: Reason preservation across all 5 reasons
  it('TC-Y07: Reason preservation across all 5 defined reasons', () => {
    const reasons = [
      'Absent',
      'Examination Malpractice',
      'Withheld Result',
      'Medical Absence',
      'Exempted',
    ];

    for (const reason of reasons) {
      const assessments: ContributingAssessmentRef[] = [
        { id: 'exam1', exam_name: 'Assessment 1' },
      ];
      const marks = [
        { exam_id: 'exam1', special_status: 'Y', irregularity_reason: reason },
      ];

      const res = calculateLearningAreaTerminalResult({
        subjectId: 'sub1',
        contributingAssessments: assessments,
        marks,
        grades: CBE_8_POINT_GRADES,
      });

      expect(res.status).toBe('INCOMPLETE (Y)');
      expect(res.assessmentTrail[0].irregularityReason).toBe(reason);
      expect(res.assessmentTrail[0].status).toBe('Y');
    }
  });

  // TC-Y08: Zero versus Y
  it('TC-Y08: Genuine numerical 0 participates normally, while Y halts calculation', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'End Term' },
    ];

    // [0, 80] -> 40% (AE1, 4 points)
    const resZero = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'exam1', marks: 0 },
        { exam_id: 'exam2', marks: 80 },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(resZero.isComplete).toBe(true);
    expect(resZero.status).toBe('Complete');
    expect(resZero.terminalPercentage).toBe(40);
    expect(resZero.cbePerformanceLevel).toBe('AE1');
    expect(resZero.points).toBe(4);

    // [0, Y, 80] with 3 assessments -> INCOMPLETE (Y)
    const assessments3: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
      { id: 'exam3', exam_name: 'End Term' },
    ];
    const resZeroY = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments3,
      marks: [
        { exam_id: 'exam1', marks: 0 },
        { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
        { exam_id: 'exam3', marks: 80 },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(resZeroY.isComplete).toBe(false);
    expect(resZeroY.status).toBe('INCOMPLETE (Y)');
    expect(resZeroY.terminalPercentage).toBeNull();
  });

  // TC-Y09: Missing + Y
  it('TC-Y09: Missing required mark row + Y produces INCOMPLETE (X/Y)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
      { id: 'exam3', exam_name: 'End Term' },
    ];
    // No mark entry for exam1 (missing row -> Blank -> X)
    const marks = [
      { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
      { exam_id: 'exam3', marks: 80 },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X/Y)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.assessmentTrail[0].status).toBe('Blank');
    expect(result.assessmentTrail[1].status).toBe('Y');
  });

  // TC-Y10: Cross-Learning-Area isolation
  it('TC-Y10: Strict Learning Area isolation (Mathematics [80, Y] does not affect English [75, 85])', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
    ];
    const marks = [
      { subject_id: 'math', exam_id: 'exam1', marks: 80 },
      { subject_id: 'math', exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
      { subject_id: 'eng', exam_id: 'exam1', marks: 75 },
      { subject_id: 'eng', exam_id: 'exam2', marks: 85 },
    ];

    const results = calculateLearnerTerminalResults({
      learnerId: 'std1',
      subjectIds: ['math', 'eng'],
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    const mathResult = results.get('math')!;
    expect(mathResult.isComplete).toBe(false);
    expect(mathResult.status).toBe('INCOMPLETE (Y)');
    expect(mathResult.terminalPercentage).toBeNull();

    const engResult = results.get('eng')!;
    expect(engResult.isComplete).toBe(true);
    expect(engResult.status).toBe('Complete');
    expect(engResult.terminalPercentage).toBe(80); // (75 + 85)/2 = 80
    expect(engResult.cbePerformanceLevel).toBe('EE2');
    expect(engResult.points).toBe(7);
  });

  // TC-Y11: Cross-learner isolation
  it('TC-Y11: Strict learner isolation (Learner A [80, Y] does not affect Learner B [80, 90])', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1' },
      { id: 'exam2', exam_name: 'CAT 2' },
    ];
    const marks = [
      { student_id: 'learnerA', subject_id: 'math', exam_id: 'exam1', marks: 80 },
      { student_id: 'learnerA', subject_id: 'math', exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
      { student_id: 'learnerB', subject_id: 'math', exam_id: 'exam1', marks: 80 },
      { student_id: 'learnerB', subject_id: 'math', exam_id: 'exam2', marks: 90 },
    ];

    const resultsA = calculateLearnerTerminalResults({
      learnerId: 'learnerA',
      subjectIds: ['math'],
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    const resultsB = calculateLearnerTerminalResults({
      learnerId: 'learnerB',
      subjectIds: ['math'],
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(resultsA.get('math')!.status).toBe('INCOMPLETE (Y)');
    expect(resultsA.get('math')!.terminalPercentage).toBeNull();

    expect(resultsB.get('math')!.status).toBe('Complete');
    expect(resultsB.get('math')!.terminalPercentage).toBe(85);
    expect(resultsB.get('math')!.cbePerformanceLevel).toBe('EE2');
    expect(resultsB.get('math')!.points).toBe(7);
  });

  // TC-Y12: Dynamic assessment count with Y
  it('TC-Y12: Dynamic assessment count with Y (2, 3, 4, 5 assessments all halt calculation upon encountering Y)', () => {
    for (const count of [2, 3, 4, 5]) {
      const assessments: ContributingAssessmentRef[] = Array.from({ length: count }, (_, i) => ({
        id: `exam_${i + 1}`,
        exam_name: `Assessment ${i + 1}`,
      }));

      // Set one assessment to Y, rest to 80
      const marks = assessments.map((a, idx) => {
        if (idx === 0) {
          return { exam_id: a.id, special_status: 'Y', irregularity_reason: 'Medical Absence' };
        }
        return { exam_id: a.id, marks: 80 };
      });

      const res = calculateLearningAreaTerminalResult({
        subjectId: 'math',
        contributingAssessments: assessments,
        marks,
        grades: CBE_8_POINT_GRADES,
      });

      expect(res.isComplete).toBe(false);
      expect(res.status).toBe('INCOMPLETE (Y)');
      expect(res.terminalPercentage).toBeNull();
      expect(res.assessmentTrail).toHaveLength(count);
    }
  });

  // Non-100 denominators with Y
  it('Different denominators with Y: 40/50, Y, 72/80 produces INCOMPLETE (Y)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'exam1', exam_name: 'CAT 1', out_of: 50 },
      { id: 'exam2', exam_name: 'CAT 2', out_of: 100 },
      { id: 'exam3', exam_name: 'End Term', out_of: 80 },
    ];
    const marks = [
      { exam_id: 'exam1', raw_score: 40, out_of: 50 },
      { exam_id: 'exam2', special_status: 'Y', irregularity_reason: 'Absent' },
      { exam_id: 'exam3', raw_score: 72, out_of: 80 },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.status).toBe('INCOMPLETE (Y)');
    expect(result.terminalPercentage).toBeNull();
    expect(result.assessmentTrail[0].percentage).toBe(80);
    expect(result.assessmentTrail[2].percentage).toBe(90);
  });
});
