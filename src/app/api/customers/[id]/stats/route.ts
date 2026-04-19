import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/customers/[id]/stats
 * Returns 360° stats for a single customer:
 * - Total orders, total spent, average order value
 * - First/last order dates
 * - RFM scores and segment
 * - Debt summary
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(
    async (
      _request,
      { accountId, params },
    ) => {
      const { id } = await params;

      // 1. Get customer details
      const { data: customer, error: custError } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .single();

      if (custError || !customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 },
        );
      }

      // 2. Aggregate orders
      const { data: orders, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("id, total_amount_vnd, created_at, status")
        .eq("customer_id", id)
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (orderError) {
        return NextResponse.json(
          { error: "Failed to fetch orders", details: orderError.message },
          { status: 500 },
        );
      }

      const allOrders = orders ?? [];
      const totalOrders = allOrders.length;
      const totalSpentVnd = allOrders.reduce(
        (sum, o) => sum + Number(o.total_amount_vnd ?? 0),
        0,
      );
      const avgOrderValueVnd =
        totalOrders > 0 ? Math.round(totalSpentVnd / totalOrders) : 0;
      const firstOrderDate = allOrders[0]?.created_at ?? null;
      const lastOrderDate =
        allOrders[allOrders.length - 1]?.created_at ?? null;

      // 3. Count orders by status
      const ordersByStatus: Record<string, number> = {};
      for (const o of allOrders) {
        const status = o.status ?? "unknown";
        ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;
      }

      // 4. Fetch payments
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("amount_vnd, created_at")
        .eq("customer_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const totalPaymentsVnd = (payments ?? []).reduce(
        (sum, p) => sum + Number(p.amount_vnd ?? 0),
        0,
      );

      return NextResponse.json({
        customerId: id,
        // Order stats
        totalOrders,
        totalSpentVnd,
        avgOrderValueVnd,
        firstOrderDate,
        lastOrderDate,
        ordersByStatus,
        // Payment stats
        totalPaymentsVnd,
        outstandingDebtVnd: totalSpentVnd - totalPaymentsVnd,
        // RFM
        segment: customer.segment,
        rfmScore: customer.rfm_score,
        rfmRecency: customer.rfm_recency,
        rfmFrequency: customer.rfm_frequency,
        rfmMonetary: customer.rfm_monetary,
        lastRfmCalculatedAt: customer.last_rfm_calculated_at,
        // Debt
        debtAmountVnd: customer.debt_amount_vnd,
        debtOverdueDays: customer.debt_overdue_days,
        reliabilityScore: customer.reliability_score,
      });
    },
  ),
);
