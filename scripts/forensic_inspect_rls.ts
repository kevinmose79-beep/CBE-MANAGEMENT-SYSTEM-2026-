import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function inspectRls() {
  const { data: policies, error } = await supabaseAdmin
    .rpc('get_table_policies', { table_names: ['teachers', 'users', 'streams', 'teacher_subjects'] })
    .select('*');

  if (error) {
    // If RPC doesn't exist, query pg_policies directly via sql or check in supabaseSql.ts
    console.log('RPC get_table_policies not found or error:', error.message);
  } else {
    console.log('Policies:', policies);
  }
}

inspectRls();
