import {
  Student,
  Subject,
  Mark,
  Grade,
  Result,
  ExamAnalysisSummary,
  ClassStream,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  extractGradeName,
  normalizeGradeName,
  getEducationLevelForGrade,
  Teacher,
  Examination,
  getShortCbeCode,
  EducationLevel
} from '../types';
import { api } from '../lib/storage';
import { getLearnerClassAtExamTime } from './historicalContextResolver';

/**
 * Determines whether a student is academically eligible for an examination based on admission date and intake period.
 * 
 * Rules:
 * 1. Future intake: Learners scheduled for future years/terms are NOT eligible for past or current exams.
 * 2. Pre-admission exam: If the examination took place prior to the student's intake year/term or admission_date,
 *    and the student has NO recorded marks for this exam, the student is NOT eligible (should not be marked 'X'/missing or included in averages).
 * 3. Mid-term admission: A student admitted during an active term is eligible for current and future assessments from their admission date onward.
 *    If an exam occurred before their admission date within the term and has no marks entered, they are excluded from missing mark penalties and class averages.
 */
export function isStudentEligibleForExam(
  student: Student,
  examination?: Examination | null,
  studentMarksForExam: Mark[] = []
): boolean {
  if (!student) return false;

  // If marks already exist for this student and exam, the student participated -> eligible
  if (studentMarksForExam && studentMarksForExam.length > 0) {
    return true;
  }

  // Future intake status check
  if (student.enrolment_status === 'future') {
    return false;
  }

  if (!examination) {
    return student.active !== false && student.enrolment_status !== 'inactive';
  }

  // Explicit examination targeting checks (if student has no entered marks)
  if (examination.class_id && examination.class_id !== 'all') {
    if (student.class_id !== examination.class_id && student.stream_id !== examination.class_id) {
      return false;
    }
  }

  if (examination.education_level && student.education_level && examination.education_level !== student.education_level) {
    return false;
  }

  if (examination.approved_levels && examination.approved_levels.length > 0 && student.education_level) {
    if (!examination.approved_levels.includes(student.education_level)) {
      return false;
    }
  }

  if (examination.approved_classes && examination.approved_classes.length > 0) {
    const studentClassKeys = [student.class_id, student.stream_id, student.grade].filter(Boolean);
    if (!studentClassKeys.some((k) => examination.approved_classes!.includes(k!))) {
      return false;
    }
  }

  // Check intake year & term relative to exam
  const examYear = examination.year;
  const examTerm = examination.term;

  if (student.intake_year) {
    if (student.intake_year > examYear) {
      // Admitted in a later academic year
      return false;
    }
    if (student.intake_year === examYear && student.intake_term && examTerm) {
      const termOrder: Record<string, number> = {
        'Term 1': 1,
        'Term 2': 2,
        'Term 3': 3,
      };
      const intakeTermNum = termOrder[student.intake_term] || 1;
      const examTermNum = termOrder[examTerm] || 1;
      if (intakeTermNum > examTermNum) {
        // Admitted in a later term of the same year
        return false;
      }
    }
  }

  // Mid-term date-based eligibility check if admission_date and exam dates are present
  if (student.admission_date) {
    const examDateStr = examination.start_date || examination.end_date || examination.date_created;
    if (examDateStr) {
      const admTime = new Date(student.admission_date).getTime();
      const examTime = new Date(examDateStr).getTime();
      if (!isNaN(admTime) && !isNaN(examTime)) {
        // If exam was strictly before student was admitted to the school
        if (examTime < admTime) {
          return false;
        }
      }
    }
  }

  // Standard active learner
  return student.active !== false && student.enrolment_status !== 'inactive';
}

/**
 * Authoritative KNEC CBE Tie Inspector
 * Returns true if two learners share equal qualifying totals for merit ranking:
 * Average Points, Total Points, Total Marks, and Mean Score / Average Percentage.
 */
export function isMeritTie(
  a: { average_points?: number; total_points?: number; total_marks?: number; average?: number; mean_percentage?: number },
  b: { average_points?: number; total_points?: number; total_marks?: number; average?: number; mean_percentage?: number }
): boolean {
  if (!a || !b) return false;
  
  // 1. Average Points comparison (rounded to 2 decimal places to prevent floating point inaccuracy)
  const aAvgPts = Math.round((a.average_points ?? 0) * 100);
  const bAvgPts = Math.round((b.average_points ?? 0) * 100);
  if (aAvgPts !== bAvgPts) return false;

  // 2. Total Points comparison (rounded to 2 decimal places)
  const aTotPts = Math.round((a.total_points ?? 0) * 100);
  const bTotPts = Math.round((b.total_points ?? 0) * 100);
  if (aTotPts !== bTotPts) return false;

  // 3. Total Marks comparison
  const aTotMarks = Math.round(a.total_marks ?? 0);
  const bTotMarks = Math.round(b.total_marks ?? 0);
  if (aTotMarks !== bTotMarks) return false;

  // 4. Mean Percentage / Average Score (rounded to 1 decimal place)
  const aAvg = Math.round((a.average ?? a.mean_percentage ?? 0) * 10);
  const bAvg = Math.round((b.average ?? b.mean_percentage ?? 0) * 10);
  return aAvg === bAvg;
}

/**
 * Centralized Authoritative Competition Ranking Helper (1, 1, 3 method)
 * Applies KNEC CBE standard competition ranking across any list of sorted items.
 * Tied items according to `isTieFn` share identical rank, and subsequent ranks skip accordingly.
 */
export function applyCompetitionRanking<T>(
  items: T[],
  isTieFn: (a: T, b: T) => boolean,
  setRankFn: (item: T, rank: number) => void
): T[] {
  let currentRank = 1;
  items.forEach((item, index) => {
    if (index > 0) {
      const prevItem = items[index - 1];
      if (!isTieFn(item, prevItem)) {
        currentRank = index + 1;
      }
    } else {
      currentRank = 1;
    }
    setRankFn(item, currentRank);
  });
  return items;
}

