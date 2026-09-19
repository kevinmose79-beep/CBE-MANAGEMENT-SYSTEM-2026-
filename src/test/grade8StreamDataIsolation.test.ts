import { describe, it, expect } from 'vitest';
import { getFilteredStudents } from '../utils/filterUtils';
import { Student, ClassStream } from '../types';

describe('Grade 8 Stream Data Isolation and Accurate Stream Values', () => {
  const grade8ClassId = 'c79816ee-1324-4abb-b5ad-d974f232b2ad';
  const grade8BlueStreamId = '8a9c07bb-1bbf-4d99-85be-3468a6457305';
  const grade8RedStreamId = '8eb5e4a0-2c5a-46be-bcff-b109216e9cd8';

  const classes: ClassStream[] = [
    {
      id: grade8ClassId,
      stream_id: grade8BlueStreamId,
      class_name: 'Grade 8',
      stream: 'Blue',
      capacity: 41,
    },
    {
      id: grade8ClassId,
      stream_id: grade8RedStreamId,
      class_name: 'Grade 8',
      stream: 'Red',
      capacity: 41,
    },
  ];

  const students: Student[] = [
    {
      id: 'std-blue-1',
      admission_number: '240',
      full_name: 'Brian Njehia',
      gender: 'M',
      class_id: grade8ClassId,
      stream_id: grade8BlueStreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-blue-2',
      admission_number: '246',
      full_name: 'Abigael Chelengat',
      gender: 'F',
      class_id: grade8ClassId,
      stream_id: grade8BlueStreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-red-1',
      admission_number: '301',
      full_name: 'David Kiprono',
      gender: 'M',
      class_id: grade8ClassId,
      stream_id: grade8RedStreamId,
      grade: 'Grade 8',
      active: true,
    },
  ];

  it('correctly isolates Grade 8 Blue stream learners without counting Red learners', () => {
    const blueStudents = getFilteredStudents(students, classes, 'Grade 8', 'Blue');
    expect(blueStudents.length).toBe(2);
    expect(blueStudents.map((s) => s.id)).toEqual(['std-blue-1', 'std-blue-2']);
  });

  it('correctly isolates Grade 8 Red stream learners without counting Blue learners', () => {
    const redStudents = getFilteredStudents(students, classes, 'Grade 8', 'Red');
    expect(redStudents.length).toBe(1);
    expect(redStudents.map((s) => s.id)).toEqual(['std-red-1']);
  });

  it('returns all learners for Grade 8 when All Streams is selected', () => {
    const allGrade8 = getFilteredStudents(students, classes, 'Grade 8', 'All Streams');
    expect(allGrade8.length).toBe(3);
  });

  it('correctly filters learners using stream_id directly', () => {
    const redByStreamId = getFilteredStudents(students, classes, grade8ClassId, grade8RedStreamId);
    expect(redByStreamId.length).toBe(1);
    expect(redByStreamId[0].id).toBe('std-red-1');

    const blueByStreamId = getFilteredStudents(students, classes, grade8ClassId, grade8BlueStreamId);
    expect(blueByStreamId.length).toBe(2);
  });
});
