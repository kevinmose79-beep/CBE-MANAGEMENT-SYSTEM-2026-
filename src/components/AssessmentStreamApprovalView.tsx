import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  BarChart3,
  FileBarChart,
  RefreshCw,
  Users,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Examination,
  ClassStream,
  Subject,
  Student,
  Mark,
  Grade,
  Teacher,
  User,
  getAllocatedSubjectsForClass,
} from '../types';
import { api, subscribeToMarksRealtime, unsubscribeFromMarksRealtime, RealtimeMarkEvent } from '../lib/storage';
import { evaluateMark } from '../utils/markUtils';
import { isClassExamApproved } from '../utils/examLockUtils';
import { getActiveTeacher, getAccessiblePrimaryClasses } from '../utils/rbacUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { getDisplayExamName, getDisplayExamType, groupExamsForDropdown } from '../utils/examDisplayUtils';
import { filterExamsForClassScope } from '../utils/filterUtils';

interface AssessmentStreamApprovalViewProps {
  exams: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  students: Student[];
  marks: Mark[];
  grades?: Grade[];
  teachers?: Teacher[];
  currentUser?: User | null;
  onNavigateToTab?: (tab: any) => void;
  onMarksUpdated?: () => void;
  onUpdateExamClassApproval?: (examId: string, classStreamId: string, approved: boolean) => Promise<void> | void;
}

