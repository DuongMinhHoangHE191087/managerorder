import { NextRequest, NextResponse } from "next/server";
import {
  deletePurchaseOrderForAccount,
  getPurchaseOrderForAccount,
  updatePurchaseOrderForAccount,
} from "@/domains/purchase-orders";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const data = await getPurchaseOrderForAccount(id, accountId);
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

      const data = await updatePurchaseOrderForAccount(id, accountId, updateData, user.email);
      return NextResponse.json({ data });
    })
  )
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      await deletePurchaseOrderForAccount(id, accountId, user.email);

      return NextResponse.json({ success: true });
    })
  )
);
