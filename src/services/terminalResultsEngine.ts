/**
 * Terminal Results Engine
 *
 * Authoritative implementation for Terminal Results calculation.
 * T-09: Terminal Results X Handling & Equal Weighting Foundation.
 *
 * Business Rules Enforced:
 * - Dynamic assessment count (1, 2, 3, 4, 5+ assessments)
 * - Strictly equal weighting: arithmetic mean of normalized assessment percentages
 * - Normalized percentages: (rawScore / outOf) * 100 before averaging
 * - Whole-number official Terminal Percentage: Math.round(arithmeticMean)
 * - Genuine numerical 0 is valid and participates as 0%
 * - X means Missing Mark / Unassessed:
 *     If ANY required contributing assessment has X (or missing required mark row),
 *     Learning Area Terminal Result MUST be INCOMPLETE (X).
 *     terminalPercentage = null, cbePerformanceLevel = null, points = null, isComplete = false.
 * - Y is Absence / Examination Irregularity:
 *     If ANY required contributing assessment has Y (and no X), Learning Area Terminal Result MUST be INCOMPLETE (Y).
 *     If contributing assessments have both X (or missing row) and Y, status MUST be INCOMPLETE (X/Y).
 *     terminalPercentage = null, cbePerformanceLevel = null, points = null, isComplete = false.
 * - Isolated per Learning Area and Learner: no cross-subject or cross-learner contamination.
 */

import { Grade, MarkResolution } from '../types';
import { getGradeForMark } from './analysisEngine';

export type TerminalResultStatus =
  | 'Complete'
  | 'INCOMPLETE (X)'
  | 'INCOMPLETE (Y)'
  | 'INCOMPLETE (X/Y)';

export interface ContributingAssessmentRef {
  id: string;
  exam_name: string;
  max_marks?: number;
  out_of?: number;
  status?: string; // 'Draft' | 'Provisional' | 'Approved' | 'Archived'
}

export interface AssessmentTrailEntry {
  examId: string;
  examName: string;
  status: 'Normal' | 'X' | 'Y' | 'Blank';
  rawScore: number | null;
  outOf: number;
  percentage: number | null; // Unrounded percentage for this assessment, null if X/Y/Blank
  displayScore: string;
  displayPercentage: string;
  irregularityReason?: string;
  resolution?: MarkResolution; // T-11 Authorised Y Resolution Provenance
  resolvedFromY?: boolean;
  resolutionReason?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  cbePerformanceLevel?: string | null;
}

export interface LearningAreaTerminalResult {
  subjectId: string;
  isComplete: boolean;
  status: TerminalResultStatus;
  terminalPercentage: number | null; // Rounded whole number when Complete, null when incomplete
  unroundedTerminalPercentage: number | null; // Full unrounded arithmetic mean retained for precision
  displayPercentage?: string; // Optional display helper for consumers/tests (e.g. '29%', '0%', 'X', 'Y')
  cbePerformanceLevel: string | null; // e.g. "EE1", "ME2", null when incomplete
  points: number | null; // CBE grade points, null when incomplete
  assessmentTrail: AssessmentTrailEntry[];
}

export interface CalculateTerminalResultParams {
  subjectId: string;
  contributingAssessments: ContributingAssessmentRef[];
  marks?: Array<{
    exam_id?: string;
    subject_id?: string;
    student_id?: string;
    marks?: number | string | null;
    raw_score?: number | string | null;
    out_of?: number | null;
    special_status?: string | null;
    irregularity_reason?: string | null;
    [key: string]: any;
  }>;
  markResolver?: (examId: string, subjectId: string) => any;
  grades?: Grade[];
}

/**
 * Resolves a learner's mark for a specific contributing assessment and Learning Area.
 * If no mark row exists for a required assessment, resolves explicitly as 'Blank' / unassessed.
 */
