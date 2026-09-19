import './setupLocalStorage';
import { describe, it, expect } from 'vitest';
import {
  isJuniorSchoolEducationLevel,
  calculateTerminalTotalMarks,
  evaluateLearnerRankingEligibility,
  calculateCohortTerminalRankings,
  calculateSingleLearnerRanking,
  LearnerCohortEntry,
} from '../services/terminalRankingEngine';
import { LearningAreaTerminalResult } from '../services/terminalResultsEngine';
import { Student, Subject, ClassStream } from '../types';

describe('Terminal Ranking Engine - Junior School Authoritative Rules', () => {
  const subjects: Subject[] = Array.from({ length: 9 }, (_, i) => ({
    id: `subj_${i + 1}`,
    subject_code: `JS0${i + 1}`,
    subject_name: `Learning Area ${i + 1}`,
    category: 'Core',
    education_level: 'Junior School',
    applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'],
    status: 'Active',
  }));

  const class8A: ClassStream = {
    id: 'cls_8a',
    class_name: 'Grade 8',
    stream: 'East',
    education_level: 'Junior School',
  };

  const class8B: ClassStream = {
    id: 'cls_8b',
    class_name: 'Grade 8',
    stream: 'West',
    education_level: 'Junior School',
  };

  const createCompleteResult = (score: number, subjId: string = 'subj_1'): LearningAreaTerminalResult => ({
    subjectId: subjId,
    isComplete: true,
    status: 'Complete',
    terminalPercentage: score,
    unroundedTerminalPercentage: score,
    cbePerformanceLevel: 'EE1',
    points: 8,
    assessmentTrail: [
      {
        examId: 'a1',
        examName: 'CAT 1',
        status: 'Normal',
        rawScore: score,
        outOf: 100,
        percentage: score,
        displayScore: `${score}/100`,
        displayPercentage: `${score}%`,
      },
    ],
  });

  const createIncompleteResult = (subjId: string = 'subj_9'): LearningAreaTerminalResult => ({
    subjectId: subjId,
    isComplete: false,
    status: 'INCOMPLETE (X)',
    terminalPercentage: null,
    unroundedTerminalPercentage: null,
    cbePerformanceLevel: null,
    points: null,
    assessmentTrail: [
      {
        examId: 'a1',
        examName: 'CAT 1',
        status: 'X',
        rawScore: null,
        outOf: 100,
        percentage: null,
        displayScore: 'X',
        displayPercentage: 'X',
      },
    ],
  });

  it('1. Authoritatively identifies Junior School vs non-Junior School', () => {
    expect(isJuniorSchoolEducationLevel('Junior School')).toBe(true);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' } as ClassStream)).toBe(true);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' } as ClassStream)).toBe(true);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 9', stream: 'East', education_level: 'Junior School' } as ClassStream)).toBe(true);

    expect(isJuniorSchoolEducationLevel('Upper Primary')).toBe(false);
    expect(isJuniorSchoolEducationLevel('Lower Primary')).toBe(false);
    expect(isJuniorSchoolEducationLevel('Pre-Primary')).toBe(false);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 6', stream: 'East', education_level: 'Upper Primary' } as ClassStream)).toBe(false);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 5', stream: 'East', education_level: 'Upper Primary' } as ClassStream)).toBe(false);

    // Strict authority: missing/undefined education level must NOT infer Junior School from Grade 7/8/9
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 7', stream: 'East' } as ClassStream)).toBe(false);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 8', stream: 'East' } as ClassStream)).toBe(false);
    expect(isJuniorSchoolEducationLevel(undefined, { class_name: 'Grade 9', stream: 'East' } as ClassStream)).toBe(false);
  });

  it('2. Correctly calculates Terminal Total Marks as the sum of whole-number percentages', () => {
    const resultsMap = new Map<string, LearningAreaTerminalResult>();
    // 9 subjects with scores 70, 75, 80, 85, 90, 65, 60, 55, 50 -> sum = 630
    const scores = [70, 75, 80, 85, 90, 65, 60, 55, 50];
    subjects.forEach((s, idx) => {
      resultsMap.set(s.id, createCompleteResult(scores[idx], s.id));
    });

    const total = calculateTerminalTotalMarks(resultsMap, subjects);
    expect(total.totalMarks).toBe(630);
    expect(total.maxMarks).toBe(900);
    expect(total.isComplete).toBe(true);
  });

  it('3. Requires 100% complete learning areas for ranking eligibility', () => {
    const resultsMap = new Map<string, LearningAreaTerminalResult>();
    subjects.slice(0, 8).forEach((s) => {
      resultsMap.set(s.id, createCompleteResult(80, s.id));
    });
    // 9th subject is incomplete (missing mark)
    resultsMap.set(subjects[8].id, createIncompleteResult(subjects[8].id));

    const { isEligible, incompleteCount } = evaluateLearnerRankingEligibility({
      classStream: class8A,
      resultsBySubject: resultsMap,
      applicableSubjects: subjects,
    });
    expect(isEligible).toBe(false);
    expect(incompleteCount).toBe(1);
  });

  it('4. Ranks cohort with standard competition ranking (1, 2, 2, 4) and isolates stream vs overall positions', () => {
    const student1: Student = { id: 's1', admission_number: 'ADM-01', gender: 'M', full_name: 'Learner 1', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const student2: Student = { id: 's2', admission_number: 'ADM-02', gender: 'F', full_name: 'Learner 2', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const student3: Student = { id: 's3', admission_number: 'ADM-03', gender: 'M', full_name: 'Learner 3', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const student4: Student = { id: 's4', admission_number: 'ADM-04', gender: 'F', full_name: 'Learner 4', grade: 'Grade 8', stream_id: 'cls_8b', class_id: 'cls_8b', active: true }; // Stream B
    const student5: Student = { id: 's5', admission_number: 'ADM-05', gender: 'M', full_name: 'Learner 5', grade: 'Grade 8', stream_id: 'cls_8b', class_id: 'cls_8b', active: true }; // Stream B

    // Scores per learner (sum of 9 subjects):
    // s1: 9 * 80 = 720 (Stream A) -> Overall 1st, Stream A 1st
    // s2: 9 * 70 = 630 (Stream A) -> Overall 2nd (tied), Stream A 2nd (tied)
    // s4: 9 * 70 = 630 (Stream B) -> Overall 2nd (tied), Stream B 1st
    // s3: 9 * 60 = 540 (Stream A) -> Overall 4th, Stream A 4th (tied skip)
    // s5: incomplete (Stream B) -> Unranked

    const buildResults = (score: number | null) => {
      const map = new Map<string, LearningAreaTerminalResult>();
      subjects.forEach((s, idx) => {
        if (score === null && idx === 8) {
          map.set(s.id, createIncompleteResult(s.id));
        } else {
          map.set(s.id, createCompleteResult(score ?? 70, s.id));
        }
      });
      return map;
    };

    const cohort: LearnerCohortEntry[] = [
      { student: student1, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(80) },
      { student: student2, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(70) },
      { student: student3, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(60) },
      { student: student4, classStream: class8B, applicableSubjects: subjects, resultsBySubject: buildResults(70) },
      { student: student5, classStream: class8B, applicableSubjects: subjects, resultsBySubject: buildResults(null) },
    ];

    const rankingMap = calculateCohortTerminalRankings({ learners: cohort });

    const r1 = rankingMap.get('s1')!;
    const r2 = rankingMap.get('s2')!;
    const r3 = rankingMap.get('s3')!;
    const r4 = rankingMap.get('s4')!;
    const r5 = rankingMap.get('s5')!;

    // Learner 1
    expect(r1.isRankable).toBe(true);
    expect(r1.terminalTotalMarks).toBe(720);
    expect(r1.overallPosition).toBe(1);
    expect(r1.overallPositionDenominator).toBe(4); // 4 rankable in grade cohort
    expect(r1.streamPosition).toBe(1);
    expect(r1.streamPositionDenominator).toBe(3); // 3 rankable in Stream A

    // Learner 2 (tied with s4 at 630)
    expect(r2.isRankable).toBe(true);
    expect(r2.terminalTotalMarks).toBe(630);
    expect(r2.overallPosition).toBe(2);
    expect(r2.overallPositionDenominator).toBe(4);
    expect(r2.streamPosition).toBe(2);
    expect(r2.streamPositionDenominator).toBe(3);

    // Learner 4 (Stream B, tied with s2 at 630)
    expect(r4.isRankable).toBe(true);
    expect(r4.terminalTotalMarks).toBe(630);
    expect(r4.overallPosition).toBe(2);
    expect(r4.overallPositionDenominator).toBe(4);
    expect(r4.streamPosition).toBe(1); // 1st in Stream B!
    expect(r4.streamPositionDenominator).toBe(1); // Only 1 rankable in Stream B!

    // Learner 3 (competition rank skips 3 -> becomes 4th overall)
    expect(r3.isRankable).toBe(true);
    expect(r3.terminalTotalMarks).toBe(540);
    expect(r3.overallPosition).toBe(4);
    expect(r3.overallPositionDenominator).toBe(4);
    expect(r3.streamPosition).toBe(3);
    expect(r3.streamPositionDenominator).toBe(3);

    // Learner 5 (incomplete)
    expect(r5.isRankable).toBe(false);
    expect(r5.terminalTotalMarks).toBeNull();
    expect(r5.overallPosition).toBeNull();
    expect(r5.overallPositionDenominator).toBeNull();
    expect(r5.streamPosition).toBeNull();
    expect(r5.streamPositionDenominator).toBeNull();
  });

  it('5. Single learner ranking evaluates non-Junior-School as non-rankable', () => {
    const upperPrimaryClass: ClassStream = {
      id: 'cls_6',
      class_name: 'Grade 6',
      stream: 'Red',
      education_level: 'Upper Primary',
    };
    const primaryStudent: Student = {
      id: 'sp1',
      admission_number: 'ADM-P01',
      gender: 'M',
      full_name: 'Primary Student',
      grade: 'Grade 6',
      class_id: 'cls_6',
      active: true,
    };
    const map = new Map<string, LearningAreaTerminalResult>();
    subjects.forEach((s) => map.set(s.id, createCompleteResult(85, s.id)));

    const ranking = calculateSingleLearnerRanking({
      student: primaryStudent,
      classStream: upperPrimaryClass,
      resultsBySubject: map,
      applicableSubjects: subjects,
    });

    expect(ranking.isJuniorSchool).toBe(false);
    expect(ranking.isRankable).toBe(false);
    expect(ranking.terminalTotalMarks).toBeNull();
    expect(ranking.streamPosition).toBeNull();
    expect(ranking.overallPosition).toBeNull();
  });

  it('6. Explicitly verifies eligible-only denominator in cohort with 5 candidates and 4 rankable', () => {
    const sA: Student = { id: 'sa', admission_number: 'ADM-A', gender: 'M', full_name: 'A', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const sB: Student = { id: 'sb', admission_number: 'ADM-B', gender: 'F', full_name: 'B', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const sC: Student = { id: 'sc', admission_number: 'ADM-C', gender: 'M', full_name: 'C', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const sD: Student = { id: 'sd', admission_number: 'ADM-D', gender: 'F', full_name: 'D', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };
    const sE: Student = { id: 'se', admission_number: 'ADM-E', gender: 'M', full_name: 'E', grade: 'Grade 8', stream_id: 'cls_8a', class_id: 'cls_8a', active: true };

    const buildResults = (score: number | null) => {
      const map = new Map<string, LearningAreaTerminalResult>();
      subjects.forEach((s, idx) => {
        if (score === null && idx === 8) {
          map.set(s.id, createIncompleteResult(s.id));
        } else {
          map.set(s.id, createCompleteResult(score ?? 70, s.id));
        }
      });
      return map;
    };

    const cohort: LearnerCohortEntry[] = [
      { student: sA, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(90) },
      { student: sB, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(80) },
      { student: sC, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(70) },
      { student: sD, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(60) },
      { student: sE, classStream: class8A, applicableSubjects: subjects, resultsBySubject: buildResults(null) }, // incomplete
    ];

    const rankingMap = calculateCohortTerminalRankings({ learners: cohort });

    expect(rankingMap.get('sa')?.streamPosition).toBe(1);
    expect(rankingMap.get('sa')?.streamPositionDenominator).toBe(4);
    expect(rankingMap.get('sa')?.overallPosition).toBe(1);
    expect(rankingMap.get('sa')?.overallPositionDenominator).toBe(4);

    expect(rankingMap.get('sb')?.streamPosition).toBe(2);
    expect(rankingMap.get('sb')?.streamPositionDenominator).toBe(4);
    expect(rankingMap.get('sb')?.overallPosition).toBe(2);
    expect(rankingMap.get('sb')?.overallPositionDenominator).toBe(4);

    expect(rankingMap.get('sc')?.streamPosition).toBe(3);
    expect(rankingMap.get('sc')?.streamPositionDenominator).toBe(4);
    expect(rankingMap.get('sc')?.overallPosition).toBe(3);
    expect(rankingMap.get('sc')?.overallPositionDenominator).toBe(4);

    expect(rankingMap.get('sd')?.streamPosition).toBe(4);
    expect(rankingMap.get('sd')?.streamPositionDenominator).toBe(4);
    expect(rankingMap.get('sd')?.overallPosition).toBe(4);
    expect(rankingMap.get('sd')?.overallPositionDenominator).toBe(4);

    expect(rankingMap.get('se')?.isRankable).toBe(false);
    expect(rankingMap.get('se')?.streamPosition).toBeNull();
    expect(rankingMap.get('se')?.streamPositionDenominator).toBeNull();
    expect(rankingMap.get('se')?.overallPosition).toBeNull();
    expect(rankingMap.get('se')?.overallPositionDenominator).toBeNull();
  });

  it('7. Rejects grade-only inference when education_level is undefined or Upper Primary', () => {
    // 1. education_level undefined with Grade 9
    const undefinedLevelClass: ClassStream = {
      id: 'cls_unknown',
      class_name: 'Grade 9',
      stream: 'North',
    };
    const studentWithGrade9: Student = {
      id: 'stu_g9',
      admission_number: 'ADM-999',
      gender: 'M',
      full_name: 'Grade 9 Learner',
      grade: 'Grade 9',
      class_id: 'cls_unknown',
      active: true,
    };

    expect(isJuniorSchoolEducationLevel(undefined, undefinedLevelClass, studentWithGrade9)).toBe(false);

    // 2. education_level explicitly Upper Primary with Grade 9
    const upperPrimaryClassG9: ClassStream = {
      id: 'cls_up_g9',
      class_name: 'Grade 9',
      stream: 'North',
      education_level: 'Upper Primary',
    };
    expect(isJuniorSchoolEducationLevel(undefined, upperPrimaryClassG9, studentWithGrade9)).toBe(false);

    // 3. education_level explicitly Junior School with Grade 9
    const juniorSchoolClassG9: ClassStream = {
      id: 'cls_js_g9',
      class_name: 'Grade 9',
      stream: 'North',
      education_level: 'Junior School',
    };
    expect(isJuniorSchoolEducationLevel(undefined, juniorSchoolClassG9, studentWithGrade9)).toBe(true);
  });

  it('8. Properly isolates streams when streams share the same parent class ID (e.g. Grade 9 with 2 streams of 38 and 37 learners)', () => {
    // Both streams have the same parent class id 'cls_grade9' from Supabase classes table
    const stream1: ClassStream = {
      id: 'cls_grade9',
      stream_id: 'stream_g9_1',
      class_name: 'Grade 9',
      stream: 'Stream 1',
      education_level: 'Junior School',
    };

    const stream2: ClassStream = {
      id: 'cls_grade9',
      stream_id: 'stream_g9_2',
      class_name: 'Grade 9',
      stream: 'Stream 2',
      education_level: 'Junior School',
    };

    const buildResults = (score: number) => {
      const map = new Map<string, LearningAreaTerminalResult>();
      subjects.forEach((s) => map.set(s.id, createCompleteResult(score, s.id)));
      return map;
    };

    const cohort: LearnerCohortEntry[] = [];

    // 38 learners in Stream 1 (scores from 95 down to 58)
    for (let i = 1; i <= 38; i++) {
      cohort.push({
        student: {
          id: `s1_${i}`,
          admission_number: `ADM-1-${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          full_name: `Stream1 Learner ${i}`,
          grade: 'Grade 9',
          class_id: 'cls_grade9',
          stream_id: 'stream_g9_1',
          active: true,
        },
        classStream: stream1,
        applicableSubjects: subjects,
        resultsBySubject: buildResults(95 - i), // Higher score = better rank
      });
    }

    // 37 learners in Stream 2 (scores from 95 down to 59)
    for (let i = 1; i <= 37; i++) {
      cohort.push({
        student: {
          id: `s2_${i}`,
          admission_number: `ADM-2-${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          full_name: `Stream2 Learner ${i}`,
          grade: 'Grade 9',
          class_id: 'cls_grade9',
          stream_id: 'stream_g9_2',
          active: true,
        },
        classStream: stream2,
        applicableSubjects: subjects,
        resultsBySubject: buildResults(95 - i),
      });
    }

    const rankingMap = calculateCohortTerminalRankings({ learners: cohort });

    // 6th learner in Stream 1 (score 89)
    const s1_6 = rankingMap.get('s1_6')!;
    expect(s1_6.isRankable).toBe(true);
    expect(s1_6.streamPosition).toBe(6);
    expect(s1_6.streamPositionDenominator).toBe(38); // Exactly 38 in Stream 1
    expect(s1_6.overallPositionDenominator).toBe(75); // Total 75 in Grade 9
    // Tied with s2_6 (both score 89), ranks 11th overall (after 5 pairs = 10 learners ahead)
    expect(s1_6.overallPosition).toBe(11);

    // 6th learner in Stream 2 (score 89)
    const s2_6 = rankingMap.get('s2_6')!;
    expect(s2_6.isRankable).toBe(true);
    expect(s2_6.streamPosition).toBe(6);
    expect(s2_6.streamPositionDenominator).toBe(37); // Exactly 37 in Stream 2
    expect(s2_6.overallPositionDenominator).toBe(75); // Total 75 in Grade 9
    expect(s2_6.overallPosition).toBe(11);
  });
});
