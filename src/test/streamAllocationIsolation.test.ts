import { describe, it, expect } from 'vitest';
import {
  getAccessibleSubjects,
  getAccessibleClasses,
  canUserEditSubjectMarks,
  canUserEditClassAndSubjectMarks,
  isAllocationForClassStream,
} from '../utils/rbacUtils';
import { Teacher, ClassStream, User, Subject } from '../types';

describe('Stream Allocation Isolation Verification (Issue: Cross-Stream Allocation Leakage)', () => {
  // Test Case replicating exact production scenario:
  // Mr Gideon is allocated:
  // - Pre-Technical Studies in Grade 8 Red
  // - Agriculture in Grade 8 Blue
  // Mr Patrick is allocated:
  // - Pre-Technical Studies in Grade 8 Blue
  // Mr Brian is Class Teacher for Grade 8 Blue.

  const grade8ClassId = 'c79816ee-1324-4abb-b5ad-d974f232b2ad';
  const grade8RedStreamId = '8eb5e4a0-2c5a-46be-bcff-b109216e9cd8';
  const grade8BlueStreamId = '8a9c07bb-1bbf-4d99-85be-3468a6457305';

  const classes: ClassStream[] = [
    {
      id: grade8ClassId,
      class_name: 'Grade 8',
      stream: 'Red',
      stream_id: grade8RedStreamId,
      education_level: 'Junior School',
    },
    {
      id: grade8ClassId,
      class_name: 'Grade 8',
      stream: 'Blue',
      stream_id: grade8BlueStreamId,
      education_level: 'Junior School',
      class_teacher_id: 'tch_brian',
    },
  ];

  const subjects: Subject[] = [
    { id: 'sub_pretech', subject_name: 'Pre-Technical Studies', subject_code: 'PRE-TECH', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_agn', subject_name: 'Agriculture', subject_code: 'AGN', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Junior School' },
  ];

  const mrGideonUser: User = {
    id: 'usr_gideon',
    name: 'Mr Gideon',
    email: 'gideon@cbe.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_gideon',
  };

  const mrGideonTeacher: Teacher = {
    id: 'tch_gideon',
    user_id: 'usr_gideon',
    teacher_name: 'Mr Gideon',
    email: 'gideon@cbe.ac.ke',
    phone: '0700000001',
    is_class_teacher: true,
    class_teacher_of_id: 'str_g7_red', // Class teacher of Grade 7 Red, NOT Grade 8
    allocations: [
      {
        id: 'alloc_gideon_pretech_red',
        class_id: grade8ClassId,
        stream_id: grade8RedStreamId,
        class_name: 'Grade 8',
        stream: 'Red',
        subject_id: 'sub_pretech',
        subject_name: 'Pre-Technical Studies',
        subject_code: 'PRE-TECH',
        education_level: 'Junior School',
      },
      {
        id: 'alloc_gideon_agn_blue',
        class_id: grade8ClassId,
        stream_id: grade8BlueStreamId,
        class_name: 'Grade 8',
        stream: 'Blue',
        subject_id: 'sub_agn',
        subject_name: 'Agriculture',
        subject_code: 'AGN',
        education_level: 'Junior School',
      },
    ],
  };

  it('verifies that Mr Gideon selecting Grade 8 Blue only gets Agriculture and NEVER Pre-Technical Studies', () => {
    const accessibleInBlue = getAccessibleSubjects(
      mrGideonUser,
      mrGideonTeacher,
      subjects,
      grade8BlueStreamId,
      classes
    );

    expect(accessibleInBlue).toHaveLength(1);
    expect(accessibleInBlue[0].id).toBe('sub_agn');
    expect(accessibleInBlue[0].subject_code).toBe('AGN');
    expect(accessibleInBlue.some((s) => s.id === 'sub_pretech')).toBe(false);
  });

  it('verifies that Mr Gideon selecting Grade 8 Red only gets Pre-Technical Studies and NEVER Agriculture', () => {
    const accessibleInRed = getAccessibleSubjects(
      mrGideonUser,
      mrGideonTeacher,
      subjects,
      grade8RedStreamId,
      classes
    );

    expect(accessibleInRed).toHaveLength(1);
    expect(accessibleInRed[0].id).toBe('sub_pretech');
    expect(accessibleInRed[0].subject_code).toBe('PRE-TECH');
    expect(accessibleInRed.some((s) => s.id === 'sub_agn')).toBe(false);
  });

  it('verifies canUserEditSubjectMarks blocks Mr Gideon from editing Pre-Technical Studies in Grade 8 Blue', () => {
    // Can edit Agriculture in Grade 8 Blue
    expect(
      canUserEditSubjectMarks(mrGideonUser, mrGideonTeacher, 'sub_agn', grade8BlueStreamId, classes)
    ).toBe(true);

    // CANNOT edit Pre-Tech in Grade 8 Blue
    expect(
      canUserEditSubjectMarks(mrGideonUser, mrGideonTeacher, 'sub_pretech', grade8BlueStreamId, classes)
    ).toBe(false);

    // Can edit Pre-Tech in Grade 8 Red
    expect(
      canUserEditSubjectMarks(mrGideonUser, mrGideonTeacher, 'sub_pretech', grade8RedStreamId, classes)
    ).toBe(true);
  });

  it('verifies canUserEditClassAndSubjectMarks enforces strict stream isolation', () => {
    expect(
      canUserEditClassAndSubjectMarks(mrGideonUser, mrGideonTeacher, grade8BlueStreamId, 'sub_pretech', classes)
    ).toBe(false);

    expect(
      canUserEditClassAndSubjectMarks(mrGideonUser, mrGideonTeacher, grade8BlueStreamId, 'sub_agn', classes)
    ).toBe(true);
  });

  it('verifies isAllocationForClassStream unit helper directly', () => {
    const preTechAlloc = mrGideonTeacher.allocations![0];
    const agnAlloc = mrGideonTeacher.allocations![1];

    const blueStream = classes.find((c) => c.stream_id === grade8BlueStreamId);
    const redStream = classes.find((c) => c.stream_id === grade8RedStreamId);

    // Pre-Tech (Red) against Blue
    expect(isAllocationForClassStream(preTechAlloc, grade8BlueStreamId, blueStream)).toBe(false);

    // Pre-Tech (Red) against Red
    expect(isAllocationForClassStream(preTechAlloc, grade8RedStreamId, redStream)).toBe(true);

    // Agriculture (Blue) against Blue
    expect(isAllocationForClassStream(agnAlloc, grade8BlueStreamId, blueStream)).toBe(true);

    // Agriculture (Blue) against Red
    expect(isAllocationForClassStream(agnAlloc, grade8RedStreamId, redStream)).toBe(false);
  });
});
