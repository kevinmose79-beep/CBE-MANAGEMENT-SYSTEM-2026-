import {
  Student,
  Subject,
  Mark,
  Grade,
  Examination,
  ClassStream,
  EducationLevel,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
} from '../types';
import { getGradeForMark, applyCompetitionRanking, isMeritTie } from './analysisEngine';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, isUpperPrimaryCompOrInsha } from '../utils/markUtils';

export interface ClassRankingItem {
  rank: number;
  class_name: string;
  learners_count: number;
  total_marks: number;
  mean_marks: number;
  max_obtainable_marks: number;
  mean_percentage: number;
  mean_points: number;
  overall_level: string;
  grade_code: string;
}

export interface StreamRankingItem {
  rank: number;
  class_id: string;
  class_name: string;
  stream: string;
  full_name: string; // e.g., "Grade 8 Blue"
  learners_count: number;
  total_marks: number;
  mean_marks: number;
  max_obtainable_marks: number;
  mean_percentage: number;
  mean_points: number;
  overall_level: string;
  grade_code: string;
}

export interface SubjectRankingItem {
  rank: number;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  category: string;
  total_candidates: number;
  mean_marks: number;
  mean_percentage: number;
  mean_points: number;
  overall_level: string;
  grade_code: string;
  education_level?: string;
  is_raw?: boolean;
  out_of?: number;
}

export interface ClassSubjectAnalysisItem {
  class_name: string;
  subjects: {
    subject_id: string;
    subject_name: string;
    subject_code: string;
    mean_marks: number;
    mean_points: number;
    overall_level: string;
    grade_code: string;
    candidates_count: number;
    is_raw?: boolean;
    out_of?: number;
  }[];
}

export interface LearnerPerformerItem {
  rank: number;
  student_id: string;
  name: string;
  admission_number: string;
  class_name: string;
  stream: string;
  total_marks: number;
  average_marks: number;
  mean_percentage: number;
  total_points: number;
  average_points: number;
  overall_level: string;
  grade_code: string;
  subject_count: number;
  is_complete?: boolean;
  education_level?: string;
}

export interface SubjectTopPerformerItem {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name?: string;
  education_level?: string;
  top_learners: {
    rank: number;
    student_id: string;
    name: string;
    admission_number: string;
    class_name: string;
    stream: string;
    marks: number;
    grade_code: string;
    overall_level: string;
    points: number;
  }[];
}

export interface DeviationItem {
  id: string;
  name: string; // School / Class / Stream / Subject / Learner name
  category: 'School' | 'Class' | 'Stream' | 'Subject' | 'Learner';
  current_mean: number;
  previous_mean: number;
  diff_mean: number;
  percentage_change: number;
  current_points: number;
  previous_points: number;
  diff_points: number;
  current_level: string;
  previous_level: string;
  trend: '▲ Improved' | '▼ Declined' | '▬ No Change';
}

export interface SchoolAnalyticsData {
  exam: Examination;
  education_level_title: string;
  education_level: EducationLevel;
  max_obtainable_marks: number;
  total_students_assessed: number;
  total_classes_count: number;
  total_streams_count: number;
  overall_school_mean: number;
  overall_school_mean_percentage: number;
  overall_school_mean_points: number;
  overall_school_level: string;
  overall_school_grade_code: string;

  class_rankings: ClassRankingItem[];
  stream_rankings: StreamRankingItem[];
  subject_rankings: SubjectRankingItem[];
  class_subject_analysis: ClassSubjectAnalysisItem[];

  best_three_per_stream: Record<string, LearnerPerformerItem[]>; // stream key -> items
  best_three_per_class: Record<string, LearnerPerformerItem[]>; // class_name -> items
  best_learners_school: LearnerPerformerItem[];
  best_subject_performers: SubjectTopPerformerItem[];

  // Summary Dashboard metrics
  highest_performing_class: string;
  highest_performing_stream: string;
  highest_performing_subject: string;
  lowest_performing_subject: string;
  best_learner: LearnerPerformerItem | null;
}

export interface ExaminationComparisonData {
  examA: Examination;
  examB: Examination;
  education_level_title: string;

  school_deviation: DeviationItem;
  class_deviations: DeviationItem[];
  stream_deviations: DeviationItem[];
  subject_deviations: DeviationItem[];
  learner_deviations: DeviationItem[];

  most_improved_class: string;
  most_improved_stream: string;
  most_improved_learner: string;
}

/**
  Calculate full School Performance Analytics for a given exam & educational level
 */
