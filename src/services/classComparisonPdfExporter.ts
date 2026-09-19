import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  School,
  Examination,
  Teacher,
  getEducationLevelForGrade,
} from '../types';
import {
  ClassPerformanceComparisonResult,
  StreamRankingSummary,
  TopLearnerSummary,
} from './classComparisonEngine';
import { savePdf } from '../utils/fileDownloader';
import { getDisplayExamName } from '../utils/examDisplayUtils';
import { formatKenyaPdfTimestamp } from '../utils/kenyaDateUtils';

export interface ClassComparisonPdfOptions {
  result: ClassPerformanceComparisonResult;
  school?: School;
  examination: Examination;
  teachers?: Teacher[];
  generatedAt?: Date;
}

// Convert image URL to Base64 safely for logo rendering
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
 * Renders full institutional header on Page 1.
 */
function renderPageOneHeader(
  doc: jsPDF,
  school: School | undefined,
  examination: Examination,
  result: ClassPerformanceComparisonResult,
  logoBase64: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  let textLeftMargin = leftMargin;

  // Frame banner border
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.rect(leftMargin, 10, pageWidth - leftMargin * 2, 28);

  // Logo rendering if available
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', leftMargin + 3, 12, 24, 24);
      textLeftMargin = leftMargin + 31;
    } catch {
      textLeftMargin = leftMargin;
    }
  } else {
    textLeftMargin = leftMargin + 6;
  }

  // School Name
  const schoolName = (school?.school_name || 'CBE COMPREHENSIVE SCHOOL').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(schoolName, textLeftMargin, 17);

  // Motto / Subtitle
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // Slate-600
  const mottoText = school?.motto ? `"${school.motto}"` : 'Competency-Based Education Management System';
  doc.text(mottoText, textLeftMargin, 22);

  // Contact line (County, Address, Phone)
  const contactParts: string[] = [];
  if (school?.address) contactParts.push(school.address);
  if (school?.postal_code) contactParts.push(school.postal_code);
  if (school?.county) contactParts.push(`${school.county} County`);
  if (school?.email) contactParts.push(school.email);
  if (school?.phone) contactParts.push(school.phone);

  const contactStr = contactParts.length > 0 ? contactParts.join(' • ') : 'Republic of Kenya • Ministry of Education CBE Framework';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(contactStr, textLeftMargin, 27);

  // Report Title Badge (Class Performance Comparison Report)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 118, 110); // Teal-700
  doc.text('CLASS PERFORMANCE COMPARISON REPORT', textLeftMargin, 33);

  // Date on top right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const dateStr = `Exported: ${formatKenyaPdfTimestamp(new Date())}`;
  doc.text(dateStr, pageWidth - leftMargin - 4, 17, { align: 'right' });

  // Context sub-banner box (Assessment, Term, Year, Grade, Edu Level)
  const contextY = 41;
  const contextHeight = 12;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, contextY, pageWidth - leftMargin * 2, contextHeight, 1.5, 1.5, 'FD');

  const eduLevel = getEducationLevelForGrade(result.className);
  const examDisplayName = getDisplayExamName(examination.exam_name);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  // Col 1: Class / Grade
  doc.text(`COHORT: ${result.className.toUpperCase()} (${eduLevel})`, leftMargin + 4, contextY + 7.5);

  // Col 2: Assessment
  doc.text(`ASSESSMENT: ${examDisplayName}`, leftMargin + 85, contextY + 7.5);

  // Col 3: Academic Term & Year
  doc.text(`PERIOD: ${examination.year} • ${examination.term}`, leftMargin + 175, contextY + 7.5);

  // Col 4: Assessed Count
  const assessedStr = `ASSESSED: ${result.aggregateComparison.grade_total_assessed} of ${result.gradeTotalLearners}`;
  doc.text(assessedStr, pageWidth - leftMargin - 4, contextY + 7.5, { align: 'right' });

  return contextY + contextHeight + 4; // Returns bottom Y coordinate
}

/**
 * Renders compact running header for Pages 2+.
 */
