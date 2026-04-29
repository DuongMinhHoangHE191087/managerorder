import { describe, expect, it, vi } from "vitest";
import { registerZaloHandlers } from "../index";
import type {
  ZaloBotLike,
  ZaloCommandContext,
  ZaloMessageLike,
  ZaloMode,
  ZaloOrderWizardServices,
  ZaloOrderWizardState,
  ZaloOrderWizardStore,
  ZaloRuntimeConfig,
} from "../types";

function makeConfig(): ZaloRuntimeConfig {
  return {
    botToken: "00000000-0000-4000-8000-000000000163",
    accountId: "00000000-0000-4000-8000-000000000009",
    adminUserIds: ["00000000-0000-4000-8000-0000000000d0"],
    geminiApiKey: "gemini-key",
    geminiModel: "gemini-2.5-flash",
    appName: "ManagerOrder",
    accountBound: true,
    capabilities: {
      ai: true,
      catalog: true,
      orderLookup: true,
      orderCreation: true,
      humanHandoff: true,
      adminNotify: true,
      gemini: true,
    },
    warnings: [],
  };
}

function createFakeMessage(
  chatId = "00000000-0000-4000-8000-00000000007c",
  userId = "00000000-0000-4000-8000-000000000088",
  displayName = "Nguyen A",
) {
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

  return { bot, commandHandlers, sentMessages, get textHandler() { return textHandler; } };
}

