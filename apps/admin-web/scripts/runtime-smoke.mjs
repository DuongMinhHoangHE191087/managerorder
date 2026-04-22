import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import jwt from "jsonwebtoken";
import "./register-ts-loader.mjs";
import { loadLocalEnv } from "./load-local-env.ts";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env.local");
const envSource = await fs.readFile(envPath, "utf8").catch(() => "");
const targetTimeoutMs = Number(process.env.SMOKE_TARGET_TIMEOUT_MS ?? 15000);
const smokeTracePath = path.join(rootDir, "qa-artifacts", "runtime-smoke-trace.log");

loadLocalEnv();

async function trace(message) {
  await fs.appendFile(smokeTracePath, `${new Date().toISOString()} ${message}\n`).catch(() => {});
}

function readEnvValue(name) {
  const match = envSource.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) {
    return undefined;
  }

  return match[1].trim().replace(/^"|"$/g, "");
}

const jwtSecret = process.env.JWT_SECRET ?? readEnvValue("JWT_SECRET");
const accountId =
  process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID ??
  readEnvValue("NEXT_PUBLIC_TEST_ACCOUNT_ID") ??
  "550e8400-e29b-41d4-a716-446655440000";

if (!jwtSecret) {
  throw new Error("JWT_SECRET is unavailable");
}

const token = jwt.sign(
  {
    sub: "codex-runtime-smoke",
    accountId,
    role: "admin_owner",
    email: "codex-runtime-smoke@local",
  },
  jwtSecret,
  { algorithm: "HS256", expiresIn: "1h" },
);

const targets = [
  { path: "/api/premium/accounts", kind: "json" },
  { path: "/api/premium/migrations?status=pending", kind: "json" },
  { path: "/api/notifications/feed?limit=12", kind: "json" },
  { path: "/api/dashboard/stats", kind: "json" },
  { path: "/api/settings/bot/status", kind: "json" },
  { path: "/orders/new", kind: "html" },
  { path: "/premium/health-checks", kind: "html" },
  { path: "/premium/migrations?status=pending", kind: "html" },
];

async function detectBaseURL() {
  const candidates = [
    process.env.BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://localhost:3000",
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];

  for (const candidate of uniqueCandidates) {
    try {
      const url = new URL(candidate);
      const canConnect = await new Promise((resolve) => {
        const socket = net.createConnection({
          host: url.hostname,
          port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
        });
        const cleanup = () => socket.destroy();
        socket.setTimeout(3000);
        socket.once("connect", () => {
          cleanup();
          resolve(true);
        });
        socket.once("timeout", () => {
          cleanup();
          resolve(false);
        });
        socket.once("error", () => {
          cleanup();
          resolve(false);
        });
      });

      if (canConnect) {
        return candidate;
      }
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    `Unable to detect runtime base URL. Tried: ${uniqueCandidates.join(", ")}`
  );
}

async function runLocalHarnessSmoke() {
  await trace("local harness start");
  process.env.NODE_ENV = "development";
  delete process.env.CODEX_DISABLE_LOCAL_FALLBACK;
  process.env.TELEGRAM_BOT_TOKEN = "";
  process.env.ZALO_BOT_TOKEN = "";
  process.env.CRON_SECRET = token;

  await trace("import next/server.js");
  const { NextRequest } = await import("next/server.js");
  const routeModuleByPath = new Map([
    ["/api/premium/accounts", "../src/app/api/premium/accounts/route.ts"],
    ["/api/premium/migrations?status=pending", "../src/app/api/premium/migrations/route.ts"],
    ["/api/notifications/feed?limit=12", "../src/app/api/notifications/feed/route.ts"],
    ["/api/cron/premium-health-checks", "../src/app/api/cron/premium-health-checks/route.ts"],
    ["/api/dashboard/stats", "../src/app/api/dashboard/stats/route.ts"],
    ["/api/settings/bot/status", "../src/app/api/settings/bot/status/route.ts"],
  ]);
  const localHarnessTargets = [
    ...targets,
    { path: "/api/cron/premium-health-checks", kind: "json" },
  ];
  const pageModuleByPath = new Map([
    ["/orders/new", "../src/app/orders/new/page.tsx"],
    ["/premium/health-checks", "../src/app/premium/health-checks/page.tsx"],
    ["/premium/migrations?status=pending", "../src/app/premium/migrations/page.tsx"],
  ]);

  async function withTimeout(valuePromise, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timed out while checking ${label}`)), timeoutMs);
    });

    try {
      return await Promise.race([valuePromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  for (const target of localHarnessTargets) {
    if (target.kind === "json") {
      await trace(`local harness GET ${target.path}`);
      const modulePath = routeModuleByPath.get(target.path);
      if (!modulePath) {
        throw new Error(`No local harness route mapping for ${target.path}`);
      }

      await trace(`import ${modulePath}`);
      const mod = await import(modulePath);
      const handler = mod.GET;
      if (typeof handler !== "function") {
        throw new Error(`No GET handler exported by ${modulePath}`);
      }

      const request = new NextRequest(`http://localhost${target.path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `access_token=${token}`,
          "x-account-id": accountId,
        },
      });

      await trace(`invoke ${target.path}`);
      const response = await withTimeout(
        handler(request, { params: {} }),
        30000,
        target.path,
      );
      await trace(`response ${target.path} status ${response.status}`);
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`${target.path}: HTTP ${response.status} ${body}`);
      }

      try {
        JSON.parse(body);
      } catch {
        throw new Error(`${target.path}: expected JSON response, received ${body.slice(0, 200)}`);
      }

      continue;
    }

    await trace(`local harness PAGE ${target.path}`);
    const modulePath = pageModuleByPath.get(target.path);
    if (!modulePath) {
      throw new Error(`No local harness page mapping for ${target.path}`);
    }

    await trace(`read ${modulePath}`);
    const sourcePath = path.resolve(rootDir, "scripts", modulePath);
    const source = await fs.readFile(sourcePath, "utf8").catch(() => "");
    if (!source) {
      throw new Error(`Unable to read page module ${modulePath}`);
    }

    if (!/export\s+default/.test(source)) {
      throw new Error(`Page module ${modulePath} does not export a default component`);
    }
  }

  console.log(`Runtime smoke passed via local harness for ${localHarnessTargets.length} targets.`);
  process.exit(0);
}

const baseURL = await detectBaseURL().catch(() => null);

if (!baseURL) {
  await runLocalHarnessSmoke();
} else {
  const failures = [];

  for (const target of targets) {
    const targetURL = `${baseURL}${target.path}`;
    console.log(`[smoke] GET ${target.path}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), targetTimeoutMs);
    let response;
    let body = "";

    try {
      response = await fetch(targetURL, {
        headers: {
          Cookie: `access_token=${token}`,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      body = await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${target.path}: request failed (${message})`);
      clearTimeout(timeoutId);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      failures.push(`${target.path}: HTTP ${response.status} ${body}`);
      continue;
    }

    if (target.kind === "json") {
      try {
        JSON.parse(body);
      } catch {
        failures.push(`${target.path}: expected JSON response, received ${body.slice(0, 200)}`);
      }
      continue;
    }

    if (/Internal Server Error|Application error|supabaseKey is required/i.test(body)) {
      failures.push(`${target.path}: detected runtime error marker in HTML`);
    }
  }

  if (failures.length > 0) {
    console.error("Runtime smoke failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Runtime smoke passed for ${targets.length} targets.`);
  process.exit(0);
}