export function resolveAssessmentMark(
  assessment: ContributingAssessmentRef,
  subjectId: string,
  marks?: any[],
  markResolver?: (examId: string, subjectId: string) => any,
  grades?: Grade[]
): AssessmentTrailEntry {
  const defaultOutOf =
    typeof assessment.out_of === 'number' && assessment.out_of > 0
      ? assessment.out_of
      : typeof assessment.max_marks === 'number' && assessment.max_marks > 0
        ? assessment.max_marks
        : 100;

  let markRow: any = undefined;

  if (typeof markResolver === 'function') {
    markRow = markResolver(assessment.id, subjectId);
  } else if (Array.isArray(marks)) {
    markRow = marks.find(
      (m) =>
        (m.exam_id === assessment.id || m.id === assessment.id) &&
        (m.subject_id === subjectId || !m.subject_id)
    );
  }

  // 1. Missing required mark row (learner has no entry in database for this required assessment)
  if (markRow === undefined || markRow === null) {
    return {
      examId: assessment.id,
      examName: assessment.exam_name,
      status: 'Blank',
      rawScore: null,
      outOf: defaultOutOf,
      percentage: null,
      displayScore: 'X',
      displayPercentage: 'X',
    };
  }

  // Determine effective outOf for this mark
  const effectiveOutOf =
    typeof markRow.out_of === 'number' && markRow.out_of > 0
      ? markRow.out_of
      : defaultOutOf;

  const rawMarkStr =
    typeof markRow.marks === 'string'
      ? markRow.marks.trim().toUpperCase()
      : typeof markRow.raw_score === 'string'
        ? markRow.raw_score.trim().toUpperCase()
        : '';

  const specialStatus = markRow.special_status || markRow.status;

  // 1b. T-11 Authorised Y Resolution Check
  // If markRow contains an authorised formal resolution provenance, extract the replacement numerical mark.
  if (markRow.resolution) {
    const res = markRow.resolution;
    const repScore =
      typeof res.replacement_score === 'number' && Number.isFinite(res.replacement_score)
        ? res.replacement_score
        : typeof res.resolved_score === 'number' && Number.isFinite(res.resolved_score)
          ? res.resolved_score
          : typeof markRow.raw_score === 'number' && Number.isFinite(markRow.raw_score)
            ? markRow.raw_score
            : typeof markRow.marks === 'number' && Number.isFinite(markRow.marks)
              ? markRow.marks
              : typeof markRow.score === 'number' && Number.isFinite(markRow.score)
                ? markRow.score
                : null;

    if (repScore !== null && Number.isFinite(repScore)) {
      const unroundedPct = effectiveOutOf > 0 ? (repScore / effectiveOutOf) * 100 : 0;
      const clampedPct = Math.min(100, Math.max(0, unroundedPct));
      const gradeObj = getGradeForMark(Math.round(clampedPct), grades);
      const cbeLevel = gradeObj?.grade_code || gradeObj?.performance_level || 'BE2';

      return {
        examId: assessment.id,
        examName: assessment.exam_name,
        status: 'Normal',
        rawScore: repScore,
        outOf: effectiveOutOf,
        percentage: clampedPct,
        displayScore: effectiveOutOf !== 100 ? `${repScore}/${effectiveOutOf}` : `${Math.round(clampedPct)}%`,
        displayPercentage: `${Math.round(clampedPct)}%`,
        cbePerformanceLevel: cbeLevel,
        resolution: res,
        resolvedFromY: true,
        resolutionReason: res.resolution_reason || (res as any).reason,
        resolvedBy: res.resolved_by || (res as any).authorized_by,
        resolvedAt: res.resolved_at || (res as any).created_at,
      };
    }
  }

  // 2. Explicit X check (Missing Mark / Unassessed)
  if (specialStatus === 'X' || rawMarkStr === 'X') {
    return {
      examId: assessment.id,
      examName: assessment.exam_name,
      status: 'X',
      rawScore: null,
      outOf: effectiveOutOf,
      percentage: null,
      displayScore: 'X',
      displayPercentage: 'X',
    };
  }

  // 3. Y check (Absence / Irregularity - preserved for T-10)
  if (specialStatus === 'Y' || rawMarkStr === 'Y') {
    const reason =
      typeof markRow.irregularity_reason === 'string' && markRow.irregularity_reason.trim() !== ''
        ? markRow.irregularity_reason
        : 'Absent';
    return {
      examId: assessment.id,
      examName: assessment.exam_name,
      status: 'Y',
      rawScore: null,
      outOf: effectiveOutOf,
      percentage: null,
      displayScore: 'Y',
      displayPercentage: 'Y',
      irregularityReason: reason,
    };
  }

  // 4. Blank / Unassessed marker
  if (
    specialStatus === 'Blank' ||
    rawMarkStr === 'BLANK' ||
    rawMarkStr === '-' ||
    rawMarkStr === 'UNASSESSED'
  ) {
    return {
      examId: assessment.id,
      examName: assessment.exam_name,
      status: 'Blank',
      rawScore: null,
      outOf: effectiveOutOf,
      percentage: null,
      displayScore: 'X',
      displayPercentage: 'X',
    };
  }

  // 5. Numerical Mark Extraction
  // Strict numeric validation to protect genuine 0 from being treated as missing or falsy
  let numScore: number | null = null;

  if (typeof markRow.raw_score === 'number' && Number.isFinite(markRow.raw_score)) {
    numScore = markRow.raw_score;
  } else if (typeof markRow.marks === 'number' && Number.isFinite(markRow.marks)) {
    numScore = markRow.marks;
  } else if (typeof markRow.score === 'number' && Number.isFinite(markRow.score)) {
    numScore = markRow.score;
  } else if (
    typeof markRow.raw_score === 'string' &&
    markRow.raw_score.trim() !== '' &&
    !isNaN(Number(markRow.raw_score))
  ) {
    numScore = Number(markRow.raw_score);
  } else if (
    typeof markRow.marks === 'string' &&
    markRow.marks.trim() !== '' &&
    !isNaN(Number(markRow.marks))
  ) {
    numScore = Number(markRow.marks);
  } else if (
    typeof markRow.score === 'string' &&
    markRow.score.trim() !== '' &&
    !isNaN(Number(markRow.score))
  ) {
    numScore = Number(markRow.score);
  }

  // If no valid number could be extracted, treat as Blank/Unassessed
  if (numScore === null || !Number.isFinite(numScore)) {
    return {
      examId: assessment.id,
      examName: assessment.exam_name,
      status: 'Blank',
      rawScore: null,
      outOf: effectiveOutOf,
      percentage: null,
      displayScore: 'X',
      displayPercentage: 'X',
    };
  }

  // Compute normalized unrounded percentage
  const unroundedPct = effectiveOutOf > 0 ? (numScore / effectiveOutOf) * 100 : 0;
  const clampedPct = Math.min(100, Math.max(0, unroundedPct));
  const gradeObj = getGradeForMark(Math.round(clampedPct), grades);
  const cbeLevel = gradeObj?.grade_code || gradeObj?.performance_level || 'BE2';

  return {
    examId: assessment.id,
    examName: assessment.exam_name,
    status: 'Normal',
    rawScore: numScore,
    outOf: effectiveOutOf,
    percentage: clampedPct,
    displayScore: effectiveOutOf !== 100 ? `${numScore}/${effectiveOutOf}` : `${Math.round(clampedPct)}%`,
    displayPercentage: `${Math.round(clampedPct)}%`,
    cbePerformanceLevel: cbeLevel,
  };
}

