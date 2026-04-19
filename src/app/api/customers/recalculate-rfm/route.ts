import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateRfm } from "@/lib/services/rfm-calculator";

export const dynamic = "force-dynamic";

/**
 * POST /api/customers/recalculate-rfm
 * Recalculate RFM scores for all customers belonging to the account.
 * Aggregates order data per customer, computes scores, and batch-updates.
 */
export const POST = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    // 1. Aggregate order data per customer
    const { data: customerOrders, error: aggError } = await supabaseAdmin
      .from("orders")
      .select("customer_id, total_amount_vnd, created_at")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (aggError) {
      return NextResponse.json(
        { error: "Failed to aggregate order data", details: aggError.message },
        { status: 500 },
      );
    }

    // 2. Group orders by customer
    const customerMap = new Map<
      string,
      { totalOrders: number; totalSpent: number; lastOrderDate: string | null }
    >();

    for (const order of customerOrders ?? []) {
      const cid = order.customer_id;
      const existing = customerMap.get(cid) ?? {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
      };
      existing.totalOrders += 1;
      existing.totalSpent += Number(order.total_amount_vnd ?? 0);
      // First row per customer is the most recent (ordered DESC)
      if (!existing.lastOrderDate) {
        existing.lastOrderDate = order.created_at;
      }
      customerMap.set(cid, existing);
    }

    // 3. Get all customers for the account
    const { data: customers, error: custError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("account_id", accountId)
      .is("deleted_at", null);

    if (custError) {
      return NextResponse.json(
        { error: "Failed to fetch customers", details: custError.message },
        { status: 500 },
      );
    }

    // 4. Calculate RFM for each customer and batch update
    const now = new Date();
    let updatedCount = 0;
    const batchSize = 50;
    const allCustomers = customers ?? [];

    for (let i = 0; i < allCustomers.length; i += batchSize) {
      const batch = allCustomers.slice(i, i + batchSize);
      const updates = batch.map((c) => {
        const orderData = customerMap.get(c.id) ?? {
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: null,
        };

        const rfm = calculateRfm(
          {
            customerId: c.id,
            lastOrderDate: orderData.lastOrderDate,
            totalOrders: orderData.totalOrders,
            totalSpentVnd: orderData.totalSpent,
          },
          now,
        );

        return {
          id: c.id,
          segment: rfm.segment,
          rfm_recency: rfm.recency,
          rfm_frequency: rfm.frequency,
          rfm_monetary: rfm.monetary,
          rfm_score: rfm.score,
          last_rfm_calculated_at: now.toISOString(),
        };
      });

      // Parallel batch update (avoids N+1)
      const results = await Promise.all(
        updates.map((update) =>
          supabaseAdmin
            .from("customers")
            .update({
              segment: update.segment,
              rfm_recency: update.rfm_recency,
              rfm_frequency: update.rfm_frequency,
              rfm_monetary: update.rfm_monetary,
              rfm_score: update.rfm_score,
              last_rfm_calculated_at: update.last_rfm_calculated_at,
            })
            .eq("id", update.id),
        ),
      );
      updatedCount += results.filter((r) => !r.error).length;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      totalCustomers: allCustomers.length,
      calculatedAt: now.toISOString(),
    });
  }),
);
