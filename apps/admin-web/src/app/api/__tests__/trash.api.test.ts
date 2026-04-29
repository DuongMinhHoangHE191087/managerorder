import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
  TEST_ACCOUNT_ID,
} from "@/app/api/__tests__/helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockCountDeletedItems = vi.fn();
const mockListDeletedItems = vi.fn();
const mockRestoreItems = vi.fn();
const mockPurgeItems = vi.fn();

vi.mock("@/lib/supabase/repositories/trash.repo", () => ({
  countDeletedItems: (...args: unknown[]) => mockCountDeletedItems(...args),
  listDeletedItems: (...args: unknown[]) => mockListDeletedItems(...args),
  restoreItems: (...args: unknown[]) => mockRestoreItems(...args),
  purgeItems: (...args: unknown[]) => mockPurgeItems(...args),
}));

const { GET } = await import("@/app/api/trash/route");
const { POST: restorePOST } = await import("@/app/api/trash/restore/route");
const { POST: purgePOST } = await import("@/app/api/trash/purge/route");

describe("trash api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overview counts using the lightweight count query", async () => {
    mockCountDeletedItems.mockResolvedValue(3);

    const request = createTestRequest("http://localhost:3000/api/trash");
    const response = await GET(request, { params: {} } as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.customers).toBe(3);
    expect(mockCountDeletedItems).toHaveBeenCalledWith(TEST_ACCOUNT_ID, "customers");
    expect(mockCountDeletedItems).toHaveBeenCalledWith(TEST_ACCOUNT_ID, "short_links");
    expect(mockCountDeletedItems).toHaveBeenCalledTimes(7);
  });

  it("returns deleted short links for the requested type", async () => {
    mockListDeletedItems.mockResolvedValue({
      data: [{ id: "550e8400-e29b-41d4-a716-446655440001", slug: "spotify-sale" }],
      count: 1,
    });

    const request = createTestRequest("http://localhost:3000/api/trash?type=short_links");
    const response = await GET(request, { params: {} } as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.type).toBe("short_links");
    expect(json.count).toBe(1);
    expect(json.data[0].slug).toBe("spotify-sale");
    expect(mockListDeletedItems).toHaveBeenCalledWith(TEST_ACCOUNT_ID, "short_links");
  });

  it("accepts short_links in restore route", async () => {
    mockRestoreItems.mockResolvedValue(1);

    const request = createTestRequest("http://localhost:3000/api/trash/restore", {
      method: "POST",
      body: {
        type: "short_links",
        ids: ["550e8400-e29b-41d4-a716-446655440001"],
      },
    });
    const response = await restorePOST(request, { params: {} } as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.restoredCount).toBe(1);
    expect(mockRestoreItems).toHaveBeenCalledWith(
      ["550e8400-e29b-41d4-a716-446655440001"],
      TEST_ACCOUNT_ID,
      "short_links",
    );
  });

  it("accepts short_links in purge route", async () => {
    mockPurgeItems.mockResolvedValue(1);

    const request = createTestRequest("http://localhost:3000/api/trash/purge", {
      method: "POST",
      body: {
        type: "short_links",
        ids: ["550e8400-e29b-41d4-a716-446655440001"],
      },
    });
    const response = await purgePOST(request, { params: {} } as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.purgedCount).toBe(1);
    expect(mockPurgeItems).toHaveBeenCalledWith(
      ["550e8400-e29b-41d4-a716-446655440001"],
      TEST_ACCOUNT_ID,
      "short_links",
    );
  });
});
