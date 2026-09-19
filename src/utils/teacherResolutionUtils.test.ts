import { describe, it, expect } from 'vitest';
import { resolveSubjectTeacher } from './teacherResolutionUtils';
import { Teacher } from '../types';

describe('resolveSubjectTeacher', () => {
  const teacherA: Teacher = {
    id: 'tch-a',
    teacher_name: 'Mr. East Teacher',
    email: 'easta@test.com',
    phone: '0700000001',
    allocations: [
      {
        id: 'alloc-1',
        education_level: 'Junior School',
        subject_id: 'subj-math',
        class_id: 'class-grade-7',
        stream_id: 'stream-7-east',
      },
      {
        id: 'alloc-2',
        education_level: 'Junior School',
        subject_id: 'subj-eng',
        class_id: 'class-grade-7',
        stream_id: 'stream-7-east',
      },
    ],
  };

  const teacherB: Teacher = {
    id: 'tch-b',
    teacher_name: 'Mrs. West Teacher',
    email: 'westb@test.com',
    phone: '0700000002',
    allocations: [
      {
        id: 'alloc-3',
        education_level: 'Junior School',
        subject_id: 'subj-math',
        class_id: 'class-grade-7',
        stream_id: 'stream-7-west',
      },
    ],
  };

  const teacherFallback: Teacher = {
    id: 'tch-fallback',
    teacher_name: 'Dr. Whole Class Teacher',
    email: 'fallback@test.com',
    phone: '0700000003',
    allocations: [
      {
        id: 'alloc-4',
        education_level: 'Junior School',
        subject_id: 'subj-science',
        class_id: 'class-grade-7',
        // stream_id is intentionally omitted (whole class allocation)
      },
    ],
  };

  const teachers = [teacherA, teacherB, teacherFallback];

  it('resolves stream-specific teacher when exact stream_id matches', () => {
    // Grade 7 East learner taking Math -> should resolve Teacher A
    const resultEast = resolveSubjectTeacher(teachers, 'subj-math', 'class-grade-7', 'stream-7-east');
    expect(resultEast).toBeDefined();
    expect(resultEast?.id).toBe('tch-a');
    expect(resultEast?.teacher_name).toBe('Mr. East Teacher');

    // Grade 7 West learner taking Math -> should resolve Teacher B
    const resultWest = resolveSubjectTeacher(teachers, 'subj-math', 'class-grade-7', 'stream-7-west');
    expect(resultWest).toBeDefined();
    expect(resultWest?.id).toBe('tch-b');
    expect(resultWest?.teacher_name).toBe('Mrs. West Teacher');
  });

  it('prevents teacher leakage between sibling streams of the same class', () => {
    // West learner taking English: Teacher A teaches English only in East stream.
    // West stream has NO English teacher allocated.
    // The resolver MUST NOT leak Teacher A to West stream even though both are class-grade-7!
    const resultWestEng = resolveSubjectTeacher(teachers, 'subj-eng', 'class-grade-7', 'stream-7-west');
    expect(resultWestEng).toBeUndefined();
  });

  it('falls back to class-level allocation ONLY when allocation has no stream_id', () => {
    // Science is allocated to the whole class without a stream_id.
    // Both East and West learners should resolve Dr. Whole Class Teacher.
    const resultEastScience = resolveSubjectTeacher(teachers, 'subj-science', 'class-grade-7', 'stream-7-east');
    expect(resultEastScience).toBeDefined();
    expect(resultEastScience?.id).toBe('tch-fallback');

    const resultWestScience = resolveSubjectTeacher(teachers, 'subj-science', 'class-grade-7', 'stream-7-west');
    expect(resultWestScience).toBeDefined();
    expect(resultWestScience?.id).toBe('tch-fallback');
  });

  it('returns undefined when subject is not allocated to anyone in the target class or stream', () => {
    const result = resolveSubjectTeacher(teachers, 'subj-unallocated', 'class-grade-7', 'stream-7-east');
    expect(result).toBeUndefined();
  });

  it('handles missing or empty arguments gracefully', () => {
    expect(resolveSubjectTeacher([], 'subj-math', 'class-grade-7', 'stream-7-east')).toBeUndefined();
    expect(resolveSubjectTeacher(teachers, '', 'class-grade-7', 'stream-7-east')).toBeUndefined();
    expect(resolveSubjectTeacher(teachers, 'subj-math', '', '')).toBeUndefined();
    expect(resolveSubjectTeacher(undefined, 'subj-math', 'class-grade-7', 'stream-7-east')).toBeUndefined();
  });
});
