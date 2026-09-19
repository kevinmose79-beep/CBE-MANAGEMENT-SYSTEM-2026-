import {
  Examination,
  Teacher,
  ClassStream,
  Subject,
  Student,
  Mark,
  User,
  EducationLevel,
  getApplicableSubjectsForGrade,
  getEducationLevelForGrade,
} from '../types';
import { isClassExamApproved } from './examLockUtils';
import { evaluateMark } from './markUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { getDisplayExamName } from './examDisplayUtils';

/**
 * Pure function: determines if an examination is applicable to a specific class or stream.
 * Evaluates:
 * 1. Explicit class/stream targeting (exam.class_id !== 'all')
 * 2. Education level targeting (exam.education_level)
 * 3. Approved levels targeting (exam.approved_levels)
 * 4. Cohort participation check: If the assessment was administered elsewhere in the school
 *    (marks exist for other classes or other classes are approved in approved_classes),
 *    but ZERO marks were entered for this cohort/stream across all subjects and the stream is not approved,
 *    under CBE rules this is a non-participating cohort.
 */
export function isExamApplicableToClassStream(
  exam: Examination | null | undefined,
  classStream: ClassStream | null | undefined | { id?: string; stream_id?: string; class_name?: string; stream?: string; education_level?: EducationLevel },
  marks: Mark[] = [],
  students: Student[] = [],
  classes: ClassStream[] = []
): boolean {
  if (!exam || !classStream) return false;

  // 1. Explicit class/stream targeting
  if (exam.class_id && exam.class_id !== 'all') {
    const target = exam.class_id.toLowerCase();
    const matchesTarget =
      exam.class_id === classStream.id ||
      ('stream_id' in classStream && exam.class_id === classStream.stream_id) ||
      (classStream.class_name && target === classStream.class_name.toLowerCase()) ||
      (classStream.id && target === classStream.id.toLowerCase()) ||
      (classStream.stream_id && target === classStream.stream_id.toLowerCase());
    if (!matchesTarget) {
      return false;
    }
  }

  // 2. Education level targeting
  const eduLevel =
    classStream.education_level ||
    (classStream.class_name ? getEducationLevelForGrade(classStream.class_name) : undefined);

  if (exam.education_level && eduLevel && exam.education_level !== eduLevel) {
    return false;
  }

  // 3. Approved levels targeting
  if (exam.approved_levels && exam.approved_levels.length > 0 && eduLevel) {
    if (!exam.approved_levels.includes(eduLevel)) {
      return false;
    }
  }

  // 4. Cohort Participation / Non-Participating Cohort Rule
  // If stream is explicitly in approved_classes, it participated and was approved
  const streamIdentifier = ('stream_id' in classStream && classStream.stream_id) || classStream.id;
  const isExplicitlyApprovedStream =
    Boolean(streamIdentifier && (exam.approved_classes || []).includes(streamIdentifier)) ||
    Boolean(classStream.class_name && (exam.approved_classes || []).includes(classStream.class_name));

  if (isExplicitlyApprovedStream) {
    return true;
  }

  // Find all students belonging to this stream/class
  const streamStudents = (students || []).filter((s) => {
    if (s.active === false || s.enrolment_status === 'future') return false;
    if ('stream_id' in classStream && classStream.stream_id) {
      return s.stream_id === classStream.stream_id;
    }
    return s.class_id === classStream.id || s.stream_id === classStream.id;
  });

  const streamStudentIds = new Set(streamStudents.map((s) => s.id));
  const streamMarks = (marks || []).filter(
    (m) => m.exam_id === exam.id && streamStudentIds.has(m.student_id)
  );
  const streamMarksCount = streamMarks.length;

  // If this stream already has entered marks, it is an active participant
  if (streamMarksCount > 0) {
    return true;
  }

  // If stream has 0 marks: check if assessment was administered elsewhere in school
  const hasMarksElsewhere = (marks || []).some((m) => m.exam_id === exam.id);
  const hasApprovedClasses = (exam.approved_classes || []).length > 0;

  if (hasMarksElsewhere || hasApprovedClasses) {
    // Other classes participated or were approved, but this stream has 0 marks entered across all subjects
    // and is not in approved_classes -> Non-participating cohort
    return false;
  }

  // If newly created exam with 0 marks and 0 approved classes anywhere in the school, it applies by default
  return true;
}

export type ReminderPriority =
  | 'action_required'
  | 'attention_needed'
  | 'ready_for_approval'
  | 'completed'
  | 'none';

