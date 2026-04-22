import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { connectSourceAccountToOrderItemForAccount } from "@/domains/source-accounts";
import type { NextRequest } from "next/server";

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json();

    const orderItemId = typeof body?.orderItemId === "string" ? body.orderItemId.trim() : "";
    if (!orderItemId) {
      throw new Error("orderItemId is required");
    }

    await connectSourceAccountToOrderItemForAccount(id, orderItemId, accountId);

    return createSuccessResponse({ message: "Kết nối thành công" });
  })
);
