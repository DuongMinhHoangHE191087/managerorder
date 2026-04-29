import { createCustomerForAccount, listCustomersForAccount } from "@/domains/customers/services";
import { formatStatusLabel, formatVnd } from "./messages";
import { createOrderWithItems } from "@/lib/services/order.service";
import {
  isValidVietnamesePhone,
  validateContactInput,
} from "@/lib/services/telegram-bot.helpers";
import type { Customer } from "@/lib/domain/types";
import type { ZaloDataService, ZaloMessageLike, ZaloOrderDurationType, ZaloOrderWizardDraftItem, ZaloOrderWizardProductCandidate, ZaloOrderWizardServices, ZaloOrderWizardState, ZaloOrderWizardStore, ZaloOrderWizardCustomerCandidate } from "./types";
import { clearZaloOrderWizardSession, zaloOrderWizardStore } from "./order-store";

type Logger = Pick<Console, "log" | "warn" | "error">;

interface CreateWizardParams {
  dataService: Promise<ZaloDataService>;
  logger?: Logger;
  orderWizardStore?: ZaloOrderWizardStore;
  services?: Partial<ZaloOrderWizardServices>;
}

export interface ZaloOrderWizardHandle {
  start(message: ZaloMessageLike): Promise<void>;
  cancel(message: ZaloMessageLike): Promise<void>;
  clear(chatId: string): Promise<void>;
  handleText(message: ZaloMessageLike): Promise<boolean>;
  hasSession(chatId: string): Promise<boolean>;
}

const DEFAULT_MAX_CUSTOMERS = 5;
const DEFAULT_MAX_PRODUCTS = 5;

function createLogger(logger: Logger = console): Logger {
  return logger;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePlain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isCancelIntent(text: string): boolean {
  const normalized = normalizePlain(text);
  return ["cancel", "/cancel", "huy", "stop", "dung", "thoat", "thoat order"].includes(normalized);
}

function isNewCustomerIntent(text: string): boolean {
  return /^new(?:[:\s-].+)?$/i.test(text.trim());
}

function extractNewCustomerName(text: string): string | null {
  const match = text.trim().match(/^new(?:[:\s-]+(.+))?$/i);
  const name = match?.[1]?.trim() ?? "";
  return name || null;
}

function isDoneIntent(text: string): boolean {
  const normalized = normalizePlain(text);
  return normalized === "done" || normalized === "xong" || normalized === "thanh toan" || normalized === "checkout" || normalized === "tra thanh toan";
}

function isConfirmIntent(text: string): boolean {
  const normalized = normalizePlain(text);
  return (
    normalized === "xac nhan" ||
    normalized === "xacnhan" ||
    normalized === "confirm" ||
    normalized === "dong y" ||
    normalized === "dongy" ||
    normalized === "ok" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "tao don" ||
    normalized === "taodon" ||
    normalized === "tao"
  );
}

function parseSelectionIndex(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2})$/);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(value) ? value : null;
}

function parseQuantity(text: string): number | null {
  const match = text.trim().match(/(\d{1,4})/);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function paymentTermsLabel(value: NonNullable<ZaloOrderWizardState["paymentTerms"]>): string {
  const labels: Record<NonNullable<ZaloOrderWizardState["paymentTerms"]>, string> = {
    prepaid: "Trả trước",
    credit: "Công nợ",
    cod: "COD / trực tiếp",
  };
  return labels[value];
}

function parsePaymentTerms(text: string): ZaloOrderWizardState["paymentTerms"] | null {
  const normalized = normalizePlain(text);
  if (["1", "prepaid", "tra truoc", "da thanh toan", "paid"].includes(normalized)) return "prepaid";
  if (["2", "credit", "cong no", "debt"].includes(normalized)) return "credit";
  if (["3", "cod", "truc tiep", "thu tien", "ship cod"].includes(normalized)) return "cod";
  return null;
}

function contactTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    phone: "SĐT",
    email: "Email",
    zalo: "Zalo",
    facebook: "Facebook",
    telegram: "Telegram",
    other: "Liên hệ",
  };
  return labels[type] ?? type;
}

