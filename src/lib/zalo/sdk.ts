import type { ZaloBotIdentity, ZaloBotLike, ZaloCommandContext, ZaloMessageLike, ZaloMessageUser } from "./types";

const DEFAULT_BASE_URL = "https://bot-api.zapps.me";
const DEFAULT_POLL_TIMEOUT_SECONDS = 30;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

type BotEventName = "message" | "text";

type ListenerCallback = (message: ZaloMessageLike, metadata?: unknown) => Promise<void> | void;

type CommandCallback = (message: ZaloMessageLike, context: ZaloCommandContext) => Promise<void> | void;

type ParsedCommand = {
  name: string;
  argsRaw: string;
  args: string[];
};

type ParsedUpdate = {
  updateId?: number;
  message: ZaloMessageLike;
  command?: ParsedCommand;
  raw: Record<string, unknown>;
};

interface BotOptions {
  token: string;
  baseUrl?: string;
}

interface StartPollingOptions {
  timeoutSeconds?: number;
  retryDelayMs?: number;
  allowedUpdates?: string[];
  onError?: (error: unknown, context: unknown) => Promise<void> | void;
}

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

class RequestTimeoutError extends Error {
  constructor(endpoint: string, timeoutMs: number) {
    super(`Request to ${endpoint} timed out after ${Math.ceil(timeoutMs / 1000)}s`);
    this.name = "RequestTimeoutError";
  }
}

class LocalZaloBot implements ZaloBotLike {
  private readonly baseUrl: string;
  private readonly eventListeners = new Map<BotEventName, ListenerCallback[]>();
  private readonly commandListeners: Array<{ command: string; callback: CommandCallback }> = [];
  private readonly errorHandlers: Array<(error: unknown, context: unknown) => Promise<void> | void> = [];
  private botUser: ZaloBotIdentity | undefined;
  private initialized = false;
  private pollingTask: Promise<void> | null = null;
  private pollingAbortController: AbortController | null = null;
  private pollingState: "idle" | "starting" | "running" | "stopping" = "idle";
  private nextUpdateOffset: number | undefined;

  constructor(config: BotOptions) {
    const token = config.token.trim();
    if (!token) {
      throw new Error("You must pass a bot token.");
    }

    this.baseUrl = `${config.baseUrl ?? DEFAULT_BASE_URL}/bot${token}`;
  }

  command(command: string, callback: CommandCallback): unknown {
    const normalized = normalizeCommand(command);
    if (!normalized) {
      throw new Error("Command name must not be empty");
    }

    this.commandListeners.push({ command: normalized, callback });
    return this;
  }

