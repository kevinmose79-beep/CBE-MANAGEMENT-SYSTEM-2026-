import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  Search,
  BookMarked,
  Users,
  Building2,
  ShieldCheck,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  AlertTriangle,
  Info,
  Layers,
  FileSpreadsheet,
  GraduationCap,
} from 'lucide-react';
import {
  Examination,
  ClassStream,
  Subject,
  Student,
  Mark,
  Grade,
  User,
  Teacher,
  Role,
  EducationLevel,
  ALL_EDUCATION_LEVELS,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  sortClasses,
  sortGrades,
  sortSubjectsByStandardOrder,
  getStudentFullName,
} from '../types';
import { evaluateMark } from '../utils/markUtils';
import { isClassInExamScope, isLearnerInExamScope, resolveAuthoritativeClass } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { groupExamsForDropdown } from '../utils/examDisplayUtils';
import { getAccessibleClasses, getAccessibleSubjects, getAccessibleStudents, getActiveTeacher } from '../utils/rbacUtils';
import { api } from '../lib/storage';
import { useAcademicSession } from '../contexts/AcademicSessionContext';

interface MarksMonitoringViewProps {
  exams: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  students: Student[];
  marks: Mark[];
  grades: Grade[];
  currentUser?: User;
  teachers?: Teacher[];
  onNavigateToTab?: (tab: any) => void;
  onMarksUpdated?: () => void;
}

type ViewBreakdownMode = 'classes' | 'subjects' | 'learners';

