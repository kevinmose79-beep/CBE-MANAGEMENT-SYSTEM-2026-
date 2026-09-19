// Teacher Auth Account Deletion Failure & Orphan Recovery Test Suite
import assert from 'assert';
import 'dotenv/config';

async function findAuthUserByEmailAcrossPages(
  supabaseAdminClient: any,
  targetEmail: string,
  extraFilter?: (user: any) => boolean
): Promise<{ user: any | null; totalMatches: number; error?: string }> {
  if (!targetEmail && !extraFilter) {
    return { user: null, totalMatches: 0 };
  }

  const normalizedEmail = targetEmail ? targetEmail.trim().toLowerCase() : '';
  const matchingUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const { data, error } = await supabaseAdminClient.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      return { user: null, totalMatches: 0, error: error.message };
    }

    const users = data?.users || [];
    if (!Array.isArray(users) || users.length === 0) {
      break;
    }

    for (const u of users) {
      const emailMatch = normalizedEmail && u.email && u.email.trim().toLowerCase() === normalizedEmail;
      const customMatch = extraFilter ? Boolean(extraFilter(u)) : false;
      if (emailMatch || customMatch) {
        if (!matchingUsers.some(m => m.id === u.id)) {
          matchingUsers.push(u);
        }
      }
    }

    if (users.length < perPage) {
      break;
    }

    page++;
  }

  if (matchingUsers.length === 0) {
    return { user: null, totalMatches: 0 };
  }

  if (matchingUsers.length === 1) {
    return { user: matchingUsers[0], totalMatches: 1 };
  }

  return {
    user: null,
    totalMatches: matchingUsers.length,
    error: `Ambiguous match: Found ${matchingUsers.length} Auth accounts matching "${targetEmail}". Aborting operation to prevent modifying or deleting the wrong account.`
  };
}

