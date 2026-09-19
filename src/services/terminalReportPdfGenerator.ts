/**
 * Authoritative Terminal Report PDF Generator
 *
 * T-14: Terminal Report Form & PDF Presentation Layer.
 *
 * Architectural Mandates:
 * - Pure presentation layer over authoritative Terminal Results:
 *   «Assessments → Assessment Discovery → Terminal Calculation → Terminal Results → Terminal Report Form/PDF»
 * - Consumes authoritative LearningAreaTerminalResult objects directly.
 * - STRICTLY FORBIDDEN from independently calculating terminal percentages, levels, or points.
 * - STRICTLY FORBIDDEN from inventing overall metrics (no overall %, no overall level, no overall points, no rank).
 * - BANS the term "CAT" anywhere in labels, headers, or output.
 * - Supports dynamic assessment counts (1, 2, 3, 4, 5+ columns) in A4 Portrait.
 * - Rigorously differentiates "OFFICIAL TERMINAL REPORT" vs "PROVISIONAL TERMINAL REPORT".
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, School, ClassStream, Subject, Grade, Teacher } from '../types';
import { ContributingAssessmentRef, LearningAreaTerminalResult } from './terminalResultsEngine';
import { TerminalLearnerRanking, isJuniorSchoolEducationLevel, calculateSingleLearnerRanking } from './terminalRankingEngine';
import { getStreamNameForLearner } from './terminalMeritListExporter';
import { savePdf } from '../utils/fileDownloader';
import { formatKenyaDate } from '../utils/kenyaDateUtils';
import { stripSurroundingQuotes } from '../utils/filterUtils';
import { resolveSubjectTeacher } from '../utils/teacherResolutionUtils';
import { isKiswahiliSubject } from '../utils/kiswahiliCommentValidator';

export interface TerminalReportPDFData {
  student: Student;
  school: School;
  classStream?: ClassStream;
  academicYear: string | number;
  term: string;
  isProvisionalMode?: boolean;
  contributingAssessments: ContributingAssessmentRef[];
  subjects: Subject[];
  resultsBySubject: Map<string, LearningAreaTerminalResult>;
  grades?: Grade[];
  teachers?: Teacher[];
  classes?: ClassStream[];
  nextTermOpeningDate?: string;
  customSubjectComments?: Record<string, string>;
  savedRemarks?: {
    class_teacher_comment?: string;
    class_teacher_name?: string;
    headteacher_comment?: string;
    headteacher_name?: string;
    hoi_name?: string;
    subject_comments?: Record<string, string>;
  };
  ranking?: TerminalLearnerRanking;
}

export const TERMINAL_PDF_COLORS = {
  PRIMARY_FOREST: [6, 78, 59] as [number, number, number],      // #064E3B - Primary dark green
  HEADER_SLATE: [15, 23, 42] as [number, number, number],       // #0F172A - Deep slate
  WHITE: [255, 255, 255] as [number, number, number],
  CARD_BG: [248, 250, 252] as [number, number, number],
  TEXT_DARK: [15, 23, 42] as [number, number, number],
  TEXT_MUTED: [71, 85, 105] as [number, number, number],
  BORDER_LINE: [203, 213, 225] as [number, number, number],
  AMBER_WARN: [217, 119, 6] as [number, number, number],
  ROSE_DANGER: [225, 29, 72] as [number, number, number],
  EE: [16, 185, 129] as [number, number, number],
  ME: [37, 99, 235] as [number, number, number],
  AE: [217, 119, 6] as [number, number, number],
  BE: [225, 29, 72] as [number, number, number],
};

/**
 * Generates an authoritative default developmental comment for a learning area.
 */
