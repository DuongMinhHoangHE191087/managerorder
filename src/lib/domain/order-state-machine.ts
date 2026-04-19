import type { Order, OrderStatus } from "@/lib/domain/types";

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["pending_payment", "refunded"],
  pending_payment: ["paid", "refunded"],
  paid: ["provisioning", "refunded"],
  provisioning: ["active", "refunded"],
  active: ["expired", "refunded"],
  expired: ["active", "refunded"],
  refunded: [],
};

export function canTransitionOrder(
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  return ORDER_TRANSITIONS[current].includes(next);
}

export function transitionOrder(order: Order, nextStatus: OrderStatus): Order {
  if (!canTransitionOrder(order.status, nextStatus)) {
    throw new Error(
      `Invalid order transition from ${order.status} to ${nextStatus}`,
    );
  }

  return {
    ...order,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function getOrderNextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[status];
}