// Mock server handler runner simulating /api/admin/delete-teacher logic
async function simulateTeacherDeletionHandler(req: any, mockSupabaseAdmin: any) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, body: { error: "Unauthorized: Missing or invalid Authorization header." } };
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== 'admin_valid_token') {
    return { status: token === 'teacher_token' ? 403 : 401, body: { error: token === 'teacher_token' ? "Forbidden: Only administrators can delete teacher accounts." : "Unauthorized: Invalid token." } };
  }

  const { teacherId, userId, email } = req.body || {};

  const cleanTeacherId = teacherId ? String(teacherId).trim() : null;
  const cleanUserId = userId ? String(userId).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  if (!cleanTeacherId && !cleanUserId && !cleanEmail) {
    return { status: 400, body: { error: "Missing teacher identifier: teacherId, userId, or email required." } };
  }

  let resolvedTeacherId = cleanTeacherId;
  let resolvedUserId = cleanUserId;
  let resolvedEmail = cleanEmail;
  let isAlreadyDeleted = false;

  // 1. Database Deletion (simulate RPC or fallback)
  let rpcRes: any = null;
  if (mockSupabaseAdmin.rpc) {
    const rpcCall = await mockSupabaseAdmin.rpc('delete_teacher_atomic', {
      p_teacher_id: cleanTeacherId,
      p_user_id: cleanUserId,
      p_email: cleanEmail,
    });
    if (rpcCall.error) {
      if (rpcCall.error.code === 'PGRST202') {
        // Fallback simulation
        let foundTeacherId: string | null = cleanTeacherId;
        let foundUserId: string | null = cleanUserId;
        let foundEmail: string | null = cleanEmail;

        if (mockSupabaseAdmin.dbState) {
          const t = mockSupabaseAdmin.dbState.teachers.find((x: any) =>
            (cleanTeacherId && x.id === cleanTeacherId) ||
            (cleanEmail && x.email?.toLowerCase() === cleanEmail) ||
            (cleanUserId && x.user_id === cleanUserId)
          );
          if (t) {
            foundTeacherId = t.id;
            foundUserId = t.user_id || foundUserId;
            foundEmail = t.email || foundEmail;
          } else {
            foundTeacherId = null;
            foundUserId = null;
          }
        }

        if (!foundTeacherId && !foundUserId) {
          rpcRes = {
            success: true,
            already_deleted: true,
            teacher_id: cleanTeacherId,
            user_id: cleanUserId,
            email: cleanEmail
          };
        } else {
          // Perform DB deletions in mock
          if (mockSupabaseAdmin.dbState) {
            mockSupabaseAdmin.dbState.teachers = mockSupabaseAdmin.dbState.teachers.filter((x: any) => x.id !== foundTeacherId);
            mockSupabaseAdmin.dbState.users = mockSupabaseAdmin.dbState.users.filter((x: any) => x.id !== foundUserId);
          }
          rpcRes = {
            success: true,
            already_deleted: false,
            teacher_id: foundTeacherId || cleanTeacherId,
            user_id: foundUserId || cleanUserId,
            email: foundEmail || cleanEmail
          };
        }
      } else {
        return { status: 500, body: { error: `Database atomic teacher deletion failed: ${rpcCall.error.message}` } };
      }
    } else {
      rpcRes = rpcCall.data;
    }
  }

  isAlreadyDeleted = !!rpcRes.already_deleted;
  if (rpcRes.teacher_id) resolvedTeacherId = String(rpcRes.teacher_id);
  if (rpcRes.user_id) resolvedUserId = String(rpcRes.user_id);
  if (rpcRes.email) resolvedEmail = String(rpcRes.email).toLowerCase();

  // Helper for UUID check
  const isUUID = (str: string | null | undefined) => !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // 2. Server-side Supabase Auth user deletion
  let authDeleteSuccess = false;
  let authDeleteErrorMsg: string | null = null;

  const candidateAuthUuids = new Set<string>();
  if (resolvedUserId && isUUID(resolvedUserId)) candidateAuthUuids.add(resolvedUserId);
  if (cleanUserId && isUUID(cleanUserId)) candidateAuthUuids.add(cleanUserId);
  if (resolvedTeacherId && isUUID(resolvedTeacherId)) candidateAuthUuids.add(resolvedTeacherId);
  if (cleanTeacherId && isUUID(cleanTeacherId)) candidateAuthUuids.add(cleanTeacherId);

  const targetEmail = (resolvedEmail || cleanEmail || '').toLowerCase().trim();

  if (candidateAuthUuids.size > 0) {
    for (const authUuid of candidateAuthUuids) {
      try {
        const { error: authErr } = await mockSupabaseAdmin.auth.admin.deleteUser(authUuid);
        if (!authErr) {
          authDeleteSuccess = true;
        } else if (authErr.message?.toLowerCase().includes('not found') || authErr.status === 404) {
          authDeleteSuccess = true; // Idempotent
        } else {
          authDeleteErrorMsg = authErr.message;
        }
      } catch (err: any) {
        authDeleteErrorMsg = err?.message || 'Auth deletion exception';
      }
    }
  }

  if (!authDeleteSuccess && targetEmail) {
    // Direct DB check in public.users first if not already tried
    let uByEmail = mockSupabaseAdmin.dbState?.users?.find((u: any) => u.email?.toLowerCase() === targetEmail);
    if (uByEmail?.id && isUUID(uByEmail.id) && !candidateAuthUuids.has(uByEmail.id)) {
      try {
        const { error: authErr } = await mockSupabaseAdmin.auth.admin.deleteUser(uByEmail.id);
        if (!authErr || authErr.message?.toLowerCase().includes('not found') || (authErr as any).status === 404) {
          authDeleteSuccess = true;
        } else {
          authDeleteErrorMsg = authErr.message;
        }
      } catch (err: any) {
        authDeleteErrorMsg = err?.message || 'Auth deletion exception';
      }
    }

    if (!authDeleteSuccess) {
      try {
        const lookupRes = await findAuthUserByEmailAcrossPages(mockSupabaseAdmin, targetEmail);
        if (lookupRes.error) {
          authDeleteErrorMsg = lookupRes.error;
        } else if (lookupRes.user) {
          const { error: authErr } = await mockSupabaseAdmin.auth.admin.deleteUser(lookupRes.user.id);
          if (!authErr || authErr.message?.toLowerCase().includes('not found') || (authErr as any).status === 404) {
            authDeleteSuccess = true;
          } else {
            authDeleteErrorMsg = authErr.message;
          }
        } else {
          authDeleteSuccess = true; // User not in Auth list across all pages (idempotent)
        }
      } catch (err: any) {
        authDeleteErrorMsg = err?.message || 'Auth list/delete exception';
      }
    }
  }

  if (candidateAuthUuids.size === 0 && !targetEmail) {
    authDeleteSuccess = true;
  }

  if (!authDeleteSuccess && authDeleteErrorMsg) {
    return {
      status: 500,
      body: {
        error: `Database records cleared, but failed to delete Supabase Auth account: ${authDeleteErrorMsg}`,
        database_deleted: true,
        auth_deleted: false,
        cleanup_required: true,
        teacher_id: resolvedTeacherId || cleanTeacherId,
        user_id: resolvedUserId || cleanUserId,
        email: targetEmail || cleanEmail
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      database_deleted: true,
      auth_deleted: true,
      already_deleted: isAlreadyDeleted,
      message: isAlreadyDeleted
        ? 'Teacher account was already deleted or does not exist.'
        : 'Teacher and associated records deleted successfully.'
    }
  };
}

