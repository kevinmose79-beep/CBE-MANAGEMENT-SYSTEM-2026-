import { describe, it, expect } from 'vitest';
import { getAccessibleClasses, getAccessibleStudents, isClassTeacherFor, getAccessiblePrimaryClasses } from '../utils/rbacUtils';
import { getFilteredStudents } from '../utils/filterUtils';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Student, Teacher, User, ClassStream, Examination, Mark, Subject } from '../types';

describe('ReportsView Class Teacher Access & Stream Isolation Test Suite', () => {
  // Common Grade 9 Class & Stream definitions
  const grade9ClassId = '0e49e9b0-0a82-4f4b-9109-685b0103a54c';
  const grade9RedStreamId = '3d0ecb00-3e0f-425a-8d69-59f6c9f18b40';
  const grade9BlueStreamId = '4e1fda11-4f1e-536b-9e70-60a7d0f29c51';

  const mockClasses: ClassStream[] = [
    {
      id: grade9ClassId,
      stream_id: grade9RedStreamId,
      class_name: 'Grade 9',
      stream: 'Red',
      education_level: 'Junior School',
      class_teacher_id: 'tch_g9_red',
    },
    {
      id: grade9ClassId,
      stream_id: grade9BlueStreamId,
      class_name: 'Grade 9',
      stream: 'Blue',
      education_level: 'Junior School',
      class_teacher_id: 'tch_g9_blue',
    },
  ];

  const marcusJordan: Student = {
    id: 'e534459c-787f-4c3a-b48c-9cb09e34b011',
    admission_number: '230',
    full_name: 'Marcus Jordan',
    gender: 'M',
    class_id: grade9ClassId,
    stream_id: grade9RedStreamId,
    grade: 'Grade 9',
    education_level: 'Junior School',
    active: true,
  };

  const blueStudent: Student = {
    id: 'b1111111-2222-3333-4444-555555555555',
    admission_number: '231',
    full_name: 'Jane Doe',
    gender: 'F',
    class_id: grade9ClassId,
    stream_id: grade9BlueStreamId,
    grade: 'Grade 9',
    education_level: 'Junior School',
    active: true,
  };

  const allStudents = [marcusJordan, blueStudent];

  const grade9RedTeacher: Teacher = {
    id: 'tch_g9_red',
    user_id: 'usr_g9_red',
    teacher_name: 'Mrs. Red Teacher',
    phone: '+254700000001',
    email: 'red@school.ac.ke',
    status: 'Active',
    is_class_teacher: true,
    class_teacher_of_id: grade9RedStreamId,
    allocations: [
      { id: 'alloc_1', class_id: grade9ClassId, stream_id: grade9RedStreamId, subject_id: 'sb_math', education_level: 'Junior School' },
    ],
  };

  const grade9RedUser: User = {
    id: 'usr_g9_red',
    name: 'Mrs. Red Teacher',
    email: 'red@school.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_g9_red',
  };

  const subjectOnlyTeacher: Teacher = {
    id: 'tch_sub_only',
    user_id: 'usr_sub_only',
    teacher_name: 'Mr. Science Teacher',
    phone: '+254700000002',
    email: 'science@school.ac.ke',
    status: 'Active',
    is_class_teacher: false,
    allocations: [
      { id: 'alloc_sub', class_id: grade9ClassId, stream_id: grade9RedStreamId, subject_id: 'sb_sci', education_level: 'Junior School' },
    ],
  };

  const subjectOnlyUser: User = {
    id: 'usr_sub_only',
    name: 'Mr. Science Teacher',
    email: 'science@school.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_sub_only',
  };

  const adminUser: User = {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@school.ac.ke',
    role: 'admin',
  };

  const opener1Exam: Examination = {
    id: '39c0b1d9-0d45-4316-a5b2-0ba45d8dae60',
    exam_name: 'Opener 1',
    term: 'Term 2',
    year: 2026,
    status: 'Approved',
    approved_classes: [grade9ClassId],
    max_marks: 100,
    exam_type: 'End-Term',
  };

  const subjects: Subject[] = [
    { id: 'sb_math', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_sci', subject_code: 'INT-SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
  ];

  const marcusMarks: Mark[] = [
    { id: 'm1', student_id: marcusJordan.id, exam_id: opener1Exam.id, subject_id: 'sb_math', marks: 87, raw_score: 87, out_of: 100, special_status: 'Normal' },
    { id: 'm2', student_id: marcusJordan.id, exam_id: opener1Exam.id, subject_id: 'sb_sci', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
  ];

  it('Test 1 — Grade 9 Red Class Teacher correctly accesses Marcus Jordan and stream Red', () => {
    // 1. Base accessible classes & students via RBAC
    const baseClasses = getAccessibleClasses(grade9RedUser, grade9RedTeacher, mockClasses);
    const baseStudents = getAccessibleStudents(grade9RedUser, grade9RedTeacher, allStudents, mockClasses);

    // 2. Class & Student resolution using authoritative isClassTeacherFor
    const accessibleClasses = baseClasses.filter(c => {
      if (grade9RedUser.role === 'admin') return true;
      return isClassTeacherFor(grade9RedTeacher, c.stream_id || c.id, mockClasses);
    });

    const accessibleStudents = baseStudents.filter(s => {
      if (grade9RedUser.role === 'admin') return true;
      return isClassTeacherFor(grade9RedTeacher, s.stream_id || s.class_id, mockClasses);
    });

    expect(accessibleClasses).toHaveLength(1);
    expect(accessibleClasses[0].stream).toBe('Red');

    expect(accessibleStudents).toHaveLength(1);
    expect(accessibleStudents[0].id).toBe(marcusJordan.id);
    expect(accessibleStudents[0].full_name).toBe('Marcus Jordan');

    // 3. Filtered targetStudents for ReportsView
    const targetStudents = getFilteredStudents(
      accessibleStudents,
      accessibleClasses,
      accessibleClasses[0].class_name,
      accessibleClasses[0].stream_id || accessibleClasses[0].id,
      opener1Exam
    );

    expect(targetStudents).toHaveLength(1);
    expect(targetStudents[0].id).toBe(marcusJordan.id);

    // 4. Calculate Opener 1 results for Marcus
    const results = calculateExamResults(opener1Exam.id, targetStudents, marcusMarks, CBE_8_POINT_GRADES, accessibleClasses, subjects);
    expect(results).toHaveLength(1);
    expect(results[0].student_id).toBe(marcusJordan.id);
    expect(results[0].total_marks).toBe(172);
    expect(results[0].average).toBe(86);
  });

  it('Test 2 — Administrator maintains full access to all streams and learners', () => {
    const baseClasses = getAccessibleClasses(adminUser, null, mockClasses);
    const baseStudents = getAccessibleStudents(adminUser, null, allStudents, mockClasses);

    const accessibleClasses = baseClasses.filter(c => {
      if (adminUser.role === 'admin') return true;
      return isClassTeacherFor(null, c.stream_id || c.id, mockClasses);
    });

    const accessibleStudents = baseStudents.filter(s => {
      if (adminUser.role === 'admin') return true;
      return isClassTeacherFor(null, s.stream_id || s.class_id, mockClasses);
    });

    expect(accessibleClasses).toHaveLength(2);
    expect(accessibleStudents).toHaveLength(2);
  });

  it('Test 3 — Stream isolation: Grade 9 Red Class Teacher does NOT see Grade 9 Blue learners', () => {
    const baseStudents = getAccessibleStudents(grade9RedUser, grade9RedTeacher, allStudents, mockClasses);
    const accessibleStudents = baseStudents.filter(s => {
      if (grade9RedUser.role === 'admin') return true;
      return isClassTeacherFor(grade9RedTeacher, s.stream_id || s.class_id, mockClasses);
    });

    const blueFound = accessibleStudents.some(s => s.id === blueStudent.id);
    expect(blueFound).toBe(false);
  });

  it('Test 4 — Subject Teacher isolation: Pure Subject Teacher is not granted Class Teacher reports access', () => {
    const baseClasses = getAccessibleClasses(subjectOnlyUser, subjectOnlyTeacher, mockClasses);
    const baseStudents = getAccessibleStudents(subjectOnlyUser, subjectOnlyTeacher, allStudents, mockClasses);

    // On class report tab (not subject tab), class teacher access is checked
    const accessibleStudentsOnLearnerTab = baseStudents.filter(s => {
      if (subjectOnlyUser.role === 'admin') return true;
      return isClassTeacherFor(subjectOnlyTeacher, s.stream_id || s.class_id, mockClasses);
    });

    expect(accessibleStudentsOnLearnerTab).toHaveLength(0);
  });
});