export function calculateSchoolAnalytics(
  examId: string,
  exams: Examination[],
  students: Student[],
  classes: ClassStream[],
  subjects: Subject[],
  marks: Mark[],
  grades: Grade[],
  targetLevel: EducationLevel = 'Junior School',
  targetClass: string = 'all'
): SchoolAnalyticsData | null {
  const targetExam = exams.find((e) => e.id === examId);
  if (!targetExam) return null;

  // Resolve historical class/stream/grade for all students at the time of targetExam
  const studentHistMap = new Map<string, ReturnType<typeof getLearnerClassAtExamTime>>();
  (students || []).forEach((s) => {
    if (!s || !s.id) return;
    const histCtx = getLearnerClassAtExamTime(s, targetExam, classes);
    studentHistMap.set(s.id, histCtx);
  });

  // 1. Determine level title & allowed classes
  let levelTitle = 'Junior School Analytics (Grades 7–9)';
  let levelClasses = classes || [];
  let sampleGrade = 'Grade 7';

  if (targetLevel === 'Junior School') {
    levelTitle = 'Junior School Analytics (Grades 7–9)';
    sampleGrade = 'Grade 7';
    levelClasses = (classes || []).filter(
      (c) => c && c.class_name && getEducationLevelForGrade(c.class_name) === 'Junior School'
    );
  } else if (targetLevel === 'Upper Primary') {
    levelTitle = 'Upper Primary Analytics (Grades 4–6)';
    sampleGrade = 'Grade 4';
    levelClasses = (classes || []).filter(
      (c) => c && c.class_name && getEducationLevelForGrade(c.class_name) === 'Upper Primary'
    );
  } else if (targetLevel === 'Lower Primary') {
    levelTitle = 'Lower Primary Analytics (Grades 1–3)';
    sampleGrade = 'Grade 1';
    levelClasses = (classes || []).filter(
      (c) => c && c.class_name && getEducationLevelForGrade(c.class_name) === 'Lower Primary'
    );
  } else if (targetLevel === 'Pre-Primary') {
    levelTitle = 'Pre-Primary Analytics (PP1–PP2)';
    sampleGrade = 'PP1';
    levelClasses = (classes || []).filter(
      (c) => c && c.class_name && getEducationLevelForGrade(c.class_name) === 'Pre-Primary'
    );
  }

  if (targetClass !== 'all') {
    levelClasses = levelClasses.filter((c) => c && c.class_name === targetClass);
    levelTitle = `${targetClass} Performance Analytics`;
  }

  const levelClassIds = new Set(levelClasses.map((c) => c.id).filter(Boolean));
  const levelStudents = (students || []).filter((s) => {
    if (!s || !s.id) return false;
    const histCtx = studentHistMap.get(s.id) || getLearnerClassAtExamTime(s, targetExam, classes);
    if (!histCtx) return false;
    if (histCtx.class_id && levelClassIds.has(histCtx.class_id)) {
      return true;
    }
    const histLevel = getEducationLevelForGrade(histCtx.class_name || histCtx.grade || 'Grade 7');
    const matchesLevel = histLevel === targetLevel;
    if (targetClass !== 'all') {
      const histClass = histCtx.class_name || histCtx.grade;
      return matchesLevel && histClass === targetClass;
    }
    return matchesLevel;
  });

  // Determine applicable subjects for this level
  const sampleGradeForSubj = targetClass !== 'all' ? targetClass : sampleGrade;
  const applicableSubjects = getApplicableSubjectsForGrade(sampleGradeForSubj, subjects);
  const applicableSubjIds = new Set(applicableSubjects.map((sb) => sb.id).filter(Boolean));

  // Calculate maximum obtainable marks for this level (e.g. 900 for JS with 9 learning areas)
  const maxObtainableMarks = applicableSubjects.length > 0 ? applicableSubjects.length * 100 : 900;

  // Filter marks for this exam & level subjects & level students
  const levelStudentIds = new Set(levelStudents.map((s) => s.id).filter(Boolean));
  const examMarks = (marks || []).filter((m) => {
    if (!m || m.exam_id !== examId || typeof m.marks !== 'number') return false;
    if (!levelStudentIds.has(m.student_id)) return false;
    if (applicableSubjIds.has(m.subject_id)) return true;
    return applicableSubjects.some(
      (sb) =>
        sb.id === m.subject_id ||
        (sb.subject_code && sb.subject_code === m.subject_id) ||
        (sb.subject_name && sb.subject_name.toLowerCase() === String(m.subject_id).toLowerCase())
    );
  });

  // Map student id to student object & class info
  const studentMap = new Map<string, Student>();
  (levelStudents || []).forEach((s) => {
    if (s && s.id) studentMap.set(s.id, s);
  });

  const classMap = new Map<string, ClassStream>();
  (classes || []).forEach((c) => {
    if (c && c.id) classMap.set(c.id, c);
  });

  // Identify assessed students (learners who have at least one valid assessed normal mark)
  const assessedStudentIds = new Set(
    examMarks
      .filter((m) => {
        if (!m) return false;
        const sb = subjects.find(s => s.id === m.subject_id || s.subject_code === m.subject_id);
        const std = levelStudents.find(s => s.id === m.student_id);
        const histCtx = std ? studentHistMap.get(std.id) : undefined;
        const clsObj = histCtx?.class_id ? classMap.get(histCtx.class_id) : undefined;
        const stdEduLevel = getEducationLevelForGrade(histCtx?.class_name || histCtx?.grade || 'Grade 7');
        const isCompInsha = isUpperPrimaryCompOrInsha(sb, clsObj, stdEduLevel);
        const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: clsObj, educationLevel: stdEduLevel });
        return evalMark.status === 'Normal' && evalMark.percentage !== null;
      })
      .map((m) => m.student_id)
      .filter(Boolean)
  );
  const assessedStudents = (levelStudents || []).filter((s) => s && s.id && assessedStudentIds.has(s.id));

  // Compute stats per student
  const studentStatsList: LearnerPerformerItem[] = [];

  assessedStudents.forEach((std) => {
    if (!std || !std.id) return;
    const stdMarks = examMarks.filter((m) => m.student_id === std.id);
    if (stdMarks.length === 0) return;

    const histCtx = studentHistMap.get(std.id) || getLearnerClassAtExamTime(std, targetExam, classes);
    if (!histCtx) return;
    const clsObj = histCtx.class_id ? classMap.get(histCtx.class_id) : undefined;
    const className = histCtx.class_name || (clsObj ? clsObj.class_name : 'Unknown');
    const streamName = histCtx.stream_name || (clsObj ? clsObj.stream : '');
    const stdGrade = histCtx.grade || (clsObj ? clsObj.class_name : std.grade) || sampleGrade;
    const stdReqSubjects = clsObj ? getAllocatedSubjectsForClass(clsObj, subjects) : getApplicableSubjectsForGrade(stdGrade, subjects);
    const stdReqCount = stdReqSubjects.length > 0 ? stdReqSubjects.length : applicableSubjects.length;

    const stdEduLevel = getEducationLevelForGrade(className);

    const validStdMarks = stdMarks
      .map((m) => {
        const sb = subjects.find(s => s.id === m.subject_id || s.subject_code === m.subject_id);
        const isCompInsha = isUpperPrimaryCompOrInsha(sb, clsObj, stdEduLevel);
        return evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: clsObj, educationLevel: stdEduLevel });
      })
      .filter((info) => info.status === 'Normal' && info.percentage !== null);

    const count = validStdMarks.length;
    if (count === 0) return;

    // Normalized percentage points out of 100 per subject, rounded to nearest whole integer
    const normalizedSubjectPcts = validStdMarks.map((info) => Math.round(info.percentage!));
    const totalMarks = normalizedSubjectPcts.reduce((sum, pct) => sum + pct, 0);
    const sumPercentage = totalMarks;
    const isComplete = stdReqCount > 0 ? count >= stdReqCount : true;

    const avgMarks = count > 0 ? Math.round(sumPercentage / count) : 0;
    const meanPercentage = avgMarks;

    let totalPoints = 0;
    validStdMarks.forEach((info) => {
      const g = getGradeForMark(Math.round(info.percentage!), grades, stdEduLevel, className);
      totalPoints += g?.points || 0;
    });
    const avgPoints = count > 0 ? Math.round((totalPoints / count) * 100) / 100 : 0;

    const gradeObj = getGradeForMark(meanPercentage, grades, stdEduLevel, className);

    studentStatsList.push({
      rank: 0,
      student_id: std.id,
      name: std.full_name || 'Unknown Learner',
      admission_number: std.admission_number || '-',
      class_name: className,
      stream: streamName,
      total_marks: totalMarks,
      average_marks: avgMarks,
      mean_percentage: meanPercentage,
      total_points: totalPoints,
      average_points: avgPoints,
      overall_level: isComplete ? gradeObj.performance_level : (gradeObj.performance_level || 'Pending'),
      grade_code: isComplete ? gradeObj.grade_code : (gradeObj.grade_code || 'Pending'),
      subject_count: count,
      is_complete: isComplete,
      education_level: stdEduLevel,
    });
  });

  // Rank complete students separately per education level using KNEC tie-breaking standards
  const eduLevelsInStats = Array.from(new Set(studentStatsList.map((s) => s.education_level || getEducationLevelForGrade(s.class_name))));
  
  eduLevelsInStats.forEach((lvl) => {
    const lvlCompleteLearners = studentStatsList.filter(
      (s) => (s.education_level || getEducationLevelForGrade(s.class_name)) === lvl && s.is_complete !== false
    );
    lvlCompleteLearners.sort((a, b) => {
      if ((b.total_marks || 0) !== (a.total_marks || 0)) {
        return (b.total_marks || 0) - (a.total_marks || 0);
      }
      if ((b.average_points || 0) !== (a.average_points || 0)) {
        return (b.average_points || 0) - (a.average_points || 0);
      }
      return (b.mean_percentage || 0) - (a.mean_percentage || 0);
    });
    applyCompetitionRanking(lvlCompleteLearners, isMeritTie, (item, rank) => {
      item.rank = rank;
    });
  });

  // Keep incomplete learners with rank = 0 (Not Yet Ranked)
  studentStatsList.filter((s) => s.is_complete === false).forEach((item) => {
    item.rank = 0;
  });

  // Sort studentStatsList so that ranked complete learners are ordered by education level then rank first
  studentStatsList.sort((a, b) => {
    if (a.is_complete !== b.is_complete) {
      return a.is_complete ? -1 : 1;
    }
    const eduA = a.education_level || getEducationLevelForGrade(a.class_name);
    const eduB = b.education_level || getEducationLevelForGrade(b.class_name);
    if (eduA !== eduB) {
      return eduA.localeCompare(eduB);
    }
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return b.total_marks - a.total_marks;
  });

  // Calculate overall school metrics for this level
  const totalAssessed = studentStatsList.length;
  let overallSchoolMean = 0;
  let overallSchoolMeanPct = 0;
  let overallSchoolMeanPoints = 0;

  if (totalAssessed > 0) {
    const sumTotalMarks = studentStatsList.reduce((acc, s) => acc + s.total_marks, 0);
    const sumPct = studentStatsList.reduce((acc, s) => acc + s.mean_percentage, 0);
    const sumPts = studentStatsList.reduce((acc, s) => acc + s.average_points, 0);
    overallSchoolMean = Math.round(sumTotalMarks / totalAssessed);
    overallSchoolMeanPct = Math.round(sumPct / totalAssessed);
    overallSchoolMeanPoints = Math.round((sumPts / totalAssessed) * 100) / 100;
  }
  const overallSchoolGradeObj = getGradeForMark(overallSchoolMeanPct, grades, targetLevel, targetClass !== 'all' ? targetClass : null);

  // 1. CLASS RANKING (Only for levelClasses)
  const classGroupMap = new Map<string, LearnerPerformerItem[]>();
  studentStatsList.forEach((s) => {
    if (!classGroupMap.has(s.class_name)) {
      classGroupMap.set(s.class_name, []);
    }
    classGroupMap.get(s.class_name)!.push(s);
  });

  const classRankings: ClassRankingItem[] = [];
  classGroupMap.forEach((learners, cName) => {
    const assessedLearners = learners.filter((l) => (l.subject_count || 0) > 0);
    const count = assessedLearners.length;
    const totMarks = assessedLearners.reduce((sum, l) => sum + l.total_marks, 0);
    const meanM = count > 0 ? Math.round(totMarks / count) : 0;
    const meanPct = count > 0 ? Math.round(assessedLearners.reduce((sum, l) => sum + l.mean_percentage, 0) / count) : 0;
    const meanP = count > 0 ? Math.round((assessedLearners.reduce((sum, l) => sum + l.average_points, 0) / count) * 100) / 100 : 0;
    const classEduLevel = getEducationLevelForGrade(cName);
    const grObj = getGradeForMark(meanPct, grades, classEduLevel, cName);

    classRankings.push({
      rank: 0,
      class_name: cName,
      learners_count: count,
      total_marks: totMarks,
      mean_marks: meanM,
      max_obtainable_marks: maxObtainableMarks,
      mean_percentage: meanPct,
      mean_points: meanP,
      overall_level: grObj.performance_level,
      grade_code: grObj.grade_code,
    });
  });

  classRankings.sort((a, b) => b.mean_points - a.mean_points || b.mean_marks - a.mean_marks || b.mean_percentage - a.mean_percentage);
  applyCompetitionRanking(
    classRankings,
    (a, b) => Math.round(a.mean_points * 100) === Math.round(b.mean_points * 100) && a.mean_marks === b.mean_marks,
    (c, rank) => { c.rank = rank; }
  );

  // 2. STREAM RANKING
  const streamGroupMap = new Map<string, LearnerPerformerItem[]>();
  studentStatsList.forEach((s) => {
    const key = `${s.class_name} ${s.stream}`.trim();
    if (!streamGroupMap.has(key)) {
      streamGroupMap.set(key, []);
    }
    streamGroupMap.get(key)!.push(s);
  });

  const streamRankings: StreamRankingItem[] = [];
  streamGroupMap.forEach((learners, fullKey) => {
    const first = learners[0];
    const assessedLearners = learners.filter((l) => (l.subject_count || 0) > 0);
    const count = assessedLearners.length;
    const totMarks = assessedLearners.reduce((sum, l) => sum + l.total_marks, 0);
    const meanM = count > 0 ? Math.round(totMarks / count) : 0;
    const meanPct = count > 0 ? Math.round(assessedLearners.reduce((sum, l) => sum + l.mean_percentage, 0) / count) : 0;
    const meanP = count > 0 ? Math.round((assessedLearners.reduce((sum, l) => sum + l.average_points, 0) / count) * 100) / 100 : 0;
    const streamEduLevel = getEducationLevelForGrade(first.class_name);
    const grObj = getGradeForMark(meanPct, grades, streamEduLevel, first.class_name);

    streamRankings.push({
      rank: 0,
      class_id: first.class_name,
      class_name: first.class_name,
      stream: first.stream,
      full_name: fullKey,
      learners_count: count,
      total_marks: totMarks,
      mean_marks: meanM,
      max_obtainable_marks: maxObtainableMarks,
      mean_percentage: meanPct,
      mean_points: meanP,
      overall_level: grObj.performance_level,
      grade_code: grObj.grade_code,
    });
  });

  streamRankings.sort((a, b) => b.mean_points - a.mean_points || b.mean_marks - a.mean_marks || b.mean_percentage - a.mean_percentage);
  applyCompetitionRanking(
    streamRankings,
    (a, b) => Math.round(a.mean_points * 100) === Math.round(b.mean_points * 100) && a.mean_marks === b.mean_marks,
    (st, rank) => { st.rank = rank; }
  );

  // 3. SUBJECT PERFORMANCE RANKING (Scoped per Education Level)
  const subjectRankings: SubjectRankingItem[] = [];
  const targetLevels: EducationLevel[] = [targetLevel];

  targetLevels.forEach((lvl) => {
    const lvlStudents = (students || []).filter((s) => {
      const histCtx = studentHistMap.get(s.id)!;
      if (!histCtx) return false;
      const studentGrade = histCtx.class_name || histCtx.grade;
      return getEducationLevelForGrade(studentGrade) === lvl;
    });

    if (lvlStudents.length === 0) return;

    const lvlStudentIds = new Set(lvlStudents.map((s) => s.id));
    const sampleGradeForLvl =
      lvl === 'Pre-Primary' ? 'PP1' : lvl === 'Lower Primary' ? 'Grade 1' : lvl === 'Upper Primary' ? 'Grade 4' : 'Grade 7';

    const lvlApplicableSubjects = (subjects || []).filter((s) => {
      if (s.status === 'Archived') return false;
      if (s.applicable_grades && s.applicable_grades.length > 0) {
        return s.applicable_grades.some((g) => getEducationLevelForGrade(g) === lvl);
      }
      if (s.education_level) {
        return s.education_level === lvl;
      }
      return getApplicableSubjectsForGrade(sampleGradeForLvl, [s]).length > 0;
    });

    const lvlSubjectRankings: SubjectRankingItem[] = [];

    (lvlApplicableSubjects || []).forEach((sb) => {
      const isCompInsha = isUpperPrimaryCompOrInsha(sb, null, lvl);
      const sbMarks = (marks || []).filter((m) => {
        if (m.exam_id !== examId || m.subject_id !== sb.id) return false;
        if (!lvlStudentIds.has(m.student_id)) return false;
        const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, educationLevel: lvl });
        return evalMark.status === 'Normal' && evalMark.percentage !== null;
      });

      const candidates = sbMarks.length;
      if (candidates > 0) {
        const sumMarks = sbMarks.reduce((acc, m) => {
          const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, educationLevel: lvl });
          return acc + Math.round(evalMark.percentage!);
        }, 0);
        const meanM = Math.round(sumMarks / candidates);

        const sumRaw = sbMarks.reduce((acc, m) => {
          const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, educationLevel: lvl });
          return acc + (evalMark.rawScore ?? 0);
        }, 0);
        const meanRaw = sumRaw / candidates;

        let sumPts = 0;
        sbMarks.forEach((m) => {
          const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, educationLevel: lvl });
          const g = getGradeForMark(Math.round(evalMark.percentage!), grades, lvl);
          sumPts += g?.points || 0;
        });
        const meanP = Math.round((sumPts / candidates) * 100) / 100;
        const grObj = getGradeForMark(meanM, grades, lvl);

        // Determine actual out_of to display raw marks correctly
        let outOf = 100;
        if (isCompInsha) {
          const sampleM = sbMarks[0];
          if (sampleM && sampleM.out_of) {
            outOf = sampleM.out_of;
          } else {
            const foundOutOf = sbMarks.find(m => m.out_of && m.out_of > 0)?.out_of;
            outOf = foundOutOf || 30;
          }
        }

        lvlSubjectRankings.push({
          rank: 0,
          subject_id: sb.id,
          subject_name: sb.subject_name,
          subject_code: sb.subject_code,
          category: sb.category || 'Core',
          total_candidates: candidates,
          mean_marks: isCompInsha ? meanRaw : meanM,
          mean_percentage: meanM,
          mean_points: meanP,
          overall_level: grObj?.performance_level || 'Pending',
          grade_code: grObj?.grade_code || 'Pending',
          education_level: lvl,
          is_raw: isCompInsha,
          out_of: outOf,
        });
      }
    });

    lvlSubjectRankings.sort((a, b) => b.mean_points - a.mean_points || b.mean_marks - a.mean_marks);
    applyCompetitionRanking(
      lvlSubjectRankings,
      (a, b) => Math.round(a.mean_points * 100) === Math.round(b.mean_points * 100) && a.mean_marks === b.mean_marks,
      (sb, rank) => { sb.rank = rank; }
    );

    subjectRankings.push(...lvlSubjectRankings);
  });

  // 4. CLASS SUBJECT ANALYSIS
  const classSubjectAnalysis: ClassSubjectAnalysisItem[] = [];
  const uniqueClassNames = Array.from(new Set(classRankings.map((c) => c.class_name)));

  uniqueClassNames.forEach((cName) => {
    const classLearners = studentStatsList.filter((s) => s.class_name === cName);
    const classLearnerIds = new Set(classLearners.map((l) => l.student_id));

    const subjItems: ClassSubjectAnalysisItem['subjects'] = [];
    const classObj = classes.find(c => c.class_name === cName);
    const classEduLevel = getEducationLevelForGrade(cName);
    const classSubjects = classObj ? getAllocatedSubjectsForClass(classObj, subjects) : getApplicableSubjectsForGrade(cName, subjects);

    (classSubjects || []).forEach((sb) => {
      const isCompInsha = isUpperPrimaryCompOrInsha(sb, classObj, classEduLevel);
      const sbClassMarks = (marks || []).filter((m) => {
        if (m.exam_id !== examId || m.subject_id !== sb.id || !classLearnerIds.has(m.student_id)) return false;
        const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: classObj, educationLevel: classEduLevel });
        return evalMark.status === 'Normal' && evalMark.percentage !== null;
      });

      if (sbClassMarks.length > 0) {
        const sumM = sbClassMarks.reduce((acc, m) => {
          const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: classObj, educationLevel: classEduLevel });
          return acc + Math.round(evalMark.percentage!);
        }, 0);
        const meanM = Math.round(sumM / sbClassMarks.length);

        const sumRaw = sbClassMarks.reduce((acc, m) => {
          const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: classObj, educationLevel: classEduLevel });
          return acc + (evalMark.rawScore ?? 0);
        }, 0);
        const meanRaw = sumRaw / sbClassMarks.length;

        let sumPts = 0;
        sbClassMarks.forEach((m) => {
          const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: classObj, educationLevel: classEduLevel });
          const g = getGradeForMark(Math.round(evalMark.percentage!), grades, classEduLevel, cName);
          sumPts += g?.points || 0;
        });
        const meanP = Math.round((sumPts / sbClassMarks.length) * 100) / 100;
        const grObj = getGradeForMark(meanM, grades, classEduLevel, cName);

        let outOf = 100;
        if (isCompInsha) {
          const sampleM = sbClassMarks[0];
          if (sampleM && sampleM.out_of) {
            outOf = sampleM.out_of;
          } else {
            const foundOutOf = sbClassMarks.find(m => m.out_of && m.out_of > 0)?.out_of;
            outOf = foundOutOf || 30;
          }
        }

        subjItems.push({
          subject_id: sb.id,
          subject_name: sb.subject_name,
          subject_code: sb.subject_code,
          mean_marks: isCompInsha ? meanRaw : meanM,
          mean_points: meanP,
          overall_level: grObj?.performance_level || 'Pending',
          grade_code: grObj?.grade_code || 'Pending',
          candidates_count: sbClassMarks.length,
          is_raw: isCompInsha,
          out_of: outOf,
        });
      }
    });

    classSubjectAnalysis.push({
      class_name: cName,
      subjects: subjItems,
    });
  });

  // 5. BEST THREE LEARNERS PER STREAM
  const best_three_per_stream: Record<string, LearnerPerformerItem[]> = {};
  streamGroupMap.forEach((learners, key) => {
    const sorted = learners
      .map((l) => ({ ...l }))
      .sort((a, b) => {
        if (a.is_complete !== b.is_complete) {
          return a.is_complete ? -1 : 1;
        }
        if ((b.total_marks || 0) !== (a.total_marks || 0)) {
          return (b.total_marks || 0) - (a.total_marks || 0);
        }
        if ((b.average_points || 0) !== (a.average_points || 0)) {
          return (b.average_points || 0) - (a.average_points || 0);
        }
        return (b.mean_percentage || 0) - (a.mean_percentage || 0);
      });
    applyCompetitionRanking(sorted, isMeritTie, (item, rank) => {
      item.rank = rank;
    });
    best_three_per_stream[key] = sorted.slice(0, 3);
  });

  // 6. BEST THREE LEARNERS PER CLASS
  const best_three_per_class: Record<string, LearnerPerformerItem[]> = {};
  classGroupMap.forEach((learners, cName) => {
    const sorted = learners
      .map((l) => ({ ...l }))
      .sort((a, b) => {
        if (a.is_complete !== b.is_complete) {
          return a.is_complete ? -1 : 1;
        }
        if ((b.total_marks || 0) !== (a.total_marks || 0)) {
          return (b.total_marks || 0) - (a.total_marks || 0);
        }
        if ((b.average_points || 0) !== (a.average_points || 0)) {
          return (b.average_points || 0) - (a.average_points || 0);
        }
        return (b.mean_percentage || 0) - (a.mean_percentage || 0);
      });
    applyCompetitionRanking(sorted, isMeritTie, (item, rank) => {
      item.rank = rank;
    });
    best_three_per_class[cName] = sorted.slice(0, 3);
  });

  // 7. BEST LEARNERS IN THE ENTIRE LEVEL
  const best_learners_school = studentStatsList;

  // 8. BEST SUBJECT PERFORMERS (Top 10 per learning area within each class and education level)
  const best_subject_performers: SubjectTopPerformerItem[] = [];

  uniqueClassNames.forEach((cName) => {
    const classLearners = studentStatsList.filter((s) => s.class_name === cName);
    const classLearnerIds = new Set(classLearners.map((l) => l.student_id));
    const eduLevel = getEducationLevelForGrade(cName);

    const classObj = classes.find((c) => c.class_name === cName);
    const classSubjects = classObj ? getAllocatedSubjectsForClass(classObj, subjects) : getApplicableSubjectsForGrade(cName, subjects);

    (classSubjects || []).forEach((sb) => {
      const isCompInsha = isUpperPrimaryCompOrInsha(sb, classObj, eduLevel);
      const sbClassMarks = (marks || []).filter((m) => {
        if (m.exam_id !== examId || m.subject_id !== sb.id || !classLearnerIds.has(m.student_id)) return false;
        const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: classObj, educationLevel: eduLevel });
        return evalMark.status === 'Normal' && evalMark.percentage !== null;
      });

      if (sbClassMarks.length > 0) {
        const learnerMap = new Map<string, { student: Student; mark: number; raw_score: number; out_of: number; is_raw: boolean }>();
        sbClassMarks.forEach((m) => {
          const std = studentMap.get(m.student_id);
          if (std) {
            const evalMark = evaluateMark(m, { isUpperPrimaryCompOrInsha: isCompInsha, subject: sb, classObj: classObj, educationLevel: eduLevel });
            learnerMap.set(m.student_id, {
              student: std,
              mark: Math.round(evalMark.percentage!),
              raw_score: evalMark.rawScore ?? 0,
              out_of: evalMark.outOf ?? 100,
              is_raw: isCompInsha
            });
          }
        });

        const list = Array.from(learnerMap.values()).sort((a, b) => b.mark - a.mark);
        const topPerformers = list.map((item) => {
          const histCtx = studentHistMap.get(item.student.id);
          const clsObj = histCtx?.class_id ? classMap.get(histCtx.class_id) : undefined;
          const className = histCtx?.class_name || (clsObj ? clsObj.class_name : cName);
          const streamName = histCtx?.stream_name || (clsObj ? clsObj.stream : '');
          const itemEduLevel = getEducationLevelForGrade(className);
          const grObj = getGradeForMark(item.mark, grades, itemEduLevel, className);
          return {
            rank: 0,
            student_id: item.student.id,
            name: item.student.full_name || 'Unknown Learner',
            admission_number: item.student.admission_number || '-',
            class_name: className,
            stream: streamName,
            marks: item.mark,
            grade_code: grObj.grade_code,
            overall_level: grObj.performance_level,
            points: grObj.points,
            raw_score: item.raw_score,
            out_of: item.out_of,
            is_raw: item.is_raw,
          };
        });

        applyCompetitionRanking(
          topPerformers,
          (a, b) => a.marks === b.marks,
          (item, rank) => {
            item.rank = rank;
          }
        );

        best_subject_performers.push({
          subject_id: sb.id,
          subject_name: sb.subject_name,
          subject_code: sb.subject_code,
          class_name: cName,
          education_level: eduLevel,
          top_learners: topPerformers.slice(0, 10),
        });
      }
    });
  });

  const uniqueClassesCount = classRankings.length;
  const uniqueStreamsCount = streamRankings.length;

  const highestClass = classRankings.length > 0 ? `${classRankings[0].class_name} (${classRankings[0].mean_marks} / ${maxObtainableMarks})` : '-';
  const highestStream = streamRankings.length > 0 ? `${streamRankings[0].full_name} (${streamRankings[0].mean_marks} / ${maxObtainableMarks})` : '-';
  const highestSubject = subjectRankings.length > 0 ? `${subjectRankings[0].subject_name} (${subjectRankings[0].mean_percentage}%)` : '-';
  const lowestSubject = subjectRankings.length > 0 ? `${subjectRankings[subjectRankings.length - 1].subject_name} (${subjectRankings[subjectRankings.length - 1].mean_percentage}%)` : '-';
  const bestLearner = studentStatsList.length > 0 ? studentStatsList[0] : null;

  return {
    exam: targetExam,
    education_level_title: levelTitle,
    education_level: targetLevel,
    max_obtainable_marks: maxObtainableMarks,
    total_students_assessed: totalAssessed,
    total_classes_count: uniqueClassesCount,
    total_streams_count: uniqueStreamsCount,
    overall_school_mean: overallSchoolMean,
    overall_school_mean_percentage: overallSchoolMeanPct,
    overall_school_mean_points: overallSchoolMeanPoints,
    overall_school_level: overallSchoolGradeObj.performance_level,
    overall_school_grade_code: overallSchoolGradeObj.grade_code,

    class_rankings: classRankings,
    stream_rankings: streamRankings,
    subject_rankings: subjectRankings,
    class_subject_analysis: classSubjectAnalysis,

    best_three_per_stream,
    best_three_per_class,
    best_learners_school,
    best_subject_performers,

    highest_performing_class: highestClass,
    highest_performing_stream: highestStream,
    highest_performing_subject: highestSubject,
    lowest_performing_subject: lowestSubject,
    best_learner: bestLearner,
  };
}

