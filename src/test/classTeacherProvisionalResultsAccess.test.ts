import { describe, it, expect } from 'vitest';
import {
  ROLE_ALLOWED_TABS,
  isTabAllowedForRole,
  getActiveTeacher,
  getAccessibleClasses,
  getAccessiblePrimaryClasses,
  getAccessibleStudents,
} from '../utils/rbacUtils';
import { getFilteredStudents } from '../utils/filterUtils';
import { User, Teacher, ClassStream, Student, Examination } from '../types';

describe('CBE Class Teacher Portal — Provisional Results Navigation & RBAC Verification', () => {
  const mockClassG7East: ClassStream = {
    id: 'cls_g7_east',
    class_name: 'Grade 7',
    stream: 'East',
    stream_id: 'str_g7_east',
    education_level: 'Junior School',
    status: 'Active',
    class_teacher_id: 'tch_mary',
  };

  const mockClassG7West: ClassStream = {
    id: 'cls_g7_west',
    class_name: 'Grade 7',
    stream: 'West',
    stream_id: 'str_g7_west',
    education_level: 'Junior School',
    status: 'Active',
    class_teacher_id: 'tch_other',
  };

  const mockClassG8North: ClassStream = {
    id: 'cls_g8_north',
    class_name: 'Grade 8',
    stream: 'North',
    stream_id: 'str_g8_north',
    education_level: 'Junior School',
    status: 'Active',
    class_teacher_id: 'tch_other',
  };

  const allClasses: ClassStream[] = [mockClassG7East, mockClassG7West, mockClassG8North];

  const teacherMary: Teacher = {
    id: 'tch_mary',
    teacher_name: 'Mary Wanjiku',
    phone: '0711223344',
    email: 'mary@school.co.ke',
    status: 'Active',
    is_class_teacher: true,
    class_teacher_of_id: 'str_g7_east',
  };

  const teacherSubjectOnly: Teacher = {
    id: 'tch_subject_only',
    teacher_name: 'James Kamau',
    phone: '0722334455',
    email: 'james@school.co.ke',
    status: 'Active',
    is_class_teacher: false,
  };

  const userClassTeacher: User = {
    id: 'usr_mary',
    email: 'mary@school.co.ke',
    name: 'Mary Wanjiku',
    role: 'class_teacher',
    teacher_id: 'tch_mary',
    status: 'Active',
  };

  const userSubjectTeacher: User = {
    id: 'usr_james',
    email: 'james@school.co.ke',
    name: 'James Kamau',
    role: 'subject_teacher',
    teacher_id: 'tch_subject_only',
    status: 'Active',
  };

  const userAdmin: User = {
    id: 'usr_admin',
    email: 'admin@school.co.ke',
    name: 'Head of Institution',
    role: 'admin',
    status: 'Active',
  };

  const studentAliceG7East: Student = {
    id: 'std_alice',
    admission_number: 'ADM-101',
    full_name: 'Alice Muthoni',
    gender: 'F',
    class_id: 'cls_g7_east',
    stream_id: 'str_g7_east',
    active: true,
  };

  const studentBobG7West: Student = {
    id: 'std_bob',
    admission_number: 'ADM-102',
    full_name: 'Bob Kiprop',
    gender: 'M',
    class_id: 'cls_g7_west',
    stream_id: 'str_g7_west',
    active: true,
  };

  const allStudents: Student[] = [studentAliceG7East, studentBobG7West];

  const mockExam: Examination = {
    id: 'exam_2026_t1_mid',
    exam_name: 'Mid Term 1 2026',
    year: 2026,
    term: 'Term 1',
    status: 'Open',
    exam_type: 'CAT',
    max_marks: 100,
  };

  it('1. Verifies ROLE_ALLOWED_TABS.class_teacher contains "provisional"', () => {
    expect(ROLE_ALLOWED_TABS.class_teacher).toContain('provisional');
  });

  it('2. Verifies isTabAllowedForRole permits Class Teacher to navigate to "provisional"', () => {
    const isAllowed = isTabAllowedForRole(userClassTeacher, 'provisional', teacherMary, allClasses);
    expect(isAllowed).toBe(true);
  });

  it('3. Verifies isTabAllowedForRole prevents fallback redirection to dashboard for Class Teacher', () => {
    const targetTab = 'provisional';
    const isAllowed = isTabAllowedForRole(userClassTeacher, targetTab, teacherMary, allClasses);
    
    // Simulate App.tsx handleSelectTab resolution logic
    const resolvedTab = isAllowed
      ? targetTab
      : (userClassTeacher.role === 'learner' ? 'learner-portal' : 'dashboard');

    expect(resolvedTab).toBe('provisional');
    expect(resolvedTab).not.toBe('dashboard');
  });

  it('4. Verifies Subject Teacher without class assignment cannot access "provisional"', () => {
    const isAllowed = isTabAllowedForRole(userSubjectTeacher, 'provisional', teacherSubjectOnly, allClasses);
    expect(isAllowed).toBe(false);
  });

  it('5. Verifies Administrator retains full access to "provisional"', () => {
    const isAllowed = isTabAllowedForRole(userAdmin, 'provisional', null, allClasses);
    expect(isAllowed).toBe(true);
  });

  it('6. Verifies Class Teacher accessing Provisional Results is scoped strictly to their assigned class and stream', () => {
    const activeTeacher = getActiveTeacher(userClassTeacher, [teacherMary]);
    expect(activeTeacher?.id).toBe('tch_mary');

    const primaryClasses = getAccessiblePrimaryClasses(userClassTeacher, activeTeacher, allClasses);
    expect(primaryClasses.length).toBe(1);
    expect(primaryClasses[0].stream_id).toBe('str_g7_east');
    expect(primaryClasses[0].class_name).toBe('Grade 7');

    const accessibleClasses = getAccessibleClasses(userClassTeacher, activeTeacher, allClasses);
    expect(accessibleClasses.length).toBe(1);
    expect(accessibleClasses[0].stream_id).toBe('str_g7_east');

    const accessibleStudents = getAccessibleStudents(userClassTeacher, activeTeacher, allStudents, allClasses);
    expect(accessibleStudents.length).toBe(1);
    expect(accessibleStudents[0].full_name).toBe('Alice Muthoni');
    expect(accessibleStudents.some((s) => s.full_name === 'Bob Kiprop')).toBe(false);

    const filtered = getFilteredStudents(
      accessibleStudents,
      accessibleClasses,
      'Grade 7',
      'str_g7_east',
      mockExam
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('std_alice');
  });
});
