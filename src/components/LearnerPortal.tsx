import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  User,
  BookOpen,
  Award,
  FileText,
  Lock,
  Building2,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Phone,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Loader2,
  CheckCircle,
  TrendingUp,
  Download,
} from 'lucide-react';
import {
  User as UserType,
  ClassStream,
  Subject,
  Teacher,
  Examination,
  School,
  Student,
  Mark,
  LearnerRankingMetadata,
  getEducationLevelForGrade,
  getShortCbeCode,
  getAllocatedSubjectsForClass,
  getStudentFullName,
  formatLearnerName,
} from '../types';
import { api, createSupabaseClient, isUUID } from '../lib/storage';
import { isStudentExamApproved } from '../utils/examLockUtils';
import { evaluateMark, getShortRemark } from '../utils/markUtils';
import { getGradeForMark } from '../services/analysisEngine';
import { getCbeGradeBadgeClass } from '../utils/gradeColorUtils';
import { downloadSingleReportCardPDF } from '../services/pdfReportGenerator';

interface LearnerPortalProps {
  currentUser: UserType;
  classes: ClassStream[];
  subjects: Subject[];
  teachers: Teacher[];
  exams: Examination[];
  school: School;
  marks?: Mark[];
  students?: Student[];
  allStudents?: Student[];
  onLogout?: () => void;
  onMarksUpdated?: () => void;
}

type LearnerTab = 'dashboard' | 'profile' | 'class-subjects' | 'marks' | 'report-card';

