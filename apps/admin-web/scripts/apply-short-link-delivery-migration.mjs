import fs from "node:fs/promises";
import path from "node:path";
import {
  assertShortLinkDeliverySchema,
  readEnvValue,
  rootDir,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./short-link-runtime-utils.mjs";

function resolveProjectRef() {
  const envProjectRef =
    process.env.SUPABASE_PROJECT_REF ?? readEnvValue("SUPABASE_PROJECT_REF");
  if (envProjectRef) {
    return envProjectRef.trim();
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is unavailable");
  }

  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  if (!projectRef) {
    throw new Error(`Unable to resolve project ref from ${supabaseUrl}`);
  }

  return projectRef;
}

function resolveAccessToken() {
  return process.env.SUPABASE_ACCESS_TOKEN ?? readEnvValue("SUPABASE_ACCESS_TOKEN");
}

async function parseResponsePayload(response) {
  const rawBody = await response.text();
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

async function applyMigrationViaManagementApi(projectRef, query, accessToken) {
  if (!accessToken) {
    return {
      ok: false,
      skipped: true,
      reason: "SUPABASE_ACCESS_TOKEN is unavailable",
      payload: null,
      status: 0,
    };
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        read_only: false,
      }),
    },
  );

  return {
    ok: response.ok,
    skipped: false,
    status: response.status,
    payload: await parseResponsePayload(response),
    reason: response.ok ? null : "Management API request failed",
  };
}

async function applyMigrationViaRestRpc(endpointName, query) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      ok: false,
      skipped: true,
      reason: "Supabase service-role REST fallback is unavailable",
      payload: null,
      status: 0,
    };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${endpointName}`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  return {
    ok: response.ok,
    skipped: false,
    status: response.status,
    payload: await parseResponsePayload(response),
    reason: response.ok ? null : `REST RPC ${endpointName} request failed`,
  };
}

const migrationFile = path.join(
  rootDir,
  "supabase",
  "migrations",
  "20260417143000_short_link_public_full_schema.sql",
);

const accessToken = resolveAccessToken();
const projectRef = resolveProjectRef();
const query = await fs.readFile(migrationFile, "utf8");

console.log(`Applying short-link delivery migration to project ${projectRef}...`);

const managementResult = await applyMigrationViaManagementApi(projectRef, query, accessToken);

if (managementResult.ok) {
  console.log("Migration request accepted via Supabase Management API.");
} else {
  if (managementResult.skipped) {
    console.warn(`Management API skipped: ${managementResult.reason}`);
  } else {
    console.warn(`Management API failed with HTTP ${managementResult.status}.`);
    console.warn(managementResult.payload);
  }

  let fallbackResult = await applyMigrationViaRestRpc("execute_sql", query);
  if (!fallbackResult.ok) {
    if (!fallbackResult.skipped) {
      console.warn(`REST RPC execute_sql failed with HTTP ${fallbackResult.status}.`);
      console.warn(fallbackResult.payload);
    }
    fallbackResult = await applyMigrationViaRestRpc("query", query);
  }

  if (!fallbackResult.ok) {
    if (fallbackResult.skipped) {
      console.error(fallbackResult.reason);
    } else {
      console.error(`Migration fallback failed with HTTP ${fallbackResult.status}.`);
      console.error(fallbackResult.payload);
    }
    process.exit(1);
  }

  console.log("Migration request accepted via Supabase REST RPC fallback.");
}

const schemaResult = await assertShortLinkDeliverySchema();
if (!schemaResult.ok) {
  console.error("Migration request completed but schema verification still failed.");
  for (const failure of schemaResult.failures) {
    console.error(`- ${failure.table}: ${failure.message}`);
  }
  process.exit(1);
}

console.log("Short-link delivery schema is ready.");