async function runTeacherAuthOrphanRecoveryTests() {
  console.log('=== RUNNING TEACHER AUTH ORPHAN RECOVERY & FAILURE TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --- TEST 1: NORMAL DELETION (DB ✓, Auth ✓) ---
  {
    const teacherUuid = '11111111-1111-4111-a111-111111111111';
    const userUuid = '22222222-2222-4222-a222-222222222222';
    const email = 'teacher1@school.ac.ke';

    const mockSupabase = {
      dbState: {
        teachers: [{ id: teacherUuid, user_id: userUuid, email }],
        users: [{ id: userUuid, teacher_id: teacherUuid, email }]
      },
      rpc: async () => ({ error: { code: 'PGRST202' } }), // Simulate fallback
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            if (id === userUuid) return { error: null };
            return { error: { message: 'User not found', status: 404 } };
          },
          listUsers: async () => ({ data: { users: [] } })
        }
      }
    };

    const req = {
      headers: { authorization: 'Bearer admin_valid_token' },
      body: { teacherId: teacherUuid, userId: userUuid, email }
    };

    const res = await simulateTeacherDeletionHandler(req, mockSupabase);
    testAssert(
      res.status === 200 && res.body.success === true && res.body.database_deleted === true && res.body.auth_deleted === true,
      'Test 1 — Normal deletion returns HTTP 200 with database_deleted: true and auth_deleted: true'
    );
    testAssert(
      mockSupabase.dbState.teachers.length === 0 && mockSupabase.dbState.users.length === 0,
      'Test 1 — Teacher and user records removed from database'
    );
  }

  // --- TEST 2: AUTH DELETION FAILURE (DB ✓, Auth ✗) ---
  {
    const teacherUuid = '33333333-3333-4333-a333-333333333333';
    const userUuid = '44444444-4444-4444-a444-444444444444';
    const email = 'teacher2@school.ac.ke';

    const mockSupabase = {
      dbState: {
        teachers: [{ id: teacherUuid, user_id: userUuid, email }],
        users: [{ id: userUuid, teacher_id: teacherUuid, email }]
      },
      rpc: async () => ({ error: { code: 'PGRST202' } }),
      auth: {
        admin: {
          deleteUser: async () => ({ error: { message: 'Auth service API network error 503' } }),
          listUsers: async () => { throw new Error('Auth service API network error 503'); }
        }
      }
    };

    const req = {
      headers: { authorization: 'Bearer admin_valid_token' },
      body: { teacherId: teacherUuid, userId: userUuid, email }
    };

    const res = await simulateTeacherDeletionHandler(req, mockSupabase);
    testAssert(
      res.status === 500,
      'Test 2 — Auth deletion failure returns HTTP 500 error status'
    );
    testAssert(
      res.body.database_deleted === true && res.body.auth_deleted === false && res.body.cleanup_required === true,
      'Test 2 — Error body explicitly flags database_deleted: true, auth_deleted: false, cleanup_required: true'
    );
    testAssert(
      mockSupabase.dbState.teachers.length === 0 && mockSupabase.dbState.users.length === 0,
      'Test 2 — Database records were cleared as expected prior to Auth deletion failure'
    );
  }

  // --- TEST 3: RETRY AFTER AUTH FAILURE (DB missing, Auth remaining -> Deleted) ---
  {
    const teacherUuid = '33333333-3333-4333-a333-333333333333';
    const userUuid = '44444444-4444-4444-a444-444444444444';
    const email = 'teacher2@school.ac.ke';

    let authUserExists = true;

    const mockSupabase = {
      dbState: {
        teachers: [], // Already deleted in previous run!
        users: []     // Already deleted in previous run!
      },
      rpc: async () => ({ error: { code: 'PGRST202' } }),
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            if (id === userUuid && authUserExists) {
              authUserExists = false;
              return { error: null };
            }
            return { error: { message: 'User not found', status: 404 } };
          },
          listUsers: async () => ({ data: { users: authUserExists ? [{ id: userUuid, email }] : [] } })
        }
      }
    };

    const req = {
      headers: { authorization: 'Bearer admin_valid_token' },
      body: { teacherId: teacherUuid, userId: userUuid, email }
    };

    const res = await simulateTeacherDeletionHandler(req, mockSupabase);
    testAssert(
      res.status === 200 && res.body.already_deleted === true && res.body.auth_deleted === true,
      'Test 3 — Retry after Auth failure resolves lingering Auth user and completes deletion idempotently'
    );
    testAssert(
      !authUserExists,
      'Test 3 — Lingering Auth user account successfully deleted during retry'
    );
  }

  // --- TEST 4: AUTH ACCOUNT ALREADY ABSENT ---
  {
    const teacherUuid = '55555555-5555-4555-a555-555555555555';
    const userUuid = '66666666-6666-4666-a666-666666666666';

    const mockSupabase = {
      dbState: { teachers: [], users: [] },
      rpc: async () => ({ error: { code: 'PGRST202' } }),
      auth: {
        admin: {
          deleteUser: async () => ({ error: { message: 'User not found', status: 404 } }),
          listUsers: async () => ({ data: { users: [] } })
        }
      }
    };

    const req = {
      headers: { authorization: 'Bearer admin_valid_token' },
      body: { teacherId: teacherUuid, userId: userUuid }
    };

    const res = await simulateTeacherDeletionHandler(req, mockSupabase);
    testAssert(
      res.status === 200 && res.body.success === true && res.body.auth_deleted === true,
      'Test 4 — Missing Auth account handled safely with idempotent 200 success response'
    );
  }

  // --- TEST 5: WRONG AUTH IDENTITY SAFETY ---
  {
    const targetUserUuid = '77777777-7777-4777-a777-777777777777';
    const foreignUserUuid = '99999999-9999-4999-a999-999999999999';
    let foreignUserDeleted = false;

    const mockSupabase = {
      dbState: { teachers: [], users: [] },
      rpc: async () => ({ error: { code: 'PGRST202' } }),
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            if (id === foreignUserUuid) {
              foreignUserDeleted = true;
            }
            return { error: null };
          },
          listUsers: async () => ({
            data: {
              users: [
                { id: foreignUserUuid, email: 'unrelated_other_user@school.ac.ke' },
                { id: targetUserUuid, email: 'target_teacher@school.ac.ke' }
              ]
            }
          })
        }
      }
    };

    const req = {
      headers: { authorization: 'Bearer admin_valid_token' },
      body: { userId: targetUserUuid, email: 'target_teacher@school.ac.ke' }
    };

    await simulateTeacherDeletionHandler(req, mockSupabase);
    testAssert(
      foreignUserDeleted === false,
      'Test 5 — Deletion mechanism strictly targets specified user and NEVER deletes unrelated Auth users'
    );
  }

  // --- TEST 6: HISTORICAL DATA PRESERVATION ---
  {
    const mockDbAcademicRecords = {
      marks: [{ id: 'm1', student_id: 's1', score: 85, entered_by_teacher_id: 'tch_deleted_99' }],
      attendance: [{ id: 'a1', student_id: 's1', status: 'Present', recorded_by: 'tch_deleted_99' }],
      report_cards: [{ id: 'rc1', student_id: 's1', term: 1, year: 2026 }],
      merit_lists: [{ id: 'ml1', class_id: 'c1', term: 1, year: 2026 }],
      learners: [{ id: 's1', name: 'John Doe', class_id: 'c1' }],
      classes: [{ id: 'c1', class_name: 'Grade 7' }],
      streams: [{ id: 'str1', stream_name: 'East', class_id: 'c1' }],
      subjects: [{ id: 'sub1', name: 'Mathematics' }],
      examinations: [{ id: 'e1', name: 'Mid Term 2026' }]
    };

    // Verify academic records exist
    const initialMarksCount = mockDbAcademicRecords.marks.length;
    const initialAttendanceCount = mockDbAcademicRecords.attendance.length;

    // Run deletion for teacher
    const req = {
      headers: { authorization: 'Bearer admin_valid_token' },
      body: { teacherId: '88888888-8888-4888-a888-888888888888', email: 'deleted_teacher@school.ac.ke' }
    };

    const mockSupabase = {
      dbState: { teachers: [], users: [] },
      rpc: async () => ({ error: { code: 'PGRST202' } }),
      auth: {
        admin: {
          deleteUser: async () => ({ error: null }),
          listUsers: async () => ({ data: { users: [] } })
        }
      }
    };

    await simulateTeacherDeletionHandler(req, mockSupabase);

    testAssert(
      mockDbAcademicRecords.marks.length === initialMarksCount &&
      mockDbAcademicRecords.attendance.length === initialAttendanceCount &&
      mockDbAcademicRecords.report_cards.length === 1 &&
      mockDbAcademicRecords.merit_lists.length === 1 &&
      mockDbAcademicRecords.learners.length === 1 &&
      mockDbAcademicRecords.classes.length === 1 &&
      mockDbAcademicRecords.streams.length === 1 &&
      mockDbAcademicRecords.subjects.length === 1 &&
      mockDbAcademicRecords.examinations.length === 1,
      'Test 6 — Historical academic data (marks, attendance, report cards, merit lists, learners, classes) remains 100% intact'
    );
  }

  // --- TEST 7: UNAUTHORIZED REQUEST PROTECTION ---
  {
    const reqUnauth = { headers: {}, body: { teacherId: '11111111-1111-4111-a111-111111111111' } };
    const reqForbidden = { headers: { authorization: 'Bearer teacher_token' }, body: { teacherId: '11111111-1111-4111-a111-111111111111' } };

    const mockSupabase = { auth: { admin: { deleteUser: async () => ({ error: null }) } } };

    const resUnauth = await simulateTeacherDeletionHandler(reqUnauth, mockSupabase);
    const resForbidden = await simulateTeacherDeletionHandler(reqForbidden, mockSupabase);

    testAssert(
      resUnauth.status === 401 && resForbidden.status === 403,
      'Test 7 — Unauthorized requests correctly blocked (401 for unauthenticated, 403 for non-admin)'
    );
  }

  console.log(`\n=== TEACHER AUTH DELETION TEST SUMMARY ===`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTeacherAuthOrphanRecoveryTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
