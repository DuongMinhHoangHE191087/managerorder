// /api/inventory/profit-report — Profit report per source account
import { NextRequest, NextResponse } from "next/server";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const [sourceAccounts, ordersResult] = await Promise.all([
      listSourceAccounts(accountId),
      supabaseAdmin
        .from("orders")
        .select("id, source_account_id, total_price_vnd, status")
        .eq("account_id", accountId)
        .in("status", ["delivered", "completed", "active"]),
    ]);

    const orders = ordersResult.data ?? [];

    // Build revenue map per source account
    const revenueByAccount = new Map<string, number>();
    for (const order of orders) {
      if (!order.source_account_id) continue;
      const current = revenueByAccount.get(order.source_account_id) || 0;
      revenueByAccount.set(
        order.source_account_id,
        current + (order.total_price_vnd ?? 0),
      );
    }

    // Build report rows
    let totalCost = 0;
    let totalRevenue = 0;

    const rows = sourceAccounts.map((account) => {
      const cost =
        account.purchase_cost_vnd ?? 0;
      const revenue = revenueByAccount.get(account.id) || 0;
      const profit = revenue - cost;

      totalCost += cost;
      totalRevenue += revenue;

      return {
        id: account.id,
        email: account.email,
        provider: account.provider,
        purchaseCostVnd: cost,
        purchaseDate: account.purchase_date || null,
        purchaseSource: account.purchase_source || null,
        revenueVnd: revenue,
        profitVnd: profit,
        roi: cost > 0 ? Math.round((profit / cost) * 100) : null,
        orderCount: orders.filter(
          (o) => o.source_account_id === account.id,
        ).length,
      };
    });

    return NextResponse.json({
      data: rows,
      summary: {
        totalCost,
        totalRevenue,
        totalProfit: totalRevenue - totalCost,
        avgRoi:
          totalCost > 0
            ? Math.round(((totalRevenue - totalCost) / totalCost) * 100)
            : null,
        accountsWithCost: rows.filter((r) => r.purchaseCostVnd > 0).length,
        totalAccounts: rows.length,
      },
    });
  }),
);
