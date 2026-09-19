import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { School, Examination } from '../types';
import { SchoolAnalyticsData, ExaminationComparisonData } from './schoolAnalyticsEngine';
import { formatPercentage, getAbbreviatedLevel } from '../utils/markUtils';
import { savePdf } from '../utils/fileDownloader';
import { getDisplayExamName } from '../utils/examDisplayUtils';

async function getBase64ImageFromUrl(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) return null;
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Failed to load image for PDF export:', err);
    return null;
  }
}

function renderHeader(
  doc: jsPDF,
  school: School,
  reportTitle: string,
  subTitle: string,
  logoBase64: string | null
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Outer frame
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 51, 102);
  doc.rect(8, 8, pageWidth - 16, 26);

  let textLeftMargin = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', 12, 10, 22, 22);
      textLeftMargin = 38;
    } catch {
      // ignore logo failure
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 51, 102);
  doc.text((school.school_name || 'School Name Not Configured').toUpperCase(), textLeftMargin, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(reportTitle.toUpperCase(), textLeftMargin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(subTitle, textLeftMargin, 28);
}

function renderFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const nowStr = new Date().toLocaleString();
  doc.text(
    `Official School Performance Report • Generated on: ${nowStr} • Page ${pageNum} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );
}

// 1. CLASS RANKING PDF
export async function exportClassRankingPDF(data: SchoolAnalyticsData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    `${data.education_level_title || 'Class Performance Ranking'} - Class Rankings`,
    `Exam: ${getDisplayExamName(data.exam.exam_name)} (${data.exam.term} ${data.exam.year}) • Max Marks: ${data.max_obtainable_marks} • Total Classes: ${data.total_classes_count} • Assessed Learners: ${data.total_students_assessed}`,
    logo
  );

  const tableData = data.class_rankings.map((c) => [
    c.rank,
    c.class_name,
    c.learners_count,
    Math.round(c.mean_marks),
    `${Math.round(c.mean_percentage)}%`,
    c.mean_points.toFixed(2),
    `${c.overall_level} (${c.grade_code})`,
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Class Name', 'Learners', 'Class Average Marks', 'Mean %', 'Mean Points', 'Overall Level']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Class_Ranking_Report_${(data.education_level_title || 'Level').replace(/\s+/g, '_')}_${(getDisplayExamName(data.exam.exam_name) || 'Exam').replace(/\s+/g, '_')}.pdf`);
}

// 2. STREAM RANKING PDF
export async function exportStreamRankingPDF(data: SchoolAnalyticsData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    `${data.education_level_title || 'Stream Performance Ranking'} - Stream Rankings`,
    `Exam: ${getDisplayExamName(data.exam.exam_name)} (${data.exam.term} ${data.exam.year}) • Max Marks: ${data.max_obtainable_marks} • Total Streams: ${data.total_streams_count} • Assessed Learners: ${data.total_students_assessed}`,
    logo
  );

  const tableData = data.stream_rankings.map((st) => [
    st.rank,
    st.full_name,
    st.class_name,
    st.stream || 'Main',
    st.learners_count,
    Math.round(st.mean_marks),
    `${Math.round(st.mean_percentage)}%`,
    st.mean_points.toFixed(2),
    `${st.overall_level} (${st.grade_code})`,
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Stream Name', 'Class', 'Stream', 'Learners', 'Class Average Marks', 'Mean %', 'Mean Points', 'Overall Level']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center', fontStyle: 'bold' },
      8: { halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Stream_Ranking_Report_${(data.education_level_title || 'Level').replace(/\s+/g, '_')}_${(getDisplayExamName(data.exam.exam_name) || 'Exam').replace(/\s+/g, '_')}.pdf`);
}

// 3. SUBJECT ANALYSIS PDF
export async function exportSubjectAnalysisPDF(data: SchoolAnalyticsData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Subject Performance Analysis Report',
    `Exam: ${getDisplayExamName(data.exam.exam_name)} (${data.exam.term} ${data.exam.year}) • School-Wide Learning Areas Performance`,
    logo
  );

  const tableData = data.subject_rankings.map((sb) => [
    sb.rank,
    sb.subject_name,
    sb.subject_code,
    sb.category,
    sb.total_candidates,
    Math.round(sb.mean_marks),
    formatPercentage(sb.mean_percentage, true),
    sb.mean_points.toFixed(2),
    `${sb.overall_level} (${sb.grade_code})`,
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Subject Name', 'Code', 'Category', 'Candidates', 'Mean Marks', 'Mean %', 'Mean Points', 'Overall Level']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center', fontStyle: 'bold' },
      8: { halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Subject_Analysis_Report_${(getDisplayExamName(data.exam.exam_name) || 'Exam').replace(/\s+/g, '_')}.pdf`);
}