export function getDefaultSubjectComment(subject: Subject, result: LearningAreaTerminalResult | undefined): string {
  if (!result) {
    return 'Incomplete assessment record; pending evaluation.';
  }

  if (result.status === 'INCOMPLETE (X)') {
    return 'Incomplete assessment record; learner missed contributing assessment.';
  }
  if (result.status === 'INCOMPLETE (Y)') {
    return 'Irregularity recorded; pending board resolution.';
  }
  if (result.status === 'INCOMPLETE (X/Y)') {
    return 'Incomplete and irregular record; requires board review.';
  }

  const isKis = isKiswahiliSubject(subject);
  const band = result.cbePerformanceLevel || '';

  if (band.startsWith('EE')) {
    if (isKis) return 'Umahiri wa hali ya juu katika stadi za lugha na mawasiliano.';
    return 'Exceeding expectations with outstanding mastery and consistent application.';
  }
  if (band.startsWith('ME')) {
    if (isKis) return 'Kiwango cha kuridhisha katika umilisi wa lugha na utendaji.';
    return 'Meeting expectations. Shows solid grasp of core competencies and skills.';
  }
  if (band.startsWith('AE')) {
    if (isKis) return 'Anakaribia kiwango kinachohitajika; anahitaji mazoezi zaidi.';
    return 'Approaching expectations. Commendable effort; regular revision recommended.';
  }
  if (band.startsWith('BE')) {
    if (isKis) return 'Chini ya kiwango kinachotarajiwa; anahitaji mwongozo wa karibu.';
    return 'Below expectations. Requires targeted remedial support in foundational concepts.';
  }

  return 'Good progress shown throughout the term.';
}

/**
 * Builds an A4 Portrait jsPDF document for a learner's Terminal Report.
 */
