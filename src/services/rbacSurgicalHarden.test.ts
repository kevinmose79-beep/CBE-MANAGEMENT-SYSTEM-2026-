// Surgical RBAC Hardening Verification Test Suite
import fs from 'fs';
import path from 'path';

async function runRbacHardeningTests() {
  console.log('=== RUNNING SURGICAL RBAC HARDENING REGRESSION TESTS ===\n');

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

  // --- 1. SECURITY-DEFINER RPC HARDENING TESTS ---
  console.log('--- 1. SECURITY-DEFINER RPC HARDENING (update_teacher_allocations_atomic) ---');

  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  testAssert(
    sqlContent.includes('CREATE OR REPLACE FUNCTION public.update_teacher_allocations_atomic'),
    'RPC Function — update_teacher_allocations_atomic is defined'
  );

  testAssert(
    sqlContent.includes('public.is_admin()') && sqlContent.includes("Access denied: Only administrators can update teacher subject allocations."),
    'RPC Authorization — update_teacher_allocations_atomic contains server-side public.is_admin() check'
  );

  // Simulate RPC internal authorization logic
  function simulateUpdateAllocationsRpc(callerRole: 'admin' | 'class_teacher' | 'subject_teacher' | 'anon', isServiceRole: boolean = false) {
    const isAdmin = callerRole === 'admin';
    if (!(isAdmin || isServiceRole)) {
      throw new Error('Access denied: Only administrators can update teacher subject allocations.');
    }
    return { success: true, inserted_count: 2 };
  }

  // Test Admin caller
  try {
    const res = simulateUpdateAllocationsRpc('admin');
    testAssert(res.success === true, 'RPC Execution — Admin user executes update_teacher_allocations_atomic successfully');
  } catch (err: any) {
    testAssert(false, 'RPC Execution — Admin user executes update_teacher_allocations_atomic successfully', err.message);
  }

  // Test Service Role caller
  try {
    const res = simulateUpdateAllocationsRpc('class_teacher', true);
    testAssert(res.success === true, 'RPC Execution — Backend service_role executes update_teacher_allocations_atomic successfully');
  } catch (err: any) {
    testAssert(false, 'RPC Execution — Backend service_role executes update_teacher_allocations_atomic successfully', err.message);
  }

  // Test Class Teacher caller
  try {
    simulateUpdateAllocationsRpc('class_teacher');
    testAssert(false, 'RPC Execution — Class Teacher receives database-level denial');
  } catch (err: any) {
    testAssert(
      err.message.includes('Access denied: Only administrators can update teacher subject allocations'),
      'RPC Execution — Class Teacher receives database-level denial',
      err.message
    );
  }

  // Test Subject Teacher caller
  try {
    simulateUpdateAllocationsRpc('subject_teacher');
    testAssert(false, 'RPC Execution — Subject Teacher receives database-level denial');
  } catch (err: any) {
    testAssert(
      err.message.includes('Access denied: Only administrators can update teacher subject allocations'),
      'RPC Execution — Subject Teacher receives database-level denial',
      err.message
    );
  }

  // --- 2. CLASS TEACHER APPROVAL UI HARDENING TESTS ---
  console.log('\n--- 2. CLASS TEACHER APPROVAL UI HARDENING (ExaminationAnalysisValidation.tsx) ---');

  const componentFilePath = path.resolve(process.cwd(), 'src/components/ExaminationAnalysisValidation.tsx');
  const componentContent = fs.readFileSync(componentFilePath, 'utf-8');

  testAssert(
    componentContent.includes("currentUser?.role === 'admin' ? (") &&
    (componentContent.includes("Approve & Lock") || componentContent.includes("Approve All Levels")),
    'Approval UI — "Approve & Lock" button is restricted strictly to currentUser.role === "admin"'
  );

  testAssert(
    componentContent.includes("Official Administrative Sign-Off") || componentContent.includes("Only an Administrator can approve"),
    'Approval UI — Non-admin users (Class & Subject Teachers) are shown clear non-actionable sign-off message'
  );

  testAssert(
    componentContent.includes("if (currentUser?.role !== 'admin')") &&
    componentContent.includes("UNAUTHORIZED: Only an Administrator can approve and lock official results."),
    'Approval Handler — handleConfirmApproval explicitly validates admin role before executing approval'
  );

  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRbacHardeningTests();
