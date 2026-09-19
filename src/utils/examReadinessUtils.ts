import {
  Examination,
  ClassStream,
  Subject,
  Student,
  Mark,
  Teacher,
  EducationLevel,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
} from '../types';
import { isClassExamApproved } from './examLockUtils';
import { evaluateMark } from './markUtils';
import { isClassInExamScope } from './filterUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';

export interface MissingSubjectInfo {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  missingCount: number;
  missingLearnerNames: string[];
}

export interface StreamReadinessDetail {
  streamObj: ClassStream;
  streamId: string;
  className: string;
  streamName: string;
  teacherName: string;
  totalLearners: number;
  enteredMarks: number;
  expectedMarks: number;
  missingMarks: number;
  percentage: number;
  isApproved: boolean;
  isReady: boolean;
  status: 'approved' | 'ready' | 'incomplete';
  missingSubjects: MissingSubjectInfo[];
}

export interface GradeReadinessDetail {
  gradeName: string;
  streams: StreamReadinessDetail[];
  totalStreams: number;
  approvedCount: number;
  readyCount: number;
  incompleteCount: number;
  isGradeApproved: boolean;
  isGradeReady: boolean;
  statusText: string;
  incompleteStreams: StreamReadinessDetail[];
}

export interface LevelReadinessDetail {
  level: EducationLevel;
  grades: Record<string, GradeReadinessDetail>;
  allStreams: StreamReadinessDetail[];
  totalStreams: number;
  approvedCount: number;
  readyCount: number;
  incompleteCount: number;
  isLevelApproved: boolean;
  isLevelReady: boolean;
  statusText: string;
  incompleteStreams: StreamReadinessDetail[];
}

export interface ExamReadinessOverview {
  levelGroups: Record<EducationLevel, LevelReadinessDetail>;
  totalStreamsCount: number;
  approvedStreamsCount: number;
  readyStreamsCount: number;
  incompleteStreamsCount: number;
  isExamApproved: boolean;
  isExamReady: boolean;
  allIncompleteStreams: StreamReadinessDetail[];
}

/**
 * Derives comprehensive, intelligent readiness details for all active streams,
 * grades, and education levels for a given examination.
 */