export const LearnerPortal: React.FC<LearnerPortalProps> = ({
  currentUser,
  classes,
  subjects,
  teachers,
  exams,
  school,
  marks: propMarks,
  students: propStudents,
  allStudents: propAllStudents,
  onLogout,
  onMarksUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<LearnerTab>('dashboard');
  const [remoteStudent, setRemoteStudent] = useState<Student | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Authoritative identity resolution strictly using currentUser.student_id
  const passedStudents = propStudents || propAllStudents || [];
  const allStudents = passedStudents.length > 0 ? passedStudents : api.getStudents();
  
  // Resolve studentId from currentUser.student_id or fallback to learner admission number from email
  const studentId = currentUser.student_id || (
    currentUser.role === 'learner' && currentUser.email
      ? allStudents.find((s) => {
          if (!s.admission_number) return false;
          const prefix = currentUser.email.split('@')[0].toLowerCase();
          const cleanAdm = s.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          return prefix === cleanAdm || s.admission_number.toLowerCase() === prefix;
        })?.id
      : undefined
  );

  const isStudentIdUuid = studentId ? isUUID(studentId) : false;
  const cachedStudent = studentId
    ? (isStudentIdUuid
        ? allStudents.find((s) => s.id === studentId)
        : allStudents.find((s) => s.id === studentId) || allStudents.find((s) => s.admission_number === studentId))
    : (currentUser.role === 'learner'
        ? allStudents.find((s) => {
            if (!s.admission_number || !currentUser.email) return false;
            const prefix = currentUser.email.split('@')[0].toLowerCase();
            const cleanAdm = s.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            return prefix === cleanAdm || s.admission_number.toLowerCase() === prefix;
          }) || (allStudents.length === 1 ? allStudents[0] : undefined)
        : undefined);

  const currentStudent = cachedStudent || remoteStudent || undefined;

  useEffect(() => {
    if (!cachedStudent && (studentId || currentUser.role === 'learner')) {
      let isMounted = true;
      setLoadingStudent(true);
      const fetchStudent = async () => {
        try {
          const client = createSupabaseClient();
          if (client) {
            let query = client.from('students').select('*');
            if (studentId) {
              if (isStudentIdUuid) {
                query = query.eq('id', studentId);
              } else {
                query = query.eq('admission_number', studentId);
              }
            } else if (currentUser.email) {
              const prefix = currentUser.email.split('@')[0];
              query = query.eq('admission_number', prefix);
            }
            const { data } = await query.limit(1);
            if (isMounted && data && data.length > 0) {
              setRemoteStudent(data[0] as Student);
              try {
                api.updateStudent(data[0] as Student);
                if (!currentUser.student_id && data[0].id) {
                  const updatedUser = { ...currentUser, student_id: data[0].id };
                  api.setCurrentUser(updatedUser);
                }
              } catch (_) {}
            }
          }
        } catch (err) {
          console.warn('Could not fetch student record:', err);
        } finally {
          if (isMounted) {
            setLoadingStudent(false);
          }
        }
      };
      fetchStudent();
      return () => {
        isMounted = false;
      };
    }
  }, [cachedStudent, studentId, isStudentIdUuid, currentUser]);

  // Derive authoritative placement details
  const studentFullName =
    getStudentFullName(currentStudent) ||
    formatLearnerName(currentStudent?.full_name) ||
    formatLearnerName(currentUser.name);

  const matchedClass =
    (currentStudent?.stream_id
      ? classes.find((c) => c.stream_id === currentStudent.stream_id || c.id === currentStudent.stream_id)
      : undefined) ||
    (currentStudent?.class_id
      ? classes.find((c) => c.id === currentStudent.class_id || c.stream_id === currentStudent.class_id)
      : undefined);

  const gradeName = currentStudent?.grade || matchedClass?.class_name || 'Unassigned Grade';
  const streamName = matchedClass?.stream || 'Default Stream';
  const fullClassName = matchedClass
    ? `${matchedClass.class_name} ${matchedClass.stream}`.trim()
    : `${gradeName} ${streamName}`.trim();

  const educationLevel =
    currentStudent?.education_level ||
    matchedClass?.education_level ||
    getEducationLevelForGrade(gradeName);

  const classTeacher = teachers.find(
    (t) =>
      (matchedClass && t.id === matchedClass.class_teacher_id) ||
      (matchedClass && (t.class_teacher_of_id === matchedClass.id || t.class_teacher_of_id === matchedClass.stream_id))
  );

  // Derive allocated learning areas for this learner's class
  const allocatedSubjects: Subject[] = useMemo(() => {
    return getAllocatedSubjectsForClass(matchedClass, subjects);
  }, [matchedClass, subjects]);

  // Find latest active assessment matching the learner's level/grade
  const activeExams = exams.filter(
    (e) => e.status !== 'Draft' && (!e.status || e.status === 'Published' || e.status === 'Approved' || e.status === 'Open')
  );
  const latestExam = activeExams.length > 0 ? activeExams[0] : null;

  // Active academic terms
  const currentAcademicYears = api.getAcademicYears();
  const currentTerms = api.getSchoolTerms();
  const activeYear = currentAcademicYears.find((y) => y.status === 'Active')?.year || new Date().getFullYear().toString();
  const activeTerm = currentTerms.find((t) => t.status === 'Active')?.term_name || 'Term 1';

  // --- PHASE 5B: AUTHORITATIVE "MY MARKS" DATA PIPELINE ---
  const studentClassOrStreamId = currentStudent?.stream_id || currentStudent?.class_id;

  // Filter only exams that are officially released/approved for this learner's class/stream
  const releasedExams = useMemo(() => {
    return exams
      .filter((e) => isStudentExamApproved(e, studentClassOrStreamId, classes))
      .sort((a, b) => {
        const dateA = a.start_date || a.date_created || `${a.year}-${a.term}`;
        const dateB = b.start_date || b.date_created || `${b.year}-${b.term}`;
        return dateB.localeCompare(dateA);
      });
  }, [exams, studentClassOrStreamId, classes]);

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    return releasedExams.length > 0 ? releasedExams[0].id : '';
  });
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const [marksLoading, setMarksLoading] = useState<boolean>(() => Boolean(releasedExams.length > 0));
  const [marksLoaded, setMarksLoaded] = useState<boolean>(false);
  const [marksError, setMarksError] = useState<string | null>(null);
  const [learnerMarks, setLearnerMarks] = useState<Mark[]>([]);
  const [rankingMetadata, setRankingMetadata] = useState<LearnerRankingMetadata | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Default / synchronize selectedExamId with available released exams
  useEffect(() => {
    if (releasedExams.length > 0) {
      if (!selectedExamId || !releasedExams.some((e) => e.id === selectedExamId)) {
        setSelectedExamId(releasedExams[0].id);
      }
    } else {
      setSelectedExamId('');
      setMarksLoading(false);
      setMarksLoaded(true);
    }
  }, [releasedExams, selectedExamId]);

  // Load authoritative cohort ranking metadata whenever selectedExamId changes
  useEffect(() => {
    if (!studentId || !selectedExamId) {
      setRankingMetadata(null);
      return;
    }
    let isMounted = true;
    const loadRanking = async () => {
      try {
        const metadata = await api.fetchLearnerExamRanking(selectedExamId);
        if (isMounted && metadata) {
          setRankingMetadata(metadata);
        }
      } catch (err) {
        console.warn('Could not fetch authoritative learner ranking metadata:', err);
      }
    };
    loadRanking();
    return () => {
      isMounted = false;
    };
  }, [studentId, selectedExamId, currentStudent?.id, retryTrigger]);

  // Load marks from authoritative backend / cache whenever selectedExamId or student changes
  useEffect(() => {
    if (!studentId || !selectedExamId) {
      setLearnerMarks([]);
      if (releasedExams.length === 0) {
        setMarksLoading(false);
        setMarksLoaded(true);
      } else {
        setMarksLoading(true);
        setMarksLoaded(false);
      }
      return;
    }

    let isMounted = true;
    const loadLearnerMarks = async () => {
      setMarksLoading(true);
      setMarksLoaded(false);
      setMarksError(null);
      try {
        const effectiveStudentId = currentStudent?.id || studentId;
        // Authoritatively fetch marks from Supabase
        await api.fetchMarksForExam(selectedExamId, { studentId: effectiveStudentId });
        const marks = await api.fetchMarksForLearner(effectiveStudentId, { examId: selectedExamId });
        if (isMounted) {
          const studentUuid = currentStudent?.id || studentId;
          const authoritativeStudentId = currentStudent?.id && isUUID(currentStudent.id)
            ? currentStudent.id
            : (studentId && isUUID(studentId) ? studentId : (currentStudent?.id || studentId));
          const isUuid = isUUID(authoritativeStudentId);
          const allCached = api.getMarks() || [];
          const combined = [...(marks || []), ...allCached];
          
          // Robust helper to match student marks by ID, UUID, or admission number
          const matchesStudent = (mStudentId: string | undefined | null) => {
            if (!mStudentId) return false;
            const str = String(mStudentId).trim().toLowerCase();
            if (currentStudent?.id && String(currentStudent.id).trim().toLowerCase() === str) return true;
            if (currentStudent?.admission_number && String(currentStudent.admission_number).trim().toLowerCase() === str) return true;
            if (studentId && String(studentId).trim().toLowerCase() === str) return true;
            if (effectiveStudentId && String(effectiveStudentId).trim().toLowerCase() === str) return true;
            if (currentUser?.student_id && String(currentUser.student_id).trim().toLowerCase() === str) return true;
            if (authoritativeStudentId && String(authoritativeStudentId).trim().toLowerCase() === str) return true;
            return false;
          };

          // Strictly filter to ensure only this learner's marks for this exam are isolated
          const filtered = combined.filter((m) => {
            const isMatchLearner = matchesStudent(m.student_id);
            const isMatchExam =
              m.exam_id === selectedExamId ||
              (selectedExam && (m.exam_id === selectedExam.id || m.exam_id === selectedExam.exam_code || m.exam_id === selectedExam.exam_name));
            return isMatchLearner && isMatchExam;
          });

          // Deduplicate by subject and exam ID
          const uniqueMarksMap = new Map<string, Mark>();
          filtered.forEach((m) => {
            const key = `${m.subject_id}_${m.exam_id}`;
            uniqueMarksMap.set(key, m);
          });
          
          setLearnerMarks(Array.from(uniqueMarksMap.values()));
          setMarksLoaded(true);
          setMarksError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Learner marks load error:', err);
          setMarksError('Unable to load assessment results. Please try again later or consult your class teacher.');
          setMarksLoaded(false);
        }
      } finally {
        if (isMounted) {
          setMarksLoading(false);
        }
      }
    };

    loadLearnerMarks();
    return () => {
      isMounted = false;
    };
  }, [studentId, selectedExamId, currentStudent?.id, currentStudent?.admission_number, selectedExam?.id, selectedExam?.exam_code, selectedExam?.exam_name, currentUser?.student_id, retryTrigger]);

  // Combined Authoritative Marks for Report Card (learnerMarks > api.getMarks() > propMarks)
  const combinedReportMarks = useMemo(() => {
    const authoritativeStudentId = currentStudent?.id && isUUID(currentStudent.id)
      ? currentStudent.id
      : (studentId && isUUID(studentId) ? studentId : (currentStudent?.id || studentId));

    const matchesStudent = (mStudentId: string | undefined | null) => {
      if (!mStudentId) return false;
      const str = String(mStudentId).trim().toLowerCase();
      if (currentStudent?.id && String(currentStudent.id).trim().toLowerCase() === str) return true;
      if (currentStudent?.admission_number && String(currentStudent.admission_number).trim().toLowerCase() === str) return true;
      if (studentId && String(studentId).trim().toLowerCase() === str) return true;
      if (currentUser?.student_id && String(currentUser.student_id).trim().toLowerCase() === str) return true;
      if (authoritativeStudentId && String(authoritativeStudentId).trim().toLowerCase() === str) return true;
      return false;
    };

    const markMap = new Map<string, Mark>();
    const processMark = (m: Mark) => {
      if (!matchesStudent(m.student_id)) return;
      const key = m.id || `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      markMap.set(key, m);
    };

    (propMarks || []).forEach(processMark);
    (api.getMarks() || []).forEach(processMark);
    (learnerMarks || []).forEach(processMark);
    return Array.from(markMap.values());
  }, [propMarks, learnerMarks, selectedExamId, currentStudent?.id, currentStudent?.admission_number, studentId, currentUser?.student_id]);

  // Evaluated assessment results view model
  const learnerAssessmentResults = useMemo(() => {
    if (!selectedExamId) return [];

    // Ensure all allocated subjects are included, plus any subjects present in active marks
    const activeMarks = combinedReportMarks.length > 0 ? combinedReportMarks : learnerMarks;
    const markSubjectIds = new Set(activeMarks.map((m) => m.subject_id));
    const extraSubjects = subjects.filter(
      (s) =>
        (markSubjectIds.has(s.id) || (s.subject_code && markSubjectIds.has(s.subject_code))) &&
        !allocatedSubjects.some((as) => as.id === s.id || (as.subject_code && as.subject_code === s.subject_code))
    );
    const allRelevantSubjects = [...allocatedSubjects, ...extraSubjects];

    const isSubjMatch = (mSubjId: string, sb: Subject) => {
      if (!mSubjId || !sb) return false;
      if (mSubjId === sb.id) return true;
      if (sb.subject_code && (mSubjId === sb.subject_code || mSubjId.toLowerCase() === sb.subject_code.toLowerCase())) return true;
      if (sb.subject_name && mSubjId.toLowerCase() === sb.subject_name.toLowerCase()) return true;
      if (sb.subject_code && getShortCbeCode(mSubjId) === getShortCbeCode(sb.subject_code)) return true;
      return subjects.some((s) => s.id === mSubjId && (s.id === sb.id || (s.subject_code && sb.subject_code && (s.subject_code === sb.subject_code || getShortCbeCode(s.subject_code) === getShortCbeCode(sb.subject_code)))));
    };

    return allRelevantSubjects.map((sb) => {
      const rawMark = activeMarks.find(
        (m) =>
          isSubjMatch(m.subject_id, sb) &&
          (m.exam_id === selectedExamId ||
            (selectedExam && (m.exam_id === selectedExam.id || m.exam_id === selectedExam.exam_code || m.exam_id === selectedExam.exam_name)))
      );
      const evaluated = evaluateMark(rawMark);
      const grade = evaluated.percentage !== null ? getGradeForMark(evaluated.percentage) : undefined;
      const level = grade?.performance_level || (evaluated.status === 'X' ? 'X' : evaluated.status === 'Y' ? 'Y' : '—');
      const gradeCode = grade?.grade_code || grade?.grade || (evaluated.status === 'X' ? 'X' : evaluated.status === 'Y' ? 'Y' : '—');
      const descriptor =
        grade?.descriptor ??
        (evaluated.status === 'X'
          ? 'Missing Mark'
          : evaluated.status === 'Y'
          ? evaluated.irregularityReason || 'Absent'
          : 'Not Recorded');
      const shortRemark = getShortRemark(grade?.remarks || descriptor, gradeCode);

      return {
        subject: sb,
        subjectId: sb.id || sb.subject_code || '',
        subjectName: sb.subject_name || sb.name || 'Learning Area',
        subjectCode: sb.subject_code || sb.code || '',
        category: sb.category || sb.department || '',
        mark: rawMark,
        evaluated,
        grade,
        rawScore: evaluated.rawScore,
        outOf: evaluated.outOf,
        percentage: evaluated.percentage,
        status: evaluated.status,
        irregularityReason: evaluated.irregularityReason,
        level,
        gradeCode,
        points: grade?.points ?? null,
        descriptor,
        shortRemark,
        remarks: grade?.remarks ?? '',
        hasRecordedMark: rawMark !== undefined && evaluated.status !== 'Blank',
      };
    });
  }, [allocatedSubjects, combinedReportMarks, learnerMarks, selectedExamId, selectedExam, subjects]);

  // Pipeline summary statistics
  const pipelineStats = useMemo(() => {
    const normalResults = learnerAssessmentResults.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );
    const recordedCount = normalResults.length;
    const totalAllocated = allocatedSubjects.length > 0 ? allocatedSubjects.length : learnerAssessmentResults.length;
    const totalScore = normalResults.reduce(
      (sum, r) => sum + Math.round(r.evaluated.percentage || 0),
      0
    );
    const totalMaxScore = recordedCount * 100;
    const averagePercentage = recordedCount > 0 ? Math.round(totalScore / recordedCount) : 0;
    const totalPoints = learnerAssessmentResults.reduce((sum, r) => sum + (r.points || 0), 0);
    const maxPoints = totalAllocated * 8;
    const meanGrade = recordedCount > 0 ? getGradeForMark(averagePercentage) : null;
    const specialStatusCount = learnerAssessmentResults.filter(
      (r) => r.evaluated.status === 'X' || r.evaluated.status === 'Y'
    ).length;
    const isComplete = totalAllocated > 0 && recordedCount === totalAllocated && specialStatusCount === 0;

    return {
      totalAllocated,
      recordedCount,
      totalRawScore: totalScore,
      totalScore,
      totalMaxScore,
      averagePercentage,
      totalPoints,
      maxPoints,
      meanGrade,
      specialStatusCount,
      isComplete,
    };
  }, [learnerAssessmentResults, allocatedSubjects.length]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadReportCardPdf = async () => {
    if (!currentStudent || !selectedExam) return;
    setIsDownloadingPdf(true);
    try {
      await downloadSingleReportCardPDF({
        student: currentStudent,
        school,
        exam: selectedExam,
        allExams: exams,
        classes,
        subjects,
        marks: combinedReportMarks,
        grades: api.getGrades(),
        teachers,
        allStudents,
        aggregateRanking: rankingMetadata || undefined,
      });
    } catch (err) {
      console.error('Failed to generate report card PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // If student is not linked or not found, display clear error states
  if (!studentId) {
    return (
      <div id="learner-unlinked-state" className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Learner Account Not Linked
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6">
            Your learner account is not linked to an active student record.
          </p>
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-left max-w-lg mx-auto mb-6 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-500" /> Administrative Action Required:
            </p>
            <p>1. Contact your Class Teacher or School Administrator.</p>
            <p>2. Request that your student admission profile be linked to your learner user account.</p>
          </div>
          {onLogout && (
            <button
              id="btn-learner-unlinked-logout"
              onClick={onLogout}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loadingStudent) {
    return (
      <div id="learner-loading-state" className="max-w-3xl mx-auto py-24 px-4 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#176B45]/10 text-[#176B45] mb-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading learner academic profile...
        </p>
      </div>
    );
  }

  if (!currentStudent) {
    return (
      <div id="learner-not-found-state" className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Student Record Unavailable
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6">
            We could not find an active student record for your account. Please contact your Class Teacher or School Administrator.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              id="btn-learner-refresh"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors shadow-sm"
            >
              Refresh Page
            </button>
            {onLogout && (
              <button
                id="btn-learner-notfound-logout"
                onClick={onLogout}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-medium rounded-xl text-sm transition-colors shadow-sm"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Gating for Inactive / Transferred Learner (Phase 6D.7.1)
  if (currentStudent.active === false || currentUser.status === 'Disabled') {
    const studentDisplayName =
      getStudentFullName(currentStudent) ||
      formatLearnerName(currentStudent.full_name) ||
      formatLearnerName(currentUser.name);

    return (
      <div id="learner-inactive-state" className="max-w-2xl mx-auto py-16 px-4">
        <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800/60">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Learner Account Inactive
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
            The learner account for <span className="font-semibold text-slate-900 dark:text-white">{studentDisplayName}</span> (<span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">{currentStudent.admission_number}</span>) is currently marked as inactive or transferred.
          </p>
          <div className="bg-white dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-4 text-left max-w-md mx-auto mb-6 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Administrative Notice</span>
            </div>
            <p>• Contact the school administration or your class teacher if you require assistance.</p>
            <p>• All academic history and past assessment records remain safely archived.</p>
          </div>
          {onLogout && (
            <button
              id="btn-learner-inactive-logout"
              onClick={onLogout}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="learner-portal-container" className="w-full space-y-6">
      {/* Top Learner Header & Identity Banner */}
      <div
        id="learner-header-banner"
        className="bg-gradient-to-r from-[#0F3D2E] via-[#14533C] to-[#1E6B4E] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-300" />
              Learner Portal • CBC / CBE 2026
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome, {studentFullName}
            </h1>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-emerald-100/90">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="opacity-75">Admission No:</span>
                <span className="font-semibold bg-white/10 px-2 py-0.5 rounded text-white">
                  {currentStudent.admission_number}
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="opacity-75">Class:</span>
                <span className="font-semibold text-white">{fullClassName}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className="opacity-75">Level:</span>
                <span className="text-emerald-200">{educationLevel}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-right">
              <div className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">Academic Session</div>
              <div className="text-base font-bold text-white">
                {activeYear} • {activeTerm}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div
        id="learner-tab-navigation"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm flex flex-wrap items-center gap-1.5"
      >
        <button
          id="tab-learner-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-[#0F3D2E] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </button>

        <button
          id="tab-learner-profile"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-[#0F3D2E] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <User className="w-4 h-4" />
          My Profile
        </button>

        <button
          id="tab-learner-class-subjects"
          onClick={() => setActiveTab('class-subjects')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'class-subjects'
              ? 'bg-[#0F3D2E] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          My Class & Learning Areas
        </button>

        <button
          id="tab-learner-marks"
          onClick={() => setActiveTab('marks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'marks'
              ? 'bg-[#0F3D2E] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-4 h-4" />
          My Marks
        </button>

        <button
          id="tab-learner-reports"
          onClick={() => setActiveTab('report-card')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'report-card'
              ? 'bg-[#0F3D2E] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Report Card</span>
        </button>
      </div>

      {/* VIEW: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div id="learner-dashboard-view" className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  My Class
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {fullClassName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Stream: <span className="font-medium text-slate-700 dark:text-slate-200">{streamName}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Class Teacher
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
                {classTeacher?.teacher_name || 'Not Assigned'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Learning Areas
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {allocatedSubjects.length} Registered
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Level: <span className="font-medium text-slate-700 dark:text-slate-200">{educationLevel}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Latest Assessment
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
                {latestExam ? latestExam.exam_name : 'Term 1 Assessment'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Status: <span className="font-medium text-emerald-600 dark:text-emerald-400">{latestExam?.status || 'Scheduled'}</span>
              </div>
            </div>
          </div>

          {/* Quick Academic Snapshot & CBE Guidelines */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    My Registered Learning Areas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Curriculum areas assigned to {fullClassName} for {activeYear}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('class-subjects')}
                  className="text-xs font-semibold text-[#0F3D2E] dark:text-emerald-400 hover:underline"
                >
                  View All Details →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {allocatedSubjects.slice(0, 6).map((sb) => (
                  <div
                    key={sb.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {sb.subject_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Code: {sb.subject_code} • {sb.category || 'Core'}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Enrolled
                    </span>
                  </div>
                ))}
              </div>

              {allocatedSubjects.length > 6 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setActiveTab('class-subjects')}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    + {allocatedSubjects.length - 6} more learning areas in your schedule
                  </button>
                </div>
              )}
            </div>

            {/* School & Learner Status Info Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Enrolment Standing</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Active Learner
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    You are currently registered as an active learner at this school.
                  </p>
                </div>

                <div className="pt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Institution:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                      {school.school_name || 'CBE School'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">County:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {school.county || 'National'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Notice to Learners
                </div>
                <p>Your marks and official report cards will appear here when they have been released by the school.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MY PROFILE */}
      {activeTab === 'profile' && (
        <div id="learner-profile-view" className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#0F3D2E] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                  {studentFullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {studentFullName}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Official Student Profile • Admission No: {currentStudent.admission_number}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {currentStudent.active !== false ? 'Active Student Record' : 'Inactive'}
              </div>
            </div>

            {/* Read-Only Profile Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Personal Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                  Personal Details
                </h3>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Full Name</span>
                    <div className="font-semibold text-slate-900 dark:text-white">{studentFullName}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Admission Number</span>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {currentStudent.admission_number}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Gender</span>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {currentStudent.gender === 'M' || (currentStudent.gender as string) === 'Boy'
                          ? 'Male'
                          : currentStudent.gender === 'F' || (currentStudent.gender as string) === 'Girl'
                          ? 'Female'
                          : currentStudent.gender || 'Not Specified'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Placement Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                  Academic Placement
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Class Grade</span>
                      <div className="font-semibold text-slate-900 dark:text-white">{gradeName}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Assigned Stream</span>
                      <div className="font-semibold text-slate-900 dark:text-white">{streamName}</div>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Education Level</span>
                    <div className="font-semibold text-slate-900 dark:text-white">{educationLevel}</div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Class Teacher</span>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {classTeacher ? classTeacher.teacher_name : 'No Class Teacher Assigned'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Account
              </h3>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Learner Account
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Your learner account is securely linked to your official school record.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p>
                  Your name, class and admission details are managed by the school administration. If any information is incorrect, please contact your Class Teacher.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MY CLASS & LEARNING AREAS */}
      {activeTab === 'class-subjects' && (
        <div id="learner-class-subjects-view" className="space-y-6">
          {/* Class Summary Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                Official Class Allocation
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {fullClassName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Education Level: <span className="font-semibold text-slate-700 dark:text-slate-300">{educationLevel}</span> • Enrolled Learning Areas: <span className="font-semibold text-slate-700 dark:text-slate-300">{allocatedSubjects.length}</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-sm space-y-1">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Class Teacher
              </div>
              <div className="font-bold text-slate-900 dark:text-white">
                {classTeacher ? classTeacher.teacher_name : 'Not Assigned'}
              </div>
            </div>
          </div>

          {/* Learning Areas List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Curriculum Learning Areas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Curriculum subjects registered for your class and stream
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                {allocatedSubjects.length} Active Subjects
              </span>
            </div>

            {allocatedSubjects.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                No learning areas are currently allocated for this class stream.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {allocatedSubjects.map((sb, idx) => {
                  // Find subject teacher allocation for this class
                  const subjectTeacher = teachers.find((t) =>
                    t.allocations?.some(
                      (a) =>
                        (a.subject_id === sb.id || a.subject_code === sb.subject_code) &&
                        (matchedClass
                          ? a.class_id === matchedClass.id ||
                            a.stream_id === matchedClass.stream_id ||
                            (a.class_name === matchedClass.class_name && a.stream === matchedClass.stream)
                          : true)
                    )
                  );

                  return (
                    <div
                      key={sb.id || idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-base">
                            {sb.subject_name}
                          </span>
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {sb.subject_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>Category: <span className="font-medium text-slate-700 dark:text-slate-300">{sb.category || 'Core'}</span></span>
                          <span>•</span>
                          <span>Level: <span className="font-medium text-slate-700 dark:text-slate-300">{sb.education_level || educationLevel}</span></span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Subject Teacher:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {subjectTeacher ? subjectTeacher.teacher_name : 'Assigned by Stream'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: MY MARKS (ASSESSMENT RESULTS REDESIGNED) */}
      {activeTab === 'marks' && (
        <div id="learner-marks-view" className="space-y-6">
          {/* Assessment Header & Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Official School Record
                  </span>
                  {fullClassName && (
                    <>
                      <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {fullClassName} {streamName ? `(${streamName})` : ''}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {selectedExam ? `${selectedExam.exam_name} — ${selectedExam.term}, ${selectedExam.year}` : 'Assessment Results'}
                </h2>
              </div>

              {releasedExams.length > 1 && (
                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <label htmlFor="select-learner-exam" className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Assessment:
                  </label>
                  <select
                    id="select-learner-exam"
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors shadow-xs cursor-pointer"
                  >
                    {releasedExams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.exam_name} ({e.term} {e.year})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Condition 1: No Released Assessments */}
          {releasedExams.length === 0 && (
            <div id="learner-no-released-exams" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  No released assessment results are available yet.
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Official results will appear here as soon as assessments for your class stream are reviewed and published by your teachers.
                </p>
              </div>
            </div>
          )}

          {/* Condition 2: Loading State (Polished Skeleton + Loading Indicator) */}
          {releasedExams.length > 0 && (marksLoading || !marksLoaded) && !marksError && (
            <div id="learner-marks-loading" className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Loading your assessment results…
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Fetching official performance records from the academic database
                </p>
              </div>
              {/* Skeleton Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                    <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condition 3: Error State */}
          {releasedExams.length > 0 && marksError && !marksLoading && (
            <div id="learner-marks-error" className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-6 text-center shadow-sm space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Failed to Load Marks
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
                {marksError}
              </p>
              <button
                id="btn-retry-learner-marks"
                onClick={() => {
                  setMarksLoaded(false);
                  setMarksLoading(true);
                  setMarksError(null);
                  setRetryTrigger((c) => c + 1);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Retry Loading
              </button>
            </div>
          )}

          {/* Condition 4: Released Exam Selected & No Marks Recorded */}
          {releasedExams.length > 0 && !marksLoading && marksLoaded && !marksError && !learnerAssessmentResults.some((r) => r.hasRecordedMark) && (
            <div id="learner-no-marks-recorded" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Info className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  No marks recorded for this assessment yet.
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Results for <span className="font-semibold">{selectedExam?.exam_name}</span> have not yet been entered for your student profile.
                </p>
              </div>
            </div>
          )}

          {/* Condition 5: Active Results Screen (OVERALL PERFORMANCE + LEARNING AREA PERFORMANCE) */}
          {releasedExams.length > 0 && !marksLoading && marksLoaded && !marksError && learnerAssessmentResults.some((r) => r.hasRecordedMark) && (
            <div id="learner-marks-pipeline-status" className="space-y-6">
              
              {/* SECTION 1: OVERALL PERFORMANCE */}
              <div id="learner-overall-performance" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Overall Performance
                    </h3>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedExam?.exam_name}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {pipelineStats.isComplete ? 'Complete' : `Incomplete (${pipelineStats.recordedCount}/${pipelineStats.totalAllocated} Assessed)`}
                  </div>
                </div>

                {/* Main Performance Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Metric 1: Total Score */}
                  <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Score
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {pipelineStats.totalRawScore}
                      </span>
                      <span className="text-base font-semibold text-slate-400 dark:text-slate-500">
                        / {pipelineStats.totalMaxScore}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Aggregated assessment marks
                    </div>
                  </div>

                  {/* Metric 2: Average Percentage */}
                  <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      Average Percentage
                    </div>
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
                      {Math.round(pipelineStats.averagePercentage)}%
                    </div>
                    <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                      Mean score across learning areas
                    </div>
                  </div>

                  {/* Metric 3: Overall CBE Grade & Level */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                    <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                      Overall CBE Level
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-indigo-700 dark:text-indigo-400">
                        {pipelineStats.meanGrade?.grade_code || '—'}
                      </span>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 truncate">
                        {pipelineStats.meanGrade?.descriptor || 'Exceeding Expectations'}
                      </span>
                    </div>
                    <div className="text-xs text-indigo-700/80 dark:text-indigo-400/80 truncate">
                      {pipelineStats.meanGrade?.performance_level || 'CBE Performance Band'}
                    </div>
                  </div>

                  {/* Metric 4: Total Points */}
                  <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-1.5">
                    <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Total Points
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
                        {pipelineStats.totalPoints}
                      </span>
                      <span className="text-base font-semibold text-amber-600/70 dark:text-amber-400/70">
                        / {pipelineStats.maxPoints} points
                      </span>
                    </div>
                    <div className="text-xs text-amber-700/80 dark:text-amber-400/80">
                      Sum of CBE subject points
                    </div>
                  </div>
                </div>

                {/* Special Status Note if any X/Y marks */}
                {pipelineStats.specialStatusCount > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      Note: {pipelineStats.specialStatusCount} learning area(s) have special status notations (such as Missing Mark or Excused Absence).
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 2: LEARNING AREA PERFORMANCE */}
              <div id="learner-learning-area-performance" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Learning Area Performance
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Subject-by-subject evaluation according to CBE assessment standards
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 self-start sm:self-auto">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{pipelineStats.recordedCount} of {learnerAssessmentResults.length} Learning Areas</span>
                  </div>
                </div>

                {/* Desktop & Tablet Table */}
                <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        <th className="py-3.5 px-5">Learning Area</th>
                        <th className="py-3.5 px-5 text-center">Score</th>
                        <th className="py-3.5 px-5 text-center">%</th>
                        <th className="py-3.5 px-5 text-center">Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                      {learnerAssessmentResults.map((item, idx) => {
                        const isNormal = item.status === 'Normal' && item.percentage !== null;
                        const isMissing = item.status === 'X';
                        const isAbsent = item.status === 'Y';

                        return (
                          <tr
                            key={item.subject?.id || item.subjectId || item.subjectCode || `mark-row-${idx}`}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                              !item.hasRecordedMark ? 'opacity-60 bg-slate-50/30 dark:bg-slate-900/40' : ''
                            }`}
                          >
                            {/* Learning Area */}
                            <td className="py-4 px-5">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {item.subjectName}
                              </div>
                              {item.category && (
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                  {item.category}
                                </div>
                              )}
                            </td>

                            {/* Score */}
                            <td className="py-4 px-5 text-center whitespace-nowrap">
                              {isNormal ? (
                                <div className="font-medium text-slate-900 dark:text-white">
                                  <span className="font-bold">{item.rawScore}</span>
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">/{item.outOf}</span>
                                </div>
                              ) : isMissing ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs">
                                  X — Missing Mark
                                </span>
                              ) : isAbsent ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs">
                                  Y — Absent
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-mono">—</span>
                              )}
                            </td>

                            {/* Percentage */}
                            <td className="py-4 px-5 text-center whitespace-nowrap">
                              {isNormal ? (
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {Math.round(item.percentage!)}%
                                </div>
                              ) : isMissing ? (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold text-xs">Missing</span>
                              ) : isAbsent ? (
                                <span className="text-purple-600 dark:text-purple-400 font-semibold text-xs">Absent</span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-mono">—</span>
                              )}
                            </td>

                            {/* Level */}
                            <td className="py-4 px-5 text-center whitespace-nowrap">
                              {isNormal ? (
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${getCbeGradeBadgeClass(
                                    item.gradeCode
                                  )}`}
                                >
                                  {item.gradeCode}
                                </span>
                              ) : isMissing ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  X
                                </span>
                              ) : isAbsent ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                  Y
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-mono">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View (sm:hidden) */}
                <div className="sm:hidden space-y-3">
                  {learnerAssessmentResults.map((item, idx) => {
                    const isNormal = item.status === 'Normal' && item.percentage !== null;
                    const isMissing = item.status === 'X';
                    const isAbsent = item.status === 'Y';

                    return (
                      <div
                        key={item.subject?.id || item.subjectId || item.subjectCode || `mark-mob-${idx}`}
                        className={`p-4 rounded-xl border transition-all ${
                          !item.hasRecordedMark
                            ? 'bg-slate-50/40 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 opacity-70'
                            : isMissing
                            ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                            : isAbsent
                            ? 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {item.subjectName}
                            </div>
                            {item.category && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {item.category}
                              </div>
                            )}
                          </div>
                          {isNormal ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold shrink-0 ${getCbeGradeBadgeClass(
                                item.gradeCode
                              )}`}
                            >
                              {item.gradeCode}
                            </span>
                          ) : isMissing ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                              X
                            </span>
                          ) : isAbsent ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                              Y
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono shrink-0">—</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                          <div className="text-slate-500 dark:text-slate-400">
                            Score:{' '}
                            <span className="font-bold text-slate-900 dark:text-white">
                              {isNormal ? `${item.rawScore}/${item.outOf}` : isMissing ? 'X — Missing' : isAbsent ? 'Y — Absent' : '—'}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            Percentage:{' '}
                            <span className="font-bold text-slate-900 dark:text-white">
                              {isNormal ? `${Math.round(item.percentage!)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary Status */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">Assessment Records:</span>
                    <span>{pipelineStats.recordedCount} recorded learning area evaluation{pipelineStats.recordedCount === 1 ? '' : 's'}</span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Verified by School</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: REPORT CARD (PHASE 6) */}
      {activeTab === 'report-card' && (
        <div id="learner-report-card-view" className="space-y-6">
          {/* Header & Assessment Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Officially Released
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Summative Report Card
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {selectedExam ? `${selectedExam.exam_name} — ${selectedExam.term || 'Term 2'}, ${selectedExam.year || '2026'}` : 'Summative Assessment Report Card'}
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  <span>Class: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{fullClassName}</strong></span>
                  <span>•</span>
                  <span>Class Teacher: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{classTeacher ? classTeacher.teacher_name : 'Not Assigned'}</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {releasedExams.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="report-exam-select" className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      Assessment:
                    </label>
                    <select
                      id="report-exam-select"
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0F3D2E] focus:outline-none"
                    >
                      {releasedExams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.exam_name} ({ex.term || 'Term 2'} {ex.year || '2026'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  id="btn-download-learner-report-card"
                  onClick={handleDownloadReportCardPdf}
                  disabled={isDownloadingPdf || !selectedExam}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F3D2E] hover:bg-[#14533C] text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  title="Download the official full formal PDF report card"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isDownloadingPdf ? 'Generating PDF…' : 'Download Official Report Card'}</span>
                </button>
              </div>
            </div>
          </div>

          {releasedExams.length === 0 ? (
            <div id="learner-no-reports-card" className="max-w-2xl mx-auto py-12">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/60">
                  <FileText className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    No Released Report Cards Yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Official summative report cards will appear here once examination results are approved and released by school administration.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-[#0F3D2E] hover:bg-[#14533C] text-white text-xs font-semibold rounded-xl transition shadow-xs"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (marksLoading || !marksLoaded || !selectedExamId) ? (
            <div id="learner-report-card-loading" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Loading your report card…
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Retrieving official summative assessment results and competency evaluations from the school database.
              </p>
            </div>
          ) : marksError ? (
            <div id="learner-report-card-error" className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-8 text-center shadow-sm space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
              <h4 className="text-base font-bold text-rose-900 dark:text-rose-200">
                Unable to Load Report Card
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
                {marksError}
              </p>
              <button
                id="btn-retry-learner-report-card"
                onClick={() => {
                  setMarksLoaded(false);
                  setMarksLoading(true);
                  setMarksError(null);
                  setRetryTrigger((c) => c + 1);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Performance Card Grid */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Overall Performance
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    8-Point KNEC CBE Scale
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 sm:gap-4">
                  {/* 1. Total Score */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Total Score
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {pipelineStats.totalRawScore} <span className="text-xs font-normal text-slate-400">/ {pipelineStats.totalMaxScore}</span>
                    </div>
                  </div>

                  {/* 2. Average Percentage */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Average
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {pipelineStats.averagePercentage !== null ? `${Math.round(pipelineStats.averagePercentage)}%` : '—'}
                    </div>
                  </div>

                  {/* 3. CBE Level */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      CBE Level
                    </div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                      {pipelineStats.meanGrade ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${getCbeGradeBadgeClass(pipelineStats.meanGrade.grade_code)}`}>
                            {pipelineStats.meanGrade.grade_code}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {pipelineStats.meanGrade.performance_level}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  {/* 4. Total Points */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Total Points
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {pipelineStats.totalPoints} <span className="text-xs font-normal text-slate-400">/ {pipelineStats.maxPoints} points</span>
                    </div>
                  </div>

                  {/* 5. Stream Rank */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Stream Rank
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {rankingMetadata?.stream_rank ? (
                        <>
                          {rankingMetadata.stream_rank}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            of {rankingMetadata.stream_total}
                          </span>
                        </>
                      ) : rankingMetadata?.is_complete === false ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Provisional</span>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  {/* 6. Overall Rank */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Overall Rank
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {rankingMetadata?.overall_rank ? (
                        <>
                          {rankingMetadata.overall_rank}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            of {rankingMetadata.overall_total}
                          </span>
                        </>
                      ) : rankingMetadata?.is_complete === false ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Provisional</span>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  {/* 7. Status */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1 col-span-2 sm:col-span-1 lg:col-span-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Status
                    </div>
                    <div className="text-base sm:text-lg font-bold">
                      {pipelineStats.isComplete ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold text-sm">
                          <Clock className="w-4 h-4" /> Provisional
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Learning Area Performance Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Learning Area Performance
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {learnerAssessmentResults.length} Learning Area{learnerAssessmentResults.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Desktop & Tablet Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Learning Area</th>
                        <th className="py-3 px-4 text-center">Score</th>
                        <th className="py-3 px-4 text-center">%</th>
                        <th className="py-3 px-4 text-center">Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {learnerAssessmentResults.map((item, idx) => (
                        <tr key={item.subjectId || item.subject?.id || item.subjectCode || `rep-row-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                            <div>{item.subjectName}</div>
                            {item.subjectCode && (
                              <div className="text-[11px] font-normal text-slate-400">Code: {item.subjectCode}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.status === 'Normal' && item.rawScore !== null ? `${item.rawScore}/${item.outOf}` : item.status === 'X' ? 'X' : item.status === 'Y' ? 'Y' : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                            {item.status === 'Normal' && item.percentage !== null ? `${Math.round(item.percentage)}%` : item.status === 'X' ? 'X' : item.status === 'Y' ? 'Y' : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.gradeCode ? (
                              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${getCbeGradeBadgeClass(item.gradeCode)}`}>
                                {item.gradeCode}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                  {learnerAssessmentResults.map((item, idx) => (
                    <div
                      key={item.subjectId || item.subject?.id || item.subjectCode || `rep-mob-${idx}`}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.subjectName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.status === 'Normal' && item.rawScore !== null
                            ? `${item.rawScore}/${item.outOf} · ${Math.round(item.percentage ?? 0)}%`
                            : item.status === 'X' ? 'Missing Assessment (X)' : item.status === 'Y' ? 'Absent (Y)' : 'Pending'}
                        </div>
                      </div>
                      <div>
                        {item.gradeCode ? (
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${getCbeGradeBadgeClass(item.gradeCode)}`}>
                            {item.gradeCode}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Summary */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">Assessment Records:</span>
                    <span>{pipelineStats.recordedCount} recorded learning area evaluation{pipelineStats.recordedCount === 1 ? '' : 's'}</span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Verified by School</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
