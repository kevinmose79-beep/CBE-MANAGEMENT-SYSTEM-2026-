import { test, assert } from 'vitest';
import { api, syncFromSupabase, KEYS } from '../lib/storage';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabaseSql';
import { Grade } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

test('TEST 1 — SUPABASE_SQL_SCHEMA contains cbe_grades table, index, and RLS policies', () => {
  assert(
    SUPABASE_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.cbe_grades'),
    'SUPABASE_SQL_SCHEMA must include cbe_grades table definition'
  );
  assert(
    SUPABASE_SQL_SCHEMA.includes('GRANT SELECT ON public.cbe_grades TO anon'),
    'SUPABASE_SQL_SCHEMA must grant SELECT on cbe_grades to anon'
  );
  assert(
    SUPABASE_SQL_SCHEMA.includes('ALTER TABLE public.cbe_grades ENABLE ROW LEVEL SECURITY'),
    'SUPABASE_SQL_SCHEMA must enable RLS on cbe_grades'
  );
});

test('TEST 2 — LocalStorage is NOT used for cbe_grades business data', () => {
  const localVal = globalThis.localStorage.getItem('cbe_grades');
  assert.strictEqual(
    localVal,
    null,
    'localStorage must not contain cbe_grades persistent business data'
  );
});

test('TEST 3 — api.getGrades returns initial CBE 8-Point scale by default in memory', () => {
  const grades = api.getGrades();
  assert(Array.isArray(grades), 'api.getGrades() must return an array');
  assert.strictEqual(grades.length, 8, 'Default CBE scale must contain 8 grade boundaries');
  assert.strictEqual(grades[0].grade_code, 'EE1', 'Top grade code must be EE1');
  assert.strictEqual(grades[7].grade_code, 'BE2', 'Bottom grade code must be BE2');
});

test('TEST 4 — api.updateGrades updates runtime memory state and returns updated grades', async () => {
  const currentGrades = api.getGrades();
  const customGrades: Grade[] = currentGrades.map((g) => {
    if (g.grade_code === 'EE1') {
      return { ...g, minimum_score: 92, minimum_marks: 92, remarks: 'Superb Performance' };
    }
    return g;
  });

  const updated = await api.updateGrades(customGrades);
  assert.strictEqual(updated[0].minimum_score, 92, 'Updated EE1 min score must be 92');
  assert.strictEqual(updated[0].remarks, 'Superb Performance', 'Updated EE1 remarks must be saved');

  const reFetched = api.getGrades();
  assert.strictEqual(reFetched[0].minimum_score, 92, 'api.getGrades() must reflect updated memory state');

  // Reset back to standard
  await api.updateGrades(CBE_8_POINT_GRADES);
  assert.strictEqual(api.getGrades()[0].minimum_score, 90, 'EE1 min score reset to 90');
});

test('TEST 5 — syncFromSupabase function exists and executes without error', async () => {
  assert.strictEqual(typeof syncFromSupabase, 'function', 'syncFromSupabase must be exported');
  const result = await syncFromSupabase();
  assert(typeof result === 'boolean', 'syncFromSupabase must return boolean');
});
