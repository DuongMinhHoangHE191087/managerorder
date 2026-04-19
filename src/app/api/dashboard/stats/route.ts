import { NextRequest } from "next/server";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { cached, TTL } from "@/lib/cache/db-cache";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { listProducts } from "@/lib/supabase/repositories/products.repo";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { buildFinancialSummary } from "@/lib/domain/financial";
import { getFormattingPreferences, normalizeSystemSettings } from "@/lib/settings/system-settings";
import { isRelationCacheError, loadRowsByIds } from "@/lib/supabase/relation-fallback";
import type { DashboardStats } from "@/shared/types/dashboard";

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
  orders: Array<{ created_at: string; total_amount_vnd: number }>,
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
  const bucketData = Array.from({ length: buckets }, () => ({ revenue: 0, orders: 0 }));

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
    bucket.orders += 1;
  }

  return bucketData.map((bucket, index) => {
    const end = new Date(cutoffMs + bucketSizeMs * (index + 1));
    return {
      name: formatChartBucketLabel(end, days, stepDays, formatting),
      revenue: bucket.revenue,
      orders: bucket.orders,
    };
  });
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

const ORDER_SELECT_FIELDS =
  "id, customer_id, product_id, total_amount_vnd, total_cost_vnd, total_paid, payment_method, payment_terms, status, created_at";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const requestedDays = Number.parseInt(searchParams.get("days") || "30", 10);
    const days = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(requestedDays, 365) : 30;
    const cacheKey = `dashboard:stats:${accountId}:${days}`;

    const stats = await cached(
      cacheKey,
      async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();

        const [
          ordersResult,
          allOrdersResult,
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

          listProducts(accountId),
          listSourceAccounts(accountId),

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

        if (ordersResult.error) throw new Error(ordersResult.error.message);
        if (customersResult.error) throw new Error(customersResult.error.message);
        if (settingsResult.error) throw new Error(settingsResult.error.message);

        const settings = normalizeSystemSettings(settingsResult.data?.[0] ?? null);
        const formatting = getFormattingPreferences(settings);
        const filteredOrders = ordersResult.data ?? [];
        let recentOrderRows = (allOrdersResult.data ?? []) as DashboardRecentOrderRow[];

        if (allOrdersResult.error) {
          if (!isRelationCacheError(allOrdersResult.error)) {
            throw new Error(allOrdersResult.error.message);
          }

          const { data: fallbackOrdersData, error: fallbackOrdersError } = await supabase
            .from("orders")
            .select(ORDER_SELECT_FIELDS)
            .eq("account_id", accountId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(15);

          if (fallbackOrdersError) {
            throw new Error(fallbackOrdersError.message);
          }

          recentOrderRows = (fallbackOrdersData ?? []) as DashboardRecentOrderRow[];
        }

        const customerIds = [...new Set(recentOrderRows.map((order) => order.customer_id).filter(Boolean))];
        const customerMap = await loadRowsByIds<{ id: string; full_name: string }>(
          supabase,
          "customers",
          accountId,
          customerIds,
          "id, full_name",
        );
        const allOrders = recentOrderRows.map((order) => ({
          ...order,
          customer: order.customer_id ? customerMap.get(order.customer_id) ?? null : null,
        })) as DashboardRecentOrderRow[];
        const products = productsData ?? [];
        const sourceAccounts = sourceAccountsData ?? [];
        const overdueCustomersRaw = customersResult.data ?? [];
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

        if (refundError) throw new Error(refundError.message);

        const refundRows = Array.isArray(refundData) ? refundData : [];
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
            })),
          days,
          formatting
        );

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
          recentOrders: recentOrderSummaries,
          calculatedAt: new Date().toISOString(),
        } satisfies DashboardStats;
      },
      TTL.AGGREGATE
    );

    return createSuccessResponse(stats);
  })
);
