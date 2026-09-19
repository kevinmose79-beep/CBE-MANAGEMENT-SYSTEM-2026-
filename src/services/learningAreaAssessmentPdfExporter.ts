import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdf } from '../utils/fileDownloader';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  getEducationLevelForGrade,
} from '../types';
import { getGradeForMark, CBE_8_POINT_GRADES, applyCompetitionRanking } from './analysisEngine';
import { getFilteredStudents } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, formatPercentage } from '../utils/markUtils';
import { formatKenyaPdfTimestamp } from '../utils/kenyaDateUtils';
import { getDisplayExamName } from '../utils/examDisplayUtils';
import { resolveSubjectTeacher } from '../utils/teacherResolutionUtils';

export interface LearningAreaAssessmentPDFOptions {
  school: School;
  exam: Examination;
  subject: Subject;
  selectedClassId: string;
  selectedStreamId: string;
  students: Student[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  outOf?: number | string;
  localMarks?: Record<
    string,
    { rawScore: string; status: string; irregularityReason?: string }
  >;
  generatedBy?: string;
}

// Helper to convert image URL to Base64 for school logo
async function getBase64ImageFromUrl(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) return null;
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 120;
          canvas.height = img.height || 120;
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

/**
 * Authoritative PDF Exporter for Learning Area Class Assessment Report.
 * Uses Landscape A4 orientation with clean School Header, Main Learner Assessment Table,
 * Compact Assessment Summary, Horizontal CBE 8-Point Distribution Cards, and CBE Legend.
 */
export async function exportLearningAreaClassAssessmentPDF(
  options: LearningAreaAssessmentPDFOptions
): Promise<void> {
  const {
    school,
    exam,
    subject,
    selectedClassId = 'all',
    selectedStreamId = 'all',
    students = [],
    marks = [],
    grades = [],
    classes = [],
    teachers = [],
    outOf: providedOutOf,
    localMarks,
    generatedBy = 'Subject Teacher',
  } = options;

  // A4 Landscape dimensions in mm: 297mm x 210mm
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  const logoBase64 = await getBase64ImageFromUrl(school.logo_url);

  // 1. Target students strictly filtered by selected class and stream context
  let targetStudents: Student[] = [];

  // If the provided students array is already a filtered cohort (e.g. classStudents passed from MarksEntryTable)
  const isCohortAlreadyFiltered =
    students.length > 0 &&
    (selectedClassId === 'all' ||
      students.every(
        (s) =>
          (s.stream_id && (s.stream_id === selectedStreamId || s.stream_id === selectedClassId)) ||
          (s.class_id && (s.class_id === selectedClassId || s.class_id === selectedStreamId)) ||
          (selectedClassId !== 'all' && s.grade && s.grade.toLowerCase() === selectedClassId.toLowerCase())
      ));

  if (isCohortAlreadyFiltered) {
    targetStudents = [...students];
  } else {
    // Attempt standard filter with examination historical context
    targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

    // Fallback 1: Try without examination historical context (using live class/stream)
    if (!targetStudents || targetStudents.length === 0) {
      targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, null);
    }

    // Fallback 2: Try resolving through targetClassObj stream_id/id
    if (!targetStudents || targetStudents.length === 0) {
      const targetClassObj = classes.find(
        (c) => c.stream_id === selectedStreamId || c.id === selectedStreamId || c.stream_id === selectedClassId || c.id === selectedClassId
      );
      if (targetClassObj) {
        targetStudents = getFilteredStudents(
          students,
          classes,
          targetClassObj.class_name,
          targetClassObj.stream_id || targetClassObj.id,
          null
        );
      }
    }

    // Fallback 3: Direct filter on student stream_id/class_id
    if (!targetStudents || targetStudents.length === 0) {
      const selectedClassObj = classes.find(
        (c) => c.stream_id === selectedClassId || c.id === selectedClassId || c.stream_id === selectedStreamId || c.id === selectedStreamId
      );
      targetStudents = students.filter((s) => {
        if (!s || s.active === false || s.enrolment_status === 'future') return false;
        if (s.stream_id && (s.stream_id === selectedStreamId || s.stream_id === selectedClassId || (selectedClassObj?.stream_id && s.stream_id === selectedClassObj.stream_id))) {
          return true;
        }
        if (s.class_id && (s.class_id === selectedClassId || s.class_id === selectedStreamId || (selectedClassObj?.id && s.class_id === selectedClassObj.id))) {
          if (!selectedClassObj?.stream_id || !s.stream_id || s.stream_id === selectedClassObj.stream_id) {
            return true;
          }
        }
        return false;
      });
    }

    // Fallback 4: If students array itself was passed as a pre-scoped list from caller
    if ((!targetStudents || targetStudents.length === 0) && students.length > 0 && students.length <= 100) {
      targetStudents = students.filter((s) => s && s.active !== false && s.enrolment_status !== 'future');
    }
  }

