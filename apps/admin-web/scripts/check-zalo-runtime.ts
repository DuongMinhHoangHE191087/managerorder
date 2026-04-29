import assert from "node:assert/strict";
import { loadLocalEnv } from "./load-local-env";
import type {
  ZaloBotLike,
  ZaloCommandContext,
  ZaloMessageLike,
  ZaloMode,
  ZaloOrderWizardServices,
  ZaloOrderWizardState,
  ZaloOrderWizardStore,
} from "../src/lib/zalo/types";

loadLocalEnv();

function createFakeMessage(text = "", userId?: string) {
  const replies: string[] = [];
  const message: ZaloMessageLike = {
    chat: { id: "chat-1" },
    text,
    fromUser: userId
      ? { id: userId, displayName: "Nguyen A" }
      : undefined,
    replyText: async (replyText: string) => {
      replies.push(replyText);
      return {};
    },
  };

  return { message, replies };
}

function createFakeModeStore(initialMode: ZaloMode = "sales-ai") {
  let currentMode: ZaloMode = initialMode;

  return {
    getMode: async () => currentMode,
    setMode: async (_accountId: string, _chatId: string, nextMode: ZaloMode) => {
      currentMode = nextMode;
    },
    clearMode: async () => {
      currentMode = "sales-ai";
    },
    get currentMode() {
      return currentMode;
    },
  };
}

function createMemoryWizardStore(): ZaloOrderWizardStore & { sessions: Map<string, ZaloOrderWizardState> } {
  const sessions = new Map<string, ZaloOrderWizardState>();
  const key = (accountId: string, chatId: string) => `${accountId}:${chatId}`;

  return {
    sessions,
    getSession: async (accountId: string, chatId: string) => sessions.get(key(accountId, chatId)) ?? null,
    setSession: async (accountId: string, chatId: string, state: ZaloOrderWizardState) => {
      sessions.set(key(accountId, chatId), state);
    },
    clearSession: async (accountId: string, chatId: string) => {
      sessions.delete(key(accountId, chatId));
    },
  };
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
      if (event === "text") {
        textHandler = callback;
      }
      return this;
    },
    onError: () => {},
    initialize: async () => {},
    deleteWebhook: async () => true,
    startPolling: async () => {},
    shutdown: async () => {},
    sendMessage: async (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return {};
    },
    sendChatAction: async () => true,
    getMe: async () => ({ id: "bot-1", displayName: "ManagerOrder Zalo Bot" }),
  };

  return { bot, commandHandlers, sentMessages, get textHandler() { return textHandler; } };
}

