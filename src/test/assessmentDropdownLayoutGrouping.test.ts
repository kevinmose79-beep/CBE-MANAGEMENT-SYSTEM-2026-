import { describe, it, expect } from 'vitest';
import {
  formatExamTitleCase,
  getCleanExamDropdownTitle,
  groupExamsForDropdown,
} from '../utils/examDisplayUtils';
import { Examination } from '../types';

describe('Assessment Dropdown Mobile-Optimized Grouping & Clean Layout', () => {
  it('formats all-caps exam names into title case while preserving acronyms', () => {
    expect(formatExamTitleCase('GRADE 9 KJSEA SECOND TRIAL TERM 3 2026')).toBe(
      'Grade 9 KJSEA Second Trial Term 3 2026'
    );
    expect(formatExamTitleCase('GRADE 6 KPSEA SECOND TRIAL TERM 3 2026')).toBe(
      'Grade 6 KPSEA Second Trial Term 3 2026'
    );
    expect(formatExamTitleCase('Grade 9 Opener Assessment Term 3 2026')).toBe(
      'Grade 9 Opener Assessment Term 3 2026'
    );
  });

  it('cleans redundant trailing term and year from dropdown titles', () => {
    expect(
      getCleanExamDropdownTitle({
        exam_name: 'Grade 9 Opener Assessment Term 3 2026',
      })
    ).toBe('Grade 9 Opener Assessment');

    expect(
      getCleanExamDropdownTitle({
        exam_name: 'GRADE 9 KJSEA SECOND TRIAL TERM 3 2026',
      })
    ).toBe('Grade 9 KJSEA Second Trial');

    expect(
      getCleanExamDropdownTitle({
        exam_name: 'GRADE 6 KPSEA SECOND TRIAL TERM 3 2026',
      })
    ).toBe('Grade 6 KPSEA Second Trial');

    expect(
      getCleanExamDropdownTitle({
        exam_name: 'Grade 6 Opener Assessment (Term 3 2026)',
      })
    ).toBe('Grade 6 Opener Assessment');
  });

  it('groups exams by Active Session and Previous Sessions with clean labels', () => {
    const mockExams: Examination[] = [
      {
        id: 'exam-1',
        exam_name: 'Grade 9 Opener Assessment Term 3 2026',
        term: 'Term 3',
        year: 2026,
        status: 'Provisional',
        exam_type: 'Opener',
        max_marks: 100,
      },
      {
        id: 'exam-2',
        exam_name: 'GRADE 9 KJSEA SECOND TRIAL TERM 3 2026',
        term: 'Term 3',
        year: 2026,
        status: 'Provisional',
        exam_type: 'Custom',
        max_marks: 100,
      },
      {
        id: 'exam-3',
        exam_name: 'GRADE 6 KPSEA SECOND TRIAL TERM 3 2026',
        term: 'Term 3',
        year: 2026,
        status: 'Provisional',
        exam_type: 'Custom',
        max_marks: 100,
      },
      {
        id: 'exam-4',
        exam_name: 'Grade 6 Opener Assessment Term 3 2026',
        term: 'Term 3',
        year: 2026,
        status: 'Draft',
        exam_type: 'Opener',
        max_marks: 100,
      },
      {
        id: 'exam-5',
        exam_name: 'Grade 9 Mid-Term Assessment',
        term: 'Term 2',
        year: 2026,
        status: 'Published',
        exam_type: 'Mid-Term',
        max_marks: 100,
      },
    ];

    const groups = groupExamsForDropdown(mockExams, 2026, 'Term 3');

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('ACTIVE SESSION (Term 3 • 2026)');
    expect(groups[0].exams).toHaveLength(4);

    expect(groups[0].exams[0].label).toBe('Grade 9 Opener Assessment [Provisional]');
    expect(groups[0].exams[1].label).toBe('Grade 9 KJSEA Second Trial [Provisional]');
    expect(groups[0].exams[2].label).toBe('Grade 6 KPSEA Second Trial [Provisional]');
    expect(groups[0].exams[3].label).toBe('Grade 6 Opener Assessment [Draft]');

    expect(groups[1].label).toBe('PREVIOUS SESSIONS');
    expect(groups[1].exams).toHaveLength(1);
    expect(groups[1].exams[0].label).toBe('Grade 9 Mid-Term Assessment (Term 2 2026)');
  });
});