export const AssessmentStreamApprovalView: React.FC<AssessmentStreamApprovalViewProps> = ({
  exams = [],
  classes = [],
  subjects = [],
  students = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser = null,
  onNavigateToTab,
  onMarksUpdated,
  onUpdateExamClassApproval,
}) => {
  const { viewingYear: activeYearObj, viewingTerm: activeTermObj } = useAcademicSession();

  // 1. Resolve Active Teacher & Primary Assigned Class/Stream(s)
  const activeTeacher = useMemo(
    () => getActiveTeacher(currentUser, teachers),
    [currentUser, teachers]
  );

  const primaryClasses = useMemo(
    () => getAccessiblePrimaryClasses(currentUser, activeTeacher, classes),
    [currentUser, activeTeacher, classes]
  );

  // Selected Class Stream State (Default to first assigned stream if available)
  const [selectedStreamKey, setSelectedStreamKey] = useState<string>('');

  useEffect(() => {
    if (primaryClasses.length > 0) {
      const exists = primaryClasses.some(
        (c) => (c.stream_id || c.id) === selectedStreamKey
      );
      if (!exists) {
        setSelectedStreamKey(primaryClasses[0].stream_id || primaryClasses[0].id);
      }
    } else {
      setSelectedStreamKey('');
    }
  }, [primaryClasses, selectedStreamKey]);

  const activePrimaryClass = useMemo(() => {
    if (primaryClasses.length === 0) return null;
    return (
      primaryClasses.find((c) => (c.stream_id || c.id) === selectedStreamKey) ||
      primaryClasses[0]
    );
  }, [primaryClasses, selectedStreamKey]);

  // Filter exams based on selected stream / class context to ensure class-level and education-level awareness
  const filteredExams = useMemo(() => {
    return filterExamsForClassScope(
      exams,
      activePrimaryClass?.id || activePrimaryClass?.class_name,
      primaryClasses,
      activePrimaryClass,
      currentUser?.role
    );
  }, [exams, activePrimaryClass, primaryClasses, currentUser?.role]);

  // 2. Target Assessment Selection State
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Default Assessment selection to matching active Academic Year & Term
  useEffect(() => {
    if (filteredExams.length > 0 && (!selectedExamId || !filteredExams.some((e) => e.id === selectedExamId))) {
      let defaultExam: Examination | undefined;

      if (activeYearObj && activeTermObj) {
        defaultExam = filteredExams.find((e) => {
          const matchYear = e.academic_year_id
            ? e.academic_year_id === activeYearObj.id
            : e.year === activeYearObj.year;
          const matchTerm = e.term === activeTermObj.term_name;
          return matchYear && matchTerm;
        });
      }

      if (!defaultExam) {
        defaultExam = filteredExams[0];
      }

      if (defaultExam) {
        setSelectedExamId(defaultExam.id);
      }
    }
  }, [filteredExams, activeYearObj, activeTermObj, selectedExamId]);

  const selectedExam = useMemo(
    () => filteredExams.find((e) => e.id === selectedExamId) || null,
    [filteredExams, selectedExamId]
  );

  // 3. Mark Data Synchronization & Realtime Management
  const [localMarks, setLocalMarks] = useState<Mark[] | null>(null);
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const lastFetchedExamIdRef = useRef<string | null>(null);

  const effectiveMarks = localMarks ?? marks;

  // Fetch marks when exam selection changes
  useEffect(() => {
    if (!selectedExamId) {
      setIsLoadingMarks(false);
      setFetchError(null);
      return;
    }

    if (lastFetchedExamIdRef.current === selectedExamId && localMarks !== null && !fetchError) {
      return;
    }

    let isMounted = true;
    setIsLoadingMarks(true);
    setFetchError(null);

    api
      .fetchMarksForExam(selectedExamId)
      .then(() => {
        if (isMounted) {
          lastFetchedExamIdRef.current = selectedExamId;
          const freshMarks = api.getMarks();
          setLocalMarks(freshMarks);
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('AssessmentStreamApproval: Error fetching marks:', err);
        if (isMounted) {
          setFetchError('Failed to synchronize latest marks from server. Showing cached marks.');
          setIsLoadingMarks(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, onMarksUpdated]);

  // Realtime subscription for mark changes
  useEffect(() => {
    const handleRealtimeEvent = (event: RealtimeMarkEvent) => {
      const record = event.newRecord || event.oldRecord;
      if (record && record.exam_id === selectedExamId) {
        const freshMarks = api.getMarks();
        setLocalMarks(freshMarks);
      }
    };

    subscribeToMarksRealtime(handleRealtimeEvent);
    return () => {
      unsubscribeFromMarksRealtime(handleRealtimeEvent);
    };
  }, [selectedExamId]);

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    if (!selectedExamId) return;
    setIsRefreshing(true);
    setFetchError(null);
    try {
      await api.fetchMarksForExam(selectedExamId);
      const freshMarks = api.getMarks();
      setLocalMarks(freshMarks);
      onMarksUpdated?.();
    } catch (err: any) {
      console.error('Manual refresh failed:', err);
      setFetchError('Failed to refresh marks. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 4. Memoized Mark Map
  const markMap = useMemo(() => {
    const map = new Map<string, Mark>();
    if (effectiveMarks) {
      effectiveMarks.forEach((m) => {
        if (m.student_id && m.subject_id && m.exam_id) {
          map.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m);
        }
      });
    }
    return map;
  }, [effectiveMarks]);

  // 5. Applicable Subjects for the Class Teacher's Stream
  const applicableSubjects = useMemo(() => {
    if (!activePrimaryClass) return [];
    const subs = getAllocatedSubjectsForClass(activePrimaryClass, subjects);
    return (subs || []).filter((s): s is Subject => Boolean(s && s.id));
  }, [activePrimaryClass, subjects]);

  // Map of Subject ID -> Allocated Subject Teacher Name
  const subjectTeacherMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!activePrimaryClass) return map;

    const targetStreamId = activePrimaryClass.stream_id || activePrimaryClass.id;
    const targetClassName = activePrimaryClass.class_name?.toLowerCase();
    const targetStreamName = activePrimaryClass.stream?.toLowerCase();

    applicableSubjects.forEach((sub) => {
      if (!sub || !sub.id) return;
      const teacher = (teachers || []).find((t) => {
        if (!t || !Array.isArray(t.allocations)) return false;
        return t.allocations.some((alloc) => {
          if (!alloc) return false;
          const matchSub =
            alloc.subject_id === sub.id ||
            (alloc.subject_code && sub.subject_code && alloc.subject_code.toLowerCase() === sub.subject_code.toLowerCase()) ||
            (alloc.subject_name && sub.subject_name && alloc.subject_name.toLowerCase() === sub.subject_name.toLowerCase());
          if (!matchSub) return false;

          if (alloc.stream_id && (alloc.stream_id === targetStreamId || alloc.stream_id === activePrimaryClass.id)) {
            return true;
          }
          if (alloc.class_id && alloc.class_id === activePrimaryClass.id) {
            return true;
          }
          if (alloc.class_name && alloc.stream && targetClassName && targetStreamName) {
            return (
              alloc.class_name.toLowerCase() === targetClassName &&
              alloc.stream.toLowerCase() === targetStreamName
            );
          }
          return false;
        });
      });

      if (teacher) {
        map.set(sub.id, teacher.teacher_name || (teacher as any).name || 'Assigned Teacher');
      }
    });

    return map;
  }, [applicableSubjects, activePrimaryClass, teachers]);

  // 6. Strict Stream Learners Resolution
  const classLearners = useMemo(() => {
    if (!activePrimaryClass) return [];

    const targetStreamId = activePrimaryClass.stream_id || activePrimaryClass.id;
    const targetClassId = activePrimaryClass.id;

    return students
      .filter((s) => {
        if (selectedExam) {
          const examContext = getLearnerClassAtExamTime(s, selectedExam, classes);
          if (activePrimaryClass.stream_id) {
            return examContext.stream_id === activePrimaryClass.stream_id;
          }
          return (
            examContext.class_id === targetClassId ||
            examContext.stream_id === targetClassId
          );
        }

        if (activePrimaryClass.stream_id) {
          return s.stream_id === activePrimaryClass.stream_id;
        }
        return s.class_id === targetClassId;
      })
      .sort((a, b) => {
        const admA = a.admission_number || '';
        const admB = b.admission_number || '';
        return admA.localeCompare(admB, undefined, { numeric: true });
      });
  }, [students, activePrimaryClass, selectedExam, classes]);

  // 7. Evaluated Learner Records & Progress
  interface LearnerProgressRow {
    student: Student;
    completedCount: number;
    missingCount: number;
    xCount: number;
    yCount: number;
    totalExpected: number;
    completionPct: number;
    missingSubjects: Subject[];
  }

  const evaluatedLearners: LearnerProgressRow[] = useMemo(() => {
    if (!selectedExam || classLearners.length === 0 || applicableSubjects.length === 0) {
      return [];
    }

    return classLearners.map((student) => {
      let completedCount = 0;
      let missingCount = 0;
      let xCount = 0;
      let yCount = 0;
      const missingSubjects: Subject[] = [];

      applicableSubjects.forEach((sub) => {
        const key = `${student.id}_${sub.id}_${selectedExam.id}`;
        const rawMark = markMap.get(key) || null;
        const evaluated = evaluateMark(rawMark);

        if (evaluated.status === 'Normal') {
          completedCount += 1;
        } else if (evaluated.status === 'X') {
          completedCount += 1;
          xCount += 1;
        } else if (evaluated.status === 'Y') {
          completedCount += 1;
          yCount += 1;
        } else {
          missingCount += 1;
          missingSubjects.push(sub);
        }
      });

      const totalExpected = applicableSubjects.length;
      const completionPct = totalExpected > 0 ? (completedCount / totalExpected) * 100 : 0;

      return {
        student,
        completedCount,
        missingCount,
        xCount,
        yCount,
        totalExpected,
        completionPct,
        missingSubjects,
      };
    });
  }, [classLearners, applicableSubjects, selectedExam, markMap]);

  // 8. Class Overall KPI Calculations
  const classKpis = useMemo(() => {
    const totalLearners = classLearners.length;
    const totalSubjects = applicableSubjects.length;
    const expectedEntries = totalLearners * totalSubjects;

    let completedEntries = 0;
    let missingEntries = 0;
    let totalX = 0;
    let totalY = 0;
    let fullyCompletedLearners = 0;

    evaluatedLearners.forEach((row) => {
      completedEntries += row.completedCount;
      missingEntries += row.missingCount;
      totalX += row.xCount;
      totalY += row.yCount;
      if (row.missingCount === 0 && row.totalExpected > 0) {
        fullyCompletedLearners += 1;
      }
    });

    const completionRate =
      expectedEntries > 0 ? (completedEntries / expectedEntries) * 100 : 0;

    return {
      totalLearners,
      totalSubjects,
      expectedEntries,
      completedEntries,
      missingEntries,
      totalX,
      totalY,
      fullyCompletedLearners,
      completionRate,
    };
  }, [classLearners, applicableSubjects, evaluatedLearners]);

  // 9. Subject-by-Subject Progress Breakdown for Class
  const subjectProgressList = useMemo(() => {
    if (!selectedExam || classLearners.length === 0) return [];
    const totalLearners = classLearners.length;

    return applicableSubjects.map((sub) => {
      let completed = 0;
      let absentX = 0;
      let irregularityY = 0;
      const missingLearnerNames: string[] = [];

      classLearners.forEach((st) => {
        const key = `${st.id}_${sub.id}_${selectedExam.id}`;
        const rawMark = markMap.get(key);
        const evalMark = evaluateMark(rawMark);

        if (evalMark.status === 'Normal') {
          completed += 1;
        } else if (evalMark.status === 'X') {
          completed += 1;
          absentX += 1;
        } else if (evalMark.status === 'Y') {
          completed += 1;
          irregularityY += 1;
        } else {
          missingLearnerNames.push(st.full_name || st.name || st.admission_number);
        }
      });

      const missing = Math.max(0, totalLearners - completed);
      const isComplete = missing === 0 && totalLearners > 0;
      const pct = totalLearners > 0 ? (completed / totalLearners) * 100 : 0;
      const assignedTeacher = subjectTeacherMap.get(sub.id) || 'Not Allocated';

      return {
        subject: sub,
        totalLearners,
        completed,
        missing,
        absentX,
        irregularityY,
        isComplete,
        pct,
        assignedTeacher,
        missingLearnerNames,
      };
    });
  }, [applicableSubjects, classLearners, selectedExam, markMap, subjectTeacherMap]);

  // Completed vs Incomplete Subjects Counts
  const completedSubjectsCount = useMemo(
    () => subjectProgressList.filter((sp) => sp.isComplete).length,
    [subjectProgressList]
  );
  const incompleteSubjectsCount = useMemo(
    () => subjectProgressList.filter((sp) => !sp.isComplete).length,
    [subjectProgressList]
  );

  // Incomplete Subjects List
  const incompleteSubjects = useMemo(
    () => subjectProgressList.filter((sp) => !sp.isComplete),
    [subjectProgressList]
  );

  // Stream Approval States
  const isStreamApproved = useMemo(() => {
    if (!selectedExam || !activePrimaryClass) return false;
    return isClassExamApproved(selectedExam, activePrimaryClass);
  }, [selectedExam, activePrimaryClass]);

  const isReadyForApproval = useMemo(() => {
    return (
      classKpis.totalLearners > 0 &&
      classKpis.missingEntries === 0 &&
      applicableSubjects.length > 0
    );
  }, [classKpis, applicableSubjects]);

  const isAdmin = currentUser?.role === 'admin';
  const canAdminApprove = useMemo(() => {
    return (
      isAdmin &&
      classKpis.totalLearners > 0 &&
      classKpis.completedEntries > 0
    );
  }, [isAdmin, classKpis]);

  const canApprove = isReadyForApproval || canAdminApprove;

  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);

  const handleApproveStream = async () => {
    if (!selectedExam || !activePrimaryClass) return;
    setIsApproving(true);
    setApprovalError(null);
    try {
      const streamIdentifier = activePrimaryClass.stream_id || activePrimaryClass.id;
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(selectedExam.id, streamIdentifier, true);
      } else {
        await api.updateExaminationClassApproval(selectedExam.id, streamIdentifier, true, currentUser);
        onMarksUpdated?.();
      }
      setShowApprovalModal(false);
    } catch (err: any) {
      console.error('Failed to approve class stream:', err);
      setApprovalError(getUserFriendlyErrorMessage(err, 'Failed to approve class stream results.'));
    } finally {
      setIsApproving(false);
    }
  };

  // State for toggling expanded details on subjects if desired
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Mobile Navigation Dropdown State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Outside click and Escape key dismissal for mobile navigation menu
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target as Node)) {
        setIsMobileNavOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isMobileNavOpen && event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    if (isMobileNavOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileNavOpen]);

  const handleSelectMobileNav = (tabId: string) => {
    onNavigateToTab?.(tabId);
    setIsMobileNavOpen(false);
  };

  // -------------------------------------------------------------------------
  // GUARD: NO ASSIGNED CLASS TEACHER STREAM
  // -------------------------------------------------------------------------
  if (primaryClasses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center max-w-xl mx-auto shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            No Class Teacher Assignment Found
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Assessment Stream Approval is restricted to designated Class Teachers. Your account is not currently assigned as a Class Teacher to any stream.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigateToTab?.('marks-entry')}
              className="cbe-btn-secondary text-xs font-semibold px-4 py-2 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Go to Marks Entry</span>
            </button>
            <button
              onClick={() => onNavigateToTab?.('dashboard')}
              className="cbe-btn-primary text-xs font-semibold px-4 py-2 flex items-center gap-1.5"
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const streamDisplayName = `${activePrimaryClass?.class_name || 'Class'} ${activePrimaryClass?.stream || ''}`.trim();

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      {/* 1. TOP HEADER & WORKFLOW CONTEXT */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#075E42] dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 bg-[#E6F4EA] dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-[#075E42]/20 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Class Teacher Sign-Off</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {streamDisplayName}
              </span>
            </div>

            <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Results Approval & Readiness
            </h1>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Verify completion and officially sign off marks for your assigned stream to lock results and unlock report cards.
            </p>
          </div>

          {/* Quick Module Navigation: Responsive Design */}
          {/* Mobile Collapsible Module Selector */}
          <div ref={mobileNavRef} className="relative block md:hidden pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="results-approval-mobile-nav-trigger"
                aria-expanded={isMobileNavOpen}
                aria-haspopup="listbox"
                aria-label="Quick Assessment Navigation Options"
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
                className="flex-1 text-left px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer min-h-[44px]"
              >
                <div className="flex items-center gap-2 truncate">
                  <ShieldCheck className="w-4 h-4 text-[#075E42] dark:text-emerald-400 shrink-0" />
                  <span className="truncate">Results Approval &amp; Release</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isMobileNavOpen ? 'Close' : 'Quick Nav'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileNavOpen ? 'rotate-180 text-[#075E42] dark:text-emerald-400' : 'text-slate-500'}`} />
                </div>
              </button>

              <button
                type="button"
                id="results-approval-mobile-refresh-btn"
                onClick={handleManualRefresh}
                disabled={isRefreshing || isLoadingMarks}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shrink-0"
                title="Refresh marks data"
                aria-label="Refresh marks"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoadingMarks ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>

            {/* Collapsible Dropdown Options */}
            {isMobileNavOpen && (
              <div
                id="results-approval-mobile-nav-dropdown"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg p-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <button
                  type="button"
                  id="results-approval-mobile-nav-marks-entry"
                  onClick={() => handleSelectMobileNav('marks-entry')}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-[#075E42] dark:hover:text-emerald-400 flex items-center gap-2.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <div className="flex-1 truncate">
                    <span>Marks Entry</span>
                    <span className="block text-[10px] font-normal text-slate-400 dark:text-slate-500">Enter marks for your learners</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="results-approval-mobile-nav-reports"
                  onClick={() => handleSelectMobileNav('reports')}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-[#075E42] dark:hover:text-emerald-400 flex items-center gap-2.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <FileBarChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 truncate">
                    <span>Merit Lists &amp; Reports</span>
                    <span className="block text-[10px] font-normal text-slate-400 dark:text-slate-500">Access official merit lists &amp; reports</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Desktop/Tablet Quick Module Navigation Shortcuts */}
          <div className="hidden md:flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateToTab?.('marks-entry')}
              className="cbe-btn-secondary text-xs font-semibold px-3.5 py-2 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              title="Enter marks for your learners"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Marks Entry</span>
            </button>
            <button
              onClick={() => onNavigateToTab?.('reports')}
              className="cbe-btn-secondary text-xs font-semibold px-3.5 py-2 flex items-center gap-1.5 min-h-[44px] cursor-pointer text-emerald-800 dark:text-emerald-300"
              title="Access official merit lists & reports"
            >
              <FileBarChart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Merit Lists & Reports</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingMarks}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Refresh marks data"
              aria-label="Refresh marks"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoadingMarks ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. COMPACT SELECTOR ROW */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Target Assessment Dropdown */}
          <div className="space-y-1">
            <label htmlFor="target-assessment-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              <span>Target Examination</span>
            </label>
            <select
              id="target-assessment-select"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors min-h-[44px] cursor-pointer"
            >
              <option value="">Select Assessment...</option>
              {groupExamsForDropdown(filteredExams, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                <optgroup key={`stream_appr_grp_${gIdx}`} label={grp.label}>
                  {grp.exams.map(({ exam: ex, label: optLabel }) => (
                    <option key={ex.id} value={ex.id}>
                      {optLabel}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Assigned Class Stream Selector */}
          <div className="space-y-1">
            <label htmlFor="assigned-class-stream-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              <span>Assigned Class / Stream</span>
            </label>
            {primaryClasses.length > 1 ? (
              <select
                id="assigned-class-stream-select"
                value={selectedStreamKey}
                onChange={(e) => setSelectedStreamKey(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors min-h-[44px]"
              >
                {primaryClasses.map((cls) => {
                  const key = cls.stream_id || cls.id;
                  return (
                    <option key={key} value={key}>
                      {cls.class_name} {cls.stream} ({cls.education_level || 'General'})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between min-h-[44px]">
                <span>{streamDisplayName}</span>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/90 px-2 py-0.5 rounded">
                  {activePrimaryClass?.education_level || 'Designated Class'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={handleManualRefresh}
            className="text-[11px] font-bold underline hover:no-underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. PRIMARY READINESS HERO CARD */}
      <div
        id="class-stream-approval-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
      >
        {/* Header & Status Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Stream Readiness Status
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {streamDisplayName} &bull; {selectedExam ? getDisplayExamName(selectedExam.exam_name) : ''}
            </div>
          </div>

          {/* Status Badge */}
          <div className="self-start sm:self-auto">
            {isStreamApproved ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>APPROVED & LOCKED</span>
              </span>
            ) : isReadyForApproval ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>READY TO APPROVE</span>
              </span>
            ) : canAdminApprove ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-50 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>PARTIAL MARKS &bull; ADMIN APPROVAL ELIGIBLE</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-50 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>NOT READY ({classKpis.missingEntries} MISSING)</span>
              </span>
            )}
          </div>
        </div>

        {/* State Banner & Primary Action Trigger */}
        {isStreamApproved ? (
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Marks Officially Approved & Locked
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  Results for <strong>{streamDisplayName}</strong> are locked. Official report cards and merit lists are fully accessible.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab?.('reports')}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
            >
              <FileBarChart className="w-4 h-4" />
              <span>View Merit Lists & Reports</span>
            </button>
          </div>
        ) : isReadyForApproval ? (
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  All Expected Marks Entered (100% Complete)
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  All <strong>{classKpis.completedEntries} marks</strong> across all {applicableSubjects.length} learning areas are verified. Ready for official sign-off.
                </p>
              </div>
            </div>

            <button
              id="btn-approve-class-stream-results"
              onClick={() => setShowApprovalModal(true)}
              disabled={isApproving}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-black text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px] cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve & Lock Results</span>
            </button>
          </div>
        ) : canAdminApprove ? (
          <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-xl shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                  <span>Admin Discretion: Partial Marks Keyed In</span>
                  <span className="bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-black px-2 py-0.5 rounded">
                    Admin Bypass
                  </span>
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
                  <strong>{classKpis.completedEntries} marks</strong> recorded across <strong>{applicableSubjects.length - incompleteSubjectsCount} of {applicableSubjects.length} learning areas</strong> ({classKpis.missingEntries} missing). As Administrator, you can approve and lock results to release merit lists and report forms.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => onNavigateToTab?.('marks-entry')}
                className="px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Enter More Marks</span>
              </button>
              <button
                id="btn-approve-class-stream-results"
                onClick={() => setShowApprovalModal(true)}
                disabled={isApproving}
                className="px-5 py-2.5 text-xs font-black text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                title="Approve and release merit lists and report forms"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Approve & Lock Results</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  Approval Blocked — Marks Incomplete
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  <strong>{classKpis.missingEntries} mark entries</strong> are missing across <strong>{incompleteSubjectsCount} learning area{incompleteSubjectsCount > 1 ? 's' : ''}</strong>. All marks must be entered before sign-off.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => onNavigateToTab?.('marks-entry')}
                className="px-4 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Go to Marks Entry</span>
              </button>
              <button
                id="btn-approve-class-stream-results"
                disabled={true}
                className="px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
                title="Complete all marks to enable approval"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Approve & Lock</span>
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar & Rate */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Progress ({classKpis.completedEntries} / {classKpis.expectedEntries} entries)</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {classKpis.completionRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isStreamApproved
                  ? 'bg-emerald-600'
                  : isReadyForApproval
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, classKpis.completionRate))}%` }}
            />
          </div>
        </div>

        {/* 4. COMPACT KPI METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          {/* Enrolled Learners */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 sm:p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Learners
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {classKpis.totalLearners}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Enrolled in stream
            </div>
          </div>

          {/* Learning Areas */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 sm:p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Learning Areas
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {classKpis.totalSubjects}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Allocated learning areas
            </div>
          </div>

          {/* Completed Subjects */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl p-2.5 sm:p-3 border border-emerald-200 dark:border-emerald-800/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Ready Learning Areas
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-900 dark:text-emerald-200 mt-0.5">
              {completedSubjectsCount} / {applicableSubjects.length}
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
              100% completed
            </div>
          </div>

          {/* Missing Marks */}
          <div className={`rounded-xl p-2.5 sm:p-3 border ${
            classKpis.missingEntries === 0
              ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
              : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
          }`}>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${
              classKpis.missingEntries === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-rose-800 dark:text-rose-400'
            }`}>
              Missing Marks
            </div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${
              classKpis.missingEntries === 0 ? 'text-slate-900 dark:text-white' : 'text-rose-900 dark:text-rose-200'
            }`}>
              {classKpis.missingEntries}
            </div>
            <div className={`text-[10px] ${
              classKpis.missingEntries === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-rose-700 dark:text-rose-400 font-semibold'
            }`}>
              {classKpis.missingEntries === 0 ? 'Zero missing' : 'Entries required'}
            </div>
          </div>

          {/* Fully Completed Learners */}
          <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 sm:p-3 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Full Rosters
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {classKpis.fullyCompletedLearners} / {classKpis.totalLearners}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Learners with all marks
            </div>
          </div>
        </div>
      </div>

      {/* 5. LEARNING AREAS CHECKLIST & STATUS LIST */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
              <span>Learning Areas Readiness Checklist</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              All learning areas must reach 100% completion before official stream approval.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {completedSubjectsCount} of {applicableSubjects.length} Complete
          </span>
        </div>

        {/* Clean Checklist Format */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {subjectProgressList.map((sp) => {
            const isExpanded = expandedSubjectId === sp.subject.id;
            return (
              <div
                key={sp.subject.id}
                className={`p-3 sm:p-3.5 transition-colors ${
                  sp.isComplete
                    ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    : 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Subject Name & Teacher */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          sp.isComplete
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {sp.isComplete ? '✓' : '!'}
                      </span>
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {sp.subject.subject_name}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                        {sp.subject.subject_code || 'N/A'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-7 mt-0.5">
                      Teacher: <span className="font-semibold text-slate-700 dark:text-slate-300">{sp.assignedTeacher}</span>
                    </div>
                  </div>

                  {/* Progress & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                          {sp.completed}/{sp.totalLearners}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            sp.isComplete
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                          }`}
                        >
                          {sp.isComplete ? '100%' : `${sp.missing} Missing`}
                        </span>
                      </div>
                    </div>

                    {!sp.isComplete && (
                      <button
                        onClick={() => onNavigateToTab?.('marks-entry')}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-2xs transition-colors shrink-0 min-h-[44px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Enter Marks</span>
                      </button>
                    )}

                    {sp.missing > 0 && sp.missingLearnerNames.length > 0 && (
                      <button
                        onClick={() => setExpandedSubjectId(isExpanded ? null : sp.subject.id)}
                        className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer min-h-[44px] flex items-center px-1"
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progressive Disclosure: Missing Learner Names */}
                {isExpanded && sp.missingLearnerNames.length > 0 && (
                  <div className="mt-2.5 ml-7 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="font-bold text-[11px]">
                      Learners Missing Marks for {sp.subject.subject_name}:
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {sp.missingLearnerNames.map((name, idx) => (
                        <span
                          key={idx}
                          className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-[10px] font-medium"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. MOBILE-ONLY STICKY BOTTOM ACTION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-lg flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {streamDisplayName}
          </div>
          <div className="text-xs font-black text-slate-900 dark:text-white truncate">
            {isStreamApproved
              ? '✓ Approved & Locked'
              : isReadyForApproval
              ? '✓ 100% Ready to Approve'
              : canAdminApprove
              ? `✓ Admin Ready (${classKpis.completedEntries} marks)`
              : `⚠ ${classKpis.missingEntries} marks missing`}
          </div>
        </div>

        {isStreamApproved ? (
          <button
            onClick={() => onNavigateToTab?.('reports')}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer shrink-0"
          >
            <FileBarChart className="w-3.5 h-3.5" />
            <span>Reports</span>
          </button>
        ) : canApprove ? (
          <button
            onClick={() => setShowApprovalModal(true)}
            disabled={isApproving}
            className="px-4 py-2.5 text-xs font-black text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-md transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Approve Results</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigateToTab?.('marks-entry')}
            className="px-4 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Enter Marks</span>
          </button>
        )}
      </div>

      {/* 7. APPROVAL CONFIRMATION MODAL */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-full text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Approve Class Stream Results
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAdmin ? 'Administrator Sign-Off & Results Lock' : 'Official Class Teacher Sign-Off & Results Lock'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {streamDisplayName} &bull; {selectedExam ? getDisplayExamName(selectedExam.exam_name) : ''}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 pt-1">
                <li>Total Enrolled Learners: <span className="font-semibold text-slate-900 dark:text-white">{classKpis.totalLearners}</span></li>
                <li>
                  Total Mark Entries:{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {classKpis.completedEntries} / {classKpis.expectedEntries} ({isReadyForApproval ? '100% Complete' : `${classKpis.completionRate.toFixed(1)}% Entered`})
                  </span>
                </li>
                <li>
                  Learning Areas Evaluated:{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {applicableSubjects.length - incompleteSubjectsCount} of {applicableSubjects.length} Entered
                  </span>
                </li>
                {canAdminApprove && !isReadyForApproval && (
                  <li className="text-amber-800 dark:text-amber-300 font-medium">
                    Admin Notice: Approving with partial marks will lock this stream and release merit lists and report forms reflecting entered learning areas. Unentered areas will reflect as unassessed.
                  </li>
                )}
                <li className="text-emerald-800 dark:text-emerald-300 font-medium">
                  Approving will <span className="font-bold">lock marks entry</span> for this stream and unlock official report cards and merit lists.
                </li>
              </ul>
            </div>

            {approvalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                disabled={isApproving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-approve-class-stream"
                onClick={handleApproveStream}
                disabled={isApproving}
                className="px-4 py-2 text-xs font-bold text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving &amp; Locking...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Lock Results</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

