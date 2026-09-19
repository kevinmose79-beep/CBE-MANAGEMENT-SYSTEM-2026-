import { describe, it, expect } from 'vitest';
import {
  getActiveTeacher,
  getAccessibleClasses,
  getAccessiblePrimaryClasses,
  getAccessibleStudents,
} from '../utils/rbacUtils';
import { getFilteredStudents } from '../utils/filterUtils';
import { User, Teacher, ClassStream, Student, Examination } from '../types';

describe('PRIORITY FIX — Provisional Results Stream Access Control & RBAC Invariants', () => {
  // Setup sample test entities matching the forensic audit
  const classG8West: ClassStream = {
    id: 'cls_g8_west',
    class_name: 'Grade 8',
    stream: 'West',
    stream_id: 'str_g8_west',
    education_level: 'Junior School',
  };

  const classG9Red: ClassStream = {
    id: 'cls_g9_red',
    class_name: 'Grade 9',
    stream: 'Red',
    stream_id: 'str_g9_red',
    class_teacher_id: 'tch_trixie',
    education_level: 'Junior School',
  };

  const classG9Blue: ClassStream = {
    id: 'cls_g9_blue',
    class_name: 'Grade 9',
    stream: 'Blue',
    stream_id: 'str_g9_blue',
    education_level: 'Junior School',
  };

  const allClasses: ClassStream[] = [classG8West, classG9Red, classG9Blue];

  const teacherTrixie: Teacher = {
    id: 'tch_trixie',
    teacher_name: 'Trixie Teacher',
    phone: '0712345678',
    email: 'trixie@school.org',
    status: 'Active',
    is_class_teacher: true,
    class_teacher_of_id: 'str_g9_red',
  };

  const userTrixie: User = {
    id: 'usr_trixie',
    email: 'trixie@school.org',
    name: 'Trixie Teacher',
    role: 'class_teacher',
    teacher_id: 'tch_trixie',
    status: 'Active',
  };

  const userAdmin: User = {
    id: 'usr_admin',
    email: 'admin@school.org',
    name: 'School Administrator',
    role: 'admin',
    status: 'Active',
  };

  const studentBeckerG8: Student = {
    id: 'std_becker',
    admission_number: 'ADM001',
    full_name: 'Becker Johnson',
    grade: 'Grade 8',
    class_id: 'cls_g8_west',
    stream_id: 'str_g8_west',
    active: true,
    gender: 'M',
  };

  const studentKateG8: Student = {
    id: 'std_kate',
    admission_number: 'ADM002',
    full_name: 'Kate Sheila',
    grade: 'Grade 8',
    class_id: 'cls_g8_west',
    stream_id: 'str_g8_west',
    active: true,
    gender: 'F',
  };

  const studentBrianG8: Student = {
    id: 'std_brian',
    admission_number: 'ADM003',
    full_name: 'Brian Ayiecha',
    grade: 'Grade 8',
    class_id: 'cls_g8_west',
    stream_id: 'str_g8_west',
    active: true,
    gender: 'M',
  };

  const studentAlexG9Red: Student = {
    id: 'std_alex',
    admission_number: 'ADM004',
    full_name: 'Alex Mutua',
    grade: 'Grade 9',
    class_id: 'cls_g9_red',
    stream_id: 'str_g9_red',
    active: true,
    gender: 'M',
  };

  const allStudents: Student[] = [
    studentBeckerG8,
    studentKateG8,
    studentBrianG8,
    studentAlexG9Red,
  ];

  const activeExam: Examination = {
    id: 'exam_2026_t1_op',
    exam_name: 'Opener Exam 2026',
    year: 2026,
    term: 'Term 1',
    status: 'Published',
    exam_type: 'CAT',
    max_marks: 100,
  };

  it('1. Correctly resolves active teacher and authorized primary class for Grade 9 Red Class Teacher', () => {
    const activeTeacher = getActiveTeacher(userTrixie, [teacherTrixie]);
    expect(activeTeacher).toBeDefined();
    expect(activeTeacher?.id).toBe('tch_trixie');

    const primaryClasses = getAccessiblePrimaryClasses(userTrixie, activeTeacher, allClasses);
    expect(primaryClasses.length).toBe(1);
    expect(primaryClasses[0].stream_id || primaryClasses[0].id).toBe('str_g9_red');
    expect(primaryClasses[0].class_name).toBe('Grade 9');
    expect(primaryClasses[0].stream).toBe('Red');
  });

  it('2. getAccessibleClasses returns ONLY Grade 9 Red for Trixie; Grade 8 West is strictly excluded', () => {
    const activeTeacher = getActiveTeacher(userTrixie, [teacherTrixie]);
    const accessibleClasses = getAccessibleClasses(userTrixie, activeTeacher, allClasses);

    expect(accessibleClasses.length).toBe(1);
    expect(accessibleClasses.some((c) => c.stream_id === 'str_g8_west' || c.id === 'cls_g8_west')).toBe(false);
    expect(accessibleClasses[0].stream_id).toBe('str_g9_red');
  });

  it('3. getAccessibleStudents returns ONLY Grade 9 Red learners; Grade 8 West learners are strictly excluded', () => {
    const activeTeacher = getActiveTeacher(userTrixie, [teacherTrixie]);
    const accessibleStudents = getAccessibleStudents(userTrixie, activeTeacher, allStudents, allClasses);

    expect(accessibleStudents.length).toBe(1);
    expect(accessibleStudents[0].full_name).toBe('Alex Mutua');
    expect(accessibleStudents.some((s) => s.full_name === 'Becker Johnson')).toBe(false);
    expect(accessibleStudents.some((s) => s.full_name === 'Kate Sheila')).toBe(false);
    expect(accessibleStudents.some((s) => s.full_name === 'Brian Ayiecha')).toBe(false);
  });

  it('4. Admin user retains unrestricted access to all classes and all students', () => {
    const adminAccessibleClasses = getAccessibleClasses(userAdmin, null, allClasses);
    expect(adminAccessibleClasses.length).toBe(3);

    const adminAccessibleStudents = getAccessibleStudents(userAdmin, null, allStudents, allClasses);
    expect(adminAccessibleStudents.length).toBe(4);
  });

  it('5. Defense-in-depth: getFilteredStudents with accessible scope prevents unauthorized leakage if Grade 8 is queried', () => {
    const activeTeacher = getActiveTeacher(userTrixie, [teacherTrixie]);
    const accessibleClasses = getAccessibleClasses(userTrixie, activeTeacher, allClasses);
    const accessibleStudents = getAccessibleStudents(userTrixie, activeTeacher, allStudents, allClasses);

    // If an attacker forces activeClassId to 'Grade 8' and activeStreamId to 'str_g8_west'
    const forcedStudents = getFilteredStudents(
      accessibleStudents,
      accessibleClasses,
      'Grade 8',
      'str_g8_west',
      activeExam
    );

    // Because accessibleStudents and accessibleClasses contain no Grade 8 data, result MUST be empty
    expect(forcedStudents.length).toBe(0);
  });

  it('6. Authorized query for Grade 9 Red returns only the assigned candidate', () => {
    const activeTeacher = getActiveTeacher(userTrixie, [teacherTrixie]);
    const accessibleClasses = getAccessibleClasses(userTrixie, activeTeacher, allClasses);
    const accessibleStudents = getAccessibleStudents(userTrixie, activeTeacher, allStudents, allClasses);

    const redStudents = getFilteredStudents(
      accessibleStudents,
      accessibleClasses,
      'Grade 9',
      'str_g9_red',
      activeExam
    );

    expect(redStudents.length).toBe(1);
    expect(redStudents[0].full_name).toBe('Alex Mutua');
  });
});
