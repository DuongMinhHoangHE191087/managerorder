import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const { data, error } = await supabaseAdmin.rpc('get_table_columns_by_name', { t_name: 'short_link_clicks' });
  if (error) {
     console.log('RPC failed, trying generic select:');
     const { data: cols, error: e2 } = await supabaseAdmin.from('short_link_clicks').select('*').limit(1);
     console.log('Columns:', cols ? Object.keys(cols[0] || {}) : 'No data');
     console.log(e2);
  } else {
     console.log(data);
  }
}
run();
