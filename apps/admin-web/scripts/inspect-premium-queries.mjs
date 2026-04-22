import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
const envSource = await fs.readFile(envPath, "utf8");

function readEnvValue(name) {
  const match = envSource.match(new RegExp(`^${name}=(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^"|"$/g, "");
}

const supabase = createClient(
  readEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
  readEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const accountId =
  readEnvValue("NEXT_PUBLIC_TEST_ACCOUNT_ID") ??
  "550e8400-e29b-41d4-a716-446655440000";

const checks = [
  {
    name: "premium_accounts",
    run: () =>
      supabase
        .from("premium_accounts")
        .select(`
          *,
          service:premium_service_types!premium_accounts_service_type_id_fkey(name, slug, logo_url),
          package:premium_packages!premium_accounts_package_id_fkey(name, package_type, slots)
        `)
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
  },
  {
    name: "account_migrations",
    run: () =>
      supabase
        .from("account_migrations")
        .select(`
          *,
          customer:customers!inner(full_name),
          source_account:premium_accounts!account_migrations_source_account_id_fkey(primary_email),
          target_account:premium_accounts!account_migrations_target_account_id_fkey(primary_email)
        `)
        .eq("account_id", accountId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
  },
  {
    name: "notification_renewals",
    run: () =>
      supabase
        .from("subscription_renewals")
        .select("id, renewal_requested_date, renewal_price, original_price, status")
        .eq("account_id", accountId)
        .eq("status", "pending")
        .order("renewal_requested_date", { ascending: false })
        .limit(6),
  },
  {
    name: "notification_migrations",
    run: () =>
      supabase
        .from("account_migrations")
        .select("id, created_at, status, source_account_email, target_account_email")
        .eq("account_id", accountId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(6),
  },
  {
    name: "notification_premium_health",
    run: () =>
      supabase
        .from("premium_accounts")
        .select("id, primary_email, connection_status, last_connection_error, updated_at, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .in("connection_status", ["error", "manual_check_needed"])
        .order("updated_at", { ascending: false })
        .limit(6),
  },
  {
    name: "notification_source_accounts",
    run: () =>
      supabase
        .from("source_accounts")
        .select("id, email, max_slots, used_slots, expires_at, updated_at, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(20),
  },
];

for (const check of checks) {
  const result = await check.run();
  console.log(`\n=== ${check.name} ===`);
  console.log(JSON.stringify(result.error, null, 2));
  console.log(`rows=${result.data?.length ?? 0}`);
}
