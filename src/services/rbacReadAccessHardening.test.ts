// Teacher Read-Access RBAC Hardening Test Suite
import fs from 'fs';
import path from 'path';

async function runRbacReadAccessHardeningTests() {
  console.log('=== RUNNING TEACHER READ-ACCESS RBAC HARDENING TESTS ===\n');

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

  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // --- 1. STATIC SQL ANALYSIS FOR MARKS ---
  console.log('--- 1. MARKS TABLE SELECT POLICY ---');
  testAssert(
    !sqlContent.includes('CREATE POLICY "Marks select policy" ON public.marks FOR SELECT TO authenticated USING (true);'),
    'Marks SELECT policy — Unrestricted "USING (true)" removed'
  );
  testAssert(
    sqlContent.includes('CREATE POLICY "Marks select policy" ON public.marks FOR SELECT TO authenticated USING (') &&
    sqlContent.includes("WHERE users.id = auth.uid() AND users.role = 'admin'") &&
    sqlContent.includes('ts.subject_id = marks.subject_id') &&
    sqlContent.includes('st.class_teacher_id = t.id'),
    'Marks SELECT policy — Restricts read access to Admins, allocated Subject Teachers, and designated Class Teachers'
  );

  // --- 2. STATIC SQL ANALYSIS FOR REPORT CARDS ---
  console.log('\n--- 2. REPORT CARDS TABLE SELECT POLICY ---');
  testAssert(
    !sqlContent.includes('CREATE POLICY "Report_cards select policy" ON public.report_cards FOR SELECT TO authenticated USING (true);'),
    'Report Cards SELECT policy — Unrestricted "USING (true)" removed'
  );
  testAssert(
    sqlContent.includes('CREATE POLICY "Report_cards select policy" ON public.report_cards FOR SELECT TO authenticated USING (') &&
    sqlContent.includes("WHERE users.id = auth.uid() AND users.role = 'admin'") &&
    sqlContent.includes('st.class_teacher_id = t.id'),
    'Report Cards SELECT policy — Restricts read access to Admins and designated Class Teachers of student stream'
  );

  // --- 3. STATIC SQL ANALYSIS FOR MERIT LISTS ---
  console.log('\n--- 3. MERIT LISTS TABLE SELECT POLICY ---');
  testAssert(
    !sqlContent.includes('CREATE POLICY "Merit_lists select policy" ON public.merit_lists FOR SELECT TO authenticated USING (true);'),
    'Merit Lists SELECT policy — Unrestricted "USING (true)" removed'
  );
  testAssert(
    sqlContent.includes('CREATE POLICY "Merit_lists select policy" ON public.merit_lists FOR SELECT TO authenticated USING (') &&
    sqlContent.includes("WHERE users.id = auth.uid() AND users.role = 'admin'") &&
    sqlContent.includes('st.class_teacher_id = t.id'),
    'Merit Lists SELECT policy — Restricts read access to Admins and designated Class Teachers of student stream'
  );

  // --- 4. STATIC SQL ANALYSIS FOR ATTENDANCE ---
  console.log('\n--- 4. ATTENDANCE TABLE SELECT POLICY ---');
  testAssert(
    !sqlContent.includes('CREATE POLICY "Attendance select policy" ON public.attendance FOR SELECT TO authenticated USING (true);'),
    'Attendance SELECT policy — Unrestricted "USING (true)" removed'
  );
  testAssert(
    sqlContent.includes('CREATE POLICY "Attendance select policy" ON public.attendance FOR SELECT TO authenticated USING (') &&
    sqlContent.includes("WHERE users.id = auth.uid() AND users.role = 'admin'") &&
    sqlContent.includes('t.id = attendance.recorded_by'),
    'Attendance SELECT policy — Restricts read access to Admins, designated Class Teachers, and recorder teacher'
  );

  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRbacReadAccessHardeningTests();
