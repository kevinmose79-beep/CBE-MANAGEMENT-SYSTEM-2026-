import React, { useState, useEffect } from 'react';
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
  getShortCbeCode,
  User as UserType,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  calculateSubjectRank,
  getLearnerReportSubjects,
} from '../services/analysisEngine';
import { generatePersonalizedLearnerComment } from '../services/learnerCommentGenerator';
import { getLearnerClassAtExamTime, getStreamCohortStudentIds } from '../services/historicalContextResolver';
import { evaluateMark, formatTwoDecimalAverage } from '../utils/markUtils';
import {
  Award,
  CheckCircle,
  Edit3,
  User,
  Calendar,
  Shield,
  Save,
  Download,
  Loader2,
  FileText,
  AlertTriangle,
  AlertCircle,
  BookOpen,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { downloadSingleReportCardPDF } from '../services/pdfReportGenerator';
import { resolveSuggestedNextTermOpeningDate } from '../services/nextTermOpeningDateResolver';
import { NextTermOpeningDateModal } from './NextTermOpeningDateModal';
import { stripSurroundingQuotes } from '../utils/filterUtils';
import {
  isKiswahiliSubject,
  getKiswahiliDefaultComment,
  validateKiswahiliComment,
} from '../utils/kiswahiliCommentValidator';
import {
  getActiveTeacher,
  canUserEditSubjectMarks,
  canUserEditClassTeacherRemarks,
} from '../utils/rbacUtils';
import { resolveSubjectTeacher } from '../utils/teacherResolutionUtils';

export interface AdminLearnerAssessmentSummaryProps {
  student: Student;
  school: School;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  currentUser?: UserType;
  selectedExamId: string;
  allStudents: Student[];
  savedRemarks?: LearnerReportComment;
  onSaveRemarks?: (studentId: string, examId: string, remarks: Partial<LearnerReportComment>) => void;
  canModify?: boolean;
  schoolTerms?: SchoolTerm[];
  confirmedNextTermDate?: string;
  onRequestDownloadWithDate?: (student: Student, exam?: Examination) => void;
}

export const AdminLearnerAssessmentSummary: React.FC<AdminLearnerAssessmentSummaryProps> = ({
  canModify = false,
  student,
  school,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  selectedExamId,
  allStudents = [],
  onSaveRemarks,
  savedRemarks,
  schoolTerms = [],
  confirmedNextTermDate = '',
  onRequestDownloadWithDate,
}) => {
  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);
  const isAdmin = currentUser?.role === 'admin';
  const selectedExam = (exams || []).find((e) => e.id === selectedExamId);

  // Resolve learner historical class, stream, and grade context for selected exam
  const examContext = selectedExam
    ? getLearnerClassAtExamTime(student, selectedExam, classes)
    : null;
  const isHistoricalContext = examContext?.is_historical === true;

  let targetClass = (classes || []).find((c) =>
    (student.stream_id && (c.stream_id === student.stream_id || c.id === student.stream_id))
  ) || (classes || []).find((c) => c.id === student.class_id);
  if (isHistoricalContext) {
    if (examContext.historical_context_resolved && examContext.class_id) {
      targetClass = (classes || []).find((c) => c.id === examContext.class_id) || {
        id: examContext.class_id,
        class_name: examContext.class_name,
        stream: examContext.stream_name,
        education_level: getEducationLevelForGrade(examContext.grade),
      } as ClassStream;
    } else {
      targetClass = undefined;
    }
  }

  const targetClassId = isHistoricalContext
    ? (examContext?.class_id || '')
    : (student.class_id || '');

  const targetStreamId = isHistoricalContext
    ? (examContext?.stream_id || targetClass?.stream_id || '')
    : (student.stream_id || targetClass?.stream_id || '');

  const classNameStr = isHistoricalContext
    ? (examContext?.full_class_name || 'Unknown Grade')
    : (targetClass
        ? `${targetClass.class_name} - ${targetClass.stream}`
        : student.class_id || student.grade || 'Grade 7');

  const studentGrade = isHistoricalContext
    ? (examContext?.grade || 'Unknown Grade')
    : (student.grade || targetClass?.class_name || '');

  const studentLevel = getEducationLevelForGrade(studentGrade);

  const effectiveStudent: Student = isHistoricalContext
    ? { ...student, class_id: targetClassId, stream_id: targetStreamId, grade: studentGrade }
    : student;

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const isClassTeacher = canUserEditClassTeacherRemarks(currentUser || null, activeTeacher, targetClassId || student.class_id, classes);

  // Find class teacher name for historical or current target class
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) ||
       teachers.find(
         (t) =>
           t.is_class_teacher &&
           (t.class_teacher_of_id === targetClassId || (t.allocations || []).some(a => a.class_id === targetClassId))
       ) ||
       teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;

  const defaultClassTeacherName = classTeacher
    ? classTeacher.teacher_name
    : `${targetClass?.stream || examContext?.stream_name || ''} Class Teacher`.trim() || 'Class Teacher';

  // Calculate overall student results for this exam
  const examResults = calculateExamResults(selectedExamId, allStudents, marks, grades, classes, subjects);
  const matchesReportStudent = (stdId: string | undefined | null) => {
    if (!stdId) return false;
    const str = String(stdId).trim().toLowerCase();
    if (student.id && String(student.id).trim().toLowerCase() === str) return true;
    if (student.admission_number && String(student.admission_number).trim().toLowerCase() === str) return true;
    return false;
  };

  const studentResult = examResults.find((r) => matchesReportStudent(r.student_id));

  // Auto-calculated defaults
  const isAssessmentComplete = studentResult ? studentResult.is_complete !== false : false;
  const totalMarks = studentResult?.total_marks || 0;
  const averageScore = studentResult?.average || 0;
  const totalPoints = isAssessmentComplete ? (studentResult?.total_points || 0) : 0;
  const overallLevel = isAssessmentComplete ? (studentResult?.performance_level || 'ME') : 'Pending';
  const overallGradeCode = isAssessmentComplete ? (studentResult?.grade_code || studentResult?.grade || 'ME1') : 'Pending';
  const overallRank = isAssessmentComplete && studentResult?.position ? `${studentResult.position}` : 'Not Yet Ranked';
  const streamRank = isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `${studentResult.class_position || studentResult.position}` : 'Not Yet Ranked';

  // Authoritative grade cohort (across streams)
  const authoritativeGrade = studentGrade || student.grade || '';
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

  // Authoritative stream cohort
  const streamStudentIds = getStreamCohortStudentIds(student, allStudents, selectedExam, classes);
  const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
  const streamAssessedStudentsCount =
    streamResults.filter((r) => r.is_complete !== false).length ||
    streamResults.length ||
    1;

  // Maximum possible score & points calculation
  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 8;

  // Dynamic Personalised Remark Builders based on actual learner data
  const getDefaultClassTeacherComment = () => {
    return generatePersonalizedLearnerComment({
      student: effectiveStudent,
      examId: selectedExamId,
      marks,
      subjects: learnerSubjects,
      grades,
      exams,
      averageScore,
      averagePoints: studentResult?.average_points || 0,
      overallLevel,
      commentType: 'class_teacher',
      isProvisional: !isAssessmentComplete,
    });
  };

  const getDefaultHOIComment = () => {
    return generatePersonalizedLearnerComment({
      student: effectiveStudent,
      examId: selectedExamId,
      marks,
      subjects: learnerSubjects,
      grades,
      exams,
      averageScore,
      averagePoints: studentResult?.average_points || 0,
      overallLevel,
      commentType: 'hoi',
      isProvisional: !isAssessmentComplete,
    });
  };

  // Editable Remarks State
  const suggestedNextTerm = resolveSuggestedNextTermOpeningDate(selectedExam, schoolTerms);
  const [classTeacherComment, setClassTeacherComment] = useState(
    savedRemarks?.class_teacher_comment || getDefaultClassTeacherComment()
  );
  const [classTeacherName, setClassTeacherName] = useState(
    savedRemarks?.class_teacher_name || defaultClassTeacherName
  );
  const [hoiComment, setHoiComment] = useState(
    savedRemarks?.hoi_comment || getDefaultHOIComment()
  );
  const [hoiName, setHoiName] = useState(
    savedRemarks?.hoi_name || school.principal_name || 'Head of Institution'
  );
  const [nextTermOpeningDate, setNextTermOpeningDate] = useState<string>(
    confirmedNextTermDate || savedRemarks?.next_term_opening_date || suggestedNextTerm?.formattedDate || ''
  );

  // Subject Comments State
  const [customSubjectComments, setCustomSubjectComments] = useState<Record<string, string>>(
    savedRemarks?.subject_comments || {}
  );
  const [saveValidationMessage, setSaveValidationMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isApproved, setIsApproved] = useState(savedRemarks?.is_approved ?? true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  const executePdfDownload = async (dateStr: string) => {
    setIsDownloadingPdf(true);
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
        savedRemarks: {
          student_id: student.id,
          exam_id: selectedExamId,
          class_teacher_comment: classTeacherComment,
          class_teacher_name: classTeacherName,
          hoi_comment: hoiComment,
          hoi_name: hoiName,
          next_term_opening_date: dateStr,
          subject_comments: customSubjectComments,
          is_approved: isApproved,
        },
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
      setIsDateModalOpen(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (onRequestDownloadWithDate) {
      onRequestDownloadWithDate(student, selectedExam);
      return;
    }

    const effectiveDate = (confirmedNextTermDate || nextTermOpeningDate || savedRemarks?.next_term_opening_date || '').trim();
    if (!effectiveDate) {
      setIsDateModalOpen(true);
      return;
    }

    await executePdfDownload(effectiveDate);
  };

  const handleConfirmDateFromModal = (dateStr: string) => {
    setNextTermOpeningDate(dateStr);
    executePdfDownload(dateStr);
  };

  // Sync state if props change
  useEffect(() => {
    if (savedRemarks) {
      if (savedRemarks.class_teacher_comment) setClassTeacherComment(savedRemarks.class_teacher_comment);
      if (savedRemarks.class_teacher_name) setClassTeacherName(savedRemarks.class_teacher_name);
      if (savedRemarks.hoi_comment) setHoiComment(savedRemarks.hoi_comment);
      if (savedRemarks.hoi_name) setHoiName(savedRemarks.hoi_name);
      if (savedRemarks.next_term_opening_date) setNextTermOpeningDate(savedRemarks.next_term_opening_date);
      if (savedRemarks.subject_comments) setCustomSubjectComments(savedRemarks.subject_comments);
      if (savedRemarks.is_approved !== undefined) setIsApproved(savedRemarks.is_approved);
    } else {
      setClassTeacherComment(getDefaultClassTeacherComment());
      setHoiComment(getDefaultHOIComment());
    }
  }, [student.id, selectedExamId, savedRemarks, averageScore]);

  // Handle Save
  const handleSave = () => {
    // Validate Kiswahili comments if present
    for (const sb of learnerSubjects) {
      if (isKiswahiliSubject(sb)) {
        const comment = customSubjectComments[sb.id];
        if (comment !== undefined && comment.trim() !== '') {
          const validation = validateKiswahiliComment(comment);
          if (!validation.isValid) {
            setSaveValidationMessage(
              `Maoni ya Kiswahili kwa ${sb.subject_name}: ${validation.reason || 'Lazima yaandikwe kwa Kiswahili.'}`
            );
            return;
          }
        }
      }
    }
    setSaveValidationMessage(null);

    if (onSaveRemarks) {
      onSaveRemarks(student.id, selectedExamId, {
        class_teacher_comment: classTeacherComment,
        class_teacher_name: classTeacherName,
        hoi_comment: hoiComment,
        hoi_name: hoiName,
        next_term_opening_date: nextTermOpeningDate,
        subject_comments: customSubjectComments,
        is_approved: isApproved,
      });
    }
    setIsEditing(false);
  };

  // Helper for default subject comment
  const getSubjectDefaultComment = (score: number) => {
    if (score >= 90) return 'Outstanding Performance';
    if (score >= 75) return 'Excellent Performance';
    if (score >= 58) return 'Good Performance';
    if (score >= 41) return 'Satisfactory Performance';
    if (score >= 31) return 'Developing Competency';
    if (score >= 21) return 'Needs More Practice';
    if (score >= 11) return 'Requires Intervention';
    return 'Immediate Support Required';
  };

  return (
    <div id="admin-learner-assessment-summary" className="space-y-6">
      {/* SECTION 1: ADMINISTRATIVE ACTION & LEARNER IDENTITY HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-[#E8F3EE] dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 rounded-xl shrink-0 mt-0.5">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {student.full_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {student.admission_number}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isApproved
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {isApproved ? 'Approved Report' : 'Draft / Unapproved'}
                </span>
                {!isAssessmentComplete && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />
                    <span>Provisional (Missing Marks)</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                <span>Class: <strong className="text-slate-800 dark:text-slate-200">{classNameStr}</strong></span>
                <span>•</span>
                <span>Assessment: <strong className="text-slate-800 dark:text-slate-200">{selectedExam?.exam_name || 'Assessment'}</strong></span>
                <span>•</span>
                <span>Academic Term: <strong className="text-slate-800 dark:text-slate-200">{selectedExam?.term || 'Term 1'} ({selectedExam?.year || 2026})</strong></span>
                {student.gender && (
                  <>
                    <span>•</span>
                    <span>Gender: <strong className="text-slate-800 dark:text-slate-200">{student.gender === 'M' ? 'Male' : 'Female'}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-center shrink-0">
            {(isAdmin || isClassTeacher || canModify) && (
              <>
                {isEditing ? (
                  <button
                    id="btn-save-remarks"
                    onClick={handleSave}
                    className="bg-[#176B45] hover:bg-[#0F5132] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Remarks</span>
                  </button>
                ) : (
                  <button
                    id="btn-edit-remarks"
                    onClick={() => setIsEditing(true)}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Remarks</span>
                  </button>
                )}
              </>
            )}

            <button
              id="btn-download-pdf"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="bg-[#176B45] hover:bg-[#0F5132] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Official PDF Report Card'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: ACADEMIC PERFORMANCE OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Score */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Score
          </span>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {totalMarks} <span className="text-xs text-slate-400 font-normal font-sans">/ {maxPossibleMarks}</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
            {evaluatedSubjectCount} Learning Areas
          </span>
        </div>

        {/* Average % */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Mean Average
          </span>
          <div className="text-xl font-black text-[#176B45] dark:text-emerald-400 mt-1">
            {Math.round(averageScore)}%
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
            {formatTwoDecimalAverage(averageScore)}% raw mean
          </span>
        </div>

        {/* Overall CBE Level */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            CBE Level
          </span>
          <div className="flex items-center space-x-1.5 mt-1">
            <span
              className={`px-2 py-0.5 rounded text-sm font-black inline-block border ${
                overallLevel === 'EE'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : overallLevel === 'ME'
                  ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                  : overallLevel === 'AE'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  : overallLevel === 'BE'
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              {overallLevel}
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">
              ({overallGradeCode})
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
            {overallLevel === 'EE'
              ? 'Exceeding'
              : overallLevel === 'ME'
              ? 'Meeting'
              : overallLevel === 'AE'
              ? 'Approaching'
              : overallLevel === 'BE'
              ? 'Below'
              : 'Pending'}
          </span>
        </div>

        {/* Total Points */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Points
          </span>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {totalPoints} <span className="text-xs text-slate-400 font-normal font-sans">/ {maxPossiblePoints}</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
            8-Point Scale
          </span>
        </div>

        {/* Stream Rank */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Stream Rank
          </span>
          <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
            {isAssessmentComplete ? streamRank : '-'}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
            out of {streamAssessedStudentsCount} learners
          </span>
        </div>

        {/* Grade Rank */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Grade Rank
          </span>
          <div className="text-xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
            {isAssessmentComplete ? overallRank : '-'}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
            out of {totalGradeAssessedStudents} in cohort
          </span>
        </div>
      </div>

      {/* SECTION 3: LEARNING AREA PERFORMANCE TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#176B45] dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Learning Area Performance Breakdown
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {learnerSubjects.length} Learning Areas Evaluated
          </span>
        </div>

        {saveValidationMessage && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 rounded-xl flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold">{saveValidationMessage}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-16 text-center">Code</th>
                <th className="py-3 px-4">Learning Area / Subject</th>
                <th className="py-3 px-3 text-center w-20">Score</th>
                <th className="py-3 px-3 text-center w-24">%</th>
                <th className="py-3 px-3 text-center w-16">Points</th>
                <th className="py-3 px-3 text-center w-16">Rank</th>
                <th className="py-3 px-4">Comments</th>
                <th className="py-3 px-3 w-32">Learning Area Instructor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {learnerSubjects.map((sb) => {
                const isSubjMatch = (mSubjId: string) => {
                  if (!mSubjId) return false;
                  if (mSubjId === sb.id) return true;
                  if (sb.subject_code && (mSubjId === sb.subject_code || mSubjId.toLowerCase() === sb.subject_code.toLowerCase())) return true;
                  if (sb.subject_name && mSubjId.toLowerCase() === sb.subject_name.toLowerCase()) return true;
                  if (sb.subject_code && getShortCbeCode(mSubjId) === getShortCbeCode(sb.subject_code)) return true;
                  return subjects.some((s) => s.id === mSubjId && (s.id === sb.id || (s.subject_code && sb.subject_code && (s.subject_code === sb.subject_code || getShortCbeCode(s.subject_code) === getShortCbeCode(sb.subject_code)))));
                };

                const stdMark = marks.find(
                  (m) =>
                    matchesReportStudent(m.student_id) &&
                    isSubjMatch(m.subject_id) &&
                    (m.exam_id === selectedExamId || (selectedExam && (m.exam_id === selectedExam.id || m.exam_id === selectedExam.exam_code || m.exam_id === selectedExam.exam_name)))
                );

                const markInfo = evaluateMark(stdMark);
                const isKisw = isKiswahiliSubject(sb);

                let scoreStr = '-';
                let pctStr = '-';
                let levelStr = '-';
                let gradeCodeStr = '-';
                let pointsStr = '-';
                let autoComment = isKisw ? 'Hajatathminiwa' : 'Not Assessed';

                if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
                  const gr = getGradeForMark(markInfo.percentage, grades);
                  scoreStr = markInfo.displayScore;
                  levelStr = gr.performance_level;
                  gradeCodeStr = gr.grade_code || gr.grade || '';
                  pctStr = `${Math.round(markInfo.percentage)}%${gradeCodeStr ? ' ' + gradeCodeStr : ''}`.trim();
                  pointsStr = `${gr.points} Pts`;
                  autoComment = isKisw
                    ? getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason)
                    : getSubjectDefaultComment(markInfo.percentage);
                } else if (markInfo.status === 'Y') {
                  scoreStr = 'Y';
                  pctStr = 'Y';
                  levelStr = 'Y';
                  gradeCodeStr = 'Y';
                  pointsStr = 'Y';
                  autoComment = isKisw
                    ? getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason)
                    : `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
                } else {
                  scoreStr = 'X';
                  pctStr = 'X';
                  levelStr = 'X';
                  gradeCodeStr = 'X';
                  pointsStr = 'X';
                  autoComment = isKisw
                    ? getKiswahiliDefaultComment(markInfo.percentage, markInfo.status, markInfo.irregularityReason)
                    : 'Missing Assessment (X)';
                }

                // Grade-wide Subject Rank
                const subjectRankStr = calculateSubjectRank(
                  student,
                  sb.id,
                  selectedExamId,
                  allStudents,
                  classes,
                  marks
                );

                // Assigned Subject Teacher
                const subjTeacher = resolveSubjectTeacher(teachers, sb.id, targetClassId, targetStreamId);
                const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';
                const currentComment = customSubjectComments[sb.id] || autoComment;

                return (
                  <tr
                    key={sb.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition ${
                      markInfo.status === 'X'
                        ? 'bg-rose-50/30 dark:bg-rose-950/20'
                        : markInfo.status === 'Y'
                        ? 'bg-amber-50/30 dark:bg-amber-950/20'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                      {sb.subject_code}
                    </td>

                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {sb.subject_name}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900 dark:text-blue-400">
                      {scoreStr}
                    </td>

                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100">
                      {pctStr}
                    </td>

                    <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-800 dark:text-slate-200">
                      {pointsStr}
                    </td>

                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {subjectRankStr}
                    </td>

                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 italic">
                      {(() => {
                        const canEditSubjectComment = isAdmin || canUserEditSubjectMarks(currentUser || null, activeTeacher, sb.id);
                        if (isEditing) {
                          const kiswValidation = isKisw && currentComment ? validateKiswahiliComment(currentComment) : null;
                          return (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={currentComment}
                                disabled={!canEditSubjectComment}
                                onChange={(e) => {
                                  if (saveValidationMessage) setSaveValidationMessage(null);
                                  setCustomSubjectComments({
                                    ...customSubjectComments,
                                    [sb.id]: e.target.value,
                                  });
                                }}
                                placeholder={
                                  canEditSubjectComment
                                    ? isKisw
                                      ? "Maoni ya Kiswahili pekee..."
                                      : "Enter comment..."
                                    : "Read-only"
                                }
                                className={`w-full border rounded-lg p-1.5 font-sans not-italic text-xs ${
                                  !canEditSubjectComment
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700'
                                    : kiswValidation && !kiswValidation.isValid
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-100'
                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100'
                                }`}
                              />
                              {isKisw && kiswValidation && !kiswValidation.isValid && (
                                <span className="block text-[9px] text-rose-600 dark:text-rose-400 font-sans not-italic font-medium">
                                  {kiswValidation.reason}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return stripSurroundingQuotes(currentComment);
                      })()}
                    </td>

                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 truncate">
                      {teacherNameStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: PRE-PRIMARY ECD INDICATORS (WHEN APPLICABLE) */}
      {studentLevel === 'Pre-Primary' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Early Childhood Development & Competency Indicators
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Pre-Primary Growth
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <strong className="text-slate-900 dark:text-slate-100 block font-bold mb-1">
                Motor & Physical Development
              </strong>
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Demonstrates excellent fine & gross motor skills, active physical participation and spatial coordination.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <strong className="text-slate-900 dark:text-slate-100 block font-bold mb-1">
                Social-Emotional Growth
              </strong>
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Interacts harmoniously with peers, shares learning tools willingly, and exhibits emotional stability.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <strong className="text-slate-900 dark:text-slate-100 block font-bold mb-1">
                Language & Listening Skills
              </strong>
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Expresses thoughts clearly, listens attentively during story time and follows simple instructions.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <strong className="text-slate-900 dark:text-slate-100 block font-bold mb-1">
                Creative & Psychomotor Expression
              </strong>
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Enthusiastic engagement in music, drawing, color identification, and imaginative play activities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: ADMINISTRATIVE REMARKS & MANAGEMENT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class Teacher Remarks Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Class Teacher's Remarks</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Teacher: <strong className="text-slate-800 dark:text-slate-200">{classTeacherName}</strong>
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-1">
              <textarea
                value={classTeacherComment}
                disabled={!isAdmin && !isClassTeacher}
                onChange={(e) => setClassTeacherComment(e.target.value.slice(0, 220))}
                maxLength={220}
                rows={3}
                placeholder={isAdmin || isClassTeacher ? "Enter Class Teacher remarks (max 220 chars)..." : "Read-only: Only assigned Class Teacher or Administrator can edit."}
                className={`w-full border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#176B45] font-medium ${
                  !isAdmin && !isClassTeacher
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                }`}
              />
              <div className="text-[10px] text-right text-slate-400 dark:text-slate-500">
                {classTeacherComment.length}/220 characters
              </div>
            </div>
          ) : (
            <div className="text-xs italic text-slate-700 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              "{stripSurroundingQuotes(classTeacherComment)}"
            </div>
          )}

          {isEditing && (
            <div className="pt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <label className="font-semibold">Teacher Name:</label>
              <input
                type="text"
                value={classTeacherName}
                onChange={(e) => setClassTeacherName(e.target.value)}
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-1.5 text-xs font-bold w-48"
              />
            </div>
          )}
        </div>

        {/* Head of Institution (HOI) Remarks Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Head of Institution Remarks</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              HOI: <strong className="text-slate-800 dark:text-slate-200">{hoiName}</strong>
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-1">
              <textarea
                value={hoiComment}
                disabled={!isAdmin}
                onChange={(e) => setHoiComment(e.target.value.slice(0, 220))}
                maxLength={220}
                rows={3}
                placeholder={isAdmin ? "Enter Head of Institution remarks (max 220 chars)..." : "Read-only: Only Administrator / Head of Institution can edit."}
                className={`w-full border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#176B45] font-medium ${
                  !isAdmin
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                }`}
              />
              <div className="text-[10px] text-right text-slate-400 dark:text-slate-500">
                {hoiComment.length}/220 characters
              </div>
            </div>
          ) : (
            <div className="text-xs italic text-slate-700 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              "{stripSurroundingQuotes(hoiComment)}"
            </div>
          )}

          {isEditing && (
            <div className="pt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <label className="font-semibold">HOI Name:</label>
              <input
                type="text"
                value={hoiName}
                onChange={(e) => setHoiName(e.target.value)}
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-1.5 text-xs font-bold w-48"
              />
            </div>
          )}
        </div>
      </div>

      {/* SECTION 6: ADMINISTRATIVE METADATA & REOPEN / RELEASE CONTROLS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-600 dark:text-slate-400">Next Term Opening Date:</span>
          {isEditing ? (
            <input
              type="text"
              value={nextTermOpeningDate}
              onChange={(e) => setNextTermOpeningDate(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-1.5 font-bold text-xs"
            />
          ) : (
            <strong className="text-slate-900 dark:text-slate-100 font-bold">{nextTermOpeningDate}</strong>
          )}
        </div>

        {isEditing && isAdmin && (
          <div className="flex items-center space-x-2">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Approval Status:</label>
            <select
              value={isApproved ? 'approved' : 'draft'}
              onChange={(e) => setIsApproved(e.target.value === 'approved')}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-1.5 font-bold text-xs"
            >
              <option value="approved">Approved</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        )}
      </div>

      {/* MANDATORY NEXT TERM OPENING DATE GATE MODAL */}
      <NextTermOpeningDateModal
        isOpen={isDateModalOpen}
        exam={selectedExam}
        schoolTerms={schoolTerms}
        initialDate={nextTermOpeningDate}
        studentName={student.full_name}
        downloadContext="single"
        onConfirm={handleConfirmDateFromModal}
        onClose={() => setIsDateModalOpen(false)}
        isProcessing={isDownloadingPdf}
      />
    </div>
  );
};
