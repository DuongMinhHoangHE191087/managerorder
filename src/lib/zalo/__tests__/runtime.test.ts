import { describe, expect, it, vi } from "vitest";
import { createZaloRuntime, registerZaloHandlers } from "../index";
import type {
  ZaloBotLike,
  ZaloCommandContext,
  ZaloMessageLike,
  ZaloMode,
  ZaloRuntimeConfig,
} from "../types";

function makeConfig(overrides: Partial<ZaloRuntimeConfig> = {}): ZaloRuntimeConfig {
  const { capabilities: overrideCapabilities, warnings: overrideWarnings, ...rest } = overrides;
  const capabilities = {
    ai: true,
    catalog: true,
    orderLookup: true,
    humanHandoff: true,
    adminNotify: true,
    gemini: true,
    ...(overrideCapabilities ?? {}),
  };

  return {
    botToken: "token-123",
    accountId: "account-1",
    adminUserIds: ["admin-1", "admin-2"],
    geminiApiKey: "gemini-key",
    geminiModel: "gemini-2.5-flash",
    appName: "ManagerOrder",
    accountBound: true,
    ...rest,
    capabilities,
    warnings: overrideWarnings ?? [],
  };
}

function createFakeMessage(chatId = "chat-1", userId = "user-1", displayName = "Nguyen A") {
  const replies: string[] = [];
  const message: ZaloMessageLike = {
    chat: { id: chatId },
    fromUser: { id: userId, displayName },
    text: "",
    replyText: vi.fn(async (text: string) => {
      replies.push(text);
      return {};
    }),
  };

  return { message, replies };
}

function createFakeBot() {
  const commandHandlers = new Map<string, (message: ZaloMessageLike, context: ZaloCommandContext) => Promise<void> | void>();
  let textHandler: ((message: ZaloMessageLike, metadata?: unknown) => Promise<void> | void) | undefined;
  const sentMessages: Array<{ chatId: string; text: string }> = [];

  const bot: ZaloBotLike = {
    command(command, callback) {
      commandHandlers.set(command, callback);
      return this;
    },
    on(event, callback) {
      if (event === "text") textHandler = callback;
      return this;
    },
    onError: vi.fn(),
    initialize: vi.fn(async () => {}),
    deleteWebhook: vi.fn(async () => true),
    startPolling: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    sendMessage: vi.fn(async (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return {};
    }),
    sendChatAction: vi.fn(async () => true),
    getMe: vi.fn(async () => ({ id: "bot-1", displayName: "ManagerOrder Zalo Bot" })),
  };

  return { bot, commandHandlers, get textHandler() { return textHandler; }, sentMessages };
}

function createFakeModeStore(initialMode: ZaloMode = "sales-ai") {
  let mode: ZaloMode = initialMode;
  return {
    getMode: vi.fn(async () => mode),
    setMode: vi.fn(async (_accountId: string, _chatId: string, nextMode: ZaloMode, _updatedBy?: string) => {
      mode = nextMode;
    }),
    clearMode: vi.fn(async () => {
      mode = "sales-ai";
    }),
    get currentMode() {
      return mode;
    },
  };
}

describe("zalo runtime", () => {
  it("routes product, lookup, human, ai, and id commands", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const dataService = {
      listProducts: vi.fn(async () => [
        {
          id: "p-1",
          name: "ChatGPT Plus",
          mode: "key",
          durationType: "months",
          durationValue: 1,
          sellPriceVnd: 199000,
          buyPriceVnd: 100000,
          isActive: true,
          createdAt: "2026-04-08T00:00:00.000Z",
        },
      ]),
      searchOrders: vi.fn(async () => [
        {
          id: "o-1",
          orderCode: "DMH_A1B2",
          customerName: "Nguyen A",
          productNameSnapshot: "ChatGPT Plus",
          totalAmountVnd: 199000,
          totalPaid: 99000,
          status: "pending_payment",
          expiresAt: "2026-05-01T00:00:00.000Z",
          createdAt: "2026-04-08T00:00:00.000Z",
        },
      ]),
    };
    const assistant = {
      replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
    };
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, { bot: fakeBot.bot, dataService, assistant, modeStore });

    const productMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("product")?.(productMessage.message, { command: { name: "product", argsRaw: "", args: [] } });
    expect(productMessage.replies.join("\n")).toContain("ChatGPT Plus");

    const lookupMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("tracuu")?.(lookupMessage.message, { command: { name: "tracuu", argsRaw: "DMH_A1B2", args: ["DMH_A1B2"] } });
    expect(lookupMessage.replies.join("\n")).toContain("DMH_A1B2");
    expect(lookupMessage.replies.join("\n")).toContain("Nguyen A");

    const humanMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("human")?.(humanMessage.message, { command: { name: "human", argsRaw: "", args: [] } });
    expect(modeStore.currentMode).toBe("human-handoff");
    expect(fakeBot.sentMessages.length).toBeGreaterThan(0);

    const aiMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("ai")?.(aiMessage.message, { command: { name: "ai", argsRaw: "", args: [] } });
    expect(modeStore.currentMode).toBe("sales-ai");

    const idMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("id")?.(idMessage.message, { command: { name: "id", argsRaw: "", args: [] } });
    expect(idMessage.replies.join("\n")).toContain("account-1");
    expect(idMessage.replies.join("\n")).toContain("sales-ai");
  });

  it("forwards normal text to the sales assistant and respects human handoff", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const assistant = {
      replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
    };
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      assistant,
      modeStore,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
    });

    const normalMessage = createFakeMessage();
    normalMessage.message.text = "Cho mình tư vấn gói premium";
    await fakeBot.textHandler?.(normalMessage.message);
    expect(normalMessage.replies[0]).toContain("AI:Cho mình tư vấn gói premium");

    await modeStore.setMode("account-1", "chat-1", "human-handoff", "user-1");
    const humanMessage = createFakeMessage();
    humanMessage.message.text = "Mình cần hỗ trợ";
    await fakeBot.textHandler?.(humanMessage.message);
    expect(assistant.replyToSalesQuery).toHaveBeenCalledTimes(1);
    expect(fakeBot.sentMessages.length).toBeGreaterThan(0);
  });

  it("boots cleanly, notifies admins, and starts polling", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const config = makeConfig();

    const runtime = await createZaloRuntime(config, {
      bot: fakeBot.bot,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
      assistant: {
        replyToSalesQuery: vi.fn(async () => "AI reply"),
      },
      modeStore,
    });

    await runtime.start();

    expect(fakeBot.bot.initialize).toHaveBeenCalledTimes(1);
    expect(fakeBot.bot.deleteWebhook).toHaveBeenCalledTimes(1);
    expect(fakeBot.bot.getMe).toHaveBeenCalledTimes(1);
    expect(fakeBot.bot.startPolling).toHaveBeenCalledTimes(1);
    expect(fakeBot.sentMessages.length).toBeGreaterThan(0);
    expect(fakeBot.sentMessages[0]?.text).toContain("bot đã chạy thành công");
  });
});