/**
 * Compare two examinations & calculate performance deviations for a specific educational level
 */
export function compareExaminations(
  examAId: string, // Current exam
  examBId: string, // Previous exam
  exams: Examination[],
  students: Student[],
  classes: ClassStream[],
  subjects: Subject[],
  marks: Mark[],
  grades: Grade[],
  targetLevel: EducationLevel = 'Junior School',
  targetClass: string = 'all'
): ExaminationComparisonData | null {
  const currentData = calculateSchoolAnalytics(examAId, exams, students, classes, subjects, marks, grades, targetLevel, targetClass);
  const previousData = calculateSchoolAnalytics(examBId, exams, students, classes, subjects, marks, grades, targetLevel, targetClass);

  if (!currentData || !previousData) return null;

  const createTrend = (curr: number, prev: number): '▲ Improved' | '▼ Declined' | '▬ No Change' => {
    const diff = curr - prev;
    if (Math.abs(diff) < 0.001) return '▬ No Change';
    return diff > 0 ? '▲ Improved' : '▼ Declined';
  };

  // 1. Level Deviation
  const currSchoolM = currentData.overall_school_mean;
  const prevSchoolM = previousData.overall_school_mean;
  const diffSchoolM = Math.round((currSchoolM - prevSchoolM) * 100) / 100;
  const pctSchool = prevSchoolM > 0 ? Math.round(((currSchoolM - prevSchoolM) / prevSchoolM) * 10000) / 100 : 0;
  const currSchoolP = currentData.overall_school_mean_points;
  const prevSchoolP = previousData.overall_school_mean_points;
  const diffSchoolP = Math.round((currSchoolP - prevSchoolP) * 100) / 100;

  const school_deviation: DeviationItem = {
    id: 'school',
    name: `${currentData.education_level_title} Overall`,
    category: 'School',
    current_mean: currSchoolM,
    previous_mean: prevSchoolM,
    diff_mean: diffSchoolM,
    percentage_change: pctSchool,
    current_points: currSchoolP,
    previous_points: prevSchoolP,
    diff_points: diffSchoolP,
    current_level: currentData.overall_school_level,
    previous_level: previousData.overall_school_level,
    trend: createTrend(currSchoolM, prevSchoolM),
  };

  // 2. Class Deviations
  const classDeviations: DeviationItem[] = [];
  const allClasses = Array.from(
    new Set([...currentData.class_rankings.map((c) => c.class_name), ...previousData.class_rankings.map((c) => c.class_name)])
  );

  allClasses.forEach((cName) => {
    const currC = currentData.class_rankings.find((c) => c.class_name === cName);
    const prevC = previousData.class_rankings.find((c) => c.class_name === cName);

    const cM = currC ? currC.mean_marks : 0;
    const pM = prevC ? prevC.mean_marks : 0;
    const diffM = Math.round((cM - pM) * 100) / 100;
    const pct = pM > 0 ? Math.round(((cM - pM) / pM) * 10000) / 100 : 0;

    const cP = currC ? currC.mean_points : 0;
    const pP = prevC ? prevC.mean_points : 0;
    const diffP = Math.round((cP - pP) * 100) / 100;

    classDeviations.push({
      id: cName,
      name: cName,
      category: 'Class',
      current_mean: cM,
      previous_mean: pM,
      diff_mean: diffM,
      percentage_change: pct,
      current_points: cP,
      previous_points: pP,
      diff_points: diffP,
      current_level: currC ? currC.overall_level : '-',
      previous_level: prevC ? prevC.overall_level : '-',
      trend: createTrend(cM, pM),
    });
  });

  // 3. Stream Deviations
  const streamDeviations: DeviationItem[] = [];
  const allStreams = Array.from(
    new Set([...currentData.stream_rankings.map((s) => s.full_name), ...previousData.stream_rankings.map((s) => s.full_name)])
  );

  allStreams.forEach((stName) => {
    const currSt = currentData.stream_rankings.find((s) => s.full_name === stName);
    const prevSt = previousData.stream_rankings.find((s) => s.full_name === stName);

    const cM = currSt ? currSt.mean_marks : 0;
    const pM = prevSt ? prevSt.mean_marks : 0;
    const diffM = Math.round((cM - pM) * 100) / 100;
    const pct = pM > 0 ? Math.round(((cM - pM) / pM) * 10000) / 100 : 0;

    const cP = currSt ? currSt.mean_points : 0;
    const pP = prevSt ? prevSt.mean_points : 0;
    const diffP = Math.round((cP - pP) * 100) / 100;

    streamDeviations.push({
      id: stName,
      name: stName,
      category: 'Stream',
      current_mean: cM,
      previous_mean: pM,
      diff_mean: diffM,
      percentage_change: pct,
      current_points: cP,
      previous_points: pP,
      diff_points: diffP,
      current_level: currSt ? currSt.overall_level : '-',
      previous_level: prevSt ? prevSt.overall_level : '-',
      trend: createTrend(cM, pM),
    });
  });

  // 4. Subject Deviations
  const subjectDeviations: DeviationItem[] = [];
  const allSubjNames = Array.from(
    new Set([...currentData.subject_rankings.map((s) => s.subject_name), ...previousData.subject_rankings.map((s) => s.subject_name)])
  );

  allSubjNames.forEach((sName) => {
    const currSb = currentData.subject_rankings.find((s) => s.subject_name === sName);
    const prevSb = previousData.subject_rankings.find((s) => s.subject_name === sName);

    const cM = currSb ? currSb.mean_marks : 0;
    const pM = prevSb ? prevSb.mean_marks : 0;
    const diffM = Math.round((cM - pM) * 100) / 100;
    const pct = pM > 0 ? Math.round(((cM - pM) / pM) * 10000) / 100 : 0;

    const cP = currSb ? currSb.mean_points : 0;
    const pP = prevSb ? prevSb.mean_points : 0;
    const diffP = Math.round((cP - pP) * 100) / 100;

    subjectDeviations.push({
      id: sName,
      name: sName,
      category: 'Subject',
      current_mean: cM,
      previous_mean: pM,
      diff_mean: diffM,
      percentage_change: pct,
      current_points: cP,
      previous_points: pP,
      diff_points: diffP,
      current_level: currSb ? currSb.overall_level : '-',
      previous_level: prevSb ? prevSb.overall_level : '-',
      trend: createTrend(cM, pM),
    });
  });

  // 5. Learner Deviations
  const learnerDeviations: DeviationItem[] = [];
  const prevLearnerMap = new Map<string, LearnerPerformerItem>();
  previousData.best_learners_school.forEach((l) => prevLearnerMap.set(l.student_id, l));

  currentData.best_learners_school.forEach((currL) => {
    const prevL = prevLearnerMap.get(currL.student_id);
    if (prevL) {
      const cM = currL.total_marks;
      const pM = prevL.total_marks;
      const diffM = Math.round((cM - pM) * 100) / 100;
      const pct = pM > 0 ? Math.round(((cM - pM) / pM) * 10000) / 100 : 0;

      const cP = currL.average_points;
      const pP = prevL.average_points;
      const diffP = Math.round((cP - pP) * 100) / 100;

      learnerDeviations.push({
        id: currL.student_id,
        name: `${currL.name} (${currL.class_name} ${currL.stream})`.trim(),
        category: 'Learner',
        current_mean: cM,
        previous_mean: pM,
        diff_mean: diffM,
        percentage_change: pct,
        current_points: cP,
        previous_points: pP,
        diff_points: diffP,
        current_level: currL.overall_level,
        previous_level: prevL.overall_level,
        trend: createTrend(cM, pM),
      });
    }
  });

  const sortedClassesImp = [...classDeviations].sort((a, b) => b.diff_mean - a.diff_mean);
  const mostImpClass = sortedClassesImp.length > 0 && sortedClassesImp[0].diff_mean > 0 ? `${sortedClassesImp[0].name} (+${sortedClassesImp[0].diff_mean.toFixed(1)} marks)` : 'None';

  const sortedStreamsImp = [...streamDeviations].sort((a, b) => b.diff_mean - a.diff_mean);
  const mostImpStream = sortedStreamsImp.length > 0 && sortedStreamsImp[0].diff_mean > 0 ? `${sortedStreamsImp[0].name} (+${sortedStreamsImp[0].diff_mean.toFixed(1)} marks)` : 'None';

  const sortedLearnersImp = [...learnerDeviations].sort((a, b) => b.diff_mean - a.diff_mean);
  const mostImpLearner = sortedLearnersImp.length > 0 && sortedLearnersImp[0].diff_mean > 0 ? `${sortedLearnersImp[0].name} (+${sortedLearnersImp[0].diff_mean.toFixed(1)} marks)` : 'None';

  return {
    examA: currentData.exam,
    examB: previousData.exam,
    education_level_title: currentData.education_level_title,
    school_deviation,
    class_deviations: classDeviations,
    stream_deviations: streamDeviations,
    subject_deviations: subjectDeviations,
    learner_deviations: learnerDeviations,
    most_improved_class: mostImpClass,
    most_improved_stream: mostImpStream,
    most_improved_learner: mostImpLearner,
  };
}

