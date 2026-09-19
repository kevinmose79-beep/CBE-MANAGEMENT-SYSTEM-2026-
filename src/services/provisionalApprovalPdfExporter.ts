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
} from '../types';
import {
  calculateExamResults,
  generateExamAnalysisSummary,
  getGradeForMark,
  CBE_8_POINT_GRADES,
} from './analysisEngine';
import { getFilteredStudents, stripSurroundingQuotes } from '../utils/filterUtils';
import { getDisplayExamName, getDisplayExamType } from '../utils/examDisplayUtils';

interface GenerateProvisionalApprovalPDFOptions {
  exam: Examination;
  school: School;
  students: Student[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  selectedClassId?: string;
  selectedStreamId?: string;
  generatedBy?: string;
  approvalStatus?: 'Provisional' | 'Approved' | 'Returned';
  approvalNotes?: string;
}

// Convert image URL to Base64
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

export async function generateProvisionalApprovalPDF(
  options: GenerateProvisionalApprovalPDFOptions
): Promise<void> {
  const {
    exam,
    school,
    students,
    subjects,
    marks,
    grades,
    classes,
    teachers = [],
    selectedClassId = 'all',
    selectedStreamId = 'all',
    generatedBy = 'Class Teacher',
    approvalStatus = exam?.status === 'Approved' ? 'Approved' : 'Provisional',
    approvalNotes = '',
  } = options;

  // 1. Filter target students using historical cohort resolver
  const targetStudents = getFilteredStudents(
    students || [],
    classes || [],
    selectedClassId,
    selectedStreamId,
    exam
  );

  // Target class description
  let classStreamLabel = 'ALL CLASSES & STREAMS';
  if (selectedClassId !== 'all') {
    const targetClass = classes.find((c) => c.id === selectedClassId);
    if (targetClass) {
      classStreamLabel = `${(targetClass.class_name || '').toUpperCase()} - ${(targetClass.stream || '').toUpperCase()}`;
    } else {
      classStreamLabel = selectedClassId.toUpperCase();
    }
  }
  if (selectedStreamId !== 'all') {
    const streamObj = classes.find((c) => c.id === selectedStreamId);
    if (streamObj) {
      classStreamLabel = `${(streamObj.class_name || '').toUpperCase()} (${(streamObj.stream || '').toUpperCase()})`;
    }
  }

  // 2. Generate Analysis Summary
  const summary = generateExamAnalysisSummary(
    exam.id,
    exam.exam_name,
    targetStudents,
    subjects,
    marks,
    grades
  );

  const totalAssessedLearners = targetStudents.length;
  const totalSubjectsCount = subjects.length;

  // Initialize jsPDF A4 Portrait (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 186mm

  const dateNowStr = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let currentY = 10;

  // --- SCHOOL HEADER SECTION ---
  const headerBoxHeight = 32;
  doc.setDrawColor(30, 41, 59); // Slate-800
  doc.setLineWidth(0.4);
  doc.rect(marginX, currentY, contentWidth, headerBoxHeight);

  // Logo
  let logoBase64: string | null = null;
  if (school.logo_url) {
    try {
      logoBase64 = await getBase64ImageFromUrl(school.logo_url);
    } catch {
      logoBase64 = null;
    }
  }

  const logoX = marginX + 4;
  const logoY = currentY + 4;
  const logoSize = 24;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch {
      // Ignore image rendering error without drawing dummy box
    }
  }

