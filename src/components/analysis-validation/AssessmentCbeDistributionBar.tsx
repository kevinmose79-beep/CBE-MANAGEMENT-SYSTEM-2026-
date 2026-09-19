import React from 'react';
import { Award } from 'lucide-react';

export interface AssessmentCbeDistributionBarProps {
  levelCounts: Record<string, number>;
  totalLearners?: number;
  completeLearnersCount?: number;
}

interface LevelDef {
  code: string;
  label: string;
  category: 'Exceeding' | 'Meeting' | 'Approaching' | 'Below' | 'Status';
  color: string;
  badgeBg: string;
  barColor: string;
}

const UPPER_PRIMARY_LEVELS: LevelDef[] = [
  {
    code: 'EE',
    label: 'Exceeding',
    category: 'Exceeding',
    color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60',
    badgeBg: 'bg-emerald-600',
    barColor: '#059669',
  },
  {
    code: 'ME',
    label: 'Meeting',
    category: 'Meeting',
    color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800/60',
    badgeBg: 'bg-teal-600',
    barColor: '#0D9488',
  },
  {
    code: 'AE',
    label: 'Approaching',
    category: 'Approaching',
    color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60',
    badgeBg: 'bg-amber-600',
    barColor: '#D97706',
  },
  {
    code: 'BE',
    label: 'Below',
    category: 'Below',
    color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60',
    badgeBg: 'bg-rose-600',
    barColor: '#E11D48',
  },
  {
    code: 'X',
    label: 'Missing',
    category: 'Status',
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    badgeBg: 'bg-slate-500',
    barColor: '#64748B',
  },
  {
    code: 'Y',
    label: 'Irregularity',
    category: 'Status',
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    badgeBg: 'bg-slate-600',
    barColor: '#475569',
  },
];

const JUNIOR_SCHOOL_LEVELS: LevelDef[] = [
  {
    code: 'EE1',
    label: 'Exceeding 1',
    category: 'Exceeding',
    color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60',
    badgeBg: 'bg-emerald-600',
    barColor: '#059669',
  },
  {
    code: 'EE2',
    label: 'Exceeding 2',
    category: 'Exceeding',
    color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60',
    badgeBg: 'bg-emerald-500',
    barColor: '#10B981',
  },
  {
    code: 'ME1',
    label: 'Meeting 1',
    category: 'Meeting',
    color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800/60',
    badgeBg: 'bg-teal-600',
    barColor: '#0D9488',
  },
  {
    code: 'ME2',
    label: 'Meeting 2',
    category: 'Meeting',
    color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800/60',
    badgeBg: 'bg-teal-500',
    barColor: '#14B8A6',
  },
  {
    code: 'AE1',
    label: 'Approaching 1',
    category: 'Approaching',
    color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60',
    badgeBg: 'bg-amber-600',
    barColor: '#D97706',
  },
  {
    code: 'AE2',
    label: 'Approaching 2',
    category: 'Approaching',
    color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60',
    badgeBg: 'bg-amber-500',
    barColor: '#F59E0B',
  },
  {
    code: 'BE1',
    label: 'Below 1',
    category: 'Below',
    color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60',
    badgeBg: 'bg-rose-600',
    barColor: '#E11D48',
  },
  {
    code: 'BE2',
    label: 'Below 2',
    category: 'Below',
    color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60',
    badgeBg: 'bg-rose-500',
    barColor: '#F43F5E',
  },
  {
    code: 'X',
    label: 'Missing',
    category: 'Status',
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    badgeBg: 'bg-slate-500',
    barColor: '#64748B',
  },
  {
    code: 'Y',
    label: 'Irregularity',
    category: 'Status',
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    badgeBg: 'bg-slate-600',
    barColor: '#475569',
  },
];

export const AssessmentCbeDistributionBar: React.FC<AssessmentCbeDistributionBarProps> = ({
  levelCounts,
  totalLearners = 0,
  completeLearnersCount,
}) => {
  const effectiveTotal = completeLearnersCount !== undefined && completeLearnersCount > 0
    ? completeLearnersCount
    : Object.values(levelCounts).reduce((a: number, b: number) => a + b, 0);

  const isUpperPrimary = Boolean(
    levelCounts.EE !== undefined ||
    levelCounts.ME !== undefined ||
    levelCounts.AE !== undefined ||
    levelCounts.BE !== undefined
  );

  const activeLevels = isUpperPrimary ? UPPER_PRIMARY_LEVELS : JUNIOR_SCHOOL_LEVELS;

  return (
    <div className="space-y-4">
      {/* Visual Proportional Distribution Stacked Bar */}
      {effectiveTotal > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#1F2937] dark:text-slate-200">
            <span className="flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
              <span>CBE Competency Distribution Ratio</span>
            </span>
            <span className="text-[11px] text-[#667085] dark:text-slate-400 font-medium">
              {effectiveTotal} Evaluated Candidates
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-0.5 border border-slate-200 dark:border-slate-700">
            {activeLevels.filter((l) => (levelCounts[l.code] || 0) > 0).map((lvl) => {
              const count = levelCounts[lvl.code] || 0;
              const pct = (count / effectiveTotal) * 100;
              return (
                <div
                  key={lvl.code}
                  title={`${lvl.code} (${lvl.label}): ${count} learner(s) (${pct.toFixed(1)}%)`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: lvl.barColor,
                  }}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-90"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Level Count Grid */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-[#1F2937] dark:text-slate-200 uppercase tracking-wider block">
          Performance Level Breakdown (Learner Count)
        </span>

        <div className={`grid grid-cols-2 ${isUpperPrimary ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-5 lg:grid-cols-10'} gap-2`}>
          {activeLevels.map((item) => {
            const count = levelCounts[item.code] || 0;
            const pct = effectiveTotal > 0 ? ((count / effectiveTotal) * 100).toFixed(0) : '0';

            return (
              <div key={item.code} className={`p-2.5 rounded-xl border text-center space-y-0.5 ${item.color}`}>
                <span className="text-[10px] font-extrabold uppercase block tracking-wider">{item.code}</span>
                <span className="text-lg font-black font-mono block">{count}</span>
                <span className="text-[9px] opacity-75 font-medium truncate block">{item.label}</span>
                {effectiveTotal > 0 && count > 0 && (
                  <span className="text-[8.5px] font-bold opacity-60 block font-mono">
                    {pct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
