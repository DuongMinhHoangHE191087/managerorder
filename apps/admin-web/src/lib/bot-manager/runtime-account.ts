import { supabaseAdmin } from "@/lib/supabase/admin";

const ACCOUNT_CACHE_TTL_MS = 5 * 60 * 1000;
const EMPTY_ACCOUNT_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

export type BotAccountResolutionSource =
  | "env:telegram_bot_account_id"
  | "env:account_id"
  | "admin_users:auto-single-tenant"
  | "unresolved";

export interface BotAccountResolution {
  accountId: string | null;
  source: BotAccountResolutionSource;
  warnings: string[];
}

type CacheEntry = {
  value: BotAccountResolution;
  expiresAt: number;
};

let cachedResolution: CacheEntry | null = null;

function normalize(value?: string | null): string {
  const normalized = (value ?? "").trim();
  // Ignore the repo's placeholder UUID so it does not force a false tenant mismatch.
  return normalized === EMPTY_ACCOUNT_PLACEHOLDER ? "" : normalized;
}

export function resolveBotAccountFromCandidates(input: {
  telegramBotAccountId?: string | null;
  accountId?: string | null;
  fallbackAccountIds?: Array<string | null | undefined>;
}): BotAccountResolution {
  const telegramBotAccountId = normalize(input.telegramBotAccountId);
  if (telegramBotAccountId) {
    return {
      accountId: telegramBotAccountId,
      source: "env:telegram_bot_account_id",
      warnings: [],
    };
  }

  const accountId = normalize(input.accountId);
  if (accountId) {
    return {
      accountId,
      source: "env:account_id",
      warnings: [],
    };
  }

  const distinctFallbackIds = Array.from(
    new Set((input.fallbackAccountIds ?? []).map((value) => normalize(value)).filter(Boolean)),
  );

  if (distinctFallbackIds.length === 1) {
    return {
      accountId: distinctFallbackIds[0],
      source: "admin_users:auto-single-tenant",
      warnings: [
        "TELEGRAM_BOT_ACCOUNT_ID is missing; using the only account_id found in admin_users.",
      ],
    };
  }

  const warnings = [
    "Unable to resolve a Telegram bot account. Configure TELEGRAM_BOT_ACCOUNT_ID or keep admin_users single-tenant.",
  ];

  if (distinctFallbackIds.length > 1) {
    warnings.push("Multiple account_id values exist in admin_users, so auto-resolution is unsafe.");
  } else {
    warnings.push("No account_id value was found in admin_users.");
  }

  return {
    accountId: null,
    source: "unresolved",
    warnings,
  };
}

async function loadFallbackAccountIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("account_id")
    .not("account_id", "is", null)
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => normalize(row.account_id)).filter(Boolean);
}

export async function resolveTelegramBotAccount(options?: {
  env?: NodeJS.ProcessEnv;
  forceRefresh?: boolean;
}): Promise<BotAccountResolution> {
  const env = options?.env ?? process.env;
  const now = Date.now();

  if (!options?.forceRefresh && cachedResolution && cachedResolution.expiresAt > now) {
    return cachedResolution.value;
  }

  let fallbackAccountIds: string[] = [];
  try {
    fallbackAccountIds = await loadFallbackAccountIds();
  } catch (error) {
    const unresolved: BotAccountResolution = {
      accountId: null,
      source: "unresolved",
      warnings: [
        error instanceof Error
          ? `Failed to inspect admin_users for bot account fallback: ${error.message}`
          : "Failed to inspect admin_users for bot account fallback.",
      ],
    };
    cachedResolution = {
      value: unresolved,
      expiresAt: now + ACCOUNT_CACHE_TTL_MS,
    };
    return unresolved;
  }

  const resolution = resolveBotAccountFromCandidates({
    telegramBotAccountId: env.TELEGRAM_BOT_ACCOUNT_ID,
    accountId: env.ACCOUNT_ID,
    fallbackAccountIds,
  });

  cachedResolution = {
    value: resolution,
    expiresAt: now + ACCOUNT_CACHE_TTL_MS,
  };

  return resolution;
}

export function resetTelegramBotAccountResolutionCache(): void {
  cachedResolution = null;
}
