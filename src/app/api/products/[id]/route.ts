import { NextRequest, NextResponse } from "next/server";
import { createProductInputSchema } from "@/lib/domain/schemas";
import { updateProduct, deleteProduct, getProductById } from "@/lib/supabase/repositories/products.repo";
import { mapProductRow } from "@/lib/supabase/mappers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json() as unknown;
    // Use parse() — ZodError is caught by withErrorHandler automatically
    const d = createProductInputSchema.partial().parse(body);

    // Guard: If price is being changed, check for orders that are NOT yet settled.
    if (d.sellPriceVnd !== undefined) {
      const current = await getProductById(id, accountId);
      if (current && current.sell_price_vnd !== d.sellPriceVnd) {
        const { count } = await supabaseAdmin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("product_id", id)
          .eq("account_id", accountId)
          .in("status", ["draft", "pending_payment"]);
        if ((count ?? 0) > 0) {
          return NextResponse.json(
            {
              error: "Không thể thay đổi giá khi còn đơn hàng chưa thanh toán",
              detail: `Có ${count} đơn hàng đang ở trạng thái chờ thanh toán. Vui lòng xử lý các đơn này trước khi thay đổi giá.`,
              pendingOrderCount: count,
            },
            { status: 409 },
          );
        }
      }
    }

    const result = await updateProduct(id, accountId, {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.mode !== undefined && { mode: d.mode as "slot" | "key" | "hybrid" }),
      ...(d.durationType !== undefined && { duration_type: d.durationType }),
      ...(d.durationValue !== undefined && { duration_value: d.durationValue }),
      ...(d.buyPriceVnd !== undefined && { buy_price_vnd: d.buyPriceVnd }),
      ...(d.sellPriceVnd !== undefined && { sell_price_vnd: d.sellPriceVnd }),
      ...(d.isActive !== undefined && { is_active: d.isActive }),
    });
    return NextResponse.json({ data: mapProductRow(result) });
  })
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    await deleteProduct(id, accountId);
    return NextResponse.json({ success: true });
  })
);