function createFakeModeStore(initialMode: ZaloMode = "sales-ai") {
  let mode: ZaloMode = initialMode;
  return {
    getMode: vi.fn(async () => mode),
    setMode: vi.fn(async (_accountId: string, _chatId: string, nextMode: ZaloMode) => {
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

describe("zalo order wizard", () => {
  it("runs the full order flow and clears the wizard session after confirmation", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore("human-handoff");
    const wizardStore = createMemoryWizardStore();
    const createdOrders: Array<{ accountId: string; input: Parameters<ZaloOrderWizardServices["createOrder"]>[1] }> = [];
    const createOrder = vi.fn(async (accountId: string, input: Parameters<ZaloOrderWizardServices["createOrder"]>[1]) => {
      createdOrders.push({ accountId, input });
      return {
        order: {
          id: "order-1",
          order_code: "DMH_ZALO_1",
          status: "pending_payment",
          total_amount_vnd: 398000,
          total_paid: 0,
          expires_at: "2026-05-01T00:00:00.000Z",
        },
        items: [{ id: "item-1" }],
      } as any;
    });
    const services: ZaloOrderWizardServices = {
      listCustomers: vi.fn(async (_accountId: string, options?: { search?: string }) => {
        if (options?.search && /nguyen/i.test(options.search)) {
          return [
            {
              id: "cust-1",
              name: "Nguyen A",
              contacts: [
                { id: "contact-1", type: "phone", value: "0901234567", isPrimary: true },
              ],
              tier: "regular",
              customerType: "retail",
              debtAmountVnd: 0,
              debtOverdueDays: 0,
              reliabilityScore: 100,
              createdAt: "2026-04-08T00:00:00.000Z",
            },
          ] as any;
        }
        return [] as any;
      }),
      createCustomer: vi.fn(async (_accountId: string, input: Parameters<ZaloOrderWizardServices["createCustomer"]>[1]) => ({
        id: "cust-new",
        name: input.name,
        contacts: input.contacts.map((contact) => ({
          id: "contact-1",
          type: contact.type,
          value: contact.value,
          isPrimary: contact.isPrimary,
          createdAt: "2026-04-08T00:00:00.000Z",
        })),
        tier: "regular",
        customerType: "retail",
        debtAmountVnd: 0,
        debtOverdueDays: 0,
        reliabilityScore: 100,
        createdAt: "2026-04-08T00:00:00.000Z",
      }) as any),
      createOrder: createOrder as ZaloOrderWizardServices["createOrder"],
    };
    const dataService = {
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
      searchOrders: vi.fn(async () => []),
    };
    const assistant = {
      replyToSalesQuery: vi.fn(async ({ query }: { query: string }) => `AI:${query}`),
    };
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      dataService,
      assistant,
      modeStore,
      orderWizardStore: wizardStore,
      orderWizardServices: services,
    });

    await fakeBot.commandHandlers.get("neworder")?.(createFakeMessage().message, {
      command: { name: "neworder", argsRaw: "", args: [] },
    });

    const customerMessage = createFakeMessage();
    customerMessage.message.text = "Nguyen";
    await fakeBot.textHandler?.(customerMessage.message);
    expect(customerMessage.replies.join("\n")).toContain("Đã chọn khách");

    const productMessage = createFakeMessage();
    productMessage.message.text = "ChatGPT";
    await fakeBot.textHandler?.(productMessage.message);
    expect(productMessage.replies.join("\n")).toContain("Đã chọn sản phẩm");

    const quantityMessage = createFakeMessage();
    quantityMessage.message.text = "2";
    await fakeBot.textHandler?.(quantityMessage.message);
    expect(quantityMessage.replies.join("\n")).toContain("Đã thêm: ChatGPT Plus x2");

    const moreItemsMessage = createFakeMessage();
    moreItemsMessage.message.text = "done";
    await fakeBot.textHandler?.(moreItemsMessage.message);
    expect(moreItemsMessage.replies.join("\n")).toContain("Chọn phương thức thanh toán");

    const paymentMessage = createFakeMessage();
    paymentMessage.message.text = "1";
    await fakeBot.textHandler?.(paymentMessage.message);
    expect(paymentMessage.replies.join("\n")).toContain("Đã chọn thanh toán");

    const notesMessage = createFakeMessage();
    notesMessage.message.text = "skip";
    await fakeBot.textHandler?.(notesMessage.message);
    expect(notesMessage.replies.join("\n")).toContain("Xác nhận đơn");

    const confirmMessage = createFakeMessage();
    confirmMessage.message.text = "xacnhan";
    await fakeBot.textHandler?.(confirmMessage.message);
    expect(confirmMessage.replies.join("\n")).toContain("Đã tạo đơn hàng");
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createdOrders[0]?.accountId).toBe(config.accountId);
    expect(wizardStore.sessions.size).toBe(0);
    expect(assistant.replyToSalesQuery).not.toHaveBeenCalled();
  });

  it("cancels an active wizard session", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const wizardStore = createMemoryWizardStore();
    const config = makeConfig();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
      assistant: {
        replyToSalesQuery: vi.fn(async () => "AI reply"),
      },
      modeStore,
      orderWizardStore: wizardStore,
      orderWizardServices: {
        listCustomers: vi.fn(async () => []),
        createCustomer: vi.fn(async () => {
          throw new Error("should not be called");
        }),
        createOrder: vi.fn(async () => {
          throw new Error("should not be called");
        }),
      },
    });

    await fakeBot.commandHandlers.get("neworder")?.(createFakeMessage().message, {
      command: { name: "neworder", argsRaw: "", args: [] },
    });

    const cancelMessage = createFakeMessage();
    await fakeBot.commandHandlers.get("cancel")?.(cancelMessage.message, {
      command: { name: "cancel", argsRaw: "", args: [] },
    });

    expect(cancelMessage.replies.join("\n")).toContain("Đã hủy đơn nháp");
    expect(wizardStore.sessions.size).toBe(0);
  });

  it("restarts from a clean draft when /neworder is sent again", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore("human-handoff");
    const wizardStore = createMemoryWizardStore();
    const config = makeConfig();
    const message = createFakeMessage();

    await wizardStore.setSession(config.accountId, message.message.chat.id, {
      step: "confirm",
      startedAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
      selectedCustomer: {
        id: "cust-1",
        name: "Nguyen A",
        contactSnapshot: "SĐT: 0901234567",
      },
      items: [
        {
          productId: "prod-1",
          productName: "ChatGPT Plus",
          mode: "key",
          sellPriceVnd: 199000,
          buyPriceVnd: 100000,
          durationType: "months",
          durationValue: 1,
          quantity: 1,
        },
      ],
      paymentTerms: "prepaid",
      orderNotes: "Old draft",
    });

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
      assistant: {
        replyToSalesQuery: vi.fn(async () => "AI reply"),
      },
      modeStore,
      orderWizardStore: wizardStore,
    });

    await fakeBot.commandHandlers.get("neworder")?.(message.message, {
      command: { name: "neworder", argsRaw: "", args: [] },
    });

    const session = await wizardStore.getSession(config.accountId, message.message.chat.id);
    expect(session?.step).toBe("customer-query");
    expect(session?.items).toEqual([]);
    expect(session?.selectedCustomer).toBeUndefined();
    expect(session?.paymentTerms).toBeUndefined();
    expect(modeStore.currentMode).toBe("sales-ai");
    expect(message.replies.join("\n")).toContain("TẠO ĐƠN HÀNG MỚI");
  });

  it("returns a friendly message when canceling without an active session", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const wizardStore = createMemoryWizardStore();
    const config = makeConfig();
    const cancelMessage = createFakeMessage();

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
      dataService: {
        listProducts: vi.fn(async () => []),
        searchOrders: vi.fn(async () => []),
      },
      assistant: {
        replyToSalesQuery: vi.fn(async () => "AI reply"),
      },
      modeStore,
      orderWizardStore: wizardStore,
    });

    await fakeBot.commandHandlers.get("cancel")?.(cancelMessage.message, {
      command: { name: "cancel", argsRaw: "", args: [] },
    });

    expect(cancelMessage.replies.join("\n")).toContain("Không có đơn nháp nào đang mở.");
    expect(wizardStore.sessions.size).toBe(0);
  });

  it("creates a new customer before continuing the order flow", async () => {
    const fakeBot = createFakeBot();
    const modeStore = createFakeModeStore();
    const wizardStore = createMemoryWizardStore();
    const config = makeConfig();
    const createdCustomers: Array<{ accountId: string; input: Parameters<ZaloOrderWizardServices["createCustomer"]>[1] }> = [];
    const createCustomer = vi.fn(async (accountId: string, input: Parameters<ZaloOrderWizardServices["createCustomer"]>[1]) => {
      createdCustomers.push({ accountId, input });
      return {
        id: "cust-new",
        name: input.name,
        contacts: input.contacts.map((contact) => ({
          id: "contact-1",
          type: contact.type,
          value: contact.value,
          isPrimary: contact.isPrimary,
          createdAt: "2026-04-08T00:00:00.000Z",
        })),
        tier: "regular",
        customerType: "retail",
        debtAmountVnd: 0,
        debtOverdueDays: 0,
        reliabilityScore: 100,
        createdAt: "2026-04-08T00:00:00.000Z",
      } as any;
    });

    registerZaloHandlers(fakeBot.bot, config, {
      bot: fakeBot.bot,
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
        searchOrders: vi.fn(async () => []),
      },
      assistant: {
        replyToSalesQuery: vi.fn(async () => "AI reply"),
      },
      modeStore,
      orderWizardStore: wizardStore,
      orderWizardServices: {
        listCustomers: vi.fn(async () => []),
        createCustomer: createCustomer as ZaloOrderWizardServices["createCustomer"],
        createOrder: vi.fn(async () => {
          throw new Error("should not be called in the customer creation test");
        }),
      },
    });

    await fakeBot.commandHandlers.get("neworder")?.(createFakeMessage().message, {
      command: { name: "neworder", argsRaw: "", args: [] },
    });

    const newCustomerMessage = createFakeMessage();
    newCustomerMessage.message.text = "new: Nguyen B";
    await fakeBot.textHandler?.(newCustomerMessage.message);
    expect(newCustomerMessage.replies.join("\n")).toContain("Nhập liên hệ chính");

    const contactMessage = createFakeMessage();
    contactMessage.message.text = "0901234567";
    await fakeBot.textHandler?.(contactMessage.message);

    expect(contactMessage.replies.join("\n")).toContain("Đã tạo khách hàng: Nguyen B");
    expect(createdCustomers).toHaveLength(1);
    expect(createdCustomers[0]?.accountId).toBe(config.accountId);
    expect(createdCustomers[0]?.input.contacts[0]).toMatchObject({
      type: "phone",
      value: "0901234567",
      isPrimary: true,
    });

    const session = await wizardStore.getSession(config.accountId, contactMessage.message.chat.id);
    expect(session?.step).toBe("product-query");
    expect(session?.selectedCustomer?.name).toBe("Nguyen B");
  });
});
