import { NextRequest, NextResponse } from "next/server";
import { runAutoRenewalEngine } from "@/lib/services/auto-renewal-engine";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const daysThreshold = Number(searchParams.get("days_threshold") ?? 7);
  const maxCreated = Number(searchParams.get("max_created") ?? 20);
  const minReliabilityScore = Number(searchParams.get("min_reliability_score") ?? 70);

  try {
    const report = await runAutoRenewalEngine({
      daysThreshold,
      maxCreated,
      minReliabilityScore,
    });

    return NextResponse.json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error("[Cron] Auto renewal engine error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
