import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createCustomerInputSchema } from "@/lib/domain/schemas";
import { createCustomerForAccount, listCustomersForAccount } from "@/domains/customers";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const data = await listCustomersForAccount(accountId, { search });
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const validatedData = createCustomerInputSchema.parse(body);
    const data = await createCustomerForAccount(accountId, validatedData);
    return NextResponse.json({ data }, { status: 201 });
  })
);
