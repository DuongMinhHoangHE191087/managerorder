import { NextRequest, NextResponse } from "next/server";
import { allocationRequestSchema } from "@/lib/domain/schemas";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import {
  buildInventoryAllocationSuggestion,
  confirmInventoryAllocation,
  deallocateInventoryOrder,
} from "@/domains/inventory";

export const POST = withErrorHandler(
  withAccount(requirePermissions(["inventory:allocate"])(async (request: NextRequest, { accountId, user }) => {
    const body = (await request.json()) as unknown;
    const parsed = allocationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.confirm) {
      const result = await confirmInventoryAllocation(
        parsed.data.orderId,
        accountId,
        user.email,
      );

      return NextResponse.json({
        data: result.order,
        suggestion: result.suggestion,
        message: result.message,
      });
    }

    const suggestion = await buildInventoryAllocationSuggestion(parsed.data.orderId, accountId);
    return NextResponse.json({
      data: suggestion,
      message: suggestion.isValid
        ? "Inventory co the cap phat"
        : "Inventory chua san sang",
    });
  }))
);

export const DELETE = withErrorHandler(
  withAccount(requirePermissions(["inventory:allocate"])(async (request: NextRequest, { accountId, user }) => {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const result = await deallocateInventoryOrder(orderId, accountId, user.email);

    return NextResponse.json({
      data: result,
      message: `Đã giải phóng ${result.deallocatedSlots} slot và ${result.deallocatedKeys} key.`,
    });
  }))
);
