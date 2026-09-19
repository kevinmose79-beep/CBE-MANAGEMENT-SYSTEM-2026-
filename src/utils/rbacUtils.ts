import { User, Teacher, ClassStream, Subject, Student, sortClasses, getAllocatedSubjectsForClass, Role, TeacherAllocation } from '../types';

/**
 * Finds the Teacher object associated with the currently logged-in user.
 */
export function getActiveTeacher(
  currentUser: User | null,
  teachers: Teacher[] = []
): Teacher | null {
  if (!currentUser || (currentUser.role !== 'class_teacher' && currentUser.role !== 'subject_teacher' && (currentUser.role as string) !== 'teacher')) return null;

  if (currentUser.teacher_id) {
    const found = teachers.find((t) => t.id === currentUser.teacher_id);
    if (found) return found;
  }

  if (currentUser.id) {
    const found = teachers.find((t) => t.user_id === currentUser.id);
    if (found) return found;
  }

  if (currentUser.email) {
    const found = teachers.find(
      (t) => (t.email || '').toLowerCase() === (currentUser.email || '').toLowerCase()
    );
    if (found) return found;
  }

  if (currentUser.tsc_number) {
    const found = teachers.find((t) => t.tsc_number === currentUser.tsc_number);
    if (found) return found;
  }

  return null;
}

/**
 * Returns all assigned ClassStream IDs for a teacher.
 */
export function getTeacherAssignedClassIds(
  teacher: Teacher | null,
  classes: ClassStream[] = []
): string[] {
  if (!teacher) return [];
  const assignedSet = new Set<string>();

  if (Array.isArray(teacher.allocations)) {
    teacher.allocations.forEach((alloc) => {
      if (alloc.stream_id) {
        assignedSet.add(alloc.stream_id);
        const matched = classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id);
        if (matched?.stream_id) assignedSet.add(matched.stream_id);
        if (matched?.id) assignedSet.add(matched.id);
      } else if (alloc.stream) {
        const matched = classes.find(
          (c) => (c.class_name === alloc.class_name || c.id === alloc.class_id) &&
                 c.stream.toLowerCase() === alloc.stream.toLowerCase()
        );
        if (matched?.stream_id) assignedSet.add(matched.stream_id);
        if (matched?.id) assignedSet.add(matched.id);
      } else if (alloc.class_id) {
        assignedSet.add(alloc.class_id);
        const matched = classes.find((c) => c.id === alloc.class_id || c.stream_id === alloc.class_id);
        if (matched?.stream_id) assignedSet.add(matched.stream_id);
        if (matched?.id) assignedSet.add(matched.id);
      }
    });
  }

  if (teacher.class_teacher_of_id) {
    assignedSet.add(teacher.class_teacher_of_id);
    const matched = classes.find(
      (c) => c.stream_id === teacher.class_teacher_of_id || c.id === teacher.class_teacher_of_id
    );
    if (matched?.stream_id) assignedSet.add(matched.stream_id);
    if (matched?.id) assignedSet.add(matched.id);
  }

  classes.forEach((c) => {
    if (
      c.class_teacher_id === teacher.id ||
      (teacher.user_id && c.class_teacher_id === teacher.user_id) ||
      (teacher.tsc_number && c.class_teacher_id === teacher.tsc_number)
    ) {
      if (c.stream_id) assignedSet.add(c.stream_id);
      if (c.id) assignedSet.add(c.id);
    }
  });

  return Array.from(assignedSet);
}

/**
 * Returns ONLY the ClassStream ID where the teacher is the designated Class Teacher.
 */
export function getTeacherPrimaryClassIds(
  teacher: Teacher | null,
  classes: ClassStream[] = []
): string[] {
  if (!teacher) return [];
  const assignedSet = new Set<string>();

  if (teacher.class_teacher_of_id) {
    assignedSet.add(teacher.class_teacher_of_id);
    const matched = classes.find(
      (c) => c.stream_id === teacher.class_teacher_of_id || c.id === teacher.class_teacher_of_id
    );
    if (matched?.stream_id) assignedSet.add(matched.stream_id);
    if (matched?.id) assignedSet.add(matched.id);
  }

  classes.forEach((c) => {
    if (
      c.class_teacher_id === teacher.id ||
      (teacher.user_id && c.class_teacher_id === teacher.user_id) ||
      (teacher.tsc_number && c.class_teacher_id === teacher.tsc_number)
    ) {
      if (c.stream_id) assignedSet.add(c.stream_id);
      if (c.id) assignedSet.add(c.id);
    }
  });

  return Array.from(assignedSet);
}

