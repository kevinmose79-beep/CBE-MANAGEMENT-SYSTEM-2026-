import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Printer,
  Award,
  Users,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Building2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import {
  TerminalMeritListData,
  downloadTerminalMeritListPDF,
  downloadTerminalMeritListExcel,
  downloadTerminalMeritListCSV,
  getSubjectDisplayName,
  getSubjectDisplayCode,
  formatSubjectResultCell,
} from '../../services/terminalMeritListExporter';
import { formatTwoDecimalAverage } from '../../utils/markUtils';

interface CbeTerminalMeritListReportProps {
  data: TerminalMeritListData;
  onRefresh?: () => void;
}

export const CbeTerminalMeritListReport: React.FC<CbeTerminalMeritListReportProps> = ({
  data,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await downloadTerminalMeritListPDF(data);
    } catch (err) {
      console.error('Failed to export Terminal Merit List PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    try {
      setIsExportingExcel(true);
      downloadTerminalMeritListExcel(data);
    } catch (err) {
      console.error('Failed to export Terminal Merit List Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCsv = () => {
    try {
      setIsExportingCsv(true);
      downloadTerminalMeritListCSV(data);
    } catch (err) {
      console.error('Failed to export Terminal Merit List CSV:', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const { summaryStats, activeSubjects, learners } = data;
  const maxScore = summaryStats.classCurriculumMax;

  return (
    <div id="terminal-merit-list-report" className="space-y-4">
      {/* 1. Header Card with Summary Metrics and Export Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider uppercase bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Junior School Terminal Merit List
              </span>
              {data.isProvisionalMode ? (
                <span
                  id="merit-provisional-badge"
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center space-x-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Provisional</span>
                </span>
              ) : (
                <span
                  id="merit-official-badge"
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center space-x-1"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Official</span>
                </span>
              )}
            </div>

            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {data.school.school_name || 'CBE MANAGEMENT SYSTEM'}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-800 dark:text-slate-200">
                  {data.grade} ({data.streamName})
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {data.academicYear} {data.term}
                </span>
              </span>
              <span>•</span>
              <span>Generated: {data.generatedAt}</span>
            </div>
          </div>

          {/* Export Action Controls */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              id="export-terminal-merit-pdf-btn"
              onClick={handleExportPdf}
              disabled={isExportingPdf || learners.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#176B45] hover:bg-[#125335] disabled:opacity-50 transition shadow-2xs cursor-pointer"
              title="Download Strict Black & White PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Exporting PDF…' : 'PDF (B&W)'}</span>
            </button>

            <button
              id="export-terminal-merit-excel-btn"
              onClick={handleExportExcel}
              disabled={isExportingExcel || learners.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-50 transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isExportingExcel ? 'Exporting…' : 'Excel'}</span>
            </button>

            <button
              id="export-terminal-merit-csv-btn"
              onClick={handleExportCsv}
              disabled={isExportingCsv || learners.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-50 transition shadow-2xs cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600" />
              <span>{isExportingCsv ? 'Exporting…' : 'CSV'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Print view"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Key Metrics Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Class Average Marks
            </span>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                {formatTwoDecimalAverage(summaryStats.classAverageMarks)}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                / {maxScore}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Mean total marks obtained
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Class Mean (%)
            </span>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                {formatTwoDecimalAverage(summaryStats.classMeanPercentage)}%
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                {summaryStats.overallPerformanceLevel}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Mean learner percentage
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Class Mean Points
            </span>
            <div className="mt-1 flex items-baseline space-x-1">
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                {formatTwoDecimalAverage(summaryStats.classMeanPoints)}
              </span>
              <span className="text-[10px] text-slate-400">Pts</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Out of 8.00 (EE1=8)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Candidates Ranked
            </span>
            <div className="mt-1 flex items-baseline space-x-1.5">
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                {summaryStats.rankableCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                / {summaryStats.enrolledCount}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {summaryStats.unrankableCount > 0
                ? `${summaryStats.unrankableCount} incomplete unranked`
                : '100% complete cohort'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main High-Density Merit List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider text-center">
                <th className="py-2.5 px-2 w-10 border-r border-slate-800">POS</th>
                <th className="py-2.5 px-2 w-16 border-r border-slate-800">ADM</th>
                <th className="py-2.5 px-3 text-left min-w-[140px] border-r border-slate-800">
                  LEARNER NAME
                </th>

                {activeSubjects.map((sb) => {
                  const sCode = getSubjectDisplayCode(sb);
                  const sName = getSubjectDisplayName(sb);
                  return (
                    <th
                      key={sb.id}
                      className="py-2 px-1.5 min-w-[62px] border-r border-slate-800 text-center"
                      title={sName}
                    >
                      <div className="font-extrabold truncate max-w-[70px]">
                        {sCode || sName.substring(0, 4).toUpperCase()}
                      </div>
                    </th>
                  );
                })}

                <th className="py-2.5 px-2 border-r border-slate-800 bg-slate-800 font-extrabold">
                  TOT
                  <span className="block text-[9px] font-normal opacity-80">
                    /{maxScore}
                  </span>
                </th>
                <th className="py-2.5 px-2 border-r border-slate-800 bg-slate-800 font-extrabold">
                  AVG
                  <span className="block text-[9px] font-normal opacity-80">
                    MARKS
                  </span>
                </th>
                <th className="py-2.5 px-2 border-r border-slate-800 bg-slate-800 font-extrabold">
                  AVG
                  <span className="block text-[9px] font-normal opacity-80">
                    PTS
                  </span>
                </th>
                <th className="py-2.5 px-2 bg-slate-800 font-extrabold">LVL</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
              {learners.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + activeSubjects.length + 4}
                    className="py-8 text-center text-slate-500 italic"
                  >
                    No learners found in the selected cohort.
                  </td>
                </tr>
              ) : (
                learners.map((lr, idx) => {
                  const isUnranked = !lr.isRankable;
                  return (
                    <tr
                      key={lr.student.id || idx}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isUnranked ? 'bg-slate-50/50 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      {/* POS (STRICT REQUIREMENT: Blank "" for unranked learners) */}
                      <td className="py-2 px-2 text-center font-bold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800">
                        {lr.displayPosition}
                      </td>

                      {/* ADM */}
                      <td className="py-2 px-2 text-center font-mono text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                        {lr.student.admission_number || '—'}
                      </td>

                      {/* NAME */}
                      <td className="py-2 px-3 text-left font-bold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800 truncate max-w-[200px]">
                        {lr.student.full_name || '—'}
                      </td>

                      {/* LEARNING AREA CELLS (Terminal Percentage + CBE Level) */}
                      {activeSubjects.map((sb) => {
                        const res = lr.subjectResults.get(sb.id);
                        const cell = formatSubjectResultCell(res);
                        if (!res || (!cell.isSpecial && !cell.pctText)) {
                          return (
                            <td
                              key={sb.id}
                              className="py-1.5 px-1 text-center text-slate-400 border-r border-slate-100 dark:border-slate-800"
                            >
                              —
                            </td>
                          );
                        }

                        if (cell.isSpecial) {
                          return (
                            <td
                              key={sb.id}
                              className="py-1.5 px-1 text-center font-black text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800"
                              title={cell.specialCode === 'X' ? 'Unassessed / Missing Mark' : 'Absence / Irregularity'}
                            >
                              {cell.specialCode}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={sb.id}
                            className="py-1.5 px-1 text-center border-r border-slate-100 dark:border-slate-800"
                          >
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">
                              {cell.pctText}
                            </span>{' '}
                            <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">
                              {cell.lvlText}
                            </span>
                          </td>
                        );
                      })}

                      {/* TOTAL MARKS */}
                      <td className="py-2 px-2 text-center font-black text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        {lr.terminalTotalMarks !== null ? lr.terminalTotalMarks : '—'}
                      </td>

                      {/* AVG MARKS */}
                      <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
                        {lr.learnerAverageMarks !== null
                          ? `${formatTwoDecimalAverage(lr.learnerAverageMarks)}%`
                          : '—'}
                      </td>

                      {/* AVG POINTS */}
                      <td className="py-2 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                        {lr.learnerAveragePoints !== null
                          ? formatTwoDecimalAverage(lr.learnerAveragePoints)
                          : '—'}
                      </td>

                      {/* LEVEL */}
                      <td className="py-2 px-2 text-center font-black text-slate-900 dark:text-slate-100">
                        {lr.overallPerformanceLevel}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* 4. FOOTER SUMMARY ROWS */}
            {learners.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                {/* 1. AVG. MARKS ROW */}
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="py-2 px-3 text-left uppercase tracking-wider font-extrabold border-r border-slate-200 dark:border-slate-700">
                    AVG. MARKS
                  </td>
                  {activeSubjects.map((sb) => {
                    const stat = summaryStats.subjectStats.get(sb.id);
                    return (
                      <td
                        key={sb.id}
                        className="py-2 px-1 text-center font-bold border-r border-slate-200 dark:border-slate-700"
                      >
                        {stat && stat.validCount > 0
                          ? `${formatTwoDecimalAverage(stat.averagePercentage)}%`
                          : '—'}
                      </td>
                    );
                  })}
                  {/* Class Average Marks under TOT column */}
                  <td className="py-2 px-2 text-center font-black border-r border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-700/60">
                    {formatTwoDecimalAverage(summaryStats.classAverageMarks)}
                  </td>
                  {/* Class Mean Percentage under AVG MARKS column */}
                  <td className="py-2 px-2 text-center font-black border-r border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-700/60">
                    {formatTwoDecimalAverage(summaryStats.classMeanPercentage)}%
                  </td>
                  {/* Class Mean Points */}
                  <td className="py-2 px-2 text-center font-mono border-r border-slate-200 dark:border-slate-700">
                    {formatTwoDecimalAverage(summaryStats.classMeanPoints)}
                  </td>
                  {/* Class Overall Level */}
                  <td className="py-2 px-2 text-center font-black">
                    {summaryStats.overallPerformanceLevel}
                  </td>
                </tr>

                {/* 2. AVG. POINTS ROW */}
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <td colSpan={3} className="py-1.5 px-3 text-left uppercase tracking-wider font-bold border-r border-slate-200 dark:border-slate-700">
                    AVG. POINTS
                  </td>
                  {activeSubjects.map((sb) => {
                    const stat = summaryStats.subjectStats.get(sb.id);
                    return (
                      <td
                        key={sb.id}
                        className="py-1.5 px-1 text-center font-mono border-r border-slate-200 dark:border-slate-700"
                      >
                        {stat && stat.validCount > 0
                          ? formatTwoDecimalAverage(stat.averagePoints)
                          : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">
                    —
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">
                    —
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono border-r border-slate-200 dark:border-slate-700">
                    {formatTwoDecimalAverage(summaryStats.classMeanPoints)}
                  </td>
                  <td className="py-1.5 px-2 text-center">—</td>
                </tr>

                {/* 3. PERFORMANCE LEVEL ROW */}
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  <td colSpan={3} className="py-1.5 px-3 text-left uppercase tracking-wider font-bold border-r border-slate-200 dark:border-slate-700">
                    PERFORMANCE LEVEL
                  </td>
                  {activeSubjects.map((sb) => {
                    const stat = summaryStats.subjectStats.get(sb.id);
                    return (
                      <td
                        key={sb.id}
                        className="py-1.5 px-1 text-center font-extrabold border-r border-slate-200 dark:border-slate-700"
                      >
                        {stat && stat.validCount > 0 ? stat.performanceLevel : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">
                    —
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">
                    —
                  </td>
                  <td className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">
                    —
                  </td>
                  <td className="py-1.5 px-2 text-center font-black">
                    {summaryStats.overallPerformanceLevel}
                  </td>
                </tr>

                {/* 4. SUBJECT TEACHER ROW */}
                <tr className="text-slate-600 dark:text-slate-400 font-medium">
                  <td colSpan={3} className="py-1.5 px-3 text-left uppercase tracking-wider font-bold border-r border-slate-200 dark:border-slate-700">
                    SUBJECT TEACHER
                  </td>
                  {activeSubjects.map((sb) => {
                    const stat = summaryStats.subjectStats.get(sb.id);
                    return (
                      <td
                        key={sb.id}
                        className="py-1.5 px-1 text-center text-[10px] truncate max-w-[70px] border-r border-slate-200 dark:border-slate-700"
                        title={stat?.assignedTeacherName || 'Unassigned'}
                      >
                        {stat?.assignedTeacherName || ''}
                      </td>
                    );
                  })}
                  <td colSpan={4} className="py-1.5 px-2 text-center text-[10px] text-slate-400">
                    —
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
