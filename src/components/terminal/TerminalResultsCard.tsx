import React from 'react';
import {
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  ContributingAssessmentRef,
  LearningAreaTerminalResult,
  AssessmentTrailEntry,
} from '../../services/terminalResultsEngine';
import { Subject } from '../../types';

interface TerminalResultsCardProps {
  subject: Subject;
  contributingAssessments: ContributingAssessmentRef[];
  result?: LearningAreaTerminalResult;
  onSelectTrail: () => void;
}

export const TerminalResultsCard: React.FC<TerminalResultsCardProps> = ({
  subject,
  contributingAssessments,
  result,
  onSelectTrail,
}) => {
  const isComplete = result?.isComplete ?? false;

  return (
    <div
      id={`mobile-card-${subject.subject_code || subject.id}`}
      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
    >
      {/* Card Header: Subject + Terminal Outcome */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-1.5">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {subject.subject_name}
            </h4>
            {subject.subject_code && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {subject.subject_code}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Learning Area
          </span>
        </div>

        {/* Terminal Badge */}
        {result ? (
          isComplete ? (
            <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
              <span>
                {result.terminalPercentage}% {result.cbePerformanceLevel} · {result.points} pts
              </span>
            </div>
          ) : (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                result.status === 'INCOMPLETE (X)'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                  : result.status === 'INCOMPLETE (Y)'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
              }`}
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {result.status}
            </span>
          )
        ) : (
          <span className="text-xs text-slate-400 font-mono">—</span>
        )}
      </div>

      {/* Contributing Assessments List */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Contributing Assessments ({contributingAssessments.length})
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {contributingAssessments.map((assessment, idx) => {
            const entry = result?.assessmentTrail.find((t) => t.examId === assessment.id);
            return (
              <div
                key={assessment.id || idx}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="truncate pr-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                    {assessment.exam_name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Max: {assessment.max_marks || assessment.out_of}
                  </span>
                </div>

                <div className="shrink-0">
                  <MobileAssessmentChip entry={entry} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action to View Trail */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={onSelectTrail}
          disabled={!result}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center text-xs font-bold text-[#176B45] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/70 transition focus:outline-hidden focus:ring-2 focus:ring-[#176B45]"
        >
          <span>View Assessment Trail</span>
          <ChevronRight className="w-4 h-4 ml-1.5" />
        </button>
      </div>
    </div>
  );
};

interface MobileAssessmentChipProps {
  entry?: AssessmentTrailEntry;
}

const MobileAssessmentChip: React.FC<MobileAssessmentChipProps> = ({ entry }) => {
  if (!entry) {
    return <span className="text-slate-400 text-xs font-mono">—</span>;
  }

  if (entry.resolvedFromY) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
        <ShieldCheck className="w-3 h-3 mr-1 text-teal-600" />
        {Math.round(entry.percentage ?? 0)}% {entry.cbePerformanceLevel}
      </span>
    );
  }

  if (entry.status === 'Normal') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
        {Math.round(entry.percentage ?? 0)}% {entry.cbePerformanceLevel}
      </span>
    );
  }

  if (entry.status === 'Y') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
        <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
        Y
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
      <Clock className="w-3 h-3 mr-1 text-slate-500" />
      X
    </span>
  );
};
