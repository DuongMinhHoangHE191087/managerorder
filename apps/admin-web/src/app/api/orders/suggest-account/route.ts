// /api/orders/suggest-account — Smart account suggestion for order creation
import { NextRequest, NextResponse } from "next/server";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { mapRowToSourceAccount } from "@/lib/mappers/source-account.mapper";
import { suggestTopAccounts } from "@/lib/domain/allocation-engine";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = (await request.json()) as {
      productId: string;
      quantity?: number;
      customerNick?: string;
    };

    if (!body.productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    const quantity = body.quantity ?? 1;
    const rows = await listSourceAccounts(accountId);
    const accounts = rows.map(mapRowToSourceAccount);

    const suggestions = suggestTopAccounts(
      body.productId,
      quantity,
      accounts,
      body.customerNick,
      3,
    );

    return NextResponse.json({ data: suggestions });
  }),
);