export const CBE_8_POINT_GRADES: Grade[] = [
  {
    id: 'gr_ee1',
    grade_code: 'EE1',
    performance_level: 'EE',
    minimum_score: 90,
    maximum_score: 100,
    points: 8,
    remarks: 'Outstanding Performance',
    descriptor: 'Exceeding Expectations',
    grade: 'EE1',
    minimum_marks: 90,
    maximum_marks: 100,
  },
  {
    id: 'gr_ee2',
    grade_code: 'EE2',
    performance_level: 'EE',
    minimum_score: 75,
    maximum_score: 89,
    points: 7,
    remarks: 'Excellent Performance',
    descriptor: 'Exceeding Expectations',
    grade: 'EE2',
    minimum_marks: 75,
    maximum_marks: 89,
  },
  {
    id: 'gr_me1',
    grade_code: 'ME1',
    performance_level: 'ME',
    minimum_score: 58,
    maximum_score: 74,
    points: 6,
    remarks: 'Good Performance',
    descriptor: 'Meeting Expectations',
    grade: 'ME1',
    minimum_marks: 58,
    maximum_marks: 74,
  },
  {
    id: 'gr_me2',
    grade_code: 'ME2',
    performance_level: 'ME',
    minimum_score: 41,
    maximum_score: 57,
    points: 5,
    remarks: 'Satisfactory Performance',
    descriptor: 'Meeting Expectations',
    grade: 'ME2',
    minimum_marks: 41,
    maximum_marks: 57,
  },
  {
    id: 'gr_ae1',
    grade_code: 'AE1',
    performance_level: 'AE',
    minimum_score: 31,
    maximum_score: 40,
    points: 4,
    remarks: 'Developing Competency',
    descriptor: 'Approaching Expectations',
    grade: 'AE1',
    minimum_marks: 31,
    maximum_marks: 40,
  },
  {
    id: 'gr_ae2',
    grade_code: 'AE2',
    performance_level: 'AE',
    minimum_score: 21,
    maximum_score: 30,
    points: 3,
    remarks: 'Needs More Practice',
    descriptor: 'Approaching Expectations',
    grade: 'AE2',
    minimum_marks: 21,
    maximum_marks: 30,
  },
  {
    id: 'gr_be1',
    grade_code: 'BE1',
    performance_level: 'BE',
    minimum_score: 11,
    maximum_score: 20,
    points: 2,
    remarks: 'Requires Intervention',
    descriptor: 'Below Expectations',
    grade: 'BE1',
    minimum_marks: 11,
    maximum_marks: 20,
  },
  {
    id: 'gr_be2',
    grade_code: 'BE2',
    performance_level: 'BE',
    minimum_score: 0,
    maximum_score: 10,
    points: 1,
    remarks: 'Immediate Support Required',
    descriptor: 'Below Expectations',
    grade: 'BE2',
    minimum_marks: 0,
    maximum_marks: 10,
  },
];

export const CBE_4_POINT_GRADES: Grade[] = [
  {
    id: 'gr_up_ee',
    grade_code: 'EE',
    performance_level: 'EE',
    minimum_score: 76,
    maximum_score: 100,
    points: 4,
    remarks: 'Exceeding Expectations',
    descriptor: 'Exceeding Expectations',
    grade: 'EE',
    minimum_marks: 76,
    maximum_marks: 100,
  },
  {
    id: 'gr_up_me',
    grade_code: 'ME',
    performance_level: 'ME',
    minimum_score: 51,
    maximum_score: 75,
    points: 3,
    remarks: 'Meeting Expectations',
    descriptor: 'Meeting Expectations',
    grade: 'ME',
    minimum_marks: 51,
    maximum_marks: 75,
  },
  {
    id: 'gr_up_ae',
    grade_code: 'AE',
    performance_level: 'AE',
    minimum_score: 26,
    maximum_score: 50,
    points: 2,
    remarks: 'Approaching Expectations',
    descriptor: 'Approaching Expectations',
    grade: 'AE',
    minimum_marks: 26,
    maximum_marks: 50,
  },
  {
    id: 'gr_up_be',
    grade_code: 'BE',
    performance_level: 'BE',
    minimum_score: 0,
    maximum_score: 25,
    points: 1,
    remarks: 'Below Expectations',
    descriptor: 'Below Expectations',
    grade: 'BE',
    minimum_marks: 0,
    maximum_marks: 25,
  },
];

/**
 * Find matching grade configuration based on numerical score (0-100%) and educational phase/grade context.
 * Upper Primary (Grades 4-6) uses the 4-Point scale (EE: 4, ME: 3, AE: 2, BE: 1).
 * Junior School (Grades 7-9) and default use the 8-Point scale (EE1..BE2: 8..1).
 */
export function getGradeForMark(
  mark: number,
  grades: Grade[] = [],
  educationLevel?: string | null,
  gradeName?: string | null
): Grade {
  const normGrade = gradeName ? normalizeGradeName(gradeName) : '';
  const isUpperPrimary =
    educationLevel === 'Upper Primary' ||
    ['Grade 4', 'Grade 5', 'Grade 6'].includes(normGrade) ||
    (gradeName && (gradeName.includes('4') || gradeName.includes('5') || gradeName.includes('6')) && !gradeName.includes('7') && !gradeName.includes('8') && !gradeName.includes('9'));

  const isPrimary4Point =
    isUpperPrimary ||
    educationLevel === 'Lower Primary' ||
    ['Grade 1', 'Grade 2', 'Grade 3', 'PP1', 'PP2', 'Playgroup'].includes(normGrade) ||
    (gradeName && (gradeName.includes('1') || gradeName.includes('2') || gradeName.includes('3')) && !gradeName.includes('7') && !gradeName.includes('8') && !gradeName.includes('9'));

  let scaleGrades: Grade[];

  if (isUpperPrimary) {
    // Strictly enforce Upper Primary 4-point scale: EE (4), ME (3), AE (2), BE (1)
    const has4PointCustom =
      grades &&
      grades.length > 0 &&
      grades.some((g) => g.grade_code === 'EE' || g.points === 4) &&
      !grades.some((g) => g.grade_code === 'EE1' || (g.points !== undefined && g.points > 4));
    scaleGrades = has4PointCustom ? grades : CBE_4_POINT_GRADES;
  } else if (isPrimary4Point) {
    const has4PointCustom = grades && grades.length > 0 && grades.some((g) => g.grade_code === 'EE' || g.points === 4) && !grades.some((g) => g.grade_code === 'EE1');
    scaleGrades = has4PointCustom ? grades : CBE_4_POINT_GRADES;
  } else {
    const has8PointCustom = grades && grades.length > 0 && (grades.some((g) => g.grade_code === 'EE1') || grades.length >= 8);
    scaleGrades = has8PointCustom ? grades : (grades && grades.length > 0 ? grades : CBE_8_POINT_GRADES);
  }

  const sortedGrades = [...scaleGrades].sort((a, b) => {
    const minA = a.minimum_score ?? a.minimum_marks ?? 0;
    const minB = b.minimum_score ?? b.minimum_marks ?? 0;
    return minB - minA;
  });

  const roundedMark = Math.round(mark);

  let matchedGrade = sortedGrades[sortedGrades.length - 1];
  for (const g of sortedGrades) {
    const min = g.minimum_score ?? g.minimum_marks ?? 0;
    if (roundedMark >= min) {
      matchedGrade = g;
      break;
    }
  }

  if (isUpperPrimary) {
    // Strictly guarantee Upper Primary CBE levels (EE, ME, AE, BE) and 4-point scale
    const perfLevel = (matchedGrade.performance_level || matchedGrade.grade_code || 'ME').toUpperCase();
    const validLevel: 'EE' | 'ME' | 'AE' | 'BE' =
      perfLevel.startsWith('EE') ? 'EE'
      : perfLevel.startsWith('ME') ? 'ME'
      : perfLevel.startsWith('AE') ? 'AE'
      : 'BE';
    const ptsMap: Record<'EE' | 'ME' | 'AE' | 'BE', number> = { EE: 4, ME: 3, AE: 2, BE: 1 };
    const descMap: Record<'EE' | 'ME' | 'AE' | 'BE', string> = {
      EE: 'Exceeding Expectations',
      ME: 'Meeting Expectations',
      AE: 'Approaching Expectations',
      BE: 'Below Expectations',
    };
    return {
      ...matchedGrade,
      grade_code: validLevel,
      performance_level: validLevel,
      grade: validLevel,
      points: ptsMap[validLevel],
      remarks: matchedGrade.remarks || descMap[validLevel],
      descriptor: matchedGrade.descriptor || descMap[validLevel],
    };
  }

  return matchedGrade;
}

