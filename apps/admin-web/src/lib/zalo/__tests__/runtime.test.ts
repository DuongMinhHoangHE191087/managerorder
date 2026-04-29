import { describe, expect, it, vi } from "vitest";
import { createZaloRuntime, registerZaloHandlers } from "../index";
import type {
  ZaloBotLike,
  ZaloCommandContext,
  ZaloMessageLike,
  ZaloMode,
  ZaloOrderWizardState,
  ZaloOrderWizardStore,
  ZaloRuntimeConfig,
} from "../types";

function makeConfig(overrides: Partial<ZaloRuntimeConfig> = {}): ZaloRuntimeConfig {
  const { capabilities: overrideCapabilities, warnings: overrideWarnings, ...rest } = overrides;
  const capabilities = {
    ai: true,
    catalog: true,
    orderLookup: true,
    orderCreation: true,
    humanHandoff: true,
    adminNotify: true,
    gemini: true,
    ...(overrideCapabilities ?? {}),
  };

  return {
    botToken: "00000000-0000-4000-8000-000000000163",
    accountId: "00000000-0000-4000-8000-000000000009",
    adminUserIds: ["00000000-0000-4000-8000-0000000000d0", "00000000-0000-4000-8000-0000000000d1"],
    geminiApiKey: "gemini-key",
    geminiModel: "gemini-2.5-flash",
    appName: "ManagerOrder",
    accountBound: true,
    ...rest,
    capabilities,
    warnings: overrideWarnings ?? [],
  };
}

