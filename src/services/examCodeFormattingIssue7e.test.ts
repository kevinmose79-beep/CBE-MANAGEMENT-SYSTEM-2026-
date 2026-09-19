import { describe, it, expect } from 'vitest';
import { formatStandardExamCode } from '../utils/filterUtils';
import { Examination } from '../types';

describe('Exam Code Format & Metadata Audit (Issue 7E)', () => {
  it('formats standard exam code for PP1 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('PP1', exam);
    expect(code).toBe('PP1-T2-2026-MT2');
  });

  it('formats standard exam code for PP2 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('PP2', exam);
    expect(code).toBe('PP2-T2-2026-MT2');
  });

  it('formats standard exam code for Grade 1 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 1', exam);
    expect(code).toBe('G1-T2-2026-MT2');
  });

  it('formats standard exam code for Grade 3 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 3', exam);
    expect(code).toBe('G3-T2-2026-MT2');
  });

  it('formats standard exam code for Grade 6 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 6', exam);
    expect(code).toBe('G6-T2-2026-MT2');
  });

  it('formats standard exam code for Grade 7 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 7', exam);
    expect(code).toBe('G7-T2-2026-MT2');
  });

  it('formats standard exam code for Grade 9 Midterm 2', () => {
    const exam: Partial<Examination> = {
      exam_name: 'Midterm 2',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 9', exam);
    expect(code).toBe('G9-T2-2026-MT2');
  });

  it('formats standard exam code for End-Term 2 exam (Grade 7)', () => {
    const exam: Partial<Examination> = {
      exam_name: 'End Term 2 Exam 2026',
      term: 'Term 2',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 7', exam);
    expect(code).toBe('G7-T2-2026-ET2');
  });

  it('formats standard exam code for CAT 1 exam (Grade 1)', () => {
    const exam: Partial<Examination> = {
      exam_name: 'CAT 1 Assessment',
      term: 'Term 1',
      year: 2026,
    };
    const code = formatStandardExamCode('Grade 1', exam);
    expect(code).toBe('G1-T1-2026-CAT1');
  });

  it('never contains ALLSTREAMS or TTERM when raw concatenated strings are passed', () => {
    const exam: any = {
      exam_name: 'Mid-Term Assessment',
      term: 'Term 2',
      year: 2026,
      exam_code: 'PP1(ALLSTREAMS)TTERM 22026', // Legacy concatenated bug
    };
    const code = formatStandardExamCode('PP1 (All Streams)', exam);
    expect(code).toBe('PP1-T2-2026-MT2');
    expect(code).not.toContain('ALLSTREAMS');
    expect(code).not.toContain('TTERM');
  });

  it('preserves clean pre-configured authoritative exam code', () => {
    const exam: any = {
      exam_name: 'Special Assessment',
      term: 'Term 2',
      year: 2026,
      exam_code: 'G8-T2-2026-SPEC',
    };
    const code = formatStandardExamCode('Grade 8', exam);
    expect(code).toBe('G8-T2-2026-SPEC');
  });
});
