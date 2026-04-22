/**
 * Script tạo bảng zalo_bot_users trong Supabase
 * Chạy: npx tsx create-table.ts
 */
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const SQL = `
CREATE TABLE IF NOT EXISTS zalo_bot_users (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        TEXT NOT NULL,
  zalo_user_id      TEXT NOT NULL,
  zalo_display_name TEXT,
  duolingo_username TEXT,
  last_order_query  TEXT,
  query_count       INTEGER DEFAULT 0,
  first_seen_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, zalo_user_id)
);
CREATE INDEX IF NOT EXISTS idx_zbu_user ON zalo_bot_users(account_id, zalo_user_id);
`;

async function runSQL(sql: string) {
  // Thử qua Postgres REST endpoint
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  return resp;
}

async function testTableInsert() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Test upsert
  const { error } = await sb.from("zalo_bot_users").upsert(
    {
      account_id: "test-account",
      zalo_user_id: "test-zalo-999",
      zalo_display_name: "Test User",
    },
    { onConflict: "account_id,zalo_user_id" }
  );

  if (error) {
    console.error("❌ Upsert failed:", error.message);
    if (error.code === "PGRST205") {
      console.log("\n📋 Bảng chưa tồn tại. Vui lòng chạy SQL này trong Supabase Dashboard > SQL Editor:");
      console.log("=".repeat(60));
      console.log(SQL);
      console.log("=".repeat(60));
      console.log("\nURL Dashboard: https://supabase.com/dashboard/project/ucqmmgopljyugxojntjv/sql/new");
    }
    return false;
  }

  // Cleanup test record
  await sb.from("zalo_bot_users").delete().eq("zalo_user_id", "test-zalo-999");
  console.log("✅ Bảng zalo_bot_users đã sẵn sàng!");
  return true;
}

testTableInsert().catch(console.error);