export type ReminderBadgeType = 'urgent' | 'warning' | 'info' | 'success' | 'neutral' | 'critical';

export type ReminderPrimaryAction =
  | 'enter_marks'
  | 'view_monitoring'
  | 'stream_approval'
  | 'view_reports'
  | 'none';

export interface SubjectAllocationProgress {
  subject: Subject;
  classStream: ClassStream;
  allocationKey: string;
  totalStudents: number;
  enteredMarksCount: number;
  missingCount: number;
  isComplete: boolean;
  isLocked: boolean;
}

export interface SubjectTeacherReminderSummary {
  totalAllocations: number;
  completedAllocations: number;
  incompleteAllocations: number;
  totalMissingMarks: number;
  allocations: SubjectAllocationProgress[];
  nextPriorityAllocation?: SubjectAllocationProgress;
}

export interface MissingSubjectDetail {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  missingCount: number;
}

export interface ClassTeacherReminderSummary {
  primaryClass: ClassStream;
  totalExpectedMarks: number;
  totalEnteredMarks: number;
  totalMissingMarks: number;
  isStreamApproved: boolean;
  isStreamReadyForApproval: boolean;
  missingSubjectsCount: number;
  missingSubjectsList: MissingSubjectDetail[];
}

export interface TeacherExamReminderSummary {
  hasActiveExam: boolean;
  activeExam: Examination | null;
  isExamLockedOrApproved: boolean;
  teacherRole: 'subject_teacher' | 'class_teacher' | 'dual_role' | 'none';
  reminderPriority: ReminderPriority;
  badgeType: ReminderBadgeType;
  badgeLabel: string;
  title: string;
  headline: string;
  subtext: string;
  secondaryNote?: string;
  isRequired: boolean;
  primaryAction: ReminderPrimaryAction;
  primaryActionLabel: string;
  primaryActionTab: string | null;
  primaryActionContext?: {
    examId?: string;
    classId?: string;
    streamId?: string;
    subjectId?: string;
  };
  subjectTeacherSummary?: SubjectTeacherReminderSummary;
  classTeacherSummary?: ClassTeacherReminderSummary;
}

interface ComputeTeacherExamReminderParams {
  teacher: Teacher | null | undefined;
  currentUser?: User | null;
  exams: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  students: Student[];
  marks: Mark[];
  activeYear?: { year: number } | null;
  activeTerm?: { term_name: string; status: string } | null;
}

/**
 * Resolves the current active examination for the teacher.
 * Prioritizes Open or Provisional examinations in current session that are applicable to the teacher.
 */
export function resolveActiveExamination(
  exams: Examination[] = [],
  activeYear?: { year: number } | null,
  activeTerm?: { term_name: string; status: string } | null,
  context?: {
    teacher?: Teacher | null;
    classes?: ClassStream[];
    marks?: Mark[];
    students?: Student[];
  }
): Examination | null {
  if (!Array.isArray(exams) || exams.length === 0) return null;

  // 1. Current Session Open/Provisional exam
  if (activeYear?.year && activeTerm?.term_name) {
    const sessionActiveExams = exams.filter(
      (e) =>
        e.year === activeYear.year &&
        e.term === activeTerm.term_name &&
        (e.status === 'Open' || e.status === 'Provisional')
    );

    // If teacher context is available, prioritize exam applicable to teacher's class or teaching allocations
    if (context?.teacher && context?.classes && sessionActiveExams.length > 0) {
      const teacherClassStreams = (context.classes || []).filter(
        (c) =>
          c.class_teacher_id === context.teacher!.id ||
          (context.teacher!.user_id && c.class_teacher_id === context.teacher!.user_id) ||
          (context.teacher!.tsc_number && c.class_teacher_id === context.teacher!.tsc_number) ||
          (context.teacher!.is_class_teacher &&
            context.teacher!.class_teacher_of_id &&
            ((c.stream_id && c.stream_id === context.teacher!.class_teacher_of_id) ||
              c.id === context.teacher!.class_teacher_of_id)) ||
          (Array.isArray(context.teacher!.allocations) &&
            context.teacher!.allocations.some(
              (a) => a.class_id === c.id || a.stream_id === c.stream_id || a.class_id === c.stream_id
            ))
      );

      const applicableSessionExam = sessionActiveExams.find((e) =>
        teacherClassStreams.some((cs) =>
          isExamApplicableToClassStream(e, cs, context.marks || [], context.students || [], context.classes || [])
        )
      );

      if (applicableSessionExam) return applicableSessionExam;
    }

    if (sessionActiveExams.length > 0) return sessionActiveExams[0];

    const sessionAny = exams.find(
      (e) => e.year === activeYear.year && e.term === activeTerm.term_name
    );
    if (sessionAny) return sessionAny;
  }

  // 2. Global Open or Provisional exam
  const globalActive = exams.find(
    (e) => e.status === 'Open' || e.status === 'Provisional'
  );
  if (globalActive) return globalActive;

  // 3. Most recently updated Approved/Published exam
  const approvedExam = exams.find(
    (e) => e.status === 'Approved' || e.status === 'Published'
  );
  if (approvedExam) return approvedExam;

  // 4. Default to first exam if exists
  return exams[0] || null;
}

