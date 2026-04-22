// ============================================================
// PROVIDER PRODUCT PRICES API
// GET ?productId=xxx — list provider prices for a product
// ============================================================

import { NextRequest } from "next/server";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { getProviderPricesForProduct } from "@/lib/supabase/repositories/provider-product-prices.repo";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return createSuccessResponse([]);
    }
    const prices = await getProviderPricesForProduct(accountId, productId);
    return createSuccessResponse(prices);
  })
);
