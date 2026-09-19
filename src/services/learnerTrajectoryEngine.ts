import { Student, Examination, Subject, Grade, ClassStream, Mark } from '../types';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { getGradeForMark } from './analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { getDisplayExamName, getDisplayExamType, getDisplayMilestoneLabel } from '../utils/examDisplayUtils';
import { isLearnerInExamScope } from '../utils/filterUtils';

export type TrajectoryTrendType = 'improving' | 'stable' | 'declining' | 'insufficient_data';
export type MilestoneStepTrend = 'improving' | 'stable' | 'declining' | 'initial';

export interface TrajectoryMilestone {
  exam_id: string;
  exam_name: string;
  exam_type: string;
  year: number;
  term: string;
  term_sequence: number; // 1, 2, 3
  start_date?: string;
  academic_period_label: string; // e.g. "2025 Term 1"
  display_label: string; // e.g. "2025 T1" for charts
  grade: string; // historical grade at exam time
  class_name: string;
  stream_name: string;
  full_class_name: string;
  is_historical: boolean;
  resolution_source: string;
  total_recorded_subjects: number;
  total_assessed_subjects: number;
  total_marks: number;
  max_possible_marks: number;
  average_percentage: number;
  average_points: number;
  overall_grade: Grade | null;
  performance_level: string; // 'EE' | 'ME' | 'AE' | 'BE' | 'N/A'
  grade_code: string;
  has_usable_data: boolean;
  step_delta?: number;
  step_trend?: MilestoneStepTrend;
}

export interface LearnerTrajectoryAnalysis {
  student_id: string;
  student_name: string;
  admission_number: string;
  all_milestones: TrajectoryMilestone[];
  usable_milestones: TrajectoryMilestone[];
  trend: TrajectoryTrendType;
  trend_label: string;
  trend_icon: string;
  trend_description: string;
  net_delta: number | null; // latest_score - earliest_score
  slope: number | null; // linear regression slope (points per milestone)
  earliest_milestone: TrajectoryMilestone | null;
  latest_milestone: TrajectoryMilestone | null;
  cumulative_mean_percentage: number | null;
  cumulative_mean_points: number | null;
  grade_progression_span: string; // e.g. "Grade 6 (2025) → Grade 7 (2026)"
  has_historical_context: boolean;
}

/**
 * Extracts a normalized term sequence number (1, 2, 3) from term string.
 */
export function extractTermSequence(termStr?: string): number {
  if (!termStr) return 1;
  const lower = termStr.toLowerCase();
  if (lower.includes('1') || lower.includes('one') || lower.includes('first')) return 1;
  if (lower.includes('2') || lower.includes('two') || lower.includes('second')) return 2;
  if (lower.includes('3') || lower.includes('three') || lower.includes('third')) return 3;
  return 1;
}

/**
 * Derives a clean, concise assessment label for milestones to prevent identical
 * X-axis labels when multiple assessments exist within the same academic term.
 */
export function deriveMilestoneShortLabel(examName?: string, examType?: string): string {
  const rawName = (examName || '').trim();
  const rawType = (examType || '').trim();

  if (!rawName && !rawType) return '';

  // Strip redundant 4-digit years and standalone "Term X" / "T X" from name
  let candidate = rawName
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\bTerm\s+[1-3]\b/gi, '')
    .replace(/\bT[1-3]\b/gi, '')
    .replace(/\bOF\s+TERM\s+[1-3]\b/gi, '')
    .replace(/^[\s\-–—:•]+|[\s\-–—:•]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!candidate || candidate.toUpperCase() === 'EXAMINATION' || candidate.toUpperCase() === 'ASSESSMENT') {
    if (rawType && rawType !== 'Custom' && rawType !== 'Standard') {
      candidate = rawType;
    } else {
      candidate = rawName || rawType || 'Assessment';
    }
  }

  // Ensure presentation layer cleans any legacy CAT terminology (e.g., CAT 1 -> Assessment 1)
  return getDisplayMilestoneLabel(candidate);
}

