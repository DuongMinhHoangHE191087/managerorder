export type TelegramRuntimeMode = "webhook" | "polling" | "disabled";
export type ZaloRuntimeMode = "polling" | "disabled";

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveTelegramRuntimeMode(
  env: NodeJS.ProcessEnv = process.env,
): TelegramRuntimeMode {
  if (!normalize(env.TELEGRAM_BOT_TOKEN)) {
    return "disabled";
  }

  const explicitMode = normalize(env.TELEGRAM_RUNTIME_MODE);
  if (explicitMode === "webhook" || explicitMode === "polling") {
    return explicitMode;
  }

  return "polling";
}

export function shouldStartTelegramPolling(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveTelegramRuntimeMode(env) === "polling";
}

export function shouldAutoRegisterTelegramWebhook(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (resolveTelegramRuntimeMode(env) !== "webhook") {
    return false;
  }

  const explicit = normalize(env.TELEGRAM_AUTO_REGISTER_WEBHOOK);
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }

  return env.NODE_ENV === "production";
}

export function resolveZaloRuntimeMode(
  env: NodeJS.ProcessEnv = process.env,
): ZaloRuntimeMode {
  if (!normalize(env.ZALO_BOT_TOKEN)) {
    return "disabled";
  }

  return normalize(env.ZALO_RUNTIME_MODE) === "disabled"
    ? "disabled"
    : "polling";
}
