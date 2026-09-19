import React, { useState, useEffect } from 'react';
import { UserCheck, ArrowRight, ShieldCheck, History, CheckSquare, Square, Users, AlertCircle, RefreshCw, X } from 'lucide-react';
import { Student, ClassStream, GradeName, ALL_GRADES, getEducationLevelForGrade, TermName } from '../types';
import { db, api } from '../lib/storage';
import { isTermModifiable, getTermStatusMessage } from '../utils/termStatusUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';

interface StudentPromotionModuleProps {
  students: Student[];
  classes: ClassStream[];
  onRefreshData?: () => void;
}

export const StudentPromotionModule: React.FC<StudentPromotionModuleProps> = ({
  students = [],
  classes = [],
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'promote' | 'history'>('promote');

  const { activeYear, activeTerm, viewingYear, viewingTerm, viewingTerm: activeTermObj } = useAcademicSession();
  const canModify = isTermModifiable(activeTermObj.status);

  // Source selections
  const [sourceGrade, setSourceGrade] = useState<GradeName | ''>('');
  const [sourceClassId, setSourceClassId] = useState<string>('');
  const [sourceYear, setSourceYear] = useState<number>(() => viewingYear?.year || activeYear?.year || 2026);
  const [sourceTerm, setSourceTerm] = useState<TermName>(() => (viewingTerm?.term_name as TermName) || (activeTerm?.term_name as TermName) || 'Term 3');

  // Auto-sync with current viewing term session
  useEffect(() => {
    if (viewingYear?.year) {
      setSourceYear(viewingYear.year);
      setTargetYear(viewingYear.year + 1);
    }
    if (viewingTerm?.term_name) {
      setSourceTerm(viewingTerm.term_name as TermName);
    }
  }, [viewingYear?.year, viewingTerm?.term_name]);

  // Target selections
  const [targetGrade, setTargetGrade] = useState<GradeName | ''>('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [targetYear, setTargetYear] = useState<number>(() => (activeYear?.year || 2026) + 1);
  const [targetTerm, setTargetTerm] = useState<TermName>('Term 1');

  // Selected student IDs
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Academic years list
  const academicYears = api.getAcademicYears();
  const availableYears = Array.from(
    new Set([
      ...academicYears.map((y) => y.year),
      sourceYear,
      targetYear,
      2024,
      2025,
      2026,
      2027,
      2028,
    ])
  ).sort((a, b) => a - b);

  const TERMS: TermName[] = ['Term 1', 'Term 2', 'Term 3'];

  // Auto-set suggested target grade & year when source grade/year changes
  const handleSourceGradeChange = (newSource: GradeName | '') => {
    setSourceGrade(newSource);
    setSourceClassId('');
    if (!newSource) {
      setTargetGrade('');
    } else {
      const currentIndex = ALL_GRADES.indexOf(newSource);
      if (currentIndex >= 0 && currentIndex < ALL_GRADES.length - 1) {
        setTargetGrade(ALL_GRADES[currentIndex + 1]);
      } else {
        setTargetGrade('');
      }
    }
    setSelectedStudentIds([]);
  };

  const handleSourceYearChange = (newYear: number) => {
    setSourceYear(newYear);
    setTargetYear(newYear + 1);
  };

  // Filter learners for source grade and class
  const eligibleStudents = students.filter((std) => {
    if (!std.active) return false;
    const stdClass = classes.find((c) => c.id === std.class_id);
    const currentGrade = std.grade || stdClass?.class_name;
    if (currentGrade !== sourceGrade) return false;
    if (sourceClassId !== 'all' && std.class_id !== sourceClassId) return false;
    return true;
  });

  const selectedStudents = eligibleStudents.filter((s) => selectedStudentIds.includes(s.id));

  const handleSelectAll = () => {
    if (selectedStudentIds.length === eligibleStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(eligibleStudents.map((s) => s.id));
    }
  };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sid) => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleOpenConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!canModify) {
      setErrorMessage(getTermStatusMessage(activeTermObj.status));
      return;
    }
    if (selectedStudentIds.length === 0) {
      setErrorMessage('Please select at least one student to promote.');
      return;
    }
    if (!targetGrade) {
      setErrorMessage('Please select a target grade.');
      return;
    }

    // Prevent accidental promotion to exact identical state
    if (
      sourceGrade === targetGrade &&
      (sourceClassId === targetClassId || (!targetClassId && sourceClassId === 'all')) &&
      sourceYear === targetYear &&
      sourceTerm === targetTerm
    ) {
      setErrorMessage('Destination position (Grade, Class, Year, Term) must be different from current position.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const executePromotion = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await db.promoteStudents(
        selectedStudentIds,
        targetGrade,
        targetClassId || undefined,
        'Administrator',
        sourceYear,
        sourceTerm,
        targetYear,
        targetTerm
      );
      setSuccessMessage(
        `Successfully promoted ${selectedStudentIds.length} learner(s) from ${sourceGrade} (${sourceYear} ${sourceTerm}) to ${targetGrade} (${targetYear} ${targetTerm})!`
      );
      setSelectedStudentIds([]);
      setIsConfirmModalOpen(false);
      if (onRefreshData) {
        await onRefreshData();
      }
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Promotion error:', err);
      setErrorMessage(err?.message || 'Failed to promote learners.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extract all promotion history records from all students
  const allPromotionHistory = students
    .flatMap((s) => {
      if (!s.promotion_history || s.promotion_history.length === 0) return [];
      return s.promotion_history.map((rec) => ({
        ...rec,
        student_name: s.full_name,
        admission_number: s.admission_number,
      }));
    })
    .sort((a, b) => new Date(b.date_promoted).getTime() - new Date(a.date_promoted).getTime());

  // Classes matching target grade & source grade
  const targetClasses = classes.filter((c) => c.class_name === targetGrade && c.status !== 'Inactive');
  const sourceClasses = classes.filter((c) => c.class_name === sourceGrade);

  const sourceClassObj = classes.find((c) => c.id === sourceClassId);
  const targetClassObj = classes.find((c) => c.id === targetClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Learner Promotion & Progression Module</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Bulk promote learners from Pre-Primary through Junior School while preserving comprehensive academic audit records.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('promote')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition ${
              activeTab === 'promote' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Promote Learners
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition flex items-center space-x-1 ${
              activeTab === 'history' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Promotion Logs ({allPromotionHistory.length})</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeTab === 'promote' && (
        <div className="space-y-6">
          {/* Step 1: Select Source & Target Grades, Academic Year & Term */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              1. Define Progression Route
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* CURRENT POSITION (SOURCE) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    CURRENT POSITION (BEFORE PROMOTION)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-full">
                    {sourceGrade ? getEducationLevelForGrade(sourceGrade) : 'Select Grade'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Current Grade *</label>
                    <select
                      value={sourceGrade}
                      onChange={(e) => handleSourceGradeChange(e.target.value as GradeName)}
                      className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Grade...</option>
                      {ALL_GRADES.map((g) => (
                        <option key={g} value={g} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${!sourceGrade ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>Stream Filter</label>
                    <select
                      value={sourceGrade ? sourceClassId : ''}
                      disabled={!sourceGrade}
                      onChange={(e) => {
                        setSourceClassId(e.target.value);
                        setSelectedStudentIds([]);
                      }}
                      className={`w-full rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 transition ${
                        !sourceGrade
                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <option value="">{!sourceGrade ? 'Select Grade First...' : 'All Streams'}</option>
                      {sourceGrade && sourceClasses.map((c) => (
                        <option key={c.stream_id || `${c.id}_${c.stream}`} value={c.stream_id || c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{c.stream}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Current Year *</label>
                    <select
                      value={sourceYear}
                      onChange={(e) => handleSourceYearChange(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Current Term *</label>
                    <select
                      value={sourceTerm}
                      onChange={(e) => setSourceTerm(e.target.value as TermName)}
                      className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      {TERMS.map((t) => (
                        <option key={t} value={t} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* DESTINATION POSITION (TARGET) */}
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center space-x-1">
                    <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>DESTINATION POSITION (PROMOTED TO)</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold rounded-full">
                    {targetGrade ? getEducationLevelForGrade(targetGrade) : 'Select Grade'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-1">Promoted-To Grade *</label>
                    <select
                      value={targetGrade}
                      onChange={(e) => {
                        setTargetGrade(e.target.value as GradeName);
                        setTargetClassId('');
                      }}
                      className="w-full border border-emerald-300 dark:border-emerald-700/80 rounded-lg p-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Grade...</option>
                      {ALL_GRADES.map((g) => (
                        <option key={g} value={g} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${!targetGrade ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-900 dark:text-emerald-300'}`}>Assign Stream (Optional)</label>
                    <select
                      value={targetGrade ? targetClassId : ''}
                      disabled={!targetGrade}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className={`w-full rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 transition ${
                        !targetGrade
                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'border border-emerald-300 dark:border-emerald-700/80 text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                        {!targetGrade ? 'Select Promoted Grade First...' : '-- Keep Current Stream Name --'}
                      </option>
                      {targetGrade && targetClasses.map((c) => (
                        <option key={c.stream_id || `${c.id}_${c.stream}`} value={c.stream_id || c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{c.class_name} - {c.stream}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-1">Promoted-To Year *</label>
                    <select
                      value={targetYear}
                      onChange={(e) => setTargetYear(Number(e.target.value))}
                      className="w-full border border-emerald-300 dark:border-emerald-700/80 rounded-lg p-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-1">Promoted-To Term *</label>
                    <select
                      value={targetTerm}
                      onChange={(e) => setTargetTerm(e.target.value as TermName)}
                      className="w-full border border-emerald-300 dark:border-emerald-700/80 rounded-lg p-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
                    >
                      {TERMS.map((t) => (
                        <option key={t} value={t} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Learner Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                  <span>2. Select Learners to Promote ({eligibleStudents.length} Eligible)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select individual learners or check all to execute batch progression.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center space-x-1.5"
                >
                  {selectedStudentIds.length === eligibleStudents.length && eligibleStudents.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  )}
                  <span>
                    {selectedStudentIds.length === eligibleStudents.length && eligibleStudents.length > 0
                      ? 'Deselect All'
                      : `Select All (${eligibleStudents.length})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenConfirmation}
                  disabled={selectedStudentIds.length === 0 || isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition flex items-center space-x-2 text-xs"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Promote Selected ({selectedStudentIds.length})</span>
                </button>
              </div>
            </div>

            {eligibleStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 w-10 text-center">Select</th>
                      <th className="p-3">Admission No</th>
                      <th className="p-3">Learner Name</th>
                      <th className="p-3">Gender</th>
                      <th className="p-3">Current Position</th>
                      <th className="p-3">Level</th>
                      <th className="p-3">Promotion Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {eligibleStudents.map((std) => {
                      const isSelected = selectedStudentIds.includes(std.id);
                      const stdClass = classes.find((c) => c.id === std.class_id);
                      const hasHistory = std.promotion_history && std.promotion_history.length > 0;
                      return (
                        <tr
                          key={std.id}
                          onClick={() => toggleStudent(std.id)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-emerald-50/70 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="p-3 text-center">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 inline" />
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{std.admission_number}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{std.full_name}</td>
                          <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">{std.gender}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {sourceGrade} - {stdClass?.stream || 'Main'} ({sourceYear} {sourceTerm})
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-semibold">
                              {getEducationLevelForGrade(sourceGrade)}
                            </span>
                          </td>
                          <td className="p-3">
                            {hasHistory ? (
                              <span className="px-2 py-0.5 bg-[#E8F3EE] dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 border border-transparent dark:border-emerald-800/60 rounded text-[10px] font-bold">
                                Promoted ({std.promotion_history?.length} times)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-semibold">
                                Initial Enrolment
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <span>No active learners found in {sourceGrade} matching your filter criteria.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
            Learner Progression Audit Log
          </h2>

          {allPromotionHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3">Date</th>
                    <th className="p-3">Admission No</th>
                    <th className="p-3">Learner Name</th>
                    <th className="p-3">FROM (Current Before)</th>
                    <th className="p-3">TO (Promoted Position)</th>
                    <th className="p-3">Promoted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allPromotionHistory.map((rec) => {
                    const fromClassObj = classes.find((c) => c.id === rec.from_class_id);
                    const toClassObj = classes.find((c) => c.id === rec.to_class_id);

                    const fromClassName = fromClassObj
                      ? `${fromClassObj.class_name} ${fromClassObj.stream}`
                      : rec.from_grade;
                    const toClassName = toClassObj
                      ? `${toClassObj.class_name} ${toClassObj.stream}`
                      : rec.to_grade;

                    const fromYr = rec.from_year || (rec.date_promoted ? new Date(rec.date_promoted).getFullYear() : 2026);
                    const fromTrm = rec.from_term || 'Term 3';
                    const toYr = rec.to_year || (fromYr + 1);
                    const toTrm = rec.to_term || 'Term 1';

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{rec.date_promoted}</td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{rec.admission_number}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{rec.student_name}</td>
                        <td className="p-3">
                          <div className="space-y-0.5 text-[11px]">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-bold inline-block">
                              {fromClassName}
                            </span>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              Year: {fromYr} • {fromTrm}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5 text-[11px]">
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-transparent dark:border-emerald-800/60 rounded font-bold inline-block">
                              {toClassName}
                            </span>
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                              Year: {toYr} • {toTrm}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">{rec.promoted_by || 'Admin'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
              No learner promotion records logged yet.
            </div>
          )}
        </div>
      )}

      {/* Confirmation Screen Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>PROMOTION SUMMARY & CONFIRMATION</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
              You are about to promote <strong className="text-slate-900 dark:text-slate-100">{selectedStudents.length} learner(s)</strong>.
              Please review current position and destination position details below:
            </div>

            {/* Side-by-side current vs destination summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CURRENT POSITION */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2">
                <div className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  CURRENT POSITION
                </div>
                <div className="text-xs space-y-2 text-slate-800 dark:text-slate-200 font-semibold">
                  <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                    <span className="text-slate-500 dark:text-slate-400 font-normal">Class:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {sourceGrade} {sourceClassObj ? `(${sourceClassObj.stream})` : sourceClassId !== 'all' ? '' : '(All Streams)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                    <span className="text-slate-500 dark:text-slate-400 font-normal">Academic Year:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{sourceYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-normal">Term:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{sourceTerm}</span>
                  </div>
                </div>
              </div>

              {/* PROMOTED TO */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-2">
                <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 tracking-wider flex items-center justify-between">
                  <span>PROMOTED TO</span>
                  <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xs space-y-2 text-emerald-950 dark:text-emerald-200 font-semibold">
                  <div className="flex justify-between border-b border-emerald-200/60 dark:border-emerald-800/50 pb-1">
                    <span className="text-emerald-700 dark:text-emerald-400 font-normal">Class:</span>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">
                      {targetGrade} {targetClassObj ? `(${targetClassObj.stream})` : '-- Keep Current Stream --'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-200/60 dark:border-emerald-800/50 pb-1">
                    <span className="text-emerald-700 dark:text-emerald-400 font-normal">Academic Year:</span>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">{targetYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400 font-normal">Term:</span>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">{targetTerm}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected learners list preview */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                Selected Learners ({selectedStudents.length}):
              </label>
              <div className="max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg p-2 divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {selectedStudents.map((s) => (
                  <div key={s.id} className="py-1 flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">{s.full_name}</span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{s.admission_number}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executePromotion}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-sm transition flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
                <span>Confirm Promotion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
