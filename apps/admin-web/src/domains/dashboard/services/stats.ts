import { cached, TTL } from "@/lib/cache/db-cache";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { listProducts } from "@/lib/supabase/repositories/products.repo";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { buildFinancialSummary } from "@/lib/domain/financial";
import { getFormattingPreferences, normalizeSystemSettings } from "@/lib/settings/system-settings";
import { isRelationCacheError, loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { isMissingRelationError } from "@/lib/supabase/schema-errors";
import type {
  DashboardClvRow,
  DashboardCohortRow,
  DashboardForecastRow,
  DashboardStats,
} from "@/shared/types/dashboard";

function formatChartBucketLabel(
  date: Date,
  days: number,
  stepDays: number,
  formatting: { locale: string; timeZone: string }
) {
  if (stepDays < 1) {
    return new Intl.DateTimeFormat(formatting.locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: formatting.timeZone,
    }).format(date);
  }

  if (days <= 30) {
    return new Intl.DateTimeFormat(formatting.locale, {
      day: "2-digit",
      month: "2-digit",
      timeZone: formatting.timeZone,
    }).format(date);
  }

  return new Intl.DateTimeFormat(formatting.locale, {
    month: "2-digit",
    year: "2-digit",
    timeZone: formatting.timeZone,
  }).format(date);
}

function buildChartData(
  orders: Array<{ created_at: string; total_amount_vnd: number; total_cost_vnd: number }>,
  days: number,
  formatting: { locale: string; timeZone: string }
) {
  const rawBuckets = days <= 7 ? 7 : days <= 30 ? 10 : 12;
  const buckets = Math.min(rawBuckets, Math.max(days, 1));
  const stepDays = days / buckets;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffMs = cutoff.getTime();
  const rangeMs = Math.max(1, Date.now() - cutoffMs);
  const bucketSizeMs = rangeMs / buckets;
  const bucketData = Array.from({ length: buckets }, () => ({ revenue: 0, cost: 0, orders: 0 }));

  for (const order of orders) {
    const orderTime = new Date(order.created_at).getTime();
    if (!Number.isFinite(orderTime)) {
      continue;
    }

    const bucketIndex = Math.min(
      buckets - 1,
      Math.max(0, Math.floor((orderTime - cutoffMs) / bucketSizeMs))
    );
    const bucket = bucketData[bucketIndex];
    bucket.revenue += Number(order.total_amount_vnd) || 0;
    bucket.cost += Number(order.total_cost_vnd) || 0;
    bucket.orders += 1;
  }

  return bucketData.map((bucket, index) => {
    const end = new Date(cutoffMs + bucketSizeMs * (index + 1));
    return {
      name: formatChartBucketLabel(end, days, stepDays, formatting),
      revenue: bucket.revenue,
      cost: bucket.cost,
      orders: bucket.orders,
    };
  });
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMonthKey(iso: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  });
  const parts = formatter.formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string, formatting: { locale: string; timeZone: string }) {
  const [year, month] = monthKey.split("-").map((value) => Number(value));
  return new Intl.DateTimeFormat(formatting.locale, {
    month: "short",
    year: "numeric",
    timeZone: formatting.timeZone,
  }).format(new Date(year, month - 1, 1));
}

type DashboardRecentOrderRow = {
  id: string;
  customer_id: string;
  product_id: string;
  total_amount_vnd: number | null;
  total_cost_vnd: number | null;
  total_paid: number | null;
  payment_method: string | null;
  payment_terms: string | null;
  status: string;
  created_at: string;
  customer: { full_name: string } | null;
};

type DashboardAnalyticsOrderRow = {
  customer_id: string;
  total_amount_vnd: number | null;
  total_cost_vnd: number | null;
  created_at: string;
};

const ORDER_SELECT_FIELDS =
  "id, customer_id, product_id, total_amount_vnd, total_cost_vnd, total_paid, payment_method, payment_terms, status, created_at";

