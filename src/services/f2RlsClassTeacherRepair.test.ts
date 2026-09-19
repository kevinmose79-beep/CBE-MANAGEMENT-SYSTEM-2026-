// F-2 Class Teacher RLS Policy & Column Reference Repair Verification Test
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function runF2Tests() {
  console.log('=== RUNNING F-2 CLASS TEACHER RLS & COLUMN REFERENCE REPAIR TESTS ===\n');

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
  console.log('--- 1. STATIC SQL SOURCE ANALYSIS ---');
  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Verify no occurrence of class_teacher_of_id in student policies
  const studentPoliciesRegex = /CREATE POLICY "Class Teacher (select|insert|update) roster" ON public\.students[\s\S]*?;/g;
  const matches = sqlContent.match(studentPoliciesRegex) || [];

  assert(matches.length === 3, 'Static SQL — Found 3 Class Teacher roster policies on public.students');

  for (const policyDef of matches) {
    const hasInvalidCol1 = policyDef.includes('class_teacher_of_id');
    const hasInvalidCol2 = policyDef.includes('classes.class_teacher_id') || policyDef.includes('c.class_teacher_id');
    const usesStreamTeacher = policyDef.includes('streams st') && policyDef.includes('st.class_teacher_id = t.id');

    assert(!hasInvalidCol1, 'Static SQL — Policy does not reference nonexistent t.class_teacher_of_id');
    assert(!hasInvalidCol2, 'Static SQL — Policy does not reference nonexistent classes.class_teacher_id');
    assert(usesStreamTeacher, 'Static SQL — Policy correctly uses streams.class_teacher_id relationship');
  }

  // Verify server.ts and storage.ts do not update classes.class_teacher_id
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert(!serverContent.includes("from('classes').update({ class_teacher_id"), 'server.ts — No attempts to update nonexistent classes.class_teacher_id');

  const storagePath = path.resolve(process.cwd(), 'src/lib/storage.ts');
  const storageContent = fs.readFileSync(storagePath, 'utf-8');
  assert(!storageContent.includes("from('classes').update({ class_teacher_id"), 'src/lib/storage.ts — No attempts to update nonexistent classes.class_teacher_id');

  // 2. Live Database Verification
  console.log('\n--- 2. LIVE DATABASE AUTHORIZATION & RLS TEST ---');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (supabaseUrl && supabaseServiceKey) {
    const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Check if teachers and streams exist in live database
    const { data: streams, error: strmErr } = await admin.from('streams').select('id, stream_name, class_id, class_teacher_id');
    assert(!strmErr, 'Live DB — Can query streams table with service role');

    const { data: teachers, error: tchErr } = await admin.from('teachers').select('id, teacher_name, is_class_teacher');
    assert(!tchErr, 'Live DB — Can query teachers table with service role');

    // Verify schema structure: streams has class_teacher_id column
    const { data: testCol, error: testColErr } = await admin.from('streams').select('class_teacher_id').limit(1);
    assert(!testColErr, 'Live DB — streams.class_teacher_id column exists and is queryable');

    // Verify classes does NOT have class_teacher_id
    const { error: noClassColErr } = await admin.from('classes').select('class_teacher_id').limit(1);
    assert(!!noClassColErr && noClassColErr.code === '42703', 'Live DB — classes.class_teacher_id correctly confirmed NOT to exist (Error 42703)');

    // Verify teachers does NOT have class_teacher_of_id
    const { error: noTchColErr } = await admin.from('teachers').select('class_teacher_of_id').limit(1);
    assert(!!noTchColErr && noTchColErr.code === '42703', 'Live DB — teachers.class_teacher_of_id correctly confirmed NOT to exist (Error 42703)');

    // Anonymous Access Denial Test
    if (supabaseAnonKey) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { error: anonErr } = await anonClient.from('students').select('*').limit(1);
      assert(!!anonErr && anonErr.code === '42501', 'Live DB — Anonymous user DENIED SELECT access to students table (Code 42501)');
    }
  } else {
    console.warn('Skipping Live DB checks — Environment variables not configured.');
  }

  console.log(`\nF-2 CLASS TEACHER REPAIR TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    process.exit(1);
  }
}

runF2Tests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
