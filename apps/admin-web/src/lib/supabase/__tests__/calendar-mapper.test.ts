/**
 * Calendar Event Mapper — Comprehensive Unit Tests
 * Tests: mapCalendarEventRow for all fields, edge cases, customer enrichment
 */
import { describe, it, expect } from "vitest";
import { mapCalendarEventRow } from "@/lib/supabase/mappers";

describe("mapCalendarEventRow", () => {
  /* ─── Basic field mapping ─────────────────────── */
  it("should map basic fields from DB row", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000020",
      title: "Test Event",
      due_at: "2025-06-15T14:30:00",
      type: "renewal",
      is_done: false,
      has_reminder: true,
      notes: "Some notes",
      customer_ids: ["00000000-0000-4000-8000-000000000005"],
      customer_id: "00000000-0000-4000-8000-000000000005",
      gcal_event_id: "gcal-abc",
      _customers: [],
    };

    const result = mapCalendarEventRow(row);

    expect(result.id).toBe("00000000-0000-4000-8000-000000000020");
    expect(result.title).toBe("Test Event");
    expect(result.date).toBe("2025-06-15");
    expect(result.time).toBe("14:30");
    expect(result.type).toBe("renewal");
    expect(result.isDone).toBe(false);
    expect(result.hasReminder).toBe(true);
    expect(result.notes).toBe("Some notes");
    expect(result.customerIds).toEqual(["00000000-0000-4000-8000-000000000005"]);
    expect(result.gcalEventId).toBe("gcal-abc");
  });

  /* ─── Date + Time parsing ─────────────────────── */
  it("should omit time when due_at is at midnight (00:00)", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000021",
      title: "All-day event",
      due_at: "2025-01-20T00:00:00",
      type: "follow_up",
      is_done: false,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.date).toBe("2025-01-20");
    expect(result.time).toBeUndefined();
  });

  it("should extract time from non-midnight due_at", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000139",
      title: "Timed event",
      due_at: "2025-03-10T09:15:00",
      type: "meeting",
      is_done: false,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.time).toBe("09:15");
  });

  it("should handle date-only due_at (10 characters)", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000013a",
      title: "Date only",
      due_at: "2025-04-01",
      type: "other",
      is_done: false,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.date).toBe("2025-04-01");
    expect(result.time).toBeUndefined();
  });

  /* ─── Customer enrichment ─────────────────────── */
  it("should map enriched _customers array", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000013b",
      title: "With customers",
      due_at: "2025-05-01T10:00:00",
      type: "renewal",
      is_done: false,
      customer_ids: ["cust-a", "cust-b"],
      _customers: [
        {
          id: "cust-a",
          full_name: "Anh Long",
          type: "retail",
          customer_contacts: [
            { value: "0901234567", is_primary: true, channel: "phone" },
          ],
        },
        {
          id: "cust-b",
          full_name: "Chị Mai",
          type: "wholesale",
          customer_contacts: [
            { value: "mai@test.com", is_primary: false, channel: "email" },
            { value: "0908765432", is_primary: true, channel: "phone" },
          ],
        },
      ],
    };

    const result = mapCalendarEventRow(row);
    expect(result.customers).toHaveLength(2);
    expect(result.customers![0]).toEqual({
      id: "cust-a",
      name: "Anh Long",
      contact: "0901234567",
    });
    expect(result.customers![1]).toEqual({
      id: "cust-b",
      name: "Chị Mai",
      contact: "0908765432", // primary contact
    });
  });

  it("should use first contact when no primary exists", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000013c",
      title: "No primary contact",
      due_at: "2025-01-01T10:00:00",
      type: "follow_up",
      is_done: false,
      customer_ids: ["cust-c"],
      _customers: [
        {
          id: "cust-c",
          full_name: "Test User",
          type: "retail",
          customer_contacts: [
            { value: "first@test.com", is_primary: false, channel: "email" },
            { value: "second@test.com", is_primary: false, channel: "email" },
          ],
        },
      ],
    };

    const result = mapCalendarEventRow(row);
    expect(result.customers![0].contact).toBe("first@test.com"); // fallback to first
  });

  it("should handle customer with no contacts", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000013d",
      title: "No contacts",
      due_at: "2025-01-01T10:00:00",
      type: "reminder",
      is_done: false,
      customer_ids: ["cust-d"],
      _customers: [
        {
          id: "cust-d",
          full_name: "No Contact User",
          type: "retail",
          customer_contacts: [],
        },
      ],
    };

    const result = mapCalendarEventRow(row);
    expect(result.customers![0]).toEqual({
      id: "cust-d",
      name: "No Contact User",
      contact: undefined,
    });
  });

  it("should handle empty _customers array", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000013e",
      title: "No customers",
      due_at: "2025-01-01T00:00:00",
      type: "other",
      is_done: true,
      customer_ids: [],
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.customers).toEqual([]);
    expect(result.customerIds).toEqual([]);
  });

  /* ─── Legacy customer_id fallback ──────────────── */
  it("should fallback to customer_id when customer_ids is null", () => {
    const row = {
      id: "00000000-0000-4000-8000-00000000013f",
      title: "Legacy",
      due_at: "2025-01-01T10:00:00",
      type: "follow_up",
      is_done: false,
      customer_ids: null,
      customer_id: "legacy-cust",
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.customerIds).toEqual(["legacy-cust"]);
  });

  it("should use empty array when no customer_ids or customer_id", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000140",
      title: "No customer",
      due_at: "2025-01-01T10:00:00",
      type: "other",
      is_done: false,
      customer_ids: null,
      customer_id: null,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.customerIds).toEqual([]);
  });

  /* ─── Default/fallback values ──────────────────── */
  it("should handle missing fields with defaults", () => {
    const result = mapCalendarEventRow({});
    expect(result.id).toBe("");
    expect(result.title).toBe("");
    expect(result.type).toBe("reminder"); // default from mapper
    expect(result.isDone).toBe(false);
    expect(result.customerIds).toEqual([]);
    expect(result.customers).toEqual([]);
  });

  it("should use 'date' field as fallback when due_at is missing", () => {
    const row = {
      id: "evt-fallback",
      title: "Fallback date",
      date: "2025-08-20",
      type: "payment",
      is_done: false,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.date).toBe("2025-08-20");
  });

  /* ─── gcalEventId mapping ──────────────────────── */
  it("should map gcal_event_id to gcalEventId", () => {
    const row = {
      id: "evt-gc",
      title: "GCal",
      due_at: "2025-01-01T10:00:00",
      type: "meeting",
      is_done: false,
      gcal_event_id: "gcal-xyz",
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.gcalEventId).toBe("gcal-xyz");
  });

  it("should set gcalEventId undefined when gcal_event_id is null", () => {
    const row = {
      id: "evt-no-gc",
      title: "No GCal",
      due_at: "2025-01-01T10:00:00",
      type: "other",
      is_done: false,
      gcal_event_id: null,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.gcalEventId).toBeUndefined();
  });

  /* ─── hasReminder derivation ──────────────────── */
  it("should use has_reminder field directly", () => {
    const row = {
      id: "evt-rem",
      title: "Reminder",
      due_at: "2025-01-01T10:00:00",
      type: "reminder",
      is_done: false,
      has_reminder: true,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.hasReminder).toBe(true);
  });

  it("should derive hasReminder from is_done when has_reminder is null", () => {
    const row = {
      id: "evt-der",
      title: "Derived",
      due_at: "2025-01-01T10:00:00",
      type: "follow_up",
      is_done: false,
      has_reminder: null,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    // When has_reminder is null and is_done is false → hasReminder = true (inverse of is_done)
    expect(result.hasReminder).toBe(true);
  });

  it("should derive hasReminder=false when is_done=true and has_reminder is null", () => {
    const row = {
      id: "evt-done",
      title: "Done",
      due_at: "2025-01-01",
      type: "other",
      is_done: true,
      has_reminder: null,
      _customers: [],
    };

    const result = mapCalendarEventRow(row);
    expect(result.hasReminder).toBe(false);
  });
});
