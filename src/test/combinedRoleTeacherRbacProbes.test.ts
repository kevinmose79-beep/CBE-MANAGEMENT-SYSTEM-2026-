import { describe, it, expect, beforeEach } from 'vitest';
import {
  canUserEditClassAndSubjectMarks,
  canUserEditSubjectMarks,
  canUserEditClassMarks,
  getEffectiveRole,
  isTabAllowedForRole,
  getAccessiblePrimaryClasses,
  getAccessibleClasses,
  getAccessibleSubjects,
  isClassTeacherFor,
  getActiveTeacher,
  getTeacherPrimaryClassIds,
} from '../utils/rbacUtils';
import { api, setStorage, getStorage, KEYS } from '../lib/storage';
import { Teacher, ClassStream, User, Student, Examination, Subject } from '../types';
import { isClassExamApproved } from '../utils/examLockUtils';

describe('Adversarial Forensic RBAC Probes: Combined-Role Teacher (Class Teacher + Subject Teacher)', () => {
  // Scenario from specification:
  // Teacher Alice is Class Teacher of Grade 8 Blue.
  // She is also Subject Teacher for:
  // - Mathematics in Grade 7 Green
  // - Social Studies in Grade 8 Blue
  // - CRE in Grade 8 Red

  const classes: ClassStream[] = [
    {
      id: 'cls_g8_blue',
      stream_id: 'str_g8_blue',
      class_name: 'Grade 8',
      stream: 'Blue',
      education_level: 'Junior School',
      class_teacher_id: 'tch_alice',
    },
    {
      id: 'cls_g8_red',
      stream_id: 'str_g8_red',
      class_name: 'Grade 8',
      stream: 'Red',
      education_level: 'Junior School',
      class_teacher_id: 'tch_bob',
    },
    {
      id: 'cls_g7_green',
      stream_id: 'str_g7_green',
      class_name: 'Grade 7',
      stream: 'Green',
      education_level: 'Junior School',
      class_teacher_id: 'tch_charlie',
    },
    {
      id: 'cls_g9_east',
      stream_id: 'str_g9_east',
      class_name: 'Grade 9',
      stream: 'East',
      education_level: 'Junior School',
      class_teacher_id: 'tch_david',
    },
  ];

  const subjects: Subject[] = [
    { id: 'sub_math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_science', subject_name: 'Integrated Science', subject_code: 'SCI', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_sst', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_cre', subject_name: 'CRE', subject_code: 'CRE', category: 'Core', education_level: 'Junior School' },
  ];

  const aliceTeacher: Teacher = {
    id: 'tch_alice',
    user_id: 'usr_alice',
    teacher_name: 'Alice Wambui',
    email: 'alice@school.com',
    phone: '0712345678',
    is_class_teacher: true,
    class_teacher_of_id: 'str_g8_blue',
    allocations: [
      {
        id: 'alloc_1',
        class_id: 'cls_g7_green',
        stream_id: 'str_g7_green',
        class_name: 'Grade 7',
        stream: 'Green',
        education_level: 'Junior School',
        subject_id: 'sub_math',
        subject_name: 'Mathematics',
      },
      {
        id: 'alloc_2',
        class_id: 'cls_g8_blue',
        stream_id: 'str_g8_blue',
        class_name: 'Grade 8',
        stream: 'Blue',
        education_level: 'Junior School',
        subject_id: 'sub_sst',
        subject_name: 'Social Studies',
      },
      {
        id: 'alloc_3',
        class_id: 'cls_g8_red',
        stream_id: 'str_g8_red',
        class_name: 'Grade 8',
        stream: 'Red',
        education_level: 'Junior School',
        subject_id: 'sub_cre',
        subject_name: 'CRE',
      },
    ],
  };

  const teachers: Teacher[] = [
    aliceTeacher,
    {
      id: 'tch_bob',
      user_id: 'usr_bob',
      teacher_name: 'Bob Mwangi',
      email: 'bob@school.com',
      phone: '0711111111',
      is_class_teacher: true,
      class_teacher_of_id: 'str_g8_red',
    },
  ];

  const aliceUserClassTeacher: User = {
    id: 'usr_alice',
    teacher_id: 'tch_alice',
    email: 'alice@school.com',
    name: 'Alice Wambui',
    role: 'class_teacher',
    username: 'alice',
  };

  const aliceUserSubjectTeacherConflict: User = {
    id: 'usr_alice',
    teacher_id: 'tch_alice',
    email: 'alice@school.com',
    name: 'Alice Wambui',
    role: 'subject_teacher', // Role conflict in user/auth metadata!
    username: 'alice',
  };

  const testExam: Examination = {
    id: 'exam_term1_2026',
    exam_name: 'Term 1 Mid-Term',
    exam_type: 'Mid-Term',
    term: 'Term 1',
    year: 2026,
    status: 'Draft',
    max_marks: 100,
  };

  beforeEach(() => {
    setStorage(KEYS.TEACHERS, teachers);
    setStorage(KEYS.CLASSES, classes);
    setStorage(KEYS.EXAMS, [testExam]);
  });

  // PROBE 1: COMBINED-ROLE TEACHER MARKS ENTRY
  it('PROBE 1: Combined-role teacher can enter marks for allocated subjects across classes AND all subjects in own class', () => {
    // 1. Allocated subject in Grade 7 Green (Mathematics)
    const canEditG7Math = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g7_green',
      'sub_math',
      classes
    );
    expect(canEditG7Math).toBe(true);

    // 2. Allocated subject in Grade 8 Blue (Social Studies)
    const canEditG8BlueSst = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g8_blue',
      'sub_sst',
      classes
    );
    expect(canEditG8BlueSst).toBe(true);

    // 3. Allocated subject in Grade 8 Red (CRE)
    const canEditG8RedCre = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g8_red',
      'sub_cre',
      classes
    );
    expect(canEditG8RedCre).toBe(true);

    // 4. Unallocated subject in own class Grade 8 Blue (Kiswahili - Class Teacher guardianship)
    const canEditG8BlueKis = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g8_blue',
      'sub_kis',
      classes
    );
    expect(canEditG8BlueKis).toBe(true);
  });

  // PROBE 2: CLASS MARKS MONITORING
  it('PROBE 2: Combined-role teacher can access class-marks-monitoring tab', () => {
    const isAllowed = isTabAllowedForRole(
      aliceUserClassTeacher,
      'class-marks-monitoring',
      aliceTeacher,
      classes
    );
    expect(isAllowed).toBe(true);

    // Even if role in user object is 'subject_teacher', effective role allows it:
    const isAllowedWithConflict = isTabAllowedForRole(
      aliceUserSubjectTeacherConflict,
      'class-marks-monitoring',
      aliceTeacher,
      classes
    );
    expect(isAllowedWithConflict).toBe(true);
  });

  // PROBE 3: RESULTS APPROVAL
  it('PROBE 3: Combined-role teacher can approve examination results for assigned class stream', async () => {
    const updatedExam = await api.updateExaminationClassApproval(
      'exam_term1_2026',
      'str_g8_blue',
      true,
      aliceUserClassTeacher
    );

    expect(updatedExam.approved_classes).toContain('str_g8_blue');
    expect(isClassExamApproved(updatedExam, classes[0])).toBe(true);
  });

  // PROBE 4: REPORT ACCESS
  it('PROBE 4: Report access is correctly partitioned (Primary class for batch/merit, all allocated classes for subject reports)', () => {
    // 1. Primary classes for Class Teacher reports
    const primaryClasses = getAccessiblePrimaryClasses(
      aliceUserClassTeacher,
      aliceTeacher,
      classes
    );
    expect(primaryClasses.length).toBe(1);
    expect(primaryClasses[0].stream_id).toBe('str_g8_blue');

    // 2. Base accessible classes includes allocated classes + primary class
    const accessibleClasses = getAccessibleClasses(
      aliceUserClassTeacher,
      aliceTeacher,
      classes
    );
    const accessibleStreamIds = accessibleClasses.map((c) => c.stream_id);
    expect(accessibleStreamIds).toContain('str_g8_blue');
    expect(accessibleStreamIds).toContain('str_g7_green');
    expect(accessibleStreamIds).toContain('str_g8_red');
    expect(accessibleStreamIds).not.toContain('str_g9_east'); // Unallocated class excluded
  });

  // PROBE 5: LEARNER ROSTER
  it('PROBE 5: Learner roster guardianship permits own class learners and restricts other streams', () => {
    const studentG8Blue: Student = {
      id: 'std_1',
      admission_number: 'ADM001',
      first_name: 'John',
      last_name: 'Kariuki',
      full_name: 'John Kariuki',
      gender: 'M',
      class_id: 'cls_g8_blue',
      stream_id: 'str_g8_blue',
      active: true,
    };

    const studentG8Red: Student = {
      id: 'std_2',
      admission_number: 'ADM002',
      first_name: 'Jane',
      last_name: 'Achieng',
      full_name: 'Jane Achieng',
      gender: 'F',
      class_id: 'cls_g8_red',
      stream_id: 'str_g8_red',
      active: true,
    };

    // Alice is Class Teacher of Grade 8 Blue
    expect(isClassTeacherFor(aliceTeacher, studentG8Blue.stream_id!, classes)).toBe(true);
    // Alice is NOT Class Teacher of Grade 8 Red
    expect(isClassTeacherFor(aliceTeacher, studentG8Red.stream_id!, classes)).toBe(false);
  });

  // PROBE 6: CONTEXTUAL NAVIGATION
  it('PROBE 6: Contextual navigation permits all 9 Class Teacher tabs for combined-role teacher', () => {
    const requiredTabs = [
      'dashboard',
      'academic-session',
      'students',
      'marks-entry',
      'class-marks-monitoring',
      'stream-approval',
      'results-approval',
      'provisional',
      'reports',
    ];

    requiredTabs.forEach((tab) => {
      const allowed = isTabAllowedForRole(
        aliceUserClassTeacher,
        tab,
        aliceTeacher,
        classes
      );
      expect(allowed).toBe(true);
    });
  });

  // PROBE 7: UNALLOCATED SUBJECT DENIAL
  it('PROBE 7: Attempting to edit unallocated subject in another class is strictly DENIED', () => {
    // Alice teaches CRE in Grade 8 Red. She does NOT teach English in Grade 8 Red.
    const canEditG8RedEnglish = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g8_red',
      'sub_eng',
      classes
    );
    expect(canEditG8RedEnglish).toBe(false);

    // Alice teaches Math in Grade 7 Green. She does NOT teach Science in Grade 7 Green.
    const canEditG7GreenScience = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g7_green',
      'sub_science',
      classes
    );
    expect(canEditG7GreenScience).toBe(false);
  });

  // PROBE 8: UNALLOCATED CLASS MARKS ENTRY DENIAL
  it('PROBE 8: Attempting to enter marks in an unallocated class (Grade 9 East) is strictly DENIED', () => {
    const canEditG9EastClass = canUserEditClassMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g9_east',
      classes
    );
    expect(canEditG9EastClass).toBe(false);

    const canEditG9EastSubject = canUserEditClassAndSubjectMarks(
      aliceUserClassTeacher,
      aliceTeacher,
      'str_g9_east',
      'sub_math',
      classes
    );
    expect(canEditG9EastSubject).toBe(false);
  });

  // PROBE 9: CROSS-STREAM APPROVAL DENIAL
  it('PROBE 9: Attempting to approve results for unassigned class stream is strictly DENIED', async () => {
    // Attempting to approve Grade 8 Red (belonging to Bob)
    await expect(
      api.updateExaminationClassApproval(
        'exam_term1_2026',
        'str_g8_red',
        true,
        aliceUserClassTeacher
      )
    ).rejects.toThrow(/UNAUTHORIZED: You are only permitted to approve results for your assigned class stream/);

    // Attempting to approve Grade 7 Green
    await expect(
      api.updateExaminationClassApproval(
        'exam_term1_2026',
        'str_g7_green',
        true,
        aliceUserClassTeacher
      )
    ).rejects.toThrow(/UNAUTHORIZED: You are only permitted to approve results for your assigned class stream/);
  });

  // PROBE 10: ROLE-DATA CONFLICT RESILIENCE
  it('PROBE 10: Role-Data Conflict: When user.role is subject_teacher but teacher has primary class in database, system elevates to class_teacher', async () => {
    // 1. getEffectiveRole resolves 'class_teacher' from actual assignments in database
    const effectiveRole = getEffectiveRole(
      aliceUserSubjectTeacherConflict,
      aliceTeacher,
      classes
    );
    expect(effectiveRole).toBe('class_teacher');

    // 2. Results approval succeeds for their assigned stream even with subject_teacher user role
    const approvedExam = await api.updateExaminationClassApproval(
      'exam_term1_2026',
      'str_g8_blue',
      true,
      aliceUserSubjectTeacherConflict
    );
    expect(approvedExam.approved_classes).toContain('str_g8_blue');
    expect(isClassExamApproved(approvedExam, classes[0])).toBe(true);

    // 3. Class Teacher marks monitoring is permitted
    expect(
      isTabAllowedForRole(
        aliceUserSubjectTeacherConflict,
        'class-marks-monitoring',
        aliceTeacher,
        classes
      )
    ).toBe(true);

    // 4. Primary class is correctly resolved
    const primaryClasses = getAccessiblePrimaryClasses(
      aliceUserSubjectTeacherConflict,
      aliceTeacher,
      classes
    );
    expect(primaryClasses.length).toBe(1);
    expect(primaryClasses[0].stream_id).toBe('str_g8_blue');

    // 5. Cross-stream approval is still strictly denied
    await expect(
      api.updateExaminationClassApproval(
        'exam_term1_2026',
        'str_g8_red',
        true,
        aliceUserSubjectTeacherConflict
      )
    ).rejects.toThrow(/UNAUTHORIZED: You are only permitted to approve results for your assigned class stream/);
  });

  // PROBE 11: CLASS ASSIGNMENT REMOVAL (IMMEDIATE DEMOTION)
  it('PROBE 11: Class assignment removal immediately revokes class teacher authority', () => {
    // Demoted teacher: no class_teacher_of_id and no class_teacher_id references
    const demotedTeacher: Teacher = {
      ...aliceTeacher,
      is_class_teacher: false,
      class_teacher_of_id: undefined,
    };
    const classesWithoutAlice = classes.map((c) => ({
      ...c,
      class_teacher_id: c.id === 'cls_g8_blue' ? 'tch_other' : c.class_teacher_id,
    }));

    const effectiveRole = getEffectiveRole(
      aliceUserClassTeacher,
      demotedTeacher,
      classesWithoutAlice
    );
    expect(effectiveRole).toBe('subject_teacher');

    expect(
      isTabAllowedForRole(
        aliceUserClassTeacher,
        'class-marks-monitoring',
        demotedTeacher,
        classesWithoutAlice
      )
    ).toBe(false);

    expect(
      isTabAllowedForRole(
        aliceUserClassTeacher,
        'results-approval',
        demotedTeacher,
        classesWithoutAlice
      )
    ).toBe(false);
  });

  // PROBE 12: ALLOCATION ADDITION (IMMEDIATE PROMOTION)
  it('PROBE 12: Allocation addition immediately activates combined permissions', () => {
    const bobUser: User = {
      id: 'usr_bob',
      username: 'bob',
      email: 'bob@school.ac.ke',
      name: 'Bob Mwangi',
      role: 'subject_teacher',
      status: 'Active',
      teacher_id: 'tch_bob',
    };
    const bobTeacher: Teacher = {
      id: 'tch_bob',
      tsc_number: 'TSC002',
      teacher_name: 'Bob Mwangi',
      phone: '0711111112',
      email: 'bob@school.ac.ke',
      is_class_teacher: true,
      class_teacher_of_id: 'str_g8_red',
      allocations: [
        {
          id: 'alloc_bob_1',
          class_name: 'Grade 8',
          stream: 'Red',
          class_id: 'cls_g8_red',
          stream_id: 'str_g8_red',
          subject_name: 'English',
          subject_id: 'sub_eng',
          education_level: 'Junior School',
        },
      ],
    };

    expect(getEffectiveRole(bobUser, bobTeacher, classes)).toBe('class_teacher');
    expect(isClassTeacherFor(bobTeacher, 'str_g8_red', classes)).toBe(true);
    expect(canUserEditClassAndSubjectMarks(bobUser, bobTeacher, 'str_g8_red', 'sub_eng', classes)).toBe(true);
  });

  // PROBE 13: MULTIPLE CLASS TEACHER ASSIGNMENTS
  it('PROBE 13: Multiple class assignments grant class teacher authority across all assigned streams', () => {
    const multiClassTeacher: Teacher = {
      ...aliceTeacher,
      allocations: [
        ...(aliceTeacher.allocations || []),
        {
          id: 'alloc_alice_multi',
          class_name: 'Grade 9',
          stream: 'East',
          class_id: 'cls_g9_east',
          stream_id: 'str_g9_east',
          subject_name: 'Mathematics',
          subject_id: 'sub_math',
          education_level: 'Junior School',
        },
      ],
    };
    const classesWithMulti = classes.map((c) => {
      if (c.stream_id === 'str_g9_east') {
        return { ...c, class_teacher_id: multiClassTeacher.id };
      }
      return c;
    });

    expect(isClassTeacherFor(multiClassTeacher, 'str_g8_blue', classesWithMulti)).toBe(true);
    expect(isClassTeacherFor(multiClassTeacher, 'str_g9_east', classesWithMulti)).toBe(true);
    expect(isClassTeacherFor(multiClassTeacher, 'str_g8_red', classesWithMulti)).toBe(false);

    const accessiblePrimary = getAccessiblePrimaryClasses(
      aliceUserClassTeacher,
      multiClassTeacher,
      classesWithMulti
    );
    expect(accessiblePrimary.length).toBe(2);
    expect(accessiblePrimary.map((c) => c.stream_id)).toEqual(
      expect.arrayContaining(['str_g8_blue', 'str_g9_east'])
    );
  });

  // PROBE 14: HEAD OF INSTITUTION / ADMIN SUPER-AUTHORITY
  it('PROBE 14: Administrator / Head of Institution retains universal authority over all classes and subjects', () => {
    const adminUser: User = {
      id: 'usr_admin',
      username: 'admin',
      email: 'admin@school.ac.ke',
      name: 'Head of Institution',
      role: 'admin',
      status: 'Active',
    };

    expect(getEffectiveRole(adminUser, null, classes)).toBe('admin');
    expect(canUserEditClassMarks(adminUser, null, 'str_g8_blue', classes)).toBe(true);
    expect(canUserEditClassMarks(adminUser, null, 'str_g8_red', classes)).toBe(true);
    expect(canUserEditClassMarks(adminUser, null, 'str_g9_east', classes)).toBe(true);
    expect(canUserEditClassAndSubjectMarks(adminUser, null, 'str_g8_red', 'sub_eng', classes)).toBe(true);

    const adminAccessibleClasses = getAccessibleClasses(adminUser, null, classes);
    expect(adminAccessibleClasses.length).toBe(classes.length);

    const adminAccessibleSubjects = getAccessibleSubjects(adminUser, null, subjects);
    expect(adminAccessibleSubjects.length).toBe(subjects.length);
  });

  // PROBE 15: LEARNER ISOLATION
  it('PROBE 15: Learner role is strictly isolated from all teacher and administrative operations', () => {
    const learnerUser: User = {
      id: 'usr_learner',
      username: 'learner',
      email: 'learner@school.ac.ke',
      name: 'Learner One',
      role: 'learner',
      status: 'Active',
      student_id: 'std_1',
    };

    expect(getEffectiveRole(learnerUser, null, classes)).toBe('learner');
    expect(canUserEditClassMarks(learnerUser, null, 'str_g8_blue', classes)).toBe(false);
    expect(canUserEditClassAndSubjectMarks(learnerUser, null, 'str_g8_blue', 'sub_math', classes)).toBe(false);
    expect(isTabAllowedForRole(learnerUser, 'dashboard', null, classes)).toBe(false);
    expect(isTabAllowedForRole(learnerUser, 'marks-entry', null, classes)).toBe(false);
    expect(isTabAllowedForRole(learnerUser, 'learner-portal', null, classes)).toBe(true);
  });
});
