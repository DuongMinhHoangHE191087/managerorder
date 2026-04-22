import { NextRequest, NextResponse } from "next/server";
import {
  createPurchaseOrderForAccount,
  listPurchaseOrdersForAccount,
} from "@/domains/purchase-orders";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("provider_id") ?? undefined;
    const data = await listPurchaseOrdersForAccount(accountId, providerId);
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

      const data = await createPurchaseOrderForAccount(accountId, {
        provider_id: body.provider_id as string,
        items: body.items as Record<string, unknown>[],
        status: (body.status as string) ?? "pending",
        total_amount_vnd: totalAmount,
        total_paid_vnd: Number(body.total_paid_vnd ?? 0),
        payment_method: (body.payment_method as string) ?? undefined,
        notes: (body.notes as string) ?? undefined,
        received_at: (body.received_at as string) ?? undefined,
      }, user.email);

      return NextResponse.json({ data }, { status: 201 });
    })
  )
);
