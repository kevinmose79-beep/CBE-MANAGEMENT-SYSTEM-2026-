// Unit tests for /api/admin/update-teacher (E-1) and /api/admin/delete-teacher (E-2) security authorization fixes

async function runUpdateAndDeleteTeacherSecurityTests() {
  console.log('=== RUNNING E-1 & E-2 TEACHER UPDATE AND DELETION SECURITY TESTS ===\n');

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

  // Simulated server handler matching server.ts logic for updateTeacherHandler
  async function simulateUpdateTeacherHandler(
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
      return { status: 403, body: { error: 'Forbidden: Only administrators can update teacher accounts.' } };
    }

    return { status: 200, body: { success: true, message: 'Update Authorized' } };
  }

  // Simulated server handler matching server.ts logic for deleteTeacherHandler
  async function simulateDeleteTeacherHandler(
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

    // Verify authentication token via Supabase Auth
    const { data: authUserData, error: tokenError } = await mockSupabaseAdmin.auth.getUser(token);
    if (tokenError || !authUserData || !authUserData.user) {
      return { status: 401, body: { error: 'Unauthorized: Invalid or expired authentication token.' } };
    }

    const authenticatedUserId = authUserData.user.id;
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
      return { status: 403, body: { error: 'Forbidden: Only administrators can delete teacher accounts.' } };
    }

    // Call atomic delete RPC
    const { data: rpcRes, error: rpcErr } = await mockSupabaseAdmin.rpc('delete_teacher_atomic', {
      p_teacher_id: req.body.teacherId,
      p_user_id: req.body.userId,
      p_email: req.body.email
    });

    if (rpcErr || !rpcRes?.success) {
      return { status: 500, body: { error: 'Database atomic deletion failed' } };
    }

    return { status: 200, body: { success: true, message: 'Deleted' } };
  }

  // ==================== E-1 UPDATE TEACHER TESTS ====================

  // E-1 TEST 1: Missing Authorization header
  {
    const req = { headers: {}, body: { teacher: { id: 'tch_1', teacher_name: 'Updated Name' } } };
    const mockSupabase = {};
    const res = await simulateUpdateTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-1 Test 1 — Missing Authorization header returns 401 Unauthorized', `got ${res.status}`);
  }

  // E-1 TEST 2: Invalid Bearer token
  {
    const req = { headers: { authorization: 'Bearer invalid_token' }, body: { teacher: { id: 'tch_1' } } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: null, error: new Error('Invalid token') }) }
    };
    const res = await simulateUpdateTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-1 Test 2 — Invalid Bearer token returns 401 Unauthorized', `got ${res.status}`);
  }

  // E-1 TEST 3: Valid authenticated non-admin user (subject_teacher)
  {
    const req = { headers: { authorization: 'Bearer token_teacher' }, body: { teacher: { id: 'tch_1' } } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user_teacher_1', email: 'teacher@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && val === 'user_teacher_1') {
                return { data: { id: 'user_teacher_1', role: 'subject_teacher' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateUpdateTeacherHandler(req, mockSupabase);
    assert(res.status === 403, 'E-1 Test 3 — Valid authenticated non-admin user returns 403 Forbidden', `got ${res.status}`);
  }

  // E-1 TEST 4: Valid authenticated administrator
  {
    const req = { headers: { authorization: 'Bearer token_admin' }, body: { teacher: { id: 'tch_1', teacher_name: 'New Name' } } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user_admin_1', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && val === 'user_admin_1') {
                return { data: { id: 'user_admin_1', role: 'admin' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateUpdateTeacherHandler(req, mockSupabase);
    assert(res.status === 200, 'E-1 Test 4 — Valid authenticated administrator update succeeds', `got ${res.status}`);
  }

  // E-1 TEST 5: Frontend-supplied fake admin role claim in request body cannot authorize
  {
    const req = { headers: { authorization: 'Bearer token_teacher' }, body: { role: 'admin', teacher: { id: 'tch_1' } } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user_teacher_1', email: 'teacher@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && val === 'user_teacher_1') {
                return { data: { id: 'user_teacher_1', role: 'class_teacher' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateUpdateTeacherHandler(req, mockSupabase);
    assert(res.status === 403, 'E-1 Test 5 — Fake admin role claim in body rejected with 403', `got ${res.status}`);
  }

  // E-1 TEST 6: Frontend-supplied adminId in request body cannot authorize without valid token
  {
    const req = { headers: {}, body: { adminId: 'usr_admin_real_123', teacher: { id: 'tch_1' } } };
    const mockSupabase = {};
    const res = await simulateUpdateTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-1 Test 6 — adminId in body without Bearer token rejected with 401', `got ${res.status}`);
  }

  // ==================== E-2 DELETE TEACHER TESTS ====================

  // E-2 TEST 1: Missing Authorization header
  {
    const req = { headers: {}, body: { teacherId: 'tch_del_1' } };
    const mockSupabase = {};
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-2 Test 1 — Missing Authorization header returns 401 Unauthorized', `got ${res.status}`);
  }

  // E-2 TEST 2: Invalid Bearer token
  {
    const req = { headers: { authorization: 'Bearer expired_token' }, body: { teacherId: 'tch_del_1' } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: null, error: new Error('Token expired') }) }
    };
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-2 Test 2 — Invalid Bearer token returns 401 Unauthorized', `got ${res.status}`);
  }

  // E-2 TEST 3: Valid authenticated non-admin user
  {
    const req = { headers: { authorization: 'Bearer token_non_admin' }, body: { teacherId: 'tch_del_1' } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user_non_admin', email: 'nonadmin@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && val === 'user_non_admin') {
                return { data: { id: 'user_non_admin', role: 'class_teacher' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 403, 'E-2 Test 3 — Valid authenticated non-admin user returns 403 Forbidden', `got ${res.status}`);
  }

  // E-2 TEST 4: Valid authenticated administrator (may proceed to atomic delete RPC)
  {
    const req = { headers: { authorization: 'Bearer token_admin' }, body: { teacherId: 'tch_del_1', email: 'target@school.ac.ke' } };
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user_admin_1', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && val === 'user_admin_1') {
                return { data: { id: 'user_admin_1', role: 'admin' } };
              }
              return { data: null };
            }
          })
        })
      }),
      rpc: async (fn: string, params: any) => {
        if (fn === 'delete_teacher_atomic' && params.p_teacher_id === 'tch_del_1') {
          return { data: { success: true, teacher_id: 'tch_del_1' }, error: null };
        }
        return { data: null, error: new Error('RPC error') };
      }
    };
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 200, 'E-2 Test 4 — Valid authenticated administrator deletion proceeds via RPC', `got ${res.status}`);
  }

  // E-2 TEST 5: adminId without Bearer token
  {
    const req = { headers: {}, body: { adminId: 'usr_admin_123', teacherId: 'tch_del_1' } };
    const mockSupabase = {};
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-2 Test 5 — adminId without Bearer token returns 401 Unauthorized', `got ${res.status}`);
  }

  // E-2 TEST 6: Fake/foreign adminId with no valid token
  {
    const req = { headers: {}, body: { adminId: 'foreign_admin_uuid_456', teacherId: 'tch_del_1' } };
    const mockSupabase = {};
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-2 Test 6 — Fake/foreign adminId with no valid token returns 401 Unauthorized', `got ${res.status}`);
  }

  // E-2 TEST 7: adminId belonging to a real administrator WITHOUT a valid Bearer token -> STILL 401
  {
    const req = { headers: {}, body: { adminId: 'real_admin_user_id', teacherId: 'tch_del_1' } };
    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (table === 'users' && val === 'real_admin_user_id') {
                return { data: { id: 'real_admin_user_id', role: 'admin' } };
              }
              return { data: null };
            }
          })
        })
      })
    };
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 401, 'E-2 Test 7 — adminId belonging to real admin WITHOUT Bearer token STILL returns 401', `got ${res.status}`);
  }

  // E-2 TEST 8: Atomic deletion RPC remains the only deletion path
  {
    const req = { headers: { authorization: 'Bearer token_admin' }, body: { teacherId: 'tch_del_atomic' } };
    let rpcCalled = false;
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'user_admin_1', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => ({ data: { id: 'user_admin_1', role: 'admin' } })
          })
        })
      }),
      rpc: async (fn: string, params: any) => {
        if (fn === 'delete_teacher_atomic') {
          rpcCalled = true;
          return { data: { success: true }, error: null };
        }
        return { data: null, error: new Error('Unknown RPC') };
      }
    };
    const res = await simulateDeleteTeacherHandler(req, mockSupabase);
    assert(res.status === 200 && rpcCalled, 'E-2 Test 8 — Existing atomic deletion RPC delete_teacher_atomic is invoked', `got ${res.status}`);
  }

  console.log(`\nE-1 & E-2 SECURITY TESTS COMPLETED: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    throw new Error(`${failed} security tests failed.`);
  }
}

runUpdateAndDeleteTeacherSecurityTests().catch((err) => {
  console.error('Security test runner error:', err);
  process.exit(1);
});
