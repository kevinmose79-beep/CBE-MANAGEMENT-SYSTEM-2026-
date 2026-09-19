import { authService } from './authService';
import { api } from '../lib/storage';
import type { Teacher, User } from '../types';

export async function runAdminPasswordResetAndDeleteTests() {
  console.log('=== RUNNING ADMIN PASSWORD RESET & TEACHER DELETION TESTS ===\n');
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

  // Setup mock admin user
  const adminUser: User = {
    id: 'usr_admin_test',
    email: 'admin@school.ac.ke',
    name: 'Administrator',
    role: 'admin',
    status: 'Active',
  };
  api.setCurrentUser(adminUser);

  // Setup test teacher
  const testTeacher: Teacher = {
    id: 'tch_test_pwd_del',
    user_id: 'usr_test_pwd_del',
    teacher_name: 'Test Teacher Auth',
    tsc_number: 'TSC-11111',
    phone: '+254 700 000 000',
    email: 'testteacherauth@school.ac.ke',
    username: 'testteacherauth',
    is_class_teacher: false,
    status: 'Active',
    allocations: [],
  };
  api.addTeacher(testTeacher);

  // Mock global fetch for testing server interactions
  const originalFetch = globalThis.fetch;

  try {
    // TEST 1: Password reset failure propagation (when server returns error)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/reset-password')) {
        return new Response(JSON.stringify({ error: 'Supabase Auth user not found.' }), { status: 404, headers: { 'content-type': 'application/json' } });
      }
      return originalFetch(url);
    };

    const resetResFail = await authService.adminResetPassword('testteacherauth@school.ac.ke', 'NewPass123!', true, adminUser);
    assert(!resetResFail.success, 'adminResetPassword fails when server returns 404/error');
    assert(resetResFail.error === 'Supabase Auth user not found.', 'Returns accurate error message from server');

    // TEST 2: Password reset success
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/reset-password')) {
        return new Response(JSON.stringify({ success: true, message: 'Password updated successfully in Supabase Auth.' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return originalFetch(url);
    };

    const resetResSuccess = await authService.adminResetPassword('testteacherauth@school.ac.ke', 'NewPass123!', true, adminUser);
    assert(resetResSuccess.success, 'adminResetPassword succeeds when server returns 200 success');
    assert(resetResSuccess.error === null, 'Error is null on successful reset');

    // TEST 3: Teacher deletion failure propagation (server fails -> NO local deletion)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response(JSON.stringify({ error: 'Database constraint failure.' }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
      return originalFetch(url);
    };

    const deleteResFail = await authService.adminDeleteTeacher(testTeacher.id, testTeacher.email);
    assert(!deleteResFail.success, 'adminDeleteTeacher fails when server returns error');
    assert(deleteResFail.error === 'Database constraint failure.', 'Accurately returns server deletion error');

    const teachersAfterFailedDelete = api.getTeachers();
    assert(teachersAfterFailedDelete.some(t => t.id === testTeacher.id), 'Teacher remains in UI state when server deletion fails (No client fallback deletion)');

    // TEST 4: Teacher deletion success (server succeeds -> UI state updated)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response(JSON.stringify({ success: true, message: 'Deleted' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return originalFetch(url);
    };

    const deleteResSuccess = await authService.adminDeleteTeacher(testTeacher.id, testTeacher.email);
    assert(deleteResSuccess.success, 'adminDeleteTeacher succeeds when server confirms deletion');

    const teachersAfterSuccessDelete = api.getTeachers();
    assert(!teachersAfterSuccessDelete.some(t => t.id === testTeacher.id), 'Teacher removed from UI state after server deletion succeeds');

    // Re-add test teacher for edge-case failure tests
    api.addTeacher(testTeacher);

    // TEST 5: HTTP 200 + HTML (SPA fallback / non-JSON response)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response('<!doctype html><html><body>SPA Root</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
      }
      return originalFetch(url);
    };

    const htmlRes = await authService.adminDeleteTeacher(testTeacher.id, testTeacher.email);
    assert(!htmlRes.success, 'adminDeleteTeacher fails safely when receiving HTTP 200 HTML');
    assert(
      htmlRes.error !== null && !htmlRes.error.includes('Server error (200)') && htmlRes.error.includes('non-JSON response'),
      'HTML response produces clear non-JSON diagnostic without calling HTTP 200 a server error'
    );
    assert(api.getTeachers().some(t => t.id === testTeacher.id), 'Teacher preserved in state when HTML returned');

    // TEST 6: Malformed JSON
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response('{ not-valid-json }', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return originalFetch(url);
    };

    const badJsonRes = await authService.adminDeleteTeacher(testTeacher.id, testTeacher.email);
    assert(!badJsonRes.success, 'adminDeleteTeacher fails safely when receiving malformed JSON');
    assert(
      badJsonRes.error !== null && badJsonRes.error.includes('Failed to parse server response as JSON'),
      'Malformed JSON produces clear parse error diagnostic'
    );
    assert(api.getTeachers().some(t => t.id === testTeacher.id), 'Teacher preserved in state when malformed JSON returned');

    // TEST 7: HTTP 200 with JSON but missing `success: true` (e.g. only `{ message: "Deleted" }`)
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/admin/delete-teacher')) {
        return new Response(JSON.stringify({ message: 'Deleted' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return originalFetch(url);
    };

    const missingSuccessRes = await authService.adminDeleteTeacher(testTeacher.id, testTeacher.email);
    assert(!missingSuccessRes.success, 'adminDeleteTeacher fails safely when JSON lacks explicit success: true');
    assert(
      missingSuccessRes.error !== null && missingSuccessRes.error.includes('missing success confirmation'),
      'JSON without success: true produces incomplete response diagnostic'
    );
    assert(api.getTeachers().some(t => t.id === testTeacher.id), 'Teacher preserved in state when success confirmation missing');

  } catch (err: any) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed.`);
  }
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('adminPasswordResetAndDeleteTeacher')) {
  runAdminPasswordResetAndDeleteTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
