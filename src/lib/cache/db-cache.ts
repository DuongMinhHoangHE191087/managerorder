/**
 * db-cache.ts
 *
 * Lightweight in-process cache for Supabase query results.
 *
 * Two complementary mechanisms:
 *  1. TTL cache  – stores results and returns them for subsequent identical
 *                  calls within the TTL window, avoiding repeat DB round-trips.
 *  2. In-flight deduplication – if N concurrent requests arrive for the same
 *                  cache key before the first one resolves, only ONE Supabase
 *                  query is issued and all callers share the single result.
 *
 * Use for READ-HEAVY, low-churn data:
 *   products, payment-sources, sales-channels, providers, source-accounts
 *
 * Always invalidate on write by calling `invalidate(key)` or `invalidatePrefix(prefix)`.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Default TTL buckets (ms)
export const TTL = {
  /** Reference data that rarely changes – settings, products, providers */
  REFERENCE: 60_000,        // 60 s
  /** Lists that change on write operations */
  LIST: 15_000,             // 15 s
  /** Single-item lookups */
  ITEM: 10_000,             // 10 s
  /** Dashboard aggregates */
  AGGREGATE: 30_000,        // 30 s
} as const;

// ─── Storage ────────────────────────────────────────────────────────────────
// Use globalThis to prevent isolated chunk instantiations (Next.js bundle isolation)
const globalCache = globalThis as unknown as {
  __IN_MEMORY_DB_CACHE_STORE?: Map<string, CacheEntry<unknown>>;
  __IN_MEMORY_DB_CACHE_INFLIGHT?: Map<string, Promise<unknown>>;
  __IN_MEMORY_DB_CACHE_EVICT_TIMER?: ReturnType<typeof setInterval>;
};

const store = globalCache.__IN_MEMORY_DB_CACHE_STORE || new Map<string, CacheEntry<unknown>>();
const inflight = globalCache.__IN_MEMORY_DB_CACHE_INFLIGHT || new Map<string, Promise<unknown>>();

if (!globalCache.__IN_MEMORY_DB_CACHE_STORE) {
  globalCache.__IN_MEMORY_DB_CACHE_STORE = store;
}
if (!globalCache.__IN_MEMORY_DB_CACHE_INFLIGHT) {
  globalCache.__IN_MEMORY_DB_CACHE_INFLIGHT = inflight;
}

// ─── Auto-evict expired entries every 5 minutes ────────────────────────────
const AUTO_EVICT_INTERVAL_MS = 5 * 60_000;

if (!globalCache.__IN_MEMORY_DB_CACHE_EVICT_TIMER) {
  globalCache.__IN_MEMORY_DB_CACHE_EVICT_TIMER = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.expiresAt) store.delete(key);
    }
  }, AUTO_EVICT_INTERVAL_MS);

  // Allow Node.js process to exit without waiting for this timer
  if (globalCache.__IN_MEMORY_DB_CACHE_EVICT_TIMER?.unref) {
    globalCache.__IN_MEMORY_DB_CACHE_EVICT_TIMER.unref();
  }
}

// ─── Core helpers ────────────────────────────────────────────────────────────

function isAlive<T>(entry: CacheEntry<T>): boolean {
  return Date.now() < entry.expiresAt;
}

/**
 * Wrap a DB fetch with cache + in-flight deduplication.
 *
 * @param key    Unique cache key (include accountId to namespace per tenant)
 * @param fetch  Async factory that runs the Supabase query
 * @param ttl    Time-to-live in milliseconds (use TTL.* constants)
 */
export async function cached<T>(
  key: string,
  fetch: () => Promise<T>,
  ttl: number = TTL.LIST,
): Promise<T> {
  // 1. Serve from cache if still alive
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && isAlive(hit)) return hit.value;

  // 2. Deduplicate concurrent requests for the same key
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  // 3. Issue the real DB query and cache the result
  const promise = (async () => {
    try {
      const value = await fetch();
      store.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise as Promise<unknown>);
  return promise;
}

/**
 * Remove a specific cache key (call after write operations).
 */
export function invalidate(key: string): void {
  store.delete(key);
}

/**
 * Remove all cache keys that start with the given prefix.
 * Useful for bulk invalidation, e.g. `invalidatePrefix('products:acc_123')`.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Clear all cache entries — use after bulk operations that affect many entities.
 * E.g., bulk import creates orders, customers, products all at once.
 */
export function invalidateAll(): void {
  store.clear();
}

/**
 * Evict all expired entries. Called lazily; also exposed for scheduled cleanup.
 */
export function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.expiresAt) store.delete(key);
  }
}

/** Total number of live cache entries (for diagnostics). */
export function cacheSize(): number {
  evictExpired();
  return store.size;
}
