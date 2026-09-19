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
  LearnerRankingMetadata,
  SchoolTerm,
  getApplicableSubjectsForGrade,
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
import { getLearnerClassAtExamTime, getStreamCohortStudentIds, getGradeCohortStudentIds } from '../services/historicalContextResolver';
import { evaluateMark, formatTwoDecimalAverage } from '../utils/markUtils';
import { Award, CheckCircle, Edit3, User, Save, Download, Loader2, AlertCircle } from 'lucide-react';
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

interface LearnerReportCardProps {
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
  isBatchMode?: boolean;
  onSaveRemarks?: (studentId: string, examId: string, remarks: Partial<LearnerReportComment>) => void;
  savedRemarks?: LearnerReportComment;
  canModify?: boolean;
  schoolTerms?: SchoolTerm[];
  confirmedNextTermDate?: string;
  onRequestDownloadWithDate?: (student: Student, exam?: Examination) => void;
  aggregateRanking?: LearnerRankingMetadata | null;
}

export const LearnerReportCard: React.FC<LearnerReportCardProps> = ({
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
  isBatchMode = false,
  onSaveRemarks,
  savedRemarks,
  schoolTerms = [],
  confirmedNextTermDate = '',
  onRequestDownloadWithDate,
  aggregateRanking,
}) => {
  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);
  const isAdmin = currentUser?.role === 'admin';
  const isLearner = currentUser?.role === 'learner';
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
      // Unresolved historical context - MUST NOT leak current student.class_id
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

  // Check if learner or cohort participated in this exam
  const matchesReportStudent = (stdId: string | undefined | null) => {
    if (!stdId) return false;
    const str = String(stdId).trim().toLowerCase();
    if (student.id && String(student.id).trim().toLowerCase() === str) return true;
    if (student.admission_number && String(student.admission_number).trim().toLowerCase() === str) return true;
    return false;
  };

  const studentExamMarks = marks.filter((m) => matchesReportStudent(m.student_id) && m.exam_id === selectedExamId);
  const gradeStudents = allStudents.filter((s) => (s.grade || '') === studentGrade);
  const gradeStudentIdSet = new Set(gradeStudents.map((s) => s.id));
  const gradeExamMarks = marks.filter((m) => m.exam_id === selectedExamId && gradeStudentIdSet.has(m.student_id));
  const isCohortNotAssessed = studentExamMarks.length === 0 && gradeExamMarks.length === 0;

  // Calculate overall student results for this exam
  const examResults = calculateExamResults(selectedExamId, allStudents, marks, grades, classes, subjects);

  const studentResult = examResults.find((r) => matchesReportStudent(r.student_id));

  // Auto-calculated defaults
  const isAssessmentComplete = aggregateRanking
    ? aggregateRanking.is_complete
    : (studentResult ? studentResult.is_complete !== false : false);

  const totalMarks = aggregateRanking?.total_marks !== undefined
    ? aggregateRanking.total_marks
    : (studentResult?.total_marks || 0);

  const averageScore = aggregateRanking?.average !== undefined
    ? aggregateRanking.average
    : (studentResult?.average || 0);

  const totalPoints = isAssessmentComplete
    ? (aggregateRanking?.total_points !== undefined ? aggregateRanking.total_points : (studentResult?.total_points || 0))
    : 0;

  const overallLevel = isAssessmentComplete
    ? (aggregateRanking?.performance_level || studentResult?.performance_level || 'ME')
    : 'Pending';

  const overallGradeCode = isAssessmentComplete
    ? (aggregateRanking?.grade_code || studentResult?.grade_code || studentResult?.grade || 'ME1')
    : 'Pending';

  const overallRank = aggregateRanking
    ? (aggregateRanking.is_complete && aggregateRanking.overall_rank ? `${aggregateRanking.overall_rank}` : 'Not Yet Ranked')
    : (isAssessmentComplete && studentResult?.position ? `${studentResult.position}` : 'Not Yet Ranked');

  const streamRank = aggregateRanking
    ? (aggregateRanking.is_complete && aggregateRanking.stream_rank ? `${aggregateRanking.stream_rank}` : 'Not Yet Ranked')
    : (isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `${studentResult.class_position || studentResult.position}` : 'Not Yet Ranked');

  // Authoritative grade cohort (across streams)
  const gradeStudentIds = getGradeCohortStudentIds(student, allStudents, selectedExam, classes);
  const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
  const totalGradeAssessedStudents = aggregateRanking?.overall_total
    ? aggregateRanking.overall_total
    : (gradeResults.filter((r) => r.is_complete !== false).length ||
       gradeResults.length ||
       1);

  // Authoritative stream cohort
  const streamStudentIds = getStreamCohortStudentIds(student, allStudents, selectedExam, classes);
  const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
  const streamAssessedStudentsCount = aggregateRanking?.stream_total
    ? aggregateRanking.stream_total
    : (streamResults.filter((r) => r.is_complete !== false).length ||
       streamResults.length ||
       1);

  // Maximum possible score & points calculation
  const isUpperPrimary = studentLevel === 'Upper Primary' || getEducationLevelForGrade(studentGrade) === 'Upper Primary';
  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * (isUpperPrimary ? 4 : 8);

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
    if (isCohortNotAssessed) {
      alert(`${studentGrade || 'This class'} did not participate in this assessment. Report card cannot be generated.`);
      return;
    }

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
    if (score >= 90) return "Outstanding Performance";
    if (score >= 75) return "Excellent Performance";
    if (score >= 58) return "Good Performance";
    if (score >= 41) return "Satisfactory Performance";
    if (score >= 31) return "Developing Competency";
    if (score >= 21) return "Needs More Practice";
    if (score >= 11) return "Requires Intervention";
    return "Immediate Support Required";
  };

  const currentDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-800 dark:border-slate-700 shadow-xl p-6 sm:p-8 max-w-4xl mx-auto font-sans text-slate-900 dark:text-slate-100 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full space-y-6 page-break-after-always">
      {/* Screen Mode Edit & Control Bar */}
      {!isBatchMode && (
        <div className="print:hidden bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                isApproved ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
              }`}
            >
              {isApproved ? 'Official Report Approved' : 'Draft Report'}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              Learner: <strong className="text-slate-900 dark:text-slate-100">{student.full_name}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {canModify && !isLearner && (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Preview Mode' : 'Edit Remarks'}</span>
                </button>

                {isEditing && (
                  <button
                    onClick={handleSave}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Remarks</span>
                  </button>
                )}

                <button
                  onClick={() => setIsApproved(!isApproved)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    isApproved
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                  }`}
                >
                  {isApproved ? 'Mark as Draft' : 'Approve Report'}
                </button>
              </>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || isCohortNotAssessed}
              className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition shadow-xs"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      )}

      {isCohortNotAssessed && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            Assessment Not Administered to {studentGrade || 'this Grade'}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            This assessment was not sat by {studentGrade || 'this learner\'s grade'}. No marks were recorded. This learner is not penalised, ranked, or made incomplete.
          </p>
        </div>
      )}

      {/* SECTION 1: REPORT HEADER */}
      <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-4 flex flex-col items-center justify-center text-center space-y-2">
        {/* Logo & School Name */}
        <div className="flex items-center justify-center space-x-3">
          {school.logo_url && (
            <img
              src={school.logo_url}
              alt="School Logo"
              className="w-14 h-14 object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              {school.school_name || 'School Name Not Configured'}
            </h1>
            {school.motto && (
              <p className="text-[10px] italic font-semibold text-amber-700 dark:text-amber-400 mt-1">{stripSurroundingQuotes(school.motto)}</p>
            )}
            {school.phone && (
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                Tel: {school.phone}
              </p>
            )}
          </div>
        </div>

        <div>
          <span className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-black uppercase tracking-widest px-4 py-1 rounded-md inline-block shadow-xs">
            LEARNER ASSESSMENT REPORT
          </span>
        </div>

        {/* Assessment & Date Details Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 pt-1">
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            Assessment: {selectedExam?.exam_name || 'End-Term Assessment'}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            Term: {selectedExam?.term || 'Term 2'} &bull; Academic Year: {selectedExam?.year || 2026}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            Class/Stream: {classNameStr}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            Date Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* SECTION 2: LEARNER PROFILE SECTION */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-800 dark:border-slate-700 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Learner Name</span>
          <span className="font-black text-sm text-slate-900 dark:text-slate-100">{student.full_name}</span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Admission Number</span>
          <span className="font-mono font-black text-sm text-[#0F5132] dark:text-emerald-400">{student.admission_number}</span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Grade & Stream</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{classNameStr}</span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Gender</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {student.gender === 'M' ? 'Male' : 'Female'}
          </span>
        </div>
      </div>

      {/* SECTION 3: OVERALL PERFORMANCE SUMMARY CARD */}
      <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-4 border-2 border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md">
        {!isAssessmentComplete && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs px-3 py-1.5 rounded-lg mb-3 flex items-center justify-between font-medium">
            <span>⚠️ <strong>Incomplete Assessment:</strong> Learner has pending subject marks. Final overall level & rank will be assigned upon complete evaluation.</span>
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs">Provisional</span>
          </div>
        )}
        <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3 text-center sm:text-left flex items-center justify-between">
          <span>Overall Competency Performance Summary</span>
          {!isAssessmentComplete && <span className="text-amber-700 dark:text-amber-400 text-[10px] font-bold">Status: Provisional</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-none">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">TOTAL SCORE</div>
            <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              {totalMarks} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ {maxPossibleMarks}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-none">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">AVERAGE MARK</div>
            <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {formatTwoDecimalAverage(averageScore)}% {!isAssessmentComplete && <span className="text-[9px] text-amber-700 dark:text-amber-300 font-medium block">(Provisional)</span>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-none">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">CBE LEVEL</div>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {overallLevel} <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">({overallGradeCode})</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-none">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">TOTAL POINTS</div>
            <div className="text-sm font-black text-purple-700 dark:text-purple-300 mt-0.5">
              {isAssessmentComplete ? totalPoints : '-'} {isAssessmentComplete && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">/ {maxPossiblePoints}</span>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-none">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">STREAM RANK</div>
            <div className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-300 mt-0.5">
              {streamRank} {isAssessmentComplete && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block">of {streamAssessedStudentsCount}</span>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs dark:shadow-none">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">OVERALL RANK</div>
            <div className="text-xs sm:text-sm font-black text-cyan-700 dark:text-cyan-300 mt-0.5">
              {overallRank} {isAssessmentComplete && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block">of {totalGradeAssessedStudents}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 & 5: LEARNING AREA PERFORMANCE TABLE (CBE GRADING) */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-1">
          <span>Learning Area (Subject) Performance Breakdown</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
            {isUpperPrimary ? '4-Point KNEC CBE Assessment Scale' : '8-Point KNEC CBE Assessment Scale'}
          </span>
        </h3>

        {saveValidationMessage && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 rounded-xl flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold">{saveValidationMessage}</span>
          </div>
        )}

        <div className="overflow-x-auto border-2 border-slate-900 dark:border-slate-700 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-200 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-extrabold uppercase tracking-tight text-[11px]">
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-12 text-center">Code</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700">Learning Area / Subject</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-20">Score</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-24">%</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-16">Points</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-16">Rank</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700">Comments</th>
                <th className="p-2 w-28">Learning Area Instructor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-medium">
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
                
                const markInfo = evaluateMark(stdMark, {
                  subject: sb,
                  classObj: targetClass,
                  educationLevel: studentLevel,
                });
                const isKisw = isKiswahiliSubject(sb);

                let scoreStr = '-';
                let pctStr = '-';
                let levelStr = '-';
                let gradeCodeStr = '-';
                let pointsStr = '-';
                let autoComment = isKisw ? 'Hajatathminiwa' : 'Not Assessed';

                if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
                  const gr = getGradeForMark(markInfo.percentage, grades, studentLevel, studentGrade);
                  scoreStr = markInfo.displayScore;
                  levelStr = gr.performance_level;
                  gradeCodeStr = gr.grade_code || gr.grade || '';
                  const roundedPct = Math.round(markInfo.percentage);
                  pctStr = markInfo.isRawScoreOnly 
                    ? `${markInfo.displayScore}${gradeCodeStr ? ' ' + gradeCodeStr : ''}`.trim()
                    : `${roundedPct}%${gradeCodeStr ? ' ' + gradeCodeStr : ''}`.trim();
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
                  // Missing Assessment ('X' or unentered/blank for an applicable learning area)
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
                  <tr key={sb.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${markInfo.status === 'X' ? 'bg-rose-50/40 dark:bg-rose-950/30' : markInfo.status === 'Y' ? 'bg-amber-50/40 dark:bg-amber-950/30' : ''}`}>
                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      {sb.subject_code}
                    </td>

                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                      {sb.subject_name}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-mono font-extrabold text-blue-900 dark:text-blue-400">
                      {scoreStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100">
                      {pctStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-bold font-mono text-slate-800 dark:text-slate-200">
                      {pointsStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                      {subjectRankStr}
                    </td>

                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-[10px] text-slate-700 dark:text-slate-300 italic">
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
                                    : "Read-only (Unassigned subject)"
                                }
                                className={`w-full border rounded p-1 font-sans not-italic text-[10px] ${
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

                    <td className="p-2 text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {teacherNameStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ASSESSMENT STATUS KEY / LEGEND BOX */}
        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-[11px] space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
            Assessment Status Key / Legend:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-300 text-[10px]">
            <div><strong className="text-rose-700 dark:text-rose-400">X</strong> = Missing Mark (Report marked Provisional)</div>
            <div><strong className="text-amber-700 dark:text-amber-400">Y</strong> = Examination Irregularity (Absent, Malpractice, Medical)</div>
            <div><strong className="text-slate-700 dark:text-slate-300">Blank / "-"</strong> = Subject Not Offered / Not Examined</div>
          </div>
        </div>
      </div>

      {/* PRE-PRIMARY EARLY CHILDHOOD DEVELOPMENT INDICATORS */}
      {studentLevel === 'Pre-Primary' && (
        <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-800 dark:border-slate-700 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="font-extrabold text-xs uppercase text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 pb-1 flex items-center justify-between">
            <span>Early Childhood Development & Psychomotor Indicators</span>
            <span className="text-[10px] text-blue-800 dark:text-blue-400 font-bold uppercase">Competency Growth Summary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Motor & Physical Development</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Demonstrates excellent fine & gross motor skills, active physical participation and spatial coordination.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Social-Emotional Growth</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Interacts harmoniously with peers, shares learning tools willingly, and exhibits emotional stability.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Language & Listening Skills</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Expresses thoughts clearly, listens attentively during story time and follows simple instructions.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Creative & Psychomotor Expression</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Enthusiastic engagement in music, drawing, color identification, and imaginative play activities.</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6 & 7: CLASS TEACHER REMARKS */}
      <div className="space-y-3 pt-2">
        <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5 mb-2">
            <span className="font-extrabold text-xs uppercase text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>Class Teacher's Assessment & Comments</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Teacher Name: <strong className="text-slate-900 dark:text-slate-100">{classTeacherName}</strong>
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-1">
              <textarea
                value={classTeacherComment}
                disabled={!isAdmin && !isClassTeacher}
                onChange={(e) => setClassTeacherComment(e.target.value.slice(0, 220))}
                maxLength={220}
                rows={2}
                placeholder={isAdmin || isClassTeacher ? "Enter Class Teacher remarks (max 220 chars)..." : "Read-only: Only assigned Class Teacher or Administrator can edit."}
                className={`w-full border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-medium ${
                  !isAdmin && !isClassTeacher ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                }`}
              />
              <div className="text-[10px] text-right text-slate-400 dark:text-slate-500">
                {classTeacherComment.length}/220 characters
              </div>
            </div>
          ) : (
            <div className="text-xs italic text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-700">
              {stripSurroundingQuotes(classTeacherComment)}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div>
              <span>Class Teacher Name: </span>
              {isEditing ? (
                <input
                  type="text"
                  value={classTeacherName}
                  onChange={(e) => setClassTeacherName(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded p-1 ml-1 font-bold"
                />
              ) : (
                <span className="text-slate-900 dark:text-slate-100 underline font-black">{classTeacherName}</span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 8: HEAD OF INSTITUTION REMARKS */}
        <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-1.5 mb-2">
            <span className="font-extrabold text-xs uppercase text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span>Head of Institution (Principal/Headteacher) Remarks</span>
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
              HOI: <strong className="text-slate-900 dark:text-slate-100">{hoiName}</strong>
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-1">
              <textarea
                value={hoiComment}
                disabled={!isAdmin}
                onChange={(e) => setHoiComment(e.target.value.slice(0, 220))}
                maxLength={220}
                rows={2}
                placeholder={isAdmin ? "Enter Head of Institution remarks (max 220 chars)..." : "Read-only: Only Administrator / Head of Institution can edit."}
                className={`w-full border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-medium ${
                  !isAdmin ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700'
                }`}
              />
              <div className="text-[10px] text-right text-slate-400 dark:text-slate-500">
                {hoiComment.length}/220 characters
              </div>
            </div>
          ) : (
            <div className="text-xs italic text-slate-900 dark:text-slate-100 font-bold leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded border border-amber-200 dark:border-amber-800">
              {stripSurroundingQuotes(hoiComment)}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300 pt-2 border-t border-amber-200 dark:border-amber-800 gap-2">
            <div>
              <span>HOI Name: </span>
              {isEditing ? (
                <input
                  type="text"
                  value={hoiName}
                  onChange={(e) => setHoiName(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded p-1 ml-1 font-bold"
                />
              ) : (
                <span className="text-slate-900 dark:text-slate-100 font-black">{hoiName}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 9: GRADING KEY LEGEND */}
      <div className="space-y-1 pt-1">
        <div className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider">
          {isUpperPrimary
            ? 'CBE Assessment Grading Scale Key (4-Point KNEC Scale)'
            : 'CBE Assessment Grading Scale Key (8-Point KNEC Scale)'}
        </div>
        <div className="overflow-x-auto border border-slate-400 dark:border-slate-700 rounded-lg">
          <table className="w-full text-center text-[9px] font-bold border-collapse">
            <thead>
              <tr className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-b border-slate-400 dark:border-slate-700 uppercase">
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Code</th>
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Performance Level</th>
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Score Range</th>
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Points</th>
                <th className="p-1">Official Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
              {isUpperPrimary ? (
                <>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/40">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-900 dark:text-emerald-300">EE</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-800 dark:text-emerald-300">Exceeding Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">76–100</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">4</td>
                    <td className="p-1 text-left px-2 font-semibold text-emerald-900 dark:text-emerald-200">Exceeding Expectations</td>
                  </tr>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/60">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-slate-800 dark:text-slate-200">ME</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-slate-700 dark:text-slate-300">Meeting Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">51–75</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">3</td>
                    <td className="p-1 text-left px-2 font-semibold text-slate-800 dark:text-slate-200">Meeting Expectations</td>
                  </tr>
                  <tr className="bg-amber-50/60 dark:bg-amber-950/40">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-900 dark:text-amber-300">AE</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-800 dark:text-amber-300">Approaching Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">26–50</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">2</td>
                    <td className="p-1 text-left px-2 font-semibold text-amber-900 dark:text-amber-200">Approaching Expectations</td>
                  </tr>
                  <tr className="bg-rose-50/60 dark:bg-rose-950/40">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-900 dark:text-rose-300">BE</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-800 dark:text-rose-300">Below Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">0–25</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">1</td>
                    <td className="p-1 text-left px-2 font-semibold text-rose-900 dark:text-rose-200">Below Expectations</td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/40">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-900 dark:text-emerald-300">EE1</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-800 dark:text-emerald-300">Exceeding Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">90–100</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">8</td>
                    <td className="p-1 text-left px-2 font-semibold text-emerald-900 dark:text-emerald-200">Outstanding Performance</td>
                  </tr>
                  <tr className="bg-emerald-50/30 dark:bg-emerald-950/20">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-800 dark:text-emerald-400">EE2</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-emerald-700 dark:text-emerald-400">Exceeding Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">75–89</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">7</td>
                    <td className="p-1 text-left px-2 font-semibold text-emerald-800 dark:text-emerald-300">Excellent Performance</td>
                  </tr>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/60">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-slate-800 dark:text-slate-200">ME1</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-slate-700 dark:text-slate-300">Meeting Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">58–74</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">6</td>
                    <td className="p-1 text-left px-2 font-semibold text-slate-800 dark:text-slate-200">Good Performance</td>
                  </tr>
                  <tr className="bg-slate-100/40 dark:bg-slate-800/30">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-slate-700 dark:text-slate-300">ME2</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400">Meeting Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">41–57</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">5</td>
                    <td className="p-1 text-left px-2 font-semibold text-slate-700 dark:text-slate-300">Satisfactory Performance</td>
                  </tr>
                  <tr className="bg-amber-50/60 dark:bg-amber-950/40">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-900 dark:text-amber-300">AE1</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-800 dark:text-amber-300">Approaching Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">31–40</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">4</td>
                    <td className="p-1 text-left px-2 font-semibold text-amber-900 dark:text-amber-200">Developing Competency</td>
                  </tr>
                  <tr className="bg-amber-50/30 dark:bg-amber-950/20">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-800 dark:text-amber-400">AE2</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-amber-700 dark:text-amber-400">Approaching Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">21–30</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">3</td>
                    <td className="p-1 text-left px-2 font-semibold text-amber-800 dark:text-amber-300">Needs More Practice</td>
                  </tr>
                  <tr className="bg-rose-50/60 dark:bg-rose-950/40">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-900 dark:text-rose-300">BE1</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-800 dark:text-rose-300">Below Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">11–20</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">2</td>
                    <td className="p-1 text-left px-2 font-semibold text-rose-900 dark:text-rose-200">Requires Intervention</td>
                  </tr>
                  <tr className="bg-rose-50/30 dark:bg-rose-950/20">
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-800 dark:text-rose-400">BE2</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-rose-700 dark:text-rose-400">Below Expectations</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">0–10</td>
                    <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">1</td>
                    <td className="p-1 text-left px-2 font-semibold text-rose-800 dark:text-rose-300">Immediate Support Required</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 10: SIGNATURE SECTION */}
      <div className="grid grid-cols-3 gap-4 pt-3 text-[10px] font-bold text-slate-800 dark:text-slate-200 border-t-2 border-slate-900 dark:border-slate-700">
        <div className="border border-slate-300 dark:border-slate-700 rounded p-2 text-center space-y-3 bg-slate-50 dark:bg-slate-800/80">
          <div className="uppercase text-slate-500 dark:text-slate-400 font-extrabold text-[9px]">Class Teacher Signature</div>
          <div className="h-6 border-b border-dashed border-slate-400 dark:border-slate-600"></div>
          <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
            <span>Sign: ____________</span>
            <span>Date: _________</span>
          </div>
        </div>

        <div className="border border-slate-300 dark:border-slate-700 rounded p-2 text-center space-y-3 bg-slate-50 dark:bg-slate-800/80">
          <div className="uppercase text-slate-500 dark:text-slate-400 font-extrabold text-[9px]">Head of Institution & Stamp</div>
          <div className="h-6 border-b border-dashed border-slate-400 dark:border-slate-600"></div>
          <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
            <span>Sign: ____________</span>
            <span>Date: _________</span>
          </div>
        </div>

        <div className="border border-slate-300 dark:border-slate-700 rounded p-2 text-center space-y-3 bg-slate-50 dark:bg-slate-800/80">
          <div className="uppercase text-slate-500 dark:text-slate-400 font-extrabold text-[9px]">Parent / Guardian Signature</div>
          <div className="h-6 border-b border-dashed border-slate-400 dark:border-slate-600"></div>
          <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
            <span>Sign: ____________</span>
            <span>Date: _________</span>
          </div>
        </div>
      </div>

      {/* SECTION 11: REPORT FOOTER */}
      <div className="pt-2 border-t border-slate-300 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span>Next Term Opening Date: </span>
          {isEditing ? (
            <input
              type="text"
              value={nextTermOpeningDate}
              onChange={(e) => setNextTermOpeningDate(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded p-1 font-bold"
            />
          ) : (
            <strong className="text-slate-900 dark:text-slate-100 font-extrabold underline">{nextTermOpeningDate}</strong>
          )}
        </div>

        <div className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
          Generated on {currentDateStr}
        </div>
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
