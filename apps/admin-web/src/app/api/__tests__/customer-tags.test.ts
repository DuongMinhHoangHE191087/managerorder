import { describe, it, expect, vi } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/supabase/repositories/customer-tags.repo", () => ({
  listCustomerTags: vi.fn(),
  createCustomerTag: vi.fn(),
  assignTagsToCustomer: vi.fn(),
  removeTagsFromCustomer: vi.fn(),
  batchAssignTag: vi.fn(),
}));

import {
  listCustomerTags, createCustomerTag,
  assignTagsToCustomer, removeTagsFromCustomer, batchAssignTag,
} from "@/lib/supabase/repositories/customer-tags.repo";
import { GET, POST } from "@/app/api/customer-tags/route";

const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const uuid2 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";

describe("GET /api/customer-tags", () => {
  it("returns tag list", async () => {
    vi.mocked(listCustomerTags).mockResolvedValue([{ id: "t1", name: "VIP" }] as any);
    const res = await GET(createTestRequest("http://localhost/api/customer-tags"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/customer-tags", () => {
  it("creates tag (action=create)", async () => {
    vi.mocked(createCustomerTag).mockResolvedValue({ id: "new", name: "Premium" } as any);
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST", body: { action: "create", name: "Premium" },
    }), { params: {} } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Premium");
  });

  it("assigns tags (action=assign)", async () => {
    vi.mocked(assignTagsToCustomer).mockResolvedValue(2);
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST",
      body: { action: "assign", customerId: uuid, tagIds: [uuid, uuid2] },
    }), { params: {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.assignedCount).toBe(2);
  });

  it("removes tags (action=remove)", async () => {
    vi.mocked(removeTagsFromCustomer).mockResolvedValue(undefined);
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST",
      body: { action: "remove", customerId: uuid, tagIds: [uuid2] },
    }), { params: {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  it("batch assigns (action=batch_assign)", async () => {
    vi.mocked(batchAssignTag).mockResolvedValue(3);
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST",
      body: { action: "batch_assign", customerIds: [uuid, uuid2], tagId: uuid },
    }), { params: {} } as any);
    const body = await res.json();
    expect(body.data.assignedCount).toBe(3);
  });

  it("rejects invalid action", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST", body: { action: "invalid" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("rejects empty name on create", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST", body: { action: "create", name: "" },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

describe("Customer Tags — edge cases", () => {
  it("returns 500 when listCustomerTags throws", async () => {
    vi.mocked(listCustomerTags).mockRejectedValue(new Error("DB error"));
    const res = await GET(createTestRequest("http://localhost/api/customer-tags"), { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("returns 500 when createCustomerTag throws", async () => {
    vi.mocked(createCustomerTag).mockRejectedValue(new Error("Duplicate name"));
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST", body: { action: "create", name: "DuplicateTag" },
    }), { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("rejects assign without customerId", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST",
      body: { action: "assign", tagIds: [uuid] },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("rejects assign without tagIds", async () => {
    const res = await POST(createTestRequest("http://localhost/api/customer-tags", {
      method: "POST",
      body: { action: "assign", customerId: uuid },
    }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});
