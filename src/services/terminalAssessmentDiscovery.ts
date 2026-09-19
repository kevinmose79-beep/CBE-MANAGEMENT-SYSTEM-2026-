import { Examination, Mark, MarkResolution, Student, ClassStream, SubjectStatus } from '../types';
import { ContributingAssessmentRef } from './terminalResultsEngine';
import { isClassExamApproved, isStudentExamApproved } from '../utils/examLockUtils';
import { isStudentEligibleForExam } from './analysisEngine';
import { createSupabaseClient, isUUID, api } from '../lib/storage';

export interface TerminalAssessmentDiscoveryParams {
  academicYearId: string;
  termId: string;
  student: Student;
  classStream: ClassStream;
  isProvisionalMode?: boolean;
  subjectId?: string;
  examinations?: Examination[];
  marks?: Mark[];
  resolutions?: MarkResolution[];
  classes?: ClassStream[];
  allMarks?: Mark[];
  students?: Student[];
  cohortMarks?: Mark[];
}

export interface DiscoveredTerminalContext {
  academicYearId: string;
  termId: string;
  studentId: string;
  streamId: string;
  isProvisionalMode: boolean;
  contributingAssessments: ContributingAssessmentRef[];
  marks: Mark[];
  resolutions: MarkResolution[];
  assessmentCount: number;
}

/**
 * Validates the examination maximum score strictly against authoritative rules.
 * Rule 5: Use examinations.max_marks. NEVER silently fall back to 100.
 * If missing, null, zero, negative, or invalid, explicitly throw an error.
 */
export function validateAndExtractMaxMarks(exam: Examination): number {
  const rawMax = exam.max_marks;
  if (
    rawMax === undefined ||
    rawMax === null ||
    typeof rawMax !== 'number' ||
    !Number.isFinite(rawMax) ||
    rawMax <= 0
  ) {
    throw new Error(
      `Assessment "${exam.exam_name}" (${exam.id}) has missing or invalid maximum score (max_marks: ${rawMax}). Cannot fabricate maximum score.`
    );
  }
  return rawMax;
}

/**
 * Pure evaluation function to determine if an examination is eligible for a learner's
 * Terminal Result context according to locked CBE rules.
 */
