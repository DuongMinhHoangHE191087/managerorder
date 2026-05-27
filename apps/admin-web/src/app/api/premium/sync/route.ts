import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { syncOrdersToPremium } from "@/lib/services/premium-order-sync.service";

export const POST = withFlatAccountHandler(async (_request, { accountId }) => {
  const result = await syncOrdersToPremium(accountId);

  return createFlatSuccessResponse(result, {
    meta: {
      total: result.total,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errorCount: result.errors.length,
    },
  });
});
