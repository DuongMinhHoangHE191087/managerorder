import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* Constants */
const AGING_BUCKET_30 = 30;
const AGING_BUCKET_60 = 60;
const AGING_BUCKET_90 = 90;
const TOP_DEBTORS_LIMIT = 10;

export const dynamic = "force-dynamic";

/**
 * GET /api/customers/debt-summary
 * Returns debt dashboard data across all customers:
 * - Total debt, total overdue customers
 * - Debt aging buckets (current, 30, 60, 90+)
 * - Top debtors
 * - Segment breakdown
 */
export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    // 1. Get all customers with debt info
    const { data: customers, error } = await supabaseAdmin
      .from("customers")
      .select(
        "id, full_name, debt_amount_vnd, debt_overdue_days, reliability_score, segment, type",
      )
      .eq("account_id", accountId)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch customers", details: error.message },
        { status: 500 },
      );
    }

    const allCustomers = customers ?? [];

    // 2. Calculate totals
    const totalDebtVnd = allCustomers.reduce(
      (sum, c) => sum + Number(c.debt_amount_vnd ?? 0),
      0,
    );
    const customersWithDebt = allCustomers.filter(
      (c) => Number(c.debt_amount_vnd ?? 0) > 0,
    );
    const overdueCustomers = allCustomers.filter(
      (c) => Number(c.debt_overdue_days ?? 0) > 0,
    );

    // 3. Debt aging buckets
    const aging = {
      current: 0, // debt_overdue_days = 0 but has debt
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_90_plus: 0,
    };

    for (const c of customersWithDebt) {
      const days = Number(c.debt_overdue_days ?? 0);
      const amount = Number(c.debt_amount_vnd ?? 0);
      if (days === 0) aging.current += amount;
      else if (days <= AGING_BUCKET_30) aging.days_1_30 += amount;
      else if (days <= AGING_BUCKET_60) aging.days_31_60 += amount;
      else if (days <= AGING_BUCKET_90) aging.days_61_90 += amount;
      else aging.days_90_plus += amount;
    }

    // 4. Top debtors
    const topDebtors = customersWithDebt
      .sort(
        (a, b) =>
          Number(b.debt_amount_vnd ?? 0) - Number(a.debt_amount_vnd ?? 0),
      )
      .slice(0, TOP_DEBTORS_LIMIT)
      .map((c) => ({
        id: c.id,
        name: c.full_name,
        debtAmountVnd: Number(c.debt_amount_vnd ?? 0),
        overdueDays: Number(c.debt_overdue_days ?? 0),
        segment: c.segment,
      }));

    // 5. Segment breakdown
    const segmentBreakdown: Record<
      string,
      { count: number; totalDebt: number }
    > = {};
    for (const c of allCustomers) {
      const seg = c.segment ?? "regular";
      if (!segmentBreakdown[seg]) {
        segmentBreakdown[seg] = { count: 0, totalDebt: 0 };
      }
      segmentBreakdown[seg].count++;
      segmentBreakdown[seg].totalDebt += Number(c.debt_amount_vnd ?? 0);
    }

    return NextResponse.json({
      totalDebtVnd,
      totalCustomers: allCustomers.length,
      customersWithDebt: customersWithDebt.length,
      overdueCustomers: overdueCustomers.length,
      avgReliabilityScore:
        allCustomers.length > 0
          ? Math.round(
              allCustomers.reduce(
                (sum, c) => sum + Number(c.reliability_score ?? 100),
                0,
              ) / allCustomers.length,
            )
          : 100,
      aging,
      topDebtors,
      segmentBreakdown,
    });
  }),
);
