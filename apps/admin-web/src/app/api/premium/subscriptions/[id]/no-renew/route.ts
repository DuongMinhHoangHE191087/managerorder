import { NextRequest } from "next/server";
import { updatedResponse, notFoundResponse } from "@/lib/utils/api-helpers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { markSubscriptionNotRenewing } from "@/lib/utils/subscriptions-helpers";

interface NoRenewBody {
  reason?: string;
}

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as NoRenewBody;

    try {
      const renewal = await markSubscriptionNotRenewing(accountId, id, body.reason);
      return updatedResponse(
        {
          renewal,
          subscription: {
            id,
            renewal_status: "not_renewing",
            renewal_denied_reason: body.reason?.trim() || null,
          },
        },
        "Subscription marked as not renewing",
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Subscription not found") {
        return notFoundResponse("Subscription");
      }

      throw error;
    }
  }),
);
