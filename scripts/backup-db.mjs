import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
    return env;
  } catch (err) {
    console.error('⚠️ Could not load .env:', err.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in .env!');
  process.exit(1);
}

const tables = [
  'products',
  'customers',
  'customer_contacts',
  'orders',
  'order_items',
  'license_keys',
  'providers',
  'provider_contacts',
  'purchase_orders',
  'purchase_order_items'
];

async function backupTable(tableName) {
  console.log(`📥 Fetching table: ${tableName}...`);
  const url = `${supabaseUrl}/rest/v1/${tableName}?select=*`;
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Range-Unit': 'items',
      'Range': '0-5000' // fetch first 5000 items
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${tableName}: ${response.statusText} (${await response.text()})`);
  }

  const data = await response.json();
  console.log(`   ✅ Loaded ${data.length} records.`);
  return data;
}

async function run() {
  try {
    const backupData = {};
    for (const table of tables) {
      try {
        backupData[table] = await backupTable(table);
      } catch (err) {
        console.error(`   ❌ Error backing up table ${table}:`, err.message);
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = resolve(__dirname, '../backup');
    mkdirSync(backupDir, { recursive: true });

    const backupPath = resolve(backupDir, `db_backup_${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`\n==================================================`);
    console.log(`🎉 BACKUP SUCCESSFUL!`);
    console.log(`💾 Saved to: ${backupPath}`);
    console.log(`==================================================`);
  } catch (err) {
    console.error('❌ Critical backup error:', err.message);
  }
}

run();
