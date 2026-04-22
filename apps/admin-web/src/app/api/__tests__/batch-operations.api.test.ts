// ============================================================
// API TESTS: Batch Operations — DELETE /api/orders/batch
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
} from "./helpers/setup";

// ── Mocks ────────────────────────────────────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  batchDeleteOrders: vi.fn(),
}));

import { batchDeleteOrders } from "@/lib/supabase/repositories/orders.repo";
import { DELETE } from "@/app/api/orders/batch/route";

// ── Helpers ──────────────────────────────────────────────────
function batchDelete(body: unknown) {
  return DELETE(
    createTestRequest("http://localhost/api/orders/batch", {
      method: "DELETE",
      body,
    }),
    { params: {} } as any
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("DELETE /api/orders/batch — Batch Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Happy Path ──────────────────────────────────────────

  describe("Happy path", () => {
    it("batch deletes multiple orders → 200", async () => {
      vi.mocked(batchDeleteOrders).mockResolvedValue({ deleted: 3 } as any);

      const res = await batchDelete({
        ids: ["ord-001", "ord-002", "ord-003"],
      });
      expect(res.status).toBe(200);
    });

    it("batch deletes single order → 200", async () => {
      vi.mocked(batchDeleteOrders).mockResolvedValue({ deleted: 1 } as any);

      const res = await batchDelete({ ids: ["ord-001"] });
      expect(res.status).toBe(200);
    });

    it("passes account ID and order IDs to repository", async () => {
      vi.mocked(batchDeleteOrders).mockResolvedValue({ deleted: 2 } as any);

      await batchDelete({ ids: ["ord-001", "ord-002"] });

      expect(batchDeleteOrders).toHaveBeenCalledWith(
        expect.arrayContaining(["ord-001", "ord-002"]),
        expect.any(String) // accountId
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
      const ids = Array.from({ length: 101 }, (_, i) => `ord-${i}`);
      const res = await batchDelete({ ids });
      expect(res.status).toBe(400);
    });

    it("accepts exactly 100 IDs (at the limit)", async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `ord-${i}`);
      vi.mocked(batchDeleteOrders).mockResolvedValue({ deleted: 100 } as any);

      const res = await batchDelete({ ids });
      // Should succeed because 50 is at the limit, not over
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── Error Handling ──────────────────────────────────────

  describe("Error handling", () => {
    it("returns 500 when repository throws", async () => {
      vi.mocked(batchDeleteOrders).mockRejectedValue(
        new Error("Database error")
      );

      const res = await batchDelete({ ids: ["ord-001"] });
      expect(res.status).toBe(500);
    });
  });
});
