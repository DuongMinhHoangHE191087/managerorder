// ============================================================
// SUPABASE DB → APP DOMAIN MAPPERS
// Converts snake_case DB rows to camelCase app types
// ============================================================

import type {
  Customer, CustomerSegment, ProductService, CalendarEvent,
  ContactInfo, Provider, PurchaseOrder,
} from "@/lib/domain/types";

const VALID_SEGMENTS: CustomerSegment[] = ["vip", "loyal", "regular", "at_risk", "churned"];

/* ─── Customer ─────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accept any DB row shape; fields are coerced defensively
export function mapCustomerRow(row: Record<string, any>): Customer {
  const rawType = String(row.type ?? "retail");
  const rawSegment = row.segment ? String(row.segment) : undefined;
  const segment: CustomerSegment | undefined = rawSegment && VALID_SEGMENTS.includes(rawSegment as CustomerSegment)
    ? (rawSegment as CustomerSegment)
    : undefined;
  return {
    id: String(row.id ?? ""),
    name: String(row.full_name ?? row.name ?? ""),
    contacts: Array.isArray(row.contacts)
      ? (row.contacts as Record<string, unknown>[]).map(mapContactInfo)
      : Array.isArray(row.customer_contacts)
        ? (row.customer_contacts as Record<string, unknown>[]).map((c) => ({
            id: String(c.id ?? ""),
            type: mapContactChannel(String(c.channel ?? "other")),
            value: String(c.value ?? ""),
            isPrimary: Boolean(c.is_primary ?? false),
          }))
        : [],
    tier: rawType === "wholesale" || rawType === "agency" ? "vip" : "regular",
    customerType: (["retail", "wholesale", "agency"].includes(rawType) ? rawType : "retail") as "retail" | "wholesale" | "agency",
    debtAmountVnd: Number(row.debt_amount_vnd ?? 0),
    debtOverdueDays: Number(row.debt_overdue_days ?? 0),
    reliabilityScore: Number(row.reliability_score ?? 100),
    segment,
    rfmScore: row.rfm_score != null ? Number(row.rfm_score) : undefined,
    rfmRecency: row.rfm_recency != null ? Number(row.rfm_recency) : undefined,
    rfmFrequency: row.rfm_frequency != null ? Number(row.rfm_frequency) : undefined,
    rfmMonetary: row.rfm_monetary != null ? Number(row.rfm_monetary) : undefined,
    lastRfmCalculatedAt: row.last_rfm_calculated_at ? String(row.last_rfm_calculated_at) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapContactChannel(ch: string): ContactInfo["type"] {
  const m: Record<string, ContactInfo["type"]> = { phone: "phone", email: "email", zalo: "zalo", facebook: "facebook", telegram: "telegram" };
  return m[ch] ?? "other";
}

function mapContactInfo(c: Record<string, unknown>): ContactInfo {
  return {
    id: String(c.id ?? ""),
    type: (c.type as ContactInfo["type"]) ?? "other",
    value: String(c.value ?? ""),
    isPrimary: Boolean(c.isPrimary ?? c.is_primary ?? false),
  };
}

function mapProviderNotes(notes: unknown): string | undefined {
  if (typeof notes === "string") {
    const trimmed = notes.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (notes && typeof notes === "object") {
    const record = notes as Record<string, unknown>;
    const value = record.text ?? record.note;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }

  return undefined;
}

/* ─── Provider ─────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProviderRow(row: Record<string, any>): Provider {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    contacts: Array.isArray(row.contacts)
      ? (row.contacts as Record<string, unknown>[]).map(mapContactInfo)
      : [],
    tier: (row.tier as Provider["tier"]) ?? "regular",
    reliabilityScore: Number(row.reliability_score ?? 100),
    notes: mapProviderNotes(row.notes),
    debtAmountVnd: Number(row.debt_amount_vnd ?? 0),
    totalImportAmountVnd: Number(row.total_import_amount_vnd ?? 0),
    purchaseOrderCount: Number(row.purchase_order_count ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/* ─── Purchase Order ───────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPurchaseOrderRow(row: Record<string, any>): PurchaseOrder {
  return {
    id: String(row.id ?? ""),
    providerId: String(row.provider_id ?? ""),
    items: Array.isArray(row.items) ? row.items : [],
    status: (row.status as PurchaseOrder["status"]) ?? "pending",
    totalAmountVnd: Number(row.total_amount_vnd ?? 0),
    totalPaidVnd: Number(row.total_paid_vnd ?? 0),
    paymentMethod: row.payment_method ? String(row.payment_method) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    receivedAt: row.received_at ? String(row.received_at) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

/* ─── Product ──────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProductRow(row: Record<string, any>): ProductService {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    mode: (row.mode as ProductService["mode"]) ?? "slot",
    buyPriceVnd: Number(row.buy_price_vnd ?? 0),
    sellPriceVnd: Number(row.sell_price_vnd ?? 0),
    durationType: (row.duration_type as 'days' | 'months' | 'years') ?? 'days',
    durationValue: Number(row.duration_value ?? 0),
    isActive: Boolean(row.is_active ?? true),
  };
}

/* ─── Calendar Event ───────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCalendarEventRow(row: Record<string, any>): CalendarEvent {
  const dueAt = String(row.due_at ?? row.date ?? "");

  // Map enriched customers from repo (_customers array)
  const rawCustomers = (row._customers ?? []) as {
    id: string;
    full_name: string;
    type: string;
    customer_contacts: { value: string; is_primary: boolean; channel: string }[];
  }[];

  const customers: CalendarEvent["customers"] = rawCustomers.map(c => {
    const contacts = c.customer_contacts ?? [];
    const primary = contacts.find(ct => ct.is_primary) ?? contacts[0];
    return {
      id: c.id,
      name: c.full_name,
      contact: primary?.value,
    };
  });

  // Fallback: extract customerIds from row data
  const customerIds = (row.customer_ids as string[] | null) ?? 
    (row.customer_id ? [row.customer_id as string] : []);

  const timeStr = dueAt.length > 10 ? dueAt.slice(11, 16) : undefined;

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    customerIds,
    customers,
    date: dueAt.slice(0, 10),
    time: timeStr === "00:00" ? undefined : timeStr,
    type: String(row.type ?? "reminder"),
    notes: (row.notes as string) ?? undefined,
    hasReminder: row.has_reminder != null ? Boolean(row.has_reminder) : (row.is_done === false),
    isDone: Boolean(row.is_done ?? false),
    gcalEventId: row.gcal_event_id ? String(row.gcal_event_id) : undefined,
  };
}
