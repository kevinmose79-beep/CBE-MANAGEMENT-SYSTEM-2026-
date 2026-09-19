import React, { useState, useMemo } from 'react';
import {
  School,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  ClassStream,
  Teacher,
  LearnerReportComment,
  SchoolTerm,
  getEducationLevelForGrade,
  User as UserType,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  getLearnerReportSubjects,
} from '../services/analysisEngine';
import { getLearnerClassAtExamTime, getStreamCohortStudentIds } from '../services/historicalContextResolver';
import { evaluateMark, formatTwoDecimalAverage } from '../utils/markUtils';
import {
  Download,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  Archive,
  Search,
  Users,
  Award,
  TrendingUp,
  BarChart3,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { isUUID } from '../lib/storage';
import { downloadSingleReportCardPDF } from '../services/pdfReportGenerator';
import { NextTermOpeningDateModal } from './NextTermOpeningDateModal';

export interface AdminBatchAssessmentSummaryProps {
  canModify?: boolean;
  school: School;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  currentUser?: UserType;
  selectedExamId: string;
  selectedClassId: string;
  selectedStreamId: string;
  targetStudents: Student[];
  allStudents: Student[];
  savedRemarksMap: Record<string, LearnerReportComment>;
  onSelectLearner?: (studentId: string) => void;
  onDownloadBatchPdf?: () => Promise<void>;
  isDownloadingBatch?: boolean;
  batchProgress?: { current: number; total: number };
  schoolTerms?: SchoolTerm[];
  confirmedNextTermDate?: string;
  onRequestDownloadSinglePdf?: (student: Student) => void;
}

export const AdminBatchAssessmentSummary: React.FC<AdminBatchAssessmentSummaryProps> = ({
  canModify = false,
  school,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  selectedExamId,
  selectedClassId,
  selectedStreamId,
  targetStudents = [],
  allStudents = [],
  savedRemarksMap = {},
  onSelectLearner,
  onDownloadBatchPdf,
  isDownloadingBatch = false,
  batchProgress = { current: 0, total: 0 },
  schoolTerms = [],
  confirmedNextTermDate = '',
  onRequestDownloadSinglePdf,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [downloadingSingleId, setDownloadingSingleId] = useState<string | null>(null);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);

  const selectedExam = (exams || []).find((e) => e.id === selectedExamId);

  // Authoritative results calculated for entire cohort
  const examResults = useMemo(() => {
    return calculateExamResults(selectedExamId, allStudents, marks, grades, classes, subjects);
  }, [selectedExamId, allStudents, marks, grades, classes, subjects]);

  // Resolve active class/stream label
  const activeClassObj = (classes || []).find((c) => c.id === selectedClassId || c.stream_id === selectedStreamId);
  const streamLabel = activeClassObj
    ? `${activeClassObj.class_name} - ${activeClassObj.stream}`
    : 'Selected Stream';

  // Map each learner to authoritative presentation row
  const studentRows = useMemo(() => {
    return targetStudents.map((std) => {
      const isStdUuid = isUUID(std.id);
      const examContext = selectedExam
        ? getLearnerClassAtExamTime(std, selectedExam, classes)
        : null;
      const isHistoricalContext = examContext?.is_historical === true;

      let targetClass = (classes || []).find(
        (c) => (std.stream_id && (c.stream_id === std.stream_id || c.id === std.stream_id))
      ) || (classes || []).find((c) => c.id === std.class_id);

      if (isHistoricalContext) {
        if (examContext.historical_context_resolved && examContext.class_id) {
          targetClass = (classes || []).find((c) => c.id === examContext.class_id) || ({
            id: examContext.class_id,
            class_name: examContext.class_name,
            stream: examContext.stream_name,
            education_level: getEducationLevelForGrade(examContext.grade),
          } as ClassStream);
        } else {
          targetClass = undefined;
        }
      }

      const targetClassId = isHistoricalContext
        ? (examContext?.class_id || '')
        : (std.class_id || '');

      const studentGrade = isHistoricalContext
        ? (examContext?.grade || 'Unknown Grade')
        : (std.grade || targetClass?.class_name || '');

      const effectiveStudent: Student = isHistoricalContext
        ? { ...std, class_id: targetClassId, grade: studentGrade }
        : std;

      const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
      const totalApplicableSubjects = learnerSubjects.length || 1;

      // Authoritative result for this student
      const matchesStudent = (stdId: string | undefined | null) => {
        if (!stdId) return false;
        const str = String(stdId).trim().toLowerCase();
        if (std.id && String(std.id).trim().toLowerCase() === str) return true;
        if (std.admission_number && String(std.admission_number).trim().toLowerCase() === str) return true;
        return false;
      };

      const studentResult = examResults.find((r) => matchesStudent(r.student_id));

      const isComplete = studentResult ? studentResult.is_complete !== false : false;
      const totalMarks = studentResult?.total_marks || 0;
      const maxPossibleMarks = totalApplicableSubjects * 100;
      const averageScore = studentResult?.average || 0;
      const totalPoints = isComplete ? (studentResult?.total_points || 0) : 0;
      const maxPossiblePoints = totalApplicableSubjects * 8;
      const overallLevel = isComplete ? (studentResult?.performance_level || 'ME') : 'Pending';
      const overallGradeCode = isComplete ? (studentResult?.grade_code || studentResult?.grade || 'ME1') : 'Pending';

      // Assessed subject count
      const assessedSubjectCount =
        studentResult?.subject_count !== undefined
          ? studentResult.subject_count
          : learnerSubjects.filter((sb) => {
              const m = marks.find(
                (mk) =>
                  (mk.student_id === std.id || mk.student_id === std.admission_number) &&
                  (mk.subject_id === sb.id || mk.subject_id === sb.subject_code) &&
                  (mk.exam_id === selectedExamId ||
                    (selectedExam && (mk.exam_id === selectedExam.id || mk.exam_id === selectedExam.exam_code)))
              );
              const evalM = evaluateMark(m);
              return evalM.status === 'Normal' || evalM.status === 'Y';
            }).length;

      // Authoritative stream cohort denominator
      const streamStudentIds = getStreamCohortStudentIds(std, allStudents, selectedExam, classes);
      const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
      const streamAssessedStudentsCount =
        streamResults.filter((r) => r.is_complete !== false).length ||
        streamResults.length ||
        1;

      // Authoritative grade cohort denominator
      const authoritativeGrade = studentGrade || std.grade || '';
      const gradeStudentIds = new Set(
        allStudents
          .filter((s) => authoritativeGrade && s.grade === authoritativeGrade)
          .map((s) => s.id)
      );
      const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
      const totalGradeAssessedStudents =
        gradeResults.filter((r) => r.is_complete !== false).length ||
        gradeResults.length ||
        1;

      // Stream & Grade ranks
      const streamRankNum = studentResult?.class_position || studentResult?.position;
      const gradeRankNum = studentResult?.position;

      // Saved remarks check
      const savedRemark = savedRemarksMap[`${std.id}_${selectedExamId}`];
      const hasRemarks = Boolean(
        savedRemark?.class_teacher_remarks?.trim() || savedRemark?.head_teacher_remarks?.trim()
      );

      return {
        student: std,
        effectiveStudent,
        targetClass,
        studentGrade,
        isComplete,
        totalMarks,
        maxPossibleMarks,
        averageScore,
        totalPoints,
        maxPossiblePoints,
        overallLevel,
        overallGradeCode,
        assessedSubjectCount,
        totalApplicableSubjects,
        streamRankNum,
        streamAssessedStudentsCount,
        gradeRankNum,
        totalGradeAssessedStudents,
        hasRemarks,
        savedRemark,
      };
    });
  }, [
    targetStudents,
    selectedExam,
    classes,
    subjects,
    teachers,
    examResults,
    allStudents,
    marks,
    selectedExamId,
    savedRemarksMap,
  ]);

  // Filtered rows for search & status tabs
  const filteredRows = useMemo(() => {
    return studentRows.filter((row) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        row.student.full_name.toLowerCase().includes(q) ||
        row.student.admission_number.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'complete' && row.isComplete) ||
        (statusFilter === 'incomplete' && !row.isComplete);

      return matchesSearch && matchesStatus;
    });
  }, [studentRows, searchQuery, statusFilter]);

  // Aggregate Cohort Metrics
  const totalLearners = studentRows.length;
  const completeCount = studentRows.filter((r) => r.isComplete).length;
  const incompleteCount = totalLearners - completeCount;

  const classMeanScore = useMemo(() => {
    const assessed = studentRows.filter((r) => r.assessedSubjectCount > 0);
    if (assessed.length === 0) return 0;
    const sum = assessed.reduce((acc, r) => acc + r.averageScore, 0);
    return Math.round(sum / assessed.length);
  }, [studentRows]);

  const classGradeObj = useMemo(() => {
    return getGradeForMark(classMeanScore, grades);
  }, [classMeanScore, grades]);

  // Single PDF download handler
  const executeSinglePdfDownload = async (student: Student, dateStr: string) => {
    setDownloadingSingleId(student.id);
    try {
      await downloadSingleReportCardPDF({
        student,
        school,
        exam: selectedExam,
        allExams: exams,
        classes,
        subjects,
        marks,
        grades,
        teachers,
        allStudents,
        nextTermOpeningDate: dateStr,
        savedRemarks: savedRemarksMap[`${student.id}_${selectedExamId}`],
      });
    } catch (err) {
      console.error('Error generating single learner PDF:', err);
    } finally {
      setDownloadingSingleId(null);
      setModalStudent(null);
    }
  };

  const handleDownloadSinglePdf = async (student: Student) => {
    if (onRequestDownloadSinglePdf) {
      onRequestDownloadSinglePdf(student);
      return;
    }

    const effectiveDate = (confirmedNextTermDate || savedRemarksMap[`${student.id}_${selectedExamId}`]?.next_term_opening_date || '').trim();
    if (!effectiveDate) {
      setModalStudent(student);
      return;
    }

    await executeSinglePdfDownload(student, effectiveDate);
  };

  return (
    <div className="space-y-6" id="admin-batch-assessment-summary">
      {/* 1. ADMINISTRATIVE HEADER & BATCH ACTION BAR */}
      <div
        id="batch-summary-header"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Batch Assessment Roster &mdash; {streamLabel}
                </h2>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                  {totalLearners} Learners
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedExam?.exam_name || 'Summative Assessment'} &bull; {selectedExam?.term || 'Term 1'} {selectedExam?.year || 2026}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Batch Combined PDF */}
        <div className="flex items-center space-x-3">
          <button
            id="download-all-batch-pdf-btn"
            onClick={onDownloadBatchPdf}
            disabled={isDownloadingBatch || totalLearners === 0}
            className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow transition flex items-center space-x-2 text-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDownloadingBatch ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isDownloadingBatch
                ? `Generating Combined PDF (${batchProgress.current}/${batchProgress.total})...`
                : `Download All ${totalLearners} Reports (Combined PDF)`}
            </span>
          </button>
        </div>
      </div>

      {/* 2. HIGH-LEVEL COHORT PERFORMANCE OVERVIEW METRICS */}
      <div
        id="batch-summary-kpis"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Class Cohort</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {totalLearners}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Active stream learners
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Fully Assessed</span>
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {completeCount} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/ {totalLearners}</span>
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5 font-medium">
            {totalLearners > 0 ? Math.round((completeCount / totalLearners) * 100) : 0}% Complete
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Provisional / Incomplete</span>
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1">
            {incompleteCount}
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
            {incompleteCount === 0 ? 'All assessed' : 'Pending marks evaluation'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Stream Mean Score</span>
          </div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {classMeanScore}%
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Cohort average percentage
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Cohort Level</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 flex items-center space-x-1.5">
            <span>{classGradeObj.performance_level}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">({classGradeObj.grade_code || classGradeObj.grade})</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {classGradeObj.descriptor}
          </div>
        </div>
      </div>

      {/* 3. ROSTER SEARCH & STATUS FILTER TOOLBAR */}
      <div
        id="batch-roster-toolbar"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="batch-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or admission number..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All ({studentRows.length})
          </button>
          <button
            onClick={() => setStatusFilter('complete')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
              statusFilter === 'complete'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            Complete ({completeCount})
          </button>
          <button
            onClick={() => setStatusFilter('incomplete')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
              statusFilter === 'incomplete'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            Provisional ({incompleteCount})
          </button>
        </div>
      </div>

      {/* 4. WEB-NATIVE ADMINISTRATIVE BATCH ASSESSMENT ROSTER */}
      <div
        id="batch-roster-table-container"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-tight text-[11px]">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[180px]">Learner Details</th>
                <th className="py-3 px-2 text-center w-20">Subjects</th>
                <th className="py-3 px-2 text-center w-24">Total Score</th>
                <th className="py-3 px-2 text-center w-16">Mean %</th>
                <th className="py-3 px-2 text-center w-24">CBE Level</th>
                <th className="py-3 px-2 text-center w-16">Points</th>
                <th className="py-3 px-2 text-center w-20">Stream Rank</th>
                <th className="py-3 px-2 text-center w-20">Grade Rank</th>
                <th className="py-3 px-2 text-center w-24">Status</th>
                <th className="py-3 px-2 text-center w-20">Remarks</th>
                <th className="py-3 px-3 text-right min-w-[170px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-xs">No learners match the current filter or search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isDownloadingThis = downloadingSingleId === row.student.id;

                  return (
                    <tr
                      key={row.student.id}
                      id={`batch-row-${row.student.id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition duration-150"
                    >
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Learner Identity */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {row.student.full_name}
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-mono font-semibold text-[#0F5132] dark:text-emerald-400">
                            {row.student.admission_number}
                          </span>
                          <span>&bull;</span>
                          <span>{row.student.gender === 'M' ? 'Male' : 'Female'}</span>
                        </div>
                      </td>

                      {/* Subjects Assessed */}
                      <td className="py-3 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                        <span>{row.assessedSubjectCount}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500"> / {row.totalApplicableSubjects}</span>
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-2 text-center font-mono font-extrabold text-slate-900 dark:text-slate-100">
                        {row.totalMarks}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal"> / {row.maxPossibleMarks}</span>
                      </td>

                      {/* Mean % */}
                      <td className="py-3 px-2 text-center font-black text-amber-700 dark:text-amber-400">
                        {formatTwoDecimalAverage(row.averageScore)}%
                      </td>

                      {/* Overall CBE Level */}
                      <td className="py-3 px-2 text-center">
                        {row.isComplete ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black inline-block border ${
                              row.overallLevel === 'EE'
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : row.overallLevel === 'ME'
                                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : row.overallLevel === 'AE'
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {row.overallLevel} ({row.overallGradeCode})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Provisional
                          </span>
                        )}
                      </td>

                      {/* Total Points */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-purple-700 dark:text-purple-300">
                        {row.isComplete ? `${row.totalPoints} Pts` : '-'}
                      </td>

                      {/* Stream Rank */}
                      <td className="py-3 px-2 text-center font-extrabold text-slate-800 dark:text-slate-200">
                        {row.isComplete && row.streamRankNum ? (
                          <span>
                            {row.streamRankNum}{' '}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              / {row.streamAssessedStudentsCount}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Grade Rank */}
                      <td className="py-3 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {row.isComplete && row.gradeRankNum ? (
                          <span>
                            {row.gradeRankNum}{' '}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                              / {row.totalGradeAssessedStudents}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Assessment Status */}
                      <td className="py-3 px-2 text-center">
                        {row.isComplete ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Complete</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Provisional</span>
                          </span>
                        )}
                      </td>

                      {/* Remarks Status */}
                      <td className="py-3 px-2 text-center">
                        {row.hasRemarks ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Saved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions: View Assessment + Download PDF */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {onSelectLearner && (
                            <button
                              id={`view-assessment-${row.student.id}`}
                              onClick={() => onSelectLearner(row.student.id)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center space-x-1 cursor-pointer"
                              title="Open Individual Assessment Review"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span className="hidden xl:inline">Review</span>
                            </button>
                          )}

                          <button
                            id={`download-single-pdf-${row.student.id}`}
                            onClick={() => handleDownloadSinglePdf(row.student)}
                            disabled={isDownloadingThis}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                            title="Download Official PDF Report Card"
                          >
                            {isDownloadingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden xl:inline">PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANDATORY NEXT TERM OPENING DATE GATE MODAL */}
      <NextTermOpeningDateModal
        isOpen={Boolean(modalStudent)}
        exam={selectedExam}
        schoolTerms={schoolTerms}
        initialDate={confirmedNextTermDate}
        studentName={modalStudent?.full_name}
        downloadContext="single"
        onConfirm={(confirmedDate) => {
          if (modalStudent) {
            executeSinglePdfDownload(modalStudent, confirmedDate);
          }
        }}
        onClose={() => setModalStudent(null)}
        isProcessing={Boolean(downloadingSingleId)}
      />
    </div>
  );
};
