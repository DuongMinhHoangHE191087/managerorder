import { NextRequest, NextResponse } from "next/server";
import {
  listPurchaseOrders,
  createPurchaseOrder,
} from "@/lib/supabase/repositories/purchase-orders.repo";
import { mapPurchaseOrderRow } from "@/lib/supabase/mappers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("provider_id") ?? undefined;
    const rows = await listPurchaseOrders(accountId, providerId);
    const data = rows.map((row) =>
      mapPurchaseOrderRow(row as unknown as Record<string, unknown>)
    );
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["inventory:adjust"])(async (request: NextRequest, { accountId, user }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (!body.provider_id || typeof body.provider_id !== "string") {
        return NextResponse.json(
          { error: "provider_id is required" },
          { status: 400 },
        );
      }
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          { error: "items array is required and must not be empty" },
          { status: 400 },
        );
      }

      const totalAmount =
        typeof body.total_amount_vnd === "number"
          ? body.total_amount_vnd
          : (body.items as Record<string, unknown>[]).reduce(
              (sum, item) =>
                sum + Number(item.quantity ?? 1) * Number(item.priceVnd ?? item.price_vnd ?? 0),
              0,
            );

      const result = await createPurchaseOrder(accountId, {
        provider_id: body.provider_id as string,
        items: body.items as Record<string, unknown>[],
        status: (body.status as string) ?? "pending",
        total_amount_vnd: totalAmount,
        total_paid_vnd: Number(body.total_paid_vnd ?? 0),
        payment_method: (body.payment_method as string) ?? undefined,
        notes: (body.notes as string) ?? undefined,
        received_at: (body.received_at as string) ?? undefined,
      });

      createActivityLog({
        account_id: accountId,
        action_type: "PROCUREMENT_UPDATED",
        created_by: user.email,
        details: {
          action: "purchase_order_created",
          purchase_order_id: result.id,
          provider_id: result.provider_id,
          total_amount_vnd: result.total_amount_vnd,
          total_paid_vnd: result.total_paid_vnd,
          status: result.status,
        },
      }).catch(() => {});

      const data = mapPurchaseOrderRow(
        result as unknown as Record<string, unknown>,
      );
      return NextResponse.json({ data }, { status: 201 });
    })
  )
);
