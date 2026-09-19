import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Users,
  Search,
  CheckCircle2,
  HelpCircle,
  Award,
  ArrowRight,
  BookOpen,
  Filter,
} from 'lucide-react';
import { Examination, Student, Subject, Mark, Grade, ClassStream, getStudentFullName } from '../../types';
import { evaluateMark } from '../../utils/markUtils';
import { getGradeForMark } from '../../services/analysisEngine';
import { TabType } from '../Sidebar';

export interface RemedialInterventionWatchlistProps {
  selectedStudents: Student[];
  learnerSubjects: Subject[];
  activeExam: Examination;
  markMap: Map<string, Mark>;
  grades: Grade[];
  classes?: ClassStream[];
  onNavigateToTab?: (tab: TabType) => void;
}

interface RemedialCandidate {
  student: Student;
  validSubjectsCount: number;
  totalScore: number;
  averageScore: number;
  averagePoints: number;
  gradeCode: string;
  gradeDescriptor: string;
  missingXCount: number;
  irregularityYCount: number;
  isLowAchievement: boolean;
  reasons: string[];
}

export const RemedialInterventionWatchlist: React.FC<RemedialInterventionWatchlistProps> = ({
  selectedStudents,
  learnerSubjects,
  activeExam,
  markMap,
  grades,
  classes,
  onNavigateToTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [issueFilter, setIssueFilter] = useState<'all' | 'low_score' | 'missing_x' | 'irregularity_y'>('all');

  // Compute remedial candidates list
  const remedialCandidates: RemedialCandidate[] = useMemo(() => {
    const list: RemedialCandidate[] = [];

    selectedStudents.forEach((student) => {
      let validSubjectsCount = 0;
      let totalScore = 0;
      let totalPoints = 0;
      let missingXCount = 0;
      let irregularityYCount = 0;
      const reasons: string[] = [];

      learnerSubjects.forEach((subject) => {
        const key = `${student.id}_${subject.id}_${activeExam.id}`;
        const markRecord = markMap.get(key);
        const evalResult = evaluateMark(markRecord);

        if (evalResult.status === 'X') {
          missingXCount++;
        } else if (evalResult.status === 'Y') {
          irregularityYCount++;
        } else if (evalResult.status === 'Normal' && evalResult.percentage !== null) {
          validSubjectsCount++;
          totalScore += evalResult.percentage;
          const gradeInfo = getGradeForMark(evalResult.percentage, grades);
          if (gradeInfo) {
            totalPoints += gradeInfo.points;
          }
        }
      });

      const averageScore = validSubjectsCount > 0 ? totalScore / validSubjectsCount : 0;
      const averagePoints = validSubjectsCount > 0 ? totalPoints / validSubjectsCount : 0;
      const overallGrade = validSubjectsCount > 0 ? getGradeForMark(averageScore, grades) : null;
      const gradeCode = overallGrade ? (overallGrade.grade_code || overallGrade.grade || 'BE2') : 'BE2';
      const gradeDescriptor = overallGrade?.descriptor || 'Below Expectation';

      const isLowAchievement = validSubjectsCount > 0 && (averagePoints <= 3.0 || averageScore < 40);

      if (isLowAchievement) {
        reasons.push(`Low Mean Score (${averageScore.toFixed(2)}% / ${averagePoints.toFixed(2)} Pts) — Below Expected Level`);
      }
      if (missingXCount > 0) {
        reasons.push(`${missingXCount} Missing Mark(s) (X)`);
      }
      if (irregularityYCount > 0) {
        reasons.push(`${irregularityYCount} Marked Irregularity/ies (Y)`);
      }

      if (isLowAchievement || missingXCount > 0 || irregularityYCount > 0) {
        list.push({
          student,
          validSubjectsCount,
          totalScore,
          averageScore,
          averagePoints,
          gradeCode,
          gradeDescriptor,
          missingXCount,
          irregularityYCount,
          isLowAchievement,
          reasons,
        });
      }
    });

    // Sort: lowest average score first, then most flags
    return list.sort((a, b) => a.averageScore - b.averageScore);
  }, [selectedStudents, learnerSubjects, activeExam, markMap, grades]);

  const filteredList = remedialCandidates.filter((cand) => {
    const name = getStudentFullName(cand.student).toLowerCase();
    const adm = (cand.student.admission_number || '').toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || adm.includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (issueFilter === 'low_score') return cand.isLowAchievement;
    if (issueFilter === 'missing_x') return cand.missingXCount > 0;
    if (issueFilter === 'irregularity_y') return cand.irregularityYCount > 0;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Remedial &amp; Academic Support Intervention Watchlist</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-mono">
              {remedialCandidates.length} Identified
            </span>
          </div>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Learners identified with Below Expectation competency levels, score deficit thresholds, or missing/irregularity assessment entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate name / adm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Issue Filter Buttons */}
          <div className="flex rounded-lg border border-[#D9E0E7] dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setIssueFilter('all')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                issueFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[#1F2937] dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({remedialCandidates.length})
            </button>
            <button
              onClick={() => setIssueFilter('low_score')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                issueFilter === 'low_score'
                  ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Below Expectation ({remedialCandidates.filter((c) => c.isLowAchievement).length})
            </button>
            <button
              onClick={() => setIssueFilter('missing_x')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                issueFilter === 'missing_x'
                  ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Missing Marks ({remedialCandidates.filter((c) => c.missingXCount > 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* Watchlist Table */}
      {filteredList.length === 0 ? (
        <div className="bg-[#E8F5EF] dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl p-6 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#075E42] dark:text-emerald-400 mx-auto" />
          <h3 className="text-sm font-bold text-[#075E42] dark:text-emerald-300">
            {remedialCandidates.length === 0
              ? 'No Learners Require Remedial Attention'
              : 'No Learners Match the Active Filters'}
          </h3>
          <p className="text-xs text-[#075E42]/80 dark:text-emerald-400/80 max-w-md mx-auto">
            {remedialCandidates.length === 0
              ? 'All evaluated candidates in this cohort are performing at or above Meeting Expectation standards with complete mark records.'
              : 'Clear or adjust the search and filter criteria to view other candidates.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#D9E0E7] dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F8FA] dark:bg-slate-800/80 text-[#667085] dark:text-slate-400 font-bold border-b border-[#D9E0E7] dark:border-slate-700">
                <th className="py-3 px-3.5">Learner Name &amp; Admission</th>
                <th className="py-3 px-3 text-center">Gender</th>
                <th className="py-3 px-3 text-center">Mean Score</th>
                <th className="py-3 px-3 text-center">Mean Points</th>
                <th className="py-3 px-3 text-center">Competency Level</th>
                <th className="py-3 px-3">Identified Intervention Need</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E0E7]/60 dark:divide-slate-800 font-medium">
              {filteredList.map((cand) => {
                const fullName = getStudentFullName(cand.student);

                return (
                  <tr
                    key={cand.student.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Learner Name & Adm */}
                    <td className="py-3 px-3.5">
                      <div>
                        <span className="font-bold text-[#1F2937] dark:text-slate-100 block">
                          {fullName}
                        </span>
                        <span className="font-mono text-[10px] text-[#667085] dark:text-slate-400">
                          Adm: {cand.student.admission_number || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Gender */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {cand.student.gender === 'F' ? 'F' : 'M'}
                      </span>
                    </td>

                    {/* Mean Score */}
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      <span
                        className={
                          cand.averageScore < 40
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[#1F2937] dark:text-slate-100'
                        }
                      >
                        {cand.validSubjectsCount > 0 ? `${cand.averageScore.toFixed(2)}%` : '—'}
                      </span>
                    </td>

                    {/* Mean Points */}
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      <span
                        className={
                          cand.averagePoints <= 3.0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[#075E42] dark:text-emerald-400'
                        }
                      >
                        {cand.validSubjectsCount > 0 ? `${cand.averagePoints.toFixed(2)} Pts` : '—'}
                      </span>
                    </td>

                    {/* Level Code */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-black text-xs ${
                          cand.gradeCode.startsWith('BE')
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : cand.gradeCode.startsWith('AE')
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {cand.gradeCode}
                      </span>
                    </td>

                    {/* Identified Intervention Need */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {cand.reasons.map((reason, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 mr-1.5"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