export function getLearnerReportSubjects(
  student: Student,
  classObj: ClassStream | undefined,
  subjects: Subject[],
  teachers?: Teacher[]
): Subject[] {
  if (classObj) {
    if (classObj.allocated_subject_ids && classObj.allocated_subject_ids.length > 0) {
      return getAllocatedSubjectsForClass(classObj, subjects);
    }
  }
  const stdGrade = classObj?.class_name || student?.grade || '';
  return getApplicableSubjectsForGrade(stdGrade, subjects);
}

import {
  evaluateMark,
  formatPercentage,
  isUpperPrimaryCompOrInsha,
  getUpperPrimaryCompositeSubjectMarks,
  isSocialStudies,
  isChristianReligiousEducation,
  isDirectSSCRE,
} from '../utils/markUtils';

/**
 * Calculates results & positions for all students in an examination using KNEC CBE 8-Point engine
 */
export function calculateExamResults(
  examId: string,
  students: Student[] = [],
  marksList: Mark[] = [],
  grades: Grade[] = [],
  classes: ClassStream[] = [],
  subjects: Subject[] = []
): Result[] {
  const safeStudents = students || [];
  const safeMarksList = marksList || [];
  const safeGrades = grades || [];
  const safeClasses = classes || [];
  const safeSubjects = subjects || [];

  const examObj = (typeof api !== 'undefined' && api.getExaminations)
    ? api.getExaminations().find((e) => e.id === examId || (e as any).exam_code === examId || (e as any).exam_name === examId)
    : undefined;

  const validExamIds = new Set(
    [examId, examObj?.id, (examObj as any)?.exam_code, (examObj as any)?.exam_name].filter(Boolean)
  );

  // Filter marks for this specific exam (supporting exam ID, code, or UUID)
  const examMarks = safeMarksList.filter((m) => validExamIds.has(m.exam_id));

  const studentTotals: {
    student_id: string;
    resolved_class_id: string;
    resolved_stream_id: string;
    resolved_grade_key: string;
    effective_edu_level?: EducationLevel | string;
    is_upper_primary?: boolean;
    total_marks: number;
    total_max_marks: number;
    subject_count: number;
    average: number;
    total_points: number;
    average_points: number;
    overallGradeObj: Grade;
    is_complete: boolean;
    missing_subjects_count: number;
  }[] = [];

  safeStudents.forEach((std) => {
    // Filter marks belonging to student for this exam (robust to student ID, UUID, and admission number)
    const stdMatches = (mStudentId: string) => {
      const sIdStr = String(mStudentId).trim().toLowerCase();
      if (std.id && String(std.id).trim().toLowerCase() === sIdStr) return true;
      if (std.admission_number && String(std.admission_number).trim().toLowerCase() === sIdStr) return true;
      return false;
    };

    const stdAllExamMarks = examMarks.filter((m) => stdMatches(m.student_id));

    // Exclude future intake learners, pre-admission learners, or inactive learners with no recorded marks for this exam
    if (!isStudentEligibleForExam(std, examObj, stdAllExamMarks)) {
      return;
    }

    // Resolve student's class, stream & grade for this exam (supporting historical exam context)
    let stdClass =
      (std.stream_id ? safeClasses.find((c) => c.stream_id === std.stream_id) : undefined) ||
      safeClasses.find((c) => c.id === std.class_id);

    let stdContextGrade: string = std.grade;
    let stdContextStreamId: string | undefined = std.stream_id;
    if (examObj) {
      const examContext = getLearnerClassAtExamTime(std, examObj, safeClasses);
      if (examContext) {
        const resolvedHistClass =
          (examContext.stream_id
            ? safeClasses.find((c) => c.stream_id === examContext.stream_id || c.id === examContext.stream_id)
            : undefined) ||
          (examContext.class_id
            ? safeClasses.find((c) => c.id === examContext.class_id || c.stream_id === examContext.class_id)
            : undefined);

        if (resolvedHistClass) {
          stdClass = resolvedHistClass;
        }
        if (examContext.stream_id) {
          stdContextStreamId = examContext.stream_id;
        }
        if (examContext.grade) {
          stdContextGrade = examContext.grade;
        }
      }
    }

    const effectiveStudent: Student = stdContextGrade !== std.grade ? { ...std, grade: stdContextGrade as any } : std;

    // Authoritative Cohort Participation Check:
    // If learner has no marks for this exam, check whether this learner's cohort actually sat this exam
    if (stdAllExamMarks.length === 0) {
      const gradeLearners = safeStudents.filter((s) => (s.grade || '') === stdContextGrade);
      if (gradeLearners.length > 0) {
        const gradeLearnerIds = new Set(gradeLearners.map((s) => s.id));
        const gradeMarks = examMarks.filter((m) => gradeLearnerIds.has(m.student_id));
        const gradeAssessedIds = new Set(gradeMarks.map((m) => m.student_id));
        const countGradeAssessed = gradeAssessedIds.size;

        // If zero learners in this grade participated, this exam was not administered to this grade
        if (countGradeAssessed === 0) {
          return;
        }

        // Scenario D: accidental / isolated mark entry below quorum (< 10% and < 3 learners in cohort >= 10)
        if (gradeLearners.length >= 10 && countGradeAssessed < 3 && countGradeAssessed / gradeLearners.length < 0.1) {
          return;
        }
      }
    }

    // Master subject pool
    const poolSubjects = safeSubjects.length > 0
      ? safeSubjects
      : (typeof api !== 'undefined' && api.getSubjects ? api.getSubjects() : []);

    // Resolve subjects allocated or applicable specifically to this learner
    const learnerAllocatedSubjects = getLearnerReportSubjects(
      effectiveStudent,
      stdClass,
      poolSubjects,
      typeof api !== 'undefined' && api.getTeachers ? api.getTeachers() : []
    );

    // If caller provided a specific safeSubjects list, intersect learner's allocated subjects with safeSubjects
    // so caller's pre-filtering is respected while unallocated school subjects are excluded from completeness check.
    let applicableSubjects: Subject[];
    if (safeSubjects.length > 0) {
      const safeSubjectIdSet = new Set(safeSubjects.map((s) => String(s.id)));
      const filteredAllocated = learnerAllocatedSubjects.filter((s) => safeSubjectIdSet.has(String(s.id)));
      applicableSubjects = filteredAllocated.length > 0 ? filteredAllocated : learnerAllocatedSubjects;
    } else {
      applicableSubjects = learnerAllocatedSubjects;
    }

    const validSubjectIds =
      applicableSubjects.length > 0
        ? new Set(applicableSubjects.map((s) => String(s.id)))
        : null;

    // Filter marks belonging to student & valid subjects
    const stdMarks = examMarks.filter(
      (m) =>
        stdMatches(m.student_id) &&
        (!validSubjectIds ||
          validSubjectIds.has(String(m.subject_id)) ||
          applicableSubjects.some((sb) =>
            String(m.subject_id) === String(sb.id) ||
            (sb.subject_code && String(m.subject_id) === String(sb.subject_code)) ||
            (sb.subject_code && getShortCbeCode(String(m.subject_id)) === getShortCbeCode(sb.subject_code)) ||
            (sb.subject_name && String(m.subject_id).toLowerCase() === sb.subject_name.toLowerCase()) ||
            (safeSubjects.some((s) => s.id === m.subject_id && (s.id === sb.id || s.subject_code === sb.subject_code || getShortCbeCode(s.subject_code) === getShortCbeCode(sb.subject_code))))
          ))
    );

    const effectiveEduLevel = stdClass?.education_level || getEducationLevelForGrade(stdContextGrade);
    const isUpperPrimary =
      effectiveEduLevel === 'Upper Primary' ||
      ['Grade 4', 'Grade 5', 'Grade 6'].includes(normalizeGradeName(stdContextGrade));

    let effectiveApplicableSubjects = applicableSubjects;
    let effectiveStdMarks = stdMarks;

    if (isUpperPrimary) {
      const compositeResult = getUpperPrimaryCompositeSubjectMarks(stdMarks, applicableSubjects, effectiveEduLevel, examObj);
      effectiveStdMarks = compositeResult.processedMarks;
      const synthIds = new Set(compositeResult.syntheticSubjects.map(s => s.id));
      const hasSsCreSynth = synthIds.has('synth_ss_cre_composite') ||
                            synthIds.has('sb_up_ss_cre') ||
                            compositeResult.syntheticSubjects.some(s => isDirectSSCRE(s) || isSocialStudies(s) || isChristianReligiousEducation(s));
      const filteredBaseSubjects = applicableSubjects.filter(sb => {
        const code = (sb.subject_code || (sb as any).code || '').toUpperCase();
        const name = (sb.subject_name || (sb as any).name || '').toUpperCase();
        if (synthIds.has('synth_english_composite') && (code === 'ENG' || code === 'COMP' || name.includes('ENGLISH') || name.includes('COMPOSITION'))) {
          return false;
        }
        if (synthIds.has('synth_kiswahili_composite') && (code === 'KIS' || code === 'KISW' || code === 'INSHA' || name.includes('KISWAHILI') || name.includes('LUGHA') || name.includes('INSHA'))) {
          return false;
        }
        if (hasSsCreSynth && (isSocialStudies(sb) || isChristianReligiousEducation(sb) || isDirectSSCRE(sb))) {
          return false;
        }
        return true;
      });
      effectiveApplicableSubjects = [...filteredBaseSubjects, ...compositeResult.syntheticSubjects];
    }

    let assessedSubjectCount = 0;
    let sumRawScore = 0;
    let sumOutOf = 0;
    let sumPercentage = 0;
    let sumPctRoundedTotal = 0;
    let sumDisplayedMarks = 0;
    let sumPoints = 0;
    let hasMissingMark = false; // X or unentered mark for applicable subject causes provisional status
    let missingCount = 0;
    let irregularityCount = 0;

    effectiveApplicableSubjects.forEach((sb) => {
      const isCompInsha = isUpperPrimaryCompOrInsha(sb, stdClass, effectiveEduLevel);
      const markObj = effectiveStdMarks.find(
        (m) =>
          String(m.subject_id) === String(sb.id) ||
          (sb.subject_code && String(m.subject_id) === String(sb.subject_code)) ||
          (sb.subject_code && getShortCbeCode(String(m.subject_id)) === getShortCbeCode(sb.subject_code)) ||
          (sb.subject_name && String(m.subject_id).toLowerCase() === sb.subject_name.toLowerCase()) ||
          (safeSubjects.some((s) => s.id === m.subject_id && (s.id === sb.id || s.subject_code === sb.subject_code || getShortCbeCode(s.subject_code) === getShortCbeCode(sb.subject_code))))
      );
      const markInfo = evaluateMark(markObj, {
        isUpperPrimaryCompOrInsha: isCompInsha,
        subject: sb,
        classObj: stdClass,
        educationLevel: effectiveEduLevel,
      });

      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        assessedSubjectCount++;
        sumRawScore += markInfo.rawScore!;
        sumOutOf += markInfo.outOf;
        sumPercentage += markInfo.percentage;
        sumPctRoundedTotal += Math.round(markInfo.percentage);

        const displayedSubjectMark = isCompInsha && markInfo.rawScore !== undefined && markInfo.rawScore !== null
          ? markInfo.rawScore
          : Math.round(markInfo.percentage);
        sumDisplayedMarks += displayedSubjectMark;

        const gr = getGradeForMark(
          markInfo.percentage,
          safeGrades,
          effectiveEduLevel,
          stdContextGrade
        );
        sumPoints += gr.points;
      } else if (markInfo.status === 'Y') {
        // Examination Irregularity: excluded from score/average calculation, not treated as missing X
        irregularityCount++;
      } else {
        // Missing Assessment ('X' or unentered/blank for an applicable curriculum subject)
        hasMissingMark = true;
        missingCount++;
      }
    });

    // If no explicit applicable subjects found, process whatever marks std has
    if (applicableSubjects.length === 0 && stdMarks.length > 0) {
      stdMarks.forEach((m) => {
        const foundSub = safeSubjects.find((s) => s.id === m.subject_id || s.subject_code === m.subject_id);
        const isCompInsha = isUpperPrimaryCompOrInsha(foundSub, stdClass, effectiveEduLevel);
        const markInfo = evaluateMark(m, {
          isUpperPrimaryCompOrInsha: isCompInsha,
          subject: foundSub,
          classObj: stdClass,
          educationLevel: effectiveEduLevel,
        });
        if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
          assessedSubjectCount++;
          sumRawScore += markInfo.rawScore!;
          sumOutOf += markInfo.outOf;
          sumPercentage += markInfo.percentage;
          sumPctRoundedTotal += Math.round(markInfo.percentage);

          const displayedSubjectMark = isCompInsha && markInfo.rawScore !== undefined && markInfo.rawScore !== null
            ? markInfo.rawScore
            : Math.round(markInfo.percentage);
          sumDisplayedMarks += displayedSubjectMark;

          const gr = getGradeForMark(
            markInfo.percentage,
            safeGrades,
            effectiveEduLevel,
            stdContextGrade
          );
          sumPoints += gr.points;
        } else if (markInfo.status === 'Y') {
          irregularityCount++;
        } else {
          hasMissingMark = true;
          missingCount++;
        }
      });
    }

    // A report is COMPLETE if there are NO missing marks ('X' or unentered applicable subjects), NO irregularities ('Y'),
    // and at least 1 subject has been assessed.
    const expectedSubjectCount = applicableSubjects.length > 0 ? applicableSubjects.length : 1;
    const isComplete = !hasMissingMark && irregularityCount === 0 && assessedSubjectCount > 0;
    const totalMissingCount = missingCount;

    const rawGrade = effectiveStudent.grade || stdClass?.class_name || '';
    const gradeKey = extractGradeName(rawGrade) || rawGrade || '';

    const totalMarks = sumPctRoundedTotal;
    const totalMaxMarks = assessedSubjectCount * 100;
    const avgMarks = assessedSubjectCount > 0 ? totalMarks / assessedSubjectCount : 0;
    const avgPoints = assessedSubjectCount > 0 ? Math.round((sumPoints / assessedSubjectCount) * 100) / 100 : 0;
    const overallGradeObj = getGradeForMark(
      avgMarks,
      safeGrades,
      effectiveEduLevel,
      stdContextGrade
    );

    const resolvedStreamId =
      stdClass?.stream_id ||
      stdContextStreamId ||
      std.stream_id ||
      (stdClass ? `${stdClass.id}_${stdClass.stream || 'default'}` : (std.class_id || 'unassigned'));

    studentTotals.push({
      student_id: std.id,
      resolved_class_id: stdClass?.id || std.class_id || 'unassigned',
      resolved_stream_id: resolvedStreamId,
      resolved_grade_key: gradeKey || 'Unassigned',
      effective_edu_level: effectiveEduLevel,
      is_upper_primary: isUpperPrimary,
      total_marks: totalMarks,
      total_max_marks: totalMaxMarks,
      subject_count: assessedSubjectCount,
      average: avgMarks,
      total_points: sumPoints,
      average_points: avgPoints,
      overallGradeObj,
      is_complete: isComplete,
      missing_subjects_count: totalMissingCount,
    });
  });

  // Separate complete students from incomplete students
  const completeTotals = studentTotals.filter((s) => s.is_complete);
  const incompleteTotals = studentTotals.filter((s) => !s.is_complete);

  // Group complete students by Grade first to prevent cross-grade competition
  const gradeGroups = new Map<string, typeof completeTotals>();
  completeTotals.forEach((item) => {
    const gradeKey = item.resolved_grade_key || 'Unassigned';
    if (!gradeGroups.has(gradeKey)) {
      gradeGroups.set(gradeKey, []);
    }
    gradeGroups.get(gradeKey)!.push(item);
  });

  const finalResults: Result[] = [];

  // Step 1 & Step 2: Rank per Grade first (Overall Position), then per Stream (Stream Position)
  gradeGroups.forEach((gradeCohort) => {
    // Step 1: Sort Grade cohort descending by TOTAL MARKS
    gradeCohort.sort((a, b) => b.total_marks - a.total_marks);

    const isCohortTie = (a: any, b: any) => {
      return Math.round(a.total_marks ?? 0) === Math.round(b.total_marks ?? 0);
    };

    // Calculate Overall Position (Grade Position) within this Grade cohort with competition ranking (1, 1, 3 pattern)
    const gradeResultsWithOverallRank: {
      item: (typeof completeTotals)[0];
      overallRank: number;
      class_id: string;
      stream_id: string;
    }[] = [];

    applyCompetitionRanking(gradeCohort, isCohortTie, (item, rank) => {
      gradeResultsWithOverallRank.push({
        item,
        overallRank: rank,
        class_id: item.resolved_class_id || 'unassigned',
        stream_id: item.resolved_stream_id || 'unassigned',
      });
    });

    // Step 2: Split Grade cohort into Streams (grouped by stream_id)
    const streamGroups = new Map<string, typeof gradeResultsWithOverallRank>();
    gradeResultsWithOverallRank.forEach((entry) => {
      const streamId = entry.stream_id;
      if (!streamGroups.has(streamId)) {
        streamGroups.set(streamId, []);
      }
      streamGroups.get(streamId)!.push(entry);
    });

    // Calculate Stream Position within each stream cohort with competition ranking (1, 1, 3 pattern)
    streamGroups.forEach((streamCohort) => {
      streamCohort.sort((a, b) => b.item.total_marks - a.item.total_marks);

      applyCompetitionRanking(
        streamCohort,
        (a, b) => isCohortTie(a.item, b.item),
        (entry, streamRank) => {
          const { item, overallRank } = entry;
          const defaultCode = (item.is_upper_primary || item.effective_edu_level === 'Lower Primary' || item.effective_edu_level === 'Pre-Primary') ? 'ME' : 'ME1';
          const code = item.overallGradeObj.grade_code || item.overallGradeObj.grade || defaultCode;
          const level = item.overallGradeObj.performance_level || (defaultCode === 'ME' ? 'ME' : 'ME');

          finalResults.push({
            id: `res_${examId}_${item.student_id}`,
            student_id: item.student_id,
            exam_id: examId,
            total_marks: item.total_marks,
            total_max_marks: item.total_max_marks,
            subject_count: item.subject_count,
            average: item.average,
            total_points: item.total_points,
            average_points: item.average_points,
            grade_code: code,
            performance_level: level,
            grade: code,
            points: item.overallGradeObj.points,
            position: overallRank,        // Grade Position (Overall Position within Grade)
            class_position: streamRank,   // Stream Position
            stream_position: streamRank,  // Stream Position
            remarks: item.overallGradeObj.remarks,
            is_complete: true,
            status: 'Complete',
            missing_subjects_count: item.missing_subjects_count,
          });
        }
      );
    });
  });

  // Append incomplete/provisional students (students with missing marks / X / incomplete assessment)
  // Provisional students are explicitly NOT ranked (positions set to 0)
  incompleteTotals.forEach((item) => {
    const isAssessed = item.subject_count > 0;
    const defaultCode = (item.is_upper_primary || item.effective_edu_level === 'Lower Primary' || item.effective_edu_level === 'Pre-Primary') ? 'ME' : 'ME1';
    const code = isAssessed ? (item.overallGradeObj.grade_code || item.overallGradeObj.grade || defaultCode) : '-';
    const level = isAssessed ? (item.overallGradeObj.performance_level || (defaultCode === 'ME' ? 'ME' : 'ME')) : '-';

    finalResults.push({
      id: `res_${examId}_${item.student_id}`,
      student_id: item.student_id,
      exam_id: examId,
      total_marks: item.total_marks,
      total_max_marks: item.total_max_marks,
      subject_count: item.subject_count,
      average: item.average, // provisional average
      total_points: item.total_points,
      average_points: item.average_points,
      grade_code: code,
      performance_level: level,
      grade: code,
      points: isAssessed ? item.overallGradeObj.points : 0,
      position: 0,
      class_position: 0,
      stream_position: 0,
      remarks: item.subject_count > 0 ? 'Provisional Assessment (Partial Subjects Entered)' : 'Incomplete Assessment (Pending Marks)',
      is_complete: false,
      status: 'Provisional',
      missing_subjects_count: item.missing_subjects_count,
    });
  });

  return finalResults;
}

