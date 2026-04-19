import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.useFakeTimers();

// The db-cache module uses globalThis for persistence.
// We must clear globalThis stores between tests.
beforeEach(async () => {
  const g = globalThis as Record<string, unknown>;
  delete g.__IN_MEMORY_DB_CACHE_STORE;
  delete g.__IN_MEMORY_DB_CACHE_INFLIGHT;
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function getModule() {
  return await import("../db-cache");
}

describe("cached()", () => {
  it("calls fetch on cache miss", async () => {
    const { cached } = await getModule();
    const fetchFn = vi.fn().mockResolvedValue([1, 2, 3]);
    const result = await cached("key1", fetchFn);
    expect(result).toEqual([1, 2, 3]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns cached value on subsequent calls within TTL", async () => {
    const { cached } = await getModule();
    const fetchFn = vi.fn().mockResolvedValue("data");
    await cached("key2", fetchFn, 10_000);
    const result = await cached("key2", fetchFn, 10_000);
    expect(result).toBe("data");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after TTL expires", async () => {
    const { cached } = await getModule();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2");
    await cached("key3", fetchFn, 5_000);
    vi.advanceTimersByTime(6_000);
    const result = await cached("key3", fetchFn, 5_000);
    expect(result).toBe("v2");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent requests for same key", async () => {
    const { cached } = await getModule();
    let resolvePromise: (v: string) => void;
    const fetchFn = vi.fn().mockReturnValue(
      new Promise<string>((r) => { resolvePromise = r; })
    );

    const p1 = cached("key4", fetchFn);
    const p2 = cached("key4", fetchFn);
    resolvePromise!("shared");
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("shared");
    expect(r2).toBe("shared");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("invalidate()", () => {
  it("removes a specific cache key", async () => {
    const { cached, invalidate } = await getModule();
    await cached("del-key", () => Promise.resolve("val"));
    invalidate("del-key");
    const fetchFn = vi.fn().mockResolvedValue("new-val");
    const result = await cached("del-key", fetchFn);
    expect(result).toBe("new-val");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("invalidatePrefix()", () => {
  it("removes all keys with matching prefix", async () => {
    const { cached, invalidatePrefix } = await getModule();
    await cached("products:acc1:list", () => Promise.resolve([1]));
    await cached("products:acc1:item", () => Promise.resolve({ id: 1 }));
    await cached("orders:acc1:list", () => Promise.resolve([2]));
    invalidatePrefix("products:acc1");

    // Orders should still be cached
    const orderFetch = vi.fn().mockResolvedValue([99]);
    const result = await cached("orders:acc1:list", orderFetch);
    expect(result).toEqual([2]); // Still cached
    expect(orderFetch).not.toHaveBeenCalled();
  });
});

describe("evictExpired()", () => {
  it("removes only expired entries", async () => {
    const { cached, evictExpired, cacheSize } = await getModule();
    await cached("short", () => Promise.resolve("s"), 1_000);
    await cached("long", () => Promise.resolve("l"), 60_000);
    vi.advanceTimersByTime(2_000);
    evictExpired();
    expect(cacheSize()).toBe(1); // Only 'long' remains
  });
});

describe("cacheSize()", () => {
  it("returns 0 for empty cache", async () => {
    const { cacheSize } = await getModule();
    expect(cacheSize()).toBe(0);
  });

  it("counts cached entries", async () => {
    const { cached, cacheSize } = await getModule();
    await cached("a", () => Promise.resolve(1));
    await cached("b", () => Promise.resolve(2));
    expect(cacheSize()).toBe(2);
  });
});

describe("TTL constants", () => {
  it("has correct TTL values", async () => {
    const { TTL } = await getModule();
    expect(TTL.REFERENCE).toBe(60_000);
    expect(TTL.LIST).toBe(15_000);
    expect(TTL.ITEM).toBe(10_000);
    expect(TTL.AGGREGATE).toBe(30_000);
  });
});