export async function buildTerminalReportDoc(
  data: TerminalReportPDFData,
  existingDoc?: jsPDF
): Promise<jsPDF> {
  const {
    student,
    school,
    classStream,
    academicYear,
    term,
    isProvisionalMode = false,
    contributingAssessments = [],
    subjects = [],
    resultsBySubject,
    nextTermOpeningDate,
    savedRemarks,
    teachers = [],
    customSubjectComments,
  } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  let currentY = 7;

  // -------------------------------------------------------------
  // 1. TOP COLOR ACCENT BAR
  // -------------------------------------------------------------
  if (isProvisionalMode) {
    doc.setFillColor(TERMINAL_PDF_COLORS.AMBER_WARN[0], TERMINAL_PDF_COLORS.AMBER_WARN[1], TERMINAL_PDF_COLORS.AMBER_WARN[2]);
  } else {
    doc.setFillColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
  }
  doc.rect(marginX, currentY, contentWidth, 2.5, 'F');
  currentY += 5;

  // -------------------------------------------------------------
  // 2. SCHOOL HEADER
  // -------------------------------------------------------------
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const schoolName = (school?.school_name || 'Competency-Based Education Center').toUpperCase();
  doc.text(schoolName, pageWidth / 2, currentY + 5, { align: 'center' });

  let textYOffset = 5;

  if (school?.motto) {
    const cleanMotto = stripSurroundingQuotes(school.motto);
    if (cleanMotto) {
      textYOffset += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
      doc.text(cleanMotto, pageWidth / 2, currentY + textYOffset, { align: 'center' });
    }
  }

  const contactPieces = [
    school?.phone ? `Tel: ${school.phone}` : null,
    school?.email ? `Email: ${school.email}` : null,
    school?.address ? school.address : null,
  ].filter(Boolean).join(' | ');

  if (contactPieces) {
    textYOffset += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
    doc.text(contactPieces, pageWidth / 2, currentY + textYOffset, { align: 'center' });
  }

  currentY += Math.max(14, textYOffset + 5);

  // -------------------------------------------------------------
  // 3. REPORT TITLE BANNER (OFFICIAL VS PROVISIONAL)
  // -------------------------------------------------------------
  const reportTitle = isProvisionalMode ? 'PROVISIONAL TERMINAL REPORT' : 'OFFICIAL TERMINAL REPORT';
  if (isProvisionalMode) {
    doc.setFillColor(TERMINAL_PDF_COLORS.AMBER_WARN[0], TERMINAL_PDF_COLORS.AMBER_WARN[1], TERMINAL_PDF_COLORS.AMBER_WARN[2]);
  } else {
    doc.setFillColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
  }
  doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, 'F');
  doc.setTextColor(TERMINAL_PDF_COLORS.WHITE[0], TERMINAL_PDF_COLORS.WHITE[1], TERMINAL_PDF_COLORS.WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(reportTitle, pageWidth / 2, currentY + 4.5, { align: 'center' });
  currentY += 8.5;

  // PROVISIONAL WARNING NOTICE (Only when in Provisional Mode)
  if (isProvisionalMode) {
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(TERMINAL_PDF_COLORS.AMBER_WARN[0], TERMINAL_PDF_COLORS.AMBER_WARN[1], TERMINAL_PDF_COLORS.AMBER_WARN[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginX, currentY, contentWidth, 5.5, 1, 1, 'FD');
    doc.setTextColor(146, 64, 14); // Amber 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(
      'PROVISIONAL — FOR STAFF REVIEW ONLY — NOT FOR OFFICIAL LEARNER RELEASE',
      pageWidth / 2,
      currentY + 3.8,
      { align: 'center' }
    );
    currentY += 7.5;
  }

  // -------------------------------------------------------------
  // 4. LEARNER IDENTITY CARD
  // -------------------------------------------------------------
  const learnerFullName = (
    student.full_name || `${student.first_name || ''} ${student.last_name || ''}`
  ).trim().toUpperCase() || 'LEARNER';

  const learnerStreamName = getStreamNameForLearner(student, data.classes || (classStream ? [classStream] : []));
  const baseClassName = classStream?.class_name || student.grade || (student as any).class_name || 'Class';
  const classNameStr = learnerStreamName && learnerStreamName !== '—'
    ? `${baseClassName} · ${learnerStreamName}`
    : classStream?.stream
      ? `${baseClassName} · ${classStream.stream}`
      : baseClassName;

  const eduLevelStr = classStream?.education_level || 'Junior School';
  const sessionStr = `${academicYear} · ${term}`;

  doc.setFillColor(TERMINAL_PDF_COLORS.WHITE[0], TERMINAL_PDF_COLORS.WHITE[1], TERMINAL_PDF_COLORS.WHITE[2]);
  doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 1, 1, 'FD');

  // Row 1 Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
  doc.text('LEARNER NAME:', marginX + 3, currentY + 4);
  doc.text('ADM NO:', marginX + 68, currentY + 4);
  doc.text('CLASS & STREAM:', marginX + 104, currentY + 4);
  doc.text('ACADEMIC SESSION:', marginX + 150, currentY + 4);

  // Row 1 Values
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
  doc.text(learnerFullName, marginX + 3, currentY + 8.5, { maxWidth: 62 });
  doc.text(student.admission_number || 'N/A', marginX + 68, currentY + 8.5, { maxWidth: 30 });
  doc.text(classNameStr, marginX + 104, currentY + 8.5, { maxWidth: 42 });
  doc.text(sessionStr, marginX + 150, currentY + 8.5, { maxWidth: 42 });

  // Row 2 Sub-details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
  doc.text(`Level: ${eduLevelStr}  |  Mode: ${isProvisionalMode ? 'Provisional Evaluation' : 'Official Released Evaluation'}`, marginX + 3, currentY + 12.2);

  currentY += 16.5;

  // -------------------------------------------------------------
  // 5. TERMINAL EVALUATION SUMMARY BANNER & JUNIOR SCHOOL RANKING
  // -------------------------------------------------------------
  const evaluatedCount = subjects.filter((s) => {
    const res = resultsBySubject.get(s.id);
    return res && res.isComplete;
  }).length;
  const totalCount = subjects.length;

  const isJuniorSchool = isJuniorSchoolEducationLevel(undefined, classStream, student);
  const effectiveRanking: TerminalLearnerRanking | undefined = isJuniorSchool
    ? (data.ranking || calculateSingleLearnerRanking({
        student,
        classStream,
        resultsBySubject,
        applicableSubjects: subjects,
        isProvisionalMode,
      }))
    : undefined;

  const isTwoRowBanner = Boolean(isJuniorSchool);
  const bannerHeight = isTwoRowBanner ? 12 : 6.5;

  doc.setFillColor(TERMINAL_PDF_COLORS.CARD_BG[0], TERMINAL_PDF_COLORS.CARD_BG[1], TERMINAL_PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, currentY, contentWidth, bannerHeight, 1, 1, 'FD');

  const bannerColW = contentWidth / 3;

  // Row 1: Learning Areas, Term Scope, Status
  const row1Y = currentY + 4.2;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
  doc.text('LEARNING AREAS:', marginX + 3, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
  doc.text(`${evaluatedCount} of ${totalCount} Evaluated`, marginX + 27, row1Y);

  // Col 2: Assessment Scope
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
  doc.text('TERM SCOPE:', marginX + bannerColW + 3, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
  doc.text(`${contributingAssessments.length} Contributing Assessment${contributingAssessments.length === 1 ? '' : 's'}`, marginX + bannerColW + 21, row1Y);

  // Col 3: Status
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
  doc.text('STATUS:', marginX + bannerColW * 2 + 3, row1Y);
  doc.setFont('helvetica', 'bold');
  if (isProvisionalMode) {
    doc.setTextColor(TERMINAL_PDF_COLORS.AMBER_WARN[0], TERMINAL_PDF_COLORS.AMBER_WARN[1], TERMINAL_PDF_COLORS.AMBER_WARN[2]);
    doc.text('PROVISIONAL REVIEW', marginX + bannerColW * 2 + 15, row1Y);
  } else {
    doc.setTextColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
    doc.text('OFFICIAL RELEASE', marginX + bannerColW * 2 + 15, row1Y);
  }

  // Row 2: Junior School Ranking Metrics
  if (isTwoRowBanner && effectiveRanking) {
    // Subtle internal divider line
    doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
    doc.setLineWidth(0.15);
    doc.line(marginX + 2, currentY + 6.0, marginX + contentWidth - 2, currentY + 6.0);

    const row2Y = currentY + 9.8;
    const isRankable = effectiveRanking.isRankable;

    // Col 1: Terminal Total Marks
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
    doc.text('TOTAL MARKS:', marginX + 3, row2Y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
    const totalMarksStr = isRankable && effectiveRanking.terminalTotalMarks !== null
      ? `${effectiveRanking.terminalTotalMarks} / ${effectiveRanking.terminalTotalMaximum}`
      : '—';
    doc.text(totalMarksStr, marginX + 22, row2Y);

    // Col 2: Stream Position
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
    const streamLabel = isProvisionalMode ? 'PROV. STREAM POS:' : 'STREAM POSITION:';
    doc.text(streamLabel, marginX + bannerColW + 3, row2Y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
    const streamOffset = isProvisionalMode ? 31 : 28;
    const streamPosStr = isRankable && effectiveRanking.streamPosition !== null
      ? `${effectiveRanking.streamPosition} / ${effectiveRanking.streamPositionDenominator}`
      : '—';
    doc.text(streamPosStr, marginX + bannerColW + streamOffset, row2Y);

    // Col 3: Overall Position
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
    const overallLabel = isProvisionalMode ? 'PROV. OVERALL POS:' : 'OVERALL POSITION:';
    doc.text(overallLabel, marginX + bannerColW * 2 + 3, row2Y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
    const overallOffset = isProvisionalMode ? 32 : 29;
    const overallPosStr = isRankable && effectiveRanking.overallPosition !== null
      ? `${effectiveRanking.overallPosition} / ${effectiveRanking.overallPositionDenominator}`
      : '—';
    doc.text(overallPosStr, marginX + bannerColW * 2 + overallOffset, row2Y);
  }

  currentY += bannerHeight + 2.0;

  // -------------------------------------------------------------
  // 6. MAIN LEARNING AREA & DYNAMIC CONTRIBUTING ASSESSMENTS TABLE
  // -------------------------------------------------------------
  const numAssessments = contributingAssessments.length;

  // Exact T-14C Locked Geometry (Total = 194mm printable width)
  let learningAreaColWidth: number;
  let assessmentColWidth: number;
  let terminalColWidth: number;
  let commentsColWidth: number;
  let instructorColWidth: number;

  if (numAssessments === 4) {
    learningAreaColWidth = 42;
    assessmentColWidth = 18;
    terminalColWidth = 24;
    commentsColWidth = 38;
    instructorColWidth = 18;
  } else if (numAssessments === 3) {
    learningAreaColWidth = 44;
    assessmentColWidth = 20;
    terminalColWidth = 26;
    commentsColWidth = 44;
    instructorColWidth = 20;
  } else if (numAssessments === 2) {
    learningAreaColWidth = 46;
    assessmentColWidth = 22;
    terminalColWidth = 28;
    commentsColWidth = 52;
    instructorColWidth = 24;
  } else if (numAssessments === 1) {
    learningAreaColWidth = 46;
    assessmentColWidth = 24;
    terminalColWidth = 28;
    commentsColWidth = 68;
    instructorColWidth = 28;
  } else if (numAssessments > 4) {
    learningAreaColWidth = 38;
    terminalColWidth = 22;
    commentsColWidth = 30;
    instructorColWidth = 16;
    const remainingForAssessments = contentWidth - (learningAreaColWidth + terminalColWidth + commentsColWidth + instructorColWidth);
    assessmentColWidth = remainingForAssessments / numAssessments;
  } else {
    learningAreaColWidth = 54;
    assessmentColWidth = 0;
    terminalColWidth = 30;
    commentsColWidth = 70;
    instructorColWidth = 40;
  }

  // Build dynamic table headers (no "CAT" terminology allowed)
  const assessmentHeaders = contributingAssessments.map((a) => {
    const cleanExamName = a.exam_name.replace(/\bCAT\s*(\d+)?\b/gi, (_, n) => (n ? `Assessment ${n}` : 'Assessment'));
    const maxScore = typeof a.max_marks === 'number' ? a.max_marks : (typeof a.out_of === 'number' ? a.out_of : 100);
    return `${cleanExamName}\n(Max: ${maxScore})`;
  });

  const tableHead = [
    ['Learning Area', ...assessmentHeaders, 'Terminal Result', 'Comments', 'Instructor'],
  ];

  // Traceability flags for supplementary section
  const resolvedEntriesToTrace: Array<{
    subjectName: string;
    examName: string;
    originalStatus: string;
    originalReason: string;
    replacementScore: string;
    resolutionReason: string;
    authorisedBy: string;
    resolutionDate: string;
  }> = [];

  const targetClassId = classStream?.id || student.class_id;
  const targetStreamId = classStream?.stream_id || student.stream_id;

  const tableRows = subjects.map((subject) => {
    const result = resultsBySubject.get(subject.id);

    // Subject display
    const subjTitle = subject.subject_code
      ? `${subject.subject_name}\n(${subject.subject_code})`
      : subject.subject_name;

    // Dynamic assessment cells: compact stacked representation
    const assessmentCells = contributingAssessments.map((a) => {
      const entry = result?.assessmentTrail?.find((t) => t.examId === a.id);
      if (!entry) {
        return 'X\nMissing';
      }

      if (entry.status === 'Blank' || entry.status === 'X') {
        return 'X\nMissing';
      }

      if (entry.status === 'Y') {
        return 'Y\nIrregularity';
      }

      if (entry.resolvedFromY) {
        // Trace resolution
        resolvedEntriesToTrace.push({
          subjectName: subject.subject_name,
          examName: a.exam_name,
          originalStatus: 'Y',
          originalReason: entry.irregularityReason || 'Absence / Irregularity',
          replacementScore: `${entry.rawScore}/${entry.outOf} (${Math.round(entry.percentage || 0)}%)`,
          resolutionReason: entry.resolutionReason || 'Authorised replacement mark',
          authorisedBy: entry.resolvedBy || 'Academic Board',
          resolutionDate: entry.resolvedAt ? formatKenyaDate(entry.resolvedAt) : 'Recorded',
        });
        const roundedPct = Math.round(entry.percentage || 0);
        return `${roundedPct}%\n${entry.cbePerformanceLevel || ''}*`.trim();
      }

      // Genuine zero check: zero is valid, never treat as missing
      if (entry.rawScore === 0 || entry.percentage === 0) {
        return '0%\nBE2 · 1 pt';
      }

      // Normal numerical mark
      if (typeof entry.percentage === 'number' && Number.isFinite(entry.percentage)) {
        const roundedPct = Math.round(entry.percentage);
        const band = entry.cbePerformanceLevel || '';
        return `${roundedPct}%\n${band}`.trim();
      }

      return 'X\nMissing';
    });

    // Terminal Result Cell: MUST consume authoritative result without recalculation
    let terminalCellText = 'INCOMPLETE (X)';
    if (result) {
      if (result.isComplete && typeof result.terminalPercentage === 'number') {
        const pts = typeof result.points === 'number' ? result.points : 0;
        terminalCellText = `${result.terminalPercentage}% ${result.cbePerformanceLevel}\n${pts} pts`;
      } else {
        // Incomplete status
        terminalCellText = result.status || 'INCOMPLETE (X)';
      }
    }

    // Comments Cell
    const customComment = customSubjectComments?.[subject.id] || savedRemarks?.subject_comments?.[subject.id];
    const commentStr = customComment
      ? stripSurroundingQuotes(customComment)
      : getDefaultSubjectComment(subject, result);

    // Instructor Cell
    const subjTeacher = resolveSubjectTeacher(teachers, subject.id, targetClassId, targetStreamId);
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : '';

    return [subjTitle, ...assessmentCells, terminalCellText, commentStr, teacherNameStr];
  });

  const columnStyles: Record<number, any> = {
    0: { halign: 'left', cellWidth: learningAreaColWidth, fontStyle: 'bold' },
  };

  for (let i = 1; i <= numAssessments; i++) {
    columnStyles[i] = { halign: 'center', cellWidth: assessmentColWidth };
  }
  columnStyles[numAssessments + 1] = {
    halign: 'center',
    cellWidth: terminalColWidth,
    fontStyle: 'bold',
  };
  columnStyles[numAssessments + 2] = {
    halign: 'left',
    cellWidth: commentsColWidth,
    fontStyle: 'italic',
    fontSize: numAssessments >= 4 ? 5.8 : 6.4,
  };
  columnStyles[numAssessments + 3] = {
    halign: 'left',
    cellWidth: instructorColWidth,
    fontSize: numAssessments >= 4 ? 5.8 : 6.4,
  };

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 10, bottom: 15 },
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: numAssessments >= 4 ? 6.2 : 6.8,
      cellPadding: numAssessments >= 4 ? 1.4 : 1.8,
      textColor: TERMINAL_PDF_COLORS.TEXT_DARK as [number, number, number],
      lineColor: TERMINAL_PDF_COLORS.BORDER_LINE as [number, number, number],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: isProvisionalMode
        ? (TERMINAL_PDF_COLORS.AMBER_WARN as [number, number, number])
        : (TERMINAL_PDF_COLORS.PRIMARY_FOREST as [number, number, number]),
      textColor: TERMINAL_PDF_COLORS.WHITE as [number, number, number],
      fontStyle: 'bold',
      fontSize: numAssessments >= 4 ? 6.2 : 6.8,
      halign: 'center',
      cellPadding: 1.8,
    },
    columnStyles,
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        const val = String(cellData.cell.raw || '');
        if (val.includes('INCOMPLETE (X/Y)')) {
          cellData.cell.styles.textColor = [190, 18, 60]; // Rose-700
          cellData.cell.styles.fontStyle = 'bold';
        } else if (val.includes('INCOMPLETE (Y)') || val.startsWith('Y\n') || val.includes('Irregularity')) {
          cellData.cell.styles.textColor = [180, 83, 9]; // Amber-700
          cellData.cell.styles.fontStyle = 'bold';
        } else if (val.includes('INCOMPLETE (X)') || val.startsWith('X\n') || val.includes('Missing')) {
          cellData.cell.styles.textColor = [100, 116, 139]; // Slate-500
          cellData.cell.styles.fontStyle = 'bold';
        } else if (val.includes('EE')) {
          cellData.cell.styles.textColor = TERMINAL_PDF_COLORS.EE as [number, number, number];
        } else if (val.includes('ME')) {
          cellData.cell.styles.textColor = TERMINAL_PDF_COLORS.ME as [number, number, number];
        } else if (val.includes('AE')) {
          cellData.cell.styles.textColor = TERMINAL_PDF_COLORS.AE as [number, number, number];
        } else if (val.includes('BE')) {
          cellData.cell.styles.textColor = TERMINAL_PDF_COLORS.BE as [number, number, number];
        }
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 3;

  // Check if we need to add a page for remarks, grading key, and signatures
  const requiredRemainingSpace = resolvedEntriesToTrace.length > 0 ? 68 : 58;
  if (currentY + requiredRemainingSpace > pageHeight - 12) {
    doc.addPage('a4', 'portrait');
    currentY = 10;
  }

  // -------------------------------------------------------------
  // 7. CLASS TEACHER'S & HEAD OF INSTITUTION'S REMARKS CARDS
  // -------------------------------------------------------------
  const classTeacher = targetClassId
    ? (teachers?.find((t) => t.id === classStream?.class_teacher_id) || teachers?.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.headteacher_name || savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment) ||
    'Demonstrates commendable dedication and effort throughout the term. Encouraged to sustain focus and consistency across all learning areas.';

  const hoiComment = stripSurroundingQuotes(savedRemarks?.headteacher_comment) ||
    'A satisfactory terminal evaluation showing steady academic development. Well done on the term\'s work.';

  // CT Box (Subtle slate tint)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, currentY, contentWidth, 11, 1, 1, 'FD');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 3.8);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.4);
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
  doc.text(ctComment, marginX + 3, currentY + 7.8, { maxWidth: contentWidth - 6 });

  currentY += 12.5;

  // HOI Box (Soft warm ivory tint)
  doc.setFillColor(254, 253, 248);
  doc.setDrawColor(229, 215, 185);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, currentY, contentWidth, 11, 1, 1, 'FD');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 3.8);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.4);
  doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
  doc.text(hoiComment, marginX + 3, currentY + 7.8, { maxWidth: contentWidth - 6 });

  currentY += 12.5;

  // -------------------------------------------------------------
  // 8. PROVENANCE & RESOLUTION AUDIT TRAIL (If Resolved Y exists)
  // -------------------------------------------------------------
  if (resolvedEntriesToTrace.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
    doc.setLineWidth(0.2);
    const boxHeight = 5 + resolvedEntriesToTrace.length * 4.2;
    doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 1, 1, 'FD');

    doc.setFontSize(6.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
    doc.text('* SPECIAL STATUS RESOLUTION & AUDIT PROVENANCE', marginX + 3, currentY + 3.5);

    resolvedEntriesToTrace.forEach((item, idx) => {
      const lineY = currentY + 7.0 + idx * 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.0);
      doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
      doc.text(
        `• ${item.subjectName} [${item.examName}]: Replaced Y with ${item.replacementScore}. Reason: ${item.resolutionReason} (Auth: ${item.authorisedBy}, ${item.resolutionDate})`,
        marginX + 3,
        lineY,
        { maxWidth: contentWidth - 6 }
      );
    });

    currentY += boxHeight + 3.0;
  }

  // -------------------------------------------------------------
  // 9. CBE 8-POINT ACHIEVEMENT SCALE GRADING KEY
  // -------------------------------------------------------------
  doc.setFillColor(TERMINAL_PDF_COLORS.CARD_BG[0], TERMINAL_PDF_COLORS.CARD_BG[1], TERMINAL_PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, currentY, contentWidth, 13, 1, 1, 'FD');

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TERMINAL_PDF_COLORS.PRIMARY_FOREST[0], TERMINAL_PDF_COLORS.PRIMARY_FOREST[1], TERMINAL_PDF_COLORS.PRIMARY_FOREST[2]);
  doc.text('CBE 8-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 3.6);

  const gradeKeyItems = [
    { code: 'EE1', desc: 'Exceeding Expectations Higher', range: '90–100%', pts: '8 Pts', color: TERMINAL_PDF_COLORS.EE },
    { code: 'EE2', desc: 'Exceeding Expectations Lower', range: '75–89%', pts: '7 Pts', color: TERMINAL_PDF_COLORS.EE },
    { code: 'ME1', desc: 'Meeting Expectations Higher', range: '58–74%', pts: '6 Pts', color: TERMINAL_PDF_COLORS.ME },
    { code: 'ME2', desc: 'Meeting Expectations Lower', range: '41–57%', pts: '5 Pts', color: TERMINAL_PDF_COLORS.ME },
    { code: 'AE1', desc: 'Approaching Expectations Higher', range: '31–40%', pts: '4 Pts', color: TERMINAL_PDF_COLORS.AE },
    { code: 'AE2', desc: 'Approaching Expectations Lower', range: '21–30%', pts: '3 Pts', color: TERMINAL_PDF_COLORS.AE },
    { code: 'BE1', desc: 'Below Expectations Higher', range: '11–20%', pts: '2 Pts', color: TERMINAL_PDF_COLORS.BE },
    { code: 'BE2', desc: 'Below Expectations Lower', range: '0–10%', pts: '1 Pt', color: TERMINAL_PDF_COLORS.BE },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 7.2 + row * 4.2;

    doc.setFontSize(6.0);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
    doc.text(`${item.range} (${item.pts})`, x + 6.5, y);
  });

  currentY += 15.0;

  // Check space for signatures (requires ~14mm)
  if (currentY + 14 > pageHeight - 12) {
    doc.addPage('a4', 'portrait');
    currentY = 10;
  }

  // -------------------------------------------------------------
  // 10. SIGNATURES SECTION
  // -------------------------------------------------------------
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', sign: 'Sign: __________________________' },
    { title: 'Head of Institution & Stamp', sign: 'Sign & Seal: ___________________' },
    { title: 'Parent / Guardian Signature', sign: 'Sign: __________________________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(TERMINAL_PDF_COLORS.WHITE[0], TERMINAL_PDF_COLORS.WHITE[1], TERMINAL_PDF_COLORS.WHITE[2]);
    doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 12, 1, 1, 'FD');

    doc.setFontSize(6.0);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 3.6, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_DARK[0], TERMINAL_PDF_COLORS.TEXT_DARK[1], TERMINAL_PDF_COLORS.TEXT_DARK[2]);
    doc.text(sig.sign, x + sigColW / 2, currentY + 8.8, { align: 'center' });
  });

  currentY += 14.0;

  // -------------------------------------------------------------
  // 11. FOOTER & WATERMARK ON ALL PAGES
  // -------------------------------------------------------------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Provisional watermark across page background
    if (isProvisionalMode) {
      doc.saveGraphicsState();
      doc.setTextColor(245, 158, 11); // Amber
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(36);
      // Subtle background watermark
      // @ts-ignore
      if (typeof doc.setGState === 'function') {
        // @ts-ignore
        doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      }
      doc.text('PROVISIONAL — STAFF REVIEW', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
      doc.restoreGraphicsState();
    }

    // Bottom Footer Line
    doc.setDrawColor(TERMINAL_PDF_COLORS.BORDER_LINE[0], TERMINAL_PDF_COLORS.BORDER_LINE[1], TERMINAL_PDF_COLORS.BORDER_LINE[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TERMINAL_PDF_COLORS.TEXT_MUTED[0], TERMINAL_PDF_COLORS.TEXT_MUTED[1], TERMINAL_PDF_COLORS.TEXT_MUTED[2]);

    const openingDateText = nextTermOpeningDate
      ? `Next Term Opening Date: ${formatKenyaDate(nextTermOpeningDate)}`
      : '';

    const footerLeft = openingDateText
      ? `${openingDateText}  ·  CBE Management System`
      : 'CBE Management System · Authoritative Terminal Results';

    doc.text(footerLeft, marginX, pageHeight - 5.5);

    const footerRight = `Page ${p} of ${totalPages}  ·  ${isProvisionalMode ? 'PROVISIONAL' : 'OFFICIAL'}`;
    doc.text(footerRight, pageWidth - marginX, pageHeight - 5.5, { align: 'right' });
  }

  return doc;
}

