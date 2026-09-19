import { describe, it, expect } from 'vitest';
import { generateBackupPayload, exportSystemBackup } from '../utils/backupExporter';
import { School, Student, Teacher, ClassStream, Subject, Examination, Mark, Grade } from '../types';
import { SystemSettingsPage } from '../components/SystemSettingsPage';
import { DeveloperSettingsPage } from '../components/DeveloperSettingsPage';

describe('Settings Relocation of Backup Data & Reset Seed Data', () => {
  const sampleSchool: School = {
    id: 'sch_muchorwe_01',
    school_name: 'Muchorwe Comprehensive School',
    county: 'Nyamira',
    address: 'P.O. Box 123, Keroka',
    email: 'info@muchorwe.ac.ke',
    motto: 'Strive for Excellence',
    school_code: 'MCS001',
  };

  const sampleStudents: Student[] = [
    {
      id: 'std_01',
      admission_number: 'ADM001',
      full_name: 'Faith Kerubo',
      gender: 'F',
      class_id: 'cls_grade7_alpha',
      active: true,
      grade: 'Grade 7',
    },
  ];

  const sampleTeachers: Teacher[] = [
    {
      id: 'tch_01',
      teacher_name: 'Tr. John Mokaya',
      phone: '+254700000000',
      email: 'john.mokaya@muchorwe.ac.ke',
      is_class_teacher: false,
      allocations: [
        {
          id: 'alc_01',
          class_id: 'cls_grade7_alpha',
          subject_id: 'sub_math',
          education_level: 'Junior School',
        },
      ],
    },
  ];

  const sampleClasses: ClassStream[] = [
    {
      id: 'cls_grade7_alpha',
      class_name: 'Grade 7',
      stream: 'Alpha',
      education_level: 'Junior School',
    },
  ];

  const sampleSubjects: Subject[] = [
    {
      id: 'sub_math',
      subject_name: 'Mathematics',
      subject_code: 'MATH',
      category: 'Core',
      education_level: 'Junior School',
    },
  ];

  const sampleExams: Examination[] = [
    {
      id: 'exam_2026_t1_mid',
      exam_name: 'Term 1 Mid-Term Assessment 2026',
      term: 'Term 1',
      year: 2026,
      max_marks: 100,
      status: 'Published',
      exam_type: 'Mid-Term',
    },
  ];

  const sampleMarks: Mark[] = [
    {
      id: 'mrk_01',
      student_id: 'std_01',
      subject_id: 'sub_math',
      exam_id: 'exam_2026_t1_mid',
      marks: 88,
      raw_score: 44,
      out_of: 50,
    },
  ];

  const sampleGrades: Grade[] = [
    {
      id: 'grd_ee1',
      grade_code: 'EE1',
      performance_level: 'EE',
      minimum_score: 90,
      maximum_score: 100,
      points: 8,
      remarks: 'Exceeding Expectations 1',
      descriptor: 'Exceeding Expectations',
    },
  ];

  it('verifies SystemSettingsPage and DeveloperSettingsPage export correctly', () => {
    expect(SystemSettingsPage).toBeDefined();
    expect(DeveloperSettingsPage).toBeDefined();
  });

  it('generates a complete backup payload with proper metadata and data arrays', () => {
    const payload = generateBackupPayload({
      school: sampleSchool,
      students: sampleStudents,
      teachers: sampleTeachers,
      classes: sampleClasses,
      subjects: sampleSubjects,
      exams: sampleExams,
      marks: sampleMarks,
      grades: sampleGrades,
    });

    expect(payload.metadata.backup_type).toBe('manual_admin_export');
    expect(payload.metadata.backup_format_version).toBe('1.0.0');
    expect(payload.metadata.school_id).toBe('sch_muchorwe_01');
    expect(payload.metadata.record_counts.learners).toBe(1);
    expect(payload.metadata.record_counts.teachers).toBe(1);
    expect(payload.metadata.record_counts.classes).toBe(1);
    expect(payload.metadata.record_counts.subjects).toBe(1);
    expect(payload.metadata.record_counts.examinations).toBe(1);
    expect(payload.metadata.record_counts.marks).toBe(1);

    expect(payload.learners).toHaveLength(1);
    expect(payload.teachers).toHaveLength(1);
    expect(payload.classes).toHaveLength(1);
    expect(payload.subjects).toHaveLength(1);
    expect(payload.examinations).toHaveLength(1);
    expect(payload.marks).toHaveLength(1);
  });

  it('guarantees teacher credentials are sanitized during backup generation', () => {
    const sensitiveTeacher: Teacher = {
      ...sampleTeachers[0],
      temporary_password: 'SensitivePassword123!',
    };

    const payload = generateBackupPayload({
      school: sampleSchool,
      teachers: [sensitiveTeacher],
    });

    expect((payload.teachers[0] as any).temporary_password).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('SensitivePassword123!');
  });

  it('generates consistent backup file name with school name and date', async () => {
    const result = await exportSystemBackup({
      school: sampleSchool,
      students: sampleStudents,
      teachers: sampleTeachers,
      marks: sampleMarks,
    });

    expect(result.fileName).toMatch(/^Muchorwe_Comprehensive_School_CBE_Backup_\d{4}-\d{2}-\d{2}\.json$/);
    expect(result.recordCount).toBe(3); // 1 student + 1 teacher + 1 mark
  });
});