  on(event: BotEventName, callback: ListenerCallback): unknown {
    const listeners = this.eventListeners.get(event) ?? [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
    return this;
  }

  onError(callback: (error: unknown, context: unknown) => Promise<void> | void): unknown {
    this.errorHandlers.push(callback);
    return this;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.getMe();
    this.initialized = true;
  }

  async deleteWebhook(options?: { dropPendingUpdates?: boolean }): Promise<boolean> {
    const result = await this.post("deleteWebhook", {
      drop_pending_updates: options?.dropPendingUpdates,
    });
    return Boolean(result);
  }

  async startPolling(options: StartPollingOptions = {}): Promise<void> {
    if (this.pollingTask) {
      return this.pollingTask;
    }

    this.pollingState = "starting";
    this.pollingAbortController = new AbortController();
    this.pollingTask = this.runPolling(options).finally(() => {
      this.pollingState = "idle";
      this.pollingTask = null;
      this.pollingAbortController = null;
    });
    return this.pollingTask;
  }

  async shutdown(): Promise<void> {
    if (this.pollingState !== "idle") {
      this.pollingState = "stopping";
    }
    this.pollingAbortController?.abort();
    this.initialized = false;
    this.botUser = undefined;
  }

  async sendMessage(chatId: string, text: string): Promise<unknown> {
    return this.post("sendMessage", {
      chat_id: chatId,
      text,
    });
  }

  async sendChatAction(chatId: string, action: string): Promise<boolean> {
    const result = await this.post("sendChatAction", {
      chat_id: chatId,
      action,
    });
    return Boolean(result);
  }

  async getMe(): Promise<ZaloBotIdentity> {
    const result = await this.post("getMe", {});
    const user = parseBotIdentity(result);
    if (!user) {
      throw new Error("Bot API returned an invalid getMe payload.");
    }

    this.botUser = user;
    return user;
  }

  get cachedUser(): ZaloBotIdentity | undefined {
    return this.botUser;
  }

  private async runPolling(options: StartPollingOptions): Promise<void> {
    const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_POLL_TIMEOUT_SECONDS;
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    await this.initialize();
    if (this.pollingState === "stopping") {
      return;
    }

    this.pollingState = "running";
    try {
      while (this.pollingState === "running") {
        try {
          const updates = await this.getUpdates({
            timeoutSeconds,
            allowedUpdates: options.allowedUpdates,
            signal: this.pollingAbortController?.signal,
          });

          if (updates.length > 0) {
            for (const rawUpdate of updates) {
              const update = parseUpdate(rawUpdate, this);
              if (!update) {
                await this.reportError(new Error("Unable to parse incoming update payload"), {
                  kind: "payload_parse",
                  source: "polling",
                });
                continue;
              }

              if (typeof update.updateId === "number") {
                this.nextUpdateOffset = update.updateId + 1;
              }

              await this.dispatchUpdate(update);
              if (this.pollingState !== "running") {
                break;
              }
            }

            continue;
          }
        } catch (error) {
          if (
            !(error instanceof RequestTimeoutError) &&
            !isAbortError(error) &&
            this.pollingState === "running"
          ) {
            await this.reportError(error, {
              kind: "request_temporary",
              source: "polling",
            }, options.onError);
          }
        }

        if (this.pollingState !== "running") {
          break;
        }

        await sleep(retryDelayMs, this.pollingAbortController?.signal);
      }
    } finally {
      await this.shutdown();
    }
  }

  private async dispatchUpdate(update: ParsedUpdate): Promise<void> {
    const metadata = {
      update,
      command: update.command,
    };

    await this.emitEvent("message", update.message, metadata, update);

    if (update.message.text) {
      await this.emitEvent("text", update.message, metadata, update);
    }

    if (update.command) {
      for (const listener of this.commandListeners) {
        if (listener.command !== update.command.name) {
          continue;
        }

        try {
          await listener.callback(update.message, {
            command: update.command,
          });
        } catch (error) {
          await this.reportError(error, {
            kind: "listener_user_code",
            source: "command_listener",
            update,
            command: update.command,
            event: "command",
          });
        }
      }
    }
  }

  private async emitEvent(
    event: BotEventName,
    message: ZaloMessageLike,
    metadata: unknown,
    update: ParsedUpdate,
  ): Promise<void> {
    const listeners = [...(this.eventListeners.get(event) ?? [])];
    for (const listener of listeners) {
      try {
        await listener(message, metadata);
      } catch (error) {
        await this.reportError(error, {
          kind: "listener_user_code",
          source: "event_dispatch",
          update,
          event,
          command: update.command,
        });
      }
    }
  }

  private async reportError(
    error: unknown,
    context: unknown,
    overrideHandler?: (error: unknown, context: unknown) => Promise<void> | void,
  ): Promise<void> {
    console.error("[Zalo] Bot error:", error, context);

    const handlers = [
      ...(overrideHandler ? [overrideHandler] : []),
      ...this.errorHandlers,
    ];

    for (const handler of handlers) {
      try {
        await handler(error, context);
      } catch (handlerError) {
        console.error("[Zalo] Unhandled error from bot onError callback:", handlerError, context);
      }
    }
  }

  private async getUpdates(input: {
    timeoutSeconds: number;
    allowedUpdates?: string[];
    signal?: AbortSignal;
  }): Promise<unknown[]> {
    const timeoutMs = Math.max((input.timeoutSeconds + 5) * 1000, DEFAULT_REQUEST_TIMEOUT_MS);
    const result = await this.post(
      "getUpdates",
      {
        timeout: input.timeoutSeconds,
        offset: this.nextUpdateOffset,
        allowed_updates: input.allowedUpdates?.join(","),
      },
      {
        timeoutMs,
        signal: input.signal,
      },
    );

    return Array.isArray(result) ? result : [];
  }

  private async post(endpoint: string, data: Record<string, unknown>, options: RequestOptions = {}): Promise<unknown> {
    const payload = await this.requestJson(endpoint, data, options);
    if (isRecord(payload) && "result" in payload) {
      return payload.result;
    }

    return payload;
  }

  private async requestJson(
    endpoint: string,
    data: Record<string, unknown>,
    options: RequestOptions = {},
  ): Promise<unknown> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutController = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);

