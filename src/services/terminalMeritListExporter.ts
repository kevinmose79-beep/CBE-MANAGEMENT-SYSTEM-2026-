import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  School,
  Student,
  Subject,
  ClassStream,
  Teacher,
  Grade,
  getEducationLevelForGrade,
} from '../types';
import {
  LearningAreaTerminalResult,
} from './terminalResultsEngine';
import {
  TerminalLearnerRanking,
  LearnerCohortEntry,
  calculateCohortTerminalRankings,
} from './terminalRankingEngine';
import { getGradeForMark, CBE_8_POINT_GRADES, getLearnerReportSubjects } from './analysisEngine';
import { formatTwoDecimalAverage } from '../utils/markUtils';
import { sortSubjectsByStandardOrder } from './meritListExporter';

function getLearnerFullName(student: Student): string {
  if (student.full_name && student.full_name.trim()) return student.full_name.trim();
  const combined = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  return combined || '—';
}

export function getSubjectDisplayName(sb: Subject): string {
  return sb.subject_name || (sb as any).name || 'Unnamed Subject';
}

export function getSubjectDisplayCode(sb: Subject): string {
  return sb.subject_code || (sb as any).code || '';
}

export function formatSubjectResultCell(res?: LearningAreaTerminalResult | null): {
  pctText: string;
  lvlText: string;
  isSpecial: boolean;
  specialCode: string;
} {
  if (!res) {
    return { pctText: '', lvlText: '', isSpecial: false, specialCode: '' };
  }
  const pct = res.terminalPercentage ?? (res as any).percentage ?? null;
  const lvl = res.cbePerformanceLevel ?? (res as any).performanceLevel ?? '';

  if (res.status === 'INCOMPLETE (X)' || (res.status as any) === 'X') {
    return { pctText: 'X', lvlText: '', isSpecial: true, specialCode: 'X' };
  }
  if (res.status === 'INCOMPLETE (Y)' || (res as any) === 'Y') {
    const code = (res as any).irregularityReason === 'Absent' ? 'X' : 'Y';
    return { pctText: code, lvlText: '', isSpecial: true, specialCode: code };
  }
  if (res.status === 'INCOMPLETE (X/Y)' || (res as any) === 'X/Y') {
    return { pctText: 'X/Y', lvlText: '', isSpecial: true, specialCode: 'X/Y' };
  }
  if (pct !== null && pct !== undefined && Number.isFinite(pct)) {
    return { pctText: String(pct), lvlText: lvl, isSpecial: false, specialCode: '' };
  }
  return { pctText: '', lvlText: '', isSpecial: false, specialCode: '' };
}

export interface SubjectColumnStat {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  validCount: number;
  totalPercentageSum: number;
  averagePercentage: number;
  averagePoints: number;
  performanceLevel: string;
  assignedTeacherName: string;
}

export interface TerminalMeritLearnerRow {
  student: Student;
  ranking?: TerminalLearnerRanking;
  subjectResults: Map<string, LearningAreaTerminalResult>;
  displayPosition: string; // blank "" for unranked
  terminalTotalMarks: number | null;
  learnerAverageMarks: number | null;
  learnerAveragePoints: number | null;
  overallPerformanceLevel: string;
  isRankable: boolean;
}

export interface TerminalMeritGenderStat {
  boysCount: number;
  girlsCount: number;
  totalCount: number;
}

export interface TerminalMeritSummaryStats {
  enrolledCount: number;
  rankableCount: number;
  unrankableCount: number;
  classCurriculumMax: number;
  classAverageMarks: number;
  classMeanPercentage: number;
  classMeanPoints: number;
  overallPerformanceLevel: string;
  genderDistribution: TerminalMeritGenderStat;
  subjectStats: Map<string, SubjectColumnStat>;
}

export interface TerminalMeritListData {
  title: string;
  school: School;
  academicYear: number;
  term: string;
  educationLevel: string;
  grade: string;
  streamName: string;
  isStreamView: boolean;
  isProvisionalMode: boolean;
  activeSubjects: Subject[];
  learners: TerminalMeritLearnerRow[];
  summaryStats: TerminalMeritSummaryStats;
  generatedAt: string;
  classes?: ClassStream[];
  teachers?: Teacher[];
  examName?: string;
  examCode?: string;
  classTeachersStr?: string;
}

/**
 * Resolve assigned subject teacher for a given class/stream and subject.
 * STRICT REQUIREMENT: If no subject teacher is assigned, return empty string "".
 * NEVER fallback to class teacher or placeholder.
 */
export function resolveSubjectTeacherName(
  subjectId: string,
  classStreamId: string,
  teachers: Teacher[] = []
): string {
  if (!teachers || teachers.length === 0 || !subjectId) return '';

  for (const t of teachers) {
    const allocs = t.allocations || [];
    for (const a of allocs) {
      const matchSubj = a.subject_id === subjectId;
      const matchClass =
        !classStreamId ||
        classStreamId === 'all' ||
        a.class_id === classStreamId ||
        a.stream_id === classStreamId;
      if (matchSubj && matchClass) {
        return t.teacher_name || (t as any).full_name || (t as any).name || '';
      }
    }
  }
  return '';
}

