import './setupLocalStorage';
import { test, expect } from 'vitest';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Student, Subject, Mark, ClassStream } from '../types';

const subjects: Subject[] = Array.from({ length: 9 }, (_, i) => ({
  id: `sb_${i + 1}`,
  subject_code: `SUB${i + 1}`,
  subject_name: `Subject ${i + 1}`,
  category: 'Core',
  education_level: 'Junior School',
  applicable_grades: ['Grade 8', 'Grade 9'],
  status: 'Active',
}));

const class8A: ClassStream = {
  id: 'cls_8a',
  class_name: 'Grade 8',
  stream: 'Blue',
  allocated_subject_ids: subjects.map((s) => s.id),
};

const class8B: ClassStream = {
  id: 'cls_8b',
  class_name: 'Grade 8',
  stream: 'Red',
  allocated_subject_ids: subjects.map((s) => s.id),
};

const classes = [class8A, class8B];

test('TEST 1: Ranks learners strictly by Total Marks descending with competition ranking for ties', () => {
  const totalMarksList = [754, 734, 700, 690, 680, 670, 660, 650, 646, 646, 624];
  const students: Student[] = totalMarksList.map((tm, idx) => ({
    id: `std_${idx + 1}`,
    admission_number: `ADM-0${idx + 1}`,
    full_name: `Student ${idx + 1}`,
    grade: 'Grade 8',
    class_id: 'cls_8a',
    gender: 'M',
    active: true,
  }));

  const marks: Mark[] = [];
  students.forEach((std, idx) => {
    const tm = totalMarksList[idx];
    const baseMark = Math.floor(tm / 9);
    let remainder = tm % 9;
    subjects.forEach((sb, sIdx) => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      const score = baseMark + extra;
      marks.push({
        id: `m_${idx}_${sIdx}`,
        exam_id: 'ex1',
        student_id: std.id,
        subject_id: sb.id,
        marks: score,
        raw_score: score,
        out_of: 100,
      });
    });
  });

  const results = calculateExamResults('ex1', students, marks, CBE_8_POINT_GRADES, classes, subjects);

  const res1 = results.find((r) => r.student_id === 'std_1')!;
  const res2 = results.find((r) => r.student_id === 'std_2')!;
  const res9 = results.find((r) => r.student_id === 'std_9')!;
  const res10 = results.find((r) => r.student_id === 'std_10')!;
  const res11 = results.find((r) => r.student_id === 'std_11')!;

  expect(res1.position).toBe(1);
  expect(res2.position).toBe(2);
  expect(res9.position).toBe(9);
  expect(res10.position).toBe(9);
  expect(res11.position).toBe(11);
});

test('TEST 2: Equal Total Marks are NOT separated using Average Points or Total Points', () => {
  const stdA: Student = { id: 'std_a', admission_number: 'A1', full_name: 'Learner A', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };
  const stdB: Student = { id: 'std_b', admission_number: 'B1', full_name: 'Learner B', grade: 'Grade 8', class_id: 'cls_8a', gender: 'F', active: true };

  const testMarks: Mark[] = [];
  subjects.forEach((sb, i) => {
    let scoreA = 50;
    if (i === 0) scoreA = 90;
    if (i === 1) scoreA = 10;
    testMarks.push({ id: `ma_${i}`, exam_id: 'ex2', student_id: 'std_a', subject_id: sb.id, marks: scoreA, raw_score: scoreA, out_of: 100 });
    testMarks.push({ id: `mb_${i}`, exam_id: 'ex2', student_id: 'std_b', subject_id: sb.id, marks: 50, raw_score: 50, out_of: 100 });
  });

  const results = calculateExamResults('ex2', [stdA, stdB], testMarks, CBE_8_POINT_GRADES, classes, subjects);
  const resA = results.find((r) => r.student_id === 'std_a')!;
  const resB = results.find((r) => r.student_id === 'std_b')!;

  expect(resA.total_marks).toBe(450);
  expect(resB.total_marks).toBe(450);
  expect(resA.position).toBe(1);
  expect(resB.position).toBe(1);
});

test('TEST 3: CBE Level continues to use Average Marks', () => {
  const stdC: Student = { id: 'std_c', admission_number: 'C1', full_name: 'Learner C', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };
  const testMarks: Mark[] = subjects.map((sb, i) => ({
    id: `mc_${i}`, exam_id: 'ex3', student_id: 'std_c', subject_id: sb.id, marks: 77, raw_score: 77, out_of: 100
  }));

  const results = calculateExamResults('ex3', [stdC], testMarks, CBE_8_POINT_GRADES, classes, subjects);
  const resC = results.find((r) => r.student_id === 'std_c')!;

  expect(resC.average).toBe(77.0);
  expect(resC.performance_level).toBe('EE');
  expect(resC.grade_code).toBe('EE2');
});

test('TEST 4: Stream Position follows Total Marks competition ranking rule', () => {
  const std1: Student = { id: 'std_s1', admission_number: 'S1', full_name: 'Stream Learner 1', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };
  const std2: Student = { id: 'std_s2', admission_number: 'S2', full_name: 'Stream Learner 2', grade: 'Grade 8', class_id: 'cls_8a', gender: 'F', active: true };
  const std3: Student = { id: 'std_s3', admission_number: 'S3', full_name: 'Stream Learner 3', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };

  const testMarks: Mark[] = [];
  subjects.forEach((sb) => {
    testMarks.push({ id: `ms1_${sb.id}`, exam_id: 'ex4', student_id: 'std_s1', subject_id: sb.id, marks: 80, raw_score: 80, out_of: 100 });
    testMarks.push({ id: `ms2_${sb.id}`, exam_id: 'ex4', student_id: 'std_s2', subject_id: sb.id, marks: 80, raw_score: 80, out_of: 100 });
    testMarks.push({ id: `ms3_${sb.id}`, exam_id: 'ex4', student_id: 'std_s3', subject_id: sb.id, marks: 60, raw_score: 60, out_of: 100 });
  });

  const results = calculateExamResults('ex4', [std1, std2, std3], testMarks, CBE_8_POINT_GRADES, classes, subjects);
  const res1 = results.find((r) => r.student_id === 'std_s1')!;
  const res2 = results.find((r) => r.student_id === 'std_s2')!;
  const res3 = results.find((r) => r.student_id === 'std_s3')!;

  expect(res1.stream_position).toBe(1);
  expect(res2.stream_position).toBe(1);
  expect(res3.stream_position).toBe(3);
});

