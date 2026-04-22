import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function execSQL(sql: string): Promise<void> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await resp.text();
  if (!resp.ok) {
    // Try management API instead
    const resp2 = await fetch(`https://api.supabase.com/v1/projects/ucqmmgopljyugxojntjv/database/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    });
    const t2 = await resp2.text();
    console.log("Management API result:", resp2.status, t2.slice(0, 200));
    return;
  }
  console.log("Result:", text.slice(0, 200));
}

async function main() {
  console.log("Creating zalo_bot_users table...");
  
  const createSQL = `
CREATE TABLE IF NOT EXISTS zalo_bot_users (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      TEXT NOT NULL,
  zalo_user_id    TEXT NOT NULL,
  zalo_display_name TEXT,
  duolingo_username TEXT,
  last_order_query  TEXT,
  query_count     INTEGER DEFAULT 0,
  first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, zalo_user_id)
);
`;
  
  await execSQL(createSQL);
  
  // Test insert
  const testResp = await fetch(`${SUPABASE_URL}/rest/v1/zalo_bot_users`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      account_id: "test",
      zalo_user_id: "test_user_001",
      zalo_display_name: "Test User"
    })
  });
  const testText = await testResp.text();
  console.log("Insert test:", testResp.status, testText.slice(0, 200));
  
  // Cleanup
  const delResp = await fetch(`${SUPABASE_URL}/rest/v1/zalo_bot_users?zalo_user_id=eq.test_user_001`, {
    method: "DELETE",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`
    }
  });
  console.log("Cleanup:", delResp.status);
}

main().catch(console.error);