export function getClassTeachersString(
  grade: string,
  classes: ClassStream[] = [],
  teachers: Teacher[] = []
): string {
  const gradeClasses = classes.filter(
    (c) => (c.class_name || '').toLowerCase() === grade.toLowerCase()
  );
  if (gradeClasses.length === 0) return '................';

  const parts: string[] = [];
  for (const cls of gradeClasses) {
    const streamName = cls.stream || cls.class_name || 'Stream';
    let teacherName = '.................';
    if (cls.class_teacher_id && teachers.length > 0) {
      const t = teachers.find((tch) => tch.id === cls.class_teacher_id);
      if (t) teacherName = t.teacher_name || (t as any).full_name || (t as any).name || '.................';
    }
    parts.push(`${streamName.toUpperCase()} — ${teacherName}`);
  }
  return parts.length > 0 ? parts.join(' | ') : '................';
}

export function getStreamNameForLearner(student: Student, classes: ClassStream[] = []): string {
  if (!student) return '—';

  const directStream = (student as any).stream || (student as any).stream_name;

  // 1. Lookup by student.stream_id in classes
  if (student.stream_id) {
    const matched = classes.find((c) => c.stream_id === student.stream_id || c.id === student.stream_id);
    if (matched) {
      const stName = matched.stream || (matched as any).stream_name;
      if (stName && stName.trim() !== '') return stName.trim();
    }
  }

  // 2. Lookup by student.class_id in classes
  if (student.class_id) {
    if (directStream) {
      const matchedExact = classes.find(
        (c) => c.id === student.class_id && (c.stream || '').toLowerCase() === String(directStream).toLowerCase()
      );
      if (matchedExact && matchedExact.stream) return matchedExact.stream.trim();
    }
    const matched = classes.find((c) => c.id === student.class_id);
    if (matched) {
      const stName = matched.stream || (matched as any).stream_name;
      if (stName && stName.trim() !== '') return stName.trim();
    }
  }

  // 3. Direct student property fallback
  if (directStream && String(directStream).trim() !== '') {
    return String(directStream).trim();
  }

  return '—';
}

/**
 * Pure generator creating the authoritative, normalized Terminal Merit List dataset.
 * Consumed identically by Web UI, PDF, Excel, and CSV.
 */
