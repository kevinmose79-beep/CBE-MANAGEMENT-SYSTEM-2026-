import { Teacher } from '../types';

/**
 * Resolves the authoritative teacher assigned to teach a specific Learning Area / Subject
 * for a learner in a specific class and stream.
 *
 * Implements strict stream-aware resolution:
 * 1. If an exact stream-specific allocation exists:
 *    allocation.subject_id === subjectId && allocation.stream_id === streamId
 *    return that teacher.
 * 2. If there is NO stream-specific allocation and there is a legitimate class-wide allocation:
 *    allocation.subject_id === subjectId && allocation.class_id === classId && (!allocation.stream_id || allocation.stream_id.trim() === '')
 *    return that teacher.
 * 3. Otherwise:
 *    return undefined.
 *
 * CRITICAL INVARIANT: Sibling stream allocations (where allocation.stream_id !== streamId)
 * MUST NEVER satisfy the lookup. Never substitute a teacher from a sibling stream.
 */
export function resolveSubjectTeacher(
  teachers: Teacher[] | undefined,
  subjectId: string | undefined,
  classId?: string | undefined,
  streamId?: string | undefined
): Teacher | undefined {
  if (!teachers || teachers.length === 0 || !subjectId) return undefined;

  const cleanSubjectId = subjectId.trim();
  const cleanStreamId = streamId?.trim();
  const cleanClassId = classId?.trim();

  // 1. Exact stream match (highest priority)
  if (cleanStreamId) {
    const streamMatch = teachers.find((t) =>
      (t.allocations || []).some(
        (a) =>
          a &&
          a.subject_id === cleanSubjectId &&
          Boolean(a.stream_id && a.stream_id.trim() === cleanStreamId)
      )
    );
    if (streamMatch) return streamMatch;
  }

  // 2. Legitimate class-wide allocation ONLY where stream_id is null/undefined/empty
  if (cleanClassId) {
    const classWideMatch = teachers.find((t) =>
      (t.allocations || []).some(
        (a) =>
          a &&
          a.subject_id === cleanSubjectId &&
          Boolean(a.class_id && a.class_id.trim() === cleanClassId) &&
          (!a.stream_id || a.stream_id.trim() === '')
      )
    );
    if (classWideMatch) return classWideMatch;
  }

  return undefined;
}
