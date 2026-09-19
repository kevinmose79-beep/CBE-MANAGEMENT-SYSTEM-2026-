import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { savePdf, saveFile } from '../utils/fileDownloader';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  LearnerReportComment,
  LearnerRankingMetadata,
  getApplicableSubjectsForGrade,
  getEducationLevelForGrade,
  EducationLevel,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  calculateSubjectRank,
  getLearnerReportSubjects,
} from './analysisEngine';
import { getDisplayExamName } from '../utils/examDisplayUtils';
import { getLearnerClassAtExamTime, getStreamCohortStudentIds, getGradeCohortStudentIds } from './historicalContextResolver';
import { evaluateMark, formatPercentage } from '../utils/markUtils';
import { formatKenyaDate } from '../utils/kenyaDateUtils';
import { isKiswahiliSubject, getKiswahiliDefaultComment } from '../utils/kiswahiliCommentValidator';
import { resolveSubjectTeacher } from '../utils/teacherResolutionUtils';

export function resolvePDFLearnerContext(student: Student, exam: Examination | undefined, classes: ClassStream[]) {
  const examContext = exam ? getLearnerClassAtExamTime(student, exam, classes) : null;
  const isHistoricalContext = examContext?.is_historical === true;

  let targetClass = (classes || []).find((c) =>
    (student.stream_id && (c.stream_id === student.stream_id || c.id === student.stream_id))
  ) || (classes || []).find((c) => c.id === student.class_id);

  if (isHistoricalContext) {
    if (examContext.historical_context_resolved && examContext.class_id) {
      targetClass = (classes || []).find((c) =>
        (examContext.stream_id && (c.stream_id === examContext.stream_id || c.id === examContext.stream_id))
      ) || (classes || []).find((c) => c.id === examContext.class_id) || ({
        id: examContext.class_id,
        stream_id: examContext.stream_id,
        class_name: examContext.class_name,
        stream: examContext.stream_name,
        education_level: getEducationLevelForGrade(examContext.grade),
      } as ClassStream);
    } else {
      targetClass = undefined;
    }
  }

  const targetClassId = isHistoricalContext
    ? (examContext?.class_id || '')
    : (student.class_id || '');

  const targetStreamId = isHistoricalContext
    ? (examContext?.stream_id || targetClass?.stream_id || '')
    : (student.stream_id || targetClass?.stream_id || '');

  const classNameStr = isHistoricalContext
    ? (examContext?.full_class_name || 'Unknown Grade')
    : (targetClass
        ? `${targetClass.class_name} - ${targetClass.stream}`
        : student.class_id || student.grade || 'Grade 7');

  const studentGrade = isHistoricalContext
    ? (examContext?.grade || 'Unknown Grade')
    : (student.grade || targetClass?.class_name || '');

  const effectiveStudent: Student = isHistoricalContext
    ? { ...student, class_id: targetClassId, stream_id: targetStreamId, grade: studentGrade as Student['grade'] }
    : student;

  return {
    examContext,
    isHistoricalContext,
    targetClass,
    targetClassId,
    targetStreamId,
    classNameStr,
    studentGrade,
    effectiveStudent,
  };
}
import { stripSurroundingQuotes } from '../utils/filterUtils';
import { generatePersonalizedLearnerComment } from './learnerCommentGenerator';
import { buildLearnerTrajectory } from './learnerTrajectoryEngine';

export const PDF_COLORS = {
  // Primary Dark Forest Green (Structural Anchor)
  PRIMARY_NAVY: [6, 78, 59] as [number, number, number],    // #064E3B - Primary dark forest green
  NAVY_DARK: [6, 78, 59] as [number, number, number],       // #064E3B - Headers, primary accents, dark metric cards
  SLATE_HEADER: [6, 78, 59] as [number, number, number],    // #064E3B - Table headers, badge bars
  
  // High-Contrast Neutral & Slate Typography
  SLATE_MUTED: [71, 85, 105] as [number, number, number],   // #475569 - Slate muted labels (contrast 5.4:1 on white)
  SLATE_TEXT: [51, 65, 85] as [number, number, number],     // #334155 - Contact details & subtitles (contrast 7.8:1 on white)
  SLATE_DARK_TEXT: [15, 23, 42] as [number, number, number],// #0F172A - Body text, grade key text, comments (contrast 15:1 on white)
  
  // Surfaces: Predominantly White with Restrained Supporting Tints
  WHITE: [255, 255, 255] as [number, number, number],
  SLATE_LIGHT: [248, 250, 252] as [number, number, number], // #F8FAFC - Very subtle neutral/mint tint for CT box
  BORDER_SLATE: [203, 213, 225] as [number, number, number],// #CBD5E1 - Clean subtle slate border
  CARD_BG: [255, 255, 255] as [number, number, number],     // #FFFFFF - Crisp white for learner card, key box & charts
  
  // Dark Summary Metric Banner Text Colors (Crisp Contrast against #064E3B)
  METRIC_LABEL: [209, 250, 229] as [number, number, number],// #D1FAE5 - Soft mint label (contrast > 8:1 against #064E3B)
  METRIC_AVG: [255, 255, 255] as [number, number, number],   // #FFFFFF - Crisp pure white for 73% (contrast 10:1 against #064E3B)
  METRIC_LEVEL: [255, 255, 255] as [number, number, number], // #FFFFFF - Crisp pure white for ME1 (contrast 10:1 against #064E3B)
  
  // Restrained Head of Institution (HOI) Box (Subtle Warm Ivory, Non-competing)
  HOI_BG: [254, 253, 248] as [number, number, number],      // #FEFDF8 - Soft ivory surface
  HOI_BORDER: [229, 215, 185] as [number, number, number],  // #E5D7B9 - Subtle warm border
  HOI_LABEL: [6, 78, 59] as [number, number, number],       // #064E3B - Dark forest green title (consistent hierarchy)
  
  // Authoritative CBE 4-Level Performance Bands (High-Contrast & Distinct)
  EE: [4, 120, 87] as [number, number, number],             // #047857 - Exceeding Expectations (Vivid Dark Emerald, contrast 5.9:1)
  ME: [30, 64, 175] as [number, number, number],            // #1E40AF - Meeting Expectations (Royal Sapphire Blue - PRESERVED BLUE, contrast 9.0:1)
  AE: [180, 83, 9] as [number, number, number],             // #B45309 - Approaching Expectations (Dark Amber/Ochre, contrast 5.3:1)
  BE: [190, 18, 60] as [number, number, number],            // #BE123C - Below Expectations (Deep Crimson Rose, contrast 6.6:1)
};

export interface PDFReportData {
  student: Student;
  school: School;
  exam?: Examination;
  allExams?: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  allStudents: Student[];
  savedRemarks?: LearnerReportComment;
  nextTermOpeningDate?: string;
  aggregateRanking?: LearnerRankingMetadata;
}

