import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  countDeletedItems,
  listDeletedItems,
  type TrashEntityType,
} from "@/lib/supabase/repositories/trash.repo";

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
    const countEntries = await Promise.all(
      VALID_TYPES.map(async (trashType) => [trashType, await countDeletedItems(accountId, trashType)] as const),
    );
    const counts = Object.fromEntries(countEntries);
    return NextResponse.json({ data: counts });
  })
);
