import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Users,
  FileBarChart,
  Calendar,
  Award,
  TrendingUp,
  Search,
  Filter,
  Layers,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Info,
  Check,
  AlertTriangle,
  X,
  Printer,
  Compass,
  CheckCircle2,
  Clock4,
} from 'lucide-react';
import {
  Teacher,
  ClassStream,
  Subject,
  Examination,
  Mark,
  Student,
  Grade,
  User,
  getStudentFullName,
} from '../types';
import { formatGreetingFirstName } from '../utils/greetingUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { TeacherExamReminderBanner } from './TeacherExamReminderBanner';
import { computeTeacherExamReminder } from '../utils/teacherExamReminderUtils';

interface SubjectTeacherCockpitProps {
  teacher: Teacher;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  students: Student[];
  grades?: Grade[];
  onNavigate: (tab: any) => void;
  currentUser?: User | null;
}

interface AllocationProgress {
  allocationKey: string;
  subject: Subject;
  classStream: ClassStream;
  classLabel: string;
  totalStudents: number;
  enteredMarksCount: number;
  missingCount: number;
  percentage: number;
  status: 'Complete' | 'In Progress' | 'Not Started' | 'Locked';
  exam: Examination | null;
}

export const SubjectTeacherCockpit: React.FC<SubjectTeacherCockpitProps> = ({
  teacher,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  students = [],
  grades = [],
  onNavigate,
  currentUser,
}) => {
  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();

  // Modal view state
  const [activeModal, setActiveModal] = useState<'none' | 'classes' | 'subjects' | 'classList'>('none');
  const [selectedClassForList, setSelectedClassForList] = useState<ClassStream | null>(null);
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'needs_attention' | 'complete'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExamReminderDismissed, setIsExamReminderDismissed] = useState(false);

  // Compute Intelligent Examination Reminder for Teacher
  const examReminder = useMemo(() => {
    return computeTeacherExamReminder({
      teacher,
      currentUser,
      exams,
      classes,
      subjects,
      students,
      marks,
      activeYear: activeYearObj,
      activeTerm: activeTermObj,
    });
  }, [teacher, currentUser, exams, classes, subjects, students, marks, activeYearObj, activeTermObj]);

  const handleReminderNavigate = (tab: string, context?: { examId?: string; classId?: string; streamId?: string; subjectId?: string }) => {
    if (context && tab === 'marks-entry') {
      try {
        if (context.streamId || context.classId) {
          sessionStorage.setItem('cbe_marks_workflow_class', context.streamId || context.classId || '');
        }
        if (context.subjectId) {
          sessionStorage.setItem('cbe_marks_workflow_subject', context.subjectId);
        }
        if (context.examId) {
          sessionStorage.setItem('cbe_marks_workflow_exam', context.examId);
        }
      } catch (e) {
        console.warn('Session storage write error:', e);
      }
    }
    onNavigate(tab);
  };

  // 1. Resolve Active Examination for Current Session
  const activeExam = useMemo(() => {
    if (!exams || exams.length === 0) return null;
    const matchCurrent = exams.find(
      (e) =>
        e.year === activeYearObj?.year &&
        e.term === activeTermObj?.term_name &&
        (e.status === 'Open' || e.status === 'Provisional' || e.status === 'Draft')
    );
    if (matchCurrent) return matchCurrent;

    const matchApprovedCurrent = exams.find(
      (e) =>
        e.year === activeYearObj?.year &&
        e.term === activeTermObj?.term_name &&
        e.status === 'Approved'
    );
    if (matchApprovedCurrent) return matchApprovedCurrent;

    return exams.find((e) => e.status !== 'Archived') || exams[0] || null;
  }, [exams, activeYearObj?.year, activeTermObj?.term_name]);

  // 2. Teacher Initials & Display Name
  const teacherInitials = useMemo(() => {
    if (!teacher?.teacher_name) return 'TR';
    const parts = teacher.teacher_name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'TR';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [teacher?.teacher_name]);

  // 3. Unique Assigned Classes for this Teacher
  const uniqueAssignedClasses = useMemo(() => {
    const map = new Map<string, { cls: ClassStream; studentCount: number; allocations: any[] }>();
    (teacher.allocations || []).forEach((alloc) => {
      const cls =
        (alloc.stream_id
          ? classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id)
          : undefined) ||
        (alloc.stream
          ? classes.find(
              (c) =>
                (c.class_name === alloc.class_name || c.id === alloc.class_id) &&
                c.stream.toLowerCase() === alloc.stream.toLowerCase()
            )
          : undefined) ||
        classes.find((c) => c.id === alloc.class_id);

      if (cls) {
        const key = cls.id + (cls.stream_id || '');
        if (map.has(key)) {
          map.get(key)!.allocations.push(alloc);
        } else {
          const count = (students || []).filter(
            (s) => (cls.stream_id ? s.stream_id === cls.stream_id : s.class_id === cls.id)
          ).length;
          map.set(key, { cls, studentCount: count, allocations: [alloc] });
        }
      }
    });
    return Array.from(map.values());
  }, [teacher.allocations, classes, students]);

  // 4. Unique Assigned Subjects for this Teacher
  const uniqueAssignedSubjects = useMemo(() => {
    const map = new Map<string, { subject: Subject; allocations: any[] }>();
    (teacher.allocations || []).forEach((alloc) => {
      const subj = subjects.find((s) => s.id === alloc.subject_id);
      if (subj) {
        const existing = map.get(subj.id);
        if (existing) {
          existing.allocations.push(alloc);
        } else {
          map.set(subj.id, { subject: subj, allocations: [alloc] });
        }
      }
    });
    return Array.from(map.values());
  }, [teacher.allocations, subjects]);

  // 5. Total unique learners taught across all allocations
  const totalLearnersCount = useMemo(() => {
    const studentIdSet = new Set<string>();
    uniqueAssignedClasses.forEach(({ cls }) => {
      students.forEach((s) => {
        if (cls.stream_id ? s.stream_id === cls.stream_id : s.class_id === cls.id) {
          studentIdSet.add(s.id);
        }
      });
    });
    return studentIdSet.size;
  }, [uniqueAssignedClasses, students]);

  // 6. Comprehensive Allocation Progress Breakdown for the Active Assessment
  const allocationsProgress = useMemo<AllocationProgress[]>(() => {
    if (!teacher.allocations || teacher.allocations.length === 0) return [];

    const list: AllocationProgress[] = [];

    teacher.allocations.forEach((alloc) => {
      const subj = subjects.find((s) => s.id === alloc.subject_id);
      if (!subj) return;

      const cls =
        (alloc.stream_id
          ? classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id)
          : undefined) ||
        (alloc.stream
          ? classes.find(
              (c) =>
                (c.class_name === alloc.class_name || c.id === alloc.class_id) &&
                c.stream.toLowerCase() === alloc.stream.toLowerCase()
            )
          : undefined) ||
        classes.find((c) => c.id === alloc.class_id);

      if (!cls) return;

      const classLabel = cls.stream ? `${cls.class_name} ${cls.stream}` : cls.class_name;
      const classIdForFilter = cls.stream_id || cls.id;

      // Learners in this specific class/stream (active only for operational enrollment)
      const enrolledLearners = students.filter((s) => {
        if (s.active === false) return false;
        if (cls.stream_id && s.stream_id === cls.stream_id) return true;
        if (cls.id && s.class_id === cls.id) {
          if (!cls.stream_id || !s.stream_id || s.stream_id === cls.stream_id) return true;
        }
        return false;
      });

      const totalStudents = enrolledLearners.length;
      let enteredMarksCount = 0;

      if (activeExam && totalStudents > 0) {
        const enrolledStudentIds = new Set(enrolledLearners.map((s) => s.id));
        const matchedMarks = marks.filter(
          (m) =>
            m.exam_id === activeExam.id &&
            m.subject_id === subj.id &&
            enrolledStudentIds.has(m.student_id)
        );

        enteredMarksCount = matchedMarks.filter(
          (m) =>
            (m.special_status && m.special_status !== 'Blank') ||
            (m.raw_score !== null && m.raw_score !== undefined && String(m.raw_score).trim() !== '') ||
            (typeof m.marks === 'number' && m.marks > 0)
        ).length;
      }

      const missingCount = Math.max(0, totalStudents - enteredMarksCount);
      const percentage = totalStudents > 0 ? Math.round((enteredMarksCount / totalStudents) * 100) : 0;

      let status: AllocationProgress['status'] = 'Not Started';
      if (activeExam?.status === 'Approved') {
        status = 'Locked';
      } else if (totalStudents > 0 && enteredMarksCount === totalStudents) {
        status = 'Complete';
      } else if (enteredMarksCount > 0) {
        status = 'In Progress';
      }

      list.push({
        allocationKey: `${subj.id}_${classIdForFilter}`,
        subject: subj,
        classStream: cls,
        classLabel,
        totalStudents,
        enteredMarksCount,
        missingCount,
        percentage,
        status,
        exam: activeExam,
      });
    });

    return list;
  }, [teacher.allocations, subjects, classes, students, activeExam, marks]);

  // 7. "Continue Your Work" Focus Priority Item
  const continueWorkItem = useMemo<AllocationProgress | null>(() => {
    if (allocationsProgress.length === 0) return null;
    // Priority 1: In progress allocation (partially completed)
    const inProgress = allocationsProgress.find((a) => a.status === 'In Progress');
    if (inProgress) return inProgress;

    // Priority 2: Not started allocation with enrolled learners
    const notStarted = allocationsProgress.find((a) => a.status === 'Not Started' && a.totalStudents > 0);
    if (notStarted) return notStarted;

    // Priority 3: First allocation
    return allocationsProgress[0] || null;
  }, [allocationsProgress]);

  // 8. Needs Attention Actionable Items
  const attentionItems = useMemo<AllocationProgress[]>(() => {
    return allocationsProgress.filter(
      (a) =>
        a.totalStudents > 0 &&
        a.missingCount > 0 &&
        a.status !== 'Locked' &&
        activeExam?.status !== 'Approved'
    );
  }, [allocationsProgress, activeExam]);

  // 9. Overall Subject Performance Analytics across Teacher's Marks
  const teacherPerformanceStats = useMemo(() => {
    if (!activeExam || teacher.allocations.length === 0) {
      return { totalMarks: 0, ee: 0, me: 0, ae: 0, be: 0, avgPercentage: 0 };
    }

    const assignedSubjectIds = new Set(teacher.allocations.map((a) => a.subject_id));
    const assignedClassStudentIds = new Set<string>();

    uniqueAssignedClasses.forEach(({ cls }) => {
      students.forEach((s) => {
        if (cls.stream_id ? s.stream_id === cls.stream_id : s.class_id === cls.id) {
          assignedClassStudentIds.add(s.id);
        }
      });
    });

    const relevantMarks = marks.filter(
      (m) =>
        m.exam_id === activeExam.id &&
        assignedSubjectIds.has(m.subject_id) &&
        assignedClassStudentIds.has(m.student_id)
    );

    let ee = 0;
    let me = 0;
    let ae = 0;
    let be = 0;
    let totalScore = 0;
    let scoredCount = 0;

    relevantMarks.forEach((m) => {
      if (m.special_status === 'X' || m.special_status === 'Y') return;

      const raw = typeof m.raw_score === 'number' ? m.raw_score : parseFloat(String(m.raw_score || ''));
      const outOf = typeof m.out_of === 'number' && m.out_of > 0 ? m.out_of : 100;

      if (!isNaN(raw) && raw >= 0) {
        const pct = (raw / outOf) * 100;
        totalScore += pct;
        scoredCount++;

        if (pct >= 75) ee++;
        else if (pct >= 41) me++;
        else if (pct >= 21) ae++;
        else be++;
      }
    });

    const avgPercentage = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    return {
      totalMarks: scoredCount,
      ee,
      me,
      ae,
      be,
      avgPercentage,
    };
  }, [activeExam, teacher.allocations, uniqueAssignedClasses, students, marks]);

  // 10. Direct Workflow Launch Navigation Handler
  const handleLaunchMarksWorkflow = (allocation: AllocationProgress) => {
    try {
      const classId = allocation.classStream.stream_id || allocation.classStream.id;
      sessionStorage.setItem('cbe_marks_workflow_class', classId);
      sessionStorage.setItem('cbe_marks_workflow_subject', allocation.subject.id);
      if (activeExam) {
        sessionStorage.setItem('cbe_marks_workflow_exam', activeExam.id);
      }
    } catch (e) {
      console.warn('Session storage write error:', e);
    }
    onNavigate('marks-entry');
  };

  // Filtered Allocations for Progress Grid
  const filteredAllocations = useMemo(() => {
    return allocationsProgress.filter((a) => {
      // Status filter
      if (filterStatus === 'in_progress' && a.status !== 'In Progress') return false;
      if (filterStatus === 'needs_attention' && (a.missingCount === 0 || a.status === 'Locked')) return false;
      if (filterStatus === 'complete' && a.status !== 'Complete') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subName = (a.subject.subject_name || '').toLowerCase();
        const subCode = (a.subject.subject_code || '').toLowerCase();
        const clsName = a.classLabel.toLowerCase();
        return subName.includes(q) || subCode.includes(q) || clsName.includes(q);
      }

      return true;
    });
  }, [allocationsProgress, filterStatus, searchQuery]);

  // Learners list for interactive class modal (active learners)
  const classModalStudents = useMemo(() => {
    if (!selectedClassForList) return [];
    const cls = selectedClassForList;
    return students.filter((s) => {
      if (s.active === false) return false;
      if (cls.stream_id && s.stream_id === cls.stream_id) return true;
      if (cls.id && s.class_id === cls.id) {
        if (!cls.stream_id || !s.stream_id || s.stream_id === cls.stream_id) return true;
      }
      return false;
    });
  }, [selectedClassForList, students]);

  const filteredClassModalStudents = useMemo(() => {
    if (!searchStudentTerm.trim()) return classModalStudents;
    const q = searchStudentTerm.toLowerCase();
    return classModalStudents.filter((s) => {
      const name = (s.full_name || `${s.first_name || ''} ${s.last_name || ''}`).toLowerCase();
      const adm = (s.admission_number || '').toLowerCase();
      return name.includes(q) || adm.includes(q);
    });
  }, [classModalStudents, searchStudentTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. COMPACT WELCOME AREA & TEACHER PROFILE CARD */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-13 h-13 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs shrink-0">
            {teacherInitials}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937] dark:text-slate-100">
                {formatGreetingFirstName(teacher.teacher_name)}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Subject Teacher
              </span>
            </div>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
              {activeYearObj?.year ? `Academic Year ${activeYearObj.year}` : 'Current Session'} &bull;{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{activeTermObj.term_name}</span>{' '}
              ({activeTermObj.status}) &bull; Active Assessment:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {activeExam ? activeExam.exam_name : 'None Open'}
              </span>
            </p>
          </div>
        </div>

        {/* Quick Quick-Action Links */}
        <div className="flex items-center space-x-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          <button
            onClick={() => onNavigate('marks-entry')}
            className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2 bg-[#075E42] hover:bg-[#054531] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer space-x-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Marks Entry</span>
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer space-x-1.5"
          >
            <FileBarChart className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
            <span>Reports</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTELLIGENT EXAMINATION REMINDER BANNER */}
      {/* ========================================================================= */}
      {!isExamReminderDismissed && examReminder.hasActiveExam && examReminder.reminderPriority !== 'none' && (
        <TeacherExamReminderBanner
          reminder={examReminder}
          onNavigate={handleReminderNavigate}
          onDismiss={() => setIsExamReminderDismissed(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. WORKLOAD SUMMARY METRICS BAR */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Metric 1: Learning Areas */}
        <div
          onClick={() => setActiveModal('subjects')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E5E7EB] dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Learning Areas</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg text-[#075E42] dark:text-emerald-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100">
              {uniqueAssignedSubjects.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Assigned subjects
            </div>
          </div>
        </div>

        {/* Metric 2: Classes & Streams */}
        <div
          onClick={() => setActiveModal('classes')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E5E7EB] dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Classes & Streams</span>
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              <Building2 className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100">
              {uniqueAssignedClasses.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Assigned classes
            </div>
          </div>
        </div>

        {/* Metric 3: Total Learners */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E5E7EB] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Learners</span>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-lg text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100">
              {totalLearnersCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Enrolled students
            </div>
          </div>
        </div>

        {/* Metric 4: Total Allocations */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E5E7EB] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Allocations</span>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950/60 rounded-lg text-purple-600 dark:text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100">
              {allocationsProgress.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Subject & Class pairs
            </div>
          </div>
        </div>

        {/* Metric 5: Needs Attention */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E5E7EB] dark:border-slate-800 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Attention Required</span>
            <div
              className={`p-1.5 rounded-lg ${
                attentionItems.length > 0
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {attentionItems.length > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div>
            <div
              className={`text-2xl font-bold ${
                attentionItems.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {attentionItems.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {attentionItems.length > 0 ? 'Pending assessments' : 'All marks up to date'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. "CONTINUE YOUR WORK" CARD & ACTIONABLE NEEDS ATTENTION */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Continue Your Work Focus */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Compass className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
              <span>Continue Your Work</span>
            </h2>
            {activeExam && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Exam: <span className="font-semibold text-slate-700 dark:text-slate-200">{activeExam.exam_name}</span>
              </span>
            )}
          </div>

          {continueWorkItem ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] dark:border-slate-800 shadow-xs relative overflow-hidden group">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#075E42] dark:bg-emerald-500" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {continueWorkItem.classLabel}
                    </span>
                    {continueWorkItem.subject.subject_code && (
                      <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
                        {continueWorkItem.subject.subject_code}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        continueWorkItem.status === 'Complete'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : continueWorkItem.status === 'In Progress'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {continueWorkItem.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {continueWorkItem.subject.subject_name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {continueWorkItem.enteredMarksCount} of {continueWorkItem.totalStudents} learners recorded &bull;{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {continueWorkItem.missingCount} remaining
                    </span>
                  </p>

                  {/* Visual Progress Bar */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1 font-medium">
                      <span>Marking Progress</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {continueWorkItem.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#075E42] dark:bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${continueWorkItem.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                  <button
                    onClick={() => handleLaunchMarksWorkflow(continueWorkItem)}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-[#075E42] hover:bg-[#054531] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer space-x-2 group-hover:shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>
                      {continueWorkItem.enteredMarksCount > 0 ? 'Continue Marking' : 'Enter Marks'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#E5E7EB] dark:border-slate-800 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                No Active Incomplete Assessments
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                All assigned marks for open assessments are up to date. You can review submitted marks or generate score sheets anytime.
              </p>
            </div>
          )}
        </div>

        {/* Right 1 Col: Needs Attention & Actionable Alerts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Needs Attention</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {attentionItems.length}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#E5E7EB] dark:border-slate-800 shadow-xs space-y-3">
            {attentionItems.length > 0 ? (
              attentionItems.slice(0, 3).map((item) => (
                <div
                  key={item.allocationKey}
                  className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.classLabel} &bull; {item.subject.subject_name}
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">
                      {item.missingCount} learner{item.missingCount > 1 ? 's' : ''} unentered
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchMarksWorkflow(item)}
                    className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center space-x-1"
                  >
                    <span>Fix</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-6 text-center space-y-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Zero Pending Issues
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Every active assessment in your teaching allocation has complete marks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ASSESSMENT WORKLOAD & MARKING PROGRESS BREAKDOWN */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              My Assessment Workload & Progress
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Status for active assessment &bull; {activeExam ? activeExam.exam_name : 'Current Term'}
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search subject or class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-200 w-40 sm:w-56"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="in_progress">In Progress</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>

        {/* Allocations Progress Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAllocations.length > 0 ? (
            filteredAllocations.map((item) => (
              <div
                key={item.allocationKey}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#E5E7EB] dark:border-slate-800 shadow-xs hover:border-[#075E42] dark:hover:border-emerald-500 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {item.classLabel}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.status === 'Complete'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : item.status === 'In Progress'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : item.status === 'Locked'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.subject.subject_name}
                    </h3>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{item.subject.education_level || 'CBE'}</span>
                      {item.subject.subject_code && (
                        <>
                          <span>&bull;</span>
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                            {item.subject.subject_code}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>
                        Marks: <span className="font-bold text-slate-800 dark:text-slate-200">{item.enteredMarksCount}</span>/{item.totalStudents}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'Complete'
                            ? 'bg-emerald-500'
                            : item.status === 'In Progress'
                            ? 'bg-amber-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.missingCount === 0 ? 'All recorded' : `${item.missingCount} remaining`}
                  </span>
                  <button
                    onClick={() => handleLaunchMarksWorkflow(item)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-[#075E42] dark:text-emerald-400 hover:text-[#054531] dark:hover:text-emerald-300 transition cursor-pointer"
                  >
                    <span>{item.status === 'Complete' ? 'Review Marks' : 'Enter Marks'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No matching teaching allocations found.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. PERFORMANCE OVERVIEW FOR TEACHER'S ALLOCATED SUBJECTS */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
              <span>Assessment Performance Summary</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              CBE Achievement Level Distribution for your entered scores ({teacherPerformanceStats.totalMarks} marks recorded)
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Average: <span className="font-bold text-slate-800 dark:text-slate-200">{teacherPerformanceStats.avgPercentage}%</span>
          </div>
        </div>

        {/* 4 CBE Levels Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* EE */}
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <span>EE (75-100%)</span>
              <span className="font-bold">{teacherPerformanceStats.ee}</span>
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
              Exceeding Expectations
            </div>
            <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              {teacherPerformanceStats.totalMarks > 0
                ? Math.round((teacherPerformanceStats.ee / teacherPerformanceStats.totalMarks) * 100)
                : 0}
              %
            </div>
          </div>

          {/* ME */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span>ME (41-74%)</span>
              <span className="font-bold">{teacherPerformanceStats.me}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Meeting Expectations
            </div>
            <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
              {teacherPerformanceStats.totalMarks > 0
                ? Math.round((teacherPerformanceStats.me / teacherPerformanceStats.totalMarks) * 100)
                : 0}
              %
            </div>
          </div>

          {/* AE */}
          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
              <span>AE (21-40%)</span>
              <span className="font-bold">{teacherPerformanceStats.ae}</span>
            </div>
            <div className="text-[11px] text-amber-700/80 dark:text-amber-400">
              Approaching Expectations
            </div>
            <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
              {teacherPerformanceStats.totalMarks > 0
                ? Math.round((teacherPerformanceStats.ae / teacherPerformanceStats.totalMarks) * 100)
                : 0}
              %
            </div>
          </div>

          {/* BE */}
          <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/60 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300">
              <span>BE (0-20%)</span>
              <span className="font-bold">{teacherPerformanceStats.be}</span>
            </div>
            <div className="text-[11px] text-rose-700/80 dark:text-rose-400">
              Below Expectations
            </div>
            <div className="text-[11px] font-bold text-rose-900 dark:text-rose-200">
              {teacherPerformanceStats.totalMarks > 0
                ? Math.round((teacherPerformanceStats.be / teacherPerformanceStats.totalMarks) * 100)
                : 0}
              %
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: MY ASSIGNED CLASSES WITH STUDENT EXPLORER */}
      {/* ========================================================================= */}
      {activeModal === 'classes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    My Assigned Classes
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Classes and streams you teach
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 flex-1">
              {uniqueAssignedClasses.length > 0 ? (
                uniqueAssignedClasses.map(({ cls, studentCount, allocations }) => (
                  <div
                    key={cls.id + (cls.stream_id || '')}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {cls.class_name} {cls.stream}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {studentCount} learners
                        </span>{' '}
                        &bull; {allocations.length} Subject allocation{allocations.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedClassForList(cls);
                          setActiveModal('classList');
                        }}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Learners</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveModal('none');
                          sessionStorage.setItem('cbe_marks_workflow_class', cls.stream_id || cls.id);
                          onNavigate('marks-entry');
                        }}
                        className="bg-[#075E42] hover:bg-[#054531] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Marks</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                  No assigned classes found.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MY ASSIGNED LEARNING AREAS */}
      {/* ========================================================================= */}
      {activeModal === 'subjects' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    My Assigned Learning Areas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Subjects and curriculum areas you teach
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 flex-1">
              {uniqueAssignedSubjects.length > 0 ? (
                uniqueAssignedSubjects.map(({ subject, allocations }) => (
                  <div
                    key={subject.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                        <span>{subject.subject_name}</span>
                        {subject.subject_code && (
                          <span className="text-[10px] font-mono font-semibold bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            {subject.subject_code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {subject.education_level || 'CBE Curriculum'} &bull; {allocations.length} Class Allocation{allocations.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveModal('none');
                        sessionStorage.setItem('cbe_marks_workflow_subject', subject.id);
                        onNavigate('marks-entry');
                      }}
                      className="bg-[#075E42] hover:bg-[#054531] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Enter Marks</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                  No assigned learning areas found.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CLASS LEARNERS LIST EXPLORER */}
      {/* ========================================================================= */}
      {activeModal === 'classList' && selectedClassForList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedClassForList.class_name} {selectedClassForList.stream} Learners
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {filteredClassModalStudents.length} of {classModalStudents.length} learners enrolled
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('classes')}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter in modal */}
            <div className="pt-3 pb-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by learner name or admission number..."
                  value={searchStudentTerm}
                  onChange={(e) => setSearchStudentTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="py-2 overflow-y-auto space-y-2 flex-1">
              {filteredClassModalStudents.length > 0 ? (
                filteredClassModalStudents.map((std, idx) => (
                  <div
                    key={std.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-[10px] text-slate-400 w-6">
                        {idx + 1}.
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {getStudentFullName(std)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Adm: {std.admission_number} &bull; Gender: {std.gender === 'M' ? 'Boy' : 'Girl'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                  No learners found matching search.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <button
                onClick={() => setActiveModal('classes')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                &larr; Back to Classes
              </button>
              <button
                onClick={() => {
                  setActiveModal('none');
                  sessionStorage.setItem('cbe_marks_workflow_class', selectedClassForList.stream_id || selectedClassForList.id);
                  onNavigate('marks-entry');
                }}
                className="bg-[#075E42] hover:bg-[#054531] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Enter Marks for this Class</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
