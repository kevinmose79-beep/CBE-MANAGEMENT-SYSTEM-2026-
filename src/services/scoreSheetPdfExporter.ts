import rawJsPDF from 'jspdf';
const jsPDF = (rawJsPDF as any).jsPDF || rawJsPDF;
import autoTable from 'jspdf-autotable';
import { savePdf } from '../utils/fileDownloader';
import {
  Student,
  School,
  Examination,
  Subject,
  ClassStream,
  Teacher,
  getStudentFullName,
} from '../types';
import { getFilteredStudents, getClassStreamLabel } from '../utils/filterUtils';
import { formatKenyaPdfTimestamp } from '../utils/kenyaDateUtils';
import { getDisplayExamName } from '../utils/examDisplayUtils';

export interface ScoreSheetPDFOptions {
  school: School;
  exam?: Examination | null;
  subject?: Subject | null;
  outOfMaxScore?: string | number;
  selectedClassId: string;
  selectedStreamId?: string;
  students: Student[];
  classes: ClassStream[];
  teachers?: Teacher[];
  generatedBy?: string;
}

export async function exportScoreSheetPDF(options: ScoreSheetPDFOptions): Promise<void> {
  const {
    school,
    exam,
    subject,
    outOfMaxScore,
    selectedClassId,
    selectedStreamId = 'all',
    students = [],
    classes = [],
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 190mm
  const marginBottom = 12;

  // 1. Resolve selected class and stream objects
  const targetClassObj =
    classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId) ||
    classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId) ||
    classes.find((c) => (c.class_name || '').toLowerCase() === (selectedClassId || '').toLowerCase());

  // 2. Filter target students matching selected class & stream context
  let targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  if (!targetStudents || targetStudents.length === 0) {
    if (targetClassObj) {
      targetStudents = getFilteredStudents(
        students,
        classes,
        targetClassObj.class_name,
        targetClassObj.stream_id || targetClassObj.id,
        exam
      );
    }
  }

  if (!targetStudents || targetStudents.length === 0) {
    // Direct matching fallback for active learners
    targetStudents = students.filter((st) => {
      if (!st) return false;
      if (selectedClassId === 'all') return true;
      if (targetClassObj) {
        if (st.stream_id && (st.stream_id === targetClassObj.stream_id || st.stream_id === targetClassObj.id)) {
          return true;
        }
        if (st.class_id && st.class_id === targetClassObj.id) {
          return true;
        }
      }
      return st.class_id === selectedClassId || st.stream_id === selectedClassId;
    });
  }

  if (!targetStudents || targetStudents.length === 0) {
    throw new Error('No learner records found for the selected class scope.');
  }

  // Sort students alphabetically by full name
  const sortedStudents = [...targetStudents].sort((a, b) => {
    const nameA = getStudentFullName(a) || a.full_name || '';
    const nameB = getStudentFullName(b) || b.full_name || '';
    return nameA.localeCompare(nameB);
  });

  // 3. Resolve Class & Stream Display Label
  const fullClassDisplay = getClassStreamLabel(classes, selectedClassId, selectedStreamId);
  const schoolNameStr = (school?.school_name || 'MUCHORWE JUNIOR SCHOOL').toUpperCase();
  const examNameStr = exam ? getDisplayExamName(exam.exam_name) : '';
  const examOutStr = outOfMaxScore ? String(outOfMaxScore) : '______';
  const learningAreaStr = subject ? subject.subject_name.toUpperCase() : '__________________';
  const dateNowStr = formatKenyaPdfTimestamp(new Date());

  // 4. Render Page 1 Header (Solid Black / High Contrast, Bold, Page 1 ONLY)
  let currentY = 10;

  // School Name (Bold, 13pt)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(schoolNameStr, pageWidth / 2, currentY, { align: 'center' });

  currentY += 5.5;

  // Subtitle / Document Title (Bold, 11pt)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text('SCORE SHEET', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;

  // Compact Metadata Line (Bold, 8.5pt)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  const metaParts = [];
  if (examNameStr) {
    metaParts.push(`Exam: ${examNameStr}`);
    if (exam?.term) metaParts.push(`Term: ${exam.term}`);
    if (exam?.year) metaParts.push(`Year: ${exam.year}`);
  }
  metaParts.push(`Class: ${fullClassDisplay}`);
  metaParts.push(`Learning Area: ${learningAreaStr}`);
  metaParts.push(`Max Score: ${examOutStr}`);

  const metaLine = metaParts.join(' | ');
  doc.text(metaLine, pageWidth / 2, currentY, { align: 'center' });

  currentY += 3.5;

  // Horizontal divider line below header on Page 1
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.35);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  currentY += 3;
  const startTableY = currentY;

  // 5. Construct Table Headers & Data (No. | Adm No. | Learner Name | 7 empty grid columns)
  const numGridCols = 7;
  const tableHead = [['No.', 'Adm No.', 'Learner Name', '', '', '', '', '', '', '']];

  const tableBody = sortedStudents.map((st, idx) => {
    const admNo = st.admission_number || (st as any).adm_no || '-';
    const name = getStudentFullName(st) || st.full_name || '';

    return [
      idx + 1,
      admNo,
      name,
      ...Array(numGridCols).fill(''),
    ];
  });

  // 6. Horizontal Space Redistribution (190mm Content Width)
  // No.: 10mm, Adm No.: 22mm, Learner Name: 58mm -> 90mm
  // Remaining 100mm split across 7 grid columns (~14.28mm each)
  const fixedWidths = 10 + 22 + 58;
  const remainingForGrid = contentWidth - fixedWidths; // 100mm
  const gridColWidth = remainingForGrid / numGridCols; // ~14.285mm

  const columnStyles: Record<number, any> = {
    0: { halign: 'center', cellWidth: 10 },
    1: { halign: 'center', cellWidth: 22 },
    2: { halign: 'left', cellWidth: 58 },
  };

  for (let c = 0; c < numGridCols; c++) {
    columnStyles[3 + c] = { halign: 'center', cellWidth: gridColWidth };
  }

  // 7. Render Table using autoTable
  autoTable(doc, {
    startY: startTableY,
    margin: { left: marginX, right: marginX, top: 12, bottom: marginBottom },
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: 8,
      cellPadding: 2.5, // Generous padding for handwriting score entries
      textColor: [0, 0, 0],
      valign: 'middle',
      lineColor: [51, 65, 85],
      lineWidth: 0.35,
      fontStyle: 'normal', // Regular weight for learner records
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [0, 0, 0],
      fontStyle: 'bold', // Table headers in bold
      halign: 'center',
      fontSize: 8,
      lineColor: [30, 41, 59],
      lineWidth: 0.4,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles,
  });

  // 8. Footers for all pages
  const totalPages = (doc.internal as any).getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${schoolNameStr} • SCORE SHEET`, marginX, footerY, { align: 'left' });
    doc.text(`Page ${i} of ${totalPages} • Generated: ${dateNowStr}`, pageWidth - marginX, footerY, { align: 'right' });
  }

  // 9. Save File
  const cleanClassName = fullClassDisplay.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanClassName}_Score_Sheet.pdf`;
  await savePdf(doc, fileName);
}
