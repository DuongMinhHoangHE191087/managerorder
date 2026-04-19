import { NextRequest, NextResponse } from "next/server";
import { allocationRequestSchema } from "@/lib/domain/schemas";
import {
  buildAllocationSuggestion,
  confirmAllocation,
  deallocateOrder,
} from "@/lib/services/allocation.service";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

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
      const result = await confirmAllocation(parsed.data.orderId, accountId);

      // Log allocation success/failure (non-blocking)
      createActivityLog({
        account_id: accountId,
        action_type: 'ALLOCATION_CONFIRMED',
        created_by: user.email,
        order_id: parsed.data.orderId,
        details: {
          message: result.message,
          allocated_items: result.suggestion.items.length,
          source_accounts: result.suggestion.items
            .filter(i => i.sourceAccountId)
            .map(i => i.sourceAccountId)
            .join(', '),
          warnings: result.suggestion.warnings.join('; ') || 'none',
        },
      }).catch(() => {});

      return NextResponse.json({
        data: result.order,
        suggestion: result.suggestion,
        message: result.message,
      });
    }

    const suggestion = await buildAllocationSuggestion(parsed.data.orderId, accountId);
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

    const result = await deallocateOrder(orderId, accountId);

    // Log deallocation (non-blocking)
    createActivityLog({
      account_id: accountId,
      action_type: 'ALLOCATION_RELEASED',
      created_by: user.email,
      order_id: orderId,
      details: {
        deallocated_slots: result.deallocatedSlots,
        deallocated_keys: result.deallocatedKeys,
      },
    }).catch(() => {});

    return NextResponse.json({
      data: result,
      message: `Đã giải phóng ${result.deallocatedSlots} slot và ${result.deallocatedKeys} key.`,
    });
  }))
);
