import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Layers,
  BookOpen,
  X,
  Printer,
  Award,
  Trophy,
  Medal,
  Users,
  Download,
  Loader2,
} from 'lucide-react';
import {
  Student,
  School,
  ClassStream,
  Examination,
  Subject,
  Mark,
  Grade,
  Teacher,
} from '../types';
import {
  generateClassPerformanceComparison,
  ClassPerformanceComparisonResult,
  StreamVsGradeRow,
} from '../services/classComparisonEngine';
import { exportClassPerformanceComparisonPDF } from '../services/classComparisonPdfExporter';

interface ClassPerformanceComparisonViewProps {
  examination: Examination;
  selectedClassIdOrName: string;
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  school?: School;
}

export const ClassPerformanceComparisonView: React.FC<ClassPerformanceComparisonViewProps> = ({
  examination,
  selectedClassIdOrName,
  students,
  classes,
  subjects,
  marks,
  grades,
  teachers,
  school,
}) => {
  const [viewMetric, setViewMetric] = useState<'mean' | 'difference' | 'rank'>('mean');
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<StreamVsGradeRow | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Authoritative calculation of class performance comparison
  const comparisonData: ClassPerformanceComparisonResult = useMemo(() => {
    return generateClassPerformanceComparison(
      examination,
      selectedClassIdOrName,
      students,
      classes,
      subjects,
      marks,
      grades,
      teachers
    );
  }, [examination, selectedClassIdOrName, students, classes, subjects, marks, grades, teachers]);

  const {
    className,
    isSingleStream,
    streams,
    aggregateComparison,
    rows,
    gradeTotalLearners,
    hasAnyAssessed,
    topLearnersOverall,
  } = comparisonData;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await exportClassPerformanceComparisonPDF({
        result: comparisonData,
        school,
        examination,
        teachers,
      });
    } catch (err) {
      console.error('Failed to export Class Performance Comparison PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formatPercentageVal = (val: number | null): string => {
    if (val === null || val === undefined) return '—';
    return `${val.toFixed(2)}%`;
  };

  const formatAverageMarks = (val: number | null): string => {
    if (val === null || val === undefined) return '—';
    return val.toFixed(2);
  };

  const formatDifferenceVal = (diff: number | null): string => {
    if (diff === null || diff === undefined) return '—';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)} pp`;
  };

  return (
    <div className="space-y-6 print:space-y-4" id="class-performance-comparison-container">
      {/* 1. Header & Sub-Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#176B45]/10 text-[#176B45] dark:bg-[#176B45]/20 dark:text-emerald-400">
                Analytical Comparison
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {examination.year} {examination.term}
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              Class Performance Comparison — {className}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Comparing stream mean percentage performance against overall Grade/Class mean percentage for {examination.exam_name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            {/* View Mode Toggle: Mean % vs Difference from Grade vs Subject Rankings */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                id="btn-metric-mean"
                onClick={() => setViewMetric('mean')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                  viewMetric === 'mean'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mean %
              </button>
              <button
                type="button"
                id="btn-metric-difference"
                onClick={() => setViewMetric('difference')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                  viewMetric === 'difference'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Difference from Grade
              </button>
              <button
                type="button"
                id="btn-metric-rank"
                onClick={() => setViewMetric('rank')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                  viewMetric === 'rank'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Subject Rankings
              </button>
            </div>

            {/* Download PDF Button */}
            <button
              type="button"
              id="btn-export-comparison-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 bg-[#176B45] hover:bg-[#125837] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs transition flex items-center space-x-1.5 shadow-xs"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Print View Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print View</span>
            </button>
          </div>
        </div>

        {/* Informational note for single-stream classes */}
        {isSingleStream && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-2.5 text-amber-800 dark:text-amber-300 text-xs">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Single-Stream Grade:</span> This Grade has only one stream ({streams[0]?.name || 'Main'}). Stream-level comparison is limited, and Grade Overall values directly match this stream.
            </div>
          </div>
        )}
      </div>

      {/* 2. SECTION ONE: CLASS AVERAGE MARKS (Aggregate Total Marks) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-[#176B45]" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Class Average Marks
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Aggregate Metric
              </span>
            </div>
            {aggregateComparison.highest_stream_name && !isSingleStream && (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Top Stream: <strong className="font-extrabold">{aggregateComparison.highest_stream_name}</strong>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sum of assessed learners' total aggregate marks ÷ number of assessed learners. This is an aggregate score out of total obtainable marks (not a percentage).
          </p>
        </div>

        {/* Aggregate Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Stream Cards */}
          {streams.map((st) => {
            const stData = aggregateComparison.stream_averages[st.id];
            const isHighest = !isSingleStream && aggregateComparison.highest_stream_name === st.name;
            return (
              <div
                key={st.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isHighest
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                    {st.name}
                  </span>
                  {isHighest && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                      Top
                    </span>
                  )}
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                  {formatAverageMarks(stData?.average_marks ?? null)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {stData?.assessed_count || 0} assessed of {st.learnerCount}
                </div>
              </div>
            );
          })}

          {/* Grade Overall Card */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-blue-950 dark:text-blue-200 truncate">
                {className} Overall
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                Grade
              </span>
            </div>
            <div className="text-lg font-black text-blue-900 dark:text-blue-100 mt-1">
              {formatAverageMarks(aggregateComparison.grade_overall_average_marks)}
            </div>
            <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mt-0.5">
              {aggregateComparison.grade_total_assessed} assessed of {gradeTotalLearners}
            </div>
          </div>
        </div>

        {/* Stream Performance Ranking Table */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3" id="stream-performance-ranking-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Stream Performance Ranking
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Ranked by Class Average Marks (aggregate score)
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="p-2.5 text-center w-14">Rank</th>
                  <th className="p-2.5">Stream</th>
                  <th className="p-2.5">Class Teacher</th>
                  <th className="p-2.5 text-right">Class Avg Marks</th>
                  <th className="p-2.5 text-center">Assessed Learners</th>
                  <th className="p-2.5">Top 3 Learners in Stream</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {aggregateComparison.stream_rankings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                      No streams found.
                    </td>
                  </tr>
                ) : (
                  aggregateComparison.stream_rankings.map((st) => {
                    const isRank1 = st.rank === 1 && !isSingleStream;
                    return (
                      <tr
                        key={st.stream_id}
                        id={`stream-ranking-row-${st.stream_id}`}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          isRank1 ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center font-extrabold">
                          {st.rank !== null ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                                st.rank === 1
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                  : st.rank === 2
                                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                  : st.rank === 3
                                  ? 'bg-amber-700/10 text-amber-900 dark:bg-amber-950 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              #{st.rank}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                          {st.stream_name}
                          <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                            ({st.total_learners} learners)
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {st.class_teacher_name ? (
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {st.class_teacher_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not Assigned</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900 dark:text-slate-100">
                          {formatAverageMarks(st.average_marks)}
                        </td>
                        <td className="p-2.5 text-center text-slate-600 dark:text-slate-300">
                          {st.assessed_count} of {st.total_learners}
                        </td>
                        <td className="p-2.5">
                          {st.topLearners.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {st.topLearners.map((lr) => (
                                <span
                                  key={lr.student_id}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                >
                                  <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                                    #{lr.position}
                                  </strong>
                                  <span className="truncate max-w-[120px]">{lr.student_name}</span>
                                  <span className="text-slate-400 font-medium">({lr.total_marks.toFixed(1)}m)</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No assessed learners</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 3 Learners Overall in Grade Panel */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3" id="top-learners-overall-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center space-x-2">
              <Medal className="w-4 h-4 text-[#176B45]" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Top 3 Learners — {className} Overall
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Ranked by aggregate total marks across entire grade
            </span>
          </div>

          {topLearnersOverall.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400 italic">
              No assessed learners available for overall ranking.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topLearnersOverall.map((lr) => (
                <div
                  key={lr.student_id}
                  id={`top-learner-overall-${lr.student_id}`}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-xs flex items-center justify-between space-x-3"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0 ${
                        lr.position === 1
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : lr.position === 2
                          ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                          : 'bg-amber-700/10 text-amber-900 dark:bg-amber-950 dark:text-amber-400'
                      }`}
                    >
                      #{lr.position}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {lr.student_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        {lr.stream_name && (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {lr.stream_name}
                          </span>
                        )}
                        {lr.admission_number && lr.admission_number !== '-' && (
                          <span>· Adm: {lr.admission_number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {lr.total_marks.toFixed(1)} mks
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {lr.average_marks.toFixed(1)}% {lr.performance_level ? `· ${lr.performance_level}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. SECTION TWO: LEARNING AREA PERFORMANCE (Percentage Metric) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#176B45]" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Learning Area Performance Comparison
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Percentage Mean (%)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mean percentage performance of each stream vs Grade overall. Absent (X), irregular (Y), and unassessed learners are excluded from calculations.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            Showing mode:{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {viewMetric === 'mean'
                ? 'Mean Percentage (%)'
                : viewMetric === 'difference'
                ? 'Difference from Grade (pp)'
                : 'Subject Rankings (Within Stream & Overall)'}
            </span>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-[#176B45] dark:bg-[#125837] text-white font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3 sticky left-0 z-10 bg-[#176B45] dark:bg-[#125837] border-r border-[#125837] dark:border-[#0e482d]">
                  Learning Area
                </th>
                {streams.map((st) => (
                  <th key={st.id} className="p-3 text-center">
                    <div>{st.name}</div>
                    <div className="text-[9px] font-normal text-emerald-100/80">
                      {st.learnerCount} learners
                    </div>
                  </th>
                ))}
                <th className="p-3 text-center bg-[#125837] dark:bg-[#0e482d] font-extrabold text-white border-l border-r border-[#0e482d]/50">
                  <div>{className} Overall</div>
                  <div className="text-[9px] font-normal text-emerald-200">
                    {gradeTotalLearners} learners
                  </div>
                </th>
                {!isSingleStream && (
                  <th className="p-3 text-center">
                    Top Stream
                  </th>
                )}
                <th className="p-3 text-center print:hidden">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={streams.length + (isSingleStream ? 2 : 3)}
                    className="p-8 text-center text-slate-500 dark:text-slate-400 italic"
                  >
                    No Learning Areas found for {className}.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  return (
                    <tr
                      key={row.subject_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Learning Area Column */}
                      <td className="p-3 font-medium sticky left-0 z-10 bg-white group-hover:bg-slate-50/80 dark:bg-slate-900 dark:group-hover:bg-slate-800/50 border-r border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                            {row.subject_code}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {row.subject_name}
                          </span>
                        </div>
                      </td>

                      {/* Stream Columns */}
                      {streams.map((st) => {
                        const sMean = row.stream_means[st.id];
                        const meanVal = sMean?.mean_percentage ?? null;
                        const diffVal = sMean?.difference_from_grade ?? null;
                        const isHighest = !isSingleStream && row.highest_stream_name === st.name;

                        return (
                          <td
                            key={st.id}
                            className={`p-3 text-center ${
                              isHighest
                                ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                                : ''
                            }`}
                          >
                            {viewMetric === 'mean' ? (
                              <div className="inline-flex flex-col items-center">
                                <span
                                  className={`font-extrabold ${
                                    meanVal === null
                                      ? 'text-slate-400 dark:text-slate-500'
                                      : isHighest
                                      ? 'text-emerald-700 dark:text-emerald-400 font-black'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {formatPercentageVal(meanVal)}
                                </span>
                                {meanVal !== null && (
                                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    <span>({sMean?.assessed_count} assessed)</span>
                                    {sMean?.stream_rank !== null && sMean?.stream_rank !== undefined && (
                                      <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                        #{sMean.stream_rank}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : viewMetric === 'difference' ? (
                              // Difference from Grade mode
                              <div className="inline-flex flex-col items-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {formatPercentageVal(meanVal)}
                                </span>
                                {diffVal !== null ? (
                                  <span
                                    className={`text-[11px] font-extrabold inline-flex items-center space-x-0.5 ${
                                      diffVal > 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : diffVal < 0
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {diffVal > 0 ? (
                                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                                    ) : diffVal < 0 ? (
                                      <ArrowDownRight className="w-3 h-3 shrink-0" />
                                    ) : (
                                      <Minus className="w-3 h-3 shrink-0" />
                                    )}
                                    <span>{formatDifferenceVal(diffVal)}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
                                )}
                              </div>
                            ) : (
                              // Subject Rankings mode
                              <div className="inline-flex flex-col items-center">
                                {sMean?.stream_rank !== null && sMean?.stream_rank !== undefined ? (
                                  <span
                                    className={`font-black text-xs px-2 py-0.5 rounded-full ${
                                      sMean.stream_rank === 1
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                        : sMean.stream_rank <= 3
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }`}
                                  >
                                    #{sMean.stream_rank}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {formatPercentageVal(meanVal)}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Grade Overall Column */}
                      <td className="p-3 text-center font-black bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 border-l border-r border-slate-100 dark:border-slate-800">
                        <div className="inline-flex flex-col items-center">
                          {viewMetric === 'rank' ? (
                            <>
                              {row.grade_overall_rank !== null && row.grade_overall_rank !== undefined ? (
                                <span
                                  className={`font-black text-xs px-2 py-0.5 rounded-full ${
                                    row.grade_overall_rank === 1
                                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                      : row.grade_overall_rank <= 3
                                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  #{row.grade_overall_rank}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                {formatPercentageVal(row.grade_overall_mean)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[13px]">
                                {formatPercentageVal(row.grade_overall_mean)}
                              </span>
                              <div className="flex items-center space-x-1 text-[10px] font-normal text-blue-600 dark:text-blue-400 mt-0.5">
                                <span>({row.total_assessed} total)</span>
                                {row.grade_overall_rank !== null && row.grade_overall_rank !== undefined && (
                                  <span className="px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 font-bold text-blue-800 dark:text-blue-300">
                                    #{row.grade_overall_rank}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Top Stream Pill */}
                      {!isSingleStream && (
                        <td className="p-3 text-center">
                          {row.highest_stream_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              {row.highest_stream_name}
                            </span>
                          ) : row.is_tie ? (
                            <span className="text-[10px] text-slate-400 font-semibold italic">
                              Tie
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Drill-down Actions Button */}
                      <td className="p-3 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedSubjectDetail(row)}
                          className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition"
                        >
                          Breakdown
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Progressive Disclosure Modal for Learning Area Drill-down */}
      {selectedSubjectDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedSubjectDetail.subject_code}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {selectedSubjectDetail.subject_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {className} Performance Breakdown — {examination.exam_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubjectDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Grade Overall Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-blue-950 dark:text-blue-200">
                    {className} Overall Mean
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    {selectedSubjectDetail.total_assessed} valid assessed learners
                    {selectedSubjectDetail.grade_overall_rank !== null && selectedSubjectDetail.grade_overall_rank !== undefined && (
                      <span className="ml-1.5 font-bold">
                        · Grade Rank #{selectedSubjectDetail.grade_overall_rank}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-900 dark:text-blue-100">
                  {formatPercentageVal(selectedSubjectDetail.grade_overall_mean)}
                </div>
              </div>

              {/* Streams Breakdown Cards */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Stream Breakdown
                </h4>
                {streams.map((st) => {
                  const sMean = selectedSubjectDetail.stream_means[st.id];
                  const meanVal = sMean?.mean_percentage ?? null;
                  const diffVal = sMean?.difference_from_grade ?? null;
                  const isTop = !isSingleStream && selectedSubjectDetail.highest_stream_name === st.name;

                  return (
                    <div
                      key={st.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        isTop
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {st.name}
                          </span>
                          {isTop && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                              Highest
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {sMean?.assessed_count || 0} valid assessed learners
                          {sMean?.stream_rank !== null && sMean?.stream_rank !== undefined && (
                            <span className="ml-1.5 font-bold text-slate-700 dark:text-slate-300">
                              · Stream Rank #{sMean.stream_rank}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                          {formatPercentageVal(meanVal)}
                        </div>
                        {diffVal !== null ? (
                          <div
                            className={`text-[11px] font-bold inline-flex items-center space-x-0.5 ${
                              diffVal > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : diffVal < 0
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-500'
                            }`}
                          >
                            <span>
                              {diffVal > 0 ? '+' : ''}
                              {diffVal.toFixed(2)} pp vs Grade
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">No assessed learners</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubjectDetail(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