function detectContactValidation(rawValue: string) {
  const value = rawValue.trim();
  if (!value) {
    return validateContactInput("other", value);
  }
  if (isValidVietnamesePhone(value)) {
    return validateContactInput("phone", value);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return validateContactInput("email", value);
  }
  if (/^https?:\/\/(www\.)?(facebook\.com|fb\.com)\//i.test(value)) {
    return validateContactInput("facebook", value);
  }
  if (/^https?:\/\/t\.me\/[a-zA-Z0-9_]{3,}$/i.test(value)) {
    return validateContactInput("telegram", value);
  }
  if (/^https?:\/\/(zalo\.me|zaloapp\.com)\//i.test(value) || /^@[a-zA-Z0-9._-]{3,}$/.test(value)) {
    return validateContactInput("zalo", value);
  }
  return validateContactInput("other", value);
}

function summarizeContact(contact: { type: string; value: string } | undefined): string | undefined {
  if (!contact) return undefined;
  return `${contactTypeLabel(contact.type)}: ${contact.value}`;
}

function toCustomerCandidate(customer: Customer): ZaloOrderWizardCustomerCandidate {
  const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0];
  return {
    id: customer.id,
    name: customer.name,
    contactPreview: summarizeContact(primaryContact),
  };
}

function toProductCandidate(product: Awaited<ReturnType<ZaloDataService["listProducts"]>>[number]): ZaloOrderWizardProductCandidate {
  return {
    id: product.id,
    name: product.name,
    mode: product.mode,
    sellPriceVnd: Number(product.sellPriceVnd ?? 0),
    buyPriceVnd: product.buyPriceVnd ?? null,
    durationType: (product.durationType ?? "days") as ZaloOrderDurationType,
    durationValue: Number(product.durationValue ?? 1),
    isActive: product.isActive,
  };
}

function formatCustomerCandidate(candidate: ZaloOrderWizardCustomerCandidate, index: number): string {
  return `${index + 1}. ${candidate.name}${candidate.contactPreview ? ` | ${candidate.contactPreview}` : ""}`;
}

function formatProductCandidate(candidate: ZaloOrderWizardProductCandidate, index: number): string {
  const duration = candidate.durationType && candidate.durationValue
    ? ` | ${candidate.durationValue} ${candidate.durationType === "days" ? "ngày" : candidate.durationType === "months" ? "tháng" : "năm"}`
    : "";
  const buy = candidate.buyPriceVnd ? ` | vốn ${formatVnd(candidate.buyPriceVnd)}` : "";
  const mode = candidate.mode ? ` | ${candidate.mode}` : "";
  return `${index + 1}. ${candidate.name} - ${formatVnd(candidate.sellPriceVnd)}${buy}${duration}${mode}`;
}

function draftItemTotal(item: ZaloOrderWizardDraftItem): number {
  return item.sellPriceVnd * item.quantity;
}

function draftOrderTotal(items: ZaloOrderWizardDraftItem[]): number {
  return items.reduce((sum, item) => sum + draftItemTotal(item), 0);
}