// 4. SCHOOL PERFORMANCE REPORT PDF
export async function exportSchoolPerformancePDF(data: SchoolAnalyticsData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Comprehensive School Performance Summary',
    `Exam: ${getDisplayExamName(data.exam.exam_name)} (${data.exam.term} ${data.exam.year}) • Official Executive Analytics Summary`,
    logo
  );

  let currentY = 38;

  // Executive Metric Cards Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(8, currentY, doc.internal.pageSize.getWidth() - 16, 28, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE PERFORMANCE HIGHLIGHTS', 12, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Overall School Mean Score: ${Math.round(data.overall_school_mean)}`, 12, currentY + 12);
  doc.text(`Overall School Mean Points: ${data.overall_school_mean_points.toFixed(2)}`, 12, currentY + 17);
  doc.text(`Overall CBE Performance Level: ${data.overall_school_level} (${data.overall_school_grade_code})`, 12, currentY + 22);

  doc.text(`Total Learners Assessed: ${data.total_students_assessed}`, 110, currentY + 12);
  doc.text(`Highest Performing Class: ${data.highest_performing_class}`, 110, currentY + 17);
  doc.text(`Highest Performing Stream: ${data.highest_performing_stream}`, 110, currentY + 22);

  currentY += 34;

  // Table 1: Class Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('1. Class Performance Overview', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Class', 'Learners', 'Mean Marks', 'Mean %', 'Mean Points', 'Overall Level']],
    body: data.class_rankings.map((c) => [
      c.rank,
      c.class_name,
      c.learners_count,
      Math.round(c.mean_marks),
      formatPercentage(c.mean_percentage, true),
      c.mean_points.toFixed(2),
      `${c.overall_level} (${c.grade_code})`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Top Subjects
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('2. Subject Performance Standings', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Subject', 'Code', 'Candidates', 'Mean Marks', 'Mean %', 'Mean Points', 'Level']],
    body: data.subject_rankings.map((s) => [
      s.rank,
      s.subject_name,
      s.subject_code,
      s.total_candidates,
      Math.round(s.mean_marks),
      formatPercentage(s.mean_percentage, true),
      s.mean_points.toFixed(2),
      `${s.overall_level} (${s.grade_code})`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `School_Performance_Report_${data.exam.exam_name.replace(/\s+/g, '_')}.pdf`);
}

// 5. BEST LEARNERS REPORT PDF
export async function exportBestLearnersPDF(data: SchoolAnalyticsData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Best Learners & Top Performers Report',
    `Exam: ${data.exam.exam_name} (${data.exam.term} ${data.exam.year}) • School-Wide Academic Excellence`,
    logo
  );

  const tableData = data.best_learners_school.map((l) => [
    l.rank,
    l.name,
    l.admission_number || '-',
    l.class_name,
    l.stream || '-',
    l.total_marks.toLocaleString(),
    formatPercentage(l.average_marks, true),
    l.average_points.toFixed(2),
    `${getAbbreviatedLevel(l.overall_level, l.grade_code)} (${l.grade_code})`,
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: 8, right: 8, top: 35, bottom: 12 },
    head: [['Pos', 'Learner Name', 'Adm No', 'Class', 'Stream', 'Total Marks', 'Mean Score', 'Mean Points', 'Overall Level']],
    body: tableData,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', valign: 'middle', minCellHeight: 6 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 }, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      1: { halign: 'left', fontStyle: 'normal' }, // Learner Name NOT bold
      2: { halign: 'left', cellWidth: 22 }, // Adm No left aligned
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      8: { halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204], cellWidth: 24 },
    },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Best_Learners_Report_${data.exam.exam_name.replace(/\s+/g, '_')}.pdf`);
}

// 6. EXAMINATION COMPARISON REPORT PDF
export async function exportExamComparisonPDF(comp: ExaminationComparisonData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Examination Comparative Analysis',
    `Comparing: ${comp.examA.exam_name} (Current) VS ${comp.examB.exam_name} (Previous)`,
    logo
  );

  let currentY = 38;

  // Comparison Summary Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(8, currentY, doc.internal.pageSize.getWidth() - 16, 26, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('EXAM COMPARISON METRICS SUMMARY', 12, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`School Mean Diff: ${comp.school_deviation.diff_mean > 0 ? '+' : ''}${comp.school_deviation.diff_mean.toFixed(2)} marks (${formatPercentage(comp.school_deviation.percentage_change, true)})`, 12, currentY + 12);
  doc.text(`School Mean Points Diff: ${comp.school_deviation.diff_points > 0 ? '+' : ''}${comp.school_deviation.diff_points.toFixed(2)} pts`, 12, currentY + 17);
  doc.text(`School Competency Trend: ${comp.school_deviation.trend}`, 12, currentY + 22);

  doc.text(`Most Improved Class: ${comp.most_improved_class}`, 110, currentY + 12);
  doc.text(`Most Improved Stream: ${comp.most_improved_stream}`, 110, currentY + 17);
  doc.text(`Most Improved Learner: ${comp.most_improved_learner}`, 110, currentY + 22);

  currentY += 32;

  // Class Comparative Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 51, 102);
  doc.text('Class Mean Comparison', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Class Name', 'Current Mean', 'Previous Mean', 'Mean Diff', '% Change', 'Pts Diff', 'Trend']],
    body: comp.class_deviations.map((d) => [
      d.name,
      d.current_mean.toFixed(2),
      d.previous_mean.toFixed(2),
      `${d.diff_mean > 0 ? '+' : ''}${d.diff_mean.toFixed(2)}`,
      `${d.percentage_change > 0 ? '+' : ''}${formatPercentage(d.percentage_change, true)}`,
      `${d.diff_points > 0 ? '+' : ''}${d.diff_points.toFixed(2)}`,
      d.trend,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center', fontStyle: 'bold' },
    },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Exam_Comparison_${comp.examA.exam_name.replace(/\s+/g, '_')}_vs_${comp.examB.exam_name.replace(/\s+/g, '_')}.pdf`);
}

// 7. PERFORMANCE DEVIATION REPORT PDF
export async function exportPerformanceDeviationPDF(comp: ExaminationComparisonData, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Performance Deviations & Trends Report',
    `Tracking Gains & Declines: ${comp.examA.exam_name} vs ${comp.examB.exam_name}`,
    logo
  );

  let currentY = 38;

  // Stream Deviations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 51, 102);
  doc.text('1. Stream Deviations', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Stream', 'Current Mean', 'Previous Mean', 'Difference', '% Change', 'Level Change', 'Trend']],
    body: comp.stream_deviations.map((d) => [
      d.name,
      d.current_mean.toFixed(2),
      d.previous_mean.toFixed(2),
      `${d.diff_mean > 0 ? '+' : ''}${d.diff_mean.toFixed(2)}`,
      `${d.percentage_change > 0 ? '+' : ''}${formatPercentage(d.percentage_change, true)}`,
      `${d.previous_level} → ${d.current_level}`,
      d.trend,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Subject Deviations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 51, 102);
  doc.text('2. Subject Performance Deviations', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Subject', 'Current Mean %', 'Previous Mean %', 'Difference', '% Change', 'Level Change', 'Trend']],
    body: comp.subject_deviations.map((d) => [
      d.name,
      formatPercentage(d.current_mean, true),
      formatPercentage(d.previous_mean, true),
      `${d.diff_mean > 0 ? '+' : ''}${formatPercentage(d.diff_mean, true)}`,
      `${d.percentage_change > 0 ? '+' : ''}${formatPercentage(d.percentage_change, true)}`,
      `${d.previous_level} → ${d.current_level}`,
      d.trend,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Performance_Deviations_${comp.examA.exam_name.replace(/\s+/g, '_')}_vs_${comp.examB.exam_name.replace(/\s+/g, '_')}.pdf`);
}


export async function exportComprehensiveAnalyticsPDF(data: SchoolAnalyticsData, comp: ExaminationComparisonData | null, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Comprehensive School Performance Report',
    `Exam: ${data.exam.exam_name} (${data.exam.term} ${data.exam.year}) • Official Analytics`,
    logo
  );

  let currentY = 38;

  // --- Executive Dashboard ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(8, currentY, doc.internal.pageSize.getWidth() - 16, 28, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE PERFORMANCE HIGHLIGHTS', 12, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Overall School Mean Score: ${data.overall_school_mean.toFixed(2)}`, 12, currentY + 12);
  doc.text(`Overall School Mean Points: ${data.overall_school_mean_points.toFixed(2)}`, 12, currentY + 17);
  doc.text(`Overall CBE Performance Level: ${data.overall_school_level} (${data.overall_school_grade_code})`, 12, currentY + 22);

  doc.text(`Total Learners Assessed: ${data.total_students_assessed}`, 110, currentY + 12);
  doc.text(`Highest Performing Class: ${data.highest_performing_class}`, 110, currentY + 17);
  doc.text(`Highest Performing Stream: ${data.highest_performing_stream}`, 110, currentY + 22);

  currentY += 34;

  // --- Class & Stream Rankings ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('1. Class Performance Overview', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Class', 'Learners', 'Mean Marks', 'Mean %', 'Mean Points', 'Overall Level']],
    body: data.class_rankings.map((c) => [
      c.rank,
      c.class_name,
      c.learners_count,
      Math.round(c.mean_marks),
      formatPercentage(c.mean_percentage, true),
      c.mean_points.toFixed(2),
      `${c.overall_level} (${c.grade_code})`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  if (data.stream_rankings.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 51, 102);
    doc.text('2. Stream Performance Standings', 8, currentY);

    autoTable(doc, {
      startY: currentY + 2,
      margin: { left: 8, right: 8 },
      head: [['Rank', 'Class', 'Stream', 'Candidates', 'Mean Marks', 'Mean %', 'Mean Points', 'Level']],
      body: data.stream_rankings.map((st) => [
        st.rank,
        st.class_name,
        st.stream || 'Main',
        st.learners_count,
        Math.round(st.mean_marks),
        formatPercentage(st.mean_percentage, true),
        st.mean_points.toFixed(2),
        `${st.overall_level} (${st.grade_code})`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- Subject Analysis ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('3. Subject Performance Standings', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Subject', 'Code', 'Candidates', 'Mean Marks', 'Mean %', 'Mean Points', 'Level']],
    body: data.subject_rankings.map((s) => [
      s.rank,
      s.subject_name,
      s.subject_code,
      s.total_candidates,
      Math.round(s.mean_marks),
      formatPercentage(s.mean_percentage, true),
      s.mean_points.toFixed(2),
      `${s.overall_level} (${s.grade_code})`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;
  
  if (currentY > doc.internal.pageSize.getHeight() - 30) {
     doc.addPage();
     currentY = 15;
  }

  // --- Top Performers & Best Learners ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('4. Best Learners & Top Performers', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Name', 'Adm No', 'Class', 'Stream', 'Total', 'Mean %', 'Points', 'Level']],
    body: data.best_learners_school.map((l) => [
      l.rank,
      l.name,
      l.admission_number || '-',
      l.class_name,
      l.stream || '-',
      l.total_marks.toLocaleString(),
      formatPercentage(l.average_marks, true),
      l.average_points.toFixed(2),
      `${getAbbreviatedLevel(l.overall_level, l.grade_code)} (${l.grade_code})`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;
  
  if (currentY > doc.internal.pageSize.getHeight() - 40) {
     doc.addPage();
     currentY = 15;
  }

  // --- Examination Comparison & Trends ---
  if (comp) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 51, 102);
    doc.text(`5. Comparison: ${getDisplayExamName(comp.examA.exam_name)} vs ${getDisplayExamName(comp.examB.exam_name)}`, 8, currentY);
    
    // Summary
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(8, currentY + 3, doc.internal.pageSize.getWidth() - 16, 18, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`School Mean Diff: ${comp.school_deviation.diff_mean > 0 ? '+' : ''}${comp.school_deviation.diff_mean.toFixed(2)} marks (${formatPercentage(comp.school_deviation.percentage_change, true)})`, 12, currentY + 9);
    doc.text(`School Mean Points Diff: ${comp.school_deviation.diff_points > 0 ? '+' : ''}${comp.school_deviation.diff_points.toFixed(2)} pts`, 12, currentY + 14);
    doc.text(`School Competency Trend: ${comp.school_deviation.trend}`, 12, currentY + 19);

    currentY += 26;

    // Class Comparative Table
    autoTable(doc, {
      startY: currentY,
      margin: { left: 8, right: 8 },
      head: [['Class', 'Current Mean', 'Prev Mean', 'Diff', '% Change', 'Points Diff', 'Trend']],
      body: comp.class_deviations.map((c) => [
        c.name,
        c.current_mean.toFixed(2),
        c.previous_mean.toFixed(2),
        `${c.diff_mean > 0 ? '+' : ''}${c.diff_mean.toFixed(2)}`,
        formatPercentage(c.percentage_change, true),
        `${c.diff_points > 0 ? '+' : ''}${c.diff_points.toFixed(2)}`,
        c.trend,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    });
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  await savePdf(doc, `Comprehensive_Analytics_${(getDisplayExamName(data.exam.exam_name) || 'Exam').replace(/\s+/g, '_')}.pdf`);
}
