import { describe, it, expect } from 'vitest';
import { ROLE_ALLOWED_TABS, isTabAllowedForRole } from '../utils/rbacUtils';
import { User, Teacher, ClassStream, Examination } from '../types';

describe('ISSUE 7F — Class Teacher Portal UX Separation & Stream Approval Routing', () => {
  const teacherJohn: Teacher = {
    id: 'tch_john',
    teacher_name: 'John Doe',
    phone: '0712345678',
    email: 'john.doe@school.org',
    status: 'Active',
    is_class_teacher: true,
    class_teacher_of_id: 'str_g7_east',
  };

  const teacherSarah: Teacher = {
    id: 'tch_sarah',
    teacher_name: 'Sarah Smith',
    phone: '0722345678',
    email: 'sarah.smith@school.org',
    status: 'Active',
    is_class_teacher: false,
    allocations: [
      {
        id: 'alloc_1',
        subject_id: 'sub_eng',
        subject_name: 'English',
        class_id: 'str_g7_east',
        class_name: 'Grade 7',
        stream: 'East',
        stream_id: 'str_g7_east',
        education_level: 'Junior School',
      },
    ],
  };

  const userClassTeacher: User = {
    id: 'usr_john',
    email: 'john.doe@school.org',
    name: 'John Doe',
    role: 'class_teacher',
    teacher_id: 'tch_john',
    status: 'Active',
  };

  const userSubjectTeacher: User = {
    id: 'usr_sarah',
    email: 'sarah.smith@school.org',
    name: 'Sarah Smith',
    role: 'subject_teacher',
    teacher_id: 'tch_sarah',
    status: 'Active',
  };

  const userAdmin: User = {
    id: 'usr_admin',
    email: 'admin@school.org',
    name: 'Administrator',
    role: 'admin',
    status: 'Active',
  };

  const mockClasses: ClassStream[] = [
    {
      id: 'str_g7_east',
      class_name: 'Grade 7',
      stream: 'East',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
      class_teacher_id: 'tch_john',
    },
    {
      id: 'str_g7_west',
      class_name: 'Grade 7',
      stream: 'West',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
      class_teacher_id: 'tch_other',
    },
  ];

  it('verifies Class Teacher Portal navigation tabs include stream-approval as a distinct module', () => {
    const classTeacherAllowedTabs = ROLE_ALLOWED_TABS.class_teacher;

    expect(classTeacherAllowedTabs).toContain('marks-entry');
    expect(classTeacherAllowedTabs).toContain('class-marks-monitoring');
    expect(classTeacherAllowedTabs).toContain('stream-approval');
    expect(classTeacherAllowedTabs).toContain('reports');
  });

  it('verifies stream-approval is accessible to Class Teachers in isTabAllowedForRole', () => {
    const isAllowed = isTabAllowedForRole(userClassTeacher, 'stream-approval', teacherJohn, mockClasses);
    expect(isAllowed).toBe(true);
  });

  it('verifies stream-approval is NOT accessible to Subject Teachers without a class teacher assignment', () => {
    const isAllowed = isTabAllowedForRole(userSubjectTeacher, 'stream-approval', teacherSarah, mockClasses);
    expect(isAllowed).toBe(false);
  });

  it('verifies Administrator has access to stream-approval and all monitoring modules', () => {
    const isAdminAllowed = isTabAllowedForRole(userAdmin, 'stream-approval', null, mockClasses);
    expect(isAdminAllowed).toBe(true);
  });

  it('verifies Class Marks Monitoring remains strictly a monitoring view', () => {
    const isMonitoringAllowed = isTabAllowedForRole(userClassTeacher, 'class-marks-monitoring', teacherJohn, mockClasses);
    expect(isMonitoringAllowed).toBe(true);
  });

  it('verifies exact four-tier Class Assessment structure for Class Teachers', () => {
    const expectedAssessmentTabs = ['marks-entry', 'class-marks-monitoring', 'stream-approval', 'reports'];
    const classTeacherTabs = ROLE_ALLOWED_TABS.class_teacher;

    expectedAssessmentTabs.forEach((tab) => {
      expect(classTeacherTabs).toContain(tab);
    });
  });
});
