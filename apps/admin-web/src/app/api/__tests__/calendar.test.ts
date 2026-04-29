/**
 * Calendar API Route — Comprehensive Integration Tests
 * Tests: GET, POST (with all types), DELETE, PATCH
 * Covers: validation, date/time parsing, GCal sync, activity logs, error handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

// --- Mocks ---
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockListCalendarEvents = vi.fn();
const mockCreateCalendarEvent = vi.fn();
const mockUpdateCalendarEvent = vi.fn();
const mockDeleteCalendarEvent = vi.fn();

vi.mock("@/lib/supabase/repositories/calendar.repo", () => ({
  listCalendarEvents: (...args: unknown[]) => mockListCalendarEvents(...args),
  createCalendarEvent: (...args: unknown[]) => mockCreateCalendarEvent(...args),
  updateCalendarEvent: (...args: unknown[]) => mockUpdateCalendarEvent(...args),
  deleteCalendarEvent: (...args: unknown[]) => mockDeleteCalendarEvent(...args),
}));

const mockMapCalendarEventRow = vi.fn((row: unknown) => row);
vi.mock("@/lib/supabase/mappers", () => ({
  mapCalendarEventRow: (row: unknown) => mockMapCalendarEventRow(row),
}));

const mockCreateActivityLog = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: (...args: unknown[]) => mockCreateActivityLog(...args),
}));

const mockSyncEventToGCal = vi.fn().mockResolvedValue({ status: "not_connected" });
vi.mock("@/lib/integrations/google-calendar", () => ({
  syncEventToGCal: (...args: unknown[]) => mockSyncEventToGCal(...args),
}));

// Dynamic import (after mocks)
const { GET, POST, DELETE, PATCH } = await import("@/app/api/calendar/route");

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   GET /api/calendar
   ============================================================ */
