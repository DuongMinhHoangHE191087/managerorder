import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { deleteOrder, getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { deallocateOrder } from "@/lib/services/allocation.service";

type OrderDeletionActor = {
  email: string;
  displayName: string | null;
};

type DeletionSnapshot = {
  status: string | null;
  total_amount_vnd: number | null;
  total_paid: number | null;
  expires_at: string | null;
};

function buildDeletionDetails(order: DeletionSnapshot) {
  return {
    before_snapshot: {
      status: order.status,
      total_amount_vnd: order.total_amount_vnd,
      total_paid: order.total_paid,
      expires_at: order.expires_at,
    },
  };
}

export async function deleteOrderWithAudit(
  id: string,
  accountId: string,
  actor: OrderDeletionActor,
): Promise<boolean> {
  const order = await getOrderWithItems(id, accountId);
  if (!order) {
    return false;
  }

  await deallocateOrder(id, accountId);
  await deleteOrder(id, accountId);
  await createActivityLog({
    account_id: accountId,
    action_type: "ORDER_DELETED",
    customer_id: order.customer_id,
    order_id: id,
    created_by: actor.displayName ?? actor.email,
    details: buildDeletionDetails(order),
  });

  return true;
}

export async function batchDeleteOrdersWithAudit(
  ids: string[],
  accountId: string,
  actor: OrderDeletionActor,
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  let deletedCount = 0;
  for (const id of ids) {
    const deleted = await deleteOrderWithAudit(id, accountId, actor);
    if (deleted) {
      deletedCount += 1;
    }
  }

  return deletedCount;
}
