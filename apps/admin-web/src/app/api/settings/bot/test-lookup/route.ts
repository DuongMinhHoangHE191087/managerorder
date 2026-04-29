import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { resolveZaloRuntimeConfig } from "@/lib/zalo/config";
import { zaloDataService } from "@/lib/zalo/data";
import { formatZaloOrderLookup } from "@/lib/zalo/messages";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json().catch(() => ({})) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return createErrorResponse("Vui lòng nhập mã đơn hoặc SĐT để test lookup", "VALIDATION_ERROR", 400);
    }

    const zaloConfig = resolveZaloRuntimeConfig(process.env);
    if (!zaloConfig.capabilities.orderLookup) {
      return createErrorResponse(
        "Zalo lookup chưa sẵn sàng. Cần cấu hình ZALO_BOT_ACCOUNT_ID hoặc TELEGRAM_BOT_ACCOUNT_ID.",
        "LOOKUP_DISABLED",
        409,
      );
    }

    const orders = await zaloDataService.searchOrders(accountId, query, 5);
    return createSuccessResponse({
      query,
      count: orders.length,
      orders,
      replyPreview: formatZaloOrderLookup(query, orders),
    });
  }),
);
