import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  requireBearerSecret,
  requireOperationalRouteEnabled,
} from "@/lib/api/operations-guard";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("operations-guard", () => {
  afterEach(() => {
    delete process.env.ENABLE_DEPRECATED_MIGRATE_ROUTE;
    delete process.env.CRON_SECRET;
  });

  it("hides disabled operational routes behind a 404", async () => {
    const response = requireOperationalRouteEnabled(
      "ENABLE_DEPRECATED_MIGRATE_ROUTE",
      "/api/migrate",
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: "ROUTE_DISABLED",
        details: {
          envName: "ENABLE_DEPRECATED_MIGRATE_ROUTE",
          route: "/api/migrate",
        },
      },
    });
  });

  it("allows operational routes when the explicit env flag is enabled", () => {
    process.env.ENABLE_DEPRECATED_MIGRATE_ROUTE = "1";

    expect(
      requireOperationalRouteEnabled(
        "ENABLE_DEPRECATED_MIGRATE_ROUTE",
        "/api/migrate",
      ),
    ).toBeNull();
  });

  it("returns 503 when the bearer secret is not configured", async () => {
    const response = requireBearerSecret(makeRequest(), "CRON_SECRET");

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: "SECRET_NOT_CONFIGURED",
        details: {
          envName: "CRON_SECRET",
        },
      },
    });
  });

  it("returns 401 when the bearer secret does not match", async () => {
    process.env.CRON_SECRET = "expected-secret";

    const response = requireBearerSecret(
      makeRequest({ authorization: "Bearer wrong-secret" }),
      "CRON_SECRET",
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });

  it("allows the request when the bearer secret matches", () => {
    process.env.CRON_SECRET = "expected-secret";

    expect(
      requireBearerSecret(
        makeRequest({ authorization: "Bearer expected-secret" }),
        "CRON_SECRET",
      ),
    ).toBeNull();
  });
});
