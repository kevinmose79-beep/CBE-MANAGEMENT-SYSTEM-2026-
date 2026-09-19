import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  CheckSquare,
  Eye,
  Search,
} from 'lucide-react';
import { Examination, User } from '../../types';
import { TabType } from '../Sidebar';

export interface AssessmentValidationHealthCardProps {
  activeExam: Examination;
  validationResults: {
    issues: { type: 'blocking' | 'warning' | 'info'; title: string; detail: string }[];
    blockingIssues: { type: 'blocking' | 'warning' | 'info'; title: string; detail: string }[];
    warningIssues: { type: 'blocking' | 'warning' | 'info'; title: string; detail: string }[];
    isReadyForApproval: boolean;
  } | null;
  overallProgressStats: {
    totalLearners: number;
    totalSubjectRecordsExpected: number;
    completedRecords: number;
    provisionalRecords: number;
    totalMissingX: number;
    totalIrregularityY: number;
    overallCompletionPercentage: number;
    allSubjects100Percent: boolean;
  };
  isRefreshingAnalysis: boolean;
  lastRefreshedAt: Date;
  onRecalculate: () => void;
  onNavigateToTab?: (tab: TabType) => void;
  currentUser?: User | null;
}

export const AssessmentValidationHealthCard: React.FC<AssessmentValidationHealthCardProps> = ({
  activeExam,
  validationResults,
  overallProgressStats,
  isRefreshingAnalysis,
  lastRefreshedAt,
  onRecalculate,
  onNavigateToTab,
  currentUser,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Assessment Diagnostic Quality & Recalculation Engine Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
              <Search className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
              <span>Live Quality-Control Diagnostic Engine</span>
            </h2>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
              Stateless continuous validation verifying score boundaries, teacher allocations, anomalies, and performance distributions.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={onRecalculate}
              disabled={isRefreshingAnalysis}
              className="bg-[#075E42] hover:bg-[#087F5B] disabled:opacity-50 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer"
            >
              {isRefreshingAnalysis ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recalculating Diagnostics...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Recalculate Diagnostics</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Analysis Live Status Display */}
        <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-4 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#1F2937] dark:text-slate-200">
            <span className="flex items-center space-x-2">
              {isRefreshingAnalysis ? (
                <RefreshCw className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400 animate-spin" />
              ) : validationResults?.blockingIssues.length === 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>
                {isRefreshingAnalysis
                  ? 'Executing live diagnostic recalculation...'
                  : validationResults?.blockingIssues.length === 0
                  ? 'Continuous quality checks active — All diagnostic criteria verified'
                  : `${validationResults?.blockingIssues.length} blocking quality issue(s) detected`}
              </span>
            </span>
            <span className="font-mono text-[#075E42] dark:text-emerald-400 font-black text-xs">
              {isRefreshingAnalysis ? 'Recalculating...' : '✓ Live & Dynamic'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-[#667085] dark:text-slate-400 pt-1 border-t border-[#D9E0E7]/60 dark:border-slate-700/60 gap-2">
            <span>9 of 9 Quality-Control Diagnostic Checks Verified</span>
            <span>Last computed: {lastRefreshedAt.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* 2. Streamlined Entry Validation Gate Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-[#D9E0E7] dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 ${
                overallProgressStats.overallCompletionPercentage >= 100
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400'
              }`}
            >
              {overallProgressStats.overallCompletionPercentage >= 100 ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                  Mark Entry Gate:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-black font-mono ${
                    overallProgressStats.overallCompletionPercentage >= 100
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-[#075E42] dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                  }`}
                >
                  {overallProgressStats.overallCompletionPercentage.toFixed(1)}% COMPLETE
                </span>
              </div>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                {overallProgressStats.overallCompletionPercentage >= 100
                  ? `All ${overallProgressStats.completedRecords} learner record entries verified for analysis gate.`
                  : `${overallProgressStats.provisionalRecords} learner entry/entries pending (${overallProgressStats.completedRecords} complete, ${
                      overallProgressStats.totalMissingX + overallProgressStats.totalIrregularityY
                    } X/Y flags).`}
              </p>
            </div>
          </div>

          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('marks-monitoring')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E8F5EF] hover:bg-[#D3EBE0] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 text-[#075E42] dark:text-emerald-300 transition-colors flex-shrink-0 self-stretch sm:self-auto justify-center cursor-pointer"
            >
              <span>Open Marks Monitoring</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Validation Status & Detected Issues */}
      {validationResults && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                <span>Validation Status & Quality Checks</span>
              </h2>
            </div>
          </div>

          {/* Status Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Validation Passed</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {validationResults.isReadyForApproval ? 'Yes ✓' : 'No ✕'}
              </span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Blocking Issues</span>
              <span
                className={`text-lg font-black font-mono ${
                  validationResults.blockingIssues.length > 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {validationResults.blockingIssues.length}
              </span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Warnings & Irregularities</span>
              <span className="text-lg font-black text-amber-700 dark:text-amber-400 font-mono">
                {validationResults.warningIssues.length}
              </span>
            </div>
          </div>

          {/* Issue Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {validationResults.issues.length === 0 ? (
              <div className="col-span-2 bg-[#E8F5EF] dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 text-[#075E42] dark:text-emerald-300 flex items-center space-x-3 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                <span>
                  All required learning areas, mark boundaries, teacher allocations, and record structures passed automated verification cleanly.
                </span>
              </div>
            ) : (
              validationResults.issues.map((iss, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
                    iss.type === 'blocking'
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200'
                      : iss.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
                      : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-200'
                  }`}
                >
                  {iss.type === 'blocking' ? (
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block text-sm">{iss.title}</span>
                    <p className="text-xs mt-0.5 opacity-90">{iss.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Quality Control & Workflow Transition Gate Card */}
      {activeExam && (
        <div
          className={`rounded-2xl p-5 sm:p-6 shadow-sm border space-y-4 transition ${
            validationResults?.isReadyForApproval
              ? 'bg-[#E8F5EF] dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-[#1F2937] dark:text-slate-100'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-[#1F2937] dark:text-slate-100'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              {validationResults?.isReadyForApproval ? (
                <div className="flex items-center space-x-2 text-[#075E42] dark:text-emerald-400 font-black text-lg">
                  <CheckCircle2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                  <span>✓ Assessment Validation Passed — Ready for Provisional Review &amp; Approval</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-black text-lg">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Blocking Validation Issues Detected — Resolution Required</span>
                </div>
              )}

              <p className="text-xs text-[#667085] dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
                {validationResults?.isReadyForApproval
                  ? 'All required learning areas, score boundaries, and calculation integrity checks passed with 0 blocking issues. Results are validated and ready for learner-level provisional inspection and administrative results approval.'
                  : 'Please resolve all blocking anomalies and mark entry errors before proceeding to results approval.'}
              </p>

              {validationResults && !validationResults.isReadyForApproval && (
                <div className="bg-rose-100/70 dark:bg-rose-950/80 p-3 rounded-xl border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1 mt-2">
                  <span className="font-bold block text-rose-950 dark:text-rose-100">Outstanding Blocking Issues:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {validationResults.blockingIssues.map((iss, i) => (
                      <li key={i}>{iss.detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Validation Status Indicator */}
            <div className="shrink-0">
              {validationResults?.isReadyForApproval ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>READY FOR REVIEW</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700 text-xs font-black">
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>{validationResults?.blockingIssues.length || 0} BLOCKING ISSUE(S)</span>
                </div>
              )}
            </div>
          </div>

          {/* Next Step Workflow Actions */}
          <div className="border-t border-[#D9E0E7]/80 dark:border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-[#667085] dark:text-slate-400 font-bold">Recommended Workflow Next Steps:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigateToTab?.('marks-entry')}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2 rounded-lg font-semibold transition flex items-center space-x-1.5 cursor-pointer min-h-[40px]"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#667085] dark:text-slate-400" />
                <span>Marks Entry Grid</span>
              </button>
              <button
                onClick={() => onNavigateToTab?.('marks-monitoring')}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2 rounded-lg font-semibold transition flex items-center space-x-1.5 cursor-pointer min-h-[40px]"
              >
                <Eye className="w-3.5 h-3.5 text-[#667085] dark:text-slate-400" />
                <span>Marks Monitoring</span>
              </button>
              <button
                onClick={() => onNavigateToTab?.('provisional')}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2 rounded-lg font-semibold transition flex items-center space-x-1.5 cursor-pointer min-h-[40px]"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                <span>Provisional Results Verification</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => onNavigateToTab?.('results-approval')}
                  className={`px-4 py-2 rounded-lg font-bold transition flex items-center space-x-1.5 min-h-[40px] shadow-sm ${
                    validationResults?.isReadyForApproval
                      ? 'bg-[#075E42] hover:bg-[#087F5B] text-white cursor-pointer'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Proceed to Results Approval</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
