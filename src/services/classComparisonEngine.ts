import {
  Student,
  ClassStream,
  Examination,
  Subject,
  Mark,
  Grade,
  Teacher,
  sortClasses,
  getApplicableSubjectsForGrade,
} from '../types';
import { getFilteredStudents } from '../utils/filterUtils';
import { evaluateMark } from '../utils/markUtils';
import { calculateExamResults, applyCompetitionRanking } from './analysisEngine';
import { getLearnerClassAtExamTime } from './historicalContextResolver';

export interface TopLearnerSummary {
  student_id: string;
  student_name: string;
  admission_number?: string;
  position: number;
  total_marks: number;
  average_marks: number;
  performance_level?: string | null;
  stream_name?: string;
}

export interface StreamRankingSummary {
  stream_id: string;
  stream_name: string;
  class_teacher_name?: string;
  average_marks: number | null;
  assessed_count: number;
  total_learners: number;
  rank: number | null;
  topLearners: TopLearnerSummary[];
}

export interface StreamColumnInfo {
  id: string;          // Unique stream key/id
  name: string;        // e.g. "Blue", "Red", "Main"
  displayName: string; // e.g. "Grade 9 Blue"
  classId: string;     // ClassStream ID
  className: string;   // e.g. "Grade 9"
  learnerCount: number;
  classTeacherName?: string;
}

export interface StreamSubjectMean {
  stream_id: string;
  stream_name: string;
  mean_percentage: number | null;        // null if 0 assessed learners
  assessed_count: number;                // number of valid assessed learners
  difference_from_grade: number | null;  // Stream Mean % - Grade Overall Mean %
  stream_rank?: number | null;           // Rank of this Learning Area within this stream
}

export interface StreamVsGradeRow {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  stream_means: Record<string, StreamSubjectMean>; // Keyed by StreamColumnInfo.id
  grade_overall_mean: number | null;               // True weighted Grade mean %
  grade_overall_rank?: number | null;              // Rank of this Learning Area across the whole Grade
  total_assessed: number;                          // Total valid assessed in Grade
  highest_stream_name: string | null;             // Highest stream name (or null if tie / 1 stream / none)
  is_tie: boolean;
}

export interface StreamAverageData {
  stream_name: string;
  average_marks: number | null; // Sum of assessed learner total aggregate marks ÷ assessed count
  assessed_count: number;
  rank?: number | null;
  topLearners: TopLearnerSummary[];
}

export interface ClassAverageMarksSummary {
  stream_averages: Record<string, StreamAverageData>;
  grade_overall_average_marks: number | null; // Sum of all assessed learner total aggregate marks in grade ÷ total assessed
  grade_total_assessed: number;
  highest_stream_name: string | null;
  is_tie: boolean;
  stream_rankings: StreamRankingSummary[];
}

export interface ClassPerformanceComparisonResult {
  className: string;
  isSingleStream: boolean;
  streams: StreamColumnInfo[];
  aggregateComparison: ClassAverageMarksSummary;
  rows: StreamVsGradeRow[];
  gradeTotalLearners: number;
  hasAnyAssessed: boolean;
  topLearnersOverall: TopLearnerSummary[];
}

/**
 * Resolves teacher name for a stream from classes and teacher records.
 * Scoped by both grade/class name and stream identity to prevent collision with streams in other grades.
 */
function resolveStreamTeacherName(
  classStreamId: string,
  streamName: string,
  targetClassName: string,
  classes: ClassStream[],
  teachers: Teacher[] = [],
  directStream?: ClassStream
): string | undefined {
  // 1. If directStream is provided and has class_teacher_id, resolve immediately
  if (directStream?.class_teacher_id) {
    const t = teachers.find((tch) => tch.id === directStream.class_teacher_id);
    if (t) return t.teacher_name || (t as any).full_name || (t as any).name;
  }

  // 2. Find exact stream record by matching stream_id first, or (class_name AND stream), or id
  const cs =
    directStream ||
    classes.find((c) => (c.stream_id && c.stream_id === classStreamId) || c.id === classStreamId) ||
    classes.find(
      (c) =>
        (c.class_name || '').toLowerCase() === targetClassName.toLowerCase() &&
        (c.stream || '').toLowerCase() === streamName.toLowerCase()
    ) ||
    classes.find(
      (c) =>
        (c.class_name || '').toLowerCase() === targetClassName.toLowerCase()
    );

  if (!cs) return undefined;

  // 3. Resolve by cs.class_teacher_id
  if (cs.class_teacher_id) {
    const t = teachers.find((tch) => tch.id === cs.class_teacher_id);
    if (t) return t.teacher_name || (t as any).full_name || (t as any).name;
  }

  // 4. Fallback to teacher allocation records referencing stream_id or class_id
  const t2 = teachers.find(
    (tch) =>
      (cs.stream_id && (tch as any).class_teacher_of_id === cs.stream_id) ||
      (tch as any).class_teacher_of_id === cs.id
  );
  if (t2) return t2.teacher_name || (t2 as any).full_name || (t2 as any).name;

  return undefined;
}