function renderRunningHeader(
  doc: jsPDF,
  school: School | undefined,
  examination: Examination,
  result: ClassPerformanceComparisonResult,
  pageSubtitle: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, 16, pageWidth - leftMargin, 16);

  const schoolName = (school?.school_name || 'CBE COMPREHENSIVE SCHOOL').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolName, leftMargin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const examTitle = `${result.className} • ${getDisplayExamName(examination.exam_name)} (${examination.term} ${examination.year})`;
  doc.text(examTitle, leftMargin + 70, 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text(pageSubtitle, pageWidth - leftMargin, 12, { align: 'right' });

  return 20;
}

/**
 * Renders uniform page numbers and footer across all generated pages.
 */
function renderAllFooters(doc: jsPDF, timestamp: string) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, pageHeight - 11, pageWidth - leftMargin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Class Performance Comparison Report • Generated on: ${timestamp} • Authoritative CBE Analytics`,
      leftMargin,
      pageHeight - 6
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - leftMargin, pageHeight - 6, {
      align: 'right',
    });
  }
}

function formatDifference(diff: number | null | undefined): string {
  if (diff === null || diff === undefined) return '—';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)} pp`;
}

/**
 * Main export function for Class Performance Comparison PDF.
 * Generates an institutional, print-ready A4 Landscape PDF.
 */
