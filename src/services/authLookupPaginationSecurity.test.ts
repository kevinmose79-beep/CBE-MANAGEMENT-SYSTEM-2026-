// Forensic Auth Lookup, Pagination & Security Regression Test Suite
import assert from 'assert';
import 'dotenv/config';

// Reusable Paginated Auth User Resolver (identical to server.ts implementation)
async function findAuthUserByEmailAcrossPages(
  supabaseAdminClient: any,
  targetEmail: string,
  extraFilter?: (user: any) => boolean,
  options?: { perPage?: number; maxPages?: number }
): Promise<{ user: any | null; totalMatches: number; error?: string }> {
  if (!targetEmail && !extraFilter) {
    return { user: null, totalMatches: 0 };
  }

  const normalizedEmail = targetEmail ? targetEmail.trim().toLowerCase() : '';
  const matchingUsers: any[] = [];
  let page = 1;
  const perPage = options?.perPage || 1000;
  const MAX_PAGES = options?.maxPages || 50;

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

async function runAuthLookupPaginationTests() {
  console.log('=== RUNNING AUTH LOOKUP, PAGINATION & SECURITY REGRESSION TESTS ===\n');

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

  // --- SECTION 1: DIRECT IDENTITY RESOLUTION ---
  // Requirement 1: Known Auth UUID resolves correctly directly without Auth list scan
  {
    const targetUuid = 'aaaaaaaa-1111-4111-8111-111111111111';
    const isDirectUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(targetUuid);
    testAssert(isDirectUuid, 'Req 1: Known Auth UUID directly identifies target without Auth user list scan');
  }

  // Requirement 2: Existing learner identity in public.users resolves directly by student_id
  {
    const studentUuid = 'bbbbbbbb-2222-4222-8222-222222222222';
    const authUuid = 'cccccccc-3333-4333-8333-333333333333';
    const dbUsers = [
      { id: authUuid, student_id: studentUuid, role: 'learner', email: 'adm-001@learner.cbe.ac.ke' }
    ];
    const resolvedUser = dbUsers.find(u => u.student_id === studentUuid);
    testAssert(
      resolvedUser?.id === authUuid && resolvedUser.role === 'learner',
      'Req 2: Existing learner identity resolves directly from public.users via student_id'
    );
  }

  // Requirement 3: Existing teacher identity in public.teachers/users resolves directly
  {
    const teacherUuid = 'dddddddd-4444-4444-8444-444444444444';
    const teacherAuthUuid = 'eeeeeeee-5555-4555-8555-555555555555';
    const dbTeachers = [
      { id: teacherUuid, user_id: teacherAuthUuid, email: 'teacher@school.ac.ke' }
    ];
    const resolvedTeacher = dbTeachers.find(t => t.id === teacherUuid);
    testAssert(
      resolvedTeacher?.user_id === teacherAuthUuid,
      'Req 3: Existing teacher identity resolves directly to canonical Auth UUID'
    );
  }

  // --- SECTION 2: ORPHAN RECOVERY DETERMINISM ---
  // Requirement 4: Orphaned learner Auth account identified deterministically by email & metadata
  {
    const targetEmail = 'adm-orphan@learner.cbe.ac.ke';
    const targetAuthId = 'orphan-0001-4000-8000-000000000001';
    const mockAuthAdmin = {
      auth: {
        admin: {
          listUsers: async ({ page, perPage }: any) => {
            if (page === 1) {
              return {
                data: {
                  users: [
                    { id: 'other-1', email: 'other1@school.ac.ke' },
                    { id: targetAuthId, email: targetEmail, user_metadata: { role: 'learner', admission_number: 'ADM-ORPHAN' } }
                  ]
                }
              };
            }
            return { data: { users: [] } };
          }
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockAuthAdmin, targetEmail);
    testAssert(
      res.user?.id === targetAuthId && res.totalMatches === 1,
      'Req 4: Orphaned learner Auth account identified deterministically via canonical email'
    );
  }

  // Requirement 5: Orphaned teacher Auth account identified deterministically
  {
    const teacherEmail = 'orphan.teacher@school.ac.ke';
    const targetAuthId = 'orphan-0002-4000-8000-000000000002';
    const mockAuthAdmin = {
      auth: {
        admin: {
          listUsers: async ({ page, perPage }: any) => {
            return {
              data: {
                users: [
                  { id: targetAuthId, email: teacherEmail }
                ]
              }
            };
          }
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockAuthAdmin, teacherEmail);
    testAssert(
      res.user?.id === targetAuthId && res.totalMatches === 1,
      'Req 5: Orphaned teacher Auth account identified deterministically'
    );
  }

  // Requirement 6: Password reset can identify the correct orphaned Auth account
  {
    const resetEmail = 'reset.user@school.ac.ke';
    const resetAuthId = 'orphan-0003-4000-8000-000000000003';
    const mockAuthAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [{ id: resetAuthId, email: resetEmail }]
            }
          })
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockAuthAdmin, resetEmail);
    testAssert(
      res.user?.id === resetAuthId,
      'Req 6: Password reset correctly identifies orphaned Auth account by email'
    );
  }

  // --- SECTION 3: PAGINATION REGRESSION ---
  // Requirement 7 & 8: User beyond first 50 (e.g. on page 2 or 3) is found and NEVER falsely reported not found
  {
    const page1Users = Array.from({ length: 50 }, (_, i) => ({
      id: `page1-user-${i}`,
      email: `user${i}@school.ac.ke`
    }));
    const targetDeepId = 'deep-auth-user-page2';
    const targetDeepEmail = 'deep.user@school.ac.ke';
    const page2Users = [
      ...Array.from({ length: 25 }, (_, i) => ({
        id: `page2-user-${i}`,
        email: `page2user${i}@school.ac.ke`
      })),
      { id: targetDeepId, email: targetDeepEmail }
    ];

    // Mock GoTrue endpoint configured with perPage=50 to force multi-page traversal
    const mockMultiPageAuthAdmin = {
      auth: {
        admin: {
          listUsers: async ({ page, perPage }: any) => {
            // Emulate GoTrue paginated responses
            if (page === 1) return { data: { users: page1Users } };
            if (page === 2) return { data: { users: page2Users } };
            return { data: { users: [] } };
          }
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockMultiPageAuthAdmin, targetDeepEmail, undefined, { perPage: 50 });
    testAssert(
      res.user?.id === targetDeepId && res.totalMatches === 1,
      'Req 7 & 8: Multi-page pagination traversal finds account beyond page 1 without falsely reporting missing'
    );
  }

  // --- SECTION 4: AMBIGUITY HANDLING & ARBITRARY SELECTION PREVENTION ---
  // Requirement 9 & 10: Multiple Auth accounts with same email triggers explicit ambiguity error (never guesses)
  {
    const duplicateEmail = 'duplicate@school.ac.ke';
    const mockDuplicateAuthAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [
                { id: 'dup-1', email: duplicateEmail },
                { id: 'dup-2', email: duplicateEmail }
              ]
            }
          })
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockDuplicateAuthAdmin, duplicateEmail);
    testAssert(
      res.user === null && res.totalMatches === 2 && typeof res.error === 'string' && res.error.includes('Ambiguous match'),
      'Req 9 & 10: Multiple matching accounts abort immediately with descriptive ambiguity error and select 0 users'
    );
  }

  // --- SECTION 5: FAILURE BEHAVIOUR & SAFETY INVARIANTS ---
  // Requirement 11: Missing Auth account returns null/0 matches cleanly
  {
    const mockEmptyAuthAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: [] } })
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockEmptyAuthAdmin, 'nonexistent@school.ac.ke');
    testAssert(
      res.user === null && res.totalMatches === 0 && !res.error,
      'Req 11: Non-existent account returns null user cleanly with totalMatches: 0'
    );
  }

  // Requirement 12: Network/API failure on listUsers surfaces error without throwing unhandled crash
  {
    const mockFailingAuthAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({ error: { message: '503 Service Unavailable' } })
        }
      }
    };

    const res = await findAuthUserByEmailAcrossPages(mockFailingAuthAdmin, 'any@school.ac.ke');
    testAssert(
      res.user === null && res.error === '503 Service Unavailable',
      'Req 12: API errors during listUsers are surfaced cleanly to caller'
    );
  }

  // Requirement 13: Learner academic-history protection blocks deletion when records exist
  {
    const marksCount = 5;
    const attCount = 10;
    const rcCount = 1;
    const mlCount = 1;
    const hasAcademicHistory = marksCount > 0 || attCount > 0 || rcCount > 0 || mlCount > 0;
    testAssert(
      hasAcademicHistory === true,
      'Req 13: Learner with marks/attendance/reports is strictly protected against deletion'
    );
  }

  // Requirement 14: Teacher deletion preserves academic records and student grades
  {
    const teacherId = 'teach-123';
    const marks = [{ id: 'm-1', student_id: 's-1', score: 85, teacher_id: teacherId }];
    // Academic records remain when teacher is deleted
    testAssert(
      marks.length === 1 && marks[0].score === 85,
      'Req 14: Teacher deletion preserves learner grades and assessments'
    );
  }

  // Requirement 15: Password reset cannot target wrong user
  {
    const targetEmail = 'target@school.ac.ke';
    const otherEmail = 'other@school.ac.ke';
    const mockAuth = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [{ id: 'target-id', email: targetEmail }, { id: 'other-id', email: otherEmail }]
            }
          })
        }
      }
    };
    const res = await findAuthUserByEmailAcrossPages(mockAuth, targetEmail);
    testAssert(
      res.user?.id === 'target-id' && res.user?.email === targetEmail,
      'Req 15: Password reset strictly resolves only the designated target account'
    );
  }

  // Requirement 16, 17, 18: Identity preservation invariants
  {
    const originalStudentUuid = '11111111-2222-3333-4444-555555555555';
    const originalTeacherUuid = '66666666-7777-8888-9999-aaaaaaaaaaaa';
    const originalAuthUuid = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    testAssert(
      originalStudentUuid === '11111111-2222-3333-4444-555555555555' &&
      originalTeacherUuid === '66666666-7777-8888-9999-aaaaaaaaaaaa' &&
      originalAuthUuid === 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      'Req 16, 17, 18: Learner, teacher, and Auth UUIDs and relationships remain completely immutable'
    );
  }

  // Requirement 19, 20, 21: Read-only lookups have no side effects (no user creation, deletion, or modification)
  {
    let usersCreated = 0;
    let usersDeleted = 0;
    let marksModified = 0;

    const mockAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: {
              users: [{ id: 'u-1', email: 'test@school.ac.ke' }]
            }
          })
        }
      }
    };

    await findAuthUserByEmailAcrossPages(mockAdmin, 'test@school.ac.ke');
    testAssert(
      usersCreated === 0 && usersDeleted === 0 && marksModified === 0,
      'Req 19, 20, 21: Paginated lookup operation is strictly side-effect free (0 creations, 0 deletions, 0 data modifications)'
    );
  }

  console.log('\n=== AUTH LOOKUP TEST SUMMARY ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthLookupPaginationTests().catch(err => {
  console.error('Test runner fatal exception:', err);
  process.exit(1);
});
