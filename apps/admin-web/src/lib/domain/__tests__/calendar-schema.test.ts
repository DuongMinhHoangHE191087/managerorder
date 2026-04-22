/**
 * Calendar Schema Validation Tests
 * Comprehensive tests for createCalendarEventSchema and updateCalendarEventSchema
 */
import { describe, it, expect } from "vitest";
import { createCalendarEventSchema, updateCalendarEventSchema } from "@/lib/domain/schemas";

/* ──────────────────────────────────────────── */
/* createCalendarEventSchema                    */
/* ──────────────────────────────────────────── */
describe("createCalendarEventSchema", () => {
  /* ---------- Happy path ---------- */
  it("should validate minimal valid input", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Test event",
      date: "2025-01-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Test event");
      expect(result.data.date).toBe("2025-01-15");
      // defaults
      expect(result.data.type).toBe("follow_up");
      expect(result.data.is_done).toBe(false);
      expect(result.data.customerIds).toEqual([]);
      expect(result.data.hasReminder).toBe(false);
    }
  });

  it("should validate full input with all fields", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Meeting with client",
      date: "2025-06-20",
      time: "14:30",
      type: "renewal",
      is_done: true,
      customerIds: ["cust-1", "cust-2"],
      notes: "Important meeting notes",
      hasReminder: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time).toBe("14:30");
      expect(result.data.type).toBe("renewal");
      expect(result.data.is_done).toBe(true);
      expect(result.data.customerIds).toEqual(["cust-1", "cust-2"]);
      expect(result.data.notes).toBe("Important meeting notes");
      expect(result.data.hasReminder).toBe(true);
    }
  });

  /* ---------- All valid event types ---------- */
  it.each([
    "renewal",
    "follow_up",
    "payment_due",
    "payment",
    "reminder",
    "meeting",
    "other",
  ])("should accept type: '%s'", (type) => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "2025-01-01",
      type,
    });
    expect(result.success).toBe(true);
  });

  /* ---------- Invalid type ---------- */
  it.each(["invalid_type", "RENEWAL", "followup", ""])(
    "should reject invalid type: '%s'",
    (type) => {
      const result = createCalendarEventSchema.safeParse({
        title: "Event",
        date: "2025-01-01",
        type,
      });
      expect(result.success).toBe(false);
    }
  );

  /* ---------- Title validation ---------- */
  it("should reject empty title", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "",
      date: "2025-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("title");
    }
  });

  it("should reject missing title", () => {
    const result = createCalendarEventSchema.safeParse({
      date: "2025-01-01",
    });
    expect(result.success).toBe(false);
  });

  /* ---------- Date validation ---------- */
  it("should reject empty date", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("date");
    }
  });

  it("should reject missing date", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
    });
    expect(result.success).toBe(false);
  });

  /* ---------- Optional fields ---------- */
  it("should accept undefined time", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "2025-02-14",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time).toBeUndefined();
    }
  });

  it("should accept empty customerIds array", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "2025-02-14",
      customerIds: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerIds).toEqual([]);
    }
  });

  it("should default type to 'follow_up' when omitted", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "2025-01-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("follow_up");
    }
  });

  it("should default is_done to false when omitted", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "2025-01-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_done).toBe(false);
    }
  });

  it("should default hasReminder to false when omitted", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: "2025-01-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasReminder).toBe(false);
    }
  });

  /* ---------- Type coercion ---------- */
  it("should reject boolean for title", () => {
    const result = createCalendarEventSchema.safeParse({
      title: true,
      date: "2025-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("should reject number for date", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Event",
      date: 12345,
    });
    expect(result.success).toBe(false);
  });
});

/* ──────────────────────────────────────────── */
/* updateCalendarEventSchema                    */
/* ──────────────────────────────────────────── */
describe("updateCalendarEventSchema", () => {
  it("should validate partial update — title only", () => {
    const result = updateCalendarEventSchema.safeParse({
      title: "Updated title",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Updated title");
      expect(result.data.date).toBeUndefined();
      expect(result.data.type).toBeUndefined();
    }
  });

  it("should validate partial update — is_done only", () => {
    const result = updateCalendarEventSchema.safeParse({ is_done: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_done).toBe(true);
    }
  });

  it("should validate full update", () => {
    const result = updateCalendarEventSchema.safeParse({
      title: "Updated",
      date: "2025-12-25",
      time: "09:00",
      type: "meeting",
      is_done: true,
      customerIds: ["c1"],
      notes: "Updated notes",
      hasReminder: true,
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty object (no updates)", () => {
    const result = updateCalendarEventSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it.each(["renewal", "follow_up", "payment_due", "payment", "reminder", "meeting", "other"])(
    "should accept type '%s' in update",
    (type) => {
      const result = updateCalendarEventSchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  );

  it("should reject invalid type in update", () => {
    const result = updateCalendarEventSchema.safeParse({ type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("should reject empty title in update", () => {
    const result = updateCalendarEventSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("should reject empty date in update", () => {
    const result = updateCalendarEventSchema.safeParse({ date: "" });
    expect(result.success).toBe(false);
  });
});
