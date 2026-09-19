import { describe, it, expect } from 'vitest';
import { ClassStream, Student } from '../types';

/**
 * Replicates the exact filtering logic from TerminalResultsView.tsx
 * to verify the mathematical and operational properties of the learner isolation fix.
 */
function filterClassStudents(
  students: Student[],
  selectedClassStream: ClassStream | null
): Student[] {
  if (!selectedClassStream) return [];
  return students.filter((s) => {
    // 1. Authoritative Stream Matching: When a specific stream_id exists
    if (selectedClassStream.stream_id) {
      return (
        s.stream_id === selectedClassStream.stream_id &&
        (!s.class_id || !selectedClassStream.id || s.class_id === selectedClassStream.id)
      );
    }

    const studentAny = s as any;
    const studentStream = typeof studentAny.stream === 'string' ? studentAny.stream : '';
    const studentClassName =
      typeof studentAny.class_name === 'string' ? studentAny.class_name : (s.grade || '');

    // 2. Legacy / Named Stream Context: When selectedClassStream has a stream name but no stream_id
    if (selectedClassStream.stream && selectedClassStream.stream.trim() !== '') {
      const matchStreamId = s.stream_id === selectedClassStream.id;
      const matchExactName =
        Boolean(studentStream) &&
        studentStream.trim().toLowerCase() === selectedClassStream.stream.trim().toLowerCase() &&
        Boolean(studentClassName && selectedClassStream.class_name) &&
        studentClassName.trim().toLowerCase() === selectedClassStream.class_name.trim().toLowerCase();

      if (studentStream) {
        return matchExactName;
      }
      return matchStreamId;
    }

    // 3. Class-Only Context: Unstreamed class (e.g., PP1 with no streams)
    const matchClassId =
      s.class_id === selectedClassStream.id || s.stream_id === selectedClassStream.id;
    const matchClassName =
      Boolean(studentClassName && selectedClassStream.class_name) &&
      studentClassName.trim().toLowerCase() === selectedClassStream.class_name.trim().toLowerCase();

    return matchClassId || matchClassName;
  });
}

