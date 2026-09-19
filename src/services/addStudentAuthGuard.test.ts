import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, getSupabaseClient } from '../lib/storage';
import fs from 'fs';
import path from 'path';

describe('addStudent Auth Guard & RLS Integrity Verification', () => {
  it('A. allows existing INSERT path when authenticated session exists', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    // Mock getSession to return active session
    vi.spyOn(client.auth, 'getSession').mockResolvedValueOnce({
      data: { session: { user: { id: 'test-admin-uuid' } } },
      error: null,
    } as any);

    // Mock client.from('students').insert to succeed
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{
          id: 'mock-student-uuid',
          admission_number: 'TEST_AUTH_ADM',
          full_name: 'Test Authenticated Student',
          gender: 'M',
          active: true,
        }],
        error: null,
      }),
    });

    vi.spyOn(client, 'from').mockImplementation((table: string) => {
      if (table === 'students') {
        return { insert: mockInsert } as any;
      }
      const chainable: any = {
        select: () => chainable,
        ilike: () => chainable,
        eq: () => chainable,
        limit: () => chainable,
        insert: () => chainable,
        maybeSingle: async () => ({ data: null }),
        then: (resolve: any) => resolve({ data: [] }),
      };
      return chainable;
    });

    const dummyStudent: any = {
      admission_number: 'TEST_AUTH_ADM',
      full_name: 'Test Authenticated Student',
      gender: 'M',
      active: true,
    };

    const res = await api.addStudent(dummyStudent);
    expect(res).toBeDefined();
    expect(res.admission_number).toBe('TEST_AUTH_ADM');
    vi.restoreAllMocks();
  });

  it('B. throws clear session expired error when Supabase Auth session is missing', async () => {
    const client = getSupabaseClient();
    if (!client) {
      // LocalStorage mode fallback test
      return;
    }

    // Mock getSession to return no session
    vi.spyOn(client.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any);

    const dummyStudent: any = {
      admission_number: 'TEST_NO_SESSION_' + Date.now(),
      full_name: 'Test Unauthenticated Student',
      gender: 'M',
      active: true,
    };

    await expect(api.addStudent(dummyStudent)).rejects.toThrow(
      /permission denied|Failed to register learner/i
    );
  });

  it('C. verifies static RLS SQL definitions remain unchanged and intact', () => {
    const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    expect(sqlContent).toContain('CREATE POLICY "Admin full access students" ON public.students');
    expect(sqlContent).toContain('public.is_admin()');
  });
});
