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
import { createZaloOrderWizard } from "./order-wizard";
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

function parseSlashCommandText(text: string): ZaloCommandContext["command"] | null {
  const normalized = text.trim();
  if (!normalized.startsWith("/") || normalized.length <= 1) {
    return null;
  }

  const body = normalized.slice(1);
  const [rawName, ...rest] = body.split(/\s+/);
  const name = rawName.split("@")[0]?.trim().toLowerCase() ?? "";
  if (!name) {
    return null;
  }

  const argsRaw = rest.join(" ").trim();
  return {
    name,
    argsRaw,
    args: argsRaw ? argsRaw.split(/\s+/) : [],
  };
}

function isHumanRequest(text: string): boolean {
  return /(?:^|\s)(?:gặp nhân viên|gặp nv|nhan vien|nhân viên|human)(?:\s|$)/i.test(text);
}

function isAiRequest(text: string): boolean {
  return /(?:^|\s)(?:\/ai|bật ai|bat ai|quay lại ai|quay lai ai|sales-ai)(?:\s|$)/i.test(text);
}

function isLookupRequest(text: string): boolean {
  const trimmed = text.trim();
  const compact = trimmed.replace(/[\s.-]/g, "");
  return /^(?:\/tracuu|\/tra\s*c[uú]u|\/kiemtra|\/ki[eể]m\s*tra|\/kt|tracuu|tra\s*c[uú]u|ki[eể]m\s*tra\s*(?:don|đơn)?|m[aã]\s*don|ma\s*don|order)\b/i.test(trimmed)
    || /^(?:\+?84|0)\d{8,10}$/.test(compact)
    || (/^[a-z0-9][a-z0-9_-]{4,}$/i.test(trimmed) && /\d/.test(trimmed));
}

