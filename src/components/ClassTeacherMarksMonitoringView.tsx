import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  getStudentFullName,
} from '../types';
import { TabType } from './Sidebar';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { evaluateMark } from '../utils/markUtils';
import {
  getActiveTeacher,
  getAccessiblePrimaryClasses,
} from '../utils/rbacUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { groupExamsForDropdown } from '../utils/examDisplayUtils';
import { isExamApplicableToClassStream } from '../utils/teacherExamReminderUtils';
import { isStudentEligibleForExam } from '../services/analysisEngine';
import { api, subscribeToMarksRealtime, unsubscribeFromMarksRealtime, RealtimeMarkEvent } from '../lib/storage';
import {
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Users,
  FileSpreadsheet,
  FileBarChart,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Check,
  Pencil,
} from 'lucide-react';

interface ClassTeacherMarksMonitoringViewProps {
  exams: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  students: Student[];
  marks: Mark[];
  grades?: Grade[];
  teachers: Teacher[];
  currentUser: User | null;
  onNavigateToTab?: (tab: TabType) => void;
  onMarksUpdated?: () => void;
}

export const ClassTeacherMarksMonitoringView: React.FC<ClassTeacherMarksMonitoringViewProps> = ({
  exams = [],
  classes = [],
  subjects = [],
  students = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  onNavigateToTab,
  onMarksUpdated,
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
      // If current selection is invalid or not set, select the first assigned stream
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

  // Real-time total learners assigned to this class stream (independent of exam selection)
  const totalStreamLearners = useMemo(() => {
    if (!activePrimaryClass) return [];
    const targetClassId = activePrimaryClass.id;
    return students.filter((s) => {
      if (s.active === false || s.enrolment_status === 'future') return false;
      if (activePrimaryClass.stream_id) {
        return s.stream_id === activePrimaryClass.stream_id;
      }
      return s.class_id === targetClassId;
    });
  }, [students, activePrimaryClass]);

  // Filter exams to only those applicable to the teacher's primary classes
  const applicableExams = useMemo(() => {
    if (primaryClasses.length === 0) return [];
    return (exams || []).filter((e) =>
      primaryClasses.some((c) => isExamApplicableToClassStream(e, c, marks, students, classes))
    );
  }, [exams, primaryClasses, marks, students, classes]);

  // 2. Target Assessment Selection State
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Default Assessment selection to matching active Academic Year & Term using applicable exams
  useEffect(() => {
    if (applicableExams.length > 0 && (!selectedExamId || !applicableExams.some((e) => e.id === selectedExamId))) {
      let defaultExam: Examination | undefined;

      if (activeYearObj && activeTermObj) {
        defaultExam = applicableExams.find((e) => {
          const matchYear = e.academic_year_id
            ? e.academic_year_id === activeYearObj.id
            : e.year === activeYearObj.year;
          const matchTerm = e.term === activeTermObj.term_name;
          return matchYear && matchTerm;
        });
      }

      if (!defaultExam) {
        defaultExam = applicableExams[0];
      }

      if (defaultExam) {
        setSelectedExamId(defaultExam.id);
      }
    }
  }, [applicableExams, activeYearObj, activeTermObj, selectedExamId]);

  const selectedExam = useMemo(
    () => applicableExams.find((e) => e.id === selectedExamId) || null,
    [applicableExams, selectedExamId]
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
        console.error('ClassTeacherMarksMonitoring: Error fetching marks:', err);
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
        // Refresh local marks on matching exam mark change
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

  // Navigate to Marks Entry for a specific subject
  const handleEnterMarksForSubject = (subjectId: string) => {
    if (!activePrimaryClass) return;
    try {
      const classKey = activePrimaryClass.stream_id || activePrimaryClass.id;
      sessionStorage.setItem('cbe_marks_workflow_class', classKey);
      sessionStorage.setItem('cbe_marks_workflow_subject', subjectId);
      if (selectedExam) {
        sessionStorage.setItem('cbe_marks_workflow_exam', selectedExam.id);
      }
    } catch (e) {
      console.warn('Session storage write error:', e);
    }
    if (onNavigateToTab) {
      onNavigateToTab('marks-entry');
    }
  };

  // 4. Memoized O(1) Mark Map
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

  // 6. Strict Stream Learners Resolution (Authoritative stream_id scoping)
  const classLearners = useMemo(() => {
    if (!activePrimaryClass) return [];

    const targetStreamId = activePrimaryClass.stream_id || activePrimaryClass.id;
    const targetClassId = activePrimaryClass.id;

    return students.filter((s) => {
      // If an exam is selected, check historical context and academic eligibility
      if (selectedExam) {
        const studentMarks = (effectiveMarks || []).filter(
          (m) => m.student_id === s.id && m.exam_id === selectedExam.id
        );
        if (!isStudentEligibleForExam(s, selectedExam, studentMarks)) {
          return false;
        }
        const examContext = getLearnerClassAtExamTime(s, selectedExam, classes);
        if (activePrimaryClass.stream_id) {
          return examContext.stream_id === activePrimaryClass.stream_id;
        }
        return (
          examContext.class_id === targetClassId ||
          examContext.stream_id === targetClassId
        );
      }

      // Live fallback (active learners only, exclude future intakes)
      if (s.active === false || s.enrolment_status === 'future') return false;
      if (activePrimaryClass.stream_id) {
        return s.stream_id === activePrimaryClass.stream_id;
      }
      return s.class_id === targetClassId;
    }).sort((a, b) => {
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
    subjectMarks: Array<{
      subject: Subject;
      mark: Mark | null;
      status: 'Normal' | 'X' | 'Y' | 'Blank';
      displayScore: string;
      percentage: number | null;
      irregularityReason?: string;
    }>;
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

      const subjectMarks = applicableSubjects.map((sub) => {
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
        }

        return {
          subject: sub,
          mark: rawMark,
          status: evaluated.status,
          displayScore: evaluated.displayScore,
          percentage: evaluated.percentage,
          irregularityReason: evaluated.irregularityReason,
        };
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
        subjectMarks,
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

  const isExamAdministeredElsewhere = useMemo(() => {
    if (!selectedExam) return false;
    return (effectiveMarks || []).some((m) => m.exam_id === selectedExam.id);
  }, [effectiveMarks, selectedExam]);

  const isCohortNotAssessed = useMemo(() => {
    if (!selectedExam) return false;
    return isExamAdministeredElsewhere && classKpis.completedEntries === 0;
  }, [isExamAdministeredElsewhere, classKpis.completedEntries, selectedExam]);

  // 9. Subject-by-Subject Progress Breakdown for Class
  const subjectProgressList = useMemo(() => {
    if (!selectedExam || classLearners.length === 0) return [];
    const totalLearners = classLearners.length;

    return applicableSubjects.map((sub) => {
      let completed = 0;
      let absentX = 0;
      let irregularityY = 0;

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
        }
      });

      const missing = Math.max(0, totalLearners - completed);
      const percentage = totalLearners > 0 ? (completed / totalLearners) * 100 : 0;
      const teacherName = subjectTeacherMap.get(sub.id) || 'Unassigned';

      return {
        subject: sub,
        teacherName,
        expected: totalLearners,
        completed,
        missing,
        absentX,
        irregularityY,
        percentage,
        isComplete: completed === totalLearners && totalLearners > 0,
      };
    });
  }, [applicableSubjects, classLearners, selectedExam, markMap, subjectTeacherMap]);

  // 10. Filter & Search State for Learner Roster Table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'needs_attention'>('all');
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState<boolean>(false);
  const [showSubjectBreakdown, setShowSubjectBreakdown] = useState<boolean>(true);

  // Derived Attention Metrics
  const needsAttentionLearners = useMemo(() => {
    return evaluatedLearners.filter(
      (row) => row.missingCount > 0 || row.xCount > 0 || row.yCount > 0
    );
  }, [evaluatedLearners]);

  const needsAttentionCount = needsAttentionLearners.length;
  const learnersWithMissingCount = evaluatedLearners.filter((r) => r.missingCount > 0).length;
  const learnersWithXCount = evaluatedLearners.filter((r) => r.xCount > 0).length;
  const learnersWithYCount = evaluatedLearners.filter((r) => r.yCount > 0).length;
  const incompleteSubjectsCount = subjectProgressList.filter((s) => !s.isComplete).length;

  const filteredLearners = useMemo(() => {
    return evaluatedLearners.filter((row) => {
      // 1. Primary Filter Mode (All vs Needs Attention for missing marks)
      if (filterMode === 'needs_attention') {
        if (row.missingCount === 0) return false;
      }

      // 2. Search Query (Name or Admission Number)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const fullName = getStudentFullName(row.student).toLowerCase();
        const adm = (row.student.admission_number || '').toLowerCase();
        if (!fullName.includes(q) && !adm.includes(q)) {
          return false;
        }
      }

      // 3. Incomplete Filter Checkbox (Missing marks > 0)
      if (showOnlyIncomplete && row.missingCount === 0) {
        return false;
      }

      // 4. Subject-Specific Filter
      if (subjectFilter !== 'all') {
        const matchSub = row.subjectMarks.find((sm) => sm.subject.id === subjectFilter);
        if (!matchSub) return false;
        if ((filterMode === 'needs_attention' || showOnlyIncomplete) && matchSub.status !== 'Blank') {
          return false;
        }
      }

      return true;
    });
  }, [evaluatedLearners, filterMode, searchQuery, showOnlyIncomplete, subjectFilter]);

  // If the user has no Class Teacher assignment
  if (primaryClasses.length === 0) {
    return (
      <div id="class-teacher-monitoring-no-assignment" className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4 shadow-sm">
          <div className="inline-flex items-center justify-center p-3 bg-amber-50 dark:bg-amber-950/40 rounded-full text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            No Class Teacher Assignment Found
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
            Your account is currently not assigned as a Class Teacher to any class or stream.
            Assessment Individual Marks Monitoring is strictly scoped to designated Class Teachers.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {onNavigateToTab && (
              <button
                id="btn-go-to-marks-entry"
                onClick={() => onNavigateToTab('marks-entry')}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                Go to Marks Entry Grid
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="class-teacher-marks-monitoring-view" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Class Assessment Marks Monitoring
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Lock className="w-3 h-3" />
              Class Teacher Oversight
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
            {activePrimaryClass?.class_name} {activePrimaryClass?.stream}
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToTab && (
            <>
              <button
                id="btn-shortcut-marks-entry"
                onClick={() => onNavigateToTab('marks-entry')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Enter Marks
              </button>
              <button
                id="btn-shortcut-stream-approval"
                onClick={() => onNavigateToTab('stream-approval')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Stream Approval
              </button>
              <button
                id="btn-shortcut-reports"
                onClick={() => onNavigateToTab('reports')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors"
              >
                <FileBarChart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Reports & Merit Lists
              </button>
            </>
          )}
          <button
            id="btn-refresh-marks"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoadingMarks}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            title="Fetch latest marks from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoadingMarks ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Marks'}</span>
          </button>
        </div>
      </div>

      {/* ERROR ALERT BANNER */}
      {fetchError && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={handleManualRefresh}
            className="font-medium underline hover:text-amber-900 dark:hover:text-amber-100 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* CONTROLS BAR: ASSESSMENT SELECTOR & SCOPED CLASS BADGE/SELECTOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left: Target Assessment Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <label htmlFor="target-assessment-select" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Target Assessment:
          </label>
          <select
            id="target-assessment-select"
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {applicableExams.length === 0 ? (
              <option value="">No applicable assessments available</option>
            ) : (
              groupExamsForDropdown(applicableExams, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                <optgroup key={`exam_grp_${gIdx}`} label={grp.label} className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  {grp.exams.map(({ exam, label }) => (
                    <option key={exam.id} value={exam.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium">
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
        </div>

        {/* Right: Scoped Class / Stream Badge or Selector */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Class:
          </span>
          {primaryClasses.length === 1 ? (
            <div
              id="scoped-class-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm"
            >
              <span>
                {primaryClasses[0].class_name} {primaryClasses[0].stream}
              </span>
              <Lock className="w-3.5 h-3.5 text-slate-400" title="Stream strictly locked to your Class Teacher allocation" />
            </div>
          ) : (
            <select
              id="multi-stream-select"
              value={selectedStreamKey}
              onChange={(e) => setSelectedStreamKey(e.target.value)}
              className="px-3 py-1.5 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {primaryClasses.map((cls) => {
                const key = cls.stream_id || cls.id;
                return (
                  <option key={key} value={key}>
                    {cls.class_name} {cls.stream}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* CLASS HEALTH SUMMARY & 3-SECOND ANSWER */}
      {classLearners.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-2 shadow-sm">
          <Users className="w-8 h-8 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {totalStreamLearners.length > 0 ? "No eligible learners for this assessment" : "No active learners found"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {totalStreamLearners.length > 0
              ? `This stream has ${totalStreamLearners.length} active learners, but they do not meet the targeting or eligibility criteria for "${selectedExam?.exam_name || 'the selected assessment'}".`
              : `There are currently no active learners assigned to ${activePrimaryClass?.class_name || 'this stream'}.`}
          </p>
        </div>
      ) : (
        <div id="class-health-summary-card" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          {isCohortNotAssessed && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start space-x-3 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Assessment Not Administered to This Class</p>
                <p className="text-amber-800 dark:text-amber-300">
                  This assessment was sat by other grades/classes in the school, but no marks were entered for {activePrimaryClass?.class_name} {activePrimaryClass?.stream}. Learners in this stream have no missing assessment penalty and are not marked incomplete.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Class Assessment Health
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {activePrimaryClass?.class_name} {activePrimaryClass?.stream} — {selectedExam?.exam_name || 'Selected Assessment'}
              </div>
            </div>

            {/* Quick Filter Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-filter-needs-attention"
                onClick={() => setFilterMode(filterMode === 'needs_attention' ? 'all' : 'needs_attention')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  filterMode === 'needs_attention'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 shadow-sm ring-2 ring-rose-500/20'
                    : needsAttentionCount > 0
                    ? 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100/70'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                }`}
              >
                {needsAttentionCount > 0 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>
                  Needs Attention — {needsAttentionCount} {needsAttentionCount === 1 ? 'learner' : 'learners'}
                </span>
              </button>

              <button
                type="button"
                id="btn-filter-all-learners"
                onClick={() => setFilterMode('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  filterMode === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>View All ({classKpis.totalLearners})</span>
              </button>
            </div>
          </div>

          {/* 3-Second Health Overview Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Completion & Health Status */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 font-medium">Overall Progress</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
                <span>{classKpis.completionRate.toFixed(1)}% complete</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                {classKpis.fullyCompletedLearners} of {classKpis.totalLearners} learners fully completed
              </div>
            </div>

            {/* Incomplete / Missing */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 font-medium">Incomplete Marks</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {learnersWithMissingCount > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400">
                    {learnersWithMissingCount} {learnersWithMissingCount === 1 ? 'learner' : 'learners'} ({classKpis.missingEntries} missing)
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">0 missing marks</span>
                )}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                {classKpis.missingEntries === 0 ? 'All expected entries entered' : 'Awaiting subject teacher entry'}
              </div>
            </div>

            {/* Special Statuses (X and Y) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 font-medium">Special Status Entries</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">{classKpis.totalX} X (Absent)</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-purple-600 dark:text-purple-400">{classKpis.totalY} Y (Irregular)</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Excused absence and irregularity entries
              </div>
            </div>

            {/* Subject Status */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 font-medium">Learning Area Status</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {incompleteSubjectsCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {incompleteSubjectsCount} {incompleteSubjectsCount === 1 ? 'subject' : 'subjects'} incomplete
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    All {classKpis.totalSubjects} subjects complete
                  </span>
                )}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                {subjectProgressList.filter((s) => s.isComplete).length} of {classKpis.totalSubjects} fully submitted
              </div>
            </div>
          </div>

          {/* 100% Complete Notice if everything is done */}
          {classKpis.completionRate === 100 && classKpis.totalLearners > 0 && (
            <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">
                All assessment marks are complete. Class stream is ready for reports generation and merit ranking.
              </span>
            </div>
          )}

          {/* Zero Marks Notice */}
          {classLearners.length > 0 && selectedExam && classKpis.completedEntries === 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <strong>No assessment marks entered:</strong> Assessment marks have not been entered for this assessment yet.
                </span>
              </div>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('marks-entry')}
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 ml-2"
                >
                  Enter Marks
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {classLearners.length > 0 && (
        <>
          {/* LEARNING AREA SUBMISSION STATUS (COLLAPSIBLE) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSubjectBreakdown(!showSubjectBreakdown)}
          className="w-full px-4 py-3.5 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Learning Area Submissions ({activePrimaryClass?.class_name} {activePrimaryClass?.stream})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({subjectProgressList.filter((s) => s.isComplete).length} of {subjectProgressList.length} Complete)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{showSubjectBreakdown ? 'Hide Submissions' : 'View Submissions'}</span>
            {showSubjectBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showSubjectBreakdown && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjectProgressList.map((item) => (
                <div
                  key={item.subject.id}
                  className={`p-3 rounded-lg border text-xs space-y-2 ${
                    item.isComplete
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      : item.completed > 0
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40'
                      : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {item.subject.subject_name || (item.subject as any).name || 'Subject'}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        Subject Teacher: <span className="font-medium text-slate-700 dark:text-slate-300">{item.teacherName}</span>
                      </div>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.isComplete
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : item.completed > 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {item.isComplete ? 'Complete' : item.completed > 0 ? 'In Progress' : 'Not Started'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1">
                    <span>
                      {item.completed} / {item.expected} complete · {item.missing} missing
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        item.isComplete
                          ? 'bg-emerald-500'
                          : item.completed > 0
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>

                  {/* Direct Marks Entry Action for Class Teacher */}
                  <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400">Class Teacher Authority</span>
                    <button
                      type="button"
                      onClick={() => handleEnterMarksForSubject(item.subject.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
                    >
                      <Pencil className="w-3 h-3" />
                      {item.completed > 0 ? 'Edit Marks' : 'Enter Marks'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* INDIVIDUAL LEARNER MONITORING TABLE SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-4 p-4">
        {/* Section Header */}
        <div className="space-y-1 pb-1 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Learner Marks Monitoring
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Individual subject-by-subject status and attention diagnostics for {activePrimaryClass?.class_name} {activePrimaryClass?.stream}
          </p>
        </div>

        {/* Table Filter & Search Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Search by Name / Adm */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="learner-search-input"
              type="text"
              placeholder="Search learner name or admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Right: Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter by Learning Area */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="filter-subject-select"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-2.5 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Learning Areas</option>
                {applicableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject_code ? `${s.subject_code} - ${s.subject_name || (s as any).name}` : (s.subject_name || (s as any).name || s.id)}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Only Incomplete Marks */}
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer transition-colors text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                id="toggle-incomplete-only"
                type="checkbox"
                checked={showOnlyIncomplete}
                onChange={(e) => setShowOnlyIncomplete(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 focus:ring-emerald-500"
              />
              <span>Show Only Learners with Incomplete Marks</span>
            </label>
          </div>
        </div>

        {/* Result summary counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            Showing <strong className="font-semibold text-slate-800 dark:text-slate-200">{filteredLearners.length}</strong> of{' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-200">{classLearners.length}</strong> learners
            {showOnlyIncomplete && (
              <span className="ml-1 text-rose-600 dark:text-rose-400 font-semibold">(Filtered to Incomplete)</span>
            )}
          </span>
          {(searchQuery || subjectFilter !== 'all' || showOnlyIncomplete) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSubjectFilter('all');
                setShowOnlyIncomplete(false);
              }}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* RESPONSIVE LEARNER-CENTRIC TABLE */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 whitespace-nowrap w-px">Admission No.</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-px">Learner</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center w-px">Progress</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center w-px">Missing</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-center w-px">Completion %</th>
                <th className="py-2.5 px-3 w-auto min-w-[200px]">
                  Subject Marks
                  {subjectFilter !== 'all' && (
                    <span className="ml-1 text-slate-400 font-normal normal-case">
                      (Filtered)
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              {filteredLearners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold text-sm">No learners match the specified filters</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search query, learning area filter, or switching back to "All Learners"
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLearners.map((row) => {
                  const visibleMarks =
                    subjectFilter === 'all'
                      ? row.subjectMarks
                      : row.subjectMarks.filter((sm) => sm.subject.id === subjectFilter);

                  return (
                    <tr
                      key={row.student.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Admission Number */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.student.admission_number || '—'}
                      </td>

                      {/* 2. Learner Name */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {getStudentFullName(row.student)}
                        </div>
                        {row.student.gender && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            {row.student.gender.toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* 3. Progress Ratio */}
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.completedCount}/{row.totalExpected}
                      </td>

                      {/* 4. Missing Count */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {row.missingCount > 0 ? (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60">
                            {row.missingCount}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium">0</span>
                        )}
                      </td>

                      {/* 5. Completion % */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono">
                        {row.completionPct === 100 ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            100%
                          </span>
                        ) : (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {row.completionPct % 1 === 0 ? row.completionPct.toFixed(0) : row.completionPct.toFixed(1)}%
                          </span>
                        )}
                      </td>

                      {/* 6. Subject Marks List */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {visibleMarks.map((sm, idx) => {
                            const subCode =
                              sm.subject.subject_code ||
                              (sm.subject as any).code ||
                              (sm.subject.subject_name ? sm.subject.subject_name.substring(0, 3).toUpperCase() : 'SUB');
                            const subName = sm.subject.subject_name || (sm.subject as any).name || 'Subject';

                            return (
                              <React.Fragment key={sm.subject.id}>
                                {idx > 0 && (
                                  <span className="text-slate-300 dark:text-slate-600 select-none">·</span>
                                )}
                                {sm.status === 'Normal' && (
                                  <span
                                    className="inline-flex items-baseline gap-1 text-slate-700 dark:text-slate-300"
                                    title={`${subName}: ${sm.displayScore}`}
                                  >
                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                      {subCode}
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {sm.displayScore}
                                    </span>
                                  </span>
                                )}
                                {sm.status === 'Blank' && (
                                  <span
                                    className="inline-flex items-baseline gap-1 text-rose-600 dark:text-rose-400 font-semibold"
                                    title={`${subName}: Mark Missing`}
                                  >
                                    <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
                                      {subCode}
                                    </span>
                                    <span>MISSING</span>
                                  </span>
                                )}
                                {sm.status === 'X' && (
                                  <span
                                    className="inline-flex items-baseline gap-1 text-amber-600 dark:text-amber-400 font-semibold"
                                    title={`${subName}: Absent (X)`}
                                  >
                                    <span className="text-[11px] font-medium text-amber-600/80 dark:text-amber-400/80">
                                      {subCode}
                                    </span>
                                    <span>X</span>
                                  </span>
                                )}
                                {sm.status === 'Y' && (
                                  <span
                                    className="inline-flex items-baseline gap-1 text-purple-600 dark:text-purple-400 font-semibold"
                                    title={`${subName}: Irregularity (Y${sm.irregularityReason ? ` - ${sm.irregularityReason}` : ''})`}
                                  >
                                    <span className="text-[11px] font-medium text-purple-600/80 dark:text-purple-400/80">
                                      {subCode}
                                    </span>
                                    <span>Y</span>
                                  </span>
                                )}
                              </React.Fragment>
                            );
                          })}
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
    </>
  )}
</div>
  );
};
