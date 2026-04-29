import { NextRequest } from "next/server";
import { executePublicShortLinkRedirect } from "@/domains/short-links/services/public-redirect";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return executePublicShortLinkRedirect(request, { slug });
}
