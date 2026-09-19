import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function checkExams() {
  const { data, error } = await supabaseAdmin.from('examinations').select('*');
  console.log('Error:', error);
  console.log('Data:', data?.length);
  if (data && data.length > 0) {
    console.log('Exam sample:', Object.keys(data[0]));
    console.log('First exam:', data[0]);
  }
}

checkExams();
