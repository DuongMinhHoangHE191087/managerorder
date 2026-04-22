// ============================================================
// ALLOCATION SERVICE — Supabase-backed (Multi-item & RPC safe)
// ============================================================

import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { updateOrderStatus, getOrderById } from "@/lib/supabase/repositories/orders.repo";
import { recalculateUsedSlots } from "@/lib/supabase/repositories/source-accounts.repo"; // Added this import
import { scoreSourceAccount } from "@/lib/domain/allocation-engine";
import type { SourceAccount, ProductService } from "@/lib/domain/types";
import type { Database } from "@/lib/supabase/database.types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type SourceAccountRow = Database["public"]["Tables"]["source_accounts"]["Row"];

export interface ItemAllocationPlan {
  orderItemId: string;
  productId: string;
  quantity: number;
  requiresSlot: boolean;
  requiresKey: boolean;
  sourceAccountId?: string;
  // We don't need to specify which keys in advance since RPC allocates them atomically
}

export interface OrderAllocationPlan {
  isValid: boolean;
  warnings: string[];
  items: ItemAllocationPlan[];
}

function mapSourceAccount(row: SourceAccountRow): SourceAccount {
  return {
    id: row.id,
    email: row.email,
    provider: row.provider,
    productIds: row.product_ids ?? [],
    maxSlots: row.max_slots,
    usedSlots: row.used_slots,
    expiresAt: row.expires_at,
  };
}




export async function buildAllocationSuggestion(
  orderId: string,
  accountId: string
): Promise<OrderAllocationPlan> {
  const order = await getOrderById(orderId, accountId);
  if (!order) throw new Error("Order not found");

  const { data: orderItemRows } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!orderItemRows || orderItemRows.length === 0) {
    throw new Error("Order has no items");
  }

  // ── Batch-load all required data upfront (fix N+1) ──────────
  const uniqueProductIds = [...new Set(orderItemRows.map(i => i.product_id))];

  // 1 query: all products needed
  const { data: productRows } = await supabase
    .from("products")
    .select("*")
    .in("id", uniqueProductIds);

  const productMap = new Map<string, ProductService>();
  for (const data of productRows ?? []) {
    productMap.set(data.id, {
      id: data.id,
      name: data.name,
      mode: (data.mode ?? "slot") as ProductService["mode"],
      buyPriceVnd: data.buy_price_vnd ?? 0,
      sellPriceVnd: data.sell_price_vnd ?? 0,
      durationType: (data.duration_type as 'days' | 'months' | 'years') ?? 'days',
      durationValue: data.duration_value ?? 30,
      isActive: data.is_active ?? true,
    });
  }

  // 1 query: all source accounts for these products
  const { data: allSourceRows } = await supabase
    .from("source_accounts")
    .select("*")
    .eq("account_id", accountId)
    .overlaps("product_ids", uniqueProductIds);

  const sourcesByProduct = new Map<string, SourceAccount[]>();
  for (const row of allSourceRows ?? []) {
    const mapped = mapSourceAccount(row);
    for (const pid of row.product_ids ?? []) {
      if (!sourcesByProduct.has(pid)) sourcesByProduct.set(pid, []);
      sourcesByProduct.get(pid)!.push(mapped);
    }
  }

  // 1 query: all available license keys for these products
  const { data: allKeyRows } = await supabase
    .from("license_keys")
    .select("id, product_id")
    .eq("account_id", accountId)
    .eq("status", "available")
    .in("product_id", uniqueProductIds);

  const keyCountByProduct = new Map<string, number>();
  for (const k of allKeyRows ?? []) {
    keyCountByProduct.set(k.product_id, (keyCountByProduct.get(k.product_id) ?? 0) + 1);
  }

  // ── Build plan from pre-loaded data (zero additional queries) ──
  const warnings: string[] = [];
  const planItems: ItemAllocationPlan[] = [];

  for (const item of orderItemRows) {
    const product = productMap.get(item.product_id);
    if (!product) {
      warnings.push(`Sản phẩm không tồn tại: ${item.product_name_snapshot}`);
      continue;
    }

    const requiresSlot = product.mode === "slot" || product.mode === "hybrid";
    const requiresKey = product.mode === "key" || product.mode === "hybrid";

    let candidateSourceAccountId: string | undefined;

    // Check slot availability
    if (requiresSlot) {
      if (item.assigned_source_account_id) {
        candidateSourceAccountId = item.assigned_source_account_id;
      } else {
        const sourceAccounts = sourcesByProduct.get(product.id) ?? [];
        
        const candidate = sourceAccounts
          .filter((account) => account.maxSlots - account.usedSlots >= item.quantity)
          .sort((a, b) => scoreSourceAccount(b, item.customer_nick_used) - scoreSourceAccount(a, item.customer_nick_used))[0];
        
        if (candidate) {
          candidateSourceAccountId = candidate.id;
        } else {
          warnings.push(`Không đủ slot cho sản phẩm: ${product.name}`);
        }
      }
    }

    // Check key availability
    if (requiresKey) {
      const availableKeys = keyCountByProduct.get(product.id) ?? 0;
      if (availableKeys < item.quantity) {
        warnings.push(`Không đủ key cho sản phẩm: ${product.name} (cần ${item.quantity}, có ${availableKeys})`);
      }
    }

    planItems.push({
      orderItemId: item.id,
      productId: product.id,
      quantity: item.quantity,
      requiresSlot,
      requiresKey,
      sourceAccountId: candidateSourceAccountId,
    });
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    items: planItems,
  };
}

