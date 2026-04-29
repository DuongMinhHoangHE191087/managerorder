import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { purgeItems, type TrashEntityType } from "@/lib/supabase/repositories/trash.repo";

const schema = z.object({
  type: z.enum(["customers", "orders", "products", "providers", "source_accounts", "license_keys", "short_links"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const { type, ids } = schema.parse(body);
    const count = await purgeItems(ids, accountId, type as TrashEntityType);
    return NextResponse.json({
      data: { purgedCount: count },
      message: `Đã xóa vĩnh viễn ${count} mục`,
    });
  })
);
