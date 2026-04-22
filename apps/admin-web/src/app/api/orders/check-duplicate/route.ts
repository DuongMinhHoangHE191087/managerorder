import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

/**
 * POST /api/orders/check-duplicate
 *
 * Checks if a similar order already exists based on:
 * - Same customer
 * - Same product(s)
 * - Same creation date (within the same day)
 *
 * Returns: { isDuplicate: boolean, existingOrders: [...] }
 */
export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json() as {
      customer_id: string;
      product_ids: string[];
      date?: string; // ISO date, defaults to today
    };

    if (!body.customer_id || !body.product_ids?.length) {
      return NextResponse.json({
        isDuplicate: false,
        existingOrders: [],
        message: "Thiếu customer_id hoặc product_ids",
      });
    }

    // Date range: beginning and end of the target day
    const targetDate = body.date ? new Date(body.date) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Find orders from the same customer on the same day
    const { data: existingOrders, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, status, product_name_snapshot, quantity, total_amount_vnd, created_at")
      .eq("customer_id", body.customer_id)
      .eq("account_id", accountId)
      .gte("created_at", dayStart.toISOString())
      .lte("created_at", dayEnd.toISOString())
      .not("status", "in", "(cancelled,refunded)");

    if (error) {
      console.error("[DuplicateCheck] Error:", error);
      return NextResponse.json({ isDuplicate: false, existingOrders: [] });
    }

    // Check if any existing order has the same product
    // We compare product_id from order_items if available
    let duplicates = existingOrders ?? [];
    if (duplicates.length > 0) {
      // Fetch order items to cross-reference product IDs
      const orderIds = duplicates.map(o => o.id);
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("order_id, product_id")
        .in("order_id", orderIds);

      if (items) {
        const orderProductMap = new Map<string, string[]>();
        for (const item of items) {
          const existing = orderProductMap.get(item.order_id) || [];
          existing.push(item.product_id);
          orderProductMap.set(item.order_id, existing);
        }

        // Filter to orders that share at least 1 product
        duplicates = duplicates.filter(o => {
          const orderProducts = orderProductMap.get(o.id) || [];
          return orderProducts.some(pid => body.product_ids.includes(pid));
        });
      }
    }

    return NextResponse.json({
      isDuplicate: duplicates.length > 0,
      existingOrders: duplicates.map(o => ({
        id: o.id,
        order_code: o.order_code,
        status: o.status,
        product_name: o.product_name_snapshot,
        quantity: o.quantity,
        total_amount: o.total_amount_vnd,
        created_at: o.created_at,
      })),
      message: duplicates.length > 0
        ? `Phát hiện ${duplicates.length} đơn hàng tương tự cho khách này trong ngày`
        : undefined,
    });
  })
);
