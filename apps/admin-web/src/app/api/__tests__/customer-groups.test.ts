import { describe, it, expect, vi } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/supabase/repositories/customer-groups.repo", () => ({
  listCustomerGroups: vi.fn(),
  createCustomerGroup: vi.fn(),
  assignCustomersToGroup: vi.fn(),
  removeCustomersFromGroup: vi.fn(),
}));

import {
  listCustomerGroups, createCustomerGroup,
  assignCustomersToGroup, removeCustomersFromGroup,
} from "@/lib/supabase/repositories/customer-groups.repo";
import { GET, POST } from "@/app/api/customer-groups/route";

const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const uuid2 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";

describe("GET /api/customer-groups", () => {
  it("returns group list", async () => {
    vi.mocked(listCustomerGroups).mockResolvedValue([{ id: "g1", name: "Gold" }] as any);
    const res = await GET(createTestRequest("http://localhost/api/customer-groups"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/customer-groups", () => {
  it("creates group (action=create)", async () => {
    vi.mocked(createCustomerGroup).mockResolvedValue({ id: "new", name: "Silver" } as any);
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST", body: { action: "create", name: "Silver" },
    }), { params: {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("Silver");
  });

  it("assigns customers (action=assign)", async () => {
    vi.mocked(assignCustomersToGroup).mockResolvedValue(2);
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST",
      body: { action: "assign", groupId: uuid, customerIds: [uuid, uuid2] },
    }), { params: {} } as any);
    const body = await res.json();
    expect(body.data.updatedCount).toBe(2);
  });

  it("removes customers (action=remove)", async () => {
    vi.mocked(removeCustomersFromGroup).mockResolvedValue(1);
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST",
      body: { action: "remove", customerIds: [uuid] },
    }), { params: {} } as any);
    const body = await res.json();
    expect(body.data.updatedCount).toBe(1);
  });

  it("rejects invalid action", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST", body: { action: "delete" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("rejects empty name on create", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST", body: { action: "create", name: "" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

describe("Customer Groups — edge cases", () => {
  it("returns 500 when listCustomerGroups throws", async () => {
    vi.mocked(listCustomerGroups).mockRejectedValue(new Error("DB error"));
    const res = await GET(createTestRequest("http://localhost/api/customer-groups"), { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("returns 500 when createCustomerGroup throws", async () => {
    vi.mocked(createCustomerGroup).mockRejectedValue(new Error("Duplicate"));
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST", body: { action: "create", name: "DupGroup" },
    }), { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("returns empty list when no groups exist", async () => {
    vi.mocked(listCustomerGroups).mockResolvedValue([]);
    const res = await GET(createTestRequest("http://localhost/api/customer-groups"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("rejects assign without groupId", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-groups", {
      method: "POST",
      body: { action: "assign", customerIds: [uuid] },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});
