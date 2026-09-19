import { getMeritListDisplayCode } from '../types';
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
  getApplicableSubjectsForGrade,
} from '../types';
import { getGradeForMark, getLearnerReportSubjects } from './analysisEngine';
import { getFilteredStudents, getClassStreamLabel } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, roundMark, isUpperPrimaryCompOrInsha } from '../utils/markUtils';
import { sortSubjectsByStandardOrder } from './meritListExporter';
import { getDisplayExamName } from '../utils/examDisplayUtils';

export interface ExportProvisionalStudentResultsPDFOptions {
  school: School;
  exam: Examination;
  selectedClassId: string;
  selectedStreamId?: string;
  classes: ClassStream[];
  students: Student[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  generatedBy?: string;
}

export async function exportProvisionalStudentResultsPDF(
  options: ExportProvisionalStudentResultsPDFOptions
): Promise<void> {
  const {
    school,
    exam,
    selectedClassId,
    selectedStreamId = 'all',
    classes = [],
    teachers = [],
    students = [],
    subjects = [],
    marks = [],
    grades = [],
    generatedBy = 'CBE Generator System',
  } = options;

  // 1. Filter target students by class and stream (historical exam context aware)
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  // Sort students by admission number / name for easy verification (NO RANKING)
  targetStudents.sort((a, b) => {
    const admA = (a.admission_number || '').toString().toLowerCase();
    const admB = (b.admission_number || '').toString().toLowerCase();
    if (admA && admB) {
      return admA.localeCompare(admB, undefined, { numeric: true });
    }
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  // 2. Identify target class & applicable subjects specifically by education level
  const firstStudent = targetStudents[0];
  const firstHistCtx = firstStudent && exam ? getLearnerClassAtExamTime(firstStudent, exam, classes) : null;

  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstStudent?.class_id))
  ) || classes.find(
    (c) => (c.class_name || '').toLowerCase() === (selectedClassId || '').toLowerCase()
  ) || (firstStudent ? classes.find((c) => c.id === firstStudent.class_id) : undefined);

  const targetGradeName = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstStudent?.grade || (selectedClassId !== 'all' ? selectedClassId : 'Grade 7');

  const rawApplicableSubjects = targetClass
    ? getLearnerReportSubjects(firstStudent || ({} as any), targetClass, subjects, teachers || [])
    : getApplicableSubjectsForGrade(targetGradeName, subjects);

  const applicableSubjects = sortSubjectsByStandardOrder(
    (rawApplicableSubjects && rawApplicableSubjects.length > 0)
      ? rawApplicableSubjects
      : getApplicableSubjectsForGrade(targetGradeName, subjects)
  );

  const streamLabel = getClassStreamLabel(classes, selectedClassId, selectedStreamId);

  // Initialize jsPDF A4 Landscape (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  const marginTop = 10;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  const dateNowStr = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // --- BUILD TABLE HEADERS ---
  const tableHeadTitles: string[] = [
    'No.',
    'Adm No.',
    'Learner Name',
    ...applicableSubjects.map((sb) => getMeritListDisplayCode(sb.subject_code, sb.subject_name, targetGradeName)),
    'Total Marks',
    'Avg Marks',
  ];

  // --- BUILD TABLE ROWS ---
  const examMarks = marks.filter((m) => m.exam_id === exam.id);