/**
 * Resolves the explicit Next Term Opening Date for official PDF report generation.
 * Enforces the mandatory date invariant: throws an explicit error if missing.
 * Zero hardcoded fallback dates are permitted.
 */
import { formatDateToKenyaHumanReadable } from './nextTermOpeningDateResolver';

export function resolveNextTermOpeningDate(data: PDFReportData): string {
  const rawDate = (data.nextTermOpeningDate || data.savedRemarks?.next_term_opening_date || '').trim();
  if (!rawDate) {
    throw new Error(
      'Next Term Opening Date is required for official report card PDF generation. An administrator must explicitly select or confirm a valid date.'
    );
  }
  return formatDateToKenyaHumanReadable(rawDate) || rawDate;
}

// Helper to convert image URL to base64 data URL for jsPDF
async function getBase64ImageFromUrl(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) return null;
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 100;
          canvas.height = img.height || 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      img.src = imageUrl;
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// Draw Common Header Banner for all Report Cards
async function drawReportHeader(
  doc: jsPDF,
  school: School,
  title: string,
  subtitle: string,
  currentY: number
): Promise<number> {
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  // Top Dark Banner
  doc.setFillColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.rect(marginX, currentY, contentWidth, 2.5, 'F');
  currentY += 5;

  // School Name
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text((school.school_name || 'School Name Not Configured').toUpperCase(), pageWidth / 2, currentY + 5, { align: 'center' });

  let textYOffset = 5;

  if (school.motto) {
    const cleanMotto = stripSurroundingQuotes(school.motto);
    if (cleanMotto) {
      textYOffset += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(cleanMotto, pageWidth / 2, currentY + textYOffset, { align: 'center' });
    }
  }

  const contactDetails = [
    school.phone ? `Tel: ${school.phone}` : null,
  ].filter(Boolean).join(' | ');

  if (contactDetails) {
    textYOffset += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.SLATE_TEXT[0], PDF_COLORS.SLATE_TEXT[1], PDF_COLORS.SLATE_TEXT[2]);
    doc.text(contactDetails, pageWidth / 2, currentY + textYOffset, { align: 'center' });
  }

  currentY += Math.max(16, textYOffset + 6);

  // Level Title Badge Bar
  doc.setFillColor(PDF_COLORS.SLATE_HEADER[0], PDF_COLORS.SLATE_HEADER[1], PDF_COLORS.SLATE_HEADER[2]);
  doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, 'F');
  doc.setTextColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), pageWidth / 2, currentY + 4.5, { align: 'center' });

  currentY += 9.5;
  return currentY;
}

// -------------------------------------------------------------
// PERFORMANCE PROGRESSION GRAPH DRAWING HELPER (Vector jsPDF)
// -------------------------------------------------------------
export function drawPerformanceProgressionGraph(
  doc: jsPDF,
  data: PDFReportData,
  currentY: number,
  contentWidth: number,
  marginX: number
): number {
  const { student, exam, allExams = [], marks = [], subjects = [], grades = [], classes = [] } = data;

  // Build candidate exams: combine allExams and current exam
  const candidateExamsMap = new Map<string, Examination>();
  (allExams || []).forEach((e) => {
    if (e && e.id) candidateExamsMap.set(e.id, e);
  });
  if (exam && exam.id) {
    candidateExamsMap.set(exam.id, exam);
  }
  const candidateExams = Array.from(candidateExamsMap.values());

  if (candidateExams.length === 0) {
    return currentY;
  }

  // Authoritative trajectory calculation
  const trajectory = buildLearnerTrajectory(
    student,
    candidateExams,
    marks,
    subjects,
    grades,
    classes
  );

  // Chronologically filter milestones up to and including the current report exam
  let relevantMilestones = trajectory.usable_milestones || [];
  if (exam && exam.id) {
    const currentExamIdx = relevantMilestones.findIndex((m) => m.exam_id === exam.id);
    if (currentExamIdx >= 0) {
      relevantMilestones = relevantMilestones.slice(0, currentExamIdx + 1);
    }
  }

  // To prevent horizontal overcrowding on printable A4 width, cap at the most recent 5 milestones
  if (relevantMilestones.length > 5) {
    relevantMilestones = relevantMilestones.slice(-5);
  }

  // One-Page Budget Protection
  const footerLimitY = 276;
  const reservedBottomHeight = 76; // CT (15) + HOI (15) + Key (16) + Sigs (16) + Gaps (14)
  const availableHeight = footerLimitY - reservedBottomHeight - currentY;

  // If page is critically constrained (< 14mm), skip to guarantee 1-page invariant
  if (availableHeight < 14) {
    return currentY;
  }

  // CASE 1: Fewer than 2 usable milestones -> Render compact neutral notice
  if (relevantMilestones.length < 2) {
    const boxHeight = 10;
    doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
    doc.text('PERFORMANCE PROGRESSION:', marginX + 3, currentY + 6.2);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
    doc.text(
      'Progression data will appear when more assessment milestones are available.',
      marginX + 48,
      currentY + 6.2
    );

    return currentY + boxHeight + 3.5;
  }

  // CASE 2: 2 or more usable milestones -> Render full vector graph
  const cardHeight = Math.min(27, Math.max(22, availableHeight - 2));

  // Outer container card
  doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, cardHeight, 1, 1, 'FD');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text('PERFORMANCE PROGRESSION', marginX + 3, currentY + 4.2);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
  doc.text('Mean Score (%) Across Assessment Milestones', marginX + 50, currentY + 4.2);

  // Trend Badge on top right
  const firstM = relevantMilestones[0];
  const lastM = relevantMilestones[relevantMilestones.length - 1];
  const netDelta = Math.round((lastM.average_percentage - firstM.average_percentage) * 10) / 10;
  const isImproving = netDelta > 0.5;
  const isDeclining = netDelta < -0.5;
  const trendLabel = isImproving
    ? `+${netDelta}% Improving`
    : isDeclining
    ? `${netDelta}% Declining`
    : `Stable (${Math.round(lastM.average_percentage)}%)`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  if (isImproving) {
    doc.setTextColor(PDF_COLORS.EE[0], PDF_COLORS.EE[1], PDF_COLORS.EE[2]); // Emerald-700
  } else if (isDeclining) {
    doc.setTextColor(PDF_COLORS.BE[0], PDF_COLORS.BE[1], PDF_COLORS.BE[2]); // Rose-700
  } else {
    doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  }
  doc.text(trendLabel, marginX + contentWidth - 3, currentY + 4.2, { align: 'right' });

  // Plot Area Dimensions
  const plotLeft = marginX + 13;
  const plotRight = marginX + contentWidth - 13;
  const plotWidth = plotRight - plotLeft;
  const plotTop = currentY + 6.5;
  const plotBottom = currentY + cardHeight - 6.5;
  const plotHeight = plotBottom - plotTop;

  // Draw Horizontal Gridlines & Y-Axis Ticks
  const yTicks = [
    { val: 100, label: '100%' },
    { val: 75, label: '75%' },
    { val: 50, label: '50%' },
    { val: 25, label: '25%' },
    { val: 0, label: '0%' },
  ];

  doc.setLineWidth(0.1);
  doc.setDrawColor(226, 232, 240); // Clean light neutral gridline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);

  yTicks.forEach((tick) => {
    const tickY = plotTop + plotHeight - (tick.val / 100) * plotHeight;
    doc.line(plotLeft, tickY, plotRight, tickY);
    doc.text(tick.label, plotLeft - 1.5, tickY + 1.2, { align: 'right' });
  });

  // Calculate coordinates for each milestone point
  const numPoints = relevantMilestones.length;
  const points = relevantMilestones.map((m, idx) => {
    const x = numPoints === 1 ? plotLeft + plotWidth / 2 : plotLeft + (idx / (numPoints - 1)) * plotWidth;
    const clampedScore = Math.max(0, Math.min(100, m.average_percentage));
    const y = plotTop + plotHeight - (clampedScore / 100) * plotHeight;
    return { x, y, milestone: m, score: m.average_percentage };
  });

  // Draw Connecting Vector Line (Emerald green)
  doc.setDrawColor(PDF_COLORS.EE[0], PDF_COLORS.EE[1], PDF_COLORS.EE[2]); // Emerald
  doc.setLineWidth(0.45);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }

  // Draw Data Points & Labels
  points.forEach((pt) => {
    // Outer Circle Ring (Emerald green)
    doc.setFillColor(PDF_COLORS.EE[0], PDF_COLORS.EE[1], PDF_COLORS.EE[2]);
    doc.circle(pt.x, pt.y, 1.2, 'F');

    // Inner White Center
    doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
    doc.circle(pt.x, pt.y, 0.6, 'F');

    // Score Label (Placed above or below point)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
    const roundedScore = Math.round(pt.score);
    const scoreText = `${roundedScore}%`;

    const labelY = pt.y < plotTop + 4 ? pt.y + 3.8 : pt.y - 1.8;
    doc.text(scoreText, pt.x, labelY, { align: 'center' });

    // X-Axis Milestone Label (Sanitized for CBE terminology, no CAT)
    let rawLabel = pt.milestone.display_label || `${pt.milestone.year} T${pt.milestone.term_sequence}`;
    rawLabel = rawLabel
      .replace(/\bCAT\s*(\d+)?\b/gi, (_, n) => (n ? `Assessment ${n}` : 'Assessment'))
      .replace(/Continuous\s+Assessment\s+Test/gi, 'Assessment');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(PDF_COLORS.SLATE_TEXT[0], PDF_COLORS.SLATE_TEXT[1], PDF_COLORS.SLATE_TEXT[2]);
    doc.text(rawLabel, pt.x, plotBottom + 3.5, { align: 'center' });
  });

  return currentY + cardHeight + 3.5;
}

