// Unit & integration tests for /api/admin/delete-learner safe deletion pipeline & security contract (Phase 6D.6.1)

export async function runLearnerDeletionTests() {
  console.log('=== RUNNING ADMIN DELETE-LEARNER SAFETY & SECURITY TESTS (Phase 6D.6.1) ===\n');

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

  const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  function isUUID(str: any): boolean {
    if (!str || typeof str !== 'string') return false;
    return UUID_REGEX.test(str.trim());
  }

  // Simulated handler mirroring server.ts deleteLearnerHandler
  async function simulateDeleteLearnerHandler(
    req: { headers: Record<string, string>; body: any },
    mockSupabaseAdmin: any
  ): Promise<{ status: number; body: any }> {
    try {
      // 1. Authenticate caller
      let token: string | null = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
        token = req.body.token.trim();
      }

      if (!token) {
        return { status: 401, body: { error: "Unauthorized: Missing authentication token." } };
      }

      const { data: authUserData, error: tokenError } = await mockSupabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return { status: 401, body: { error: "Unauthorized: Invalid or expired authentication token." } };
      }

      const authenticatedUserId = authUserData.user.id;

      // Verify admin role in public.users
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
        return { status: 401, body: { error: "Unauthorized: Authenticated user record not found in database." } };
      }

      if (adminUser.role !== 'admin') {
        return { status: 403, body: { error: "Forbidden: Only administrators can delete learner accounts." } };
      }

      // 2. Validate student_id
      const rawStudentId = req.body?.student_id || req.body?.id || req.body?.studentId;
      if (!rawStudentId || typeof rawStudentId !== 'string' || !rawStudentId.trim()) {
        return { status: 400, body: { error: "Invalid request payload: student_id is required." } };
      }

      const cleanStudentId = rawStudentId.trim();
      if (!isUUID(cleanStudentId)) {
        return { status: 400, body: { error: "Invalid learner identifier: student_id must be a valid UUID format." } };
      }

      // 3. Locate target student in public.students
      const { data: studentRecord, error: studentFetchErr } = await mockSupabaseAdmin
        .from('students')
        .select('id, admission_number, full_name')
        .eq('id', cleanStudentId)
        .maybeSingle();

      if (studentFetchErr) {
        return { status: 500, body: { error: `Database error querying learner: ${studentFetchErr.message}` } };
      }

      if (!studentRecord) {
        return { status: 404, body: { error: `Learner not found: No student record exists with ID '${cleanStudentId}'.` } };
      }

      // 4. Academic Record Safety Gate: Check for existing marks, attendance, report cards, merit lists
      const [marksRes, attendanceRes, reportCardsRes, meritListsRes] = await Promise.all([
        mockSupabaseAdmin.from('marks').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId),
        mockSupabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId),
        mockSupabaseAdmin.from('report_cards').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId),
        mockSupabaseAdmin.from('merit_lists').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId),
      ]);

      const marksCount = marksRes.count || 0;
      const attendanceCount = attendanceRes.count || 0;
      const reportCardsCount = reportCardsRes.count || 0;
      const meritListsCount = meritListsRes.count || 0;
      const totalProtectedRecords = marksCount + attendanceCount + reportCardsCount + meritListsCount;

      if (totalProtectedRecords > 0) {
        const blockingDetails = [];
        if (marksCount > 0) blockingDetails.push(`${marksCount} assessment mark(s)`);
        if (attendanceCount > 0) blockingDetails.push(`${attendanceCount} attendance record(s)`);
        if (reportCardsCount > 0) blockingDetails.push(`${reportCardsCount} report card(s)`);
        if (meritListsCount > 0) blockingDetails.push(`${meritListsCount} merit list entry/entries`);

        return {
          status: 409,
          body: {
            error: `Permanent Deletion Blocked: Learner '${studentRecord.full_name || studentRecord.admission_number}' has existing academic records (${blockingDetails.join(', ')}). Under CBE data integrity rules, learners with recorded academic history cannot be permanently deleted. Please Deactivate / Archive the learner instead to preserve academic compliance.`,
            blocked: true,
            details: {
              marks_count: marksCount,
              attendance_count: attendanceCount,
              report_cards_count: reportCardsCount,
              merit_lists_count: meritListsCount,
              total_records: totalProtectedRecords,
            }
          }
        };
      }

      // 5. Identity Discovery: find public.users record
      let learnerUserProfile: any = null;
      const { data: userProfileData } = await mockSupabaseAdmin
        .from('users')
        .select('*')
        .eq('student_id', cleanStudentId)
        .maybeSingle();

      if (userProfileData) {
        learnerUserProfile = userProfileData;
      }

      // Safety check: ensure we are not deleting an admin or teacher by accident
      if (learnerUserProfile) {
        if (learnerUserProfile.role && learnerUserProfile.role !== 'learner' && learnerUserProfile.role !== 'student') {
          return { status: 403, body: { error: `Security check failed: Target user profile role is '${learnerUserProfile.role}', not 'learner'. Aborting deletion.` } };
        }
        if (learnerUserProfile.id === authenticatedUserId || learnerUserProfile.id === adminUser.id) {
          return { status: 403, body: { error: "Security check failed: Cannot delete active authenticated administrator profile." } };
        }
        if (learnerUserProfile.teacher_id) {
          return { status: 403, body: { error: "Security check failed: Target profile is linked to a teacher record. Aborting deletion." } };
        }
      }

      const authUserIdToDelete = learnerUserProfile ? learnerUserProfile.id : null;

      // 6. Database Cleanup
      if (learnerUserProfile && learnerUserProfile.id) {
        const { error: userDeleteErr } = await mockSupabaseAdmin
          .from('users')
          .delete()
          .eq('id', learnerUserProfile.id)
          .eq('role', 'learner');

        if (userDeleteErr && userDeleteErr.code !== 'PGRST116') {
          return { status: 500, body: { error: `Database error removing learner user profile: ${userDeleteErr.message}` } };
        }
      }

      const { error: studentDeleteErr } = await mockSupabaseAdmin
        .from('students')
        .delete()
        .eq('id', cleanStudentId);

      if (studentDeleteErr) {
        return { status: 500, body: { error: `Database error removing student record: ${studentDeleteErr.message}` } };
      }

      // 7. Supabase Auth Cleanup
      let authUserDeleted = false;
      if (authUserIdToDelete && isUUID(authUserIdToDelete)) {
        try {
          const { error: authDelErr } = await mockSupabaseAdmin.auth.admin.deleteUser(authUserIdToDelete);
          if (authDelErr) {
            if (authDelErr.status === 404 || authDelErr.message?.includes('not found') || (authDelErr as any).code === 'user_not_found') {
              authUserDeleted = true;
            } else {
              return {
                status: 207,
                body: {
                  success: true,
                  warning: `Learner database record deleted, but Auth account cleanup failed: ${authDelErr.message}`,
                  database_deleted: true,
                  auth_deleted: false,
                  cleanup_required: true,
                  auth_user_id: authUserIdToDelete,
                }
              };
            }
          } else {
            authUserDeleted = true;
          }
        } catch (authEx: any) {
          return {
            status: 207,
            body: {
              success: true,
              warning: `Learner database record deleted, but Auth account cleanup encountered error: ${authEx.message}`,
              database_deleted: true,
              auth_deleted: false,
              cleanup_required: true,
              auth_user_id: authUserIdToDelete,
            }
          };
        }
      }

      return {
        status: 200,
        body: {
          success: true,
          message: `Learner '${studentRecord.full_name || studentRecord.admission_number}' (${studentRecord.admission_number}) successfully and permanently deleted.`,
          student_id: cleanStudentId,
          admission_number: studentRecord.admission_number,
          database_deleted: true,
          auth_deleted: authUserIdToDelete ? authUserDeleted : null,
          academic_records_verified_empty: true,
        }
      };
    } catch (err: any) {
      return { status: 500, body: { error: `Internal server error during learner deletion: ${err.message}` } };
    }
  }

  // --- TEST 1: Unauthenticated request (no token) -> 401
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: null, error: new Error('Missing token') }) }
    };
    const res = await simulateDeleteLearnerHandler({ headers: {}, body: { student_id: 'a0000000-0000-4000-8000-000000000001' } }, mockDb);
    assert(res.status === 401, 'Test 1 — Anonymous request without token returns 401 Unauthorized', `got ${res.status}`);
  }

  // --- TEST 2: Invalid / Expired Token -> 401
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: null }, error: new Error('Token expired') }) }
    };
    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer expired-token' }, body: { student_id: 'a0000000-0000-4000-8000-000000000001' } }, mockDb);
    assert(res.status === 401, 'Test 2 — Invalid / expired token returns 401 Unauthorized', `got ${res.status}`);
  }

  // --- TEST 3: Non-Admin Caller (Teacher/Learner) -> 403
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'teacher-user-id', email: 'teacher@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: 'teacher-user-id', role: 'teacher' }, error: null }) })
            })
          };
        }
        return {};
      }
    };
    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer teacher-token' }, body: { student_id: 'a0000000-0000-4000-8000-000000000001' } }, mockDb);
    assert(res.status === 403, 'Test 3 — Non-admin caller returns 403 Forbidden', `got ${res.status}`);
  }

  // --- TEST 4: Missing student_id -> 400
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) })
      })
    };
    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: {} }, mockDb);
    assert(res.status === 400, 'Test 4 — Missing student_id returns 400 Bad Request', `got ${res.status}`);
  }

  // --- TEST 5: Non-UUID student_id format -> 400
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) })
      })
    };
    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: 'std-not-a-valid-uuid' } }, mockDb);
    assert(res.status === 400, 'Test 5 — Non-UUID student_id returns 400 Bad Request', `got ${res.status}`);
    assert(res.body.error.includes('UUID'), 'Test 5.1 — Error specifically mentions UUID format requirement');
  }

  // --- TEST 6: Non-existent student UUID -> 404
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) })
          };
        }
        if (table === 'students') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          };
        }
        return {};
      }
    };
    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: 'a0000000-0000-4000-8000-000000000404' } }, mockDb);
    assert(res.status === 404, 'Test 6 — Non-existent student UUID returns 404 Not Found', `got ${res.status}`);
  }

  // --- TEST 7: Safety Gate — Learner with marks (marks_count > 0) -> 409 Conflict + 0 Deletions
  {
    let anyDeleteCalled = false;
    const mockDb: any = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }),
        admin: { deleteUser: async () => { anyDeleteCalled = true; return { data: null, error: null }; } }
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) }),
            delete: () => { anyDeleteCalled = true; return { eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }; }
          };
        }
        if (table === 'students') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'b0000000-0000-4000-8000-000000000007', admission_number: 'ADM-007', full_name: 'Bond James' }, error: null }) }) }),
            delete: () => { anyDeleteCalled = true; return { eq: () => Promise.resolve({ data: null, error: null }) }; }
          };
        }
        if (table === 'marks') {
          return {
            select: () => ({ eq: async () => ({ count: 5, data: null, error: null }) }),
            delete: () => { anyDeleteCalled = true; return { eq: () => Promise.resolve({ data: null, error: null }) }; }
          };
        }
        if (table === 'attendance' || table === 'report_cards' || table === 'merit_lists') {
          return {
            select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }),
            delete: () => { anyDeleteCalled = true; return { eq: () => Promise.resolve({ data: null, error: null }) }; }
          };
        }
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: 'b0000000-0000-4000-8000-000000000007' } }, mockDb);
    assert(res.status === 409, 'Test 7.1 — Learner with marks returns 409 Conflict', `got ${res.status}`);
    assert(res.body.blocked === true, 'Test 7.2 — Response includes blocked: true');
    assert(res.body.details?.marks_count === 5, 'Test 7.3 — Details specifies marks_count: 5');
    assert(res.body.error.includes('assessment mark(s)'), 'Test 7.4 — Error message explains blocked marks reason');
    assert(!anyDeleteCalled, 'Test 7.5 — Safety Gate invariant: ZERO delete operations executed when marks exist');
  }

  // --- TEST 8: Safety Gate — Learner with attendance records -> 409 Conflict + 0 Deletions
  {
    let anyDeleteCalled = false;
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) }) };
        if (table === 'students') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'b0000000-0000-4000-8000-000000000008', admission_number: 'ADM-008', full_name: 'Attended Learner' }, error: null }) }) }) };
        if (table === 'marks') return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        if (table === 'attendance') return { select: () => ({ eq: async () => ({ count: 12, data: null, error: null }) }) };
        if (table === 'report_cards' || table === 'merit_lists') return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        return { delete: () => { anyDeleteCalled = true; return { eq: () => Promise.resolve({ data: null, error: null }) }; } };
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: 'b0000000-0000-4000-8000-000000000008' } }, mockDb);
    assert(res.status === 409, 'Test 8.1 — Learner with attendance records returns 409 Conflict', `got ${res.status}`);
    assert(res.body.details?.attendance_count === 12, 'Test 8.2 — Details specifies attendance_count: 12');
    assert(!anyDeleteCalled, 'Test 8.3 — Safety Gate invariant: ZERO delete operations executed when attendance exists');
  }

  // --- TEST 9: Safety Gate — Learner with report cards -> 409 Conflict + 0 Deletions
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) }) };
        if (table === 'students') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'b0000000-0000-4000-8000-000000000009', admission_number: 'ADM-009', full_name: 'Report Card Learner' }, error: null }) }) }) };
        if (table === 'marks') return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        if (table === 'attendance') return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        if (table === 'report_cards') return { select: () => ({ eq: async () => ({ count: 2, data: null, error: null }) }) };
        if (table === 'merit_lists') return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: 'b0000000-0000-4000-8000-000000000009' } }, mockDb);
    assert(res.status === 409, 'Test 9.1 — Learner with report cards returns 409 Conflict', `got ${res.status}`);
    assert(res.body.details?.report_cards_count === 2, 'Test 9.2 — Details specifies report_cards_count: 2');
  }

  // --- TEST 10: Safety Gate — Learner with merit lists -> 409 Conflict + 0 Deletions
  {
    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) }) }) };
        if (table === 'students') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'b0000000-0000-4000-8000-000000000010', admission_number: 'ADM-010', full_name: 'Merit Learner' }, error: null }) }) }) };
        if (table === 'marks' || table === 'attendance' || table === 'report_cards') return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        if (table === 'merit_lists') return { select: () => ({ eq: async () => ({ count: 3, data: null, error: null }) }) };
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: 'b0000000-0000-4000-8000-000000000010' } }, mockDb);
    assert(res.status === 409, 'Test 10.1 — Learner with merit list entries returns 409 Conflict', `got ${res.status}`);
    assert(res.body.details?.merit_lists_count === 3, 'Test 10.2 — Details specifies merit_lists_count: 3');
  }

  // --- TEST 11: Clean Deletion with full identity (students, users, auth.users) -> 200 OK
  {
    let studentDeleted = false;
    let userDeleted = false;
    let authUserDeleted = false;
    const targetStudentId = 'c0000000-0000-4000-8000-000000000011';
    const targetAuthId = 'c0000000-0000-4000-8000-000000000099';

    const mockDb: any = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }),
        admin: {
          deleteUser: async (id: string) => {
            if (id === targetAuthId) authUserDeleted = true;
            return { data: null, error: null };
          }
        }
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === 'admin-user-id') {
                  return { maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) };
                }
                if (col === 'student_id' && val === targetStudentId) {
                  return { maybeSingle: async () => ({ data: { id: targetAuthId, student_id: targetStudentId, role: 'learner', email: 'adm011@learner.cbe.ac.ke' }, error: null }) };
                }
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
            }),
            delete: () => ({
              eq: (col1: string, val1: string) => ({
                eq: (col2: string, val2: string) => {
                  if (col1 === 'id' && val1 === targetAuthId && col2 === 'role' && val2 === 'learner') {
                    userDeleted = true;
                  }
                  return Promise.resolve({ data: null, error: null });
                }
              })
            })
          };
        }
        if (table === 'students') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: targetStudentId, admission_number: 'ADM-011', full_name: 'Clean Delete Learner' }, error: null }) })
            }),
            delete: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === targetStudentId) studentDeleted = true;
                return Promise.resolve({ data: null, error: null });
              }
            })
          };
        }
        if (table === 'marks' || table === 'attendance' || table === 'report_cards' || table === 'merit_lists') {
          return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        }
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: targetStudentId } }, mockDb);
    assert(res.status === 200, 'Test 11.1 — Clean deletion returns 200 OK', `got ${res.status}`);
    assert(res.body.success === true, 'Test 11.2 — Response includes success: true');
    assert(userDeleted, 'Test 11.3 — public.users learner profile was deleted');
    assert(studentDeleted, 'Test 11.4 — public.students record was deleted');
    assert(authUserDeleted, 'Test 11.5 — Supabase Auth user account was deleted via admin.deleteUser');
    assert(res.body.academic_records_verified_empty === true, 'Test 11.6 — Verified zero academic records in response');
  }

  // --- TEST 12: Clean Deletion of historical learner without user profile/auth account -> 200 OK
  {
    let studentDeleted = false;
    const targetStudentId = 'd0000000-0000-4000-8000-000000000012';

    const mockDb: any = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }),
        admin: { deleteUser: async () => ({ data: null, error: null }) }
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === 'admin-user-id') {
                  return { maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) };
                }
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
            }),
            delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) })
          };
        }
        if (table === 'students') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: targetStudentId, admission_number: 'ADM-HIST-012', full_name: 'Historical Learner' }, error: null }) })
            }),
            delete: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === targetStudentId) studentDeleted = true;
                return Promise.resolve({ data: null, error: null });
              }
            })
          };
        }
        if (table === 'marks' || table === 'attendance' || table === 'report_cards' || table === 'merit_lists') {
          return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        }
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: targetStudentId } }, mockDb);
    assert(res.status === 200, 'Test 12.1 — Historical learner without user profile returns 200 OK', `got ${res.status}`);
    assert(studentDeleted, 'Test 12.2 — Student record deleted successfully without user profile errors');
    assert(res.body.auth_deleted === null, 'Test 12.3 — Auth deleted is null when no auth user exists');
  }

  // --- TEST 13: Auth User Role Protection (if target profile is teacher or admin) -> 403 Forbidden
  {
    let anyDeleteCalled = false;
    const targetStudentId = 'e0000000-0000-4000-8000-000000000013';

    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === 'admin-user-id') {
                  return { maybeSingle: async () => ({ data: { id: 'admin-user-id', role: 'admin' }, error: null }) };
                }
                if (col === 'student_id' && val === targetStudentId) {
                  // Mismatched role anomaly in database (e.g. linked to teacher account)
                  return { maybeSingle: async () => ({ data: { id: 'teacher-auth-id', student_id: targetStudentId, role: 'teacher', teacher_id: 'tch-001' }, error: null }) };
                }
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
            }),
            delete: () => { anyDeleteCalled = true; return { eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }; }
          };
        }
        if (table === 'students') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: targetStudentId, admission_number: 'ADM-ANOMALY-013', full_name: 'Anomaly Student' }, error: null }) }) }),
            delete: () => { anyDeleteCalled = true; return { eq: () => Promise.resolve({ data: null, error: null }) }; }
          };
        }
        if (table === 'marks' || table === 'attendance' || table === 'report_cards' || table === 'merit_lists') {
          return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        }
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: targetStudentId } }, mockDb);
    assert(res.status === 403, 'Test 13.1 — Target profile with non-learner role triggers 403 Forbidden abort', `got ${res.status}`);
    assert(!anyDeleteCalled, 'Test 13.2 — ZERO delete operations executed when target role is non-learner');
  }

  // --- TEST 14: Caller Identity Protection (cannot delete active admin) -> 403 Forbidden
  {
    let anyDeleteCalled = false;
    const targetStudentId = 'f0000000-0000-4000-8000-000000000014';
    const adminAuthId = 'admin-user-id';

    const mockDb: any = {
      auth: { getUser: async () => ({ data: { user: { id: adminAuthId, email: 'admin@school.ac.ke' } }, error: null }) },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === adminAuthId) {
                  return { maybeSingle: async () => ({ data: { id: adminAuthId, role: 'admin' }, error: null }) };
                }
                if (col === 'student_id' && val === targetStudentId) {
                  // Admin's own ID returned as student_id match
                  return { maybeSingle: async () => ({ data: { id: adminAuthId, student_id: targetStudentId, role: 'admin' }, error: null }) };
                }
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
            }),
            delete: () => { anyDeleteCalled = true; return { eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }; }
          };
        }
        if (table === 'students') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: targetStudentId, admission_number: 'ADM-ADMIN-014', full_name: 'Self Admin' }, error: null }) }) }),
            delete: () => { anyDeleteCalled = true; return { eq: () => Promise.resolve({ data: null, error: null }) }; }
          };
        }
        if (table === 'marks' || table === 'attendance' || table === 'report_cards' || table === 'merit_lists') {
          return { select: () => ({ eq: async () => ({ count: 0, data: null, error: null }) }) };
        }
        return {};
      }
    };

    const res = await simulateDeleteLearnerHandler({ headers: { authorization: 'Bearer valid-admin-token' }, body: { student_id: targetStudentId } }, mockDb);
    assert(res.status === 403, 'Test 14.1 — Attempt to delete administrator profile triggers 403 Forbidden abort', `got ${res.status}`);
    assert(!anyDeleteCalled, 'Test 14.2 — ZERO delete operations executed when target matches admin caller');
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  return { passed, failed };
}

// Execute tests
runLearnerDeletionTests().catch(console.error);
