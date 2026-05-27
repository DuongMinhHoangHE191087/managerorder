import { describe, expect, it } from "vitest";
import { buildGoogleAdminLoginUrl, buildLoginCallbackUrl, resolveInternalRedirectPath } from "./login-routing";

describe("login-routing", () => {
  it("prefers next over redirect and rejects external paths", () => {
    expect(resolveInternalRedirectPath("/orders", "/dashboard")).toBe("/orders");
    expect(resolveInternalRedirectPath("https://evil.example", "/dashboard")).toBe("/dashboard");
  });

  it("falls back to redirect when next is missing", () => {
    expect(resolveInternalRedirectPath(undefined, "/settings")).toBe("/settings");
  });

  it("builds callback url with next query", () => {
    const url = buildLoginCallbackUrl("http://localhost:3000", "/orders");
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/api/auth/callback");
    expect(parsed.searchParams.get("next")).toBe("/orders");
  });

  it("builds google admin login url", () => {
    const url = buildGoogleAdminLoginUrl("/dashboard");
    const parsed = new URL(url, "http://localhost:3000");

    expect(parsed.pathname).toBe("/api/auth/google/login");
    expect(parsed.searchParams.get("mode")).toBe("login");
    expect(parsed.searchParams.get("next")).toBe("/dashboard");
  });
});
