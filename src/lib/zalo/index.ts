import { upsertBotUserContact } from "../bot-manager/bot-contacts";
import { buildSalesReply } from "./assistant";
import { canStartZaloBot, describeZaloRuntime, resolveZaloRuntimeConfig } from "./config";
import {
  formatZaloAdminForward,
  formatZaloAiAck,
  formatZaloFeatureUnavailableMessage,
  formatZaloHelpMessage,
  formatZaloIdStatus,
  formatZaloHumanAck,
  formatZaloOrderLookup,
  formatZaloProductCatalog,
  formatZaloStartupNotification,
  formatZaloWelcomeMessage,
} from "./messages";
import { clearZaloMode, getZaloMode, setZaloMode, zaloModeStore } from "./store";
import type {
  ZaloAssistantService,
  ZaloBotLike,
  ZaloCommandContext,
  ZaloDataService,
  ZaloMessageLike,
  ZaloModeStore,
  ZaloRuntimeConfig,
  ZaloRuntimeDeps,
  ZaloRuntimeHandle,
} from "./types";
import { createZaloBot } from "./sdk";

function createLogger(logger: Pick<Console, "log" | "warn" | "error"> = console) {
  return logger;
}

function createBot(config: ZaloRuntimeConfig): ZaloBotLike {
  return createZaloBot(config.botToken);
}

function createDisabledDataService(): ZaloDataService {
  return {
    async listProducts() {
      return [];
    },
    async searchOrders() {
      return [];
    },
  };
}

function createDefaultAssistant(): ZaloAssistantService {
  return {
    async replyToSalesQuery(input) {
      return buildSalesReply(input);
    },
  };
}

function getActor(message: ZaloMessageLike) {
  return {
    userId: message.fromUser?.id ?? "unknown",
    displayName: message.fromUser?.displayName ?? message.fromUser?.accountName ?? undefined,
  };
}

function isCommandText(text: string): boolean {
  return text.trim().startsWith("/");
}

function isHumanRequest(text: string): boolean {
  return /(?:^|\s)(?:gặp nhân viên|gặp nv|nhan vien|nhân viên|human)(?:\s|$)/i.test(text);
}

function isAiRequest(text: string): boolean {
  return /(?:^|\s)(?:\/ai|bật ai|bat ai|quay lại ai|quay lai ai|sales-ai)(?:\s|$)/i.test(text);
}

function isLookupRequest(text: string): boolean {
  return /^(?:\/tracuu|\/tra\s*c[uú]u|tracuu|tra\s*c[uú]u|m[aã]\s*don|ma\s*don|ki[eể]m\s*tra\s*don|order)\b/i.test(text);
}

function extractLookupTerm(text: string): string {
  const trimmed = text.trim();
  const matched = trimmed.match(/^(?:\/tracuu|\/tra\s*c[uú]u|tracuu|tra\s*c[uú]u|m[aã]\s*don|ma\s*don|ki[eể]m\s*tra\s*don|order)\s*(.*)$/i);
  return (matched?.[1] ?? trimmed).trim();
}

async function notifyAdmins(
  bot: ZaloBotLike,
  adminIds: string[],
  message: string,
  logger: Pick<Console, "log" | "warn" | "error">,
): Promise<void> {
  if (adminIds.length === 0) return;

  const results = await Promise.allSettled(adminIds.map((adminId) => bot.sendMessage(adminId, message)));
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      logger.warn(`[Zalo] Failed to notify admin ${adminIds[index]}:`, result.reason);
    }
  }
}

async function resolveDataService(config: ZaloRuntimeConfig, deps: ZaloRuntimeDeps): Promise<ZaloDataService> {
  if (deps.dataService) return deps.dataService;
  if (!config.accountBound) return createDisabledDataService();
  try {
    const dataModule = await import("./data");
    return dataModule.zaloDataService;
  } catch (error) {
    deps.logger?.warn?.("[Zalo] Failed to load Supabase-backed data service; falling back to disabled mode.", error);
    return createDisabledDataService();
  }
}

function resolveModeStore(deps: ZaloRuntimeDeps): ZaloModeStore {
  return deps.modeStore ?? {
    getMode: getZaloMode,
    setMode: setZaloMode,
    clearMode: clearZaloMode,
  };
}

