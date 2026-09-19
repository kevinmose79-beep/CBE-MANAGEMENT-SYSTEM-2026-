import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Filter,
  Users,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Loader2,
  FileText,
  CheckCircle2,
  HelpCircle,
  Info,
  Clock,
  Eye,
  Download,
  FileDown,
  Printer,
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
  sortClasses,
  getStudentFullName,
} from '../../types';
import {
  discoverTerminalAssessments,
  DiscoveredTerminalContext,
} from '../../services/terminalAssessmentDiscovery';
import {
  calculateLearnerTerminalResults,
  LearningAreaTerminalResult,
  ContributingAssessmentRef,
} from '../../services/terminalResultsEngine';
import {
  TerminalLearnerRanking,
  LearnerCohortEntry,
  isJuniorSchoolEducationLevel,
  calculateCohortTerminalRankings,
  calculateSingleLearnerRanking,
} from '../../services/terminalRankingEngine';
import {
  downloadSingleTerminalReportPDF,
  downloadBatchTerminalReportsPDF,
  TerminalReportPDFData,
} from '../../services/terminalReportPdfGenerator';
import { getLearnerReportSubjects } from '../../services/analysisEngine';
import { useAcademicSession } from '../../contexts/AcademicSessionContext';
import { getUserFriendlyErrorMessage } from '../../utils/errorUtils';
import {
  getActiveTeacher,
  getAccessibleClasses,
  getAccessibleStudents,
} from '../../utils/rbacUtils';
import { api } from '../../lib/storage';
import { TerminalResultsTable } from './TerminalResultsTable';
import { TerminalResultsCard } from './TerminalResultsCard';
import { AssessmentTrailDrawer } from './AssessmentTrailDrawer';
import { TerminalReportModal } from './TerminalReportModal';
import { CbeTerminalMeritListReport } from './CbeTerminalMeritListReport';
import {
  generateTerminalMeritDataset,
  TerminalMeritListData,
} from '../../services/terminalMeritListExporter';
import { getEducationLevelForGrade } from '../../types';

interface TerminalResultsViewProps {
  school: School;
  students: Student[];
  subjects: Subject[];
  exams?: Examination[];
  marks?: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  currentUser?: User;
  initialClassId?: string;
  initialStreamId?: string;
  initialStudentId?: string;
  initialViewMode?: 'individual' | 'merit_list';
}

