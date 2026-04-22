import { NextRequest } from "next/server";
import { createProviderInputSchema } from "@/lib/domain/schemas";
import {
  deleteProviderForAccount,
  getProviderForAccount,
  updateProviderForAccount,
} from "@/domains/providers";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

function logProviderDetailRouteError(
  action: "get" | "update" | "delete",
  accountId: string,
  providerId: string,
  error: unknown,
) {
  console.error(`[API /api/providers/[id]] ${action} failed`, { accountId, providerId }, error);
}

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    try {
      const data = await getProviderForAccount(id, accountId);
      return createSuccessResponse(data);
    } catch (error) {
      logProviderDetailRouteError("get", accountId, id, error);
      throw error;
    }
  })
);

export const PUT = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      try {
        const body = await request.json() as Record<string, unknown>;
        const parsed = createProviderInputSchema.partial().safeParse(body);
        if (!parsed.success) {
          return createErrorResponse(
            "Dữ liệu đầu vào không hợp lệ",
            "VALIDATION_ERROR",
            400,
            parsed.error.flatten().fieldErrors,
          );
        }

        const hasKnownPayloadFields = [
          "name",
          "contacts",
          "tier",
          "reliabilityScore",
          "notes",
          "createdAt",
        ].some((field) => body[field] !== undefined);
        if (!hasKnownPayloadFields) {
          return createErrorResponse("No valid fields to update", "VALIDATION_ERROR", 400);
        }

        const data = await updateProviderForAccount(
          id,
          accountId,
          {
            ...parsed.data,
            reliabilityScore:
              body.reliabilityScore === undefined ? undefined : Number(body.reliabilityScore),
            notes:
              body.notes === undefined
                ? undefined
                : (typeof body.notes === "string" ? body.notes : null),
            createdAt:
              body.createdAt === undefined
                ? undefined
                : String(body.createdAt),
          },
          user.email,
        );

        return createSuccessResponse(data);
      } catch (error) {
        logProviderDetailRouteError("update", accountId, id, error);
        throw error;
      }
    })
  )
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      try {
        await deleteProviderForAccount(id, accountId, user.email);
        return createSuccessResponse({ success: true });
      } catch (error) {
        logProviderDetailRouteError("delete", accountId, id, error);
        throw error;
      }
    })
  )
);