describe("GET /api/calendar", () => {
  it("should return empty array when no events", async () => {
    mockListCalendarEvents.mockResolvedValue([]);
    const req = createTestRequest("http://localhost:3000/api/calendar");
    const res = await GET(req, { params: {} } as any);
    const _json = await res.json();
    expect(res.status).toBe(200);
    expect(_json.data).toEqual([]);
    expect(mockListCalendarEvents).toHaveBeenCalledWith(TEST_ACCOUNT_ID);
  });

  it("should return mapped events", async () => {
    const mockRows = [
      { id: "00000000-0000-4000-8000-000000000020", title: "Event 1", due_at: "2025-01-15T14:00:00", type: "renewal" },
      { id: "00000000-0000-4000-8000-000000000021", title: "Event 2", due_at: "2025-01-20T00:00:00", type: "follow_up" },
    ];
    mockListCalendarEvents.mockResolvedValue(mockRows);
    mockMapCalendarEventRow.mockImplementation((r: any) => ({ ...r, mapped: true }));

    const req = createTestRequest("http://localhost:3000/api/calendar");
    const res = await GET(req, { params: {} } as any);
    const _json2 = await res.json();

    expect(_json2.data).toHaveLength(2);
    expect(mockMapCalendarEventRow).toHaveBeenCalledTimes(2);
  });

  it("should propagate repository errors", async () => {
    mockListCalendarEvents.mockRejectedValue(new Error("DB connection failed"));
    const req = createTestRequest("http://localhost:3000/api/calendar");
    const res = await GET(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });
});

/* ============================================================
   POST /api/calendar
   ============================================================ */
describe("POST /api/calendar", () => {
  const validBody = {
    title: "Test Event",
    date: "2025-06-15",
    type: "reminder",
    hasReminder: true,
  };

  const mockCreated = {
    id: "00000000-0000-4000-8000-000000000022",
    title: "Test Event",
    due_at: "2025-06-15T00:00:00",
    type: "reminder",
    is_done: false,
    notes: null,
    has_reminder: true,
    gcal_event_id: null,
  };

  it("should create event with valid data", async () => {
    mockCreateCalendarEvent.mockResolvedValue(mockCreated);
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req, { params: {} } as any);
    const _json3 = await res.json();
    expect(res.status).toBe(201);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(TEST_ACCOUNT_ID, expect.objectContaining({
      title: "Test Event",
      due_at: "2025-06-15T00:00:00",
      type: "reminder",
      has_reminder: true,
    }));
  });

  it("should combine date + time into due_at", async () => {
    mockCreateCalendarEvent.mockResolvedValue({ ...mockCreated, due_at: "2025-06-15T09:30:00" });
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { ...validBody, time: "09:30" },
    });
    await POST(req, { params: {} } as any);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ due_at: "2025-06-15T09:30:00" })
    );
  });

  it("should use T00:00:00 when no time provided", async () => {
    mockCreateCalendarEvent.mockResolvedValue(mockCreated);
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { title: "No time", date: "2025-03-01" },
    });
    await POST(req, { params: {} } as any);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ due_at: "2025-03-01T00:00:00" })
    );
  });

  // Test all valid event types from frontend
  it.each([
    "renewal", "follow_up", "payment_due", "payment", "reminder", "meeting", "other",
  ])("should accept event type: '%s'", async (type) => {
    mockCreateCalendarEvent.mockResolvedValue({ ...mockCreated, type });
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { title: "Typed event", date: "2025-01-01", type },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(201);
  });

  it("should reject invalid event type", async () => {
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { title: "Bad type", date: "2025-01-01", type: "invalid_type" },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject missing title", async () => {
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { date: "2025-01-01" },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject missing date", async () => {
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { title: "No date" },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should pass customerIds to repo", async () => {
    mockCreateCalendarEvent.mockResolvedValue(mockCreated);
    const ids = ["cust-a", "cust-b"];
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: { ...validBody, customerIds: ids },
    });
    await POST(req, { params: {} } as any);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ customer_ids: ids })
    );
  });

  it("should call createActivityLog after creation", async () => {
    mockCreateCalendarEvent.mockResolvedValue(mockCreated);
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: validBody,
    });
    await POST(req, { params: {} } as any);
    // Activity log is fire-and-forget, so it's called but we don't await it
    // We simply check it was triggered
    expect(mockCreateActivityLog).toHaveBeenCalled();
  });

  it("should attempt GCal sync on create", async () => {
    mockCreateCalendarEvent.mockResolvedValue(mockCreated);
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: validBody,
    });
    await POST(req, { params: {} } as any);
    expect(mockSyncEventToGCal).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ id: "00000000-0000-4000-8000-000000000022" }),
      "create"
    );
  });

  it("should update gcal_event_id when GCal returns an ID", async () => {
    mockCreateCalendarEvent.mockResolvedValue(mockCreated);
    mockSyncEventToGCal.mockResolvedValue({ status: "synced", gcalEventId: "gcal-123" });
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "POST",
      body: validBody,
    });
    await POST(req, { params: {} } as any);
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000022", TEST_ACCOUNT_ID, { gcal_event_id: "gcal-123" }
    );
  });
});

/* ============================================================
   DELETE /api/calendar
   ============================================================ */
describe("DELETE /api/calendar", () => {
  it("should require id parameter", async () => {
    const req = createTestRequest("http://localhost:3000/api/calendar", { method: "DELETE" });
    const res = await DELETE(req, { params: {} } as any);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("id is required");
  });

  it("should return 404 if event not found", async () => {
    mockListCalendarEvents.mockResolvedValue([]);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=missing-id", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: {} } as any);
    expect(res.status).toBe(404);
  });

  it("should delete existing event", async () => {
    mockListCalendarEvents.mockResolvedValue([
      { id: "evt-del", title: "To delete", due_at: "2025-01-01", gcal_event_id: null },
    ]);
    mockDeleteCalendarEvent.mockResolvedValue(undefined);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-del", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: {} } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("evt-del", TEST_ACCOUNT_ID);
  });

  it("should sync delete to GCal if gcal_event_id exists", async () => {
    mockListCalendarEvents.mockResolvedValue([
      { id: "evt-gc", title: "GCal event", due_at: "2025-01-01", gcal_event_id: "gcal-abc" },
    ]);
    mockDeleteCalendarEvent.mockResolvedValue(undefined);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-gc", {
      method: "DELETE",
    });
    await DELETE(req, { params: {} } as any);
    expect(mockSyncEventToGCal).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ gcal_event_id: "gcal-abc" }),
      "delete"
    );
  });

  it("should skip GCal sync if no gcal_event_id", async () => {
    mockListCalendarEvents.mockResolvedValue([
      { id: "evt-no-gc", title: "No GCal", due_at: "2025-01-01", gcal_event_id: null },
    ]);
    mockDeleteCalendarEvent.mockResolvedValue(undefined);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-no-gc", {
      method: "DELETE",
    });
    await DELETE(req, { params: {} } as any);
    expect(mockSyncEventToGCal).not.toHaveBeenCalled();
  });

  it("should log activity on delete", async () => {
    mockListCalendarEvents.mockResolvedValue([
      { id: "evt-log", title: "Log me", due_at: "2025-01-01", gcal_event_id: null },
    ]);
    mockDeleteCalendarEvent.mockResolvedValue(undefined);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-log", {
      method: "DELETE",
    });
    await DELETE(req, { params: {} } as any);
    expect(mockCreateActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        action_type: "CALENDAR_EVENT_DELETED",
        details: { event_id: "evt-log" },
      })
    );
  });
});

