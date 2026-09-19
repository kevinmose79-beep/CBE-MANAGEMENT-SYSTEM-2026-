// F-1 Defence-in-Depth RLS Policy Hardening Verification Test
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function runF1HardeningTests() {
  console.log('=== RUNNING F-1 RLS POLICY HARDENING VERIFICATION TESTS ===\n');

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

  // 1. Static Analysis of src/lib/supabaseSql.ts
  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  const academicTables = [
    { table: 'classes', policy: 'Classes select policy' },
    { table: 'streams', policy: 'Streams select policy' },
    { table: 'subjects', policy: 'Subjects select policy' },
    { table: 'teacher_subjects', policy: 'Teacher_subjects select policy' },
    { table: 'examinations', policy: 'Examinations select policy' },
    { table: 'examination_subjects', policy: 'Examination_subjects select policy' },
    { table: 'marks', policy: 'Marks select policy' },
    { table: 'report_cards', policy: 'Report_cards select policy' },
    { table: 'merit_lists', policy: 'Merit_lists select policy' },
    { table: 'attendance', policy: 'Attendance select policy' },
  ];

  console.log('--- STATIC SQL SOURCE ANALYSIS ---');
  for (const { table, policy } of academicTables) {
    const policyRegex = new RegExp(`CREATE POLICY "${policy}" ON public\\.${table} FOR SELECT ([\\s\\S]*?);`);
    const match = sqlContent.match(policyRegex);
    const policyDef = match ? match[0] : '';

    assert(
      policyDef.includes('TO authenticated') &&
      !policyDef.includes('TO public') &&
      !policyDef.includes('anon'),
      `Static SQL — ${table} SELECT policy explicitly targets 'TO authenticated' only`,
      `Found: ${policyDef}`
    );
  }

  // Check that school_profile retains public/anon access
  const schoolProfileMatch = sqlContent.match(/CREATE POLICY "Public read school_profile" ON public\.school_profile FOR SELECT ([\s\S]*?);/);
  const schoolProfileDef = schoolProfileMatch ? schoolProfileMatch[0] : '';
  assert(
    schoolProfileDef.includes('TO public, anon, authenticated'),
    "Static SQL — school_profile SELECT policy retains 'TO public, anon, authenticated' for public school info",
    `Found: ${schoolProfileDef}`
  );

  // 2. Live Database Security Checks
  console.log('\n--- LIVE DATABASE ANONYMOUS ACCESS VERIFICATION ---');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (supabaseUrl && supabaseAnonKey) {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    // Test school_profile is accessible anonymously
    const { error: schoolErr } = await anonClient.from('school_profile').select('*').limit(1);
    assert(
      !schoolErr,
      'Live Database — school_profile SELECT allowed for anonymous users'
    );

    // Test all 10 academic tables DENY anonymous SELECT access
    for (const { table } of academicTables) {
      const { error } = await anonClient.from(table).select('*').limit(1);
      assert(
        !!error && (error.code === '42501' || error.message.includes('permission denied')),
        `Live Database — ${table} anonymous SELECT denied (Code: ${error?.code || 'none'})`
      );
    }
  } else {
    console.warn('Skipping live DB checks — Supabase environment variables not configured.');
  }

  // 3. Live Database Service Role / Admin Access Verification
  if (supabaseUrl && supabaseServiceKey) {
    console.log('\n--- LIVE DATABASE SERVICE ROLE ACCESS VERIFICATION ---');
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    for (const { table } of academicTables) {
      const { error } = await serviceClient.from(table).select('*').limit(1);
      assert(
        !error,
        `Live Database — ${table} service-role SELECT allowed`
      );
    }
  }

  console.log(`\nF-1 RLS POLICY HARDENING VERIFICATION: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runF1HardeningTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
