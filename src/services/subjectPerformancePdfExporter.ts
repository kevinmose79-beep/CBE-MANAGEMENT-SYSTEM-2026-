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
import { getGradeForMark, applyCompetitionRanking } from './analysisEngine';
import { getFilteredStudents } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, formatPercentage, getAbbreviatedLevel } from '../utils/markUtils';
import { formatKenyaPdfTimestamp } from '../utils/kenyaDateUtils';
import { getDisplayExamName } from '../utils/examDisplayUtils';

export interface SubjectPerformancePDFOptions {
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
  allExams?: Examination[];
  generatedBy?: string;
}

// Helper to convert image URL to Base64 for logo
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

// Generate High-Res Canvas Horizontal Bar Chart for Performance Level Distribution
function generateHorizontalBarChartCanvas(levelCounts: Record<string, number>, total: number): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Frame border
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Performance Level Distribution (CBE 8-Point Scale)', 25, 34);

    const levels = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];
    const levelColors: Record<string, string> = {
      EE1: '#047857', // Emerald-700
      EE2: '#10B981', // Emerald-500
      ME1: '#1D4ED8', // Blue-700
      ME2: '#3B82F6', // Blue-500
      AE1: '#B45309', // Amber-700
      AE2: '#F59E0B', // Amber-500
      BE1: '#B91C1C', // Red-700
      BE2: '#EF4444', // Red-500
    };

    const maxCount = Math.max(1, ...levels.map((l) => levelCounts[l] || 0));
    const startX = 70;
    const startY = 55;
    const rowHeight = 30;
    const maxBarWidth = 560;

    levels.forEach((lvl, idx) => {
      const count = levelCounts[lvl] || 0;
      const pct = total > 0 ? String(Math.round((count / total) * 100)) : '0';
      const bWidth = maxCount > 0 ? (count / maxCount) * maxBarWidth : 0;
      const y = startY + idx * rowHeight;

      // Level label
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(lvl, startX - 12, y + 14);

      // Track background
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(startX, y, maxBarWidth, 18, 3);
      } else {
        ctx.rect(startX, y, maxBarWidth, 18);
      }
      ctx.fill();
      ctx.stroke();

      // Active bar
      if (bWidth > 0) {
        ctx.fillStyle = levelColors[lvl] || '#3B82F6';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(startX, y, Math.max(bWidth, 6), 18, 3);
        } else {
          ctx.rect(startX, y, Math.max(bWidth, 6), 18);
        }
        ctx.fill();
      }

      // Value text next to bar
      ctx.fillStyle = count > 0 ? '#0F172A' : '#94A3B8';
      ctx.font = count > 0 ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${count} (${pct}%)`, startX + Math.max(bWidth, 6) + 10, y + 14);
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Failed to render horizontal performance level canvas:', err);
    return null;
  }
}

// Generate Canvas Line Chart for Historical Subject Performance Trend
function generateYearTrendChartCanvas(trendData: Array<{ examName: string; meanPoints: number }>): string | null {
  if (!trendData || trendData.length < 2) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 190;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Frame
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Yearly / Longitudinal Subject Performance Trend (Mean Points)', 25, 30);

    const startX = 65;
    const startY = 150;
    const chartWidth = 690;
    const chartHeight = 95;

    const minY = 1;
    const maxY = 8;

    // Grid lines
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    for (let p = 1; p <= 8; p += 2) {
      const y = startY - ((p - minY) / (maxY - minY)) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${p} Pts`, startX - 8, y + 3);
    }

    const pointsCount = trendData.length;
    const stepX = chartWidth / Math.max(1, pointsCount - 1);

    const coords: Array<{ x: number; y: number; name: string; pts: number }> = [];

    trendData.forEach((item, idx) => {
      const x = startX + idx * stepX;
      const ptsClamped = Math.max(1, Math.min(8, item.meanPoints));
      const y = startY - ((ptsClamped - minY) / (maxY - minY)) * chartHeight;
      coords.push({ x, y, name: item.examName, pts: item.meanPoints });
    });

    // Connecting line
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    coords.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Dots & Labels
    coords.forEach((pt) => {
      ctx.fillStyle = '#1D4ED8';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#1E3A8A';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pt.pts.toFixed(2)} Pts`, pt.x, pt.y - 8);

      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const labelShort = pt.name.length > 18 ? pt.name.slice(0, 16) + '..' : pt.name;
      ctx.fillText(labelShort, pt.x, startY + 16);
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Failed to render trend canvas:', err);
    return null;
  }
}

