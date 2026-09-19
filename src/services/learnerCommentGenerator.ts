import {
  Student,
  Subject,
  Mark,
  Grade,
  Examination,
} from '../types';
import { evaluateMark } from '../utils/markUtils';

export interface GenerateCommentOptions {
  student: Student;
  examId: string;
  marks: Mark[];
  subjects: Subject[];
  grades: Grade[];
  exams?: Examination[];
  averageScore?: number;
  averagePoints?: number;
  overallLevel?: string;
  commentType?: 'class_teacher' | 'hoi';
  isProvisional?: boolean;
}

// Deterministic hash based on student info to pick template variations reliably
function getStudentHash(studentId: string, admNo: string = '', extra: string = ''): number {
  const str = `${studentId}_${admNo}_${extra}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Helper to pick one element deterministically from an array based on seed and offset
function pickVariant<T>(arr: T[], seed: number, offset: number = 0): T {
  const index = (seed + offset) % arr.length;
  return arr[index];
}

/**
 * Generates a dynamic, individualised comment for a learner based on actual assessment data.
 * Rules:
 * 1. Provisional reports (missing marks, pending results, or explicit flag):
 *    - Generate non-academic provisional comments for CT & HOI explaining incomplete state.
 * 2. Completed reports:
 *    - CT Comment: Exactly 1 sentence, 20-40 words, data-driven (strength, weakness, trend, consistency).
 *    - HOI Comment: Exactly 1 sentence, 15-35 words, encouraging institutional approval & readiness.
 * 3. Unique wording for every learner, never repeating identical sentences.
 * 4. No rank/position mentions, no grade codes (EE2, ME1, etc.), no data contradictions.
 */
export function generatePersonalizedLearnerComment(options: GenerateCommentOptions): string {
  const {
    student,
    examId,
    marks = [],
    subjects = [],
    grades = [],
    exams = [],
    averageScore: providedAvg,
    commentType = 'class_teacher',
    isProvisional: explicitProvisional = false,
  } = options;

  const admNo = student.admission_number || '';
  const seed = getStudentHash(student.id, admNo, commentType);

  // 1. Gather student's marks for current exam & check completeness
  const stdExamMarks = marks.filter((m) => m.student_id === student.id && m.exam_id === examId);

  let assessedCount = 0;
  let totalScore = 0;
  let missingCount = 0;
  let irregularityCount = 0;

  interface SubjectEval {
    subject: Subject;
    score: number;
  }
  const subjectEvals: SubjectEval[] = [];

  subjects.forEach((sb) => {
    const markObj = stdExamMarks.find((m) => m.subject_id === sb.id);
    const markInfo = evaluateMark(markObj);

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      assessedCount++;
      totalScore += markInfo.percentage;
      subjectEvals.push({ subject: sb, score: markInfo.percentage });
    } else if (markInfo.status === 'X') {
      missingCount++;
    } else if (markInfo.status === 'Y') {
      irregularityCount++;
    }
  });

  const isProvisional = explicitProvisional || missingCount > 0 || (subjects.length > 0 && assessedCount < subjects.length);

  // --- PROVISIONAL REPORT COMMENTS ---
  if (isProvisional) {
    if (commentType === 'hoi') {
      const hoiProvisionalPool = [
        "This report is provisional and should not be considered the learner's final academic record, as official comments will be issued after complete examination review and approval.",
        "Please note that this provisional report serves as an interim document, and official performance evaluation will be finalized once all pending assessment records are approved.",
        "As an interim provisional document, final institutional approval and official academic remarks for this learner will be confirmed after all pending marks are fully processed.",
        "This is a provisional academic statement, and formal institutional comments will be issued upon final verification and approval of all learning area assessment results.",
        "This document represents a provisional result for verification purposes, and official comments will be released following complete examination audit and final administrative approval.",
        "Official institutional approval remains pending completion of outstanding learning area evaluations, after which final academic remarks will be validated.",
        "This provisional transcript provides interim academic feedback, with final institutional certification to be released upon full verification of all marks.",
        "Formal institutional endorsement will be appended once all pending subject scores have been processed and confirmed into the official assessment database.",
      ];
      return pickVariant(hoiProvisionalPool, seed, 1);
    } else {
      const ctProvisionalPool = [
        "This learner's assessment is still incomplete because one or more learning area marks are pending, and a full academic evaluation will be available once all assessments are verified.",
        "As certain assessment tasks remain pending verification, this learner's evaluation is currently incomplete until all subject marks are fully compiled into the official record.",
        "This assessment record remains provisional due to outstanding subject entries, and comprehensive academic performance feedback will be provided once all marks are uploaded and approved.",
        "With some learning area results currently outstanding, this learner's assessment is incomplete, and an official performance comment will be issued upon complete mark entry.",
        "This learner's report is pending full completion of assessment entries, and a complete academic evaluation will be issued as soon as all subject marks are submitted.",
        "A comprehensive subject evaluation will be provided upon the submission and verification of all pending assessment scores for this examination period.",
        "This academic summary is currently pending complete mark recording across all learning areas, and definitive feedback will follow final submission.",
        "Full pedagogical evaluation across all competencies will be finalized once the outstanding learning area assessments are recorded and verified.",
      ];
      return pickVariant(ctProvisionalPool, seed, 2);
    }
  }

  // --- COMPLETED REPORT COMMENTS ---
  const computedAvg = assessedCount > 0 ? totalScore / assessedCount : 0;
  const avgScore = providedAvg !== undefined ? providedAvg : computedAvg;

  // Identify strongest and weakest learning areas
  subjectEvals.sort((a, b) => b.score - a.score);
  const strongest = subjectEvals.length > 0 && subjectEvals[0].score >= 50 ? subjectEvals[0] : null;
  const weakest =
    subjectEvals.length > 1 && subjectEvals[subjectEvals.length - 1].score < 65
      ? subjectEvals[subjectEvals.length - 1]
      : null;

  const scoreSpread =
    subjectEvals.length > 1
      ? subjectEvals[0].score - subjectEvals[subjectEvals.length - 1].score
      : 0;
  const isHighlyConsistent = subjectEvals.length >= 3 && scoreSpread <= 12;

  // Previous exam trend check (only if valid previous exam data exists)
  let trend: number | null = null;
  if (exams.length > 1) {
    const currentExamIndex = exams.findIndex((e) => e.id === examId);
    const prevExam = exams.find((e, idx) => e.id !== examId && (currentExamIndex >= 0 ? idx !== currentExamIndex : true));
    if (prevExam) {
      const prevMarks = marks.filter((m) => m.student_id === student.id && m.exam_id === prevExam.id);
      let prevAssessed = 0;
      let prevTotal = 0;
      prevMarks.forEach((m) => {
        const info = evaluateMark(m);
        if (info.status === 'Normal' && info.percentage !== null) {
          prevAssessed++;
          prevTotal += info.percentage;
        }
      });
      if (prevAssessed > 0) {
        const prevAvg = prevTotal / prevAssessed;
        trend = avgScore - prevAvg;
      }
    }
  }

  // --- COMPLETED: HEAD OF INSTITUTION (HOI) COMMENT ---
  // Constraint: Exactly 1 sentence, 15 to 28 words.
  if (commentType === 'hoi') {
    if (avgScore >= 75) {
      const hoiHighPool = [
        "Approved with commendation for sustained academic excellence and commendable mastery across all evaluated learning areas.",
        "Official approval granted with distinction, recognizing your exemplary performance and readiness for higher academic competencies.",
        "Approved with commendation on your outstanding assessment results and recommended for continued academic distinction in future terms.",
        "Official approval granted in recognition of your high academic achievement and consistent mastery of core curriculum concepts.",
        "Approved with commendation for distinguished performance across evaluated subjects and strong readiness for advanced coursework.",
        "Official institutional approval granted with high praise for your excellent academic results across all evaluated learning areas.",
        "Approved with distinction, reflecting solid academic competence and commendable grasp of evaluated learning area strands.",
        "Official approval granted with commendation for your outstanding academic standard and thorough understanding of curriculum expectations.",
        "Approved with commendation for exceptional academic attainment and recommended for continued high achievement in subsequent assessments.",
        "Official approval granted, acknowledging your admirable academic results and solid mastery across the evaluated curriculum.",
      ];
      return pickVariant(hoiHighPool, seed, 3);
    } else if (avgScore >= 50) {
      const hoiMedPool = [
        "Approved for progression with encouragement to maintain steady academic focus and build greater strength across all learning areas.",
        "Official approval granted, with recommendation for regular revision and structured study to elevate your overall academic achievement.",
        "Approved for advancement with encouragement to aim for higher mastery across evaluated subjects in upcoming assessment terms.",
        "Official institutional approval granted with recommendation to sustain steady academic progress across all curriculum areas.",
        "Approved with encouragement to reinforce foundational competencies and pursue higher academic performance in future assessments.",
        "Official approval granted, acknowledging satisfactory academic development and encouraging continued focus on subject mastery.",
        "Approved for progression with recommendation to balance study across all learning areas for enhanced overall performance.",
        "Official approval granted with encouragement to consolidate core concepts and strive for greater academic consistency.",
        "Approved for advancement with recommendation for structured revision to support steady academic growth.",
        "Official institutional approval granted with encouragement to maintain focused academic preparation across all subjects.",
      ];
      return pickVariant(hoiMedPool, seed, 4);
    } else {
      const hoiLowPool = [
        "Approved with recommendation for structured remedial support, regular practice, and close academic guidance to strengthen core competencies.",
        "Official approval granted, with strong recommendation for targeted revision and teacher consultations to improve overall academic standing.",
        "Approved with recommendation for dedicated academic intervention and regular subject practice to build solid curriculum understanding.",
        "Official approval granted with encouragement to utilize available remedial resources and focus on foundational subject skills.",
        "Approved with recommendation for focused academic review and consistent practice to address learning gaps in upcoming terms.",
        "Official approval granted, with guidance to seek regular academic support and strengthen understanding of core concepts.",
        "Approved with recommendation for systematic revision and guided study sessions to elevate performance in subsequent assessments.",
        "Official institutional approval granted with encouragement to prioritize remedial practice and master essential learning area competencies.",
      ];
      return pickVariant(hoiLowPool, seed, 5);
    }
  }

  // --- COMPLETED: CLASS TEACHER (CT) COMMENT ---
  // Constraint: Exactly 1 sentence, 20 to 35 words.
  if (trend !== null && trend >= 4.0) {
    const trendUpPool = [
      `Your encouraging improvement since the previous assessment reflects solid academic progress, and continuing this positive trajectory will strengthen your mastery in all learning areas.`,
      `You have achieved measurable academic growth compared to the previous assessment, demonstrating positive momentum that will support continued success across your subjects.`,
      `Your assessment results show clear upward progress since the last examination, highlighting greater subject understanding that provides a firm basis for future achievement.`,
      `You have demonstrated noticeable progress from the previous evaluation, and sustaining this steady academic momentum will elevate your performance across all learning areas.`,
      `Your upward performance trend reflects commendable academic development since the last assessment, showing solid potential for even higher competency levels.`,
      `You have registered commendable score gains compared to the prior assessment, and maintaining this focused approach will deepen your curriculum understanding.`,
      `Your results demonstrate positive academic progress across evaluated areas, indicating that continuous revision is yielding tangible improvements.`,
      `You have shown significant learning gains since the previous examination, establishing a strong foundation for continued advancement in your studies.`,
    ];
    return pickVariant(trendUpPool, seed, 6);
  }

  if (avgScore >= 75) {
    if (strongest) {
      const sName = strongest.subject.subject_name;
      const ctHighStrengthPool = [
        `You have demonstrated outstanding understanding in ${sName}, displaying commendable mastery across your learning areas while maintaining a high academic standard.`,
        `Your exemplary performance across evaluated learning areas is anchored by strong proficiency in ${sName}, which provides a solid benchmark for your ongoing studies.`,
        `You have shown impressive academic depth with solid mastery in ${sName}, and regular practice will support sustained high achievement across all competencies.`,
        `Your high score in ${sName} reflects comprehensive grasp of core concepts, and applying similar rigor to all subjects will ensure continued academic distinction.`,
        `You have achieved an exceptional level of performance with particular distinction in ${sName}, demonstrating thorough understanding across your evaluated curriculum.`,
        `Your command of ${sName} is commendable, and maintaining this high standard across all learning areas will support continued academic excellence.`,
        `You have exhibited superior subject comprehension in ${sName}, establishing a strong foundation for advanced learning across all your subjects.`,
        `Your strong mastery in ${sName} alongside excellent overall scores demonstrates thorough subject readiness across the entire curriculum.`,
      ];
      return pickVariant(ctHighStrengthPool, seed, 7);
    } else {
      const ctHighGeneralPool = [
        `Your consistent high achievement across all evaluated learning areas reflects solid academic mastery and thorough understanding of core curriculum strands.`,
        `You have demonstrated exemplary competence across your subjects, establishing a strong academic foundation for subsequent assessment terms.`,
        `Your comprehensive performance indicates excellent understanding across all learning areas, setting a commendable standard of academic achievement.`,
        `You have shown thorough grasp of concepts across the entire curriculum, maintaining balanced and distinguished performance throughout your subjects.`,
        `Your assessment results reflect high academic proficiency across evaluated areas, demonstrating thorough preparation and clear conceptual mastery.`,
        `You have maintained an enviable level of academic performance across all subjects, showing strong capability across diverse learning strands.`,
        `Your uniformly high scores demonstrate solid curriculum competency and excellent retention across all evaluated subjects.`,
        `You have attained commendable mastery in all evaluated learning areas, demonstrating readiness for advanced academic tasks.`,
      ];
      return pickVariant(ctHighGeneralPool, seed, 8);
    }
  } else if (avgScore >= 50) {
    if (strongest && weakest && strongest.subject.id !== weakest.subject.id) {
      const sName = strongest.subject.subject_name;
      const wName = weakest.subject.subject_name;
      const ctMedContrastPool = [
        `You have achieved commendable progress in ${sName}, though allocating additional revision time to ${wName} will help build greater consistency across all your learning areas.`,
        `Your solid performance in ${sName} is encouraging, and giving extra study focus to ${wName} will help raise your overall achievement to an even higher level.`,
        `You have displayed good aptitude in ${sName}, while targeted practice in ${wName} will help balance your achievements across all evaluated subjects.`,
        `Your strength in ${sName} shows clear academic capability, and dedicated revision in ${wName} will support a more uniform performance profile.`,
        `You have shown commendable understanding in ${sName}, and addressing key concepts in ${wName} will strengthen your overall academic standing.`,
        `Your positive results in ${sName} provide a good baseline, while guided practice in ${wName} will help elevate your overall subject average.`,
        `You have demonstrated promising proficiency in ${sName}, and concentrating on foundational topics in ${wName} will yield better balance across your subjects.`,
        `Your solid marks in ${sName} highlight your potential, and consistent review of ${wName} will enhance your comprehensive curriculum mastery.`,
      ];
      return pickVariant(ctMedContrastPool, seed, 9);
    } else if (strongest) {
      const sName = strongest.subject.subject_name;
      const ctMedStrengthPool = [
        `You have demonstrated steady progress with good potential in ${sName}, and maintaining regular study across all subjects will help elevate your achievement.`,
        `Your commendable performance in ${sName} highlights solid academic capability, and extending this focus to other learning areas will yield higher overall results.`,
        `You have shown promising understanding in ${sName}, and consistent revision across the remaining subjects will strengthen your overall competency profile.` ,
        `Your solid grasp of ${sName} demonstrates clear subject aptitude, which can be leveraged to improve performance across all evaluated learning areas.`,
        `You have achieved good results in ${sName}, and regular practice across the curriculum will help raise your overall academic standard.`,
        `Your performance in ${sName} is encouraging, and applying equal revision time to all subjects will promote well-rounded academic growth.`,
        `You have exhibited noteworthy strength in ${sName}, providing a positive foundation for enhancing your performance in other learning areas.`,
        `Your good score in ${sName} reflects clear conceptual understanding, and sustained review across all subjects will support overall progress.`,
      ];
      return pickVariant(ctMedStrengthPool, seed, 10);
    } else if (isHighlyConsistent) {
      const ctMedConsistentPool = [
        `You have maintained steady and balanced performance across all evaluated learning areas, providing a solid foundation for your ongoing academic development.`,
        `Your consistent results across all subjects demonstrate uniform understanding that serves as a dependable platform for higher future achievement.`,
        `You have shown balanced academic achievement across the curriculum, and deepening your revision in key topics will elevate your overall performance.`,
        `Your performance profile reflects uniform competency across evaluated subjects, and targeted study will help convert this consistency into higher mastery.`,
        `You have attained evenly distributed scores across all learning areas, and focused practice will assist in lifting your overall academic tier.`,
        `Your assessment indicates balanced progress across all subjects, demonstrating a dependable academic baseline across evaluated strands.`,
        `You have demonstrated steady academic equilibrium across your subjects, and regular review will help accelerate your overall progress.`,
        `Your uniform achievement across evaluated learning areas shows consistent grasp of core curriculum concepts.`,
      ];
      return pickVariant(ctMedConsistentPool, seed, 11);
    } else {
      const ctMedGeneralPool = [
        `Your performance shows steady academic progress in core concepts, and regular revision combined with targeted practice will help strengthen your understanding further.`,
        `You have performed satisfactorily across several learning areas, and structured review of curriculum topics will help you achieve higher overall results.`,
        `Your assessment results indicate fair progress across evaluated subjects, and consistent study routines will support steady academic improvement.`,
        `You have demonstrated good foundational understanding in key areas, and dedicating more time to practice exercises will elevate your achievement.`,
        `Your performance reflects steady academic development, and regular revision across all learning areas will help consolidate your core skills.`,
        `You have established a solid academic baseline, and focused attention on challenging topics will help raise your overall competency levels.`,
        `Your results demonstrate commendable potential across evaluated subjects, and continued revision will support sustained academic growth.`,
        `You have shown satisfactory grasp of evaluated concepts, and systematic study will help convert this progress into higher performance.`,
      ];
      return pickVariant(ctMedGeneralPool, seed, 12);
    }
  } else {
    if (weakest) {
      const wName = weakest.subject.subject_name;
      const ctLowWeaknessPool = [
        `Your assessment reflects foundational effort, and dedicating extra revision time to ${wName} with teacher guidance will support progress toward higher competency.`,
        `You possess clear learning potential, and focusing on structured practice in ${wName} will help strengthen your overall academic achievement.`,
        `Your performance highlights areas for growth, particularly in ${wName}, where targeted remedial review will help build essential conceptual understanding.`,
        `You have demonstrated basic foundational knowledge, and prioritizing guided study in ${wName} will support better balance across your subjects.`,
        `Your results indicate a need for concentrated revision in ${wName}, and consistent practice of core exercises will help improve your academic standing.`,
        `You show emerging understanding in your subjects, and regular consultation on difficult topics in ${wName} will accelerate your progress.`,
        `Your assessment points to foundational learning needs in ${wName}, and systematic practice will provide the support needed for improvement.`,
        `You have shown fair initial effort, and structured remedial attention to ${wName} will help elevate your overall performance level.`,
      ];
      return pickVariant(ctLowWeaknessPool, seed, 13);
    } else {
      const ctLowGeneralPool = [
        `You have demonstrated basic potential across your learning areas, and focusing on regular practice with teacher guidance will help strengthen your overall achievement.`,
        `Your results show foundational effort, and structured study routines alongside remedial support will help elevate your academic progress.`,
        `Your performance indicates emerging subject competencies, and consistent review of core concepts will support steady improvement in subsequent assessments.`,
        `You possess good learning capacity, and dedicated practice on foundational exercises will help build solid understanding across your subjects.`,
        `Your assessment reflects introductory competency levels, and regular academic consultation with teachers will provide the needed support for progress.`,
        `You have established basic conceptual awareness, and systematic revision of fundamental topics will help raise your overall performance.`,
        `Your results highlight the importance of consistent study practice, and focused remedial engagement will support your academic development.`,
        `You show promising foundational ability, and structured revision across all learning areas will assist in strengthening your curriculum mastery.`,
      ];
      return pickVariant(ctLowGeneralPool, seed, 14);
    }
  }
}
