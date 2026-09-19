import { describe, it, expect, beforeEach } from 'vitest';
import { api, KEYS, getStorage, setStorage } from '../lib/storage';
import { Examination, ClassStream, Teacher, User, Grade, EducationLevel } from '../types';
import {
  isClassExamApproved,
  isLevelApproved,
  isStreamApproved,
  isGradeFullyApproved,
  isEducationLevelFullyApproved,
  isExaminationFullyApproved,
} from '../utils/examLockUtils';

// Polyfill localStorage for Node/vitest test runner if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (index: number) => Object.keys(store)[index] || null,
    length: 0,
  } as any;
}

describe('Examination Approval Surgical Fix & Independent Progressive Workflow', () => {
  const mockAdminUser: User = {
    id: 'usr_admin_1',
    email: 'admin@school.ac.ke',
    role: 'admin',
    name: 'Chief Principal',
  };

  const mockClassTeacherG7Blue: User = {
    id: 'usr_teacher_g7b',
    email: 'teacher.g7b@school.ac.ke',
    role: 'class_teacher',
    name: 'Mr. Otieno (Grade 7 Blue)',
    teacher_id: 't_g7b',
  };

  const mockTeacherG7bProfile: Teacher = {
    id: 't_g7b',
    user_id: 'usr_teacher_g7b',
    email: 'teacher.g7b@school.ac.ke',
    teacher_name: 'Mr. Otieno',
    tsc_number: 'TSC-11111',
    phone: '0712345678',
    status: 'Active',
    class_teacher_of_id: 'st_g7_blue',
  };

  const mockClasses: ClassStream[] = [
    // Junior School
    {
      id: 'cls_g7',
      stream_id: 'st_g7_blue',
      class_name: 'Grade 7',
      stream: 'Blue',
      education_level: 'Junior School',
      class_teacher_id: 't_g7b',
      status: 'Active',
    },
    {
      id: 'cls_g7',
      stream_id: 'st_g7_red',
      class_name: 'Grade 7',
      stream: 'Red',
      education_level: 'Junior School',
      class_teacher_id: 't_g7r',
      status: 'Active',
    },
    {
      id: 'cls_g8',
      stream_id: 'st_g8_blue',
      class_name: 'Grade 8',
      stream: 'Blue',
      education_level: 'Junior School',
      class_teacher_id: 't_g8b',
      status: 'Active',
    },
    {
      id: 'cls_g9',
      stream_id: 'st_g9_blue',
      class_name: 'Grade 9',
      stream: 'Blue',
      education_level: 'Junior School',
      class_teacher_id: 't_g9b',
      status: 'Active',
    },
    // Upper Primary
    {
      id: 'cls_g4',
      stream_id: 'st_g4_blue',
      class_name: 'Grade 4',
      stream: 'Blue',
      education_level: 'Upper Primary',
      status: 'Active',
    },
    {
      id: 'cls_g5',
      stream_id: 'st_g5_blue',
      class_name: 'Grade 5',
      stream: 'Blue',
      education_level: 'Upper Primary',
      status: 'Active',
    },
    {
      id: 'cls_g6',
      stream_id: 'st_g6_blue',
      class_name: 'Grade 6',
      stream: 'Blue',
      education_level: 'Upper Primary',
      status: 'Active',
    },
    // Lower Primary
    {
      id: 'cls_g1',
      stream_id: 'st_g1_blue',
      class_name: 'Grade 1',
      stream: 'Blue',
      education_level: 'Lower Primary',
      status: 'Active',
    },
    {
      id: 'cls_g2',
      stream_id: 'st_g2_blue',
      class_name: 'Grade 2',
      stream: 'Blue',
      education_level: 'Lower Primary',
      status: 'Active',
    },
    {
      id: 'cls_g3',
      stream_id: 'st_g3_blue',
      class_name: 'Grade 3',
      stream: 'Blue',
      education_level: 'Lower Primary',
      status: 'Active',
    },
  ];

  const initialExam: Examination = {
    id: 'exam_term1_2026',
    exam_name: 'Term 1 Mid-Term Assessment 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Draft',
    exam_type: 'Mid-Term',
    max_marks: 100,
    approved_levels: [],
    approved_classes: [],
  };

  beforeEach(() => {
    setStorage(KEYS.CLASSES, mockClasses);
    setStorage(KEYS.TEACHERS, [mockTeacherG7bProfile]);
    setStorage(KEYS.EXAMS, [initialExam]);
  });

  // --------------------------------------------------------------------------
  // TEST A: Individual Stream Approval
  // --------------------------------------------------------------------------
  it('TEST A: Individual Stream Approval stores only stream UUID and avoids parent class ID', async () => {
    const updated = await api.updateExaminationClassApproval(
      'exam_term1_2026',
      'st_g7_blue',
      true,
      mockClassTeacherG7Blue
    );

    // 1. Authoritative stream UUID present in approved_classes
    expect(updated.approved_classes).toContain('st_g7_blue');
    // 2. Parent class UUID ('cls_g7') MUST NOT be in approved_classes
    expect(updated.approved_classes).not.toContain('cls_g7');
    // 3. Length must be exactly 1
    expect(updated.approved_classes?.length).toBe(1);

    // 4. Other streams in the same grade/level must be unapproved
    const stG7Blue = mockClasses.find((c) => c.stream_id === 'st_g7_blue')!;
    const stG7Red = mockClasses.find((c) => c.stream_id === 'st_g7_red')!;
    const stG8Blue = mockClasses.find((c) => c.stream_id === 'st_g8_blue')!;

    expect(isClassExamApproved(updated, stG7Blue)).toBe(true);
    expect(isClassExamApproved(updated, stG7Red)).toBe(false);
    expect(isClassExamApproved(updated, stG8Blue)).toBe(false);

    // 5. Level should NOT be approved because other streams in Junior School are still pending
    expect(isLevelApproved(updated, 'Junior School')).toBe(false);
    expect(updated.status).toBe('Provisional');
  });

  // --------------------------------------------------------------------------
  // TEST B: Individual Stream Reopening
  // --------------------------------------------------------------------------
  it('TEST B: Individual Stream Reopening removes the stream and preserves others', async () => {
    // Start with two approved streams
    const examWithTwo: Examination = {
      ...initialExam,
      status: 'Provisional',
      approved_classes: ['st_g7_blue', 'st_g7_red'],
    };
    setStorage(KEYS.EXAMS, [examWithTwo]);

    // Reopen Grade 7 Blue by Admin
    const updated = await api.updateExaminationClassApproval(
      'exam_term1_2026',
      'st_g7_blue',
      false,
      mockAdminUser
    );

    expect(updated.approved_classes).not.toContain('st_g7_blue');
    expect(updated.approved_classes).toContain('st_g7_red');
    expect(updated.approved_classes?.length).toBe(1);

    const stG7Blue = mockClasses.find((c) => c.stream_id === 'st_g7_blue')!;
    const stG7Red = mockClasses.find((c) => c.stream_id === 'st_g7_red')!;
    expect(isClassExamApproved(updated, stG7Blue)).toBe(false);
    expect(isClassExamApproved(updated, stG7Red)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST C: Education-Level Approval
  // --------------------------------------------------------------------------
  it('TEST C: Education-Level Approval synchronizes all constituent streams without affecting other levels', async () => {
    // Admin approves Junior School (Grade 7 Blue, Grade 7 Red, Grade 8 Blue, Grade 9 Blue)
    const updated = await api.updateExaminationLevelApproval(
      'exam_term1_2026',
      'Junior School',
      true,
      mockAdminUser
    );

    // 1. approved_levels contains 'Junior School'
    expect(updated.approved_levels).toContain('Junior School');

    // 2. approved_classes contains all Junior School stream UUIDs
    expect(updated.approved_classes).toContain('st_g7_blue');
    expect(updated.approved_classes).toContain('st_g7_red');
    expect(updated.approved_classes).toContain('st_g8_blue');
    expect(updated.approved_classes).toContain('st_g9_blue');

    // 3. Streams from other levels (Upper Primary, Lower Primary) are NOT in approved_classes
    expect(updated.approved_classes).not.toContain('st_g4_blue');
    expect(updated.approved_classes).not.toContain('st_g5_blue');
    expect(updated.approved_classes).not.toContain('st_g6_blue');
    expect(updated.approved_classes).not.toContain('st_g1_blue');

    // 4. Verification via lock utils
    const jsStream = mockClasses.find((c) => c.stream_id === 'st_g7_blue')!;
    const upStream = mockClasses.find((c) => c.stream_id === 'st_g4_blue')!;
    expect(isClassExamApproved(updated, jsStream)).toBe(true);
    expect(isClassExamApproved(updated, upStream)).toBe(false);
    expect(isLevelApproved(updated, 'Junior School')).toBe(true);
    expect(isLevelApproved(updated, 'Upper Primary')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST D: Cross-Level Isolation
  // --------------------------------------------------------------------------
  it('TEST D: Cross-Level Isolation guarantees modifying Upper Primary does not alter Junior School', async () => {
    // Start with Junior School fully approved
    const examWithJuniorSchool: Examination = {
      ...initialExam,
      status: 'Provisional',
      approved_levels: ['Junior School'],
      approved_classes: ['st_g7_blue', 'st_g7_red', 'st_g8_blue', 'st_g9_blue'],
    };
    setStorage(KEYS.EXAMS, [examWithJuniorSchool]);

    // Now approve Grade 4 Blue in Upper Primary
    const updated = await api.updateExaminationClassApproval(
      'exam_term1_2026',
      'st_g4_blue',
      true,
      mockAdminUser
    );

    // Junior School level approval remains completely intact
    expect(updated.approved_levels).toContain('Junior School');
    expect(updated.approved_classes).toContain('st_g7_blue');
    expect(updated.approved_classes).toContain('st_g7_red');
    expect(updated.approved_classes).toContain('st_g8_blue');
    expect(updated.approved_classes).toContain('st_g9_blue');

    // Upper Primary Grade 4 Blue is added
    expect(updated.approved_classes).toContain('st_g4_blue');

    // Upper Primary level is NOT approved yet (since Grade 5 and Grade 6 are pending)
    expect(updated.approved_levels).not.toContain('Upper Primary');
  });

  // --------------------------------------------------------------------------
  // TEST E: Partial Stream Approval within Level
  // --------------------------------------------------------------------------
  it('TEST E: Partial Stream Approval does not falsely approve the entire level or grade', async () => {
    const updated = await api.updateExaminationClassApproval(
      'exam_term1_2026',
      'st_g7_blue',
      true,
      mockAdminUser
    );

    expect(isStreamApproved(updated, 'st_g7_blue', mockClasses)).toBe(true);
    expect(isStreamApproved(updated, 'st_g7_red', mockClasses)).toBe(false);
    expect(isGradeFullyApproved(updated, 'Grade 7', mockClasses)).toBe(false);
    expect(isEducationLevelFullyApproved(updated, 'Junior School', mockClasses)).toBe(false);
    expect(isExaminationFullyApproved(updated, mockClasses)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST F: Level Reopening
  // --------------------------------------------------------------------------
  it('TEST F: Level Reopening removes only that level streams and leaves other levels intact', async () => {
    // Start with BOTH Junior School and Lower Primary approved
    const examWithTwoLevels: Examination = {
      ...initialExam,
      status: 'Provisional',
      approved_levels: ['Junior School', 'Lower Primary'],
      approved_classes: [
        'st_g7_blue',
        'st_g7_red',
        'st_g8_blue',
        'st_g9_blue',
        'st_g1_blue',
        'st_g2_blue',
        'st_g3_blue',
      ],
    };
    setStorage(KEYS.EXAMS, [examWithTwoLevels]);

    // Reopen Junior School
    const updated = await api.updateExaminationLevelApproval(
      'exam_term1_2026',
      'Junior School',
      false,
      mockAdminUser
    );

    // Junior School level and streams removed
    expect(updated.approved_levels).not.toContain('Junior School');
    expect(updated.approved_classes).not.toContain('st_g7_blue');
    expect(updated.approved_classes).not.toContain('st_g7_red');
    expect(updated.approved_classes).not.toContain('st_g8_blue');
    expect(updated.approved_classes).not.toContain('st_g9_blue');

    // Lower Primary level and streams completely preserved
    expect(updated.approved_levels).toContain('Lower Primary');
    expect(updated.approved_classes).toContain('st_g1_blue');
    expect(updated.approved_classes).toContain('st_g2_blue');
    expect(updated.approved_classes).toContain('st_g3_blue');

    expect(isLevelApproved(updated, 'Lower Primary')).toBe(true);
    expect(isLevelApproved(updated, 'Junior School')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST G: Parallel Marking Workflows
  // --------------------------------------------------------------------------
  it('TEST G: Parallel Marking Workload allows Lower Primary to lock while Junior School is still in progress', async () => {
    // Lower Primary complete -> Admin approves Lower Primary
    const updated = await api.updateExaminationLevelApproval(
      'exam_term1_2026',
      'Lower Primary',
      true,
      mockAdminUser
    );

    expect(isLevelApproved(updated, 'Lower Primary')).toBe(true);
    expect(isLevelApproved(updated, 'Junior School')).toBe(false);
    expect(isLevelApproved(updated, 'Upper Primary')).toBe(false);

    // Examination status is Provisional (not forcing entire school to wait)
    expect(updated.status).toBe('Provisional');

    // Teachers in Junior School can still enter marks because JS is unapproved
    const jsStream = mockClasses.find((c) => c.stream_id === 'st_g7_blue')!;
    expect(isClassExamApproved(updated, jsStream)).toBe(false);

    // Lower Primary streams are safely locked
    const lpStream = mockClasses.find((c) => c.stream_id === 'st_g1_blue')!;
    expect(isClassExamApproved(updated, lpStream)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST H: Security & RBAC Enforcement
  // --------------------------------------------------------------------------
  it('TEST H: Security & RBAC prevents Class Teacher from approving unassigned streams or levels', async () => {
    // 1. Class Teacher cannot approve an unassigned stream
    await expect(
      api.updateExaminationClassApproval(
        'exam_term1_2026',
        'st_g7_red', // assigned to t_g7r, not t_g7b
        true,
        mockClassTeacherG7Blue
      )
    ).rejects.toThrow(/UNAUTHORIZED/);

    // 2. Class Teacher cannot approve an education level (Admin only)
    await expect(
      api.updateExaminationLevelApproval(
        'exam_term1_2026',
        'Junior School',
        true,
        mockClassTeacherG7Blue
      )
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});
