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

async function inspectSchema() {
  console.log('--- FORENSIC QUERY: INSPECTING ALL SCHEMAS, TABLES, AND COLUMNS ---');

  // Let's check what RPCs or functions exist
  // We can also query all standard tables
  const tables = [
    'users',
    'students',
    'student_promotions',
    'marks',
    'report_cards',
    'merit_lists',
    'attendance',
    'audit_logs',
    'teachers',
    'streams',
    'classes',
    'subjects',
    'teacher_subjects',
    'examinations',
    'examination_subjects',
    'academic_years',
    'school_terms',
    'school_profile',
    'cbe_grades'
  ];

  for (const table of tables) {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table [${table}] query error:`, error.message);
    } else {
      const sample = data && data.length > 0 ? Object.keys(data[0]) : '(empty table or no rows)';
      console.log(`Table [${table}] exists. Columns sample:`, sample);
    }
  }
}

inspectSchema();
