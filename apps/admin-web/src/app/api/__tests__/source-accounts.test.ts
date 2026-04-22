import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest, mockRBAC } from "./helpers/setup";

const mockListSourceAccountsForAccount = vi.fn();
const mockCreateSourceAccountForAccount = vi.fn();
const mockGetDecryptedSourceAccountSecretsForAccount = vi.fn();
const mockScanSmartMatchesForAccount = vi.fn();
const mockSearchUnconnectedSourceAccountsForAccount = vi.fn();

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/domains/source-accounts", () => ({
  listSourceAccountsForAccount: (...args: unknown[]) => mockListSourceAccountsForAccount(...args),
  createSourceAccountForAccount: (...args: unknown[]) => mockCreateSourceAccountForAccount(...args),
  getDecryptedSourceAccountSecretsForAccount: (...args: unknown[]) =>
    mockGetDecryptedSourceAccountSecretsForAccount(...args),
  scanSmartMatchesForAccount: (...args: unknown[]) => mockScanSmartMatchesForAccount(...args),
  searchUnconnectedSourceAccountsForAccount: (...args: unknown[]) =>
    mockSearchUnconnectedSourceAccountsForAccount(...args),
}));

import { GET, POST } from "@/app/api/source-accounts/route";
import { GET as GET_DECRYPT } from "@/app/api/source-accounts/[id]/decrypt/route";
import { GET as GET_SMART_MATCH } from "@/app/api/source-accounts/smart-match/route";
import { GET as GET_CONNECTION_SEARCH } from "@/app/api/source-accounts/[id]/connections/search/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/source-accounts", () => {
  beforeEach(() => {
    mockListSourceAccountsForAccount.mockResolvedValue([
      { id: "sa1", email: "test@netflix.com", provider: "netflix", maxSlots: 5, usedSlots: 3 } as any,
    ]);
  });

  it("returns source accounts", async () => {
    const res = await GET(createTestRequest("http://localhost/api/source-accounts"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].email).toBe("test@netflix.com");
  });
});

describe("POST /api/source-accounts", () => {
  beforeEach(() => {
    mockCreateSourceAccountForAccount.mockResolvedValue({
      id: "new-sa1", email: "new@netflix.com", provider: "netflix",
      maxSlots: 5, usedSlots: 0,
    } as any);
  });

  it("creates source account and returns 201", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST",
      body: { email: "new@netflix.com", provider: "netflix", expiresAt: "2025-12-31T00:00:00Z" },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
  });

  it("rejects missing email", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST",
      body: { provider: "netflix" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("rejects missing provider", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST",
      body: { email: "test@test.com" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("passes optional fields to the domain service", async () => {
    const res = await POST(createTestRequest("http://localhost/api/source-accounts", {
      method: "POST",
      body: { email: "min@test.com", provider: "spotify", expiresAt: "2025-12-31T00:00:00Z" },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
    expect(mockCreateSourceAccountForAccount).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxSlots: 1, productIds: [] }),
      expect.any(String),
    );
  });
});

describe("GET /api/source-accounts/:id/decrypt", () => {
  it("returns normalized decrypted secrets", async () => {
    mockGetDecryptedSourceAccountSecretsForAccount.mockResolvedValue({
      id: "sa-1",
      email: "storage@example.com",
      password: "plain-password",
      credentials: [
        { id: "sa-1-cred-1", type: "2fa", value: "123456", label: "OTP" },
      ],
    });

    const res = await GET_DECRYPT(
      createTestRequest("http://localhost/api/source-accounts/sa-1/decrypt"),
      { params: Promise.resolve({ id: "sa-1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.password).toBe("plain-password");
    expect(body.data.credentials[0].id).toBe("sa-1-cred-1");
  });
});

describe("GET /api/source-accounts/smart-match", () => {
  it("returns smart match suggestions", async () => {
    mockScanSmartMatchesForAccount.mockResolvedValue([
      {
        sourceAccountId: "sa-1",
        sourceAccountEmail: "storage@example.com",
        orderItemId: "item-1",
        orderItemQuantity: 1,
        productNameSnapshot: "Netflix",
        customerName: "Customer A",
        orderId: "order-1",
        matchedField: "reserved_nick",
        matchedValue: "nick-a",
        confidence: 100,
      },
    ]);

    const res = await GET_SMART_MATCH(
      createTestRequest("http://localhost/api/source-accounts/smart-match"),
      { params: {} } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].matchedField).toBe("reserved_nick");
  });
});

describe("GET /api/source-accounts/:id/connections/search", () => {
  it("returns search results for a query", async () => {
    mockSearchUnconnectedSourceAccountsForAccount.mockResolvedValue([
      {
        id: "item-1",
        product_id: "prod-1",
        product_name_snapshot: "Netflix",
        quantity: 1,
        notes: "reserved nick",
        customer_nick_used: "nick-a",
        assigned_source_account_id: null,
        order_id: "order-1",
      },
    ]);

    const res = await GET_CONNECTION_SEARCH(
      createTestRequest("http://localhost/api/source-accounts/sa-1/connections/search?q=nick"),
      { params: Promise.resolve({ id: "sa-1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(mockSearchUnconnectedSourceAccountsForAccount).toHaveBeenCalledWith(
      "sa-1",
      expect.any(String),
      "nick",
    );
  });
});
