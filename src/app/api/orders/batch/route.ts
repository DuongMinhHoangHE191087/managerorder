import { NextRequest, NextResponse } from "next/server";
import { batchDeleteOrders } from "@/lib/supabase/repositories/orders.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const DELETE = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const ids: string[] = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: "Cannot delete more than 100 orders at once" },
        { status: 400 }
      );
    }

    await batchDeleteOrders(ids, accountId);

    return NextResponse.json({
      data: { deleted: ids.length },
      message: `${ids.length} orders deleted successfully`,
    });
  })
);
