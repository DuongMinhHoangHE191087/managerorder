import { describe, expect, it } from "vitest";

import { resolveBotAccountFromCandidates } from "../runtime-account";

describe("resolveBotAccountFromCandidates", () => {
  it("prefers TELEGRAM_BOT_ACCOUNT_ID when present", () => {
    const result = resolveBotAccountFromCandidates({
      telegramBotAccountId: " telegram-account ",
      accountId: "fallback-account",
      fallbackAccountIds: ["tenant-a"],
    });

    expect(result).toEqual({
      accountId: "telegram-account",
      source: "env:telegram_bot_account_id",
      warnings: [],
    });
  });

  it("falls back to ACCOUNT_ID when telegram account env is absent", () => {
    const result = resolveBotAccountFromCandidates({
      accountId: " account-id ",
      fallbackAccountIds: ["tenant-a"],
    });

    expect(result).toEqual({
      accountId: "account-id",
      source: "env:account_id",
      warnings: [],
    });
  });

  it("auto-resolves from admin_users when only one tenant exists", () => {
    const result = resolveBotAccountFromCandidates({
      fallbackAccountIds: ["tenant-a", "tenant-a", " tenant-a "],
    });

    expect(result.accountId).toBe("tenant-a");
    expect(result.source).toBe("admin_users:auto-single-tenant");
    expect(result.warnings[0]).toContain("TELEGRAM_BOT_ACCOUNT_ID is missing");
  });

  it("stays unresolved when multiple fallback tenants exist", () => {
    const result = resolveBotAccountFromCandidates({
      fallbackAccountIds: ["tenant-a", "tenant-b"],
    });

    expect(result.accountId).toBeNull();
    expect(result.source).toBe("unresolved");
    expect(result.warnings.some((warning) => warning.includes("Multiple account_id"))).toBe(true);
  });

  it("stays unresolved when no fallback tenant exists", () => {
    const result = resolveBotAccountFromCandidates({});

    expect(result.accountId).toBeNull();
    expect(result.source).toBe("unresolved");
    expect(result.warnings.some((warning) => warning.includes("No account_id"))).toBe(true);
  });
});
