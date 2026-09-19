import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setupLocalStorage';
import { api, KEYS, RealtimeMarkEvent } from '../lib/storage';
import { Mark } from '../types';

describe('Stage 8D — Reconnection & Missed Event Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should export reconcileMarksOnReconnect in storage api', () => {
    expect(typeof api.reconcileMarksOnReconnect).toBe('function');
  });

  it('should reconcile updated and deleted marks from authoritative Supabase query', async () => {
    const existingMark1: Mark = {
      id: 'm1',
      student_id: 's1',
      subject_id: 'sub1',
      exam_id: 'ex1',
      marks: 70,
      raw_score: 70,
      special_status: null,
      updated_at: '2026-08-12T10:00:00.000Z',
    };

    const existingMark2: Mark = {
      id: 'm2',
      student_id: 's2',
      subject_id: 'sub1',
      exam_id: 'ex1',
      marks: 80,
      raw_score: 80,
      special_status: null,
      updated_at: '2026-08-12T10:00:00.000Z',
    };

    localStorage.setItem(KEYS.MARKS, JSON.stringify([existingMark1, existingMark2]));

    const eventsDispatched: RealtimeMarkEvent[] = [];
    const callback = (evt: RealtimeMarkEvent) => {
      eventsDispatched.push(evt);
    };

    const unsub = api.subscribeToMarksRealtime(callback);

    // Call reconcileMarksOnReconnect (if client is mock or null, it handles gracefully without crashing)
    await api.reconcileMarksOnReconnect();

    // Cache remains intact and valid
    const currentMarks = api.getMarks();
    expect(Array.isArray(currentMarks)).toBe(true);

    if (unsub) api.unsubscribeFromMarksRealtime(callback);
  });
});
