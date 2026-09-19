import { getMeritListDisplayCode } from '../types';
import rawJsPDF from 'jspdf';
const jsPDF = (rawJsPDF as any).jsPDF || rawJsPDF;
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
import { evaluateMark } from '../utils/markUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { getLearnerReportSubjects } from './analysisEngine';
import { sortSubjectsByStandardOrder } from './meritListExporter';
import { getFilteredStudents } from '../utils/filterUtils';
import { formatKenyaPdfTimestamp } from '../utils/kenyaDateUtils';
import { getDisplayExamName } from '../utils/examDisplayUtils';

export interface RawMarksPDFOptions {
  school: School;
  exam: Examination;
  selectedClassId: string;
  selectedStreamId?: string;
  students: Student[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  generatedBy?: string;
}

// Convert image URL to Base64 for jsPDF
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

export async function exportRawMarksAllSubjectsPDF(
  options: RawMarksPDFOptions
): Promise<void> {
  const {
    school,
    exam,
    selectedClassId,
    selectedStreamId = 'all',
    students = [],
    subjects = [],
    marks = [],
    classes = [],
    teachers = [],
  } = options;

  // 1. Resolve selected class/stream context
  const targetClassObj =
    classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId) ||
    classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId) ||
    classes.find((c) => (c.class_name || '').toLowerCase() === (selectedClassId || '').toLowerCase());

  // 2. Filter students matching class & stream scope at exam time using standard filterUtils
  let targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  if (!targetStudents || targetStudents.length === 0) {
    // If selectedClassId was a specific class/stream UUID
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
    throw new Error('No learner records found for the selected assessment and class.');
  }

  // 3. Format header class name description
  let classNameStr = 'ALL CLASSES';
  if (targetClassObj) {
    if (targetClassObj.stream && selectedStreamId !== 'all') {
      classNameStr = `${targetClassObj.class_name} ${targetClassObj.stream}`;
    } else if (targetClassObj.stream) {
      classNameStr = `${targetClassObj.class_name} ${targetClassObj.stream}`;
    } else {
      classNameStr = targetClassObj.class_name;
    }
  } else if (selectedClassId !== 'all') {
    classNameStr = selectedClassId;
  }

  // 4. Determine active subjects applicable to this class cohort
  const firstStudent = targetStudents[0];
  const rawCohortSubjects = targetClassObj
    ? getLearnerReportSubjects(firstStudent || ({} as any), targetClassObj, subjects, teachers)
    : subjects.filter((s) => s.status !== 'Archived');

  let cohortSubjects = sortSubjectsByStandardOrder(rawCohortSubjects);

  if (cohortSubjects.length === 0 && targetClassObj) {
    cohortSubjects = sortSubjectsByStandardOrder(
      getApplicableSubjectsForGrade(targetClassObj.class_name, subjects)
    );
  }

  if (cohortSubjects.length === 0) {
    cohortSubjects = sortSubjectsByStandardOrder(subjects.filter((s) => s.status !== 'Archived'));
  }

  if (cohortSubjects.length === 0) {
    throw new Error('No active subject/learning area records found for this class.');
  }

  // 5. Prepare Landscape A4 PDF document (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  const logoBase64 = await getBase64ImageFromUrl(school.logo_url);

  // 6. Sort learners deterministically by admission number / full name
  const sortedStudents = [...targetStudents].sort((a, b) => {
    const admA = (a.admission_number || '').trim();
    const admB = (b.admission_number || '').trim();
    if (admA && admB) {
      return admA.localeCompare(admB, undefined, { numeric: true });
    }
    const nameA = (a.full_name || `${a.first_name || ''} ${a.last_name || ''}`).trim();
    const nameB = (b.full_name || `${b.first_name || ''} ${b.last_name || ''}`).trim();
    return nameA.localeCompare(nameB);
  });

  // 7. Define table headers and body
  const subjectHeaders = cohortSubjects.map((s) => getMeritListDisplayCode(s.subject_code, s.subject_name));
  const headRow = ['S.No', 'ADM', 'LEARNER NAME', ...subjectHeaders];

  const tableBody = sortedStudents.map((st, index) => {
    const admNo = st.admission_number || '-';
    const studentName = (st.full_name || `${st.first_name || ''} ${st.last_name || ''}`).trim().toUpperCase();

    const subjCols = cohortSubjects.map((sub) => {
      const match = marks.find(
        (m) =>
          String(m.student_id) === String(st.id) &&
          String(m.exam_id) === String(exam.id) &&
          String(m.subject_id) === String(sub.id)
      );

      const evalRes = evaluateMark(match);
      if (evalRes.status === 'Normal' && evalRes.rawScore !== null) {
        return String(evalRes.rawScore);
      } else if (evalRes.status === 'X') {
        return 'X';
      } else if (evalRes.status === 'Y') {
        return 'Y';
      } else {
        return '-';
      }
    });

    return [
      String(index + 1),
      admNo,
      studentName,
      ...subjCols,
    ];
  });

  // 8. Render Header Function (Only on Page 1)
  const renderHeader = (data?: any) => {
    if (data && data.pageNumber && data.pageNumber !== 1) {
      return;
    }
    let currentY = 6;
    const headerBoxHeight = 25;

    // Outer border for header box
    doc.setDrawColor(0, 0, 0); // Strictly black
    doc.setLineWidth(0.3);
    doc.rect(marginX, currentY, contentWidth, headerBoxHeight);

    // Optional Logo
    const logoSize = 18;
    const logoX = marginX + 3;
    const logoY = currentY + 3.5;

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch {
        // Ignore logo failure
      }
    }

    const textCenterX = marginX + contentWidth / 2;

    // Line 1: School Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0); // Strictly black
    doc.text((school.school_name || 'SCHOOL NAME').toUpperCase(), textCenterX, currentY + 6, { align: 'center' });

    // Line 2: Report Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0); // Strictly black
    doc.text('RAW UNOFFICIAL MARKS: FOR VERIFICATION', textCenterX, currentY + 12, { align: 'center' });

    // Line 3: Class Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0); // Strictly black
    doc.text(`CLASS: ${classNameStr.toUpperCase()}`, textCenterX, currentY + 17.5, { align: 'center' });

    // Line 4: Examination Info
    const examStr = `ASSESSMENT: ${(getDisplayExamName(exam.exam_name) || 'EXAMINATION').toUpperCase()}${exam.term || exam.year ? ` (${exam.term} ${exam.year})` : ''}`;
    doc.text(examStr, textCenterX, currentY + 22.5, { align: 'center' });
  };

  // 9. Generate AutoTable
  autoTable(doc, {
    head: [headRow],
    body: tableBody,
    startY: 34,
    margin: { top: 10, bottom: 15, left: marginX, right: marginX },
    showHead: 'everyPage',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: [0, 0, 0], // Strictly black text
      lineWidth: 0.15,
      lineColor: [0, 0, 0], // Strictly black borders
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255], // Strictly white background
      textColor: [0, 0, 0], // Strictly black text
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
      cellPadding: 2,
      lineWidth: 0.15,
      lineColor: [0, 0, 0], // Strictly black borders
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // Strictly white
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // S.No
      1: { halign: 'center', cellWidth: 18 }, // ADM
      2: { halign: 'left', cellWidth: 50 }, // LEARNER NAME
      ...cohortSubjects.reduce((acc, _, idx) => {
        acc[idx + 3] = { halign: 'center' };
        return acc;
      }, {} as Record<number, any>),
    },
    didDrawPage: (data) => {
      if (data.pageNumber === 1) {
        renderHeader(data);
      }
    },
  });

  // 10. Draw Footer on every page
  const totalPages = (doc.internal as any).getNumberOfPages();
  const timestampStr = formatKenyaPdfTimestamp(new Date());

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 7;

    // Footer divider line
    doc.setDrawColor(0, 0, 0); // Strictly black
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 3, marginX + contentWidth, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0); // Strictly black text
    doc.text(`Report generated on: ${timestampStr}`, marginX, footerY);
    doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth, footerY, { align: 'right' });
  }

  // 11. Save PDF
  const cleanExamName = (getDisplayExamName(exam.exam_name) || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClassName = classNameStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Raw_Marks_Verification_Sheet_${cleanClassName}_${cleanExamName}.pdf`;

  await savePdf(doc, fileName);
}
