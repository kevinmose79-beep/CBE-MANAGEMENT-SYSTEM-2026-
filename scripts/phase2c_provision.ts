import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const sstId = uuidv4();
  const creId = uuidv4();
  
  console.log('Generated SST UUID:', sstId);
  console.log('Generated CRE UUID:', creId);
  
  // Provision SST
  const { error: err1 } = await supabase.from('subjects').insert({
    id: sstId,
    subject_code: 'SST UP', // Wait, the instructions said Code: "SST". Let's check Junior school code!
    // Junior school code is "SST". DB allows same code if names differ? Wait! We saw the DB has unique code constraint? Let's check.
  });
  console.log('Err1:', err1);
}
run();
