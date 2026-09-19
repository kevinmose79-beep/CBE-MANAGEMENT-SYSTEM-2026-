import React, { useState, useEffect } from 'react';
import { X, BookOpen, TrendingUp, BarChart2, History } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Student, Mark, Examination, Subject, Grade, ClassStream, Teacher, User, getApplicableSubjectsForGrade, getEducationLevelForGrade } from '../types';
import { getGradeForMark } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { stripSurroundingQuotes, isLearnerInExamScope } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { buildLearnerTrajectory } from '../services/learnerTrajectoryEngine';
import { getDisplayExamName } from '../utils/examDisplayUtils';
import { api } from '../lib/storage';
import { isClassTeacherFor, getActiveTeacher } from '../utils/rbacUtils';
import { ChartWrapper } from './ChartWrapper';

interface LearnerProfileModalProps {
  student: Student | null;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  teachers: Teacher[];
  currentUser: User | null;
  onClose: () => void;
}

export const LearnerProfileModal: React.FC<LearnerProfileModalProps> = ({
  student,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'current_results' | 'trajectory'>('current_results');
  const [learnerHistoricalMarks, setLearnerHistoricalMarks] = useState<Mark[]>([]);
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);

  // Asynchronously fetch all authoritative marks for this learner from Supabase
  useEffect(() => {
    let isMounted = true;
    const loadHistoricalMarks = async () => {
      if (!student?.id) return;
      setIsLoadingMarks(true);
      try {
        const fetched = await api.fetchMarksForLearner(student.id);
        if (isMounted && fetched && fetched.length > 0) {
          setLearnerHistoricalMarks(fetched);
        }
      } catch (err) {
        console.warn('Error loading learner historical marks for trajectory:', err);
      } finally {
        if (isMounted) {
          setIsLoadingMarks(false);
        }
      }
    };

    loadHistoricalMarks();
    return () => {
      isMounted = false;
    };
  }, [student?.id]);

  if (!student) return null;
  
  // Security check for unauthorized URL access or direct modal opening
  const isAuthorized = () => {
    if (currentUser?.role === 'admin') return true;
    const activeTeacher = getActiveTeacher(currentUser || null, teachers);
    if (!activeTeacher) return false;
    
    // Class Teachers are permitted to view full learner profiles (PII) for their assigned class learners
    if (isClassTeacherFor(activeTeacher, student.stream_id || student.class_id, classes)) {
      return true;
    }
    
    // Subject Teachers are not permitted to view full learner profiles (PII), only marks data.
    return false;
  };

  if (!isAuthorized()) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6 text-center space-y-4">
           <div className="mx-auto w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
             <X className="w-8 h-8" />
           </div>
           <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
           <p className="text-sm text-slate-500">You are not authorized to view the profile of this learner because they are not in your assigned class or stream.</p>
           <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition">
             Close
           </button>
        </div>
      </div>
    );
  }

  const classObj = (classes || []).find((c) => c.id === student.class_id);
  const classNameStr = classObj ? `${classObj.class_name} ${classObj.stream}` : student.class_id;
  const studentEduLevel = student.education_level || classObj?.education_level;
  const studentGrade = student.grade || classObj?.class_name;

  // Combine passed marks with learner-specific historical marks
  const combinedMarksMap = new Map<string, Mark>();
  (marks || []).forEach((m) => {
    if (m && m.id) combinedMarksMap.set(m.id, m);
  });
  learnerHistoricalMarks.forEach((m) => {
    if (m && m.id) combinedMarksMap.set(m.id, m);
  });
  const allStudentMarks = Array.from(combinedMarksMap.values()).filter((m) => {
    const sId = String(m.student_id).trim().toLowerCase();
    return (
      (student.id && String(student.id).trim().toLowerCase() === sId) ||
      (student.admission_number && String(student.admission_number).trim().toLowerCase() === sId)
    );
  });

  // Calculate Long-Term Trajectory Analytics
  const trajectory = buildLearnerTrajectory(
    student,
    exams,
    allStudentMarks,
    subjects,
    grades,
    classes
  );

  // Group marks by examination for the standard CBE results breakdown (filtering out-of-scope exams)
  const inScopeExams = (exams || []).filter((exam) => {
    const histContext = getLearnerClassAtExamTime(student, exam, classes);
    return isLearnerInExamScope(histContext, exam, classes);
  });

  const examBreakdown = inScopeExams.map((exam) => {
    const examClass = getLearnerClassAtExamTime(student, exam, classes);
    const examGrade = examClass ? examClass.class_name : studentGrade;
    
    // Get the standard set of applicable subjects for the student's grade at the time of this exam
    const applicableSubjects = getApplicableSubjectsForGrade(examGrade || '', subjects);

    const eMarks = allStudentMarks.filter((m) => {
      if (m.exam_id !== exam.id) return false;
      const subObj = subjects.find((s) => s.id === m.subject_id);
      if (subObj) {
        // A subject is applicable if it is in the standard applicable subjects for this grade
        const isApplicable = applicableSubjects.some(
          (s) => s.id === subObj.id || (s.subject_code && s.subject_code === subObj.subject_code)
        );
        return isApplicable;
      }
      return true;
    });
    const subjectDetails = eMarks.map((m) => {
      const subObj = subjects.find((s) => s.id === m.subject_id);
      const ev = evaluateMark(m);
      const isAssessed = ev.status === 'Normal' && ev.percentage !== null;
      const gradeObj = isAssessed ? getGradeForMark(ev.percentage!, grades) : null;

      let remarks = 'Not Assessed';
      if (isAssessed && gradeObj) {
        remarks = stripSurroundingQuotes(gradeObj.remarks);
      } else if (ev.status === 'X') {
        remarks = 'Missing Assessment (X)';
      } else if (ev.status === 'Y') {
        remarks = ev.irregularityReason ? `Irregularity (${ev.irregularityReason})` : 'Examination Irregularity (Y)';
      }

      return {
        subject_name: subObj?.subject_name || 'Subject',
        subject_code: subObj?.subject_code || 'SUB',
        marks: m.marks,
        ev,
        isAssessed,
        percentage: ev.percentage,
        gradeObj,
        remarks,
      };
    });

    const assessedDetails = subjectDetails.filter((sd) => sd.isAssessed && sd.percentage !== null && sd.gradeObj !== null);
    const totalMarks = assessedDetails.reduce((sum, item) => sum + item.percentage!, 0);
    const count = assessedDetails.length;
    const avg = count > 0 ? Math.round((totalMarks / count) * 10) / 10 : 0;
    const totalPoints = assessedDetails.reduce((sum, item) => sum + item.gradeObj!.points, 0);
    const avgPoints = count > 0 ? Math.round((totalPoints / count) * 100) / 100 : 0;
    const overallGrade = count > 0 ? getGradeForMark(avg, grades) : null;

    return {
      exam,
      totalRecorded: subjectDetails.length,
      count,
      totalMarks,
      avg,
      totalPoints,
      avgPoints,
      overallGrade,
      subjectDetails,
    };
  });

  // Prepare chart dataset
  const chartData = trajectory.usable_milestones.map((m) => ({
    milestone: m.display_label,
    period: m.academic_period_label,
    exam: m.exam_name,
    grade: m.grade,
    score: m.average_percentage,
    points: m.average_points,
    level: m.performance_level,
    code: m.grade_code,
  }));

  // Helper for trend badge color in trajectory view
  const getTrendBadgeClasses = (trendType: string) => {
    switch (trendType) {
      case 'improving':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      case 'declining':
        return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      case 'stable':
        return 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl max-w-2xl sm:max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 sm:p-5 relative border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-600 text-white font-black font-mono text-lg flex items-center justify-center shrink-0 shadow-sm">
              {student.full_name.charAt(0)}
            </div>
            <div className="pr-8">
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase block mb-0.5">Learner Performance Profile</span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">{student.full_name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-300 font-medium">
                <span>Adm: <strong className="font-mono text-white">{student.admission_number}</strong></span>
                <span className="text-slate-500">•</span>
                <span>{classNameStr}</span>
                <span className="text-slate-500">•</span>
                <span>{student.gender === 'M' ? 'Male' : 'Female'}</span>
                {trajectory.usable_milestones.length >= 2 && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                      <span>{trajectory.trend_icon}</span>
                      <span>{trajectory.trend_label}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => setActiveTab('current_results')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'current_results'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Assessment Results</span>
            </button>

            <button
              onClick={() => setActiveTab('trajectory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'trajectory'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Long-Term Progress</span>
              {trajectory.usable_milestones.length >= 2 && (
                <span className="text-[10px] bg-slate-900/60 px-1.5 py-0.2 rounded font-mono">
                  {trajectory.trend_icon} {trajectory.trend_label}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 md:p-5 space-y-4 max-h-[72vh] overflow-y-auto">

          {/* ========================================================================= */}
          {/* TAB 1: CURRENT / INDIVIDUAL ASSESSMENT RESULTS (EXISTING VIEW)            */}
          {/* ========================================================================= */}
          {activeTab === 'current_results' && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> CBE Assessment Performance
              </h3>

              {examBreakdown.length === 0 || examBreakdown.every((e) => e.totalRecorded === 0) ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  No examination scores recorded for this learner yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {examBreakdown
                    .filter((eb) => eb.totalRecorded > 0)
                    .map(({ exam, count, totalMarks, avg, avgPoints, overallGrade, subjectDetails }) => {
                      const level = overallGrade?.performance_level || 'N/A';
                      const code = overallGrade?.grade_code || overallGrade?.grade || 'N/A';
                      const maxPossibleMarks = count * 100;
                      const roundedTotalMarks = Math.round(totalMarks);

                      return (
                        <div
                          key={exam.id}
                          className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900"
                        >
                          {/* Exam Header & Compact Summary */}
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              {exam.term.toUpperCase()} {exam.year} · {getDisplayExamName(exam.exam_name).toUpperCase()}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                              <span className="whitespace-nowrap">
                                Total: <strong className="font-mono text-slate-900 dark:text-white font-bold">{count > 0 ? `${roundedTotalMarks} / ${maxPossibleMarks}` : '0 / 0'}</strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="whitespace-nowrap font-bold text-slate-900 dark:text-white">
                                {count > 0 ? `${avg}% Mean` : 'N/A Mean'}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                                {count > 0 ? `${avgPoints} Mean Pts` : '0 Mean Pts'}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              {overallGrade ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-black border inline-flex items-center ${
                                    level === 'EE'
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                      : level === 'ME'
                                      ? 'bg-emerald-50 text-[#0F5132] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                      : level === 'AE'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                      : 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                                  }`}
                                >
                                  {level} ({code}) · {overallGrade.points} Pts
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-bold border bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                  Not Assessed
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Subject Breakdown Table */}
                          <div className="overflow-x-auto p-2 sm:p-3">
                            <table className="w-full text-left text-xs border-collapse min-w-[520px]">
                              <thead>
                                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                                  <th className="pb-2 px-1">Learning Area</th>
                                  <th className="pb-2 px-1 text-center">%</th>
                                  <th className="pb-2 px-1 text-center">Level</th>
                                  <th className="pb-2 px-1 text-center">Code</th>
                                  <th className="pb-2 px-1 text-center">Pts</th>
                                  <th className="pb-2 px-1">Remark</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                {subjectDetails.map((sd, i) => {
                                  const isAssessed = sd.isAssessed && sd.gradeObj;
                                  const sLevel = isAssessed ? (sd.gradeObj!.performance_level || 'ME') : sd.ev.status;
                                  const sCode = isAssessed ? (sd.gradeObj!.grade_code || sd.gradeObj!.grade || 'ME1') : (sd.ev.status === 'X' || sd.ev.status === 'Y' ? sd.ev.status : '-');
                                  const pointsStr = isAssessed ? String(sd.gradeObj!.points) : '-';
                                  const displayScoreStr = isAssessed ? `${Math.round(sd.percentage!)}%` : (sd.ev.displayScore || '-');

                                  return (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                      <td className="py-2 px-1 font-bold text-slate-800 dark:text-slate-200">
                                        <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 mr-1.5">{sd.subject_code}</span>
                                        <span className="text-xs">{sd.subject_name}</span>
                                      </td>
                                      <td className="py-2 px-1 text-center font-mono font-bold text-slate-900 dark:text-white">{displayScoreStr}</td>
                                      <td className="py-2 px-1 text-center">
                                        {isAssessed ? (
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                              sLevel === 'EE'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                : sLevel === 'ME'
                                                ? 'bg-emerald-50 text-[#176B45] dark:bg-emerald-950/40 dark:text-emerald-300'
                                                : sLevel === 'AE'
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                            }`}
                                          >
                                            {sLevel}
                                          </span>
                                        ) : (
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                              sd.ev.status === 'Y'
                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                : sd.ev.status === 'X'
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}
                                          >
                                            {sd.ev.status === 'X' ? 'Absent (X)' : sd.ev.status === 'Y' ? 'Irregularity (Y)' : 'Blank'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-1 text-center font-black text-purple-700 dark:text-purple-400">{sCode}</td>
                                      <td className="py-2 px-1 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{pointsStr}</td>
                                      <td className="py-2 px-1 text-slate-600 dark:text-slate-300 text-xs">{sd.remarks}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: LONG-TERM PROGRESS / TRAJECTORY ANALYTICS                          */}
          {/* ========================================================================= */}
          {activeTab === 'trajectory' && (
            <div className="space-y-4">
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Long-Term Progress & Trajectory
                </h3>
                {isLoadingMarks && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                    Syncing marks...
                  </span>
                )}
              </div>

              {trajectory.all_milestones.length === 0 || trajectory.usable_milestones.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
                    <History className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Historical Performance Data</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    No historical examination scores or milestone assessments have been recorded for this learner across terms or academic years.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Overall Trend Summary Card */}
                  <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/60">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Overall Academic Trajectory
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-black border inline-flex items-center gap-1.5 shadow-xs ${getTrendBadgeClasses(
                              trajectory.trend
                            )}`}
                          >
                            <span>{trajectory.trend_icon}</span>
                            <span>{trajectory.trend_label}</span>
                          </span>
                          {trajectory.net_delta !== null && (
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                              {trajectory.net_delta > 0 ? `+${trajectory.net_delta}%` : `${trajectory.net_delta}%`} Overall
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:text-right">
                        <div className="text-xs">
                          <span className="text-[10px] block font-medium text-slate-500 dark:text-slate-400">Progression Span</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {trajectory.grade_progression_span}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {trajectory.trend_description}
                    </p>

                    {/* Compact Metric Highlights */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">Cumulative Mean</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {trajectory.cumulative_mean_percentage !== null ? `${trajectory.cumulative_mean_percentage}%` : 'N/A'}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">Mean Points</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-purple-600 dark:text-purple-400">
                          {trajectory.cumulative_mean_points !== null ? `${trajectory.cumulative_mean_points} Pts` : 'N/A'}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">Milestones Sat</span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                          {trajectory.usable_milestones.length} Term{trajectory.usable_milestones.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">Recent Level</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                          {trajectory.latest_milestone?.performance_level || 'N/A'} ({trajectory.latest_milestone?.grade_code || '-'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Trajectory Line Chart */}
                  {trajectory.usable_milestones.length >= 2 ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Performance Progression Curve
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Mean Score (%) Across Milestones</span>
                      </div>

                      <ChartWrapper className="h-48 sm:h-56 w-full pt-2" hasData={chartData.length > 0}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                            <XAxis
                              dataKey="milestone"
                              stroke="#64748b"
                              fontSize={11}
                              fontWeight={600}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              unit="%"
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-800 space-y-1">
                                      <div className="font-bold text-emerald-400">{data.period}</div>
                                      <div className="text-[11px] text-slate-300">{data.exam}</div>
                                      <div className="text-[11px] text-slate-400">{data.grade}</div>
                                      <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-3">
                                        <span className="font-mono font-black text-white">{data.score}% Mean</span>
                                        <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold text-[10px]">
                                          {data.level} ({data.code})
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="#10b981"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                              activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartWrapper>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <span>⚪</span>
                      <span>A performance curve requires at least 2 comparable assessed milestones. Historical data is listed below.</span>
                    </div>
                  )}

                  {/* Historical Performance Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Chronological Academic Milestones
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {trajectory.all_milestones.length} Recorded Milestone{trajectory.all_milestones.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="overflow-x-auto p-2 sm:p-3">
                      <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                        <thead>
                          <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                            <th className="pb-2 px-1.5">Academic Period</th>
                            <th className="pb-2 px-1.5">Grade / Class</th>
                            <th className="pb-2 px-1.5">Assessment</th>
                            <th className="pb-2 px-1.5 text-center">Subjects</th>
                            <th className="pb-2 px-1.5 text-center">Mean Score</th>
                            <th className="pb-2 px-1.5 text-center">Level & Pts</th>
                            <th className="pb-2 px-1.5 text-center">Step Trend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                          {trajectory.all_milestones.map((m, idx) => {
                            const isUsable = m.has_usable_data;
                            return (
                              <tr key={m.exam_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-1.5 font-bold text-slate-900 dark:text-white">
                                  {m.academic_period_label}
                                </td>
                                <td className="py-2.5 px-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{m.full_class_name || m.grade}</span>
                                    {m.is_historical && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                        Historical
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-1.5 text-slate-700 dark:text-slate-300">
                                  {m.exam_name}
                                </td>
                                <td className="py-2.5 px-1.5 text-center font-mono">
                                  {m.total_assessed_subjects}
                                </td>
                                <td className="py-2.5 px-1.5 text-center font-mono font-bold text-slate-900 dark:text-white">
                                  {isUsable ? `${m.average_percentage}%` : '—'}
                                </td>
                                <td className="py-2.5 px-1.5 text-center">
                                  {isUsable ? (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
                                        m.performance_level === 'EE'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                          : m.performance_level === 'ME'
                                          ? 'bg-emerald-50 text-[#176B45] dark:bg-emerald-950/40 dark:text-emerald-300'
                                          : m.performance_level === 'AE'
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      }`}
                                    >
                                      <span>{m.performance_level}</span>
                                      <span className="text-[10px] opacity-80">({m.grade_code})</span>
                                      <span>·</span>
                                      <span className="font-mono">{m.average_points} Pts</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">Unassessed</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-1.5 text-center">
                                  {!isUsable ? (
                                    <span className="text-slate-400 text-xs">—</span>
                                  ) : m.step_trend === 'initial' ? (
                                    <span className="text-slate-400 text-[11px] font-mono">— Base</span>
                                  ) : m.step_trend === 'improving' ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xs inline-flex items-center gap-0.5">
                                      📈 +{m.step_delta}%
                                    </span>
                                  ) : m.step_trend === 'declining' ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-bold font-mono text-xs inline-flex items-center gap-0.5">
                                      📉 {m.step_delta}%
                                    </span>
                                  ) : (
                                    <span className="text-blue-600 dark:text-blue-400 font-bold font-mono text-xs inline-flex items-center gap-0.5">
                                      ➡️ {m.step_delta! > 0 ? `+${m.step_delta}%` : `${m.step_delta}%`}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeTab === 'trajectory' ? 'Long-term progression derived from CBE assessment history' : 'CBE Competency-Based Assessment Breakdown'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition shadow-xs"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