  // School Details (Centered)
  const textCenterX = marginX + contentWidth / 2 + (logoBase64 ? 8 : 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text((school.school_name || 'School Name Not Configured').toUpperCase(), textCenterX, currentY + 7, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // Slate-700
  
  const subHeaderLines: string[] = [];
  if (school.school_code || school.county) {
    subHeaderLines.push(
      `School Code: ${school.school_code || 'N/A'}  |  County: ${school.county || 'N/A'}${
        school.sub_county ? ` (${school.sub_county})` : ''
      }`
    );
  }
  const contactParts: string[] = [];
  if (school.phone) contactParts.push(`Tel: ${school.phone}`);

  if (contactParts.length > 0) {
    subHeaderLines.push(contactParts.join('  |  '));
  }

  let subY = currentY + 13;
  subHeaderLines.forEach((line) => {
    doc.text(line, textCenterX, subY, { align: 'center' });
    subY += 4.5;
  });

  currentY += headerBoxHeight + 4;

  // --- MAIN REPORT TITLE BANNER ---
  doc.setFillColor(15, 23, 42); // Dark Navy background
  doc.rect(marginX, currentY, contentWidth, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('PROVISIONAL RESULTS APPROVAL REPORT', marginX + contentWidth / 2, currentY + 6, {
    align: 'center',
  });

  currentY += 12;

  // --- EXAMINATION METADATA GRID ---
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.rect(marginX, currentY, contentWidth, 22, 'FD');

  const col1X = marginX + 4;
  const col2X = marginX + contentWidth / 2 + 4;

  doc.setFontSize(8.5);
  
  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Examination:', col1X, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(getDisplayExamName(exam.exam_name) || 'N/A', col1X + 26, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Class / Cohort:', col2X, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(classStreamLabel, col2X + 26, currentY + 5.5);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Exam Type:', col1X, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(getDisplayExamType(exam.exam_type) || 'End-Term Assessment', col1X + 26, currentY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Term / Year:', col2X, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${exam.term || 'Term 2'} - ${exam.year || 2026}`, col2X + 26, currentY + 11.5);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Date Generated:', col1X, currentY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dateNowStr, col1X + 26, currentY + 17.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Report Scope:', col2X, currentY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Official Administrative Approval`, col2X + 26, currentY + 17.5);

  currentY += 26;

  // --- SECTION 1: EXAMINATION OVERALL SUMMARY ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXAMINATION OVERALL PERFORMANCE SUMMARY', marginX, currentY);
  currentY += 2.5;

  // Best & Lowest Subject strings
  const strongStr = summary.strong_subjects.length > 0 ? summary.strong_subjects[0] : 'N/A';
  const weakStr = summary.weak_subjects.length > 0 ? summary.weak_subjects[0] : 'N/A';

  const summaryData = [
    [
      { content: 'Total Learners Assessed', styles: { fontStyle: 'bold' as const } },
      `${totalAssessedLearners} Learners`,
      { content: 'Total Learning Areas / Subjects', styles: { fontStyle: 'bold' as const } },
      `${totalSubjectsCount} Subjects`,
    ],
    [
      { content: 'Class Mean Score (%)', styles: { fontStyle: 'bold' as const } },
      `${Math.round(summary.mean_score)}%`,
      { content: 'Class Mean Points (out of 8.00)', styles: { fontStyle: 'bold' as const } },
      `${summary.mean_points} / 8.00`,
    ],
    [
      { content: 'CBE Mean Performance Level', styles: { fontStyle: 'bold' as const } },
      `${summary.mean_grade_code} (${summary.mean_performance_level})`,
      { content: 'Score Range (Highest / Lowest)', styles: { fontStyle: 'bold' as const } },
      `High: ${Math.round(summary.highest_score)}%  |  Low: ${Math.round(summary.lowest_score)}%`,
    ],
    [
      { content: 'Highest Performing Subject', styles: { fontStyle: 'bold' as const } },
      strongStr,
      { content: 'Lowest Performing Subject', styles: { fontStyle: 'bold' as const } },
      weakStr,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [],
    body: summaryData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 48, fillColor: [241, 245, 249] },
      1: { cellWidth: 45 },
      2: { cellWidth: 48, fillColor: [241, 245, 249] },
      3: { cellWidth: 45 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 2: CBE PERFORMANCE LEVEL DISTRIBUTION ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. COMPETENCY LEVEL DISTRIBUTION (CBE 8-POINT SCALE)', marginX, currentY);
  currentY += 2.5;

  const eeCount = summary.level_counts.EE || 0;
  const meCount = summary.level_counts.ME || 0;
  const aeCount = summary.level_counts.AE || 0;
  const beCount = summary.level_counts.BE || 0;
  const totalCount = totalAssessedLearners || 1;

  const pct = (cnt: number) => `${Math.round((cnt / totalCount) * 1000) / 10}%`;

  const levelDistributionRows = [
    [
      'Exceeding Expectations (EE)',
      'EE1, EE2 (75% - 100%)',
      `${eeCount}`,
      pct(eeCount),
      'Outstanding & Excellent Mastery',
    ],
    [
      'Meeting Expectations (ME)',
      'ME1, ME2 (41% - 74%)',
      `${meCount}`,
      pct(meCount),
      'Good & Satisfactory Competency',
    ],
    [
      'Approaching Expectations (AE)',
      'AE1, AE2 (21% - 40%)',
      `${aeCount}`,
      pct(aeCount),
      'Developing Competency / Practice Needed',
    ],
    [
      'Below Expectations (BE)',
      'BE1, BE2 (1% - 20%)',
      `${beCount}`,
      pct(beCount),
      'Requires Targeted Teacher Support',
    ],
    [
      'TOTAL COHORT ASSESSED',
      'ALL CODES (EE1 - BE2)',
      `${totalCount}`,
      '100.0%',
      'Official Examination Candidates',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      ['CBE Performance Level', 'Grade Codes & Range', 'Learner Count', 'Distribution %', 'Descriptor'],
    ],
    body: levelDistributionRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 42 },
      2: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 43 },
    },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 3: SUBJECT PERFORMANCE SUMMARY ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. SUBJECT-WISE PERFORMANCE ANALYSIS', marginX, currentY);
  currentY += 2.5;

  const subjectTableRows = summary.subject_summaries.map((s) => {
    const gr = getGradeForMark(s.mean_score, grades);
    return [
      s.subject_code || '-',
      s.subject_name || '-',
      `${totalAssessedLearners}`,
      `${s.mean_score}%`,
      `${s.mean_points}`,
      `${gr.grade_code || gr.grade || 'ME1'} (${gr.performance_level || 'ME'})`,
      `${s.pass_rate}%`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [
      ['Code', 'Subject / Learning Area', 'Assessed', 'Mean Score', 'Mean Points', 'CBE Level', 'Pass Rate %'],
    ],
    body: subjectTableRows.length > 0 ? subjectTableRows : [['-', 'No subjects registered', '0', '0%', '0.00', '-', '0%']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 54, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 23, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 23, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 19, halign: 'center' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Check page overflow before Status and Sign-off
  if (currentY + 66 > pageHeight - 15) {
    doc.addPage();
    currentY = 15;
  }

  // --- SECTION 4: RESULT APPROVAL DECISION & COMMENTS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. RESULT STATUS & ADMINISTRATIVE APPROVAL DECISION', marginX, currentY);
  currentY += 3;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, currentY, contentWidth, 24, 'FD');

  const boxY = currentY;
  doc.setFontSize(8.5);

  // Status checkboxes
  const isProv = approvalStatus === 'Provisional';
  const isAppr = approvalStatus === 'Approved';
  const isRet = approvalStatus === 'Returned';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('EXAMINATION RESULT STATUS:', marginX + 4, boxY + 5.5);

  doc.setFont('helvetica', 'bold');
  // Box 1: Provisional
  doc.text(isProv ? '[ X ] PROVISIONAL RESULTS' : '[   ] PROVISIONAL RESULTS', marginX + 58, boxY + 5.5);
  // Box 2: Approved
  doc.text(isAppr ? '[ X ] APPROVED FOR PUBLICATION' : '[   ] APPROVED FOR PUBLICATION', marginX + 104, boxY + 5.5);
  // Box 3: Returned
  doc.text(isRet ? '[ X ] RETURNED FOR CORRECTION' : '[   ] RETURNED FOR CORRECTION', marginX + 154, boxY + 5.5);

  // Divider line inside box
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX + 2, boxY + 8.5, marginX + contentWidth - 2, boxY + 8.5);

  // Notes
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Approval Notes / Observations:', marginX + 4, boxY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const noteText = stripSurroundingQuotes(approvalNotes || 'Marks audited and verified against marksheets. Standard CBE 8-point grading applied.');
  doc.text(noteText, marginX + 48, boxY + 13, { maxWidth: 134 });

  currentY += 28;

  // --- SECTION 5: AUTHORIZATION & OFFICIAL SIGN-OFF GRID ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5. AUTHORIZATION & OFFICIAL SIGN-OFF', marginX, currentY);
  currentY += 3;

  const signGridWidth = (contentWidth - 6) / 3; // ~60mm per column
  const signBoxHeight = 32;

  // Determine Class Teacher for Prepared By sign-off
  const selectedClass = classes.find((c) => c.id === selectedClassId || c.id === selectedStreamId);
  const classTeacher =
    teachers.find((t) => t.id === selectedClass?.class_teacher_id) ||
    teachers.find(
      (t) =>
        t.is_class_teacher &&
        (t.class_teacher_of_id === selectedClassId || t.class_teacher_of_id === selectedStreamId)
    ) ||
    teachers.find((t) => (t.allocations || []).some(a => a.class_id === selectedClassId || (selectedStreamId && a.class_id === selectedStreamId)));

  const preparedByName = classTeacher ? classTeacher.teacher_name : generatedBy;

  // Box 1: Prepared By
  const box1X = marginX;
  doc.setDrawColor(203, 213, 225);
  doc.rect(box1X, currentY, signGridWidth, signBoxHeight);
  
  doc.setFillColor(241, 245, 249);
  doc.rect(box1X, currentY, signGridWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PREPARED BY', box1X + signGridWidth / 2, currentY + 4, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Name:', box1X + 3, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(preparedByName, box1X + 13, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Title:', box1X + 3, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Class Teacher', box1X + 11, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Sign:', box1X + 3, currentY + 21);
  doc.text('_______________________', box1X + 12, currentY + 21);

  doc.text('Date:', box1X + 3, currentY + 27);
  doc.text('_______________________', box1X + 12, currentY + 27);


  // Box 2: Verified By
  const box2X = marginX + signGridWidth + 3;
  doc.setDrawColor(203, 213, 225);
  doc.rect(box2X, currentY, signGridWidth, signBoxHeight);

  doc.setFillColor(241, 245, 249);
  doc.rect(box2X, currentY, signGridWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('VERIFIED BY', box2X + signGridWidth / 2, currentY + 4, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Name:', box2X + 3, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Examinations Officer', box2X + 13, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Title:', box2X + 3, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Senior Exam Coordinator', box2X + 11, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Sign:', box2X + 3, currentY + 21);
  doc.text('_______________________', box2X + 12, currentY + 21);

  doc.text('Date:', box2X + 3, currentY + 27);
  doc.text('_______________________', box2X + 12, currentY + 27);


  // Box 3: Approved By (Head of Institution)
  const box3X = marginX + (signGridWidth + 3) * 2;
  doc.setDrawColor(203, 213, 225);
  doc.rect(box3X, currentY, signGridWidth, signBoxHeight);

  doc.setFillColor(241, 245, 249);
  doc.rect(box3X, currentY, signGridWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('APPROVED BY', box3X + signGridWidth / 2, currentY + 4, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Name:', box3X + 3, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(school.principal_name || 'Headteacher / Principal', box3X + 13, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Sign:', box3X + 3, currentY + 15);
  doc.text('_______________________', box3X + 12, currentY + 15);

  doc.text('Date:', box3X + 3, currentY + 20);
  doc.text('_______________________', box3X + 12, currentY + 20);

  // Official Stamp Box inside Box 3
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setFillColor(255, 255, 255);
  doc.rect(box3X + 14, currentY + 22.5, 32, 8);
  doc.setTextColor(148, 163, 184);
  doc.text('OFFICIAL SCHOOL STAMP', box3X + 30, currentY + 27.5, { align: 'center' });

  // --- FOOTER ON ALL PAGES ---
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    const footerY = pageHeight - 10;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 3, marginX + contentWidth, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // Slate-500

    doc.text(
      `${school.school_name || 'School Name Not Configured'} - PROVISIONAL RESULTS APPROVAL REPORT`,
      marginX,
      footerY
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      'This is a provisional report and subject to final approval.',
      marginX + contentWidth / 2,
      footerY,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${pageNum} of ${totalPages}`, marginX + contentWidth, footerY, {
      align: 'right',
    });
  }

  // Sanitize filename
  const cleanExamName = (getDisplayExamName(exam.exam_name) || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClassName = classStreamLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Provisional_Approval_Report_${cleanExamName}_${cleanClassName}.pdf`;

  await savePdf(doc, filename);
}
