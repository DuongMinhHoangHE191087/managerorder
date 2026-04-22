import { NextRequest } from "next/server";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { formatDateCustom } from "@/lib/utils";

function getRangeHours(range: string) {
  if (range === "7d") return 24 * 7;
  if (range === "30d") return 24 * 30;
  return 24;
}

function normalizeActionType(actionType: string | null | undefined) {
  return (actionType || "unknown").trim().toLowerCase();
}

function isErrorAction(actionType: string | null | undefined) {
  const normalized = normalizeActionType(actionType);
  return normalized.includes("error") || normalized.includes("fail");
}

function isRateLimitAction(actionType: string | null | undefined) {
  const normalized = normalizeActionType(actionType);
  return normalized.includes("rate") || normalized.includes("limit") || normalized.includes("throttle");
}

function isBlockedAction(actionType: string | null | undefined) {
  const normalized = normalizeActionType(actionType);
  return normalized.includes("blocked") || normalized.includes("deny");
}

type BlockedIpSummary = {
  ipAddress: string;
  hits: number;
  lastSeen: string;
  reason: string | null;
};

type BlockedLinkSummary = {
  shortLinkId: string;
  slug: string | null;
  title: string | null;
  hits: number;
};

function buildTimeBuckets(hours: number) {
  const hoursToShow = Math.min(hours, 24);
  const stepHours = hours / hoursToShow;
  const now = new Date();
  const buckets = new Map<string, { requests: number; errors: number }>();

  for (let index = 0; index < hoursToShow; index += 1) {
    const bucketDate = new Date(now);
    bucketDate.setHours(now.getHours() - hours + index * stepHours, 0, 0, 0);
    const bucketKey = formatDateCustom(bucketDate, { timeZone: "Asia/Ho_Chi_Minh" }, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    buckets.set(bucketKey, { requests: 0, errors: 0 });
  }

  return buckets;
}

function addToNearestBucket(
  buckets: Map<string, { requests: number; errors: number }>,
  createdAt: string,
  isError = false
) {
  const target = new Date(createdAt);
  let nearestKey = "";
  let minDiff = Number.POSITIVE_INFINITY;

  for (const bucketKey of buckets.keys()) {
    const [hour, minute] = bucketKey.split(":").map(Number);
    const bucketDate = new Date(target);
    bucketDate.setHours(hour, minute, 0, 0);
    let diff = Math.abs(target.getTime() - bucketDate.getTime());
    if (diff > 12 * 60 * 60 * 1000) {
      diff = 24 * 60 * 60 * 1000 - diff;
    }
    if (diff < minDiff) {
      minDiff = diff;
      nearestKey = bucketKey;
    }
  }

  if (!nearestKey) return;
  const bucket = buckets.get(nearestKey);
  if (!bucket) return;
  bucket.requests += 1;
  if (isError) bucket.errors += 1;
}

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "24h";
    const hours = getRangeHours(range);

    const currentCutoff = new Date();
    currentCutoff.setHours(currentCutoff.getHours() - hours);

    const previousCutoff = new Date(currentCutoff);
    previousCutoff.setHours(previousCutoff.getHours() - hours);

    const currentCutoffIso = currentCutoff.toISOString();
    const previousCutoffIso = previousCutoff.toISOString();

    const [
      currentLogsRes,
      previousLogsRes,
      currentOrdersRes,
      previousOrdersRes,
      currentCustomersRes,
      previousCustomersRes,
      currentProductsRes,
      previousProductsRes,
    ] = await Promise.all([
      supabase
        .from("activity_logs")
        .select("action_type, created_at, created_by")
        .eq("account_id", accountId)
        .gte("created_at", currentCutoffIso),
      supabase
        .from("activity_logs")
        .select("action_type, created_at")
        .eq("account_id", accountId)
        .gte("created_at", previousCutoffIso)
        .lt("created_at", currentCutoffIso),
      supabase
        .from("orders")
        .select("id, created_at", { count: "exact" })
        .eq("account_id", accountId)
        .gte("created_at", currentCutoffIso),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("created_at", previousCutoffIso)
        .lt("created_at", currentCutoffIso),
      supabase
        .from("customers")
        .select("id, created_at", { count: "exact" })
        .eq("account_id", accountId)
        .gte("created_at", currentCutoffIso),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("created_at", previousCutoffIso)
        .lt("created_at", currentCutoffIso),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("created_at", currentCutoffIso),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("created_at", previousCutoffIso)
        .lt("created_at", currentCutoffIso),
    ]);

    const errors = [
      currentLogsRes.error,
      previousLogsRes.error,
      currentOrdersRes.error,
      previousOrdersRes.error,
      currentCustomersRes.error,
      previousCustomersRes.error,
      currentProductsRes.error,
      previousProductsRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(errors[0]?.message || "Unable to load platform metrics");
    }

    const currentLogs = currentLogsRes.data || [];
    const previousLogs = previousLogsRes.data || [];
    const currentOrders = currentOrdersRes.data || [];
    const currentCustomers = currentCustomersRes.data || [];

    const currentTotal =
      currentLogs.length +
      (currentOrdersRes.count || 0) +
      (currentCustomersRes.count || 0) +
      (currentProductsRes.count || 0);
    const previousTotal =
      previousLogs.length +
      (previousOrdersRes.count || 0) +
      (previousCustomersRes.count || 0) +
      (previousProductsRes.count || 0);

    const trend = previousTotal > 0
      ? Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1))
      : 0;

    const buckets = buildTimeBuckets(hours);
    const endpointHits = new Map<string, number>();
    const activeUsers = new Set<string>();
    let errorCount = 0;
    let loginCount = 0;
    let rateLimitHits = 0;
    let blockedHits = 0;

    for (const log of currentLogs) {
      const actionType = normalizeActionType(log.action_type);
      const isError = isErrorAction(actionType);
      addToNearestBucket(buckets, log.created_at, isError);
      endpointHits.set(actionType, (endpointHits.get(actionType) || 0) + 1);

      if (isError) errorCount += 1;
      if (actionType.includes("login") || actionType.includes("auth")) loginCount += 1;
      if (isRateLimitAction(actionType)) rateLimitHits += 1;
      if (isBlockedAction(actionType)) blockedHits += 1;
      if (log.created_by) activeUsers.add(log.created_by);
    }

    for (const order of currentOrders) {
      addToNearestBucket(buckets, order.created_at);
    }
    for (const customer of currentCustomers) {
      addToNearestBucket(buckets, customer.created_at);
    }

    const recentErrors = currentLogs
      .filter((log) => isErrorAction(log.action_type))
      .slice(0, 5)
      .map((log) => ({
        time: formatDateCustom(log.created_at, { timeZone: "Asia/Ho_Chi_Minh" }, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
        path: log.action_type,
        status: 500,
        message: "Activity log error event",
      }));

    const topEndpoints = Array.from(endpointHits.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([path, calls]) => ({
        path,
        calls,
        avgMs: 0,
        status: recentErrors.some((error) => error.path === path) ? "warning" : "healthy",
      }));

    let blockedIps: BlockedIpSummary[] = [];
    let blockedLinks: BlockedLinkSummary[] = [];

    try {
      const blockedClicksRes = await supabase
        .from("short_link_clicks")
        .select("short_link_id, ip_address, suspicious_reason, created_at")
        .eq("event_type", "blocked")
        .gte("created_at", currentCutoffIso)
        .order("created_at", { ascending: false })
        .limit(250);

      const blockedClickRows = (blockedClicksRes.data ?? []).filter((click) => click.ip_address);
      const blockedLinkIds = Array.from(new Set(blockedClickRows.map((click) => click.short_link_id))).filter(Boolean);
      const blockedLinksRes = blockedLinkIds.length > 0
        ? await supabase
          .from("short_links")
          .select("id, account_id, slug, title")
          .in("id", blockedLinkIds)
        : { data: [] as Array<{ id: string; account_id: string; slug: string | null; title: string | null }>, error: null };

      const ownedBlockedLinks = new Map(
        (blockedLinksRes.data ?? [])
          .filter((link) => link.account_id === accountId)
          .map((link) => [link.id, link])
      );

      const ipMap = new Map<string, { hits: number; lastSeen: string; reason: string | null }>();
      const linkMap = new Map<string, { hits: number }>();

      for (const click of blockedClickRows) {
        const link = ownedBlockedLinks.get(click.short_link_id);
        if (!link) continue;

        const ipEntry = ipMap.get(click.ip_address) ?? { hits: 0, lastSeen: click.created_at, reason: click.suspicious_reason ?? null };
        ipEntry.hits += 1;
        if (new Date(click.created_at).getTime() > new Date(ipEntry.lastSeen).getTime()) {
          ipEntry.lastSeen = click.created_at;
        }
        if (!ipEntry.reason && click.suspicious_reason) {
          ipEntry.reason = click.suspicious_reason;
        }
        ipMap.set(click.ip_address, ipEntry);

        const linkEntry = linkMap.get(click.short_link_id) ?? { hits: 0 };
        linkEntry.hits += 1;
        linkMap.set(click.short_link_id, linkEntry);
      }

      blockedIps = Array.from(ipMap.entries())
        .sort((left, right) => right[1].hits - left[1].hits)
        .slice(0, 5)
        .map(([ipAddress, entry]) => ({
          ipAddress,
          hits: entry.hits,
          lastSeen: entry.lastSeen,
          reason: entry.reason,
        }));

      blockedLinks = Array.from(linkMap.entries())
        .sort((left, right) => right[1].hits - left[1].hits)
        .slice(0, 5)
        .map(([shortLinkId, entry]) => {
          const link = ownedBlockedLinks.get(shortLinkId);
          return {
            shortLinkId,
            slug: link?.slug ?? null,
            title: link?.title ?? null,
            hits: entry.hits,
          };
        });
    } catch {
      blockedIps = [];
      blockedLinks = [];
    }

    return createSuccessResponse({
      apiCalls: {
        total: currentTotal,
        today: currentTotal,
        avgResponseMs: 0,
        p95ResponseMs: 0,
        errorRate: currentTotal > 0 ? Number(((errorCount / currentTotal) * 100).toFixed(1)) : 0,
        trend,
      },
      rateLimits: {
        totalHits: rateLimitHits,
        blocked: blockedHits,
        topEndpoints: topEndpoints.map((endpoint) => ({
          path: endpoint.path,
          hits: endpoint.calls,
        })),
        blockedIps,
        blockedLinks,
      },
      authMetrics: {
        loginSuccess: loginCount,
        loginFailed: errorCount,
        tokenRefreshed: 0,
        activeUsers: activeUsers.size,
      },
      hourlyRequests: Array.from(buckets.entries()).map(([hour, data]) => ({
        hour,
        requests: data.requests,
        errors: data.errors,
      })),
      topEndpoints,
      recentErrors,
    });
  })
);
