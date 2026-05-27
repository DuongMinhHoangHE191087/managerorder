/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared constants and utilities for all Telegram bot handlers
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveTelegramAdminChatId, sendTelegramMessage, escapeHtml, formatVnd, formatDateVn, sendMessageWithKeyboard, answerCallbackQuery, editMessageText, sendChatAction, setMyCommands, sendKbWithMenu, type TelegramButton, type TelegramReplyButton, type BotCommand } from '@/lib/utils/telegram';
import { decryptNotes } from '@/lib/utils/credential-crypto';
import {
  daysUntil, progressBar, findSimilarCommands, levenshtein,
  isValidCallbackData, getGreeting,
  premiumHeader, miniStat, SEPARATOR, HEADER_LINE,
  modernHeader, modernList, modernDetail, MODERN_SEPARATOR,
  PAGE_SIZE,
  type WizardSession,
} from '@/lib/services/telegram-bot.helpers';
import type { BotContext } from '../bot-router';

// ─── Constants ─────────────────────────────────────────────
export const ADMIN_CHAT_ID = resolveTelegramAdminChatId();
export const BOT_ACCOUNT_ID = process.env.TELEGRAM_BOT_ACCOUNT_ID ?? '';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';

// ─── Re-exports ────────────────────────────────────────────
export {
  supabaseAdmin,
  sendTelegramMessage, escapeHtml, formatVnd, formatDateVn,
  sendMessageWithKeyboard, answerCallbackQuery, editMessageText, sendChatAction,
  setMyCommands, sendKbWithMenu,
  decryptNotes,
  daysUntil, progressBar, findSimilarCommands, levenshtein,
  isValidCallbackData, getGreeting,
  premiumHeader, miniStat, SEPARATOR, HEADER_LINE,
  modernHeader, modernList, modernDetail, MODERN_SEPARATOR,
  PAGE_SIZE,
  type TelegramButton,
  type TelegramReplyButton,
  type BotCommand,
  type WizardSession,
  type BotContext,
};

// ─── Messaging helpers ─────────────────────────────────────
export function sendMsg(chatId: number, text: string): Promise<number | false> {
  return sendTelegramMessage(text, { chatId: String(chatId) });
}

export function sendKb(chatId: number, text: string, keyboard: TelegramButton[][]): Promise<number | false> {
  return sendMessageWithKeyboard(text, keyboard, { chatId: String(chatId) });
}

export function sendMenu(chatId: number, text: string, replyKeyboard: TelegramReplyButton[][], options?: { disableNotification?: boolean }): Promise<number | false> {
  return sendTelegramMessage(text, { 
    chatId: String(chatId), 
    replyKeyboard, 
    disableNotification: options?.disableNotification 
  });
}

export function editMsg(chatId: number, messageId: number, text: string, keyboard?: TelegramButton[][]): Promise<boolean> {
  return editMessageText(String(chatId), messageId, text, keyboard);
}

export function formatDate(d: string | null): string {
  if (!d) return 'N/A';
  return formatDateVn(d);
}

export function sendKbMenu(
  chatId: number, text: string,
  inlineKeyboard: TelegramButton[][],
  replyKeyboard: TelegramReplyButton[][]
): Promise<number | false> {
  return sendKbWithMenu(String(chatId), text, inlineKeyboard, replyKeyboard);
}

/** Normalize username: strip @, strip email domain, extract from Duolingo/FB URLs, handle ID:xxx */
export function normalizeUsername(input: string): { value: string; isNumericId: boolean } {
  let val = input.trim();
  // Handle "ID:xxx" or "id: xxx" prefix — extract numeric ID
  const idPrefixMatch = val.match(/^(?:ID|id)\s*:\s*(.+)/);
  if (idPrefixMatch) {
    val = idPrefixMatch[1].trim();
    return { value: val, isNumericId: /^\d+$/.test(val) };
  }
  // Strip leading @ (Telegram-style @username)
  if (val.startsWith('@')) val = val.slice(1);
  // Extract username from Duolingo profile URL
  const duoMatch = val.match(/duolingo\.com\/profile\/([^/?#]+)/i);
  if (duoMatch) val = duoMatch[1];
  // Extract Facebook numeric ID from profile.php?id=xxx
  const fbIdMatch = val.match(/(?:m\.|mbasic\.|web\.|www\.)?facebook\.com\/profile\.php\?id=(\d+)/i);
  if (fbIdMatch) { val = fbIdMatch[1]; }
  else {
    // Extract from any Facebook URL variant (m., mbasic., web., www.)
    const fbMatch = val.match(/(?:m\.|mbasic\.|web\.|www\.)?facebook\.com\/([^/?#]+)/i);
    if (fbMatch) {
      val = fbMatch[1];
      const invalidPaths = ['pages', 'groups', 'events', 'watch', 'marketplace', 'gaming', 'stories', 'reels'];
      if (invalidPaths.includes(val.toLowerCase())) val = '';
    }
  }
  // Strip email domain (user@gmail.com → user) for Duolingo lookups
  if (val.includes('@')) {
    val = val.split('@')[0];
  }
  val = val.trim();
  return { value: val, isNumericId: /^\d+$/.test(val) };
}

// ─── Session helpers for BotContext ─────────────────────────
export function getCtxSession(ctx: BotContext): WizardSession | null {
  return ctx.state.session ?? null;
}

export async function setCtxSession(ctx: BotContext, command: string, step: number, data: Record<string, any>) {
  if (ctx.state.setSession) {
    await ctx.state.setSession(command, step, data);
  }
}

export async function clearCtxSession(ctx: BotContext) {
  if (ctx.state.clearSession) {
    await ctx.state.clearSession();
  }
}