/**
 * Returns all assigned Subject IDs for a teacher.
 */
export function getTeacherAssignedSubjectIds(teacher: Teacher | null): string[] {
  if (!teacher) return [];
  const assignedSet = new Set<string>();

  if (Array.isArray(teacher.allocations)) {
    teacher.allocations.forEach((alloc) => {
      if (alloc.subject_id) assignedSet.add(alloc.subject_id);
      if (alloc.subject_code) assignedSet.add(alloc.subject_code);
    });
  }

  return Array.from(assignedSet);
}

/**
 * Returns the filtered list of ClassStreams accessible to the current user.
 * Admin: all classes
 * Teacher: only assigned classes
 */
export function getAccessibleClasses(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classes: ClassStream[] = []
): ClassStream[] {
  if (!currentUser) return sortClasses(classes);
  if (currentUser.role === 'admin') return sortClasses(classes);
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    if (!activeTeacher) return [];
    return sortClasses(
      classes.filter((c) => {
        // 1. Is designated class teacher for this class/stream
        if (
          c.class_teacher_id === activeTeacher.id ||
          (activeTeacher.user_id && c.class_teacher_id === activeTeacher.user_id) ||
          (activeTeacher.tsc_number && c.class_teacher_id === activeTeacher.tsc_number)
        ) {
          return true;
        }
        if (activeTeacher.is_class_teacher && activeTeacher.class_teacher_of_id) {
          if (c.stream_id && c.stream_id === activeTeacher.class_teacher_of_id) return true;
          if (c.id === activeTeacher.class_teacher_of_id) return true;
        }
        // 2. Has explicit subject teaching allocation
        if (Array.isArray(activeTeacher.allocations)) {
          return activeTeacher.allocations.some((a) => {
            if (a.stream_id && (c.stream_id === a.stream_id || c.id === a.stream_id)) return true;
            if (a.stream && c.stream) {
              const gradeMatches = (a.class_name && c.class_name && a.class_name.toLowerCase() === c.class_name.toLowerCase()) ||
                                   (a.class_id && a.class_id === c.id);
              return Boolean(gradeMatches && a.stream.trim().toLowerCase() === c.stream.trim().toLowerCase());
            }
            if (!a.stream_id && !a.stream && a.class_id && a.class_id === c.id) return true;
            return false;
          });
        }
        return false;
      })
    );
  }
  return sortClasses(classes);
}

/**
 * Returns the filtered list of ClassStreams for roster management (Class Teachers only).
 */
export function getAccessiblePrimaryClasses(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classes: ClassStream[] = []
): ClassStream[] {
  if (!currentUser) return sortClasses(classes);
  if (currentUser.role === 'admin') return sortClasses(classes);
  if (
    currentUser.role === 'class_teacher' ||
    currentUser.role === 'subject_teacher' ||
    (currentUser.role as string) === 'teacher'
  ) {
    if (!activeTeacher) return [];
    return sortClasses(classes.filter((c) => isClassTeacherFor(activeTeacher, c.stream_id || c.id, classes)));
  }
  return [];
}

/**
 * Resolves the authoritative effective role for the current user.
 * If a user has role 'class_teacher', 'subject_teacher', or 'teacher', but has an assigned class/stream
 * where they are the designated class teacher, their effective portal role is 'class_teacher'.
 * If they have no assigned class/stream where they are the designated class teacher
 * (e.g. they only teach subjects, or were stripped of class assignment), their effective role is 'subject_teacher'.
 */