    const { signal, cleanup } = mergeAbortSignals(options.signal, timeoutController.signal);

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "zalo-bot-js",
        },
        body: JSON.stringify(stripNullish(data)),
        signal,
      });

      const text = await response.text();
      if (!response.ok) {
        const preview = text.trim().slice(0, 500);
        throw new Error(
          preview
            ? `Zalo API ${endpoint} failed (${response.status} ${response.statusText}): ${preview}`
            : `Zalo API ${endpoint} failed (${response.status} ${response.statusText})`,
        );
      }

      return parseJson(text);
    } catch (error) {
      if (isAbortError(error)) {
        if (timedOut) {
          throw new RequestTimeoutError(endpoint, timeoutMs);
        }
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanup();
    }
  }
}

export function createZaloBot(token: string): ZaloBotLike {
  return new LocalZaloBot({ token });
}

function parseUpdate(value: unknown, bot: LocalZaloBot): ParsedUpdate | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const message = parseMessage(value.message, bot);
  if (!message) {
    return undefined;
  }

  const updateId = asNumber(value.update_id);
  return {
    updateId,
    message,
    command: parseCommand(message.text),
    raw: value,
  };
}

function parseMessage(value: unknown, bot: LocalZaloBot): ZaloMessageLike | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const chat = parseChat(value.chat);
  const messageId = normalizeMessageId(value.message_id);
  if (!chat || !messageId) {
    return undefined;
  }

  const fromUser = parseMessageUser(value.from);
  const text = asString(value.text);

  return {
    chat,
    fromUser,
    text,
    replyText: async (replyText: string) => bot.sendMessage(chat.id, replyText),
  };
}

function parseChat(value: unknown): { id: string } | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }

  return { id: value.id };
}

function parseMessageUser(value: unknown): ZaloMessageUser | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }

  return {
    id: value.id,
    displayName: asString(value.display_name),
    accountName: asString(value.account_name),
    isBot: typeof value.is_bot === "boolean" ? value.is_bot : undefined,
  };
}

function parseBotIdentity(value: unknown): ZaloBotIdentity | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }

  return {
    id: value.id,
    displayName: asString(value.display_name),
    accountName: asString(value.account_name),
    accountType: asString(value.account_type),
    isBot: typeof value.is_bot === "boolean" ? value.is_bot : undefined,
    canJoinGroups: typeof value.can_join_groups === "boolean" ? value.can_join_groups : undefined,
  };
}

function parseCommand(text: string | undefined): ParsedCommand | undefined {
  if (!text) {
    return undefined;
  }

  const normalized = text.trim();
  if (!normalized.startsWith("/") || normalized.length <= 1) {
    return undefined;
  }

  const body = normalized.slice(1);
  const [rawName, ...rest] = body.split(/\s+/);
  const name = rawName.split("@")[0].trim().toLowerCase();
  if (!name) {
    return undefined;
  }

  const argsRaw = rest.join(" ").trim();
  return {
    name,
    argsRaw,
    args: argsRaw ? argsRaw.split(/\s+/) : [],
  };
}

function normalizeCommand(command: string): string {
  const normalized = command.trim().replace(/^\//, "");
  return normalized.toLowerCase();
}

function normalizeMessageId(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }

  return JSON.parse(trimmed) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function stripNullish(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function mergeAbortSignals(
  signalA: AbortSignal | undefined,
  signalB: AbortSignal | undefined,
): { signal?: AbortSignal; cleanup: () => void } {
  const signals = [signalA, signalB].filter((signal): signal is AbortSignal => Boolean(signal));
  if (signals.length === 0) {
    return { cleanup: () => undefined };
  }

  if (signals.length === 1) {
    return { signal: signals[0], cleanup: () => undefined };
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const cleanups: Array<() => void> = [];

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      continue;
    }

    signal.addEventListener("abort", onAbort, { once: true });
    cleanups.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    },
  };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