export function isExamEligibleForTerminal(
  exam: Examination,
  params: {
    academicYearId: string;
    termId: string;
    student: Student;
    classStream: ClassStream;
    isProvisionalMode?: boolean;
    subjectId?: string;
    studentMarksForExam?: Mark[];
    classes?: ClassStream[];
    allMarks?: Mark[];
    students?: Student[];
    cohortMarksForExam?: Mark[];
  }
): boolean {
  // 1. Status Check: Draft and Archived are ALWAYS excluded
  if (exam.status === 'Draft' || (exam.status as string) === 'Archived') {
    return false;
  }

  // 2. Academic Isolation: Academic Year & Term match
  const matchYear = exam.academic_year_id
    ? exam.academic_year_id === params.academicYearId
    : String(exam.year) === String(params.academicYearId);

  const matchTerm = exam.term_id
    ? exam.term_id === params.termId
    : exam.term === params.termId;

  if (!matchYear || !matchTerm) {
    return false;
  }

  // 3. Learning Area Isolation: If exam is scoped to a specific subject, ensure match
  if (params.subjectId && (exam as any).subject_id) {
    if ((exam as any).subject_id !== params.subjectId) {
      return false;
    }
  }

  // 4. Stream / Class Approval Check
  const classObj = params.classStream;
  const classesList = params.classes || (classObj ? [classObj] : []);
  const studentClassId = params.student.stream_id || params.student.class_id || classObj?.stream_id || classObj?.id;

  const isApprovedForStream =
    isClassExamApproved(exam, classObj) ||
    isStudentExamApproved(exam, studentClassId, classesList);

  if (!params.isProvisionalMode) {
    // Official Mode: Must be approved for this stream/class
    if (!isApprovedForStream) {
      return false;
    }
  } else {
    // Provisional Mode: Allowed if Provisional or Approved. Draft/Archived were already excluded above.
    if (exam.status !== 'Provisional' && !isApprovedForStream) {
      return false;
    }
  }

  // 5. Learner Eligibility Check: Admission date, intake year/term, enrollment status
  const isEligibleLearner = isStudentEligibleForExam(
    params.student,
    exam,
    params.studentMarksForExam || []
  );

  if (!isEligibleLearner) {
    return false;
  }

  // 6. Authoritative Cohort Participation Verification
  // If the student has recorded marks for this exam, the student participated.
  if (params.studentMarksForExam && params.studentMarksForExam.length > 0) {
    return true;
  }

  // If learner has no recorded marks, check cohort mark participation evidence.
  // Explicitly empty cohort marks passed -> non-participating.
  if (params.cohortMarksForExam !== undefined && params.cohortMarksForExam.length === 0) {
    return false;
  }

  // When cohort students and marks are available, verify whether the learner's grade actually sat the assessment
  if (params.allMarks && params.students && params.students.length > 0) {
    const studentGrade = params.student.grade || (params.classStream as any)?.grade || params.classStream?.class_name || '';
    const cohortStudents = params.students.filter((s) => {
      if (studentGrade && s.grade && s.grade === studentGrade) {
        return true;
      }
      if (params.classStream) {
        if (params.classStream.id && s.class_id && s.class_id === params.classStream.id) return true;
        if (params.classStream.stream_id && s.stream_id && s.stream_id === params.classStream.stream_id) return true;
      }
      return false;
    });

    if (cohortStudents.length > 0) {
      const cohortStudentIds = new Set(cohortStudents.map((s) => s.id));
      const cohortMarks = params.allMarks.filter(
        (m) => m.exam_id === exam.id && cohortStudentIds.has(m.student_id)
      );
      const assessedCohortIds = new Set(cohortMarks.map((m) => m.student_id));
      const countAssessed = assessedCohortIds.size;

      // If zero learners in this cohort have marks, the exam was not administered to this grade
      if (countAssessed === 0) {
        return false;
      }

      // Scenario D: accidental/isolated mark entry below quorum (< 10% and < 3 learners in cohort >= 10)
      if (cohortStudents.length >= 10 && countAssessed < 3 && countAssessed / cohortStudents.length < 0.1) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filter a collection of examinations to those eligible for terminal result calculation,
 * returning properly structured ContributingAssessmentRef objects.
 * Examination-First: Assessments are discovered independently of whether the learner
 * has entered marks for them.
 */
export function filterEligibleTerminalAssessments(
  examinations: Examination[],
  params: {
    academicYearId: string;
    termId: string;
    student: Student;
    classStream: ClassStream;
    isProvisionalMode?: boolean;
    subjectId?: string;
    studentMarks?: Mark[];
    classes?: ClassStream[];
    allMarks?: Mark[];
    students?: Student[];
    cohortMarks?: Mark[];
  }
): ContributingAssessmentRef[] {
  const eligibleExams = examinations.filter((exam) => {
    const examMarks = (params.studentMarks || []).filter((m) => m.exam_id === exam.id);
    const cohortExamMarks = params.cohortMarks
      ? params.cohortMarks.filter((m) => m.exam_id === exam.id)
      : undefined;

    return isExamEligibleForTerminal(exam, {
      ...params,
      studentMarksForExam: examMarks,
      cohortMarksForExam: cohortExamMarks,
    });
  });

  // Sort assessments deterministically by start_date, date_created, created_at, or id
  const sortedExams = [...eligibleExams].sort((a, b) => {
    const dateA = a.start_date || a.date_created || a.created_at || '';
    const dateB = b.start_date || b.date_created || b.created_at || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.id.localeCompare(b.id);
  });

  return sortedExams.map((exam) => {
    const maxScore = validateAndExtractMaxMarks(exam);
    return {
      id: exam.id,
      exam_name: exam.exam_name,
      max_marks: maxScore,
      out_of: maxScore,
      status: exam.status,
    };
  });
}

/**
 * Authoritative Terminal Assessment Discovery Service
 * Queries Supabase (or uses provided authoritative dataset) to discover all contributing
 * assessments for a learner in an academic session, preserving missing assessments,
 * genuine zeros, and resolution provenance.
 */
export async function discoverTerminalAssessments(
  params: TerminalAssessmentDiscoveryParams
): Promise<DiscoveredTerminalContext> {
  const client = createSupabaseClient();

  // 1. Fetch Examinations from Supabase if not provided
  let rawExams: Examination[] = params.examinations || [];
  if (!params.examinations && client) {
    let query = client.from('examinations').select('*');
    if (isUUID(params.academicYearId)) {
      query = query.eq('academic_year_id', params.academicYearId);
    } else {
      const numYear = Number(params.academicYearId);
      if (Number.isFinite(numYear)) {
        query = query.eq('year', numYear);
      }
    }

    if (isUUID(params.termId)) {
      query = query.eq('term_id', params.termId);
    } else {
      query = query.eq('term', params.termId);
    }

    const { data: dbExams, error: examError } = await query;
    if (examError) {
      throw new Error(`Failed to query examinations from Supabase: ${examError.message}`);
    }
    rawExams = (dbExams as Examination[]) || [];
  }

  // 2. Authoritatively ensure learner marks for candidate assessments
  // CRITICAL REQUIREMENT: Examinations being provided MUST NOT prevent querying Supabase for the learner's marks.
  // The condition answers: «"Do I actually have authoritative marks for this selected learner and the relevant assessments?"»
  let rawMarks: Mark[] = params.marks ? [...params.marks] : [];
  const validExamUuids = rawExams.map((e) => e.id).filter((id) => isUUID(id));

  const learnerCandidateMarks = rawMarks.filter(
    (m) =>
      (m.student_id === params.student.id || (m as any).admission_number === params.student.admission_number) &&
      validExamUuids.includes(m.exam_id)
  );

  if (client && isUUID(params.student.id) && validExamUuids.length > 0 && learnerCandidateMarks.length === 0) {
    let marksQuery = client
      .from('marks')
      .select('*')
      .eq('student_id', params.student.id)
      .in('exam_id', validExamUuids);

    if (params.subjectId && isUUID(params.subjectId)) {
      marksQuery = marksQuery.eq('subject_id', params.subjectId);
    }

    try {
      const { data: dbMarks, error: marksError } = await marksQuery;
      if (marksError) {
        console.warn(`[terminalAssessmentDiscovery] Supabase marks query notice: ${marksError.message}`);
      } else if (dbMarks && dbMarks.length > 0) {
        const mapped = api.mapDatabaseMarks(dbMarks);
        const markMap = new Map<string, Mark>();
        rawMarks.forEach((m) => markMap.set(m.id || `${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mapped.forEach((m) => markMap.set(m.id || `${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        rawMarks = Array.from(markMap.values());
      }
    } catch (queryErr: any) {
      console.warn(`[terminalAssessmentDiscovery] Supabase marks query caught: ${queryErr?.message || queryErr}`);
    }
  }

  // 3. Filter eligible contributing assessments (Pattern A: Examination-First)
  const contributingAssessments = filterEligibleTerminalAssessments(rawExams, {
    academicYearId: params.academicYearId,
    termId: params.termId,
    student: params.student,
    classStream: params.classStream,
    isProvisionalMode: params.isProvisionalMode,
    subjectId: params.subjectId,
    studentMarks: rawMarks,
    classes: params.classes,
    allMarks: params.allMarks || params.marks,
    students: params.students,
    cohortMarks: params.cohortMarks,
  });

  const discoveredExamIds = new Set(contributingAssessments.map((a) => a.id));

  // 4. Filter marks to only those matching discovered assessments, this student, and subject if specified
  // Enforces absolute cross-learner isolation: only marks belonging to this learner can be included
  const relevantMarks = rawMarks.filter((m) => {
    const isLearner =
      m.student_id === params.student.id ||
      (m as any).admission_number === params.student.admission_number;
    if (!isLearner) return false;
    if (!discoveredExamIds.has(m.exam_id)) return false;
    if (params.subjectId && m.subject_id !== params.subjectId) return false;
    return true;
  });

  // 5. Fetch Mark Resolutions for any Y marks if not explicitly passed
  let resolutions: MarkResolution[] = params.resolutions || [];
  if (!params.resolutions && client && relevantMarks.length > 0) {
    const yMarkIds = relevantMarks
      .filter((m) => (m.special_status || m.status) === 'Y')
      .map((m) => m.id)
      .filter((id) => isUUID(id));

    if (yMarkIds.length > 0) {
      const { data: resData, error: resError } = await client
        .from('mark_resolutions')
        .select('*')
        .in('mark_id', yMarkIds);

      if (resError) {
        throw new Error(`Failed to query mark_resolutions from Supabase: ${resError.message}`);
      }
      resolutions = (resData as MarkResolution[]) || [];
    }
  }

  // 6. Enrich marks with resolutions and normalize score fields for seamless terminal engine consumption
  const resolutionsMap = new Map<string, MarkResolution>();
  resolutions.forEach((r) => {
    if (r.mark_id) resolutionsMap.set(r.mark_id, r);
  });

  const enrichedMarks: Mark[] = relevantMarks.map((m) => {
    const res = resolutionsMap.get(m.id);
    const numVal =
      typeof m.raw_score === 'number'
        ? m.raw_score
        : typeof m.marks === 'number'
          ? m.marks
          : typeof m.score === 'number'
            ? m.score
            : null;

    const resolvedStatus: SubjectStatus = res
      ? 'Normal'
      : ((m.special_status || m.status || 'Normal') as SubjectStatus);

    return {
      ...m,
      raw_score: numVal !== null ? numVal : m.raw_score,
      marks: numVal !== null ? numVal : (typeof m.marks === 'number' ? m.marks : 0),
      special_status: resolvedStatus,
      status: resolvedStatus,
      resolution: res || m.resolution,
    };
  });

  return {
    academicYearId: params.academicYearId,
    termId: params.termId,
    studentId: params.student.id,
    streamId: params.classStream.stream_id || params.classStream.id,
    isProvisionalMode: Boolean(params.isProvisionalMode),
    contributingAssessments,
    marks: enrichedMarks,
    resolutions,
    assessmentCount: contributingAssessments.length,
  };
}