export const TerminalResultsView: React.FC<TerminalResultsViewProps> = ({
  school,
  students = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  classes = [],
  teachers = [],
  currentUser,
  initialClassId,
  initialStreamId,
  initialStudentId,
  initialViewMode,
}) => {
  // Authoritative Academic Session Context
  const { viewingYear, viewingTerm } = useAcademicSession();

  // Sub-navigation view mode: 'individual' vs 'merit_list'
  const [viewMode, setViewMode] = useState<'individual' | 'merit_list'>(
    initialViewMode || 'individual'
  );
  // Merit List stream filter: 'all' (General Grade View) or specific stream_id
  const [meritStreamId, setMeritStreamId] = useState<string>(
    initialStreamId || 'all'
  );

  // RBAC & Permission verification
  const isStaff =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'class_teacher' ||
    currentUser?.role === 'subject_teacher';

  const activeTeacher = useMemo(
    () => getActiveTeacher(currentUser || null, teachers || []),
    [currentUser, teachers]
  );

  const accessibleClasses = useMemo(() => {
    return getAccessibleClasses(currentUser || null, activeTeacher, classes);
  }, [currentUser, activeTeacher, classes]);

  // Helper to resolve an incoming class ID or class name to authoritative stream_id || id
  const resolveClassStreamId = useCallback((targetClassId?: string, targetStreamId?: string): string => {
    if (!targetClassId && !targetStreamId) return '';
    // 1. Direct stream_id / id match
    if (targetClassId) {
      const match = accessibleClasses.find((c) => (c.stream_id || c.id) === targetClassId);
      if (match) return match.stream_id || match.id;
    }
    if (targetStreamId && targetStreamId !== 'all') {
      const match = accessibleClasses.find((c) => (c.stream_id || c.id) === targetStreamId);
      if (match) return match.stream_id || match.id;
    }
    // 2. Class name match (e.g. "Grade 9")
    if (targetClassId) {
      const candidates = accessibleClasses.filter(
        (c) => c.class_name.toLowerCase() === targetClassId.toLowerCase()
      );
      if (targetStreamId && targetStreamId !== 'all') {
        const streamMatch = candidates.find(
          (c) =>
            c.stream_id === targetStreamId ||
            c.id === targetStreamId ||
            c.stream.toLowerCase() === targetStreamId.toLowerCase()
        );
        if (streamMatch) return streamMatch.stream_id || streamMatch.id;
      }
      if (candidates.length === 1) {
        return candidates[0].stream_id || candidates[0].id;
      }
    }
    // Fail-closed: NEVER default to accessibleClasses[0] or PP1
    return '';
  }, [accessibleClasses]);

  // Context Selection States (Fail-closed: Defaults to empty when unselected or unmatched)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return resolveClassStreamId(initialClassId, initialStreamId);
  });

  // Authoritatively sync when initialClassId or initialStreamId prop changes
  useEffect(() => {
    const resolved = resolveClassStreamId(initialClassId, initialStreamId);
    if (resolved && resolved !== selectedClassId) {
      setSelectedClassId(resolved);
    }
  }, [initialClassId, initialStreamId, resolveClassStreamId, selectedClassId]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [isProvisionalMode, setIsProvisionalMode] = useState<boolean>(false);

  // Discovery & Calculation States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveredContext, setDiscoveredContext] = useState<DiscoveredTerminalContext | null>(null);
  const [learnerMarks, setLearnerMarks] = useState<Mark[]>([]);

  // Progressive Disclosure Trail Drawer State
  const [trailSubject, setTrailSubject] = useState<Subject | null>(null);
  const [trailResult, setTrailResult] = useState<LearningAreaTerminalResult | null>(null);
  const [isTrailOpen, setIsTrailOpen] = useState<boolean>(false);

  // Terminal Report Form & PDF Presentation States
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState<boolean>(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchDownloadError, setBatchDownloadError] = useState<string | null>(null);

  // Selected Class Stream Object
  const selectedClassStream = useMemo(() => {
    if (!selectedClassId) return null;
    return (
      classes.find((c) => (c.stream_id || c.id) === selectedClassId) ||
      classes.find((c) => c.class_name === selectedClassId) ||
      null
    );
  }, [classes, selectedClassId]);

  // Accessible Learners for Selected Class & Stream (Strict Stream Isolation)
  const classStudents = useMemo(() => {
    if (!selectedClassStream) return [];
    return students.filter((s) => {
      const studentAny = s as any;
      const studentStream = typeof studentAny.stream === 'string' ? studentAny.stream : (studentAny.stream_name || '');
      const studentClassName =
        typeof studentAny.class_name === 'string' ? studentAny.class_name : (s.grade || '');

      // 1. Authoritative Stream Matching: When a specific stream_id exists
      if (selectedClassStream.stream_id) {
        if (s.stream_id === selectedClassStream.stream_id) return true;
        if (s.class_id === selectedClassStream.id && s.stream_id === selectedClassStream.stream_id) return true;
        if (
          selectedClassStream.stream &&
          studentStream &&
          studentStream.trim().toLowerCase() === selectedClassStream.stream.trim().toLowerCase() &&
          (!selectedClassStream.class_name || studentClassName.trim().toLowerCase() === selectedClassStream.class_name.trim().toLowerCase())
        ) {
          return true;
        }
      }

      // 2. Legacy / Named Stream Context: When selectedClassStream has a stream name but no stream_id
      if (selectedClassStream.stream && selectedClassStream.stream.trim() !== '') {
        const matchStreamId = s.stream_id === selectedClassStream.id;
        const matchExactName =
          Boolean(studentStream) &&
          studentStream.trim().toLowerCase() === selectedClassStream.stream.trim().toLowerCase() &&
          Boolean(studentClassName && selectedClassStream.class_name) &&
          studentClassName.trim().toLowerCase() === selectedClassStream.class_name.trim().toLowerCase();

        if (studentStream) {
          return matchExactName;
        }
        return matchStreamId;
      }

      // 3. Class-Only Context: Unstreamed class (e.g., PP1 with no streams)
      const matchClassId =
        s.class_id === selectedClassStream.id || s.stream_id === selectedClassStream.id;
      const matchClassName =
        Boolean(studentClassName && selectedClassStream.class_name) &&
        studentClassName.trim().toLowerCase() === selectedClassStream.class_name.trim().toLowerCase();

      return matchClassId || matchClassName;
    });
  }, [students, selectedClassStream]);

  // Fail-closed learner selection: preserve valid learner, clear if invalid after class/stream change
  useEffect(() => {
    if (selectedStudentId) {
      const isValid = classStudents.some((s) => s.id === selectedStudentId);
      if (!isValid) {
        if (initialStudentId && classStudents.some((s) => s.id === initialStudentId)) {
          setSelectedStudentId(initialStudentId);
        } else {
          setSelectedStudentId('');
        }
      }
    } else if (initialStudentId && classStudents.some((s) => s.id === initialStudentId)) {
      setSelectedStudentId(initialStudentId);
    }
  }, [classStudents, selectedStudentId, initialStudentId]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Discover Assessments & Calculate Results
  const loadTerminalResults = useCallback(async () => {
    if (!selectedStudent || !selectedClassStream || !viewingYear || !viewingTerm) {
      setDiscoveredContext(null);
      setLearnerMarks([]);
      return;
    }

    setIsLoading(true);
    setDiscoveryError(null);

    try {
      const academicYearId = (viewingYear as any).id || String(viewingYear.year);
      const termId = (viewingTerm as any).id || String(viewingTerm.term_name || viewingTerm.id);

      // Authoritatively fetch the selected learner's marks from Supabase
      const fetchedMarks = await api.fetchMarksForLearner(selectedStudent.id);
      setLearnerMarks(fetchedMarks);

      // Enforce strict learner scoping: candidate marks must ONLY belong to the selected learner
      const studentPropMarks = marks.filter((m) => m.student_id === selectedStudent.id);
      const candidateMarks =
        fetchedMarks.length > 0 ? fetchedMarks : (studentPropMarks.length > 0 ? studentPropMarks : undefined);

      const discovered = await discoverTerminalAssessments({
        academicYearId,
        termId,
        student: selectedStudent,
        classStream: selectedClassStream,
        isProvisionalMode: isStaff ? isProvisionalMode : false, // Staff-only gating
        examinations: exams.length > 0 ? exams : undefined,
        marks: candidateMarks,
        classes,
        allMarks: marks,
        students,
      });

      setDiscoveredContext(discovered);
    } catch (err: any) {
      console.error('[TerminalResultsView] Discovery error:', err);
      setDiscoveryError(getUserFriendlyErrorMessage(err, 'Failed to discover contributing assessments from database.'));
      setDiscoveredContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedStudent,
    selectedClassStream,
    viewingYear,
    viewingTerm,
    isProvisionalMode,
    isStaff,
    exams,
    marks,
    classes,
    students,
  ]);

  // Auto-reload when context changes
  useEffect(() => {
    loadTerminalResults();
  }, [loadTerminalResults]);

  // Contributing Assessments
  const contributingAssessments: ContributingAssessmentRef[] = useMemo(() => {
    return discoveredContext?.contributingAssessments || [];
  }, [discoveredContext]);

  // Authoritative Learner-Scoped Applicable Subjects
  const applicableSubjects: Subject[] = useMemo(() => {
    if (!selectedStudent && !selectedClassStream) {
      return subjects;
    }
    const rawScoped = getLearnerReportSubjects(
      selectedStudent || undefined,
      selectedClassStream || undefined,
      subjects,
      teachers
    );
    // Ensure strict uniqueness by Subject ID
    const seenIds = new Set<string>();
    const unique: Subject[] = [];
    for (const sb of rawScoped) {
      if (sb && sb.id && !seenIds.has(sb.id)) {
        seenIds.add(sb.id);
        unique.push(sb);
      }
    }
    return unique.length > 0 ? unique : subjects;
  }, [selectedStudent, selectedClassStream, subjects, teachers]);

  // Learning Area Results Calculation Map
  const resultsBySubject: Map<string, LearningAreaTerminalResult> = useMemo(() => {
    if (!selectedStudent || contributingAssessments.length === 0) {
      return new Map();
    }

    const subjectIds = applicableSubjects.map((s) => s.id);
    const discoveredMarks =
      discoveredContext?.marks && discoveredContext.marks.length > 0
        ? discoveredContext.marks
        : learnerMarks.length > 0
          ? learnerMarks
          : marks.filter((m) => m.student_id === selectedStudent.id);

    return calculateLearnerTerminalResults({
      learnerId: selectedStudent.id,
      subjectIds,
      contributingAssessments,
      marks: discoveredMarks,
      grades,
    });
  }, [selectedStudent, applicableSubjects, contributingAssessments, discoveredContext, learnerMarks, marks, grades]);

  // Learner Summary Metrics
  const summaryMetrics = useMemo(() => {
    let completeCount = 0;
    let incompleteCount = 0;

    for (const subject of applicableSubjects) {
      const res = resultsBySubject.get(subject.id);
      if (res?.isComplete) {
        completeCount++;
      } else {
        incompleteCount++;
      }
    }

    return {
      totalSubjects: applicableSubjects.length,
      completeCount,
      incompleteCount,
      assessmentCount: contributingAssessments.length,
    };
  }, [applicableSubjects, resultsBySubject, contributingAssessments]);

  // Determine Junior School Education Level Authority
  const isJuniorSchool = useMemo(() => {
    return isJuniorSchoolEducationLevel(undefined, selectedClassStream, selectedStudent);
  }, [selectedClassStream, selectedStudent]);

  // Grade Cohort for Class-level and Stream-level Ranking
  const gradeStudents = useMemo(() => {
    if (!selectedClassStream && !selectedStudent) return [];
    const targetGrade = (selectedClassStream?.class_name || selectedStudent?.grade || '').trim().toLowerCase();
    if (!targetGrade) return classStudents;
    return students.filter((s) => {
      const g = (s.grade || (s as any).class_name || '').trim().toLowerCase();
      return g === targetGrade || g.replace(/^grade\s+/i, '') === targetGrade.replace(/^grade\s+/i, '');
    });
  }, [students, selectedClassStream, selectedStudent, classStudents]);

  // Authoritative Cohort Ranking Map for Junior School
  const cohortRankings = useMemo(() => {
    if (!isJuniorSchool || contributingAssessments.length === 0) {
      return new Map<string, TerminalLearnerRanking>();
    }

    const cohortList: LearnerCohortEntry[] = [];

    // Include selected student first if available
    if (selectedStudent) {
      cohortList.push({
        student: selectedStudent,
        classStream: selectedClassStream,
        applicableSubjects,
        resultsBySubject,
      });
    }

    // Include other students in the grade cohort
    for (const st of gradeStudents) {
      if (selectedStudent && st.id === selectedStudent.id) continue;

      const stClass =
        (st.stream_id ? classes.find((c) => c.stream_id === st.stream_id || c.id === st.stream_id) : undefined) ||
        classes.find((c) => c.id === st.class_id && (!c.stream || c.stream === (st as any).stream)) ||
        classes.find((c) => c.id === st.class_id) ||
        selectedClassStream;
      const rawScoped = getLearnerReportSubjects(st, stClass, subjects, teachers);
      const seenIds = new Set<string>();
      const uniqueSubjs: Subject[] = [];
      for (const sb of rawScoped) {
        if (sb && sb.id && !seenIds.has(sb.id)) {
          seenIds.add(sb.id);
          uniqueSubjs.push(sb);
        }
      }
      const stSubjects = uniqueSubjs.length > 0 ? uniqueSubjs : subjects;
      const stMarks = marks.filter((m) => m.student_id === st.id);
      const stResults = calculateLearnerTerminalResults({
        learnerId: st.id,
        subjectIds: stSubjects.map((s) => s.id),
        contributingAssessments,
        marks: stMarks,
        grades,
      });

      cohortList.push({
        student: st,
        classStream: stClass,
        applicableSubjects: stSubjects,
        resultsBySubject: stResults,
      });
    }

    return calculateCohortTerminalRankings({
      learners: cohortList,
      isProvisionalMode,
    });
  }, [
    isJuniorSchool,
    contributingAssessments,
    selectedStudent,
    selectedClassStream,
    applicableSubjects,
    resultsBySubject,
    gradeStudents,
    classes,
    subjects,
    teachers,
    marks,
    grades,
    isProvisionalMode,
  ]);

  const selectedLearnerRanking: TerminalLearnerRanking | null = useMemo(() => {
    if (!selectedStudent || !isJuniorSchool) return null;
    return (
      cohortRankings.get(selectedStudent.id) ||
      calculateSingleLearnerRanking({
        student: selectedStudent,
        classStream: selectedClassStream,
        resultsBySubject,
        applicableSubjects,
        isProvisionalMode,
      })
    );
  }, [selectedStudent, isJuniorSchool, cohortRankings, selectedClassStream, resultsBySubject, applicableSubjects, isProvisionalMode]);

  // Single Learner Report Download
  const handleDownloadSinglePDF = async () => {
    if (!selectedStudent || !selectedClassStream || contributingAssessments.length === 0) {
      return;
    }
    try {
      setIsDownloadingSingle(true);
      await downloadSingleTerminalReportPDF({
        student: selectedStudent,
        school,
        classStream: selectedClassStream,
        classes,
        academicYear: viewingYear?.year || 2026,
        term: viewingTerm?.term_name || 'Term 1',
        isProvisionalMode,
        contributingAssessments,
        subjects: applicableSubjects,
        resultsBySubject,
        grades,
        teachers,
        nextTermOpeningDate: (viewingTerm as any)?.next_term_opening_date || (viewingTerm as any)?.nextTermOpeningDate,
        ranking: selectedLearnerRanking || undefined,
      });
    } catch (err) {
      console.error('Failed to download terminal report PDF:', err);
    } finally {
      setIsDownloadingSingle(false);
    }
  };

  // Batch Stream Reports Download
  const handleBatchDownloadPDF = async () => {
    if (!selectedClassStream || classStudents.length === 0 || contributingAssessments.length === 0) {
      return;
    }
    try {
      setIsBatchDownloading(true);
      setBatchDownloadError(null);
      setBatchProgress({ current: 0, total: classStudents.length });

      const allReportsData: TerminalReportPDFData[] = [];

      // Step 1: Pre-fetch authoritative marks for this cohort using scoped workflow batch query if available
      const studentIds = classStudents.map((s) => s.id).filter(Boolean);
      const streamMarksMap = new Map<string, Mark[]>();

      try {
        if (typeof api.fetchMarksForWorkflow === 'function' && studentIds.length > 0) {
          const batchWorkflowMarks = await api.fetchMarksForWorkflow({
            studentIds,
          });
          if (Array.isArray(batchWorkflowMarks) && batchWorkflowMarks.length > 0) {
            for (const m of batchWorkflowMarks) {
              if (m.student_id) {
                const existing = streamMarksMap.get(m.student_id) || [];
                existing.push(m);
                streamMarksMap.set(m.student_id, existing);
              }
            }
          }
        }
      } catch (batchErr) {
        console.warn('[TerminalResultsView] Scoped batch marks fetch failed, falling back to individual learner queries:', batchErr);
      }

      // Step 2: For each learner in classStudents, retrieve their authoritative marks and calculate terminal results
      for (let idx = 0; idx < classStudents.length; idx++) {
        const st = classStudents[idx];
        setBatchProgress({ current: idx + 1, total: classStudents.length });

        let stMarks: Mark[] = [];

        // If this learner is the currently selected student and we already have their authoritative marks loaded
        if (selectedStudent && st.id === selectedStudent.id && learnerMarks.length > 0) {
          stMarks = learnerMarks.filter((m) => m.student_id === st.id);
        } else if (streamMarksMap.has(st.id)) {
          stMarks = streamMarksMap.get(st.id)!;
        } else {
          // If not in streamMarksMap, fetch authoritatively for this learner specifically
          try {
            const fetched = await api.fetchMarksForLearner(st.id);
            if (Array.isArray(fetched) && fetched.length > 0) {
              stMarks = fetched.filter((m) => m.student_id === st.id);
              streamMarksMap.set(st.id, stMarks);
            }
          } catch (fetchErr: any) {
            console.error(`[TerminalResultsView] Authoritative mark retrieval failed for learner ${st.id}:`, fetchErr);
            // CRITICAL (Part 6 & 13): A retrieval failure must NOT silently manufacture INCOMPLETE (X).
            throw new Error(
              `Failed to retrieve authoritative marks from database for learner ${getStudentFullName(st)} (${st.admission_number || st.id}): ${fetchErr?.message || 'Database error'}. Batch generation aborted.`
            );
          }
        }

        // Supplement from in-memory marks prop if still empty and marks prop contains entries for this learner
        if (stMarks.length === 0 && marks && marks.length > 0) {
          const propMarks = marks.filter((m) => m.student_id === st.id);
          if (propMarks.length > 0) {
            stMarks = propMarks;
          }
        }

        // STRICT IDENTITY VALIDATION:
        // Guarantee every mark belongs strictly to this learner's UUID
        stMarks = stMarks.filter((m) => m.student_id === st.id);

        const rawScoped = getLearnerReportSubjects(st, selectedClassStream, subjects, teachers);
        const seenIds = new Set<string>();
        const uniqueSubjs: Subject[] = [];
        for (const sb of rawScoped) {
          if (sb && sb.id && !seenIds.has(sb.id)) {
            seenIds.add(sb.id);
            uniqueSubjs.push(sb);
          }
        }
        const stSubjects = uniqueSubjs.length > 0 ? uniqueSubjs : subjects;

        const stResultsMap = calculateLearnerTerminalResults({
          learnerId: st.id,
          subjectIds: stSubjects.map((s) => s.id),
          contributingAssessments,
          marks: stMarks,
          grades,
        });

        allReportsData.push({
          student: st,
          school,
          classStream: selectedClassStream,
          classes,
          academicYear: viewingYear?.year || 2026,
          term: viewingTerm?.term_name || 'Term 1',
          isProvisionalMode,
          contributingAssessments,
          subjects: stSubjects,
          resultsBySubject: stResultsMap,
          grades,
          teachers,
        });
      }

      // Pre-compute cohort rankings for batch reports if Junior School (using full grade cohort)
      if (isJuniorSchoolEducationLevel(undefined, selectedClassStream)) {
        for (const r of allReportsData) {
          r.ranking = cohortRankings.get(r.student.id) || calculateSingleLearnerRanking({
            student: r.student,
            classStream: r.classStream,
            resultsBySubject: r.resultsBySubject,
            applicableSubjects: r.subjects,
            isProvisionalMode,
          });
        }
      }

      await downloadBatchTerminalReportsPDF(allReportsData, (current, total) => {
        setBatchProgress({ current, total });
      });
    } catch (err: any) {
      console.error('Failed to batch download terminal reports PDF:', err);
      setBatchDownloadError(getUserFriendlyErrorMessage(err, 'Failed to generate batch terminal reports PDF.'));
    } finally {
      setIsBatchDownloading(false);
      setBatchProgress(null);
    }
  };

  // --- Terminal Merit List Computation ---
  // Active Grade for Merit List mode: derived from selectedClassStream, or fallback to first accessible class grade
  const [meritGrade, setMeritGrade] = useState<string>(() => {
    return selectedClassStream?.class_name || (accessibleClasses.length > 0 ? accessibleClasses[0].class_name : '');
  });

  // Keep meritGrade in sync when selectedClassStream changes
  useEffect(() => {
    if (selectedClassStream?.class_name && selectedClassStream.class_name !== meritGrade) {
      setMeritGrade(selectedClassStream.class_name);
    }
  }, [selectedClassStream, meritGrade]);

  // Unique accessible grades
  const accessibleGrades = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of accessibleClasses) {
      if (c.class_name && !seen.has(c.class_name)) {
        seen.add(c.class_name);
        list.push(c.class_name);
      }
    }
    return list;
  }, [accessibleClasses]);

  // Available streams for current merit grade
  const gradeStreams = useMemo(() => {
    if (!meritGrade) return [];
    return accessibleClasses.filter(
      (c) => c.class_name.toLowerCase() === meritGrade.toLowerCase()
    );
  }, [accessibleClasses, meritGrade]);

  // Contributing assessments for Terminal Merit List
  const meritContributingAssessments = useMemo(() => {
    if (!exams || exams.length === 0 || !viewingYear || !viewingTerm || !meritGrade) {
      return contributingAssessments;
    }
    const yearNum = typeof viewingYear.year === 'number' ? viewingYear.year : parseInt(String(viewingYear.year), 10);
    const termStr = String(viewingTerm.term_name || viewingTerm.id || '').toLowerCase();

    const filtered = (exams || []).filter((e) => {
      if (!isStaff || !isProvisionalMode) {
        if (e.status !== 'Approved' && (e as any).approval_status !== 'Approved') return false;
      } else {
        const st = e.status || (e as any).approval_status;
        if (st !== 'Approved' && st !== 'Provisional' && st !== 'Draft_Pending_Approval') return false;
      }

      const eYear = typeof e.academic_year === 'number' ? e.academic_year : parseInt(String(e.academic_year), 10);
      if (eYear !== yearNum) return false;
      const eTerm = String(e.term || '').toLowerCase();
      if (!eTerm.includes(termStr) && !termStr.includes(eTerm)) return false;

      const targetClasses = (e as any).target_classes || [];
      const targetLevels = (e as any).target_levels || [];
      if (targetClasses.length > 0) {
        const match = targetClasses.some((tc: string) => {
          const tcLow = tc.toLowerCase();
          return tcLow.includes(meritGrade.toLowerCase()) || meritGrade.toLowerCase().includes(tcLow);
        });
        if (match) return true;
      }
      if (targetLevels.length > 0) {
        const eduLevel = getEducationLevelForGrade(meritGrade);
        if (eduLevel && targetLevels.includes(eduLevel)) return true;
      }
      if (targetClasses.length === 0 && targetLevels.length === 0) return true;
      return false;
    }).map((e) => ({
      id: e.id,
      title: e.title || e.name || 'Assessment',
      status: e.status || 'Approved',
      date: e.date || e.created_at || '',
      maxScore: (e as any).max_score || (e as any).total_marks || 100,
      isOfficial: e.status === 'Approved',
    }));

    if (filtered.length > 0) return filtered;
    return contributingAssessments;
  }, [exams, viewingYear, viewingTerm, meritGrade, isStaff, isProvisionalMode, contributingAssessments]);

  // Generate Terminal Merit List Dataset
  const meritListData: TerminalMeritListData | null = useMemo(() => {
    if (!meritGrade || !viewingYear || !viewingTerm) return null;

    // Filter cohort students for merit list
    const cohortStudents = students.filter((s) => {
      const sGrade = s.grade || (s as any).class_name || '';
      if (sGrade.toLowerCase() !== meritGrade.toLowerCase()) return false;
      if (meritStreamId && meritStreamId !== 'all') {
        const targetStream = gradeStreams.find((c) => (c.stream_id || c.id) === meritStreamId);
        if (targetStream?.stream_id) {
          return s.stream_id === targetStream.stream_id;
        }
        return s.class_id === targetStream?.id || s.stream_id === targetStream?.id;
      }
      return true;
    });

    if (cohortStudents.length === 0) return null;

    // Map candidate marks for all cohort learners
    const marksByLearner = new Map<string, Mark[]>();
    for (const st of cohortStudents) {
      const stMarks = (marks || []).filter((m) => m.student_id === st.id);
      marksByLearner.set(st.id, stMarks);
    }

    // Compute resultsBySubject for each learner
    const learnerResultsMap = new Map<string, Map<string, LearningAreaTerminalResult>>();
    for (const st of cohortStudents) {
      const stClass = classes.find((c) => c.stream_id === st.stream_id || c.id === st.class_id) || selectedClassStream;
      const stSubjects = getLearnerReportSubjects(st, stClass, subjects, teachers);
      const stMarks = marksByLearner.get(st.id) || [];
      const stResults = calculateLearnerTerminalResults({
        learnerId: st.id,
        subjectIds: stSubjects.map((s) => s.id),
        contributingAssessments: meritContributingAssessments,
        marks: stMarks,
        grades,
      });
      learnerResultsMap.set(st.id, stResults);
    }

    const yearNum = typeof viewingYear.year === 'number' ? viewingYear.year : parseInt(String(viewingYear.year), 10);

    return generateTerminalMeritDataset({
      school,
      academicYear: yearNum,
      term: viewingTerm?.term_name || 'Term 1',
      grade: meritGrade,
      selectedStreamId: meritStreamId,
      classes,
      students,
      subjects,
      teachers,
      grades,
      isProvisionalMode: isStaff ? isProvisionalMode : false,
      learnerResultsMap,
    });
  }, [
    meritGrade,
    viewingYear,
    viewingTerm,
    meritStreamId,
    students,
    gradeStreams,
    meritContributingAssessments,
    marks,
    classes,
    selectedClassStream,
    subjects,
    teachers,
    grades,
    school,
    isStaff,
    isProvisionalMode,
  ]);

  // Handle open trail
  const handleOpenTrail = (subject: Subject, result: LearningAreaTerminalResult) => {
    setTrailSubject(subject);
    setTrailResult(result);
    setIsTrailOpen(true);
  };

  const handleCloseTrail = () => {
    setIsTrailOpen(false);
    setTrailSubject(null);
    setTrailResult(null);
  };

  return (
    <div id="terminal-results-view" className="space-y-5">
      {/* 1. Context Controls Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {/* Top Header Row: Title & Subtitle + Action Badge & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#176B45] dark:text-emerald-400 shrink-0 shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Terminal Results Orchestrator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                View individual learner report cards & cohort terminal merit lists
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap border border-slate-200/70 dark:border-slate-700/70 shadow-2xs">
              <span>{viewingYear?.year || '2026'}</span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{viewingTerm?.term_name || 'Term 1'}</span>
            </div>

            <button
              id="refresh-terminal-results-btn"
              onClick={loadTerminalResults}
              disabled={isLoading}
              className="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 focus:outline-hidden focus:ring-2 focus:ring-[#176B45] shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Refresh Terminal Results"
              aria-label="Refresh Terminal Results"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Mode Switcher Tabs (Individual Learner vs Terminal Merit List) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <button
            id="terminal-view-individual-btn"
            type="button"
            onClick={() => setViewMode('individual')}
            className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
              viewMode === 'individual'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
            <span>Individual Learner</span>
          </button>
          <button
            id="terminal-view-merit-btn"
            type="button"
            onClick={() => setViewMode('merit_list')}
            className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
              viewMode === 'merit_list'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Terminal Merit List</span>
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div className="p-3.5 sm:p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs items-end">
            {viewMode === 'individual' ? (
              <>
                {/* Class Selector */}
                <div className="w-full">
                  <label htmlFor="terminal-class-select" className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 text-xs sm:text-sm">
                    Class & Stream
                  </label>
                  <select
                    id="terminal-class-select"
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedStudentId('');
                    }}
                    className="h-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm focus:ring-2 focus:ring-[#176B45] focus:outline-hidden cursor-pointer shadow-2xs"
                  >
                    <option value="">Select Class & Stream...</option>
                    {accessibleClasses.map((cls) => (
                      <option
                        key={cls.stream_id || (cls.stream ? `${cls.id}_${cls.stream}` : cls.id)}
                        value={cls.stream_id || cls.id}
                      >
                        {cls.class_name} {cls.stream ? `(${cls.stream})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Learner Selector */}
                <div className="w-full">
                  <label htmlFor="terminal-learner-select" className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 text-xs sm:text-sm">
                    Learner
                  </label>
                  <select
                    id="terminal-learner-select"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    disabled={!selectedClassId || classStudents.length === 0}
                    className="h-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm focus:ring-2 focus:ring-[#176B45] focus:outline-hidden disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {!selectedClassId ? (
                      <option value="">Select Class & Stream First...</option>
                    ) : classStudents.length === 0 ? (
                      <option value="">No learners found in class</option>
                    ) : (
                      <>
                        <option value="">Select Learner...</option>
                        {classStudents.map((stu) => (
                          <option key={stu.id} value={stu.id}>
                            {getStudentFullName(stu)} {stu.admission_number ? `(${stu.admission_number})` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Merit Grade Selector */}
                <div className="w-full">
                  <label htmlFor="terminal-merit-grade-select" className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 text-xs sm:text-sm">
                    Class / Grade
                  </label>
                  <select
                    id="terminal-merit-grade-select"
                    value={meritGrade}
                    onChange={(e) => {
                      setMeritGrade(e.target.value);
                      setMeritStreamId('all');
                    }}
                    className="h-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm focus:ring-2 focus:ring-[#176B45] focus:outline-hidden cursor-pointer shadow-2xs"
                  >
                    <option value="">Select Class / Grade...</option>
                    {accessibleGrades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Merit Stream Selector */}
                <div className="w-full">
                  <label htmlFor="terminal-merit-stream-select" className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 text-xs sm:text-sm">
                    Stream View
                  </label>
                  <select
                    id="terminal-merit-stream-select"
                    value={meritStreamId}
                    onChange={(e) => setMeritStreamId(e.target.value)}
                    disabled={!meritGrade}
                    className="h-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm focus:ring-2 focus:ring-[#176B45] focus:outline-hidden disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Streams (General Grade Cohort)</option>
                    {gradeStreams.map((st) => (
                      <option key={st.stream_id || st.id} value={st.stream_id || st.id}>
                        Stream: {st.stream || st.class_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Result Mode (Official vs Provisional) - Staff Gated */}
            <div className="w-full">
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 text-xs sm:text-sm">
                Result Mode
              </label>
              {isStaff ? (
                <div className="h-10 w-full flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-2xs">
                  <button
                    id="terminal-mode-official-btn"
                    onClick={() => setIsProvisionalMode(false)}
                    className={`h-full flex-1 rounded-md text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      !isProvisionalMode
                        ? 'bg-[#176B45] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Official</span>
                  </button>

                  <button
                    id="terminal-mode-provisional-btn"
                    onClick={() => setIsProvisionalMode(true)}
                    className={`h-full flex-1 rounded-md text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      isProvisionalMode
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Provisional</span>
                  </button>
                </div>
              ) : (
                <div className="h-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-[#176B45] shrink-0" />
                  <span>Official Mode</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Provisional Mode Warning Banner */}
        {isProvisionalMode && isStaff && (
          <div
            id="provisional-mode-banner"
            className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Provisional Terminal Results Active</span>
              <p className="text-xs text-amber-800 dark:text-amber-300/90">
                Displaying results using Approved and Provisional contributing assessments. Staff review only. Not for official learner release.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. View Body: Terminal Merit List or Individual Learner View */}
      {viewMode === 'merit_list' ? (
        meritListData ? (
          <CbeTerminalMeritListReport
            data={meritListData}
            onRefresh={loadTerminalResults}
          />
        ) : (
          <div
            id="terminal-merit-empty-state"
            className="bg-white dark:bg-slate-900 rounded-xl p-12 border border-slate-200 dark:border-slate-800 text-center shadow-xs space-y-3"
          >
            <Award className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Merit List Records Available
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Please ensure a class/grade is selected and contributing assessments have marks recorded for this academic session.
            </p>
          </div>
        )
      ) : (
        <>
          {/* Learner Context Summary Card */}
          {selectedStudent && (
            <div
              id="terminal-learner-card"
              className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs"
            >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {getStudentFullName(selectedStudent)}
                </h3>
                {selectedStudent.admission_number && (
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {selectedStudent.admission_number}
                  </span>
                )}
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isProvisionalMode
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  {isProvisionalMode ? 'Provisional Result' : 'Official Result'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>
                  Class: <strong className="text-slate-700 dark:text-slate-300">{selectedClassStream?.class_name} {selectedClassStream?.stream ? `(${selectedClassStream.stream})` : ''}</strong>
                </span>
                <span>•</span>
                <span>
                  Level: <strong className="text-slate-700 dark:text-slate-300">{selectedClassStream?.education_level || 'Junior School'}</strong>
                </span>
                <span>•</span>
                <span>
                  Session: <strong className="text-slate-700 dark:text-slate-300">{viewingYear?.year || '2026'} · {viewingTerm?.term_name || 'Term 1'}</strong>
                </span>
              </div>
            </div>

            {/* Metrics Chips (Complete, Incomplete, Contributing Assessments, Junior School Ranking) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Assessments
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {summaryMetrics.assessmentCount}
                </span>
              </div>

              <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  Complete
                </span>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                  {summaryMetrics.completeCount}
                </span>
              </div>

              {summaryMetrics.incompleteCount > 0 && (
                <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Incomplete
                  </span>
                  <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400">
                    {summaryMetrics.incompleteCount}
                  </span>
                </div>
              )}

              {isJuniorSchool && (
                <>
                  <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Terminal Total
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      {selectedLearnerRanking?.isRankable && selectedLearnerRanking.terminalTotalMarks !== null
                        ? `${selectedLearnerRanking.terminalTotalMarks} / ${selectedLearnerRanking.terminalTotalMaximum}`
                        : '—'}
                    </span>
                  </div>

                  <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {isProvisionalMode ? 'Prov. Stream Pos' : 'Stream Pos'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      {selectedLearnerRanking?.isRankable && selectedLearnerRanking.streamPosition !== null
                        ? `${selectedLearnerRanking.streamPosition} / ${selectedLearnerRanking.streamPositionDenominator}`
                        : '—'}
                    </span>
                  </div>

                  <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {isProvisionalMode ? 'Prov. Overall Pos' : 'Overall Pos'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      {selectedLearnerRanking?.overallPosition !== null
                        ? `${selectedLearnerRanking.overallPosition} / ${selectedLearnerRanking.overallPositionDenominator}`
                        : '—'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons: Preview Form, Download PDF, Batch Download PDF */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              id="preview-terminal-report-btn"
              onClick={() => setIsReportModalOpen(true)}
              disabled={contributingAssessments.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-50 transition shadow-2xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Preview Report Form</span>
            </button>

            <button
              id="download-terminal-report-btn"
              onClick={handleDownloadSinglePDF}
              disabled={isDownloadingSingle || contributingAssessments.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#176B45] hover:bg-[#125335] disabled:opacity-50 transition shadow-2xs cursor-pointer"
            >
              {isDownloadingSingle ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download PDF</span>
            </button>

            {classStudents.length > 1 && (
              <button
                id="batch-download-terminal-reports-btn"
                onClick={handleBatchDownloadPDF}
                disabled={isBatchDownloading || contributingAssessments.length === 0}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#176B45] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition shadow-2xs cursor-pointer"
              >
                {isBatchDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {isBatchDownloading && batchProgress
                    ? `Batch PDF (${batchProgress.current}/${batchProgress.total})`
                    : `Batch PDF (${classStudents.length} Learners)`}
                </span>
              </button>
            )}
          </div>

          {batchDownloadError && (
            <div
              id="terminal-batch-error-banner"
              className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{batchDownloadError}</span>
              </div>
              <button
                onClick={() => setBatchDownloadError(null)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline ml-3 shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Main Results Presentation Area */}
      {isLoading ? (
        <div
          id="terminal-loading-state"
          className="bg-white dark:bg-slate-900 rounded-xl p-12 border border-slate-200 dark:border-slate-800 text-center shadow-xs space-y-3"
        >
          <Loader2 className="w-8 h-8 text-[#176B45] animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Discovering Contributing Assessments…
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Querying authoritative assessments, stream approvals, learner marks, and resolution provenance.
          </p>
        </div>
      ) : discoveryError ? (
        <div
          id="terminal-error-state"
          className="bg-rose-50 dark:bg-rose-950/40 rounded-xl p-8 border border-rose-200 dark:border-rose-800 text-center shadow-xs space-y-3"
        >
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
          <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            Unable to Load Terminal Results
          </h4>
          <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto font-mono">
            {discoveryError}
          </p>
          <button
            onClick={loadTerminalResults}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Query</span>
          </button>
        </div>
      ) : !selectedStudent ? (
        <div
          id="terminal-no-student-state"
          className="bg-white dark:bg-slate-900 rounded-xl p-12 border border-slate-200 dark:border-slate-800 text-center shadow-xs space-y-2"
        >
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No Learner Selected
          </h4>
          <p className="text-xs text-slate-500">
            Select a class and learner above to view Terminal Results.
          </p>
        </div>
      ) : contributingAssessments.length === 0 ? (
        <div
          id="terminal-empty-assessments-state"
          className="bg-white dark:bg-slate-900 rounded-xl p-12 border border-dashed border-slate-200 dark:border-slate-800 text-center shadow-xs space-y-3"
        >
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No Contributing Assessments Discovered
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No {isProvisionalMode ? 'provisional or approved' : 'approved'} examinations were found for{' '}
            <strong>{selectedClassStream?.class_name}</strong> in {viewingYear?.year} {viewingTerm?.term_name}.
          </p>
          {isStaff && !isProvisionalMode && (
            <button
              onClick={() => setIsProvisionalMode(true)}
              className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold transition hover:bg-amber-100"
            >
              Check Provisional Mode
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <TerminalResultsTable
              subjects={applicableSubjects}
              contributingAssessments={contributingAssessments}
              resultsBySubject={resultsBySubject}
              onSelectSubjectForTrail={handleOpenTrail}
            />
          </div>

          {/* Mobile Adaptive Cards View */}
          <div className="block md:hidden space-y-3">
            {applicableSubjects.map((subject) => {
              const res = resultsBySubject.get(subject.id);
              return (
                <TerminalResultsCard
                  key={subject.id}
                  subject={subject}
                  contributingAssessments={contributingAssessments}
                  result={res}
                  onSelectTrail={() => {
                    if (res) handleOpenTrail(subject, res);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
        </>
      )}

      {/* 4. Assessment Trail Slide-Over Drawer */}
      <AssessmentTrailDrawer
        isOpen={isTrailOpen}
        onClose={handleCloseTrail}
        subject={trailSubject}
        result={trailResult}
      />

      {/* 5. Terminal Report Form & PDF Presentation Modal */}
      {selectedStudent && (
        <TerminalReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          student={selectedStudent}
          school={school}
          classStream={selectedClassStream || undefined}
          academicYear={viewingYear?.year || 2026}
          term={viewingTerm?.term_name || 'Term 1'}
          isProvisionalMode={isProvisionalMode}
          contributingAssessments={contributingAssessments}
          subjects={applicableSubjects}
          resultsBySubject={resultsBySubject}
          grades={grades}
          teachers={teachers}
          classes={classes}
          nextTermOpeningDate={(viewingTerm as any)?.next_term_opening_date || (viewingTerm as any)?.nextTermOpeningDate}
          ranking={selectedLearnerRanking || undefined}
        />
      )}
    </div>
  );
};
