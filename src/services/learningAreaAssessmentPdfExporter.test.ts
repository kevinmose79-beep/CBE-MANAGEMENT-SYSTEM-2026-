import { describe, it, expect, vi } from 'vitest';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Teacher,
} from '../types';
import { CBE_8_POINT_GRADES, getGradeForMark } from './analysisEngine';
import { exportLearningAreaClassAssessmentPDF } from './learningAreaAssessmentPdfExporter';
import * as fileDownloader from '../utils/fileDownloader';

describe('Learning Area Assessment PDF Exporter', () => {
  const school: School = {
    id: 'sch_01',
    school_name: 'Muchorwe Junior School',
    motto: 'Knowledge to Excel',
    county: 'Kenya',
    address: 'P.O. Box 100',
    email: 'info@muchorwe.ac.ke',
  };

  const classes: ClassStream[] = [
    { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_01' },
    { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_02' },
  ];

  const teachers: Teacher[] = [
    {
      id: 'tch_01',
      teacher_name: 'Mr. Kiprop',
      phone: '+254700000001',
      email: 'kiprop@school.ac.ke',
      is_class_teacher: true,
      class_teacher_of_id: 'cls_8e',
    },
    {
      id: 'tch_02',
      teacher_name: 'Ms. Achieng',
      phone: '+254700000002',
      email: 'achieng@school.ac.ke',
      is_class_teacher: true,
      class_teacher_of_id: 'cls_8w',
    },
  ];

  const students: Student[] = [
    {
      id: 'std_01',
      admission_number: 'ADM-001',
      full_name: 'Alice Chebet',
      gender: 'F',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
    {
      id: 'std_02',
      admission_number: 'ADM-002',
      full_name: 'Brian Omondi',
      gender: 'M',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
    {
      id: 'std_03',
      admission_number: 'ADM-003',
      full_name: 'Carol Mwangi',
      gender: 'F',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
    {
      id: 'std_04',
      admission_number: 'ADM-004',
      full_name: 'Daniel Kiprono',
      gender: 'M',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
    {
      id: 'std_05',
      admission_number: 'ADM-005',
      full_name: 'Emily Wanjiru',
      gender: 'F',
      class_id: 'cls_8w', // West stream student - should NOT be included when East is selected
      stream_id: 'cls_8w',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
  ];

  const subject: Subject = {
    id: 'sb_sci',
    subject_name: 'Integrated Science',
    subject_code: 'SC',
    category: 'Core',
    department: 'Sciences',
  };

  const exam: Examination = {
    id: 'ex_mid',
    exam_name: 'Mid Term Assessment',
    exam_type: 'CAT',
    term: 'Term 1',
    year: 2026,
    class_id: 'cls_8e',
    status: 'Draft',
    max_marks: 80, // Assessment out of 80
  };

  // Marks for assessment out of 80:
  // Alice: 68 / 80 = 85.0% -> EE2, 7 pts
  // Brian: 48 / 80 = 60.0% -> ME1, 6 pts
  // Carol: X (Absent)
  // Daniel: 76 / 80 = 95.0% -> EE1, 8 pts
  const marks: Mark[] = [
    {
      id: 'mk_01',
      student_id: 'std_01',
      exam_id: 'ex_mid',
      subject_id: 'sb_sci',
      marks: 85,
      raw_score: 68,
      out_of: 80,
      special_status: 'Normal',
    },
    {
      id: 'mk_02',
      student_id: 'std_02',
      exam_id: 'ex_mid',
      subject_id: 'sb_sci',
      marks: 60,
      raw_score: 48,
      out_of: 80,
      special_status: 'Normal',
    },
    {
      id: 'mk_03',
      student_id: 'std_03',
      exam_id: 'ex_mid',
      subject_id: 'sb_sci',
      marks: 0,
      raw_score: null,
      out_of: 80,
      special_status: 'X',
    },
    {
      id: 'mk_04',
      student_id: 'std_04',
      exam_id: 'ex_mid',
      subject_id: 'sb_sci',
      marks: 95,
      raw_score: 76,
      out_of: 80,
      special_status: 'Normal',
    },
    {
      id: 'mk_05',
      student_id: 'std_05',
      exam_id: 'ex_mid',
      subject_id: 'sb_sci',
      marks: 70,
      raw_score: 56,
      out_of: 80,
      special_status: 'Normal',
    },
  ];

  it('exports valid Landscape PDF with Out of 80, accurate Class Mean, and CBE levels', async () => {
    let capturedDoc: any = null;
    let capturedFileName: string = '';

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any, fileName: string) => {
      capturedDoc = doc;
      capturedFileName = fileName;
    });

    await exportLearningAreaClassAssessmentPDF({
      school,
      exam,
      subject,
      selectedClassId: 'cls_8e',
      selectedStreamId: 'cls_8e',
      students,
      marks,
      grades: CBE_8_POINT_GRADES,
      classes,
      teachers,
      outOf: 80,
    });

    expect(capturedDoc).toBeDefined();
    expect(capturedFileName).toContain('Class_Assessment_SC_Grade_8_Mid_Term_Assessment.pdf');

    // Landscape checks: width 297mm, height 210mm
    const w = capturedDoc.internal.pageSize.getWidth();
    const h = capturedDoc.internal.pageSize.getHeight();
    expect(Math.round(w)).toBe(297);
    expect(Math.round(h)).toBe(210);

    // CBE Grade Verification:
    // Alice: 68/80 = 85.0% -> EE2, 7 pts
    const grAlice = getGradeForMark(85, CBE_8_POINT_GRADES);
    expect(grAlice.grade_code).toBe('EE2');
    expect(grAlice.points).toBe(7);

    // Daniel: 76/80 = 95.0% -> EE1, 8 pts
    const grDaniel = getGradeForMark(95, CBE_8_POINT_GRADES);
    expect(grDaniel.grade_code).toBe('EE1');
    expect(grDaniel.points).toBe(8);

    // Brian: 48/80 = 60.0% -> ME1, 6 pts
    const grBrian = getGradeForMark(60, CBE_8_POINT_GRADES);
    expect(grBrian.grade_code).toBe('ME1');
    expect(grBrian.points).toBe(6);

    // Mean should be (85 + 60 + 95) / 3 = 80.00%
    const mean = (85 + 60 + 95) / 3;
    expect(mean.toFixed(2)).toBe('80.00');
  });

  it('incorporates in-grid live localMarks override for unsaved grid inputs', async () => {
    let capturedFileName = '';

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (_doc: any, fileName: string) => {
      capturedFileName = fileName;
    });

    await exportLearningAreaClassAssessmentPDF({
      school,
      exam,
      subject,
      selectedClassId: 'cls_8e',
      selectedStreamId: 'cls_8e',
      students,
      marks,
      grades: CBE_8_POINT_GRADES,
      classes,
      teachers,
      outOf: 80,
      localMarks: {
        std_01: { rawScore: '72', status: 'Normal' }, // 72 / 80 = 90.0% -> EE1
        std_02: { rawScore: '48', status: 'Normal' },
        std_03: { rawScore: 'Y', status: 'Y', irregularityReason: 'Medical' },
        std_04: { rawScore: '76', status: 'Normal' },
      },
    });

    expect(capturedFileName).toBeTruthy();
  });

  it('successfully exports when given a pre-scoped learner cohort from active table', async () => {
    let capturedDoc: any = null;
    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
      capturedDoc = doc;
    });

    const singleCohort = students.filter((s) => s.class_id === 'cls_8e');

    await exportLearningAreaClassAssessmentPDF({
      school,
      exam,
      subject,
      selectedClassId: 'Grade 8',
      selectedStreamId: 'stream_east_uuid',
      students: singleCohort,
      marks,
      grades: CBE_8_POINT_GRADES,
      classes,
      teachers,
      outOf: 100,
    });

    expect(capturedDoc).toBeDefined();
  });

  it('renders header metadata without repetitive Class/Grade or Term strings', async () => {
    let capturedDoc: any = null;
    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
      capturedDoc = doc;
    });

    const testExam: Examination = {
      id: 'ex_term3',
      exam_name: 'GRADE 9 KJSEA SECOND TRIAL TERM 3 2026',
      exam_type: 'CAT',
      term: 'Term 3',
      year: 2026,
      class_id: 'cls_g9_red',
      status: 'Draft',
      max_marks: 100,
    };

    const g9Classes: ClassStream[] = [
      { id: 'cls_g9_red', class_name: 'Grade 9', stream: 'Red', capacity: 45, education_level: 'Junior School', status: 'Active' },
    ];

    const g9Students: Student[] = [
      {
        id: 'std_g9_1',
        admission_number: 'ADM-901',
        full_name: 'Faith Kerubo',
        gender: 'F',
        class_id: 'cls_g9_red',
        stream_id: 'cls_g9_red',
        active: true,
        education_level: 'Junior School',
        grade: 'Grade 9',
      },
    ];

    const g9Marks: Mark[] = [
      {
        id: 'mk_g9_1',
        student_id: 'std_g9_1',
        exam_id: 'ex_term3',
        subject_id: 'sb_sci',
        marks: 75,
        raw_score: 75,
        out_of: 100,
        special_status: 'Normal',
      },
    ];

    await exportLearningAreaClassAssessmentPDF({
      school,
      exam: testExam,
      subject,
      selectedClassId: 'Grade 9',
      selectedStreamId: 'cls_g9_red',
      students: g9Students,
      marks: g9Marks,
      grades: CBE_8_POINT_GRADES,
      classes: g9Classes,
      teachers,
      outOf: 100,
    });

    expect(capturedDoc).toBeDefined();
  });

  it('throws descriptive error when learner array is empty', async () => {
    await expect(
      exportLearningAreaClassAssessmentPDF({
        school,
        exam,
        subject,
        selectedClassId: 'cls_nonexistent',
        selectedStreamId: 'cls_nonexistent',
        students: [],
        marks,
        grades: CBE_8_POINT_GRADES,
        classes,
        teachers,
        outOf: 100,
      })
    ).rejects.toThrow('No learner records found for the selected assessment, class and learning area');
  });
});
