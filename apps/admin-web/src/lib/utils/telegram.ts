// ============================================================
// SHARED TELEGRAM UTILITY
// Retry queue, rate limiting, inline keyboard support
// ============================================================

import { markBotRuntimeError, markBotRuntimeReply } from "@/lib/bot-manager/runtime-health";
import { formatDateShort, formatNumber, type FormatOptions } from "./formatters";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_ADMIN_CHAT_ID = (process.env.TELEGRAM_ADMIN_CHAT_ID ?? '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').trim();

export function resolveTelegramAdminChatId(): string {
  return TELEGRAM_ADMIN_CHAT_ID || TELEGRAM_CHAT_ID;
}

export function resolveTelegramDefaultChatId(): string {
  return resolveTelegramAdminChatId();
}

// ─── Rate Limiter (Token Bucket — 30 msgs/sec) ───────────────
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 1_000;
let tokenBucket = RATE_LIMIT;
let lastRefill = Date.now();

function consumeToken(): boolean {
  const now = Date.now();
  const elapsed = now - lastRefill;
  if (elapsed >= RATE_WINDOW_MS) {
    tokenBucket = RATE_LIMIT;
    lastRefill = now;
  }
  if (tokenBucket > 0) {
    tokenBucket--;
    return true;
  }
  return false;
}

async function waitForToken(): Promise<void> {
  while (!consumeToken()) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format number as currency-style amount for Telegram text (e.g. 1,500,000đ)
 */
export function formatVnd(amount: number, options?: FormatOptions): string {
  return `${formatNumber(Math.round(amount), options)}đ`;
}

/**
 * Format a date string to dd/MM/yyyy
 */
export function formatDateVn(dateStr: string | Date | null | undefined, options?: FormatOptions): string {
  return formatDateShort(dateStr, options);
}

/**
 * Send chat action (typing indicator) to Telegram
 */
export async function sendChatAction(chatId: string, action: 'typing' | 'upload_photo' = 'typing'): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => { /* non-critical */ });
}

// ─── Types ───────────────────────────────────────────────────

export interface TelegramButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
}

export interface TelegramReplyButton {
  text: string;
}

export interface SendMessageOptions {
  chatId?: string;
  buttons?: TelegramButton[];
  replyKeyboard?: TelegramReplyButton[][];
  retries?: number;
  disablePreview?: boolean;
  parseMode?: 'HTML' | 'MarkdownV2';
  disableNotification?: boolean;
}

// ─── Core: Send Telegram Message with Retry ──────────────────

const DEFAULT_RETRIES = 2;
const BASE_DELAY_MS = 300;

/**
 * Sleep for ms milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Send an HTML-formatted message to a Telegram chat.
 * Supports retry with exponential backoff, inline keyboard buttons,
 * custom chat IDs, and rate limiting.
 *
 * @returns message_id if message was sent successfully, false otherwise
 */
export async function sendTelegramMessage(
  text: string,
  options?: SendMessageOptions
): Promise<number | false> {
  const chatId = (options?.chatId ?? resolveTelegramDefaultChatId()).trim();
  const maxRetries = options?.retries ?? DEFAULT_RETRIES;
  const disablePreview = options?.disablePreview ?? true;
  const parseMode = options?.parseMode ?? 'HTML';
  const disableNotification = options?.disableNotification ?? false;

  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn('[Telegram] Missing BOT_TOKEN or CHAT_ID');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  // Build request body
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: disablePreview,
  };
  
  if (disableNotification) {
    body.disable_notification = true;
  }

  // Add inline keyboard if buttons provided
  if (options?.buttons && options.buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: [
        options.buttons.map((btn) => {
          const buttonObj: Record<string, unknown> = { text: btn.text };
          if (btn.url) buttonObj.url = btn.url;
          if (btn.callback_data) buttonObj.callback_data = btn.callback_data;
          if (btn.web_app) buttonObj.web_app = btn.web_app;
          return buttonObj;
        }),
      ],
    };
  } else if (options?.replyKeyboard && options.replyKeyboard.length > 0) {
    body.reply_markup = {
      keyboard: options.replyKeyboard,
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Rate limiting
    await waitForToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        await markBotRuntimeReply("telegram", {
          chatId,
          messageId: data?.result?.message_id ?? null,
        });
        return data?.result?.message_id ?? true;
      }

      // Telegram rate limit (429) — respect Retry-After header
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
        console.warn(`[Telegram] Rate limited. Retry after ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(retryAfter * 1_000);
        continue;
      }

      const errText = await res.text();
      console.error(`[Telegram] Failed (attempt ${attempt + 1}/${maxRetries}):`, errText);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[Telegram] Timeout (attempt ${attempt + 1}/${maxRetries})`);
      } else {
        console.error(`[Telegram] Error (attempt ${attempt + 1}/${maxRetries}):`, error);
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Exponential backoff before next retry (skip delay on last attempt)
    if (attempt < maxRetries - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  const failureMessage = `All ${maxRetries} attempts failed for chat ${chatId}`;
  console.error(`[Telegram] ${failureMessage}`);
  await markBotRuntimeError("telegram", new Error(failureMessage), { chatId });
  return false;
}

/**
 * Send a photo with caption to a Telegram chat.
 */
export async function sendTelegramPhoto(
  photoUrl: string,
  caption: string,
  options?: Omit<SendMessageOptions, 'disablePreview'>
): Promise<boolean> {
  const chatId = (options?.chatId ?? resolveTelegramDefaultChatId()).trim();
  const maxRetries = options?.retries ?? DEFAULT_RETRIES;

  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn('[Telegram] Missing BOT_TOKEN or CHAT_ID');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await waitForToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption,
          parse_mode: options?.parseMode ?? 'HTML',
        }),
        signal: controller.signal,
      });

      if (res.ok) return true;

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
        await sleep(retryAfter * 1_000);
        continue;
      }

      const errText = await res.text();
      console.error(`[Telegram] Photo send failed (attempt ${attempt + 1}/${maxRetries}):`, errText);
    } catch (error) {
      console.error(`[Telegram] Photo error (attempt ${attempt + 1}/${maxRetries}):`, error);
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < maxRetries - 1) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  return false;
}

