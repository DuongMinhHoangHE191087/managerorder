import { describe, expect, it } from "vitest";
import { canStartZaloBot, formatZaloCapabilityList, resolveZaloRuntimeConfig } from "../config";

describe("zalo config", () => {
  it("parses env and dedupes admin IDs", () => {
    const env: NodeJS.ProcessEnv = {
      ZALO_BOT_TOKEN: "token-123",
      ZALO_BOT_ACCOUNT_ID: "account-1",
      ADMIN_ZALO_USER_IDS: "admin-1, admin-2\nadmin-1 ; admin-3",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-2.5-flash",
      APP_NAME: "ManagerOrder",
      NODE_ENV: "test",
    };
    const config = resolveZaloRuntimeConfig(env);

    expect(canStartZaloBot(config)).toBe(true);
    expect(config.accountBound).toBe(true);
    expect(config.adminUserIds).toEqual(["admin-1", "admin-2", "admin-3"]);
    expect(config.capabilities.orderLookup).toBe(true);
    expect(formatZaloCapabilityList(config)).toContain("AI (Gemini)");
    expect(formatZaloCapabilityList(config)).toContain("tra cứu đơn");
    expect(config.warnings).toHaveLength(0);
  });

  it("keeps running with warnings when account or admins are missing", () => {
    const env: NodeJS.ProcessEnv = {
      ZALO_BOT_TOKEN: "token-123",
      NODE_ENV: "test",
    };
    const config = resolveZaloRuntimeConfig(env);

    expect(canStartZaloBot(config)).toBe(true);
    expect(config.accountBound).toBe(false);
    expect(config.capabilities.catalog).toBe(false);
    expect(config.capabilities.orderLookup).toBe(false);
    expect(config.capabilities.humanHandoff).toBe(false);
    expect(config.warnings.length).toBeGreaterThan(0);
  });

  it("disables startup when token is missing", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
    };
    const config = resolveZaloRuntimeConfig(env);

    expect(canStartZaloBot(config)).toBe(false);
    expect(config.warnings).toContain("Missing ZALO_BOT_TOKEN; Zalo bot will be skipped.");
  });
});