function extractLookupTerm(text: string): string {
  const trimmed = text.trim();
  const matched = trimmed.match(/^(?:\/tracuu|\/tra\s*c[uú]u|\/kiemtra|\/ki[eể]m\s*tra|\/kt|tracuu|tra\s*c[uú]u|ki[eể]m\s*tra\s*(?:don|đơn)?|m[aã]\s*don|ma\s*don|order)\s*(.*)$/i);
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
  const handledCommandMessages = new WeakSet<ZaloMessageLike>();
  const dataServicePromise = resolveDataService(config, deps);
  const orderWizard = createZaloOrderWizard(config.accountId, {
    dataService: dataServicePromise,
    logger,
    orderWizardStore: deps.orderWizardStore,
    services: deps.orderWizardServices,
  });
  const safeReplyText = async (message: ZaloMessageLike, replyText: string, context: string) => {
    try {
      await message.replyText(replyText);
    } catch (error) {
      logger.error(`[Zalo] Failed to reply in ${context}:`, error);
    }
  };
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
    await safeReplyText(message, formatZaloWelcomeMessage(config, products), "start");
  };

  const handleHelp = async (message: ZaloMessageLike) => {
    await syncContact(message);
    await safeReplyText(message, formatZaloHelpMessage(config), "help");
  };

  const handleProduct = async (message: ZaloMessageLike, context: ZaloCommandContext) => {
    await syncContact(message);
    if (!config.capabilities.catalog) {
      await safeReplyText(message, formatZaloFeatureUnavailableMessage("catalog", "Cần cấu hình ZALO_BOT_ACCOUNT_ID riêng cho Zalo."), "product_unavailable");
      return;
    }

    const dataService = await dataServicePromise;
    const query = context.command?.argsRaw?.trim() || "";
    const products = await dataService.listProducts(config.accountId, query || undefined, 5);
    await safeReplyText(message, formatZaloProductCatalog(products, query || undefined), "product");
  };

  const handleOrderLookup = async (message: ZaloMessageLike, context: ZaloCommandContext) => {
    await syncContact(message);
    if (!config.capabilities.orderLookup) {
      await safeReplyText(message, formatZaloFeatureUnavailableMessage("tra cứu đơn", "Cần cấu hình ZALO_BOT_ACCOUNT_ID riêng cho Zalo."), "lookup_unavailable");
      return;
    }

    const query = context.command?.argsRaw?.trim() || "";
    if (!query) {
      await safeReplyText(message, "Nhắn /tracuu <mã đơn|SĐT>, /kiemtra <mã đơn|SĐT> hoặc /kt <mã đơn|SĐT> để tra cứu đơn.", "lookup_empty");
      return;
    }

    try {
      const dataService = await dataServicePromise;
      const orders = await dataService.searchOrders(config.accountId, query, 5);
      await safeReplyText(message, formatZaloOrderLookup(query, orders), "lookup");
    } catch (error) {
      logger.error("[Zalo] Order lookup failed:", error);
      await safeReplyText(message, `Không thể tra cứu "${query}" lúc này. Vui lòng thử lại với /kt <mã đơn|SĐT> hoặc liên hệ người bán.`, "lookup_error");
    }
  };

  const handleHuman = async (message: ZaloMessageLike) => {
    await syncContact(message);
    if (!config.capabilities.humanHandoff) {
      await safeReplyText(message, formatZaloFeatureUnavailableMessage("human-handoff", "Cần cấu hình ADMIN_ZALO_USER_IDS."), "human_unavailable");
      return;
    }

    const actor = getActor(message);
    if (await orderWizard.hasSession(message.chat.id)) {
      await orderWizard.clear(message.chat.id);
    }
    await modeStore.setMode(config.accountId, message.chat.id, "human-handoff", actor.userId);
    await safeReplyText(message, formatZaloHumanAck(config), "human");
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
    if (await orderWizard.hasSession(message.chat.id)) {
      await orderWizard.clear(message.chat.id);
    }
    await modeStore.clearMode(config.accountId, message.chat.id);
    await safeReplyText(message, formatZaloAiAck(), "ai");
  };

  const handleNewOrderStart = async (message: ZaloMessageLike) => {
    await syncContact(message);
    if (!config.capabilities.orderCreation) {
      await safeReplyText(
        message,
        formatZaloFeatureUnavailableMessage("tạo đơn hàng", "Cần cấu hình ZALO_BOT_ACCOUNT_ID riêng cho Zalo."),
        "neworder_unavailable",
      );
      return;
    }

    await orderWizard.clear(message.chat.id);
    await modeStore.clearMode(config.accountId, message.chat.id);
    await orderWizard.start(message);
  };

  const handleCancel = async (message: ZaloMessageLike) => {
    await syncContact(message);
    await orderWizard.cancel(message);
  };

  const handleId = async (message: ZaloMessageLike) => {
    await syncContact(message);
    const actor = getActor(message);
    const mode = await modeStore.getMode(config.accountId, message.chat.id);
    await safeReplyText(
      message,
      formatZaloIdStatus({
        userId: actor.userId,
        chatId: message.chat.id,
        accountId: config.accountId,
        mode,
        capabilities: config.capabilities,
        adminCount: config.adminUserIds.length,
        displayName: actor.displayName,
      }),
      "id",
    );
  };

  const commandHandlers: Record<string, (message: ZaloMessageLike, context: ZaloCommandContext) => Promise<void>> = {
    start: handleStart,
    help: handleHelp,
    product: handleProduct,
    sanpham: handleProduct,
    tracuu: handleOrderLookup,
    kiemtra: handleOrderLookup,
    kt: handleOrderLookup,
    neworder: handleNewOrderStart,
    cancel: handleCancel,
    id: handleId,
    nhanvien: handleHuman,
    human: handleHuman,
    ai: handleAi,
  };

  const dispatchSlashCommand = async (message: ZaloMessageLike, text: string): Promise<boolean> => {
    const command = parseSlashCommandText(text);
    if (!command) {
      return false;
    }

    const handler = commandHandlers[command.name];
    if (!handler) {
      return false;
    }

    handledCommandMessages.add(message);
    await handler(message, { command });
    return true;
  };

  for (const [command, handler] of Object.entries(commandHandlers)) {
    bot.command(command, async (message, context) => {
      if (handledCommandMessages.has(message)) {
        handledCommandMessages.delete(message);
        return;
      }

      await handler(message, context);
    });
  }

  bot.on("text", async (message) => {
    await syncContact(message);
    const text = (message.text ?? "").trim();
    if (!text) return;

    if (isCommandText(text)) {
      if (await dispatchSlashCommand(message, text)) {
        return;
      }
      return;
    }

    if (isHumanRequest(text)) {
      await handleHuman(message);
      return;
    }

    if (isAiRequest(text)) {
      await handleAi(message);
      return;
    }

    if (await orderWizard.handleText(message)) {
      return;
    }

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
        await safeReplyText(message, formatZaloHumanAck(config), "text_human");
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
        await safeReplyText(message, formatZaloFeatureUnavailableMessage("human-handoff", "Cần cấu hình ADMIN_ZALO_USER_IDS."), "text_human_unavailable");
      }
      return;
    }

    if (isAiRequest(text)) {
      await modeStore.clearMode(config.accountId, message.chat.id);
      await safeReplyText(message, formatZaloAiAck(), "text_ai");
      return;
    }

    if (isLookupRequest(text)) {
      if (!config.capabilities.orderLookup) {
        await safeReplyText(message, formatZaloFeatureUnavailableMessage("tra cứu đơn", "Cần cấu hình ZALO_BOT_ACCOUNT_ID hoặc TELEGRAM_BOT_ACCOUNT_ID."), "text_lookup_unavailable");
        return;
      }

      const lookupTerm = extractLookupTerm(text);
      if (!lookupTerm) {
        await safeReplyText(message, "Nhắn /kt <mã đơn|SĐT> để tra cứu đơn.", "text_lookup_empty");
        return;
      }

      try {
        const dataService = await dataServicePromise;
        const orders = await dataService.searchOrders(config.accountId, lookupTerm, 5);
        await safeReplyText(message, formatZaloOrderLookup(lookupTerm, orders), "text_lookup");
      } catch (error) {
        logger.error("[Zalo] Text order lookup failed:", error);
        await safeReplyText(message, `Không thể tra cứu "${lookupTerm}" lúc này. Vui lòng thử lại với /kt <mã đơn|SĐT> hoặc liên hệ người bán.`, "text_lookup_error");
      }
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
    await safeReplyText(message, reply, "sales_ai");
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