/**
 * Answer a callback query from inline keyboard button press.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text ?? '',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Multi-row Inline Keyboard ──────────────────────────────

/**
 * Send an HTML message with a multi-row inline keyboard.
 * Each sub-array represents a row of buttons.
 */
export async function sendMessageWithKeyboard(
  text: string,
  keyboard: TelegramButton[][],
  options?: Omit<SendMessageOptions, 'buttons'>
): Promise<number | false> {
  const chatId = (options?.chatId ?? resolveTelegramDefaultChatId()).trim();
  const maxRetries = options?.retries ?? DEFAULT_RETRIES;

  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn('[Telegram] Missing BOT_TOKEN or CHAT_ID');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode ?? 'HTML',
    disable_web_page_preview: options?.disablePreview ?? true,
    reply_markup: {
      inline_keyboard: keyboard.map(row =>
        row.map(btn => {
          const obj: Record<string, unknown> = { text: btn.text };
          if (btn.url) obj.url = btn.url;
          if (btn.callback_data) obj.callback_data = btn.callback_data;
          if (btn.web_app) obj.web_app = btn.web_app;
          return obj;
        })
      ),
    },
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await waitForToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        await markBotRuntimeReply("telegram", {
          chatId,
          messageId: data?.result?.message_id ?? null,
        });
        return data?.result?.message_id ?? true;
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
        await sleep(retryAfter * 1_000);
        continue;
      }
      console.error(`[Telegram] Keyboard send failed (attempt ${attempt + 1}):`, await res.text());
    } catch (error) {
      console.error(`[Telegram] Keyboard error (attempt ${attempt + 1}):`, error);
    } finally {
      clearTimeout(timeoutId);
    }
    if (attempt < maxRetries - 1) await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
  }
  return false;
}

/**
 * Edit an existing message text and optional keyboard.
 */
export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string,
  keyboard?: TelegramButton[][]
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (keyboard) {
    body.reply_markup = {
      inline_keyboard: keyboard.map(row =>
        row.map(btn => {
          const obj: Record<string, unknown> = { text: btn.text };
          if (btn.url) obj.url = btn.url;
          if (btn.callback_data) obj.callback_data = btn.callback_data;
          if (btn.web_app) obj.web_app = btn.web_app;
          return obj;
        })
      ),
    };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      // Ignore 'message is not modified' error as it happens during rapid clicks
      if (!errText.includes('message is not modified')) {
        console.error('[Telegram] editMessageText failed:', errText, JSON.stringify(body).slice(0, 500));
      }
    } else {
      await markBotRuntimeReply("telegram", {
        chatId,
        messageId,
        edited: true,
      });
    }
    return res.ok;
  } catch (err) {
    console.error('[Telegram] editMessageText exception:', err);
    return false;
  }
}

// ─── Set Bot Menu Commands ──────────────────────────────────

export interface BotCommand {
  command: string;
  description: string;
}

/**
 * Register the / menu commands visible in Telegram's command picker.
 * This is the persistent menu users see when typing / in the chat.
 */
export async function setMyCommands(commands: BotCommand[]): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    if (!res.ok) {
      console.error('[Telegram] setMyCommands failed:', await res.text());
    }
    return res.ok;
  } catch (e) {
    console.error('[Telegram] setMyCommands error:', e);
    return false;
  }
}

// ─── Send with Inline KB + Persistent Reply KB ──────────────

/**
 * Send an HTML message with BOTH:
 * - Inline keyboard (buttons embedded in message)
 * - Persistent reply keyboard (always-visible bottom menu)
 * 
 * This avoids sending two separate messages.
 * The inline KB is sent first, then immediately followed by
 * a reply keyboard message (Telegram API limitation: can't have both in one message).
 */
export async function sendKbWithMenu(
  chatId: string,
  text: string,
  inlineKeyboard: TelegramButton[][],
  replyKeyboard: TelegramReplyButton[][],
  _options?: { disableNotification?: boolean }
): Promise<number | false> {
  // Send main message with inline keyboard
  const msgId = await sendMessageWithKeyboard(text, inlineKeyboard, { chatId });
  
  // Send a brief reply-keyboard-setting message (without notification)
  await sendTelegramMessage('👇 Menu nhanh', {
    chatId,
    replyKeyboard,
    disableNotification: true,
  });
  
  return msgId;
}

// ─── Testing helpers (exported for unit tests) ───────────────
export const _testHelpers = {
  resetRateLimiter: () => {
    tokenBucket = RATE_LIMIT;
    lastRefill = Date.now();
  },
};
