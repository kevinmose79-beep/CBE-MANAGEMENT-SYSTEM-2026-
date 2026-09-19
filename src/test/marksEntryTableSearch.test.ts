import { describe, test, expect } from 'vitest';
import { Student } from '../types';

describe('MarksEntryTable Real-Time Search Filtering', () => {
  const students: Student[] = [
    {
      id: 'std_01',
      admission_number: 'ADM-2024-001',
      full_name: 'Faith Achieng',
      gender: 'F',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
    {
      id: 'std_02',
      admission_number: 'ADM-2024-002',
      full_name: 'Brian Kiprop',
      gender: 'M',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
    {
      id: 'std_03',
      admission_number: 'ADM-2024-003',
      first_name: 'Grace',
      last_name: 'Wanjiku',
      full_name: 'Grace Wanjiku',
      gender: 'F',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      active: true,
      education_level: 'Junior School',
      grade: 'Grade 8',
    },
  ];

  const filterStudents = (list: Student[], query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((std) => {
      const fullName = (std.full_name || `${std.first_name || ''} ${std.last_name || ''}`).toLowerCase();
      const admNo = (std.admission_number || '').toLowerCase();
      return fullName.includes(q) || admNo.includes(q);
    });
  };

  test('returns all students when search query is empty', () => {
    const result = filterStudents(students, '');
    expect(result.length).toBe(3);
  });

  test('filters students by full name (case insensitive)', () => {
    const result = filterStudents(students, 'achieng');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('std_01');
  });

  test('filters students by first name and last name fallback', () => {
    const result = filterStudents(students, 'wanjiku');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('std_03');
  });

  test('filters students by admission number', () => {
    const result = filterStudents(students, '002');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('std_02');
  });

  test('returns empty array when no student matches', () => {
    const result = filterStudents(students, 'NonExistent');
    expect(result.length).toBe(0);
  });
});