  const tableRows: (string | number)[][] = targetStudents.map((std, idx) => {
    const stdMarks = examMarks.filter((m) => m.student_id === std.id);

    let assessedCount = 0;
    let sumScore = 0;

    const subjectCellValues: string[] = applicableSubjects.map((sb) => {
      const markObj = stdMarks.find((m) => m.subject_id === sb.id);
      const stdClass = classes.find((c) => c.id === std.class_id || c.stream_id === std.stream_id || c.class_name === std.grade);
      const eduLevel = exam?.education_level || stdClass?.education_level;
      const isCompInsha = isUpperPrimaryCompOrInsha(sb, stdClass, eduLevel);
      const markInfo = evaluateMark(markObj, {
        isUpperPrimaryCompOrInsha: isCompInsha,
        subject: sb,
        classObj: stdClass,
        educationLevel: eduLevel,
      });

      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        assessedCount++;
        sumScore += markInfo.percentage;
        const gr = getGradeForMark(
          markInfo.percentage,
          grades,
          eduLevel,
          stdClass?.class_name || std.grade
        );
        const scoreVal = isCompInsha ? markInfo.displayScore : roundMark(markInfo.percentage);
        return `${scoreVal} ${gr.grade_code || gr.grade}`;
      } else if (markInfo.status === 'X') {
        return 'X';
      } else if (markInfo.status === 'Y') {
        return 'Y';
      } else {
        return 'X';
      }
    });

    const totalMarks = Math.round(sumScore);
    const avgMarks = assessedCount > 0 ? (sumScore / assessedCount).toFixed(1) : '-';

    return [
      idx + 1,
      std.admission_number || 'N/A',
      (std.full_name || 'Unnamed Learner').toUpperCase(),
      ...subjectCellValues,
      assessedCount > 0 ? totalMarks : '-',
      avgMarks,
    ];
  });

  // --- FUNCTION TO RENDER TOP PAGE HEADER ON PAGE 1 ONLY (BLACK & WHITE + ALL BOLD) ---
  const renderDocumentHeader = (docInstance: jsPDF) => {
    let curY = marginTop;

    // Outer Header Box (BLACK & WHITE)
    const headerHeight = 22;
    docInstance.setDrawColor(0, 0, 0); // Black border
    docInstance.setFillColor(255, 255, 255); // White fill
    docInstance.setLineWidth(0.4);
    docInstance.rect(marginX, curY, contentWidth, headerHeight, 'FD');

    // Title & School Name Area (Cleanly Centered, No Logo Box)
    const textCenterX = marginX + contentWidth / 2;

    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(13);
    docInstance.setTextColor(0, 0, 0); // Solid Black
    docInstance.text((school.school_name || 'SCHOOL NAME').toUpperCase(), textCenterX, curY + 6, {
      align: 'center',
    });

    // Report Title
    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(11);
    docInstance.setTextColor(0, 0, 0); // Solid Black
    docInstance.text('PROVISIONAL RESULTS', textCenterX, curY + 11.5, {
      align: 'center',
    });

    // Compact Sub Metadata Line (Pipe-separated)
    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(8.5);
    docInstance.setTextColor(0, 0, 0); // Solid Black

    const examNameStr = getDisplayExamName(exam.exam_name) || 'Examination';
    const metaLine = `Exam: ${examNameStr} | Term: ${exam.term || 'Term 2'} | Year: ${exam.year || 2026} | Class: ${streamLabel} | ${dateNowStr}`;

    docInstance.text(metaLine, textCenterX, curY + 17, { align: 'center' });

    curY += headerHeight + 2.5;

    // --- PROVISIONAL NOTICE BANNER (BLACK & WHITE + ALL BOLD) ---
    const noticeHeight = 7.5;
    docInstance.setFillColor(255, 255, 255); // White fill
    docInstance.setDrawColor(0, 0, 0); // Black border
    docInstance.setLineWidth(0.4);
    docInstance.rect(marginX, curY, contentWidth, noticeHeight, 'FD');

    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(8.5);
    docInstance.setTextColor(0, 0, 0); // Solid Black
    docInstance.text(
      'This is a provisional report for verification purposes only. Results are not final until officially approved.',
      textCenterX,
      curY + 5,
      { align: 'center' }
    );
  };

  // Render Header on Page 1 before table
  renderDocumentHeader(doc);

  const startTableY = marginTop + 22 + 2.5 + 7.5 + 3.5; // 45.5mm

  // Configure autotable column styles
  const numSubjectCols = applicableSubjects.length;
  
  // Custom column widths configuration with active redistribution
  const columnStyles: Record<number, any> = {
    0: { cellWidth: 10, halign: 'center' }, // No.
    1: { cellWidth: 22, halign: 'center' }, // Adm No.
    2: { cellWidth: 58, halign: 'left' }, // Learner Name (expanded width for full readability)
  };

  // Dynamic width for subject columns
  const fixedWidths = 10 + 22 + 58 + 22 + 22; // 134mm
  const remainingForSubjects = contentWidth - fixedWidths; // 143mm available for subjects
  const subjColWidth = numSubjectCols > 0
    ? Math.max(10, Math.min(25, remainingForSubjects / numSubjectCols))
    : 16;

  let colIdx = 3;
  for (let i = 0; i < numSubjectCols; i++) {
    columnStyles[colIdx] = { cellWidth: subjColWidth, halign: 'center' };
    colIdx++;
  }

  // Summary columns after subjects
  columnStyles[colIdx++] = { cellWidth: 22, halign: 'center' }; // Total Marks
  columnStyles[colIdx++] = { cellWidth: 22, halign: 'center' }; // Avg Marks

  autoTable(doc, {
    startY: startTableY,
    margin: { left: marginX, right: marginX, top: 12, bottom: marginBottom },
    head: [tableHeadTitles],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [0, 0, 0], // Solid Black header
      textColor: [255, 255, 255], // White bold text
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 8.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    styles: {
      fontStyle: 'normal', // Learner rows & values are regular (non-bold)
      fontSize: 7.2,
      cellPadding: { top: 1.4, bottom: 1.4, left: 1.2, right: 1.2 },
      textColor: [0, 0, 0], // Solid Black text everywhere
      lineColor: [0, 0, 0], // Solid Black grid lines
      lineWidth: 0.2,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // White fill (black and white)
      textColor: [0, 0, 0],
      fontStyle: 'normal',
    },
  });

  // --- FOOTER FOR ALL PAGES (CLEAN, PROFESSIONAL & COMPACT) ---
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 10;

    // Divider Line
    doc.setDrawColor(0, 0, 0); // Black line
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 2.5, marginX + contentWidth, footerY - 2.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0); // Solid Black

    // Left: Document Identification
    doc.text(
      `${(school.school_name || 'CBE MANAGEMENT SYSTEM').toUpperCase()} • PROVISIONAL STUDENT RESULTS`,
      marginX,
      footerY.valueOf()
    );

    // Right: Page number
    doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth, footerY.valueOf(), {
      align: 'right',
    });
  }

  // Save PDF
  const cleanExamName = (getDisplayExamName(exam.exam_name) || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClassName = streamLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Provisional_Student_Results_${cleanClassName}_${cleanExamName}.pdf`;

  await savePdf(doc, fileName);
}
