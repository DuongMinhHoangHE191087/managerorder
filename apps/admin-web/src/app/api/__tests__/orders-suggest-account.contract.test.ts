import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockListSourceAccounts = vi.fn();
const mockMapRowToSourceAccount = vi.fn();
const mockSuggestTopAccounts = vi.fn();
const emptyContext = { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> };

vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: (...args: unknown[]) => mockListSourceAccounts(...args),
}));

vi.mock("@/lib/mappers/source-account.mapper", () => ({
  mapRowToSourceAccount: (...args: unknown[]) => mockMapRowToSourceAccount(...args),
}));

vi.mock("@/lib/domain/allocation-engine", () => ({
  suggestTopAccounts: (...args: unknown[]) => mockSuggestTopAccounts(...args),
}));

import { POST } from "@/app/api/orders/suggest-account/route";

describe("POST /api/orders/suggest-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when productId is omitted", async () => {
    const response = await POST(
      createTestRequest("http://localhost/api/orders/suggest-account", {
        method: "POST",
        body: {
          quantity: 2,
        },
      }),
      emptyContext,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "productId is required",
    });
    expect(mockListSourceAccounts).not.toHaveBeenCalled();
  });

  it("maps account rows and returns ranked suggestions for the requested product", async () => {
    const rawRows = [
      { id: "00000000-0000-4000-8000-000000000066", primary_email: "slot-a@example.com" },
      { id: "00000000-0000-4000-8000-000000000067", primary_email: "slot-b@example.com" },
    ];
    const mappedAccounts = [
      {
        id: "00000000-0000-4000-8000-000000000066",
        email: "slot-a@example.com",
        productIds: ["product-netflix"],
        maxSlots: 5,
        usedSlots: 4,
        expiresAt: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000067",
        email: "slot-b@example.com",
        productIds: ["product-netflix"],
        maxSlots: 5,
        usedSlots: 3,
        expiresAt: "2026-05-10T00:00:00.000Z",
      },
    ];
    const suggestions = [
      {
        sourceAccountId: "00000000-0000-4000-8000-000000000066",
        email: "slot-a@example.com",
        score: 812,
        reason: "Gan day (1 slot trong)",
        availableSlots: 1,
        expiresAt: "2026-05-01T00:00:00.000Z",
        daysLeft: 9,
      },
    ];

    mockListSourceAccounts.mockResolvedValue(rawRows);
    mockMapRowToSourceAccount
      .mockReturnValueOnce(mappedAccounts[0])
      .mockReturnValueOnce(mappedAccounts[1]);
    mockSuggestTopAccounts.mockReturnValue(suggestions);

    const response = await POST(
      createTestRequest("http://localhost/api/orders/suggest-account", {
        method: "POST",
        body: {
          productId: "product-netflix",
          quantity: 2,
          customerNick: "slot-a@example.com",
        },
      }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect(mockListSourceAccounts).toHaveBeenCalledWith(TEST_ACCOUNT_ID);
    expect(mockMapRowToSourceAccount).toHaveBeenCalledTimes(2);
    expect(mockSuggestTopAccounts).toHaveBeenCalledWith(
      "product-netflix",
      2,
      mappedAccounts,
      "slot-a@example.com",
      3,
    );
    expect(await response.json()).toEqual({ data: suggestions });
  });
});
