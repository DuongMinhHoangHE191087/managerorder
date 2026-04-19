import { describe, expect, it } from "vitest";
import { buildBotOperationalSummary } from "../status";

describe("buildBotOperationalSummary", () => {
  it("marks webhook-first runtime when telegram is fully configured", () => {
    const result = buildBotOperationalSummary({
      telegram: {
        tokenConfigured: true,
        adminChatConfigured: true,
        webhookSecretConfigured: true,
        accountConfigured: true,
        accountMatchesCurrentTenant: true,
      },
      contacts: {
        total: 50,
        matched: 30,
        autoReminderEnabled: 10,
      },
    });

    expect(result.runtimeMode).toBe("webhook-first");
    expect(result.broadcastReady).toBe(true);
    expect(result.matchedCoveragePercent).toBe(60);
    expect(result.autoReminderCoveragePercent).toBe(20);
  });

  it("falls back when webhook secret is missing", () => {
    const result = buildBotOperationalSummary({
      telegram: {
        tokenConfigured: true,
        adminChatConfigured: false,
        webhookSecretConfigured: false,
        accountConfigured: true,
        accountMatchesCurrentTenant: true,
      },
      contacts: {
        total: 0,
        matched: 0,
        autoReminderEnabled: 0,
      },
    });

    expect(result.runtimeMode).toBe("polling-fallback");
    expect(result.broadcastReady).toBe(false);
    expect(result.matchedCoveragePercent).toBe(0);
  });
});
