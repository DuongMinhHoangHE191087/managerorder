import { NextResponse } from "next/server";
import {
  updateCustomer,
  deleteCustomer,
  getCustomerById,
} from "@/lib/supabase/repositories/customers.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { mapToCustomer, mapTierToDbType } from "@/lib/supabase/mappers/customer-mapper";
import { replaceCustomerTags } from "@/lib/supabase/repositories/customer-tags.repo";
import { updateCustomerInputSchema } from "@/lib/domain/schemas";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request, { accountId, params }) => {
    const { id } = await params;
    const row = await getCustomerById(id, accountId);
    if (!row)
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    const data = mapToCustomer(row);
    return NextResponse.json({ data });
  })
);

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json();

    // Validate input with Zod schema
    const validated = updateCustomerInputSchema.parse(body);

    // Map contacts with is_primary preserved
    const dbContacts = validated.contacts?.map((c) => ({
      channel: String(c.type ?? "other"),
      value: String(c.value ?? ""),
      is_primary: Boolean(c.isPrimary ?? false),
      is_verified: false,
    }));

    // Support both tier (vip/regular) and customerType (retail/wholesale/agency)
    const type = validated.customerType ?? (validated.tier ? mapTierToDbType(validated.tier) : undefined);

    let result = await updateCustomer(id, accountId, {
      full_name: validated.name,
      type: type as "retail" | "wholesale" | "agency" | undefined,
      contacts: dbContacts,
      reliability_score: validated.reliabilityScore,
      notes: validated.notes,
    });

    // Update tags if provided
    if (validated.tagIds) {
      await replaceCustomerTags(id, validated.tagIds);
      // Fetch updated customer to include new tags
      const updatedRow = await getCustomerById(id, accountId);
      if (updatedRow) {
        result = { ...result, ...updatedRow };
      }
    }

    const data = mapToCustomer(result);
    return NextResponse.json({ data });
  })
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    await deleteCustomer(id, accountId);
    return NextResponse.json({ success: true });
  })
);

