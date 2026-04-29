import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetcher } from "../fetcher";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe("fetcher", () => {
  it("returns payload.data when present", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [1, 2, 3] }));
    const result = await fetcher<number[]>("/api/test");
    expect(result).toEqual([1, 2, 3]);
  });

  it("returns full payload when meta is present", async () => {
    const payload = { data: [1], meta: { total: 10 } };
    mockFetch.mockResolvedValue(jsonResponse(payload));
    const result = await fetcher("/api/test");
    expect(result).toEqual(payload);
  });

  it("returns raw payload when no data/meta fields", async () => {
    const payload = { items: ["a", "b"] };
    mockFetch.mockResolvedValue(jsonResponse(payload));
    const result = await fetcher("/api/test");
    expect(result).toEqual(payload);
  });

  it("throws on non-ok response with error message", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { message: "Not found" } }, 404)
    );
    await expect(fetcher("/api/missing")).rejects.toThrow("Not found");
  });

  it("throws on non-ok response with string error", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "Forbidden" }, 403)
    );
    await expect(fetcher("/api/forbidden")).rejects.toThrow("Forbidden");
  });

  it("throws generic message when no error detail", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 500));
    await expect(fetcher("/api/fail")).rejects.toThrow(
      "Lỗi máy chủ nội bộ"
    );
  });

  it("throws fallback validation message for non-json client errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("bad request"),
    });

    await expect(fetcher("/api/fail")).rejects.toThrow("bad request");
  });

  it("sends cache headers without forcing content type on bodyless requests", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: null }));
    await fetcher("/api/test");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.headers["Cache-Control"]).toBe(
      "no-cache, no-store, must-revalidate"
    );
  });

  it("sets json content type when a request body is present", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: null }));
    await fetcher("/api/test", {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
    });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("merges custom headers", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: null }));
    await fetcher("/api/test", {
      headers: { Authorization: "Bearer abc" },
    });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer abc");
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("uses no-store cache by default", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: null }));
    await fetcher("/api/test");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.cache).toBe("no-store");
  });
});
