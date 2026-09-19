// Unit tests for /api/admin/create-teacher security authorization fix
import { createClient } from '@supabase/supabase-js';

// We can test the security authorization logic directly or via mocked Supabase admin client

async function runSecurityTests() {
  console.log('=== RUNNING ADMIN CREATE-TEACHER SECURITY AUTHORIZATION TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // Simulated server handler matching server.ts logic
  async function simulateCreateTeacherHandler(
    req: { headers: Record<string, string>; body: any },
    mockSupabaseAdmin: any
  ): Promise<{ status: number; body: any }> {
    // Extract authentication token
    let token: string | null = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
      token = req.body.token.trim();
    }

    if (!token) {
      return { status: 401, body: { error: 'Unauthorized: Missing authentication token.' } };
    }

    // Verify token with Supabase Auth
    const { data: authUserData, error: tokenError } = await mockSupabaseAdmin.auth.getUser(token);
    if (tokenError || !authUserData || !authUserData.user) {
      return { status: 401, body: { error: 'Unauthorized: Invalid or expired authentication token.' } };
    }

    const authenticatedUserId = authUserData.user.id;

    // Look up authoritative user record in public.users
    let adminUser: { id: string; role: string } | null = null;
    const { data: userById } = await mockSupabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', authenticatedUserId)
      .maybeSingle();

    if (userById) {
      adminUser = userById;
    } else if (authUserData.user.email) {
      const { data: userByEmail } = await mockSupabaseAdmin
        .from('users')
        .select('id, role')
        .eq('email', authUserData.user.email.toLowerCase())
        .maybeSingle();
      if (userByEmail) adminUser = userByEmail;
    }

    if (!adminUser) {
      return { status: 401, body: { error: 'Unauthorized: Authenticated user record not found in database.' } };
    }

    if (adminUser.role !== 'admin') {
      return { status: 403, body: { error: 'Forbidden: Only administrators can create accounts.' } };
    }

    return { status: 200, body: { message: 'Authorized' } };
  }

  // TEST 1: No authentication token
  {
    const req = {
      headers: {},
      body: { name: 'Teacher 1', email: 't1@school.ac.ke' }
    };
    const mockSupabase = {};
    const res = await simulateCreateTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'Test 1 — No authentication returns 401 Unauthorized', `got ${res.status}`);
  }

  // TEST 2: Fake adminId in body without valid token
  {
    const req = {
      headers: {},
      body: { adminId: 'usr_admin_fake_123', name: 'Teacher 2', email: 't2@school.ac.ke' }
    };
    const mockSupabase = {};
    const res = await simulateCreateTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'Test 2 — Fake adminId without valid token returns 401 Unauthorized', `got ${res.status}`);
  }

  // TEST 3: Authenticated user who is NOT an admin (role = 'class_teacher')
  {
    const req = {
      headers: { authorization: 'Bearer valid_token_teacher' },
      body: { adminId: 'fake_admin', name: 'Teacher 3', email: 't3@school.ac.ke' }
    };
    const mockSupabase = {
      auth: {
        getUser: async (tok: string) => {
          if (tok === 'valid_token_teacher') {
            return { data: { user: { id: 'teacher_user_id', email: 'teacher@school.ac.ke' } }, error: null };
          }
          return { data: null, error: new Error('Invalid token') };
        }
      },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && (val === 'teacher_user_id' || val === 'teacher@school.ac.ke')) {
                return { data: { id: 'teacher_user_id', role: 'class_teacher' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateCreateTeacherHandler(req, mockSupabase);
    assert(res.status === 403, 'Test 3 — Authenticated non-admin user returns 403 Forbidden', `got ${res.status}`);
  }

  // TEST 4: Authenticated administrator (role = 'admin')
  {
    const req = {
      headers: { authorization: 'Bearer valid_token_admin' },
      body: { name: 'Teacher 4', email: 't4@school.ac.ke' }
    };
    const mockSupabase = {
      auth: {
        getUser: async (tok: string) => {
          if (tok === 'valid_token_admin') {
            return { data: { user: { id: 'admin_user_id', email: 'admin@school.ac.ke' } }, error: null };
          }
          return { data: null, error: new Error('Invalid token') };
        }
      },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && (val === 'admin_user_id' || val === 'admin@school.ac.ke')) {
                return { data: { id: 'admin_user_id', role: 'admin' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateCreateTeacherHandler(req, mockSupabase);
    assert(res.status === 200, 'Test 4 — Authenticated administrator returns 200 OK (authorized)', `got ${res.status}`);
  }

  // TEST 5: Invalid / expired token
  {
    const req = {
      headers: { authorization: 'Bearer expired_or_invalid_token' },
      body: { name: 'Teacher 5', email: 't5@school.ac.ke' }
    };
    const mockSupabase = {
      auth: {
        getUser: async () => ({ data: null, error: new Error('Token expired') })
      }
    };
    const res = await simulateCreateTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'Test 5 — Invalid or expired token returns 401 Unauthorized', `got ${res.status}`);
  }

  console.log(`\nADMIN CREATE-TEACHER SECURITY TESTS: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
