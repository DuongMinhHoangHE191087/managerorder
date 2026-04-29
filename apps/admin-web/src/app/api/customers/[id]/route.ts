import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { updateCustomerInputSchema } from "@/lib/domain/schemas";
import {
  deleteCustomerForAccount,
  getCustomerForAccount,
  updateCustomerForAccount,
} from "@/domains/customers";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    const includeDeleted = new URL(_request.url).searchParams.get("include_deleted") === "1";
    const data = await getCustomerForAccount(id, accountId, { includeDeleted });
    if (!data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  })
);

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json();
    const validated = updateCustomerInputSchema.parse(body);
    const data = await updateCustomerForAccount(id, accountId, validated);
    return NextResponse.json({ data });
  })
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    await deleteCustomerForAccount(id, accountId);
    return NextResponse.json({ success: true });
  })
);