/**
 * Calculates grade-wide subject rank for a student in a specific subject and exam.
 * Ranks are calculated across all learners in the same grade (regardless of stream).
 * Denominator is the total number of learners in that grade who were assessed in that subject for the selected examination.
 * Returns formatted string like "1/92" or "X" if not assessed.
 */
export function calculateSubjectRank(
  student: Student,
  subjectId: string,
  examId: string,
  allStudents: Student[] = [],
  classes: ClassStream[] = [],
  marks: Mark[] = []
): string {
  if (!student || !subjectId || !examId) return '-';

  const safeStudents = allStudents || [];
  const safeClasses = classes || [];
  const safeMarks = marks || [];

  // 1. Identify student's grade name
  const studentClass =
    (student.stream_id ? safeClasses.find((c) => c.stream_id === student.stream_id || c.id === student.stream_id) : undefined) ||
    safeClasses.find((c) => c.id === student.class_id || c.stream_id === student.class_id);
  const gradeName = student.grade || (studentClass ? studentClass.class_name : student.class_id);

  if (!gradeName) {
    return '-';
  }

  // 2. Find all class_ids belonging to the same grade
  const matchingClassIds = new Set(
    safeClasses
      .filter((c) => c.class_name.toLowerCase() === gradeName.toLowerCase())
      .map((c) => c.id)
  );

  // 3. Find all students in this grade cohort across all streams
  const gradeStudents = safeStudents.filter((s) => {
    if (matchingClassIds.has(s.class_id)) return true;
    const sClass =
      (s.stream_id ? safeClasses.find((c) => c.stream_id === s.stream_id || c.id === s.stream_id) : undefined) ||
      safeClasses.find((c) => c.id === s.class_id || c.stream_id === s.class_id);
    const sGradeName = sClass ? sClass.class_name : s.class_id;
    return sGradeName?.toLowerCase() === gradeName.toLowerCase();
  });

  const gradeStudentIds = new Set(gradeStudents.map((s) => s.id));

  const targetSubject = (typeof api !== 'undefined' && api.getSubjects)
    ? api.getSubjects().find((s) => s.id === subjectId || s.subject_code === subjectId)
    : undefined;

  const validSubjectMatcher = (markSubId: string) => {
    if (markSubId === subjectId) return true;
    if (targetSubject && (markSubId === targetSubject.id || markSubId === targetSubject.subject_code)) return true;
    if (targetSubject?.subject_code && getShortCbeCode(markSubId) === getShortCbeCode(targetSubject.subject_code)) return true;
    if (targetSubject?.subject_name && markSubId.toLowerCase() === targetSubject.subject_name.toLowerCase()) return true;
    return false;
  };

  // Check target student's mark status first
  const matchesStudent = (mStudentId: string) => {
    const sIdStr = String(mStudentId).trim().toLowerCase();
    if (student.id && String(student.id).trim().toLowerCase() === sIdStr) return true;
    if (student.admission_number && String(student.admission_number).trim().toLowerCase() === sIdStr) return true;
    return false;
  };

  const studentMarkObj = safeMarks.find(
    (m) =>
      (m.exam_id === examId || (typeof api !== 'undefined' && api.getExaminations && api.getExaminations().some(e => e.id === examId && (m.exam_id === e.id || m.exam_id === (e as any).exam_code)))) &&
      validSubjectMatcher(m.subject_id) &&
      matchesStudent(m.student_id)
  );
  const studentInfo = evaluateMark(studentMarkObj);

  if (studentInfo.status === 'X') return 'X';
  if (studentInfo.status === 'Y') return 'Y';
  if (studentInfo.status === 'Blank' || studentInfo.percentage === null) return '-';

  // Filter marks with Normal status
  const validMarks = safeMarks
    .filter(
      (m) =>
        (m.exam_id === examId || (typeof api !== 'undefined' && api.getExaminations && api.getExaminations().some(e => e.id === examId && (m.exam_id === e.id || m.exam_id === (e as any).exam_code)))) &&
        validSubjectMatcher(m.subject_id) &&
        (gradeStudentIds.has(m.student_id) || (gradeStudents.some(s => (s.id === m.student_id) || (s.admission_number && String(s.admission_number).trim().toLowerCase() === String(m.student_id).trim().toLowerCase()))))
    )
    .map((m) => ({ student_id: m.student_id, info: evaluateMark(m) }))
    .filter((item) => item.info.status === 'Normal' && item.info.percentage !== null);

  const totalAssessed = validMarks.length;
  if (totalAssessed === 0) return '-';

  // Sort descending by percentage
  validMarks.sort((a, b) => b.info.percentage! - a.info.percentage!);

  let studentRank = 1;
  for (let i = 0; i < validMarks.length; i++) {
    if (i > 0 && validMarks[i].info.percentage! < validMarks[i - 1].info.percentage!) {
      studentRank = i + 1;
    }
    if (matchesStudent(validMarks[i].student_id)) {
      break;
    }
  }

  return `${studentRank}/${totalAssessed}`;
}

