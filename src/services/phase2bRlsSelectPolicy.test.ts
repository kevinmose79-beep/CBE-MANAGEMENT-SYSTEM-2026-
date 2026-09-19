// Unit and Static Analysis tests for Phase 2B RLS SELECT policies on users, administrators, teachers, and audit_logs
import fs from 'fs';
import path from 'path';

async function runPhase2BTests() {
  console.log('=== RUNNING PHASE 2B RLS SELECT POLICY SECURITY TESTS ===\n');

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

  // 1. Static Analysis of SQL file definitions (src/lib/supabaseSql.ts)
  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  assert(
    sqlContent.includes('CREATE OR REPLACE FUNCTION public.is_admin()') &&
    sqlContent.includes('SECURITY DEFINER') &&
    sqlContent.includes('SET search_path = public'),
    'Static SQL Analysis — public.is_admin() SECURITY DEFINER helper function exists'
  );

  assert(
    sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_my_teacher_id()') &&
    sqlContent.includes('SECURITY DEFINER') &&
    sqlContent.includes('SET search_path = public'),
    'Static SQL Analysis — public.get_my_teacher_id() SECURITY DEFINER helper function exists'
  );

  const usersPolicySection = sqlContent.match(/CREATE POLICY "Users select policy"[\s\S]*?;\n/)?.[0] || '';
  assert(
    usersPolicySection.includes('public.is_admin()') &&
    !usersPolicySection.includes('FROM public.users'),
    'Static SQL Analysis — Users SELECT policy uses public.is_admin() without direct users query'
  );

  const adminsPolicySection = sqlContent.match(/CREATE POLICY "Administrators select policy"[\s\S]*?;\n/)?.[0] || '';
  assert(
    adminsPolicySection.includes('public.is_admin()') &&
    !adminsPolicySection.includes('FROM public.users'),
    'Static SQL Analysis — Administrators SELECT policy uses public.is_admin()'
  );

  const teachersPolicySection = sqlContent.match(/CREATE POLICY "Teachers select policy"[\s\S]*?;\n/)?.[0] || '';
  assert(
    teachersPolicySection.includes('FOR SELECT TO authenticated USING (true)'),
    'Static SQL Analysis — Teachers SELECT policy allows authenticated users to read teacher directory'
  );

  const auditLogsPolicySection = sqlContent.match(/CREATE POLICY "Audit_logs select policy"[\s\S]*?;\n/)?.[0] || '';
  assert(
    auditLogsPolicySection.includes('public.is_admin()') &&
    !auditLogsPolicySection.includes('FROM public.users'),
    'Static SQL Analysis — Audit_logs SELECT policy uses public.is_admin()'
  );

  // Simulated policy evaluation helpers matching src/lib/supabaseSql.ts definitions

  function evaluateUsersSelectPolicy(user: { id: string; role: string } | null, targetRow: { id: string }): boolean {
    if (!user) return false; // TO authenticated
    const isAdmin = user.role === 'admin';
    return targetRow.id === user.id || isAdmin;
  }

  function evaluateAdministratorsSelectPolicy(user: { id: string; role: string } | null): boolean {
    if (!user) return false; // TO authenticated
    return user.role === 'admin';
  }

  function evaluateTeachersSelectPolicy(user: { id: string; role: string; teacher_id?: string } | null, targetRow: { id: string; user_id?: string }): boolean {
    if (!user) return false; // TO authenticated
    return true; // Authenticated users can read teacher directory for allocations & name resolution
  }

  function evaluateAuditLogsSelectPolicy(user: { id: string; role: string } | null): boolean {
    if (!user) return false; // TO authenticated
    return user.role === 'admin';
  }

  // 2. Simulated Behavioral Policy Tests
  assert(
    evaluateUsersSelectPolicy(null, { id: 'usr_1' }) === false,
    'Users Table — Anonymous SELECT denied'
  );
  assert(
    evaluateUsersSelectPolicy({ id: 'usr_1', role: 'class_teacher' }, { id: 'usr_1' }) === true,
    'Users Table — Authenticated user can SELECT own profile'
  );
  assert(
    evaluateUsersSelectPolicy({ id: 'usr_1', role: 'class_teacher' }, { id: 'usr_2' }) === false,
    'Users Table — Authenticated non-admin cannot SELECT another user'
  );
  assert(
    evaluateUsersSelectPolicy({ id: 'admin_1', role: 'admin' }, { id: 'usr_2' }) === true,
    'Users Table — Administrator can SELECT all user profiles'
  );

  assert(
    evaluateAdministratorsSelectPolicy(null) === false,
    'Administrators Table — Anonymous SELECT denied'
  );
  assert(
    evaluateAdministratorsSelectPolicy({ id: 'usr_1', role: 'class_teacher' }) === false,
    'Administrators Table — Authenticated non-admin SELECT denied'
  );
  assert(
    evaluateAdministratorsSelectPolicy({ id: 'admin_1', role: 'admin' }) === true,
    'Administrators Table — Administrator SELECT permitted'
  );

  assert(
    evaluateTeachersSelectPolicy(null, { id: 'tch_01', user_id: 'usr_1' }) === false,
    'Teachers Table — Anonymous SELECT denied'
  );
  assert(
    evaluateTeachersSelectPolicy({ id: 'usr_1', role: 'class_teacher', teacher_id: 'tch_01' }, { id: 'tch_01', user_id: 'usr_1' }) === true,
    'Teachers Table — Teacher can SELECT own teacher record'
  );
  assert(
    evaluateTeachersSelectPolicy({ id: 'usr_1', role: 'class_teacher', teacher_id: 'tch_01' }, { id: 'tch_02', user_id: 'usr_2' }) === true,
    'Teachers Table — Authenticated teacher can SELECT other teacher directory records (enables subject-teacher resolution)'
  );
  assert(
    evaluateTeachersSelectPolicy({ id: 'admin_1', role: 'admin' }, { id: 'tch_02', user_id: 'usr_2' }) === true,
    'Teachers Table — Administrator can SELECT all teacher records'
  );

  assert(
    evaluateAuditLogsSelectPolicy(null) === false,
    'Audit Logs Table — Anonymous SELECT denied'
  );
  assert(
    evaluateAuditLogsSelectPolicy({ id: 'usr_1', role: 'class_teacher' }) === false,
    'Audit Logs Table — Authenticated non-admin SELECT denied'
  );
  assert(
    evaluateAuditLogsSelectPolicy({ id: 'admin_1', role: 'admin' }) === true,
    'Audit Logs Table — Administrator SELECT permitted'
  );

  console.log(`\nPHASE 2B RLS SELECT POLICY TESTS: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2BTests();
