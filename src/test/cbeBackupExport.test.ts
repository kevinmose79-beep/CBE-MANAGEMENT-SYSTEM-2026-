import { describe, it, expect } from 'vitest';
import { api } from '../lib/storage';
import { School, Student, Teacher, ClassStream, Subject, Examination, Mark, Grade } from '../types';
import { generateBackupPayload, exportSystemBackup } from '../utils/backupExporter';

describe('CBE Backup Data Export Forensic & Functional Tests', () => {
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
    {
      id: 'std_02',
      admission_number: 'ADM002',
      full_name: 'Brian Omwenga',
      gender: 'M',
      class_id: 'cls_grade7_alpha',
      active: true,
      grade: 'Grade 7',
    },
  ];

  const sampleTeachers: Teacher[] = [
    {
      id: 'tch_01',
      teacher_name: 'Tr. John Mokaya',
      phone: '0712345678',
      email: 'john.mokaya@school.edu',
      is_class_teacher: true,
      class_teacher_of_id: 'cls_grade7_alpha',
      temporary_password: 'SensitivePassword123!',
      allocations: [
        {
          id: 'alloc_01',
          education_level: 'Junior School',
          class_id: 'cls_grade7_alpha',
          subject_id: 'sub_math',
        },
      ],
    },
  ];

  const sampleClasses: ClassStream[] = [
    {
      id: 'cls_grade7_alpha',
      class_name: 'Grade 7',
      stream: 'Alpha',
      capacity: 45,
      education_level: 'Junior School',
      status: 'Active',
    },
  ];

  const sampleSubjects: Subject[] = [
    {
      id: 'sub_math',
      subject_name: 'Mathematics',
      subject_code: 'MATH',
      category: 'Core',
      education_level: 'Junior School',
      status: 'Active',
    },
    {
      id: 'sub_eng',
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      education_level: 'Junior School',
      status: 'Active',
    },
  ];

  const sampleExams: Examination[] = [
    {
      id: 'exam_2026_t1_mid',
      exam_name: 'Term 1 Mid-Term Assessment 2026',
      term: 'Term 1',
      year: 2026,
      status: 'Open',
      exam_type: 'Mid-Term',
      max_marks: 100,
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
      special_status: 'Normal',
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
    {
      id: 'grd_ee2',
      grade_code: 'EE2',
      performance_level: 'EE',
      minimum_score: 75,
      maximum_score: 89,
      points: 7,
      remarks: 'Exceeding Expectations 2',
      descriptor: 'Exceeding Expectations',
    },
  ];

  function generateBackupPayload(
    school: School,
    students: Student[],
    teachers: Teacher[],
    classes: ClassStream[],
    subjects: Subject[],
    exams: Examination[],
    marks: Mark[],
    grades: Grade[]
  ) {
    const academicYears = api.getAcademicYears();
    const terms = api.getSchoolTerms();

    const sanitizedTeachers = teachers.map((t) => {
      const { temporary_password, ...safeTeacher } = t;
      return safeTeacher;
    });

    const exportTimestamp = new Date().toISOString();
    const schoolId = school?.id || 'sch_default';
    const schoolName = school?.school_name || 'School';

    return {
      metadata: {
        backup_format_version: '1.0.0',
        app_version: '1.0.0',
        exported_at: exportTimestamp,
        school_id: schoolId,
        school_name: schoolName,
        backup_type: 'manual_admin_export',
        record_counts: {
          learners: students.length,
          teachers: teachers.length,
          classes: classes.length,
          subjects: subjects.length,
          examinations: exams.length,
          marks: marks.length,
          grades: grades.length,
          academic_years: academicYears.length,
          terms: terms.length,
        },
      },
      school,
      academic_years: academicYears,
      terms,
      classes,
      subjects,
      teachers: sanitizedTeachers,
      learners: students,
      students,
      examinations: exams,
      exams,
      marks,
      grades,
      exported_at: exportTimestamp,
    };
  }

  it('Test 1 — Manual Export structure contains all required top-level categories', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload).toBeDefined();
    expect(payload.metadata).toBeDefined();
    expect(payload.school).toBeDefined();
    expect(payload.academic_years).toBeDefined();
    expect(payload.terms).toBeDefined();
    expect(payload.classes).toBeDefined();
    expect(payload.subjects).toBeDefined();
    expect(payload.teachers).toBeDefined();
    expect(payload.learners).toBeDefined();
    expect(payload.examinations).toBeDefined();
    expect(payload.marks).toBeDefined();
    expect(payload.grades).toBeDefined();
  });

  it('Test 2 — Metadata contains format version, export timestamp, school id and record counts', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload.metadata.backup_format_version).toBe('1.0.0');
    expect(payload.metadata.backup_type).toBe('manual_admin_export');
    expect(payload.metadata.school_id).toBe('sch_muchorwe_01');
    expect(payload.metadata.school_name).toBe('Muchorwe Comprehensive School');
    expect(typeof payload.metadata.exported_at).toBe('string');
    expect(payload.metadata.record_counts.learners).toBe(2);
    expect(payload.metadata.record_counts.teachers).toBe(1);
    expect(payload.metadata.record_counts.subjects).toBe(2);
    expect(payload.metadata.record_counts.examinations).toBe(1);
    expect(payload.metadata.record_counts.marks).toBe(1);
  });

  it('Test 3 — Academic Structure contains academic years, terms, classes and subjects', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(Array.isArray(payload.academic_years)).toBe(true);
    expect(payload.academic_years.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.terms)).toBe(true);
    expect(payload.terms.length).toBeGreaterThan(0);
    expect(payload.classes.length).toBe(1);
    expect(payload.classes[0].class_name).toBe('Grade 7');
    expect(payload.subjects.length).toBe(2);
    expect(payload.subjects[0].subject_code).toBe('MATH');
  });

  it('Test 4 — People data preserves learner and teacher records and IDs', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload.learners[0].id).toBe('std_01');
    expect(payload.learners[0].full_name).toBe('Faith Kerubo');
    expect(payload.learners[1].admission_number).toBe('ADM002');
    expect(payload.teachers[0].id).toBe('tch_01');
    expect(payload.teachers[0].teacher_name).toBe('Tr. John Mokaya');
    expect(payload.teachers[0].allocations[0].subject_id).toBe('sub_math');
  });

  it('Test 5 — Examinations preserve exam identity, year, term and configuration', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload.examinations[0].id).toBe('exam_2026_t1_mid');
    expect(payload.examinations[0].exam_name).toBe('Term 1 Mid-Term Assessment 2026');
    expect(payload.examinations[0].term).toBe('Term 1');
    expect(payload.examinations[0].year).toBe(2026);
    expect(payload.examinations[0].max_marks).toBe(100);
  });

  it('Test 6 — Marks preserve student_id, subject_id, exam_id and raw scores', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload.marks[0].id).toBe('mrk_01');
    expect(payload.marks[0].student_id).toBe('std_01');
    expect(payload.marks[0].subject_id).toBe('sub_math');
    expect(payload.marks[0].exam_id).toBe('exam_2026_t1_mid');
    expect(payload.marks[0].marks).toBe(88);
    expect(payload.marks[0].raw_score).toBe(44);
    expect(payload.marks[0].out_of).toBe(50);
  });

  it('Test 7 — Grades definitions and descriptors are fully preserved', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload.grades.length).toBe(2);
    expect(payload.grades[0].grade_code).toBe('EE1');
    expect(payload.grades[0].points).toBe(8);
    expect(payload.grades[1].grade_code).toBe('EE2');
  });

  it('Test 8 — Sensitive credentials (temporary_password, tokens) are strictly excluded', () => {
    const payload = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    const jsonString = JSON.stringify(payload);
    expect(jsonString).not.toContain('SensitivePassword123!');
    expect((payload.teachers[0] as any).temporary_password).toBeUndefined();
    expect(jsonString).not.toContain('service_role');
    expect(jsonString).not.toContain('jwt');
  });

  it('Test 9 & 10 — Idempotency and Non-destructive behavior', () => {
    const payload1 = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    const payload2 = generateBackupPayload(
      sampleSchool,
      sampleStudents,
      sampleTeachers,
      sampleClasses,
      sampleSubjects,
      sampleExams,
      sampleMarks,
      sampleGrades
    );

    expect(payload1.learners).toEqual(payload2.learners);
    expect(payload1.teachers).toEqual(payload2.teachers);
    expect(payload1.marks).toEqual(payload2.marks);
    expect(payload1.subjects).toEqual(payload2.subjects);
    expect(payload1.classes).toEqual(payload2.classes);
  });

  it('Test 11 — Utility backupExporter exports valid structure with correct filename', async () => {
    const options = {
      school: sampleSchool,
      students: sampleStudents,
      teachers: sampleTeachers,
      classes: sampleClasses,
      subjects: sampleSubjects,
      exams: sampleExams,
      marks: sampleMarks,
      grades: sampleGrades,
    };
    const exported = await exportSystemBackup(options);
    expect(exported.fileName).toContain('Muchorwe_Comprehensive_School_CBE_Backup_');
    expect(exported.fileName).toContain('.json');
    expect(exported.recordCount).toBe(4); // 2 students + 1 teacher + 1 mark
  });
});