export function registerZaloHandlers(
  bot: ZaloBotLike,
  config: ZaloRuntimeConfig,
  deps: ZaloRuntimeDeps = {},
): void {
  const logger = createLogger(deps.logger);
  const assistant = deps.assistant ?? createDefaultAssistant();
  const modeStore = resolveModeStore(deps);
  const dataServicePromise = resolveDataService(config, deps);
  const syncContact = async (message: ZaloMessageLike) => {
    if (!config.accountBound) return;

    const actor = getActor(message);
    if (!actor.userId || actor.userId === "unknown") return;

    try {
      await upsertBotUserContact({
        accountId: config.accountId,
        channel: "zalo",
        externalUserId: actor.userId,
        chatId: message.chat.id,
        displayName: actor.displayName,
        lastMessageText: message.text ?? null,
        metadata: {
          fromUser: message.fromUser ?? null,
        },
      });
    } catch (error) {
      logger.warn("[Zalo] Failed to sync bot contact:", error);
    }
  };

  bot.onError?.((error, context) => {
    logger.error("[Zalo] Bot error:", error, context);
  });

  const handleStart = async (message: ZaloMessageLike) => {
    await syncContact(message);
    const dataService = await dataServicePromise;
    const products = config.capabilities.catalog
      ? await dataService.listProducts(config.accountId, undefined, 3)
      : [];
    await message.replyText(formatZaloWelcomeMessage(config, products));
  };

  const handleHelp = async (message: ZaloMessageLike) => {
    await syncContact(message);
    await message.replyText(formatZaloHelpMessage(config));
  };

  const handleProduct = async (message: ZaloMessageLike, context: ZaloCommandContext) => {
    await syncContact(message);
    if (!config.capabilities.catalog) {
      await message.replyText(formatZaloFeatureUnavailableMessage("catalog", "Cần cấu hình ZALO_BOT_ACCOUNT_ID hoặc TELEGRAM_BOT_ACCOUNT_ID."));
      return;
    }

    const dataService = await dataServicePromise;
    const query = context.command?.argsRaw?.trim() || "";
    const products = await dataService.listProducts(config.accountId, query || undefined, 5);
    await message.replyText(formatZaloProductCatalog(products, query || undefined));
  };

  const handleOrderLookup = async (message: ZaloMessageLike, context: ZaloCommandContext) => {
    await syncContact(message);
    if (!config.capabilities.orderLookup) {
      await message.replyText(formatZaloFeatureUnavailableMessage("tra cứu đơn", "Cần cấu hình ZALO_BOT_ACCOUNT_ID hoặc TELEGRAM_BOT_ACCOUNT_ID."));
      return;
    }

    const query = context.command?.argsRaw?.trim() || "";
    if (!query) {
      await message.replyText("Nhắn /tracuu <mã đơn|SĐT> để tra cứu đơn.");
      return;
    }

    const dataService = await dataServicePromise;
    const orders = await dataService.searchOrders(config.accountId, query, 5);
    await message.replyText(formatZaloOrderLookup(query, orders));
  };

  const handleHuman = async (message: ZaloMessageLike) => {
    await syncContact(message);
    if (!config.capabilities.humanHandoff) {
      await message.replyText(formatZaloFeatureUnavailableMessage("human-handoff", "Cần cấu hình ADMIN_ZALO_USER_IDS."));
      return;
    }

    const actor = getActor(message);
    await modeStore.setMode(config.accountId, message.chat.id, "human-handoff", actor.userId);
    await message.replyText(formatZaloHumanAck(config));
    await notifyAdmins(
      bot,
      config.adminUserIds,
      formatZaloAdminForward({
        userId: actor.userId,
        chatId: message.chat.id,
        displayName: actor.displayName,
        text: "Khách yêu cầu gặp nhân viên.",
        mode: "human-handoff",
      }),
      logger,
    );
  };

  const handleAi = async (message: ZaloMessageLike) => {
    await syncContact(message);
    await modeStore.clearMode(config.accountId, message.chat.id);
    await message.replyText(formatZaloAiAck());
  };

  const handleId = async (message: ZaloMessageLike) => {
    await syncContact(message);
    const actor = getActor(message);
    const mode = await modeStore.getMode(config.accountId, message.chat.id);
    await message.replyText(
      formatZaloIdStatus({
        userId: actor.userId,
        chatId: message.chat.id,
        accountId: config.accountId,
        mode,
        capabilities: config.capabilities,
        adminCount: config.adminUserIds.length,
        displayName: actor.displayName,
      }),
    );
  };

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("product", handleProduct);
  bot.command("sanpham", handleProduct);
  bot.command("tracuu", handleOrderLookup);
  bot.command("id", handleId);
  bot.command("nhanvien", handleHuman);
  bot.command("human", handleHuman);
  bot.command("ai", handleAi);

  bot.on("text", async (message) => {
    await syncContact(message);
    const text = (message.text ?? "").trim();
    if (!text || isCommandText(text)) return;

    const actor = getActor(message);
    const currentMode = await modeStore.getMode(config.accountId, message.chat.id);

    if (currentMode === "human-handoff") {
      if (config.capabilities.adminNotify) {
        await notifyAdmins(
          bot,
          config.adminUserIds,
          formatZaloAdminForward({
            userId: actor.userId,
            chatId: message.chat.id,
            displayName: actor.displayName,
            text,
            mode: currentMode,
          }),
          logger,
        );
      }
      return;
    }

    if (isHumanRequest(text)) {
      if (config.capabilities.humanHandoff) {
        await modeStore.setMode(config.accountId, message.chat.id, "human-handoff", actor.userId);
        await message.replyText(formatZaloHumanAck(config));
        await notifyAdmins(
          bot,
          config.adminUserIds,
          formatZaloAdminForward({
            userId: actor.userId,
            chatId: message.chat.id,
            displayName: actor.displayName,
            text,
            mode: "human-handoff",
          }),
          logger,
        );
      } else {
        await message.replyText(formatZaloFeatureUnavailableMessage("human-handoff", "Cần cấu hình ADMIN_ZALO_USER_IDS."));
      }
      return;
    }

    if (isAiRequest(text)) {
      await modeStore.clearMode(config.accountId, message.chat.id);
      await message.replyText(formatZaloAiAck());
      return;
    }

    if (isLookupRequest(text) && config.capabilities.orderLookup) {
      const dataService = await dataServicePromise;
      const lookupTerm = extractLookupTerm(text);
      const orders = await dataService.searchOrders(config.accountId, lookupTerm, 5);
      await message.replyText(formatZaloOrderLookup(lookupTerm, orders));
      return;
    }

    const dataService = await dataServicePromise;
    const products = config.capabilities.catalog
      ? await dataService.listProducts(config.accountId, undefined, 5)
      : [];
    const reply = await assistant.replyToSalesQuery({
      query: text,
      products,
      config: {
        appName: config.appName,
        geminiApiKey: config.geminiApiKey,
        geminiModel: config.geminiModel,
        accountBound: config.accountBound,
      },
    });
    await message.replyText(reply);
  });
}

