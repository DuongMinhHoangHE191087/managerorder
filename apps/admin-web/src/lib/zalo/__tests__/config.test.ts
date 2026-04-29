import { describe, expect, it } from "vitest";
import { canStartZaloBot, formatZaloCapabilityList, resolveZaloRuntimeConfig } from "../config";

describe("zalo config", () => {
  it("parses env and dedupes admin IDs", () => {
    const env: NodeJS.ProcessEnv = {
      ZALO_BOT_TOKEN: "00000000-0000-4000-8000-000000000163",
      ZALO_BOT_ACCOUNT_ID: "00000000-0000-4000-8000-000000000009",
      ADMIN_ZALO_USER_IDS:
        "00000000-0000-4000-8000-0000000000d0, 00000000-0000-4000-8000-0000000000d1\n00000000-0000-4000-8000-0000000003f8 ; 00000000-0000-4000-8000-000000000164",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-2.5-flash",
      APP_NAME: "ManagerOrder",
      NODE_ENV: "test",
    };
    const config = resolveZaloRuntimeConfig(env);

    expect(canStartZaloBot(config)).toBe(true);
    expect(config.accountBound).toBe(true);
    expect(config.adminUserIds).toEqual([
      "00000000-0000-4000-8000-0000000000d0",
      "00000000-0000-4000-8000-0000000000d1",
      "00000000-0000-4000-8000-0000000003f8",
      "00000000-0000-4000-8000-000000000164",
    ]);
    expect(config.capabilities.orderLookup).toBe(true);
    expect(config.capabilities.orderCreation).toBe(true);
    expect(formatZaloCapabilityList(config)).toContain("AI (Gemini)");
    expect(formatZaloCapabilityList(config)).toContain("tra cứu đơn");
    expect(formatZaloCapabilityList(config)).toContain("tạo đơn hàng");
    expect(config.warnings).toHaveLength(0);
  });

  it("keeps running with warnings when account or admins are missing", () => {
    const env: NodeJS.ProcessEnv = {
      ZALO_BOT_TOKEN: "00000000-0000-4000-8000-000000000163",
      NODE_ENV: "test",
    };
    const config = resolveZaloRuntimeConfig(env);

    expect(canStartZaloBot(config)).toBe(true);
    expect(config.accountBound).toBe(false);
    expect(config.capabilities.catalog).toBe(false);
    expect(config.capabilities.orderLookup).toBe(false);
    expect(config.capabilities.orderCreation).toBe(false);
    expect(config.capabilities.humanHandoff).toBe(false);
    expect(config.warnings.length).toBeGreaterThan(0);
  });

  it("does not fall back to telegram account env vars", () => {
    const env: NodeJS.ProcessEnv = {
      ZALO_BOT_TOKEN: "00000000-0000-4000-8000-000000000163",
      TELEGRAM_BOT_ACCOUNT_ID: "00000000-0000-4000-8000-000000000009",
      ACCOUNT_ID: "00000000-0000-4000-8000-000000000010",
      NODE_ENV: "test",
    };
    const config = resolveZaloRuntimeConfig(env);

    expect(config.accountId).toBe("");
    expect(config.accountBound).toBe(false);
    expect(config.warnings.some((warning) => warning.includes("no longer falls back"))).toBe(true);
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
