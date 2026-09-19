import { describe, it, expect } from 'vitest';
import { ClassStream } from '../types';

/**
 * Pure helper mirroring the exact logic in CbeMeritListReport.tsx lines 193-225
 */
function computeViewingSummary({
  targetGrade,
  selectedClassId,
  selectedStreamId,
  classes,
  studentCount,
}: {
  targetGrade?: string;
  selectedClassId?: string;
  selectedStreamId?: string;
  classes: ClassStream[];
  studentCount: number;
}): { displayGrade: string; displayStream: string; viewingSummaryText: string } {
  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const rawGrade = targetGrade || (selectedClassId !== 'all' ? selectedClassId : 'All Classes') || 'All Classes';
  let displayGrade = rawGrade;
  if (isUUID(rawGrade)) {
    const clsObj = classes.find((c) => c.id === rawGrade || (c.class_name && c.class_name.toLowerCase() === rawGrade.toLowerCase()));
    displayGrade = clsObj?.class_name || 'All Classes';
  }

  let displayStream = 'All Streams';
  if (selectedStreamId && selectedStreamId !== 'all' && selectedStreamId !== 'All Streams') {
    const streamObj = classes.find(
      (c) => c.id === selectedStreamId || c.stream_id === selectedStreamId || (c.stream && c.stream.toLowerCase() === selectedStreamId.toLowerCase())
    );
    if (streamObj && streamObj.stream && !isUUID(streamObj.stream)) {
      const sStr = String(streamObj.stream || '');
      displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
    } else if (!isUUID(selectedStreamId)) {
      const sStr = String(selectedStreamId || '');
      displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
    } else {
      displayStream = 'All Streams';
    }
  } else if (!selectedStreamId && selectedClassId && selectedClassId !== 'all') {
    const matchingClasses = classes.filter(
      (c) => c.id === selectedClassId || (c.class_name && c.class_name.toLowerCase() === selectedClassId.toLowerCase())
    );
    if (matchingClasses.length === 1 && matchingClasses[0].stream && !isUUID(matchingClasses[0].stream)) {
      const sStr = String(matchingClasses[0].stream || '');
      displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
    }
  }

  const viewingSummaryText = `Viewing: ${displayGrade} • ${displayStream} • ${studentCount} Learners`;
  return { displayGrade, displayStream, viewingSummaryText };
}

describe('CBE Merit List Viewing Summary Label Verification', () => {
  const mockClasses: ClassStream[] = [
    {
      id: 'cls_g9_blue',
      class_name: 'Grade 9',
      stream: 'Blue',
      stream_id: 'strm_g9_blue',
      education_level: 'Junior School',
    },
    {
      id: 'cls_g9_red',
      class_name: 'Grade 9',
      stream: 'Red',
      stream_id: 'strm_g9_red',
      education_level: 'Junior School',
    },
    {
      id: 'cls_g8_single',
      class_name: 'Grade 8',
      stream: 'Main',
      stream_id: 'strm_g8_main',
      education_level: 'Junior School',
    },
  ];

  it('1. When "All Streams" (selectedStreamId = "all") is selected for multi-stream Grade 9, displays "All Streams"', () => {
    const result = computeViewingSummary({
      targetGrade: 'Grade 9',
      selectedClassId: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      studentCount: 76,
    });

    expect(result.displayGrade).toBe('Grade 9');
    expect(result.displayStream).toBe('All Streams');
    expect(result.viewingSummaryText).toBe('Viewing: Grade 9 • All Streams • 76 Learners');
  });

  it('2. When selectedStreamId = "All Streams", displays "All Streams"', () => {
    const result = computeViewingSummary({
      targetGrade: 'Grade 9',
      selectedClassId: 'Grade 9',
      selectedStreamId: 'All Streams',
      classes: mockClasses,
      studentCount: 76,
    });

    expect(result.displayStream).toBe('All Streams');
    expect(result.viewingSummaryText).toBe('Viewing: Grade 9 • All Streams • 76 Learners');
  });

  it('3. When specific stream "strm_g9_blue" is selected, displays "Blue Stream"', () => {
    const result = computeViewingSummary({
      targetGrade: 'Grade 9',
      selectedClassId: 'Grade 9',
      selectedStreamId: 'strm_g9_blue',
      classes: mockClasses,
      studentCount: 38,
    });

    expect(result.displayStream).toBe('Blue Stream');
    expect(result.viewingSummaryText).toBe('Viewing: Grade 9 • Blue Stream • 38 Learners');
  });

  it('4. When specific stream "strm_g9_red" is selected, displays "Red Stream"', () => {
    const result = computeViewingSummary({
      targetGrade: 'Grade 9',
      selectedClassId: 'Grade 9',
      selectedStreamId: 'strm_g9_red',
      classes: mockClasses,
      studentCount: 38,
    });

    expect(result.displayStream).toBe('Red Stream');
    expect(result.viewingSummaryText).toBe('Viewing: Grade 9 • Red Stream • 38 Learners');
  });

  it('5. When selectedStreamId is omitted and class has multiple streams, defaults to "All Streams"', () => {
    const result = computeViewingSummary({
      targetGrade: 'Grade 9',
      selectedClassId: 'Grade 9',
      selectedStreamId: undefined,
      classes: mockClasses,
      studentCount: 76,
    });

    expect(result.displayStream).toBe('All Streams');
    expect(result.viewingSummaryText).toBe('Viewing: Grade 9 • All Streams • 76 Learners');
  });

  it('6. When selectedStreamId is omitted and class has only one stream, shows that single stream', () => {
    const result = computeViewingSummary({
      targetGrade: 'Grade 8',
      selectedClassId: 'Grade 8',
      selectedStreamId: undefined,
      classes: mockClasses,
      studentCount: 35,
    });

    expect(result.displayStream).toBe('Main Stream');
    expect(result.viewingSummaryText).toBe('Viewing: Grade 8 • Main Stream • 35 Learners');
  });
});
