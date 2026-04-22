import Redis from "ioredis";

// ============================================================
// RATE LIMITER & ACCOUNT LOCKOUT — Standard Redis Supported
// ============================================================
// Provides per-IP rate limiting to defend against brute-force
// attacks on login, excessive order creation, and API abuse.
// Supports distributed setups via Redis, with in-memory fallback.

interface RateLimitEntry { count: number; resetAt: number; }
interface RateLimiterConfig { maxRequests: number; windowMs: number; }

const DEFAULT_CONFIG: RateLimiterConfig = { maxRequests: 60, windowMs: 60_000 };
const AUTH_CONFIG: RateLimiterConfig = { maxRequests: 5, windowMs: 60_000 };
const ORDER_CONFIG: RateLimiterConfig = { maxRequests: 20, windowMs: 60_000 };

// In-memory store fallback
const stores = new Map<string, Map<string, RateLimitEntry>>();
function getStore(bucket: string) {
  if (!stores.has(bucket)) stores.set(bucket, new Map());
  return stores.get(bucket)!;
}

const redisUrl = process.env.REDIS_URL;
const redis = (() => {
  if (!redisUrl) return null;
  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
      connectTimeout: 5000,
      reconnectOnError: () => false,
    });
    client.on('error', () => { /* suppress unhandled error events */ });
    return client;
  } catch {
    return null;
  }
})();

function isRedisReady(): boolean {
  return redis !== null && redis.status === 'ready';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

export async function checkRateLimit(
  identifier: string,
  bucket: string = "default",
  config: RateLimiterConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Date.now();
  if (isRedisReady()) {
    const redisKey = `rl:${bucket}:${identifier}:${Math.floor(now / config.windowMs)}`;
    try {
      const count = await redis!.incr(redisKey);
      if (count === 1) await redis!.pexpire(redisKey, config.windowMs);
      const resetAt = Math.floor(now / config.windowMs) * config.windowMs + config.windowMs;
      if (count > config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt, retryAfterMs: resetAt - now };
      }
      return { allowed: true, remaining: config.maxRequests - count, resetAt, retryAfterMs: 0 };
    } catch (e) { console.error("Redis error:", e); }
  }

  const store = getStore(bucket);
  const entry = store.get(identifier);
  if (!entry || entry.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs, retryAfterMs: 0 };
  }
  if (entry.count < config.maxRequests) {
    entry.count++;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt, retryAfterMs: 0 };
  }
  return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfterMs: entry.resetAt - now };
}

export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> { return checkRateLimit(ip, "auth", AUTH_CONFIG); }
export async function checkOrderRateLimit(ip: string): Promise<RateLimitResult> { return checkRateLimit(ip, "orders", ORDER_CONFIG); }

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

const LOCKOUT_CONFIG = { maxAttempts: 5, lockoutMs: 15 * 60_000 };
const lockoutStore = new Map<string, { failures: number; lockedUntil: number }>();

export async function checkAccountLockout(email: string): Promise<RateLimitResult> {
  const key = `lockout:${email.toLowerCase()}`;
  const now = Date.now();
  if (isRedisReady()) {
    try {
      const rawData = await redis!.get(key);
      const data: { failures: number; lockedUntil: number } | null = rawData ? JSON.parse(rawData) : null;
      if (!data || data.lockedUntil <= now) {
        return { allowed: true, remaining: LOCKOUT_CONFIG.maxAttempts, resetAt: now + LOCKOUT_CONFIG.lockoutMs, retryAfterMs: 0 };
      }
      if (data.failures >= LOCKOUT_CONFIG.maxAttempts) {
        return { allowed: false, remaining: 0, resetAt: data.lockedUntil, retryAfterMs: data.lockedUntil - now };
      }
      return { allowed: true, remaining: LOCKOUT_CONFIG.maxAttempts - data.failures, resetAt: data.lockedUntil, retryAfterMs: 0 };
    } catch (e) { console.error("Redis error:", e); }
  }

  const entry = lockoutStore.get(key);
  if (!entry || entry.lockedUntil <= now) {
    return { allowed: true, remaining: LOCKOUT_CONFIG.maxAttempts, resetAt: now + LOCKOUT_CONFIG.lockoutMs, retryAfterMs: 0 };
  }
  if (entry.failures >= LOCKOUT_CONFIG.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.lockedUntil, retryAfterMs: entry.lockedUntil - now };
  }
  return { allowed: true, remaining: LOCKOUT_CONFIG.maxAttempts - entry.failures, resetAt: entry.lockedUntil, retryAfterMs: 0 };
}

export async function recordLoginFailure(email: string): Promise<void> {
  const key = `lockout:${email.toLowerCase()}`;
  const now = Date.now();
  if (isRedisReady()) {
    try {
      const rawData = await redis!.get(key);
      let data: { failures: number; lockedUntil: number } | null = rawData ? JSON.parse(rawData) : null;
      if (!data || data.lockedUntil <= now) {
        data = { failures: 1, lockedUntil: now + LOCKOUT_CONFIG.lockoutMs };
      } else {
        data.failures++;
        if (data.failures >= LOCKOUT_CONFIG.maxAttempts) data.lockedUntil = now + LOCKOUT_CONFIG.lockoutMs;
      }
      await redis!.set(key, JSON.stringify(data), "PX", Math.max(1, data.lockedUntil - now));
      return;
    } catch (e) { console.error("Redis error:", e); }
  }
  const entry = lockoutStore.get(key);
  if (!entry || entry.lockedUntil <= now) {
    lockoutStore.set(key, { failures: 1, lockedUntil: now + LOCKOUT_CONFIG.lockoutMs });
    return;
  }
  entry.failures++;
  if (entry.failures >= LOCKOUT_CONFIG.maxAttempts) entry.lockedUntil = now + LOCKOUT_CONFIG.lockoutMs;
}

export async function clearLoginFailures(email: string): Promise<void> {
  const key = `lockout:${email.toLowerCase()}`;
  if (isRedisReady()) {
    try { await redis!.del(key); return; } catch (e) { console.error("Redis error:", e); }
  }
  lockoutStore.delete(key);
}
