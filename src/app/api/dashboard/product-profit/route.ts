// ============================================================
// DASHBOARD: PRODUCT PROFIT API
// Aggregate order_items → revenue, cost, profit, ROI per product
// ============================================================

import { NextRequest } from "next/server";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { cached, TTL } from "@/lib/cache/db-cache";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";

export interface ProductProfitRow {
  productId: string;
  productName: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  roiPercent: number | null;
  orderCount: number;
  totalQuantity: number;
}

export interface ProductProfitResponse {
  data: ProductProfitRow[];
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    avgRoi: number | null;
  };
}

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const cacheKey = `dashboard:product-profit:${accountId}:${days}`;

    const result = await cached(
      cacheKey,
      async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("id")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .neq("status", "refunded")
          .gte("created_at", cutoff.toISOString())
          .order("created_at", { ascending: false });

        if (ordersError) throw new Error(ordersError.message);

        const orderIds = (orders ?? []).map((order) => order.id);
        if (orderIds.length === 0) {
          return {
            data: [],
            summary: {
              totalRevenue: 0,
              totalCost: 0,
              totalProfit: 0,
              avgRoi: null,
            },
          } satisfies ProductProfitResponse;
        }

        const { data: items, error } = await supabase
          .from("order_items")
          .select(`
            order_id,
            product_id,
            product_name_snapshot,
            quantity,
            price_vnd,
            cost_price_vnd,
            subtotal_vnd
          `)
          .in("order_id", orderIds);

        if (error) throw new Error(error.message);

        // Aggregate by product
        const map = new Map<string, {
          productName: string;
          revenue: number;
          cost: number;
          orderIds: Set<string>;
          qty: number;
        }>();

        for (const item of items ?? []) {
          const pid = item.product_id;
          let entry = map.get(pid);
          if (!entry) {
            entry = {
              productName: item.product_name_snapshot ?? pid,
              revenue: 0,
              cost: 0,
              orderIds: new Set(),
              qty: 0,
            };
            map.set(pid, entry);
          }
          const qty = item.quantity ?? 1;
          entry.revenue += (Number(item.price_vnd) || 0) * qty;
          entry.cost += (Number(item.cost_price_vnd) || 0) * qty;
          entry.qty += qty;
          // Count unique orders
          if (item.order_id) entry.orderIds.add(item.order_id);
        }

        const data: ProductProfitRow[] = Array.from(map.entries())
          .map(([productId, entry]) => {
            const profit = entry.revenue - entry.cost;
            return {
              productId,
              productName: entry.productName,
              totalRevenue: entry.revenue,
              totalCost: entry.cost,
              totalProfit: profit,
              roiPercent: entry.cost > 0 ? Math.round((profit / entry.cost) * 100) : null,
              orderCount: entry.orderIds.size,
              totalQuantity: entry.qty,
            };
          })
          .sort((a, b) => b.totalRevenue - a.totalRevenue);

        const totalRevenue = data.reduce((s, r) => s + r.totalRevenue, 0);
        const totalCost = data.reduce((s, r) => s + r.totalCost, 0);
        const totalProfit = totalRevenue - totalCost;
        const avgRoi = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : null;

        return {
          data,
          summary: { totalRevenue, totalCost, totalProfit, avgRoi },
        } satisfies ProductProfitResponse;
      },
      TTL.AGGREGATE,
    );

    return createSuccessResponse(result);
  })
);