// -------------------------------------------------------------
// 1. PRE-PRIMARY REPORT CARD PDF GENERATOR (PP1 - PP2)
// -------------------------------------------------------------
export async function generatePrePrimaryReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const { targetClass, targetClassId, targetStreamId, classNameStr, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);
  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examId = exam?.id || '';

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency & Growth Evaluation', currentY);

  // Learner Info Card
  const learnerFullName = (student.full_name || `${student.first_name || ''} ${student.last_name || ''}`).trim().toUpperCase() || 'LEARNER';
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(learnerFullName, marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`${getDisplayExamName(exam?.exam_name) || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Pre-Primary Development Progress Banner
  doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 9, 1, 1, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text('LEARNING AREA PERFORMANCE & COMPETENCY EVALUATION', marginX + 4, currentY + 6);

  currentY += 13;

  // Table of Learning Areas
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark);

    let level = 'X';
    let descStr = 'Missing Assessment (X)';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (isKiswahiliSubject(sb)) {
      defaultSubjComment = getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason);
      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        const gr = getGradeForMark(markInfo.percentage, grades);
        level = gr.performance_level;
        const descMap: Record<string, string> = {
          EE: 'Exceeding Expectations - Demonstrates exceptional skill and independent initiative',
          ME: 'Meeting Expectations - Displays target competency consistently with minor guidance',
          AE: 'Approaching Expectations - Developing skill; requires regular practice',
          BE: 'Below Expectations - Requires structured guidance and continuous support',
        };
        descStr = descMap[level] || 'Evaluation in progress';
      } else if (markInfo.status === 'Y') {
        level = 'Y';
        descStr = `Examination Irregularity (${markInfo.irregularityReason || 'Absent'})`;
      }
    } else if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades);
      level = gr.performance_level;
      const descMap: Record<string, string> = {
        EE: 'Exceeding Expectations - Demonstrates exceptional skill and independent initiative',
        ME: 'Meeting Expectations - Displays target competency consistently with minor guidance',
        AE: 'Approaching Expectations - Developing skill; requires regular practice',
        BE: 'Below Expectations - Requires structured guidance and continuous support',
      };
      descStr = descMap[level] || 'Evaluation in progress';
      defaultSubjComment = gr.remarks || 'Good progress';
    } else if (markInfo.status === 'Y') {
      level = 'Y';
      descStr = `Examination Irregularity (${markInfo.irregularityReason || 'Absent'})`;
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjTeacher = resolveSubjectTeacher(teachers, sb.id, targetClassId, targetStreamId);
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';
    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_name, level, descStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Learning Area Activity', 'Competency', 'Level Indicator & Progress Description', 'Comments', 'Learning Area Instructor']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: PDF_COLORS.SLATE_DARK_TEXT as [number, number, number], lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: PDF_COLORS.SLATE_HEADER as [number, number, number], textColor: PDF_COLORS.WHITE as [number, number, number], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 52, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 50, fontSize: 7 },
      3: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      4: { halign: 'left', cellWidth: 28, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 1) {
        const val = cellData.cell.raw as string;
        if (val === 'EE') cellData.cell.styles.textColor = PDF_COLORS.EE as [number, number, number];
        else if (val === 'ME') cellData.cell.styles.textColor = PDF_COLORS.ME as [number, number, number];
        else if (val === 'AE') cellData.cell.styles.textColor = PDF_COLORS.AE as [number, number, number];
        else if (val === 'BE') cellData.cell.styles.textColor = PDF_COLORS.BE as [number, number, number];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Development Summary Table (Motor, Social-Emotional, Language, Creative)
  doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 26, 1, 1, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text('EARLY CHILDHOOD DEVELOPMENT & PSYCHOMOTOR INDICATORS', marginX + 4, currentY + 4.5);

  const devIndicators = [
    { domain: 'Motor & Physical Development:', text: 'Excellent fine and gross motor skills, active physical participation and coordination.' },
    { domain: 'Social-Emotional Growth:', text: 'Interacts harmoniously with peers, shares learning tools, and demonstrates good manners.' },
    { domain: 'Language & Communication:', text: 'Expresses thoughts clearly, listens attentively during story time and group activities.' },
    { domain: 'Creative & Artistic Skills:', text: 'Shows enthusiastic engagement in music, drawing, color identification, and role play.' },
  ];

  devIndicators.forEach((dev, idx) => {
    const yPos = currentY + 9 + idx * 4.5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_COLORS.EE[0], PDF_COLORS.EE[1], PDF_COLORS.EE[2]); // Emerald-700
    doc.text(dev.domain, marginX + 4, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
    doc.text(dev.text, marginX + 54, yPos);
  });

  currentY += 31;

  // Teacher Remarks & HOI Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Headteacher';

  const defaultCtComment = 'The learner shows positive engagement and good developmental progress.';
  const defaultHoiComment = 'Commendable growth across learning areas. Keep encouraging the learner.';

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = formatKenyaDate(new Date());

  // CT Remarks Box
  doc.setFillColor(PDF_COLORS.SLATE_LIGHT[0], PDF_COLORS.SLATE_LIGHT[1], PDF_COLORS.SLATE_LIGHT[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(ctComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 20;

  // HOI Remarks Box
  doc.setFillColor(PDF_COLORS.HOI_BG[0], PDF_COLORS.HOI_BG[1], PDF_COLORS.HOI_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`HEADTEACHER'S REMARKS (Headteacher: ${hoiName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(hoiComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 21;

  // Signatures Section
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Headteacher & Official Seal', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 18, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.5, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
    doc.text(sig.label, x + sigColW / 2, currentY + 13.5, { align: 'center' });
  });

  currentY += 21;

  // Next Term Opening Date & Official Generation Notice (After Signatures)
  const nextTermDate = resolveNextTermOpeningDate(data);
  const footerY = Math.max(currentY + 4, 278);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
  doc.text(`Generated: ${currentDateStr}`, marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// 2. LOWER PRIMARY REPORT CARD PDF GENERATOR (Grades 1 - 3)
// -------------------------------------------------------------
export async function generateLowerPrimaryReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], allStudents = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const examId = exam?.id || '';
  const { targetClass, targetClassId, targetStreamId, classNameStr, studentGrade, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examResults = calculateExamResults(examId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);
  const isAssessmentComplete = data.aggregateRanking
    ? data.aggregateRanking.is_complete
    : (studentResult ? studentResult.is_complete !== false : false);

  const totalMarks = data.aggregateRanking?.total_marks !== undefined
    ? data.aggregateRanking.total_marks
    : (studentResult?.total_marks || 0);
  const averageScore = data.aggregateRanking?.average !== undefined
    ? data.aggregateRanking.average
    : (studentResult?.average || 0);
  const totalPoints = isAssessmentComplete
    ? (data.aggregateRanking?.total_points !== undefined ? data.aggregateRanking.total_points : (studentResult?.total_points || 0))
    : 0;
  const overallLevel = isAssessmentComplete
    ? (data.aggregateRanking?.performance_level || studentResult?.performance_level || 'ME')
    : 'Pending';
  const overallGradeCode = isAssessmentComplete
    ? (data.aggregateRanking?.grade_code || studentResult?.grade_code || studentResult?.grade || 'ME')
    : 'Pending';
  const overallRank = data.aggregateRanking
    ? (data.aggregateRanking.is_complete && data.aggregateRanking.overall_rank ? `${data.aggregateRanking.overall_rank}` : 'Not Ranked')
    : (isAssessmentComplete && studentResult?.position ? `${studentResult.position}` : 'Not Ranked');
  const streamRank = data.aggregateRanking
    ? (data.aggregateRanking.is_complete && data.aggregateRanking.stream_rank ? `${data.aggregateRanking.stream_rank}` : 'Not Ranked')
    : (isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `${studentResult.class_position || studentResult.position}` : 'Not Ranked');

  // Authoritative grade cohort (across streams)
  const gradeStudentIds = getGradeCohortStudentIds(student, allStudents, exam, classes);
  const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
  const totalGradeAssessedStudents = data.aggregateRanking?.overall_total
    ? data.aggregateRanking.overall_total
    : (gradeResults.filter((r) => r.is_complete !== false).length ||
       gradeResults.length ||
       1);

  // Authoritative stream cohort
  const streamStudentIds = getStreamCohortStudentIds(student, allStudents, exam, classes);
  const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
  const streamAssessedStudentsCount = data.aggregateRanking?.stream_total
    ? data.aggregateRanking.stream_total
    : (streamResults.filter((r) => r.is_complete !== false).length ||
       streamResults.length ||
       1);

  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 4;

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency-Based Education (CBE)', currentY);

  // Details Grid
  const learnerFullName = (student.full_name || `${student.first_name || ''} ${student.last_name || ''}`).trim().toUpperCase() || 'LEARNER';
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(learnerFullName, marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`${getDisplayExamName(exam?.exam_name) || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Performance Summary Box
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  const colW = contentWidth / 6;

  for (let i = 1; i < 6; i++) {
    const lineX = marginX + i * colW;
    doc.line(lineX, currentY, lineX, currentY + 16);
  }

  const metrics = [
    { label: 'TOTAL SCORE', val: `${totalMarks} / ${maxPossibleMarks}` },
    { label: 'AVERAGE (%)', val: formatPercentage(averageScore, true) },
    { label: 'CBE LEVEL', val: isAssessmentComplete ? overallGradeCode : 'Pending' },
    { label: 'TOTAL POINTS', val: isAssessmentComplete ? `${totalPoints} / ${maxPossiblePoints}` : '-' },
    { label: 'STREAM RANK', val: isAssessmentComplete && streamRank !== 'Not Ranked' ? `${streamRank} of ${streamAssessedStudentsCount}` : streamRank },
    { label: 'OVERALL RANK', val: isAssessmentComplete && overallRank !== 'Not Ranked' ? `${overallRank} of ${totalGradeAssessedStudents}` : overallRank },
  ];

  metrics.forEach((m, idx) => {
    const startX = marginX + idx * colW;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, startX + colW / 2, currentY + 4.5, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(m.val, startX + colW / 2, currentY + 11, { align: 'center' });
  });

  currentY += 21;

  // Performance Table
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark);

    let scoreDisplay = 'X';
    let pctDisplay = 'X';
    let pointsDisplay = 'X';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (isKiswahiliSubject(sb)) {
      defaultSubjComment = getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason);
      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        const gr = getGradeForMark(markInfo.percentage, grades, 'Lower Primary', studentGrade);
        const roundedScore = Math.round(markInfo.percentage);
        scoreDisplay = `${roundedScore}/100`;
        const gradeCode = gr.grade_code || gr.grade || '';
        pctDisplay = `${formatPercentage(roundedScore, true)}${gradeCode ? ' ' + gradeCode : ''}`.trim();
        pointsDisplay = `${gr.points}`;
      } else if (markInfo.status === 'Y') {
        scoreDisplay = 'Y';
        pctDisplay = 'Y';
        pointsDisplay = 'Y';
      }
    } else if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades, 'Lower Primary', studentGrade);
      const roundedScore = Math.round(markInfo.percentage);
      scoreDisplay = `${roundedScore}/100`;
      const gradeCode = gr.grade_code || gr.grade || '';
      pctDisplay = `${formatPercentage(roundedScore, true)}${gradeCode ? ' ' + gradeCode : ''}`.trim();
      pointsDisplay = `${gr.points}`;
      defaultSubjComment = gr.remarks || 'Good Progress';
    } else if (markInfo.status === 'Y') {
      scoreDisplay = 'Y';
      pctDisplay = 'Y';
      pointsDisplay = 'Y';
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjectRankStr = markInfo.status === 'Normal' ? calculateSubjectRank(effectiveStudent, sb.id, examId, allStudents, classes, marks) : '-';
    const subjTeacher = resolveSubjectTeacher(teachers, sb.id, targetClassId, targetStreamId);
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';

    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_name, scoreDisplay, pctDisplay, pointsDisplay, subjectRankStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Learning Area', 'Score', '%', 'Points', 'Rank', 'Comments', 'Learning Area Instructor']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.0, textColor: PDF_COLORS.SLATE_DARK_TEXT as [number, number, number], lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: PDF_COLORS.SLATE_HEADER as [number, number, number], textColor: PDF_COLORS.WHITE as [number, number, number], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      5: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      6: { halign: 'left', cellWidth: 26, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 2) {
        const val = String(cellData.cell.raw || '');
        if (val.includes('EE')) cellData.cell.styles.textColor = PDF_COLORS.EE as [number, number, number];
        else if (val.includes('ME')) cellData.cell.styles.textColor = PDF_COLORS.ME as [number, number, number];
        else if (val.includes('AE')) cellData.cell.styles.textColor = PDF_COLORS.AE as [number, number, number];
        else if (val.includes('BE')) cellData.cell.styles.textColor = PDF_COLORS.BE as [number, number, number];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // Performance Progression Graph
  currentY = drawPerformanceProgressionGraph(doc, data, currentY, contentWidth, marginX);

  // Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const defaultCtComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'class_teacher',
    isProvisional: !isAssessmentComplete,
  });
  const defaultHoiComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'hoi',
    isProvisional: !isAssessmentComplete,
  });

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = formatKenyaDate(new Date());

  // CT Box
  doc.setFillColor(PDF_COLORS.SLATE_LIGHT[0], PDF_COLORS.SLATE_LIGHT[1], PDF_COLORS.SLATE_LIGHT[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(ctComment, marginX + 3, currentY + 8.8, { maxWidth: contentWidth - 6 });

  currentY += 18;

  // HOI Box
  doc.setFillColor(PDF_COLORS.HOI_BG[0], PDF_COLORS.HOI_BG[1], PDF_COLORS.HOI_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 4.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(hoiComment, marginX + 3, currentY + 8.8, { maxWidth: contentWidth - 6 });

  currentY += 18;

  // Grading Key
  doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 12, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text('CBE 4-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 4.2);

  const gradeKeyItems = [
    { code: 'EE', range: '76–100%', pts: '4 Pts', color: PDF_COLORS.EE },
    { code: 'ME', range: '51–75%', pts: '3 Pts', color: PDF_COLORS.ME },
    { code: 'AE', range: '26–50%', pts: '2 Pts', color: PDF_COLORS.AE },
    { code: 'BE', range: '0–25%', pts: '1 Pt', color: PDF_COLORS.BE },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 8.5;

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
    doc.text(`${item.range} (${item.pts})`, x + 7, y);
  });

  currentY += 15;

  // Signatures
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Head of Institution & Stamp', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 15, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.2, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
    doc.text(sig.label, x + sigColW / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 18;

  // Next Term Opening Date & Official Generation Notice (After Signatures)
  const nextTermDate = resolveNextTermOpeningDate(data);
  const footerY = Math.max(currentY + 4, 278);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
  doc.text(`Generated: ${currentDateStr}`, marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// 3. UPPER PRIMARY REPORT CARD PDF GENERATOR (Grades 4 - 6)
// -------------------------------------------------------------
export async function generateUpperPrimaryReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], allStudents = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const examId = exam?.id || '';
  const { targetClass, targetClassId, targetStreamId, classNameStr, studentGrade, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examResults = calculateExamResults(examId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);
  const isAssessmentComplete = data.aggregateRanking
    ? data.aggregateRanking.is_complete
    : (studentResult ? studentResult.is_complete !== false : false);

  const totalMarks = data.aggregateRanking?.total_marks !== undefined
    ? data.aggregateRanking.total_marks
    : (studentResult?.total_marks || 0);
  const averageScore = data.aggregateRanking?.average !== undefined
    ? data.aggregateRanking.average
    : (studentResult?.average || 0);
  const totalPoints = isAssessmentComplete
    ? (data.aggregateRanking?.total_points !== undefined ? data.aggregateRanking.total_points : (studentResult?.total_points || 0))
    : 0;
  const overallLevel = isAssessmentComplete
    ? (data.aggregateRanking?.performance_level || studentResult?.performance_level || 'ME')
    : 'Pending';
  const overallGradeCode = isAssessmentComplete
    ? (data.aggregateRanking?.grade_code || studentResult?.grade_code || studentResult?.grade || 'ME1')
    : 'Pending';
  const overallRank = data.aggregateRanking
    ? (data.aggregateRanking.is_complete && data.aggregateRanking.overall_rank ? `${data.aggregateRanking.overall_rank}` : 'Not Ranked')
    : (isAssessmentComplete && studentResult?.position ? `${studentResult.position}` : 'Not Ranked');
  const streamRank = data.aggregateRanking
    ? (data.aggregateRanking.is_complete && data.aggregateRanking.stream_rank ? `${data.aggregateRanking.stream_rank}` : 'Not Ranked')
    : (isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `${studentResult.class_position || studentResult.position}` : 'Not Ranked');

  // Authoritative grade cohort (across streams)
  const gradeStudentIds = getGradeCohortStudentIds(student, allStudents, exam, classes);
  const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
  const totalGradeAssessedStudents = data.aggregateRanking?.overall_total
    ? data.aggregateRanking.overall_total
    : (gradeResults.filter((r) => r.is_complete !== false).length ||
       gradeResults.length ||
       1);

  // Authoritative stream cohort
  const streamStudentIds = getStreamCohortStudentIds(student, allStudents, exam, classes);
  const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
  const streamAssessedStudentsCount = data.aggregateRanking?.stream_total
    ? data.aggregateRanking.stream_total
    : (streamResults.filter((r) => r.is_complete !== false).length ||
       streamResults.length ||
       1);

  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 4;

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency-Based Education (CBE)', currentY);

  // Details Grid
  const learnerFullName = (student.full_name || `${student.first_name || ''} ${student.last_name || ''}`).trim().toUpperCase() || 'LEARNER';
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(learnerFullName, marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`${getDisplayExamName(exam?.exam_name) || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Summary Card
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  const colW = contentWidth / 6;

  for (let i = 1; i < 6; i++) {
    const lineX = marginX + i * colW;
    doc.line(lineX, currentY, lineX, currentY + 16);
  }

  const metrics = [
    { label: 'TOTAL SCORE', val: `${totalMarks} / ${maxPossibleMarks}` },
    { label: 'AVERAGE (%)', val: formatPercentage(averageScore, true) },
    { label: 'CBE LEVEL', val: isAssessmentComplete ? overallGradeCode : 'Pending' },
    { label: 'TOTAL POINTS', val: isAssessmentComplete ? `${totalPoints} / ${maxPossiblePoints}` : '-' },
    { label: 'STREAM RANK', val: isAssessmentComplete && streamRank !== 'Not Ranked' ? `${streamRank} of ${streamAssessedStudentsCount}` : streamRank },
    { label: 'OVERALL RANK', val: isAssessmentComplete && overallRank !== 'Not Ranked' ? `${overallRank} of ${totalGradeAssessedStudents}` : overallRank },
  ];

  metrics.forEach((m, idx) => {
    const startX = marginX + idx * colW;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, startX + colW / 2, currentY + 4.5, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(m.val, startX + colW / 2, currentY + 11, { align: 'center' });
  });

  currentY += 21;

  // Performance Table
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark, {
      subject: sb,
      classObj: targetClass,
      educationLevel: 'Upper Primary',
    });

    let scoreDisplay = 'X';
    let pctDisplay = 'X';
    let pointsDisplay = 'X';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (isKiswahiliSubject(sb)) {
      defaultSubjComment = getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason);
      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        const gr = getGradeForMark(markInfo.percentage, grades, 'Upper Primary', studentGrade);
        scoreDisplay = markInfo.displayScore;
        const gradeCode = gr.grade_code || gr.grade || '';
        pctDisplay = `${formatPercentage(Math.round(markInfo.percentage), true)}${gradeCode ? ' ' + gradeCode : ''}`.trim();
        pointsDisplay = `${gr.points}`;
      } else if (markInfo.status === 'Y') {
        scoreDisplay = 'Y';
        pctDisplay = 'Y';
        pointsDisplay = 'Y';
      }
    } else if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades, 'Upper Primary', studentGrade);
      scoreDisplay = markInfo.displayScore;
      const gradeCode = gr.grade_code || gr.grade || '';
      pctDisplay = `${formatPercentage(Math.round(markInfo.percentage), true)}${gradeCode ? ' ' + gradeCode : ''}`.trim();
      pointsDisplay = `${gr.points}`;
      defaultSubjComment = gr.remarks || 'Good Progress';
    } else if (markInfo.status === 'Y') {
      scoreDisplay = 'Y';
      pctDisplay = 'Y';
      pointsDisplay = 'Y';
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjectRankStr = markInfo.status === 'Normal' ? calculateSubjectRank(effectiveStudent, sb.id, examId, allStudents, classes, marks) : '-';
    const subjTeacher = resolveSubjectTeacher(teachers, sb.id, targetClassId, targetStreamId);
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';

    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_name, scoreDisplay, pctDisplay, pointsDisplay, subjectRankStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Learning Area', 'Score', '%', 'Points', 'Rank', 'Comments', 'Learning Area Instructor']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.0, textColor: PDF_COLORS.SLATE_DARK_TEXT as [number, number, number], lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: PDF_COLORS.SLATE_HEADER as [number, number, number], textColor: PDF_COLORS.WHITE as [number, number, number], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      5: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      6: { halign: 'left', cellWidth: 26, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 2) {
        const val = String(cellData.cell.raw || '');
        if (val.includes('EE')) cellData.cell.styles.textColor = PDF_COLORS.EE as [number, number, number];
        else if (val.includes('ME')) cellData.cell.styles.textColor = PDF_COLORS.ME as [number, number, number];
        else if (val.includes('AE')) cellData.cell.styles.textColor = PDF_COLORS.AE as [number, number, number];
        else if (val.includes('BE')) cellData.cell.styles.textColor = PDF_COLORS.BE as [number, number, number];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // Performance Progression Graph
  currentY = drawPerformanceProgressionGraph(doc, data, currentY, contentWidth, marginX);

  // Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const defaultCtComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'class_teacher',
    isProvisional: !isAssessmentComplete,
  });
  const defaultHoiComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'hoi',
    isProvisional: !isAssessmentComplete,
  });

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = formatKenyaDate(new Date());

  // CT Box
  doc.setFillColor(PDF_COLORS.SLATE_LIGHT[0], PDF_COLORS.SLATE_LIGHT[1], PDF_COLORS.SLATE_LIGHT[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(ctComment, marginX + 3, currentY + 8.8, { maxWidth: contentWidth - 6 });

  currentY += 18;

  // HOI Box
  doc.setFillColor(PDF_COLORS.HOI_BG[0], PDF_COLORS.HOI_BG[1], PDF_COLORS.HOI_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 4.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(hoiComment, marginX + 3, currentY + 8.8, { maxWidth: contentWidth - 6 });

  currentY += 18;

  // Key
  doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 17, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text('CBE 4-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 4.2);

  const gradeKeyItems = [
    { code: 'EE', range: '76–100%', pts: '4 Pts', color: PDF_COLORS.EE },
    { code: 'ME', range: '51–75%', pts: '3 Pts', color: PDF_COLORS.ME },
    { code: 'AE', range: '26–50%', pts: '2 Pts', color: PDF_COLORS.AE },
    { code: 'BE', range: '0–25%', pts: '1 Pt', color: PDF_COLORS.BE },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 8.5 + row * 5.2;

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
    doc.text(`${item.range} (${item.pts})`, x + 7, y);
  });

  currentY += 20;

  // Signatures
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Head of Institution & Stamp', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 15, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.2, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
    doc.text(sig.label, x + sigColW / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 18;

  // Next Term Opening Date & Official Generation Notice (After Signatures)
  const nextTermDate = resolveNextTermOpeningDate(data);
  const footerY = Math.max(currentY + 4, 278);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
  doc.text(`Generated: ${currentDateStr}`, marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// 4. JUNIOR SCHOOL REPORT CARD PDF GENERATOR (Grades 7 - 9)
// -------------------------------------------------------------
export async function generateJuniorSchoolReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], allStudents = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const examId = exam?.id || '';
  const { targetClass, targetClassId, targetStreamId, classNameStr, studentGrade, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examResults = calculateExamResults(examId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);
  const isAssessmentComplete = data.aggregateRanking
    ? data.aggregateRanking.is_complete
    : (studentResult ? studentResult.is_complete !== false : false);

  const totalMarks = data.aggregateRanking?.total_marks !== undefined
    ? data.aggregateRanking.total_marks
    : (studentResult?.total_marks || 0);
  const averageScore = data.aggregateRanking?.average !== undefined
    ? data.aggregateRanking.average
    : (studentResult?.average || 0);
  const totalPoints = isAssessmentComplete
    ? (data.aggregateRanking?.total_points !== undefined ? data.aggregateRanking.total_points : (studentResult?.total_points || 0))
    : 0;
  const overallLevel = isAssessmentComplete
    ? (data.aggregateRanking?.performance_level || studentResult?.performance_level || 'ME')
    : 'Pending';
  const overallGradeCode = isAssessmentComplete
    ? (data.aggregateRanking?.grade_code || studentResult?.grade_code || studentResult?.grade || 'ME1')
    : 'Pending';
  const overallRank = data.aggregateRanking
    ? (data.aggregateRanking.is_complete && data.aggregateRanking.overall_rank ? `${data.aggregateRanking.overall_rank}` : 'Not Ranked')
    : (isAssessmentComplete && studentResult?.position ? `${studentResult.position}` : 'Not Ranked');
  const streamRank = data.aggregateRanking
    ? (data.aggregateRanking.is_complete && data.aggregateRanking.stream_rank ? `${data.aggregateRanking.stream_rank}` : 'Not Ranked')
    : (isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `${studentResult.class_position || studentResult.position}` : 'Not Ranked');

  // Authoritative grade cohort (across streams)
  const gradeStudentIds = getGradeCohortStudentIds(student, allStudents, exam, classes);
  const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
  const totalGradeAssessedStudents = data.aggregateRanking?.overall_total
    ? data.aggregateRanking.overall_total
    : (gradeResults.filter((r) => r.is_complete !== false).length ||
       gradeResults.length ||
       1);

  // Authoritative stream cohort
  const streamStudentIds = getStreamCohortStudentIds(student, allStudents, exam, classes);
  const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
  const streamAssessedStudentsCount = data.aggregateRanking?.stream_total
    ? data.aggregateRanking.stream_total
    : (streamResults.filter((r) => r.is_complete !== false).length ||
       streamResults.length ||
       1);

  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 8;

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency-Based Education (CBE)', currentY);

  // Details Grid
  const learnerFullName = (student.full_name || `${student.first_name || ''} ${student.last_name || ''}`).trim().toUpperCase() || 'LEARNER';
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(learnerFullName, marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`${getDisplayExamName(exam?.exam_name) || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Summary Card
  doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  const colW = contentWidth / 6;

  for (let i = 1; i < 6; i++) {
    const lineX = marginX + i * colW;
    doc.line(lineX, currentY, lineX, currentY + 16);
  }

  const metrics = [
    { label: 'TOTAL SCORE', val: `${totalMarks} / ${maxPossibleMarks}` },
    { label: 'AVERAGE (%)', val: formatPercentage(averageScore, true) },
    { label: 'CBE LEVEL', val: isAssessmentComplete ? overallGradeCode : 'Pending' },
    { label: 'TOTAL POINTS', val: isAssessmentComplete ? `${totalPoints} / ${maxPossiblePoints}` : '-' },
    { label: 'STREAM RANK', val: isAssessmentComplete && streamRank !== 'Not Ranked' ? `${streamRank} of ${streamAssessedStudentsCount}` : streamRank },
    { label: 'OVERALL RANK', val: isAssessmentComplete && overallRank !== 'Not Ranked' ? `${overallRank} of ${totalGradeAssessedStudents}` : overallRank },
  ];

  metrics.forEach((m, idx) => {
    const startX = marginX + idx * colW;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, startX + colW / 2, currentY + 4.5, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(m.val, startX + colW / 2, currentY + 11, { align: 'center' });
  });

  currentY += 21;

  // Performance Table
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark, {
      subject: sb,
      classObj: targetClass,
      educationLevel: 'Junior School',
    });

    let scoreDisplay = 'X';
    let pctDisplay = 'X';
    let pointsDisplay = 'X';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (isKiswahiliSubject(sb)) {
      defaultSubjComment = getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason);
      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        const gr = getGradeForMark(markInfo.percentage, grades, 'Junior School', studentGrade);
        const roundedScore = Math.round(markInfo.percentage);
        scoreDisplay = `${roundedScore}/100`;
        const gradeCode = gr.grade_code || gr.grade || '';
        pctDisplay = `${formatPercentage(roundedScore, true)}${gradeCode ? ' ' + gradeCode : ''}`.trim();
        pointsDisplay = `${gr.points}`;
      } else if (markInfo.status === 'Y') {
        scoreDisplay = 'Y';
        pctDisplay = 'Y';
        pointsDisplay = 'Y';
      }
    } else if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades, 'Junior School', studentGrade);
      const roundedScore = Math.round(markInfo.percentage);
      scoreDisplay = `${roundedScore}/100`;
      const gradeCode = gr.grade_code || gr.grade || '';
      pctDisplay = `${formatPercentage(roundedScore, true)}${gradeCode ? ' ' + gradeCode : ''}`.trim();
      pointsDisplay = `${gr.points}`;
      defaultSubjComment = gr.remarks || 'Good Progress';
    } else if (markInfo.status === 'Y') {
      scoreDisplay = 'Y';
      pctDisplay = 'Y';
      pointsDisplay = 'Y';
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjectRankStr = markInfo.status === 'Normal' ? calculateSubjectRank(effectiveStudent, sb.id, examId, allStudents, classes, marks) : '-';
    const subjTeacher = resolveSubjectTeacher(teachers, sb.id, targetClassId, targetStreamId);
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';

    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_name, scoreDisplay, pctDisplay, pointsDisplay, subjectRankStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Learning Area', 'Score', '%', 'Points', 'Rank', 'Comments', 'Learning Area Instructor']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.0, textColor: PDF_COLORS.SLATE_DARK_TEXT as [number, number, number], lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: PDF_COLORS.SLATE_HEADER as [number, number, number], textColor: PDF_COLORS.WHITE as [number, number, number], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      5: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      6: { halign: 'left', cellWidth: 26, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 2) {
        const val = String(cellData.cell.raw || '');
        if (val.includes('EE')) cellData.cell.styles.textColor = PDF_COLORS.EE as [number, number, number];
        else if (val.includes('ME')) cellData.cell.styles.textColor = PDF_COLORS.ME as [number, number, number];
        else if (val.includes('AE')) cellData.cell.styles.textColor = PDF_COLORS.AE as [number, number, number];
        else if (val.includes('BE')) cellData.cell.styles.textColor = PDF_COLORS.BE as [number, number, number];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // Performance Progression Graph
  currentY = drawPerformanceProgressionGraph(doc, data, currentY, contentWidth, marginX);

  // Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const defaultCtComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'class_teacher',
    isProvisional: !isAssessmentComplete,
  });
  const defaultHoiComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'hoi',
    isProvisional: !isAssessmentComplete,
  });

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = formatKenyaDate(new Date());

  // CT Box
  doc.setFillColor(PDF_COLORS.SLATE_LIGHT[0], PDF_COLORS.SLATE_LIGHT[1], PDF_COLORS.SLATE_LIGHT[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(ctComment, marginX + 3, currentY + 8.8, { maxWidth: contentWidth - 6 });

  currentY += 18;

  // HOI Box
  doc.setFillColor(PDF_COLORS.HOI_BG[0], PDF_COLORS.HOI_BG[1], PDF_COLORS.HOI_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 4.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
  doc.text(hoiComment, marginX + 3, currentY + 8.8, { maxWidth: contentWidth - 6 });

  currentY += 18;

  // Key
  doc.setFillColor(PDF_COLORS.CARD_BG[0], PDF_COLORS.CARD_BG[1], PDF_COLORS.CARD_BG[2]);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, currentY, contentWidth, 17, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text('CBE 8-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 4.2);

  const gradeKeyItems = [
    { code: 'EE1', range: '90–100%', pts: '8 Pts', color: PDF_COLORS.EE },
    { code: 'EE2', range: '75–89%', pts: '7 Pts', color: PDF_COLORS.EE },
    { code: 'ME1', range: '58–74%', pts: '6 Pts', color: PDF_COLORS.ME },
    { code: 'ME2', range: '41–57%', pts: '5 Pts', color: PDF_COLORS.ME },
    { code: 'AE1', range: '31–40%', pts: '4 Pts', color: PDF_COLORS.AE },
    { code: 'AE2', range: '21–30%', pts: '3 Pts', color: PDF_COLORS.AE },
    { code: 'BE1', range: '11–20%', pts: '2 Pts', color: PDF_COLORS.BE },
    { code: 'BE2', range: '0–10%', pts: '1 Pt', color: PDF_COLORS.BE },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 8.5 + row * 5.2;

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PDF_COLORS.SLATE_DARK_TEXT[0], PDF_COLORS.SLATE_DARK_TEXT[1], PDF_COLORS.SLATE_DARK_TEXT[2]);
    doc.text(`${item.range} (${item.pts})`, x + 7, y);
  });

  currentY += 20;

  // Signatures
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Head of Institution & Stamp', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(PDF_COLORS.WHITE[0], PDF_COLORS.WHITE[1], PDF_COLORS.WHITE[2]);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 15, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.2, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
    doc.text(sig.label, x + sigColW / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 18;

  // Next Term Opening Date & Official Generation Notice (After Signatures)
  const nextTermDate = resolveNextTermOpeningDate(data);
  const footerY = Math.max(currentY + 4, 278);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PDF_COLORS.NAVY_DARK[0], PDF_COLORS.NAVY_DARK[1], PDF_COLORS.NAVY_DARK[2]);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PDF_COLORS.SLATE_MUTED[0], PDF_COLORS.SLATE_MUTED[1], PDF_COLORS.SLATE_MUTED[2]);
  doc.text(`Generated: ${currentDateStr}`, marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// MAIN ENTRY POINT FOR PDF DOCUMENT GENERATION
// Automatically dispatches based on the learner's educational level
// -------------------------------------------------------------
export async function createReportCardPDFDoc(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, exam, classes } = data;
  const { studentGrade } = resolvePDFLearnerContext(student, exam, classes);
  const eduLevel: EducationLevel = getEducationLevelForGrade(studentGrade);

  switch (eduLevel) {
    case 'Pre-Primary':
      return generatePrePrimaryReportPDF(data, existingDoc);
    case 'Lower Primary':
      return generateLowerPrimaryReportPDF(data, existingDoc);
    case 'Upper Primary':
      return generateUpperPrimaryReportPDF(data, existingDoc);
    case 'Junior School':
    default:
      return generateJuniorSchoolReportPDF(data, existingDoc);
  }
}

// Download single learner PDF
export async function downloadSingleReportCardPDF(data: PDFReportData): Promise<void> {
  const doc = await createReportCardPDFDoc(data);
  const fileName = `${data.student.admission_number}_${data.student.full_name.replace(/\s+/g, '_')}_ReportCard.pdf`;
  await savePdf(doc, fileName);
}

// Download batch combined PDF of report cards (One master PDF document, exactly 1 page per learner)
export async function downloadAllReportCardsCombinedPDF(
  dataList: PDFReportData[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!dataList || dataList.length === 0) return;

  const total = dataList.length;
  const masterDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < total; i++) {
    const item = dataList[i];
    if (onProgress) {
      onProgress(i + 1, total);
    }
    if (i > 0) {
      masterDoc.addPage('a4', 'portrait');
    }
    await createReportCardPDFDoc(item, masterDoc);
  }

  const firstItem = dataList[0];
  const examName = getDisplayExamName(firstItem?.exam?.exam_name) || 'Report';
  const year = firstItem?.exam?.year || new Date().getFullYear();
  const { classNameStr } = resolvePDFLearnerContext(firstItem.student, firstItem.exam, firstItem.classes);

  const cleanClass = classNameStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExam = examName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const fileName = `Report_Forms_${cleanExam}_${year}_${cleanClass}.pdf`;
  await savePdf(masterDoc, fileName);
}

// Download batch ZIP of report cards (Kept for compatibility)
export async function downloadAllReportCardsZIP(
  dataList: PDFReportData[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const total = dataList.length;

  for (let i = 0; i < total; i++) {
    const item = dataList[i];
    if (onProgress) {
      onProgress(i + 1, total);
    }
    const doc = await createReportCardPDFDoc(item);
    const pdfBlob = doc.output('blob');
    const fileName = `${item.student.admission_number}_${item.student.full_name.replace(/\s+/g, '_')}_ReportCard.pdf`;
    zip.file(fileName, pdfBlob);
  }

  const firstExam = getDisplayExamName(dataList[0]?.exam?.exam_name) || 'Class_Report_Cards';
  const zipName = `Learner_Report_Cards_${firstExam.replace(/\s+/g, '_')}.zip`;

  const content = await zip.generateAsync({ type: 'blob' });
  await saveFile(content, zipName, { mimeType: 'application/zip' });
}
