import React, { useEffect, useRef } from 'react';
import {
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  AssessmentTrailEntry,
  LearningAreaTerminalResult,
} from '../../services/terminalResultsEngine';
import { Subject } from '../../types';

interface AssessmentTrailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
  result: LearningAreaTerminalResult | null;
}

export const AssessmentTrailDrawer: React.FC<AssessmentTrailDrawerProps> = ({
  isOpen,
  onClose,
  subject,
  result,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !subject || !result) {
    return null;
  }

  const subjectName = subject.subject_name || 'Learning Area';
  const isComplete = result.isComplete;

  return (
    <div
      id="assessment-trail-overlay"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trail-drawer-title"
    >
      <div
        id="assessment-trail-panel"
        ref={drawerRef}
        className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 overflow-hidden sm:rounded-l-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="space-y-1 pr-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#176B45] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                Assessment Trail
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                {subject.subject_code}
              </span>
            </div>
            <h3
              id="trail-drawer-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {subjectName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit trail of all discovered contributing assessments and calculation provenance.
            </p>
          </div>

          <button
            id="close-trail-drawer-btn"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition focus:outline-hidden focus:ring-2 focus:ring-[#176B45]"
            aria-label="Close Assessment Trail"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Terminal Result Header Summary Banner */}
        <div className="px-5 py-3.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Terminal Outcome:
          </span>

          {isComplete ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                {result.terminalPercentage}% {result.cbePerformanceLevel} · {result.points} pts
              </span>
            </div>
          ) : (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                result.status === 'INCOMPLETE (X)'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                  : result.status === 'INCOMPLETE (Y)'
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  : 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {result.status}
            </span>
          )}
        </div>

        {/* Assessment Entries List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Contributing Assessments ({result.assessmentTrail.length})
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Strictly Equal Weighting
            </span>
          </div>

          {result.assessmentTrail.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                No contributing assessments discovered
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No approved assessments found for this session and class.
              </p>
            </div>
          ) : (
            result.assessmentTrail.map((entry, index) => (
              <AssessmentTrailCard
                key={entry.examId || index}
                entry={entry}
                index={index}
              />
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Equal Weighting: (Σ Normalised %) ÷ Assessment Count</span>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-[#176B45]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface AssessmentTrailCardProps {
  entry: AssessmentTrailEntry;
  index: number;
}

const AssessmentTrailCard: React.FC<AssessmentTrailCardProps> = ({
  entry,
  index,
}) => {
  const isNormal = entry.status === 'Normal';
  const isX = entry.status === 'X' || entry.status === 'Blank';
  const isY = entry.status === 'Y';
  const isResolved = Boolean(entry.resolvedFromY || entry.resolution);

  return (
    <div
      id={`trail-entry-${entry.examId}`}
      className={`p-4 rounded-xl border transition-all ${
        isResolved
          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
          : isNormal
          ? 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 shadow-2xs'
          : isY
          ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
      }`}
    >
      {/* Assessment Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="space-y-0.5">
          <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
            Assessment {index + 1}
          </span>
          <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {entry.examName}
          </h5>
        </div>

        {/* Status Badge */}
        {isResolved ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-teal-600 dark:text-teal-400" />
            Resolved from Y
          </span>
        ) : isNormal ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Assessed
          </span>
        ) : isY ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
            Irregularity / Withheld
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Missing / Unassessed (X)
          </span>
        )}
      </div>

      {/* Metrics Row */}
      {isNormal ? (
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">
              Raw Score
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {entry.rawScore !== null ? entry.rawScore : '—'}{' '}
              <span className="text-xs font-normal text-slate-400">/ {entry.outOf}</span>
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">
              Normalised
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {entry.percentage !== null ? `${Math.round(entry.percentage)}%` : '—'}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">
              CBE Level
            </span>
            <span className="text-sm font-extrabold text-[#176B45] dark:text-emerald-400">
              {entry.cbePerformanceLevel || '—'}
            </span>
          </div>
        </div>
      ) : isY ? (
        <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/50 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              Irregularity Reason:
            </span>
            <span className="font-bold text-amber-800 dark:text-amber-300">
              {entry.irregularityReason || 'Absent / Unresolved'}
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400/90">
            Unresolved irregularity or withheld status. Excludes Learning Area from completion until authoritatively resolved.
          </p>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              Assessment Status:
            </span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Unassessed / Mark Row Missing
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Learner has no valid numerical entry for this required assessment. Designated as X (Missing).
          </p>
        </div>
      )}

      {/* Resolution Provenance Section (if resolved from Y) */}
      {isResolved && (
        <div className="mt-3 p-3 rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Authorised Resolution Provenance</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">Original Status:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Y ({entry.resolution?.original_irregularity_reason || entry.irregularityReason || 'Withheld'})
              </span>
            </div>

            <div>
              <span className="text-slate-400 dark:text-slate-500 block">Replacement Mark:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                {entry.rawScore} / {entry.outOf} ({entry.percentage !== null ? Math.round(entry.percentage) : '—'}%)
              </span>
            </div>

            {entry.resolutionReason && (
              <div className="col-span-2">
                <span className="text-slate-400 dark:text-slate-500 block">Resolution Reason:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 italic">
                  "{entry.resolutionReason}"
                </span>
              </div>
            )}

            {entry.resolvedBy && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">Authorised By:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {entry.resolvedBy}
                </span>
              </div>
            )}

            {entry.resolvedAt && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">Resolution Date:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                  {new Date(entry.resolvedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