// ============================================================
// DEALLOCATE ORDER — Release all allocated slots & keys
// ============================================================

export async function deallocateOrder(
  orderId: string,
  accountId: string
): Promise<{ deallocatedSlots: number; deallocatedKeys: number }> {
  // Use atomic RPC to batch-release all slots + keys in one transaction
  const { data, error } = await supabase.rpc(
    "deallocate_order_atomic" as never,
    { p_order_id: orderId, p_account_id: accountId } as never
  );

  if (!error && data) {
    const result = data as unknown as { deallocated_slots: number; deallocated_keys: number };
    return {
      deallocatedSlots: Number(result.deallocated_slots) || 0,
      deallocatedKeys: Number(result.deallocated_keys) || 0,
    };
  }

  // Fallback: JS-side batch if RPC not available
  console.warn("[deallocateOrder] RPC unavailable, fallback to JS batch", error?.message);
  return deallocateOrderFallback(orderId, accountId);
}

/** JS-side fallback for deallocation (batch, not N+1) */
async function deallocateOrderFallback(
  orderId: string,
  accountId: string
): Promise<{ deallocatedSlots: number; deallocatedKeys: number }> {
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, product_id, quantity, assigned_source_account_id")
    .eq("order_id", orderId);

  if (!orderItems || orderItems.length === 0) {
    return { deallocatedSlots: 0, deallocatedKeys: 0 };
  }

  // Collect unique source account IDs and total slots to deallocate
  const sourceAccountIds = new Set<string>();
  let deallocatedSlots = 0;

  const itemsWithSlots = orderItems.filter(i => i.assigned_source_account_id);
  for (const item of itemsWithSlots) {
    sourceAccountIds.add(item.assigned_source_account_id!);
    deallocatedSlots += item.quantity;
  }

  // Batch: clear all assignments in one update
  if (itemsWithSlots.length > 0) {
    const itemIds = itemsWithSlots.map(i => i.id);
    await supabase
      .from("order_items")
      .update({ assigned_source_account_id: null })
      .in("id", itemIds);

    // Recalculate once per source account (not per item)
    await Promise.all(
      [...sourceAccountIds].map(saId => recalculateUsedSlots(saId, accountId))
    );
  }

  // Batch: release all keys in one update
  const { data: usedKeys } = await supabase
    .from("license_keys")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "used");

  let deallocatedKeys = 0;
  if (usedKeys && usedKeys.length > 0) {
    const keyIds = usedKeys.map(k => k.id);
    await supabase
      .from("license_keys")
      .update({ status: "available", order_id: null, assigned_at: null, updated_at: new Date().toISOString() })
      .in("id", keyIds);
    deallocatedKeys = keyIds.length;
  }

  return { deallocatedSlots, deallocatedKeys };
}

// ============================================================
// CHECK IF ORDER HAS EXISTING ALLOCATIONS
// ============================================================

