// ============================================================
// DASHBOARD: IMPORT SUMMARY API
// Aggregate purchase_orders by month
// ============================================================

import { NextRequest } from "next/server";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { cached, TTL } from "@/lib/cache/db-cache";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { isMissingRelationError } from "@/lib/supabase/schema-errors";

export interface ImportSummaryMonth {
  month: string; // "2026-03"
  label: string; // "Tháng 3/2026"
  orderCount: number;
  totalAmountVnd: number;
  avgPerOrder: number;
}

export interface ImportSummaryResponse {
  data: ImportSummaryMonth[];
  summary: {
    totalOrders: number;
    totalAmountVnd: number;
    avgPerOrder: number;
  };
}

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "6", 10);

    const cacheKey = `dashboard:import-summary:${accountId}:${months}`;

    const result = await cached(
      cacheKey,
      async () => {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);

        const { data: pos, error } = await supabase
          .from("purchase_orders")
          .select("id, total_amount_vnd, created_at")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .gte("created_at", cutoff.toISOString())
          .order("created_at", { ascending: true });

        if (error) {
          if (isMissingRelationError(error, "purchase_orders")) {
            return {
              data: [],
              summary: {
                totalOrders: 0,
                totalAmountVnd: 0,
                avgPerOrder: 0,
              },
            } satisfies ImportSummaryResponse;
          }
          throw new Error(error.message);
        }

        // Group by month
        const monthMap = new Map<string, { count: number; total: number }>();

        for (const po of pos ?? []) {
          const d = new Date(po.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          let entry = monthMap.get(key);
          if (!entry) {
            entry = { count: 0, total: 0 };
            monthMap.set(key, entry);
          }
          entry.count++;
          entry.total += Number(po.total_amount_vnd) || 0;
        }

        const data: ImportSummaryMonth[] = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, entry]) => {
            const [y, m] = month.split("-");
            return {
              month,
              label: `Tháng ${parseInt(m)}/${y}`,
              orderCount: entry.count,
              totalAmountVnd: entry.total,
              avgPerOrder: entry.count > 0 ? Math.round(entry.total / entry.count) : 0,
            };
          });

        const totalOrders = data.reduce((s, r) => s + r.orderCount, 0);
        const totalAmountVnd = data.reduce((s, r) => s + r.totalAmountVnd, 0);

        return {
          data,
          summary: {
            totalOrders,
            totalAmountVnd,
            avgPerOrder: totalOrders > 0 ? Math.round(totalAmountVnd / totalOrders) : 0,
          },
        } satisfies ImportSummaryResponse;
      },
      TTL.AGGREGATE,
    );

    return createSuccessResponse(result);
  })
);
