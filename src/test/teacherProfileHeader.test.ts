import { describe, it, expect } from 'vitest';
import { Teacher, ClassStream } from '../types';

describe('Teacher Dashboard Profile Header Layout & Logic Verification', () => {
  const mockTeacher: Teacher = {
    id: 'tch_01',
    user_id: 'usr_01',
    teacher_name: 'BRIAN AYIECHA',
    email: 'brian.ayiecha@school.com',
    phone: '0712345678',
    is_class_teacher: true,
    class_teacher_of_id: 'stream_g9_red',
    allocations: [],
  };

  const mockClasses: ClassStream[] = [
    {
      id: 'cls_g9_red',
      education_level: 'Junior School',
      class_name: 'Grade 9',
      stream: 'Red',
      stream_id: 'stream_g9_red',
      class_teacher_id: 'tch_01',
    },
  ];

  it('1. Extracts correct initials for circular avatar', () => {
    const getTeacherInitials = (name: string): string => {
      if (!name || typeof name !== 'string') return 'TR';
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'TR';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    expect(getTeacherInitials('BRIAN AYIECHA')).toBe('BA');
    expect(getTeacherInitials('Kiprono Dennis')).toBe('KD');
    expect(getTeacherInitials('Faith')).toBe('FA');
    expect(getTeacherInitials('')).toBe('TR');
  });

  it('2. Formats Class Teacher role and class title correctly', () => {
    const primaryClasses = mockClasses.filter(
      (c) =>
        c.class_teacher_id === mockTeacher.id ||
        (mockTeacher.is_class_teacher &&
          mockTeacher.class_teacher_of_id &&
          ((c.stream_id && c.stream_id === mockTeacher.class_teacher_of_id) ||
            c.id === mockTeacher.class_teacher_of_id))
    );

    const primaryClassTitle =
      primaryClasses.length > 0
        ? primaryClasses.map((c) => (c.stream ? `${c.class_name} ${c.stream}` : c.class_name)).join(', ')
        : 'Class Teacher';

    expect(primaryClassTitle).toBe('Grade 9 Red');

    const roleBadgeText = `Class Teacher • ${primaryClassTitle}`;
    expect(roleBadgeText).toBe('Class Teacher • Grade 9 Red');
  });

  it('3. Formats Subject Teacher fallback role when not assigned as Class Teacher', () => {
    const subjectOnlyTeacher: Teacher = {
      id: 'tch_02',
      teacher_name: 'MARY WANJIKU',
      email: 'mary@school.com',
      phone: '0799887766',
      is_class_teacher: false,
      allocations: [],
    };

    const isClassTeacher = Boolean(subjectOnlyTeacher.is_class_teacher);
    const roleText = isClassTeacher ? 'Class Teacher' : 'Subject Teacher';
    expect(roleText).toBe('Subject Teacher');
  });

  it('4. Formats contact information cleanly under all 4 presence states', () => {
    const cleanVal = (val?: string | null) => {
      if (!val) return null;
      const trimmed = val.trim();
      if (!trimmed || trimmed.toUpperCase() === 'N/A' || trimmed.toUpperCase() === 'NONE' || trimmed.toUpperCase() === 'NULL' || trimmed.toUpperCase() === 'UNDEFINED') {
        return null;
      }
      return trimmed;
    };

    const formatContactLine = (phone?: string | null, email?: string | null) => {
      const p = cleanVal(phone);
      const e = cleanVal(email);
      if (!p && !e) return null;
      if (p && e) return `Phone: ${p} • Email: ${e}`;
      if (p) return `Phone: ${p}`;
      return `Email: ${e}`;
    };

    // Both available
    expect(formatContactLine('0712 345 678', 'teacher@example.com')).toBe('Phone: 0712 345 678 • Email: teacher@example.com');

    // Phone only (email null, undefined, empty, or 'N/A')
    expect(formatContactLine('0712 345 678', null)).toBe('Phone: 0712 345 678');
    expect(formatContactLine('0712 345 678', '')).toBe('Phone: 0712 345 678');
    expect(formatContactLine('0712 345 678', '  ')).toBe('Phone: 0712 345 678');
    expect(formatContactLine('0712 345 678', 'N/A')).toBe('Phone: 0712 345 678');

    // Email only (phone null, undefined, empty, or 'N/A')
    expect(formatContactLine(null, 'teacher@example.com')).toBe('Email: teacher@example.com');
    expect(formatContactLine('', 'teacher@example.com')).toBe('Email: teacher@example.com');
    expect(formatContactLine('   ', 'teacher@example.com')).toBe('Email: teacher@example.com');
    expect(formatContactLine('N/A', 'teacher@example.com')).toBe('Email: teacher@example.com');

    // Neither available
    expect(formatContactLine(null, null)).toBeNull();
    expect(formatContactLine('', '')).toBeNull();
    expect(formatContactLine('   ', '   ')).toBeNull();
    expect(formatContactLine('N/A', 'N/A')).toBeNull();
    expect(formatContactLine(undefined, 'N/A')).toBeNull();
  });
});
