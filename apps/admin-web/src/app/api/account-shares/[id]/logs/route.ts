import {
  listAccountShareLogsForAccount,
} from "@/domains/account-sharing";
import { withAccount } from "@/lib/api/with-account";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api/with-error-handler";
import { requirePermissions, type RBACApiHandler } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

type Ctx = { id: string };

export const GET = withErrorHandler(
  withAccount(
    requirePermissions<Ctx>(["credentials:share"])(((_request, context) => {
      return (async () => {
        const { id } = await context.params;
        const logs = await listAccountShareLogsForAccount(id, context.accountId);
        if (!logs) {
          return createErrorResponse("Account share link not found", "NOT_FOUND", 404);
        }
        return createSuccessResponse(logs);
      })();
    }) as RBACApiHandler<Ctx>),
  ),
);
