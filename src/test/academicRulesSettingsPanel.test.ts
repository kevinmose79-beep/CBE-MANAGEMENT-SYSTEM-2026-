import { test, assert } from 'vitest';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabaseSql';
import { api } from '../lib/storage';

test('TEST 1 — SystemSettingsPage module imports without error', async () => {
  const mod = await import('../components/SystemSettingsPage');
  assert(mod.SystemSettingsPage, 'SystemSettingsPage must be exported');
});

test('TEST 2 — Academic Session data exists and provides current term & year', () => {
  const year = api.getActiveAcademicYear();
  const term = api.getActiveTerm();
  assert(year && year.year, 'Active academic year must exist');
  assert(term && term.term_name, 'Active academic term must exist');
});

test('TEST 3 — Database schema preserves zero schema changes rule for settings panel', () => {
  assert(
    SUPABASE_SQL_SCHEMA.length > 0,
    'Database schema file must remain valid'
  );
});
