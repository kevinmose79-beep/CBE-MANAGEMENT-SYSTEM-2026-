import { describe, it, expect } from 'vitest';
import { canUserEditClassAndSubjectMarks, canUserEditSubjectMarks, canUserEditClassMarks } from '../utils/rbacUtils';
import { Teacher, ClassStream, User } from '../types';

describe('RBAC Rule: A class teacher can edit marks for only learning areas in their respective classes', () => {
  const adminUser: User = {
    id: 'usr_admin',
    username: 'admin',
    email: 'admin@school.com',
    role: 'admin',
    name: 'Administrator',
  };

  const classTeacherUser: User = {
    id: 'usr_ct',
    username: 'brian',
    email: 'brian@school.com',
    role: 'class_teacher',
    name: 'Brian Ayiecha',
  };

  const subjectTeacherUser: User = {
    id: 'usr_st',
    username: 'mary',
    email: 'mary@school.com',
    role: 'subject_teacher',
    name: 'Mary Wanjiku',
  };

  const classes: ClassStream[] = [
    {
      id: 'cls_g9_red',
      education_level: 'Junior School',
      class_name: 'Grade 9',
      stream: 'Red',
      stream_id: 'stream_g9_red',
      class_teacher_id: 'tch_brian',
    },
    {
      id: 'cls_g9_blue',
      education_level: 'Junior School',
      class_name: 'Grade 9',
      stream: 'Blue',
      stream_id: 'stream_g9_blue',
      class_teacher_id: 'tch_other',
    },
    {
      id: 'cls_g8_green',
      education_level: 'Junior School',
      class_name: 'Grade 8',
      stream: 'Green',
      stream_id: 'stream_g8_green',
      class_teacher_id: 'tch_other2',
    },
  ];

  // Brian is Class Teacher of Grade 9 Red, and also allocated Subject Teacher for Mathematics in Grade 8 Green
  const brianTeacher: Teacher = {
    id: 'tch_brian',
    user_id: 'usr_ct',
    teacher_name: 'Brian Ayiecha',
    email: 'brian@school.com',
    phone: '0712345678',
    is_class_teacher: true,
    class_teacher_of_id: 'stream_g9_red',
    allocations: [
      {
        id: 'alloc_01',
        education_level: 'Junior School',
        class_id: 'cls_g8_green',
        stream_id: 'stream_g8_green',
        subject_id: 'sub_mat',
        subject_name: 'Mathematics',
        class_name: 'Grade 8',
        stream: 'Green',
      },
    ],
  };

  // Mary is only Subject Teacher for English in Grade 9 Red and Grade 9 Blue
  const maryTeacher: Teacher = {
    id: 'tch_mary',
    user_id: 'usr_st',
    teacher_name: 'Mary Wanjiku',
    email: 'mary@school.com',
    phone: '0798765432',
    is_class_teacher: false,
    allocations: [
      {
        id: 'alloc_02',
        education_level: 'Junior School',
        class_id: 'cls_g9_red',
        stream_id: 'stream_g9_red',
        subject_id: 'sub_eng',
        subject_name: 'English',
        class_name: 'Grade 9',
        stream: 'Red',
      },
    ],
  };

  it('1. Class teacher CAN edit marks for ALL learning areas in their respective class (Grade 9 Red)', () => {
    // English (allocated or unallocated) in Grade 9 Red
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g9_red', 'sub_eng', classes, false)
    ).toBe(true);

    // Mathematics in Grade 9 Red
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g9_red', 'sub_mat', classes, false)
    ).toBe(true);

    // Integrated Science (completely unallocated) in Grade 9 Red (new and existing marks)
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g9_red', 'sub_sci', classes, false)
    ).toBe(true);
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g9_red', 'sub_sci', classes, true)
    ).toBe(true);

    // Subject marks check for their class
    expect(
      canUserEditSubjectMarks(classTeacherUser, brianTeacher, 'sub_sci', 'stream_g9_red', classes, false)
    ).toBe(true);
  });

  it('2. Class teacher CANNOT edit marks for unallocated learning areas in other classes (Grade 9 Blue)', () => {
    // Brian is NOT class teacher of Grade 9 Blue and has no allocation there
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g9_blue', 'sub_sci', classes, false)
    ).toBe(false);
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g9_blue', 'sub_mat', classes, false)
    ).toBe(false);

    expect(
      canUserEditSubjectMarks(classTeacherUser, brianTeacher, 'sub_sci', 'stream_g9_blue', classes, false)
    ).toBe(false);
  });

  it('3. Class teacher CAN edit marks for allocated subject in another class where they are subject teacher', () => {
    // Brian is allocated Mathematics in Grade 8 Green
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g8_green', 'sub_mat', classes, false)
    ).toBe(true);

    // But CANNOT edit Science in Grade 8 Green
    expect(
      canUserEditClassAndSubjectMarks(classTeacherUser, brianTeacher, 'stream_g8_green', 'sub_sci', classes, false)
    ).toBe(false);
  });

  it('4. Subject-only teacher can only edit allocated subjects', () => {
    // Mary can edit English in Grade 9 Red
    expect(
      canUserEditClassAndSubjectMarks(subjectTeacherUser, maryTeacher, 'stream_g9_red', 'sub_eng', classes, false)
    ).toBe(true);

    // Mary cannot edit Science in Grade 9 Red
    expect(
      canUserEditClassAndSubjectMarks(subjectTeacherUser, maryTeacher, 'stream_g9_red', 'sub_sci', classes, false)
    ).toBe(false);
  });

  it('5. Admin has full edit access everywhere', () => {
    expect(
      canUserEditClassAndSubjectMarks(adminUser, null, 'stream_g9_blue', 'sub_sci', classes, false)
    ).toBe(true);
  });
});
