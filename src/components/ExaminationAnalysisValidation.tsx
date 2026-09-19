import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Filter,
  Award,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Info,
  Sliders,
  Users,
  AlertCircle,
  FileSpreadsheet,
  FileBarChart,
  CheckSquare,
  Search,
  Lock,
  Unlock,
  Check,
  FileText,
  Clock,
  Sparkles,
  Layers,
  GraduationCap,
  Calendar,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LoadingIndicator } from './LoadingIndicator';
import {
  Examination,
  Student,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  User,
  EducationLevel,
  GradeName,
  ALL_EDUCATION_LEVELS,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  sortGrades,
} from '../types';
import { getGradeForMark, getLearnerReportSubjects } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { getAccessibleClasses, getTeacherAssignedSubjectIds, getTeacherAssignedClassIds, isClassTeacherFor } from '../utils/rbacUtils';
import { getFilteredStudents, isClassInExamScope, isLearnerInExamScope, resolveAuthoritativeClass } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';
import { getDisplayExamName, getDisplayExamType, groupExamsForDropdown } from '../utils/examDisplayUtils';
import { TabType } from './Sidebar';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { canApproveExams, getTermStatusMessage } from '../utils/termStatusUtils';
import {
  isLevelApproved,
  isClassExamApproved,
  isStreamApproved,
  isGradeFullyApproved,
  isEducationLevelFullyApproved,
  isExaminationFullyApproved,
} from '../utils/examLockUtils';
import {
  computeExamReadiness,
  StreamReadinessDetail,
  GradeReadinessDetail,
  LevelReadinessDetail,
  ExamReadinessOverview,
} from '../utils/examReadinessUtils';
import { api } from '../lib/storage';
import {
  AssessmentValidationHealthCard,
  AssessmentPerformanceKpiCards,
  AssessmentCbeDistributionBar,
  LearningAreaDiagnosticsTable,
  RemedialInterventionWatchlist,
} from './analysis-validation';

interface ExaminationAnalysisValidationProps {
  exams: Examination[];
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers: Teacher[];
  currentUser: User | null;
  initialAdminViewMode?: 'analysis' | 'stream-approvals';
  onUpdateExamStatus: (examId: string, status: Examination['status']) => void;
  onUpdateExamLevelApproval?: (examId: string, level: EducationLevel, approved: boolean) => void;
  onUpdateExamClassApproval?: (examId: string, classStreamId: string, approved: boolean) => void;
  onNavigateToTab?: (tab: TabType) => void;
  onMarksUpdated?: () => void;
}