/**
 * Generate full analytical summary for an examination
 */
export function generateExamAnalysisSummary(
  examId: string,
  examName: string,
  students: Student[] = [],
  subjects: Subject[] = [],
  marksList: Mark[] = [],
  grades: Grade[] = []
): ExamAnalysisSummary {
  const safeStudents = students || [];
  const safeSubjects = subjects || [];
  const safeMarksList = marksList || [];
  const safeGrades = grades || [];
  const safeClasses = typeof api !== 'undefined' ? api.getClasses() : [];

  // Determine applicable subjects for the students cohort
  let applicableSubjects: Subject[] = safeSubjects;
  if (safeStudents.length > 0 && safeSubjects.length > 0) {
    const studentGrades = Array.from(
      new Set(safeStudents.map((s) => s.grade || '').filter(Boolean))
    );
    if (studentGrades.length === 1) {
      // Find a student and their class for this grade to accurately determine subjects
      const sampleStudent = safeStudents.find(s => (s.grade || '') === studentGrades[0]);
      const sampleClass = sampleStudent
        ? (sampleStudent.stream_id ? safeClasses.find(c => c.stream_id === sampleStudent.stream_id || c.id === sampleStudent.stream_id) : undefined) ||
          safeClasses.find(c => c.id === sampleStudent.class_id || c.stream_id === sampleStudent.class_id)
        : undefined;
      
      applicableSubjects = sampleStudent ? getLearnerReportSubjects(sampleStudent, sampleClass, safeSubjects, typeof api !== 'undefined' ? api.getTeachers() : []) : [];
    } else if (studentGrades.length > 1) {
      const applicableSet = new Set<string>();
      studentGrades.forEach((g) => {
        const sampleStudent = safeStudents.find(s => (s.grade || '') === g);
        const sampleClass = sampleStudent
          ? (sampleStudent.stream_id ? safeClasses.find(c => c.stream_id === sampleStudent.stream_id || c.id === sampleStudent.stream_id) : undefined) ||
            safeClasses.find(c => c.id === sampleStudent.class_id || c.stream_id === sampleStudent.class_id)
          : undefined;
        if (sampleStudent) {
            getLearnerReportSubjects(sampleStudent, sampleClass, safeSubjects, typeof api !== 'undefined' ? api.getTeachers() : []).forEach((sb) => applicableSet.add(sb.id));
        }
      });
      applicableSubjects = safeSubjects.filter((sb) => applicableSet.has(sb.id));
    }
  }

  const results = calculateExamResults(examId, safeStudents, safeMarksList, safeGrades, safeClasses, safeSubjects);
  const examMarks = safeMarksList.filter((m) => {
    if (m.exam_id !== examId) return false;
    const evaluated = evaluateMark(m);
    return evaluated.status === 'Normal' && evaluated.percentage !== null;
  });

  if (results.length === 0) {
    return {
      exam_id: examId,
      exam_name: examName,
      total_students: 0,
      mean_score: 0,
      mean_points: 0,
      mean_grade_code: '-',
      mean_performance_level: '-',
      highest_score: 0,
      lowest_score: 0,
      subject_summaries: [],
      grade_counts: {},
      level_counts: { EE: 0, ME: 0, AE: 0, BE: 0 },
      top_performers: [],
      weak_subjects: [],
      strong_subjects: [],
      not_administered: true,
    };
  }

  const assessedResults = results.filter((r) => (r.subject_count || 0) > 0);
  const countAssessed = assessedResults.length;

  if (countAssessed === 0) {
    return {
      exam_id: examId,
      exam_name: examName,
      total_students: results.length,
      mean_score: 0,
      mean_points: 0,
      mean_grade_code: '-',
      mean_performance_level: '-',
      highest_score: 0,
      lowest_score: 0,
      subject_summaries: [],
      grade_counts: {},
      level_counts: { EE: 0, ME: 0, AE: 0, BE: 0 },
      top_performers: [],
      weak_subjects: [],
      strong_subjects: [],
      not_administered: true,
    };
  }

  const totalMeanScore =
    countAssessed > 0
      ? assessedResults.reduce((sum, r) => sum + r.average, 0) / countAssessed
      : 0;
  const roundedMeanScore = Math.round(totalMeanScore);

  const totalMeanPoints =
    countAssessed > 0
      ? assessedResults.reduce((sum, r) => sum + r.average_points, 0) / countAssessed
      : 0;
  const roundedMeanPoints = Math.round(totalMeanPoints * 100) / 100;

  const overallGradeObj = getGradeForMark(roundedMeanScore, grades);

  const highestScore =
    countAssessed > 0 ? Math.round(Math.max(...assessedResults.map((r) => r.average))) : 0;
  const lowestScore =
    countAssessed > 0 ? Math.round(Math.min(...assessedResults.map((r) => r.average))) : 0;

  // Grade code distribution (EE1..BE2) & level counts (EE, ME, AE, BE)
  const gradeCounts: Record<string, number> = {};
  const levelCounts: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };

  grades.forEach((g) => {
    const code = g.grade_code || g.grade;
    if (code) gradeCounts[code] = 0;
  });

  assessedResults.forEach((r) => {
    const code = r.grade_code || r.grade;
    if (code) {
      gradeCounts[code] = (gradeCounts[code] || 0) + 1;
    }

    const level = r.performance_level || 'ME';
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  });

  // Subject Summaries (only for applicable subjects)
  const subjectSummaries = applicableSubjects.map((sb) => {
    const sbMarks = examMarks.filter((m) => m.subject_id === sb.id);
    if (sbMarks.length === 0) {
      return {
        subject_id: sb.id,
        subject_name: sb.subject_name,
        subject_code: sb.subject_code,
        mean_score: 0,
        mean_points: 0,
        highest: 0,
        lowest: 0,
        pass_rate: 0,
      };
    }

    const sbValues = sbMarks.map((m) => {
      const evaluated = evaluateMark(m);
      return evaluated.percentage!;
    });
    const sum = sbValues.reduce((a, b) => a + b, 0);
    const mean = Math.round(sum / sbValues.length);

    const totalPts = sbValues.reduce(
      (acc, val) => acc + getGradeForMark(val, grades).points,
      0
    );
    const meanPts = Math.round((totalPts / sbValues.length) * 100) / 100;

    const highest = Math.round(Math.max(...sbValues));
    const lowest = Math.round(Math.min(...sbValues));

    // Pass rate = % meeting or exceeding expectations (>= 41% or ME/EE)
    const passes = sbValues.filter((v) => v >= 41).length;
    const passRate = Math.round((passes / sbValues.length) * 100);

    return {
      subject_id: sb.id,
      subject_name: sb.subject_name,
      subject_code: sb.subject_code,
      mean_score: mean,
      mean_points: meanPts,
      highest,
      lowest,
      pass_rate: passRate,
    };
  });

  // Top Performers (Top 5 assessed learners)
  const sortedResults = [...assessedResults].sort((a, b) => {
    const posA = a.position && a.position > 0 ? a.position : 999999;
    const posB = b.position && b.position > 0 ? b.position : 999999;
    if (posA !== posB) {
      return posA - posB;
    }
    if (b.average_points !== a.average_points) {
      return b.average_points - a.average_points;
    }
    if (b.total_marks !== a.total_marks) {
      return b.total_marks - a.total_marks;
    }
    return b.average - a.average;
  });
  const topPerformers = sortedResults.slice(0, 5).map((r) => {
    const std = students.find((s) => s.id === r.student_id);
    const cls = std
      ? (std.stream_id ? safeClasses.find((c) => c.stream_id === std.stream_id || c.id === std.stream_id) : undefined) ||
        safeClasses.find((c) => c.id === std.class_id || c.stream_id === std.class_id)
      : undefined;
    const resolvedClassName = cls
      ? `${cls.class_name}${cls.stream ? ` ${cls.stream}` : ''}`
      : (std?.grade || '');
    return {
      student_id: r.student_id,
      student_name: std?.full_name || 'Unknown',
      admission_number: std?.admission_number || '-',
      class_name: resolvedClassName,
      total_marks: r.total_marks,
      average: Math.round(r.average),
      total_points: r.total_points,
      average_points: r.average_points,
      grade_code: r.grade_code,
      performance_level: r.performance_level,
      position: r.position,
    };
  });

  // Strong subjects (top 3 mean scores)
  const sortedSubjects = [...subjectSummaries]
    .filter((s) => s.mean_score > 0)
    .sort((a, b) => b.mean_score - a.mean_score);

  const strongSubjects = sortedSubjects.slice(0, 3).map((s) => `${s.subject_name} (${formatPercentage(s.mean_score, true)})`);
  const weakSubjects = [...sortedSubjects].reverse().slice(0, 3).map((s) => `${s.subject_name} (${formatPercentage(s.mean_score, true)})`);

  return {
    exam_id: examId,
    exam_name: examName,
    total_students: results.length,
    mean_score: roundedMeanScore,
    mean_points: roundedMeanPoints,
    mean_grade_code: overallGradeObj.grade_code || overallGradeObj.grade || 'ME1',
    mean_performance_level: overallGradeObj.performance_level || 'ME',
    highest_score: highestScore,
    lowest_score: lowestScore,
    subject_summaries: subjectSummaries,
    grade_counts: gradeCounts,
    level_counts: levelCounts,
    top_performers: topPerformers,
    weak_subjects: weakSubjects,
    strong_subjects: strongSubjects,
  };
}

