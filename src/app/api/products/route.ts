import { NextRequest, NextResponse } from "next/server";
import { createProductInputSchema } from "@/lib/domain/schemas";
import { listProducts, createProduct } from "@/lib/supabase/repositories/products.repo";
import { mapProductRow } from "@/lib/supabase/mappers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const rows = await listProducts(accountId);
    const data = rows.map(r => mapProductRow(r));
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const validatedData = createProductInputSchema.parse(body);
    
    // Call Repo
    const result = await createProduct(accountId, {
      name: validatedData.name,
      mode: validatedData.mode as "slot" | "key" | "hybrid",
      duration_type: validatedData.durationType,
      duration_value: validatedData.durationValue,
      buy_price_vnd: validatedData.buyPriceVnd,
      sell_price_vnd: validatedData.sellPriceVnd,
      is_active: validatedData.isActive,
    });
    
    const data = mapProductRow(result);

    // Activity Log (Non-blocking — fire and forget)
    createActivityLog({
      account_id: accountId,
      action_type: 'PRODUCT_CREATED',
      details: {
        product_id: data.id,
        name: data.name,
        mode: data.mode,
        price: data.sellPriceVnd
      }
    }).catch(() => {});
    
    return NextResponse.json({ data }, { status: 201 });
  })
);
