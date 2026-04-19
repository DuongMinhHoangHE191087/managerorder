import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest, mockRBAC } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/lib/supabase/repositories/providers.repo", () => ({
  listProviders: vi.fn(),
  createProvider: vi.fn(),
}));
vi.mock("@/lib/supabase/mappers", () => ({
  mapProviderRow: vi.fn((row: Record<string, unknown>) => ({
    id: row.id, name: row.name, tier: row.tier || "regular",
    contacts: row.contacts || [], reliabilityScore: row.reliability_score || 100,
  })),
}));

import { listProviders, createProvider } from "@/lib/supabase/repositories/providers.repo";
import { GET, POST } from "@/app/api/providers/route";

describe("GET /api/providers", () => {
  it("returns mapped provider list", async () => {
    vi.mocked(listProviders).mockResolvedValue([{ id: "pv1", name: "Provider A" } as any]);
    const res = await GET(createTestRequest("http://localhost/api/providers"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data[0].name).toBe("Provider A");
  });
});

describe("POST /api/providers", () => {
  beforeEach(() => {
    vi.mocked(createProvider).mockResolvedValue({
      id: "new-pv1", name: "New", tier: "regular",
      contacts: [], reliability_score: 100,
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
  });

  it("rejects missing name", async () => {
    const res = await POST(createTestRequest("http://localhost/api/providers", {
      method: "POST", body: {},
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});
