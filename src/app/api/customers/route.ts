import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  createCustomer,
  getCustomerById,
} from "@/lib/supabase/repositories/customers.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createCustomerInputSchema } from "@/lib/domain/schemas";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { mapToCustomer, mapTierToDbType } from "@/lib/supabase/mappers/customer-mapper";
import { assignTagsToCustomer } from "@/lib/supabase/repositories/customer-tags.repo";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const rows = await listCustomers(accountId);
    const data = rows.map((r) =>
      mapToCustomer(r)
    );
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    // 1. Validate Input
    const body = await request.json();
    const validatedData = createCustomerInputSchema.parse(body);

    // 2. Map tier to DB type
    const dbType = mapTierToDbType(validatedData.tier);

    const dbContacts = validatedData.contacts.map((c) => ({
      channel: String(c.type ?? "other"),
      value: String(c.value ?? ""),
      is_primary: Boolean(c.isPrimary ?? false),
      is_verified: false,
      facebook_id: c.facebookId,
      facebook_name: c.facebookName,
    }));

    // 3. Call Repository
    const result = await createCustomer(accountId, {
      full_name: validatedData.name,
      type: dbType,
      contacts: dbContacts,
    });

    // 4. Assign Tags if provided
    if (validatedData.tagIds && validatedData.tagIds.length > 0) {
      await assignTagsToCustomer(result.id, validatedData.tagIds);
      // Fetch again to include the newly assigned tags in the response
      const updatedRow = await getCustomerById(result.id, accountId);
      if (updatedRow) {
        Object.assign(result, updatedRow);
      }
    }

    // 5. Transform Output
    const data = mapToCustomer(
      result as unknown as Record<string, unknown>
    );

    // 6. Activity Log (Non-blocking)
    createActivityLog({
      account_id: accountId,
      action_type: "CUSTOMER_CREATED",
      customer_id: data.id,
      details: {
        name: data.name,
        tier: data.tier,
        contacts_count: data.contacts.length,
      },
    }).catch(() => {});

    return NextResponse.json({ data }, { status: 201 });
  })
);