export function generateTerminalMeritDataset(params: {
  school: School;
  academicYear: number;
  term: string;
  grade: string;
  selectedStreamId?: string;
  classes: ClassStream[];
  students: Student[];
  subjects: Subject[];
  teachers?: Teacher[];
  grades?: Grade[];
  isProvisionalMode?: boolean;
  learnerResultsMap: Map<string, Map<string, LearningAreaTerminalResult>>;
}): TerminalMeritListData {
  const {
    school,
    academicYear,
    term,
    grade,
    selectedStreamId = 'all',
    classes = [],
    students = [],
    subjects = [],
    teachers = [],
    grades = CBE_8_POINT_GRADES,
    isProvisionalMode = false,
    learnerResultsMap,
  } = params;

  const isStreamView = Boolean(selectedStreamId && selectedStreamId !== 'all');

  // 1. Resolve Stream Name
  let streamName = 'All Streams (General Grade View)';
  let targetClassStream: ClassStream | undefined = undefined;

  if (isStreamView) {
    targetClassStream = classes.find(
      (c) => c.stream_id === selectedStreamId || c.id === selectedStreamId
    );
    if (targetClassStream) {
      streamName = targetClassStream.stream
        ? `${targetClassStream.class_name} - ${targetClassStream.stream}`
        : targetClassStream.class_name;
    }
  }

  const effectiveEduLevel =
    targetClassStream?.education_level || getEducationLevelForGrade(grade) || 'Junior School';

  // 2. Filter cohort students strictly
  const cohortStudents = students.filter((s) => {
    // Must match grade
    const sGrade = s.grade || (s as any).class_name || '';
    const matchGrade = sGrade.toLowerCase() === grade.toLowerCase();
    if (!matchGrade) return false;

    // If stream view, must match stream strictly
    if (isStreamView && targetClassStream) {
      const targetStreamId = targetClassStream.stream_id || targetClassStream.id;
      const targetStreamName = (targetClassStream.stream || (targetClassStream as any).stream_name || '').toLowerCase();

      // 1. If student has a specific stream_id set
      if (s.stream_id) {
        if (s.stream_id === targetStreamId) return true;
        // If s.stream_id points to another stream, reject
        if (targetClassStream.stream_id && s.stream_id !== targetClassStream.stream_id) {
          return false;
        }
      }

      // 2. If student has direct stream text name
      const studentStreamName = (((s as any).stream || (s as any).stream_name || '') as string).toLowerCase();
      if (studentStreamName && targetStreamName) {
        if (studentStreamName === targetStreamName) return true;
        // If studentStreamName is set and doesn't match, reject
        return false;
      }

      // 3. Fallback to class_id matching if no stream identifier exists on student
      if (s.class_id && targetClassStream.id) {
        if (s.class_id === targetClassStream.id) return true;
      }

      return false;
    }

    return true;
  });

  // 3. Determine applicable subjects across cohort in standard CBE order
  const rawApplicableSet = new Map<string, Subject>();
  for (const st of cohortStudents) {
    const stClass = classes.find((c) => c.stream_id === st.stream_id || c.id === st.class_id);
    const stSubjs = getLearnerReportSubjects(st, stClass || targetClassStream, subjects, teachers);
    for (const sb of stSubjs) {
      if (sb && sb.id && !rawApplicableSet.has(sb.id)) {
        rawApplicableSet.set(sb.id, sb);
      }
    }
  }

  const unorderedSubjects = Array.from(rawApplicableSet.values());
  const activeSubjects =
    unorderedSubjects.length > 0
      ? sortSubjectsByStandardOrder(unorderedSubjects)
      : sortSubjectsByStandardOrder(
          subjects.filter(
            (s) =>
              !s.education_level ||
              s.education_level === effectiveEduLevel ||
              (s as any).level === effectiveEduLevel
          )
        );

  // 4. Build LearnerCohortEntry array for terminalRankingEngine
  const cohortEntries: LearnerCohortEntry[] = cohortStudents.map((st) => {
    const stClass = classes.find((c) => c.stream_id === st.stream_id || c.id === st.class_id);
    const stResults = learnerResultsMap.get(st.id) || new Map<string, LearningAreaTerminalResult>();
    return {
      student: st,
      classStream: stClass || targetClassStream,
      applicableSubjects: activeSubjects,
      resultsBySubject: stResults,
    };
  });

  // 5. Invoke Authoritative Terminal Ranking Engine
  const rankingsMap = calculateCohortTerminalRankings({
    learners: cohortEntries,
    isProvisionalMode,
  });

  // 6. Build Learner Rows
  const learnerRows: TerminalMeritLearnerRow[] = cohortStudents.map((st) => {
    const ranking = rankingsMap.get(st.id);
    const stResults = learnerResultsMap.get(st.id) || new Map<string, LearningAreaTerminalResult>();
    const isRankable = Boolean(ranking?.isRankable);

    // Position: Stream position for stream view, overall position for general grade view.
    // STRICT REQUIREMENT: Blank string "" for unranked learners.
    let displayPosition = '';
    if (isRankable && ranking) {
      const pos = isStreamView ? ranking.streamPosition : ranking.overallPosition;
      displayPosition = pos !== null ? String(pos) : '';
    }

    const terminalTotalMarks = isRankable && ranking ? ranking.terminalTotalMarks : null;

    // Learner Average Marks and Points
    let validSubjectCount = 0;
    let sumPercentages = 0;
    let sumPoints = 0;

    for (const sb of activeSubjects) {
      const res = stResults.get(sb.id);
      const pct = res?.terminalPercentage ?? (res as any)?.percentage ?? null;
      if (pct !== null && pct !== undefined && Number.isFinite(pct)) {
        validSubjectCount++;
        sumPercentages += pct;
        const gr = getGradeForMark(pct, grades, effectiveEduLevel, grade);
        sumPoints += gr.points;
      }
    }

    const learnerAverageMarks =
      validSubjectCount > 0 ? Math.round((sumPercentages / validSubjectCount) * 10) / 10 : null;
    const learnerAveragePoints =
      validSubjectCount > 0 ? Math.round((sumPoints / validSubjectCount) * 100) / 100 : null;

    const overallPerformanceLevel =
      learnerAverageMarks !== null
        ? getGradeForMark(Math.round(learnerAverageMarks), grades, effectiveEduLevel, grade).grade
        : 'INCOMPLETE';

    const augmentedRanking = ranking
      ? {
          ...ranking,
          status: (ranking as any).status || (!ranking.isRankable ? 'INC' : 'Complete'),
        }
      : undefined;

    return {
      student: st,
      ranking: augmentedRanking,
      subjectResults: stResults,
      displayPosition,
      terminalTotalMarks,
      learnerAverageMarks,
      learnerAveragePoints,
      overallPerformanceLevel,
      isRankable,
    };
  });

  // 7. Sort Rows: Ranked learners first (by numerical position), Unranked learners second (alphabetical)
  learnerRows.sort((a, b) => {
    if (a.isRankable && !b.isRankable) return -1;
    if (!a.isRankable && b.isRankable) return 1;

    if (a.isRankable && b.isRankable) {
      const posA = Number(a.displayPosition) || 999999;
      const posB = Number(b.displayPosition) || 999999;
      if (posA !== posB) return posA - posB;
      // Stable secondary tie-breaker for display ordering only (alphabetical)
      return (a.student.full_name || '').localeCompare(b.student.full_name || '');
    }

    // Both unranked: alphabetical
    return getLearnerFullName(a.student).localeCompare(getLearnerFullName(b.student));
  });

  // 8. Calculate Summary Statistics
  const enrolledCount = cohortStudents.length;
  const rankableLearners = learnerRows.filter((r) => r.isRankable);
  const rankableCount = rankableLearners.length;
  const unrankableCount = enrolledCount - rankableCount;

  // Dynamic Class Maximum = applicable subjects * 100
  const isUpperPrimaryTerminal = (effectiveEduLevel as string) === 'Upper Primary' || (effectiveEduLevel as string) === 'upper_primary' || Boolean(grade && ['Grade 4', 'Grade 5', 'Grade 6'].includes(grade));
  const classCurriculumMax = isUpperPrimaryTerminal ? 600 : activeSubjects.length * 100;

  // Class Average Marks = sum of rankable learner totals ÷ rankable count
  const totalAssessedMarksSum = rankableLearners.reduce(
    (acc, r) => acc + (r.terminalTotalMarks || 0),
    0
  );
  const classAverageMarks =
    rankableCount > 0
      ? parseFloat((totalAssessedMarksSum / rankableCount).toFixed(2))
      : 0;

  // Class Mean Percentage = sum of rankable learner averages ÷ rankable count
  const sumLearnerAverages = rankableLearners.reduce(
    (acc, r) => acc + (r.learnerAverageMarks || 0),
    0
  );
  const classMeanPercentage =
    rankableCount > 0
      ? parseFloat((sumLearnerAverages / rankableCount).toFixed(2))
      : 0;

  // Class Mean Points
  const sumLearnerPoints = rankableLearners.reduce(
    (acc, r) => acc + (r.learnerAveragePoints || 0),
    0
  );
  const classMeanPoints =
    rankableCount > 0
      ? parseFloat((sumLearnerPoints / rankableCount).toFixed(2))
      : 0;

  const overallClassGradeObj = getGradeForMark(
    Math.round(classMeanPercentage),
    grades,
    effectiveEduLevel,
    grade
  );
  const overallPerformanceLevel = overallClassGradeObj.grade;

  // 9. Calculate Per-Subject Summary Statistics
  const subjectStats = new Map<string, SubjectColumnStat>();

  for (const sb of activeSubjects) {
    let validCount = 0;
    let totalPct = 0;
    let totalPts = 0;

    for (const r of learnerRows) {
      const res = r.subjectResults.get(sb.id);
      const pct = res?.terminalPercentage ?? (res as any)?.percentage ?? null;
      if (pct !== null && pct !== undefined && Number.isFinite(pct)) {
        validCount++;
        totalPct += pct;
        const gr = getGradeForMark(pct, grades, effectiveEduLevel, grade);
        totalPts += gr.points;
      }
    }

    const avgPct = validCount > 0 ? parseFloat((totalPct / validCount).toFixed(2)) : 0;
    const avgPts = validCount > 0 ? parseFloat((totalPts / validCount).toFixed(2)) : 0;
    const perfLvl =
      validCount > 0
        ? getGradeForMark(Math.round(avgPct), grades, effectiveEduLevel, grade).grade
        : '—';

    const assignedTeacherName = resolveSubjectTeacherName(
      sb.id,
      selectedStreamId,
      teachers
    );

    subjectStats.set(sb.id, {
      subjectId: sb.id,
      subjectCode: getSubjectDisplayCode(sb) || getSubjectDisplayName(sb).substring(0, 3).toUpperCase(),
      subjectName: getSubjectDisplayName(sb),
      validCount,
      totalPercentageSum: totalPct,
      averagePercentage: avgPct,
      averagePoints: avgPts,
      performanceLevel: perfLvl,
      assignedTeacherName,
    });
  }

  const boysCount = cohortStudents.filter(
    (s) => s.gender === 'M' || (s.gender as any) === 'Male'
  ).length;
  const girlsCount = cohortStudents.filter(
    (s) => s.gender === 'F' || (s.gender as any) === 'Female'
  ).length;
  const genderDistribution: TerminalMeritGenderStat = {
    boysCount,
    girlsCount,
    totalCount: cohortStudents.length,
  };

  return {
    title: 'TERMINAL MERIT LIST',
    school,
    academicYear,
    term,
    educationLevel: effectiveEduLevel,
    grade,
    streamName,
    isStreamView,
    isProvisionalMode,
    activeSubjects,
    learners: learnerRows,
    summaryStats: {
      enrolledCount,
      rankableCount,
      unrankableCount,
      classCurriculumMax,
      classAverageMarks,
      classMeanPercentage,
      classMeanPoints,
      overallPerformanceLevel,
      genderDistribution,
      subjectStats,
    },
    generatedAt: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  };
}

