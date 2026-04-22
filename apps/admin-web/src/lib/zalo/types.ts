export type ZaloMode = "sales-ai" | "human-handoff";

export interface ZaloCapabilities {
  ai: boolean;
  catalog: boolean;
  orderLookup: boolean;
  humanHandoff: boolean;
  adminNotify: boolean;
  gemini: boolean;
}

export interface ZaloRuntimeConfig {
  botToken: string;
  accountId: string;
  adminUserIds: string[];
  geminiApiKey: string;
  geminiModel: string;
  appName: string;
  accountBound: boolean;
  capabilities: ZaloCapabilities;
  warnings: string[];
}

export interface ZaloBotIdentity {
  id: string;
  displayName?: string;
  accountName?: string;
  accountType?: string;
  isBot?: boolean;
  canJoinGroups?: boolean;
}

export interface ZaloMessageUser {
  id: string;
  displayName?: string;
  accountName?: string;
  isBot?: boolean;
}

export interface ZaloMessageLike {
  chat: { id: string };
  fromUser?: ZaloMessageUser;
  text?: string;
  replyText(text: string): Promise<unknown>;
}

export interface ZaloCommandContext {
  command?: {
    name: string;
    argsRaw: string;
    args: string[];
  };
}

export interface ZaloProductRecord {
  id: string;
  name: string;
  mode: string;
  durationType?: string | null;
  durationValue?: number | null;
  buyPriceVnd?: number | null;
  sellPriceVnd?: number | null;
  isActive?: boolean;
  createdAt: string;
}

export interface ZaloOrderRecord {
  id: string;
  orderCode: string | null;
  customerId?: string | null;
  customerName: string | null;
  contactSnapshot?: string | null;
  productNameSnapshot: string | null;
  quantity?: number | null;
  totalAmountVnd: number;
  totalPaid: number;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface ZaloDataService {
  listProducts(accountId: string, query?: string, limit?: number): Promise<ZaloProductRecord[]>;
  searchOrders(accountId: string, query: string, limit?: number): Promise<ZaloOrderRecord[]>;
}

export interface ZaloAssistantRequest {
  query: string;
  products: ZaloProductRecord[];
  config: Pick<ZaloRuntimeConfig, "appName" | "geminiApiKey" | "geminiModel" | "accountBound">;
}

export interface ZaloAssistantService {
  replyToSalesQuery(input: ZaloAssistantRequest): Promise<string>;
}

export interface ZaloModeStore {
  getMode(accountId: string, chatId: string): Promise<ZaloMode>;
  setMode(accountId: string, chatId: string, mode: ZaloMode, updatedBy?: string): Promise<void>;
  clearMode(accountId: string, chatId: string): Promise<void>;
}

export interface ZaloRuntimeDeps {
  bot?: ZaloBotLike;
  dataService?: ZaloDataService;
  assistant?: ZaloAssistantService;
  modeStore?: ZaloModeStore;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

export interface ZaloBotLike {
  command(command: string, callback: (message: ZaloMessageLike, context: ZaloCommandContext) => Promise<void> | void): unknown;
  on(event: "text" | "message", callback: (message: ZaloMessageLike, metadata?: unknown) => Promise<void> | void): unknown;
  onError?(callback: (error: unknown, context: unknown) => Promise<void> | void): unknown;
  initialize(): Promise<void>;
  deleteWebhook?(options?: { dropPendingUpdates?: boolean }): Promise<boolean>;
  startPolling(options?: { timeoutSeconds?: number; retryDelayMs?: number; allowedUpdates?: string[] }): Promise<void>;
  shutdown(): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<unknown>;
  sendChatAction(chatId: string, action: string): Promise<boolean>;
  getMe(): Promise<ZaloBotIdentity>;
  cachedUser?: ZaloBotIdentity;
}

export interface ZaloRuntimeHandle {
  bot: ZaloBotLike;
  config: ZaloRuntimeConfig;
  start(): Promise<void>;
  stop(): Promise<void>;
}