async function main() {
  const { canStartZaloBot, describeZaloRuntime, resolveZaloRuntimeConfig } = await import("../src/lib/zalo/config");
  const { registerZaloHandlers } = await import("../src/lib/zalo/index");
  const config = resolveZaloRuntimeConfig(process.env);
  if (!canStartZaloBot(config)) {
    throw new Error("ZALO_BOT_TOKEN is unavailable");
  }

  console.log(`[check-zalo] ${describeZaloRuntime(config)}`);

  const fakeBot = createFakeBot();
  const modeStore = createFakeModeStore();
  const wizardStore = createMemoryWizardStore();
  const productCatalog = [
    {
      id: "prod-1",
      name: "ChatGPT Plus",
      mode: "key",
      durationType: "months",
      durationValue: 1,
      sellPriceVnd: 199000,
      buyPriceVnd: 100000,
      isActive: true,
      createdAt: "2026-04-08T00:00:00.000Z",
    },
  ];
  const orderResults = [
    {
      id: "order-lookup-1",
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
  const dataService = {
    listProducts: async (_accountId: string, query?: string) => {
      if (!query || /chatgpt/i.test(query)) {
        return productCatalog;
      }
      return [];
    },
    searchOrders: async (_accountId: string, query: string) => (query ? orderResults : []),
  };
  const services: ZaloOrderWizardServices = {
    listCustomers: async (_accountId: string, options?: { search?: string }) => {
      if (options?.search && /nguyen/i.test(options.search)) {
        return [
          {
            id: "cust-1",
            name: "Nguyen A",
            contacts: [{ id: "contact-1", type: "phone", value: "0901234567", isPrimary: true }],
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
    },
    createCustomer: async (_accountId: string, input: Parameters<ZaloOrderWizardServices["createCustomer"]>[1]) => ({
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
    }) as any,
    createOrder: async (_accountId: string, input: Parameters<ZaloOrderWizardServices["createOrder"]>[1]) => ({
      order: {
        id: "order-1",
        order_code: "DMH_ZALO_1",
        status: input.paymentTerms === "prepaid" ? "paid" : "pending_payment",
        total_amount_vnd: 398000,
        total_paid: input.paymentTerms === "prepaid" ? 398000 : 0,
        expires_at: "2026-05-01T00:00:00.000Z",
      },
      items: [{ id: "item-1" }],
    }) as any,
  };
  const assistant = {
    replyToSalesQuery: async ({ query }: { query: string }) => `AI:${query}`,
  };

  registerZaloHandlers(fakeBot.bot, config, {
    bot: fakeBot.bot,
    dataService,
    assistant,
    modeStore,
    orderWizardStore: wizardStore,
    orderWizardServices: services,
  });

  const requiredCommands = ["start", "help", "product", "sanpham", "tracuu", "kiemtra", "kt", "neworder", "cancel", "human", "nhanvien", "ai", "id"];
  for (const command of requiredCommands) {
    assert(fakeBot.commandHandlers.has(command), `Missing Zalo command handler: ${command}`);
  }

  const startMessage = createFakeMessage();
  await fakeBot.commandHandlers.get("start")?.(startMessage.message, {
    command: { name: "start", argsRaw: "", args: [] },
  });
  assert(startMessage.replies.some((reply) => reply.length > 0), "Zalo /start did not reply");

  const helpMessage = createFakeMessage();
  await fakeBot.commandHandlers.get("help")?.(helpMessage.message, {
    command: { name: "help", argsRaw: "", args: [] },
  });
  assert(helpMessage.replies.some((reply) => reply.includes("/neworder")), "Zalo /help did not include order guidance");

  const plainHelpMessage = createFakeMessage("/help");
  await fakeBot.textHandler?.(plainHelpMessage.message);
  assert(
    plainHelpMessage.replies.some((reply) => reply.includes("/neworder") && reply.includes("/cancel")),
    "Zalo plain text /help did not route through the fallback command handler",
  );

  const plainStartMessage = createFakeMessage("/start");
  await fakeBot.textHandler?.(plainStartMessage.message);
  assert(
    plainStartMessage.replies.some((reply) => reply.includes("ChatGPT Plus") || reply.includes("trợ lý bán hàng")),
    "Zalo plain text /start did not route through the fallback command handler",
  );

  const plainProductMessage = createFakeMessage("/product ChatGPT");
  await fakeBot.textHandler?.(plainProductMessage.message);
  assert(
    plainProductMessage.replies.some((reply) => reply.includes("ChatGPT Plus")),
    "Zalo plain text /product did not route through the fallback command handler",
  );

  const plainLookupMessage = createFakeMessage("/tracuu DMH_A1B2");
  await fakeBot.textHandler?.(plainLookupMessage.message);
  assert(
    plainLookupMessage.replies.some((reply) => reply.includes("DMH_A1B2") && reply.includes("Nguyen A")),
    "Zalo plain text /tracuu did not route through the fallback command handler",
  );

  const newOrderStart = createFakeMessage();
  await fakeBot.commandHandlers.get("neworder")?.(newOrderStart.message, {
    command: { name: "neworder", argsRaw: "", args: [] },
  });
  assert(newOrderStart.replies.some((reply) => reply.includes("TẠO ĐƠN HÀNG MỚI")), "Zalo /neworder did not start wizard");

  const customerMessage = createFakeMessage("Nguyen");
  await fakeBot.textHandler?.(customerMessage.message);
  assert(customerMessage.replies.some((reply) => reply.includes("Đã chọn khách")), "Zalo wizard did not select customer");

  const productMessage = createFakeMessage("ChatGPT");
  await fakeBot.textHandler?.(productMessage.message);
  assert(productMessage.replies.some((reply) => reply.includes("Đã chọn sản phẩm")), "Zalo wizard did not select product");

  const quantityMessage = createFakeMessage("2");
  await fakeBot.textHandler?.(quantityMessage.message);
  assert(quantityMessage.replies.some((reply) => reply.includes("Đã thêm: ChatGPT Plus x2")), "Zalo quantity step failed");

  const moreItemsMessage = createFakeMessage("done");
  await fakeBot.textHandler?.(moreItemsMessage.message);
  assert(moreItemsMessage.replies.some((reply) => reply.includes("Chọn phương thức thanh toán")), "Zalo payment step was not reached");

  const paymentMessage = createFakeMessage("1");
  await fakeBot.textHandler?.(paymentMessage.message);
  assert(paymentMessage.replies.some((reply) => reply.includes("Đã chọn thanh toán")), "Zalo payment selection failed");

  const notesMessage = createFakeMessage("skip");
  await fakeBot.textHandler?.(notesMessage.message);
  assert(notesMessage.replies.some((reply) => reply.includes("Xác nhận đơn")), "Zalo notes step failed");

  const confirmMessage = createFakeMessage("xacnhan");
  await fakeBot.textHandler?.(confirmMessage.message);
  assert(confirmMessage.replies.some((reply) => reply.includes("Đã tạo đơn hàng")), "Zalo confirm step failed");
  assert.strictEqual(wizardStore.sessions.size, 0, "Wizard session should be cleared after order creation");

  const cancelStart = createFakeMessage();
  await fakeBot.commandHandlers.get("neworder")?.(cancelStart.message, {
    command: { name: "neworder", argsRaw: "", args: [] },
  });
  const cancelMessage = createFakeMessage();
  await fakeBot.commandHandlers.get("cancel")?.(cancelMessage.message, {
    command: { name: "cancel", argsRaw: "", args: [] },
  });
  assert(cancelMessage.replies.some((reply) => reply.includes("Đã hủy đơn nháp")), "Zalo /cancel did not clear wizard");
  assert.strictEqual(wizardStore.sessions.size, 0, "Wizard session should be empty after cancel");

  const lookupTextMessage = createFakeMessage("kiểm tra đơn DMH_A1B2");
  await fakeBot.textHandler?.(lookupTextMessage.message);
  assert(
    lookupTextMessage.replies.some((reply) => reply.includes("DMH_A1B2") || reply.includes("tra cứu đơn")),
    "Zalo natural lookup text did not route correctly",
  );

  const salesTextMessage = createFakeMessage("Mình muốn tư vấn gói premium");
  await fakeBot.textHandler?.(salesTextMessage.message);
  assert(salesTextMessage.replies.some((reply) => reply.startsWith("AI:")), "Zalo fallback AI reply did not run");

  console.log("[check-zalo] Runtime handler smoke passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[check-zalo] Runtime handler smoke failed:", error);
  process.exit(1);
});
