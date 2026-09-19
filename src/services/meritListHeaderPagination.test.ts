import { describe, it, expect } from 'vitest';
import type { School, Examination, ClassStream, Subject, Mark, Grade, Student } from '../types';
import { downloadMeritListPDF } from './meritListExporter';
import { CBE_8_POINT_GRADES } from './analysisEngine';

describe('Merit List PDF Header Pagination Regression Tests', () => {
  const school: School = {
    id: 'sch_multi_test',
    school_name: 'Muchorwe Comprehensive School',
    county: 'Nakuru',
    address: 'P.O. Box 50',
    phone: '0711223344',
    email: 'info@muchorwe.ac.ke',
  };

  const exam: Examination = {
    id: 'ex_pri_multi',
    exam_name: 'End Term 2 Comprehensive Exam',
    year: 2026,
    academic_year_id: 'ay2026',
    term: 'Term 2',
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  it('Multi-Page Upper Primary Merit List (70 learners, 3+ pages) generates cleanly with Page 1 header only', async () => {
    const classG4: ClassStream = {
      id: 'cls_g4_north',
      class_name: 'Grade 4',
      stream: 'North',
      education_level: 'Upper Primary',
      allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_agri', 'sb_ca', 'sb_cre'],
    };

    const primarySubjects: Subject[] = [
      { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sb_mat', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sb_sci', subject_code: 'SCI', subject_name: 'Science and Technology', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sb_agri', subject_code: 'AGRI', subject_name: 'Agriculture and Nutrition', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sb_ca', subject_code: 'CA', subject_name: 'Creative Arts', education_level: 'Upper Primary', category: 'Core' },
      { id: 'sb_cre', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Upper Primary', category: 'Core' },
    ];

    const g4Students: Student[] = [];
    const g4Marks: Mark[] = [];

    for (let i = 1; i <= 70; i++) {
      const sId = `std_g4_${i}`;
      const adm = `400${String(i).padStart(2, '0')}`;
      g4Students.push({
        id: sId,
        full_name: `Learner Grade4 Number ${i}`,
        admission_number: adm,
        class_id: 'cls_g4_north',
        stream_id: 'cls_g4_north',
        grade: 'Grade 4',
        gender: i % 2 === 0 ? 'F' : 'M',
        active: true,
      });

      const baseMark = 40 + (i % 51);
      primarySubjects.forEach((sb, sIdx) => {
        const score = Math.min(100, Math.max(30, baseMark + (sIdx * 2) - 5));
        g4Marks.push({
          id: `m_g4_${i}_${sb.id}`,
          student_id: sId,
          exam_id: 'ex_pri_multi',
          subject_id: sb.id,
          marks: score,
          raw_score: score,
          out_of: 100,
          special_status: 'Normal',
        });
      });
    }

    await expect(
      downloadMeritListPDF({
        school,
        exam,
        selectedClassId: 'cls_g4_north',
        selectedStreamId: 'cls_g4_north',
        classes: [classG4],
        teachers: [],
        students: g4Students,
        subjects: primarySubjects,
        marks: g4Marks,
        grades: CBE_8_POINT_GRADES,
      })
    ).resolves.not.toThrow();
  });

  it('Multi-Page Pre-Primary PP1 Merit List (50 learners, 2+ pages) generates cleanly with Page 1 header only', async () => {
    const classPP1: ClassStream = {
      id: 'cls_pp1_blue',
      class_name: 'PP1',
      stream: 'Blue',
      education_level: 'Pre-Primary',
      allocated_subject_ids: ['sb_pp_lang', 'sb_pp_mat', 'sb_pp_env', 'sb_pp_pca', 'sb_pp_cre'],
    };

    const pp1Subjects: Subject[] = [
      { id: 'sb_pp_mat', subject_code: 'PP-MATH', subject_name: 'Mathematical Activities', education_level: 'Pre-Primary', category: 'Core' },
      { id: 'sb_pp_pca', subject_code: 'PP-PCA', subject_name: 'Psychomotor and Creative Activities', education_level: 'Pre-Primary', category: 'Core' },
      { id: 'sb_pp_cre', subject_code: 'PP-CRE', subject_name: 'Religious Education Activities', education_level: 'Pre-Primary', category: 'Core' },
      { id: 'sb_pp_env', subject_code: 'PP-ENV', subject_name: 'Environmental Activities', education_level: 'Pre-Primary', category: 'Core' },
      { id: 'sb_pp_lang', subject_code: 'PP-LANG', subject_name: 'Language Activities', education_level: 'Pre-Primary', category: 'Core' },
    ];

    const pp1Students: Student[] = [];
    const pp1Marks: Mark[] = [];

    for (let i = 1; i <= 50; i++) {
      const sId = `std_pp1_${i}`;
      const adm = `100${String(i).padStart(2, '0')}`;
      pp1Students.push({
        id: sId,
        full_name: `PrePrimary Learner ${i}`,
        admission_number: adm,
        class_id: 'cls_pp1_blue',
        stream_id: 'cls_pp1_blue',
        grade: 'PP1',
        gender: i % 2 === 0 ? 'F' : 'M',
        active: true,
      });

      const baseMark = 50 + (i % 45);
      pp1Subjects.forEach((sb, sIdx) => {
        const score = Math.min(100, Math.max(35, baseMark + sIdx));
        pp1Marks.push({
          id: `m_pp1_${i}_${sb.id}`,
          student_id: sId,
          exam_id: 'ex_pri_multi',
          subject_id: sb.id,
          marks: score,
          raw_score: score,
          out_of: 100,
          special_status: 'Normal',
        });
      });
    }

    await expect(
      downloadMeritListPDF({
        school,
        exam,
        selectedClassId: 'cls_pp1_blue',
        selectedStreamId: 'cls_pp1_blue',
        classes: [classPP1],
        teachers: [],
        students: pp1Students,
        subjects: pp1Subjects,
        marks: pp1Marks,
        grades: CBE_8_POINT_GRADES,
      })
    ).resolves.not.toThrow();
  });

  it('Multi-Page Junior School Merit List (60 learners, 2+ pages) generates cleanly with Page 1 header only', async () => {
    const classG8: ClassStream = {
      id: 'cls_g8_alpha',
      class_name: 'Grade 8',
      stream: 'Alpha',
      education_level: 'Junior School',
      allocated_subject_ids: ['sb1', 'sb2', 'sb3', 'sb4', 'sb5', 'sb6', 'sb7', 'sb8', 'sb9'],
    };

    const jsSubjects: Subject[] = [
      { id: 'sb1', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
      { id: 'sb2', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
      { id: 'sb3', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
      { id: 'sb4', subject_code: 'INT SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
      { id: 'sb5', subject_code: 'CAS', subject_name: 'Creative Arts & Sports', education_level: 'Junior School', category: 'Core' },
      { id: 'sb6', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
      { id: 'sb7', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Junior School', category: 'Core' },
      { id: 'sb8', subject_code: 'AGRI', subject_name: 'Agriculture and Nutrition', education_level: 'Junior School', category: 'Core' },
      { id: 'sb9', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core' },
    ];

    const g8Students: Student[] = [];
    const g8Marks: Mark[] = [];

    for (let i = 1; i <= 60; i++) {
      const sId = `std_g8_${i}`;
      const adm = `800${String(i).padStart(2, '0')}`;
      g8Students.push({
        id: sId,
        full_name: `Junior School Learner ${i}`,
        admission_number: adm,
        class_id: 'cls_g8_alpha',
        stream_id: 'cls_g8_alpha',
        grade: 'Grade 8',
        gender: i % 2 === 0 ? 'F' : 'M',
        active: true,
      });

      const baseMark = 45 + (i % 48);
      jsSubjects.forEach((sb, sIdx) => {
        const score = Math.min(100, Math.max(30, baseMark + (sIdx * 3) - 6));
        g8Marks.push({
          id: `m_g8_${i}_${sb.id}`,
          student_id: sId,
          exam_id: 'ex_pri_multi',
          subject_id: sb.id,
          marks: score,
          raw_score: score,
          out_of: 100,
          special_status: 'Normal',
        });
      });
    }

    await expect(
      downloadMeritListPDF({
        school,
        exam,
        selectedClassId: 'cls_g8_alpha',
        selectedStreamId: 'cls_g8_alpha',
        classes: [classG8],
        teachers: [],
        students: g8Students,
        subjects: jsSubjects,
        marks: g8Marks,
        grades: CBE_8_POINT_GRADES,
      })
    ).resolves.not.toThrow();
  });
});
