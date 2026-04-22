import { readFileSync } from "fs";
import { resolve } from "path";
import jwt from "jsonwebtoken";

// Simple script to generate a token for k6
// Read from .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const secretMatch = envContent.match(/JWT_SECRET=(.*)/);
let secret = secretMatch ? secretMatch[1].trim() : "super-secret-key-change-me-in-production";
secret = secret.replace(/^"|"$/g, '');

const accountIdMatch = envContent.match(/TELEGRAM_BOT_ACCOUNT_ID=(.*)/);
let accountId = accountIdMatch ? accountIdMatch[1].trim() : "test-account";
accountId = accountId.replace(/^"|"$/g, '');

const payload = {
  sub: "k6-tester",
  accountId: accountId,
  role: "admin",
  email: "k6@test.com"
};

const token = jwt.sign(payload, secret, { expiresIn: "1h", algorithm: "HS256" });
console.log(token);
