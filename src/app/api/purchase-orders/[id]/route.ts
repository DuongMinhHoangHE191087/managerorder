import { NextRequest, NextResponse } from "next/server";
import {
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "@/lib/supabase/repositories/purchase-orders.repo";
import { mapPurchaseOrderRow } from "@/lib/supabase/mappers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const result = await getPurchaseOrderById(id, accountId);
    const data = mapPurchaseOrderRow(result as unknown as Record<string, unknown>);
    return NextResponse.json({ data });
  })
);

export const PUT = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      const body = (await request.json()) as Record<string, unknown>;

      const updateData: Record<string, unknown> = {};
      if (body.items !== undefined) updateData.items = body.items;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.total_amount_vnd !== undefined) updateData.total_amount_vnd = Number(body.total_amount_vnd);
      if (body.total_paid_vnd !== undefined) updateData.total_paid_vnd = Number(body.total_paid_vnd);
      if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.received_at !== undefined) updateData.received_at = body.received_at;

      const result = await updatePurchaseOrder(id, accountId, updateData);

      createActivityLog({
        account_id: accountId,
        action_type: "PROCUREMENT_UPDATED",
        created_by: user.email,
        details: {
          action: "purchase_order_updated",
          purchase_order_id: id,
          status: result.status,
          total_amount_vnd: result.total_amount_vnd,
          total_paid_vnd: result.total_paid_vnd,
        },
      }).catch(() => {});

      const data = mapPurchaseOrderRow(result as unknown as Record<string, unknown>);
      return NextResponse.json({ data });
    })
  )
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      const existing = await getPurchaseOrderById(id, accountId);
      await deletePurchaseOrder(id, accountId);

      createActivityLog({
        account_id: accountId,
        action_type: "PROCUREMENT_UPDATED",
        created_by: user.email,
        details: {
          action: "purchase_order_deleted",
          purchase_order_id: id,
          provider_id: existing.provider_id,
        },
      }).catch(() => {});

      return NextResponse.json({ success: true });
    })
  )
);
