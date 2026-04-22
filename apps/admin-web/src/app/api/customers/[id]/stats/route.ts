import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCustomerStatsForAccount } from "@/domains/customers";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(
    async (_request, { accountId, params }) => {
      const { id } = await params;
      const data = await getCustomerStatsForAccount(accountId, id);

      if (!data) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 },
        );
      }

      return NextResponse.json(data);
    },
  ),
);
