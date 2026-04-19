/**
 * ============================================================
 * DASHBOARD CACHE — TTL, Deduplication & Invalidation Tests
 * Covers: lib/cache/db-cache.ts integration with dashboard API
 *
 * Tests the caching layer in isolation:
 * - TTL hit: cached value served within TTL window
 * - TTL miss: DB fetch triggered after TTL expiry
 * - In-flight deduplication: N concurrent requests → 1 DB query
 * - Cache key namespacing by accountId and days
 * - Invalidation by key and prefix
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Direct imports (no route mocks needed for unit cache tests) ──
import {
  cached,
  invalidate,
  invalidatePrefix,
  cacheSize,
  evictExpired,
  TTL,
} from "@/lib/cache/db-cache";

// ═══════════════════════════════════════════════════════════════
describe("Dashboard Cache Layer (db-cache.ts)", () => {
  beforeEach(() => {
    // Clear all caches before each test
    invalidatePrefix("");
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── TTL Behavior ──────────────────────────────────────────
  describe("TTL Hit/Miss", () => {
    it("returns cached value within TTL window (no re-fetch)", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ revenue: 1_000_000 });

      const result1 = await cached("test:ttl:hit", fetchFn, 5000);
      const result2 = await cached("test:ttl:hit", fetchFn, 5000);

      expect(fetchFn).toHaveBeenCalledTimes(1); // Only 1 DB call
      expect(result1).toEqual({ revenue: 1_000_000 });
      expect(result2).toEqual({ revenue: 1_000_000 });
    });

    it("re-fetches after TTL expires", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ revenue: 100 })
        .mockResolvedValueOnce({ revenue: 200 });

      const r1 = await cached("test:ttl:miss", fetchFn, 100); // 100ms TTL
      expect(r1).toEqual({ revenue: 100 });

      // Advance past TTL
      vi.advanceTimersByTime(150);

      const r2 = await cached("test:ttl:miss", fetchFn, 100);
      expect(r2).toEqual({ revenue: 200 });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  // ── In-flight Deduplication ───────────────────────────────
  describe("In-flight Deduplication", () => {
    it("5 concurrent requests for same key → only 1 DB query", async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchFn = vi.fn().mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve; })
      );

      // Fire 5 concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        cached("test:dedup", fetchFn, 5000)
      );

      // Resolve the single DB call
      resolvePromise!({ data: "shared" });

      const results = await Promise.all(promises);

      expect(fetchFn).toHaveBeenCalledTimes(1); // Only 1 DB call!
      results.forEach((r) => expect(r).toEqual({ data: "shared" }));
    });
  });

  // ── Cache Key Namespacing ─────────────────────────────────
  describe("Cache Key Namespacing", () => {
    it("different accountIds get different cache entries", async () => {
      const fetchA = vi.fn().mockResolvedValue({ account: "A" });
      const fetchB = vi.fn().mockResolvedValue({ account: "B" });

      const a = await cached("dashboard:stats:acc-A:30", fetchA, 5000);
      const b = await cached("dashboard:stats:acc-B:30", fetchB, 5000);

      expect(a).toEqual({ account: "A" });
      expect(b).toEqual({ account: "B" });
      expect(fetchA).toHaveBeenCalledTimes(1);
      expect(fetchB).toHaveBeenCalledTimes(1);
    });

    it("different days parameters get different cache entries", async () => {
      const fetch7 = vi.fn().mockResolvedValue({ days: 7 });
      const fetch30 = vi.fn().mockResolvedValue({ days: 30 });

      await cached("dashboard:stats:acc-A:7", fetch7, 5000);
      await cached("dashboard:stats:acc-A:30", fetch30, 5000);

      expect(fetch7).toHaveBeenCalledTimes(1);
      expect(fetch30).toHaveBeenCalledTimes(1);
    });
  });

  // ── Invalidation ──────────────────────────────────────────
  describe("Cache Invalidation", () => {
    it("invalidate() removes specific key", async () => {
      const fetchFn = vi.fn().mockResolvedValue("cached");

      await cached("test:inv:specific", fetchFn, 60_000);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      invalidate("test:inv:specific");

      // Next call should re-fetch
      await cached("test:inv:specific", fetchFn, 60_000);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("invalidatePrefix() removes all matching keys", async () => {
      const fn1 = vi.fn().mockResolvedValue("v1");
      const fn2 = vi.fn().mockResolvedValue("v2");
      const fn3 = vi.fn().mockResolvedValue("v3");

      await cached("dashboard:stats:acc-A:7", fn1, 60_000);
      await cached("dashboard:stats:acc-A:30", fn2, 60_000);
      await cached("other:key", fn3, 60_000);

      invalidatePrefix("dashboard:stats:acc-A");

      // Dashboard keys should be invalidated
      await cached("dashboard:stats:acc-A:7", fn1, 60_000);
      await cached("dashboard:stats:acc-A:30", fn2, 60_000);
      await cached("other:key", fn3, 60_000);

      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(2);
      expect(fn3).toHaveBeenCalledTimes(1); // Not invalidated
    });
  });

  // ── TTL Constants ─────────────────────────────────────────
  describe("TTL Constants", () => {
    it("AGGREGATE TTL is 30 seconds", () => {
      expect(TTL.AGGREGATE).toBe(30_000);
    });

    it("REFERENCE TTL is 60 seconds", () => {
      expect(TTL.REFERENCE).toBe(60_000);
    });

    it("LIST TTL is 15 seconds", () => {
      expect(TTL.LIST).toBe(15_000);
    });
  });

  // ── Eviction & Diagnostics ────────────────────────────────
  describe("Eviction & Diagnostics", () => {
    it("evictExpired() cleans up expired entries", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const fn = vi.fn().mockResolvedValue("temp");
      await cached("test:evict", fn, 50); // 50ms TTL

      vi.advanceTimersByTime(100); // Expire it

      evictExpired();

      // Cache is clean, next call re-fetches
      await cached("test:evict", fn, 50);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("cacheSize() returns number of live entries", async () => {
      // Clear everything first
      invalidatePrefix("");

      const fn = vi.fn().mockResolvedValue("data");
      await cached("test:size:1", fn, 60_000);
      await cached("test:size:2", fn, 60_000);

      const size = cacheSize();
      expect(size).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Error Handling ────────────────────────────────────────
  describe("Error Handling", () => {
    it("does not cache failed fetches", async () => {
      const fetchFn = vi.fn()
        .mockRejectedValueOnce(new Error("DB timeout"))
        .mockResolvedValueOnce({ recovered: true });

      // First call fails
      await expect(cached("test:error", fetchFn, 5000))
        .rejects.toThrow("DB timeout");

      // Second call should retry (not return cached error)
      const result = await cached("test:error", fetchFn, 5000);
      expect(result).toEqual({ recovered: true });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });
});