export async function getDashboardStats(accountId: string, days = 30): Promise<DashboardStats> {
  const cacheKey = `dashboard:stats:${accountId}:${days}`;

  return cached(
    cacheKey,
    async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffISO = cutoff.toISOString();
      const analyticsCutoff = new Date();
      analyticsCutoff.setDate(analyticsCutoff.getDate() - Math.max(days, 365));
      const analyticsCutoffISO = analyticsCutoff.toISOString();

      const [
        ordersResult,
        allOrdersResult,
        analyticsOrdersResult,
        productsData,
        sourceAccountsData,
        customersResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(ORDER_SELECT_FIELDS)
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .gte("created_at", cutoffISO)
          .order("created_at", { ascending: false }),

        supabase
          .from("orders")
          .select(ORDER_SELECT_FIELDS)
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(15),

        supabase
          .from("orders")
          .select("customer_id, total_amount_vnd, total_cost_vnd, created_at")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .gte("created_at", analyticsCutoffISO)
          .order("created_at", { ascending: true })
          .limit(2000),

        listProducts(accountId).catch(() => []),
        listSourceAccounts(accountId).catch(() => []),

        supabase
          .from("customers")
          .select("id, full_name, debt_amount_vnd, debt_overdue_days")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .gt("debt_overdue_days", 0)
          .order("debt_amount_vnd", { ascending: false })
          .limit(5),

        supabase
          .from("system_settings")
          .select("*")
          .eq("account_id", accountId)
          .limit(1),
      ]);

      const settings = normalizeSystemSettings(settingsResult.error ? null : settingsResult.data?.[0] ?? null);
      const formatting = getFormattingPreferences(settings);
      const filteredOrders = ordersResult.error ? [] : (ordersResult.data ?? []);
      let recentOrderRows = (allOrdersResult.data ?? []) as DashboardRecentOrderRow[];

      if (allOrdersResult.error) {
        if (!isRelationCacheError(allOrdersResult.error)) {
          recentOrderRows = [];
        } else {
          const { data: fallbackOrdersData, error: fallbackOrdersError } = await supabase
            .from("orders")
            .select(ORDER_SELECT_FIELDS)
            .eq("account_id", accountId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(15);

          if (!fallbackOrdersError) {
            recentOrderRows = (fallbackOrdersData ?? []) as DashboardRecentOrderRow[];
          } else {
            recentOrderRows = [];
          }
        }
      }

      const customerMap = new Map<string, { id: string; full_name: string }>();
      for (const order of recentOrderRows) {
        if (!order.customer?.full_name || !order.customer_id) {
          continue;
        }

        customerMap.set(order.customer_id, {
          id: order.customer_id,
          full_name: order.customer.full_name,
        });
      }

      const missingCustomerIds = [...new Set(
        recentOrderRows
          .filter((order) => order.customer === undefined)
          .map((order) => order.customer_id)
          .filter((customerId): customerId is string => Boolean(customerId) && !customerMap.has(customerId))
      )];

      if (missingCustomerIds.length > 0) {
        const fallbackCustomerMap = await loadRowsByIds<{ id: string; full_name: string }>(
          supabase,
          "customers",
          accountId,
          missingCustomerIds,
          "id, full_name",
        );

        for (const [customerId, customer] of fallbackCustomerMap.entries()) {
          customerMap.set(customerId, customer);
        }
      }

      const allOrders = recentOrderRows.map((order) => ({
        ...order,
        customer: order.customer !== undefined
          ? order.customer
          : (order.customer_id ? customerMap.get(order.customer_id) ?? null : null),
      })) as DashboardRecentOrderRow[];
      const products = productsData ?? [];
      const sourceAccounts = sourceAccountsData ?? [];
      const overdueCustomersRaw = customersResult.error && isMissingRelationError(customersResult.error, "customers")
        ? []
        : customersResult.error
          ? []
          : (customersResult.data ?? []);
      const productNameById = new Map(products.map((product) => [product.id, product.name] as const));

      let totalRevenue = 0;
      let totalCost = 0;
      let totalCollected = 0;
      let pendingCount = 0;
      let refundedCount = 0;
      let totalDebt = 0;

      for (const order of filteredOrders) {
        const financial = buildFinancialSummary(order);
        if (order.status === "refunded") {
          refundedCount++;
          continue;
        }

        totalRevenue += Number(order.total_amount_vnd) || 0;
        totalCost += Number(order.total_cost_vnd) || 0;
        totalCollected += Number(order.total_paid) || 0;
        totalDebt += financial.balance_due_vnd;

        if (order.status === "pending_payment") {
          pendingCount++;
        }
      }

      const { data: refundData, error: refundError } = await supabase
        .from("refund_requests")
        .select("refundable_amount_vnd")
        .eq("status", "completed")
        .gte("completed_at", cutoffISO)
        .order("completed_at", { ascending: false });

      const refundRows = refundError && isMissingRelationError(refundError, "refund_requests")
        ? []
        : refundError
          ? []
          : (Array.isArray(refundData) ? refundData : []);
      const totalRefunded = refundRows.reduce(
        (sum, refund) => sum + (Number(refund.refundable_amount_vnd) || 0),
        0
      );

      let totalSlots = 0;
      let usedSlots = 0;
      for (const account of sourceAccounts) {
        totalSlots += account.max_slots ?? 0;
        usedSlots += account.used_slots ?? 0;
      }
      const availableSlots = Math.max(0, totalSlots - usedSlots);
      const fillRate = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

      const today = new Date();
      const future7 = new Date();
      future7.setDate(today.getDate() + 7);

      const expiringAccounts = sourceAccounts
        .filter(
          (account) =>
            account.expires_at &&
            new Date(account.expires_at) <= future7 &&
            new Date(account.expires_at) >= today
        )
        .map((account) => ({
          id: account.id,
          email: account.email ?? undefined,
          expiresAt: account.expires_at!,
          daysLeft: Math.ceil(
            (new Date(account.expires_at!).getTime() - today.getTime()) / (1000 * 3600 * 24)
          ),
          productIds: account.product_ids ?? [],
          usedSlots: account.used_slots,
          maxSlots: account.max_slots,
        }))
        .sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime())
        .slice(0, 5);

      const overdueCustomers = overdueCustomersRaw.map((customer) => ({
        id: customer.id,
        name: (customer as Record<string, unknown>).full_name as string ?? "N/A",
        debtAmountVnd: Number((customer as Record<string, unknown>).debt_amount_vnd) || 0,
        debtOverdueDays: Number((customer as Record<string, unknown>).debt_overdue_days) || 0,
      }));

      const pendingOrders = allOrders
        .map((order) => ({
          order,
          financial: buildFinancialSummary(order),
        }))
        .filter(({ order, financial }) => order.status !== "refunded" && financial.balance_due_vnd > 0)
        .slice(0, 10)
        .map(({ order, financial }) => ({
          id: order.id,
          customerId: order.customer_id,
          productId: order.product_id,
          totalAmountVnd: Number(order.total_amount_vnd) || 0,
          createdAt: order.created_at,
          paymentState: financial.payment_state,
          balanceDueVnd: financial.balance_due_vnd,
        }));

      const productStats = new Map<string, { name: string; revenue: number; count: number }>();
      for (const order of filteredOrders) {
        if (order.status === "refunded") continue;
        const productId = order.product_id;
        const current = productStats.get(productId);
        if (current) {
          current.revenue += Number(order.total_amount_vnd) || 0;
          current.count += 1;
          continue;
        }

        productStats.set(productId, {
          name: productNameById.get(productId) || productId,
          revenue: Number(order.total_amount_vnd) || 0,
          count: 1,
        });
      }
      const topProducts = Array.from(productStats.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 5);

      const productSlotTotals = new Map<string, { used: number; max: number }>();
      for (const account of sourceAccounts) {
        for (const productId of account.product_ids ?? []) {
          const current = productSlotTotals.get(productId) ?? { used: 0, max: 0 };
          current.used += account.used_slots ?? 0;
          current.max += account.max_slots ?? 0;
          productSlotTotals.set(productId, current);
        }
      }

      const productSlots = products.slice(0, 4).map((product) => {
        const slotTotals = productSlotTotals.get(product.id) ?? { used: 0, max: 0 };
        const used = slotTotals.used;
        const max = slotTotals.max;
        return { id: product.id, name: product.name, used, max };
      });

      const chartData = buildChartData(
        filteredOrders
          .filter((order) => order.status !== "refunded")
          .map((order) => ({
            created_at: order.created_at,
            total_amount_vnd: Number(order.total_amount_vnd) || 0,
            total_cost_vnd: Number(order.total_cost_vnd) || 0,
          })),
        days,
        formatting
      );

      const analyticsOrders = analyticsOrdersResult.error
        ? []
        : (analyticsOrdersResult.data ?? []);
      const customerRollups = new Map<
        string,
        {
          customerId: string;
          orderCount: number;
          revenue: number;
          cost: number;
          firstOrderAt: string;
          lastOrderAt: string;
        }
      >();

      for (const order of analyticsOrders as DashboardAnalyticsOrderRow[]) {
        if (!order.customer_id) {
          continue;
        }

        const current = customerRollups.get(order.customer_id) ?? {
          customerId: order.customer_id,
          orderCount: 0,
          revenue: 0,
          cost: 0,
          firstOrderAt: order.created_at,
          lastOrderAt: order.created_at,
        };

        current.orderCount += 1;
        current.revenue += Number(order.total_amount_vnd) || 0;
        current.cost += Number(order.total_cost_vnd) || 0;

        if (new Date(order.created_at).getTime() < new Date(current.firstOrderAt).getTime()) {
          current.firstOrderAt = order.created_at;
        }
        if (new Date(order.created_at).getTime() > new Date(current.lastOrderAt).getTime()) {
          current.lastOrderAt = order.created_at;
        }

        customerRollups.set(order.customer_id, current);
      }

      const cohortRollups = new Map<
        string,
        {
          acquiredCustomers: number;
          returningCustomers: number;
          revenue: number;
        }
      >();

      for (const rollup of customerRollups.values()) {
        const cohortKey = getMonthKey(rollup.firstOrderAt, formatting.timeZone);
        const current = cohortRollups.get(cohortKey) ?? {
          acquiredCustomers: 0,
          returningCustomers: 0,
          revenue: 0,
        };

        current.acquiredCustomers += 1;
        current.revenue += rollup.revenue;
        if (rollup.orderCount > 1) {
          current.returningCustomers += 1;
        }

        cohortRollups.set(cohortKey, current);
      }

      const cohortAnalysis: DashboardCohortRow[] = Array.from(cohortRollups.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-6)
        .reverse()
        .map(([cohortKey, rollup]) => {
          const retentionRate = rollup.acquiredCustomers > 0
            ? (rollup.returningCustomers / rollup.acquiredCustomers) * 100
            : 0;

          return {
            cohortLabel: formatMonthLabel(cohortKey, formatting),
            acquiredCustomers: rollup.acquiredCustomers,
            returningCustomers: rollup.returningCustomers,
            revenue: rollup.revenue,
            retentionRate,
            churnRate: Math.max(0, 100 - retentionRate),
          };
        });

      const forecastBaseRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
      const firstHalf = chartData.slice(0, Math.max(1, Math.floor(chartData.length / 2)));
      const secondHalf = chartData.slice(Math.floor(chartData.length / 2));
      const firstHalfAverage = firstHalf.reduce((sum, item) => sum + item.revenue, 0) / Math.max(firstHalf.length, 1);
      const secondHalfAverage = secondHalf.reduce((sum, item) => sum + item.revenue, 0) / Math.max(secondHalf.length, 1);
      const trendDelta = firstHalfAverage > 0 ? (secondHalfAverage - firstHalfAverage) / firstHalfAverage : 0;
      const trendMultiplier = clampNumber(1 + trendDelta * 0.65, 0.75, 1.35);
      const pendingPipeline = pendingOrders.reduce((sum, order) => sum + (Number(order.balanceDueVnd) || 0), 0);

      const revenueForecast: DashboardForecastRow[] = [30, 60, 90].map((horizonDays) => {
        const horizonWeight = horizonDays / 90;
        const projectedRevenue = Math.max(
          0,
          Math.round(
            (forecastBaseRevenue / Math.max(days, 1)) * horizonDays * trendMultiplier
            + pendingPipeline * (0.18 + horizonWeight * 0.12)
          )
        );
        const confidence = clampNumber(
          Math.round(
            58
            + Math.min(chartData.length * 2, 16)
            - Math.min(Math.abs(trendDelta) * 16, 14)
            + (pendingOrders.length > 0 ? 4 : 0)
          ),
          45,
          92,
        );
        const note =
          trendDelta > 0.15
            ? "Xu hướng đang tăng, đơn chờ sẽ kéo thêm doanh thu."
            : trendDelta < -0.15
              ? "Xu hướng chậm lại, nên kích cầu ngắn hạn."
              : "Xu hướng ổn định, dự báo bám theo nhịp bán hiện tại.";

        return {
          horizonLabel: `${horizonDays} ngày`,
          days: horizonDays,
          projectedRevenue,
          confidence,
          note,
        };
      });

      const customerCandidates = Array.from(customerRollups.values())
        .map((rollup) => {
          const profit = rollup.revenue - rollup.cost;
          const repeatRate = rollup.orderCount > 1 ? (rollup.orderCount - 1) / rollup.orderCount : 0;
          const daysSinceLastOrder = Math.max(
            0,
            Math.floor((Date.now() - new Date(rollup.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
          );
          const recencyBoost = daysSinceLastOrder <= 30 ? 1.2 : daysSinceLastOrder <= 90 ? 1.08 : 0.92;
          const clvScore = Math.round(
            (rollup.revenue * 0.7 + Math.max(profit, 0) * 0.6) * (1 + repeatRate) * recencyBoost
          );

          return {
            ...rollup,
            profit,
            repeatRate,
            clvScore,
          };
        })
        .sort((left, right) => right.clvScore - left.clvScore)
        .slice(0, 5);

      const customerNameMap: Map<string, { id: string; full_name: string }> =
        customerCandidates.length > 0
          ? await loadRowsByIds<{ id: string; full_name: string }>(
              supabase,
              "customers",
              accountId,
              customerCandidates.map((item) => item.customerId),
              "id, full_name",
            ).catch(() => new Map<string, { id: string; full_name: string }>())
          : new Map<string, { id: string; full_name: string }>();

      const customerClv: DashboardClvRow[] = customerCandidates.map((item) => ({
        customerId: item.customerId,
        customerName: customerNameMap.get(item.customerId)?.full_name ?? item.customerId,
        totalRevenue: item.revenue,
        totalProfit: item.profit,
        orderCount: item.orderCount,
        repeatRate: item.repeatRate * 100,
        clvScore: item.clvScore,
      }));

      const recentOrderSummaries = allOrders.slice(0, 5).map((order) => {
        const customerRelation = order.customer;
        const financial = buildFinancialSummary(order);
        return {
          id: order.id,
          customerId: order.customer_id,
          customerName: customerRelation?.full_name ?? order.customer_id,
          productId: order.product_id,
          productName: productNameById.get(order.product_id) || order.product_id,
          status: order.status,
          paymentState: financial.payment_state,
          balanceDueVnd: financial.balance_due_vnd,
          totalAmountVnd: Number(order.total_amount_vnd) || 0,
          createdAt: order.created_at,
        };
      });

      return {
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        totalCollected,
        totalDebt,
        totalRefunded,
        refundedCount,
        pendingCount,
        totalSlots,
        usedSlots,
        availableSlots,
        fillRate,
        expiringAccounts,
        overdueCustomers,
        pendingOrders,
        topProducts,
        productSlots,
        chartData,
        cohortAnalysis,
        revenueForecast,
        customerClv,
        recentOrders: recentOrderSummaries,
        calculatedAt: new Date().toISOString(),
      } satisfies DashboardStats;
    },
    TTL.AGGREGATE
  );
}