/**
 * Build Terminal Merit List PDF Document in STRICT BLACK-AND-WHITE.
 * Adheres strictly to:
 * - Pure monochrome: Black text [0, 0, 0], white fill [255, 255, 255], black borders.
 * - NO color badges, NO colored zebra stripes, NO blue/red/green text.
 * - Bold black text for X and Y attendance/irregularity codes.
 * - Blank position for unranked learners.
 * - Dynamic Maximum (e.g. OUT OF 900 or applicable * 100).
 */
export function generateTerminalMeritListPdfDoc(data: TerminalMeritListData): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 6;
  const usableWidth = pageWidth - margin * 2; // 285mm

  // 1. Page 1 Header (Header Block - Page 1 ONLY)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const schoolName = (data.school?.school_name || 'MUCHORWE COMPREHENSIVE SCHOOL').toUpperCase();
  doc.text(schoolName, pageWidth / 2, 8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("REPORT: LEARNERS' PERFORMANCE TERMINAL MERIT LIST", pageWidth / 2, 11.8, { align: 'center' });

  const streamDisplay = data.isStreamView ? data.streamName.toUpperCase() : 'ALL STREAMS';
  const line1 = `CLASS: ${data.grade.toUpperCase()}   STREAM: ${streamDisplay}   TERM: ${data.term.toUpperCase()}   YEAR: ${data.academicYear}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(line1, pageWidth / 2, 15.2, { align: 'center' });

  const defaultExamName = `${data.grade.toUpperCase()} OPENER ASSESSMENT ${data.term.toUpperCase()} ${data.academicYear}`;
  const defaultExamCode = `${data.grade.replace(/\s+/g, '')}-${data.term.substring(0, 2).toUpperCase()}-${data.academicYear}-OPN`;
  const examName = (data.examName || defaultExamName).toUpperCase();
  const examCode = (data.examCode || defaultExamCode).toUpperCase();
  const line2 = `EXAM NAME: ${examName}   EXAM CODE: ${examCode}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(line2, pageWidth / 2, 18.2, { align: 'center' });

  const teachersStr = data.classTeachersStr || getClassTeachersString(data.grade, data.classes || [], data.teachers || []);
  const line3 = `CLASS TEACHERS: ${teachersStr}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(line3, pageWidth / 2, 21.2, { align: 'center' });

  // 2. Prepare Columns (24 Columns Total)
  // Identity: S.NO, ADM NO., LEARNER NAME, STREAM
  // Current ranking: STR. POS., OVR POS.
  // Previous ranking placeholders: PRV STR POS., PRV OVR POS.
  // Learning Areas: ENG, KIS, MATH, INT, SCI, CAS, SST, CRE, AGN, PRE-TECH...
  // Summary: SUB. ENTRY, TOTAL MARKS, AVG MARKS, TOTAL PTS, AVG PTS, CBE LEVEL
  const posColIndices = [4, 5, 6, 7];

  const tableHeaders: string[] = [
    'S.NO',
    'ADM NO.',
    'LEARNER NAME',
    'STREAM',
    '', // STR. POS. (drawn vertically)
    '', // OVR POS. (drawn vertically)
    '', // PRV STR POS. (drawn vertically)
    '', // PRV OVR POS. (drawn vertically)
    ...data.activeSubjects.map((s) => getSubjectDisplayCode(s) || getSubjectDisplayName(s).substring(0, 4).toUpperCase()),
    'SUB.\nENTRY',
    'TOTAL\nMARKS',
    'AVG\nMARKS',
    'TOTAL\nPTS',
    'AVG\nPTS',
    'CBE\nLEVEL',
  ];

  // 3. Prepare Learner Rows
  const learnerTableBody: any[][] = data.learners.map((lr, idx) => {
    const streamName = getStreamNameForLearner(lr.student, data.classes || []);

    // Position handling
    let strPos = '';
    let ovrPos = '';
    if (lr.isRankable && lr.ranking) {
      strPos = lr.ranking.streamPosition !== null && lr.ranking.streamPosition !== undefined ? String(lr.ranking.streamPosition) : '';
      ovrPos = lr.ranking.overallPosition !== null && lr.ranking.overallPosition !== undefined ? String(lr.ranking.overallPosition) : '';
    }

    // Previous positions (leave blank if no previous position data)
    const prvStrPos = (lr.ranking as any)?.previousStreamPosition !== undefined && (lr.ranking as any)?.previousStreamPosition !== null ? String((lr.ranking as any).previousStreamPosition) : '';
    const prvOvrPos = (lr.ranking as any)?.previousOverallPosition !== undefined && (lr.ranking as any)?.previousOverallPosition !== null ? String((lr.ranking as any).previousOverallPosition) : '';

    const row: any[] = [
      String(idx + 1), // S.NO
      lr.student.admission_number || '—',
      getLearnerFullName(lr.student),
      streamName,
      strPos,
      ovrPos,
      prvStrPos,
      prvOvrPos,
    ];

    let validSubjCount = 0;
    let learnerPointsSum = 0;

    for (const sb of data.activeSubjects) {
      const res = lr.subjectResults.get(sb.id);
      const cell = formatSubjectResultCell(res);
      if (cell.isSpecial) {
        row.push(cell.specialCode);
      } else if (cell.pctText) {
        // CRITICAL REQUIREMENT 5: ON ONE HORIZONTAL LINE: "{percentage} {CBE level}"
        row.push(`${cell.pctText} ${cell.lvlText}`);
        validSubjCount++;
        const pctNum = Number(cell.pctText);
        if (Number.isFinite(pctNum)) {
          const gr = getGradeForMark(pctNum, [], data.educationLevel, data.grade);
          learnerPointsSum += gr.points;
        }
      } else {
        row.push('—');
      }
    }

    const totMarksStr = lr.terminalTotalMarks !== null ? String(lr.terminalTotalMarks) : '—';
    const avgMarksStr = lr.learnerAverageMarks !== null ? `${formatTwoDecimalAverage(lr.learnerAverageMarks)}%` : '—';
    const totalPtsStr = lr.isRankable && learnerPointsSum > 0 ? String(learnerPointsSum) : (lr.learnerAveragePoints !== null ? formatTwoDecimalAverage(lr.learnerAveragePoints * validSubjCount) : '—');
    const avgPtsStr = lr.learnerAveragePoints !== null ? formatTwoDecimalAverage(lr.learnerAveragePoints) : '—';

    row.push(
      String(validSubjCount),
      totMarksStr,
      avgMarksStr,
      totalPtsStr,
      avgPtsStr,
      lr.overallPerformanceLevel
    );

    return row;
  });

  // 4. Column Width Calculations (Total 285mm usable)
  const numSubjects = data.activeSubjects.length;
  // Identity: S.NO: 6.5mm, ADM: 13.5mm, NAME: 36mm, STREAM: 11mm
  // Positions (4 cols): 7.5mm each = 30mm
  // Summary (6 cols): SUB. ENTRY: 9.5mm, TOT: 13.5mm, AVG: 13.5mm, TOT PTS: 11mm, AVG PTS: 11mm, LVL: 12.5mm = 71mm
  // Non-subject width = 97 + 71 = 168mm
  // Remaining for subjects = 285 - 168 = 117mm
  const subjectColWidth = numSubjects > 0 ? 117 / numSubjects : 13;

  const columnStyles: { [key: number]: any } = {
    0: { cellWidth: 6.5, halign: 'center' },  // S.NO
    1: { cellWidth: 13.5, halign: 'center' }, // ADM NO.
    2: { cellWidth: 36, halign: 'left' },     // LEARNER NAME
    3: { cellWidth: 11, halign: 'center' },   // STREAM
    4: { cellWidth: 7.5, halign: 'center' },  // STR. POS.
    5: { cellWidth: 7.5, halign: 'center' },  // OVR POS.
    6: { cellWidth: 7.5, halign: 'center' },  // PRV STR POS.
    7: { cellWidth: 7.5, halign: 'center' },  // PRV OVR POS.
  };

  data.activeSubjects.forEach((_, idx) => {
    columnStyles[8 + idx] = { cellWidth: subjectColWidth, halign: 'center' };
  });

  const sumStartIdx = 8 + numSubjects;
  columnStyles[sumStartIdx] = { cellWidth: 9.5, halign: 'center' };      // SUB. ENTRY
  columnStyles[sumStartIdx + 1] = { cellWidth: 13.5, halign: 'center' }; // TOTAL MARKS
  columnStyles[sumStartIdx + 2] = { cellWidth: 13.5, halign: 'center' }; // AVG MARKS
  columnStyles[sumStartIdx + 3] = { cellWidth: 11, halign: 'center' };   // TOTAL PTS
  columnStyles[sumStartIdx + 4] = { cellWidth: 11, halign: 'center' };   // AVG PTS
  columnStyles[sumStartIdx + 5] = { cellWidth: 12.5, halign: 'center' }; // CBE LEVEL

  // 4. Chunk Learner Rows into Groups of Max 42 Rows Per Page
  const ROWS_PER_PAGE = 42;
  const learnerChunks: any[][][] = [];

  if (learnerTableBody.length === 0) {
    learnerChunks.push([]);
  } else {
    for (let i = 0; i < learnerTableBody.length; i += ROWS_PER_PAGE) {
      learnerChunks.push(learnerTableBody.slice(i, i + ROWS_PER_PAGE));
    }
  }

  let learnerTableFinalY = 22;

  learnerChunks.forEach((chunk, chunkIdx) => {
    if (chunkIdx > 0) {
      doc.addPage();
    }

    const startY = chunkIdx === 0 ? 22 : 10;

    autoTable(doc, {
      startY,
      margin: { top: 8, left: margin, right: margin, bottom: 8 },
      head: [tableHeaders],
      body: chunk,
      theme: 'plain',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: 'center',
        valign: 'middle',
        minCellHeight: 14,
        fontSize: 5.5,
        cellPadding: { top: 0.3, bottom: 0.3, left: 0.2, right: 0.2 },
      },
      styles: {
        fontSize: 5.5,
        cellPadding: { top: 0.35, bottom: 0.35, left: 0.3, right: 0.3 },
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.15,
        halign: 'center',
        valign: 'middle',
        minCellHeight: 3.5,
      },
      columnStyles,
      didDrawCell: (hookData) => {
        // Draw vertical text for the 4 position headers
        if (hookData.section === 'head' && posColIndices.includes(hookData.column.index)) {
          const titleMap: { [key: number]: string } = {
            4: 'STR. POS.',
            5: 'OVR POS.',
            6: 'PRV STR POS.',
            7: 'PRV OVR POS.',
          };
          const title = titleMap[hookData.column.index];
          if (title) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(4.5);
            doc.setTextColor(0, 0, 0);
            const x = hookData.cell.x + hookData.cell.width / 2 + 0.6;
            const y = hookData.cell.y + hookData.cell.height - 1.5;
            doc.text(title, x, y, { angle: 90 });
          }
        }
      },
      didParseCell: (dataCell) => {
        const rawText = String(dataCell.cell.raw || '');
        if (rawText === 'X' || rawText === 'Y' || rawText === 'X/Y') {
          dataCell.cell.styles.fontStyle = 'bold';
          dataCell.cell.styles.textColor = [0, 0, 0];
        }
      },
    });

    learnerTableFinalY = (doc as any).lastAutoTable?.finalY || startY + 50;
  });

  // 5. Prepare & Render SEPARATE Summary Table (Subject Teacher Completely Removed)
  const summaryHeaders: string[] = ['', '', 'LEARNING AREA', '', '', '', '', ''];
  for (const sb of data.activeSubjects) {
    summaryHeaders.push(getSubjectDisplayCode(sb) || getSubjectDisplayName(sb).substring(0, 4).toUpperCase());
  }
  summaryHeaders.push('', 'CLASS AVG', '', '', '', '');

  // Row 1: AVG. MARKS
  const avgMarksRow: any[] = ['', '', 'AVG. MARKS', '', '', '', '', ''];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    avgMarksRow.push(stat && stat.validCount > 0 ? `${formatTwoDecimalAverage(stat.averagePercentage)}%` : '—');
  }
  avgMarksRow.push(
    '',
    formatTwoDecimalAverage(data.summaryStats.classAverageMarks),
    `${formatTwoDecimalAverage(data.summaryStats.classMeanPercentage)}%`,
    '',
    formatTwoDecimalAverage(data.summaryStats.classMeanPoints),
    data.summaryStats.overallPerformanceLevel
  );

  // Row 2: AVG. POINTS
  const avgPointsRow: any[] = ['', '', 'AVG. POINTS', '', '', '', '', ''];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    avgPointsRow.push(stat && stat.validCount > 0 ? formatTwoDecimalAverage(stat.averagePoints) : '—');
  }
  avgPointsRow.push('', '', '', '', formatTwoDecimalAverage(data.summaryStats.classMeanPoints), '');

  // Row 3: PERFORMANCE LEVEL
  const perfLevelRow: any[] = ['', '', 'PERFORMANCE LEVEL', '', '', '', '', ''];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    perfLevelRow.push(stat && stat.validCount > 0 ? stat.performanceLevel : '—');
  }
  perfLevelRow.push('', '', '', '', '', data.summaryStats.overallPerformanceLevel);

  const summaryTableBody = [
    avgMarksRow,
    avgPointsRow,
    perfLevelRow,
  ];

  let summaryStartY = learnerTableFinalY + 4;
  if (summaryStartY + 20 > pageHeight - 10) {
    doc.addPage();
    summaryStartY = 12;
  }

  autoTable(doc, {
    startY: summaryStartY,
    margin: { top: 8, left: margin, right: margin, bottom: 8 },
    head: [summaryHeaders],
    body: summaryTableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: 'center',
      valign: 'middle',
      fontSize: 5.5,
      cellPadding: { top: 0.4, bottom: 0.4, left: 0.2, right: 0.2 },
    },
    styles: {
      fontSize: 5.5,
      fontStyle: 'bold',
      cellPadding: { top: 0.4, bottom: 0.4, left: 0.2, right: 0.2 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles,
  });

  // 7. Render CLASS AVERAGE MARKS line below table (Req 14 & 15)
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  const maxStr = data.summaryStats.classCurriculumMax > 0 ? ` (OUT OF ${data.summaryStats.classCurriculumMax})` : '';
  const classAvgText = `CLASS AVERAGE MARKS: ${formatTwoDecimalAverage(data.summaryStats.classAverageMarks)}${maxStr}`;

  if (finalY + 8 < pageHeight - 12) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(classAvgText, margin, finalY + 5);
  } else {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(classAvgText, margin, 15);
  }

  // 8. Page Footers across all pages (Req 17)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    const footerText = `Generated: ${data.generatedAt}     Page ${i} of ${totalPages}`;
    doc.text(footerText, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }

  return doc;
}

/**
 * Download Terminal Merit List PDF in browser.
 */
export async function downloadTerminalMeritListPDF(data: TerminalMeritListData): Promise<void> {
  const doc = generateTerminalMeritListPdfDoc(data);
  const cleanFilename = `Terminal_Merit_List_${data.grade.replace(/\s+/g, '_')}_${data.isStreamView ? data.streamName.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Streams'}_${data.academicYear}_${data.term.replace(/\s+/g, '_')}.pdf`;
  doc.save(cleanFilename);
}

/**
 * Build Terminal Merit List in Excel Workbook format (.xlsx).
 * Uses exact normalized dataset values.
 */
export function generateTerminalMeritListWorkbook(data: TerminalMeritListData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const titleRow = [
    `${data.school.school_name || 'CBE MANAGEMENT SYSTEM'} - TERMINAL MERIT LIST`,
  ];
  const metaRow = [
    `Grade: ${data.grade}`,
    `Stream: ${data.streamName}`,
    `Academic Year: ${data.academicYear}`,
    `Term: ${data.term}`,
    `Mode: ${data.isProvisionalMode ? 'Provisional' : 'Official'}`,
    `Date: ${data.generatedAt}`,
  ];
  const summaryRow = [
    `Class Average Marks: ${formatTwoDecimalAverage(data.summaryStats.classAverageMarks)} / ${data.summaryStats.classCurriculumMax}`,
    `Class Mean: ${formatTwoDecimalAverage(data.summaryStats.classMeanPercentage)}%`,
    `Rankable: ${data.summaryStats.rankableCount} of ${data.summaryStats.enrolledCount}`,
  ];

  const headers = [
    'Position',
    'Admission No',
    'Learner Name',
    ...data.activeSubjects.map((s) => `${getSubjectDisplayName(s)} (${getSubjectDisplayCode(s)})`),
    `Total Marks (Out of ${data.summaryStats.classCurriculumMax})`,
    'Average Marks (%)',
    'Average Points',
    'Overall Level',
  ];

  const rows: any[][] = [];

  for (const lr of data.learners) {
    const row: any[] = [
      lr.displayPosition, // blank for unranked
      lr.student.admission_number || '',
      getLearnerFullName(lr.student),
    ];

    for (const sb of data.activeSubjects) {
      const res = lr.subjectResults.get(sb.id);
      const cell = formatSubjectResultCell(res);
      if (cell.isSpecial) {
        row.push(cell.specialCode);
      } else if (cell.pctText) {
        row.push(`${cell.pctText} (${cell.lvlText})`);
      } else {
        row.push('');
      }
    }

    row.push(
      lr.terminalTotalMarks !== null ? lr.terminalTotalMarks : '',
      lr.learnerAverageMarks !== null ? lr.learnerAverageMarks : '',
      lr.learnerAveragePoints !== null ? lr.learnerAveragePoints : '',
      lr.overallPerformanceLevel
    );

    rows.push(row);
  }

  // Summary rows in Excel
  const avgMarksRow: any[] = ['', '', 'Learning Area Average Marks (%)'];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    avgMarksRow.push(stat && stat.validCount > 0 ? stat.averagePercentage : '');
  }
  avgMarksRow.push(
    data.summaryStats.classAverageMarks,
    data.summaryStats.classMeanPercentage,
    data.summaryStats.classMeanPoints,
    data.summaryStats.overallPerformanceLevel
  );

  const avgPointsRow: any[] = ['', '', 'Learning Area Average Points'];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    avgPointsRow.push(stat && stat.validCount > 0 ? stat.averagePoints : '');
  }
  avgPointsRow.push('', '', data.summaryStats.classMeanPoints, '');

  const teacherRow: any[] = ['', '', 'Assigned Subject Teacher'];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    teacherRow.push(stat?.assignedTeacherName || '');
  }
  teacherRow.push('', '', '', '');

  const sheetData = [
    titleRow,
    metaRow,
    summaryRow,
    [],
    headers,
    ...rows,
    [],
    avgMarksRow,
    avgPointsRow,
    teacherRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Terminal Merit List');

  return wb;
}

