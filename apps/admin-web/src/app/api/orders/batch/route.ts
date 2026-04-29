import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { batchDeleteOrdersWithAudit } from "@/lib/services/order-deletion.service";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const batchDeleteHandler = withAccount(
  requirePermissions(["order:delete"])(async (request: NextRequest, { accountId, user }) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body rỗng hoặc không hợp lệ" },
        { status: 400 },
      );
    }

    const parsed = batchDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ids must be a non-empty array of valid order UUIDs" },
        { status: 400 },
      );
    }

    const ids = Array.from(new Set(parsed.data.ids));
    const deletedCount = await batchDeleteOrdersWithAudit(ids, accountId, user);

    return NextResponse.json({
      data: { deleted: deletedCount },
      message: `${deletedCount} orders deleted successfully`,
    });
  })
);

export const POST = withErrorHandler(batchDeleteHandler);
export const DELETE = withErrorHandler(batchDeleteHandler);