/* ============================================================
   PATCH /api/calendar
   ============================================================ */
describe("PATCH /api/calendar", () => {
  const mockUpdated = {
    id: "evt-upd",
    title: "Updated title",
    due_at: "2025-07-01T14:00:00",
    type: "meeting",
    is_done: false,
    notes: "Updated",
    has_reminder: true,
    gcal_event_id: null,
  };

  it("should require id parameter", async () => {
    const req = createTestRequest("http://localhost:3000/api/calendar", {
      method: "PATCH",
      body: { title: "Updated" },
    });
    const res = await PATCH(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should update event with valid data", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(mockUpdated);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { title: "Updated title" },
    });
    const res = await PATCH(req, { params: {} } as any);
    expect(res.status).toBe(200);
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "evt-upd",
      TEST_ACCOUNT_ID,
      expect.objectContaining({ title: "Updated title" })
    );
  });

  it("should toggle is_done", async () => {
    mockUpdateCalendarEvent.mockResolvedValue({ ...mockUpdated, is_done: true });
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { is_done: true },
    });
    await PATCH(req, { params: {} } as any);
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "evt-upd",
      TEST_ACCOUNT_ID,
      expect.objectContaining({ is_done: true })
    );
  });

  it("should rebuild due_at from date + time", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(mockUpdated);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { date: "2025-07-01", time: "14:00" },
    });
    await PATCH(req, { params: {} } as any);
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "evt-upd",
      TEST_ACCOUNT_ID,
      expect.objectContaining({ due_at: "2025-07-01T14:00:00" })
    );
  });

  it("should use T00:00:00 when date given without time", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(mockUpdated);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { date: "2025-07-01" },
    });
    await PATCH(req, { params: {} } as any);
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "evt-upd",
      TEST_ACCOUNT_ID,
      expect.objectContaining({ due_at: "2025-07-01T00:00:00" })
    );
  });

  it("should reject invalid type in update", async () => {
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { type: "invalid_type" },
    });
    const res = await PATCH(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should log activity on update", async () => {
    mockUpdateCalendarEvent.mockResolvedValue(mockUpdated);
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { title: "Updated" },
    });
    await PATCH(req, { params: {} } as any);
    expect(mockCreateActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "CALENDAR_EVENT_UPDATED",
        details: expect.objectContaining({ event_id: "evt-upd" }),
      })
    );
  });

  it("should sync existing GCal event on update", async () => {
    mockUpdateCalendarEvent.mockResolvedValue({ ...mockUpdated, gcal_event_id: "gcal-exist" });
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { title: "Synced update" },
    });
    await PATCH(req, { params: {} } as any);
    expect(mockSyncEventToGCal).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ gcal_event_id: "gcal-exist" }),
      "update"
    );
  });

  it("should create new GCal event if none exists during update", async () => {
    mockUpdateCalendarEvent.mockResolvedValue({ ...mockUpdated, gcal_event_id: null });
    mockSyncEventToGCal.mockResolvedValue({ status: "synced", gcalEventId: "new-gcal-id" });
    const req = createTestRequest("http://localhost:3000/api/calendar?id=evt-upd", {
      method: "PATCH",
      body: { title: "New GCal" },
    });
    await PATCH(req, { params: {} } as any);
    expect(mockSyncEventToGCal).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ gcal_event_id: null }),
      "create"
    );
  });
});