/**
 * Download Terminal Merit List in Excel format in browser.
 */
export function downloadTerminalMeritListExcel(data: TerminalMeritListData): void {
  const wb = generateTerminalMeritListWorkbook(data);
  const cleanFilename = `Terminal_Merit_List_${data.grade.replace(/\s+/g, '_')}_${data.isStreamView ? data.streamName.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Streams'}_${data.academicYear}_${data.term.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}

/**
 * Build Terminal Merit List in CSV text format.
 * Strict parity with screen, PDF, and Excel.
 */
export function generateTerminalMeritListCsvContent(data: TerminalMeritListData): string {
  const headers = [
    'Position',
    'Admission No',
    'Learner Name',
    ...data.activeSubjects.map((s) => `${getSubjectDisplayName(s)} (${getSubjectDisplayCode(s)})`),
    `Total Marks (Out of ${data.summaryStats.classCurriculumMax})`,
    'Average Marks (%)',
    'Average Points',
    'Overall Level',
  ];

  const rows: any[][] = [];

  for (const lr of data.learners) {
    const row: any[] = [
      lr.displayPosition, // blank for unranked
      lr.student.admission_number || '',
      getLearnerFullName(lr.student),
    ];

    for (const sb of data.activeSubjects) {
      const res = lr.subjectResults.get(sb.id);
      const cell = formatSubjectResultCell(res);
      if (cell.isSpecial) {
        row.push(cell.specialCode);
      } else if (cell.pctText) {
        row.push(`${cell.pctText} (${cell.lvlText})`);
      } else {
        row.push('');
      }
    }

    row.push(
      lr.terminalTotalMarks !== null ? lr.terminalTotalMarks : '',
      lr.learnerAverageMarks !== null ? lr.learnerAverageMarks : '',
      lr.learnerAveragePoints !== null ? lr.learnerAveragePoints : '',
      lr.overallPerformanceLevel
    );

    rows.push(row);
  }

  // Summary rows in CSV
  const avgMarksRow: any[] = ['', '', 'Learning Area Average Marks (%)'];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    avgMarksRow.push(stat && stat.validCount > 0 ? stat.averagePercentage : '');
  }
  avgMarksRow.push(
    data.summaryStats.classAverageMarks,
    data.summaryStats.classMeanPercentage,
    data.summaryStats.classMeanPoints,
    data.summaryStats.overallPerformanceLevel
  );

  const avgPointsRow: any[] = ['', '', 'Learning Area Average Points'];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    avgPointsRow.push(stat && stat.validCount > 0 ? stat.averagePoints : '');
  }
  avgPointsRow.push('', '', data.summaryStats.classMeanPoints, '');

  const teacherRow: any[] = ['', '', 'Assigned Subject Teacher'];
  for (const sb of data.activeSubjects) {
    const stat = data.summaryStats.subjectStats.get(sb.id);
    teacherRow.push(stat?.assignedTeacherName || '');
  }
  teacherRow.push('', '', '', '');

  return Papa.unparse({
    fields: headers,
    data: [...rows, [], avgMarksRow, avgPointsRow, teacherRow],
  });
}

/**
 * Download Terminal Merit List in CSV format (.csv).
 * Strict parity with screen, PDF, and Excel.
 */
export function downloadTerminalMeritListCSV(data: TerminalMeritListData): void {
  const csvContent = generateTerminalMeritListCsvContent(data);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanFilename = `Terminal_Merit_List_${data.grade.replace(/\s+/g, '_')}_${data.isStreamView ? data.streamName.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Streams'}_${data.academicYear}_${data.term.replace(/\s+/g, '_')}.csv`;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export aliases for testing & backward compatibility
export const exportTerminalMeritListToPdf = generateTerminalMeritListPdfDoc;
export const exportTerminalMeritListToExcel = generateTerminalMeritListWorkbook;
export const exportTerminalMeritListToCsv = generateTerminalMeritListCsvContent;
