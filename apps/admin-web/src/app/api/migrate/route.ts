import { NextRequest } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import {
  requireBearerSecret,
  requireOperationalRouteEnabled,
} from "@/lib/api/operations-guard";
import { requireRole } from "@/lib/api/rbac";
import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const REQUIRED_ADMIN_USER_COLUMNS = [
  "password_hash",
  "first_name",
  "last_name",
  "status",
] as const;

const MIGRATION_SQL = `
-- Run this in Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/ucqmmgopljyugxojntjv/sql/new

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE admin_users
SET
  first_name = split_part(COALESCE(display_name, email), ' ', 1),
  last_name = CASE
    WHEN display_name IS NOT NULL AND position(' ' in display_name) > 0
    THEN substring(display_name from position(' ' in display_name) + 1)
    ELSE ''
  END,
  status = 'active'
WHERE first_name IS NULL;

CREATE OR REPLACE FUNCTION run_auth_migration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS first_name TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_name TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

  UPDATE admin_users
  SET first_name = split_part(COALESCE(display_name, email), ' ', 1),
      last_name = CASE
        WHEN display_name IS NOT NULL AND position(' ' in display_name) > 0
        THEN substring(display_name from position(' ' in display_name) + 1)
        ELSE ''
      END,
      status = 'active'
  WHERE first_name IS NULL;
END;
$$;
`;

type AdminUsersProbeRow = Record<string, unknown>;

const migrateHandler = withErrorHandler(
  withAccount(
    requireRole(["admin_owner"])(async (request: NextRequest) => {
      const secretResponse = requireBearerSecret(request, "CRON_SECRET");
      if (secretResponse) {
        return secretResponse;
      }

      const results: string[] = [];

      const { data: testData } = await supabaseAdmin
        .from("admin_users")
        .select("*")
        .limit(1);

      const currentCols =
        testData && testData.length > 0
          ? Object.keys((testData[0] as AdminUsersProbeRow) ?? {})
          : [];
      results.push(`Current columns: ${currentCols.join(", ")}`);

      const missingCols: string[] = [];
      for (const col of REQUIRED_ADMIN_USER_COLUMNS) {
        const { error } = await supabaseAdmin
          .from("admin_users")
          .select(col)
          .limit(1);
        if (error) {
          missingCols.push(col);
        }
      }

      if (missingCols.length === 0) {
        results.push("All required columns exist");
        return createSuccessResponse({
          deprecated: true,
          status: "ok",
          results,
          replacement: "Use forward-only Supabase migrations or internal CLI tasks.",
        });
      }

      results.push(`Missing columns: ${missingCols.join(", ")}`);

      const { error: rpcError } = await supabaseAdmin.rpc("run_auth_migration", {});
      if (rpcError) {
        results.push(`RPC not available: ${rpcError.message}`);
        results.push("Please run the SQL migration manually in Supabase Dashboard");
      } else {
        results.push("Migration RPC executed successfully");
      }

      return createSuccessResponse({
        deprecated: true,
        status: "migration_needed",
        results,
        missingCols,
        replacement: "Use forward-only Supabase migrations or internal CLI tasks.",
        sql: MIGRATION_SQL,
      });
    }),
  ),
);

/**
 * Deprecated runtime migration endpoint.
 * Hidden by default behind ENABLE_DEPRECATED_MIGRATE_ROUTE=1.
 * When enabled, still requires both admin_owner auth and CRON_SECRET bearer.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const disabledResponse = requireOperationalRouteEnabled(
    "ENABLE_DEPRECATED_MIGRATE_ROUTE",
    "/api/migrate",
  );

  if (disabledResponse) {
    return disabledResponse;
  }

  return migrateHandler(request, context);
}
