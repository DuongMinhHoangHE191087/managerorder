import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { listDeletedItems, type TrashEntityType } from "@/lib/supabase/repositories/trash.repo";

const VALID_TYPES: TrashEntityType[] = [
  "customers", "orders", "products", "providers", "source_accounts", "license_keys", "short_links",
];

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TrashEntityType | null;

    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (type) {
      const result = await listDeletedItems(accountId, type);
      return NextResponse.json({ data: result.data, count: result.count, type });
    }

    // Return counts for all types (overview)
    const counts: Record<string, number> = {};
    for (const t of VALID_TYPES) {
      const result = await listDeletedItems(accountId, t);
      counts[t] = result.count;
    }
    return NextResponse.json({ data: counts });
  })
);
