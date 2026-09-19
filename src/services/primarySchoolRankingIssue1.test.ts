import { describe, it, expect } from 'vitest';
import { calculateExamResults } from './analysisEngine';
import { Student, Subject, Mark, ClassStream } from '../types';
import { initialSubjects, initialGrades } from '../data/seedData';

describe('PRIMARY SCHOOL MERIT LIST — ISSUE 1: UNIFY PRIMARY RANKING WITH JUNIOR SCHOOL', () => {
  const grades = initialGrades;

  // 8 Primary subjects for Grade 5
  const primarySubjects: Subject[] = [
    { id: 'sb_up_eng', subject_code: 'S1', subject_name: 'Primary Subject 1', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_kis', subject_code: 'S2', subject_name: 'Primary Subject 2', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_mat', subject_code: 'S3', subject_name: 'Primary Subject 3', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_sci', subject_code: 'S4', subject_name: 'Primary Subject 4', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_agr', subject_code: 'S5', subject_name: 'Primary Subject 5', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_sst', subject_code: 'S6', subject_name: 'Primary Subject 6', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_crt', subject_code: 'S7', subject_name: 'Primary Subject 7', education_level: 'Upper Primary', category: 'Core' },
    { id: 'sb_up_re', subject_code: 'S8', subject_name: 'Primary Subject 8', education_level: 'Upper Primary', category: 'Core' },
  ];

  const primaryClassA: ClassStream = {
    id: 'cls_g5_north',
    class_name: 'Grade 5',
    stream: 'North',
    status: 'Active',
    education_level: 'Upper Primary',
    allocated_subject_ids: primarySubjects.map((s) => s.id),
  };

  const primaryClassB: ClassStream = {
    id: 'cls_g5_south',
    class_name: 'Grade 5',
    stream: 'South',
    status: 'Active',
    education_level: 'Upper Primary',
    allocated_subject_ids: primarySubjects.map((s) => s.id),
  };

  it('Test A: Higher total marks wins even if other learner has higher average points', () => {
    // Learner A: 4 * 100 (8 pts) + 4 * 69 (6 pts) = 676 total marks. Average points = 7.00
    // Learner B: 8 * 70 (6 pts) = 560 total marks. Average points = 6.00
    const studentA: Student = {
      id: 'std_a',
      admission_number: 'ADM001',
      full_name: 'Learner A',
      first_name: 'Learner',
      last_name: 'A',
      gender: 'M',
      class_id: 'cls_g5_north',
      grade: 'Grade 5',
      active: true,
    };
    const studentB: Student = {
      id: 'std_b',
      admission_number: 'ADM002',
      full_name: 'Learner B',
      first_name: 'Learner',
      last_name: 'B',
      gender: 'F',
      class_id: 'cls_g5_north',
      grade: 'Grade 5',
      active: true,
    };

    // Learner A marks: 4 * 100 + 4 * 69 = 676
    const marksA: Mark[] = [
      { id: 'm1', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_eng', marks: 100, raw_score: 100, out_of: 100 },
      { id: 'm2', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_kis', marks: 100, raw_score: 100, out_of: 100 },
      { id: 'm3', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_mat', marks: 100, raw_score: 100, out_of: 100 },
      { id: 'm4', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_sci', marks: 100, raw_score: 100, out_of: 100 },
      { id: 'm5', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_agr', marks: 69, raw_score: 69, out_of: 100 },
      { id: 'm6', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_sst', marks: 69, raw_score: 69, out_of: 100 },
      { id: 'm7', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_crt', marks: 69, raw_score: 69, out_of: 100 },
      { id: 'm8', exam_id: 'ex1', student_id: 'std_a', subject_id: 'sb_up_re', marks: 69, raw_score: 69, out_of: 100 },
    ];

    // Learner B marks: 8 * 70 = 560
    const marksB: Mark[] = primarySubjects.map((s, idx) => ({
      id: `mb_${idx}`,
      exam_id: 'ex1',
      student_id: 'std_b',
      subject_id: s.id,
      marks: 70,
      raw_score: 70,
      out_of: 100,
    }));

    const results = calculateExamResults('ex1', [studentA, studentB], [...marksA, ...marksB], grades, [primaryClassA], primarySubjects);

    const resA = results.find((r) => r.student_id === 'std_a')!;
    const resB = results.find((r) => r.student_id === 'std_b')!;

    expect(resA.total_marks).toBe(676);
    expect(resB.total_marks).toBe(560);
    expect(resA.position).toBe(1);
    expect(resB.position).toBe(2);
    expect(resA.stream_position).toBe(1);
    expect(resB.stream_position).toBe(2);
  });

  it('Test B: Equal total marks uses competition ranking (1, 1, 3)', () => {
    const studentA: Student = { id: 'std_a', admission_number: 'ADM001', full_name: 'A 1', first_name: 'A', last_name: '1', gender: 'M', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };
    const studentB: Student = { id: 'std_b', admission_number: 'ADM002', full_name: 'B 2', first_name: 'B', last_name: '2', gender: 'F', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };
    const studentC: Student = { id: 'std_c', admission_number: 'ADM003', full_name: 'C 3', first_name: 'C', last_name: '3', gender: 'M', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };

    // A = 700, B = 700, C = 650 across 8 subjects
    // A: 6 * 90 + 2 * 80 = 540 + 160 = 700
    const marksA: Mark[] = primarySubjects.map((s, i) => ({
      id: `ma_${i}`, exam_id: 'ex1', student_id: 'std_a', subject_id: s.id, marks: i < 6 ? 90 : 80, raw_score: i < 6 ? 90 : 80, out_of: 100,
    }));
    // B: 4 * 100 + 4 * 75 = 400 + 300 = 700
    const marksB: Mark[] = primarySubjects.map((s, i) => ({
      id: `mb_${i}`, exam_id: 'ex1', student_id: 'std_b', subject_id: s.id, marks: i < 4 ? 100 : 75, raw_score: i < 4 ? 100 : 75, out_of: 100,
    }));
    // C: 2 * 85 + 6 * 80 = 170 + 480 = 650
    const marksC: Mark[] = primarySubjects.map((s, i) => ({
      id: `mc_${i}`, exam_id: 'ex1', student_id: 'std_c', subject_id: s.id, marks: i < 2 ? 85 : 80, raw_score: i < 2 ? 85 : 80, out_of: 100,
    }));

    const results = calculateExamResults('ex1', [studentA, studentB, studentC], [...marksA, ...marksB, ...marksC], grades, [primaryClassA], primarySubjects);

    const resA = results.find((r) => r.student_id === 'std_a')!;
    const resB = results.find((r) => r.student_id === 'std_b')!;
    const resC = results.find((r) => r.student_id === 'std_c')!;

    expect(resA.total_marks).toBe(700);
    expect(resB.total_marks).toBe(700);
    expect(resC.total_marks).toBe(650);

    expect(resA.position).toBe(1);
    expect(resB.position).toBe(1);
    expect(resC.position).toBe(3); // Competition rank skips to 3
  });

  it('Test C: Genuine numerical 0 is a valid assessed mark and learner remains complete & ranked', () => {
    const studentD: Student = { id: 'std_d', admission_number: 'ADM004', full_name: 'D 4', first_name: 'D', last_name: '4', gender: 'M', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };

    // 7 subjects @ 80 + 1 subject @ 0
    const marksD: Mark[] = primarySubjects.map((s, i) => ({
      id: `md_${i}`,
      exam_id: 'ex1',
      student_id: 'std_d',
      subject_id: s.id,
      marks: i === 0 ? 0 : 80,
      raw_score: i === 0 ? 0 : 80,
      out_of: 100,
    }));

    const results = calculateExamResults('ex1', [studentD], marksD, grades, [primaryClassA], primarySubjects);
    const resD = results.find((r) => r.student_id === 'std_d')!;

    expect(resD.is_complete).toBe(true);
    expect(resD.status).toBe('Complete');
    expect(resD.total_marks).toBe(560); // 7 * 80 + 0 = 560
    expect(resD.position).toBe(1);
    expect(resD.stream_position).toBe(1);
  });

  it('Test D: Missing learning area results in provisional unranked status (position = 0)', () => {
    const studentE: Student = { id: 'std_e', admission_number: 'ADM005', full_name: 'E 5', first_name: 'E', last_name: '5', gender: 'F', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };

    // Only 7 of 8 subjects entered
    const marksE: Mark[] = primarySubjects.slice(0, 7).map((s, i) => ({
      id: `me_${i}`,
      exam_id: 'ex1',
      student_id: 'std_e',
      subject_id: s.id,
      marks: 80,
      raw_score: 80,
      out_of: 100,
    }));

    const results = calculateExamResults('ex1', [studentE], marksE, grades, [primaryClassA], primarySubjects);
    const resE = results.find((r) => r.student_id === 'std_e')!;

    expect(resE.is_complete).toBe(false);
    expect(resE.status).toBe('Provisional');
    expect(resE.position).toBe(0);
    expect(resE.stream_position).toBe(0);
    expect(resE.missing_subjects_count).toBe(1);
  });

  it('Test E: X (Absent) causes learner to be unranked (position = 0)', () => {
    const studentF: Student = { id: 'std_f', admission_number: 'ADM006', full_name: 'F 6', first_name: 'F', last_name: '6', gender: 'M', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };

    const marksF: Mark[] = primarySubjects.map((s, i) => ({
      id: `mf_${i}`,
      exam_id: 'ex1',
      student_id: 'std_f',
      subject_id: s.id,
      marks: i === 0 ? ('X' as any) : 80,
      raw_score: i === 0 ? null : 80,
      out_of: 100,
      special_status: i === 0 ? 'X' : undefined,
    }));

    const results = calculateExamResults('ex1', [studentF], marksF, grades, [primaryClassA], primarySubjects);
    const resF = results.find((r) => r.student_id === 'std_f')!;

    expect(resF.is_complete).toBe(false);
    expect(resF.position).toBe(0);
    expect(resF.stream_position).toBe(0);
  });

  it('Test F: Y (Irregularity) causes learner to be unranked (position = 0)', () => {
    const studentG: Student = { id: 'std_g', admission_number: 'ADM007', full_name: 'G 7', first_name: 'G', last_name: '7', gender: 'F', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };

    const marksG: Mark[] = primarySubjects.map((s, i) => ({
      id: `mg_${i}`,
      exam_id: 'ex1',
      student_id: 'std_g',
      subject_id: s.id,
      marks: i === 0 ? ('Y' as any) : 80,
      raw_score: i === 0 ? null : 80,
      out_of: 100,
      special_status: i === 0 ? 'Y' : undefined,
    }));

    const results = calculateExamResults('ex1', [studentG], marksG, grades, [primaryClassA], primarySubjects);
    const resG = results.find((r) => r.student_id === 'std_g')!;

    expect(resG.is_complete).toBe(false);
    expect(resG.position).toBe(0);
    expect(resG.stream_position).toBe(0);
  });

  it('Test G: Stream ranking correctly partitions within streams and overall within grade', () => {
    // 2 students in North, 2 students in South
    const stdNorth1: Student = { id: 's_n1', admission_number: 'N1', full_name: 'N1 N1', first_name: 'N1', last_name: 'N1', gender: 'M', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };
    const stdNorth2: Student = { id: 's_n2', admission_number: 'N2', full_name: 'N2 N2', first_name: 'N2', last_name: 'N2', gender: 'F', class_id: 'cls_g5_north', grade: 'Grade 5', active: true };
    const stdSouth1: Student = { id: 's_s1', admission_number: 'S1', full_name: 'S1 S1', first_name: 'S1', last_name: 'S1', gender: 'M', class_id: 'cls_g5_south', grade: 'Grade 5', active: true };
    const stdSouth2: Student = { id: 's_s2', admission_number: 'S2', full_name: 'S2 S2', first_name: 'S2', last_name: 'S2', gender: 'F', class_id: 'cls_g5_south', grade: 'Grade 5', active: true };

    // Total Marks:
    // s_s1 = 720 (8 * 90) -> Grade Rank 1, South Stream Rank 1
    // s_n1 = 640 (8 * 80) -> Grade Rank 2, North Stream Rank 1
    // s_s2 = 560 (8 * 70) -> Grade Rank 3, South Stream Rank 2
    // s_n2 = 480 (8 * 60) -> Grade Rank 4, North Stream Rank 2
    const createMarks = (stdId: string, score: number) =>
      primarySubjects.map((s, i) => ({
        id: `m_${stdId}_${i}`,
        exam_id: 'ex1',
        student_id: stdId,
        subject_id: s.id,
        marks: score,
        raw_score: score,
        out_of: 100,
      }));

    const allMarks = [
      ...createMarks('s_s1', 90),
      ...createMarks('s_n1', 80),
      ...createMarks('s_s2', 70),
      ...createMarks('s_n2', 60),
    ];

    const results = calculateExamResults(
      'ex1',
      [stdNorth1, stdNorth2, stdSouth1, stdSouth2],
      allMarks,
      grades,
      [primaryClassA, primaryClassB],
      primarySubjects
    );

    const rS1 = results.find((r) => r.student_id === 's_s1')!;
    const rN1 = results.find((r) => r.student_id === 's_n1')!;
    const rS2 = results.find((r) => r.student_id === 's_s2')!;
    const rN2 = results.find((r) => r.student_id === 's_n2')!;

    // Overall Grade positions
    expect(rS1.position).toBe(1);
    expect(rN1.position).toBe(2);
    expect(rS2.position).toBe(3);
    expect(rN2.position).toBe(4);

    // Stream positions
    expect(rS1.stream_position).toBe(1); // 1st in South
    expect(rS2.stream_position).toBe(2); // 2nd in South
    expect(rN1.stream_position).toBe(1); // 1st in North
    expect(rN2.stream_position).toBe(2); // 2nd in North
  });

  it('Test H: Junior School regression check — Junior School ranking remains strictly by total_marks', () => {
    // 9 Junior School subjects from initialSubjects
    const juniorSubjects: Subject[] = initialSubjects.filter((s) =>
      ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'].includes(s.id)
    );

    const jsClass: ClassStream = {
      id: 'cls_g7_east',
      class_name: 'Grade 7',
      stream: 'East',
      status: 'Active',
      education_level: 'Junior School',
      allocated_subject_ids: juniorSubjects.map((s) => s.id),
    };

    const stdJ1: Student = { id: 's_j1', admission_number: 'J1', full_name: 'J1 J1', first_name: 'J1', last_name: 'J1', gender: 'M', class_id: 'cls_g7_east', grade: 'Grade 7', active: true };
    const stdJ2: Student = { id: 's_j2', admission_number: 'J2', full_name: 'J2 J2', first_name: 'J2', last_name: 'J2', gender: 'F', class_id: 'cls_g7_east', grade: 'Grade 7', active: true };

    // stdJ1: 9 * 85 = 765 total marks
    // stdJ2: 9 * 80 = 720 total marks
    const marksJ1 = juniorSubjects.map((s, i) => ({
      id: `mj1_${i}`, exam_id: 'ex_j', student_id: 's_j1', subject_id: s.id, marks: 85, raw_score: 85, out_of: 100,
    }));
    const marksJ2 = juniorSubjects.map((s, i) => ({
      id: `mj2_${i}`, exam_id: 'ex_j', student_id: 's_j2', subject_id: s.id, marks: 80, raw_score: 80, out_of: 100,
    }));

    const results = calculateExamResults('ex_j', [stdJ1, stdJ2], [...marksJ1, ...marksJ2], grades, [jsClass], juniorSubjects);

    const rJ1 = results.find((r) => r.student_id === 's_j1')!;
    const rJ2 = results.find((r) => r.student_id === 's_j2')!;

    expect(rJ1.total_marks).toBe(765);
    expect(rJ2.total_marks).toBe(720);
    expect(rJ1.position).toBe(1);
    expect(rJ2.position).toBe(2);
  });
});