/**
 * Pure function: computes the intelligent examination reminder summary for a given teacher.
 * Does not mutate inputs, query databases, or execute asynchronous actions.
 */
export function computeTeacherExamReminder({
  teacher,
  currentUser,
  exams = [],
  classes = [],
  subjects = [],
  students = [],
  marks = [],
  activeYear,
  activeTerm,
}: ComputeTeacherExamReminderParams): TeacherExamReminderSummary {
  // Base neutral response
  const neutralResponse: TeacherExamReminderSummary = {
    hasActiveExam: false,
    activeExam: null,
    isExamLockedOrApproved: false,
    teacherRole: 'none',
    reminderPriority: 'none',
    badgeType: 'neutral',
    badgeLabel: 'No Active Exam',
    title: 'No Active Examination',
    headline: 'No examination actions required at this time.',
    subtext: 'There are no open examinations requiring marks entry or approval.',
    isRequired: false,
    primaryAction: 'none',
    primaryActionLabel: '',
    primaryActionTab: null,
  };

  if (!teacher) {
    return neutralResponse;
  }

  const activeExam = resolveActiveExamination(exams, activeYear, activeTerm, {
    teacher,
    classes,
    marks,
    students,
  });
  if (!activeExam) {
    return neutralResponse;
  }

  // Check if exam is strictly in Draft or has no active marking workflow
  if (activeExam.status === 'Draft') {
    return {
      hasActiveExam: true,
      activeExam,
      isExamLockedOrApproved: false,
      teacherRole: 'none',
      reminderPriority: 'none',
      badgeType: 'neutral',
      badgeLabel: 'Draft Assessment',
      title: 'Assessment in Draft Mode',
      headline: `${getDisplayExamName(activeExam.exam_name)} is currently in draft.`,
      subtext: 'Marks entry will open once the administrator activates this assessment.',
      isRequired: false,
      primaryAction: 'none',
      primaryActionLabel: '',
      primaryActionTab: null,
    };
  }

  // Fast Mark Lookup Map for the active exam
  const examMarkMap = new Map<string, Mark>();
  (marks || []).forEach((m) => {
    if (m.exam_id === activeExam.id && m.student_id && m.subject_id) {
      examMarkMap.set(`${m.student_id}_${m.subject_id}`, m);
    }
  });

  // =========================================================================
  // 1. DETERMINE ROLES & PRIMARY CLASS/STREAM ASSIGNMENTS
  // =========================================================================
  const primaryClasses = (classes || []).filter(
    (c) =>
      c.class_teacher_id === teacher.id ||
      (teacher.user_id && c.class_teacher_id === teacher.user_id) ||
      (teacher.tsc_number && c.class_teacher_id === teacher.tsc_number) ||
      (teacher.is_class_teacher &&
        teacher.class_teacher_of_id &&
        ((c.stream_id && c.stream_id === teacher.class_teacher_of_id) ||
          c.id === teacher.class_teacher_of_id))
  );

  const isClassTeacher = primaryClasses.length > 0;
  const allocations = Array.isArray(teacher.allocations) ? teacher.allocations : [];
  const hasSubjectAllocations = allocations.length > 0;

  const teacherRole: 'subject_teacher' | 'class_teacher' | 'dual_role' | 'none' =
    isClassTeacher && hasSubjectAllocations
      ? 'dual_role'
      : isClassTeacher
      ? 'class_teacher'
      : hasSubjectAllocations
      ? 'subject_teacher'
      : 'none';

  // =========================================================================
  // 2. CHECK GLOBAL OR STREAM-LEVEL EXAMINATION COMPLETION
  // =========================================================================
  const isGlobalExamApproved =
    activeExam.status === 'Approved' ||
    activeExam.status === 'Published' ||
    (activeExam.status as string) === 'Official Results Released';

  // =========================================================================
  // 3. EVALUATE SUBJECT TEACHER ALLOCATIONS
  // =========================================================================
  let subjectSummary: SubjectTeacherReminderSummary | undefined = undefined;

  if (hasSubjectAllocations) {
    const allocationProgressList: SubjectAllocationProgress[] = [];

    allocations.forEach((alloc) => {
      // Find matching subject
      const subject = (subjects || []).find((s) => s.id === alloc.subject_id);
      if (!subject) return;

      // Find matching class stream
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

      if (!isExamApplicableToClassStream(activeExam, cls, marks, students, classes)) {
        return;
      }

      const isLocked = isClassExamApproved(activeExam, cls);

      // Learners in this stream
      const streamStudents = (students || []).filter((s) => {
        if (s.active === false) return false;
        const examCtx = getLearnerClassAtExamTime(s, activeExam, classes);
        if (cls.stream_id) {
          return examCtx.stream_id === cls.stream_id;
        }
        return examCtx.class_id === cls.id || examCtx.stream_id === cls.id;
      });

      let enteredCount = 0;
      streamStudents.forEach((std) => {
        const rawMark = examMarkMap.get(`${std.id}_${subject.id}`);
        const evaluated = evaluateMark(rawMark);
        if (evaluated.status === 'Normal' || evaluated.status === 'X' || evaluated.status === 'Y') {
          enteredCount++;
        }
      });

      const totalStudents = streamStudents.length;
      const missingCount = Math.max(0, totalStudents - enteredCount);
      const isComplete = totalStudents > 0 ? enteredCount === totalStudents : true;

      allocationProgressList.push({
        subject,
        classStream: cls,
        allocationKey: `${cls.id}_${cls.stream_id || ''}_${subject.id}`,
        totalStudents,
        enteredMarksCount: enteredCount,
        missingCount,
        isComplete,
        isLocked,
      });
    });

    const totalAllocations = allocationProgressList.length;
    const completedAllocations = allocationProgressList.filter((a) => a.isComplete).length;
    const incompleteAllocations = totalAllocations - completedAllocations;
    const totalMissingMarks = allocationProgressList.reduce((acc, a) => acc + a.missingCount, 0);

    // Prioritize first incomplete and unlocked allocation
    const nextPriorityAllocation =
      allocationProgressList.find((a) => !a.isComplete && !a.isLocked) ||
      allocationProgressList.find((a) => !a.isComplete) ||
      allocationProgressList[0];

    subjectSummary = {
      totalAllocations,
      completedAllocations,
      incompleteAllocations,
      totalMissingMarks,
      allocations: allocationProgressList,
      nextPriorityAllocation,
    };
  }

  // =========================================================================
  // 4. EVALUATE CLASS TEACHER DESIGNATED STREAM
  // =========================================================================
  let classSummary: ClassTeacherReminderSummary | undefined = undefined;

  if (isClassTeacher && primaryClasses.length > 0) {
    const primaryClass = primaryClasses[0];
    const isApplicable = isExamApplicableToClassStream(
      activeExam,
      primaryClass,
      marks,
      students,
      classes
    );

    if (!isApplicable) {
      classSummary = {
        primaryClass,
        totalExpectedMarks: 0,
        totalEnteredMarks: 0,
        totalMissingMarks: 0,
        isStreamApproved: true,
        isStreamReadyForApproval: false,
        missingSubjectsCount: 0,
        missingSubjectsList: [],
      };
    } else {
      const isStreamApproved = isClassExamApproved(activeExam, primaryClass);

      // Learners in primary stream
      const primaryStudents = (students || []).filter((s) => {
        if (s.active === false) return false;
        const examCtx = getLearnerClassAtExamTime(s, activeExam, classes);
        if (primaryClass.stream_id) {
          return examCtx.stream_id === primaryClass.stream_id;
        }
        return examCtx.class_id === primaryClass.id || examCtx.stream_id === primaryClass.id;
      });

      const applicableSubjects = getApplicableSubjectsForGrade(
        primaryClass.class_name,
        subjects
      );
      const totalExpectedMarks = primaryStudents.length * applicableSubjects.length;

      let totalEnteredMarks = 0;
      const missingSubjectsList: MissingSubjectDetail[] = [];

      applicableSubjects.forEach((sub) => {
        let subEntered = 0;
        primaryStudents.forEach((std) => {
          const rawMark = examMarkMap.get(`${std.id}_${sub.id}`);
          const evaluated = evaluateMark(rawMark);
          if (evaluated.status === 'Normal' || evaluated.status === 'X' || evaluated.status === 'Y') {
            subEntered++;
          }
        });

        totalEnteredMarks += subEntered;
        const subMissing = Math.max(0, primaryStudents.length - subEntered);
        if (subMissing > 0) {
          missingSubjectsList.push({
            subjectId: sub.id,
            subjectName: sub.subject_name || 'Subject',
            subjectCode: sub.subject_code || 'SUB',
            missingCount: subMissing,
          });
        }
      });

      const totalMissingMarks = Math.max(0, totalExpectedMarks - totalEnteredMarks);
      const isStreamReadyForApproval = totalMissingMarks === 0 && !isStreamApproved;

      classSummary = {
        primaryClass,
        totalExpectedMarks,
        totalEnteredMarks,
        totalMissingMarks,
        isStreamApproved,
        isStreamReadyForApproval,
        missingSubjectsCount: missingSubjectsList.length,
        missingSubjectsList,
      };
    }
  }

  // =========================================================================
  // 5. SYNTHESIZE INTELLIGENT REMINDER STATE
  // =========================================================================

  // Case A: Examination is globally approved/published
  if (isGlobalExamApproved) {
    return {
      hasActiveExam: true,
      activeExam,
      isExamLockedOrApproved: true,
      teacherRole,
      reminderPriority: 'completed',
      badgeType: 'success',
      badgeLabel: 'Results Released',
      title: 'Examination Completed',
      headline: `${getDisplayExamName(activeExam.exam_name)} is complete and official results are published.`,
      subtext: 'Marks entry and stream approvals for this assessment are concluded.',
      isRequired: false,
      primaryAction: 'view_reports',
      primaryActionLabel: 'View Reports & Transcripts',
      primaryActionTab: 'reports',
      subjectTeacherSummary: subjectSummary,
      classTeacherSummary: classSummary,
    };
  }

  // Case B: Subject Teacher with Missing Marks (Priority 1 for Subject or Dual-Role)
  if (subjectSummary && subjectSummary.totalMissingMarks > 0) {
    const missingCount = subjectSummary.totalMissingMarks;
    const nextAlloc = subjectSummary.nextPriorityAllocation;

    let secondaryNote: string | undefined = undefined;
    if (classSummary && classSummary.totalExpectedMarks > 0) {
      if (classSummary.totalMissingMarks > 0) {
        secondaryNote = `Your class stream (${classSummary.primaryClass.class_name} ${classSummary.primaryClass.stream || ''}) also has ${classSummary.totalMissingMarks} missing marks across other subjects.`;
      } else if (classSummary.isStreamApproved) {
        secondaryNote = `Your class stream (${classSummary.primaryClass.class_name} ${classSummary.primaryClass.stream || ''}) is already approved.`;
      }
    }

    return {
      hasActiveExam: true,
      activeExam,
      isExamLockedOrApproved: false,
      teacherRole,
      reminderPriority: 'action_required',
      badgeType: 'urgent',
      badgeLabel: 'Action Required',
      title: 'Marks Entry Required',
      headline: `You have ${missingCount} examination mark${missingCount === 1 ? '' : 's'} still to enter for ${getDisplayExamName(activeExam.exam_name)}.`,
      subtext: nextAlloc
        ? `Continue marks entry for ${nextAlloc.subject.subject_name} (${nextAlloc.classStream.class_name} ${nextAlloc.classStream.stream || ''}).`
        : `Please complete marks entry for your allocated learning areas.`,
      secondaryNote,
      isRequired: true,
      primaryAction: 'enter_marks',
      primaryActionLabel: 'Enter Marks',
      primaryActionTab: 'marks-entry',
      primaryActionContext: {
        examId: activeExam.id,
        classId: nextAlloc?.classStream.id,
        streamId: nextAlloc?.classStream.stream_id,
        subjectId: nextAlloc?.subject.id,
      },
      subjectTeacherSummary: subjectSummary,
      classTeacherSummary: classSummary,
    };
  }

  // Case C: Class Teacher Responsibilities (when teacher's own marks are complete or teacher has no allocations)
  if (classSummary && classSummary.totalExpectedMarks > 0) {
    // Sub-case C1: All stream marks complete and stream not yet approved -> Ready for Stream Approval
    if (classSummary.isStreamReadyForApproval) {
      const clsName = `${classSummary.primaryClass.class_name} ${classSummary.primaryClass.stream || ''}`.trim();
      return {
        hasActiveExam: true,
        activeExam,
        isExamLockedOrApproved: false,
        teacherRole,
        reminderPriority: 'ready_for_approval',
        badgeType: 'urgent',
        badgeLabel: 'Stream Ready',
        title: 'Ready for Stream Approval',
        headline: `All examination marks for ${clsName} are complete.`,
        subtext: 'Please review provisional assessment rankings and submit formal stream approval.',
        secondaryNote: subjectSummary
          ? 'All your assigned subject marks are 100% complete.'
          : undefined,
        isRequired: true,
        primaryAction: 'stream_approval',
        primaryActionLabel: 'Review & Approve',
        primaryActionTab: 'stream-approval',
        primaryActionContext: {
          examId: activeExam.id,
          classId: classSummary.primaryClass.id,
          streamId: classSummary.primaryClass.stream_id,
        },
        subjectTeacherSummary: subjectSummary,
        classTeacherSummary: classSummary,
      };
    }

    // Sub-case C2: Other subjects in stream have missing marks -> Attention Needed
    if (classSummary.totalMissingMarks > 0 && !classSummary.isStreamApproved) {
      const clsName = `${classSummary.primaryClass.class_name} ${classSummary.primaryClass.stream || ''}`.trim();
      return {
        hasActiveExam: true,
        activeExam,
        isExamLockedOrApproved: false,
        teacherRole,
        reminderPriority: 'attention_needed',
        badgeType: 'warning',
        badgeLabel: 'Monitoring',
        title: 'Examination Marks Need Attention',
        headline: `Some subjects in ${clsName} still have missing examination marks.`,
        subtext: `${classSummary.missingSubjectsCount} subject${classSummary.missingSubjectsCount === 1 ? '' : 's'} (${classSummary.totalMissingMarks} total marks) pending from other subject teachers.`,
        secondaryNote: subjectSummary
          ? 'All your own assigned subject marks are complete (100%).'
          : undefined,
        isRequired: false,
        primaryAction: 'view_monitoring',
        primaryActionLabel: 'View Marks Monitoring',
        primaryActionTab: 'class-marks-monitoring',
        primaryActionContext: {
          examId: activeExam.id,
          classId: classSummary.primaryClass.id,
          streamId: classSummary.primaryClass.stream_id,
        },
        subjectTeacherSummary: subjectSummary,
        classTeacherSummary: classSummary,
      };
    }

    // Sub-case C3: Stream already approved
    if (classSummary.isStreamApproved) {
      const clsName = `${classSummary.primaryClass.class_name} ${classSummary.primaryClass.stream || ''}`.trim();
      return {
        hasActiveExam: true,
        activeExam,
        isExamLockedOrApproved: true,
        teacherRole,
        reminderPriority: 'completed',
        badgeType: 'success',
        badgeLabel: 'Approved',
        title: 'Stream Approved',
        headline: `${clsName} has been approved for ${getDisplayExamName(activeExam.exam_name)}.`,
        subtext: 'Your stream approval is complete and is awaiting the next administrative stage.',
        isRequired: false,
        primaryAction: 'view_reports',
        primaryActionLabel: 'View Class Reports',
        primaryActionTab: 'reports',
        subjectTeacherSummary: subjectSummary,
        classTeacherSummary: classSummary,
      };
    }
  }

  // Case D: Pure Subject Teacher with 100% Complete Marks
  if (subjectSummary && subjectSummary.totalAllocations > 0 && subjectSummary.totalMissingMarks === 0) {
    return {
      hasActiveExam: true,
      activeExam,
      isExamLockedOrApproved: false,
      teacherRole,
      reminderPriority: 'completed',
      badgeType: 'success',
      badgeLabel: 'Marks Complete',
      title: 'Your Examination Marks Are Complete',
      headline: `All your assigned marks for ${getDisplayExamName(activeExam.exam_name)} are entered.`,
      subtext: 'All your allocated classes and subjects are 100% complete. The class review process can continue.',
      isRequired: false,
      primaryAction: 'none',
      primaryActionLabel: '',
      primaryActionTab: null,
      subjectTeacherSummary: subjectSummary,
      classTeacherSummary: classSummary,
    };
  }

  // Default fallback
  return neutralResponse;
}
