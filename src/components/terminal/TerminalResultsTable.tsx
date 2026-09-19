import React from 'react';
import {
  ShieldCheck,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  ContributingAssessmentRef,
  LearningAreaTerminalResult,
  AssessmentTrailEntry,
} from '../../services/terminalResultsEngine';
import { Subject } from '../../types';

interface TerminalResultsTableProps {
  subjects: Subject[];
  contributingAssessments: ContributingAssessmentRef[];
  resultsBySubject: Map<string, LearningAreaTerminalResult>;
  onSelectSubjectForTrail: (subject: Subject, result: LearningAreaTerminalResult) => void;
}

export const TerminalResultsTable: React.FC<TerminalResultsTableProps> = ({
  subjects,
  contributingAssessments,
  resultsBySubject,
  onSelectSubjectForTrail,
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <table
        id="terminal-results-table"
        className="w-full text-left text-xs border-collapse"
        role="table"
        aria-label="Terminal Results Summary Table"
      >
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <th
              scope="col"
              className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100 min-w-[180px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10"
            >
              Learning Area
            </th>

            {contributingAssessments.map((assessment, idx) => (
              <th
                key={assessment.id || idx}
                scope="col"
                className="py-3.5 px-3 font-semibold text-center min-w-[120px] whitespace-nowrap"
              >
                <div className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-[140px] mx-auto">
                  {assessment.exam_name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Max: {assessment.max_marks || assessment.out_of}
                </div>
              </th>
            ))}

            <th
              scope="col"
              className="py-3.5 px-4 font-bold text-center min-w-[160px] bg-slate-100/70 dark:bg-slate-800/60"
            >
              Terminal Result
            </th>

            <th
              scope="col"
              className="py-3.5 px-3 font-semibold text-center w-[90px]"
            >
              Trail
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {subjects.map((subject, sIdx) => {
            const result = resultsBySubject.get(subject.id);
            const isComplete = result?.isComplete ?? false;

            return (
              <tr
                key={subject.id || sIdx}
                id={`terminal-row-${subject.subject_code || subject.id}`}
                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* Learning Area Column */}
                <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {subject.subject_name}
                    </span>
                    {subject.subject_code && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800">
                        {subject.subject_code}
                      </span>
                    )}
                  </div>
                </td>

                {/* Dynamic Assessment Columns */}
                {contributingAssessments.map((assessment) => {
                  const trailEntry = result?.assessmentTrail.find(
                    (t) => t.examId === assessment.id
                  );

                  return (
                    <td
                      key={assessment.id}
                      className="py-3.5 px-3 text-center align-middle whitespace-nowrap"
                    >
                      <AssessmentCellContent entry={trailEntry} />
                    </td>
                  );
                })}

                {/* Terminal Result Column */}
                <td className="py-3.5 px-4 text-center align-middle bg-slate-50/40 dark:bg-slate-800/30 whitespace-nowrap">
                  {result ? (
                    isComplete ? (
                      <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          {result.terminalPercentage}% {result.cbePerformanceLevel}
                        </span>
                        <span className="mx-1 text-emerald-400 dark:text-emerald-600">·</span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                          {result.points} pts
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
                        <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
                        {result.status}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400 font-mono text-xs">—</span>
                  )}
                </td>

                {/* Progressive Disclosure Trail Button */}
                <td className="py-3.5 px-3 text-center align-middle">
                  <button
                    id={`view-trail-btn-${subject.subject_code || subject.id}`}
                    onClick={() => {
                      if (result) onSelectSubjectForTrail(subject, result);
                    }}
                    disabled={!result}
                    className="inline-flex items-center text-xs font-bold text-[#176B45] dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-30 disabled:pointer-events-none px-2.5 py-1 rounded-md transition focus:outline-hidden focus:ring-2 focus:ring-[#176B45]"
                    aria-label={`View Assessment Trail for ${subject.subject_name}`}
                  >
                    <span>Trail</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface AssessmentCellContentProps {
  entry?: AssessmentTrailEntry;
}

const AssessmentCellContent: React.FC<AssessmentCellContentProps> = ({ entry }) => {
  if (!entry) {
    return <span className="text-slate-400 font-mono text-xs">—</span>;
  }

  // 1. Resolved from Y (Replacement numerical score participating)
  if (entry.resolvedFromY) {
    return (
      <div className="inline-flex flex-col items-center">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
          <ShieldCheck className="w-3 h-3 mr-1 text-teal-600 dark:text-teal-400" />
          {Math.round(entry.percentage ?? 0)}% {entry.cbePerformanceLevel}
        </span>
        <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold tracking-tight mt-0.5">
          Resolved from Y
        </span>
      </div>
    );
  }

  // 2. Normal Assessed Score (including genuine 0)
  if (entry.status === 'Normal') {
    const pct = Math.round(entry.percentage ?? 0);
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
        {pct}% {entry.cbePerformanceLevel}
      </span>
    );
  }

  // 3. Y (Unresolved Irregularity / Withheld)
  if (entry.status === 'Y') {
    return (
      <div className="inline-flex flex-col items-center">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
          title={`Irregularity: ${entry.irregularityReason || 'Withheld'}`}
        >
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
          Y
        </span>
        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate max-w-[90px] mt-0.5">
          {entry.irregularityReason || 'Withheld'}
        </span>
      </div>
    );
  }

  // 4. X or Blank (Missing / Unassessed)
  return (
    <div className="inline-flex flex-col items-center">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
        title="Missing / Unassessed mark"
      >
        <Clock className="w-3 h-3 mr-1 text-slate-500" />
        X
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        Missing
      </span>
    </div>
  );
};
