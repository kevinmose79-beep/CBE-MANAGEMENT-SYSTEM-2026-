import React from 'react';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface AssessmentPerformanceKpiCardsProps {
  examStatistics: {
    highestMark: number;
    lowestMark: number;
    classAveragePct: number;
    classAveragePoints: number;
    overallLevelCode: string;
    overallPerfLevel: string;
    overallDescriptor: string;
    totalLearners: number;
    completeLearnersCount: number;
    provisionalLearnersCount: number;
    levelCounts: Record<string, number>;
  };
  comparisonData?: {
    found: boolean;
    message?: string;
    priorExamName?: string;
    countImproved?: number;
    countDeclined?: number;
    countUnchanged?: number;
    avgImprovement?: number;
    avgDecline?: number;
  } | null;
}

export const AssessmentPerformanceKpiCards: React.FC<AssessmentPerformanceKpiCardsProps> = ({
  examStatistics,
  comparisonData,
}) => {
  return (
    <div className="space-y-3">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* 1. Highest Mark */}
        <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block tracking-wider">
            Highest Mark
          </span>
          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono block">
            {Math.round(examStatistics.highestMark)}%
          </span>
        </div>

        {/* 2. Lowest Mark */}
        <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block tracking-wider">
            Lowest Mark
          </span>
          <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono block">
            {Math.round(examStatistics.lowestMark)}%
          </span>
        </div>

        {/* 3. Class Average Score */}
        <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block tracking-wider">
            Class Average
          </span>
          <span className="text-xl font-black text-[#075E42] dark:text-emerald-400 font-mono block">
            {Math.round(examStatistics.classAveragePct)}%
          </span>
        </div>

        {/* 4. Class Average Points */}
        <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block tracking-wider">
            Average Points
          </span>
          <span className="text-xl font-black text-emerald-800 dark:text-emerald-300 font-mono block">
            {examStatistics.classAveragePoints.toFixed(2)} Pts
          </span>
        </div>

        {/* 5. Performance Level */}
        <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block tracking-wider">
            Performance Level
          </span>
          <div className="flex items-baseline space-x-1.5 truncate">
            <span className="text-xl font-black text-[#075E42] dark:text-emerald-400">
              {examStatistics.overallLevelCode}
            </span>
            <span className="text-xs text-[#667085] dark:text-slate-400 font-medium truncate">
              ({examStatistics.overallPerfLevel})
            </span>
          </div>
        </div>
      </div>

      {/* Historical Comparison Insight Card (If comparison selected and available) */}
      {comparisonData && (
        <div className="bg-white dark:bg-slate-900 border border-[#D9E0E7] dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-2">
          {comparisonData.found ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-[#075E42] dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-[#1F2937] dark:text-slate-100">
                  Compared to: {comparisonData.priorExamName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center text-emerald-700 dark:text-emerald-400 font-bold gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {comparisonData.countImproved || 0} Improved (+{(comparisonData.avgImprovement || 0).toFixed(1)}%)
                </span>
                <span className="inline-flex items-center text-rose-700 dark:text-rose-400 font-bold gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {comparisonData.countDeclined || 0} Declined (-{(comparisonData.avgDecline || 0).toFixed(1)}%)
                </span>
                <span className="inline-flex items-center text-slate-600 dark:text-slate-400 font-semibold gap-1">
                  <Minus className="w-3.5 h-3.5" />
                  {comparisonData.countUnchanged || 0} Unchanged
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[#667085] dark:text-slate-400 italic">
              {comparisonData.message || 'No prior comparison assessment found.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