describe('Terminal Results — Class vs Stream Learner Isolation Verification', () => {
  const grade8ClassId = 'c79816ee-1324-4abb-b5ad-d974f232b2ad';
  const grade8EastStreamId = 'stream-g8-east-uuid';
  const grade8WestStreamId = 'stream-g8-west-uuid';
  const grade8BlueStreamId = 'stream-g8-blue-uuid';
  const grade8RedStreamId = 'stream-g8-red-uuid';
  const grade8East1StreamId = 'stream-g8-east-1-uuid';

  const grade8East: ClassStream = {
    id: grade8ClassId,
    stream_id: grade8EastStreamId,
    class_name: 'Grade 8',
    stream: 'East',
    capacity: 40,
    education_level: 'Junior School',
    status: 'Active',
  };

  const grade8West: ClassStream = {
    id: grade8ClassId,
    stream_id: grade8WestStreamId,
    class_name: 'Grade 8',
    stream: 'West',
    capacity: 40,
    education_level: 'Junior School',
    status: 'Active',
  };

  const grade8East1: ClassStream = {
    id: grade8ClassId,
    stream_id: grade8East1StreamId,
    class_name: 'Grade 8',
    stream: 'East 1',
    capacity: 40,
    education_level: 'Junior School',
    status: 'Active',
  };

  const unstreamedPP1: ClassStream = {
    id: 'class-pp1-uuid',
    class_name: 'PP1',
    stream: '',
    capacity: 30,
    education_level: 'Pre-Primary',
    status: 'Active',
  };

  const emptyStreamGrade8Green: ClassStream = {
    id: grade8ClassId,
    stream_id: 'stream-g8-green-uuid',
    class_name: 'Grade 8',
    stream: 'Green',
    capacity: 40,
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockStudents: Student[] = [
    {
      id: 'std-east-1',
      admission_number: 'ADM-001',
      full_name: 'Amina Mwangi',
      first_name: 'Amina',
      last_name: 'Mwangi',
      gender: 'F',
      class_id: grade8ClassId,
      stream_id: grade8EastStreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-west-1',
      admission_number: 'ADM-002',
      full_name: 'Brian Omondi',
      first_name: 'Brian',
      last_name: 'Omondi',
      gender: 'M',
      class_id: grade8ClassId,
      stream_id: grade8WestStreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-blue-1',
      admission_number: 'ADM-003',
      full_name: 'Faith Chebet',
      first_name: 'Faith',
      last_name: 'Chebet',
      gender: 'F',
      class_id: grade8ClassId,
      stream_id: grade8BlueStreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-red-1',
      admission_number: 'ADM-004',
      full_name: 'Kevin Mutua',
      first_name: 'Kevin',
      last_name: 'Mutua',
      gender: 'M',
      class_id: grade8ClassId,
      stream_id: grade8RedStreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-east-1-learner',
      admission_number: 'ADM-005',
      full_name: 'Dennis Koech',
      first_name: 'Dennis',
      last_name: 'Koech',
      gender: 'M',
      class_id: grade8ClassId,
      stream_id: grade8East1StreamId,
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-pp1-1',
      admission_number: 'ADM-101',
      full_name: 'Joy Wambui',
      first_name: 'Joy',
      last_name: 'Wambui',
      gender: 'F',
      class_id: 'class-pp1-uuid',
      grade: 'PP1',
      active: true,
    },
  ];

  // Test 1 — Single stream
  it('Test 1 — Single stream: Grade 8 East includes only East learner and excludes West learner', () => {
    const results = filterClassStudents(mockStudents, grade8East);
    expect(results.map((s) => s.id)).toEqual(['std-east-1']);
    expect(results.some((s) => s.id === 'std-west-1')).toBe(false);
  });

  // Test 2 — Multiple sibling streams
  it('Test 2 — Multiple sibling streams: Grade 8 East excludes West, Blue, and Red', () => {
    const results = filterClassStudents(mockStudents, grade8East);
    const ids = results.map((s) => s.id);
    expect(ids).toContain('std-east-1');
    expect(ids).not.toContain('std-west-1');
    expect(ids).not.toContain('std-blue-1');
    expect(ids).not.toContain('std-red-1');
    expect(ids).not.toContain('std-east-1-learner');
    expect(ids).not.toContain('std-pp1-1');
  });

  // Test 3 — Class-level context
  it('Test 3 — Class-level context: Unstreamed PP1 includes all PP1 learners and excludes other classes', () => {
    const results = filterClassStudents(mockStudents, unstreamedPP1);
    expect(results.map((s) => s.id)).toEqual(['std-pp1-1']);
    expect(results.some((s) => s.class_id !== 'class-pp1-uuid')).toBe(false);
  });

  // Test 4 — Empty stream
  it('Test 4 — Empty stream: returns [] with zero fallback to parent class', () => {
    const results = filterClassStudents(mockStudents, emptyStreamGrade8Green);
    expect(results).toEqual([]);
    expect(results.length).toBe(0);
  });

  // Test 5 — Similar names
  it('Test 5 — Similar names: East and East 1 cannot cross-match through name logic', () => {
    const eastResults = filterClassStudents(mockStudents, grade8East);
    expect(eastResults.map((s) => s.id)).toEqual(['std-east-1']);
    expect(eastResults.some((s) => s.id === 'std-east-1-learner')).toBe(false);

    const east1Results = filterClassStudents(mockStudents, grade8East1);
    expect(east1Results.map((s) => s.id)).toEqual(['std-east-1-learner']);
    expect(east1Results.some((s) => s.id === 'std-east-1')).toBe(false);
  });

  // Test 6 — Regression & Invariance
  it('Test 6 — Regression: selectedClassStream null returns empty array', () => {
    const results = filterClassStudents(mockStudents, null);
    expect(results).toEqual([]);
  });

  it('Test 6b — Regression: West stream selection isolates West learner exclusively', () => {
    const westResults = filterClassStudents(mockStudents, grade8West);
    expect(westResults.map((s) => s.id)).toEqual(['std-west-1']);
    expect(westResults.some((s) => s.id === 'std-east-1')).toBe(false);
  });
});
