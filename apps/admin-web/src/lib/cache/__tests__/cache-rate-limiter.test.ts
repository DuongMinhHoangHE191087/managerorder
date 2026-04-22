import { describe, it, expect, vi, beforeEach } from "vitest";

vi.useFakeTimers();

let checkRateLimit: typeof import("../rate-limiter").checkRateLimit;
let evictExpiredWindows: typeof import("../rate-limiter").evictExpiredWindows;
let LIMIT: typeof import("../rate-limiter").LIMIT;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../rate-limiter");
  checkRateLimit = mod.checkRateLimit;
  evictExpiredWindows = mod.evictExpiredWindows;
  LIMIT = mod.LIMIT;
});

describe("checkRateLimit (cache/rate-limiter)", () => {
  it("allows requests within WRITE limit", async () => {
    const r = await checkRateLimit("write:acc1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(LIMIT.WRITE.requests - 1);
  });

  it("blocks after exceeding custom limit", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit("key1", 3, 10_000);
    const blocked = await checkRateLimit("key1", 3, 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    await checkRateLimit("key2", 1, 5_000);
    const blocked = await checkRateLimit("key2", 1, 5_000);
    expect(blocked.allowed).toBe(false);
    vi.advanceTimersByTime(6_000);
    const after = await checkRateLimit("key2", 1, 5_000);
    expect(after.allowed).toBe(true);
  });

  it("returns correct resetAt timestamp", async () => {
    const now = Date.now();
    const r = await checkRateLimit("key3", 10, 30_000);
    expect(r.resetAt).toBeGreaterThanOrEqual(now + 30_000);
  });

  it("uses default WRITE config", async () => {
    const r = await checkRateLimit("default-key");
    expect(r.remaining).toBe(LIMIT.WRITE.requests - 1);
  });

  it("allows READ limit (higher)", async () => {
    const r = await checkRateLimit("read:acc1", LIMIT.READ.requests, LIMIT.READ.windowMs);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(LIMIT.READ.requests - 1);
  });
});

describe("evictExpiredWindows", () => {
  it("removes expired entries", async () => {
    await checkRateLimit("evict1", 10, 1_000);
    await checkRateLimit("evict2", 10, 60_000);
    vi.advanceTimersByTime(2_000);
    evictExpiredWindows();
    // evict1 expired, evict2 should still work
    const r = await checkRateLimit("evict2", 10, 60_000);
    expect(r.remaining).toBe(8); // 10 - 2 (initial + this call)
  });
});

describe("LIMIT constants", () => {
  it("has correct WRITE limits", () => {
    expect(LIMIT.WRITE.requests).toBe(60);
    expect(LIMIT.WRITE.windowMs).toBe(60_000);
  });

  it("has correct READ limits", () => {
    expect(LIMIT.READ.requests).toBe(120);
    expect(LIMIT.READ.windowMs).toBe(60_000);
  });
});
