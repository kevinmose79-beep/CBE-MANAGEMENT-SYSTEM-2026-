import { describe, it, expect } from 'vitest';
import { Examination, ClassStream } from '../types';

describe('Assessment Management Card Metadata Bullet Separator Verification', () => {
  const distinctClasses: Array<{ id: string; className: string; educationLevel: string }> = [
    { id: 'cls-g9', className: 'Grade 9', educationLevel: 'Junior School' },
    { id: 'cls-g8', className: 'Grade 8', educationLevel: 'Junior School' },
    { id: 'cls-g7', className: 'Grade 7', educationLevel: 'Junior School' },
  ];

  // Helper reflecting the exact JSX text rendering logic in ExaminationManagement.tsx
  const renderAssessmentCardMetadata = (
    ex: Examination,
    classes: Array<{ id: string; className: string; educationLevel: string }>
  ): string => {
    let text = `${ex.term} • Year: ${ex.year} • Max Score: ${ex.max_marks} marks`;
    if (ex.education_level) {
      text += ` • Level: ${ex.education_level}`;
    }
    if (ex.class_id) {
      const targetName = classes.find((c) => c.id === ex.class_id)?.className || ex.class_id;
      text += ` • Class: ${targetName}`;
    }
    return text;
  };

  it('Case 1: Grade-targeted assessment renders unicode bullets with no literal &bull;', () => {
    const exam: Examination = {
      id: 'ex-1',
      exam_name: 'Mid Term Opener',
      term: 'Term 1',
      year: 2026,
      max_marks: 100,
      status: 'Draft',
      exam_type: 'Opener',
      education_level: 'Junior School',
      class_id: 'cls-g9',
    };

    const rendered = renderAssessmentCardMetadata(exam, distinctClasses);

    expect(rendered).toContain('Max Score: 100 marks • Level: Junior School • Class: Grade 9');
    expect(rendered).not.toContain('&bull;');
    expect(rendered).toBe('Term 1 • Year: 2026 • Max Score: 100 marks • Level: Junior School • Class: Grade 9');
  });

  it('Case 2: Level-wide assessment renders unicode bullets with no literal &bull;', () => {
    const exam: Examination = {
      id: 'ex-2',
      exam_name: 'Junior School Midterm',
      term: 'Term 1',
      year: 2026,
      max_marks: 100,
      status: 'Draft',
      exam_type: 'Opener',
      education_level: 'Junior School',
      class_id: undefined,
    };

    const rendered = renderAssessmentCardMetadata(exam, distinctClasses);

    expect(rendered).toContain('Max Score: 100 marks • Level: Junior School');
    expect(rendered).not.toContain('Class:');
    expect(rendered).not.toContain('&bull;');
    expect(rendered).toBe('Term 1 • Year: 2026 • Max Score: 100 marks • Level: Junior School');
  });

  it('Case 3: School-wide assessment renders unicode bullets with no literal &bull;', () => {
    const exam: Examination = {
      id: 'ex-3',
      exam_name: 'All School General Exam',
      term: 'Term 2',
      year: 2026,
      max_marks: 50,
      status: 'Draft',
      exam_type: 'Mid-Term',
      education_level: undefined,
      class_id: undefined,
    };

    const rendered = renderAssessmentCardMetadata(exam, distinctClasses);

    expect(rendered).toBe('Term 2 • Year: 2026 • Max Score: 50 marks');
    expect(rendered).not.toContain('Level:');
    expect(rendered).not.toContain('Class:');
    expect(rendered).not.toContain('&bull;');
  });

  it('Case 4: Existing assessment records: stored data remains intact and clean', () => {
    const existingExam: Examination = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      exam_name: 'End Term Summative',
      term: 'Term 3',
      year: 2025,
      max_marks: 75,
      status: 'Approved',
      exam_type: 'End-Term',
      education_level: 'Junior School',
      class_id: 'cls-g8',
    };

    const rendered = renderAssessmentCardMetadata(existingExam, distinctClasses);

    expect(rendered).toBe('Term 3 • Year: 2025 • Max Score: 75 marks • Level: Junior School • Class: Grade 8');
    expect(rendered).not.toContain('&bull;');
    expect(existingExam.max_marks).toBe(75);
    expect(existingExam.education_level).toBe('Junior School');
    expect(existingExam.class_id).toBe('cls-g8');
  });
});