/**
 * Download a single learner's Terminal Report PDF.
 */
export async function downloadSingleTerminalReportPDF(data: TerminalReportPDFData): Promise<void> {
  const doc = await buildTerminalReportDoc(data);
  const cleanAdm = (data.student.admission_number || 'Learner').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanName = (data.student.full_name || `${data.student.first_name || ''}_${data.student.last_name || ''}`)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTerm = String(data.term).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanYear = String(data.academicYear).replace(/[^a-zA-Z0-9_-]/g, '_');
  const modeTag = data.isProvisionalMode ? 'Provisional' : 'Official';

  const fileName = `Terminal_Report_${cleanAdm}_${cleanName}_${cleanYear}_${cleanTerm}_${modeTag}.pdf`;
  await savePdf(doc, fileName);
}

/**
 * Batch download Terminal Reports PDF for an entire cohort/class stream.
 * Creates a single combined master document where each learner's report starts cleanly.
 */
export async function downloadBatchTerminalReportsPDF(
  reportsData: TerminalReportPDFData[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!reportsData || reportsData.length === 0) return;

  const total = reportsData.length;
  const masterDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < total; i++) {
    const reportItem = reportsData[i];
    if (onProgress) {
      onProgress(i + 1, total);
    }
    if (i > 0) {
      masterDoc.addPage('a4', 'portrait');
    }
    await buildTerminalReportDoc(reportItem, masterDoc);
  }

  const firstItem = reportsData[0];
  const classNameStr = firstItem.classStream
    ? `${firstItem.classStream.class_name || ''}_${firstItem.classStream.stream || ''}`
    : 'Class';
  const cleanClass = classNameStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanYear = String(firstItem.academicYear).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTerm = String(firstItem.term).replace(/[^a-zA-Z0-9_-]/g, '_');
  const modeTag = firstItem.isProvisionalMode ? 'Provisional' : 'Official';

  const fileName = `Terminal_Reports_${cleanClass}_${cleanYear}_${cleanTerm}_${modeTag}.pdf`;
  await savePdf(masterDoc, fileName);
}
