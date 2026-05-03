import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRecoverableDetail } from "../recoverable-detail";

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

describe("fetchRecoverableDetail", () => {
  it("retries with include_deleted after a 404 and marks the result as soft deleted", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Not found" } }, 404))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "product-1",
          name: "Deleted product",
          deleted_at: "2026-05-02T10:00:00.000Z",
        }),
      );

    const result = await fetchRecoverableDetail<{ id: string; name: string }>(
      "/api/products/product-1",
    );

    expect(result).toMatchObject({
      id: "product-1",
      name: "Deleted product",
      deleted_at: "2026-05-02T10:00:00.000Z",
      softDeleted: true,
      data: {
        id: "product-1",
        name: "Deleted product",
        deleted_at: "2026-05-02T10:00:00.000Z",
      },
    });
    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/products/product-1", expect.any(Object));
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/products/product-1?include_deleted=1",
      expect.any(Object),
    );
  });

  it("uses include_deleted on the initial request when requested explicitly", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "product-2",
        name: "Trash view product",
        deleted_at: "2026-05-02T10:00:00.000Z",
      }),
    );

    const result = await fetchRecoverableDetail<{ id: string; name: string }>(
      "/api/products/product-2",
      true,
    );

    expect(result.softDeleted).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/products/product-2?include_deleted=1",
      expect.any(Object),
    );
  });
});
