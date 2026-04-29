import {
  createActivityLog,
  type ActivityLog,
} from "@/lib/supabase/repositories/activity-logs.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdminHistoryQuery } from "@/lib/types/admin-history";

export const AUTO_RENEWAL_ENGINE_ACTION_TYPE = "auto_renewal_engine_run";

export type AutoRenewalEngineRunMode = "manual" | "cron";

export interface AutoRenewalEngineRunCreatedItem {
  accountId: string;
  subscriptionId: string;
  renewalId: string;
  customerId: string;
  customerName: string;
  daysRemaining: number;
}

export interface AutoRenewalEngineRunSnapshot {
  scannedCount: number;
  eligibleCount: number;
  createdCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
  created: AutoRenewalEngineRunCreatedItem[];
}

export interface AutoRenewalEngineRunAuditInput {
  accountId: string;
  createdBy?: string | null;
  mode: AutoRenewalEngineRunMode;
  snapshot: AutoRenewalEngineRunSnapshot;
  options?: {
    daysThreshold?: number | null;
    maxCreated?: number | null;
    minReliabilityScore?: number | null;
  };
}

export interface AutoRenewalEngineRunHistoryItem extends AutoRenewalEngineRunSnapshot {
  id: string;
  accountId: string;
  createdBy: string | null;
  createdAt: string;
  mode: AutoRenewalEngineRunMode;
  daysThreshold: number | null;
  maxCreated: number | null;
  minReliabilityScore: number | null;
}

export interface AutoRenewalEngineRunHistoryResult {
  items: AutoRenewalEngineRunHistoryItem[];
  meta: {
    count: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    manualCount: number;
    cronCount: number;
    systemCount: number;
    userCount: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMaybeJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSkippedReasons(value: unknown): Record<string, number> {
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([reason, count]) => [reason, Number(count) || 0]),
    );
  }

  const parsed = parseMaybeJson<Record<string, unknown>>(value);
  if (!parsed) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([reason, count]) => [reason, Number(count) || 0]),
  );
}

function normalizeCreatedItems(value: unknown): AutoRenewalEngineRunCreatedItem[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      const accountId = typeof item.accountId === "string" ? item.accountId : "";
      const subscriptionId = typeof item.subscriptionId === "string" ? item.subscriptionId : "";
      const renewalId = typeof item.renewalId === "string" ? item.renewalId : "";
      const customerId = typeof item.customerId === "string" ? item.customerId : "";
      const customerName = typeof item.customerName === "string" ? item.customerName : "";
      const daysRemaining = Number(item.daysRemaining);

      if (!accountId || !subscriptionId || !renewalId || !customerId || !customerName || !Number.isFinite(daysRemaining)) {
        return [];
      }

      return [
        {
          accountId,
          subscriptionId,
          renewalId,
          customerId,
          customerName,
          daysRemaining,
        },
      ];
    });
  }

  const parsed = parseMaybeJson<unknown[]>(value);
  if (!parsed) {
    return [];
  }

  return parsed.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const accountId = typeof item.accountId === "string" ? item.accountId : "";
    const subscriptionId = typeof item.subscriptionId === "string" ? item.subscriptionId : "";
    const renewalId = typeof item.renewalId === "string" ? item.renewalId : "";
    const customerId = typeof item.customerId === "string" ? item.customerId : "";
    const customerName = typeof item.customerName === "string" ? item.customerName : "";
    const daysRemaining = Number(item.daysRemaining);

    if (!accountId || !subscriptionId || !renewalId || !customerId || !customerName || !Number.isFinite(daysRemaining)) {
      return [];
    }

    return [
      {
        accountId,
        subscriptionId,
        renewalId,
        customerId,
        customerName,
        daysRemaining,
      },
    ];
  });
}

function normalizeSnapshot(snapshot: AutoRenewalEngineRunSnapshot): AutoRenewalEngineRunSnapshot {
  return {
    scannedCount: Number(snapshot.scannedCount) || 0,
    eligibleCount: Number(snapshot.eligibleCount) || 0,
    createdCount: Number(snapshot.createdCount) || 0,
    skippedCount: Number(snapshot.skippedCount) || 0,
    skippedReasons: Object.fromEntries(
      Object.entries(snapshot.skippedReasons ?? {}).map(([reason, count]) => [reason, Number(count) || 0]),
    ),
    created: snapshot.created.map((item) => ({
      accountId: item.accountId,
      subscriptionId: item.subscriptionId,
      renewalId: item.renewalId,
      customerId: item.customerId,
      customerName: item.customerName,
      daysRemaining: Number(item.daysRemaining) || 0,
    })),
  };
}

