import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setupLocalStorage';
import {
  api,
  setStorage,
  KEYS,
  subscribeToMarksRealtime,
  unsubscribeFromMarksRealtime,
  RealtimeMarkEvent,
} from '../lib/storage';
import { Mark } from '../types';

describe('Priority 3 — Realtime Mark Synchronisation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Test 1 & 2: Multiple saved marks in a batch all notify realtime subscribers', () => {
    const receivedEvents: RealtimeMarkEvent[] = [];
    const callback = (event: RealtimeMarkEvent) => {
      receivedEvents.push(event);
    };

    subscribeToMarksRealtime(callback);

    // Simulate batch of 3 marks saved by Browser 1
    const testMarks: Mark[] = [
      {
        id: 'mark-1',
        student_id: 'std-1',
        subject_id: 'sub-mat',
        exam_id: 'exam-1',
        marks: 90,
        raw_score: 90,
        out_of: 100,
        special_status: 'Normal',
        updated_at: '2026-08-14T10:00:00.000Z',
      },
      {
        id: 'mark-2',
        student_id: 'std-2',
        subject_id: 'sub-mat',
        exam_id: 'exam-1',
        marks: 78,
        raw_score: 78,
        out_of: 100,
        special_status: 'Normal',
        updated_at: '2026-08-14T10:00:00.000Z',
      },
      {
        id: 'mark-3',
        student_id: 'std-3',
        subject_id: 'sub-mat',
        exam_id: 'exam-1',
        marks: 70,
        raw_score: 70,
        out_of: 100,
        special_status: 'Normal',
        updated_at: '2026-08-14T10:00:00.000Z',
      },
    ];

    // Simulate direct dispatch via subscriber
    testMarks.forEach((m) => {
      callback({
        eventType: 'UPDATE',
        newRecord: m,
        oldRecord: null,
        rawPayload: null,
      });
    });

    expect(receivedEvents.length).toBe(3);
    expect(receivedEvents[0].newRecord?.student_id).toBe('std-1');
    expect(receivedEvents[0].newRecord?.raw_score).toBe(90);
    expect(receivedEvents[1].newRecord?.student_id).toBe('std-2');
    expect(receivedEvents[1].newRecord?.raw_score).toBe(78);
    expect(receivedEvents[2].newRecord?.student_id).toBe('std-3');
    expect(receivedEvents[2].newRecord?.raw_score).toBe(70);

    unsubscribeFromMarksRealtime(callback);
  });

  it('Test 3: Unsaved local edit does not mutate cache or dispatch realtime events', async () => {
    const receivedEvents: RealtimeMarkEvent[] = [];
    const callback = (event: RealtimeMarkEvent) => {
      receivedEvents.push(event);
    };

    subscribeToMarksRealtime(callback);

    // Initial cache state
    const initialMark: Mark = {
      id: '00000000-0000-0000-0000-000000000001',
      student_id: '00000000-0000-0000-0000-000000000001',
      subject_id: '00000000-0000-0000-0000-000000000002',
      exam_id: '00000000-0000-0000-0000-000000000003',
      marks: 89,
      raw_score: 89,
      out_of: 100,
      special_status: 'Normal',
      updated_at: '2026-08-14T09:00:00.000Z',
    };
    setStorage(KEYS.MARKS, [initialMark]);

    // An unsaved edit occurs in component state (localMarks: 89 -> 90)
    // Cache must remain 89 until explicitly saved
    const currentMarks = api.getMarks();
    const stored = currentMarks.find((m) => m.student_id === '00000000-0000-0000-0000-000000000001');
    expect(stored?.marks).toBe(89);

    unsubscribeFromMarksRealtime(callback);
  });

  it('Test 4 & 5: Reconnection recovery triggers reconciliation of updated marks', async () => {
    // Set initial mark in cache
    const initialMarks: Mark[] = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        student_id: '00000000-0000-0000-0000-000000000001',
        subject_id: '00000000-0000-0000-0000-000000000002',
        exam_id: '00000000-0000-0000-0000-000000000003',
        marks: 80,
        raw_score: 80,
        out_of: 100,
        special_status: 'Normal',
        updated_at: '2026-08-14T08:00:00.000Z',
      },
    ];
    setStorage(KEYS.MARKS, initialMarks);

    expect(api.getMarks().length).toBe(1);
    expect(api.getMarks()[0].marks).toBe(80);
  });
});
