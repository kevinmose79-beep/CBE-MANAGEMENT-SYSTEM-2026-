import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Users,
  Award,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Examination, Student, ClassStream, Subject, Mark, Grade, Teacher } from '../../types';
import { evaluateMark } from '../../utils/markUtils';
import { getGradeForMark } from '../../services/analysisEngine';

export interface SubjectProgressItem {
  subject: Subject;
  totalExpected: number;
  completed: number;
  provisional: number;
  missingX: number;
  irregularityY: number;
  completionRate: number;
  isComplete100: boolean;
}

export interface LearningAreaDiagnosticsTableProps {
  subjectProgressList: SubjectProgressItem[];
  activeExam: Examination;
  selectedStudents: Student[];
  markMap: Map<string, Mark>;
  grades: Grade[];
  teachers: Teacher[];
  selectedClassId: string;
  classes: ClassStream[];
  onNavigateToMarksEntry?: () => void;
}

export const LearningAreaDiagnosticsTable: React.FC<LearningAreaDiagnosticsTableProps> = ({
  subjectProgressList,
  activeExam,
  selectedStudents,
  markMap,
  grades,
  teachers,
  selectedClassId,
  classes,
  onNavigateToMarksEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'in-progress'>('all');

  // Compute per-subject performance stats (mean score & average points)
  const subjectStatsMap = React.useMemo(() => {
    const map = new Map<
      string,
      {
        validMarksCount: number;
        totalScore: number;
        totalPoints: number;
        meanScore: number;
        meanPoints: number;
        gradeCode: string;
      }
    >();

    subjectProgressList.forEach(({ subject }) => {
      let validMarksCount = 0;
      let totalScore = 0;
      let totalPoints = 0;

      selectedStudents.forEach((student) => {
        const key = `${student.id}_${subject.id}_${activeExam.id}`;
        const markRecord = markMap.get(key);
        const evalResult = evaluateMark(markRecord);
        if (evalResult.status === 'Normal' && evalResult.percentage !== null) {
          validMarksCount++;
          totalScore += evalResult.percentage;
          const gradeInfo = getGradeForMark(evalResult.percentage, grades);
          if (gradeInfo) {
            totalPoints += gradeInfo.points;
          }
        }
      });

      const meanScore = validMarksCount > 0 ? totalScore / validMarksCount : 0;
      const meanPoints = validMarksCount > 0 ? totalPoints / validMarksCount : 0;
      const gradeInfo = validMarksCount > 0 ? getGradeForMark(meanScore, grades) : null;

      map.set(subject.id, {
        validMarksCount,
        totalScore,
        totalPoints,
        meanScore,
        meanPoints,
        gradeCode: gradeInfo ? (gradeInfo.grade_code || gradeInfo.grade || '—') : '—',
      });
    });

    return map;
  }, [subjectProgressList, selectedStudents, activeExam, markMap, grades]);

  const filteredList = subjectProgressList.filter((item) => {
    const matchesSearch =
      (item.subject.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.subject.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterStatus === 'complete') return item.isComplete100;
    if (filterStatus === 'in-progress') return !item.isComplete100;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
            <span>Learning Area Diagnostic Metrics</span>
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Real-time completion tracking, entry validation, score averages, and competency grade distributions across learning areas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search learning area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#075E42]"
            />
          </div>

          {/* Filter Status Selector */}
          <div className="flex rounded-lg border border-[#D9E0E7] dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[#075E42] dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({subjectProgressList.length})
            </button>
            <button
              onClick={() => setFilterStatus('complete')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                filterStatus === 'complete'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Complete ({subjectProgressList.filter((s) => s.isComplete100).length})
            </button>
            <button
              onClick={() => setFilterStatus('in-progress')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                filterStatus === 'in-progress'
                  ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              In Progress ({subjectProgressList.filter((s) => !s.isComplete100).length})
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto rounded-xl border border-[#D9E0E7] dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F6F8FA] dark:bg-slate-800/80 text-[#667085] dark:text-slate-400 font-bold border-b border-[#D9E0E7] dark:border-slate-700">
              <th className="py-3 px-3.5">Learning Area</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3 text-center">Completed / Expected</th>
              <th className="py-3 px-3 text-center">Progress</th>
              <th className="py-3 px-3 text-center">Flags (X / Y)</th>
              <th className="py-3 px-3 text-center">Mean Score</th>
              <th className="py-3 px-3 text-center">Mean Points</th>
              <th className="py-3 px-3 text-center">Grade</th>
              {onNavigateToMarksEntry && <th className="py-3 px-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9E0E7]/60 dark:divide-slate-800 font-medium">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#667085] dark:text-slate-400 italic">
                  No learning areas match the specified criteria.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => {
                const stats = subjectStatsMap.get(item.subject.id);
                const hasFlags = item.missingX > 0 || item.irregularityY > 0;

                return (
                  <tr
                    key={item.subject.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Learning Area Name & Code */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] font-black px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                          {item.subject.subject_code || item.subject.id}
                        </span>
                        <div>
                          <span className="font-bold text-[#1F2937] dark:text-slate-100 block">
                            {item.subject.subject_name}
                          </span>
                          {item.subject.category && (
                            <span className="text-[10px] text-[#667085] dark:text-slate-400">
                              {item.subject.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center">
                      {item.isComplete100 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>100% COMPLETE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>IN PROGRESS</span>
                        </span>
                      )}
                    </td>

                    {/* Completed / Expected */}
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="font-bold text-[#1F2937] dark:text-slate-100">
                        {item.completed}
                      </span>
                      <span className="text-[#667085] dark:text-slate-400"> / {item.totalExpected}</span>
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3 px-3 text-center">
                      <div className="w-24 mx-auto space-y-1">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.isComplete100 ? 'bg-[#075E42]' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(item.completionRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#667085] dark:text-slate-400 font-bold block">
                          {item.completionRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Flags (X / Y) */}
                    <td className="py-3 px-3 text-center font-mono">
                      {hasFlags ? (
                        <span className="text-amber-700 dark:text-amber-400 font-bold">
                          {item.missingX > 0 && `${item.missingX}X `}
                          {item.irregularityY > 0 && `${item.irregularityY}Y`}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Mean Score */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-[#1F2937] dark:text-slate-100">
                      {stats && stats.validMarksCount > 0 ? `${stats.meanScore.toFixed(2)}%` : '—'}
                    </td>

                    {/* Mean Points */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-[#075E42] dark:text-emerald-400">
                      {stats && stats.validMarksCount > 0 ? `${stats.meanPoints.toFixed(2)} Pts` : '—'}
                    </td>

                    {/* CBE Grade Code */}
                    <td className="py-3 px-3 text-center">
                      {stats && stats.gradeCode !== '—' ? (
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[#1F2937] dark:text-slate-200">
                          {stats.gradeCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Action */}
                    {onNavigateToMarksEntry && (
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={onNavigateToMarksEntry}
                          className="inline-flex items-center space-x-1 text-[#075E42] dark:text-emerald-400 hover:underline font-bold text-xs cursor-pointer"
                          title="Open in Marks Entry"
                        >
                          <span>Marks Entry</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
