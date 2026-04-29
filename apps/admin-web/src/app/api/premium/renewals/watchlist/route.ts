import { withFlatAccountHandler, createFlatSuccessResponse } from "@/lib/api/flat-response";
import { getPremiumRenewalWatchlist } from "@/lib/services/premium-renewal-watchlist";

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export const dynamic = "force-dynamic";

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const searchParams = new URL(request.url).searchParams;
  const daysThreshold = parseBoundedInt(searchParams.get("days_threshold"), 7, 1, 30);
  const limit = parseBoundedInt(searchParams.get("limit"), 50, 1, 200);

  const data = await getPremiumRenewalWatchlist({
    accountId,
    daysThreshold,
    limit,
  });

  return createFlatSuccessResponse(data, {
    meta: {
      daysThreshold,
      limit,
      totalActionable: data.summary.totalActionable,
    },
  });
});

