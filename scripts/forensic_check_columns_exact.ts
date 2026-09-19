import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function checkTeachersSchema() {
  const { data } = await supabaseAdmin.from('teachers').select('*').limit(1);
  console.log('Teachers columns:', Object.keys(data![0]));
  
  const { data: users } = await supabaseAdmin.from('users').select('*').limit(1);
  console.log('Users columns:', Object.keys(users![0]));
}

checkTeachersSchema();
