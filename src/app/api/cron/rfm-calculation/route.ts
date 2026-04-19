// ============================================================
// RFM CRON JOB — Automated daily RFM score recalculation
// Meant to be called by a Vercel/Netlify/external cron service
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateRfm } from "@/lib/services/rfm-calculator";

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 50;

export async function GET(req: Request) {
  // Verify the cron secret for security - Fail closed!
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized or missing CRON_SECRET" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Step 1: Fetch all orders grouped by customer
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("customer_id, total_amount_vnd, created_at")
      .not("status", "in", "(cancelled,refunded)")
      .order("created_at", { ascending: false });

    if (ordersErr) throw ordersErr;

    // Step 2: Group orders by customer_id
    const customerMap = new Map<
      string,
      { totalOrders: number; totalSpentVnd: number; lastOrderDate: string | null }
    >();

    for (const o of orders ?? []) {
      const cid = o.customer_id;
      if (!cid) continue;

      const existing = customerMap.get(cid) ?? {
        totalOrders: 0,
        totalSpentVnd: 0,
        lastOrderDate: null,
      };

      existing.totalOrders += 1;
      existing.totalSpentVnd += Number(o.total_amount_vnd ?? 0);
      if (!existing.lastOrderDate || o.created_at > existing.lastOrderDate) {
        existing.lastOrderDate = o.created_at;
      }

      customerMap.set(cid, existing);
    }

    // Step 3: Also fetch customers without orders
    const { data: allCustomers, error: custErr } = await supabase
      .from("customers")
      .select("id")
      .eq("is_deleted", false);

    if (custErr) throw custErr;

    // Ensure every customer gets RFM (even those with 0 orders)
    for (const c of allCustomers ?? []) {
      if (!customerMap.has(c.id)) {
        customerMap.set(c.id, {
          totalOrders: 0,
          totalSpentVnd: 0,
          lastOrderDate: null,
        });
      }
    }

    // Step 4: Calculate RFM scores and batch-update
    const now = new Date();
    const entries = Array.from(customerMap.entries());
    let updatedCount = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const updates = batch.map(([customerId, data]) => {
        const rfm = calculateRfm(
          {
            customerId,
            lastOrderDate: data.lastOrderDate,
            totalOrders: data.totalOrders,
            totalSpentVnd: data.totalSpentVnd,
          },
          now,
        );

        return {
          id: customerId,
          segment: rfm.segment,
          rfm_score: rfm.score,
          rfm_recency: rfm.recency,
          rfm_frequency: rfm.frequency,
          rfm_monetary: rfm.monetary,
          last_rfm_calculated_at: now.toISOString(),
        };
      });

      const { error: updateErr } = await supabase
        .from("customers")
        .upsert(updates, { onConflict: "id", ignoreDuplicates: false });

      if (updateErr) {
        console.error(`[Cron RFM] Batch ${i} error:`, updateErr);
      } else {
        updatedCount += updates.length;
      }
    }

    console.log(`[Cron RFM] Updated ${updatedCount}/${entries.length} customers`);

    return NextResponse.json({
      success: true,
      updatedCount,
      totalCustomers: entries.length,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[Cron RFM] Fatal error:", err);
    return NextResponse.json(
      { error: "RFM calculation failed", details: String(err) },
      { status: 500 },
    );
  }
}