function createRunHistoryItem(row: ActivityLog): AutoRenewalEngineRunHistoryItem {
  const details = isRecord(row.details) ? row.details : {};
  const created = normalizeCreatedItems(details.created);
  const snapshot: AutoRenewalEngineRunSnapshot = normalizeSnapshot({
    scannedCount: Number(details.scannedCount) || 0,
    eligibleCount: Number(details.eligibleCount) || 0,
    createdCount: Number(details.createdCount) || 0,
    skippedCount: Number(details.skippedCount) || 0,
    skippedReasons: normalizeSkippedReasons(details.skippedReasons),
    created,
  });

  return {
    id: row.id,
    accountId: row.account_id,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    mode: details.mode === "cron" ? "cron" : "manual",
    daysThreshold: toNumberOrNull(details.daysThreshold),
    maxCreated: toNumberOrNull(details.maxCreated),
    minReliabilityScore: toNumberOrNull(details.minReliabilityScore),
    ...snapshot,
  };
}

function buildAuditDetails(input: AutoRenewalEngineRunAuditInput): Record<string, string | number | boolean | null | object> {
  const snapshot = normalizeSnapshot(input.snapshot);

  return {
    mode: input.mode,
    scannedCount: snapshot.scannedCount,
    eligibleCount: snapshot.eligibleCount,
    createdCount: snapshot.createdCount,
    skippedCount: snapshot.skippedCount,
    skippedReasons: snapshot.skippedReasons,
    created: snapshot.created,
    daysThreshold: input.options?.daysThreshold ?? null,
    maxCreated: input.options?.maxCreated ?? null,
    minReliabilityScore: input.options?.minReliabilityScore ?? null,
  };
}

export async function recordAutoRenewalEngineRun(input: AutoRenewalEngineRunAuditInput) {
  return createActivityLog({
    account_id: input.accountId,
    action_type: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
    created_by: input.createdBy ?? null,
    details: buildAuditDetails(input),
  });
}

export async function getAutoRenewalEngineRunHistory(
  accountId: string,
  options: AdminHistoryQuery = {},
): Promise<AutoRenewalEngineRunHistoryResult> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(Math.max(1, Number(options.limit) || 10), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const toDateExclusive = options.toDate
    ? new Date(new Date(options.toDate).setDate(new Date(options.toDate).getDate() + 1)).toISOString()
    : null;

  let dataQuery = supabaseAdmin
    .from("activity_logs")
    .select("*", { count: "exact" })
    .eq("account_id", accountId)
    .eq("action_type", AUTO_RENEWAL_ENGINE_ACTION_TYPE);

  let summaryQuery = supabaseAdmin
    .from("activity_logs")
    .select("id, account_id, created_by, created_at, details")
    .eq("account_id", accountId)
    .eq("action_type", AUTO_RENEWAL_ENGINE_ACTION_TYPE);

  if (options.mode && options.mode !== "all") {
    dataQuery = dataQuery.eq("details->>mode", options.mode);
    summaryQuery = summaryQuery.eq("details->>mode", options.mode);
  }

  if (options.createdBy && options.createdBy !== "all") {
    if (options.createdBy === "system") {
      dataQuery = dataQuery.is("created_by", null);
      summaryQuery = summaryQuery.is("created_by", null);
    } else {
      dataQuery = dataQuery.eq("created_by", options.createdBy);
      summaryQuery = summaryQuery.eq("created_by", options.createdBy);
    }
  }

  if (options.fromDate) {
    dataQuery = dataQuery.gte("created_at", options.fromDate);
    summaryQuery = summaryQuery.gte("created_at", options.fromDate);
  }

  if (toDateExclusive) {
    dataQuery = dataQuery.lt("created_at", toDateExclusive);
    summaryQuery = summaryQuery.lt("created_at", toDateExclusive);
  }

  const [dataResult, summaryResult] = await Promise.all([
    dataQuery.order("created_at", { ascending: false }).range(from, to),
    summaryQuery.order("created_at", { ascending: false }),
  ]);

  if (dataResult.error) {
    throw dataResult.error;
  }

  if (summaryResult.error) {
    throw summaryResult.error;
  }

  const summary = ((summaryResult.data ?? []) as ActivityLog[]).reduce(
    (accumulator, row) => {
      const item = createRunHistoryItem(row);

      if (item.mode === "cron") {
        accumulator.cronCount += 1;
      } else {
        accumulator.manualCount += 1;
      }

      if (item.createdBy) {
        accumulator.userCount += 1;
      } else {
        accumulator.systemCount += 1;
      }

      return accumulator;
    },
    {
      manualCount: 0,
      cronCount: 0,
      systemCount: 0,
      userCount: 0,
    },
  );

  return {
    items: ((dataResult.data ?? []) as ActivityLog[]).map(createRunHistoryItem),
    meta: {
      count: dataResult.count || 0,
      page,
      limit,
      totalPages: dataResult.count ? Math.ceil(dataResult.count / limit) : 0,
    },
    summary,
  };
}