export async function createZaloRuntime(
  config: ZaloRuntimeConfig,
  deps: ZaloRuntimeDeps = {},
): Promise<ZaloRuntimeHandle> {
  const logger = createLogger(deps.logger);
  const bot = deps.bot ?? createBot(config);
  registerZaloHandlers(bot, config, deps);

  let stopping = false;

  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await bot.shutdown().catch((error) => {
      logger.warn("[Zalo] Failed to shutdown bot cleanly:", error);
    });
  };

  const start = async (): Promise<void> => {
    await bot.initialize();
    if (bot.deleteWebhook) {
      await bot.deleteWebhook({ dropPendingUpdates: true }).catch((error) => {
        logger.warn("[Zalo] Failed to delete webhook before polling:", error);
        return false;
      });
    }

    const me = bot.cachedUser ?? (await bot.getMe());
    const startupMessage = formatZaloStartupNotification({
      botName: me.displayName ?? me.accountName ?? config.appName,
      botUserId: me.id,
      accountId: config.accountId,
      capabilities: config.capabilities,
      adminCount: config.adminUserIds.length,
      startedAt: new Date(),
    });

    await notifyAdmins(bot, config.adminUserIds, startupMessage, logger);
    logger.log(`[Zalo] Runtime ready: ${describeZaloRuntime(config)}`);
    await bot.startPolling({
      timeoutSeconds: 30,
      retryDelayMs: 1000,
      allowedUpdates: ["message"],
    });
  };

  return { bot, config, start, stop };
}

export async function startZaloBot(
  env: NodeJS.ProcessEnv = process.env,
  deps: ZaloRuntimeDeps = {},
): Promise<ZaloRuntimeHandle | null> {
  const config = resolveZaloRuntimeConfig(env);
  if (!canStartZaloBot(config)) {
    deps.logger?.warn?.("[Zalo] ZALO_BOT_TOKEN is missing; skipping bot startup.");
    return null;
  }

  return createZaloRuntime(config, deps);
}

export {
  canStartZaloBot,
  describeZaloRuntime,
  resolveZaloRuntimeConfig,
  zaloModeStore,
};

export { formatZaloCapabilityList } from "./config";
