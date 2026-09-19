import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Award,
  Users,
  BookOpen,
  Download,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart2,
  TrendingUp,
  Layers,
  UserCheck,
  Archive,
  Loader2,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Filter,
  ArrowRight,
} from 'lucide-react';
import {
  School,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  ClassStream,
  Teacher,
  User,
  LearnerReportComment,
  SchoolTerm,
  sortGrades,
  sortClasses,
  getEducationLevelForGrade,
} from '../types';
import {
  calculateExamResults,
  generateExamAnalysisSummary,
  getGradeForMark,
  getLearnerReportSubjects,
} from '../services/analysisEngine';
import { isClassExamApproved } from '../utils/examLockUtils';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';
import { getFilteredStudents, stripSurroundingQuotes, isClassInExamScope, filterExamsForClassScope } from '../utils/filterUtils';
import {
  getActiveTeacher,
  getAccessibleClasses,
  getAccessiblePrimaryClasses,
  getAccessibleSubjects,
  getAccessibleStudents,
  isClassTeacherFor,
  canUserAccessClassComparison,
  getAccessibleClassesForComparison,
  getAccessibleStudentsForComparison,
} from '../utils/rbacUtils';
import { AdminLearnerAssessmentSummary } from './AdminLearnerAssessmentSummary';
import { AdminBatchAssessmentSummary } from './AdminBatchAssessmentSummary';
import { NextTermOpeningDateModal } from './NextTermOpeningDateModal';
import { ChartWrapper } from './ChartWrapper';
import { CbeMeritListReport } from './CbeMeritListReport';
import { LoadingIndicator } from './LoadingIndicator';
import { TerminalResultsView } from './terminal/TerminalResultsView';
import { ClassPerformanceComparisonView } from './ClassPerformanceComparisonView';
import {
  downloadSingleReportCardPDF,
  downloadAllReportCardsZIP,
  downloadAllReportCardsCombinedPDF,
  PDFReportData,
} from '../services/pdfReportGenerator';
import { exportSubjectPerformanceAnalysisPDF } from '../services/subjectPerformancePdfExporter';
import { groupExamsForDropdown } from '../utils/examDisplayUtils';
import { api } from '../lib/storage';
import { canGenerateReports, getTermStatusMessage, canEnterMarks } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface ReportsViewProps {
  school: School;
  students: Student[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  currentUser?: User;
  onNavigateToTab?: (tab: any) => void;
  onMarksUpdated?: () => void;
  onUpdateExamClassApproval?: (examId: string, classStreamId: string, approved: boolean) => Promise<void> | void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  school,
  students = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  classes = [],
  teachers = [],
  currentUser,
  onNavigateToTab,
  onMarksUpdated,
  onUpdateExamClassApproval,
}) => {
  const isStudent = false;
  const studentSelfId = undefined;

  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();
  const canModify = canEnterMarks(activeTermObj.status);

  const [reportTab, setReportTab] = useState<
    'individual' | 'batch' | 'merit' | 'subject' | 'class_comparison' | 'grades' | 'terminal'
  >(() => {
    const activeTch = getActiveTeacher(currentUser || null, teachers || []);
    const pClasses = getAccessiblePrimaryClasses(currentUser || null, activeTch, classes);
    const hasPrimaryClass = pClasses.length > 0;
    return currentUser?.role === 'subject_teacher' && !hasPrimaryClass ? 'subject' : 'individual';
  });

  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Auto-detect and select exam for current active/viewing term session
  useEffect(() => {
    if (!exams || exams.length === 0) return;
    if (!selectedExamId || !exams.some((e) => e.id === selectedExamId)) {
      const match =
        exams.find(
          (ex) =>
            ex.year === activeYearObj?.year &&
            ex.term === activeTermObj?.term_name &&
            ex.status !== 'Archived'
        ) ||
        exams.find((ex) => ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name);
      if (match) {
        setSelectedExamId(match.id);
      }
    }
  }, [exams, activeYearObj?.year, activeTermObj?.term_name]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(studentSelfId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);

  const activeTeacher = React.useMemo(
    () => getActiveTeacher(currentUser || null, teachers || []),
    [currentUser, teachers]
  );
  const canAccessComparison = React.useMemo(
    () => canUserAccessClassComparison(currentUser || null, activeTeacher, classes),
    [currentUser, activeTeacher, classes]
  );

  // Defensive guard against state bypass: If unauthorized, force reportTab to 'subject'
  useEffect(() => {
    if (!canAccessComparison && reportTab === 'class_comparison') {
      setReportTab('subject');
    }
  }, [canAccessComparison, reportTab]);

  // Dynamically fetch marks for selected exam from Supabase
  useEffect(() => {
    let isMounted = true;
    if (!selectedExamId) {
      setIsLoadingMarks(false);
      return;
    }

    const isComparisonMode = reportTab === 'class_comparison' && canAccessComparison;

    setIsLoadingMarks(true);
    api
      .fetchMarksForExam(selectedExamId, {
        classId: selectedClassId,
        streamId: isComparisonMode ? 'all' : selectedStreamId,
        studentId: isComparisonMode ? undefined : selectedStudentId,
        subjectId: isComparisonMode ? undefined : selectedSubjectId,
      })
      .then(() => {
        if (isMounted) {
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('Error fetching exam marks:', err);
        if (isMounted) setIsLoadingMarks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, selectedClassId, selectedStreamId, selectedStudentId, selectedSubjectId, reportTab, canAccessComparison]);

  const isClassTeacher = currentUser?.role === 'class_teacher' || Boolean(activeTeacher?.class_teacher_of_id);
  const isClassTeacherRole = currentUser?.role !== 'admin' && isClassTeacher;
  const primaryClasses = React.useMemo(() => {
    if (!isClassTeacherRole) return [];
    return getAccessiblePrimaryClasses(currentUser || null, activeTeacher, classes);
  }, [currentUser, activeTeacher, classes, isClassTeacherRole]);
  const primaryClass = isClassTeacherRole && primaryClasses.length > 0 ? primaryClasses[0] : null;
  const isSubjectTeacherOnly = currentUser?.role === 'subject_teacher' && !isClassTeacher;

  const accessibleClasses = React.useMemo(() => {
    if (currentUser?.role === 'admin') return sortClasses(classes);
    if (reportTab === 'class_comparison' && canAccessComparison) {
      return getAccessibleClassesForComparison(currentUser || null, activeTeacher, classes);
    }
    const baseAccessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
    return baseAccessibleClasses.filter((c) => {
      if (reportTab === 'subject') return true;
      return isClassTeacherFor(activeTeacher, c.stream_id || c.id, classes);
    });
  }, [currentUser, activeTeacher, classes, reportTab, canAccessComparison]);

  const accessibleSubjects = React.useMemo(() => {
    if (currentUser?.role === 'admin' || (reportTab === 'class_comparison' && canAccessComparison)) {
      return subjects;
    }
    return getAccessibleSubjects(currentUser || null, activeTeacher, subjects);
  }, [currentUser, activeTeacher, subjects, reportTab, canAccessComparison]);

  const accessibleStudents = React.useMemo(() => {
    if (currentUser?.role === 'admin') return students;
    if (reportTab === 'class_comparison' && canAccessComparison) {
      return getAccessibleStudentsForComparison(currentUser || null, activeTeacher, students, classes);
    }
    const baseAccessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);
    return baseAccessibleStudents.filter((s) => {
      if (reportTab === 'subject') return true;
      return isClassTeacherFor(activeTeacher, s.stream_id || s.class_id, classes);
    });
  }, [currentUser, activeTeacher, students, classes, reportTab, canAccessComparison]);

  // Filter exams for dropdown to ensure class-level and education-level awareness
  const filteredExamsForDropdown = React.useMemo(() => {
    return filterExamsForClassScope(
      exams,
      selectedClassId,
      accessibleClasses,
      primaryClass,
      currentUser?.role
    );
  }, [exams, selectedClassId, accessibleClasses, primaryClass, currentUser?.role]);

  // Entity Selection Integrity: Auto-select or adjust selectedExamId if current selection is not in filteredExamsForDropdown
  useEffect(() => {
    if (filteredExamsForDropdown.length === 0) return;
    if (selectedExamId && !filteredExamsForDropdown.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(filteredExamsForDropdown[0].id);
    }
  }, [filteredExamsForDropdown, selectedExamId]);

  const selectedExam = (exams || []).find((e) => e.id === selectedExamId);

  // In-scope classes restricted by selected exam scope (class-aware and level-aware)
  const inScopeClasses = React.useMemo(() => {
    if (!selectedExam) return accessibleClasses;
    return (accessibleClasses || []).filter((c) => isClassInExamScope(c, selectedExam));
  }, [accessibleClasses, selectedExam]);

  // Unique class levels restricted to in-scope classes
  const uniqueClasses = React.useMemo(() => {
    return sortGrades(Array.from(new Set<string>((inScopeClasses || []).map((c) => c.class_name))));
  }, [inScopeClasses]);

  // Auto-set and lock Class and Stream for Class Teachers on class-scoped tabs (when class is in exam scope)
  useEffect(() => {
    if (isClassTeacherRole && primaryClass && reportTab !== 'subject' && reportTab !== 'class_comparison') {
      const isPrimaryInScope = !selectedExam || isClassInExamScope(primaryClass, selectedExam);
      if (isPrimaryInScope) {
        if (selectedClassId !== primaryClass.class_name) {
          setSelectedClassId(primaryClass.class_name);
        }
        const streamVal = primaryClass.stream_id || primaryClass.id;
        if (selectedStreamId !== streamVal) {
          setSelectedStreamId(streamVal);
        }
      }
    }
  }, [isClassTeacherRole, primaryClass, reportTab, selectedExam, selectedClassId, selectedStreamId]);

  // Auto-select first class/stream if only 1 accessible class on subject tab
  useEffect(() => {
    if (reportTab === 'subject' && inScopeClasses.length === 1 && !selectedClassId) {
      setSelectedClassId(inScopeClasses[0].class_name);
      setSelectedStreamId(inScopeClasses[0].stream_id || inScopeClasses[0].id);
    }
  }, [reportTab, inScopeClasses, selectedClassId]);

  // Ensure stream is set to 'all' on class_comparison tab (fail-closed: do not force class selection)
  useEffect(() => {
    if (reportTab === 'class_comparison') {
      if (selectedStreamId !== 'all') {
        setSelectedStreamId('all');
      }
    }
  }, [reportTab, selectedStreamId]);

  // Entity Selection Integrity: Invalidate selectedClassId, selectedStreamId, and selectedStudentId when selectedExam changes and class is out of scope
  useEffect(() => {
    if (!selectedExamId) {
      if (selectedClassId) setSelectedClassId('');
      if (selectedStreamId) setSelectedStreamId('');
      if (selectedStudentId && !isStudent) setSelectedStudentId('');
      return;
    }

    if (selectedClassId) {
      const isClassValid = inScopeClasses.some(
        (c) => c.class_name.toLowerCase() === selectedClassId.toLowerCase() || c.id === selectedClassId
      );
      if (!isClassValid) {
        setSelectedClassId('');
        setSelectedStreamId('');
        if (!isStudent) setSelectedStudentId('');
      }
    }
  }, [selectedExamId, inScopeClasses, selectedClassId, selectedStreamId, selectedStudentId, isStudent]);

  // Entity Selection Integrity: Invalidate selectedStreamId when not in valid streams for selectedClass
  useEffect(() => {
    if (selectedStreamId && selectedStreamId !== 'all') {
      const isStreamValid = inScopeClasses.some(
        (c) =>
          (c.stream_id || c.id) === selectedStreamId &&
          (c.class_name.toLowerCase() === selectedClassId.toLowerCase() || c.id === selectedClassId)
      );
      if (!isStreamValid) {
        setSelectedStreamId('');
        if (!isStudent) setSelectedStudentId('');
      }
    }
  }, [selectedClassId, inScopeClasses, selectedStreamId, isStudent]);

  // Determine learning areas (subjects) applicable strictly to the selected class level and stream
  const selectedStreamObj = selectedStreamId && selectedStreamId !== 'all'
    ? inScopeClasses.find((c) => (c.stream_id || c.id) === selectedStreamId)
    : null;
  const targetClass = selectedStreamObj || inScopeClasses.find(c => c.id === selectedClassId || c.class_name === selectedClassId) || accessibleClasses.find(c => c.id === selectedClassId || c.class_name === selectedClassId);
  const applicableSubjects = targetClass ? getLearnerReportSubjects({} as any, targetClass, accessibleSubjects, teachers) : [];
  const displaySubjects = targetClass ? applicableSubjects : accessibleSubjects;

  // Entity Selection Integrity: Invalidate selectedSubjectId when not in displaySubjects
  useEffect(() => {
    if (selectedSubjectId) {
      const isSubjectValid = displaySubjects.some((s) => s.id === selectedSubjectId);
      if (!isSubjectValid) {
        setSelectedSubjectId('');
      }
    }
  }, [displaySubjects, selectedSubjectId]);

  // Auto-select first subject if only 1 available
  useEffect(() => {
    if (reportTab === 'subject' && displaySubjects.length === 1 && !selectedSubjectId) {
      setSelectedSubjectId(displaySubjects[0].id);
    }
  }, [reportTab, displaySubjects, selectedSubjectId]);

  const handleDownloadSubjectPdf = async (sbObj?: Subject) => {
    const targetSub = sbObj || displaySubjects.find((s) => s.id === selectedSubjectId) || null;
    if (!targetSub || !selectedExam) return;
    try {
      await exportSubjectPerformanceAnalysisPDF({
        school,
        exam: selectedExam,
        subject: targetSub,
        selectedClassId,
        selectedStreamId,
        students,
        marks,
        grades,
        classes,
        teachers,
        allExams: exams,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err) {
      console.error('Failed to export subject performance analysis PDF:', err);
    }
  };

  useEffect(() => {
    if (isStudent && currentUser?.student_id) {
      setSelectedStudentId(currentUser.student_id);
      setReportTab('individual');
    }
  }, [isStudent, currentUser]);

  // In-Memory Remarks Storage
  const [savedRemarksMap, setSavedRemarksMap] = useState<
    Record<string, LearnerReportComment>
  >({});
  const [reportToast, setReportToast] = useState<{ type: 'warning' | 'error' | 'success'; message: string } | null>(null);
  const [isApprovingStream, setIsApprovingStream] = useState<boolean>(false);

  const handleAdminQuickApprove = async () => {
    if (!selectedExam || !targetClass || !currentUser || currentUser.role !== 'admin') return;
    setIsApprovingStream(true);
    try {
      const streamId = targetClass.stream_id || targetClass.id;
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(selectedExam.id, streamId, true);
      } else {
        await api.updateExaminationClassApproval(selectedExam.id, streamId, true, currentUser);
        onMarksUpdated?.();
      }
      setReportToast({
        type: 'success',
        message: `Results approved for ${targetClass.class_name} ${targetClass.stream || ''}. Reports and merit lists are now released.`,
      });
    } catch (err: any) {
      console.error('Failed to approve class stream:', err);
      setReportToast({
        type: 'error',
        message: getUserFriendlyErrorMessage(err, 'Failed to approve class stream results.'),
      });
    } finally {
      setIsApprovingStream(false);
    }
  };

  const handleSaveRemarks = (
    studentId: string,
    examId: string,
    remarks: Partial<LearnerReportComment>
  ) => {
    if (!canModify) {
      setReportToast({
        type: 'warning',
        message: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setReportToast(null), 5000);
      return;
    }
    const key = `${studentId}_${examId}`;
    const cleanedRemarks = { ...remarks };
    if (cleanedRemarks.class_teacher_comment) {
      cleanedRemarks.class_teacher_comment = stripSurroundingQuotes(cleanedRemarks.class_teacher_comment);
    }
    if (cleanedRemarks.hoi_comment) {
      cleanedRemarks.hoi_comment = stripSurroundingQuotes(cleanedRemarks.hoi_comment);
    }
    if (cleanedRemarks.subject_comments) {
      const cleanedSubj: Record<string, string> = {};
      Object.entries(cleanedRemarks.subject_comments).forEach(([k, v]) => {
        cleanedSubj[k] = stripSurroundingQuotes(v);
      });
      cleanedRemarks.subject_comments = cleanedSubj;
    }

    const updated = {
      ...savedRemarksMap[key],
      student_id: studentId,
      exam_id: examId,
      ...cleanedRemarks,
    };
    const newMap = { ...savedRemarksMap, [key]: updated };
    setSavedRemarksMap(newMap);
  };

  // Filter students strictly by class and stream
  const targetStudents = getFilteredStudents(
    accessibleStudents,
    accessibleClasses,
    selectedClassId,
    selectedStreamId,
    selectedExam
  );

  // Fail-closed learner selection: if selected learner is no longer in target cohort, clear selection
  useEffect(() => {
    if (selectedStudentId && !targetStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId('');
    }
  }, [targetStudents, selectedStudentId]);

  const selectedStudent = (students || []).find((s) => s.id === selectedStudentId);

  const meritResults = calculateExamResults(
    selectedExamId,
    targetStudents,
    marks,
    grades
  );

  const analysis = selectedExam
    ? generateExamAnalysisSummary(
        selectedExam.id,
        selectedExam.exam_name,
        targetStudents,
        displaySubjects,
        marks,
        grades
      )
    : null;

  // Batch ZIP Download state
  const schoolTerms = React.useMemo(() => api.getSchoolTerms(), []);
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [dateModalConfig, setDateModalConfig] = useState<{
    isOpen: boolean;
    context: 'single' | 'batch';
    student?: Student;
  } | null>(null);

  const isSelectionComplete = React.useMemo(() => {
    if (!selectedExamId || !selectedClassId) return false;
    if (reportTab === 'class_comparison' && canAccessComparison) {
      return true;
    }
    if (!selectedStreamId) return false;
    if (reportTab === 'individual' && !selectedStudentId) return false;
    if (reportTab === 'subject' && !selectedSubjectId) return false;
    return true;
  }, [selectedExamId, selectedClassId, selectedStreamId, selectedStudentId, selectedSubjectId, reportTab, canAccessComparison]);

  const getMissingSelectionMessage = (): string => {
    if (!selectedExamId) return 'Select an assessment to continue.';
    if (!selectedClassId) return 'Select a class to continue.';
    if (reportTab === 'class_comparison' && canAccessComparison) {
      return '';
    }
    if (!selectedStreamId) return 'Select a stream to continue.';
    if (reportTab === 'individual' && !selectedStudentId) {
      return targetStudents.length === 0
        ? 'No learners found for the selected class and stream.'
        : 'Select a learner to generate the report.';
    }
    if (reportTab === 'subject' && !selectedSubjectId) {
      return 'Select a learning area to view the subject analysis.';
    }
    return 'Complete the filter selections above to generate reports.';
  };

  const handleDownloadSinglePdf = (studentToDownload?: Student) => {
    const targetStudent = studentToDownload || selectedStudent;
    if (!targetStudent) return;
    setDateModalConfig({
      isOpen: true,
      context: 'single',
      student: targetStudent,
    });
  };

  const handleDownloadBatchZip = async () => {
    if (targetStudents.length === 0) return;
    setDateModalConfig({
      isOpen: true,
      context: 'batch',
    });
  };

  const executeConfirmedDownload = async (confirmedDate: string) => {
    if (!dateModalConfig) return;

    if (dateModalConfig.context === 'single') {
      const std = dateModalConfig.student || selectedStudent;
      if (!std) return;
      try {
        await downloadSingleReportCardPDF({
          student: std,
          school,
          exam: selectedExam,
          allExams: exams,
          classes,
          subjects,
          marks,
          grades,
          teachers,
          allStudents: students,
          nextTermOpeningDate: confirmedDate,
          savedRemarks: {
            ...savedRemarksMap[`${std.id}_${selectedExamId}`],
            student_id: std.id,
            exam_id: selectedExamId,
            next_term_opening_date: confirmedDate,
          },
        });
      } catch (err) {
        console.error('Error generating PDF:', err);
      } finally {
        setDateModalConfig(null);
      }
    } else if (dateModalConfig.context === 'batch') {
      if (targetStudents.length === 0) return;
      setIsDownloadingBatch(true);
      setBatchProgress({ current: 0, total: targetStudents.length });

      try {
        const dataList: PDFReportData[] = targetStudents.map((std) => ({
          student: std,
          school,
          exam: selectedExam,
          allExams: exams,
          classes,
          subjects,
          marks,
          grades,
          teachers,
          allStudents: students,
          nextTermOpeningDate: confirmedDate,
          savedRemarks: {
            ...savedRemarksMap[`${std.id}_${selectedExamId}`],
            student_id: std.id,
            exam_id: selectedExamId,
            next_term_opening_date: confirmedDate,
          },
        }));

        await downloadAllReportCardsCombinedPDF(dataList, (current, total) => {
          setBatchProgress({ current, total });
        });
      } catch (err) {
        console.error('Error generating combined PDF:', err);
      } finally {
        setIsDownloadingBatch(false);
        setDateModalConfig(null);
      }
    }
  };

  // Grade counts for Pie chart
  const pieData = grades.map((g) => ({
    name: `${g.grade_code || g.grade} (${g.descriptor})`,
    value: analysis?.grade_counts[g.grade_code || g.grade || ''] || 0,
  }));
  const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  const isExamApproved = Boolean(
    selectedExam &&
      (selectedExam.status === 'Approved' ||
        selectedExam.status === 'Published' ||
        selectedExam.status === 'Official Results Released' ||
        isClassExamApproved(selectedExam, targetClass) ||
        (selectedStreamId && selectedStreamId !== 'all' && (selectedExam.approved_classes || []).includes(selectedStreamId)) ||
        (targetClass && (selectedExam.approved_classes || []).includes(targetClass.stream_id || targetClass.id)) ||
        (currentUser?.role === 'admin' && (
          (selectedExam.approved_classes && selectedExam.approved_classes.length > 0 && (
            !selectedClassId ||
            accessibleClasses.some(c =>
              (c.class_name === selectedClassId || c.id === selectedClassId) &&
              (selectedExam.approved_classes || []).includes(c.stream_id || c.id)
            )
          )) ||
          (selectedExam.approved_levels && selectedExam.approved_levels.length > 0)
        ))
      )
  );

  if (!canGenerateReports(activeTermObj.status)) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="bg-amber-100 text-amber-800 p-6 rounded-2xl max-w-md mx-auto">
          <h2 className="text-lg font-bold mb-2">Term {activeTermObj.status}</h2>
          <p className="text-sm">{getTermStatusMessage(activeTermObj.status)}</p>
          <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700">
            Return
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header (Hidden in Print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2 tracking-tight">
            <FileBarChart className="w-5 h-5 text-[#176B45] dark:text-emerald-400" />
            <span>Assessment Reports</span>
          </h1>
        </div>

        {/* Compact Segmented Navigation Bar */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
          {!isSubjectTeacherOnly && (
            <>
              <button
                onClick={() => setReportTab('individual')}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
                  reportTab === 'individual'
                    ? 'bg-[#176B45] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Learner</span>
              </button>

              <button
                onClick={() => setReportTab('batch')}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
                  reportTab === 'batch'
                    ? 'bg-[#176B45] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Class</span>
              </button>
            </>
          )}

          {!isSubjectTeacherOnly && (
            <button
              onClick={() => setReportTab('merit')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
                reportTab === 'merit'
                  ? 'bg-[#176B45] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Merit List</span>
            </button>
          )}

          <button
            onClick={() => setReportTab('subject')}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
              reportTab === 'subject'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Learning Area Analysis</span>
          </button>

          {canAccessComparison && (
            <button
              type="button"
              id="class-comparison-tab-btn"
              onClick={() => {
                setReportTab('class_comparison');
                if (selectedStreamId !== 'all') {
                  setSelectedStreamId('all');
                }
              }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
                reportTab === 'class_comparison'
                  ? 'bg-[#176B45] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Class Performance Comparison</span>
            </button>
          )}

          {!isSubjectTeacherOnly && (
            <button
              id="terminal-results-tab-btn"
              onClick={() => setReportTab('terminal')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
                reportTab === 'terminal'
                  ? 'bg-[#176B45] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Terminal Results</span>
            </button>
          )}

          {!isSubjectTeacherOnly && (
            <button
              onClick={() => setReportTab('grades')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center space-x-1.5 ${
                reportTab === 'grades'
                  ? 'bg-[#176B45] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Distribution</span>
            </button>
          )}
        </div>

        {/* Primary Action Button (When Applicable) */}
        {(reportTab === 'batch' || reportTab === 'individual') && (
          <div className="flex items-center gap-2">
            {reportTab === 'batch' ? (
              <button
                onClick={handleDownloadBatchZip}
                disabled={isDownloadingBatch || targetStudents.length === 0}
                className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
              >
                {isDownloadingBatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>
                  {isDownloadingBatch
                    ? `PDF (${batchProgress.current}/${batchProgress.total})`
                    : 'Combined Class PDF'}
                </span>
              </button>
            ) : reportTab === 'individual' ? (
              <button
                onClick={handleDownloadSinglePdf}
                disabled={!selectedStudent}
                className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Learner PDF</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {reportToast && (
        <div
          role="status"
          aria-live="polite"
          className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          {reportToast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 dark:text-amber-400" />
          ) : reportToast.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="text-xs font-bold leading-tight truncate">{reportToast.message}</span>
        </div>
      )}

      {/* Filter Controls Panel (Hidden in Print and in Terminal Tab) */}
      {reportTab !== 'terminal' && (
        <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 shadow-xs border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center space-x-1.5 text-[#176B45] dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-[#176B45] dark:text-emerald-400" />
          <span>Filters</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Assessment</label>
            <select
              value={selectedExamId}
              onChange={(e) => {
                const newExamId = e.target.value;
                setSelectedExamId(newExamId);
                if (!isClassTeacherRole || reportTab === 'subject' || reportTab === 'class_comparison') {
                  setSelectedClassId('');
                  setSelectedStreamId('');
                  setSelectedStudentId('');
                } else if (primaryClass) {
                  setSelectedClassId(primaryClass.class_name);
                  setSelectedStreamId(primaryClass.stream_id || primaryClass.id);
                  // Student will be auto-set by the effect
                }
              }}
              className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select Assessment...</option>
              {groupExamsForDropdown(filteredExamsForDropdown, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                <optgroup key={`grp_${gIdx}`} label={grp.label}>
                  {grp.exams.map(({ exam: ex, label: optLabel }) => (
                    <option key={ex.id} value={ex.id}>
                      {optLabel}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {isClassTeacherRole && primaryClass && reportTab !== 'subject' && reportTab !== 'class_comparison' ? (
            <div className="col-span-2 lg:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Assigned Class & Stream</label>
              <div className="w-full h-9 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-1.5 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[#176B45] dark:text-emerald-400 shrink-0" />
                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {primaryClass.class_name} {primaryClass.stream}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                    ({targetStudents.length} learners)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-700/60 shrink-0">
                  Class Teacher
                </span>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Class</label>
                <select
                  value={selectedExamId ? selectedClassId : ''}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedStreamId('');
                    setSelectedStudentId('');
                  }}
                  disabled={!selectedExamId}
                  className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                  {!selectedExamId ? (
                    <option value="">Select Assessment First...</option>
                  ) : (
                    <>
                      <option value="">Select Class...</option>
                      {uniqueClasses.map((className, idx) => {
                        const count = getFilteredStudents(accessibleStudents, inScopeClasses, className, 'all', selectedExam).length;
                        return (
                          <option key={`${className}_${idx}`} value={className}>
                            {className} ({count} learners)
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Stream {reportTab === 'class_comparison' && canAccessComparison && (
                    <span className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400 ml-1">
                      (All Streams in Comparison)
                    </span>
                  )}
                </label>
                <select
                  value={selectedExamId && selectedClassId ? selectedStreamId : ''}
                  onChange={(e) => {
                    setSelectedStreamId(e.target.value);
                    setSelectedStudentId('');
                  }}
                  disabled={!selectedExamId || !selectedClassId}
                  className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                  {!selectedClassId ? (
                    <option value="">Select Class First...</option>
                  ) : (
                    <>
                      <option value="">Select Stream...</option>
                      <option value="all">
                        All Streams {reportTab === 'class_comparison' && canAccessComparison ? '(Comparison Mode)' : ''}
                      </option>
                      {sortClasses(inScopeClasses
                        .filter(
                          (c) =>
                            c.class_name.toLowerCase() === selectedClassId.toLowerCase() ||
                            c.id === selectedClassId
                        ))
                        .map((c, idx) => (
                          <option key={`${c.stream_id || c.id}_${c.stream}_${idx}`} value={c.stream_id || c.id}>
                            {c.class_name} - {c.stream} ({getFilteredStudents(accessibleStudents, inScopeClasses, c.class_name, c.stream_id || c.id, selectedExam).length} learners)
                          </option>
                        ))}
                    </>
                  )}
                </select>
              </div>
            </>
          )}

          {reportTab === 'subject' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Learning Area</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={!selectedExamId || !selectedClassId}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              >
                {!selectedExamId ? (
                  <option value="">Select Assessment First...</option>
                ) : !selectedClassId ? (
                  <option value="">Select Class First...</option>
                ) : (
                  <>
                    <option value="">Select Learning Area...</option>
                    {displaySubjects.map((sb, idx) => (
                      <option key={`${sb.id}_${idx}`} value={sb.id}>
                        {sb.subject_name} ({sb.subject_code})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          )}

          {reportTab === 'individual' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Learner</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!selectedStreamId}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              >
                {!selectedStreamId ? (
                  <option value="">Select Stream First...</option>
                ) : targetStudents.length > 0 ? (
                  <>
                    <option value="">Select Learner...</option>
                    {targetStudents.map((std, idx) => {
                      const adm = std.admission_number?.trim();
                      const displayLabel = adm ? `${std.full_name} — ${adm}` : std.full_name;
                      return (
                        <option key={`${std.id}_${idx}`} value={std.id}>
                          {displayLabel}
                        </option>
                      );
                    })}
                  </>
                ) : (
                  <option value="">No learners found</option>
                )}
              </select>
            </div>
          )}
        </div>
      </div>
      )}

      {reportTab === 'terminal' ? (() => {
        const candidates = selectedClassId
          ? accessibleClasses.filter((c) => c.class_name.toLowerCase() === selectedClassId.toLowerCase())
          : [];
        const targetClassStream = selectedStreamId && selectedStreamId !== 'all'
          ? accessibleClasses.find((c) => (c.stream_id === selectedStreamId || c.id === selectedStreamId))
          : candidates.length === 1
          ? candidates[0]
          : null;
        const resolvedClassId = targetClassStream
          ? (targetClassStream.stream_id || targetClassStream.id)
          : '';
        return (
          <TerminalResultsView
            school={school}
            students={students}
            subjects={subjects}
            exams={exams}
            marks={marks}
            grades={grades}
            classes={classes}
            teachers={teachers}
            currentUser={currentUser}
            initialClassId={resolvedClassId}
            initialStreamId={selectedStreamId}
            initialStudentId={selectedStudentId}
          />
        );
      })() : (
        <>
          {isLoadingMarks ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs my-6">
              <LoadingIndicator minHeight="min-h-[300px]" />
            </div>
          ) : !isExamApproved ? (
        (() => {
          const examStatus = selectedExam?.status || 'Draft';
          const analysisDone = ['Verification', 'Provisional', 'Approved', 'Published', 'Official Results Released'].includes(examStatus);
          const validationFailed = examStatus.toLowerCase().includes('fail') || examStatus.toLowerCase().includes('block');
          const validationPassed = analysisDone && !validationFailed;
          const hasPartialApproval = Boolean(
            (selectedExam?.approved_levels && selectedExam.approved_levels.length > 0) ||
            (selectedExam?.approved_classes && selectedExam.approved_classes.length > 0)
          );

          let statusBadgeStyle = 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800';
          if (validationFailed) {
            statusBadgeStyle = 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800';
          } else if (examStatus === 'Open' || examStatus === 'Verification' || examStatus === 'Provisional') {
            statusBadgeStyle = 'bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800';
          }

          // Gate heading and description explaining prerequisite requirements
          let gateTitle = 'Official Results Approval Required';
          let gateDescription = 'This assessment has not yet completed the required validation and approval process before official reports and merit lists can be released.';
          const nextDestination = 'results-approval';
          const ctaLabel = 'Go to Results Approval';

          if (validationFailed) {
            gateTitle = 'Validation Issues Detected';
            gateDescription = 'Blocking data issues were detected during analysis. Review and approve results once validation issues are cleared.';
          } else if (hasPartialApproval) {
            gateTitle = 'Assessment Approval in Progress';
            gateDescription = 'Selected class or level is pending authorization in the Results Approval matrix.';
          } else if (!analysisDone) {
            gateTitle = 'Assessment Analysis & Approval Required';
            gateDescription = 'This assessment must complete the validation and approval process before official reports and merit lists can be released.';
          }

          return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200/90 dark:border-amber-800/80 shadow-xs p-5 max-w-lg mx-auto my-6 space-y-4 text-slate-800 dark:text-slate-200">
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200/80 dark:border-amber-800/60 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{gateTitle}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${statusBadgeStyle}`}>
                      {examStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-normal">
                    {gateDescription}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 space-y-2.5 text-xs">
                <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                  Official reports, rankings, analytics, and exports require:
                </p>
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-2 min-w-0">
                      {analysisDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">1. Assessment Analysis</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${analysisDone ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                      {analysisDone ? 'Completed' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-2 min-w-0">
                      {validationFailed ? (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : validationPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">2. Zero Blocking Validation Issues</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      validationFailed
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                        : validationPassed
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                    }`}>
                      {validationFailed ? 'Failed' : validationPassed ? 'Passed' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-2 min-w-0">
                      {isExamApproved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : hasPartialApproval ? (
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">3. Official Examination Approval</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      isExamApproved
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                        : hasPartialApproval
                        ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                    }`}>
                      {isExamApproved ? 'Approved' : hasPartialApproval ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Action Button respecting role permissions */}
              {(currentUser?.role === 'admin' || ((currentUser?.role === 'class_teacher' || isClassTeacher) && nextDestination === 'results-approval')) && (
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-start sm:justify-end gap-2">
                  {currentUser?.role === 'admin' && targetClass && (
                    <button
                      onClick={handleAdminQuickApprove}
                      disabled={isApprovingStream}
                      className="w-full sm:w-auto bg-[#176B45] hover:bg-[#0F5132] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                      title="Approve stream results directly as Administrator"
                    >
                      {isApprovingStream ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Approving &amp; Unlocking...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Approve &amp; Release Reports (Admin)</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => onNavigateToTab?.(nextDestination)}
                    className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer min-h-[44px]"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>{ctaLabel}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <>
          {/* SELECTION INCOMPLETE PLACEHOLDER */}
          {!isSelectionComplete ? (
            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-3.5 sm:p-4 max-w-lg mx-auto my-6 shadow-xs flex items-center space-x-3.5 text-amber-900 dark:text-amber-200">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-lg shrink-0">
                <Filter className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Selection Required
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {getMissingSelectionMessage()}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: INDIVIDUAL LEARNER ASSESSMENT REPORT */}
              {reportTab === 'individual' && selectedStudent && (
                <AdminLearnerAssessmentSummary
                  canModify={canModify}
                  student={selectedStudent}
                  school={school}
                  classes={classes}
                  subjects={subjects}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  teachers={teachers}
                  currentUser={currentUser}
                  selectedExamId={selectedExamId}
                  allStudents={students}
                  savedRemarks={savedRemarksMap[`${selectedStudent.id}_${selectedExamId}`]}
                  onSaveRemarks={handleSaveRemarks}
                  schoolTerms={schoolTerms}
                  onRequestDownloadWithDate={(std) => {
                    handleDownloadSinglePdf(std);
                  }}
                />
              )}

              {/* TAB 2: BATCH CLASS REPORTS */}
              {reportTab === 'batch' && (
                <AdminBatchAssessmentSummary
                  canModify={canModify}
                  school={school}
                  classes={classes}
                  subjects={subjects}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  teachers={teachers}
                  currentUser={currentUser}
                  selectedExamId={selectedExamId}
                  selectedClassId={selectedClassId}
                  selectedStreamId={selectedStreamId}
                  targetStudents={targetStudents}
                  allStudents={students}
                  savedRemarksMap={savedRemarksMap}
                  onSelectLearner={(studentId) => {
                    setSelectedStudentId(studentId);
                    setReportTab('individual');
                  }}
                  onDownloadBatchPdf={handleDownloadBatchZip}
                  isDownloadingBatch={isDownloadingBatch}
                  batchProgress={batchProgress}
                  schoolTerms={schoolTerms}
                  onRequestDownloadSinglePdf={(std) => {
                    handleDownloadSinglePdf(std);
                  }}
                />
              )}

              {/* TAB 3: CLASS MERIT LIST */}
              {reportTab === 'merit' && (
                <CbeMeritListReport
                  school={school}
                  students={students}
                  subjects={subjects}
                  exam={selectedExam}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  classes={classes}
                  teachers={teachers}
                  selectedClassId={selectedClassId}
                  selectedStreamId={selectedStreamId}
                  onClassChange={(classId) => {
                    setSelectedClassId(classId);
                    setSelectedStreamId('all');
                  }}
                  generatedBy="Administrator"
                />
              )}

              {/* TAB 4: LEARNING AREA ANALYSIS */}
              {reportTab === 'subject' && analysis && (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div>
                            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                              Learning Area Analysis
                            </h2>
                          </div>

                          <button
                            onClick={() => handleDownloadSubjectPdf()}
                            className="bg-[#176B45] hover:bg-[#0F5132] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5 shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export PDF</span>
                          </button>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-900 dark:bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                                <th className="p-3">Learning Area Code</th>
                                <th className="p-3">Learning Area Name</th>
                                <th className="p-3 text-center">Mean Score (%)</th>
                                <th className="p-3 text-center">Mean Points</th>
                                <th className="p-3 text-center">Highest Mark</th>
                                <th className="p-3 text-center">Lowest Mark</th>
                                <th className="p-3 text-center">Pass Rate (%)</th>
                                <th className="p-3 text-center">Export PDF</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {analysis.subject_summaries.map((s) => {
                                const sbObj = (subjects || []).find((sub) => sub.id === s.subject_id || sub.subject_code === s.subject_code);
                                return (
                                  <tr key={s.subject_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
                                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{s.subject_code}</td>
                                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{s.subject_name}</td>
                                    <td className="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400">{Math.round(s.mean_score)}%</td>
                                    <td className="p-3 text-center font-bold text-indigo-800 dark:text-indigo-400">{s.mean_points} Pts</td>
                                    <td className="p-3 text-center font-bold text-emerald-700 dark:text-emerald-400">{Math.round(s.highest)}%</td>
                                    <td className="p-3 text-center font-bold text-rose-700 dark:text-rose-400">{Math.round(s.lowest)}%</td>
                                    <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">{Math.round(s.pass_rate)}%</td>
                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => handleDownloadSubjectPdf(sbObj)}
                                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md text-[11px] border border-slate-300 dark:border-slate-700 transition flex items-center justify-center space-x-1 mx-auto"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>PDF Report</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

              {/* TAB 5: CLASS PERFORMANCE COMPARISON */}
              {reportTab === 'class_comparison' && canAccessComparison && (
                selectedExam && selectedClassId ? (
                  <ClassPerformanceComparisonView
                    examination={selectedExam}
                    selectedClassIdOrName={selectedClassId}
                    students={accessibleStudents}
                    classes={accessibleClasses}
                    subjects={displaySubjects}
                    marks={marks}
                    grades={grades}
                    teachers={teachers}
                    school={school}
                  />
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs text-center text-slate-500 dark:text-slate-400">
                    Please select an Examination and a Class/Grade from the filter bar above to view the Class Performance Comparison.
                  </div>
                )
              )}

              {/* TAB 6: GRADE DISTRIBUTION */}
              {reportTab === 'grades' && (() => {
                const effectiveEduLevel =
                  targetClass?.education_level ||
                  (selectedClassId ? getEducationLevelForGrade(selectedClassId) : (selectedExam?.education_level && selectedExam.education_level !== 'All Levels' ? selectedExam.education_level : 'Junior School'));
                const isJuniorSchool = effectiveEduLevel === 'Junior School';

                return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chart Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                      Grade Distribution Chart ({isJuniorSchool ? 'CBE 8-Point Scale' : 'CBE 4-Level Scale'})
                    </h2>
                    <ChartWrapper className="h-64 w-full" hasData={pieData.some(d => d.value > 0)}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartWrapper>
                  </div>

                  {/* Level Breakdown Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                      CBE Performance Level Breakdown
                    </h2>
                    <div className="space-y-3">
                      {grades.map((g) => {
                        const code = g.grade_code || g.grade || '';
                        const count = analysis?.grade_counts[code] || 0;
                        const min = g.minimum_score ?? g.minimum_marks ?? 0;
                        const max = g.maximum_score ?? g.maximum_marks ?? 100;

                        return (
                          <div key={g.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
                            <div>
                              <span className="font-extrabold text-[#176B45] dark:text-emerald-400 text-sm">{code}</span> &bull;{' '}
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{g.performance_level} ({g.descriptor})</span>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Score Range: {min}% - {max}% &bull; {g.points} Points</div>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-slate-900 dark:text-slate-100">{count}</span>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Learners</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CBE Achievement Scale Reference Table Card */}
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                      <span>{isJuniorSchool ? 'CBE 8-Point Achievement Scale Reference Table' : 'CBE 4-Level Achievement Scale Reference Table'}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{isJuniorSchool ? 'Junior School Standard' : `${effectiveEduLevel} Standard`}</span>
                    </h2>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 dark:bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider text-center">
                            <th className="p-2 border-r border-slate-800 dark:border-slate-700">CODE</th>
                            <th className="p-2 border-r border-slate-800 dark:border-slate-700 text-left">PERFORMANCE LEVEL</th>
                            <th className="p-2 border-r border-slate-800 dark:border-slate-700">SCORE RANGE</th>
                            <th className="p-2">POINTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                          {isJuniorSchool ? (
                            <>
                              <tr className="bg-emerald-50/40 dark:bg-emerald-950/40">
                                <td className="p-2 text-center font-extrabold text-emerald-800 dark:text-emerald-300">EE1</td>
                                <td className="p-2 font-bold text-emerald-900 dark:text-emerald-200">Exceeding Expectations (Level 1)</td>
                                <td className="p-2 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300">90 – 100%</td>
                                <td className="p-2 text-center font-black text-emerald-900 dark:text-emerald-200">8 Pts</td>
                              </tr>
                              <tr className="bg-emerald-50/20 dark:bg-emerald-950/20">
                                <td className="p-2 text-center font-extrabold text-emerald-700 dark:text-emerald-400">EE2</td>
                                <td className="p-2 font-bold text-emerald-900 dark:text-emerald-200">Exceeding Expectations (Level 2)</td>
                                <td className="p-2 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">75 – 89%</td>
                                <td className="p-2 text-center font-black text-emerald-900 dark:text-emerald-200">7 Pts</td>
                              </tr>
                              <tr className="bg-blue-50/40 dark:bg-blue-950/40">
                                <td className="p-2 text-center font-extrabold text-blue-800 dark:text-blue-300">ME1</td>
                                <td className="p-2 font-bold text-blue-900 dark:text-blue-200">Meeting Expectations (Level 1)</td>
                                <td className="p-2 text-center font-mono font-bold text-blue-800 dark:text-blue-300">58 – 74%</td>
                                <td className="p-2 text-center font-black text-blue-900 dark:text-blue-200">6 Pts</td>
                              </tr>
                              <tr className="bg-blue-50/20 dark:bg-blue-950/20">
                                <td className="p-2 text-center font-extrabold text-blue-700 dark:text-blue-400">ME2</td>
                                <td className="p-2 font-bold text-blue-900 dark:text-blue-200">Meeting Expectations (Level 2)</td>
                                <td className="p-2 text-center font-mono font-bold text-blue-700 dark:text-blue-400">41 – 57%</td>
                                <td className="p-2 text-center font-black text-blue-900 dark:text-blue-200">5 Pts</td>
                              </tr>
                              <tr className="bg-amber-50/40 dark:bg-amber-950/40">
                                <td className="p-2 text-center font-extrabold text-amber-800 dark:text-amber-300">AE1</td>
                                <td className="p-2 font-bold text-amber-900 dark:text-amber-200">Approaching Expectations (Level 1)</td>
                                <td className="p-2 text-center font-mono font-bold text-amber-800 dark:text-amber-300">31 – 40%</td>
                                <td className="p-2 text-center font-black text-amber-900 dark:text-amber-200">4 Pts</td>
                              </tr>
                              <tr className="bg-amber-50/20 dark:bg-amber-950/20">
                                <td className="p-2 text-center font-extrabold text-amber-700 dark:text-amber-400">AE2</td>
                                <td className="p-2 font-bold text-amber-900 dark:text-amber-200">Approaching Expectations (Level 2)</td>
                                <td className="p-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400">21 – 30%</td>
                                <td className="p-2 text-center font-black text-amber-900 dark:text-amber-200">3 Pts</td>
                              </tr>
                              <tr className="bg-rose-50/40 dark:bg-rose-950/40">
                                <td className="p-2 text-center font-extrabold text-rose-800 dark:text-rose-300">BE1</td>
                                <td className="p-2 font-bold text-rose-900 dark:text-rose-200">Below Expectations (Level 1)</td>
                                <td className="p-2 text-center font-mono font-bold text-rose-800 dark:text-rose-300">11 – 20%</td>
                                <td className="p-2 text-center font-black text-rose-900 dark:text-rose-200">2 Pts</td>
                              </tr>
                              <tr className="bg-rose-50/20 dark:bg-rose-950/20">
                                <td className="p-2 text-center font-extrabold text-rose-700 dark:text-rose-400">BE2</td>
                                <td className="p-2 font-bold text-rose-900 dark:text-rose-200">Below Expectations (Level 2)</td>
                                <td className="p-2 text-center font-mono font-bold text-rose-700 dark:text-rose-400">0 – 10%</td>
                                <td className="p-2 text-center font-black text-rose-900 dark:text-rose-200">1 Pt</td>
                              </tr>
                            </>
                          ) : (
                            <>
                              <tr className="bg-emerald-50/40 dark:bg-emerald-950/40">
                                <td className="p-2 text-center font-extrabold text-emerald-800 dark:text-emerald-300">EE</td>
                                <td className="p-2 font-bold text-emerald-900 dark:text-emerald-200">Exceeding Expectations</td>
                                <td className="p-2 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300">80 – 100%</td>
                                <td className="p-2 text-center font-black text-emerald-900 dark:text-emerald-200">4 Pts</td>
                              </tr>
                              <tr className="bg-blue-50/40 dark:bg-blue-950/40">
                                <td className="p-2 text-center font-extrabold text-blue-800 dark:text-blue-300">ME</td>
                                <td className="p-2 font-bold text-blue-900 dark:text-blue-200">Meeting Expectations</td>
                                <td className="p-2 text-center font-mono font-bold text-blue-800 dark:text-blue-300">50 – 79%</td>
                                <td className="p-2 text-center font-black text-blue-900 dark:text-blue-200">3 Pts</td>
                              </tr>
                              <tr className="bg-amber-50/40 dark:bg-amber-950/40">
                                <td className="p-2 text-center font-extrabold text-amber-800 dark:text-amber-300">AE</td>
                                <td className="p-2 font-bold text-amber-900 dark:text-amber-200">Approaching Expectations</td>
                                <td className="p-2 text-center font-mono font-bold text-amber-800 dark:text-amber-300">30 – 49%</td>
                                <td className="p-2 text-center font-black text-amber-900 dark:text-amber-200">2 Pts</td>
                              </tr>
                              <tr className="bg-rose-50/40 dark:bg-rose-950/40">
                                <td className="p-2 text-center font-extrabold text-rose-800 dark:text-rose-300">BE</td>
                                <td className="p-2 font-bold text-rose-900 dark:text-rose-200">Below Expectations</td>
                                <td className="p-2 text-center font-mono font-bold text-rose-800 dark:text-rose-300">0 – 29%</td>
                                <td className="p-2 text-center font-black text-rose-900 dark:text-rose-200">1 Pt</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                );
              })()}
            </>
          )}
        </>
      )}
        </>
      )}

      {/* MANDATORY NEXT TERM OPENING DATE GATE MODAL */}
      <NextTermOpeningDateModal
        isOpen={Boolean(dateModalConfig?.isOpen)}
        exam={selectedExam}
        schoolTerms={schoolTerms}
        initialDate={
          dateModalConfig?.student
            ? savedRemarksMap[`${dateModalConfig.student.id}_${selectedExamId}`]?.next_term_opening_date
            : undefined
        }
        studentName={dateModalConfig?.student?.full_name}
        totalCount={dateModalConfig?.context === 'batch' ? targetStudents.length : undefined}
        cohortCount={dateModalConfig?.context === 'batch' ? targetStudents.length : undefined}
        downloadContext={dateModalConfig?.context || 'single'}
        onConfirm={executeConfirmedDownload}
        onClose={() => setDateModalConfig(null)}
        isProcessing={isDownloadingBatch}
      />
    </div>
  );
};
