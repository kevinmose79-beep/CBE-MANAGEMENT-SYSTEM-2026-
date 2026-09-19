import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: cols } = await supabase.rpc('get_marks_schema_dummy').catch(() => null) || 
    await supabase.from('marks').select('*').limit(1);
    
  console.log('Marks row structure:', cols && cols.length > 0 ? Object.keys(cols[0]) : 'no rows found to infer schema');
  
  const { data: cols2 } = await supabase.from('marks').select('*').limit(1);
  console.log('Marks row keys:', Object.keys(cols2[0] || {}));
}
run();
