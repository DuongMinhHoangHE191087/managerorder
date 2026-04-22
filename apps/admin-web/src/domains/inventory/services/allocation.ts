import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import {
  buildAllocationSuggestion,
  confirmAllocation,
  deallocateOrder,
} from "@/lib/services/allocation.service";
import type { OrderAllocationPlan } from "@/lib/services/allocation.service";
type ConfirmAllocationResult = Awaited<ReturnType<typeof confirmAllocation>>;

function buildAllocationDetails(plan: OrderAllocationPlan, message: string) {
  return {
    message,
    allocated_items: plan.items.length,
    source_accounts: plan.items
      .filter((item) => item.sourceAccountId)
      .map((item) => item.sourceAccountId)
      .join(", "),
    warnings: plan.warnings.join("; ") || "none",
  };
}

export async function buildInventoryAllocationSuggestion(
  orderId: string,
  accountId: string,
): Promise<OrderAllocationPlan> {
  return buildAllocationSuggestion(orderId, accountId);
}

export async function confirmInventoryAllocation(
  orderId: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<ConfirmAllocationResult> {
  const result = await confirmAllocation(orderId, accountId);

  createActivityLog({
    account_id: accountId,
    action_type: "ALLOCATION_CONFIRMED",
    created_by: actorEmail ?? undefined,
    order_id: orderId,
    details: buildAllocationDetails(result.suggestion, result.message),
  }).catch((error) => {
    console.warn("[activity-log] Failed to log ALLOCATION_CONFIRMED:", error);
  });

  return result;
}

export async function deallocateInventoryOrder(
  orderId: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<{ deallocatedSlots: number; deallocatedKeys: number }> {
  const result = await deallocateOrder(orderId, accountId);

  createActivityLog({
    account_id: accountId,
    action_type: "ALLOCATION_RELEASED",
    created_by: actorEmail ?? undefined,
    order_id: orderId,
    details: {
      deallocated_slots: result.deallocatedSlots,
      deallocated_keys: result.deallocatedKeys,
    },
  }).catch((error) => {
    console.warn("[activity-log] Failed to log ALLOCATION_RELEASED:", error);
  });

  return result;
}
