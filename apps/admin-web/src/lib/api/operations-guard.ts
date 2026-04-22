import { NextRequest, NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api/with-error-handler";

function readEnvValue(envName: string): string {
  return process.env[envName]?.trim() ?? "";
}

export function requireOperationalRouteEnabled(
  envName: string,
  routeName: string,
): NextResponse | null {
  if (readEnvValue(envName) === "1") {
    return null;
  }

  return createErrorResponse(
    `${routeName} is disabled in runtime`,
    "ROUTE_DISABLED",
    404,
    {
      envName,
      route: routeName,
    },
  );
}

export function requireBearerSecret(
  request: NextRequest,
  secretEnvName: string,
): NextResponse | null {
  const expectedSecret = readEnvValue(secretEnvName);

  if (!expectedSecret) {
    return createErrorResponse(
      `${secretEnvName} is not configured`,
      "SECRET_NOT_CONFIGURED",
      503,
      { envName: secretEnvName },
    );
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return createErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
  }

  return null;
}
