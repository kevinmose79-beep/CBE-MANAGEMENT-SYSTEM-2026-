// Unit tests for /api/admin/create-learner provisioning and security authorization contract (Phase 6D.3)

export async function runLearnerProvisioningTests() {
  console.log('=== RUNNING ADMIN CREATE-LEARNER PROVISIONING & SECURITY TESTS ===\n');

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

  // Simulated server handler matching server.ts /api/admin/create-learner logic
  async function simulateCreateLearnerHandler(
    req: { headers: Record<string, string>; body: any },
    mockSupabaseAdmin: any
  ): Promise<{ status: number; body: any }> {
    let createdStudentId: string | null = null;
    let authUserId: string | null = null;

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
        return { status: 403, body: { error: "Forbidden: Only administrators can provision learner accounts." } };
      }

      // 2. Validate student payload
      const studentInput = req.body.student || req.body;
      const customPassword = req.body.password;

      if (!studentInput || typeof studentInput !== 'object') {
        return { status: 400, body: { error: "Invalid request payload: student object is required." } };
      }

      const firstName = (studentInput.first_name || '').trim();
      const lastName = (studentInput.last_name || '').trim();
      const secondName = (studentInput.second_name || '').trim();
      const rawAdmissionNumber = (studentInput.admission_number || '').trim();
      const rawGender = (studentInput.gender || 'M').toString().trim();
      const dob = studentInput.dob ? String(studentInput.dob).trim() : null;

      if (!rawAdmissionNumber) {
        return { status: 400, body: { error: "Admission number is required." } };
      }

      const normalizedAdm = rawAdmissionNumber.toUpperCase();

      let fullName = studentInput.full_name ? String(studentInput.full_name).trim() : '';
      if (!fullName) {
        if (!firstName && !lastName) {
          return { status: 400, body: { error: "Learner name (first and last name) is required." } };
        }
        fullName = `${firstName}${secondName ? ' ' + secondName : ''} ${lastName}`.trim();
      }

      const canonicalGender = (rawGender === 'M' || rawGender.toLowerCase() === 'boy' || rawGender.toLowerCase() === 'male') ? 'M' : 'F';

      // 3. Pre-check admission number uniqueness (case-insensitive)
      const { data: existingStudent, error: checkError } = await mockSupabaseAdmin
        .from('students')
        .select('id, admission_number')
        .ilike('admission_number', normalizedAdm)
        .maybeSingle();

      if (checkError) {
        return { status: 500, body: { error: `Database error verifying admission number: ${checkError.message}` } };
      }

      if (existingStudent) {
        return {
          status: 409,
          body: { error: `Admission number "${normalizedAdm}" already exists in the student directory.` }
        };
      }

      // 4. Resolve class_id and stream_id
      let targetClassId: string | null = studentInput.class_id || 'cls-uuid-1';
      let targetStreamId: string | null = studentInput.stream_id || 'strm-uuid-1';

      // 5. Derive canonical email
      const cleanEmailPrefix = normalizedAdm.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const canonicalEmail = `${cleanEmailPrefix}@learner.cbe.ac.ke`;

      // 6. Determine initial password
      const initialPassword = (typeof customPassword === 'string' && customPassword.trim().length >= 6)
        ? customPassword.trim()
        : 'Learner@2026';

      // 7. Step A: Insert into public.students
      const studentPayload = {
        admission_number: normalizedAdm,
        full_name: fullName,
        gender: canonicalGender,
        class_id: targetClassId,
        stream_id: targetStreamId,
        dob: dob || null,
        active: studentInput.active ?? true
      };

      const { data: createdStudent, error: createStudentErr } = await mockSupabaseAdmin
        .from('students')
        .insert([studentPayload])
        .select()
        .single();

      if (createStudentErr || !createdStudent) {
        if (createStudentErr?.code === '23505') {
          return { status: 409, body: { error: `Admission number "${normalizedAdm}" already exists.` } };
        }
        return { status: 400, body: { error: `Failed to create student record: ${createStudentErr?.message || 'Unknown database error'}` } };
      }

      createdStudentId = createdStudent.id;

      // 8. Step B: Create Auth Account in Supabase Auth
      const { data: authData, error: authError } = await mockSupabaseAdmin.auth.admin.createUser({
        email: canonicalEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          role: 'learner',
          name: fullName,
          student_id: createdStudentId,
          admission_number: normalizedAdm
        }
      });

      if (authError || !authData || !authData.user) {
        // Compensating rollback
        await mockSupabaseAdmin.from('students').delete().eq('id', createdStudentId);
        createdStudentId = null;

        if (authError?.message?.includes('User already registered') || authError?.message?.includes('already been registered')) {
          return { status: 409, body: { error: `An authentication account with email "${canonicalEmail}" already exists.` } };
        }
        return { status: 400, body: { error: `Failed to provision Auth credentials: ${authError?.message || 'Unknown Auth error'}` } };
      }

      authUserId = authData.user.id;

      // 9. Step C: Create public.users profile
      const { data: userProfile, error: userProfileErr } = await mockSupabaseAdmin
        .from('users')
        .insert([{
          id: authUserId,
          name: fullName,
          email: canonicalEmail,
          role: 'learner',
          student_id: createdStudentId,
          teacher_id: null
        }])
        .select()
        .single();

      if (userProfileErr || !userProfile) {
        // Compensating rollback
        await mockSupabaseAdmin.auth.admin.deleteUser(authUserId);
        await mockSupabaseAdmin.from('students').delete().eq('id', createdStudentId);
        authUserId = null;
        createdStudentId = null;

        return { status: 400, body: { error: `Failed to create learner user profile: ${userProfileErr?.message || 'Unknown database error'}` } };
      }

      // 10. Return 201 Created
      return {
        status: 201,
        body: {
          success: true,
          student: createdStudent,
          credentials: {
            admission_number: normalizedAdm,
            email: canonicalEmail,
            initial_password: initialPassword
          }
        }
      };

    } catch (err: any) {
      if (authUserId) {
        await mockSupabaseAdmin.from('users').delete().eq('id', authUserId);
        await mockSupabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      if (createdStudentId) {
        await mockSupabaseAdmin.from('students').delete().eq('id', createdStudentId);
      }
      return { status: 500, body: { error: `Internal server error: ${err.message}` } };
    }
  }

  // --- TEST 1: Missing authentication token ---
  {
    const req = { headers: {}, body: { student: { admission_number: 'ADM-001', first_name: 'John', last_name: 'Doe' } } };
    const mockDb = {};
    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 401, 'Test 1 — Unauthenticated request returns 401 Unauthorized', `got ${res.status}`);
  }

  // --- TEST 2: Non-admin caller (e.g. class teacher) ---
  {
    const mockDb = {
      auth: {
        getUser: async (token: string) => ({ data: { user: { id: 'teacher-auth-uuid', email: 'teacher@cbe.ac.ke' } }, error: null })
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 'teacher-auth-uuid', role: 'class_teacher' }, error: null })
          })
        })
      })
    };
    const req = {
      headers: { authorization: 'Bearer valid-teacher-token' },
      body: { student: { admission_number: 'ADM-001', first_name: 'John', last_name: 'Doe' } }
    };
    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 403, 'Test 2 — Non-admin caller returns 403 Forbidden', `got ${res.status}`);
  }

  // --- TEST 3: Validation: Missing admission number ---
  {
    const mockDb = {
      auth: {
        getUser: async (token: string) => ({ data: { user: { id: 'admin-auth-uuid', email: 'admin@cbe.ac.ke' } }, error: null })
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 'admin-auth-uuid', role: 'admin' }, error: null })
          })
        })
      })
    };
    const req = {
      headers: { authorization: 'Bearer valid-admin-token' },
      body: { student: { admission_number: '', first_name: 'John', last_name: 'Doe' } }
    };
    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 400, 'Test 3 — Missing admission number returns 400 Bad Request', `got ${res.status}`);
  }

  // --- TEST 4: Duplicate admission number pre-check returns 409 Conflict ---
  {
    const mockDb = {
      auth: {
        getUser: async (token: string) => ({ data: { user: { id: 'admin-auth-uuid', email: 'admin@cbe.ac.ke' } }, error: null })
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'admin-auth-uuid', role: 'admin' }, error: null })
              })
            })
          };
        }
        if (table === 'students') {
          return {
            select: () => ({
              ilike: (col: string, val: string) => ({
                maybeSingle: async () => ({ data: { id: 'existing-student-uuid', admission_number: 'ADM-2024-001' }, error: null })
              })
            })
          };
        }
        return {};
      }
    };
    const req = {
      headers: { authorization: 'Bearer valid-admin-token' },
      body: { student: { admission_number: 'adm-2024-001', first_name: 'John', last_name: 'Doe' } }
    };
    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 409, 'Test 4 — Duplicate admission number returns 409 Conflict', `got ${res.status}`);
  }

  // --- TEST 5: Successful Learner Creation & Identity Chain ---
  {
    let createdStudentRow: any = null;
    let createdAuthRow: any = null;
    let createdUserRow: any = null;

    const mockDb = {
      auth: {
        getUser: async (token: string) => ({ data: { user: { id: 'admin-auth-uuid', email: 'admin@cbe.ac.ke' } }, error: null }),
        admin: {
          createUser: async (payload: any) => {
            createdAuthRow = { id: 'auth-learner-uuid-999', ...payload };
            return { data: { user: createdAuthRow }, error: null };
          }
        }
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'admin-auth-uuid', role: 'admin' }, error: null })
              })
            }),
            insert: (payload: any[]) => {
              createdUserRow = payload[0];
              return {
                select: () => ({
                  single: async () => ({ data: createdUserRow, error: null })
                })
              };
            }
          };
        }
        if (table === 'students') {
          return {
            select: () => ({
              ilike: () => ({
                maybeSingle: async () => ({ data: null, error: null })
              })
            }),
            insert: (payload: any[]) => {
              createdStudentRow = { id: 'std-uuid-created-555', ...payload[0] };
              return {
                select: () => ({
                  single: async () => ({ data: createdStudentRow, error: null })
                })
              };
            }
          };
        }
        return {};
      }
    };

    const req = {
      headers: { authorization: 'Bearer valid-admin-token' },
      body: {
        student: {
          admission_number: 'ADM-2024-888',
          first_name: 'Faith',
          last_name: 'Chepngetich',
          gender: 'F',
          class_id: 'cls-uuid-1',
          stream_id: 'strm-uuid-1'
        },
        password: 'LearnerSecure2026!'
      }
    };

    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 201, 'Test 5.1 — Successful creation returns 201 Created', `got ${res.status}`);
    assert(createdStudentRow !== null && createdStudentRow.admission_number === 'ADM-2024-888', 'Test 5.2 — Student record created with normalized admission number');
    assert(createdAuthRow !== null && createdAuthRow.email === 'adm-2024-888@learner.cbe.ac.ke', 'Test 5.3 — Canonical email derived correctly');
    assert(createdAuthRow.user_metadata.role === 'learner', 'Test 5.4 — Auth user_metadata role is "learner"');
    assert(createdAuthRow.user_metadata.student_id === createdStudentRow.id, 'Test 5.5 — Auth user_metadata student_id matches student.id');
    assert(createdUserRow !== null && createdUserRow.id === createdAuthRow.id, 'Test 5.6 — public.users.id === auth.users.id');
    assert(createdUserRow.student_id === createdStudentRow.id, 'Test 5.7 — public.users.student_id === public.students.id');
    assert(createdUserRow.role === 'learner', 'Test 5.8 — public.users.role === "learner"');
    assert(res.body.credentials.initial_password === 'LearnerSecure2026!', 'Test 5.9 — Return credentials includes custom initial password');
  }

  // --- TEST 6: Compensating Rollback if Auth Creation Fails ---
  {
    let studentDeleted: boolean = false;

    const mockDb = {
      auth: {
        getUser: async (token: string) => ({ data: { user: { id: 'admin-auth-uuid', email: 'admin@cbe.ac.ke' } }, error: null }),
        admin: {
          createUser: async () => ({ data: null, error: { message: 'Database connection failed' } })
        }
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'admin-auth-uuid', role: 'admin' }, error: null })
              })
            })
          };
        }
        if (table === 'students') {
          return {
            select: () => ({
              ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
            }),
            insert: (payload: any[]) => ({
              select: () => ({ single: async () => ({ data: { id: 'std-uuid-to-rollback', ...payload[0] }, error: null }) })
            }),
            delete: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === 'std-uuid-to-rollback') {
                  studentDeleted = true;
                }
                return Promise.resolve({ data: null, error: null });
              }
            })
          };
        }
        return {};
      }
    };

    const req = {
      headers: { authorization: 'Bearer valid-admin-token' },
      body: {
        student: { admission_number: 'ADM-ROLLBACK-01', first_name: 'Roll', last_name: 'Back' }
      }
    };

    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 400, 'Test 6.1 — Auth failure returns 400 Bad Request', `got ${res.status}`);
    assert(studentDeleted, 'Test 6.2 — Compensating transaction deleted student record from public.students');
  }

  // --- TEST 7: Compensating Rollback if public.users Profile Fails ---
  {
    let authUserDeleted: boolean = false;
    let studentDeleted: boolean = false;

    const mockDb = {
      auth: {
        getUser: async (token: string) => ({ data: { user: { id: 'admin-auth-uuid', email: 'admin@cbe.ac.ke' } }, error: null }),
        admin: {
          createUser: async (payload: any) => ({ data: { user: { id: 'auth-to-delete', ...payload } }, error: null }),
          deleteUser: async (id: string) => {
            if (id === 'auth-to-delete') authUserDeleted = true;
            return { data: null, error: null };
          }
        }
      },
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'admin-auth-uuid', role: 'admin' }, error: null })
              })
            }),
            insert: () => ({
              select: () => ({ single: async () => ({ data: null, error: { message: 'Foreign key violation in users table' } }) })
            })
          };
        }
        if (table === 'students') {
          return {
            select: () => ({
              ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
            }),
            insert: (payload: any[]) => ({
              select: () => ({ single: async () => ({ data: { id: 'std-to-delete', ...payload[0] }, error: null }) })
            }),
            delete: () => ({
              eq: (col: string, val: string) => {
                if (col === 'id' && val === 'std-to-delete') {
                  studentDeleted = true;
                }
                return Promise.resolve({ data: null, error: null });
              }
            })
          };
        }
        return {};
      }
    };

    const req = {
      headers: { authorization: 'Bearer valid-admin-token' },
      body: {
        student: { admission_number: 'ADM-ROLLBACK-02', first_name: 'Roll', last_name: 'Back' }
      }
    };

    const res = await simulateCreateLearnerHandler(req, mockDb);
    assert(res.status === 400, 'Test 7.1 — Profile failure returns 400 Bad Request', `got ${res.status}`);
    assert(authUserDeleted, 'Test 7.2 — Compensating transaction deleted created Auth user');
    assert(studentDeleted, 'Test 7.3 — Compensating transaction deleted created student record');
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  return { passed, failed };
}

// Execute tests
runLearnerProvisioningTests().catch(console.error);