export const MarksMonitoringView: React.FC<MarksMonitoringViewProps> = ({
  exams = [],
  classes = [],
  subjects = [],
  students = [],
  marks = [],
  grades = [],
  currentUser,
  teachers = [],
  onNavigateToTab,
  onMarksUpdated,
}) => {
  // Access Control & Teacher Scoping
  const isAdmin = currentUser?.role === 'admin';
  const activeTeacher = useMemo(() => getActiveTeacher(currentUser || null, teachers), [currentUser, teachers]);
  const accessibleClasses = useMemo(() => getAccessibleClasses(currentUser || null, activeTeacher, classes), [currentUser, activeTeacher, classes]);
  const accessibleSubjects = useMemo(() => getAccessibleSubjects(currentUser || null, activeTeacher, subjects), [currentUser, activeTeacher, subjects]);
  const accessibleStudents = useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);

  // Term Session Context
  const { viewingYear: activeYearObj, viewingTerm: activeTermObj } = useAcademicSession();

  // 1. Examination Selection State
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId]
  );

  // Auto-detect and select the exam for the current active/viewing term session
  useEffect(() => {
    if (!exams || exams.length === 0) return;
    if (!selectedExamId || !exams.some((e) => e.id === selectedExamId)) {
      const match = exams.find(
        (ex) =>
          ex.year === activeYearObj?.year &&
          ex.term === activeTermObj?.term_name &&
          ex.status !== 'Archived'
      ) || exams.find((ex) => ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name) || exams[0];
      if (match) {
        setSelectedExamId(match.id);
      }
    }
  }, [exams, activeYearObj?.year, activeTermObj?.term_name]);

  // 2. View Mode & Selection Drill-Down State
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<ViewBreakdownMode>('classes');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEducationLevel, setSelectedEducationLevel] = useState<EducationLevel | ''>('');

  const [selectedSectionTab, setSelectedSectionTab] = useState<EducationLevel>('Junior School');

  // Targeted Marks Fetching & Cache Synchronization
  const [localMarks, setLocalMarks] = useState<Mark[] | null>(null);
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const lastFetchedExamIdRef = useRef<string | null>(null);

  // Effective marks uses localMarks if fetched, falling back to props.marks
  const effectiveMarks = localMarks ?? marks;

  // Assessment-Scoped Fresh Data Synchronization Effect
  useEffect(() => {
    if (!selectedExamId) {
      setIsLoadingMarks(false);
      setFetchError(null);
      return;
    }

    // Prevent duplicate fetches on harmless re-renders if exam hasn't changed and no error occurred
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
        console.error('Error fetching assessment marks for monitoring:', err);
        if (isMounted) {
          setFetchError('Failed to synchronize latest marks from server. Showing cached marks.');
          setIsLoadingMarks(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, onMarksUpdated]);

  // Cascade Reset Handlers
  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    setSelectedClassId('');
    setSelectedStreamId('');
    setSelectedSubjectId('');
    setStatusFilter('all');
    setSearchQuery('');
    setFetchError(null);
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStreamId('');
    setSelectedSubjectId('');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleStreamChange = (streamId: string) => {
    setSelectedStreamId(streamId);
    setSelectedSubjectId('');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleResetFilters = () => {
    setSelectedClassId('');
    setSelectedStreamId('');
    setSelectedSubjectId('');
    setStatusFilter('all');
    setShowOnlyIncomplete(false);
    setSearchQuery('');
  };

  // 3. Memoized $O(1)$ Mark Lookup Map
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

  // Authoritative in-scope classes according to Phase 3A assessment scope rules
  const inScopeClasses = useMemo(() => {
    if (!selectedExam) return [];
    return accessibleClasses.filter((c) => isClassInExamScope(c, selectedExam));
  }, [accessibleClasses, selectedExam]);

  // Target class helper for single-class scoped examinations
  const targetClass = useMemo(() => {
    if (!selectedExam?.class_id || selectedExam.class_id === 'all') return null;
    return (
      inScopeClasses.find((c) => c.id === selectedExam.class_id) ||
      accessibleClasses.find((c) => c.id === selectedExam.class_id) ||
      classes.find((c) => c.id === selectedExam.class_id) ||
      null
    );
  }, [selectedExam, inScopeClasses, accessibleClasses, classes]);

  const isTargetClassExam = Boolean(
    targetClass || (selectedExam?.class_id && selectedExam.class_id !== 'all')
  );
  const targetClassName = targetClass?.class_name || 'Target Class';

  // 4. Resolve Historical Class & Stream Context for each student for selected exam
  const resolvedLearnersWithContext = useMemo(() => {
    if (!selectedExam) return [];

    return accessibleStudents.map((student) => {
      const examContext = getLearnerClassAtExamTime(student, selectedExam, accessibleClasses);
      return {
        student,
        examContext,
      };
    });
  }, [accessibleStudents, selectedExam, accessibleClasses]);

  // 5. Eligible Learners Filtered by Phase 3A Authoritative Exam Scope
  const examEligibleLearners = useMemo(() => {
    if (!selectedExam) return [];

    return resolvedLearnersWithContext.filter(({ examContext }) => {
      return isLearnerInExamScope(examContext, selectedExam, accessibleClasses);
    });
  }, [resolvedLearnersWithContext, selectedExam, accessibleClasses]);

  // Unique Classes and Streams in System for Filter Dropdowns (Scoped to Selected Exam)
  const uniqueGradeNames = useMemo(() => {
    if (!selectedExam) return [];
    const gradesSet = new Set<string>();

    inScopeClasses.forEach((c) => {
      if (c.class_name) {
        gradesSet.add(c.class_name);
      }
    });

    return sortGrades(Array.from(gradesSet));
  }, [selectedExam, inScopeClasses]);

  // Authoritative class resolution for selectedClassId (UUID or display name)
  const resolvedClass = useMemo(() => {
    return resolveAuthoritativeClass(selectedClassId, inScopeClasses);
  }, [selectedClassId, inScopeClasses]);

  const availableStreams = useMemo(() => {
    if (!selectedExam) return [];
    if (resolvedClass.status === 'empty' || resolvedClass.status === 'all') {
      return inScopeClasses;
    }
    if (resolvedClass.status === 'resolved' && resolvedClass.classId) {
      return inScopeClasses.filter((c) => c.id === resolvedClass.classId);
    }
    // Fail closed on ambiguous or not_found
    return [];
  }, [selectedExam, inScopeClasses, resolvedClass]);

  // Entity Selection Integrity: Invalidate class selection when out-of-scope or ambiguous
  useEffect(() => {
    if (!selectedExam) {
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
  }, [selectedExam, inScopeClasses, selectedClassId]);

  // Entity Selection Integrity: Invalidate stream selection when out-of-scope for selected class/exam
  useEffect(() => {
    if (!selectedStreamId || selectedStreamId === 'all') return;
    const isStreamValid = availableStreams.some(
      (c) => c.stream_id === selectedStreamId || c.id === selectedStreamId
    );
    if (!isStreamValid) {
      setSelectedStreamId('');
    }
  }, [availableStreams, selectedStreamId]);

  // Auto-sync active education section when class filter is selected or exam scope specifies level
  useEffect(() => {
    if (resolvedClass.status === 'resolved' && resolvedClass.classId) {
      const matchingClassObj = classes.find((c) => c.id === resolvedClass.classId);
      const gradeName = matchingClassObj?.class_name || resolvedClass.className;
      if (gradeName) {
        const level = getEducationLevelForGrade(gradeName);
        setSelectedEducationLevel(level);
        setSelectedSectionTab(level);
      }
    } else if (selectedExam?.class_id && selectedExam.class_id !== 'all') {
      const cls =
        inScopeClasses.find((c) => c.id === selectedExam.class_id) ||
        classes.find((c) => c.id === selectedExam.class_id);
      if (cls) {
        const level = cls.education_level || getEducationLevelForGrade(cls.class_name);
        setSelectedEducationLevel(level);
        setSelectedSectionTab(level);
      }
    } else if (selectedExam?.education_level) {
      setSelectedEducationLevel(selectedExam.education_level);
      setSelectedSectionTab(selectedExam.education_level);
    }
  }, [resolvedClass, selectedExam, classes, inScopeClasses]);

  const applicableSubjects = useMemo(() => {
    if (!selectedExam) return [];

    // Active education level constraint
    const activeLevel =
      (resolvedClass.status === 'resolved' && resolvedClass.classId
        ? classes.find((c) => c.id === resolvedClass.classId)?.education_level ||
          (resolvedClass.className ? getEducationLevelForGrade(resolvedClass.className) : null)
        : null) ||
      selectedEducationLevel ||
      selectedSectionTab ||
      (selectedExam.education_level && selectedExam.education_level !== 'All Levels' ? selectedExam.education_level : null);

    // Case 1: Specific Class is selected
    if (resolvedClass.status === 'resolved' && resolvedClass.classId) {
      const matchingStreams = accessibleClasses.filter((c) => {
        if (c.id !== resolvedClass.classId && c.class_name !== resolvedClass.className) return false;
        if (selectedStreamId && selectedStreamId !== 'all') {
          return (
            c.stream_id === selectedStreamId ||
            c.id === selectedStreamId ||
            c.stream === selectedStreamId
          );
        }
        return true;
      });

      if (matchingStreams.length > 0) {
        const subjectMap = new Map<string, Subject>();
        matchingStreams.forEach((clsObj) => {
          const subs = getAllocatedSubjectsForClass(clsObj, accessibleSubjects);
          subs.forEach((s) => subjectMap.set(s.id, s));
        });
        return sortSubjectsByStandardOrder(Array.from(subjectMap.values()));
      } else {
        const subs = getApplicableSubjectsForGrade(resolvedClass.className || '', accessibleSubjects);
        return sortSubjectsByStandardOrder(subs);
      }
    }

    // Case 2: All Classes or No Class selected ('all' or 'empty')
    // Collect subjects from in-scope classes that match the active education level
    const relevantInScopeClasses = inScopeClasses.filter((c) => {
      if (!activeLevel) return true;
      const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : null);
      return cLevel === activeLevel;
    });

    if (relevantInScopeClasses.length > 0) {
      const subjectMap = new Map<string, Subject>();
      relevantInScopeClasses.forEach((clsObj) => {
        const subs = getAllocatedSubjectsForClass(clsObj, accessibleSubjects);
        subs.forEach((s) => subjectMap.set(s.id, s));
      });
      const collected = Array.from(subjectMap.values());
      if (collected.length > 0) {
        return sortSubjectsByStandardOrder(collected);
      }
    }

    // Fallback: If no class streams found, filter accessibleSubjects by activeLevel
    if (activeLevel) {
      const levelGrades = LEVEL_TO_GRADES[activeLevel as EducationLevel] || [];
      const subjectMap = new Map<string, Subject>();
      levelGrades.forEach((g) => {
        const subs = getApplicableSubjectsForGrade(g, accessibleSubjects);
        subs.forEach((s) => subjectMap.set(s.id, s));
      });
      if (subjectMap.size > 0) {
        return sortSubjectsByStandardOrder(Array.from(subjectMap.values()));
      }

      // Secondary level fallback
      const levelSubs = accessibleSubjects.filter((s) => {
        if (s.status === 'Archived') return false;
        if (s.education_level === activeLevel) return true;
        if (s.education_level === 'Grade 4–9' && (activeLevel === 'Upper Primary' || activeLevel === 'Junior School')) return true;
        if (s.applicable_grades && s.applicable_grades.some((g) => getEducationLevelForGrade(g) === activeLevel)) return true;
        return false;
      });
      return sortSubjectsByStandardOrder(levelSubs);
    }

    return sortSubjectsByStandardOrder(accessibleSubjects);
  }, [
    selectedExam,
    resolvedClass,
    selectedStreamId,
    accessibleClasses,
    inScopeClasses,
    accessibleSubjects,
    selectedEducationLevel,
    selectedSectionTab,
    classes,
  ]);

  // 6. School Overall & Education Section Metrics Calculation
  const metricsByScope = useMemo(() => {
    const createEmptyMetrics = () => ({
      totalLearners: 0,
      expectedEntries: 0,
      completedEntries: 0,
      missingEntries: 0,
      completionPercentage: 0,
    });

    const sectionMap: Record<
      EducationLevel,
      {
        totalLearners: number;
        expectedEntries: number;
        completedEntries: number;
        missingEntries: number;
        completionPercentage: number;
      }
    > = {
      'Pre-Primary': createEmptyMetrics(),
      'Lower Primary': createEmptyMetrics(),
      'Upper Primary': createEmptyMetrics(),
      'Junior School': createEmptyMetrics(),
    };

    if (!selectedExam || examEligibleLearners.length === 0) {
      return {
        schoolOverall: createEmptyMetrics(),
        sections: sectionMap,
      };
    }

    const learnersPerLevel: Record<EducationLevel, Set<string>> = {
      'Pre-Primary': new Set(),
      'Lower Primary': new Set(),
      'Upper Primary': new Set(),
      'Junior School': new Set(),
    };

    // School-wide computation across ALL eligible learners for the selected target assessment
    examEligibleLearners.forEach(({ student, examContext }) => {
      const matchingClassStream = accessibleClasses.find(
        (c) =>
          (examContext.stream_id && c.stream_id === examContext.stream_id) ||
          c.id === examContext.class_id
      );

      const level = getEducationLevelForGrade(
        matchingClassStream?.class_name || examContext.class_name || examContext.grade
      );

      learnersPerLevel[level].add(student.id);

      const applicableSubjects = matchingClassStream
        ? getAllocatedSubjectsForClass(matchingClassStream, accessibleSubjects)
        : getApplicableSubjectsForGrade(examContext.grade, accessibleSubjects);

      applicableSubjects.forEach((sub) => {
        sectionMap[level].expectedEntries++;

        const markRecord = markMap.get(`${student.id}_${sub.id}_${selectedExam.id}`);
        const evaluated = evaluateMark(markRecord);

        // Completed = Normal (including 0), X (Absent), Y (Irregularity)
        if (
          evaluated.status === 'Normal' ||
          evaluated.status === 'X' ||
          evaluated.status === 'Y'
        ) {
          sectionMap[level].completedEntries++;
        }
      });
    });

    let totalSchoolExpected = 0;
    let totalSchoolCompleted = 0;

    ALL_EDUCATION_LEVELS.forEach((lvl) => {
      const sec = sectionMap[lvl];
      sec.totalLearners = learnersPerLevel[lvl].size;
      sec.missingEntries = Math.max(0, sec.expectedEntries - sec.completedEntries);
      sec.completionPercentage =
        sec.expectedEntries > 0 ? (sec.completedEntries / sec.expectedEntries) * 100 : 0;

      totalSchoolExpected += sec.expectedEntries;
      totalSchoolCompleted += sec.completedEntries;
    });

    const totalSchoolMissing = Math.max(0, totalSchoolExpected - totalSchoolCompleted);
    const totalSchoolPct =
      totalSchoolExpected > 0 ? (totalSchoolCompleted / totalSchoolExpected) * 100 : 0;

    const schoolOverall = {
      totalLearners: examEligibleLearners.length,
      expectedEntries: totalSchoolExpected,
      completedEntries: totalSchoolCompleted,
      missingEntries: totalSchoolMissing,
      completionPercentage: totalSchoolPct,
    };

    return {
      schoolOverall,
      sections: sectionMap,
    };
  }, [
    selectedExam,
    examEligibleLearners,
    accessibleClasses,
    accessibleSubjects,
    markMap,
  ]);

  const schoolSummary = metricsByScope.schoolOverall;
  const selectedSectionMetrics =
    metricsByScope.sections[selectedSectionTab] || metricsByScope.sections['Junior School'];

  const isSelectedSectionInScope = useMemo(() => {
    if (!selectedExam) return true;
    if (isTargetClassExam) {
      return inScopeClasses.some(
        (c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === selectedSectionTab
      );
    }
    if (selectedExam.education_level) {
      return selectedExam.education_level === selectedSectionTab;
    }
    return inScopeClasses.some(
      (c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === selectedSectionTab
    );
  }, [selectedExam, isTargetClassExam, inScopeClasses, selectedSectionTab]);

  // 7. Class/Stream Breakdown Data
  const classStreamBreakdown = useMemo(() => {
    if (!selectedExam) return [];

    // Group eligible learners by stream/class context
    const streamGroups = new Map<
      string,
      {
        class_id: string;
        stream_id: string;
        class_name: string;
        stream_name: string;
        full_name: string;
        learners: Student[];
      }
    >();

    examEligibleLearners.forEach(({ student, examContext }) => {
      const key = examContext.stream_id || examContext.class_id || examContext.class_name;
      if (!streamGroups.has(key)) {
        streamGroups.set(key, {
          class_id: examContext.class_id,
          stream_id: examContext.stream_id,
          class_name: examContext.class_name,
          stream_name: examContext.stream_name,
          full_name: examContext.full_class_name || examContext.class_name,
          learners: [],
        });
      }
      streamGroups.get(key)!.learners.push(student);
    });

    const results: Array<{
      key: string;
      class_id: string;
      stream_id: string;
      class_name: string;
      stream_name: string;
      full_name: string;
      learnerCount: number;
      expected: number;
      completed: number;
      missing: number;
      completionPct: number;
      status: 'COMPLETE' | 'IN PROGRESS' | 'NOT STARTED' | 'NOT APPLICABLE';
    }> = [];

    streamGroups.forEach((group, key) => {
      const matchingClassObj = accessibleClasses.find(
        (c) =>
          (group.stream_id && c.stream_id === group.stream_id) || c.id === group.class_id
      );

      const applicableSubjects = matchingClassObj
        ? getAllocatedSubjectsForClass(matchingClassObj, accessibleSubjects)
        : getApplicableSubjectsForGrade(group.class_name, accessibleSubjects);

      let expected = 0;
      let completed = 0;

      group.learners.forEach((student) => {
        applicableSubjects.forEach((sub) => {
          expected++;
          const markRecord = markMap.get(`${student.id}_${sub.id}_${selectedExam.id}`);
          const evaluated = evaluateMark(markRecord);
          if (
            evaluated.status === 'Normal' ||
            evaluated.status === 'X' ||
            evaluated.status === 'Y'
          ) {
            completed++;
          }
        });
      });

      const missing = Math.max(0, expected - completed);
      const completionPct = expected > 0 ? (completed / expected) * 100 : 0;

      let status: 'COMPLETE' | 'IN PROGRESS' | 'NOT STARTED' | 'NOT APPLICABLE' =
        'NOT APPLICABLE';
      if (expected > 0) {
        if (completed === expected) status = 'COMPLETE';
        else if (completed === 0) status = 'NOT STARTED';
        else status = 'IN PROGRESS';
      }

      results.push({
        key,
        class_id: group.class_id,
        stream_id: group.stream_id,
        class_name: group.class_name,
        stream_name: group.stream_name,
        full_name: group.full_name,
        learnerCount: group.learners.length,
        expected,
        completed,
        missing,
        completionPct,
        status,
      });
    });

    // Sort by Grade and Stream order
    return results.sort((a, b) => {
      const gradeA = a.class_name;
      const gradeB = b.class_name;
      if (gradeA !== gradeB) return gradeA.localeCompare(gradeB);
      return a.stream_name.localeCompare(b.stream_name);
    });
  }, [selectedExam, examEligibleLearners, accessibleClasses, accessibleSubjects, markMap]);

  // Filtered Class/Stream Breakdown based on User Filter selections
  const filteredClassStreamBreakdown = useMemo(() => {
    return classStreamBreakdown.filter((item) => {
      if (resolvedClass.status === 'resolved' && resolvedClass.classId) {
        if (item.class_id !== resolvedClass.classId) return false;
      } else if (resolvedClass.status === 'ambiguous' || resolvedClass.status === 'not_found') {
        return false;
      }

      if (selectedStreamId && selectedStreamId !== 'all') {
        if (item.stream_id !== selectedStreamId && item.class_id !== selectedStreamId) return false;
      }
      if (showOnlyIncomplete && item.status === 'COMPLETE') return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'complete' && item.status !== 'COMPLETE') return false;
        if (statusFilter === 'in_progress' && item.status !== 'IN PROGRESS') return false;
        if (statusFilter === 'not_started' && item.status !== 'NOT STARTED') return false;
        if (statusFilter === 'missing' && item.missing === 0) return false;
      }
      return true;
    });
  }, [classStreamBreakdown, resolvedClass, selectedStreamId, showOnlyIncomplete, statusFilter]);

  // 8. Learning Area Breakdown Data
  const subjectBreakdown = useMemo(() => {
    if (!selectedExam) return [];

    // Filter learners by currently selected Class/Stream filters
    const filteredLearners = examEligibleLearners.filter(({ examContext }) => {
      if (resolvedClass.status === 'resolved' && resolvedClass.classId) {
        if (examContext.class_id !== resolvedClass.classId) return false;
      } else if (resolvedClass.status === 'ambiguous' || resolvedClass.status === 'not_found') {
        return false;
      }

      if (selectedStreamId && selectedStreamId !== 'all') {
        if (examContext.stream_id !== selectedStreamId && examContext.class_id !== selectedStreamId) return false;
      }
      return true;
    });

    // Determine relevant subjects (level-aware & class-aware)
    let relevantSubjects = applicableSubjects;
    if (selectedSubjectId && selectedSubjectId !== 'all') {
      relevantSubjects = accessibleSubjects.filter((s) => s.id === selectedSubjectId);
    }

    const subjectStats = relevantSubjects.map((subject) => {
      let expected = 0;
      let completed = 0;

      filteredLearners.forEach(({ student, examContext }) => {
        const matchingClassObj = accessibleClasses.find(
          (c) =>
            (examContext.stream_id && c.stream_id === examContext.stream_id) ||
            c.id === examContext.class_id
        );

        const learnerApplicableSubjects = matchingClassObj
          ? getAllocatedSubjectsForClass(matchingClassObj, accessibleSubjects)
          : getApplicableSubjectsForGrade(examContext.grade, accessibleSubjects);

        const isApplicable = learnerApplicableSubjects.some((s) => s.id === subject.id);
        if (isApplicable) {
          expected++;
          const markRecord = markMap.get(`${student.id}_${subject.id}_${selectedExam.id}`);
          const evaluated = evaluateMark(markRecord);
          if (
            evaluated.status === 'Normal' ||
            evaluated.status === 'X' ||
            evaluated.status === 'Y'
          ) {
            completed++;
          }
        }
      });

      const missing = Math.max(0, expected - completed);
      const completionPct = expected > 0 ? (completed / expected) * 100 : 0;

      let status: 'COMPLETE' | 'IN PROGRESS' | 'NOT STARTED' | 'NOT APPLICABLE' =
        'NOT APPLICABLE';
      if (expected > 0) {
        if (completed === expected) status = 'COMPLETE';
        else if (completed === 0) status = 'NOT STARTED';
        else status = 'IN PROGRESS';
      }

      return {
        subject,
        expected,
        completed,
        missing,
        completionPct,
        status,
      };
    });

    // Filter out subjects with 0 expected entries unless explicitly selected
    const activeSubjectStats = subjectStats.filter((item) =>
      selectedSubjectId && selectedSubjectId !== 'all' ? true : item.expected > 0
    );

    return sortSubjectsByStandardOrder(activeSubjectStats.map((item) => item.subject)).map(
      (sub) => activeSubjectStats.find((item) => item.subject.id === sub.id)!
    ).filter(Boolean);
  }, [
    selectedExam,
    examEligibleLearners,
    resolvedClass,
    selectedStreamId,
    selectedSubjectId,
    applicableSubjects,
    accessibleClasses,
    accessibleSubjects,
    markMap,
  ]);

  // Filtered Subject Breakdown
  const filteredSubjectBreakdown = useMemo(() => {
    return subjectBreakdown.filter((item) => {
      if (showOnlyIncomplete && item.status === 'COMPLETE') return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'complete' && item.status !== 'COMPLETE') return false;
        if (statusFilter === 'in_progress' && item.status !== 'IN PROGRESS') return false;
        if (statusFilter === 'not_started' && item.status !== 'NOT STARTED') return false;
        if (statusFilter === 'missing' && item.missing === 0) return false;
      }
      return true;
    });
  }, [subjectBreakdown, showOnlyIncomplete, statusFilter]);

  // 9. Detailed Learner Progress Matrix Data
  const learnerDetailedProgress = useMemo(() => {
    if (!selectedExam) return [];

    // Filter learners by class/stream filter and search query
    const filtered = examEligibleLearners.filter(({ student, examContext }) => {
      if (resolvedClass.status === 'resolved' && resolvedClass.classId) {
        if (examContext.class_id !== resolvedClass.classId) return false;
      } else if (resolvedClass.status === 'ambiguous' || resolvedClass.status === 'not_found') {
        return false;
      }

      if (
        selectedStreamId &&
        selectedStreamId !== 'all' &&
        examContext.stream_id !== selectedStreamId &&
        examContext.class_id !== selectedStreamId
      )
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const learnerName = getStudentFullName(student) || student.full_name || '';
        const nameMatch = learnerName.toLowerCase().includes(q);
        const admMatch = (student.admission_number || '').toLowerCase().includes(q);
        if (!nameMatch && !admMatch) return false;
      }

      return true;
    });

    return filtered.map(({ student, examContext }) => {
      const matchingClassObj = accessibleClasses.find(
        (c) =>
          (examContext.stream_id && c.stream_id === examContext.stream_id) ||
          c.id === examContext.class_id
      );

      let applicableSubjects = matchingClassObj
        ? getAllocatedSubjectsForClass(matchingClassObj, accessibleSubjects)
        : getApplicableSubjectsForGrade(examContext.grade, accessibleSubjects);

      if (selectedSubjectId && selectedSubjectId !== 'all') {
        applicableSubjects = applicableSubjects.filter((s) => s.id === selectedSubjectId);
      }

      let completedCount = 0;
      const subjectStatuses: Array<{
        subject: Subject;
        mark?: Mark;
        evaluated: ReturnType<typeof evaluateMark>;
      }> = [];

      applicableSubjects.forEach((sub) => {
        const markRecord = markMap.get(`${student.id}_${sub.id}_${selectedExam.id}`);
        const evaluated = evaluateMark(markRecord);

        if (
          evaluated.status === 'Normal' ||
          evaluated.status === 'X' ||
          evaluated.status === 'Y'
        ) {
          completedCount++;
        }

        subjectStatuses.push({
          subject: sub,
          mark: markRecord,
          evaluated,
        });
      });

      const totalApplicable = applicableSubjects.length;
      const missingCount = Math.max(0, totalApplicable - completedCount);
      const completionPct = totalApplicable > 0 ? (completedCount / totalApplicable) * 100 : 0;

      return {
        student,
        examContext,
        totalApplicable,
        completedCount,
        missingCount,
        completionPct,
        subjectStatuses,
      };
    });
  }, [
    selectedExam,
    examEligibleLearners,
    selectedClassId,
    selectedStreamId,
    selectedSubjectId,
    searchQuery,
    accessibleClasses,
    accessibleSubjects,
    markMap,
  ]);

  // Filtered Detailed Learner Progress
  const filteredLearnerDetailedProgress = useMemo(() => {
    return learnerDetailedProgress.filter((item) => {
      if (showOnlyIncomplete && item.missingCount === 0) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'complete' && item.missingCount > 0) return false;
        if (statusFilter === 'in_progress' && (item.completedCount === 0 || item.missingCount === 0)) return false;
        if (statusFilter === 'not_started' && item.completedCount > 0) return false;
        if (statusFilter === 'missing' && item.missingCount === 0) return false;
      }
      return true;
    });
  }, [learnerDetailedProgress, showOnlyIncomplete, statusFilter]);

  // Handle unauthorized view
  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl max-w-xl mx-auto my-8 space-y-4">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-rose-900 dark:text-rose-100">
          Admin Access Required
        </h2>
        <p className="text-sm text-rose-700 dark:text-rose-300">
          Assessment Marks Entry Monitoring is reserved exclusively for system administrators to oversee school-wide evaluation progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#0F5132]/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#0F5132] text-emerald-100 flex items-center justify-center shrink-0 shadow-md shadow-[#0F5132]/20">
              <BarChart3 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Assessment Marks Monitoring
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#0F5132] dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Read-Only Oversight
                </span>
              </div>
            </div>
          </div>

          {/* Shortcut to Grid View */}
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('marks-entry')}
              className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
              <span>Go to Marks Entry Grid</span>
            </button>
          )}
        </div>
      </div>

      {/* Assessment Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center">
              <BookMarked className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              Select Target Assessment *
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#0F5132] focus:outline-none transition"
            >
              <option value="">
                -- Select Assessment --
              </option>
              {groupExamsForDropdown(exams, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                <optgroup key={`exam_grp_${gIdx}`} label={grp.label} className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  {grp.exams.map(({ exam, label }) => (
                    <option key={exam.id} value={exam.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium">
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {selectedExam && (
            <div className="md:col-span-7 flex flex-wrap items-center justify-start md:justify-end gap-3 text-xs pt-1 md:pt-0">
              {isLoadingMarks && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#0F5132] dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  Updating Marks...
                </span>
              )}
              {fetchError && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                  Offline Cache Mode
                </span>
              )}
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white mr-1">Term:</span>{' '}
                {selectedExam.term} {selectedExam.year}
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white mr-1">Status:</span>{' '}
                <span
                  className={`ml-1 font-bold ${
                    selectedExam.status === 'Approved'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : selectedExam.status === 'Open'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {selectedExam.status}
                </span>
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white mr-1">Out Of:</span>{' '}
                {selectedExam.max_marks || 100} Marks
              </span>
            </div>
          )}
        </div>
      </div>

      {!selectedExamId || !selectedExam ? (
        /* Empty State when no assessment is selected */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-[#0F5132] dark:text-emerald-400 flex items-center justify-center mx-auto">
            <BookMarked className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Select an assessment to view marks-entry progress.
          </h3>
        </div>
      ) : (
        <>
          {/* SECTION 1 — SCHOOL OVERALL SUMMARY */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 px-1">
              <GraduationCap className="w-4 h-4 text-[#0F5132] dark:text-emerald-400" />
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {isTargetClassExam
                  ? `${targetClassName} Overall Summary`
                  : selectedExam?.education_level
                  ? `${selectedExam.education_level} Overall Summary`
                  : 'School Overall Summary'}
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isTargetClassExam
                  ? `(${targetClassName} Only)`
                  : selectedExam?.education_level
                  ? `(${LEVEL_TO_GRADES[selectedExam.education_level]?.join(', ') || selectedExam.education_level} Only)`
                  : '(PP1–PP2 & Grades 1–9 Combined)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Expected Entries */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Expected Entries
                  </span>
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {schoolSummary.expectedEntries.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Across {schoolSummary.totalLearners} eligible learners
                  </div>
                </div>
              </div>

              {/* Completed Entries */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Completed Entries
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {schoolSummary.completedEntries.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Evaluated scores, 0, X, and Y statuses
                  </div>
                </div>
              </div>

              {/* Missing Entries */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Missing Entries
                  </span>
                  <div
                    className={`p-2 rounded-xl ${
                      schoolSummary.missingEntries > 0
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div
                    className={`text-2xl font-black ${
                      schoolSummary.missingEntries > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {schoolSummary.missingEntries.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {schoolSummary.missingEntries === 0
                      ? 'All marks 100% entered!'
                      : 'Unentered mark cells requiring input'}
                  </div>
                </div>
              </div>

              {/* Overall Completion Percentage */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Overall Completion
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#0F5132] dark:text-emerald-400">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline justify-between">
                    <span>{schoolSummary.completionPercentage.toFixed(1)}%</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        schoolSummary.completionPercentage === 100
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                          : schoolSummary.completionPercentage > 0
                          ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          : 'bg-rose-50 text-rose-800 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                      }`}
                    >
                      {schoolSummary.completionPercentage === 100
                        ? 'Complete'
                        : schoolSummary.completionPercentage > 0
                        ? 'In Progress'
                        : 'Not Started'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        schoolSummary.completionPercentage === 100
                          ? 'bg-emerald-500'
                          : schoolSummary.completionPercentage > 50
                          ? 'bg-[#0F5132]'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, schoolSummary.completionPercentage))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 — LEVEL SECTION BREAKDOWN & CARDS (Omitted for single target class assessment) */}
          {!isTargetClassExam && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-center space-x-2 text-center">
                  <Building2 className="w-4 h-4 text-[#0F5132] dark:text-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                    LEVEL SECTION BREAKDOWN
                  </h3>
                </div>

              {/* Clean 4-Level Equal Grid Selector */}
              <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                {ALL_EDUCATION_LEVELS.map((level) => {
                  const isSelected = selectedSectionTab === level;
                  const levelMetrics = metricsByScope.sections[level];
                  const isLevelInScope =
                    !selectedExam ||
                    (!selectedExam.education_level &&
                      (!selectedExam.class_id || selectedExam.class_id === 'all'))
                      ? true
                      : isTargetClassExam
                      ? inScopeClasses.some(
                          (c) =>
                            (c.education_level || getEducationLevelForGrade(c.class_name)) === level
                        )
                      : selectedExam.education_level
                      ? selectedExam.education_level === level
                      : inScopeClasses.some(
                          (c) =>
                            (c.education_level || getEducationLevelForGrade(c.class_name)) === level
                        );

                  return (
                    <button
                      key={level}
                      onClick={() => {
                        setSelectedSectionTab(level);
                        setSelectedClassId('');
                        setSelectedStreamId('');
                        setSelectedSubjectId('');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 w-full ${
                        isSelected
                          ? 'bg-[#0F5132] text-white shadow-xs dark:bg-emerald-600 dark:text-white'
                          : isLevelInScope
                          ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                          : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200/40 dark:hover:bg-slate-700/40 opacity-75'
                      }`}
                    >
                      <span className="truncate">{level}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : isLevelInScope
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {isLevelInScope
                          ? `${levelMetrics.completionPercentage.toFixed(0)}%`
                          : 'Out of Scope'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Education Section Overview & 4 Metric Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedSectionTab} Overview
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {!isSelectedSectionInScope
                      ? '(Out of Scope)'
                      : `(${LEVEL_TO_GRADES[selectedSectionTab]?.join(', ') || ''})`}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedSectionMetrics.totalLearners} Learners in {selectedSectionTab}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Section Expected Entries */}
                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Expected Entries
                    </span>
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xl font-black text-slate-900 dark:text-white">
                      {selectedSectionMetrics.expectedEntries.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Target entries for {selectedSectionTab}
                    </div>
                  </div>
                </div>

                {/* Section Completed Entries */}
                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Completed Entries
                    </span>
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {selectedSectionMetrics.completedEntries.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Scores, 0, X, and Y statuses
                    </div>
                  </div>
                </div>

                {/* Section Missing Entries */}
                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Missing Entries
                    </span>
                    <div
                      className={`p-1.5 rounded-lg ${
                        selectedSectionMetrics.missingEntries > 0
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div
                      className={`text-xl font-black ${
                        selectedSectionMetrics.missingEntries > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {selectedSectionMetrics.missingEntries.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {selectedSectionMetrics.missingEntries === 0
                        ? 'Section 100% complete!'
                        : 'Pending mark inputs'}
                    </div>
                  </div>
                </div>

                {/* Section Completion % */}
                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Section Completion
                    </span>
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#0F5132] dark:text-emerald-400">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xl font-black text-slate-900 dark:text-white flex items-baseline justify-between">
                      <span>{selectedSectionMetrics.completionPercentage.toFixed(1)}%</span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          selectedSectionMetrics.completionPercentage === 100
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                            : selectedSectionMetrics.completionPercentage > 0
                            ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            : 'bg-rose-50 text-rose-800 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                        }`}
                      >
                        {selectedSectionMetrics.completionPercentage === 100
                          ? 'Complete'
                          : selectedSectionMetrics.completionPercentage > 0
                          ? 'In Progress'
                          : 'Not Started'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          selectedSectionMetrics.completionPercentage === 100
                            ? 'bg-emerald-500'
                            : selectedSectionMetrics.completionPercentage > 50
                            ? 'bg-[#0F5132]'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, selectedSectionMetrics.completionPercentage))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Composable Cascading Filters & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Monitoring Filters</span>
              </div>
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* 1. Class / Grade Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Class / Grade
                </label>
                <select
                  value={selectedClassId}
                  disabled={!selectedExamId || !selectedExam}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F5132] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedExamId || !selectedExam ? 'Select Assessment First' : 'Select Class / Grade'}
                  </option>
                  {selectedExamId && selectedExam && <option value="all">All Classes</option>}
                  {uniqueGradeNames.map((g, idx) => (
                    <option key={`${g}_${idx}`} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Stream Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Stream
                </label>
                <select
                  value={selectedStreamId}
                  disabled={!selectedExamId || !selectedClassId}
                  onChange={(e) => handleStreamChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F5132] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedClassId ? 'Select Class First' : 'Select Stream'}
                  </option>
                  {selectedClassId && <option value="all">All Streams</option>}
                  {availableStreams.map((c, idx) => (
                    <option key={`${c.stream_id || c.id}_${c.stream}_${idx}`} value={c.stream_id || c.id}>
                      {c.class_name} {c.stream}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Learning Area Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Learning Area
                </label>
                <select
                  value={selectedSubjectId}
                  disabled={!selectedExamId || !selectedClassId || !selectedStreamId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F5132] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedStreamId ? 'Select Stream First' : 'Select Learning Area'}
                  </option>
                  {selectedStreamId && <option value="all">All Learning Areas</option>}
                  {applicableSubjects.map((s, idx) => (
                    <option key={`${s.id}_${idx}`} value={s.id}>
                      {s.subject_name} ({s.subject_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Status Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Completion Status
                </label>
                <select
                  value={statusFilter}
                  disabled={!selectedExamId || !selectedClassId || !selectedStreamId || !selectedSubjectId}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F5132] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedSubjectId ? 'Select Learning Area First' : 'Select Completion Status'}
                  </option>
                  {selectedSubjectId && (
                    <>
                      <option value="all">All Statuses</option>
                      <option value="complete">100% Complete</option>
                      <option value="in_progress">In Progress</option>
                      <option value="not_started">Not Started</option>
                      <option value="missing">Has Missing Marks</option>
                    </>
                  )}
                </select>
              </div>

              {/* 5. Learner Search Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Search Learner
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    disabled={!selectedExamId || !selectedClassId || !selectedStreamId || !selectedSubjectId}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={!selectedSubjectId ? 'Select Learning Area First' : 'Name or Adm No...'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F5132] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Quick Toggle Filter Checkbox */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyIncomplete}
                  onChange={(e) => setShowOnlyIncomplete(e.target.checked)}
                  className="rounded text-[#0F5132] focus:ring-[#0F5132] w-4 h-4 cursor-pointer"
                />
                <span className="text-slate-900 dark:text-white font-bold">
                  Show Only Incomplete / Pending Items
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-normal">
                  (Hides 100% complete streams and subjects)
                </span>
              </label>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Auditing {examEligibleLearners.length} learners
              </span>
            </div>
          </div>

          {/* Breakdown Tabs Navigation */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2">
            <button
              onClick={() => setActiveBreakdownTab('classes')}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
                activeBreakdownTab === 'classes'
                  ? 'border-[#0F5132] text-[#0F5132] dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Class & Stream Progress ({filteredClassStreamBreakdown.length})</span>
            </button>

            <button
              onClick={() => setActiveBreakdownTab('subjects')}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
                activeBreakdownTab === 'subjects'
                  ? 'border-[#0F5132] text-[#0F5132] dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>Learning Area Breakdown ({filteredSubjectBreakdown.length})</span>
            </button>

            <button
              onClick={() => setActiveBreakdownTab('learners')}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 ${
                activeBreakdownTab === 'learners'
                  ? 'border-[#0F5132] text-[#0F5132] dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Learner-Level Detail ({filteredLearnerDetailedProgress.length})</span>
            </button>
          </div>

          {/* TAB 1: CLASS & STREAM BREAKDOWN TABLE */}
          {activeBreakdownTab === 'classes' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Class / Grade</th>
                      <th className="py-3.5 px-4">Stream</th>
                      <th className="py-3.5 px-4 text-center">Learners</th>
                      <th className="py-3.5 px-4 text-center">Expected Entries</th>
                      <th className="py-3.5 px-4 text-center">Completed</th>
                      <th className="py-3.5 px-4 text-center">Missing</th>
                      <th className="py-3.5 px-4 text-center">Completion %</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-medium">
                    {filteredClassStreamBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          No class streams match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredClassStreamBreakdown.map((item, idx) => (
                        <tr
                          key={`${item.key}_${idx}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {item.class_name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                            {item.stream_name || 'Main Stream'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.learnerCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.expected}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.completed}
                          </td>
                          <td className="py-3.5 px-4 text-center font-extrabold">
                            <span
                              className={
                                item.missing > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-400'
                              }
                            >
                              {item.missing}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold">
                            <div className="flex items-center justify-center space-x-2">
                              <span>{item.completionPct.toFixed(1)}%</span>
                              <div className="w-12 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full ${
                                    item.completionPct === 100
                                      ? 'bg-emerald-500'
                                      : item.completionPct > 0
                                      ? 'bg-[#0F5132]'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${item.completionPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                item.status === 'COMPLETE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                                  : item.status === 'IN PROGRESS'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
                                  : item.status === 'NOT STARTED'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedClassId(item.class_id || item.class_name);
                                if (item.stream_id) setSelectedStreamId(item.stream_id);
                                setActiveBreakdownTab('learners');
                              }}
                              className="inline-flex items-center text-xs font-bold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              <span>View Learners</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LEARNING AREA BREAKDOWN TABLE */}
          {activeBreakdownTab === 'subjects' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Learning Area Name</th>
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Education Level</th>
                      <th className="py-3.5 px-4 text-center">Expected Entries</th>
                      <th className="py-3.5 px-4 text-center">Completed</th>
                      <th className="py-3.5 px-4 text-center">Missing</th>
                      <th className="py-3.5 px-4 text-center">Completion %</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-medium">
                    {filteredSubjectBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          No learning areas match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredSubjectBreakdown.map((item, idx) => (
                        <tr
                          key={`${item.subject.id}_${idx}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {item.subject.subject_name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono font-bold">
                            {item.subject.subject_code}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                            {item.subject.education_level}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.expected}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.completed}
                          </td>
                          <td className="py-3.5 px-4 text-center font-extrabold">
                            <span
                              className={
                                item.missing > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-400'
                              }
                            >
                              {item.missing}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold">
                            {item.completionPct.toFixed(1)}%
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                item.status === 'COMPLETE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                                  : item.status === 'IN PROGRESS'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
                                  : item.status === 'NOT STARTED'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedSubjectId(item.subject.id);
                                setActiveBreakdownTab('learners');
                              }}
                              className="inline-flex items-center text-xs font-bold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              <span>Filter Learners</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DETAILED LEARNER PROGRESS GRID */}
          {activeBreakdownTab === 'learners' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Adm No.</th>
                      <th className="py-3.5 px-4">Learner Name</th>
                      <th className="py-3.5 px-4">Class & Stream</th>
                      <th className="py-3.5 px-4 text-center">Entered / Total</th>
                      <th className="py-3.5 px-4 text-center">Missing Marks</th>
                      <th className="py-3.5 px-4 text-center">Completion</th>
                      <th className="py-3.5 px-4">Learning Area Marks Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-medium">
                    {filteredLearnerDetailedProgress.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          No learners match the selected filter criteria or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredLearnerDetailedProgress.map(({ student, examContext, completedCount, totalApplicable, missingCount, completionPct, subjectStatuses }, idx) => (
                        <tr
                          key={`${student.id}_${idx}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono font-bold">
                            {student.admission_number}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {getStudentFullName(student) || student.full_name || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                            {examContext.full_class_name || examContext.class_name}
                            {examContext.is_historical && (
                              <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold" title="Class resolved from historical exam context">
                                (Hist)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {completedCount} / {totalApplicable}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={
                                missingCount > 0
                                  ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                                  : 'text-slate-600 dark:text-slate-400 font-medium'
                              }
                            >
                              {missingCount === 0 ? 'None (Complete)' : `${missingCount} missing`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold">
                            {completionPct.toFixed(0)}%
                          </td>
                          <td className="py-3.5 px-4">
                            {/* Score pills per subject */}
                            <div className="flex flex-wrap gap-1.5 max-w-xl">
                              {subjectStatuses.map(({ subject, evaluated }, sIdx) => {
                                let badgeBg = 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/50';
                                let textVal = 'MISSING';

                                if (evaluated.status === 'Normal') {
                                  badgeBg = 'bg-slate-100/90 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80';
                                  textVal = evaluated.displayScore;
                                } else if (evaluated.status === 'X') {
                                  badgeBg = 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50';
                                  textVal = 'X (Absent)';
                                } else if (evaluated.status === 'Y') {
                                  badgeBg = 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/50';
                                  textVal = 'Y (Irreg)';
                                }

                                return (
                                  <span
                                    key={`${subject.id}_${sIdx}`}
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeBg}`}
                                    title={`${subject.subject_name}: ${evaluated.displayStatus}`}
                                  >
                                    <span className="opacity-70 mr-1">{subject.subject_code}:</span>
                                    <span>{textVal}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