/**
 * Pure calculation engine for Class Performance Comparison.
 *
 * STRICT INVARIANTS:
 * 1. "Class Average Marks" is strictly an aggregate mark metric (sum of learner total marks ÷ assessed count).
 *    It is never converted to a percentage or confused with subject means.
 * 2. "Learning Area Mean (%)" is strictly the mean percentage for that learning area (sum of valid % ÷ assessed count).
 * 3. Grade Overall is ALWAYS calculated from the underlying learner-level data across the entire Grade,
 *    never by averaging stream averages (which would fail when stream sizes are unequal).
 * 4. Learners with 'X' (absent), 'Y' (irregularity), or blank marks are excluded from percentage means.
 * 5. Single-stream grades are handled gracefully without breaking.
 * 6. Historical examination context is preserved via getFilteredStudents / getLearnerClassAtExamTime.
 */
export function generateClassPerformanceComparison(
  examination: Examination,
  selectedClassIdOrName: string,
  students: Student[] = [],
  classes: ClassStream[] = [],
  subjects: Subject[] = [],
  marks: Mark[] = [],
  grades: Grade[] = [],
  teachers: Teacher[] = []
): ClassPerformanceComparisonResult {
  // 1. Resolve canonical Grade/Class name and object
  const foundCls = classes.find(
    (c) =>
      c.id === selectedClassIdOrName ||
      (c.class_name && c.class_name.toLowerCase() === selectedClassIdOrName.toLowerCase())
  );
  const targetClassName = foundCls ? foundCls.class_name : selectedClassIdOrName;

  // 2. Identify all learners belonging to this Grade at the time of the examination
  const gradeStudents = getFilteredStudents(
    students,
    classes,
    targetClassName,
    'all',
    examination
  );
  const gradeStudentIds = new Set(gradeStudents.map((s) => s.id));
  const gradeTotalLearners = gradeStudents.length;

  // 3. Identify all streams belonging to this Grade
  const matchingClassStreams = classes.filter(
    (c) =>
      (c.class_name || '').toLowerCase() === targetClassName.toLowerCase() ||
      c.id === foundCls?.id
  );
  const sortedStreams = sortClasses(matchingClassStreams);

  // Group uniquely by stream name to avoid duplicate columns if identical stream names exist
  const streamMap = new Map<string, StreamColumnInfo>();
  const streamLearnersMap = new Map<string, Student[]>();

  if (sortedStreams.length === 0) {
    const fallbackId = foundCls?.id || selectedClassIdOrName;
    const info: StreamColumnInfo = {
      id: fallbackId,
      name: 'Main',
      displayName: `${targetClassName} Main`,
      classId: fallbackId,
      className: targetClassName,
      learnerCount: gradeTotalLearners,
      classTeacherName: resolveStreamTeacherName(fallbackId, 'Main', targetClassName, classes, teachers, foundCls),
    };
    streamMap.set(fallbackId, info);
    streamLearnersMap.set(fallbackId, gradeStudents);
  } else {
    sortedStreams.forEach((cs) => {
      const streamName = (cs.stream || 'Main').trim();
      const streamKey = streamName.toLowerCase();

      if (!streamMap.has(streamKey)) {
        // Resolve learners who belonged to this stream at exam time
        const streamLearners = getFilteredStudents(
          gradeStudents,
          classes,
          targetClassName,
          cs.stream_id || cs.id || streamName,
          examination
        );

        const info: StreamColumnInfo = {
          id: streamKey,
          name: streamName,
          displayName: `${targetClassName} ${streamName}`,
          classId: cs.id,
          className: cs.class_name,
          learnerCount: streamLearners.length,
          classTeacherName: resolveStreamTeacherName(cs.stream_id || cs.id, streamName, targetClassName, classes, teachers, cs),
        };
        streamMap.set(streamKey, info);
        streamLearnersMap.set(streamKey, streamLearners);
      }
    });
  }

  const streams = Array.from(streamMap.values());
  const isSingleStream = streams.length <= 1;

  // 4. SECTION ONE: CLASS AVERAGE MARKS (Aggregate Total Marks)
  // Reuses authoritative calculateExamResults exactly as in CbeMeritListReport & meritListExporter
  const examResults = calculateExamResults(
    examination.id,
    gradeStudents,
    marks,
    grades,
    classes,
    subjects
  );

  // Grade Overall: sum of assessed learner total aggregate marks ÷ assessed count
  const assessedGradeResults = examResults.filter(
    (r) => r.is_complete || r.subject_count > 0
  );
  const gradeAssessedCount = assessedGradeResults.length;
  const gradeTotalMarksSum = assessedGradeResults.reduce(
    (acc, r) => acc + (r.total_marks || 0),
    0
  );
  const gradeOverallAvgMarks =
    gradeAssessedCount > 0 ? gradeTotalMarksSum / gradeAssessedCount : null;

  // Stream-level Class Average Marks & Top 3 Learners per Stream
  const streamAverages: ClassAverageMarksSummary['stream_averages'] = {};
  let highestStreamAvgMarks: number | null = null;
  let highestStreamAvgName: string | null = null;
  let isStreamAvgTie = false;

  streams.forEach((st) => {
    const stLearners = streamLearnersMap.get(st.id) || [];
    const stLearnerIds = new Set(stLearners.map((s) => s.id));

    const stResults = examResults.filter((r) => stLearnerIds.has(r.student_id));
    const assessedStResults = stResults.filter(
      (r) => r.is_complete || r.subject_count > 0
    );
    const stAssessedCount = assessedStResults.length;
    const stTotalMarksSum = assessedStResults.reduce(
      (acc, r) => acc + (r.total_marks || 0),
      0
    );
    const stAvgMarks =
      stAssessedCount > 0 ? stTotalMarksSum / stAssessedCount : null;

    // Top 3 learners in this stream
    const hasRankedStreamLearners = assessedStResults.some(
      (r) => (r.class_position || r.stream_position || r.position || 0) > 0
    );

    let eligibleStreamLearners: { result: typeof assessedStResults[0]; position: number }[] = [];

    if (hasRankedStreamLearners) {
      eligibleStreamLearners = assessedStResults
        .filter((r) => (r.class_position || r.stream_position || r.position || 0) > 0)
        .map((r) => ({
          result: r,
          position: r.class_position || r.stream_position || r.position || 0,
        }))
        .sort((a, b) => {
          if (a.position !== b.position) return a.position - b.position;
          return (b.result.total_marks || 0) - (a.result.total_marks || 0);
        });
    } else {
      // Provisional/in-progress exam where official positions are 0 but learners have assessed marks
      const unrankedAssessed = assessedStResults
        .filter((r) => (r.total_marks || 0) > 0 || r.subject_count > 0)
        .sort((a, b) => {
          const diffMarks = (b.total_marks || 0) - (a.total_marks || 0);
          if (diffMarks !== 0) return diffMarks;
          return (b.average || 0) - (a.average || 0);
        });

      applyCompetitionRanking(
        unrankedAssessed,
        (a, b) => Math.abs((a.total_marks || 0) - (b.total_marks || 0)) < 0.0001,
        (item, rank) => {
          eligibleStreamLearners.push({ result: item, position: rank });
        }
      );
    }

    const stTopLearners: TopLearnerSummary[] = eligibleStreamLearners
      .filter((e) => e.position <= 3)
      .map(({ result: r, position }) => {
        const std = stLearners.find((s) => s.id === r.student_id);
        return {
          student_id: r.student_id,
          student_name: std?.full_name || 'Unknown Learner',
          admission_number: std?.admission_number || '-',
          position,
          total_marks: r.total_marks || 0,
          average_marks: r.average || 0,
          performance_level: r.performance_level || null,
          stream_name: st.name,
        };
      });

    streamAverages[st.id] = {
      stream_name: st.name,
      average_marks: stAvgMarks,
      assessed_count: stAssessedCount,
      rank: null,
      topLearners: stTopLearners,
    };

    if (stAvgMarks !== null && !isSingleStream) {
      if (highestStreamAvgMarks === null || stAvgMarks > highestStreamAvgMarks) {
        highestStreamAvgMarks = stAvgMarks;
        highestStreamAvgName = st.name;
        isStreamAvgTie = false;
      } else if (stAvgMarks === highestStreamAvgMarks) {
        isStreamAvgTie = true;
      }
    }
  });

  // Rank streams using Class Average Marks (Standard competition ranking 1, 1, 3)
  const assessedStreamList = streams
    .filter((st) => streamAverages[st.id]?.average_marks !== null)
    .map((st) => ({
      stream_id: st.id,
      stream_name: st.name,
      class_teacher_name: st.classTeacherName || null,
      average_marks: streamAverages[st.id].average_marks,
      assessed_count: streamAverages[st.id].assessed_count,
      total_learners: st.learnerCount,
      rank: null as number | null,
      topLearners: streamAverages[st.id].topLearners,
    }))
    .sort((a, b) => (b.average_marks ?? 0) - (a.average_marks ?? 0));

  applyCompetitionRanking(
    assessedStreamList,
    (a, b) => Math.abs((a.average_marks ?? 0) - (b.average_marks ?? 0)) < 0.0001,
    (item, rank) => {
      item.rank = rank;
      if (streamAverages[item.stream_id]) {
        streamAverages[item.stream_id].rank = rank;
      }
    }
  );

  const unassessedStreamList = streams
    .filter((st) => streamAverages[st.id]?.average_marks === null)
    .map((st) => ({
      stream_id: st.id,
      stream_name: st.name,
      class_teacher_name: st.classTeacherName || null,
      average_marks: null,
      assessed_count: streamAverages[st.id]?.assessed_count || 0,
      total_learners: st.learnerCount,
      rank: null,
      topLearners: streamAverages[st.id]?.topLearners || [],
    }));

  const streamRankings: StreamRankingSummary[] = [
    ...assessedStreamList,
    ...unassessedStreamList,
  ];

  const aggregateComparison: ClassAverageMarksSummary = {
    stream_averages: streamAverages,
    grade_overall_average_marks: gradeOverallAvgMarks,
    grade_total_assessed: gradeAssessedCount,
    highest_stream_name: isStreamAvgTie ? null : highestStreamAvgName,
    is_tie: isStreamAvgTie,
    stream_rankings: streamRankings,
  };

  // Top 3 Learners Overall in the Grade
  const hasRankedGradeLearners = assessedGradeResults.some(
    (r) => (r.position || 0) > 0
  );

  let eligibleGradeList: { result: typeof assessedGradeResults[0]; position: number }[] = [];

  if (hasRankedGradeLearners) {
    eligibleGradeList = assessedGradeResults
      .filter((r) => (r.position || 0) > 0)
      .map((r) => ({
        result: r,
        position: r.position || 0,
      }))
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return (b.result.total_marks || 0) - (a.result.total_marks || 0);
      });
  } else {
    // Provisional/in-progress exam: rank assessed learners by total marks descending
    const unrankedAssessed = assessedGradeResults
      .filter((r) => (r.total_marks || 0) > 0 || r.subject_count > 0)
      .sort((a, b) => {
        const diffMarks = (b.total_marks || 0) - (a.total_marks || 0);
        if (diffMarks !== 0) return diffMarks;
        return (b.average || 0) - (a.average || 0);
      });

    applyCompetitionRanking(
      unrankedAssessed,
      (a, b) => Math.abs((a.total_marks || 0) - (b.total_marks || 0)) < 0.0001,
      (item, rank) => {
        eligibleGradeList.push({ result: item, position: rank });
      }
    );
  }

  const topLearnersOverall: TopLearnerSummary[] = eligibleGradeList
    .filter((e) => e.position <= 3)
    .map(({ result: r, position }) => {
      const std = gradeStudents.find((s) => s.id === r.student_id);
      let stName = '';
      for (const [stId, stLearners] of streamLearnersMap.entries()) {
        if (stLearners.some((sl) => sl.id === r.student_id)) {
          stName = streamMap.get(stId)?.name || '';
          break;
        }
      }
      if (!stName && std) {
        const histCtx = getLearnerClassAtExamTime(std, examination, classes);
        stName = histCtx.stream_name || '';
      }

      return {
        student_id: r.student_id,
        student_name: std?.full_name || 'Unknown Learner',
        admission_number: std?.admission_number || '-',
        position,
        total_marks: r.total_marks || 0,
        average_marks: r.average || 0,
        performance_level: r.performance_level || null,
        stream_name: stName,
      };
    });

  // 5. SECTION TWO: LEARNING AREA PERFORMANCE (Percentage Mean)
  // Curriculum-ordered subjects for this Grade
  const applicableSubjects = getApplicableSubjectsForGrade(targetClassName, subjects);
  const subjectsToProcess = applicableSubjects.length > 0 ? applicableSubjects : subjects;

  const validExamIds = new Set(
    [examination.id, (examination as any).exam_code, (examination as any).exam_name].filter(
      Boolean
    )
  );

  const rows: StreamVsGradeRow[] = [];
  let hasAnyAssessed = gradeAssessedCount > 0;

  subjectsToProcess.forEach((sb) => {
    // A. Grade Overall Mean Percentage:
    // Sum of valid % scores across all assessed learners in the Grade ÷ number of valid assessed learners
    const gradeSubjMarks = marks.filter(
      (m) =>
        validExamIds.has(m.exam_id) &&
        String(m.subject_id) === String(sb.id) &&
        gradeStudentIds.has(m.student_id)
    );

    const validGradeMarks = gradeSubjMarks
      .map((m) => evaluateMark(m))
      .filter((info) => info.status === 'Normal' && info.percentage !== null);

    const gradeSubjCount = validGradeMarks.length;
    const gradeSubjSumPct = validGradeMarks.reduce((acc, info) => acc + info.percentage!, 0);
    const gradeOverallMean = gradeSubjCount > 0 ? gradeSubjSumPct / gradeSubjCount : null;

    if (gradeSubjCount > 0) {
      hasAnyAssessed = true;
    }

    // B. Stream Mean Percentage:
    // Sum of valid % scores for that stream ÷ number of valid assessed learners in that stream
    const streamMeans: Record<string, StreamSubjectMean> = {};
    let highestSubjectPct: number | null = null;
    let highestSubjectStreamName: string | null = null;
    let isSubjTie = false;

    streams.forEach((st) => {
      const stLearners = streamLearnersMap.get(st.id) || [];
      const stLearnerIds = new Set(stLearners.map((s) => s.id));

      const stSubjMarks = marks.filter(
        (m) =>
          validExamIds.has(m.exam_id) &&
          String(m.subject_id) === String(sb.id) &&
          stLearnerIds.has(m.student_id)
      );

      const validStMarks = stSubjMarks
        .map((m) => evaluateMark(m))
        .filter((info) => info.status === 'Normal' && info.percentage !== null);

      const stCount = validStMarks.length;
      const stSumPct = validStMarks.reduce((acc, info) => acc + info.percentage!, 0);
      const stMeanPct = stCount > 0 ? stSumPct / stCount : null;

      const diff =
        stMeanPct !== null && gradeOverallMean !== null
          ? stMeanPct - gradeOverallMean
          : null;

      streamMeans[st.id] = {
        stream_id: st.id,
        stream_name: st.name,
        mean_percentage: stMeanPct,
        assessed_count: stCount,
        difference_from_grade: diff,
        stream_rank: null,
      };

      if (stMeanPct !== null && !isSingleStream) {
        if (highestSubjectPct === null || stMeanPct > highestSubjectPct) {
          highestSubjectPct = stMeanPct;
          highestSubjectStreamName = st.name;
          isSubjTie = false;
        } else if (stMeanPct === highestSubjectPct) {
          isSubjTie = true;
        }
      }
    });

    rows.push({
      subject_id: sb.id,
      subject_code: sb.subject_code,
      subject_name: sb.subject_name,
      stream_means: streamMeans,
      grade_overall_mean: gradeOverallMean,
      grade_overall_rank: null,
      total_assessed: gradeSubjCount,
      highest_stream_name: isSubjTie ? null : highestSubjectStreamName,
      is_tie: isSubjTie,
    });
  });

  // Calculate Learning Area Rankings:
  // 1. Within each stream (by mean_percentage)
  streams.forEach((st) => {
    const streamAssessedRows = rows
      .filter((r) => r.stream_means[st.id]?.mean_percentage !== null)
      .sort(
        (a, b) =>
          b.stream_means[st.id].mean_percentage! - a.stream_means[st.id].mean_percentage!
      );

    applyCompetitionRanking(
      streamAssessedRows,
      (a, b) =>
        Math.abs(
          a.stream_means[st.id].mean_percentage! -
            b.stream_means[st.id].mean_percentage!
        ) < 0.0001,
      (r, rank) => {
        r.stream_means[st.id].stream_rank = rank;
      }
    );
  });

  // 2. Across the overall Grade (by grade_overall_mean)
  const gradeAssessedRows = rows
    .filter((r) => r.grade_overall_mean !== null)
    .sort((a, b) => b.grade_overall_mean! - a.grade_overall_mean!);

  applyCompetitionRanking(
    gradeAssessedRows,
    (a, b) => Math.abs(a.grade_overall_mean! - b.grade_overall_mean!) < 0.0001,
    (r, rank) => {
      r.grade_overall_rank = rank;
    }
  );

  return {
    className: targetClassName,
    isSingleStream,
    streams,
    aggregateComparison,
    rows,
    gradeTotalLearners,
    hasAnyAssessed,
    topLearnersOverall,
  };
}