export async function exportClassPerformanceComparisonPDF(
  options: ClassComparisonPdfOptions
): Promise<void> {
  const { result, school, examination, generatedAt = new Date() } = options;

  // 1. Initialize A4 Landscape document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const leftMargin = 14;
  const contentWidth = pageWidth - leftMargin * 2; // 269mm
  const logoBase64 = await getBase64ImageFromUrl(school?.logo_url);
  const timestampStr = formatKenyaPdfTimestamp(generatedAt);

  // 2. Empty State Handling: No assessed performance data available
  if (!result.hasAnyAssessed || result.aggregateComparison.grade_total_assessed === 0) {
    renderPageOneHeader(doc, school, examination, result, logoBase64);

    doc.setFillColor(254, 242, 242); // Red-50
    doc.setDrawColor(252, 165, 165); // Red-300
    doc.roundedRect(leftMargin, 70, contentWidth, 36, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28); // Red-700
    doc.text('No Assessed Performance Data Available', pageWidth / 2, 83, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'There are currently no recorded or finalized assessment marks for this cohort and examination.',
      pageWidth / 2,
      90,
      { align: 'center' }
    );
    doc.text(
      'Please ensure student marks are entered, reviewed, and finalized before exporting the comparison report.',
      pageWidth / 2,
      96,
      { align: 'center' }
    );

    renderAllFooters(doc, timestampStr);

    const safeName = `Class_Performance_Comparison_${result.className.replace(/\s+/g, '_')}_${examination.year}_Term${examination.term.replace(/\s+/g, '_')}.pdf`;
    await savePdf(doc, safeName);
    return;
  }

  // =========================================================================
  // PAGE 1: PERFORMANCE OVERVIEW & STREAM RANKING & STREAM TOP ACHIEVERS
  // =========================================================================
  let currentY = renderPageOneHeader(doc, school, examination, result, logoBase64);

  // Grade Overview Metric Callout Box
  const overviewBoxY = currentY;
  const overviewBoxH = 15;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, overviewBoxY, contentWidth, overviewBoxH, 1.5, 1.5, 'FD');

  const gradeAvgMarks =
    result.aggregateComparison.grade_overall_average_marks !== null
      ? result.aggregateComparison.grade_overall_average_marks.toFixed(2)
      : '—';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('GRADE OVERALL CLASS AVERAGE MARKS:', leftMargin + 4, overviewBoxY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(gradeAvgMarks, leftMargin + 72, overviewBoxY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('(Aggregate Score out of Total Obtainable Marks)', leftMargin + 94, overviewBoxY + 6);

  if (!result.isSingleStream) {
    const topStreamText = result.aggregateComparison.highest_stream_name
      ? `Top Performing Stream: ${result.aggregateComparison.highest_stream_name}`
      : result.aggregateComparison.is_tie
      ? 'Top Stream: Tie'
      : 'Top Stream: —';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110);
    doc.text(topStreamText, pageWidth - leftMargin - 4, overviewBoxY + 6, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Assessed Learners: ${result.aggregateComparison.grade_total_assessed} of ${result.gradeTotalLearners} total cohort learners across ${result.streams.length} stream${result.streams.length > 1 ? 's' : ''}.`,
    leftMargin + 4,
    overviewBoxY + 11.5
  );

  currentY = overviewBoxY + overviewBoxH + 4;

  // Stream Performance Ranking Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('STREAM PERFORMANCE RANKING (Ranked by Class Average Marks)', leftMargin, currentY + 3);
  currentY += 5;

  const streamRankingRows = result.aggregateComparison.stream_rankings.map((st: StreamRankingSummary) => {
    const rankStr = st.rank !== null ? `#${st.rank}` : '—';
    const avgMarksStr = st.average_marks !== null ? st.average_marks.toFixed(2) : '—';
    const teacherStr = st.class_teacher_name || '—';
    const assessedRatioStr = `${st.assessed_count} of ${st.total_learners}`;
    const statusBadge =
      st.rank === 1 && !result.isSingleStream ? 'Top Stream' : st.average_marks !== null ? 'Assessed' : 'No Marks';

    return [rankStr, st.stream_name, teacherStr, avgMarksStr, assessedRatioStr, statusBadge];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['Rank', 'Stream', 'Class Teacher', 'Class Average Marks', 'Assessed Learners', 'Status']],
    body: streamRankingRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'right', cellWidth: 42, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 42 },
      5: { halign: 'center', cellWidth: 38, fontStyle: 'bold' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Stream Top 3 Learners Panel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('STREAM TOP ACHIEVERS (Competition Rank ≤ 3)', leftMargin, currentY + 3);
  currentY += 5;

  const streamTopLearnerRows: any[] = [];
  result.aggregateComparison.stream_rankings.forEach((st) => {
    const learners = st.topLearners || [];
    if (learners.length === 0) {
      streamTopLearnerRows.push([
        st.stream_name,
        '—',
        '—',
        'No assessed learners recorded in this stream',
        '—',
        '—',
        '—',
      ]);
    } else {
      learners.forEach((l: TopLearnerSummary) => {
        streamTopLearnerRows.push([
          st.stream_name,
          `#${l.position}`,
          l.admission_number || '—',
          l.student_name,
          l.total_marks.toFixed(1),
          l.average_marks.toFixed(2),
          l.performance_level || '—',
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['Stream', 'Rank', 'Adm No', 'Learner Name', 'Total Marks', 'Average Marks', 'Performance Level']],
    body: streamTopLearnerRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85], // Slate-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 35, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'left', cellWidth: 78, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 35 },
      6: { halign: 'center', cellWidth: 40, fontStyle: 'bold' },
    },
  });

  // =========================================================================
  // PAGE 2: LEARNING AREA PERFORMANCE MATRIX
  // =========================================================================
  doc.addPage('a4', 'landscape');
  currentY = renderRunningHeader(
    doc,
    school,
    examination,
    result,
    'LEARNING AREA PERFORMANCE COMPARISON'
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('LEARNING AREA PERFORMANCE MATRIX (Standard Curriculum Order)', leftMargin, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Note: Learning Area Means are percentages (%). Difference from Grade is in percentage points (pp). Unassessed areas are marked as "—".',
    leftMargin,
    currentY + 8
  );
  currentY += 10;

  // Dynamic table headers based on streams
  // Dynamic table headers
  const tableHeaders: string[] = ['Code', 'Learning Area'];
  const includeDiffCol = !result.isSingleStream && result.streams.length <= 3;

  result.streams.forEach((st) => {
    tableHeaders.push(`${st.name} Mean %`);
    if (includeDiffCol) {
      tableHeaders.push(`${st.name} Diff`);
    }
    tableHeaders.push(`${st.name} Rank`);
  });
  tableHeaders.push('Grade Mean %');
  tableHeaders.push('Grade Rank');
  if (!result.isSingleStream) {
    tableHeaders.push('Top Stream');
  }

  // Dynamic table rows
  const matrixRows = result.rows.map((row) => {
    const r: string[] = [row.subject_code, row.subject_name];

    result.streams.forEach((st) => {
      const stMeanData = row.stream_means[st.id];
      const meanStr =
        stMeanData && stMeanData.mean_percentage !== null
          ? `${stMeanData.mean_percentage.toFixed(2)}%`
          : '—';
      const diffStr =
        stMeanData && stMeanData.difference_from_grade !== null && stMeanData.difference_from_grade !== undefined
          ? formatDifference(stMeanData.difference_from_grade)
          : '—';
      const rankStr =
        stMeanData && stMeanData.stream_rank !== null && stMeanData.stream_rank !== undefined
          ? `#${stMeanData.stream_rank}`
          : '—';

      r.push(meanStr);
      if (includeDiffCol) {
        r.push(diffStr);
      }
      r.push(rankStr);
    });

    const gradeMeanStr =
      row.grade_overall_mean !== null ? `${row.grade_overall_mean.toFixed(2)}%` : '—';
    const gradeRankStr =
      row.grade_overall_rank !== null && row.grade_overall_rank !== undefined
        ? `#${row.grade_overall_rank}`
        : '—';

    r.push(gradeMeanStr);
    r.push(gradeRankStr);

    if (!result.isSingleStream) {
      const topStreamStr = row.highest_stream_name || (row.is_tie ? 'Tie' : '—');
      r.push(topStreamStr);
    }

    return r;
  });

  // Calculate dynamic column widths to fill contentWidth smoothly
  const streamCount = result.streams.length;
  const colStyles: Record<number, any> = {
    0: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
    1: { halign: 'left', fontStyle: 'bold' }, // auto width
  };

  let colIdx = 2;
  result.streams.forEach(() => {
    colStyles[colIdx] = { halign: 'right', cellWidth: streamCount > 2 ? 20 : 24 }; // Mean %
    if (includeDiffCol) {
      colStyles[colIdx + 1] = { halign: 'right', cellWidth: streamCount > 2 ? 18 : 22 }; // Diff
      colStyles[colIdx + 2] = { halign: 'center', cellWidth: streamCount > 2 ? 15 : 18 }; // Rank
      colIdx += 3;
    } else {
      colStyles[colIdx + 1] = { halign: 'center', cellWidth: streamCount > 2 ? 16 : 20 }; // Rank
      colIdx += 2;
    }
  });

  colStyles[colIdx] = { halign: 'right', cellWidth: streamCount > 2 ? 22 : 26, fontStyle: 'bold' }; // Grade Mean %
  colStyles[colIdx + 1] = { halign: 'center', cellWidth: streamCount > 2 ? 18 : 22, fontStyle: 'bold' }; // Grade Rank
  colIdx += 2;

  if (!result.isSingleStream) {
    colStyles[colIdx] = { halign: 'center', cellWidth: streamCount > 2 ? 22 : 26, fontStyle: 'bold' }; // Top Stream
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: leftMargin },
    head: [tableHeaders],
    body: matrixRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    columnStyles: colStyles,
  });

  // =========================================================================
  // PAGE 3: GRADE-WIDE TOP ACHIEVERS, ANALYTICAL HIGHLIGHTS & SIGNATURES
  // =========================================================================
  doc.addPage('a4', 'landscape');
  currentY = renderRunningHeader(
    doc,
    school,
    examination,
    result,
    'GRADE TOP ACHIEVERS & INSTITUTIONAL SIGNATURES'
  );

  // Section 1: Grade-Wide Top Learners (Whole-Grade Top 3 with Competition Ties)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('GRADE-WIDE TOP ACHIEVERS (Overall Rank ≤ 3)', leftMargin, currentY + 4);
  currentY += 6;

  const gradeTopRows: string[][] = [];
  if (result.topLearnersOverall.length === 0) {
    gradeTopRows.push(['—', '—', 'No assessed learners meeting ranking criteria', '—', '—', '—', '—']);
  } else {
    result.topLearnersOverall.forEach((l) => {
      gradeTopRows.push([
        `#${l.position}`,
        l.admission_number || '—',
        l.student_name,
        l.stream_name || '—',
        l.total_marks.toFixed(1),
        l.average_marks.toFixed(2),
        l.performance_level || '—',
      ]);
    });
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['Grade Rank', 'Adm No', 'Learner Name', 'Stream', 'Total Marks', 'Average Marks', 'Performance Level']],
    body: gradeTopRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 118, 110], // Teal-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'left', cellWidth: 80, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 32 },
      6: { halign: 'center', cellWidth: 34, fontStyle: 'bold' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 2: Analytical Highlights (Strongest & Weakest Learning Areas by Grade Mean)
  const assessedRows = result.rows
    .filter((r) => r.grade_overall_mean !== null)
    .sort((a, b) => (b.grade_overall_mean ?? 0) - (a.grade_overall_mean ?? 0));

  if (assessedRows.length > 0) {
    const strongest = assessedRows.slice(0, Math.min(3, assessedRows.length));
    const weakest = [...assessedRows].reverse().slice(0, Math.min(3, assessedRows.length));

    const halfWidth = (contentWidth - 6) / 2;

    // Strongest Box
    doc.setFillColor(240, 253, 250); // Teal-50
    doc.setDrawColor(153, 246, 228); // Teal-200
    doc.setLineWidth(0.3);
    doc.roundedRect(leftMargin, currentY, halfWidth, 25, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110);
    doc.text('HIGHEST PERFORMING LEARNING AREAS (GRADE MEAN %)', leftMargin + 3, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    let strY = currentY + 10;
    strongest.forEach((s, idx) => {
      const line = `${idx + 1}. ${s.subject_name} (${s.subject_code}): ${s.grade_overall_mean?.toFixed(2)}%`;
      doc.text(line, leftMargin + 3, strY);
      strY += 4.5;
    });

    // Areas Requiring Attention Box
    doc.setFillColor(255, 247, 237); // Orange-50
    doc.setDrawColor(254, 215, 170); // Orange-200
    doc.roundedRect(leftMargin + halfWidth + 6, currentY, halfWidth, 25, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(194, 65, 12); // Orange-700
    doc.text('LEARNING AREAS REQUIRING ATTENTION (LOWEST GRADE MEAN %)', leftMargin + halfWidth + 9, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    let weakY = currentY + 10;
    weakest.forEach((w, idx) => {
      const line = `${idx + 1}. ${w.subject_name} (${w.subject_code}): ${w.grade_overall_mean?.toFixed(2)}%`;
      doc.text(line, leftMargin + halfWidth + 9, weakY);
      weakY += 4.5;
    });

    currentY += 31;
  }

  // Section 3: Official Verification & Signatory Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTITUTIONAL VERIFICATION & AUTHENTICATION', leftMargin, currentY + 2);
  currentY += 5;

  // Build signatories table
  const signatoryRows: string[][] = [];
  result.streams.forEach((st) => {
    signatoryRows.push([
      `Class Teacher (${st.displayName})`,
      st.classTeacherName || 'Class Teacher',
      'Signature: ______________________',
      `Date: ${formatKenyaPdfTimestamp(generatedAt).split(' at ')[0]}`,
    ]);
  });

  signatoryRows.push([
    'Senior Teacher / Deputy Headteacher',
    'Academic Affairs Office',
    'Signature: ______________________',
    'Date: ______________________',
  ]);

  signatoryRows.push([
    'Headteacher / Principal',
    school?.principal_name || 'Headteacher',
    'Official Stamp & Sign: ______________________',
    'Date: ______________________',
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: leftMargin },
    head: [['Office / Role', 'Designation / Name', 'Signature / Stamp', 'Verification Date']],
    body: signatoryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 65 },
      2: { cellWidth: 74 },
      3: { cellWidth: 60, halign: 'center' },
    },
  });

  // 3. Finalize footers on all pages
  renderAllFooters(doc, timestampStr);

  // 4. Save/Download PDF via universal fileDownloader
  const cleanGrade = result.className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExam = getDisplayExamName(examination.exam_name).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Class_Performance_Comparison_${cleanGrade}_${cleanExam}.pdf`;

  await savePdf(doc, fileName);
}
