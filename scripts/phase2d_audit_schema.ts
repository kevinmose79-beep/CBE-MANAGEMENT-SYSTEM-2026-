import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  console.log('--- 1. Live Subjects Schema ---');
  const { data: cols, error: colsErr } = await supabase.from('subjects').select('*').limit(1);
  if (colsErr) console.error('Cols err:', colsErr);
  if (cols && cols.length > 0) {
     for (const [k, v] of Object.entries(cols[0])) {
         console.log(`${k}: type ${typeof v} (sample: ${v})`);
     }
  }

  console.log('\n--- 2. Unique constraints ---');
  // Since we can't easily query pg_constraint without RPC if RPC is missing, we already know "subjects_subject_code_key" exists from Phase 2C.
  // But let's check for "learning_area" values.
  console.log('\n--- 3. learning_area values ---');
  const { data: allSubs } = await supabase.from('subjects').select('id, subject_code, subject_name, learning_area');
  const distinctLA = [...new Set(allSubs?.map(s => s.learning_area))];
  console.log('Distinct learning_areas:', distinctLA);
  
  console.log('\n--- 4. Current Identities ---');
  const { data: subs } = await supabase.from('subjects').select('*').in('subject_code', ['SST', 'CRE', 'SS&CRE']);
  console.log('Current Subjects:', subs);
  
  console.log('\n--- 17. Composite uniqueness tests ---');
  if (allSubs) {
    const codeEdu = new Set();
    const codeLA = new Set();
    let hasEduDupes = false;
    let hasLADupes = false;
    
    // Note: education_level is not in DB! Wait, let's check if it exists in the schema.
    for (let s of allSubs) {
       // Since education_level wasn't selected, it might not exist in the DB? Let's check `cols[0]`.
       const laKey = `${s.subject_code}-${s.learning_area}`;
       if (codeLA.has(laKey)) {
          console.log('DUPE LA:', laKey);
          hasLADupes = true;
       }
       codeLA.add(laKey);
    }
    console.log('Has LA dupes?', hasLADupes);
  }
}
run();
