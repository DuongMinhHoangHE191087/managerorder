import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env.local");
const envSource = await fs.readFile(envPath, "utf8").catch(() => "");
const baseURL = process.env.BASE_URL ?? "http://localhost:3001";

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
    sub: "codex-runtime-debug",
    accountId,
    role: "admin_owner",
    email: "codex-runtime-debug@local",
  },
  jwtSecret,
  { algorithm: "HS256", expiresIn: "1h" },
);

const targets = [
  "/api/premium/accounts",
  "/api/notifications/feed?limit=12",
  "/api/premium/migrations?status=pending",
  "/orders/new",
];

for (const target of targets) {
  const response = await fetch(`${baseURL}${target}`, {
    headers: {
      Cookie: `access_token=${token}`,
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.text();

  console.log(`\n=== ${target} ===`);
  console.log(`STATUS: ${response.status}`);
  console.log(body);
}
