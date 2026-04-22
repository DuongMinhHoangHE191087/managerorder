import type { PurchaseOrder } from "@/lib/domain/types";
import { mapPurchaseOrderRow } from "@/lib/supabase/mappers";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import {
  createPurchaseOrder as createPurchaseOrderRepo,
  deletePurchaseOrder as deletePurchaseOrderRepo,
  getPurchaseOrderById as getPurchaseOrderByIdRepo,
  listPurchaseOrders as listPurchaseOrdersRepo,
  updatePurchaseOrder as updatePurchaseOrderRepo,
} from "@/lib/supabase/repositories/purchase-orders.repo";
import type { Database } from "@/lib/supabase/database.types";

type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"];

export interface PurchaseOrderCreateInput {
  provider_id: string;
  items: Record<string, unknown>[];
  status?: string;
  total_amount_vnd: number;
  total_paid_vnd?: number;
  payment_method?: string;
  notes?: string;
  received_at?: string;
}

export interface PurchaseOrderUpdateInput {
  items?: Record<string, unknown>[];
  status?: string;
  total_amount_vnd?: number;
  total_paid_vnd?: number;
  payment_method?: string;
  notes?: string;
  received_at?: string;
}

function toDomainPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return mapPurchaseOrderRow(row as unknown as Record<string, unknown>);
}

async function logPurchaseOrderActivity(
  accountId: string,
  actionType: string,
  details: Record<string, string | number | boolean | object | null>,
  actorEmail?: string | null,
  purchaseOrderId?: string,
  providerId?: string,
) {
  try {
    await createActivityLog({
      account_id: accountId,
      action_type: actionType,
      created_by: actorEmail ?? undefined,
      ...(purchaseOrderId ? { purchase_order_id: purchaseOrderId } : {}),
      ...(providerId ? { provider_id: providerId } : {}),
      details,
    });
  } catch {
    // Activity logging is best-effort.
  }
}

export async function listPurchaseOrdersForAccount(
  accountId: string,
  providerId?: string,
): Promise<PurchaseOrder[]> {
  const rows = await listPurchaseOrdersRepo(accountId, providerId);
  return rows.map((row) => toDomainPurchaseOrder(row));
}

export async function getPurchaseOrderForAccount(
  id: string,
  accountId: string,
): Promise<PurchaseOrder> {
  const row = await getPurchaseOrderByIdRepo(id, accountId);
  return toDomainPurchaseOrder(row);
}

export async function createPurchaseOrderForAccount(
  accountId: string,
  input: PurchaseOrderCreateInput,
  actorEmail?: string | null,
): Promise<PurchaseOrder> {
  const row = await createPurchaseOrderRepo(accountId, input);

  await logPurchaseOrderActivity(
    accountId,
    "PROCUREMENT_UPDATED",
    {
      action: "purchase_order_created",
      purchase_order_id: row.id,
      provider_id: row.provider_id,
      total_amount_vnd: row.total_amount_vnd,
      total_paid_vnd: row.total_paid_vnd,
      status: row.status,
    },
    actorEmail,
    row.id,
    row.provider_id,
  );

  return toDomainPurchaseOrder(row);
}

export async function updatePurchaseOrderForAccount(
  id: string,
  accountId: string,
  input: PurchaseOrderUpdateInput,
  actorEmail?: string | null,
): Promise<PurchaseOrder> {
  const row = await updatePurchaseOrderRepo(id, accountId, input);

  await logPurchaseOrderActivity(
    accountId,
    "PROCUREMENT_UPDATED",
    {
      action: "purchase_order_updated",
      purchase_order_id: id,
      status: row.status,
      total_amount_vnd: row.total_amount_vnd,
      total_paid_vnd: row.total_paid_vnd,
    },
    actorEmail,
    id,
    row.provider_id,
  );

  return toDomainPurchaseOrder(row);
}

export async function deletePurchaseOrderForAccount(
  id: string,
  accountId: string,
  actorEmail?: string | null,
): Promise<void> {
  const existing = await getPurchaseOrderByIdRepo(id, accountId);
  await deletePurchaseOrderRepo(id, accountId);

  await logPurchaseOrderActivity(
    accountId,
    "PROCUREMENT_UPDATED",
    {
      action: "purchase_order_deleted",
      purchase_order_id: id,
      provider_id: existing.provider_id,
    },
    actorEmail,
    id,
    existing.provider_id,
  );
}
