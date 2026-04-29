import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { detectRuntimeBaseURL } from "./detect-base-url.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(scriptDir, "..");
export const workspaceDir = path.resolve(appDir, "..", "..");
export const rootDir = workspaceDir;
const envPath = path.join(appDir, ".env.local");
const envSource = await fs.readFile(envPath, "utf8").catch(() => "");
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export function readEnvValue(name) {
  const match = envSource.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) {
    return undefined;
  }

  return match[1].trim().replace(/^"|"$/g, "");
}

export function readBooleanFlag(name, fallback = null) {
  const rawValue = process.env[name] ?? readEnvValue(name);
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  return fallback;
}

export const jwtSecret = process.env.JWT_SECRET ?? readEnvValue("JWT_SECRET");
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnvValue("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? readEnvValue("SUPABASE_SERVICE_ROLE_KEY");
export const accountId =
  process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID ??
  readEnvValue("NEXT_PUBLIC_TEST_ACCOUNT_ID") ??
  "550e8400-e29b-41d4-a716-446655440000";

export function getShortLinkRuntimePolicyFlags() {
  const forceDirectRedirect = readBooleanFlag("SHORT_LINK_FORCE_DIRECT_REDIRECT", false) === true;
  const landingEnabledFlag = readBooleanFlag("SHORT_LINK_PUBLIC_LANDING_ENABLED", null);
  const landingEnabled = forceDirectRedirect ? false : landingEnabledFlag ?? true;

  return {
    forceDirectRedirect,
    landingEnabled,
  };
}

export function requireEnv(value, name) {
  if (!value) {
    throw new Error(`${name} is unavailable`);
  }

  return value;
}

export function createAdminToken() {
  const secret = requireEnv(jwtSecret, "JWT_SECRET");
  return jwt.sign(
    {
      sub: "codex-short-link-smoke",
      accountId,
      role: "admin_owner",
      email: "codex-short-link-smoke@local",
    },
    secret,
    { algorithm: "HS256", expiresIn: "1h" },
  );
}

export function createAdminHeaders() {
  const token = createAdminToken();

  return {
    Authorization: `Bearer ${token}`,
    Cookie: `access_token=${token}`,
    "Content-Type": "application/json",
  };
}

export function createSupabaseAdminClient() {
  return createClient(
    requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(supabaseServiceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function detectBaseURL() {
  return detectRuntimeBaseURL();
}

export async function assertShortLinkDeliverySchema() {
  const supabaseAdmin = createSupabaseAdminClient();
  const checks = [
    {
      table: "sales_channels",
      columns: ["id", "default_delivery_mode", "default_landing_template_key"],
      migration: "sales_channels defaults",
    },
    {
      table: "short_links",
      columns: [
        "id",
        "sales_channel_id",
        "delivery_mode",
        "landing_template_key",
        "locked_ipv6",
      ],
      migration: "short_links delivery fields",
    },
    {
      table: "short_link_clicks",
      columns: ["id", "event_type"],
      migration: "short_link_clicks event_type",
    },
  ];

  const failures = [];
  let connectionFailure = null;

  for (const check of checks) {
    try {
      const { error } = await supabaseAdmin
        .from(check.table)
        .select(check.columns.join(", "))
        .limit(1);

      if (error) {
        const message = error.message ?? "Unknown schema error";
        const isConnectionFailure =
          /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network|timeout/i.test(message);
        failures.push({
          ...check,
          message: isConnectionFailure
            ? `Unable to reach Supabase while verifying schema: ${message}`
            : message,
          kind: isConnectionFailure ? "connection_error" : "schema_error",
        });

        if (isConnectionFailure && !connectionFailure) {
          connectionFailure = message;
        }
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      const isConnectionFailure =
        /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network|timeout/i.test(message);

      failures.push({
        ...check,
        message: isConnectionFailure
          ? `Unable to reach Supabase while verifying schema: ${message}`
          : message,
        kind: isConnectionFailure ? "connection_error" : "schema_error",
      });

      if (isConnectionFailure && !connectionFailure) {
        connectionFailure = message;
      }
    }
  }

  return {
    ok: failures.length === 0,
      failures,
      connectionFailure,
      migrationFile: path.join(
        appDir,
        "supabase",
        "migrations",
        "20260417143000_short_link_public_full_schema.sql",
      ),
  };
}

export async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}
