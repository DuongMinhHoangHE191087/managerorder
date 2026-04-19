import Redis from 'ioredis';

// Redis client with graceful degradation to in-memory fallback.
// When Redis is unavailable, all operations silently use an in-memory Map.
const redisUrl = process.env.REDIS_URL;
let redisWarned = false;

function createRedisClient(url: string): Redis | null {
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Don't queue commands when disconnected — fail fast
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
      connectTimeout: 5000,
      reconnectOnError: () => false, // Don't auto-reconnect on command errors
    });
    client.on('error', (err) => {
      if (!redisWarned) {
        redisWarned = true;
        console.warn('[Redis] Unavailable, using in-memory fallback:', err.message);
      }
    });
    return client;
  } catch {
    return null;
  }
}

export const redis = redisUrl ? createRedisClient(redisUrl) : null;

/** Check if redis connection is usable */
function isRedisReady(): boolean {
  return redis !== null && redis.status === 'ready';
}

// In-memory fallback store
const inMemoryStore = new Map<string, { value: any, /* eslint-disable-line @typescript-eslint/no-explicit-any */ expiresAt?: number }>();

/**
 * Set a value in cache, with optional TTL in seconds.
 */
export async function setCache(key: string, value: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, ttlSeconds?: number): Promise<void> {
  if (isRedisReady()) {
    try {
      if (ttlSeconds) {
        await redis!.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } else {
        await redis!.set(key, JSON.stringify(value));
      }
      return;
    } catch { /* fall through to in-memory */ }
  }
  inMemoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
  });
}

/**
 * Get a value from cache.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (isRedisReady()) {
    try {
      const raw = await redis!.get(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch { /* fall through to in-memory */ }
  }
  const record = inMemoryStore.get(key);
  if (!record) return null;
  if (record.expiresAt && Date.now() > record.expiresAt) {
    inMemoryStore.delete(key);
    return null;
  }
  return record.value as T;
}

/**
 * Delete a value from cache.
 */
export async function deleteCache(key: string): Promise<void> {
  if (isRedisReady()) {
    try { await redis!.del(key); return; } catch { /* fall through */ }
  }
  inMemoryStore.delete(key);
}

/**
 * Increment a counter. If it is newly created, its TTL is set to ttlSeconds.
 */
export async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  if (isRedisReady()) {
    try {
      const val = await redis!.incr(key);
      if (val === 1) {
        await redis!.expire(key, ttlSeconds);
      }
      return val;
    } catch { /* fall through to in-memory */ }
  }
  const record = inMemoryStore.get(key);
  if (record && record.expiresAt && Date.now() > record.expiresAt) {
    inMemoryStore.delete(key);
  }
  const current = inMemoryStore.get(key);
  const newVal = (current ? current.value : 0) + 1;
  if (!current) {
    inMemoryStore.set(key, { value: newVal, expiresAt: Date.now() + ttlSeconds * 1000 });
  } else {
    inMemoryStore.set(key, { value: newVal, expiresAt: current?.expiresAt });
  }
  return newVal;
}

