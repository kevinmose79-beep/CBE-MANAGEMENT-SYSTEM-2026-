import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import http from 'http';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function makeRequest(
  port: number,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload).toString() } : {}),
          ...headers,
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode || 500, data: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, data: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runSecuritySuite() {
  console.log("=== STARTING ADMIN AUTHENTICATION SECURITY AUDIT SUITE ===");
  const testPort = 3000;

  // Verify server is running
  const health = await makeRequest(testPort, '/api/health', 'GET', {});
  console.log("Health Check:", health.status, health.data);
  if (health.status !== 200) {
    console.error("Dev server not responding on port 3000. Start server first.");
    process.exit(1);
  }

  const endpoints = [
    { name: 'create-teacher', path: '/api/admin/create-teacher', method: 'POST', body: { name: 'Test Teacher' } },
    { name: 'create-learner', path: '/api/admin/create-learner', method: 'POST', body: { student: { admission_number: 'ADM9999' } } },
    { name: 'delete-learner', path: '/api/admin/delete-learner', method: 'POST', body: { student_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'set-learner-status', path: '/api/admin/set-learner-status', method: 'POST', body: { student_id: '00000000-0000-0000-0000-000000000000', active: true } },
    { name: 'update-teacher', path: '/api/admin/update-teacher', method: 'POST', body: { teacher: { id: '00000000-0000-0000-0000-000000000000' } } },
    { name: 'delete-teacher', path: '/api/admin/delete-teacher', method: 'POST', body: { teacherId: '00000000-0000-0000-0000-000000000000' } },
  ];

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // TEST 1: Unauthenticated request must return 401 across all 6 endpoints
  console.log("\n[TEST GROUP 1] Unauthenticated requests (Missing Token) -> 401");
  for (const ep of endpoints) {
    const res = await makeRequest(testPort, ep.path, ep.method, {}, ep.body);
    assert(res.status === 401, `${ep.name} returns 401 for unauthenticated request (got ${res.status})`);
    assert(typeof res.data?.error === 'string' && res.data.error.includes("Missing authentication token"), `${ep.name} returns correct 401 error message`);
  }

  // TEST 2: Invalid JWT must return 401 across all 6 endpoints
  console.log("\n[TEST GROUP 2] Invalid/expired JWT -> 401");
  for (const ep of endpoints) {
    const res = await makeRequest(testPort, ep.path, ep.method, { 'Authorization': 'Bearer invalid.fake.token' }, ep.body);
    assert(res.status === 401, `${ep.name} returns 401 for invalid JWT (got ${res.status})`);
    assert(typeof res.data?.error === 'string' && res.data.error.includes("Invalid or expired"), `${ep.name} returns invalid token error message`);
  }

  // TEST 3: Spoofed adminId without valid JWT cannot bypass authentication
  console.log("\n[TEST GROUP 3] Spoofed adminId parameter without JWT -> 401");
  for (const ep of endpoints) {
    const spoofedBody = { ...ep.body, adminId: '00000000-0000-0000-0000-000000000001', role: 'admin' };
    const res = await makeRequest(testPort, ep.path, ep.method, {}, spoofedBody);
    assert(res.status === 401, `${ep.name} rejects spoofed adminId body without token (got ${res.status})`);
  }

  // TEST 4: Query token support on delete-learner
  console.log("\n[TEST GROUP 4] delete-learner query token parameter fallback");
  const resQueryMissing = await makeRequest(testPort, '/api/admin/delete-learner?token=', 'POST', {}, { student_id: '00000000-0000-0000-0000-000000000000' });
  assert(resQueryMissing.status === 401, `delete-learner returns 401 for empty query token`);

  const resQueryInvalid = await makeRequest(testPort, '/api/admin/delete-learner?token=badtoken', 'POST', {}, { student_id: '00000000-0000-0000-0000-000000000000' });
  assert(resQueryInvalid.status === 401, `delete-learner returns 401 for invalid query token`);

  // TEST 5: Reset-password endpoint retains special admin resolution
  console.log("\n[TEST GROUP 5] reset-password endpoint verification");
  const resResetUnauth = await makeRequest(testPort, '/api/admin/reset-password', 'POST', {}, { emailOrUserId: 'test@user.com', newPassword: 'password123' });
  assert(resResetUnauth.status === 401, `reset-password returns 401 for unauthenticated request`);

  const resResetInvalid = await makeRequest(testPort, '/api/admin/reset-password', 'POST', { 'Authorization': 'Bearer badtoken' }, { emailOrUserId: 'test@user.com', newPassword: 'password123' });
  assert(resResetInvalid.status === 401, `reset-password returns 401 for invalid token`);

  // TEST 6: Direct RBAC authorization tests on authenticateAdminCaller
  console.log("\n[TEST GROUP 6] authenticateAdminCaller direct role checks & context structure");
  const { authenticateAdminCaller } = await import('../server.ts');

  // Helper to create mock response
  function createMockResponse() {
    return {
      statusCode: 200,
      jsonBody: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.jsonBody = body;
        return this;
      }
    };
  }

  // 6A: Test with mock Supabase client where user is a teacher
  const mockTeacherSupabase: any = {
    auth: {
      async getUser(token: string) {
        if (token === 'teacher-token') {
          return { data: { user: { id: 'teacher-uuid-1', email: 'teacher@school.com' } }, error: null };
        }
        return { data: null, error: new Error('Invalid token') };
      }
    },
    from(table: string) {
      return {
        select(fields: string) {
          return {
            eq(col: string, val: string) {
              return {
                async maybeSingle() {
                  return { data: { id: val, role: 'subject_teacher', email: 'teacher@school.com' }, error: null };
                }
              };
            }
          };
        }
      };
    }
  };

  const mockResTeacher = createMockResponse();
  const teacherResult = await authenticateAdminCaller(
    { headers: { authorization: 'Bearer teacher-token' }, body: {}, query: {} } as any,
    mockResTeacher as any,
    mockTeacherSupabase,
    "Forbidden: Only administrators can modify learner active status."
  );
  assert(teacherResult === null, "Teacher user is rejected with null context");
  assert(mockResTeacher.statusCode === 403, "Teacher user receives HTTP 403");
  assert(mockResTeacher.jsonBody?.error === "Forbidden: Only administrators can modify learner active status.", "Teacher receives exact custom forbidden message");

  // 6B: Test with mock Supabase client where user is a learner
  const mockLearnerSupabase: any = {
    auth: {
      async getUser(token: string) {
        return { data: { user: { id: 'learner-uuid-1', email: 'learner@school.com' } }, error: null };
      }
    },
    from(table: string) {
      return {
        select(fields: string) {
          return {
            eq(col: string, val: string) {
              return {
                async maybeSingle() {
                  return { data: { id: val, role: 'learner', email: 'learner@school.com' }, error: null };
                }
              };
            }
          };
        }
      };
    }
  };

  const mockResLearner = createMockResponse();
  const learnerResult = await authenticateAdminCaller(
    { headers: { authorization: 'Bearer learner-token' }, body: {}, query: {} } as any,
    mockResLearner as any,
    mockLearnerSupabase
  );
  assert(learnerResult === null, "Learner user is rejected with null context");
  assert(mockResLearner.statusCode === 403, "Learner user receives HTTP 403");

  // 6C: Test with mock Supabase client where user is not in users table
  const mockNoUserSupabase: any = {
    auth: {
      async getUser(token: string) {
        return { data: { user: { id: 'ghost-uuid-1', email: 'ghost@school.com' } }, error: null };
      }
    },
    from(table: string) {
      return {
        select(fields: string) {
          return {
            eq(col: string, val: string) {
              return {
                async maybeSingle() {
                  return { data: null, error: null };
                }
              };
            }
          };
        }
      };
    }
  };

  const mockResGhost = createMockResponse();
  const ghostResult = await authenticateAdminCaller(
    { headers: { authorization: 'Bearer ghost-token' }, body: {}, query: {} } as any,
    mockResGhost as any,
    mockNoUserSupabase
  );
  assert(ghostResult === null, "User not found in DB is rejected with null context");
  assert(mockResGhost.statusCode === 401, "User not found in DB receives HTTP 401");

  // 6D: Test with mock Supabase client where user is an authorized admin
  const mockAdminSupabase: any = {
    auth: {
      async getUser(token: string) {
        return { data: { user: { id: 'admin-uuid-1', email: 'admin@school.com' } }, error: null };
      }
    },
    from(table: string) {
      return {
        select(fields: string) {
          return {
            eq(col: string, val: string) {
              return {
                async maybeSingle() {
                  return { data: { id: val, role: 'admin', email: 'admin@school.com' }, error: null };
                }
              };
            }
          };
        }
      };
    }
  };

  const mockResAdmin = createMockResponse();
  const adminResult = await authenticateAdminCaller(
    { headers: { authorization: 'Bearer admin-token' }, body: {}, query: {} } as any,
    mockResAdmin as any,
    mockAdminSupabase
  );
  assert(adminResult !== null, "Admin user succeeds and returns context");
  assert(adminResult?.authenticatedUserId === 'admin-uuid-1', "Context returns correct authenticatedUserId from JWT");
  assert(adminResult?.adminUser?.role === 'admin', "Context returns verified adminUser record");
  assert(adminResult?.token === 'admin-token', "Context returns verified token");

  console.log(`\n=== AUDIT SUITE COMPLETED: ${passedTests}/${totalTests} tests passed ===`);
  process.exit(0);
}

runSecuritySuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