function createFakeMessage(chatId = "00000000-0000-4000-8000-00000000007c", userId = "00000000-0000-4000-8000-000000000088", displayName = "Nguyen A") {
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
    getMe: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000167", displayName: "ManagerOrder Zalo Bot" })),
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

function createMemoryWizardStore(): ZaloOrderWizardStore & { sessions: Map<string, ZaloOrderWizardState> } {
  const sessions = new Map<string, ZaloOrderWizardState>();
  const key = (accountId: string, chatId: string) => `${accountId}:${chatId}`;

  return {
    sessions,
    getSession: vi.fn(async (accountId: string, chatId: string) => sessions.get(key(accountId, chatId)) ?? null),
    setSession: vi.fn(async (accountId: string, chatId: string, state: ZaloOrderWizardState) => {
      sessions.set(key(accountId, chatId), state);
    }),
    clearSession: vi.fn(async (accountId: string, chatId: string) => {
      sessions.delete(key(accountId, chatId));
    }),
  };
}

describe("zalo runtime", () => {
  it("routes product, lookup, human, ai, and id commands", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const dataService = {
      listProducts: vi.fn(async () => [
        {
          id: "00000000-0000-4000-8000-0000000003ed",
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
          id: "00000000-0000-4000-8000-0000000003f9",
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
    expect(fakeBot.commandHandlers.has("kiemtra")).toBe(true);
    expect(fakeBot.commandHandlers.has("kt")).toBe(true);
    expect(fakeBot.commandHandlers.has("neworder")).toBe(true);
    expect(fakeBot.commandHandlers.has("cancel")).toBe(true);

    const ktMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("kt")?.(ktMessage.message, { command: { name: "kt", argsRaw: "0901234567", args: ["0901234567"] } });
    expect(ktMessage.replies.join("\n")).toContain("0901234567");

    const humanMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("human")?.(humanMessage.message, { command: { name: "human", argsRaw: "", args: [] } });
    expect(modeStore.currentMode).toBe("human-handoff");
    expect(fakeBot.sentMessages.length).toBeGreaterThan(0);

    const aiMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("ai")?.(aiMessage.message, { command: { name: "ai", argsRaw: "", args: [] } });
    expect(modeStore.currentMode).toBe("sales-ai");

    const idMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("id")?.(idMessage.message, { command: { name: "id", argsRaw: "", args: [] } });
    expect(idMessage.replies.join("\n")).toContain("00000000-0000-4000-8000-000000000009");
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

    await modeStore.setMode("00000000-0000-4000-8000-000000000009", "00000000-0000-4000-8000-00000000007c", "human-handoff", "00000000-0000-4000-8000-000000000088");
    const humanMessage = createFakeMessage();
    humanMessage.message.text = "Mình cần hỗ trợ";
    await fakeBot.textHandler?.(humanMessage.message);
    expect(assistant.replyToSalesQuery).toHaveBeenCalledTimes(1);
    expect(fakeBot.sentMessages.length).toBeGreaterThan(0);
  });

  it("responds to /help even when only the text event is delivered", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      assistant: {
        replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
      },
      modeStore,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
    });

    const helpMessage = createFakeMessage();
    helpMessage.message.text = "/help";
    await fakeBot.textHandler?.(helpMessage.message);

    const combinedReply = helpMessage.replies.join("\n");
    expect(combinedReply).toContain("/neworder");
    expect(combinedReply).toContain("/cancel");
  });

  it("responds to other slash commands even when only the text event is delivered", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      assistant: {
        replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
      },
      modeStore,
      dataService: {
        listProducts: vi.fn(async (_accountId: string, query?: string) => {
          if (!query || /chatgpt/i.test(query)) {
            return [
              {
                id: "prod-1",
                name: "ChatGPT Plus",
                mode: "key",
                durationType: "months",
                durationValue: 1,
                buyPriceVnd: 100000,
                sellPriceVnd: 199000,
                isActive: true,
                createdAt: "2026-04-08T00:00:00.000Z",
              },
            ];
          }
          return [];
        }),
        searchOrders: vi.fn(async (_accountId: string, query: string) => {
          if (/dmh_a1b2/i.test(query)) {
            return [
              {
                id: "order-1",
                orderCode: "DMH_A1B2",
                customerName: "Nguyen A",
                productNameSnapshot: "ChatGPT Plus",
                totalAmountVnd: 199000,
                totalPaid: 99000,
                status: "pending_payment",
                expiresAt: "2026-05-01T00:00:00.000Z",
                createdAt: "2026-04-08T00:00:00.000Z",
              },
            ];
          }
          return [];
        }),
      },
    });

    const startMessage = createFakeMessage();
    startMessage.message.text = "/start";
    await fakeBot.textHandler?.(startMessage.message);
    expect(startMessage.replies.join("\n")).toContain("ChatGPT Plus");

    const productMessage = createFakeMessage();
    productMessage.message.text = "/product ChatGPT";
    await fakeBot.textHandler?.(productMessage.message);
    expect(productMessage.replies.join("\n")).toContain("ChatGPT Plus");

    const lookupMessage = createFakeMessage();
    lookupMessage.message.text = "/tracuu DMH_A1B2";
    await fakeBot.textHandler?.(lookupMessage.message);
    expect(lookupMessage.replies.join("\n")).toContain("DMH_A1B2");
    expect(lookupMessage.replies.join("\n")).toContain("Nguyen A");
  });

  it("lets a plain human request escape an active wizard session", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const wizardStore = createMemoryWizardStore();
    const assistant = {
      replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
    };
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      assistant,
      modeStore,
      orderWizardStore: wizardStore,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
    });

    await fakeBot.commandHandlers.get("neworder")?.(createFakeMessage().message, {
      command: { name: "neworder", argsRaw: "", args: [] },
    });

    const humanMessage = createFakeMessage();
    humanMessage.message.text = "mình muốn gặp nhân viên";
    await fakeBot.textHandler?.(humanMessage.message);

    expect(modeStore.currentMode).toBe("human-handoff");
    expect(await wizardStore.getSession(config.accountId, humanMessage.message.chat.id)).toBeNull();
    expect(fakeBot.sentMessages.length).toBeGreaterThan(0);
    expect(assistant.replyToSalesQuery).not.toHaveBeenCalled();
  });

  it("routes natural lookup aliases and phone numbers without falling through to AI", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const assistant = {
      replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
    };
    const dataService = {
      listProducts: vi.fn(async () => []),
      searchOrders: vi.fn(async () => []),
    };
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      assistant,
      modeStore,
      dataService,
    });

    const aliasMessage = createFakeMessage();
    aliasMessage.message.text = "kiểm tra đơn DMH_A1B2";
    await fakeBot.textHandler?.(aliasMessage.message);

    const phoneMessage = createFakeMessage();
    phoneMessage.message.text = "0901234567";
    await fakeBot.textHandler?.(phoneMessage.message);

    expect(dataService.searchOrders).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000009", "DMH_A1B2", 5);
    expect(dataService.searchOrders).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000009", "0901234567", 5);
    expect(assistant.replyToSalesQuery).not.toHaveBeenCalled();
  });

  it("always replies with guidance when lookup is unavailable or fails", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const unavailableConfig = makeConfig({
      capabilities: {
        ai: true,
        catalog: true,
        orderLookup: false,
        orderCreation: false,
        humanHandoff: true,
        adminNotify: true,
        gemini: true,
      },
    });

    registerZaloHandlers(fakeBot.bot, unavailableConfig, {
      bot: fakeBot.bot,
      modeStore,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
    });

    const unavailableMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("kt")?.(unavailableMessage.message, {
      command: { name: "kt", argsRaw: "DMH_A1B2", args: ["DMH_A1B2"] },
    });
    expect(unavailableMessage.replies.join("\n")).toContain("tra cứu đơn");

    const failingBot = createFakeBot();
    registerZaloHandlers(failingBot.bot, makeConfig(), {
      bot: failingBot.bot,
      modeStore: createFakeModeStore(),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => {
          throw new Error("lookup failed");
        }),
      },
    });

    const failingMessage = createFakeMessage();
    await failingBot.commandHandlers.get("kiemtra")?.(failingMessage.message, {
      command: { name: "kiemtra", argsRaw: "DMH_A1B2", args: ["DMH_A1B2"] },
    });
    expect(failingMessage.replies.join("\n")).toContain("Không thể tra cứu");
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
