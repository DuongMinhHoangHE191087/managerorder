export type BotRuntimeMode = "webhook-first" | "polling-fallback" | "inactive";

export interface BotOperationalSummaryInput {
  telegram: {
    tokenConfigured: boolean;
    adminChatConfigured: boolean;
    webhookSecretConfigured: boolean;
    accountConfigured: boolean;
    accountMatchesCurrentTenant: boolean;
  };
  contacts: {
    total: number;
    matched: number;
    autoReminderEnabled: number;
  };
}

export interface BotOperationalSummary {
  runtimeMode: BotRuntimeMode;
  broadcastReady: boolean;
  tenantAligned: boolean;
  matchedCoveragePercent: number;
  autoReminderCoveragePercent: number;
}

function safePercent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((Math.max(0, part) / total) * 100);
}

export function buildBotOperationalSummary(
  input: BotOperationalSummaryInput,
): BotOperationalSummary {
  const total = Math.max(0, input.contacts.total);
  const matched = Math.max(0, input.contacts.matched);
  const autoReminderEnabled = Math.max(0, input.contacts.autoReminderEnabled);
  const tenantAligned = input.telegram.accountConfigured && input.telegram.accountMatchesCurrentTenant;
  const broadcastReady =
    input.telegram.tokenConfigured &&
    input.telegram.adminChatConfigured &&
    tenantAligned;

  let runtimeMode: BotRuntimeMode = "inactive";
  if (input.telegram.tokenConfigured) {
    runtimeMode =
      input.telegram.webhookSecretConfigured && tenantAligned
        ? "webhook-first"
        : "polling-fallback";
  }

  return {
    runtimeMode,
    broadcastReady,
    tenantAligned,
    matchedCoveragePercent: safePercent(matched, total),
    autoReminderCoveragePercent: safePercent(autoReminderEnabled, total),
  };
}
