import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MeritListData } from './meritListExporter';
import {
  initialSchool,
  initialGrades,
  initialSubjects,
  initialTeachers,
  initialExaminations,
} from '../data/seedData';
import { Student, Mark, ClassStream } from '../types';

let capturedAutoTables: any[] = [];

vi.mock('jspdf-autotable', async (importOriginal) => {
  const actual: any = await importOriginal();
  const mockAutoTable = (doc: any, options: any) => {
    capturedAutoTables.push(options);
    return actual.default ? actual.default(doc, options) : actual(doc, options);
  };
  return {
    default: mockAutoTable,
    __esModule: true,
  };
});

describe('PRIMARY MERIT LIST — ISSUE 7C: PP1/PP2 PDF LEARNING-AREA CODE SURGICAL FIX', () => {
  const school = initialSchool;
  const grades = initialGrades;
  const subjects = initialSubjects;
  const teachers = initialTeachers;
  const exam = initialExaminations[0];

  const pp1Class: ClassStream = {
    id: 'cls_pp1_test',
    class_name: 'PP1',
    stream: 'Blue',
    capacity: 30,
    education_level: 'Pre-Primary',
    status: 'Active',
    allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re'],
  };

  const pp2Class: ClassStream = {
    id: 'cls_pp2_test',
    class_name: 'PP2',
    stream: 'North',
    capacity: 30,
    education_level: 'Pre-Primary',
    status: 'Active',
    allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re'],
  };

  const ppStudents: Student[] = [
    {
      id: 'std_pp_01',
      admission_number: 'ADM-PP1-01',
      full_name: 'Kiprono Koech',
      gender: 'M',
      class_id: 'cls_pp1_test',
      stream_id: 'cls_pp1_test',
      active: true,
      education_level: 'Pre-Primary',
      grade: 'PP1',
    },
    {
      id: 'std_pp_02',
      admission_number: 'ADM-PP1-02',
      full_name: 'Zahra Ali',
      gender: 'F',
      class_id: 'cls_pp1_test',
      stream_id: 'cls_pp1_test',
      active: true,
      education_level: 'Pre-Primary',
      grade: 'PP1',
    },
  ];

  const ppMarks: Mark[] = [
    { id: 'm_pp1_math', exam_id: exam.id, student_id: 'std_pp_01', subject_id: 'sb_pp_math', marks: 95 },
    { id: 'm_pp1_psy', exam_id: exam.id, student_id: 'std_pp_01', subject_id: 'sb_pp_psy', marks: 85 },
    { id: 'm_pp1_re', exam_id: exam.id, student_id: 'std_pp_01', subject_id: 'sb_pp_re', marks: 75 },
    { id: 'm_pp1_env', exam_id: exam.id, student_id: 'std_pp_01', subject_id: 'sb_pp_env', marks: 65 },
    { id: 'm_pp1_lang', exam_id: exam.id, student_id: 'std_pp_01', subject_id: 'sb_pp_lang', marks: 55 },

    { id: 'm_pp2_math', exam_id: exam.id, student_id: 'std_pp_02', subject_id: 'sb_pp_math', marks: 80 },
    { id: 'm_pp2_psy', exam_id: exam.id, student_id: 'std_pp_02', subject_id: 'sb_pp_psy', marks: 70 },
    { id: 'm_pp2_re', exam_id: exam.id, student_id: 'std_pp_02', subject_id: 'sb_pp_re', marks: 60 },
    { id: 'm_pp2_env', exam_id: exam.id, student_id: 'std_pp_02', subject_id: 'sb_pp_env', marks: 50 },
    { id: 'm_pp2_lang', exam_id: exam.id, student_id: 'std_pp_02', subject_id: 'sb_pp_lang', marks: 40 },
  ];

  beforeEach(() => {
    capturedAutoTables = [];
  });

  it('PP1 PDF displays PP-MATH, PP-PCA, PP-CRE, PP-ENV, PP-LANG in exact 1..5 order and maintains mark integrity', async () => {
    const { downloadMeritListPDF } = await import('./meritListExporter');

    const data: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_pp1_test',
      selectedStreamId: 'all',
      classes: [pp1Class],
      teachers,
      students: ppStudents,
      subjects,
      marks: ppMarks,
      grades,
    };

    await downloadMeritListPDF(data);

    expect(capturedAutoTables.length).toBeGreaterThanOrEqual(1);
    const mainTable = capturedAutoTables[0];

    const headRow = mainTable.head[0];
    const subjHeaders = headRow.slice(8, 13);
    expect(subjHeaders).toEqual(['PP-MATH', 'PP-PCA', 'PP-CRE', 'PP-ENV', 'PP-LANG']);

    // Check learner 1 (Kiprono Koech) row data
    const learner1Row = mainTable.body[0];
    const learner1SubjCells = learner1Row.slice(8, 13);
    expect(learner1SubjCells[0]).toBe('95 EE');
    expect(learner1SubjCells[1]).toBe('85 EE');
    expect(learner1SubjCells[2]).toBe('75 ME');
    expect(learner1SubjCells[3]).toBe('65 ME');
    expect(learner1SubjCells[4]).toBe('55 ME');

    // Check learner 2 (Zahra Ali) row data
    const learner2Row = mainTable.body[1];
    const learner2SubjCells = learner2Row.slice(8, 13);
    expect(learner2SubjCells[0]).toBe('80 EE');
    expect(learner2SubjCells[1]).toBe('70 ME');
    expect(learner2SubjCells[2]).toBe('60 ME');
    expect(learner2SubjCells[3]).toBe('50 AE');
    expect(learner2SubjCells[4]).toBe('40 AE');
  });

  it('PP2 PDF displays PP-MATH, PP-PCA, PP-CRE, PP-ENV, PP-LANG in exact 1..5 order', async () => {
    const { downloadMeritListPDF } = await import('./meritListExporter');

    const pp2Students: Student[] = [
      {
        id: 'std_pp2_01',
        admission_number: 'ADM-PP2-01',
        full_name: 'Baraka Kamau',
        gender: 'M',
        class_id: 'cls_pp2_test',
        stream_id: 'cls_pp2_test',
        active: true,
        education_level: 'Pre-Primary',
        grade: 'PP2',
      },
    ];

    const pp2Marks: Mark[] = [
      { id: 'm_pp2_1', exam_id: exam.id, student_id: 'std_pp2_01', subject_id: 'sb_pp_math', marks: 88 },
      { id: 'm_pp2_2', exam_id: exam.id, student_id: 'std_pp2_01', subject_id: 'sb_pp_psy', marks: 78 },
      { id: 'm_pp2_3', exam_id: exam.id, student_id: 'std_pp2_01', subject_id: 'sb_pp_re', marks: 68 },
      { id: 'm_pp2_4', exam_id: exam.id, student_id: 'std_pp2_01', subject_id: 'sb_pp_env', marks: 58 },
      { id: 'm_pp2_5', exam_id: exam.id, student_id: 'std_pp2_01', subject_id: 'sb_pp_lang', marks: 48 },
    ];

    const data: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_pp2_test',
      selectedStreamId: 'all',
      classes: [pp2Class],
      teachers,
      students: pp2Students,
      subjects,
      marks: pp2Marks,
      grades,
    };

    await downloadMeritListPDF(data);

    expect(capturedAutoTables.length).toBeGreaterThanOrEqual(1);
    const mainTable = capturedAutoTables[0];
    const headRow = mainTable.head[0];
    const subjHeaders = headRow.slice(8, 13);
    expect(subjHeaders).toEqual(['PP-MATH', 'PP-PCA', 'PP-CRE', 'PP-ENV', 'PP-LANG']);
  });

  it('Lower Primary (Grade 2) PDF remains unaffected', async () => {
    const { downloadMeritListPDF } = await import('./meritListExporter');

    const g2Class: ClassStream = {
      id: 'cls_g2_test',
      class_name: 'Grade 2',
      stream: 'Blue',
      capacity: 35,
      education_level: 'Lower Primary',
      status: 'Active',
      allocated_subject_ids: ['sb_lp_eng', 'sb_lp_kis', 'sb_lp_ila'],
    };

    const g2Student: Student = {
      id: 'std_g2_01',
      admission_number: 'ADM-G2-01',
      full_name: 'Zawadi Mwangi',
      gender: 'F',
      class_id: 'cls_g2_test',
      stream_id: 'cls_g2_test',
      active: true,
      education_level: 'Lower Primary',
      grade: 'Grade 2',
    };

    const g2Marks: Mark[] = [
      { id: 'm_g2_2', exam_id: exam.id, student_id: 'std_g2_01', subject_id: 'sb_lp_eng', marks: 85 },
      { id: 'm_g2_3', exam_id: exam.id, student_id: 'std_g2_01', subject_id: 'sb_lp_kis', marks: 75 },
      { id: 'm_g2_4', exam_id: exam.id, student_id: 'std_g2_01', subject_id: 'sb_lp_ila', marks: 90 },
    ];

    const data: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_g2_test',
      selectedStreamId: 'all',
      classes: [g2Class],
      teachers,
      students: [g2Student],
      subjects,
      marks: g2Marks,
      grades,
    };

    await downloadMeritListPDF(data);

    expect(capturedAutoTables.length).toBeGreaterThanOrEqual(1);
    const mainTable = capturedAutoTables[0];
    const headRow = mainTable.head[0];
    expect(headRow).toContain('ILA');
    expect(headRow).not.toContain('PP-MATH');
  });

  it('Upper Primary (Grade 5) PDF remains unaffected', async () => {
    const { downloadMeritListPDF } = await import('./meritListExporter');

    const g5Class: ClassStream = {
      id: 'cls_g5_test',
      class_name: 'Grade 5',
      stream: 'Blue',
      capacity: 40,
      education_level: 'Upper Primary',
      status: 'Active',
      allocated_subject_ids: ['sb_up_eng', 'sb_up_kis', 'sb_up_mat', 'sb_sci', 'sb_up_cas', 'sb_up_ss_cre'],
    };

    const g5Student: Student = {
      id: 'std_g5_01',
      admission_number: 'ADM-G5-01',
      full_name: 'Ethan Wambua',
      gender: 'M',
      class_id: 'cls_g5_test',
      stream_id: 'cls_g5_test',
      active: true,
      education_level: 'Upper Primary',
      grade: 'Grade 5',
    };

    const g5Marks: Mark[] = [
      { id: 'm_g5_1', exam_id: exam.id, student_id: 'std_g5_01', subject_id: 'sb_up_eng', marks: 36 },
      { id: 'm_g5_2', exam_id: exam.id, student_id: 'std_g5_01', subject_id: 'sb_up_kis', marks: 30 },
      { id: 'm_g5_3', exam_id: exam.id, student_id: 'std_g5_01', subject_id: 'sb_up_mat', marks: 90 },
      { id: 'm_g5_4', exam_id: exam.id, student_id: 'std_g5_01', subject_id: 'sb_sci', marks: 85 },
      { id: 'm_g5_5', exam_id: exam.id, student_id: 'std_g5_01', subject_id: 'sb_up_cas', marks: 80 },
      { id: 'm_g5_6', exam_id: exam.id, student_id: 'std_g5_01', subject_id: 'sb_up_ss_cre', marks: 75 },
    ];

    const data: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_g5_test',
      selectedStreamId: 'all',
      classes: [g5Class],
      teachers,
      students: [g5Student],
      subjects,
      marks: g5Marks,
      grades,
    };

    await downloadMeritListPDF(data);

    expect(capturedAutoTables.length).toBeGreaterThanOrEqual(1);
    const mainTable = capturedAutoTables[0];
    const headCells = mainTable.head.flat().map((cell: any) => (typeof cell === 'object' && cell !== null ? cell.content : cell));
    expect(headCells).toContain('ENG');
    expect(headCells).toContain('MATH');
    expect(headCells).not.toContain('PP-MATH');
  });
});
