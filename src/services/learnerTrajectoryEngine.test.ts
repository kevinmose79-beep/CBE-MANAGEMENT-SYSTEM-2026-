import { describe, it, expect } from 'vitest';
import { Student, Examination, Subject, Grade, ClassStream, Mark, LearnerPromotionRecord } from '../types';
import {
  buildLearnerTrajectory,
  sortMilestonesChronologically,
  calculateProgressionSlope,
  extractTermSequence,
} from './learnerTrajectoryEngine';

describe('Learner Trajectory Engine', () => {
  it('runs trajectory engine unit tests', () => {
    let total = 0;
    let passed = 0;

    function assert(condition: boolean, message: string) {
      total++;
      if (condition) {
        passed++;
        console.log(`✓ PASS: ${message}`);
      } else {
        console.error(`✗ FAIL: ${message}`);
      }
      expect(condition).toBe(true);
    }

// Standard CBE Grades
const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE1', minimum_score: 90, maximum_score: 100, points: 4, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'Very High' },
  { id: 'g2', grade_code: 'EE2', minimum_score: 80, maximum_score: 89, points: 4, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'High' },
  { id: 'g3', grade_code: 'ME1', minimum_score: 70, maximum_score: 79, points: 3, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Good' },
  { id: 'g4', grade_code: 'ME2', minimum_score: 60, maximum_score: 69, points: 3, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Adequate' },
  { id: 'g5', grade_code: 'AE1', minimum_score: 50, maximum_score: 59, points: 2, performance_level: 'AE', remarks: 'Approaching Expectations', descriptor: 'Fair' },
  { id: 'g6', grade_code: 'AE2', minimum_score: 40, maximum_score: 49, points: 2, performance_level: 'AE', remarks: 'Approaching Expectations', descriptor: 'Low' },
  { id: 'g7', grade_code: 'BE1', minimum_score: 20, maximum_score: 39, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Needs Support' },
  { id: 'g8', grade_code: 'BE2', minimum_score: 0, maximum_score: 19, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Critical' },
];

const classes: ClassStream[] = [
  { id: 'cls_6a', class_name: 'Grade 6', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_9e', class_name: 'Grade 9', stream: 'East', education_level: 'Junior School' },
];

const subjects: Subject[] = [
  { id: 'sb_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_sci', subject_code: 'SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
];

// Helper to create exam
function makeExam(id: string, name: string, year: number, term: 'Term 1' | 'Term 2' | 'Term 3', startDate?: string): Examination {
  return {
    id,
    exam_name: name,
    year,
    term,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
    start_date: startDate || `${year}-0${term === 'Term 1' ? '3' : term === 'Term 2' ? '7' : '11'}-15`,
  };
}

// -------------------------------------------------------------
// 1. CHRONOLOGICAL SORTING TEST
// -------------------------------------------------------------
const unorderExams: Examination[] = [
  makeExam('ex_2026_t1', '2026 T1', 2026, 'Term 1'),
  makeExam('ex_2024_t3', '2024 T3', 2024, 'Term 3'),
  makeExam('ex_2025_t2', '2025 T2', 2025, 'Term 2'),
  makeExam('ex_2024_t1', '2024 T1', 2024, 'Term 1'),
  makeExam('ex_2025_t1', '2025 T1', 2025, 'Term 1'),
  makeExam('ex_2025_t3', '2025 T3', 2025, 'Term 3'),
];

const studentStandard: Student = {
  id: 'std_001',
  full_name: 'Jane Doe',
  admission_number: 'ADM100',
  class_id: 'cls_8e',
  grade: 'Grade 8',
  gender: 'F',
  active: true,
};

const trajSort = buildLearnerTrajectory(studentStandard, unorderExams, [], subjects, grades, classes);
assert(trajSort.all_milestones.length === 6, 'All 6 milestone objects derived');
assert(trajSort.all_milestones[0].academic_period_label === '2024 Term 1', 'First sorted milestone is 2024 Term 1');
assert(trajSort.all_milestones[1].academic_period_label === '2024 Term 3', 'Second sorted milestone is 2024 Term 3');
assert(trajSort.all_milestones[2].academic_period_label === '2025 Term 1', 'Third sorted milestone is 2025 Term 1');
assert(trajSort.all_milestones[3].academic_period_label === '2025 Term 2', 'Fourth sorted milestone is 2025 Term 2');
assert(trajSort.all_milestones[4].academic_period_label === '2025 Term 3', 'Fifth sorted milestone is 2025 Term 3');
assert(trajSort.all_milestones[5].academic_period_label === '2026 Term 1', 'Sixth sorted milestone is 2026 Term 1');

// -------------------------------------------------------------
// 2. TEST B — SINGLE RESULT -> INSUFFICIENT DATA
// -------------------------------------------------------------
const singleExam = [makeExam('ex_2026_t1', '2026 T1', 2026, 'Term 1')];
const singleMarks: Mark[] = [
  { id: 'm1', student_id: 'std_001', exam_id: 'ex_2026_t1', subject_id: 'sb_mat', marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'std_001', exam_id: 'ex_2026_t1', subject_id: 'sb_eng', marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
];

const trajSingle = buildLearnerTrajectory(studentStandard, singleExam, singleMarks, subjects, grades, classes);
assert(trajSingle.usable_milestones.length === 1, 'Exactly 1 usable milestone found');
assert(trajSingle.trend === 'insufficient_data', 'Single exam produces "insufficient_data" trend');
assert(trajSingle.trend_icon === '⚪', 'Icon is ⚪');
assert(trajSingle.trend_label === 'Insufficient Data', 'Label is "Insufficient Data"');
assert(trajSingle.net_delta === null, 'Net delta is null for insufficient data');

// -------------------------------------------------------------
// 3. TEST C — IMPROVING TRAJECTORY (e.g. 60% -> 65% -> 72% -> 80%)
// -------------------------------------------------------------
const improvingExams = [
  makeExam('ex_1', '2025 T1', 2025, 'Term 1'),
  makeExam('ex_2', '2025 T2', 2025, 'Term 2'),
  makeExam('ex_3', '2025 T3', 2025, 'Term 3'),
  makeExam('ex_4', '2026 T1', 2026, 'Term 1'),
];
const improvingMarks: Mark[] = [
  { id: 'm1', student_id: 'std_001', exam_id: 'ex_1', subject_id: 'sb_mat', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'std_001', exam_id: 'ex_2', subject_id: 'sb_mat', marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 'std_001', exam_id: 'ex_3', subject_id: 'sb_mat', marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },
  { id: 'm4', student_id: 'std_001', exam_id: 'ex_4', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
];

const trajImproving = buildLearnerTrajectory(studentStandard, improvingExams, improvingMarks, subjects, grades, classes);
assert(trajImproving.usable_milestones.length === 4, '4 usable milestones');
assert(trajImproving.trend === 'improving', 'Trend is "improving"');
assert(trajImproving.trend_icon === '📈', 'Trend icon is 📈');
assert(trajImproving.net_delta === 20.0, 'Net delta is +20.0%');
assert(trajImproving.cumulative_mean_percentage === 69.3, `Cumulative mean percentage is 69.3% (got ${trajImproving.cumulative_mean_percentage}%)`);
assert(trajImproving.usable_milestones[1].step_trend === 'improving', 'Step 2 trend is improving (+5%)');
assert(trajImproving.usable_milestones[2].step_trend === 'improving', 'Step 3 trend is improving (+7%)');
assert(trajImproving.usable_milestones[3].step_trend === 'improving', 'Step 4 trend is improving (+8%)');

// -------------------------------------------------------------
// 4. TEST D — STABLE TRAJECTORY (e.g. 70% -> 71% -> 69.5% -> 70.5%)
// -------------------------------------------------------------
const stableMarks: Mark[] = [
  { id: 'm1', student_id: 'std_001', exam_id: 'ex_1', subject_id: 'sb_mat', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'std_001', exam_id: 'ex_2', subject_id: 'sb_mat', marks: 71, raw_score: 71, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 'std_001', exam_id: 'ex_3', subject_id: 'sb_mat', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
  { id: 'm4', student_id: 'std_001', exam_id: 'ex_4', subject_id: 'sb_mat', marks: 71, raw_score: 71, out_of: 100, special_status: 'Normal' },
];

const trajStable = buildLearnerTrajectory(studentStandard, improvingExams, stableMarks, subjects, grades, classes);
assert(trajStable.trend === 'stable', 'Trend is "stable"');
assert(trajStable.trend_icon === '➡️', 'Trend icon is ➡️');
assert(trajStable.net_delta === 1.0, 'Net delta is +1.0% (within +/-2.0% stability bound)');

// -------------------------------------------------------------
// 5. TEST E — DECLINING TRAJECTORY (e.g. 85% -> 78% -> 70% -> 60%)
// -------------------------------------------------------------
const decliningMarks: Mark[] = [
  { id: 'm1', student_id: 'std_001', exam_id: 'ex_1', subject_id: 'sb_mat', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'std_001', exam_id: 'ex_2', subject_id: 'sb_mat', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 'std_001', exam_id: 'ex_3', subject_id: 'sb_mat', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
  { id: 'm4', student_id: 'std_001', exam_id: 'ex_4', subject_id: 'sb_mat', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
];

const trajDeclining = buildLearnerTrajectory(studentStandard, improvingExams, decliningMarks, subjects, grades, classes);
assert(trajDeclining.trend === 'declining', 'Trend is "declining"');
assert(trajDeclining.trend_icon === '📉', 'Trend icon is 📉');
assert(trajDeclining.net_delta === -25.0, 'Net delta is -25.0%');

// -------------------------------------------------------------
// 6. TEST F — PROMOTED LEARNER ACROSS YEARS (Grade 6 -> Grade 7 -> Grade 8)
// -------------------------------------------------------------
const promotions: LearnerPromotionRecord[] = [
  {
    id: 'promo_1',
    student_id: 'std_promoted',
    from_class_id: 'cls_6a',
    to_class_id: 'cls_7e',
    from_grade: 'Grade 6',
    to_grade: 'Grade 7',
    date_promoted: '2025-01-05T00:00:00.000Z',
    from_year: 2024,
    from_term: 'Term 3',
    to_year: 2025,
    to_term: 'Term 1',
    promoted_by: 'Admin',
  },
  {
    id: 'promo_2',
    student_id: 'std_promoted',
    from_class_id: 'cls_7e',
    to_class_id: 'cls_8e',
    from_grade: 'Grade 7',
    to_grade: 'Grade 8',
    date_promoted: '2026-01-05T00:00:00.000Z',
    from_year: 2025,
    from_term: 'Term 3',
    to_year: 2026,
    to_term: 'Term 1',
    promoted_by: 'Admin',
  },
];

const studentPromoted: Student = {
  id: 'std_promoted',
  full_name: 'Kelvin Mutua',
  admission_number: 'ADM200',
  class_id: 'cls_8e',
  grade: 'Grade 8',
  gender: 'M',
  active: true,
  promotion_history: promotions,
};

const multiYearExams = [
  makeExam('ex_g6_2024', 'Grade 6 End Term', 2024, 'Term 3', '2024-11-20'),
  makeExam('ex_g7_2025', 'Grade 7 End Term', 2025, 'Term 3', '2025-11-20'),
  makeExam('ex_g8_2026', 'Grade 8 Mid Term', 2026, 'Term 1', '2026-03-10'),
];

const multiYearMarks: Mark[] = [
  { id: 'm1', student_id: 'std_promoted', exam_id: 'ex_g6_2024', subject_id: 'sb_mat', marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'std_promoted', exam_id: 'ex_g7_2025', subject_id: 'sb_mat', marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },
  { id: 'm3', student_id: 'std_promoted', exam_id: 'ex_g8_2026', subject_id: 'sb_mat', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
];

const trajPromoted = buildLearnerTrajectory(studentPromoted, multiYearExams, multiYearMarks, subjects, grades, classes);
assert(trajPromoted.usable_milestones.length === 3, '3 multi-year milestones');
assert(trajPromoted.usable_milestones[0].grade === 'Grade 6', '2024 exam correctly resolves to Grade 6');
assert(trajPromoted.usable_milestones[0].is_historical === true, '2024 exam marked as historical');
assert(trajPromoted.usable_milestones[1].grade === 'Grade 7', '2025 exam correctly resolves to Grade 7');
assert(trajPromoted.usable_milestones[1].is_historical === true, '2025 exam marked as historical');
assert(trajPromoted.usable_milestones[2].grade === 'Grade 8', '2026 exam correctly resolves to Grade 8');
assert(trajPromoted.grade_progression_span === 'Grade 6 (2024) → Grade 8 (2026)', `Span string: ${trajPromoted.grade_progression_span}`);
assert(trajPromoted.has_historical_context === true, 'Has historical context flag is true');

// -------------------------------------------------------------
// 7. TEST G — MISSING & SPECIAL STATUS HANDLING (X and Y not counted as 0)
// -------------------------------------------------------------
const specialExam = [
  makeExam('ex_spec_1', 'Exam 1', 2025, 'Term 1'),
  makeExam('ex_spec_2', 'Exam 2', 2025, 'Term 2'),
];
const specialMarks: Mark[] = [
  // Exam 1: 80% Math, 60% Eng -> average 70%
  { id: 'sm1', student_id: 'std_001', exam_id: 'ex_spec_1', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
  { id: 'sm2', student_id: 'std_001', exam_id: 'ex_spec_1', subject_id: 'sb_eng', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
  // Exam 2: 80% Math, X on Eng (absent), Y on Sci (irregularity) -> assessed only Math (80%), average 80%
  { id: 'sm3', student_id: 'std_001', exam_id: 'ex_spec_2', subject_id: 'sb_mat', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
  { id: 'sm4', student_id: 'std_001', exam_id: 'ex_spec_2', subject_id: 'sb_eng', marks: 0, raw_score: null, out_of: 100, special_status: 'X' },
  { id: 'sm5', student_id: 'std_001', exam_id: 'ex_spec_2', subject_id: 'sb_sci', marks: 0, raw_score: null, out_of: 100, special_status: 'Y' },
];

const trajSpecial = buildLearnerTrajectory(studentStandard, specialExam, specialMarks, subjects, grades, classes);
assert(trajSpecial.usable_milestones.length === 2, '2 usable milestones');
assert(trajSpecial.usable_milestones[0].average_percentage === 70.0, 'Exam 1 average is 70.0% (80+60/2)');
assert(trajSpecial.usable_milestones[1].total_assessed_subjects === 1, 'Exam 2 total assessed subjects is 1 (excluding X and Y)');
assert(trajSpecial.usable_milestones[1].average_percentage === 80.0, 'Exam 2 average is 80.0% - NOT 26.6% (X and Y not counted as 0)');
assert(trajSpecial.trend === 'improving', 'Trend is improving from 70% to 80%');

console.log(`\n==================================================\nTOTAL TESTS: ${total}, PASSED: ${passed}, FAILED: ${total - passed}\n==================================================`);
  });
});
