import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { findCustomerDuplicatesForAccount } from "@/domains/customers";

const checkSchema = z.object({
  name: z.string().min(1),
  contacts: z.array(z.object({
    value: z.string().min(1),
  })).optional(),
  excludeId: z.string().uuid().optional(),
});

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const { name, contacts, excludeId } = checkSchema.parse(body);
    const data = await findCustomerDuplicatesForAccount(accountId, { name, contacts, excludeId });
    return NextResponse.json({ data });
  })
);