/**
 * Calculates the Terminal Result for a single Learning Area.
 *
 * Implements Locked Rule 9 & Rule 4:
 * - If ANY contributing assessment has status 'X' or 'Blank' (missing required assessment),
 *   returns status: 'INCOMPLETE (X)' with terminalPercentage = null, cbePerformanceLevel = null, points = null.
 * - If all assessments are Normal, calculates arithmetic mean of normalized percentages with equal weight.
 * - Official terminal percentage is rounded to nearest integer (Math.round).
 * - CBE performance level and points are derived from the rounded integer.
 */
export function calculateLearningAreaTerminalResult(
  params: CalculateTerminalResultParams
): LearningAreaTerminalResult {
  const { subjectId, contributingAssessments, marks, markResolver, grades } = params;

  // Empty contributing assessments check
  if (!contributingAssessments || contributingAssessments.length === 0) {
    return {
      subjectId,
      isComplete: false,
      status: 'INCOMPLETE (X)',
      terminalPercentage: null,
      unroundedTerminalPercentage: null,
      displayPercentage: 'X',
      cbePerformanceLevel: null,
      points: null,
      assessmentTrail: [],
    };
  }

  // Step B: Mark Resolution across all contributing assessments
  const assessmentTrail: AssessmentTrailEntry[] = contributingAssessments.map((assessment) =>
    resolveAssessmentMark(assessment, subjectId, marks, markResolver, grades)
  );

  // Step C: Terminal Incomplete Validation (X, Y, Blank)
  // Check for X or Blank (missing required assessment)
  const hasX = assessmentTrail.some((entry) => entry.status === 'X' || entry.status === 'Blank');
  // Check for Y (Absence / Irregularity)
  const hasY = assessmentTrail.some((entry) => entry.status === 'Y');

  // Rule Y6: Mixed X + Y produces 'INCOMPLETE (X/Y)'
  if (hasX && hasY) {
    return {
      subjectId,
      isComplete: false,
      status: 'INCOMPLETE (X/Y)',
      terminalPercentage: null,
      unroundedTerminalPercentage: null,
      displayPercentage: 'X/Y',
      cbePerformanceLevel: null,
      points: null,
      assessmentTrail,
    };
  }

  // Rule Y7: X only (or missing mark row) produces 'INCOMPLETE (X)'
  if (hasX) {
    return {
      subjectId,
      isComplete: false,
      status: 'INCOMPLETE (X)',
      terminalPercentage: null,
      unroundedTerminalPercentage: null,
      displayPercentage: 'X',
      cbePerformanceLevel: null,
      points: null,
      assessmentTrail,
    };
  }

  // Rule Y8: Y only produces 'INCOMPLETE (Y)'
  if (hasY) {
    return {
      subjectId,
      isComplete: false,
      status: 'INCOMPLETE (Y)',
      terminalPercentage: null,
      unroundedTerminalPercentage: null,
      displayPercentage: 'Y',
      cbePerformanceLevel: null,
      points: null,
      assessmentTrail,
    };
  }

  // Step D: Numerical Aggregation (Strictly Equal Weighting)
  // All contributing assessments are valid 'Normal' numerical scores
  const validPercentages: number[] = [];
  for (const entry of assessmentTrail) {
    if (typeof entry.percentage === 'number' && Number.isFinite(entry.percentage)) {
      validPercentages.push(entry.percentage);
    }
  }

  // Double check all assessments contributed
  if (validPercentages.length !== contributingAssessments.length || validPercentages.length === 0) {
    return {
      subjectId,
      isComplete: false,
      status: 'INCOMPLETE (X)',
      terminalPercentage: null,
      unroundedTerminalPercentage: null,
      displayPercentage: 'X',
      cbePerformanceLevel: null,
      points: null,
      assessmentTrail,
    };
  }

  // Arithmetic mean of normalized assessment percentages
  const sum = validPercentages.reduce((acc, pct) => acc + pct, 0);
  const unroundedMean = sum / validPercentages.length;

  // Authoritative whole-number official terminal percentage
  const roundedTerminalPercentage = Math.round(unroundedMean);

  // Derive CBE performance level and points using authoritative configuration
  const gradeObj = getGradeForMark(roundedTerminalPercentage, grades);
  const cbePerformanceLevel = gradeObj?.grade_code || gradeObj?.performance_level || 'BE2';
  const points = typeof gradeObj?.points === 'number' ? gradeObj.points : 0;

  return {
    subjectId,
    isComplete: true,
    status: 'Complete',
    terminalPercentage: roundedTerminalPercentage,
    unroundedTerminalPercentage: unroundedMean,
    displayPercentage: `${roundedTerminalPercentage}%`,
    cbePerformanceLevel,
    points,
    assessmentTrail,
  };
}

/**
 * Calculates Terminal Results across multiple Learning Areas for a learner.
 * Enforces strict Learning Area isolation: an X in one subject never affects another subject.
 */
export function calculateLearnerTerminalResults(params: {
  learnerId: string;
  subjectIds: string[];
  contributingAssessments: ContributingAssessmentRef[];
  marks?: Array<{
    exam_id?: string;
    subject_id?: string;
    student_id?: string;
    [key: string]: any;
  }>;
  markResolver?: (examId: string, subjectId: string) => any;
  grades?: Grade[];
}): Map<string, LearningAreaTerminalResult> {
  const { learnerId, subjectIds, contributingAssessments, marks, markResolver, grades } = params;

  // Filter marks for this specific learner to guarantee learner isolation
  const learnerMarks = Array.isArray(marks)
    ? marks.filter((m) => !m.student_id || m.student_id === learnerId)
    : undefined;

  const resultsBySubject = new Map<string, LearningAreaTerminalResult>();

  for (const subjectId of subjectIds) {
    const laResult = calculateLearningAreaTerminalResult({
      subjectId,
      contributingAssessments,
      marks: learnerMarks,
      markResolver,
      grades,
    });
    resultsBySubject.set(subjectId, laResult);
  }

  return resultsBySubject;
}
