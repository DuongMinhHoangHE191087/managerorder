/**
 * rate-limiter.ts
 *
 * In-process sliding-window rate limiter with Standard Redis (ioredis) support.
 * Prevents a single account from hammering the database with bursts of writes.
 *
 * It uses Redis distributed rate limiting if REDIS_URL is provided.
 * Otherwise, it falls back to a plain Map.
 *
 * Default limits (configurable):
 *   - WRITE operations : 60 requests / 60 s per account
 *   - READ  operations : 120 requests / 60 s per account
 */

import Redis from "ioredis";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

export const LIMIT = {
  WRITE: { requests: 60, windowMs: 60_000 },
  READ: { requests: 120, windowMs: 60_000 },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Initialize Redis if env var is present, with error handling
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

export async function checkRateLimit(
  key: string,
  maxRequests: number = LIMIT.WRITE.requests,
  windowMs: number = LIMIT.WRITE.windowMs,
): Promise<RateLimitResult> {
  const now = Date.now();

  // If Redis is configured and ready, use it for distributed rate limiting
  if (isRedisReady()) {
    const redisKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    try {
      const count = await redis!.incr(redisKey);
      if (count === 1) {
        await redis!.pexpire(redisKey, windowMs);
      }
      const resetAt = Math.floor(now / windowMs) * windowMs + windowMs;
      
      if (count > maxRequests) {
        return { allowed: false, remaining: 0, resetAt };
      }
      return { allowed: true, remaining: maxRequests - count, resetAt };
    } catch (error) {
      console.error("Redis rate limiting failed, falling back to memory:", error);
    }
  }

  // Fallback: In-memory Map
  if (process.env.NODE_ENV === "production" && !redis) {
    console.warn("WARNING: Using in-memory rate limiter in production. Set REDIS_URL for distributed rate limits.");
  }
  
  let entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    windows.set(key, entry);
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  windows.set(key, entry);
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

export function evictExpiredWindows(): void {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (now >= entry.resetAt) windows.delete(key);
  }
}
