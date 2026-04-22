import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// We need to import from the api rate-limiter (not cache one)
// The module has side-effects (setInterval), so we mock timers
vi.useFakeTimers();

// Reset module state between tests by re-importing
let checkRateLimit: typeof import("../rate-limiter").checkRateLimit;
let checkAuthRateLimit: typeof import("../rate-limiter").checkAuthRateLimit;
let checkOrderRateLimit: typeof import("../rate-limiter").checkOrderRateLimit;
let getClientIp: typeof import("../rate-limiter").getClientIp;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../rate-limiter");
  checkRateLimit = mod.checkRateLimit;
  checkAuthRateLimit = mod.checkAuthRateLimit;
  checkOrderRateLimit = mod.checkOrderRateLimit;
  getClientIp = mod.getClientIp;
});

afterEach(() => {
  vi.useRealTimers();
  vi.useFakeTimers();
});

describe("checkRateLimit", () => {
  it("allows first request in a fresh window", async () => {
    const result = await checkRateLimit("ip-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59); // default 60 - 1
    expect(result.retryAfterMs).toBe(0);
  });

  it("tracks multiple requests within the window", async () => {
    await checkRateLimit("ip-2");
    await checkRateLimit("ip-2");
    const r3 = await checkRateLimit("ip-2");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(57); // 60 - 3
  });

  it("blocks request when limit is exceeded", async () => {
    const config = { maxRequests: 3, windowMs: 10_000 };
    await checkRateLimit("ip-3", "test", config);
    await checkRateLimit("ip-3", "test", config);
    await checkRateLimit("ip-3", "test", config);
    const blocked = await checkRateLimit("ip-3", "test", config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets window after expiry", async () => {
    const config = { maxRequests: 2, windowMs: 5_000 };
    await checkRateLimit("ip-4", "test2", config);
    await checkRateLimit("ip-4", "test2", config);
    // Window expires
    vi.advanceTimersByTime(6_000);
    const result = await checkRateLimit("ip-4", "test2", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("uses separate buckets for different identifiers", async () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    await checkRateLimit("ip-a", "b1", config);
    const r = await checkRateLimit("ip-b", "b1", config);
    expect(r.allowed).toBe(true); // Different IP
  });
});

describe("checkAuthRateLimit", () => {
  it("allows up to 5 requests per minute", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkAuthRateLimit(`auth-ip-${Date.now()}-single`);
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks after 5 auth attempts", async () => {
    const ip = "brute-ip";
    for (let i = 0; i < 5; i++) await checkAuthRateLimit(ip);
    const blocked = await checkAuthRateLimit(ip);
    expect(blocked.allowed).toBe(false);
  });
});

describe("checkOrderRateLimit", () => {
  it("allows up to 20 order requests per minute", async () => {
    const ip = "order-ip";
    for (let i = 0; i < 20; i++) await checkOrderRateLimit(ip);
    const blocked = await checkOrderRateLimit(ip);
    expect(blocked.allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return {
      headers: {
        get: (key: string) => headers[key.toLowerCase()] ?? null,
      },
    } as unknown as Request;
  }

  it("extracts first IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace in x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "  9.8.7.6 , 1.1.1.1" });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });
});