  if (!targetStudents || targetStudents.length === 0) {
    throw new Error('No learner records found for the selected assessment, class and learning area. Please verify learner enrollment in this class and stream.');
  }

  // Sort learners by admission number or full name for consistent roster presentation
  const sortedStudents = [...targetStudents].sort((a, b) => {
    return (a.admission_number || '').localeCompare(b.admission_number || '', undefined, { numeric: true });
  });

  // 2. Resolve Class, Stream, Education Level, Class Teacher, and Assessment Out Of
  const firstTargetStudent = sortedStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;

  const targetClassObj =
    classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId) ||
    classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId) ||
    (firstHistCtx?.class_id ? classes.find((c) => c.id === firstHistCtx.class_id) : undefined) ||
    (firstTargetStudent?.class_id ? classes.find((c) => c.id === firstTargetStudent.class_id) : undefined) ||
    (firstTargetStudent?.stream_id ? classes.find((c) => c.stream_id === firstTargetStudent.stream_id || c.id === firstTargetStudent.stream_id) : undefined) ||
    (selectedClassId !== 'all' ? classes.find((c) => (c.class_name || '').toLowerCase() === selectedClassId.toLowerCase()) : undefined);

  const targetStreamObj =
    classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId) ||
    (firstTargetStudent?.stream_id ? classes.find((c) => c.stream_id === firstTargetStudent.stream_id || c.id === firstTargetStudent.stream_id) : undefined);

  const classNameStr = targetClassObj ? targetClassObj.class_name : (selectedClassId !== 'all' ? selectedClassId : (firstTargetStudent?.grade || 'All Classes'));
  let streamNameStr = targetStreamObj?.stream || targetClassObj?.stream || (selectedStreamId !== 'all' && selectedStreamId !== selectedClassId ? selectedStreamId : '');

  const streamOrClassDisplay = streamNameStr && streamNameStr !== 'All Streams' && streamNameStr !== classNameStr
    ? `${classNameStr} - ${streamNameStr}`
    : classNameStr;

  const derivedEduLevel = targetClassObj?.education_level || getEducationLevelForGrade(classNameStr);
  const is4PointScale = derivedEduLevel === 'Upper Primary' || derivedEduLevel === 'Lower Primary' || derivedEduLevel === 'Pre-Primary';

  // Resolve Subject Teacher for the selected class/stream and subject/learning area
  const targetClassId = targetClassObj?.id;
  const targetStreamId = targetStreamObj?.stream_id || targetClassObj?.stream_id || selectedStreamId;
  const assignedSubjectTeacher = resolveSubjectTeacher(teachers, subject.id, targetClassId, targetStreamId);

  const subjectTeacherName = assignedSubjectTeacher
    ? assignedSubjectTeacher.teacher_name || (assignedSubjectTeacher as any).full_name || ''
    : '';

  // Determine Assessment Out Of (Max Score)
  let assessmentOutOf = 100;
  if (providedOutOf !== undefined && providedOutOf !== null && !isNaN(Number(providedOutOf)) && Number(providedOutOf) > 0) {
    assessmentOutOf = Number(providedOutOf);
  } else if (exam.max_marks && exam.max_marks > 0) {
    assessmentOutOf = exam.max_marks;
  } else {
    // Check if any existing mark has out_of
    const sampleMark = marks.find(
      (m) => String(m.exam_id) === String(exam.id) && String(m.subject_id) === String(subject.id) && m.out_of && m.out_of > 0
    );
    if (sampleMark && sampleMark.out_of) {
      assessmentOutOf = sampleMark.out_of;
    }
  }

  // 3. Process learner assessment scores
  interface TempProcessedRow {
    student: Student;
    rawScore: number | null;
    displayScore: string;
    percentage: number | null;
    displayPercentage: string;
    cbeLevel: string;
    points: number | string;
    status: string;
    isAssessed: boolean;
  }

  const tempRows: TempProcessedRow[] = [];
  const levelCounts: Record<string, number> = is4PointScale
    ? { EE: 0, ME: 0, AE: 0, BE: 0 }
    : { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };

  let assessedCount = 0;
  let missingCount = 0;
  let percentageSum = 0;
  let highestPercentage: number | null = null;
  let highestRawScore: number | null = null;
  let lowestPercentage: number | null = null;
  let lowestRawScore: number | null = null;

  sortedStudents.forEach((st) => {
    if (!st) return;
    // Check localMarks first if provided (capturing dirty/current edits)
    const localEntry = localMarks ? localMarks[st.id] : undefined;

    let evalStatus: string;
    let evalRawScore: number | null = null;
    let evalPct: number | null = null;
    let irregularityReason: string | undefined;

    if (localEntry) {
      evalStatus = localEntry.status;
      irregularityReason = localEntry.irregularityReason;
      if (evalStatus === 'Normal' && localEntry.rawScore !== '') {
        const parsed = parseFloat(localEntry.rawScore);
        if (!isNaN(parsed) && parsed >= 0) {
          evalRawScore = parsed;
          evalPct = Math.min(100, Math.max(0, (parsed / assessmentOutOf) * 100));
        }
      }
    } else {
      const mObj = marks.find(
        (m) => String(m.student_id) === String(st.id) && String(m.exam_id) === String(exam.id) && String(m.subject_id) === String(subject.id)
      );
      const evalRes = evaluateMark(mObj);
      evalStatus = evalRes.status;
      evalRawScore = evalRes.rawScore;
      evalPct = evalRes.percentage;
      irregularityReason = evalRes.irregularityReason;
    }

    if (evalStatus === 'Normal' && evalPct !== null && evalRawScore !== null) {
      assessedCount++;
      percentageSum += evalPct;

      if (highestPercentage === null || evalPct > highestPercentage) {
        highestPercentage = evalPct;
        highestRawScore = evalRawScore;
      }
      if (lowestPercentage === null || evalPct < lowestPercentage) {
        lowestPercentage = evalPct;
        lowestRawScore = evalRawScore;
      }

      const gr = getGradeForMark(evalPct, grades, derivedEduLevel, classNameStr);
      const grCode = (gr?.grade_code || gr?.grade || 'ME2').toUpperCase();
      const points = gr?.points ?? 5;

      if (levelCounts[grCode] !== undefined) {
        levelCounts[grCode]++;
      } else {
        if (is4PointScale) {
          const baseCode = grCode.substring(0, 2);
          if (levelCounts[baseCode] !== undefined) {
            levelCounts[baseCode]++;
          }
        } else {
          if (grCode.startsWith('EE')) levelCounts['EE2']++;
          else if (grCode.startsWith('ME')) levelCounts['ME2']++;
          else if (grCode.startsWith('AE')) levelCounts['AE2']++;
          else if (grCode.startsWith('BE')) levelCounts['BE2']++;
        }
      }

      const displayScoreStr = assessmentOutOf !== 100 ? `${evalRawScore} / ${assessmentOutOf}` : `${evalRawScore}`;
      const displayPctStr = formatPercentage(evalPct, true);

      tempRows.push({
        student: st,
        rawScore: evalRawScore,
        displayScore: displayScoreStr,
        percentage: evalPct,
        displayPercentage: displayPctStr,
        cbeLevel: grCode,
        points: points,
        status: 'Normal',
        isAssessed: true,
      });
    } else if (evalStatus === 'X') {
      missingCount++;
      tempRows.push({
        student: st,
        rawScore: null,
        displayScore: 'X',
        percentage: null,
        displayPercentage: '-',
        cbeLevel: 'X (Absent)',
        points: '-',
        status: 'X',
        isAssessed: false,
      });
    } else if (evalStatus === 'Y') {
      missingCount++;
      const reasonLabel = irregularityReason ? `Y (${irregularityReason})` : 'Y (Absent)';
      tempRows.push({
        student: st,
        rawScore: null,
        displayScore: 'Y',
        percentage: null,
        displayPercentage: '-',
        cbeLevel: reasonLabel,
        points: '-',
        status: 'Y',
        isAssessed: false,
      });
    } else {
      // Blank / Unassessed
      missingCount++;
      tempRows.push({
        student: st,
        rawScore: null,
        displayScore: '-',
        percentage: null,
        displayPercentage: '-',
        cbeLevel: '-',
        points: '-',
        status: 'Blank',
        isAssessed: false,
      });
    }
  });

  // Calculate Class Mean strictly from assessed percentage scores
  const classMeanPct = assessedCount > 0 ? (percentageSum / assessedCount) : 0;
  const classMeanFormatted = `${classMeanPct.toFixed(2)}%`;

  // Separate assessed and unassessed rows for ranking and proper sorting
  const assessedRows = tempRows.filter((r) => r.isAssessed) as (TempProcessedRow & { percentage: number })[];
  const unassessedRows = tempRows.filter((r) => !r.isAssessed);

  // Sort assessed rows: Highest performance -> Lowest performance
  assessedRows.sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    // Tie breaker 1: raw score descending
    if ((b.rawScore || 0) !== (a.rawScore || 0)) {
      return (b.rawScore || 0) - (a.rawScore || 0);
    }
    // Tie breaker 2: alphabetical name order
    const nameA = (a.student.full_name || '').toLowerCase();
    const nameB = (b.student.full_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  interface RankedProcessedRow {
    rank: number | string;
    admNo: string;
    studentName: string;
    rawScore: number | null;
    displayScore: string;
    percentage: number | null;
    displayPercentage: string;
    cbeLevel: string;
    points: number | string;
    status: string;
    isAssessed: boolean;
  }

  const rankedAssessedRows: RankedProcessedRow[] = [];

  // Central competition ranking rules (1, 1, 3 standard)
  applyCompetitionRanking(
    assessedRows,
    (a, b) => a.percentage === b.percentage,
    (item, rank) => {
      const learnerName = (item.student.full_name || `${item.student.first_name || ''} ${item.student.last_name || ''}`).trim().toUpperCase();
      rankedAssessedRows.push({
        rank: rank,
        admNo: item.student.admission_number || '-',
        studentName: learnerName,
        rawScore: item.rawScore,
        displayScore: item.displayScore,
        percentage: item.percentage,
        displayPercentage: item.displayPercentage,
        cbeLevel: item.cbeLevel,
        points: item.points,
        status: item.status,
        isAssessed: true,
      });
    }
  );

  // Sort unassessed rows alphabetically for consistent layout
  unassessedRows.sort((a, b) => {
    const nameA = (a.student.full_name || '').toLowerCase();
    const nameB = (b.student.full_name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const rankedUnassessedRows: RankedProcessedRow[] = unassessedRows.map((item) => {
    const learnerName = (item.student.full_name || `${item.student.first_name || ''} ${item.student.last_name || ''}`).trim().toUpperCase();
    return {
      rank: '-',
      admNo: item.student.admission_number || '-',
      studentName: learnerName,
      rawScore: item.rawScore,
      displayScore: item.displayScore,
      percentage: item.percentage,
      displayPercentage: item.displayPercentage,
      cbeLevel: item.cbeLevel,
      points: item.points,
      status: item.status,
      isAssessed: false,
    };
  });

  // Combine into final ordered array
  const processedRows: RankedProcessedRow[] = [...rankedAssessedRows, ...rankedUnassessedRows];

  // 4. Render School Header Function
  const renderHeader = (isFirstPage: boolean) => {
    const learningAreaName = subject.subject_name || '';
    const assessmentName = getDisplayExamName(exam.exam_name);

    if (isFirstPage) {
      const schoolNameStr = (school.school_name || 'MUCHORWE COMPREHENSIVE SCHOOL').toUpperCase();
      
      // Page 1: Ultra-compact, clean, academic text header with no boxes, no decoration, and no motto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0); // Pure black
      doc.text(schoolNameStr, marginX + contentWidth / 2, 8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('LEARNING AREA ASSESSMENT REPORT', marginX + contentWidth / 2, 12, { align: 'center' });

      // Grade [X] [Stream] | [Learning Area] | [Assessment] | Term [X] [Year]
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const cleanTerm = (exam.term || '').trim().replace(/^term\s+/i, '');
      const termDisplay = cleanTerm ? `Term ${cleanTerm}` : 'Term';
      const classStreamHeader = streamOrClassDisplay || classNameStr;
      const metaLine = `${classStreamHeader}  |  ${learningAreaName}  |  ${assessmentName} (Out Of: ${assessmentOutOf})  |  ${termDisplay} ${exam.year || ''}`.trim();
      doc.text(metaLine, marginX + contentWidth / 2, 16, { align: 'center' });

      // Single thin elegant divider line (Strictly Black)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(marginX, 18, marginX + contentWidth, 18);
    } else {
      // Page 2+: Small, single-line continuation header with no metadata bloat (Strictly Black)
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const continuationStr = `Learning Area Assessment Report  |  ${classNameStr}  |  ${learningAreaName}`;
      doc.text(continuationStr, marginX, 8);

      // Continuation thin separator line (Strictly Black)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.15);
      doc.line(marginX, 10, marginX + contentWidth, 10);
    }
  };

  // Draw Page 1 Header
  renderHeader(true);

  // 5. Main Learner Assessment Table
  // Columns: Rank | Admission No. | Learner Name | Score | % | CBE Level | Points
  const tableHead = [['Rank', 'Admission No.', 'Learner Name', 'Score', '%', 'CBE Level', 'Points']];

  const tableBody = processedRows.map((row) => [
    row.rank,
    row.admNo,
    row.studentName,
    row.displayScore,
    row.displayPercentage,
    row.cbeLevel,
    row.points,
  ]);

  autoTable(doc, {
    startY: 20,
    margin: { left: marginX, right: marginX, top: 13, bottom: 10 },
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: 8,
      cellPadding: 1.2,
      textColor: [0, 0, 0], // Pure black text
      lineColor: [0, 0, 0], // Strictly black borders
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255], // Strictly white background
      textColor: [0, 0, 0], // Pure black text
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [0, 0, 0], // Strictly black borders
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // Strictly white rows
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 }, // Rank
      1: { halign: 'left', cellWidth: 30 },   // Admission No.
      2: { halign: 'left', cellWidth: 110 },  // Learner Name
      3: { halign: 'center', cellWidth: 30 },  // Score
      4: { halign: 'center', cellWidth: 25 },  // %
      5: { halign: 'center', cellWidth: 45 },  // CBE Level
      6: { halign: 'center', cellWidth: 25 },  // Points
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        renderHeader(false);
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 5;

  // We require about 25mm of vertical height for the compact side-by-side summary blocks + legend
  const neededHeight = 25;
  if (currentY + neededHeight > pageHeight - 10) {
    doc.addPage();
    renderHeader(false);
    currentY = 15;
  }

  // 6. Section C: Compact Side-by-Side Summary & Performance Tables
  const summaryRows = [
    ['Total Learners', `${sortedStudents.length}`],
    ['Assessed Learners', `${assessedCount}`],
    ['Class Mean Score', `${classMeanFormatted}`],
    ['Highest Score', `${highestRawScore !== null ? `${highestRawScore} / ${assessmentOutOf} (${formatPercentage(highestPercentage || 0, true)})` : '-'}`],
    ['Lowest Score', `${lowestRawScore !== null ? `${lowestRawScore} / ${assessmentOutOf} (${formatPercentage(lowestPercentage || 0, true)})` : '-'}`]
  ];

  // Render Left Side - Class Summary Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX },
    tableWidth: 105,
    body: summaryRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0], // Strictly black
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [255, 255, 255], cellWidth: 40 }, // Strictly white
      1: { halign: 'left', fillColor: [255, 255, 255], cellWidth: 65 } // Strictly white
    }
  });

  const leftFinalY = (doc as any).lastAutoTable.finalY;

  // Render Right Side - CBE Horizontal Performance Table
  const getPct = (code: string) => {
    const count = levelCounts[code] || 0;
    return assessedCount > 0 ? `${((count / assessedCount) * 100).toFixed(1)}%` : '0.0%';
  };

  const distributionHead = is4PointScale
    ? [['Level', 'EE', 'ME', 'AE', 'BE']]
    : [['Level', 'EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2']];

  const distributionBody = is4PointScale
    ? [
        [
          'Learners',
          `${levelCounts.EE || 0}`,
          `${levelCounts.ME || 0}`,
          `${levelCounts.AE || 0}`,
          `${levelCounts.BE || 0}`
        ],
        [
          '%',
          getPct('EE'),
          getPct('ME'),
          getPct('AE'),
          getPct('BE')
        ]
      ]
    : [
        [
          'Learners',
          `${levelCounts.EE1 || 0}`,
          `${levelCounts.EE2 || 0}`,
          `${levelCounts.ME1 || 0}`,
          `${levelCounts.ME2 || 0}`,
          `${levelCounts.AE1 || 0}`,
          `${levelCounts.AE2 || 0}`,
          `${levelCounts.BE1 || 0}`,
          `${levelCounts.BE2 || 0}`
        ],
        [
          '%',
          getPct('EE1'),
          getPct('EE2'),
          getPct('ME1'),
          getPct('ME2'),
          getPct('AE1'),
          getPct('AE2'),
          getPct('BE1'),
          getPct('BE2')
        ]
      ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX + 112 },
    tableWidth: 155,
    head: distributionHead,
    body: distributionBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0], // Strictly black
      lineWidth: 0.1,
      halign: 'center',
    },
    headStyles: {
      fillColor: [255, 255, 255], // Strictly white
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: is4PointScale
      ? {
          0: { fontStyle: 'bold', fillColor: [255, 255, 255], halign: 'left', cellWidth: 35 },
          1: { fillColor: [255, 255, 255], cellWidth: 30 },
          2: { fillColor: [255, 255, 255], cellWidth: 30 },
          3: { fillColor: [255, 255, 255], cellWidth: 30 },
          4: { fillColor: [255, 255, 255], cellWidth: 30 }
        }
      : {
          0: { fontStyle: 'bold', fillColor: [255, 255, 255], halign: 'left', cellWidth: 23 },
          1: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          2: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          3: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          4: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          5: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          6: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          7: { fillColor: [255, 255, 255], cellWidth: 16.5 },
          8: { fillColor: [255, 255, 255], cellWidth: 16.5 }
        }
  });

  const rightFinalY = (doc as any).lastAutoTable.finalY;
  const tablesFinalY = Math.max(leftFinalY, rightFinalY);

  // 7. Section D: Compact CBE Legend directly below tables (Strictly Black)
  currentY = tablesFinalY + 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  const legendText = is4PointScale
    ? 'CBE Legend: EE = Exceeding Expectation (4 Pts, 75-100%)   |   ME = Meeting Expectation (3 Pts, 41-74%)   |   AE = Approaching Expectation (2 Pts, 21-40%)   |   BE = Below Expectation (1 Pt, 0-20%)'
    : 'CBE Legend: EE = Exceeding Expectation (7-8 Pts, 75-100%)   |   ME = Meeting Expectation (5-6 Pts, 41-74%)   |   AE = Approaching Expectation (3-4 Pts, 21-40%)   |   BE = Below Expectation (1-2 Pts, 0-20%)';
  doc.text(legendText, marginX + contentWidth / 2, currentY, { align: 'center' });

  // 8. Section E: Authoritative Subject Teacher sign-off at the bottom (Strictly Black, Exactly Once)
  currentY += 8;
  if (currentY + 10 > pageHeight - 10) {
    doc.addPage();
    renderHeader(false);
    currentY = 15;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const displayTeacherName = subjectTeacherName ? subjectTeacherName.toUpperCase() : '__________________________';
  doc.text(`SUBJECT TEACHER: ${displayTeacherName}`, marginX, currentY);

  // 9. Footers & Page Numbering across all pages (Strictly Black)
  const totalPages = (doc.internal as any).getNumberOfPages();
  const timestampStr = formatKenyaPdfTimestamp(new Date());

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 5;

    // divider line (Strictly Black)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);
    doc.line(marginX, footerY - 2, marginX + contentWidth, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(`MUCHORWE COMPREHENSIVE SCHOOL  •  Learning Area Assessment Report  •  Generated on: ${timestampStr}`, marginX, footerY);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, footerY, { align: 'right' });
  }

  // 9. File name & Save
  const cleanSubject = (subject.subject_code || subject.subject_name).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClass = classNameStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExam = (getDisplayExamName(exam.exam_name) || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Class_Assessment_${cleanSubject}_${cleanClass}_${cleanExam}.pdf`;

  await savePdf(doc, fileName);
}