export interface CalculationValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCalculationData(
  results: Result[],
  marks: Mark[],
  grades: Grade[],
  subjects: Subject[]
): CalculationValidationResult {
  const errors: string[] = [];

  // Check 1: Validate each result
  results.forEach((r, idx) => {
    // Check percentage bounds
    if (typeof r.average !== 'number' || isNaN(r.average) || r.average < 0 || r.average > 100) {
      errors.push(`Student result ${idx + 1} (${r.student_id}): average percentage ${r.average} is out of bounds [0, 100].`);
    }

    // Check total obtained <= total maximum
    if (typeof r.total_marks === 'number' && typeof r.total_max_marks === 'number' && r.total_max_marks > 0) {
      if (r.total_marks > r.total_max_marks) {
        errors.push(`Student result ${idx + 1} (${r.student_id}): total marks obtained (${r.total_marks}) exceeds maximum (${r.total_max_marks}).`);
      }
    }

    // Check CBE level corresponds to percentage
    if (typeof r.average === 'number' && !isNaN(r.average)) {
      const actualCode = (r.grade_code || r.grade || '').toUpperCase();
      const is4PointGrade = ['EE', 'ME', 'AE', 'BE'].includes(actualCode);
      const eduLevel = is4PointGrade ? 'Upper Primary' : 'Junior School';
      const expectedGrade = getGradeForMark(r.average, grades, eduLevel);
      const expectedCode = (expectedGrade.grade_code || expectedGrade.grade || '').toUpperCase();

      if (r.is_complete !== false && actualCode && actualCode !== 'PENDING' && actualCode !== expectedCode) {
        errors.push(`Student result ${idx + 1} (${r.student_id}): CBE level '${actualCode}' does not correspond to calculated average ${r.average}% (expected '${expectedCode}').`);
      }

      if (r.is_complete !== false && typeof r.points === 'number' && r.points !== expectedGrade.points) {
        errors.push(`Student result ${idx + 1} (${r.student_id}): points '${r.points}' do not correspond to CBE level '${expectedCode}' (expected ${expectedGrade.points}).`);
      }
    }
  });

  // Check 2: Audit individual marks for 9/100 test case & special statuses X/Y
  marks.forEach((m) => {
    const markInfo = evaluateMark(m);

    // Special status check: X and Y must not produce numerical percentage
    if (markInfo.status === 'X' || markInfo.status === 'Y') {
      if (markInfo.percentage !== null) {
        errors.push(`Special status mark '${markInfo.status}' for student ${m.student_id} produced a non-null numerical percentage: ${markInfo.percentage}.`);
      }
    }

    // Explicit 9/100 test case check
    if (markInfo.status === 'Normal' && markInfo.rawScore === 9 && markInfo.outOf === 100) {
      if (markInfo.percentage !== 9) {
        errors.push(`Test case failure: raw mark 9/100 produced percentage ${markInfo.percentage}% instead of 9%.`);
      }
      const gr = getGradeForMark(markInfo.percentage!, grades);
      if (gr.grade_code !== 'BE2') {
        errors.push(`Test case failure: raw mark 9/100 produced CBE level '${gr.grade_code}' instead of 'BE2'.`);
      }
      if (gr.points !== 1) {
        errors.push(`Test case failure: raw mark 9/100 produced points '${gr.points}' instead of 1.`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

