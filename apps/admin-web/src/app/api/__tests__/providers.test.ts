import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest, mockRBAC } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/domains/providers", () => ({
  listProvidersForAccount: vi.fn(),
  createProviderForAccount: vi.fn(),
  getProviderForAccount: vi.fn(),
  updateProviderForAccount: vi.fn(),
  deleteProviderForAccount: vi.fn(),
}));

import {
  createProviderForAccount,
  deleteProviderForAccount,
  getProviderForAccount,
  listProvidersForAccount,
  updateProviderForAccount,
} from "@/domains/providers";
import { GET, POST } from "@/app/api/providers/route";
import {
  DELETE,
  GET as GET_DETAIL,
  PUT,
} from "@/app/api/providers/[id]/route";

describe("GET /api/providers", () => {
  it("returns mapped provider list", async () => {
    vi.mocked(listProvidersForAccount).mockResolvedValue([{ id: "pv1", name: "Provider A" } as any]);
    const res = await GET(createTestRequest("http://localhost/api/providers"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data[0].name).toBe("Provider A");
  });
});

describe("POST /api/providers", () => {
  beforeEach(() => {
    vi.mocked(createProviderForAccount).mockResolvedValue({
      id: "new-pv1", name: "New", tier: "regular",
      contacts: [], reliabilityScore: 100,
    } as any);
  });

  it("creates provider → 201", async () => {
    const res = await POST(createTestRequest("http://localhost/api/providers", {
      method: "POST",
      body: { name: "New", contacts: [{ type: "email", value: "t@t.com", isPrimary: true }] },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("New");
    expect(createProviderForAccount).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "New",
        reliabilityScore: 100,
      }),
      expect.any(String),
    );
  });

  it("rejects missing name", async () => {
    const res = await POST(createTestRequest("http://localhost/api/providers", {
      method: "POST", body: {},
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/providers/[id]", () => {
  it("returns provider detail", async () => {
    vi.mocked(getProviderForAccount).mockResolvedValue({
      id: "pv1",
      name: "Provider A",
      contacts: [],
      tier: "regular",
      reliabilityScore: 90,
      createdAt: "2026-04-15T00:00:00.000Z",
    } as any);

    const res = await GET_DETAIL(
      createTestRequest("http://localhost/api/providers/pv1"),
      { params: Promise.resolve({ id: "pv1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("pv1");
  });
});

describe("PUT /api/providers/[id]", () => {
  it("updates a provider", async () => {
    vi.mocked(updateProviderForAccount).mockResolvedValue({
      id: "pv1",
      name: "Provider Updated",
      contacts: [],
      tier: "vip",
      reliabilityScore: 95,
      createdAt: "2026-04-15T00:00:00.000Z",
    } as any);

    const res = await PUT(
      createTestRequest("http://localhost/api/providers/pv1", {
        method: "PUT",
        body: {
          name: "Provider Updated",
          reliabilityScore: 95,
        },
      }),
      { params: Promise.resolve({ id: "pv1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Provider Updated");
    expect(updateProviderForAccount).toHaveBeenCalledWith(
      "pv1",
      expect.any(String),
      expect.objectContaining({
        name: "Provider Updated",
        reliabilityScore: 95,
      }),
      expect.any(String),
    );
  });

  it("rejects empty provider updates", async () => {
    const res = await PUT(
      createTestRequest("http://localhost/api/providers/pv1", {
        method: "PUT",
        body: {},
      }),
      { params: Promise.resolve({ id: "pv1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/providers/[id]", () => {
  it("deletes a provider", async () => {
    vi.mocked(deleteProviderForAccount).mockResolvedValue(undefined as any);

    const res = await DELETE(
      createTestRequest("http://localhost/api/providers/pv1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "pv1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(deleteProviderForAccount).toHaveBeenCalledWith("pv1", expect.any(String), expect.any(String));
  });
});
