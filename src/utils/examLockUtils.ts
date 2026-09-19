import { Examination, EducationLevel, ClassStream, getEducationLevelForGrade } from '../types';

/**
 * Checks if a specific education level is approved/locked for an examination.
 * Falls back to global exam.status === 'Approved' | 'Published'
 * for complete backward compatibility with existing examinations.
 */
export function isLevelApproved(
  exam: Examination | null | undefined,
  level: EducationLevel | string | null | undefined
): boolean {
  if (!exam) return false;
  if (
    exam.status === 'Approved' ||
    exam.status === 'Published' ||
    (exam.status as string) === 'Official Results Released'
  ) {
    return true;
  }
  if (!level) return false;
  return (exam.approved_levels || []).includes(level as EducationLevel);
}

/**
 * Checks if a specific class/stream is approved/locked for an examination.
 * Resolves by stream UUID, class UUID, class name, education level, or global exam approval.
 */
export function isClassExamApproved(
  exam: Examination | null | undefined,
  classStream: ClassStream | null | undefined | { id?: string; stream_id?: string; class_name?: string; stream?: string; education_level?: EducationLevel }
): boolean {
  if (!exam) return false;
  if (!classStream) return false;

  // 1. If exam has explicit class targeting (class_id !== 'all'), verify class match
  if (exam.class_id && exam.class_id !== 'all') {
    const matchesTarget =
      exam.class_id === classStream.id ||
      ('stream_id' in classStream && exam.class_id === classStream.stream_id) ||
      (classStream.class_name && exam.class_id.toLowerCase() === classStream.class_name.toLowerCase());
    if (!matchesTarget) {
      return false;
    }
  }

  // 2. If exam has education_level specified, verify education level match
  const eduLevel = classStream.education_level || (classStream.class_name ? getEducationLevelForGrade(classStream.class_name) : undefined);
  if (exam.education_level && eduLevel && exam.education_level !== eduLevel) {
    return false;
  }

  // 3. If exam has approved_levels specified, class's education level must be in approved_levels
  if (exam.approved_levels && exam.approved_levels.length > 0 && eduLevel) {
    if (!exam.approved_levels.includes(eduLevel)) {
      return false;
    }
  }

  // 4. If exam has approved_classes specified, stream/class must be in approved_classes
  const approvedList = exam.approved_classes || [];
  if (approvedList.length > 0) {
    const isExplicitlyApproved =
      ('stream_id' in classStream && classStream.stream_id && approvedList.includes(classStream.stream_id)) ||
      (classStream.id && approvedList.includes(classStream.id)) ||
      (classStream.class_name && approvedList.includes(classStream.class_name));
    if (!isExplicitlyApproved) {
      return false;
    }
  }

  // 5. If targeting/approval restrictions passed, check exam status
  if (
    exam.status === 'Approved' ||
    exam.status === 'Published' ||
    (exam.status as string) === 'Official Results Released'
  ) {
    return true;
  }

  // 6. Progressive / Provisional mode approvals
  if (eduLevel && (exam.approved_levels || []).includes(eduLevel)) {
    return true;
  }
  if ('stream_id' in classStream && classStream.stream_id && approvedList.includes(classStream.stream_id)) {
    return true;
  }
  if (classStream.id && approvedList.includes(classStream.id)) {
    return true;
  }
  if (classStream.class_name && approvedList.includes(classStream.class_name)) {
    return true;
  }

  return false;
}

/**
 * Checks if a specific stream is approved for an exam.
 */
export function isStreamApproved(
  exam: Examination | null | undefined,
  streamIdentifier: string | undefined,
  classes: ClassStream[]
): boolean {
  if (!exam || !streamIdentifier) return false;
  const targetClass = classes.find(
    (c) => c.stream_id === streamIdentifier || c.id === streamIdentifier || c.class_name === streamIdentifier
  );
  if (targetClass) {
    return isClassExamApproved(exam, targetClass);
  }
  return (exam.approved_classes || []).includes(streamIdentifier);
}

/**
 * Checks if all active streams in a grade are approved for an examination.
 */
export function isGradeFullyApproved(
  exam: Examination | null | undefined,
  gradeName: string,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (exam.status === 'Approved' || exam.status === 'Published') return true;

  const gradeStreams = classes.filter(
    (c) => c.class_name?.toLowerCase() === gradeName.toLowerCase() && c.status !== 'Inactive'
  );

  if (gradeStreams.length === 0) return false;
  return gradeStreams.every((st) => isClassExamApproved(exam, st));
}

/**
 * Checks if all active streams in an education level are approved for an examination.
 */
export function isEducationLevelFullyApproved(
  exam: Examination | null | undefined,
  level: EducationLevel,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (exam.status === 'Approved' || exam.status === 'Published') return true;
  if ((exam.approved_levels || []).includes(level)) return true;

  const levelStreams = classes.filter((c) => {
    if (c.status === 'Inactive') return false;
    const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : undefined);
    return cLevel === level;
  });

  if (levelStreams.length === 0) return false;
  return levelStreams.every((st) => isClassExamApproved(exam, st));
}

/**
 * Checks if all active streams across the entire school are approved for an examination.
 */
export function isExaminationFullyApproved(
  exam: Examination | null | undefined,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (exam.status === 'Approved' || exam.status === 'Published') return true;

  const activeStreams = classes.filter((c) => c.status !== 'Inactive');
  if (activeStreams.length === 0) return false;
  return activeStreams.every((st) => isClassExamApproved(exam, st));
}

/**
 * Checks if a student's class/level is approved for an exam.
 */
export function isStudentExamApproved(
  exam: Examination | null | undefined,
  studentClassId: string | undefined,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (!studentClassId) return false;

  const targetClass = classes.find(
    (c) => c.stream_id === studentClassId || c.id === studentClassId || c.class_name === studentClassId
  );
  if (targetClass) {
    return isClassExamApproved(exam, targetClass);
  }

  // Fallback: check direct presence in approved_classes or global status if untargeted
  if (exam.approved_classes && exam.approved_classes.length > 0) {
    return exam.approved_classes.includes(studentClassId);
  }

  return (
    exam.status === 'Approved' ||
    exam.status === 'Published' ||
    (exam.status as string) === 'Official Results Released'
  );
}
