import { NextRequest } from "next/server";
import { createProviderInputSchema } from "@/lib/domain/schemas";
import {
  createProviderForAccount,
  listProvidersForAccount,
} from "@/domains/providers";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

function logProvidersRouteError(
  action: "list" | "create",
  accountId: string,
  error: unknown,
) {
  console.error(`[API /api/providers] ${action} failed`, { accountId }, error);
}

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    try {
      const data = await listProvidersForAccount(accountId);
      return createSuccessResponse(data);
    } catch (error) {
      logProvidersRouteError("list", accountId, error);
      throw error;
    }
  })
);

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["inventory:adjust"])(async (request: NextRequest, { accountId, user }) => {
      try {
        const body = await request.json() as unknown;
        const parsed = createProviderInputSchema.safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "Dữ liệu đầu vào không hợp lệ",
            "VALIDATION_ERROR",
            400,
            parsed.error.flatten().fieldErrors,
          );
        }

        const data = await createProviderForAccount(
          accountId,
          {
            ...parsed.data,
            reliabilityScore: Number((body as Record<string, unknown>).reliabilityScore ?? 100),
            notes: typeof (body as Record<string, unknown>).notes === "string"
              ? ((body as Record<string, unknown>).notes as string)
              : null,
          },
          user.email,
        );

        return createSuccessResponse(data, { status: 201 });
      } catch (error) {
        logProvidersRouteError("create", accountId, error);
        throw error;
      }
    })
  )
);
