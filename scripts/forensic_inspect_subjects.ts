import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function inspectAllSubjects() {
  const { data: subjects, error } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .order('subject_name', { ascending: true });

  if (error) {
    console.error('Error fetching subjects:', error);
    process.exit(1);
  }

  console.log(`TOTAL LIVE SUBJECTS COUNT: ${subjects.length}`);
  console.log('\n--- LIVE DATABASE SUBJECTS TABLE ---');
  console.table(subjects.map(s => ({
    id: s.id,
    subject_code: s.subject_code,
    subject_name: s.subject_name,
    learning_area: s.learning_area,
    department: s.department
  })));

  // Identify all duplicates by name
  const nameMap: Record<string, typeof subjects> = {};
  for (const s of subjects) {
    const key = (s.subject_name || '').trim().toLowerCase();
    if (!nameMap[key]) nameMap[key] = [];
    nameMap[key].push(s);
  }

  console.log('\n--- DUPLICATE SUBJECT NAMES IN LIVE DATABASE ---');
  for (const [name, list] of Object.entries(nameMap)) {
    if (list.length > 1) {
      console.log(`\nDuplicate: "${name}" (${list.length} records):`);
      for (const item of list) {
        console.log(`  - ID: ${item.id} | Code: ${item.subject_code} | Learning Area: "${item.learning_area}" | Dept: ${item.department}`);
      }
    }
  }
}

inspectAllSubjects();