/**
 * Deterministically sorts milestones in strict chronological order:
 * 1. Year (asc)
 * 2. Term sequence (1 -> 2 -> 3)
 * 3. Exam start date / date created (asc)
 * 4. Exam ID (deterministic tie-breaker)
 */
export function sortMilestonesChronologically(milestones: TrajectoryMilestone[]): TrajectoryMilestone[] {
  return [...milestones].sort((a, b) => {
    // 1. Year
    if (a.year !== b.year) {
      return a.year - b.year;
    }

    // 2. Term sequence
    if (a.term_sequence !== b.term_sequence) {
      return a.term_sequence - b.term_sequence;
    }

    // 3. Exam Date if present
    const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
    const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
    if (dateA > 0 && dateB > 0 && dateA !== dateB) {
      return dateA - dateB;
    }

    // 4. Deterministic string tie-breaker
    return (a.exam_name || a.exam_id).localeCompare(b.exam_name || b.exam_id);
  });
}

/**
 * Calculates linear regression slope for an array of numbers.
 * Returns slope m (change per unit step).
 */
export function calculateProgressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - meanX;
    const yDiff = values[i] - meanY;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}

/**
 * Builds comprehensive Long-Term Trajectory Analytics for a specific learner.
 * Consumes existing authoritative historical examination records, marks, and promotion context.
 * Non-destructive and purely derived.
 */
