import { describe, it, expect } from 'vitest';
import { ClassStream, Teacher, Student } from '../types';

describe('Learner Portal Class Teacher Resolution', () => {
  const mockTeachers: Teacher[] = [
    {
      id: '9322a268-0567-463c-a121-e7d26c054d6c',
      teacher_name: 'Trixie Mode',
      email: 'trixiemode@school.ac.ke',
      phone: '+254700000000',
      is_class_teacher: true,
      status: 'Active',
    },
    {
      id: 'tch_jane_wanjiku',
      teacher_name: 'Jane Wanjiku',
      email: 'jane.wanjiku@school.ac.ke',
      phone: '+254700000001',
      is_class_teacher: true,
      status: 'Active',
    },
  ];

  const mockClasses: ClassStream[] = [
    {
      id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
      stream_id: '3d0ecb00-3e0f-425a-8d69-59f6c9f18b40',
      class_name: 'Grade 9',
      stream: 'Red',
      class_teacher_id: '9322a268-0567-463c-a121-e7d26c054d6c',
      education_level: 'Junior School',
    },
    {
      id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
      stream_id: 'stream_g9_blue',
      class_name: 'Grade 9',
      stream: 'Blue',
      class_teacher_id: 'tch_jane_wanjiku',
      education_level: 'Junior School',
    },
    {
      id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
      stream_id: 'stream_g9_green_unassigned',
      class_name: 'Grade 9',
      stream: 'Green',
      class_teacher_id: undefined,
      education_level: 'Junior School',
    },
  ];

  function resolveClassTeacherForLearner(
    student: { stream_id?: string; class_id?: string },
    classes: ClassStream[],
    teachers: Teacher[]
  ) {
    const matchedClass =
      (student.stream_id
        ? classes.find((c) => c.stream_id === student.stream_id || c.id === student.stream_id)
        : undefined) ||
      (student.class_id
        ? classes.find((c) => c.id === student.class_id || c.stream_id === student.class_id)
        : undefined);

    const classTeacher = teachers.find(
      (t) =>
        (matchedClass && t.id === matchedClass.class_teacher_id) ||
        (matchedClass && (t.class_teacher_of_id === matchedClass.id || t.class_teacher_of_id === matchedClass.stream_id))
    );

    return {
      matchedClass,
      classTeacher,
      displayName: classTeacher?.teacher_name || 'Not Assigned',
    };
  }

  it('Test 1 — Marcus Jordan in Grade 9 Red resolves Trixie Mode (name only, no email)', () => {
    const marcus = {
      id: 'e534459c-787f-4c3a-b48c-9cb09e34b011',
      admission_number: '230',
      stream_id: '3d0ecb00-3e0f-425a-8d69-59f6c9f18b40',
      class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    };

    const result = resolveClassTeacherForLearner(marcus, mockClasses, mockTeachers);
    expect(result.matchedClass?.stream).toBe('Red');
    expect(result.matchedClass?.class_teacher_id).toBe('9322a268-0567-463c-a121-e7d26c054d6c');
    expect(result.classTeacher?.id).toBe('9322a268-0567-463c-a121-e7d26c054d6c');
    expect(result.displayName).toBe('Trixie Mode');
  });

  it('Test 2 — Unassigned Stream resolves "Not Assigned" when class_teacher_id is undefined/null', () => {
    const unassignedLearner = {
      id: 'std_unassigned',
      admission_number: '999',
      stream_id: 'stream_g9_green_unassigned',
      class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    };

    const result = resolveClassTeacherForLearner(unassignedLearner, mockClasses, mockTeachers);
    expect(result.matchedClass?.stream).toBe('Green');
    expect(result.matchedClass?.class_teacher_id).toBeUndefined();
    expect(result.classTeacher).toBeUndefined();
    expect(result.displayName).toBe('Not Assigned');
  });

  it('Test 3 — Learner in Grade 9 Blue dynamically resolves Jane Wanjiku, never Trixie Mode', () => {
    const blueLearner = {
      id: 'std_blue',
      admission_number: '231',
      stream_id: 'stream_g9_blue',
      class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    };

    const result = resolveClassTeacherForLearner(blueLearner, mockClasses, mockTeachers);
    expect(result.matchedClass?.stream).toBe('Blue');
    expect(result.displayName).toBe('Jane Wanjiku');
    expect(result.displayName).not.toBe('Trixie Mode');
  });
});