export function getEffectiveRole(
  currentUser: User | null,
  activeTeacher?: Teacher | null,
  classes: ClassStream[] = []
): Role {
  if (!currentUser) return 'subject_teacher';
  const role = currentUser.role as string;
  if (role === 'admin') return 'admin';
  if (role === 'learner' || role === 'student') return 'learner';

  if (
    role === 'class_teacher' ||
    role === 'subject_teacher' ||
    role === 'teacher'
  ) {
    if (activeTeacher !== undefined) {
      if (activeTeacher) {
        const primaryIds = getTeacherPrimaryClassIds(activeTeacher, classes);
        if (primaryIds.length > 0) {
          return 'class_teacher';
        }
        // If stripped of class or not assigned any class stream, default to subject_teacher
        return 'subject_teacher';
      }
      return 'subject_teacher';
    }
    // If activeTeacher was not passed (undefined in basic checks), fallback to current user.role
    return role === 'teacher' ? 'subject_teacher' : (role as Role);
  }

  return (currentUser.role as Role) || 'subject_teacher';
}

export function isPrePrimaryOrLowerPrimaryGrade(gradeName?: string): boolean {
  if (!gradeName) return false;
  const trimmed = gradeName.trim().toLowerCase();
  if (
    trimmed === 'pp1' ||
    trimmed === 'pp2' ||
    trimmed === 'grade 1' ||
    trimmed === 'grade 2' ||
    trimmed === 'grade 3' ||
    trimmed === 'pre-primary 1' ||
    trimmed === 'pre-primary 2' ||
    trimmed === 'pp 1' ||
    trimmed === 'pp 2' ||
    trimmed === 'g1' ||
    trimmed === 'g2' ||
    trimmed === 'g3'
  ) {
    return true;
  }
  if (trimmed.startsWith('pp') || trimmed.startsWith('pre-primary')) return true;
  if (trimmed === 'g1' || trimmed === 'g2' || trimmed === 'g3') return true;
  return false;
}

/**
 * Helper to check if a teacher allocation matches a target class or class stream.
 * Enforces strict stream isolation: an allocation for Stream A will never match Stream B.
 */
export function isAllocationForClassStream(
  alloc: TeacherAllocation,
  targetClassId: string,
  cls?: ClassStream
): boolean {
  if (!alloc) return false;

  // 1. Direct stream match by stream_id
  if (alloc.stream_id) {
    if (targetClassId === alloc.stream_id || cls?.stream_id === alloc.stream_id) {
      return true;
    }
    // If the allocation has a specific stream_id and the target is a known stream,
    // they do NOT match if stream_id differs.
    if (cls?.stream_id && alloc.stream_id !== cls.stream_id) {
      return false;
    }
  }

  // 2. Stream match by name (e.g. 'Blue' vs 'Red')
  if (alloc.stream && cls?.stream) {
    if (alloc.stream.trim().toLowerCase() !== cls.stream.trim().toLowerCase()) {
      return false;
    }
  }

  // 3. Class-level match (ID or name)
  const classMatches =
    (alloc.class_id && (targetClassId === alloc.class_id || cls?.id === alloc.class_id)) ||
    (cls && alloc.class_name && cls.class_name && alloc.class_name.trim().toLowerCase() === cls.class_name.trim().toLowerCase());

  if (!classMatches) {
    return false;
  }

  // If the allocation has NO stream (class-wide allocation), it applies to all streams of that class!
  if (!alloc.stream_id && !alloc.stream) {
    return true;
  }

  // If allocation has stream info and the target also has stream info, verify they match
  if (alloc.stream_id && cls?.stream_id) {
    return alloc.stream_id === cls.stream_id;
  }
  if (alloc.stream && cls?.stream) {
    return alloc.stream.trim().toLowerCase() === cls.stream.trim().toLowerCase();
  }

  return true;
}

/**
 * Returns the filtered list of Subjects accessible to the current user for subject-based operations.
 * Admin: all subjects
 * Teacher: assigned subjects or subjects in their assigned primary class stream
 */