export function computeExamReadiness(
  exam: Examination | null | undefined,
  classes: ClassStream[],
  students: Student[],
  subjects: Subject[],
  marks: Mark[],
  teachers: Teacher[] = []
): ExamReadinessOverview {
  // 1. Identify active streams in the school
  const allActiveStreams = (classes || []).filter((c) => c.status !== 'Inactive');

  // 2. Filter active streams scoped to the examination target
  const activeStreams = allActiveStreams.filter((c) => isClassInExamScope(c, exam));

  const levelGroups: Record<EducationLevel, LevelReadinessDetail> = {
    'Pre-Primary': {
      level: 'Pre-Primary',
      grades: {},
      allStreams: [],
      totalStreams: 0,
      approvedCount: 0,
      readyCount: 0,
      incompleteCount: 0,
      isLevelApproved: false,
      isLevelReady: false,
      statusText: '',
      incompleteStreams: [],
    },
    'Lower Primary': {
      level: 'Lower Primary',
      grades: {},
      allStreams: [],
      totalStreams: 0,
      approvedCount: 0,
      readyCount: 0,
      incompleteCount: 0,
      isLevelApproved: false,
      isLevelReady: false,
      statusText: '',
      incompleteStreams: [],
    },
    'Upper Primary': {
      level: 'Upper Primary',
      grades: {},
      allStreams: [],
      totalStreams: 0,
      approvedCount: 0,
      readyCount: 0,
      incompleteCount: 0,
      isLevelApproved: false,
      isLevelReady: false,
      statusText: '',
      incompleteStreams: [],
    },
    'Junior School': {
      level: 'Junior School',
      grades: {},
      allStreams: [],
      totalStreams: 0,
      approvedCount: 0,
      readyCount: 0,
      incompleteCount: 0,
      isLevelApproved: false,
      isLevelReady: false,
      statusText: '',
      incompleteStreams: [],
    },
  };

  // Build Fast Mark Lookup Map for active Exam
  const examMarkMap = new Map<string, Mark>();
  if (exam && marks) {
    marks.forEach((m) => {
      if (m.exam_id === exam.id && m.student_id && m.subject_id) {
        examMarkMap.set(`${m.student_id}_${m.subject_id}`, m);
      }
    });
  }

  let totalStreamsCount = 0;
  let approvedStreamsCount = 0;
  let readyStreamsCount = 0;
  let incompleteStreamsCount = 0;
  const allIncompleteStreams: StreamReadinessDetail[] = [];

  activeStreams.forEach((st) => {
    const eduLevel =
      st.education_level ||
      (st.class_name ? getEducationLevelForGrade(st.class_name) : 'Junior School');
    const gradeKey = st.class_name || 'General';
    const targetLevelGroup = levelGroups[eduLevel] || levelGroups['Junior School'];

    if (!targetLevelGroup.grades[gradeKey]) {
      targetLevelGroup.grades[gradeKey] = {
        gradeName: gradeKey,
        streams: [],
        totalStreams: 0,
        approvedCount: 0,
        readyCount: 0,
        incompleteCount: 0,
        isGradeApproved: false,
        isGradeReady: false,
        statusText: '',
        incompleteStreams: [],
      };
    }

    // Resolve learners belonging to this stream (using historical resolver if exam has context)
    const streamStudents = (students || []).filter((s) => {
      if (s.active === false) return false;
      if (exam) {
        const examCtx = getLearnerClassAtExamTime(s, exam, classes);
        if (st.stream_id) {
          return examCtx.stream_id === st.stream_id;
        }
        return examCtx.class_id === st.id || examCtx.stream_id === st.id;
      }

      if (st.stream_id && (s.stream_id === st.stream_id || s.stream_id === st.id)) {
        return true;
      }
      if (s.class_id && (s.class_id === st.id || s.class_id === st.class_name)) {
        if (!st.stream_id || !s.stream_id || s.stream_id === st.stream_id) return true;
      }
      return false;
    });

    const assignedTeacher = (teachers || []).find(
      (t) => t.id === st.class_teacher_id || t.class_teacher_of_id === st.id || t.class_teacher_of_id === st.stream_id
    );

    const applicableSubjects = getApplicableSubjectsForGrade(st.class_name, subjects);
    const expectedMarks = streamStudents.length * applicableSubjects.length;

    let enteredMarks = 0;
    const missingSubjectsMap: MissingSubjectInfo[] = [];

    if (exam && streamStudents.length > 0 && applicableSubjects.length > 0) {
      applicableSubjects.forEach((sub) => {
        let subEntered = 0;
        const missingLearnerNames: string[] = [];

        streamStudents.forEach((std) => {
          const rawMark = examMarkMap.get(`${std.id}_${sub.id}`);
          const evaluated = evaluateMark(rawMark);

          if (evaluated.status === 'Normal' || evaluated.status === 'X' || evaluated.status === 'Y') {
            subEntered++;
          } else {
            missingLearnerNames.push(std.full_name || std.admission_number || 'Learner');
          }
        });

        enteredMarks += subEntered;
        const missingCount = streamStudents.length - subEntered;
        if (missingCount > 0) {
          missingSubjectsMap.push({
            subjectId: sub.id,
            subjectName: sub.subject_name || 'Subject',
            subjectCode: sub.subject_code || 'SUB',
            missingCount,
            missingLearnerNames,
          });
        }
      });
    }

    const missingMarks = Math.max(0, expectedMarks - enteredMarks);
    const percentage = expectedMarks > 0 ? Math.round((enteredMarks / expectedMarks) * 100) : 0;
    const isApproved = exam ? isClassExamApproved(exam, st) : false;
    const isReady =
      streamStudents.length > 0 &&
      applicableSubjects.length > 0 &&
      missingMarks === 0;

    let status: 'approved' | 'ready' | 'incomplete' = 'incomplete';
    if (isApproved) {
      status = 'approved';
    } else if (isReady) {
      status = 'ready';
    }

    const streamDetail: StreamReadinessDetail = {
      streamObj: st,
      streamId: st.stream_id || st.id,
      className: st.class_name || 'Class',
      streamName: st.stream || 'General',
      teacherName: assignedTeacher?.teacher_name || (assignedTeacher as any)?.name || 'Unassigned',
      totalLearners: streamStudents.length,
      enteredMarks,
      expectedMarks,
      missingMarks,
      percentage,
      isApproved,
      isReady,
      status,
      missingSubjects: missingSubjectsMap,
    };

    targetLevelGroup.grades[gradeKey].streams.push(streamDetail);
    targetLevelGroup.grades[gradeKey].totalStreams++;
    targetLevelGroup.allStreams.push(streamDetail);
    targetLevelGroup.totalStreams++;
    totalStreamsCount++;

    if (isApproved) {
      targetLevelGroup.grades[gradeKey].approvedCount++;
      targetLevelGroup.approvedCount++;
      approvedStreamsCount++;
    } else if (isReady) {
      targetLevelGroup.grades[gradeKey].readyCount++;
      targetLevelGroup.readyCount++;
      readyStreamsCount++;
    } else {
      targetLevelGroup.grades[gradeKey].incompleteCount++;
      targetLevelGroup.incompleteCount++;
      targetLevelGroup.incompleteStreams.push(streamDetail);
      targetLevelGroup.grades[gradeKey].incompleteStreams.push(streamDetail);
      allIncompleteStreams.push(streamDetail);
      incompleteStreamsCount++;
    }
  });

  // Calculate Roll-up Metrics for Grades and Levels
  Object.values(levelGroups).forEach((lvlGrp) => {
    Object.values(lvlGrp.grades).forEach((grd) => {
      grd.isGradeApproved = grd.totalStreams > 0 && grd.approvedCount === grd.totalStreams;
      grd.isGradeReady = grd.totalStreams > 0 && grd.approvedCount + grd.readyCount === grd.totalStreams;

      if (grd.isGradeApproved) {
        grd.statusText = `${grd.approvedCount}/${grd.totalStreams} Approved & Locked`;
      } else if (grd.incompleteCount === 0 && grd.totalStreams > 0) {
        grd.statusText = `All ${grd.totalStreams} streams ready for approval`;
      } else if (grd.totalStreams === 0) {
        grd.statusText = 'No streams in scope';
      } else {
        grd.statusText = `${grd.approvedCount} approved / ${grd.readyCount} ready / ${grd.incompleteCount} incomplete`;
      }
    });

    lvlGrp.isLevelApproved = lvlGrp.totalStreams > 0 && lvlGrp.approvedCount === lvlGrp.totalStreams;
    lvlGrp.isLevelReady = lvlGrp.totalStreams > 0 && lvlGrp.approvedCount + lvlGrp.readyCount === lvlGrp.totalStreams;

    if (lvlGrp.isLevelApproved) {
      lvlGrp.statusText = `Level Fully Approved (${lvlGrp.approvedCount}/${lvlGrp.totalStreams})`;
    } else if (lvlGrp.incompleteCount === 0 && lvlGrp.totalStreams > 0) {
      lvlGrp.statusText = `Level Ready for Approval (${lvlGrp.totalStreams}/${lvlGrp.totalStreams} Ready)`;
    } else if (lvlGrp.totalStreams === 0) {
      lvlGrp.statusText = 'No streams in scope';
    } else {
      lvlGrp.statusText = `${lvlGrp.approvedCount} approved / ${lvlGrp.readyCount} ready / ${lvlGrp.incompleteCount} incomplete`;
    }
  });

  const isExamApproved = totalStreamsCount > 0 && approvedStreamsCount === totalStreamsCount;
  const isExamReady = totalStreamsCount > 0 && approvedStreamsCount + readyStreamsCount === totalStreamsCount;

  return {
    levelGroups,
    totalStreamsCount,
    approvedStreamsCount,
    readyStreamsCount,
    incompleteStreamsCount,
    isExamApproved,
    isExamReady,
    allIncompleteStreams,
  };
}
