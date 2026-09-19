import React, { useState } from 'react';
import { Award, Save, CheckCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { Grade } from '../types';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';

interface GradingSettingsProps {
  grades: Grade[];
  onUpdateGrades: (updatedGrades: Grade[]) => Promise<void> | void;
}

export const GradingSettings: React.FC<GradingSettingsProps> = ({
  grades,
  onUpdateGrades,
}) => {
  const [localGrades, setLocalGrades] = useState<Grade[]>(
    grades && grades.length > 0 ? [...grades] : CBE_8_POINT_GRADES
  );
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleGradeChange = (id: string, field: keyof Grade, value: any) => {
    setLocalGrades((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const handleResetToStandard = async () => {
    try {
      setLocalGrades([...CBE_8_POINT_GRADES]);
      await onUpdateGrades([...CBE_8_POINT_GRADES]);
      setToast({
        type: 'success',
        message: 'Reset to official Kenya CBE 8-Point Achievement Scale successfully!',
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to reset grading boundaries.',
      });
    }
  };

  const handleSave = async () => {
    try {
      await onUpdateGrades(localGrades);
      setToast({
        type: 'success',
        message: 'Grading boundaries saved successfully!',
      });
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to save grading boundaries.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Award className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            <span>CBE Grading System Configuration</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enforcing the official Kenya Competency-Based Education (CBE) 8-Point Achievement Scale.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetToStandard}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 transition flex items-center space-x-1.5"
            title="Reset to official Kenya CBE 8-Point Achievement Scale"
          >
            <RotateCcw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Reset to CBE 8-Point Scale</span>
          </button>

          <button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm transition flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Grading Boundaries</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span className="text-xs font-bold leading-tight truncate">{toast.message}</span>
        </div>
      )}

      {/* Grade Thresholds Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
          Competency Grade Boundaries, Levels, Points & Descriptors (8-Point KNEC CBE Scale)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                <th className="p-3 w-20">Code</th>
                <th className="p-3 w-24">Level</th>
                <th className="p-3 w-24">Min Score %</th>
                <th className="p-3 w-24">Max Score %</th>
                <th className="p-3 w-20">Points</th>
                <th className="p-3">Competency Descriptor</th>
                <th className="p-3">Official Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {localGrades.map((g) => {
                const code = g.grade_code || g.grade || '';
                const min = g.minimum_score ?? g.minimum_marks ?? 0;
                const max = g.maximum_score ?? g.maximum_marks ?? 100;
                const level = g.performance_level || 'ME';

                return (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3 font-extrabold text-[#176B45] dark:text-emerald-400">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                          const v = e.target.value;
                          handleGradeChange(g.id, 'grade_code', v);
                          handleGradeChange(g.id, 'grade', v);
                        }}
                        className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 font-bold text-center focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={level}
                        onChange={(e) => handleGradeChange(g.id, 'performance_level', e.target.value as any)}
                        className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 font-bold text-center text-xs focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="EE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">EE</option>
                        <option value="ME" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">ME</option>
                        <option value="AE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">AE</option>
                        <option value="BE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">BE</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={min}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleGradeChange(g.id, 'minimum_score', val);
                          handleGradeChange(g.id, 'minimum_marks', val);
                        }}
                        className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 text-center font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={max}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleGradeChange(g.id, 'maximum_score', val);
                          handleGradeChange(g.id, 'maximum_marks', val);
                        }}
                        className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 text-center font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      <input
                        type="number"
                        value={g.points}
                        onChange={(e) => handleGradeChange(g.id, 'points', Number(e.target.value))}
                        className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 text-center font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={g.descriptor}
                        onChange={(e) => handleGradeChange(g.id, 'descriptor', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={g.remarks}
                        onChange={(e) => handleGradeChange(g.id, 'remarks', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded p-1 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