function formatDraftSummary(state: ZaloOrderWizardState): string {
  const lines = [
    "📋 Xác nhận đơn",
    "",
    `Khách hàng: ${state.selectedCustomer?.name ?? "N/A"}`,
    state.selectedCustomer?.contactSnapshot ? `Liên hệ: ${state.selectedCustomer.contactSnapshot}` : "",
    "",
    "Sản phẩm:",
  ];

  state.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.productName} x${item.quantity}`,
      `   • Đơn giá: ${formatVnd(item.sellPriceVnd)} | Thành tiền: ${formatVnd(draftItemTotal(item))}`,
    );
  });

  lines.push(
    "",
    `Tổng: ${formatVnd(draftOrderTotal(state.items))}`,
    `Thanh toán: ${state.paymentTerms ? paymentTermsLabel(state.paymentTerms) : "N/A"}`,
    `Ghi chú: ${state.orderNotes?.trim() ? state.orderNotes.trim() : "Không có"}`,
    "",
    "Nhắn `xacnhan` để tạo đơn, hoặc `/cancel` để hủy.",
  );

  return lines.filter(Boolean).join("\n");
}

function formatCustomerSearchPrompt(query: string, candidates: ZaloOrderWizardCustomerCandidate[]): string {
  const lines = [
    `Tìm thấy ${candidates.length} khách phù hợp cho "${query}":`,
    "",
  ];
  for (const [index, candidate] of candidates.slice(0, DEFAULT_MAX_CUSTOMERS).entries()) {
    lines.push(formatCustomerCandidate(candidate, index));
  }
  lines.push("", "Nhập số để chọn, hoặc gõ `new` để tạo khách mới.");
  return lines.join("\n");
}

function formatProductSearchPrompt(query: string, candidates: ZaloOrderWizardProductCandidate[]): string {
  const lines = [
    query
      ? `Kết quả sản phẩm cho "${query}":`
      : "Nhập tên sản phẩm để tìm, hoặc gửi trống để xem danh mục đang mở bán:",
    "",
  ];
  for (const [index, candidate] of candidates.slice(0, DEFAULT_MAX_PRODUCTS).entries()) {
    lines.push(formatProductCandidate(candidate, index));
  }
  lines.push("", "Nhập số để chọn sản phẩm, hoặc tìm từ khóa khác.");
  return lines.join("\n");
}

async function searchCustomers(
  services: ZaloOrderWizardServices,
  accountId: string,
  query: string,
): Promise<ZaloOrderWizardCustomerCandidate[]> {
  const customers = await services.listCustomers(accountId, { search: query });
  return customers.slice(0, DEFAULT_MAX_CUSTOMERS).map(toCustomerCandidate);
}

async function searchProducts(
  dataService: ZaloDataService,
  accountId: string,
  query: string,
): Promise<ZaloOrderWizardProductCandidate[]> {
  const products = await dataService.listProducts(accountId, query || undefined, DEFAULT_MAX_PRODUCTS);
  return products.filter((product) => product.isActive !== false).slice(0, DEFAULT_MAX_PRODUCTS).map(toProductCandidate);
}

function createWizardState(step: ZaloOrderWizardState["step"]): ZaloOrderWizardState {
  const timestamp = nowIso();
  return {
    step,
    startedAt: timestamp,
    updatedAt: timestamp,
    items: [],
  };
}

async function saveState(
  store: ZaloOrderWizardStore,
  accountId: string,
  chatId: string,
  state: ZaloOrderWizardState,
): Promise<ZaloOrderWizardState> {
  const nextState: ZaloOrderWizardState = {
    ...state,
    updatedAt: nowIso(),
  };
  await store.setSession(accountId, chatId, nextState);
  return nextState;
}

function cloneItems(items: ZaloOrderWizardDraftItem[]): ZaloOrderWizardDraftItem[] {
  return items.map((item) => ({ ...item }));
}

function buildOrderInput(
  state: ZaloOrderWizardState,
  createdBy?: string,
) {
  if (!state.selectedCustomer) {
    throw new Error("Thiếu khách hàng trong đơn nháp");
  }
  if (!state.items.length) {
    throw new Error("Đơn nháp chưa có sản phẩm");
  }
  return {
    customerId: state.selectedCustomer.id,
    items: state.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      sellPriceVnd: item.sellPriceVnd,
      costPriceVnd: item.buyPriceVnd ?? undefined,
      durationType: item.durationType,
      durationValue: item.durationValue,
    })),
    paymentTerms: state.paymentTerms,
    contactSnapshot: state.selectedCustomer.contactSnapshot,
    orderNotes: state.orderNotes?.trim() || undefined,
    createdBy: createdBy ?? null,
  } satisfies Parameters<ZaloOrderWizardServices["createOrder"]>[1];
}

async function replySafely(message: ZaloMessageLike, text: string, logger: Logger, context: string): Promise<void> {
  try {
    await message.replyText(text);
  } catch (error) {
    logger.error(`[ZaloOrderWizard] Failed to reply in ${context}:`, error);
  }
}

export function createZaloOrderWizard(
  accountId: string,
  deps: CreateWizardParams,
): ZaloOrderWizardHandle {
  const logger = createLogger(deps.logger);
  const store = deps.orderWizardStore ?? zaloOrderWizardStore;
  const services = {
    listCustomers: deps.services?.listCustomers ?? listCustomersForAccount,
    createCustomer: deps.services?.createCustomer ?? createCustomerForAccount,
    createOrder: deps.services?.createOrder ?? createOrderWithItems,
  };
  const dataServicePromise = deps.dataService;

  async function getSession(chatId: string): Promise<ZaloOrderWizardState | null> {
    return store.getSession(accountId, chatId);
  }

  async function start(message: ZaloMessageLike): Promise<void> {
    const state = createWizardState("customer-query");
    await saveState(store, accountId, message.chat.id, state);
    await replySafely(
      message,
      [
        "🆕 TẠO ĐƠN HÀNG MỚI",
        "",
        "Nhập tên khách hàng hoặc SĐT để tìm khách cũ.",
        "Gõ `new` để tạo khách hàng mới.",
        "Gõ `/cancel` để hủy bất kỳ lúc nào.",
      ].join("\n"),
      logger,
      "start",
    );
  }

  async function cancel(message: ZaloMessageLike): Promise<void> {
    const session = await getSession(message.chat.id);
    await store.clearSession(accountId, message.chat.id);
    if (!session) {
      await replySafely(message, "Không có đơn nháp nào đang mở.", logger, "cancel_empty");
      return;
    }
    await replySafely(message, "Đã hủy đơn nháp Zalo.", logger, "cancel");
  }

  async function clear(chatId: string): Promise<void> {
    await store.clearSession(accountId, chatId);
  }

  async function handleCustomerQuery(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const newCustomerName = extractNewCustomerName(text);
    if (isNewCustomerIntent(text) || newCustomerName !== null) {
      const nextState = await saveState(store, accountId, message.chat.id, {
        ...state,
        step: "customer-name",
        pendingCustomerName: newCustomerName ?? undefined,
        customerCandidates: undefined,
      });

      if (newCustomerName) {
        await saveState(store, accountId, message.chat.id, {
          ...nextState,
          step: "customer-contact",
          pendingCustomerName: newCustomerName,
        });
        await replySafely(
          message,
          [
            `Khách mới: ${newCustomerName}`,
            "",
            "Nhập liên hệ chính cho khách hàng này.",
            "Ví dụ: 0901234567, customer@email.com, https://zalo.me/..., hoặc link Facebook.",
          ].join("\n"),
          logger,
          "customer_new_contact_prompt",
        );
        return;
      }

      await replySafely(
        message,
        [
          "Nhập tên khách hàng mới:",
          "Ví dụ: Nguyễn Văn A",
        ].join("\n"),
        logger,
        "customer_new_name_prompt",
      );
      return;
    }

    const query = text.trim();
    if (!query) {
      await replySafely(
        message,
        "Nhập tên khách hàng hoặc SĐT để tìm khách cũ, hoặc gõ `new` để tạo mới.",
        logger,
        "customer_query_empty",
      );
      return;
    }

    const candidates = await searchCustomers(services, accountId, query);
    if (candidates.length === 0) {
      await saveState(store, accountId, message.chat.id, {
        ...state,
        step: "customer-query",
        customerCandidates: undefined,
      });
      await replySafely(
        message,
        [
          `Không tìm thấy khách phù hợp với "${query}".`,
          "Nhập từ khóa khác hoặc gõ `new` để tạo khách mới.",
        ].join("\n"),
        logger,
        "customer_not_found",
      );
      return;
    }

    if (candidates.length === 1) {
      const selected = candidates[0];
      if (!selected) {
        return;
      }
      await saveState(store, accountId, message.chat.id, {
        ...state,
        step: "product-query",
        selectedCustomer: {
          id: selected.id,
          name: selected.name,
          contactSnapshot: selected.contactPreview,
        },
        customerCandidates: undefined,
      });
      await replySafely(
        message,
        [
          `Đã chọn khách: ${selected.name}`,
          selected.contactPreview ? `Liên hệ: ${selected.contactPreview}` : "",
          "",
          "Nhập tên sản phẩm để thêm vào đơn.",
        ].filter(Boolean).join("\n"),
        logger,
        "customer_auto_select",
      );
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "customer-pick",
      customerCandidates: candidates,
    });
    await replySafely(message, formatCustomerSearchPrompt(query, candidates), logger, "customer_candidates");
  }

  async function selectCustomer(
    message: ZaloMessageLike,
    state: ZaloOrderWizardState,
    candidate: ZaloOrderWizardCustomerCandidate,
  ): Promise<void> {
    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "product-query",
      selectedCustomer: {
        id: candidate.id,
        name: candidate.name,
        contactSnapshot: candidate.contactPreview,
      },
      customerCandidates: undefined,
    });
    await replySafely(
      message,
      [
        `Đã chọn khách: ${candidate.name}`,
        candidate.contactPreview ? `Liên hệ: ${candidate.contactPreview}` : "",
        "",
        "Nhập tên sản phẩm để thêm vào đơn.",
      ].filter(Boolean).join("\n"),
      logger,
      "customer_selected",
    );
  }

  async function handleCustomerPick(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const index = parseSelectionIndex(text);
    if (index && state.customerCandidates?.[index - 1]) {
      await selectCustomer(message, state, state.customerCandidates[index - 1]!);
      return;
    }

    const newCustomerName = extractNewCustomerName(text);
    if (isNewCustomerIntent(text) || newCustomerName !== null) {
      await saveState(store, accountId, message.chat.id, {
        ...state,
        step: newCustomerName ? "customer-contact" : "customer-name",
        pendingCustomerName: newCustomerName ?? undefined,
        customerCandidates: undefined,
      });

      if (newCustomerName) {
        await replySafely(
          message,
          [
            `Khách mới: ${newCustomerName}`,
            "",
            "Nhập liên hệ chính cho khách hàng này.",
          ].join("\n"),
          logger,
          "customer_pick_new_contact_prompt",
        );
        return;
      }

      await replySafely(
        message,
        "Nhập tên khách hàng mới:",
        logger,
        "customer_pick_new_name_prompt",
      );
      return;
    }

    const query = text.trim();
    if (!query) {
      await replySafely(
        message,
        "Nhập số để chọn khách, gõ `new` để tạo mới, hoặc tìm từ khóa khác.",
        logger,
        "customer_pick_empty",
      );
      return;
    }

    const candidates = await searchCustomers(services, accountId, query);
    if (candidates.length === 0) {
      await replySafely(
        message,
        [
          `Không tìm thấy khách phù hợp với "${query}".`,
          "Nhập số để chọn khách hiện có, hoặc gõ `new` để tạo mới.",
        ].join("\n"),
        logger,
        "customer_pick_not_found",
      );
      return;
    }

    if (candidates.length === 1) {
      const selected = candidates[0];
      if (!selected) return;
      await selectCustomer(message, state, selected);
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      customerCandidates: candidates,
    });
    await replySafely(message, formatCustomerSearchPrompt(query, candidates), logger, "customer_pick_candidates");
  }

  async function handleCustomerName(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const name = text.trim();
    if (!name) {
      await replySafely(message, "Tên khách hàng không được để trống.", logger, "customer_name_empty");
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "customer-contact",
      pendingCustomerName: name,
    });
    await replySafely(
      message,
      [
        `Khách mới: ${name}`,
        "",
        "Nhập liên hệ chính cho khách hàng này.",
        "Ví dụ: 0901234567, customer@email.com, https://zalo.me/..., hoặc link Facebook.",
      ].join("\n"),
      logger,
      "customer_name_prompt_contact",
    );
  }

  async function createCustomerFromPending(
    message: ZaloMessageLike,
    state: ZaloOrderWizardState,
  ): Promise<Customer | null> {
    const pendingName = state.pendingCustomerName?.trim();
    const pendingContact = state.pendingCustomerContact;
    if (!pendingName) {
      await replySafely(message, "Thiếu tên khách hàng mới. Gõ `/neworder` để bắt đầu lại.", logger, "customer_create_missing_name");
      return null;
    }
    if (!pendingContact?.ok || !pendingContact.normalizedChannel || !pendingContact.normalizedValue) {
      await replySafely(message, "Thiếu thông tin liên hệ hợp lệ cho khách hàng mới.", logger, "customer_create_missing_contact");
      return null;
    }

    const contacts = [
      {
        type: pendingContact.normalizedChannel,
        value: pendingContact.normalizedValue,
        isPrimary: true,
        facebookId: pendingContact.normalizedChannel === "facebook" ? pendingContact.extractedId : undefined,
        facebookName: undefined,
      },
    ];

    return services.createCustomer(accountId, {
      name: pendingName,
      contacts,
      tier: "regular",
      customerType: "retail",
    });
  }

  async function handleCustomerContact(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const validation = detectContactValidation(text);
    if (!validation.ok) {
      await replySafely(message, validation.error ?? "Liên hệ không hợp lệ.", logger, "customer_contact_invalid");
      return;
    }

    const nextState = await saveState(store, accountId, message.chat.id, {
      ...state,
      pendingCustomerContact: validation,
    });

    try {
      const customer = await createCustomerFromPending(message, nextState);
      if (!customer) {
        return;
      }
      const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0];
      await saveState(store, accountId, message.chat.id, {
        ...nextState,
        step: "product-query",
        selectedCustomer: {
          id: customer.id,
          name: customer.name,
          contactSnapshot: summarizeContact(primaryContact),
        },
        pendingCustomerName: undefined,
        pendingCustomerContact: undefined,
        customerCandidates: undefined,
      });
      await replySafely(
        message,
        [
          `Đã tạo khách hàng: ${customer.name}`,
          primaryContact ? `Liên hệ: ${summarizeContact(primaryContact)}` : "",
          "",
          "Nhập tên sản phẩm để thêm vào đơn.",
        ].filter(Boolean).join("\n"),
        logger,
        "customer_created",
      );
    } catch (error) {
      logger.error("[ZaloOrderWizard] Failed to create customer:", error);
      await replySafely(
        message,
        `Không thể tạo khách hàng mới lúc này: ${error instanceof Error ? error.message : String(error)}`,
        logger,
        "customer_create_error",
      );
    }
  }

  async function handleProductQuery(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const dataService = await dataServicePromise;
    const query = text.trim();
    const candidates = await searchProducts(dataService, accountId, query);

    if (candidates.length === 0) {
      await saveState(store, accountId, message.chat.id, {
        ...state,
        step: "product-query",
        productCandidates: undefined,
      });
      await replySafely(
        message,
        [
          query
            ? `Không tìm thấy sản phẩm phù hợp với "${query}".`
            : "Hiện chưa có sản phẩm phù hợp.",
          "Nhập từ khóa khác hoặc gõ `/cancel` để hủy.",
        ].join("\n"),
        logger,
        "product_not_found",
      );
      return;
    }

    if (candidates.length === 1) {
      const selected = candidates[0];
      if (!selected) return;
      await saveState(store, accountId, message.chat.id, {
        ...state,
        step: "quantity",
        pendingProduct: selected,
        productCandidates: undefined,
      });
      await replySafely(
        message,
        [
          `Đã chọn sản phẩm: ${selected.name}`,
          `Giá: ${formatVnd(selected.sellPriceVnd)}`,
          "",
          "Nhập số lượng cần mua.",
        ].join("\n"),
        logger,
        "product_auto_select",
      );
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "product-pick",
      productCandidates: candidates,
    });
    await replySafely(message, formatProductSearchPrompt(query, candidates), logger, "product_candidates");
  }

  async function selectProduct(
    message: ZaloMessageLike,
    state: ZaloOrderWizardState,
    candidate: ZaloOrderWizardProductCandidate,
  ): Promise<void> {
    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "quantity",
      pendingProduct: candidate,
      productCandidates: undefined,
    });
    await replySafely(
      message,
      [
        `Đã chọn sản phẩm: ${candidate.name}`,
        `Giá: ${formatVnd(candidate.sellPriceVnd)}`,
        "",
        "Nhập số lượng cần mua.",
      ].join("\n"),
      logger,
      "product_selected",
    );
  }

  async function handleProductPick(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const index = parseSelectionIndex(text);
    if (index && state.productCandidates?.[index - 1]) {
      await selectProduct(message, state, state.productCandidates[index - 1]!);
      return;
    }

    const dataService = await dataServicePromise;
    const query = text.trim();
    if (!query) {
      await replySafely(message, "Nhập số để chọn sản phẩm, hoặc tìm từ khóa khác.", logger, "product_pick_empty");
      return;
    }

    const candidates = await searchProducts(dataService, accountId, query);
    if (candidates.length === 0) {
      await replySafely(
        message,
        [
          `Không tìm thấy sản phẩm phù hợp với "${query}".`,
          "Nhập số để chọn sản phẩm hiện có, hoặc tìm từ khóa khác.",
        ].join("\n"),
        logger,
        "product_pick_not_found",
      );
      return;
    }

    if (candidates.length === 1) {
      const selected = candidates[0];
      if (!selected) return;
      await selectProduct(message, state, selected);
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      productCandidates: candidates,
    });
    await replySafely(message, formatProductSearchPrompt(query, candidates), logger, "product_pick_candidates");
  }

  async function handleQuantity(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const quantity = parseQuantity(text);
    if (!quantity) {
      await replySafely(message, "Số lượng không hợp lệ. Nhập số nguyên lớn hơn 0.", logger, "quantity_invalid");
      return;
    }

    if (!state.pendingProduct) {
      await replySafely(message, "Thiếu sản phẩm đang chọn. Nhắn `/neworder` để bắt đầu lại.", logger, "quantity_missing_product");
      return;
    }

    const pendingProduct = state.pendingProduct;
    const item: ZaloOrderWizardDraftItem = {
      productId: pendingProduct.id,
      productName: pendingProduct.name,
      mode: pendingProduct.mode,
      sellPriceVnd: pendingProduct.sellPriceVnd,
      buyPriceVnd: pendingProduct.buyPriceVnd ?? null,
      durationType: pendingProduct.durationType ?? "days",
      durationValue: pendingProduct.durationValue ?? 1,
      quantity,
    };

    const items = cloneItems(state.items);
    items.push(item);

    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "more-items",
      items,
      pendingProduct: undefined,
      productCandidates: undefined,
    });

    await replySafely(
      message,
      [
        `Đã thêm: ${item.productName} x${item.quantity} = ${formatVnd(draftItemTotal(item))}`,
        `Tạm tính: ${formatVnd(draftOrderTotal(items))}`,
        "",
        "Nhắn tên sản phẩm khác để thêm tiếp, hoặc gõ `done` để sang thanh toán.",
      ].join("\n"),
      logger,
      "quantity_saved",
    );
  }

  async function handleMoreItems(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    if (isDoneIntent(text)) {
      if (state.items.length === 0) {
        await replySafely(message, "Đơn nháp chưa có sản phẩm nào.", logger, "more_items_empty");
        return;
      }
      await saveState(store, accountId, message.chat.id, {
        ...state,
        step: "payment-terms",
      });
      await replySafely(
        message,
        [
          "Chọn phương thức thanh toán:",
          "1. Trả trước",
          "2. Công nợ",
          "3. COD / trực tiếp",
        ].join("\n"),
        logger,
        "payment_prompt",
      );
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "product-query",
    });
    await handleProductQuery(message, text, {
      ...state,
      step: "product-query",
    });
  }

  async function handlePaymentTerms(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const paymentTerms = parsePaymentTerms(text);
    if (!paymentTerms) {
      await replySafely(
        message,
        [
          "Chọn phương thức thanh toán hợp lệ:",
          "1. Trả trước",
          "2. Công nợ",
          "3. COD / trực tiếp",
        ].join("\n"),
        logger,
        "payment_invalid",
      );
      return;
    }

    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "order-notes",
      paymentTerms,
    });

    await replySafely(
      message,
      [
        `Đã chọn thanh toán: ${paymentTermsLabel(paymentTerms)}`,
        "",
        "Nhập ghi chú đơn hàng hoặc gõ `skip` để bỏ qua.",
      ].join("\n"),
      logger,
      "payment_saved",
    );
  }

  async function handleOrderNotes(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    const normalized = normalizePlain(text);
    const notes = normalized === "skip" || normalized === "-" ? "" : text.trim();
    await saveState(store, accountId, message.chat.id, {
      ...state,
      step: "confirm",
      orderNotes: notes || undefined,
    });

    const session = await getSession(message.chat.id);
    if (!session) return;

    await replySafely(message, formatDraftSummary(session), logger, "confirm_prompt");
  }

  async function handleConfirm(
    message: ZaloMessageLike,
    text: string,
    state: ZaloOrderWizardState,
  ): Promise<void> {
    if (isCancelIntent(text)) {
      await cancel(message);
      return;
    }

    if (!isConfirmIntent(text)) {
      await replySafely(message, formatDraftSummary(state), logger, "confirm_retry");
      return;
    }

    if (!state.selectedCustomer || state.items.length === 0 || !state.paymentTerms) {
      await replySafely(
        message,
        "Đơn nháp chưa đủ dữ liệu để tạo đơn. Nhắn `/cancel` rồi tạo lại.",
        logger,
        "confirm_invalid_state",
      );
      return;
    }

    try {
      await replySafely(message, "⏳ Đang tạo đơn...", logger, "confirm_pending");
      const result = await services.createOrder(accountId, buildOrderInput(state, message.fromUser?.id));
      await store.clearSession(accountId, message.chat.id);

      const lines = [
        "✅ Đã tạo đơn hàng",
        `Mã đơn: ${result.order.order_code ?? result.order.id}`,
        `Khách hàng: ${state.selectedCustomer.name}`,
        `Tổng tiền: ${formatVnd(result.order.total_amount_vnd)}`,
        `Đã thu: ${formatVnd(result.order.total_paid)}`,
        `Trạng thái: ${formatStatusLabel(result.order.status)}`,
        `Thanh toán: ${paymentTermsLabel(state.paymentTerms)}`,
        state.orderNotes?.trim() ? `Ghi chú: ${state.orderNotes.trim()}` : "",
        result.order.expires_at ? `Hết hạn: ${new Date(result.order.expires_at).toLocaleString("vi-VN")}` : "",
      ];

      if ("warning" in result && result.warning) {
        lines.push("", `⚠️ ${result.warning}`);
      }

      lines.push("", "Nhắn `/neworder` để tạo đơn khác hoặc `/tracuu <mã đơn|SĐT>` để tra cứu.");
      await replySafely(message, lines.filter(Boolean).join("\n"), logger, "order_created");
    } catch (error) {
      logger.error("[ZaloOrderWizard] Failed to create order:", error);
      await replySafely(
        message,
        `Không thể tạo đơn lúc này: ${error instanceof Error ? error.message : String(error)}`,
        logger,
        "order_create_error",
      );
    }
  }

  async function handleText(message: ZaloMessageLike): Promise<boolean> {
    const session = await getSession(message.chat.id);
    if (!session) {
      return false;
    }

    const text = (message.text ?? "").trim();
    if (!text) {
      return true;
    }

    const handlers: Record<ZaloOrderWizardState["step"], (message: ZaloMessageLike, text: string, state: ZaloOrderWizardState) => Promise<void>> = {
      "customer-query": handleCustomerQuery,
      "customer-pick": handleCustomerPick,
      "customer-name": handleCustomerName,
      "customer-contact": handleCustomerContact,
      "product-query": handleProductQuery,
      "product-pick": handleProductPick,
      quantity: handleQuantity,
      "more-items": handleMoreItems,
      "payment-terms": handlePaymentTerms,
      "order-notes": handleOrderNotes,
      confirm: handleConfirm,
    };

    const handler = handlers[session.step];
    if (!handler) {
      await clearZaloOrderWizardSession(accountId, message.chat.id);
      await replySafely(
        message,
        "Phiên tạo đơn bị lỗi trạng thái. Nhắn `/neworder` để bắt đầu lại.",
        logger,
        "invalid_step",
      );
      return true;
    }

    await handler(message, text, session);
    return true;
  }

  async function hasSession(chatId: string): Promise<boolean> {
    return Boolean(await getSession(chatId));
  }

  return {
    start,
    cancel,
    clear,
    handleText,
    hasSession,
  };
}
