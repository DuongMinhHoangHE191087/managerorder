import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const PASSCODE_ITERATIONS = 120_000;
const PASSCODE_KEY_LENGTH = 32;
const PASSCODE_DIGEST = "sha256";
const UNLOCK_COOKIE_VERSION = "v1";
const DEFAULT_UNLOCK_TTL_SECONDS = 15 * 60;

export const ACCOUNT_SHARE_UNLOCK_COOKIE = "account_share_unlock";

export interface ShareUnlockPayload {
  slug: string;
  exp: number;
  ua: string;
}

function getShareUnlockSecret(env: Record<string, string | undefined> = process.env) {
  return env.SHARE_UNLOCK_SECRET ?? null;
}

function base64UrlEncode(value: Buffer | string) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

export function hashPasscode(passcode: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(passcode, salt, PASSCODE_ITERATIONS, PASSCODE_KEY_LENGTH, PASSCODE_DIGEST);
  return `pbkdf2:${PASSCODE_ITERATIONS}:${salt}:${derived.toString("hex")}`;
}

export function verifyPasscode(passcode: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || !salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = pbkdf2Sync(passcode, salt, iterations, expected.length, PASSCODE_DIGEST);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashUserAgent(userAgent: string | null | undefined) {
  return createHash("sha256")
    .update((userAgent ?? "").trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function createUnlockCookieValue(
  input: { slug: string; userAgent: string | null; ttlSeconds?: number },
  env: Record<string, string | undefined> = process.env,
) {
  const secret = getShareUnlockSecret(env);
  if (!secret) {
    throw new Error("SHARE_UNLOCK_SECRET is required for account share unlock cookies");
  }

  const payload: ShareUnlockPayload = {
    slug: input.slug,
    exp: Date.now() + (input.ttlSeconds ?? DEFAULT_UNLOCK_TTL_SECONDS) * 1000,
    ua: hashUserAgent(input.userAgent),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest();
  return `${UNLOCK_COOKIE_VERSION}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function verifyUnlockCookieValue(
  value: string | null | undefined,
  input: { slug: string; userAgent: string | null },
  env: Record<string, string | undefined> = process.env,
): ShareUnlockPayload | null {
  if (!value) {
    return null;
  }

  const secret = getShareUnlockSecret(env);
  if (!secret) {
    return null;
  }

  const [version, encodedPayload, encodedSignature] = value.split(".");
  if (version !== UNLOCK_COOKIE_VERSION || !encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest();
  const actualSignature = Buffer.from(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as ShareUnlockPayload;
    if (payload.slug !== input.slug || payload.exp <= Date.now()) {
      return null;
    }
    if (payload.ua !== hashUserAgent(input.userAgent)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