async function hasExistingAllocations(orderId: string): Promise<boolean> {
  const { data: items } = await supabase
    .from("order_items")
    .select("assigned_source_account_id")
    .eq("order_id", orderId)
    .not("assigned_source_account_id", "is", null);

  if (items && items.length > 0) return true;

  const { count } = await supabase
    .from("license_keys")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("status", "used");

  return (count ?? 0) > 0;
}

// ============================================================
// CONFIRM ALLOCATION (supports re-allocation)
// ============================================================

export async function confirmAllocation(
  orderId: string,
  accountId: string
): Promise<{ order: OrderRow; suggestion: OrderAllocationPlan; message: string }> {
  let order = await getOrderById(orderId, accountId);
  if (!order) throw new Error("Order not found");

  // If order already has allocations, deallocate first (enables re-allocation)
  const alreadyAllocated = await hasExistingAllocations(orderId);
  if (alreadyAllocated) {
    await deallocateOrder(orderId, accountId);
  }

  // Transition status for fresh orders
  if (["pending_payment", "paid", "active"].includes(order.status)) {
    order = await updateOrderStatus(orderId, accountId, "provisioning");
  }

  const plan = await buildAllocationSuggestion(orderId, accountId);

  if (!plan.isValid) {
    order = await updateOrderStatus(orderId, accountId, "paid"); // Rollback on failure
    return {
      order,
      suggestion: plan,
      message: "Cấp phát thất bại: " + plan.warnings.join(", "),
    };
  }

  // Build allocation payload for atomic RPC
  const allocations = plan.items.map(itemPlan => ({
    order_item_id: itemPlan.orderItemId,
    product_id: itemPlan.productId,
    quantity: itemPlan.quantity,
    source_account_id: (itemPlan.requiresSlot && itemPlan.sourceAccountId) ? itemPlan.sourceAccountId : null,
    requires_key: itemPlan.requiresKey,
  }));

  // Try atomic RPC first (with advisory lock for race condition safety)
  const { data: _rpcResult, error: rpcError } = await supabase.rpc(
    "confirm_allocation_atomic" as never,
    {
      p_order_id: orderId,
      p_account_id: accountId,
      p_allocations: allocations,
    } as never
  );

  if (rpcError) {
    // Fallback: execute allocations one-by-one if RPC not deployed
    console.warn("[confirmAllocation] Atomic RPC unavailable, fallback:", rpcError.message);
    try {
      await confirmAllocationFallback(orderId, accountId, plan);
    } catch (err) {
      // Rollback to paid if fallback fails
      await updateOrderStatus(orderId, accountId, "paid");
      throw err;
    }
  }

  // Advance to active after successful allocation
  await updateOrderStatus(orderId, accountId, "active");

  // Refresh order to get latest state
  order = await getOrderById(orderId, accountId) ?? order;

  const actionMsg = alreadyAllocated
    ? "Cấp phát lại thành công. Đơn hàng đã chuyển sang Active."
    : "Cấp phát thành công. Đơn hàng đã chuyển sang Active.";

  return {
    order,
    suggestion: plan,
    message: actionMsg,
  };
}

/** Fallback: per-item allocation if atomic RPC not available */
async function confirmAllocationFallback(
  orderId: string,
  accountId: string,
  plan: OrderAllocationPlan
): Promise<void> {
  for (const itemPlan of plan.items) {
    if (itemPlan.requiresSlot && itemPlan.sourceAccountId) {
      const { error } = await supabase.rpc("increment_source_account_slots" as never, {
        p_account_id: accountId,
        p_source_id: itemPlan.sourceAccountId,
        p_quantity: itemPlan.quantity
      } as never);
      if (error) {
        throw new Error(`Lỗi cấp phát slot cho sản phẩm ${itemPlan.productId}: ${error.message}`);
      }

      await supabase
        .from("order_items")
        .update({ assigned_source_account_id: itemPlan.sourceAccountId })
        .eq("id", itemPlan.orderItemId);
    }

    if (itemPlan.requiresKey) {
      const { error } = await supabase.rpc("allocate_license_keys" as never, {
        p_account_id: accountId,
        p_product_id: itemPlan.productId,
        p_order_id: orderId,
        p_quantity: itemPlan.quantity
      } as never);
      if (error) {
        throw new Error(`Lỗi cấp phát key cho sản phẩm ${itemPlan.productId}: ${error.message}`);
      }
    }
  }

}