export function getAccessibleSubjects(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  subjects: Subject[] = [],
  selectedClassId?: string,
  classes: ClassStream[] = []
): Subject[] {
  if (!currentUser) return subjects;
  if (currentUser.role === 'admin') return subjects;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    if (!activeTeacher) return [];

    // If a classId is provided
    if (selectedClassId) {
      const cls = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);

      // If the active teacher is the designated Class Teacher of that class stream,
      // they can access all subjects for that class
      if (isClassTeacherFor(activeTeacher, selectedClassId, classes)) {
        if (cls) {
          return getAllocatedSubjectsForClass(cls, subjects);
        }
        return subjects;
      }

      // If not the Class Teacher for this class, return subjects explicitly allocated to them for this class
      const teacherAllocs = activeTeacher.allocations || [];
      const classAllocs = teacherAllocs.filter((a) => isAllocationForClassStream(a, selectedClassId, cls));

      return subjects.filter((s) =>
        classAllocs.some(
          (a) =>
            (a.subject_id && (a.subject_id === s.id || a.subject_id === s.subject_code)) ||
            (a.subject_code && s.subject_code && a.subject_code.toUpperCase() === s.subject_code.toUpperCase()) ||
            (!a.subject_id && !a.subject_code && a.subject_name && a.subject_name.toLowerCase() === s.subject_name.toLowerCase())
        )
      );
    }

    // When no classId is provided (general accessible subjects across all assignments):
    const teacherAllocs = activeTeacher.allocations || [];
    const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);

    // If the teacher is a designated Class Teacher of any class, include that class's subjects
    const ctClasses = classes.filter((c) => isClassTeacherFor(activeTeacher, c.stream_id || c.id, classes));
    const ctSubjects = ctClasses.flatMap((c) => getAllocatedSubjectsForClass(c, subjects));

    return subjects.filter(
      (s) =>
        assignedIds.includes(s.id) ||
        ctSubjects.some((cts) => cts.id === s.id) ||
        teacherAllocs.some(
          (a) =>
            a.subject_id === s.id ||
            a.subject_id === s.subject_code ||
            (a.subject_code && a.subject_code === s.subject_code) ||
            (a.subject_name && a.subject_name.toLowerCase() === s.subject_name.toLowerCase())
        )
    );
  }
  return subjects;
}

/**
 * Returns the filtered list of Students accessible to the current user.
 * Admin: all students
 * Teacher: only students in assigned classes
 */
export function getAccessibleStudents(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  students: Student[] = [],
  classes: ClassStream[] = []
): Student[] {
  if (!currentUser) return students;
  if (currentUser.role === 'admin') return students;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    if (!activeTeacher) return [];
    const assignedIds = getTeacherAssignedClassIds(activeTeacher, classes);
    return students.filter((s) => {
      if (s.stream_id) {
        return assignedIds.includes(s.stream_id);
      }
      return assignedIds.includes(s.class_id);
    });
  }
  return students;
}

/**
 * Check if the teacher is a Class Teacher for a given class ID
 */
export function isClassTeacherFor(
  teacher: Teacher | null,
  classId: string,
  classes: ClassStream[] = []
): boolean {
  if (!teacher || !classId) return false;
  const cls = classes.find((c) => c.stream_id === classId || c.id === classId);
  if (teacher.class_teacher_of_id) {
    if (cls?.stream_id && teacher.class_teacher_of_id === cls.stream_id) return true;
    if (cls?.id && teacher.class_teacher_of_id === cls.id) return true;
    if (teacher.class_teacher_of_id === classId) return true;
  }
  if (
    cls &&
    (cls.class_teacher_id === teacher.id ||
      (teacher.user_id && cls.class_teacher_id === teacher.user_id) ||
      (teacher.tsc_number && cls.class_teacher_id === teacher.tsc_number))
  ) {
    return true;
  }
  return false;
}

/**
 * Check if the user/teacher can edit marks for a specific subject
 * Admin: true
 * Teacher: true if allocated OR if Class Teacher for the specified class (learning areas in their respective classes)
 */
