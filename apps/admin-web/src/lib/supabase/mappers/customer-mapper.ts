// ============================================================
// CUSTOMER MAPPER — Shared DB Row → Domain Model transformation
// Single source of truth for mapToCustomer, mapChannel, mapType
// ============================================================

import type { Customer, ContactInfo, CustomerSegment } from "@/lib/domain/types";

export function mapChannel(ch: string): ContactInfo["type"] {
  const m: Record<string, ContactInfo["type"]> = {
    phone: "phone",
    email: "email",
    zalo: "zalo",
    facebook: "facebook",
    telegram: "telegram",
  };
  return m[ch] ?? "other";
}

export function mapDbTypeToTier(t: string): Customer["tier"] {
  return t === "agency" || t === "wholesale" ? "vip" : "regular";
}

export function mapTierToDbType(
  tier: string
): "retail" | "wholesale" | "agency" {
  const typeMap: Record<string, "retail" | "wholesale" | "agency"> = {
    vip: "wholesale",
    agency: "agency",
    regular: "retail",
  };
  return typeMap[tier] ?? "retail";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accept any DB row shape, fields are coerced defensively below
export function mapToCustomer(row: Record<string, any>): Customer {
  const contacts: ContactInfo[] = Array.isArray(row.contacts)
    ? (row.contacts as Record<string, unknown>[]).map((c, i) => ({
        id: String(c.id ?? `cc_${i}`),
        type: mapChannel(String(c.channel ?? c.type ?? "other")),
        value: String(c.value ?? ""),
        isPrimary: Boolean(c.is_primary ?? c.isPrimary ?? i === 0),
      }))
    : [];

  const nicksRegistry = Array.isArray(row.nicks_registry)
    ? (row.nicks_registry as unknown as Customer["nicksRegistry"])
    : [];

  const rawType = String(row.type ?? "retail");

  const tags = Array.isArray(row.customer_tags)
    ? (row.customer_tags as Record<string, unknown>[]).map(t => ({
        id: String(t.id ?? ""),
        name: String(t.name ?? ""),
        color: String(t.color ?? ""),
      }))
    : [];

  const validSegments = ["vip", "loyal", "regular", "at_risk", "churned", "new"] as const;
  const rawSegment = String(row.segment ?? "regular");
  const segment: CustomerSegment = validSegments.includes(rawSegment as CustomerSegment)
    ? (rawSegment as CustomerSegment)
    : "regular";

  // Calculate real totalSpentVnd from embedded orders
  const orders = Array.isArray(row.orders) ? row.orders : [];
  const totalSpentVnd = orders.reduce((sum: number, o: Record<string, unknown>) => sum + Number(o.total_amount_vnd || 0), 0);
  
  // Calculate balance mapping
  const balanceVnd = Number(row.balance_vnd ?? row.balanceVnd ?? 0);

  const debtAmountVnd = Number(row.debt_amount_vnd ?? 0);

  return {
    id: String(row.id ?? ""),
    name: String(row.full_name ?? row.name ?? ""),
    contacts,
    tags,
    tier: mapDbTypeToTier(rawType),
    customerType: (["retail", "wholesale", "agency"].includes(rawType) ? rawType : "retail") as "retail" | "wholesale" | "agency",
    debtAmountVnd,
    debtOverdueDays: Number(row.debt_overdue_days ?? 0),
    totalSpentVnd,
    balanceVnd,
    reliabilityScore: Number(row.reliability_score ?? 100),
    notes: row.notes ? String(row.notes) : undefined,
    nicksRegistry,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    // RFM Segmentation
    segment,
    rfmScore: Number(row.rfm_score ?? 0),
    rfmRecency: Number(row.rfm_recency ?? 0),
    rfmFrequency: Number(row.rfm_frequency ?? 0),
    rfmMonetary: Number(row.rfm_monetary ?? 0),
    lastRfmCalculatedAt: row.last_rfm_calculated_at ? String(row.last_rfm_calculated_at) : undefined,
  };
}