export const ExaminationAnalysisValidation: React.FC<ExaminationAnalysisValidationProps> = ({
  exams,
  students,
  classes,
  subjects,
  marks,
  grades,
  teachers,
  currentUser,
  initialAdminViewMode = 'analysis',
  onUpdateExamStatus,
  onUpdateExamLevelApproval,
  onUpdateExamClassApproval,
  onNavigateToTab,
  onMarksUpdated,
}) => {
  // Admin View Mode: Assessment Quality-Control Analysis vs Manage Class-Stream Approvals
  const [adminViewMode, setAdminViewMode] = useState<'analysis' | 'stream-approvals'>(initialAdminViewMode);

  useEffect(() => {
    if (initialAdminViewMode) {
      setAdminViewMode(initialAdminViewMode);
    }
  }, [initialAdminViewMode]);

  const [streamToApprove, setStreamToApprove] = useState<ClassStream | null>(null);
  const [streamToReopen, setStreamToReopen] = useState<ClassStream | null>(null);
  const [streamFilterLevel, setStreamFilterLevel] = useState<EducationLevel | 'All'>('All');
  const [showApprovalGuide, setShowApprovalGuide] = useState<boolean>(false);
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});
  const [expandedStreamIssues, setExpandedStreamIssues] = useState<Record<string, boolean>>({});

  const toggleLevelExpand = (level: string) => {
    setExpandedLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const toggleStreamIssues = (streamId: string) => {
    setExpandedStreamIssues((prev) => ({ ...prev, [streamId]: !prev[streamId] }));
  };

  // Term Session Context Detection
  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();

  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>(() => activeYearObj?.year || 2026);
  const [selectedTerm, setSelectedTerm] = useState<string>(() => activeTermObj?.term_name || 'Term 2');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);

  // Diagnostics Navigation Refs and Highlight State
  const diagnosticsSectionRef = useRef<HTMLDivElement>(null);
  const streamListSectionRef = useRef<HTMLDivElement>(null);
  const [highlightDiagnostics, setHighlightDiagnostics] = useState<boolean>(false);

  const handleInspectStream = (level: EducationLevel, className: string, streamObj: ClassStream) => {
    setSelectedLevel(level);
    setSelectedClassId(className);
    const targetStreamKey = streamObj.stream_id || streamObj.stream || streamObj.id;
    setSelectedStreamId(targetStreamKey);
    setHighlightDiagnostics(true);

    // Smooth scroll to diagnostics layer after state dispatch and DOM render
    setTimeout(() => {
      if (diagnosticsSectionRef.current) {
        diagnosticsSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 120);

    // Reset visual highlight pulse after 2.5s
    setTimeout(() => {
      setHighlightDiagnostics(false);
    }, 2500);
  };

  const handleScrollToStreamList = () => {
    if (streamListSectionRef.current) {
      streamListSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  // Auto-sync selected Year & Term when active viewing session changes
  useEffect(() => {
    if (activeYearObj?.year) setSelectedYear(activeYearObj.year);
    if (activeTermObj?.term_name) setSelectedTerm(activeTermObj.term_name);
  }, [activeYearObj?.year, activeTermObj?.term_name]);

  // Auto-default selectedExamId if empty or invalid when exams load or session changes
  useEffect(() => {
    if (exams && exams.length > 0) {
      const examExists = exams.some((e) => e.id === selectedExamId);
      if (!selectedExamId || !examExists) {
        let defaultExam: Examination | undefined;
        // 1. First priority: Matching active viewing year & term
        if (activeYearObj && activeTermObj) {
          defaultExam = exams.find((e) => {
            const matchYear = e.academic_year_id ? e.academic_year_id === activeYearObj.id : e.year === activeYearObj.year;
            const matchTerm = e.term === activeTermObj.term_name;
            return matchYear && matchTerm && e.status !== 'Archived';
          });
        }
        // 2. Second priority: Matching selectedYear and selectedTerm
        if (!defaultExam && selectedYear && selectedTerm) {
          defaultExam = exams.find(
            (e) => e.year === Number(selectedYear) && e.term === selectedTerm && e.status !== 'Archived'
          );
        }
        // Fail-closed: Never fall back to arbitrary exams[0]!
        if (defaultExam) {
          setSelectedExamId(defaultExam.id);
          if (defaultExam.year) setSelectedYear(Number(defaultExam.year));
          if (defaultExam.term) setSelectedTerm(defaultExam.term);
        } else {
          setSelectedExamId('');
        }
      }
    }
  }, [exams, activeYearObj, activeTermObj, selectedExamId, selectedYear, selectedTerm]);

  // Helper to find the best matching exam when parameters change
  const findMatchingExam = (
    lvl: string,
    clsId: string,
    yr: number | '',
    trm: string
  ) => {
    if (!exams || exams.length === 0) return '';
    const matching = exams.filter((ex) => {
      const matchLevel = !lvl || !ex.education_level || ex.education_level === lvl;
      let matchClass = true;
      if (ex.class_id && ex.class_id !== 'all' && clsId) {
        const clsObj = classes.find((c) => c.id === clsId || c.class_name.toLowerCase() === clsId.toLowerCase());
        matchClass = ex.class_id === clsId || (clsObj && (ex.class_id.toLowerCase() === clsObj.class_name.toLowerCase() || ex.class_id === clsObj.id));
      }
      const matchYear = !yr || ex.year === Number(yr);
      const matchTerm = !trm || ex.term === trm;
      return matchLevel && matchClass && matchYear && matchTerm;
    });

    if (matching.length > 0) {
      const preferred = matching.find((ex) => ex.status !== 'Archived') || matching[0];
      return preferred.id;
    }

    // Fallback: match level and class regardless of year/term
    const fallbackClass = exams.find((ex) => {
      const matchLevel = !lvl || !ex.education_level || ex.education_level === lvl;
      let matchClass = true;
      if (ex.class_id && ex.class_id !== 'all' && clsId) {
        const clsObj = classes.find((c) => c.id === clsId || c.class_name.toLowerCase() === clsId.toLowerCase());
        matchClass = ex.class_id === clsId || (clsObj && (ex.class_id.toLowerCase() === clsObj.class_name.toLowerCase() || ex.class_id === clsObj.id));
      }
      return matchLevel && matchClass;
    });

    return fallbackClass ? fallbackClass.id : '';
  };

  // Note: Filter selection starts in neutral state (unselected) so no level is favored on mount.



  // Fetch targeted marks for selected exam from Supabase
  useEffect(() => {
    let isMounted = true;
    if (!selectedExamId) {
      setIsLoadingMarks(false);
      return;
    }

    setIsLoadingMarks(true);
    api
      .fetchMarksForExam(selectedExamId, {
        classId: selectedClassId,
        streamId: selectedStreamId,
      })
      .then(() => {
        if (isMounted) {
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('Error fetching validation marks:', err);
        if (isMounted) setIsLoadingMarks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, selectedClassId, selectedStreamId]);

  // Comparison Option Selection
  const [comparisonType, setComparisonType] = useState<string>('None');

  // Merit Configuration Options
  const [rankingMethod, setRankingMethod] = useState<'total_marks' | 'total_points'>('total_marks');
  const [perfLevelMethod, setPerfLevelMethod] = useState<'avg_marks' | 'avg_points'>('avg_marks');
  const [includeXYInRankings, setIncludeXYInRankings] = useState<boolean>(false);
  const [excludeProvisional, setExcludeProvisional] = useState<boolean>(false);
  const [provisionalRankingsOnly, setProvisionalRankingsOnly] = useState<boolean>(false);
  const [applyTieBreaking, setApplyTieBreaking] = useState<boolean>(true);

  // Analysis Recalculation Trigger State (Live dynamic calculation is always available)
  const [isRefreshingAnalysis, setIsRefreshingAnalysis] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Confirmation Modals State
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);

  // Active Exam
  const activeExam = useMemo(() => {
    return exams.find((ex) => ex.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Active teacher and accessible classes for RBAC
  const activeTeacher = useMemo(() => {
    if (!currentUser) return null;
    return teachers.find((t) => t.user_id === currentUser.id || t.id === currentUser.id) || null;
  }, [currentUser, teachers]);

  const accessibleClasses = useMemo(() => {
    return getAccessibleClasses(currentUser || null, activeTeacher, classes);
  }, [currentUser, activeTeacher, classes]);

  // Authoritative in-scope classes according to Phase 3A assessment scope rules
  const inScopeClasses = useMemo(() => {
    const baseList = (accessibleClasses || []).filter((c) => c.status !== 'Inactive');
    if (!activeExam) return baseList;
    return baseList.filter((c) => isClassInExamScope(c, activeExam));
  }, [accessibleClasses, activeExam]);

  // Authoritative in-scope education levels for active assessment
  const availableLevels = useMemo(() => {
    if (!activeExam) return ALL_EDUCATION_LEVELS;
    if (activeExam.education_level) {
      return [activeExam.education_level as EducationLevel];
    }
    if (activeExam.class_id && activeExam.class_id !== 'all') {
      const target = classes.find((c) => c.id === activeExam.class_id);
      if (target) {
        const lvl = target.education_level || getEducationLevelForGrade(target.class_name);
        if (lvl) return [lvl as EducationLevel];
      }
    }
    // School-wide: only levels present in inScopeClasses
    const levelSet = new Set<EducationLevel>();
    inScopeClasses.forEach((c) => {
      const lvl = c.education_level || getEducationLevelForGrade(c.class_name);
      if (lvl) levelSet.add(lvl as EducationLevel);
    });
    const presentLevels = ALL_EDUCATION_LEVELS.filter((l) => levelSet.has(l));
    return presentLevels.length > 0 ? presentLevels : ALL_EDUCATION_LEVELS;
  }, [activeExam, classes, inScopeClasses]);

  // Unique Classes filtered strictly by in-scope classes and selected education level
  const uniqueClasses = useMemo(() => {
    const levelFiltered = selectedLevel
      ? inScopeClasses.filter((c) => {
          const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
          const levelGrades = LEVEL_TO_GRADES[selectedLevel] || [];
          return cLevel === selectedLevel || levelGrades.includes(c.class_name as GradeName);
        })
      : inScopeClasses;

    const rawNames = Array.from(new Set(levelFiltered.map((c) => c.class_name))) as string[];
    return sortGrades(rawNames);
  }, [inScopeClasses, selectedLevel]);

  // Authoritative class resolution for selected class filter (fail closed on ambiguity)
  const resolvedClass = useMemo(() => {
    return resolveAuthoritativeClass(selectedClassId, inScopeClasses);
  }, [selectedClassId, inScopeClasses]);

  // Selected Class object resolved authoritatively
  const selectedClassObject = useMemo(() => {
    if (resolvedClass.status !== 'resolved' || !resolvedClass.classId) return null;
    return inScopeClasses.find((c) => c.id === resolvedClass.classId) || null;
  }, [resolvedClass, inScopeClasses]);

  // Available Streams filtered strictly for authoritative parent class
  const availableStreams = useMemo(() => {
    if (resolvedClass.status !== 'resolved' || !resolvedClass.classId) return [];
    const matching = inScopeClasses.filter((c) => c.id === resolvedClass.classId);
    const streamMap = new Map<string, ClassStream>();
    matching.forEach((c) => {
      const sKey = c.stream ? c.stream.trim() : 'General';
      if (!streamMap.has(sKey)) {
        streamMap.set(sKey, c);
      }
    });
    return Array.from(streamMap.values());
  }, [resolvedClass, inScopeClasses]);

  // Entity Selection Integrity: Invalidate or synchronize level when out-of-scope for active assessment
  useEffect(() => {
    if (!activeExam) return;
    if (activeExam.education_level) {
      if (selectedLevel !== activeExam.education_level) {
        setSelectedLevel(activeExam.education_level as EducationLevel);
        setSelectedClassId('');
        setSelectedStreamId('');
      }
      return;
    }
    // If Grade/Class-Wide assessment with class_id
    if (activeExam.class_id && activeExam.class_id !== 'all') {
      const targetClass = classes.find((c) => c.id === activeExam.class_id);
      if (targetClass) {
        const targetLevel = (targetClass.education_level || getEducationLevelForGrade(targetClass.class_name)) as EducationLevel;
        if (targetLevel && selectedLevel !== targetLevel) {
          setSelectedLevel(targetLevel);
          setSelectedClassId('');
          setSelectedStreamId('');
        }
      }
      return;
    }
    // School-Wide assessment: verify selectedLevel is among availableLevels
    if (selectedLevel && !availableLevels.includes(selectedLevel)) {
      setSelectedLevel('');
      setSelectedClassId('');
      setSelectedStreamId('');
    }
  }, [activeExam, classes, availableLevels, selectedLevel]);

  // Entity Selection Integrity: Invalidate class selection when out-of-scope or ambiguous
  useEffect(() => {
    if (!activeExam) {
      if (selectedClassId) setSelectedClassId('');
      if (selectedStreamId) setSelectedStreamId('');
      return;
    }

    if (selectedClassId && selectedClassId !== 'all') {
      const res = resolveAuthoritativeClass(selectedClassId, inScopeClasses);
      if (res.status === 'not_found' || res.status === 'ambiguous') {
        setSelectedClassId('');
        setSelectedStreamId('');
      }
    }
  }, [activeExam, inScopeClasses, selectedClassId]);

  // Entity Selection Integrity: Invalidate stream selection when out-of-scope for selected class/exam
  useEffect(() => {
    if (!selectedStreamId || selectedStreamId === 'all') return;
    const isStreamValid = availableStreams.some(
      (c) =>
        c.stream_id === selectedStreamId ||
        c.id === selectedStreamId ||
        (c.stream && c.stream.trim().toLowerCase() === selectedStreamId.trim().toLowerCase())
    );
    if (!isStreamValid) {
      setSelectedStreamId('');
    }
  }, [availableStreams, selectedStreamId]);

  // Stream Approvals View: Keep filter level valid
  useEffect(() => {
    if (streamFilterLevel !== 'All' && !availableLevels.includes(streamFilterLevel as EducationLevel)) {
      setStreamFilterLevel('All');
    }
  }, [availableLevels, streamFilterLevel]);

  // Available Years
  const availableYears = useMemo(() => {
    const yrSet = new Set<number>();
    exams.forEach((ex) => {
      if (ex.year) yrSet.add(Number(ex.year));
    });
    yrSet.add(2026);
    yrSet.add(2025);
    yrSet.add(2024);
    return Array.from(yrSet).sort((a, b) => b - a);
  }, [exams]);

  // Available Terms
  const availableTerms = useMemo(() => {
    const defaultTerms = ['Term 1', 'Term 2', 'Term 3'];
    const termSet = new Set<string>(defaultTerms);
    exams.forEach((ex) => {
      if (ex.term) termSet.add(ex.term);
    });
    return Array.from(termSet);
  }, [exams]);

  // Available Exams
  const availableExams = useMemo(() => {
    return exams.filter((ex) => {
      const matchYear = !selectedYear || ex.year === Number(selectedYear);
      const matchTerm = !selectedTerm || ex.term === selectedTerm;
      const matchLevel =
        !selectedLevel ||
        !ex.education_level ||
        ex.education_level === selectedLevel;

      let matchClass = true;
      if (ex.class_id && ex.class_id !== 'all') {
        if (selectedClassId) {
          matchClass =
            ex.class_id === selectedClassId ||
            (selectedClassObject &&
              (ex.class_id.toLowerCase() === selectedClassObject.class_name.toLowerCase() ||
               ex.class_id === selectedClassObject.id));
        }
      }
      return matchYear && matchTerm && matchLevel && matchClass;
    });
  }, [exams, selectedYear, selectedTerm, selectedLevel, selectedClassId, selectedClassObject]);

  // Selected Students scoped strictly by authoritative class resolution and assessment scope
  const selectedStudents = useMemo(() => {
    if (!selectedClassId || resolvedClass.status !== 'resolved') return [];
    const lookupClass = resolvedClass.className || selectedClassId;
    const filtered = getFilteredStudents(students, classes, lookupClass, selectedStreamId, activeExam);
    return filtered.filter((std) => {
      if (std.active === false) return false;
      if (!activeExam) return true;
      const context = getLearnerClassAtExamTime(std, activeExam, classes);
      return isLearnerInExamScope(context, activeExam, classes);
    });
  }, [students, classes, selectedClassId, resolvedClass, selectedStreamId, activeExam]);

  // Applicable Subjects
  const learnerSubjects = useMemo(() => {
    if (!selectedClassObject) return [];
    const baseApplicable = getLearnerReportSubjects({} as any, selectedClassObject, subjects, teachers);
    if (currentUser?.role === 'admin') return baseApplicable;

    if (currentUser?.role === 'class_teacher' || currentUser?.role === 'subject_teacher') {
      const targetStreamObj = selectedStreamId
        ? classes.find((c) => c.stream_id === selectedStreamId || c.stream === selectedStreamId || c.id === selectedStreamId) || selectedClassObject
        : selectedClassObject;

      const isClassTeacher =
        isClassTeacherFor(activeTeacher, targetStreamObj.id, classes) ||
        (activeTeacher?.is_class_teacher &&
          (activeTeacher?.class_teacher_of_id === selectedClassObject.id ||
            selectedClassObject.class_teacher_id === activeTeacher.id));

      if (isClassTeacher) return baseApplicable;

      const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);
      return baseApplicable.filter((s) => assignedIds.includes(s.id));
    }
    return baseApplicable;
  }, [selectedClassObject, selectedStreamId, classes, subjects, currentUser, activeTeacher]);

  // Check selection completeness
  const isSelectionComplete = useMemo(() => {
    return Boolean(selectedLevel && selectedClassId && selectedStreamId && selectedYear && selectedTerm && selectedExamId);
  }, [selectedLevel, selectedClassId, selectedStreamId, selectedYear, selectedTerm, selectedExamId]);


  // Shared memoised lookup Map for O(1) mark retrieval: student_id + subject_id + exam_id
  const markMap = useMemo(() => {
    const map = new Map<string, Mark>();
    if (marks) {
      marks.forEach((m) => {
        if (m.student_id && m.subject_id && m.exam_id) {
          map.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m);
        }
      });
    }
    return map;
  }, [marks]);

  // Marks Entry Progress & Per-Subject Summary
  const subjectProgressList = useMemo(() => {
    if (!isSelectionComplete || !activeExam || selectedStudents.length === 0) return [];

    return learnerSubjects.map((sb) => {
      let completed = 0;
      let missingX = 0;
      let irregularityY = 0;

      selectedStudents.forEach((std) => {
        const stdMark = markMap.get(`${std.id}_${sb.id}_${activeExam.id}`);
        const evalMark = evaluateMark(stdMark);

        if (evalMark.status === 'Normal' && evalMark.percentage !== null) {
          completed++;
        } else if (evalMark.status === 'X') {
          missingX++;
          completed++;
        } else if (evalMark.status === 'Y') {
          irregularityY++;
          completed++;
        }
      });

      const totalExpected = selectedStudents.length;
      const provisional = totalExpected - completed;
      const completionRate = totalExpected > 0 ? (completed / totalExpected) * 100 : 0;
      const isComplete100 = totalExpected > 0 && completed === totalExpected;

      return {
        subject: sb,
        totalExpected,
        completed,
        provisional,
        missingX,
        irregularityY,
        completionRate,
        isComplete100,
      };
    });
  }, [isSelectionComplete, activeExam, selectedStudents, learnerSubjects, markMap]);

  // Aggregate Stats
  const overallProgressStats = useMemo(() => {
    const totalLearners = selectedStudents.length;

    if (totalLearners === 0 || learnerSubjects.length === 0) {
      return {
        totalLearners,
        totalSubjectRecordsExpected: 0,
        completedRecords: 0,
        provisionalRecords: totalLearners,
        totalMissingX: 0,
        totalIrregularityY: 0,
        overallCompletionPercentage: 0,
        allSubjects100Percent: false,
      };
    }

    let completeLearnerCount = 0;
    let learnersWithXCount = 0;
    let learnersWithYCount = 0;

    selectedStudents.forEach((std) => {
      let studentCompletedSubjects = 0;
      let studentHasX = false;
      let studentHasY = false;

      learnerSubjects.forEach((sb) => {
        const stdMark = activeExam ? markMap.get(`${std.id}_${sb.id}_${activeExam.id}`) : undefined;
        const evalMark = evaluateMark(stdMark);

        if (
          (evalMark.status === 'Normal' && evalMark.percentage !== null) ||
          evalMark.status === 'X' ||
          evalMark.status === 'Y'
        ) {
          studentCompletedSubjects++;
        }
        if (evalMark.status === 'X') studentHasX = true;
        if (evalMark.status === 'Y') studentHasY = true;
      });

      if (studentCompletedSubjects === learnerSubjects.length && learnerSubjects.length > 0) {
        completeLearnerCount++;
      }
      if (studentHasX) learnersWithXCount++;
      if (studentHasY) learnersWithYCount++;
    });

    const totalSubjectRecordsExpected = totalLearners * learnerSubjects.length;
    const totalSubjectRecordsCompleted = subjectProgressList.reduce((acc, sp) => acc + sp.completed, 0);
    const completedRecords = Math.min(totalLearners, completeLearnerCount);
    const provisionalRecords = Math.max(0, totalLearners - completedRecords);
    const totalMissingX = learnersWithXCount;
    const totalIrregularityY = learnersWithYCount;
    const overallCompletionPercentage = totalSubjectRecordsExpected > 0 ? (totalSubjectRecordsCompleted / totalSubjectRecordsExpected) * 100 : 0;
    const allSubjects100Percent =
      totalLearners > 0 &&
      completedRecords === totalLearners &&
      subjectProgressList.every((sp) => sp.isComplete100);

    return {
      totalLearners,
      totalSubjectRecordsExpected,
      completedRecords,
      provisionalRecords,
      totalMissingX,
      totalIrregularityY,
      overallCompletionPercentage,
      allSubjects100Percent,
    };
  }, [selectedStudents, learnerSubjects, markMap, activeExam, subjectProgressList]);

  // Exam Statistics & Grade Distribution
  const examStatistics = useMemo(() => {
    const selectedClassObj = classes.find((c) => c.id === selectedClassId || c.stream_id === selectedClassId || c.class_name === selectedClassId);
    const currentEducationLevel = selectedClassObj?.education_level || (selectedClassObj?.class_name ? getEducationLevelForGrade(selectedClassObj.class_name) : (activeExam?.education_level !== 'All Levels' ? activeExam?.education_level : undefined));
    const isUpperPrimaryPhase = currentEducationLevel === 'Upper Primary';

    const defaultLevelCounts = isUpperPrimaryPhase
      ? { EE: 0, ME: 0, AE: 0, BE: 0, X: 0, Y: 0 }
      : { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0, X: 0, Y: 0 };

    const defaultStats = {
      highestMark: 0,
      lowestMark: 0,
      classAveragePct: 0,
      classAveragePoints: 0,
      overallLevelCode: '-',
      overallPerfLevel: 'Pending',
      overallDescriptor: 'No Data',
      totalLearners: selectedStudents.length,
      completeLearnersCount: 0,
      provisionalLearnersCount: 0,
      levelCounts: { ...defaultLevelCounts } as Record<string, number>,
    };

    if (!isSelectionComplete || !activeExam || selectedStudents.length === 0) {
      return defaultStats;
    }

    let maxMark = 0;
    let minMark = 100;
    let sumMarks = 0;
    let sumPoints = 0;
    let evaluatedStudentsCount = 0;

    const levelCounts: Record<string, number> = { ...defaultLevelCounts };

    selectedStudents.forEach((std) => {
      let studentSumPct = 0;
      let studentSumPts = 0;
      let validSubjCount = 0;
      let hasX = false;
      let hasY = false;

      learnerSubjects.forEach((sb) => {
        const stdMark = markMap.get(`${std.id}_${sb.id}_${activeExam.id}`);
        const evalMark = evaluateMark(stdMark);

        if (evalMark.status === 'Normal' && evalMark.percentage !== null) {
          studentSumPct += evalMark.percentage;
          const gr = getGradeForMark(evalMark.percentage, grades, currentEducationLevel, selectedClassObj?.class_name);
          studentSumPts += gr.points;
          validSubjCount++;
        } else if (evalMark.status === 'X') {
          hasX = true;
        } else if (evalMark.status === 'Y') {
          hasY = true;
        }
      });

      if (validSubjCount > 0) {
        const studentAvgPct = studentSumPct / validSubjCount;
        const studentAvgPts = studentSumPts / validSubjCount;

        if (studentAvgPct > maxMark) maxMark = studentAvgPct;
        if (studentAvgPct < minMark) minMark = studentAvgPct;

        sumMarks += studentAvgPct;
        sumPoints += studentAvgPts;
        evaluatedStudentsCount++;

        const studentGradeObj = getGradeForMark(studentAvgPct, grades, currentEducationLevel, selectedClassObj?.class_name);
        const code = studentGradeObj.grade_code || studentGradeObj.grade || (isUpperPrimaryPhase ? 'ME' : 'ME1');
        if (levelCounts[code] !== undefined) {
          levelCounts[code]++;
        }
      } else if (hasX) {
        levelCounts.X++;
      } else if (hasY) {
        levelCounts.Y++;
      }
    });

    const classAveragePct = evaluatedStudentsCount > 0 ? sumMarks / evaluatedStudentsCount : 0;
    const overallGrade = evaluatedStudentsCount > 0 ? getGradeForMark(classAveragePct, grades, currentEducationLevel, selectedClassObj?.class_name) : null;
    const classAveragePoints = overallGrade?.points || 0;

    return {
      highestMark: evaluatedStudentsCount > 0 ? maxMark : 0,
      lowestMark: evaluatedStudentsCount > 0 ? minMark : 0,
      classAveragePct,
      classAveragePoints,
      overallLevelCode: overallGrade?.grade_code || overallGrade?.grade || '-',
      overallPerfLevel: overallGrade?.performance_level || 'Pending',
      overallDescriptor: overallGrade?.descriptor || (evaluatedStudentsCount > 0 ? 'Evaluated' : 'No Entry'),
      totalLearners: selectedStudents.length,
      completeLearnersCount: Math.min(selectedStudents.length, evaluatedStudentsCount),
      provisionalLearnersCount: Math.max(0, selectedStudents.length - Math.min(selectedStudents.length, evaluatedStudentsCount)),
      levelCounts,
    };
  }, [isSelectionComplete, activeExam, selectedStudents, learnerSubjects, markMap, grades, selectedClassId, classes]);

  // Comparison Data
  const comparisonData = useMemo(() => {
    if (comparisonType === 'None' || !isSelectionComplete || !activeExam) return null;

    let priorExam: Examination | null = null;
    if (comparisonType === 'Previous Mid-Term') {
      priorExam = exams.find((ex) => ex.exam_type === 'Mid-Term' && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous End-Term') {
      priorExam = exams.find((ex) => ex.exam_type === 'End-Term' && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous Term') {
      priorExam = exams.find((ex) => ex.year === activeExam.year && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous Academic Year') {
      priorExam = exams.find((ex) => ex.year === activeExam.year - 1) || null;
    }

    if (!priorExam) {
      return { found: false, message: `No historical assessment records found for "${comparisonType}".` };
    }

    let totalGains = 0;
    let totalLosses = 0;
    let countImproved = 0;
    let countDeclined = 0;
    let countUnchanged = 0;

    selectedStudents.forEach((std) => {
      let currPctSum = 0;
      let currCount = 0;
      learnerSubjects.forEach((sb) => {
        const m = markMap.get(`${std.id}_${sb.id}_${activeExam.id}`);
        const evalM = evaluateMark(m);
        if (evalM.status === 'Normal' && evalM.percentage !== null) {
          currPctSum += evalM.percentage;
          currCount++;
        }
      });
      const currAvg = currCount > 0 ? currPctSum / currCount : null;

      let priorPctSum = 0;
      let priorCount = 0;
      learnerSubjects.forEach((sb) => {
        const m = priorExam ? markMap.get(`${std.id}_${sb.id}_${priorExam.id}`) : undefined;
        const evalM = evaluateMark(m);
        if (evalM.status === 'Normal' && evalM.percentage !== null) {
          priorPctSum += evalM.percentage;
          priorCount++;
        }
      });
      const priorAvg = priorCount > 0 ? priorPctSum / priorCount : null;

      if (currAvg !== null && priorAvg !== null) {
        const diff = currAvg - priorAvg;
        if (diff > 0.05) {
          countImproved++;
          totalGains += diff;
        } else if (diff < -0.05) {
          countDeclined++;
          totalLosses += Math.abs(diff);
        } else {
          countUnchanged++;
        }
      }
    });

    return {
      found: true,
      priorExamName: `${priorExam.exam_name} (${priorExam.term} ${priorExam.year})`,
      countImproved,
      countDeclined,
      countUnchanged,
      avgImprovement: countImproved > 0 ? totalGains / countImproved : 0,
      avgDecline: countDeclined > 0 ? totalLosses / countDeclined : 0,
    };
  }, [comparisonType, isSelectionComplete, activeExam, exams, selectedStudents, learnerSubjects, markMap]);

  // Automated Examination Validation Checklist
  const validationResults = useMemo(() => {
    if (!isSelectionComplete || !activeExam) return null;

    const issues: { type: 'blocking' | 'warning' | 'info'; title: string; detail: string }[] = [];

    // Check 0: Active Learners in Cohort
    if (selectedStudents.length === 0) {
      issues.push({
        type: 'blocking',
        title: 'No Active Learners in Cohort',
        detail: 'No active learners found for the selected cohort. Cannot run analysis.',
      });
    }

    // Check 1: Required Learning Areas
    if (learnerSubjects.length === 0) {
      issues.push({
        type: 'blocking',
        title: 'Missing Required Learning Areas',
        detail: `No active subjects or learning areas found for ${selectedClassObject?.class_name || 'selected class'}.`,
      });
    }

    // Check 2: Teacher Allocations
    const matchingClassIds = resolvedClass.status === 'resolved' && resolvedClass.classId
      ? [resolvedClass.classId]
      : [];

    const unallocatedSubjects = learnerSubjects.filter(
      (sb) =>
        !teachers.some((t) => {
          const assignedSubjects = getTeacherAssignedSubjectIds(t);
          const assignedClasses = getTeacherAssignedClassIds(t, classes);
          const matchesClass = assignedClasses.length === 0 || assignedClasses.some((cId) => matchingClassIds.includes(cId) || cId === selectedClassId);
          return assignedSubjects.includes(sb.id) && matchesClass;
        })
    );
    if (unallocatedSubjects.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Unassigned Learning Areas',
        detail: `${unallocatedSubjects.length} subject(s) lack explicit teacher allocations (${unallocatedSubjects.map((s) => s.subject_code).join(', ')}).`,
      });
    }

    // Check 3: Assessment Range & Invalid Marks
    let invalidMarkCount = 0;
    marks.forEach((m) => {
      if (m.exam_id === activeExam.id) {
        const studentBelongs = selectedStudents.some((s) => s.id === m.student_id);
        const subjectBelongs = learnerSubjects.some((s) => s.id === m.subject_id);
        if (studentBelongs && subjectBelongs && (m.special_status === 'Normal' || !m.special_status)) {
          const val = m.raw_score !== undefined && m.raw_score !== null ? m.raw_score : m.marks;
          const max = activeExam.max_marks;
          const numVal = typeof val === 'number' ? val : (typeof val === 'string' && val.trim() !== '' ? Number(val) : NaN);
          if (isNaN(numVal) || numVal < 0 || numVal > max) {
            invalidMarkCount++;
          }
        }
      }
    });

    if (invalidMarkCount > 0) {
      issues.push({
        type: 'blocking',
        title: 'Invalid Mark Entries Detected',
        detail: `${invalidMarkCount} mark entry(ies) fall outside allowed boundaries (0–${activeExam.max_marks}).`,
      });
    }

    // Check 4: Duplicate Entries
    const seenMap = new Set<string>();
    let duplicateCount = 0;
    marks.forEach((m) => {
      if (m.exam_id === activeExam.id) {
        const studentBelongs = selectedStudents.some((s) => s.id === m.student_id);
        const subjectBelongs = learnerSubjects.some((s) => s.id === m.subject_id);
        if (studentBelongs && subjectBelongs) {
          const key = `${m.student_id}_${m.subject_id}`;
          if (seenMap.has(key)) duplicateCount++;
          else seenMap.add(key);
        }
      }
    });

    if (duplicateCount > 0) {
      issues.push({
        type: 'blocking',
        title: 'Duplicate Assessment Entries',
        detail: `Found ${duplicateCount} duplicate mark record(s) in the database.`,
      });
    }

    // Check 5: Missing Marks (X)
    let missingXCount = 0;
    subjectProgressList.forEach((sp) => { missingXCount += sp.missingX; });
    if (missingXCount > 0) {
      issues.push({
        type: 'warning',
        title: 'Missing Assessments (Status X)',
        detail: `Identified ${missingXCount} missing assessment record(s) flagged as 'X'.`,
      });
    }

    // Check 6: Irregularities (Y)
    let irregularityYCount = 0;
    subjectProgressList.forEach((sp) => { irregularityYCount += sp.irregularityY; });
    if (irregularityYCount > 0) {
      issues.push({
        type: 'warning',
        title: 'Assessment Irregularities (Status Y)',
        detail: `Identified ${irregularityYCount} irregularity record(s) flagged as 'Y'.`,
      });
    }

    // Check 7: Subject Completeness
    const incompleteSubjects = subjectProgressList.filter((sp) => !sp.isComplete100);
    if (incompleteSubjects.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Incomplete Learning Area Entry',
        detail: `${incompleteSubjects.length} learning area(s) have uncompleted mark entries.`,
      });
    }

    // Check 8: Zero Marks Entered
    if (selectedStudents.length > 0 && learnerSubjects.length > 0) {
      const totalEntered = subjectProgressList.reduce((acc, sp) => acc + sp.completed, 0);
      if (totalEntered === 0) {
        issues.push({
          type: 'blocking',
          title: 'No Marks Entered',
          detail: 'No assessment marks have been entered for this cohort. Enter marks before running analysis and requesting approval.',
        });
      }
    }

    const blockingIssues = issues.filter((i) => i.type === 'blocking');
    const warningIssues = issues.filter((i) => i.type === 'warning');

    return {
      issues,
      blockingIssues,
      warningIssues,
      isReadyForApproval: blockingIssues.length === 0,
    };
  }, [isSelectionComplete, activeExam, learnerSubjects, selectedClassObject, teachers, selectedClassId, marks, selectedStudents, subjectProgressList]);

  // Recalculate / Refresh Live Diagnostic Assessment Analysis
  const handleStartAnalysis = () => {
    if (!isSelectionComplete || !activeExam) {
      setToastMessage({
        type: 'warning',
        text: 'Please complete all filter selections before running assessment analysis.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (selectedStudents.length === 0) {
      setToastMessage({
        type: 'warning',
        text: 'No active learners found for the selected cohort. Cannot run analysis.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    setIsRefreshingAnalysis(true);
    setLastRefreshedAt(new Date());

    // Instantaneous diagnostic recalculation
    setTimeout(() => {
      setIsRefreshingAnalysis(false);
      setToastMessage({
        type: 'success',
        text: `✓ Live Diagnostic Analysis refreshed for "${getDisplayExamName(activeExam.exam_name)}"! Calculations and quality checks are up-to-date.`,
      });
      setTimeout(() => setToastMessage(null), 4000);
    }, 250);
  };

  // Term Permission
  const canModify = canApproveExams(activeTermObj.status);

  // Determine if currently selected level is approved
  const isCurrentLevelApproved = useMemo(() => {
    if (!activeExam) return false;
    if (activeExam.status === 'Approved') return true;
    if (selectedLevel) {
      return isLevelApproved(activeExam, selectedLevel);
    }
    return false;
  }, [activeExam, selectedLevel]);

  // Handle Official Level-Specific Approval Confirmation
  const handleConfirmLevelApproval = () => {
    if (!activeExam || !selectedLevel) return;
    if (currentUser?.role !== 'admin') {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can approve and lock official results.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    if (onUpdateExamLevelApproval) {
      onUpdateExamLevelApproval(activeExam.id, selectedLevel as EducationLevel, true);
    } else {
      onUpdateExamStatus(activeExam.id, 'Approved');
    }
    setShowApproveModal(false);
    setToastMessage({
      type: 'success',
      text: `✓ Education Level [${selectedLevel}] for "${getDisplayExamName(activeExam.exam_name)}" has been OFFICIALLY APPROVED & LOCKED! Reports for ${selectedLevel} are now unlocked.`,
    });
    setTimeout(() => setToastMessage(null), 6000);
  };

  // Handle Level Re-open Confirmation
  const handleConfirmLevelReopen = () => {
    if (!activeExam || !selectedLevel) return;
    if (currentUser?.role !== 'admin') {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can reopen an approved assessment level.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    if (onUpdateExamLevelApproval) {
      onUpdateExamLevelApproval(activeExam.id, selectedLevel as EducationLevel, false);
    } else {
      onUpdateExamStatus(activeExam.id, 'Draft');
    }
    setShowReopenModal(false);

    setToastMessage({
      type: 'info',
      text: `Education Level [${selectedLevel}] reopened for editing. Marks and verification are open.`,
    });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handle Official Global Approval Confirmation
  const handleConfirmApproval = () => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can approve and lock official results.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    onUpdateExamStatus(activeExam.id, 'Approved');
    setShowApproveModal(false);
    setToastMessage({
      type: 'success',
      text: `✓ Assessment "${getDisplayExamName(activeExam.exam_name)}" has been OFFICIALLY APPROVED & LOCKED across all education levels! Official reports and merit lists are now available.`,
    });
    setTimeout(() => setToastMessage(null), 6000);
  };

  // Handle Re-open Confirmation
  const handleConfirmReopen = () => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can reopen an approved assessment.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    onUpdateExamStatus(activeExam.id, 'Draft');
    setShowReopenModal(false);

    setToastMessage({
      type: 'info',
      text: `Assessment "${getDisplayExamName(activeExam.exam_name)}" reopened for editing. Marks and verification are open.`,
    });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handle Individual Class-Stream Approval by Admin
  const handleConfirmStreamApproval = async (targetStream: ClassStream) => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setStreamToApprove(null);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can approve class streams from this management panel.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setStreamToApprove(null);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const streamIdentifier = targetStream.stream_id || targetStream.id;
    try {
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(activeExam.id, streamIdentifier, true);
      } else {
        await api.updateExaminationClassApproval(activeExam.id, streamIdentifier, true, currentUser);
        onMarksUpdated?.();
      }
      setStreamToApprove(null);
      setToastMessage({
        type: 'success',
        text: `✓ Results for ${targetStream.class_name} ${targetStream.stream} OFFICIALLY APPROVED & LOCKED.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to approve class stream:', err);
      setStreamToApprove(null);
      setToastMessage({
        type: 'warning',
        text: getUserFriendlyErrorMessage(err, 'Failed to approve class stream.'),
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Handle Individual Class-Stream Reopen by Admin
  const handleConfirmStreamReopen = async (targetStream: ClassStream) => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setStreamToReopen(null);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can reopen an approved class stream.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setStreamToReopen(null);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const streamIdentifier = targetStream.stream_id || targetStream.id;
    try {
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(activeExam.id, streamIdentifier, false);
      } else {
        await api.updateExaminationClassApproval(activeExam.id, streamIdentifier, false, currentUser);
        onMarksUpdated?.();
      }
      setStreamToReopen(null);
      setToastMessage({
        type: 'info',
        text: `Results for ${targetStream.class_name} ${targetStream.stream} reopened for editing.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to reopen class stream:', err);
      setStreamToReopen(null);
      setToastMessage({
        type: 'warning',
        text: getUserFriendlyErrorMessage(err, 'Failed to reopen class stream.'),
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Helper to compute comprehensive stream readiness & approval stats
  const streamApprovalStats = useMemo(() => {
    return computeExamReadiness(activeExam, classes, students, subjects, marks, teachers);
  }, [classes, students, subjects, marks, teachers, activeExam]);

  return (
    <div className="space-y-6 pb-12">
      {/* Floating Brief Pop-up Toast: Examination Approval & Workflow */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
          )}
          <span className="text-xs font-bold leading-tight truncate">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP EXECUTIVE BANNER: REMOVED FOR CLEAN COMPACT MOBILE-FIRST PRESENTATION */}

      {/* VIEW 1: MANAGE CLASS-STREAM APPROVALS (ADMINISTRATOR VIEW) */}
      {adminViewMode === 'stream-approvals' && currentUser?.role === 'admin' ? (
        <div className="space-y-4 sm:space-y-5">
          {/* Results Approval & Release Control Centre */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-4">
            {/* Header & Stage Sequence Workflow */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                  <h1 className="text-base sm:text-lg font-black text-[#1F2937] dark:text-slate-100 uppercase tracking-tight">
                    Results Approval &amp; Release
                  </h1>
                </div>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Review stream readiness, execute approvals, and lock assessments.
                </p>
              </div>

              {/* Sequential Stage Indicator (Requirement 12) */}
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0 self-start md:self-auto">
                <span className="text-slate-400 dark:text-slate-500">1. Validate</span>
                <span>&rarr;</span>
                <span className="text-[#075E42] dark:text-emerald-400 font-black">2. Approve</span>
                <span>&rarr;</span>
                <span className="text-slate-700 dark:text-slate-300">3. Lock</span>
                <span>&rarr;</span>
                <span className="text-slate-400 dark:text-slate-500">4. Release</span>
              </div>
            </div>

            {/* Target Assessment Monitored (Requirement 1) */}
            <div className="space-y-1.5">
              <label htmlFor="stream-approval-target-exam" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                <span>Target Assessment:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <select
                    id="stream-approval-target-exam"
                    value={selectedExamId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedExamId(newId);
                      const ex = exams.find((x) => x.id === newId);
                      if (ex) {
                        if (ex.year) setSelectedYear(Number(ex.year));
                        if (ex.term) setSelectedTerm(ex.term);
                        if (ex.education_level) setSelectedLevel(ex.education_level as EducationLevel);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 cursor-pointer shadow-2xs min-h-[44px]"
                  >
                    <option value="">Select Assessment...</option>
                    {groupExamsForDropdown(exams, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                      <optgroup key={`appr_grp_${gIdx}`} label={grp.label}>
                        {grp.exams.map(({ exam: ex, label: optLabel }) => (
                          <option key={ex.id} value={ex.id}>
                            {optLabel}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4 flex items-center gap-2">
                  {activeExam ? (
                    <div
                      className={`w-full text-xs font-bold px-3 py-2 rounded-xl border flex items-center justify-center gap-1.5 min-h-[44px] shadow-2xs ${
                        activeExam.status === 'Approved'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : activeExam.status === 'Provisional'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {activeExam.status === 'Approved' ? (
                        <>
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Approved &amp; Locked</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Status: {activeExam.status || 'Active'}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 min-h-[44px] flex items-center justify-center w-full">
                      No Assessment Selected
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Approval Overview Card (Requirement 1) */}
            {activeExam && (
              <div className="bg-[#F8FAFC] dark:bg-slate-800/50 rounded-xl p-3.5 sm:p-4 border border-[#E2E8F0] dark:border-slate-700/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                      Approval Overview
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      ({streamApprovalStats.totalStreamsCount} Total Streams)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-lg">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{streamApprovalStats.readyStreamsCount + streamApprovalStats.approvedStreamsCount} Ready</span>
                    </span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-lg">
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>{streamApprovalStats.incompleteStreamsCount} Pending</span>
                    </span>
                    {streamApprovalStats.approvedStreamsCount > 0 && (
                      <>
                        <span className="text-slate-400">&bull;</span>
                        <span className="inline-flex items-center gap-1 text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 rounded-lg">
                          <Lock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                          <span>{streamApprovalStats.approvedStreamsCount} Locked</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Percentage */}
                {(() => {
                  const total = streamApprovalStats.totalStreamsCount;
                  const readyAndApproved = streamApprovalStats.readyStreamsCount + streamApprovalStats.approvedStreamsCount;
                  const percentage = total > 0 ? Math.round((readyAndApproved / total) * 100) : 0;

                  return (
                    <div className="space-y-1.5">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            percentage >= 100
                              ? 'bg-emerald-600'
                              : percentage >= 60
                              ? 'bg-sky-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>Readiness: {readyAndApproved} of {total} streams complete</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{percentage}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Education Level Filter Segmented Control (Requirement 2) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                Filter School Level:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(availableLevels.length > 1 ? (['All', ...availableLevels] as const) : availableLevels).map((lvl) => {
                  const isActive = streamFilterLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setStreamFilterLevel(lvl)}
                      className={`text-xs px-3.5 py-2 rounded-xl font-bold transition cursor-pointer whitespace-nowrap shrink-0 min-h-[44px] flex items-center justify-center gap-1.5 shadow-2xs ${
                        isActive
                          ? 'bg-[#075E42] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span>{lvl.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Formal Sign-Off Guide - Single Top Display (Requirement 3) */}
            <div className="border border-emerald-200 dark:border-emerald-800/70 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowApprovalGuide((prev) => !prev)}
                className="w-full bg-emerald-50/80 dark:bg-emerald-950/40 p-3 text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center justify-between hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60 transition cursor-pointer min-h-[44px]"
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#075E42] dark:text-emerald-400 shrink-0" />
                  <span className="uppercase tracking-wide text-[11px]">Approval &amp; Locking Gate Guidelines</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  <span>{showApprovalGuide ? 'Hide Guidelines' : 'View Guidelines'}</span>
                  {showApprovalGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {showApprovalGuide && (
                <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 border-t border-emerald-200/80 dark:border-emerald-800/60 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs text-emerald-950 dark:text-emerald-200">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <span className="font-extrabold text-[#075E42] dark:text-emerald-400 block text-[11px]">1. Quality Verification</span>
                    <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">Audits and completeness checks ensure marks meet the 100% readiness requirement before sign-off.</span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <span className="font-extrabold text-[#075E42] dark:text-emerald-400 block text-[11px]">2. Lock Enforcement</span>
                    <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">Clicking <strong>Approve &amp; Lock</strong> freezes marks entry against edits and authorizes official merit lists and reports.</span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                    <span className="font-extrabold text-[#075E42] dark:text-emerald-400 block text-[11px]">3. Automatic Rollup</span>
                    <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">Stream approvals roll up progressively to Grade, Education Level, and Whole-Assessment status.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grouped Level & Grade Stream Cards (Filtered by streamFilterLevel and only in-scope levels) */}
          <div className="space-y-4 sm:space-y-5">
            {(Object.values(streamApprovalStats.levelGroups) as LevelReadinessDetail[])
              .filter((lvlGrp) => streamFilterLevel === 'All' || lvlGrp.level === streamFilterLevel)
              .filter((lvlGrp) => lvlGrp.totalStreams > 0)
              .map((lvlGrp) => {
                const isExpanded = Boolean(expandedLevels[lvlGrp.level]);

                return (
                  <div
                    key={lvlGrp.level}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-4"
                  >
                    {/* Education Level Header */}
                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isExpanded ? 'border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3' : ''}`}>
                      <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-extrabold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                            <GraduationCap className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                            <span>{lvlGrp.level}</span>
                          </h3>
                          <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">
                            {lvlGrp.totalStreams} Streams &bull; {lvlGrp.readyCount + lvlGrp.approvedCount} Ready &bull; {lvlGrp.incompleteCount} Pending
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap sm:flex-nowrap">
                        <span
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center space-x-1.5 shadow-2xs ${
                            lvlGrp.isLevelApproved
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : lvlGrp.isLevelReady
                              ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {lvlGrp.isLevelApproved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Approved ({lvlGrp.approvedCount}/{lvlGrp.totalStreams})</span>
                            </>
                          ) : lvlGrp.isLevelReady ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                              <span>Ready ({lvlGrp.readyCount + lvlGrp.approvedCount}/{lvlGrp.totalStreams})</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>In Progress ({lvlGrp.readyCount} Ready, {lvlGrp.incompleteCount} Pending)</span>
                            </>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleLevelExpand(lvlGrp.level)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px]"
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${lvlGrp.level} section`}
                        >
                          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        {/* Level Incomplete Alert Banner */}
                        {lvlGrp.incompleteStreams.length > 0 && !lvlGrp.isLevelApproved && (
                          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-xl p-3.5 flex items-start space-x-3">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                              <p className="font-extrabold text-amber-950 dark:text-amber-100">
                                {lvlGrp.level} has {lvlGrp.incompleteCount} stream{lvlGrp.incompleteCount === 1 ? '' : 's'} with pending mark entries:
                              </p>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                {lvlGrp.incompleteStreams.map((st) => (
                                  <li key={st.streamId}>
                                    <span className="font-bold text-amber-950 dark:text-amber-100">{st.className} {st.streamName}</span> — {st.missingMarks} mark{st.missingMarks === 1 ? '' : 's'} missing {st.missingSubjects.length > 0 ? `(${st.missingSubjects.map(s => `${s.subjectName}: ${s.missingCount}`).join(', ')})` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Grades within this Level */}
                        <div className="space-y-3 sm:space-y-4">
                          {(Object.values(lvlGrp.grades) as GradeReadinessDetail[]).map((grd) => (
                            <div
                              key={grd.gradeName}
                              className="bg-[#F6F8FA] dark:bg-slate-800/40 rounded-xl p-3.5 sm:p-4 border border-[#D9E0E7]/80 dark:border-slate-800 space-y-3"
                            >
                              {/* Grade Header */}
                              <div className="flex items-center justify-between border-b border-[#D9E0E7]/60 dark:border-slate-700/60 pb-2">
                                <span className="font-extrabold text-xs text-[#1F2937] dark:text-slate-200 uppercase tracking-wide">
                                  {grd.gradeName}
                                </span>
                                <span
                                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                                    grd.isGradeApproved
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                      : grd.isGradeReady
                                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  {grd.isGradeApproved
                                    ? '✓ Approved'
                                    : grd.isGradeReady
                                    ? `✓ Ready (${grd.readyCount + grd.approvedCount}/${grd.totalStreams})`
                                    : `⚠ Incomplete (${grd.incompleteCount} pending)`}
                                </span>
                              </div>

                              {/* Stream Cards Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {grd.streams.map((st) => {
                                  const streamUniqueId = st.streamObj.stream_id || st.streamObj.id;
                                  const isExpanded = expandedStreamIssues[streamUniqueId];

                                  return (
                                    <div
                                      key={streamUniqueId}
                                      className={`rounded-2xl p-4 border transition flex flex-col justify-between space-y-3.5 shadow-xs ${
                                        st.isApproved
                                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80'
                                          : st.isReady
                                          ? 'bg-white dark:bg-slate-900 border-emerald-300/80 dark:border-emerald-800/70 hover:border-emerald-500'
                                          : 'bg-white dark:bg-slate-900 border-amber-300/70 dark:border-amber-900/60'
                                      }`}
                                    >
                                      <div className="space-y-2.5">
                                        {/* Card Header: Stream Name & Status Badge */}
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-black text-[#1F2937] dark:text-slate-100 truncate">
                                              {st.streamObj.class_name} {st.streamObj.stream}
                                            </h4>
                                            <p className="text-xs text-[#667085] dark:text-slate-400 truncate mt-0.5">
                                              Teacher: <span className="font-semibold text-[#1F2937] dark:text-slate-300">{st.teacherName}</span>
                                            </p>
                                          </div>

                                          {/* Status Information Pill */}
                                          <span
                                            className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-1 shadow-2xs ${
                                              st.isApproved
                                                ? 'bg-emerald-600 text-white border border-emerald-700'
                                                : st.isReady
                                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                                                : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                            }`}
                                          >
                                            {st.isApproved ? (
                                              <>
                                                <Lock className="w-3 h-3" />
                                                <span>Approved &amp; Locked</span>
                                              </>
                                            ) : st.isReady ? (
                                              <>
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                <span>Ready for Approval</span>
                                              </>
                                            ) : (
                                              <>
                                                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                <span>Attention Required</span>
                                              </>
                                            )}
                                          </span>
                                        </div>

                                        {/* Progress Bar & Numerical Metrics */}
                                        <div className="space-y-1.5 pt-0.5">
                                          <div className="flex justify-between items-center text-xs font-semibold text-[#667085] dark:text-slate-400">
                                            <span>{st.totalLearners} Learners</span>
                                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                              {st.enteredMarks} / {st.expectedMarks} marks ({st.percentage}%)
                                            </span>
                                          </div>
                                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full transition-all duration-300 ${
                                                st.percentage >= 100
                                                  ? 'bg-emerald-600'
                                                  : st.percentage >= 80
                                                  ? 'bg-amber-500'
                                                  : 'bg-rose-500'
                                              }`}
                                              style={{ width: `${Math.min(100, st.percentage)}%` }}
                                            />
                                          </div>

                                          {/* Incomplete Issues Summary with Expandable Drawer */}
                                          {st.missingSubjects.length > 0 && (
                                            <div className="pt-1.5 space-y-1.5">
                                              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                                                <span>
                                                  {st.missingMarks} mark{st.missingMarks === 1 ? '' : 's'} missing ({st.missingSubjects.length} subject{st.missingSubjects.length === 1 ? '' : 's'})
                                                </span>
                                              </div>

                                              {/* Expanded Missing Subjects Breakdown */}
                                              {isExpanded && (
                                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex flex-wrap gap-1.5">
                                                  {st.missingSubjects.map((sub) => (
                                                    <span
                                                      key={sub.subjectId}
                                                      className="text-[10px] font-bold bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 px-2 py-1 rounded-lg"
                                                    >
                                                      {sub.subjectCode || sub.subjectName}: {sub.missingCount} missing
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Action Area with 44px Minimum Touch Height */}
                                      <div className="pt-2.5 border-t border-[#D9E0E7]/60 dark:border-slate-800 flex items-center justify-between gap-2">
                                        {st.isApproved ? (
                                          <div className="w-full flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                              <Lock className="w-3.5 h-3.5" />
                                              <span>Locked against edits</span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setStreamToReopen(st.streamObj)}
                                              className="text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center space-x-1.5 min-h-[44px] shrink-0 shadow-2xs"
                                              title="Re-open stream to allow mark editing"
                                            >
                                              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                              <span>Re-open</span>
                                            </button>
                                          </div>
                                        ) : st.isReady ? (
                                          <div className="w-full flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                              ✓ 100% Ready
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setStreamToApprove(st.streamObj)}
                                              className="text-xs font-black bg-[#075E42] hover:bg-[#087F5B] text-white px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-2 min-h-[44px] shrink-0"
                                              title="Approve & Lock stream"
                                            >
                                              <Lock className="w-3.5 h-3.5" />
                                              <span>Approve &amp; Lock</span>
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="w-full flex items-center justify-between gap-2">
                                            <button
                                              type="button"
                                              onClick={() => toggleStreamIssues(streamUniqueId)}
                                              className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center space-x-1 min-h-[44px]"
                                            >
                                              <Info className="w-3.5 h-3.5 text-amber-600" />
                                              <span>{isExpanded ? 'Hide Issues' : 'View Issues'}</span>
                                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => setStreamToApprove(st.streamObj)}
                                              className="text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 px-3 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-1 min-h-[44px]"
                                              title="Approve incomplete stream (requires confirmation)"
                                            >
                                              <Lock className="w-3 h-3 text-amber-700" />
                                              <span>Approve Incomplete</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {/* 1. Assessment Analyser Header & Control Center */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                  <h1 className="text-base sm:text-lg font-black text-[#1F2937] dark:text-slate-100 uppercase tracking-tight">
                    Assessment Analyser
                  </h1>
                </div>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  {activeExam ? `${activeExam.term} • ${activeExam.year}` : `${activeTermObj?.term_name || 'Term 2'} • ${activeYearObj?.year || 2026}`} &bull; Decision-support &amp; diagnostic quality control
                </p>
              </div>

              {/* Stage Workflow & Transition to Results Approval */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0">
                  <span className="text-[#075E42] dark:text-emerald-400 font-black">1. Analyse</span>
                  <span>&rarr;</span>
                  <span className="text-slate-400 dark:text-slate-500">2. Validate</span>
                  <span>&rarr;</span>
                  <span className="text-slate-400 dark:text-slate-500">3. Approve</span>
                  <span>&rarr;</span>
                  <span className="text-slate-400 dark:text-slate-500">4. Release</span>
                </div>

                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToTab) {
                        onNavigateToTab('results-approval');
                      } else {
                        setAdminViewMode('stream-approvals');
                      }
                    }}
                    className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5 min-h-[36px]"
                    title="Switch to Results Approval & Release"
                  >
                    <span>Results Approval</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Assessment Selector & Recalculate Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-8 space-y-1">
                <label htmlFor="analyser-target-exam" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                  <span>Select Assessment:</span>
                </label>
                <select
                  id="analyser-target-exam"
                  value={selectedExamId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedExamId(newId);
                    const ex = exams.find((x) => x.id === newId);
                    if (ex) {
                      if (ex.year) setSelectedYear(Number(ex.year));
                      if (ex.term) setSelectedTerm(ex.term);
                      if (ex.education_level) setSelectedLevel(ex.education_level as EducationLevel);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 cursor-pointer shadow-2xs min-h-[44px]"
                >
                  <option value="">Select Assessment...</option>
                  {groupExamsForDropdown(exams, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                    <optgroup key={`analyser_grp_${gIdx}`} label={grp.label}>
                      {grp.exams.map(({ exam: ex, label: optLabel }) => (
                        <option key={ex.id} value={ex.id}>
                          {optLabel}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isRefreshingAnalysis}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl font-black text-xs text-white bg-[#075E42] hover:bg-[#087F5B] disabled:opacity-60 transition cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAnalysis ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingAnalysis ? 'Recalculating...' : 'Recalculate Analysis'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Assessment Analysis Summary Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#075E42] dark:text-emerald-400 shrink-0" />
                <h2 className="text-xs font-bold text-[#1F2937] dark:text-slate-200 uppercase tracking-wider">
                  Analysis Overview
                </h2>
              </div>
              <span className="text-[11px] font-bold text-[#667085] dark:text-slate-400">
                {streamApprovalStats.totalStreamsCount > 0
                  ? `${Math.round(((streamApprovalStats.totalStreamsCount - streamApprovalStats.incompleteStreamsCount) / streamApprovalStats.totalStreamsCount) * 100)}% Complete`
                  : '0% Complete'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Total Streams
                </span>
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                  {streamApprovalStats.totalStreamsCount} Streams
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Analysed
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {streamApprovalStats.totalStreamsCount - streamApprovalStats.incompleteStreamsCount} Analysed
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Normal
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {streamApprovalStats.approvedStreamsCount + streamApprovalStats.readyStreamsCount} Normal
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Need Attention
                </span>
                <span className={`text-base sm:text-lg font-black font-mono ${streamApprovalStats.incompleteStreamsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  {streamApprovalStats.incompleteStreamsCount} Need Attention
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    streamApprovalStats.incompleteStreamsCount === 0 && streamApprovalStats.totalStreamsCount > 0
                      ? 'bg-[#075E42] dark:bg-emerald-500'
                      : 'bg-emerald-600 dark:bg-emerald-500'
                  }`}
                  style={{
                    width: `${streamApprovalStats.totalStreamsCount > 0
                      ? Math.round(((streamApprovalStats.totalStreamsCount - streamApprovalStats.incompleteStreamsCount) / streamApprovalStats.totalStreamsCount) * 100)
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3. Education-Level Filter Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Filter by Education Level:
              </span>
              {streamFilterLevel !== 'All' && (
                <button
                  type="button"
                  onClick={() => setStreamFilterLevel('All')}
                  className="text-[11px] font-bold text-[#075E42] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Reset to All Levels
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(['All', ...ALL_EDUCATION_LEVELS] as const).map((lvl) => {
                const isSelected = streamFilterLevel === lvl;
                const count = lvl === 'All'
                  ? streamApprovalStats.totalStreamsCount
                  : streamApprovalStats.levelGroups[lvl]?.totalStreams || 0;
                const incomplete = lvl === 'All'
                  ? streamApprovalStats.incompleteStreamsCount
                  : streamApprovalStats.levelGroups[lvl]?.incompleteCount || 0;

                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setStreamFilterLevel(lvl)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                      isSelected
                        ? 'bg-[#075E42] text-white border-[#075E42] shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{lvl === 'All' ? 'ALL LEVELS' : lvl.toUpperCase()}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : incomplete > 0
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 & 5. Level Summary & Stream Presentation */}
          <div ref={streamListSectionRef} id="assessment-analyser-streams-list" className="space-y-4 scroll-mt-20">
            {ALL_EDUCATION_LEVELS
              .filter((lvl) => streamFilterLevel === 'All' || streamFilterLevel === lvl)
              .map((lvl) => {
                const lvlData = streamApprovalStats.levelGroups[lvl];
                if (!lvlData || lvlData.totalStreams === 0) return null;

                const sortedGradeKeys = sortGrades(Object.keys(lvlData.grades));

                return (
                  <div
                    key={lvl}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-4"
                  >
                    {/* Level Header Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                          {lvl}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {lvlData.totalStreams} Streams &bull; {lvlData.readyCount + lvlData.approvedCount} Normal &bull; {lvlData.incompleteCount} Need Attention
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          lvlData.incompleteCount === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {lvlData.incompleteCount === 0 ? '✓ All Streams Normal' : `${lvlData.incompleteCount} Stream${lvlData.incompleteCount === 1 ? '' : 's'} Require Attention`}
                        </span>
                      </div>
                    </div>

                    {/* Grades in this Level */}
                    <div className="space-y-4">
                      {sortedGradeKeys.map((gradeName) => {
                        const gradeData = lvlData.grades[gradeName];
                        if (!gradeData || gradeData.streams.length === 0) return null;

                        return (
                          <div key={gradeName} className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                {gradeName} ({gradeData.streams.length} Stream{gradeData.streams.length === 1 ? '' : 's'})
                              </h4>
                            </div>

                            {/* Stream Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {gradeData.streams.map((st) => {
                                const isStreamMatch =
                                  (Boolean(st.streamObj.stream_id) && selectedStreamId === st.streamObj.stream_id) ||
                                  (Boolean(st.streamName) && selectedStreamId.trim().toLowerCase() === st.streamName.trim().toLowerCase()) ||
                                  (!st.streamObj.stream_id && selectedStreamId === st.streamId);

                                const isInspected =
                                  Boolean(selectedStreamId) &&
                                  selectedStreamId !== 'all' &&
                                  selectedStreamId !== 'All Streams' &&
                                  selectedLevel === lvl &&
                                  selectedClassId === st.className &&
                                  isStreamMatch;
                                const isNormal = st.isReady || st.isApproved;

                                return (
                                  <div
                                    key={st.streamId}
                                    className={`p-3.5 rounded-xl border transition-all duration-300 space-y-2.5 ${
                                      isInspected
                                        ? 'bg-[#E8F5EF]/80 dark:bg-emerald-950/40 border-[#075E42] dark:border-emerald-600 ring-2 ring-[#075E42]/20 shadow-xs'
                                        : isNormal
                                        ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">
                                          {gradeName} • {st.streamName || 'Stream'}
                                        </h5>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                          {st.totalLearners} Learners &bull; {st.teacherName || 'No Class Teacher'}
                                        </p>
                                      </div>

                                      {/* Status Badge */}
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                                        isNormal
                                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                      }`}>
                                        {isNormal ? '🟢 Normal' : '⚠ Attention Required'}
                                      </span>
                                    </div>

                                    {/* Stream Metrics Summary */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                      {isNormal ? (
                                        <>
                                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Analysis Complete</span>
                                          </span>
                                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Marks Complete</span>
                                          </span>
                                          <span className="text-slate-600 dark:text-slate-300 font-bold font-mono">
                                            {st.percentage}% Analysis
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-amber-700 dark:text-amber-400 font-bold">
                                            {st.percentage}% Complete
                                          </span>
                                          <span className="text-slate-600 dark:text-slate-400">
                                            {st.missingSubjects.length > 0
                                              ? `${st.missingSubjects.length} Learning Area${st.missingSubjects.length === 1 ? '' : 's'} Require Review`
                                              : `${st.missingMarks} missing mark${st.missingMarks === 1 ? '' : 's'}`}
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    {/* Action Button */}
                                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleInspectStream(lvl, st.className, st.streamObj)}
                                        className={`w-full text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 ${
                                          isInspected
                                            ? 'bg-[#075E42] hover:bg-[#064E37] text-white shadow-xs ring-2 ring-[#075E42]/30'
                                            : isNormal
                                            ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                                            : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                        }`}
                                      >
                                        <Search className="w-3.5 h-3.5" />
                                        <span>{isInspected ? 'VIEWING DIAGNOSTICS' : isNormal ? 'VIEW ANALYSIS' : 'VIEW DIAGNOSTICS'}</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* 6. Progressive Disclosure: Detailed Diagnostics Layer */}
          <div
            ref={diagnosticsSectionRef}
            id="detailed-diagnostics-section"
            className={`space-y-4 pt-2 scroll-mt-20 transition-all duration-500 rounded-2xl ${
              highlightDiagnostics
                ? 'ring-4 ring-[#075E42]/40 dark:ring-emerald-400/40 p-1 sm:p-2 bg-emerald-50/20 dark:bg-emerald-950/20'
                : ''
            }`}
          >
            {/* Cohort Selector Header & Active Inspection Status */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border transition-all duration-300 ${
                highlightDiagnostics
                  ? 'border-[#075E42] dark:border-emerald-500 ring-2 ring-[#075E42]/20'
                  : 'border-[#D9E0E7] dark:border-slate-800'
              } space-y-3`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sliders className="w-4 h-4 text-[#075E42] dark:text-emerald-400 shrink-0" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Detailed Diagnostics Layer
                    </h3>
                    {highlightDiagnostics && (
                      <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#075E42] text-white">
                        Focused Stream Diagnostics
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {selectedLevel && selectedClassId
                      ? `Active Scope: ${selectedLevel} • ${selectedClassId} ${
                          selectedStreamId && selectedStreamId !== 'all'
                            ? `(${availableStreams.find((s) => s.stream_id === selectedStreamId || s.stream === selectedStreamId || s.id === selectedStreamId)?.stream || classes.find((c) => c.stream_id === selectedStreamId || c.stream === selectedStreamId || c.id === selectedStreamId)?.stream || selectedStreamId})`
                            : '(All Streams)'
                        }`
                      : 'Select a stream above or configure cohort filters below to inspect deeper metrics'}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {/* Quick return button to jump back up to stream list */}
                  <button
                    type="button"
                    onClick={handleScrollToStreamList}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#075E42] dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 transition cursor-pointer min-h-[36px]"
                    title="Return up to Stream Overview List"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Back to Stream List</span>
                  </button>

                  {selectedClassId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClassId('');
                        setSelectedStreamId('');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer min-h-[36px]"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Cohort Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Education Level
                  </label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => {
                      const lvl = e.target.value as EducationLevel;
                      setSelectedLevel(lvl);
                      setSelectedClassId('');
                      setSelectedStreamId('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] min-h-[44px] cursor-pointer"
                  >
                    <option value="">Select Level...</option>
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Class
                  </label>
                  <select
                    value={selectedLevel ? selectedClassId : ''}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedStreamId('');
                    }}
                    disabled={!selectedLevel}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] min-h-[44px] cursor-pointer disabled:opacity-50"
                  >
                    {!selectedLevel ? (
                      <option value="">Select Level First...</option>
                    ) : (
                      <>
                        <option value="">Select Class...</option>
                        {uniqueClasses.map((className, idx) => (
                          <option key={`${className}_${idx}`} value={className}>
                            {className}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stream
                  </label>
                  <select
                    value={(selectedLevel && selectedClassId) ? selectedStreamId : ''}
                    onChange={(e) => setSelectedStreamId(e.target.value)}
                    disabled={!selectedLevel || !selectedClassId}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] min-h-[44px] cursor-pointer disabled:opacity-50"
                  >
                    {(!selectedLevel || !selectedClassId) ? (
                      <option value="">Select Class First...</option>
                    ) : (
                      <>
                        <option value="">All Streams</option>
                        {availableStreams.map((c, idx) => {
                          const sVal = c.stream_id || c.stream || c.id;
                          return (
                            <option key={`${c.stream_id || c.id}_${c.stream}_${idx}`} value={sVal}>
                              {c.stream}
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Render Deep Diagnostics when Cohort is active */}
            {isSelectionComplete && activeExam ? (
              isLoadingMarks ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <LoadingIndicator minHeight="min-h-[250px]" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Empty Cohort Alert */}
                  {selectedStudents.length === 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl p-5 shadow-xs flex items-start space-x-3.5">
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                          No Active Learners Found
                        </h3>
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                          No active learners found for the selected cohort. Cannot run detailed diagnostics.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 1. Quality-Control Diagnostic Engine & Live Health Gate */}
                  <AssessmentValidationHealthCard
                    activeExam={activeExam}
                    validationResults={validationResults}
                    overallProgressStats={overallProgressStats}
                    isRefreshingAnalysis={isRefreshingAnalysis}
                    lastRefreshedAt={lastRefreshedAt}
                    onRecalculate={handleStartAnalysis}
                    onNavigateToTab={onNavigateToTab}
                    currentUser={currentUser}
                  />

                  {/* 2. Assessment Statistics & Grade Distribution */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-[#D9E0E7] dark:border-slate-800 space-y-4">
                    <div className="flex items-center space-x-2 text-[#1F2937] dark:text-slate-100 font-bold border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                      <Award className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
                      <h2 className="text-sm font-bold uppercase tracking-wider">Assessment Statistics &amp; Grade Distribution</h2>
                    </div>

                    <AssessmentPerformanceKpiCards
                      examStatistics={examStatistics}
                      comparisonData={comparisonData}
                    />

                    <AssessmentCbeDistributionBar
                      levelCounts={examStatistics.levelCounts}
                      totalLearners={selectedStudents.length}
                      completeLearnersCount={examStatistics.completeLearnersCount}
                    />
                  </div>

                  {/* 3. Learning Area Diagnostic Metrics Table */}
                  <LearningAreaDiagnosticsTable
                    subjectProgressList={subjectProgressList}
                    activeExam={activeExam}
                    selectedStudents={selectedStudents}
                    markMap={markMap}
                    grades={grades}
                    teachers={teachers}
                    selectedClassId={selectedClassId}
                    classes={classes}
                    onNavigateToMarksEntry={onNavigateToTab ? () => onNavigateToTab('marks-entry') : undefined}
                  />

                  {/* 4. Remedial & Academic Support Intervention Watchlist */}
                  <RemedialInterventionWatchlist
                    selectedStudents={selectedStudents}
                    learnerSubjects={learnerSubjects}
                    activeExam={activeExam}
                    markMap={markMap}
                    grades={grades}
                    classes={classes}
                    onNavigateToTab={onNavigateToTab}
                  />
                </div>
              )
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Select a stream card from the list above to view deep diagnostic breakdowns and learning area metrics.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPROVE & LOCK CONFIRMATION MODAL */}
      {showApproveModal && activeExam && (() => {
        const targetLevelReadiness = selectedLevel ? streamApprovalStats.levelGroups[selectedLevel] : null;
        const incompleteStreamsInScope = targetLevelReadiness
          ? targetLevelReadiness.incompleteStreams
          : streamApprovalStats.allIncompleteStreams;

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-3 text-[#075E42] dark:text-emerald-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-[#E8F5EF] dark:bg-emerald-950/80 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                    {selectedLevel ? `Approve & Lock ${selectedLevel}?` : 'Approve and Lock Assessment?'}
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">
                    {selectedLevel ? `Official Administrative Sign-Off for ${selectedLevel}` : 'Official Administrative Sign-Off for All Levels'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
                <p className="leading-relaxed text-[#667085] dark:text-slate-400">
                  {selectedLevel
                    ? `This will officially approve and lock results specifically for ${selectedLevel}. Teachers will no longer be able to modify marks for ${selectedLevel}, while other education levels remain editable.`
                    : 'This will officially approve the assessment and lock its results across all levels. Marks and analysis data can no longer be edited until reopened by an administrator.'}
                </p>

                {incompleteStreamsInScope.length > 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-extrabold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Warning: {selectedLevel || 'Assessment'} is not fully ready for approval</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      {incompleteStreamsInScope.length} stream{incompleteStreamsInScope.length === 1 ? '' : 's'} still {incompleteStreamsInScope.length === 1 ? 'has' : 'have'} incomplete marks:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300 font-medium max-h-28 overflow-y-auto">
                      {incompleteStreamsInScope.map((st) => (
                        <li key={st.streamId}>
                          <span className="font-bold text-amber-950 dark:text-amber-100">{st.className} {st.streamName}</span> — {st.missingMarks} mark{st.missingMarks === 1 ? '' : 's'} missing {st.missingSubjects.length > 0 ? `(${st.missingSubjects.map(s => `${s.subjectName}: ${s.missingCount}`).join(', ')})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/80 rounded-xl p-3 flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>All streams in {selectedLevel || 'assessment'} are 100% complete and ready for approval.</span>
                  </div>
                )}

                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Assessment:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{getDisplayExamName(activeExam.exam_name)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Target Level:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{selectedLevel || 'All Education Levels (Global)'}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Cohort / Candidates:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{selectedStudents.length} Learners</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Readiness Status:</span>
                    <span className={`font-extrabold ${incompleteStreamsInScope.length === 0 ? 'text-[#075E42] dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {incompleteStreamsInScope.length === 0 ? '✓ Ready (0 Incomplete Streams)' : `⚠ ${incompleteStreamsInScope.length} Stream(s) Incomplete`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={selectedLevel ? handleConfirmLevelApproval : handleConfirmApproval}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer ${
                    incompleteStreamsInScope.length > 0
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#075E42] hover:bg-[#087F5B]'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{selectedLevel ? `Lock ${selectedLevel} Results` : 'Approve & Lock All Levels'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RE-OPEN CONFIRMATION MODAL */}
      {showReopenModal && activeExam && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                  {selectedLevel ? `Re-open ${selectedLevel} for Editing?` : 'Re-open Assessment for Editing?'}
                </h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Revert Lock Status</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
              <p className="leading-relaxed text-[#667085] dark:text-slate-400 font-semibold">
                {selectedLevel
                  ? `Reopening ${selectedLevel} will allow authorised teachers to modify marks for ${selectedLevel} classes again. Continue?`
                  : 'Reopening this approved assessment will allow authorised users to modify marks again across all classes. Continue?'}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={selectedLevel && activeExam.status !== 'Approved' ? handleConfirmLevelReopen : handleConfirmReopen}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{selectedLevel ? `Re-open ${selectedLevel}` : 'Re-open Assessment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STREAM APPROVE & LOCK CONFIRMATION MODAL */}
      {streamToApprove && activeExam && (() => {
        const streamId = streamToApprove.stream_id || streamToApprove.id;
        let streamReadiness: StreamReadinessDetail | null = null;
        for (const lvl of (Object.values(streamApprovalStats.levelGroups) as LevelReadinessDetail[])) {
          const found = lvl.allStreams.find((s) => s.streamId === streamId);
          if (found) {
            streamReadiness = found;
            break;
          }
        }

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-3 text-[#075E42] dark:text-emerald-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-[#E8F5EF] dark:bg-emerald-950/80 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                    Approve {streamToApprove.class_name} {streamToApprove.stream}?
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Class-Stream Official Sign-Off</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
                <p className="leading-relaxed text-[#667085] dark:text-slate-400">
                  Approving this stream will lock marks entry specifically for{' '}
                  <span className="font-bold text-[#1F2937] dark:text-slate-200">
                    {streamToApprove.class_name} {streamToApprove.stream}
                  </span>
                  . Official stream report cards and merit lists will become authorized, while other streams remain independently editable.
                </p>

                {streamReadiness && !streamReadiness.isReady ? (
                  <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-extrabold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Stream has incomplete marks ({streamReadiness.missingMarks} missing entries)</span>
                    </div>
                    {streamReadiness.missingSubjects.length > 0 && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        Missing in: {streamReadiness.missingSubjects.map((s) => `${s.subjectName} (${s.missingCount} learners)`).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/80 rounded-xl p-2.5 flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Marks entry for this stream is 100% complete.</span>
                  </div>
                )}

                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Assessment:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{getDisplayExamName(activeExam.exam_name)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Target Stream:</span>
                    <span className="font-bold text-[#075E42] dark:text-emerald-400">
                      {streamToApprove.class_name} {streamToApprove.stream}
                    </span>
                  </div>
                  {streamReadiness && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-[#667085] dark:text-slate-400">Marks Progress:</span>
                      <span className="font-bold text-[#1F2937] dark:text-slate-200">
                        {streamReadiness.enteredMarks} / {streamReadiness.expectedMarks} ({streamReadiness.percentage}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setStreamToApprove(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmStreamApproval(streamToApprove)}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer ${
                    streamReadiness && !streamReadiness.isReady
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#075E42] hover:bg-[#087F5B]'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Approve & Lock Stream</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STREAM RE-OPEN CONFIRMATION MODAL */}
      {streamToReopen && activeExam && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                  Re-open {streamToReopen.class_name} {streamToReopen.stream}?
                </h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Revert Stream Lock Status</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
              <p className="leading-relaxed text-[#667085] dark:text-slate-400 font-semibold">
                Reopening this class stream will allow authorised subject teachers and the class teacher to modify marks for{' '}
                <span className="font-bold text-[#1F2937] dark:text-slate-200">
                  {streamToReopen.class_name} {streamToReopen.stream}
                </span>{' '}
                again. Continue?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setStreamToReopen(null)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmStreamReopen(streamToReopen)}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-open Stream</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