export function canUserEditSubjectMarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  subjectId: string,
  classId?: string,
  classes: ClassStream[] = [],
  isExistingMark: boolean = false
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    if (!activeTeacher) return false;

    // Check if allocated for this subject
    const hasAllocation = classId
      ? (activeTeacher.allocations || []).some((a) => {
          const cls = classes.find((c) => c.stream_id === classId || c.id === classId);
          const classMatches = isAllocationForClassStream(a, classId, cls);

          if (!classMatches) return false;

          return (
            a.subject_id === subjectId ||
            (a.subject_code && a.subject_code === subjectId) ||
            (a.subject_name && a.subject_name.toLowerCase() === subjectId.toLowerCase())
          );
        })
      : getTeacherAssignedSubjectIds(activeTeacher).includes(subjectId);

    if (hasAllocation) return true;

    // A class teacher can edit marks for learning areas in their respective classes
    if (classId && isClassTeacherFor(activeTeacher, classId, classes)) {
      return true;
    }

    if (!classId) {
      const ctClasses = classes.filter((c) => isClassTeacherFor(activeTeacher, c.stream_id || c.id, classes));
      const ctSubjects = ctClasses.flatMap((c) => getAllocatedSubjectsForClass(c));
      if (ctSubjects.some((s) => s.id === subjectId || s.subject_code === subjectId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if the user/teacher can edit marks for a specific class
 * Admin: true
 * Teacher: true ONLY if classId is in teacher's assigned classes or is their respective class
 */
export function canUserEditClassMarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classId: string,
  classes: ClassStream[] = []
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    if (!activeTeacher) return false;
    if (isClassTeacherFor(activeTeacher, classId, classes)) return true;
    const assignedClassIds = getTeacherAssignedClassIds(activeTeacher, classes);
    return assignedClassIds.includes(classId);
  }
  return false;
}

/**
 * Check if the user/teacher can edit marks for a specific class AND subject combination
 * Admin: true
 * Teacher:
 *  - Explicit subject allocation: TRUE
 *  - Designated Class Teacher for their respective class: TRUE (can edit marks for learning areas in their respective classes)
 */
export function canUserEditClassAndSubjectMarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classId: string,
  subjectId: string,
  classes: ClassStream[] = [],
  isExistingMark: boolean = false
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    if (!activeTeacher) return false;

    // 1. Explicit subject allocation
    const cls = classes.find((c) => c.stream_id === classId || c.id === classId);
    const hasAllocation = (activeTeacher.allocations || []).some((a) => {
      const classMatches = isAllocationForClassStream(a, classId, cls);

      if (!classMatches) return false;

      return (
        a.subject_id === subjectId ||
        (a.subject_code && a.subject_code === subjectId) ||
        (a.subject_name && a.subject_name.toLowerCase() === subjectId.toLowerCase())
      );
    });

    if (hasAllocation) return true;

    // 2. Designated Class Teacher check (A class teacher can edit marks for learning areas in their respective classes)
    if (isClassTeacherFor(activeTeacher, classId, classes)) {
      return true;
    }

    return false;
  }
  return false;
}

/**
 * Check if user/teacher can edit Class Teacher remarks for a specific class
 * Admin: true
 * Teacher: true ONLY if teacher is the designated Class Teacher for that class
 */
export function canUserEditClassTeacherRemarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classId: string,
  classes: ClassStream[] = []
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher') {
    return isClassTeacherFor(activeTeacher, classId, classes);
  }
  return false;
}

export const ROLE_ALLOWED_TABS: Record<Role, string[]> = {
  admin: [
    'dashboard',
    'academic-session',
    'students',
    'student-promotion',
    'teachers',
    'classes',
    'subjects',
    'exams',
    'marks-entry',
    'marks-monitoring',
    'class-marks-monitoring',
    'stream-approval',
    'results-approval',
    'provisional',
    'exam-validation',
    'reports',
    'school-analytics',
    'grading',
    'school-profile',
    'system-settings',
    'developer-mode',
  ],
  class_teacher: [
    'dashboard',
    'academic-session',
    'students',
    'marks-entry',
    'class-marks-monitoring',
    'stream-approval',
    'results-approval',
    'provisional',
    'reports',
  ],
  subject_teacher: [
    'dashboard',
    'academic-session',
    'marks-entry',
    'reports',
  ],
  learner: [
    'learner-portal',
  ],
};

