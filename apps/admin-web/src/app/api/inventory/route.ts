// /api/inventory/route.ts — List all license keys + create a new one
import { NextRequest } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { createLicenseKeyInputSchema } from "@/lib/domain/schemas";
import {
  createInventoryKeyForAccount,
  listInventoryKeysForAccount,
} from "@/domains/inventory";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const data = await listInventoryKeysForAccount(accountId);
    return createSuccessResponse(data);
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = (await request.json()) as unknown;
    const parsed = createLicenseKeyInputSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        "Dữ liệu đầu vào không hợp lệ",
        "VALIDATION_ERROR",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const result = await createInventoryKeyForAccount(accountId, parsed.data);
    return createSuccessResponse(result, { status: 201 });
  })
);
