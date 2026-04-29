// ============================================================
// API TESTS: Batch Operations — POST /api/orders/batch
//
// Tests batch deletion endpoint:
//  - Valid batch delete (multiple IDs)
//  - Empty array rejection
//  - Exceeding max limit
//  - Invalid ID format handling
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  mockRBAC,
  TEST_USER_EMAIL,
} from "./helpers/setup";

// ── Mocks ────────────────────────────────────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/lib/services/order-deletion.service", () => ({
  batchDeleteOrdersWithAudit: vi.fn(),
}));

import { batchDeleteOrdersWithAudit } from "@/lib/services/order-deletion.service";
import { POST } from "@/app/api/orders/batch/route";

// ── Helpers ──────────────────────────────────────────────────
function batchDelete(body: unknown) {
  return POST(
    createTestRequest("http://localhost/api/orders/batch", {
      method: "POST",
      body,
    }),
    { params: {} } as any
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/orders/batch — Batch Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Happy Path ──────────────────────────────────────────

  describe("Happy path", () => {
    it("batch deletes multiple orders → 200", async () => {
      vi.mocked(batchDeleteOrdersWithAudit).mockResolvedValue(3);

      const res = await batchDelete({
        ids: ["00000000-0000-4000-8000-00000000001b", "00000000-0000-4000-8000-00000000001c", "00000000-0000-4000-8000-00000000001d"],
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.deleted).toBe(3);
    });

    it("batch deletes single order → 200", async () => {
      vi.mocked(batchDeleteOrdersWithAudit).mockResolvedValue(1);

      const res = await batchDelete({ ids: ["00000000-0000-4000-8000-00000000001b"] });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.deleted).toBe(1);
    });

    it("passes account ID and order IDs to repository", async () => {
      vi.mocked(batchDeleteOrdersWithAudit).mockResolvedValue(2);

      await batchDelete({ ids: ["00000000-0000-4000-8000-00000000001b", "00000000-0000-4000-8000-00000000001c"] });

      expect(batchDeleteOrdersWithAudit).toHaveBeenCalledWith(
        expect.arrayContaining(["00000000-0000-4000-8000-00000000001b", "00000000-0000-4000-8000-00000000001c"]),
        expect.any(String),
        expect.objectContaining({
          email: TEST_USER_EMAIL,
          displayName: "Test User",
        }),
      );
    });
  });

  // ─── Validation ──────────────────────────────────────────

  describe("Validation", () => {
    it("rejects empty ids array → 400", async () => {
      const res = await batchDelete({ ids: [] });
      expect(res.status).toBe(400);
    });

    it("rejects missing ids field → 400", async () => {
      const res = await batchDelete({});
      expect(res.status).toBe(400);
    });

    it("rejects exceeding max batch limit (100+) → 400", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
      const res = await batchDelete({ ids });
      expect(res.status).toBe(400);
    });

    it("accepts exactly 100 IDs (at the limit)", async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
      vi.mocked(batchDeleteOrdersWithAudit).mockResolvedValue(100);

      const res = await batchDelete({ ids });
      expect(res.status).toBe(200);
    });
  });

  // ─── Error Handling ──────────────────────────────────────

  describe("Error handling", () => {
    it("returns 500 when repository throws", async () => {
      vi.mocked(batchDeleteOrdersWithAudit).mockRejectedValue(
        new Error("Database error")
      );

      const res = await batchDelete({ ids: ["00000000-0000-4000-8000-00000000001b"] });
      expect(res.status).toBe(500);
    });
  });
});