export interface SubjectTrendPoint {
  exam_id: string;
  exam_name: string;
  term: string;
  year: number | string;
  milestone: string;
  [subject_key: string]: any;
}

export interface SubjectTrendMeta {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  category?: string;
  color: string;
}

export interface MultiExamSubjectTrends {
  points: SubjectTrendPoint[];
  subjects: SubjectTrendMeta[];
  examCount: number;
}

const SUBJECT_PALETTE = [
  '#059669', // Emerald
  '#2563EB', // Blue
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#EA580C', // Orange
  '#4F46E5', // Indigo
  '#16A34A', // Green
  '#9333EA', // Purple
  '#0D9488', // Teal
  '#E11D48', // Rose
  '#CA8A04', // Yellow
  '#475569', // Slate
];

/**
 * Calculate multi-exam longitudinal subject performance trends across terms/examinations
 */
export function calculateMultiExamSubjectTrends(
  exams: Examination[],
  students: Student[],
  classes: ClassStream[],
  subjects: Subject[],
  marks: Mark[],
  grades: Grade[],
  targetLevel: EducationLevel = 'Junior School',
  targetClass: string = 'all'
): MultiExamSubjectTrends {
  if (!exams || exams.length === 0) {
    return { points: [], subjects: [], examCount: 0 };
  }

  // Sort exams chronologically by year, term (Term 1, Term 2, Term 3), and start date / created_at
  const termOrder: Record<string, number> = {
    'Term 1': 1,
    'Term 2': 2,
    'Term 3': 3,
    'term 1': 1,
    'term 2': 2,
    'term 3': 3,
  };

  const sortedExams = [...exams].sort((a, b) => {
    const yearA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || '0'), 10);
    const yearB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || '0'), 10);
    if (yearA !== yearB) return yearA - yearB;

    const tA = termOrder[a.term] || 0;
    const tB = termOrder[b.term] || 0;
    if (tA !== tB) return tA - tB;

    const dateA = new Date(a.start_date || a.created_at || 0).getTime();
    const dateB = new Date(b.start_date || b.created_at || 0).getTime();
    return dateA - dateB;
  });

  const points: SubjectTrendPoint[] = [];
  const subjectMap = new Map<string, { id: string; name: string; code: string; category?: string }>();

  sortedExams.forEach((ex) => {
    const analytics = calculateSchoolAnalytics(ex.id, exams, students, classes, subjects, marks, grades, targetLevel, targetClass);
    if (!analytics || analytics.subject_rankings.length === 0) return;

    const milestoneLabel = `${ex.term} ${ex.year || ''} - ${ex.exam_name}`.trim();
    const point: SubjectTrendPoint = {
      exam_id: ex.id,
      exam_name: ex.exam_name,
      term: ex.term,
      year: ex.year,
      milestone: milestoneLabel,
    };

    analytics.subject_rankings.forEach((sr) => {
      subjectMap.set(sr.subject_id, {
        id: sr.subject_id,
        name: sr.subject_name,
        code: sr.subject_code,
        category: sr.category,
      });

      point[sr.subject_name] = sr.mean_percentage;
      point[`${sr.subject_name}__mean`] = sr.mean_marks;
      point[`${sr.subject_name}__points`] = sr.mean_points;
      point[`${sr.subject_name}__level`] = sr.overall_level;
      point[`${sr.subject_name}__grade`] = sr.grade_code;
      point[`${sr.subject_name}__candidates`] = sr.total_candidates;
    });

    points.push(point);
  });

  let colorIdx = 0;
  const subjectMetaList: SubjectTrendMeta[] = Array.from(subjectMap.values()).map((s) => {
    const color = SUBJECT_PALETTE[colorIdx % SUBJECT_PALETTE.length];
    colorIdx++;
    return {
      subject_id: s.id,
      subject_name: s.name,
      subject_code: s.code,
      category: s.category,
      color,
    };
  });

  return {
    points,
    subjects: subjectMetaList,
    examCount: points.length,
  };
}