export const isTabAllowedForRole = (
  user: User | null,
  tab: string,
  activeTeacher?: Teacher | null,
  classes: ClassStream[] = []
): boolean => {
  if (!user) return false;
  const effectiveRole = getEffectiveRole(user, activeTeacher, classes);
  if (effectiveRole === 'admin') {
    return ROLE_ALLOWED_TABS.admin.includes(tab);
  }
  if (effectiveRole === 'class_teacher') {
    return ROLE_ALLOWED_TABS.class_teacher.includes(tab);
  }
  if (effectiveRole === 'subject_teacher') {
    return ROLE_ALLOWED_TABS.subject_teacher.includes(tab);
  }
  if (effectiveRole === 'learner') {
    return ROLE_ALLOWED_TABS.learner.includes(tab);
  }
  return false;
};

/**
 * Check if the user is authorized to access Class Performance Comparison.
 * - Admin: TRUE
 * - Stream Class Teacher: TRUE (within their authorized scope)
 * - Subject Teacher: FALSE (Strictly blocked)
 * - Learner: FALSE
 */
export function canUserAccessClassComparison(
  currentUser: User | null,
  activeTeacher?: Teacher | null,
  classes: ClassStream[] = []
): boolean {
  if (!currentUser) return false;
  const effectiveRole = getEffectiveRole(currentUser, activeTeacher, classes);
  if (effectiveRole === 'admin') return true;
  if (effectiveRole === 'class_teacher') return true;
  return false;
}

/**
 * Returns the list of ClassStreams accessible for Class Performance Comparison.
 * - Admin: all classes
 * - Class Teacher: all streams for the grade levels they are authorized for (so they can compare both/all streams of their grade)
 * - Subject Teacher / Learner: empty array
 */
export function getAccessibleClassesForComparison(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classes: ClassStream[] = []
): ClassStream[] {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return sortClasses(classes);

  const effectiveRole = getEffectiveRole(currentUser, activeTeacher, classes);
  if (effectiveRole !== 'class_teacher' && effectiveRole !== 'admin') {
    return [];
  }

  // Determine authorized grade names for the class teacher
  const baseClasses = getAccessibleClasses(currentUser, activeTeacher, classes);
  const authorizedGradeNames = new Set(
    baseClasses.map((c) => (c.class_name || '').trim().toLowerCase())
  );

  if (activeTeacher?.class_teacher_of_id) {
    const matched = classes.find(
      (c) => c.stream_id === activeTeacher.class_teacher_of_id || c.id === activeTeacher.class_teacher_of_id
    );
    if (matched?.class_name) {
      authorizedGradeNames.add(matched.class_name.trim().toLowerCase());
    }
  }

  return sortClasses(
    classes.filter((c) =>
      authorizedGradeNames.has((c.class_name || '').trim().toLowerCase())
    )
  );
}

/**
 * Returns the list of Students accessible for Class Performance Comparison.
 * - Admin: all students
 * - Class Teacher: all students in all streams of their authorized grade levels
 * - Subject Teacher / Learner: empty array
 */
export function getAccessibleStudentsForComparison(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  students: Student[] = [],
  classes: ClassStream[] = []
): Student[] {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return students;

  const effectiveRole = getEffectiveRole(currentUser, activeTeacher, classes);
  if (effectiveRole !== 'class_teacher' && effectiveRole !== 'admin') {
    return [];
  }

  const compClasses = getAccessibleClassesForComparison(currentUser, activeTeacher, classes);
  const authorizedGradeNames = new Set(
    compClasses.map((c) => (c.class_name || '').trim().toLowerCase())
  );
  const authorizedStreamIds = new Set(
    compClasses.flatMap((c) => [c.id, c.stream_id].filter(Boolean) as string[])
  );

  return students.filter((s) => {
    if (s.grade && authorizedGradeNames.has(s.grade.trim().toLowerCase())) return true;
    if (s.stream_id && authorizedStreamIds.has(s.stream_id)) return true;
    if (s.class_id && authorizedStreamIds.has(s.class_id)) return true;
    return false;
  });
}

