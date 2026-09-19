import { describe, it, expect } from 'vitest';
import { ClassStream, Examination, LEVEL_TO_GRADES } from '../types';

describe('Marks Monitoring Target Class vs Education Level Scope Display Logic', () => {
  const mockClasses: ClassStream[] = [
    {
      id: 'cls_uuid_g9',
      stream_id: 'strm_uuid_g9_blue',
      class_name: 'Grade 9',
      stream: 'Blue',
      education_level: 'Junior School',
      status: 'Active',
    },
    {
      id: 'cls_uuid_g9',
      stream_id: 'strm_uuid_g9_red',
      class_name: 'Grade 9',
      stream: 'Red',
      education_level: 'Junior School',
      status: 'Active',
    },
    {
      id: 'cls_uuid_g8',
      stream_id: 'strm_uuid_g8_green',
      class_name: 'Grade 8',
      stream: 'Green',
      education_level: 'Junior School',
      status: 'Active',
    },
  ];

  // Helper matching MarksMonitoringView logic
  function resolveDisplayLabels(selectedExam: Examination | null, classes: ClassStream[]) {
    if (!selectedExam) {
      return {
        title: 'School Overall Summary',
        subtitle: '(PP1–PP2 & Grades 1–9 Combined)',
        isTargetClassExam: false,
        targetClassName: '',
      };
    }

    const targetClass =
      selectedExam.class_id && selectedExam.class_id !== 'all'
        ? classes.find((c) => c.id === selectedExam.class_id) || null
        : null;

    const isTargetClassExam = Boolean(
      targetClass || (selectedExam.class_id && selectedExam.class_id !== 'all')
    );
    const targetClassName = targetClass?.class_name || 'Target Class';

    const title = isTargetClassExam
      ? `${targetClassName} Overall Summary`
      : selectedExam.education_level
      ? `${selectedExam.education_level} Overall Summary`
      : 'School Overall Summary';

    const subtitle = isTargetClassExam
      ? `(${targetClassName} Only)`
      : selectedExam.education_level
      ? `(${LEVEL_TO_GRADES[selectedExam.education_level]?.join(', ') || selectedExam.education_level} Only)`
      : '(PP1–PP2 & Grades 1–9 Combined)';

    const shouldRenderLevelSectionBreakdown = !isTargetClassExam;
    const levelSectionHeader = 'LEVEL SECTION BREAKDOWN';

    return {
      title,
      subtitle,
      levelSectionHeader,
      shouldRenderLevelSectionBreakdown,
      isTargetClassExam,
      targetClassName,
    };
  }

  it('correctly prioritizes Grade 9 target class over Junior School education level', () => {
    const grade9Exam: Examination = {
      id: 'exam_grade9_opener',
      exam_name: 'Opener Exam 2026 - Grade 9',
      class_id: 'cls_uuid_g9',
      education_level: 'Junior School',
      term: 'Term 1',
      year: 2026,
      status: 'Published',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    const labels = resolveDisplayLabels(grade9Exam, mockClasses);

    expect(labels.isTargetClassExam).toBe(true);
    expect(labels.targetClassName).toBe('Grade 9');
    expect(labels.title).toBe('Grade 9 Overall Summary');
    expect(labels.subtitle).toBe('(Grade 9 Only)');
    expect(labels.shouldRenderLevelSectionBreakdown).toBe(false);
  });

  it('correctly falls back to Education Level when class_id is not set', () => {
    const juniorSchoolExam: Examination = {
      id: 'exam_js_midterm',
      exam_name: 'Mid Term Exam - Junior School',
      class_id: null as any,
      education_level: 'Junior School',
      term: 'Term 1',
      year: 2026,
      status: 'Published',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    const labels = resolveDisplayLabels(juniorSchoolExam, mockClasses);

    expect(labels.isTargetClassExam).toBe(false);
    expect(labels.title).toBe('Junior School Overall Summary');
    expect(labels.subtitle).toBe('(Grade 7, Grade 8, Grade 9 Only)');
    expect(labels.levelSectionHeader).toBe('LEVEL SECTION BREAKDOWN');
  });

  it('correctly falls back to School Overall when neither class_id nor education_level is set', () => {
    const schoolWideExam: Examination = {
      id: 'exam_school_wide',
      exam_name: 'End of Term 1 2026',
      class_id: null as any,
      education_level: null as any,
      term: 'Term 1',
      year: 2026,
      status: 'Published',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    const labels = resolveDisplayLabels(schoolWideExam, mockClasses);

    expect(labels.isTargetClassExam).toBe(false);
    expect(labels.title).toBe('School Overall Summary');
    expect(labels.subtitle).toBe('(PP1–PP2 & Grades 1–9 Combined)');
    expect(labels.levelSectionHeader).toBe('LEVEL SECTION BREAKDOWN');
  });
});
