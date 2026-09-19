import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const openerId = 'e33680c9-e071-493e-9a4a-a49bce6c1742';
  let { count } = await supabase.from('marks').select('*', { count: 'exact', head: true }).eq('exam_id', openerId);
  console.log(`Marks for Grade 6 Opener: ${count}`);

  const targetId = 'b354bcc6-ee20-4ced-a651-ed5aecd91603';
  let { count: tCount } = await supabase.from('marks').select('*', { count: 'exact', head: true }).eq('exam_id', targetId);
  console.log(`Marks for Target Assessment: ${tCount}`);
}
run();
