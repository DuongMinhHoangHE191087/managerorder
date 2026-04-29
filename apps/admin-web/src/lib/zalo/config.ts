import type { ZaloCapabilities, ZaloRuntimeConfig } from "./types";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_APP_NAME = "ManagerOrder";

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function parseList(raw: string | undefined): string[] {
  const unique = new Set(
    normalize(raw)
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return Array.from(unique);
}

function buildCapabilities(input: {
  botToken: string;
  accountBound: boolean;
  adminUserIds: string[];
  geminiApiKey: string;
}): ZaloCapabilities {
  return {
    ai: Boolean(input.botToken),
    catalog: input.accountBound,
    orderLookup: input.accountBound,
    orderCreation: input.accountBound,
    humanHandoff: input.adminUserIds.length > 0,
    adminNotify: input.adminUserIds.length > 0,
    gemini: Boolean(input.geminiApiKey),
  };
}

export function resolveZaloRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ZaloRuntimeConfig {
  const warnings: string[] = [];
  const botToken = normalize(env.ZALO_BOT_TOKEN);
  const accountId = normalize(env.ZALO_BOT_ACCOUNT_ID);
  const adminUserIds = parseList(env.ADMIN_ZALO_USER_IDS);
  const geminiApiKey = normalize(env.GEMINI_API_KEY);
  const geminiModel = normalize(env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;
  const appName = normalize(env.APP_NAME) || normalize(env.NEXT_PUBLIC_APP_NAME) || DEFAULT_APP_NAME;
  const accountBound = Boolean(accountId);

  if (!botToken) {
    warnings.push("Missing ZALO_BOT_TOKEN; Zalo bot will be skipped.");
  }
  if (!accountBound) {
    const telegramAccountId = normalize(env.TELEGRAM_BOT_ACCOUNT_ID);
    const legacyAccountId = normalize(env.ACCOUNT_ID);
    if (telegramAccountId || legacyAccountId) {
      warnings.push("Missing ZALO_BOT_ACCOUNT_ID; Zalo no longer falls back to TELEGRAM_BOT_ACCOUNT_ID or ACCOUNT_ID.");
    } else {
      warnings.push("Missing ZALO_BOT_ACCOUNT_ID; product, order lookup, and order creation will be disabled.");
    }
  }
  if (adminUserIds.length === 0) {
    warnings.push("Missing ADMIN_ZALO_USER_IDS; startup notifications and human handoff will be disabled.");
  }

  return {
    botToken,
    accountId,
    adminUserIds,
    geminiApiKey,
    geminiModel,
    appName,
    accountBound,
    capabilities: buildCapabilities({ botToken, accountBound, adminUserIds, geminiApiKey }),
    warnings,
  };
}

export function canStartZaloBot(config: ZaloRuntimeConfig): boolean {
  return Boolean(config.botToken);
}

export function formatZaloCapabilityList(config: ZaloRuntimeConfig): string[] {
  const capabilities: string[] = [];

  if (config.capabilities.ai) {
    capabilities.push(config.capabilities.gemini ? "AI (Gemini)" : "AI (fallback)");
  }
  if (config.capabilities.catalog) capabilities.push("catalog");
  if (config.capabilities.orderLookup) capabilities.push("tra cứu đơn");
  if (config.capabilities.orderCreation) capabilities.push("tạo đơn hàng");
  if (config.capabilities.humanHandoff) capabilities.push("human-handoff");
  if (config.capabilities.adminNotify) capabilities.push("admin notify");
  if (config.capabilities.gemini && !capabilities.includes("AI (Gemini)")) {
    capabilities.push("Gemini");
  }

  return capabilities;
}

export function describeZaloRuntime(config: ZaloRuntimeConfig): string {
  const parts = [
    `app=${config.appName}`,
    `account=${config.accountId || "unset"}`,
    `admins=${config.adminUserIds.length}`,
    `ai=${config.capabilities.ai ? "on" : "off"}`,
    `catalog=${config.capabilities.catalog ? "on" : "off"}`,
    `lookup=${config.capabilities.orderLookup ? "on" : "off"}`,
    `order=${config.capabilities.orderCreation ? "on" : "off"}`,
    `handoff=${config.capabilities.humanHandoff ? "on" : "off"}`,
    `gemini=${config.capabilities.gemini ? "on" : "off"}`,
  ];

  return parts.join(", ");
}
