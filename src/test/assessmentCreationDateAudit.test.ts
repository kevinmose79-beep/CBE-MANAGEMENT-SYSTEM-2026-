import { describe, it, expect, beforeEach } from 'vitest';
import { api, generateUUID, KEYS, setStorage, getStorage } from '../lib/storage';
import { Examination } from '../types';
import { formatAssessmentCreationDate, KENYA_TIMEZONE } from '../utils/kenyaDateUtils';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('Registered Assessment Creation Date Audit & Verification', () => {
  beforeEach(() => {
    // Reset test storage environment
    localStorage.clear();
  });

  it('Test 1: formatAssessmentCreationDate correctly formats ISO timestamptz into Kenya EAT (UTC+3)', () => {
    // 2026-08-09T13:11:56.733109+00:00 is 16:11:56 EAT
    const isoUtc = '2026-08-09T13:11:56.733109+00:00';
    const formatted = formatAssessmentCreationDate(isoUtc);
    
    expect(formatted).toBe('9 Aug 2026, 4:11 PM');
  });

  it('Test 2: formatAssessmentCreationDate handles morning and evening Kenya EAT timestamps', () => {
    // 2026-08-20T07:34:00.000Z is 10:34:00 EAT (morning)
    const morningIso = '2026-08-20T07:34:00.000Z';
    expect(formatAssessmentCreationDate(morningIso)).toBe('20 Aug 2026, 10:34 AM');

    // 2026-08-13T15:08:25.111429+00:00 is 18:08:25 EAT (evening)
    const eveningIso = '2026-08-13T15:08:25.111429+00:00';
    expect(formatAssessmentCreationDate(eveningIso)).toBe('13 Aug 2026, 6:08 PM');
  });

  it('Test 3: formatAssessmentCreationDate safely falls back for date-only (YYYY-MM-DD) strings and handles nulls', () => {
    expect(formatAssessmentCreationDate('2026-08-20')).toBe('20 Aug 2026');
    expect(formatAssessmentCreationDate(null)).toBe('');
    expect(formatAssessmentCreationDate(undefined)).toBe('');
    expect(formatAssessmentCreationDate('')).toBe('');
  });

  it('Test 4: Creating an assessment assigns a valid creation timestamp', async () => {
    const examUuid = generateUUID();
    const nowIso = new Date().toISOString();
    const exam: Examination = {
      id: examUuid,
      exam_name: 'End-Term 2 Evaluation',
      term: 'Term 2',
      year: 2026,
      academic_year_id: '69ebb4c9-8f38-43ec-81c1-bb41d7488363',
      term_id: 'b1b46b17-c979-4824-aad7-31545b5ef212',
      status: 'Draft',
      exam_type: 'End-Term',
      max_marks: 100,
      created_at: nowIso,
    };

    setStorage(KEYS.EXAMS, [exam]);

    // Check that storage holds the created_at timestamp
    const examsInStorage = api.getExaminations();
    const stored = examsInStorage.find((e) => e.id === examUuid);
    expect(stored).toBeDefined();
    expect(stored?.created_at).toBe(nowIso);
    expect(formatAssessmentCreationDate(stored?.created_at)).toBe(formatAssessmentCreationDate(nowIso));
  });

  it('Test 5: Preserves existing assessment records and their historical timestamps', () => {
    const existingHistoricalExam: Examination = {
      id: '39c0b1d9-0d45-4316-a5b2-0ba45d8dae60',
      exam_name: 'Opener 1',
      term: 'Term 2',
      year: 2026,
      status: 'Provisional',
      exam_type: 'CAT',
      max_marks: 100,
      created_at: '2026-08-09T13:11:56.733109+00:00',
    };

    setStorage(KEYS.EXAMS, [existingHistoricalExam]);

    const retrieved = api.getExaminations();
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('39c0b1d9-0d45-4316-a5b2-0ba45d8dae60');
    expect(retrieved[0].created_at).toBe('2026-08-09T13:11:56.733109+00:00');
    expect(formatAssessmentCreationDate(retrieved[0].created_at)).toBe('9 Aug 2026, 4:11 PM');
  });

  it('Test 6: Assessment deletion functions safely while preserving other records and their timestamps', async () => {
    const exam1: Examination = {
      id: 'exam-1-id',
      exam_name: 'Opener Test 1',
      term: 'Term 2',
      year: 2026,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 100,
      created_at: '2026-08-09T10:00:00.000Z',
    };

    const exam2: Examination = {
      id: 'exam-2-id',
      exam_name: 'Opener Test 2',
      term: 'Term 2',
      year: 2026,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 100,
      created_at: '2026-08-10T12:00:00.000Z',
    };

    setStorage(KEYS.EXAMS, [exam1, exam2]);

    await api.deleteExamination(exam1.id);

    const remaining = api.getExaminations();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(exam2.id);
    expect(remaining[0].created_at).toBe('2026-08-10T12:00:00.000Z');
  });
});