export async function exportSubjectPerformanceAnalysisPDF(
  options: SubjectPerformancePDFOptions
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
    allExams = [],
    generatedBy = 'Administrator',
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getBase64ImageFromUrl(school.logo_url);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 190mm

  // 1. Filter target students matching selected class & stream context
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  if (!targetStudents || targetStudents.length === 0) {
    throw new Error('No learner records found for the selected assessment, class and subject scope.');
  }

  // 2. Resolve Class, Stream, Education Level, and Subject Teacher
  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;

  const targetClassObj = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  ) || (selectedClassId !== 'all' ? classes.find((c) => c.class_name.toLowerCase() === selectedClassId.toLowerCase()) : undefined);

  const targetStreamObj = classes.find((c) => c.id === selectedStreamId);

  const classNameStr = targetClassObj ? targetClassObj.class_name : (selectedClassId !== 'all' ? selectedClassId : 'All Classes');
  let streamNameStr = 'All Streams';
  if (targetStreamObj && targetStreamObj.stream) {
    streamNameStr = targetStreamObj.stream;
  } else if (targetClassObj && targetClassObj.stream) {
    streamNameStr = targetClassObj.stream;
  } else if (selectedStreamId !== 'all') {
    streamNameStr = selectedStreamId;
  }

  const derivedEduLevel = targetClassObj?.education_level || getEducationLevelForGrade(classNameStr);

  // Assigned Subject Teacher
  const assignedTeacher = teachers.find((t) =>
    (t.allocations || []).some((a) => a.subject_id === subject.id && (selectedClassId === 'all' || a.class_id === selectedClassId))
  ) || teachers.find((t) => (t.allocations || []).some((a) => a.subject_id === subject.id));

  const teacherNameStr = assignedTeacher
    ? (assignedTeacher as any).teacher_name || (assignedTeacher as any).name || (assignedTeacher as any).full_name
    : 'Not Assigned';

  // 3. Process Marks & Ranking using authoritative calculation logic
  const cohortMarksMap = new Map<string, { numericPercentage: number | null; rawScore: number | null; displayStr: string; status: string }>();

  targetStudents.forEach((st) => {
    const mObj = marks.find(
      (m) => String(m.student_id) === String(st.id) && String(m.exam_id) === String(exam.id) && String(m.subject_id) === String(subject.id)
    );
    const evalResult = evaluateMark(mObj);
    cohortMarksMap.set(st.id, {
      numericPercentage: evalResult.status === 'Normal' ? evalResult.percentage : null,
      rawScore: evalResult.status === 'Normal' ? evalResult.rawScore : null,
      displayStr: evalResult.displayPercentage || evalResult.displayScore || '-',
      status: evalResult.status,
    });
  });

  // Rank assessed students in cohort descending by percentage score
  const sortedAssessedCohort = Array.from(cohortMarksMap.entries())
    .filter(([, data]) => data.numericPercentage !== null)
    .sort((a, b) => (b[1].numericPercentage as number) - (a[1].numericPercentage as number));

  const totalAssessedCount = sortedAssessedCohort.length;

  const cohortRanksMap = new Map<string, string>();
  applyCompetitionRanking(
    sortedAssessedCohort,
    (a, b) => Math.round(((a[1].numericPercentage as number) || 0) * 10) === Math.round(((b[1].numericPercentage as number) || 0) * 10),
    (entry, rank) => {
      cohortRanksMap.set(entry[0], `${rank} / ${targetStudents.length}`);
    }
  );

  // Evaluated learner roster records
  interface LearnerRosterRow {
    student: Student;
    streamName: string;
    rawScoreStr: string;
    percentageStr: string;
    numericPercentage: number | null;
    gradeCode: string;
    points: number;
    performanceLevel: string;
    positionStr: string;
    isAssessed: boolean;
  }

  const assessedRows: LearnerRosterRow[] = [];
  const unassessedRows: LearnerRosterRow[] = [];

  targetStudents.forEach((st) => {
    const markData = cohortMarksMap.get(st.id);
    const hist = exam ? getLearnerClassAtExamTime(st, exam, classes) : null;
    const stClassObj = classes.find((c) => c.id === (hist ? hist.class_id : st.class_id));
    const stStreamName = stClassObj?.stream || hist?.stream_name || 'Main';

    if (markData && markData.status === 'Normal' && markData.numericPercentage !== null) {
      const numPct = markData.numericPercentage;
      const gr = getGradeForMark(numPct, grades);
      const grCode = gr.grade_code || gr.grade || 'ME2';
      const pts = gr.points ?? 5;
      const perfLvl = gr.descriptor || gr.performance_level || 'Meeting Expectations';
      const posStr = cohortRanksMap.get(st.id) || `- / ${targetStudents.length}`;
      const rawStr = markData.rawScore !== null ? `${Math.round(markData.rawScore)}` : `${formatPercentage(numPct, true)}`;

      assessedRows.push({
        student: st,
        streamName: stStreamName,
        rawScoreStr: rawStr,
        percentageStr: formatPercentage(numPct, true),
        numericPercentage: numPct,
        gradeCode: grCode,
        points: pts,
        performanceLevel: perfLvl,
        positionStr: posStr,
        isAssessed: true,
      });
    } else {
      const dispStr = markData?.displayStr || '-';
      unassessedRows.push({
        student: st,
        streamName: stStreamName,
        rawScoreStr: dispStr,
        percentageStr: '-',
        numericPercentage: null,
        gradeCode: dispStr,
        points: 0,
        performanceLevel: markData?.status === 'Absent' ? 'Absent' : markData?.status === 'Irregularity' ? 'Irregularity' : 'Unassessed',
        positionStr: '-',
        isAssessed: false,
      });
    }
  });

  // Sort assessed learners descending by percentage score
  assessedRows.sort((a, b) => (b.numericPercentage || 0) - (a.numericPercentage || 0));
  const fullRoster = [...assessedRows, ...unassessedRows];

  // 4. Class Summary Metrics Calculations
  const validScores = assessedRows.map((r) => r.numericPercentage as number);
  const sumPercentage = validScores.reduce((a, b) => a + b, 0);
  const avgPercentage = totalAssessedCount > 0 ? Math.round(sumPercentage / totalAssessedCount) : 0;

  const sumPoints = assessedRows.reduce((a, b) => a + b.points, 0);
  const avgPoints = totalAssessedCount > 0 ? sumPoints / totalAssessedCount : 0;

  const highestScoreNum = validScores.length > 0 ? Math.round(Math.max(...validScores)) : 0;
  const lowestScoreNum = validScores.length > 0 ? Math.round(Math.min(...validScores)) : 0;

  const overallGradeObj = getGradeForMark(avgPercentage, grades);
  const overallGradeCode = overallGradeObj.grade_code || overallGradeObj.grade || 'ME2';
  const overallLevelName = overallGradeObj.descriptor || overallGradeObj.performance_level || 'Meeting Expectations';

  // 5. Performance Level Counts (EE1 to BE2)
  const levelCounts: Record<string, number> = {
    EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0,
  };

  assessedRows.forEach((r) => {
    const code = r.gradeCode.toUpperCase();
    if (levelCounts[code] !== undefined) {
      levelCounts[code]++;
    } else if (code.startsWith('EE')) levelCounts['EE2']++;
    else if (code.startsWith('ME')) levelCounts['ME2']++;
    else if (code.startsWith('AE')) levelCounts['AE2']++;
    else if (code.startsWith('BE')) levelCounts['BE2']++;
  });

  // 6. Streams Breakdown Data
  const classStreams = classes.filter(
    (c) => c.class_name.toLowerCase() === classNameStr.toLowerCase() || c.id === selectedClassId
  );

  interface StreamBreakdownRow {
    streamName: string;
    levelCounts: Record<string, number>;
    entryCount: number;
    xCount: number;
    yCount: number;
    avgMarkPct: string;
    avgPointsStr: string;
    overallLevelCode: string;
  }

  const streamBreakdownList: StreamBreakdownRow[] = [];
  const streamsToProcess = classStreams.length > 0 ? classStreams : [{ id: selectedClassId, stream: streamNameStr, class_name: classNameStr } as ClassStream];

  streamsToProcess.forEach((stObj) => {
    const stStudents = targetStudents.filter((s) => s.class_id === stObj.id);
    if (stStudents.length === 0 && selectedStreamId !== 'all' && stObj.id !== selectedStreamId) return;

    const stLevelCounts: Record<string, number> = { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
    let stXCount = 0;
    let stYCount = 0;
    let stSumPct = 0;
    let stSumPts = 0;
    let stAssessed = 0;

    stStudents.forEach((st) => {
      const markData = cohortMarksMap.get(st.id);
      if (markData?.status === 'Normal' && markData.numericPercentage !== null) {
        const numPct = markData.numericPercentage;
        const gr = getGradeForMark(numPct, grades);
        const grCode = (gr.grade_code || gr.grade || 'ME2').toUpperCase();
        if (stLevelCounts[grCode] !== undefined) {
          stLevelCounts[grCode]++;
        } else if (grCode.startsWith('EE')) stLevelCounts['EE2']++;
        else if (grCode.startsWith('ME')) stLevelCounts['ME2']++;
        else if (grCode.startsWith('AE')) stLevelCounts['AE2']++;
        else if (grCode.startsWith('BE')) stLevelCounts['BE2']++;

        stSumPct += numPct;
        stSumPts += gr.points ?? 5;
        stAssessed++;
      } else if (markData?.status === 'X') {
        stXCount++;
      } else if (markData?.status === 'Y') {
        stYCount++;
      }
    });

    const stAvgPct = stAssessed > 0 ? stSumPct / stAssessed : 0;
    const stAvgPts = stAssessed > 0 ? stSumPts / stAssessed : 0;
    const stGradeObj = getGradeForMark(stAvgPct, grades);

    streamBreakdownList.push({
      streamName: stObj.stream || stObj.class_name || 'Main',
      levelCounts: stLevelCounts,
      entryCount: stStudents.length,
      xCount: stXCount,
      yCount: stYCount,
      avgMarkPct: stAssessed > 0 ? formatPercentage(stAvgPct, true) : '-',
      avgPointsStr: stAssessed > 0 ? stAvgPts.toFixed(2) : '-',
      overallLevelCode: stAssessed > 0 ? stGradeObj.grade_code || 'ME2' : '-',
    });
  });

  // 7. Historical Assessment Trend Collection
  const trendData: Array<{ examName: string; meanPoints: number }> = [];
  if (allExams && allExams.length > 1) {
    const sortedExams = [...allExams].sort((a, b) => a.year - b.year || a.term.localeCompare(b.term));
    sortedExams.forEach((ex) => {
      let exSumPts = 0;
      let exValidCount = 0;

      targetStudents.forEach((st) => {
        const mObj = marks.find(
          (m) => String(m.student_id) === String(st.id) && String(m.exam_id) === String(ex.id) && String(m.subject_id) === String(subject.id)
        );
        const evalRes = evaluateMark(mObj);
        if (evalRes.status === 'Normal' && evalRes.percentage !== null) {
          const gr = getGradeForMark(evalRes.percentage, grades);
          exSumPts += gr.points ?? 5;
          exValidCount++;
        }
      });

      if (exValidCount > 0) {
        trendData.push({
          examName: getDisplayExamName(ex.exam_name),
          meanPoints: Math.round((exSumPts / exValidCount) * 100) / 100,
        });
      }
    });
  }

  // Header Renderer Function
  const renderPDFHeader = () => {
    let currentY = 6;
    const headerBoxHeight = 28;

    // Header Frame Box
    doc.setDrawColor(30, 41, 59); // Slate-800
    doc.setLineWidth(0.3);
    doc.rect(marginX, currentY, contentWidth, headerBoxHeight);

    // Optional Logo
    const logoSize = 20;
    const logoX = marginX + 3.5;
    const logoY = currentY + 4;

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch {
        // Fallback
      }
    }

    const textCenterX = marginX + contentWidth / 2;

    // School Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text((school.school_name || 'MUCHORWE JUNIOR SCHOOL').toUpperCase(), textCenterX, currentY + 6.5, { align: 'center' });

    // Document Subtitle / Report Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 58, 138); // Navy / Blue-900
    doc.text(`SUBJECT PERFORMANCE ANALYSIS — ${subject.subject_name.toUpperCase()}`, textCenterX, textCenterX ? currentY + 12.5 : currentY + 12.5, { align: 'center' });

    // Structured Key-Value Metadata Grid
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // Slate-700

    const line1 = `Education Level: ${derivedEduLevel}  |  Class: ${classNameStr}  |  Stream: ${streamNameStr}  |  Learning Area: ${subject.subject_name} (${subject.subject_code})`;
    doc.text(line1, textCenterX, currentY + 18, { align: 'center' });

    const line2 = `Assessment: ${getDisplayExamName(exam.exam_name)}  |  Term: ${exam.term}  |  Academic Year: ${exam.year}  |  Subject Teacher: ${teacherNameStr}`;
    doc.text(line2, textCenterX, currentY + 23.5, { align: 'center' });
  };

  // Draw Page 1 Header
  renderPDFHeader();

  let currentY = 38;

  // 8. Class Performance Summary Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PERFORMANCE OVERALL METRICS & SUMMARY', marginX, currentY);
  currentY += 3;

  const summaryCardsBody = [
    [
      'Class Average',
      'Average Points',
      'Overall Level',
      'Highest Mark',
      'Lowest Mark',
      'Total Learners',
    ],
    [
      formatPercentage(avgPercentage, true),
      `${avgPoints.toFixed(2)} Pts`,
      `${overallGradeCode} (${getAbbreviatedLevel(overallLevelName, overallGradeCode)})`,
      formatPercentage(highestScoreNum, true),
      formatPercentage(lowestScoreNum, true),
      `${targetStudents.length}`,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    body: summaryCardsBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
    bodyStyles: { textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [239, 246, 255] },
      1: { fontStyle: 'bold', fillColor: [240, 253, 244] },
      2: { fontStyle: 'bold', fillColor: [254, 243, 199] },
      3: { fontStyle: 'bold', textColor: [5, 150, 105] },
      4: { fontStyle: 'bold', textColor: [220, 38, 38] },
      5: { fontStyle: 'bold', fillColor: [248, 250, 252] },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 9. Performance Level Distribution Chart & Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. PERFORMANCE LEVEL DISTRIBUTION (CBE 8-POINT SCALE)', marginX, currentY);
  currentY += 3;

  const horizChartBase64 = generateHorizontalBarChartCanvas(levelCounts, totalAssessedCount);

  if (horizChartBase64) {
    doc.addImage(horizChartBase64, 'PNG', marginX, currentY, 115, 48);
  }

  // Performance Level Summary Table beside horizontal chart
  const perfLevelTableBody = [
    ['EE1', `${levelCounts['EE1']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['EE1'] / totalAssessedCount) * 100, true) : '0%'],
    ['EE2', `${levelCounts['EE2']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['EE2'] / totalAssessedCount) * 100, true) : '0%'],
    ['ME1', `${levelCounts['ME1']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['ME1'] / totalAssessedCount) * 100, true) : '0%'],
    ['ME2', `${levelCounts['ME2']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['ME2'] / totalAssessedCount) * 100, true) : '0%'],
    ['AE1', `${levelCounts['AE1']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['AE1'] / totalAssessedCount) * 100, true) : '0%'],
    ['AE2', `${levelCounts['AE2']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['AE2'] / totalAssessedCount) * 100, true) : '0%'],
    ['BE1', `${levelCounts['BE1']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['BE1'] / totalAssessedCount) * 100, true) : '0%'],
    ['BE2', `${levelCounts['BE2']}`, totalAssessedCount > 0 ? formatPercentage((levelCounts['BE2'] / totalAssessedCount) * 100, true) : '0%'],
    [{ content: 'TOTAL ASSESSED', styles: { fontStyle: 'bold' } }, `${totalAssessedCount}`, '100%'],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX + 118, right: marginX },
    head: [['Level', 'Learners', '%']],
    body: perfLevelTableBody as any,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 1.1 },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
    },
  });

  currentY = Math.max(currentY + 50, (doc as any).lastAutoTable.finalY + 6);

  // 10. Performance Level Breakdown Matrix Table across streams
  if (currentY + 35 > pageHeight - 15) {
    doc.addPage();
    renderPDFHeader();
    currentY = 38;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. PERFORMANCE LEVEL BREAKDOWN MATRIX BY STREAM', marginX, currentY);
  currentY += 3;

  const breakdownHead = [['Stream', 'EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2', 'Entry', 'X', 'Y', 'Avg Marks', 'Points', 'Level']];

  const breakdownBody = streamBreakdownList.map((stRow) => [
    stRow.streamName,
    stRow.levelCounts['EE1'],
    stRow.levelCounts['EE2'],
    stRow.levelCounts['ME1'],
    stRow.levelCounts['ME2'],
    stRow.levelCounts['AE1'],
    stRow.levelCounts['AE2'],
    stRow.levelCounts['BE1'],
    stRow.levelCounts['BE2'],
    stRow.entryCount,
    stRow.xCount,
    stRow.yCount,
    stRow.avgMarkPct,
    stRow.avgPointsStr,
    stRow.overallLevelCode,
  ]);

  // Add CLASS OVERALL row if multiple streams exist
  if (streamBreakdownList.length > 1) {
    breakdownBody.push([
      'CLASS OVERALL',
      levelCounts['EE1'],
      levelCounts['EE2'],
      levelCounts['ME1'],
      levelCounts['ME2'],
      levelCounts['AE1'],
      levelCounts['AE2'],
      levelCounts['BE1'],
      levelCounts['BE2'],
      targetStudents.length,
      targetStudents.filter((s) => cohortMarksMap.get(s.id)?.status === 'X').length,
      targetStudents.filter((s) => cohortMarksMap.get(s.id)?.status === 'Y').length,
      formatPercentage(avgPercentage, true),
      avgPoints.toFixed(2),
      overallGradeCode,
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: breakdownHead,
    body: breakdownBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 1.5, halign: 'center' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 24 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 11. Yearly / Longitudinal Performance Trend Section
  const trendChartBase64 = generateYearTrendChartCanvas(trendData);
  if (trendChartBase64) {
    if (currentY + 45 > pageHeight - 15) {
      doc.addPage();
      renderPDFHeader();
      currentY = 38;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4. YEARLY PERFORMANCE TREND', marginX, currentY);
    currentY += 3;

    doc.addImage(trendChartBase64, 'PNG', marginX, currentY, contentWidth, 42);
    currentY += 46;
  }

  // 12. Student Performance Roster Section
  if (currentY + 45 > pageHeight - 15) {
    doc.addPage();
    renderPDFHeader();
    currentY = 38;
  }

  const sectionNumRoster = trendChartBase64 ? '5' : '4';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sectionNumRoster}. STUDENT PERFORMANCE ROSTER (${fullRoster.length} LEARNERS)`, marginX, currentY);
  currentY += 3;

  const rosterHead = [['No.', 'Adm No.', 'Student Name', 'Stream', 'Marks', '%', 'Grade', 'Points', 'Level', 'Position']];

  const rosterBody = fullRoster.map((row, idx) => [
    idx + 1,
    row.student.admission_number || '-',
    (row.student.full_name || '').toUpperCase(),
    row.streamName,
    row.rawScoreStr,
    row.percentageStr,
    row.gradeCode,
    row.isAssessed ? row.points : '-',
    getAbbreviatedLevel(row.performanceLevel, row.gradeCode),
    row.positionStr,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 38, bottom: 12 },
    head: rosterHead,
    body: rosterBody,
    theme: 'grid',
    showHead: 'everyPage',
    styles: { fontSize: 7.5, cellPadding: 1.2, textColor: [30, 41, 59], valign: 'middle' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 20 },
      2: { halign: 'left', cellWidth: 46 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        renderPDFHeader();
      }
    },
  });

  // 13. Dynamic Footers & Page Numbering across all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  const timestampStr = formatKenyaPdfTimestamp(new Date());

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 6;

    // Divider line above footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 2.5, marginX + contentWidth, footerY - 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Report generated on: ${timestampStr}`, marginX, footerY);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, footerY, { align: 'right' });
  }

  // Save PDF file
  const cleanSubjectCode = (subject.subject_code || subject.subject_name).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClassName = classNameStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExamName = (getDisplayExamName(exam.exam_name) || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Subject_Performance_${cleanSubjectCode}_${cleanClassName}_${cleanExamName}.pdf`;

  await savePdf(doc, fileName);
}
