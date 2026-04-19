// /api/inventory/route.ts — List all license keys + create a new one
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  listLicenseKeys,
  createLicenseKey,
} from "@/lib/supabase/repositories/inventory.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createLicenseKeyInputSchema } from "@/lib/domain/schemas";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

type LicenseStatus = Database['public']['Tables']['license_keys']['Row']['status'];

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const data = await listLicenseKeys(accountId);
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const validatedData = createLicenseKeyInputSchema.parse(body);

    const result = await createLicenseKey(accountId, {
      key_code: validatedData.keyCode,
      product_id: validatedData.productId,
      status: validatedData.status as LicenseStatus,
    });

    createActivityLog({
      account_id: accountId,
      action_type: 'INVENTORY_KEY_CREATED',
      details: {
        product_id: validatedData.productId,
        key_code: validatedData.keyCode,
        status: validatedData.status
      }
    }).catch((err) => {
      console.warn("[activity-log] Failed to log INVENTORY_KEY_CREATED:", err);
    });

    return NextResponse.json({ data: result }, { status: 201 });
  })
);
