import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const accountId = env['NEXT_PUBLIC_TEST_ACCOUNT_ID'];
const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function cleanData() {
  console.log(`Starting cleanup for account: ${accountId}`);

  // Delete all orders (will cascade delete order_items)
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .delete()
    .eq('account_id', accountId)
    .select('id');
    
  if (oErr) console.error("Error deleting orders:", oErr);
  else console.log(`Deleted ${orders?.length} orders (and cascaded items/keys hopefully)`);

  // Delete all customers (will cascade delete customer_contacts)
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .delete()
    .eq('account_id', accountId)
    .select('id');
    
  if (cErr) console.error("Error deleting customers:", cErr);
  else console.log(`Deleted ${customers?.length} customers.`);

  console.log("Cleanup finished.");
}

cleanData();