export function buildLearnerTrajectory(
  student: Student,
  exams: Examination[] = [],
  marks: Mark[] = [],
  subjects: Subject[] = [],
  grades: Grade[] = [],
  classes: ClassStream[] = []
): LearnerTrajectoryAnalysis {
  if (!student) {
    return {
      student_id: '',
      student_name: '',
      admission_number: '',
      all_milestones: [],
      usable_milestones: [],
      trend: 'insufficient_data',
      trend_label: 'Insufficient Data',
      trend_icon: '⚪',
      trend_description: 'No learner profile supplied.',
      net_delta: null,
      slope: null,
      earliest_milestone: null,
      latest_milestone: null,
      cumulative_mean_percentage: null,
      cumulative_mean_points: null,
      grade_progression_span: 'N/A',
      has_historical_context: false,
    };
  }

  const studentMarks = (marks || []).filter((m) => {
    if (!m) return false;
    const sId = String(m.student_id).trim().toLowerCase();
    if (student.id && String(student.id).trim().toLowerCase() === sId) return true;
    if (student.admission_number && String(student.admission_number).trim().toLowerCase() === sId) return true;
    return false;
  });

  const rawMilestones: TrajectoryMilestone[] = (exams || [])
    .filter((exam) => {
      const histContext = getLearnerClassAtExamTime(student, exam, classes);
      return isLearnerInExamScope(histContext, exam, classes);
    })
    .map((exam) => {
      // 1. Resolve historical class/grade context at exam time
    const histContext = getLearnerClassAtExamTime(student, exam, classes);
    const examYear = exam.year || new Date().getFullYear();
    const termSeq = extractTermSequence(exam.term);
    const termLabel = exam.term ? (exam.term.startsWith('Term') ? exam.term : `Term ${extractTermSequence(exam.term)}`) : 'Term 1';
    const periodLabel = `${examYear} ${termLabel}`;
    const shortAssessment = deriveMilestoneShortLabel(exam.exam_name, exam.exam_type);
    const displayLabel = shortAssessment ? `${examYear} T${termSeq} • ${shortAssessment}` : `${examYear} T${termSeq}`;

    // 2. Filter learner marks for this specific exam & appropriate historical curriculum
    const eMarks = studentMarks.filter((m) => {
      if (m.exam_id !== exam.id) return false;
      const subObj = subjects.find((s) => s.id === m.subject_id);
      if (subObj) {
        if (histContext.grade && subObj.applicable_grades && subObj.applicable_grades.length > 0) {
          if (!(subObj.applicable_grades as string[]).includes(histContext.grade)) {
            return false;
          }
        }
      }
      return true;
    });

    // 3. Evaluate each mark using standard authoritative evaluator
    const assessedItems: {
      percentage: number;
      points: number;
      gradeObj: Grade;
    }[] = [];

    eMarks.forEach((m) => {
      const ev = evaluateMark(m);
      if (ev.status === 'Normal' && ev.percentage !== null) {
        const gradeObj = getGradeForMark(ev.percentage, grades);
        if (gradeObj) {
          assessedItems.push({
            percentage: ev.percentage,
            points: gradeObj.points,
            gradeObj,
          });
        }
      }
    });

    const totalAssessed = assessedItems.length;
    const hasUsableData = totalAssessed > 0;
    const totalMarks = assessedItems.reduce((sum, item) => sum + item.percentage, 0);
    const totalPoints = assessedItems.reduce((sum, item) => sum + item.points, 0);
    const avgPercentage = hasUsableData ? Math.round((totalMarks / totalAssessed) * 10) / 10 : 0;
    const avgPoints = hasUsableData ? Math.round((totalPoints / totalAssessed) * 100) / 100 : 0;
    const overallGrade = hasUsableData ? getGradeForMark(avgPercentage, grades) : null;
    const perfLevel = overallGrade?.performance_level || (hasUsableData ? 'ME' : 'N/A');
    const gradeCode = overallGrade?.grade_code || overallGrade?.grade || (hasUsableData ? 'ME1' : 'N/A');

    return {
      exam_id: exam.id,
      exam_name: getDisplayExamName(exam.exam_name) || 'Assessment',
      exam_type: getDisplayExamType(exam.exam_type) || 'Standard',
      year: examYear,
      term: termLabel,
      term_sequence: termSeq,
      start_date: exam.start_date || (exam as any).date_created,
      academic_period_label: periodLabel,
      display_label: displayLabel,
      grade: histContext.grade || student.grade || 'Unknown Grade',
      class_name: histContext.class_name,
      stream_name: histContext.stream_name,
      full_class_name: histContext.full_class_name,
      is_historical: histContext.is_historical,
      resolution_source: histContext.resolution_source,
      total_recorded_subjects: eMarks.length,
      total_assessed_subjects: totalAssessed,
      total_marks: totalMarks,
      max_possible_marks: totalAssessed * 100,
      average_percentage: avgPercentage,
      average_points: avgPoints,
      overall_grade: overallGrade,
      performance_level: perfLevel,
      grade_code: gradeCode,
      has_usable_data: hasUsableData,
    };
  });

  // Sort all milestones chronologically
  const sortedMilestones = sortMilestonesChronologically(rawMilestones);

  // Filter usable milestones (milestones with actual assessed scores)
  const usableMilestones = sortedMilestones.filter((m) => m.has_usable_data);

  // Compute step deltas and step trends across usable milestones
  for (let i = 0; i < usableMilestones.length; i++) {
    const current = usableMilestones[i];
    if (i === 0) {
      current.step_delta = undefined;
      current.step_trend = 'initial';
    } else {
      const prev = usableMilestones[i - 1];
      const delta = Math.round((current.average_percentage - prev.average_percentage) * 10) / 10;
      current.step_delta = delta;
      if (delta >= 1.5) {
        current.step_trend = 'improving';
      } else if (delta <= -1.5) {
        current.step_trend = 'declining';
      } else {
        current.step_trend = 'stable';
      }
    }
  }

  // Calculate Cumulative Metrics
  let cumulativeMeanPercentage: number | null = null;
  let cumulativeMeanPoints: number | null = null;
  if (usableMilestones.length > 0) {
    const sumPct = usableMilestones.reduce((acc, m) => acc + m.average_percentage, 0);
    const sumPts = usableMilestones.reduce((acc, m) => acc + m.average_points, 0);
    cumulativeMeanPercentage = Math.round((sumPct / usableMilestones.length) * 10) / 10;
    cumulativeMeanPoints = Math.round((sumPts / usableMilestones.length) * 100) / 100;
  }

  const earliest = usableMilestones.length > 0 ? usableMilestones[0] : null;
  const latest = usableMilestones.length > 0 ? usableMilestones[usableMilestones.length - 1] : null;

  // Compute Grade Progression Span string
  let gradeProgressionSpan = 'N/A';
  if (usableMilestones.length === 1) {
    gradeProgressionSpan = `${usableMilestones[0].grade} (${usableMilestones[0].year})`;
  } else if (usableMilestones.length > 1) {
    const firstG = `${usableMilestones[0].grade} (${usableMilestones[0].year})`;
    const lastG = `${usableMilestones[usableMilestones.length - 1].grade} (${usableMilestones[usableMilestones.length - 1].year})`;
    if (firstG === lastG) {
      gradeProgressionSpan = firstG;
    } else {
      gradeProgressionSpan = `${firstG} → ${lastG}`;
    }
  }

  const hasHistoricalContext = usableMilestones.some((m) => m.is_historical);

  // Minimum data requirement check: require at least 2 usable milestones for directional trajectory
  if (usableMilestones.length < 2) {
    return {
      student_id: student.id,
      student_name: student.full_name,
      admission_number: student.admission_number,
      all_milestones: sortedMilestones,
      usable_milestones: usableMilestones,
      trend: 'insufficient_data',
      trend_label: 'Insufficient Data',
      trend_icon: '⚪',
      trend_description:
        usableMilestones.length === 1
          ? 'Single examination recorded. At least 2 assessed terms are required to compute a directional trajectory.'
          : 'No assessed examination records found for this learner.',
      net_delta: null,
      slope: null,
      earliest_milestone: earliest,
      latest_milestone: latest,
      cumulative_mean_percentage: cumulativeMeanPercentage,
      cumulative_mean_points: cumulativeMeanPoints,
      grade_progression_span: gradeProgressionSpan,
      has_historical_context: hasHistoricalContext,
    };
  }

  // Calculate Net Delta and Linear Regression Slope
  const scores = usableMilestones.map((m) => m.average_percentage);
  const netDelta = Math.round((latest!.average_percentage - earliest!.average_percentage) * 10) / 10;
  const slope = calculateProgressionSlope(scores);

  // Threshold evaluation:
  // Improving: net delta >= +2.0% or positive progression slope >= +1.0%/term
  // Declining: net delta <= -2.0% or negative progression slope <= -1.0%/term
  // Stable: within [-2.0%, +2.0%] range
  let trend: TrajectoryTrendType = 'stable';
  let trendLabel = 'Stable';
  let trendIcon = '➡️';
  let trendDesc = 'Academic performance is steady and consistent across terms within standard variance bounds.';

  if (netDelta >= 2.0 || slope >= 1.0) {
    trend = 'improving';
    trendLabel = 'Improving';
    trendIcon = '📈';
    trendDesc = `Demonstrating positive academic progression with a net improvement of ${netDelta > 0 ? `+${netDelta}%` : `${netDelta}%`} across assessment milestones.`;
  } else if (netDelta <= -2.0 || slope <= -1.0) {
    trend = 'declining';
    trendLabel = 'Declining';
    trendIcon = '📉';
    trendDesc = `Performance has decreased by ${Math.abs(netDelta)}% across assessment milestones and may benefit from targeted academic support.`;
  }

  return {
    student_id: student.id,
    student_name: student.full_name,
    admission_number: student.admission_number,
    all_milestones: sortedMilestones,
    usable_milestones: usableMilestones,
    trend,
    trend_label: trendLabel,
    trend_icon: trendIcon,
    trend_description: trendDesc,
    net_delta: netDelta,
    slope,
    earliest_milestone: earliest,
    latest_milestone: latest,
    cumulative_mean_percentage: cumulativeMeanPercentage,
    cumulative_mean_points: cumulativeMeanPoints,
    grade_progression_span: gradeProgressionSpan,
    has_historical_context: hasHistoricalContext,
  };
}
