// ============================================================
// TELEGRAM BOT SERVICE v9.0 — Full-featured webhook handler
// ============================================================
// 🔒 SECURITY: 3-layer protection
//   Layer 1: Webhook secret token (verified in route.ts)
//   Layer 2: Admin Chat ID whitelist (only YOUR chat ID)
//   Layer 3: Silent reject — bot does NOT respond to unauthorized users
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { sendTelegramMessage, escapeHtml, formatVnd, formatDateVn, sendMessageWithKeyboard, answerCallbackQuery, editMessageText, sendChatAction, type TelegramButton } from '@/lib/utils/telegram';
import { formatDateCustom, formatNumber } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createOrderWithItems } from '@/lib/services/order.service';
import { getOrderWithItemsByCode } from '@/lib/supabase/repositories/orders.repo';
import { createOrderStatusHistory } from '@/lib/supabase/repositories/order-status-history.repo';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';
import { decryptNotes } from '@/lib/utils/credential-crypto';
import { buildFinancialSummary, formatPaymentMethodLabel, mapLegacyStatusAlias, PAYMENT_STATE_VALUES, toLegacyPaymentMethod } from '@/lib/domain/financial';
import {
  isAuthorized as _isAuthorized,
  isBlocked as _isBlocked,
  recordFailedAttempt as _recordFailedAttempt,
  getSession as _getSession,
  setSession as _setSession,
  clearSession as _clearSession,
  levenshtein as _levenshtein,
  getGreeting,
  daysUntil,
  progressBar,
  findSimilarCommands,
  validateContactInput,
  appendUniqueContact,
  isValidCallbackData as _isValidCallbackData,
  PAGE_SIZE,
  DEFAULT_BLOCK_CONFIG,
  type TelegramUser,
  type TelegramMessage as _TelegramMessage,
  type TelegramCallbackQuery as _TelegramCallbackQuery,
  type TelegramUpdate,
  type WizardSession,
  type FailedAttemptRecord,
} from './telegram-bot.helpers';

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '';
let BOT_ACCOUNT_ID = (process.env.TELEGRAM_BOT_ACCOUNT_ID ?? process.env.ACCOUNT_ID ?? '').trim();

export function setLegacyBotAccountId(accountId: string): void {
  const normalized = accountId.trim();
  if (!normalized) return;
  BOT_ACCOUNT_ID = normalized;
  process.env.TELEGRAM_BOT_ACCOUNT_ID = normalized;
}

// Module-level state
const failedAttempts = new Map<number, FailedAttemptRecord>();
const sessions = new Map<number, WizardSession>();
/**
 * Exposed for BotRouter fallback — check if a legacy wizard session
 * is active so text input can be delegated to handleBotUpdate() instead
 * of the smart-search router.
 */
export function hasLegacySession(chatId: number): boolean {
  return _getSession(chatId, sessions) !== null;
}

// ─── Simple In-Memory Cache (30s TTL) ───────────────────────
const cacheStore = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 30_000;
function getCached<T = any>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data as T;
  if (entry) cacheStore.delete(key);
  return null;
}
function setCache(key: string, data: any): void {
  cacheStore.set(key, { data, ts: Date.now() });
  // Evict old entries (keep max 20)
  if (cacheStore.size > 20) {
    const oldest = [...cacheStore.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cacheStore.delete(oldest[0]);
  }
}

// ─── Wrapped Auth (uses module state + env) ─────────────────

function isAuthorized(chatId: number): boolean {
  if (!ADMIN_CHAT_ID) {
    console.error('[Bot Security] TELEGRAM_ADMIN_CHAT_ID is not configured! Bot is locked.');
    return false;
  }
  return _isAuthorized(chatId, ADMIN_CHAT_ID);
}

function isBlocked(chatId: number): boolean {
  return _isBlocked(chatId, failedAttempts, DEFAULT_BLOCK_CONFIG);
}

function recordFailedAttempt(chatId: number, user: TelegramUser): void {
  const record = _recordFailedAttempt(chatId, failedAttempts);

  console.warn(
    `[Bot Security] ⚠️ Unauthorized attempt #${record.count} | ` +
    `Chat: ${chatId} | User: ${user.first_name} ${user.last_name ?? ''} ` +
    `(@${user.username ?? 'no-username'}) | ID: ${user.id}`
  );

  if (record.count === DEFAULT_BLOCK_CONFIG.maxAttempts && ADMIN_CHAT_ID) {
    sendTelegramMessage(
      [
        `🚨 <b>CẢNH BÁO BẢO MẬT</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `Phát hiện ${DEFAULT_BLOCK_CONFIG.maxAttempts} lần truy cập trái phép!`,
        ``,
        `👤 User: <code>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name ?? '')}</code>`,
        `🆔 ID: <code>${user.id}</code>`,
        `📱 Username: @${escapeHtml(user.username ?? 'N/A')}`,
        `💬 Chat ID: <code>${chatId}</code>`,
        ``,
        `🔒 Đã tự động block user này 1 giờ.`,
      ].join('\n'),
      { chatId: ADMIN_CHAT_ID }
    ).catch(() => { /* non-critical */ });
  }
}

function getSession(chatId: number): WizardSession | null {
  return _getSession(chatId, sessions);
}
function setSession(chatId: number, command: string, step: number, data: Record<string, any>) {
  _setSession(chatId, sessions, command, step, data);
}
function clearSession(chatId: number) {
  _clearSession(chatId, sessions);
}

type TelegramCustomerBaseRow = {
  id: string;
  full_name: string;
  type?: string | null;
  created_at?: string | null;
  notes?: string | null;
  nicks_registry?: unknown;
};

type TelegramOrderBaseRow = {
  id: string;
  customer_id: string | null;
  product_id?: string | null;
  order_code: string | null;
  status: string | null;
  total_amount_vnd: number | null;
  total_paid: number | null;
  payment_method: string | null;
  payment_terms: string | null;
  created_at: string | null;
  expires_at: string | null;
  product_name_snapshot: string | null;
  sales_note?: string | null;
  notes?: string | null;
};

type TelegramCustomerContactRow = {
  customer_id: string;
  channel: string;
  value: string;
};

type TelegramOrderItemBaseRow = {
  order_id: string | null;
  customer_nick_used: string | null;
  product_name_snapshot: string | null;
};

async function loadTelegramCustomerMap(
  customerIds: string[],
  select = 'id, full_name, type, created_at, notes, nicks_registry',
): Promise<Map<string, TelegramCustomerBaseRow>> {
  return loadRowsByIds<TelegramCustomerBaseRow>(
    supabaseAdmin,
    'customers',
    BOT_ACCOUNT_ID,
    customerIds,
    select,
  );
}

async function loadTelegramOrderMap(
  orderIds: string[],
  select = 'id, customer_id, order_code, status, total_amount_vnd, total_paid, payment_method, payment_terms, created_at, expires_at, product_name_snapshot, sales_note, notes',
): Promise<Map<string, TelegramOrderBaseRow>> {
  return loadRowsByIds<TelegramOrderBaseRow>(
    supabaseAdmin,
    'orders',
    BOT_ACCOUNT_ID,
    orderIds,
    select,
  );
}

async function loadTelegramCustomerContacts(customerIds: string[]): Promise<Map<string, TelegramCustomerContactRow[]>> {
  const uniqueIds = [...new Set(customerIds.filter((id): id is string => Boolean(id)))];
  const contactMap = new Map<string, TelegramCustomerContactRow[]>();
  if (!uniqueIds.length) return contactMap;

  const { data, error } = await supabaseAdmin
    .from('customer_contacts')
    .select('customer_id, channel, value')
    .in('customer_id', uniqueIds);

  if (error) throw error;

  for (const row of (data ?? []) as TelegramCustomerContactRow[]) {
    const list = contactMap.get(row.customer_id) ?? [];
    list.push(row);
    contactMap.set(row.customer_id, list);
  }

  return contactMap;
}

function attachTelegramOrderCustomers<T extends { customer_id: string | null }>(
  rows: T[],
  customerMap: Map<string, TelegramCustomerBaseRow>,
): Array<T & { customers: Array<{ id: string; full_name: string; type?: string | null }> | null }> {
  return rows.map((row) => {
    const customer = row.customer_id ? customerMap.get(row.customer_id) ?? null : null;
    return {
      ...row,
      customers: customer
        ? [{ id: customer.id, full_name: customer.full_name, type: customer.type ?? null }]
        : null,
    };
  });
}

function attachTelegramCustomerContacts<T extends { id: string }>(
  rows: T[],
  contactMap: Map<string, TelegramCustomerContactRow[]>,
): Array<T & { customer_contacts: TelegramCustomerContactRow[] }> {
  return rows.map((row) => ({
    ...row,
    customer_contacts: contactMap.get(row.id) ?? [],
  }));
}

function getPrimaryTelegramContact(
  contacts: Array<{ channel: string; value: string }>,
): { channel: string; value: string } | null {
  return contacts.find((contact) => contact.channel === 'zalo')
    ?? contacts.find((contact) => contact.channel === 'phone')
    ?? null;
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSevenDayRevenueTrend(
  rows: Array<{ created_at: string | null; total_amount_vnd: number | null }>,
  now: Date,
): { trendChart: string; trendLabels: string } {
  const totalsByDay = new Map<string, number>();
  for (const row of rows) {
    if (!row.created_at) continue;
    const key = formatLocalDateKey(new Date(row.created_at));
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + (row.total_amount_vnd ?? 0));
  }

  const dayRevs: number[] = [];
  const dayLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    dayRevs.push(totalsByDay.get(formatLocalDateKey(d)) ?? 0);
    dayLabels.push(formatTelegramWeekday(d, 'narrow'));
  }

  const maxRev = Math.max(...dayRevs, 1);
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const trendChart = dayRevs.map((revenue) => blocks[Math.min(Math.floor((revenue / maxRev) * 7), 7)]).join('');

  return { trendChart, trendLabels: dayLabels.join(' ') };
}

// ─── Helpers ────────────────────────────────────────────────
function sendMsg(chatId: number, text: string) {
  return sendTelegramMessage(text, { chatId: String(chatId) });
}
function sendKb(chatId: number, text: string, keyboard: TelegramButton[][]) {
  return sendMessageWithKeyboard(text, keyboard, { chatId: String(chatId) });
}

/**
 * Edit-in-place or send new message.
 * If msgId is provided (callback context), edits existing message for instant UX.
 * Falls back to sendKb if edit fails (message too old / deleted).
 */
async function sendOrEdit(chatId: number, text: string, keyboard: TelegramButton[][], msgId?: number): Promise<boolean> {
  if (msgId) {
    const ok = await editMessageText(String(chatId), msgId, text, keyboard);
    if (ok) return true;
    // Fallback: edit failed (msg too old), send new
  }
  return (await sendKb(chatId, text, keyboard)) !== false;
}
function formatDate(d: string | null): string {
  if (!d) return 'N/A';
  return formatDateVn(d);
}

function formatTelegramDateOnly(date: string | Date | null | undefined) {
  return formatDateCustom(date, undefined, { day: '2-digit', month: '2-digit' });
}

function formatTelegramDateWithYear(date: string | Date | null | undefined) {
  return formatDateCustom(date, undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTelegramWeekday(date: string | Date | null | undefined, weekday: 'narrow' | 'long') {
  return formatDateCustom(date, undefined, { weekday });
}

function formatTelegramClock(date: string | Date | null | undefined) {
  return formatDateCustom(date, undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatTelegramCount(value: number | null | undefined) {
  return formatNumber(Number(value ?? 0));
}

const BOT_ORDER_STATUS_EMOJI: Record<string, string> = {
  draft: '⬜',
  pending_payment: '🟠',
  paid: '💳',
  provisioning: '🔵',
  active: '🟢',
  expired: '🔴',
  refunded: '🟣',
};

const BOT_ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  provisioning: 'Provisioning',
  active: 'Active',
  expired: 'Expired',
  refunded: 'Refunded',
};

const TELEGRAM_SEARCHABLE_ORDER_STATUSES = new Set([
  'draft',
  'pending_payment',
  'paid',
  'provisioning',
  'active',
  'expired',
  'refunded',
]);

function getOutstandingAmount(order: {
  total_amount_vnd?: number | null;
  total_paid?: number | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}) {
  return buildFinancialSummary(order).balance_due_vnd;
}

function hasOutstandingBalance(order: {
  total_amount_vnd?: number | null;
  total_paid?: number | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}) {
  return getOutstandingAmount(order) > 0;
}

function isDebtTrackedOrder(order: {
  status?: string | null;
  total_amount_vnd?: number | null;
  total_paid?: number | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}) {
  return !['draft', 'refunded'].includes(order.status ?? '') && hasOutstandingBalance(order);
}

function getStatusEmoji(status: string | null | undefined) {
  if (!status) return '⚪';
  return BOT_ORDER_STATUS_EMOJI[status] ?? '⚪';
}

function getStatusLabel(status: string | null | undefined) {
  if (!status) return 'Unknown';
  return `${getStatusEmoji(status)} ${BOT_ORDER_STATUS_LABEL[status] ?? status}`;
}

function getTelegramPaymentLabel(value: string | null | undefined) {
  return formatPaymentMethodLabel(value) || (value ?? '');
}

/**
 * Normalize username input:
 * - Strip @ prefix (@duolingo → duolingo)
 * - Extract from Duolingo URL (duolingo.com/profile/xxx → xxx)
 * - Extract from Facebook URL (facebook.com/xxx → xxx)
 * - Trim whitespace
 */
function normalizeUsername(input: string): { value: string; isNumericId: boolean } {
  let val = input.trim();
  // Strip @ prefix
  if (val.startsWith('@')) val = val.slice(1);
  // Extract from Duolingo profile URL
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
      // Strip common Facebook path suffixes that aren't usernames
      const invalidPaths = ['pages', 'groups', 'events', 'watch', 'marketplace', 'gaming', 'stories', 'reels'];
      if (invalidPaths.includes(val.toLowerCase())) val = '';
    }
  }
  val = val.trim();
  return { value: val, isNumericId: /^\d+$/.test(val) };
}

// ─── Main Update Handler ────────────────────────────────────

export async function handleBotUpdate(update: TelegramUpdate): Promise<void> {
  // Handle callback queries from inline keyboards
  if (update.callback_query) {
    const cbq = update.callback_query;
    const chatId = cbq.message?.chat?.id;
    const msgId = cbq.message?.message_id;
    if (!chatId || !isAuthorized(chatId)) return;
    // Fire-and-forget: don't block handler waiting for ack
    answerCallbackQuery(cbq.id).catch(() => {});
    if (cbq.data) await processCallbackQuery(chatId, cbq.data, msgId);
    return;
  }

  const message = update.message;
  if (!message?.text) return;
  const chatId = message.chat.id;
  const user = message.from;

  if (isBlocked(chatId)) return;
  if (!isAuthorized(chatId)) { recordFailedAttempt(chatId, user); return; }

  const text = message.text.trim();
  const [cmd, ...args] = text.split(/\s+/);
  const arg = args.join(' ');

  try {
    // Send typing indicator immediately (fire-and-forget)
    sendChatAction(String(chatId), 'typing').catch(() => {});
    // Check wizard session first
    const session = getSession(chatId);
    if (session && !text.startsWith('/')) {
      if (session.command === 'neworder') return await handleNewOrderWizard(chatId, text, session);
      if (session.command === 'newtask') return await handleNewTaskWizard(chatId, text, session);
      if (session.command === 'newproduct') return await handleNewProductWizard(chatId, text, session);
      if (session.command === 'newkho') return await handleNewKhoWizard(chatId, text, session);
      if (session.command === 'newcustomer') return await handleNewCustomerWizard(chatId, text, session);
      if (session.command === 'editcustomer') return await handleEditCustomerWizard(chatId, text, session);
      if (session.command === 'duolingo_lookup') { clearSession(chatId); return await handleDuolingo(chatId, text.trim().split(/\s+/)[0]); }
      if (session.command === 'fbid_lookup') { clearSession(chatId); return await handleFbid(chatId, text.trim()); }
      if (session.command === 'creds_search') return await handleCredsSearchWizard(chatId, text, session);
      if (session.command === 'record_payment') return await handlePaymentWizard(chatId, text, session);
    }

    if (cmd.toLowerCase() === '/cancel') { clearSession(chatId); await sendMsg(chatId, '❌ Đã hủy thao tác hiện tại.'); return; }

    switch (cmd.toLowerCase()) {
      case '/start': case '/help': return await handleStart(chatId);
      case '/stats': case '/revenue': return await handleStats(chatId);
      case '/orders': return await handleOrders(chatId);
      case '/find': case '/lookup': case '/tim': return await handleFind(chatId, arg);
      case '/search': return await handleAdvancedSearch(chatId, arg);
      case '/kho': return await handleKho(chatId, arg);
      case '/duolingo': case '/duo': case '/nick': return await handleDuolingo(chatId, arg);
      case '/fbid': return await handleFbid(chatId, arg);
      case '/tasks': return await handleTasks(chatId);
      case '/neworder': return await handleNewOrderStart(chatId);
      case '/newcustomer': return await handleNewCustomerStart(chatId);
      case '/allocate': return await handleAllocateStart(chatId);
      case '/newtask': return await handleNewTaskStart(chatId);
      case '/newproduct': return await handleNewProductStart(chatId);
      case '/newkho': return await handleNewKhoStart(chatId);
      case '/today': return await handleToday(chatId);
      case '/expiring': return await handleExpiring(chatId);
      case '/expired': return await handleExpired(chatId);
      case '/warehouse': return await handleWarehouse(chatId);
      case '/slots': return await handleSlots(chatId);
      case '/inventory': return await handleInventory(chatId, arg);
      case '/creds': return await handleCreds(chatId, arg);
      case '/detail': return await handleDetail(chatId, arg);
      case '/security': return await handleSecurityStatus(chatId);
      case '/customer': case '/kh': return await handleCustomerProfile(chatId, arg);
      case '/debt': case '/no': return await handleDebt(chatId);
      case '/summary': case '/report': return await handleSummary(chatId);
      case '/products': case '/sp': return await handleProducts(chatId);
      case '/active_accounts': case '/tk': return await handleActiveAccounts(chatId);
      case '/remind': return await handleQuickRemind(chatId, arg);
      case '/export': return await handleExport(chatId, arg);
      case '/note': return await handleQuickNote(chatId, arg);
      case '/pin': return await handlePinMessage(chatId, arg);
      case '/recent': return await handleRecent(chatId);
      default:
        if (!text.startsWith('/')) return await smartTextRouter(chatId, text);
        await suggestSimilarCommands(chatId, cmd.toLowerCase());
    }
  } catch (error) {
    console.error(`[Bot] ❌ Error processing "${text}":`, error);
    await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(error instanceof Error ? error.message : (typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error)))}`);
  }
}

// ─── Callback Query Router ──────────────────────────────────
async function processCallbackQuery(chatId: number, data: string, msgId?: number) {
  try {
    if (data.startsWith('cmd:')) {
      const cmd = data.replace('cmd:', '');
      if (cmd.startsWith('debt')) { const pg = parseInt(cmd.split(':page:')[1] || '0', 10) || 0; return await handleDebt(chatId, msgId, pg); }
      if (cmd.startsWith('products')) { const pg = parseInt(cmd.split(':page:')[1] || '0', 10) || 0; return await handleProducts(chatId, msgId, pg); }
      if (cmd.startsWith('active_accounts')) { const pg = parseInt(cmd.split(':page:')[1] || '0', 10) || 0; return await handleActiveAccounts(chatId, msgId, pg); }
      switch (cmd) {
        case 'help': case 'start': return await handleStart(chatId, msgId);
        case 'help_detail': return await handleHelp(chatId, msgId);
        case 'stats': return await handleStats(chatId, msgId);
        case 'orders': return await handleOrders(chatId, msgId);
        case 'kho': return await handleKho(chatId, '', msgId);
        case 'tasks': return await handleTasks(chatId, msgId);
        case 'neworder': return await handleNewOrderStart(chatId);
        case 'allocate': return await handleAllocateStart(chatId);
        case 'newtask': return await handleNewTaskStart(chatId);
        case 'newcustomer': return await handleNewCustomerStart(chatId);
        case 'newproduct': return await handleNewProductStart(chatId);
        case 'newkho': return await handleNewKhoStart(chatId);
        case 'duolingo': return await handleDuolingo(chatId, '');
        case 'fbid': return await handleFbid(chatId, '');
        case 'warehouse': return await handleWarehouse(chatId, msgId);
        case 'slots': return await handleSlots(chatId, msgId);
        case 'creds': return await handleCreds(chatId, '');
        case 'security': return await handleSecurityStatus(chatId, msgId);
        case 'search_prompt': return await handleSearchPrompt(chatId, msgId);
        case 'utilities': return await handleUtilities(chatId, msgId);
        case 'create_menu': return await handleCreateMenu(chatId, msgId);
        case 'customer': return await handleCustomerProfile(chatId, '', msgId);
        case 'summary': return await handleSummary(chatId, msgId);
        case 'recent': return await handleRecent(chatId, msgId);
        case 'webapp': {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://duongminhhoang.id.vn';
          return await sendKb(chatId, [
            `🌐 <b>Web App — ManagerOrder</b>`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `👇 Nhấn nút bên dưới để mở:`,
            ``,
            `📋 Link copy: <code>${escapeHtml(appUrl)}</code>`,
          ].join('\n'), [
            [{ text: '🌐 Mở Web App', web_app: { url: appUrl } }],
            [{ text: '📊 Dashboard', url: `${appUrl}/dashboard` }, { text: '📦 Đơn hàng', url: `${appUrl}/orders` }],
            [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
          ]);
        }
        case 'cancel': clearSession(chatId); await sendMsg(chatId, '❌ Đã hủy.'); return;
        case 'search': return await handleAdvancedSearch(chatId, '');
      }
    }
    if (data.startsWith('orders:')) {
      const sub = data.replace('orders:', '');
      // Support pagination: orders:today:page:2
      if (sub.startsWith('today')) { const pg = parseInt(sub.split(':page:')[1] ?? '0'); return await handleToday(chatId, pg); }
      if (sub.startsWith('expiring')) { const pg = parseInt(sub.split(':page:')[1] ?? '0'); return await handleExpiring(chatId, pg); }
      if (sub.startsWith('expired')) { const pg = parseInt(sub.split(':page:')[1] ?? '0'); return await handleExpired(chatId, pg); }
    }
    if (data.startsWith('kho:')) {
      const sub = data.replace('kho:', '');
      if (sub === 'stats') return await handleWarehouse(chatId);
      if (sub.startsWith('slots')) { const pg = parseInt(sub.split(':page:')[1] ?? '0'); return await handleSlots(chatId, msgId, pg); }
      if (sub === 'creds') return await handleCreds(chatId, '');
      if (sub === 'active') return await handleActiveAccounts(chatId, msgId);
    }
    if (data.startsWith('detail:')) { const id = data.replace('detail:', ''); return await handleDetail(chatId, id); }
    if (data.startsWith('editcust:')) { return await handleEditCustomer(chatId, data.replace('editcust:', '')); }
    if (data.startsWith('delcust:')) { return await handleDeleteCustomer(chatId, data.replace('delcust:', '')); }
    if (data.startsWith('creds:')) return await handleCredsCallback(chatId, data);
    if (data.startsWith('no:')) return await handleNewOrderCallback(chatId, data);
    if (data.startsWith('nc:')) return await handleNewCustomerCallback(chatId, data);
    if (data.startsWith('ec:')) return await handleEditCustomerCallback(chatId, data);
    if (data.startsWith('alloc:')) return await handleAllocateCallback(chatId, data);
    if (data.startsWith('task:')) return await handleNewTaskCallback(chatId, data);
    if (data.startsWith('np:')) return await handleNewProductCallback(chatId, data);
    if (data.startsWith('nk:')) return await handleNewKhoCallback(chatId, data);
    if (data.startsWith('prodview:')) return await handleProductView(chatId, data);
    if (data.startsWith('custpage:')) {
      const page = parseInt(data.replace('custpage:', '')) || 0;
      return await handleCustomerProfile(chatId, '', msgId, page);
    }
    if (data.startsWith('copy:')) {
      const val = data.replace('copy:', '');
      await sendMsg(chatId, `📋 <b>Copy:</b> <code>${escapeHtml(val)}</code>`);
      return;
    }
    if (data.startsWith('tdone:')) return await handleTaskDoneToggle(chatId, data);
    if (data.startsWith('sf:')) return await handleSearchFilter(chatId, data);
    if (data.startsWith('credreveal:')) return await handleCredReveal(chatId, data);
    if (data.startsWith('ostatus:')) return await handleOrderStatusPicker(chatId, data);
    if (data.startsWith('setstatus:')) return await handleOrderStatusSet(chatId, data);
    if (data.startsWith('pay:')) return await handlePaymentStart(chatId, data);
    if (data.startsWith('payfull:')) {
      const parts = data.replace('payfull:', '').split(':');
      const orderCode = parts[0]; const amount = parseInt(parts[1], 10);
      const { data: order } = await supabaseAdmin.from('orders').select('id, total_paid').ilike('order_code', `%${orderCode}%`).limit(1).maybeSingle();
      if (order) {
        const newPaid = (order.total_paid ?? 0) + amount;
        await supabaseAdmin.from('orders').update({ total_paid: newPaid }).eq('id', order.id);
        await sendKb(chatId, `✅ Đã thanh toán <b>${formatVnd(amount)}</b> cho <b>${escapeHtml(orderCode)}</b>`, [
          [{ text: '📋 Chi tiết', callback_data: `detail:${orderCode}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
        ]);
      } else {
        await sendMsg(chatId, `❌ Không tìm thấy đơn: <code>${escapeHtml(orderCode)}</code>`);
      }
      return;
    }

    if (data.startsWith('runcmd:')) {
      const runcmd = data.replace('runcmd:', '');
      const [c, ...a] = runcmd.split(' ');
      return await handleBotUpdate({ update_id: 0, message: { message_id: 0, from: { id: 0, first_name: '' }, chat: { id: chatId, type: 'private' }, text: `/${c} ${a.join(' ')}`.trim(), date: 0 } });
    }
  } catch (error) {
    console.error('[Bot] Callback error:', error);
    const errStr = error instanceof Error ? error.message : (typeof error === 'object' && error !== null ? JSON.stringify(error).slice(0, 200) : String(error));
    await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(errStr)}`);
  }
}

// ─── Utilities & Create Menu (new sub-menus) ────────────────

async function handleSearchPrompt(chatId: number, msgId?: number) {
  await sendOrEdit(chatId, [
    `🔍 <b>TÌM KIẾM THÔNG MINH</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Gõ bất kỳ từ khóa để tìm:`,
    ``,
    `  📦 <b>Đơn hàng:</b> mã đơn, tên SP`,
    `  👤 <b>Khách hàng:</b> tên, email, SĐT`,
    `  🏷 <b>Nick:</b> nick game, nick dịch vụ`,
    `  📧 <b>Kho:</b> email kho hàng`,
    ``,
    `💡 VD: <code>hoang</code> hoặc <code>ORD-2603</code>`,
  ].join('\n'), [
    [{ text: '📦 Đơn hôm nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

async function handleUtilities(chatId: number, msgId?: number) {
  await sendOrEdit(chatId, [
    `⚙️ <b>TIỆN ÍCH & CÔNG CỤ</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Chọn công cụ cần dùng:`,
  ].join('\n'), [
    [{ text: '🦉 Tra Duolingo', callback_data: 'cmd:duolingo' }, { text: '📘 Lấy FB ID', callback_data: 'cmd:fbid' }],
    [{ text: '🔐 Creds', callback_data: 'cmd:creds' }, { text: '🔒 Bảo mật', callback_data: 'cmd:security' }],
    [{ text: '📦 TK kho', callback_data: 'kho:stats' }, { text: '🔗 Slot trống', callback_data: 'kho:slots' }],
    [{ text: '📤 Export', callback_data: 'runcmd:export' }, { text: '⏰ Remind', callback_data: 'runcmd:remind' }],
    [{ text: '🏷 SP', callback_data: 'cmd:products' }, { text: '📊 Báo cáo', callback_data: 'cmd:summary' }],
    [{ text: '🌐 Web App', callback_data: 'cmd:webapp' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

async function handleCreateMenu(chatId: number, msgId?: number) {
  await sendOrEdit(chatId, [
    `➕ <b>TẠO NHANH</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Chọn loại cần tạo:`,
    ``,
    `📦 <b>Đơn hàng</b> — Tạo đơn + gán nick + tra cứu`,
    `🏷 <b>Sản phẩm</b> — Thêm SP mới vào hệ thống`,
    `📦 <b>Kho hàng</b> — Thêm email tài khoản nguồn`,
    `📝 <b>Task</b> — Lịch hẹn, nhắc việc, thu nợ`,
  ].join('\n'), [
    [{ text: '📦 Đơn mới', callback_data: 'cmd:neworder' }, { text: '🔗 Gán kho', callback_data: 'cmd:allocate' }],
    [{ text: '🏷 SP mới', callback_data: 'cmd:newproduct' }, { text: '📦 Kho mới', callback_data: 'cmd:newkho' }],
    [{ text: '📝 Task', callback_data: 'cmd:newtask' }, { text: '⏰ Remind', callback_data: 'runcmd:remind' }],
    [{ text: '👤 KH mới', callback_data: 'cmd:newcustomer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

// ─── /help (detailed) ───────────────────────────────────────

async function handleHelp(chatId: number, msgId?: number) {
  const msg = [
    `❓ <b>HƯỚNG DẪN v11.0</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>TỔNG QUAN</b>`,
    `/start — Dashboard | /stats — Thống kê`,
    `/summary — Báo cáo ngày | /tasks — Tasks`,
    ``,
    `📦 <b>ĐƠN HÀNG</b>`,
    `/orders — Menu | /today — Hôm nay`,
    `/recent — 10 đơn gần nhất`,
    `/find <code>kw</code> — Tìm | /detail <code>mã</code> — Chi tiết`,
    ``,
    `📦 <b>KHO</b>`,
    `/kho — Menu | /warehouse — TK kho`,
    `/slots — Slot trống | /creds — Credentials`,
    ``,
    `👤 <b>KH</b>`,
    `/customer <code>tên</code> — Hồ sơ | /debt — Nợ`,
    ``,
    `🛠 <b>TẠO</b>`,
    `/neworder | /newtask | /newproduct | /newkho`,
    ``,
    `🔧 <b>TIỆN ÍCH</b>`,
    `/duolingo <code>user</code> | /fbid <code>URL</code>`,
    `/remind <code>2h text</code> — Nhắc nhanh`,
    `/export — Xuất dữ liệu text`,
    `/note <code>ORD-xxx text</code> — Ghi chú đơn`,
    `/pin <code>text</code> — Ghim tin nhắn`,
    ``,
    `⚡ <b>SHORTCUTS</b>`,
    `Gõ <code>ORD-xxx</code> → chi tiết | <code>email</code> → kho`,
    `Gõ <code>SĐT</code> → KH | URL Duo/FB → tra ngay`,
  ].join('\n');
  await sendOrEdit(chatId, msg, [
    [{ text: '📊 Dashboard', callback_data: 'cmd:stats' }, { text: '📦 Đơn', callback_data: 'cmd:orders' }],
    [{ text: '📋 Gần nhất', callback_data: 'cmd:recent' }, { text: '💳 Nợ', callback_data: 'cmd:debt' }],
    [{ text: '📤 Export', callback_data: 'runcmd:export' }, { text: '📌 Pin', callback_data: 'runcmd:pin' }],
    [{ text: '➕ Tạo nhanh', callback_data: 'cmd:create_menu' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

// ─── /start ─────────────────────────────────────────────────

async function handleStart(chatId: number, msgId?: number) {
  // Check cache first (dashboard stats rarely change within 30s)
  const cached = getCached<any>('dashboard');
  if (cached) {
    await sendOrEdit(chatId, cached.msg, cached.keyboard, msgId);
    return;
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekLater = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const [ordersToday, ordersExpiring, ordersExpired, tasksCount, accountsData, revTodayData, revWeekData, revMonthData, debtData, newCustsToday, expSoonAccounts] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now.toISOString()).lte('expires_at', weekLater),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('reminder_events').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).eq('is_done', false),
    supabaseAdmin.from('source_accounts').select('id, max_slots, used_slots').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', weekAgo).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', monthStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('status, total_amount_vnd, total_paid, payment_method, payment_terms').eq('account_id', BOT_ACCOUNT_ID).not('status', 'in', '(draft,refunded)'),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
    supabaseAdmin.from('source_accounts').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).lte('expires_at', weekLater).gte('expires_at', now.toISOString()),
  ]);
  const revToday = (revTodayData.data ?? []).reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
  const revWeek = (revWeekData.data ?? []).reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
  const revMonth = (revMonthData.data ?? []).reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
  const totalDebt = (debtData.data ?? []).reduce((sum, order) => sum + (isDebtTrackedOrder(order) ? getOutstandingAmount(order) : 0), 0);
  const greeting = getGreeting();
  const tdy = ordersToday.count ?? 0;
  const exp = ordersExpiring.count ?? 0;
  const expd = ordersExpired.count ?? 0;
  const tsk = tasksCount.count ?? 0;
  const accounts = accountsData.data ?? [];
  const kho = accounts.length;
  const newCusts = newCustsToday.count ?? 0;
  const expSoon = expSoonAccounts.count ?? 0;
  // Kho usage mini-bar
  const totalSlots = accounts.reduce((s, a: any) => s + (a.max_slots ?? 0), 0);
  const usedSlots = accounts.reduce((s, a: any) => s + (a.used_slots ?? 0), 0);
  const khoPct = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
  const _khoBar = progressBar(khoPct, 12);
  // Timestamp
  const timeStr = formatDateCustom(now, undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  // Kho health indicator
  const khoHealth = khoPct < 60 ? '🟢' : khoPct < 85 ? '🟡' : '🔴';
  // Alert badges
  const alerts: string[] = [];
  if (exp > 0) alerts.push(`⏰ ${exp} đơn sắp hạn`);
  if (expSoon > 0) alerts.push(`⚠️ ${expSoon} TK kho sắp hết hạn`);
  if (totalDebt > 0) alerts.push(`🔴 Nợ: ${formatVnd(totalDebt)}`);
  if (expd > 0) alerts.push(`❌ ${expd} đơn hết hạn`);

  const msg = [
    `🤖 <b>ManagerOrder v11.0</b>  📅 ${timeStr}`,
    `${greeting}! 👋`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📦 Đơn: <b>${tdy}</b> hôm nay  ⏰ <b>${exp}</b> sắp hạn  📋 <b>${tsk}</b> tasks`,
    `💰 Hôm nay: <b>${formatVnd(revToday)}</b>  📆 Tuần: <b>${formatVnd(revWeek)}</b>`,
    `💵 Tháng: <b>${formatVnd(revMonth)}</b>${totalDebt > 0 ? `  🔴 Nợ: <b>${formatVnd(totalDebt)}</b>` : ''}`,
    `${khoHealth} Kho: <b>${kho}</b> TK  🔗 <b>${usedSlots}/${totalSlots}</b> slot (${khoPct}%)${newCusts > 0 ? `  👤 +${newCusts} KH mới` : ''}`,
    alerts.length ? `\n🚨 <b>CẢNH BÁO:</b>\n${alerts.map(a => `  ${a}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  // Build keyboard with counts
  const keyboard: TelegramButton[][] = [
    [{ text: `📊 Stats`, callback_data: 'cmd:stats' }, { text: `📦 Đơn (${tdy})`, callback_data: 'cmd:orders' }, { text: `📋 Tasks (${tsk})`, callback_data: 'cmd:tasks' }],
    [{ text: `⏰ Sắp hạn (${exp})`, callback_data: 'orders:expiring' }, { text: `🟢 Kho (${kho})`, callback_data: 'cmd:active_accounts' }],
    [{ text: '👤 Khách hàng', callback_data: 'cmd:customer' }, { text: `💳 Nợ`, callback_data: 'cmd:debt' }, { text: '📊 Báo cáo', callback_data: 'cmd:summary' }],
    [{ text: '➕ Tạo nhanh', callback_data: 'cmd:create_menu' }, { text: '⚙️ Tiện ích', callback_data: 'cmd:utilities' }],
    [{ text: '🔍 Tìm kiếm', callback_data: 'cmd:search_prompt' }, { text: '🌐 Web App', callback_data: 'cmd:webapp' }, { text: '❓ Help', callback_data: 'cmd:help_detail' }],
  ];
  setCache('dashboard', { msg, keyboard });
  await sendOrEdit(chatId, msg, keyboard, msgId);
}

// ─── /stats ─────────────────────────────────────────────────

async function handleStats(chatId: number, msgId?: number) {
  const supabase = supabaseAdmin;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekLater = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const [ordersToday, ordersWeek, ordersActive, accountsTotal, accountsExpiring, revTodayD, revWeekD, revMonthD, debtD, totalOrders, paidOrders, custsTotal, revByDay] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('source_accounts').select('id, max_slots, used_slots').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
    supabase.from('source_accounts').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).lte('expires_at', weekLater).gte('expires_at', now.toISOString()),
    supabase.from('orders').select('total_amount_vnd').gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('orders').select('total_amount_vnd').gte('created_at', weekAgo).eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('orders').select('total_amount_vnd').gte('created_at', monthStart).eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('orders').select('status, total_amount_vnd, total_paid, payment_method, payment_terms').eq('account_id', BOT_ACCOUNT_ID).not('status', 'in', '(draft,refunded)'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).in('status', ['paid', 'active']),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
    supabase.from('orders').select('total_amount_vnd, created_at').gte('created_at', weekAgo).eq('account_id', BOT_ACCOUNT_ID),
  ]);
  const revToday = (revTodayD.data ?? []).reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
  const revWeek = (revWeekD.data ?? []).reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
  const revMonth = (revMonthD.data ?? []).reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
  const totalDebt = (debtD.data ?? []).reduce((sum, order) => sum + (isDebtTrackedOrder(order) ? getOutstandingAmount(order) : 0), 0);
  const allAccs = (accountsTotal.data ?? []) as { max_slots: number; used_slots: number }[];
  const totalSlots = allAccs.reduce((s, a) => s + a.max_slots, 0);
  const usedSlots = allAccs.reduce((s, a) => s + a.used_slots, 0);
  const slotPct = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
  const payRate = (totalOrders.count ?? 0) > 0 ? Math.round(((paidOrders.count ?? 0) / (totalOrders.count ?? 0)) * 100) : 0;

  const { trendChart, trendLabels } = buildSevenDayRevenueTrend(
    (revByDay.data ?? []) as Array<{ created_at: string | null; total_amount_vnd: number | null }>,
    now,
  );

  await sendOrEdit(chatId, [
    `📊 <b>THỐNG KÊ TỔNG HỢP</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📦 Đơn: <b>${ordersToday.count ?? 0}</b> nay | <b>${ordersWeek.count ?? 0}</b> tuần | <b>${ordersActive.count ?? 0}</b> active`,
    `📈 Tỷ lệ TT: <b>${payRate}%</b> (${paidOrders.count ?? 0}/${totalOrders.count ?? 0})`,
    ``,
    `💰 <b>DOANH THU</b>`,
    `  📅 Nay: <b>${formatVnd(revToday)}</b>  📆 Tuần: <b>${formatVnd(revWeek)}</b>`,
    `  📅 Tháng: <b>${formatVnd(revMonth)}</b>${totalDebt > 0 ? `  🔴 Nợ: <b>${formatVnd(totalDebt)}</b>` : ''}`,
    `  📈 7 ngày: <code>${trendChart}</code>`,
    `  ${trendLabels}`,
    ``,
    `📦 Kho: <b>${allAccs.length}</b> TK | <b>${usedSlots}/${totalSlots}</b> (${slotPct}%) | ⚠️ <b>${accountsExpiring.count ?? 0}</b> sắp hạn`,
    `👥 KH: <b>${custsTotal.count ?? 0}</b>`,
  ].join('\n'), [
    [{ text: '📋 Nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }, { text: '💳 Nợ', callback_data: 'cmd:debt' }],
    [{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '📊 Báo cáo', callback_data: 'cmd:summary' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

// ─── /orders ────────────────────────────────────────────────

async function handleOrders(chatId: number, msgId?: number) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekLater = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const [tdy, exp, expd] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now.toISOString()).lte('expires_at', weekLater),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID),
  ]);
  const { count: unpaidCnt } = await supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).eq('status', 'pending_payment');
  await sendOrEdit(chatId, [
    `📦 <b>QUẢN LÝ ĐƠN HÀNG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 Nay: <b>${tdy.count ?? 0}</b> | ⏰ Sắp hạn: <b>${exp.count ?? 0}</b>`,
    `❌ Hết hạn: <b>${expd.count ?? 0}</b> | 🟡 Chưa TT: <b>${unpaidCnt ?? 0}</b>`,
  ].join('\n'), [
    [{ text: `📋 Hôm nay (${tdy.count ?? 0})`, callback_data: 'orders:today' }, { text: `⏰ Sắp hạn (${exp.count ?? 0})`, callback_data: 'orders:expiring' }],
    [{ text: `❌ Hết hạn (${expd.count ?? 0})`, callback_data: 'orders:expired' }, { text: `🟡 Chưa TT (${unpaidCnt ?? 0})`, callback_data: 'runcmd:search payment_state:unpaid' }],
    [{ text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '➕ Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🔗 Gán kho', callback_data: 'cmd:allocate' }],
    [{ text: '📤 Export', callback_data: 'runcmd:export orders' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

// ─── /today ─── Pagination support ──────────────────────────

async function handleToday(chatId: number, page = 0) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const { count: totalCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID);
  const total = totalCount ?? 0;
  if (!total) { await sendMsg(chatId, '📭 Chưa có đơn hôm nay.'); return; }
  const { data: rawOrders } = await supabaseAdmin.from('orders')
    .select('id, customer_id, order_code, status, total_amount_vnd, created_at, product_name_snapshot')
    .gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (!rawOrders?.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  const customerMap = await loadTelegramCustomerMap([...new Set(rawOrders.map(o => o.customer_id).filter((id): id is string => Boolean(id)))], 'id, full_name');
  const orders = attachTelegramOrderCustomers(rawOrders as TelegramOrderBaseRow[], customerMap);
  const lines = orders.map((o, _i) => {
    const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as { full_name: string } | null;
    const time = o.created_at ? formatTelegramClock(new Date(o.created_at)) : '';
    return `${getStatusEmoji(o.status)} <code>${escapeHtml(o.order_code ?? '')}</code> ${escapeHtml(c?.full_name ?? 'N/A').slice(0, 12)} ${formatVnd(o.total_amount_vnd ?? 0)} ${time}`;
  });
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trước', callback_data: `orders:today:page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `orders:today:page:${page + 1}` });
  // Quick detail buttons (top 5)
  const detailBtns: TelegramButton[][] = orders.slice(0, 5).map(o => [
    { text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` },
  ]);
  const btns: TelegramButton[][] = [...detailBtns, navRow];
  btns.push([{ text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }, { text: '➕ Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  await sendKb(chatId, [`📋 <b>ĐƠN HÔM NAY</b> (${total})`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...lines].join('\n'), btns);
}

// ─── /expiring ─── Pagination support ───────────────────────

async function handleExpiring(chatId: number, page = 0) {
  const now = new Date().toISOString();
  const weekLater = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { count: totalCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now).lte('expires_at', weekLater);
  const total = totalCount ?? 0;
  if (!total) { await sendMsg(chatId, '✅ Không có đơn sắp hạn trong 7 ngày.'); return; }
  const { data: rawOrders } = await supabaseAdmin.from('orders')
    .select('id, customer_id, order_code, expires_at, product_name_snapshot')
    .eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now).lte('expires_at', weekLater).order('expires_at')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (!rawOrders?.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  const customerMap = await loadTelegramCustomerMap([...new Set(rawOrders.map(o => o.customer_id).filter((id): id is string => Boolean(id)))], 'id, full_name');
  const orders = attachTelegramOrderCustomers(rawOrders as TelegramOrderBaseRow[], customerMap);
  const lines = orders.map((o, _i) => {
    const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as { full_name: string } | null;
    const remaining = daysUntil(o.expires_at);
    const urgency = remaining <= 2 ? '🔴' : remaining <= 4 ? '🟠' : '🟡';
    return `${urgency} <code>${escapeHtml(o.order_code ?? '')}</code> ${escapeHtml(c?.full_name ?? 'N/A').slice(0, 12)} còn <b>${remaining}d</b> ${formatDate(o.expires_at)}`;
  });
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trước', callback_data: `orders:expiring:page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `orders:expiring:page:${page + 1}` });
  // Quick detail buttons (top 5)
  const detailBtns: TelegramButton[][] = orders.slice(0, 5).map(o => [
    { text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` },
  ]);
  const btns: TelegramButton[][] = [...detailBtns, navRow];
  btns.push([{ text: '📋 Hôm nay', callback_data: 'orders:today' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  await sendKb(chatId, [`⏰ <b>SẮP HẾT HẠN</b> (${total})`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...lines].join('\n'), btns);
}

// ─── /expired ───────────────────────────────────────────────

async function handleExpired(chatId: number, page = 0) {
  const { count: totalCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID);
  const total = totalCount ?? 0;
  if (!total) { await sendMsg(chatId, '✅ Không có đơn hết hạn.'); return; }
  const { data: rawOrders } = await supabaseAdmin.from('orders')
    .select('id, customer_id, order_code, expires_at, product_name_snapshot')
    .eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID).order('expires_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (!rawOrders?.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  const customerMap = await loadTelegramCustomerMap([...new Set(rawOrders.map(o => o.customer_id).filter((id): id is string => Boolean(id)))], 'id, full_name');
  const orders = attachTelegramOrderCustomers(rawOrders as TelegramOrderBaseRow[], customerMap);
  const lines = orders.map((o, _i) => {
    const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as { full_name: string } | null;
    const ago = Math.abs(daysUntil(o.expires_at));
    return `🔴 <code>${escapeHtml(o.order_code ?? '')}</code> ${escapeHtml(c?.full_name ?? 'N/A').slice(0, 12)} hết <b>${ago}d</b> trước`;
  });
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trước', callback_data: `orders:expired:page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `orders:expired:page:${page + 1}` });

  const detailBtns: TelegramButton[][] = orders.slice(0, 5).map(o => [
    { text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` },
  ]);
  const btns: TelegramButton[][] = [...detailBtns, navRow];
  btns.push([{ text: '📋 Hôm nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }]);
  btns.push([{ text: '📤 Export', callback_data: 'runcmd:export orders' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  
  await sendKb(chatId, [`❌ <b>ĐÃ HẾT HẠN</b> (${total})`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...lines].join('\n'), btns);
}

// ─── /find — Smart search (đa chiều) ────────────────────────

async function handleFind(chatId: number, query: string) {
  if (!query) {
    // Menu tìm kiếm danh mục
    await sendKb(chatId, [
      `🔍 <b>TÌM KIẾM THÔNG MINH</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Gõ bất kỳ từ khóa để tìm:`,
      ``,
      `  📦 <b>Đơn hàng:</b> mã đơn, tên SP`,
      `  👤 <b>Khách hàng:</b> tên, SĐT, email`,
      `  🏷 <b>Nick:</b> nick game, nick dịch vụ`,
      `  📧 <b>Kho:</b> email kho hàng`,
      `  🏷 <b>Sản phẩm:</b> tên sản phẩm`,
      ``,
      `💡 VD: <code>/find hoang</code> hoặc <code>0987654321</code>`,
      `💡 Gõ text bất kỳ (không cần /find) → tự tìm`,
    ].join('\n'), [
      [{ text: '📦 Đơn hôm nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }],
      [{ text: '👤 Khách hàng', callback_data: 'cmd:customer' }, { text: '💳 Thu nợ', callback_data: 'cmd:debt' }],
      [{ text: '📦 Kho hàng', callback_data: 'cmd:kho' }, { text: '🏷 Sản phẩm', callback_data: 'cmd:products' }],
      [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }
  const results: string[] = [];
  const actionButtons: TelegramButton[][] = [];
  let totalFound = 0;
  const queryDigits = query.replace(/\D/g, '');

  // Parallel search across all entities
  const [ordersByCode, ordersByProduct, custsByName, custsByNotes, byContact, byNick, byKhoEmail, byProduct] = await Promise.all([
    // Search orders by code
    supabaseAdmin.from('orders')
      .select('id, customer_id, order_code, status, total_amount_vnd, total_paid, payment_method, payment_terms, product_name_snapshot, created_at')
      .ilike('order_code', `%${query}%`).eq('account_id', BOT_ACCOUNT_ID).limit(5),
    // Search orders by product name
    supabaseAdmin.from('orders')
      .select('id, customer_id, order_code, status, total_amount_vnd, total_paid, payment_method, payment_terms, product_name_snapshot, created_at')
      .ilike('product_name_snapshot', `%${query}%`).eq('account_id', BOT_ACCOUNT_ID).limit(5),
    // Search customers by name
    supabaseAdmin.from('customers')
      .select('id, full_name, type, created_at, nicks_registry').ilike('full_name', `%${query}%`).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).limit(5),
    // Search customers by notes
    supabaseAdmin.from('customers')
      .select('id, full_name, type, created_at, nicks_registry').ilike('notes', `%${query}%`).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).limit(5),
    // Search contacts (phone, zalo, facebook, telegram, email, other)
    supabaseAdmin.from('customer_contacts')
      .select('customer_id, channel, value')
      .ilike('value', `%${query}%`).limit(10),
    // Search nicks
    supabaseAdmin.from('order_items')
      .select('customer_nick_used, product_name_snapshot, order_id')
      .ilike('customer_nick_used', `%${query}%`).limit(5),
    // Search warehouse (kho)
    supabaseAdmin.from('source_accounts')
      .select('id, email, max_slots, used_slots, provider_name, expires_at')
      .eq('account_id', BOT_ACCOUNT_ID)
      .ilike('email', `%${query}%`).is('deleted_at', null).limit(3),
    // Search products
    supabaseAdmin.from('products')
      .select('id, name, sell_price_vnd, created_at')
      .eq('account_id', BOT_ACCOUNT_ID)
      .ilike('name', `%${query}%`).limit(5),
  ]);

  // Additional contact search using normalized VN phone variants.
  let byContactRows = (byContact.data ?? []) as any[];
  if (queryDigits.length >= 9) {
    const variants = new Set<string>([queryDigits]);
    if (queryDigits.startsWith('84')) variants.add(`0${queryDigits.slice(2)}`);
    if (queryDigits.startsWith('0')) variants.add(`84${queryDigits.slice(1)}`);

    const extraContactResults = await Promise.all(
      Array.from(variants).slice(0, 3).map(v =>
        supabaseAdmin.from('customer_contacts')
          .select('customer_id, channel, value')
          .ilike('value', `%${v}%`)
          .limit(10)
      )
    );

    const mergedMap = new Map<string, any>();
    for (const row of byContactRows) {
      mergedMap.set(`${row.customer_id}:${row.channel}:${row.value}`, row);
    }
    for (const extra of extraContactResults) {
      for (const row of (extra.data ?? [])) {
        mergedMap.set(`${row.customer_id}:${row.channel}:${row.value}`, row);
      }
    }
    byContactRows = Array.from(mergedMap.values());
  }

  const contactCustomerMap = await loadTelegramCustomerMap(
    [...new Set(byContactRows.map((row: any) => row.customer_id))],
    'id, full_name, type, created_at, nicks_registry',
  );
  const byContactWithCustomers = byContactRows
    .map((row: any) => {
      const customer = contactCustomerMap.get(row.customer_id) ?? null;
      return customer
        ? {
            ...row,
            customers: [{ ...customer }],
          }
        : null;
    })
    .filter(Boolean) as Array<any>;

  // Merge orders (by code + by product, deduplicated)
  const allOrders = [...(ordersByCode.data ?? []), ...(ordersByProduct.data ?? [])] as TelegramOrderBaseRow[];
  const uniqueOrderRows = Array.from(new Map(allOrders.map(o => [o.id, o])).values()).slice(0, 5);
  const orderCustomerMap = await loadTelegramCustomerMap(
    [...new Set(uniqueOrderRows.map(o => o.customer_id).filter((id): id is string => Boolean(id)))],
    'id, full_name',
  );
  const uniqueOrders = attachTelegramOrderCustomers(uniqueOrderRows, orderCustomerMap);
  if (uniqueOrders.length) {
    totalFound += uniqueOrders.length;
    results.push(`📦 <b>Đơn hàng (${uniqueOrders.length}):</b>`);
    for (const o of uniqueOrders) {
      const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as any;
      const time = o.created_at ? formatTelegramDateOnly(new Date(o.created_at)) : '';
      results.push(`  ${getStatusEmoji(o.status)} <code>${escapeHtml(o.order_code ?? '')}</code> ${escapeHtml(c?.full_name ?? 'N/A').slice(0, 12)} ${formatVnd(o.total_amount_vnd ?? 0)} ${time}`);
      actionButtons.push([{ text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` }]);
    }
  }

  // Merge customers (by name + by notes + by contacts, deduplicated)
  const contactCusts = byContactWithCustomers.map((cc: any) => {
    const cu = Array.isArray(cc.customers) ? cc.customers[0] : cc.customers;
    return cu ? { ...cu, _contactMatch: `${cc.channel}: ${cc.value}` } : null;
  }).filter(Boolean);
  const allCusts = [...(custsByName.data ?? []), ...(custsByNotes.data ?? []), ...contactCusts];
  const uniqueCusts = Array.from(new Map(allCusts.map(c => [c.id, c])).values()).slice(0, 8);
  if (uniqueCusts.length) {
    const custIds = uniqueCusts.map(c => c.id);
    const { data: orderCounts } = await supabaseAdmin.from('orders')
      .select('customer_id')
      .eq('account_id', BOT_ACCOUNT_ID)
      .in('customer_id', custIds);
    // Load contacts for display
    const { data: custContacts } = await supabaseAdmin.from('customer_contacts')
      .select('customer_id, channel, value').in('customer_id', custIds);
    const contactMap = new Map<string, string>();
    for (const cc of custContacts ?? []) {
      if (!contactMap.has(cc.customer_id)) contactMap.set(cc.customer_id, `${cc.channel}: ${cc.value}`);
    }
    const countMap = new Map<string, number>();
    for (const oc of orderCounts ?? []) countMap.set(oc.customer_id, (countMap.get(oc.customer_id) ?? 0) + 1);
    const typeLabels: Record<string, string> = { retail: '🛒', wholesale: '🏭', agency: '🏢' };
    totalFound += uniqueCusts.length;
    results.push(`\n👤 <b>Khách hàng (${uniqueCusts.length}):</b>`);
    for (const c of uniqueCusts) {
      const nicks = Array.isArray(c.nicks_registry) ? (c.nicks_registry as string[]).slice(0, 3).join(', ') : '';
      const orderCnt = countMap.get(c.id) ?? 0;
      const contact = c._contactMatch ?? contactMap.get(c.id) ?? '';
      results.push(`  ${typeLabels[c.type] ?? '👤'} <b>${escapeHtml(c.full_name)}</b> | 📦 ${orderCnt} đơn${contact ? ` | ${escapeHtml(contact)}` : ''}${nicks ? `\n     🏷 Nick: ${escapeHtml(nicks)}` : ''}`);
      actionButtons.push([{ text: `👤 ${c.full_name}`, callback_data: `runcmd:customer ${c.id}` }]);
    }
  }

  // Additional contacts (not merged into customers above)
  const contactOnlyCusts = byContactWithCustomers.filter((cc: any) => {
    const cu = Array.isArray(cc.customers) ? cc.customers[0] : cc.customers;
    return cu && !uniqueCusts.some((uc: any) => uc.id === cu.id);
  });
  if (contactOnlyCusts.length) {
    totalFound += contactOnlyCusts.length;
    results.push(`\n📧 <b>Liên hệ khác (${contactOnlyCusts.length}):</b>`);
    for (const cc of contactOnlyCusts) { const cu = (Array.isArray(cc.customers) ? cc.customers[0] : cc.customers) as any; results.push(`  • ${escapeHtml(cc.channel)}: <code>${escapeHtml(cc.value)}</code> | ${escapeHtml(cu?.full_name ?? 'N/A')}`); }
  }

  // Nicks
  const nickRows = (byNick.data ?? []) as TelegramOrderItemBaseRow[];
  if (nickRows.length) {
    const nickOrderMap = await loadTelegramOrderMap(
      [...new Set(nickRows.map((item) => item.order_id).filter((id): id is string => Boolean(id)))],
      'id, customer_id, order_code, status',
    );
    const nickCustomerMap = await loadTelegramCustomerMap(
      [...new Set([...nickOrderMap.values()].map((order) => order.customer_id).filter((id): id is string => Boolean(id)))],
      'id, full_name',
    );
    const nickResults = nickRows.map((item) => {
      const order = item.order_id ? nickOrderMap.get(item.order_id) ?? null : null;
      const customer = order?.customer_id ? nickCustomerMap.get(order.customer_id) ?? null : null;
      return {
        customer_nick_used: item.customer_nick_used,
        order: order
          ? {
              order_code: order.order_code,
              status: order.status,
              customer: customer ? { full_name: customer.full_name } : null,
            }
          : null,
      };
    });
    totalFound += nickResults.length;
    results.push(`\n🏷 <b>Nick (${nickResults.length}):</b>`);
    for (const item of nickResults) {
      const o = item.order;
      const cu = o?.customer ?? null;
      results.push(`  • <code>${escapeHtml(item.customer_nick_used ?? '')}</code> | ${escapeHtml(o?.order_code ?? '')} | ${escapeHtml(cu?.full_name ?? 'N/A')}`);
      if (o?.order_code) actionButtons.push([{ text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` }]);
    }
  }

  // Kho
  if (byKhoEmail.data?.length) {
    totalFound += byKhoEmail.data.length;
    results.push(`\n📦 <b>Kho hàng (${byKhoEmail.data.length}):</b>`);
    for (const sa of byKhoEmail.data) {
      const free = sa.max_slots - sa.used_slots;
      const provider = (sa as any).provider_name ? ` | 🏢 ${escapeHtml((sa as any).provider_name)}` : '';
      const expStr = sa.expires_at ? ` | hạn ${formatDate(sa.expires_at)}` : '';
      results.push(`  • <code>${escapeHtml(sa.email ?? '')}</code>\n     ${free}/${sa.max_slots} slot trống${provider}${expStr}`);
    }
  }

  // Products
  if (byProduct.data?.length) {
    totalFound += byProduct.data.length;
    results.push(`\n🏷 <b>Sản phẩm (${byProduct.data.length}):</b>`);
    for (const p of byProduct.data) {
      results.push(`  • <b>${escapeHtml(p.name)}</b> | ${formatVnd(p.sell_price_vnd ?? 0)}`);
    }
  }

  if (!results.length) {
    await sendKb(chatId, [
      `❌ Không tìm thấy: <code>${escapeHtml(query)}</code>`,
      ``,
      `💡 <b>Thử:</b>`,
      `  • Tên KH, SĐT, email`,
      `  • Mã đơn (ORD-xxxx)`,
      `  • Nick game, email kho`,
      `  • Tên sản phẩm`,
    ].join('\n'), [
      [{ text: '👤 Tìm KH', callback_data: 'cmd:customer' }, { text: '📦 Xem đơn', callback_data: 'cmd:orders' }],
      [{ text: '📦 Xem kho', callback_data: 'cmd:kho' }, { text: '🏷 Sản phẩm', callback_data: 'cmd:products' }],
      [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  // Build navigation buttons
  const btns = actionButtons.slice(0, 5);
  btns.push(
    [{ text: '🔍 Tìm lại', callback_data: 'cmd:search_prompt' }, { text: '👤 Tìm KH', callback_data: 'cmd:customer' }],
    [{ text: '📦 Xem đơn', callback_data: 'cmd:orders' }, { text: '📦 Xem kho', callback_data: 'cmd:kho' }],
    [{ text: '🏷 Sản phẩm', callback_data: 'cmd:products' }, { text: '➕ Tạo nhanh', callback_data: 'cmd:create_menu' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  );
  await sendKb(chatId, [`🔍 <b>KẾT QUẢ</b> — "${escapeHtml(query)}" (${totalFound} kết quả)`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...results].join('\n'), btns);
}

// ─── /kho ───────────────────────────────────────────────────

async function handleKho(chatId: number, query: string, msgId?: number) {
  if (query) return await handleInventory(chatId, query);
  await sendOrEdit(chatId, `📦 <b>KHO HÀNG</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━\nChọn chức năng:`, [
    [{ text: '📊 Thống kê', callback_data: 'kho:stats' }, { text: '🟢 Còn hạn', callback_data: 'kho:active' }],
    [{ text: '🔗 Slot trống', callback_data: 'kho:slots' }, { text: '🔐 Creds', callback_data: 'kho:creds' }],
    [{ text: '📤 Export', callback_data: 'runcmd:export kho' }, { text: '➕ Tạo kho', callback_data: 'cmd:newkho' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

// ─── /warehouse ─────────────────────────────────────────────

async function handleWarehouse(chatId: number, _msgId?: number) {
  const { data: accounts } = await supabaseAdmin.from('source_accounts').select('id, max_slots, used_slots, expires_at').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null);
  const all = accounts ?? [];
  const totalSlots = all.reduce((s, a) => s + a.max_slots, 0);
  const usedSlots = all.reduce((s, a) => s + a.used_slots, 0);
  const freeSlots = totalSlots - usedSlots;
  const pct = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
  const expSoon = all.filter(a => a.expires_at && daysUntil(a.expires_at) <= 7 && daysUntil(a.expires_at) > 0).length;
  const expired = all.filter(a => a.expires_at && new Date(a.expires_at) < new Date()).length;
  // ASCII bar chart
  const barLen = 20;
  const filled = Math.round((pct / 100) * barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
  const khoHealth = pct >= 90 ? '🔴' : pct >= 70 ? '🟡' : '🟢';
  await sendKb(chatId, [
    `📦 <b>THỐNG KÊ KHO</b> ${khoHealth}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 <b>${all.length}</b> TK | ${bar} <b>${pct}%</b>`,
    `📦 Dùng: <b>${usedSlots}</b> | Trống: <b>${freeSlots}</b> | Tổng: <b>${totalSlots}</b>`,
    expSoon > 0 ? `⏰ Sắp hạn: <b>${expSoon}</b>` : '',
    expired > 0 ? `❌ Hết hạn: <b>${expired}</b>` : `✅ Không hết hạn`,
  ].filter(Boolean).join('\n'), [
    [{ text: '🔗 Slot trống', callback_data: 'kho:slots' }, { text: '🔐 Creds', callback_data: 'kho:creds' }],
    [{ text: '🟢 Còn hạn', callback_data: 'kho:active' }, { text: '📤 Export kho', callback_data: 'runcmd:export kho' }],
    [{ text: '📊 Stats', callback_data: 'cmd:stats' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── /slots ─────────────────────────────────────────────────

async function handleSlots(chatId: number, _msgId?: number, page = 0) {
  const { data: accounts } = await supabaseAdmin.from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, provider_name').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).order('expires_at', { ascending: false });
  const avail = (accounts ?? []).filter((a: any) => a.used_slots < a.max_slots && (!a.expires_at || new Date(a.expires_at) > new Date()));
  const total = avail.length;
  if (!total) { await sendKb(chatId, '❌ Không có slot trống.', [[{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]]); return; }
  
  const paginated = avail.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (!paginated.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  
  const lines = paginated.map((a: any, i: number) => {
    const free = a.max_slots - a.used_slots;
    const exp = a.expires_at ? `${daysUntil(a.expires_at)}d` : '∞';
    return `${page * PAGE_SIZE + i + 1}. <code>${escapeHtml(a.email)}</code> trống <b>${free}/${a.max_slots}</b> ${exp}`;
  });
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trước', callback_data: `kho:slots:page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `kho:slots:page:${page + 1}` });

  await sendKb(chatId, [`🔗 <b>SLOT TRỐNG</b> (${total} TK)`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...lines].join('\n'), [
    navRow,
    [{ text: '🔗 Gán kho', callback_data: 'cmd:allocate' }, { text: '🔐 Creds', callback_data: 'kho:creds' }],
    [{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── /inventory ─────────────────────────────────────────────

async function handleInventory(chatId: number, query: string) {
  if (!query) { await sendMsg(chatId, '⚠️ Nhập email.\nVD: <code>/inventory abc@gmail.com</code>'); return; }
  const { data: accounts } = await supabaseAdmin.from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, reserved_nicks').eq('account_id', BOT_ACCOUNT_ID).ilike('email', `%${query}%`).is('deleted_at', null).limit(10);
  if (!accounts?.length) { await sendMsg(chatId, `❌ Không tìm thấy: <code>${escapeHtml(query)}</code>`); return; }
  const lines = accounts.map(a => {
    const nicks = (a.reserved_nicks ?? []) as string[];
    return [`📧 <b>${escapeHtml(a.email)}</b>`, `  Slot: ${a.used_slots}/${a.max_slots} (trống: <b>${a.max_slots - a.used_slots}</b>)`,
      nicks.length ? `  Nick: <code>${escapeHtml(nicks.join(', '))}</code>` : '', a.expires_at ? `  Hạn: ${formatDate(a.expires_at)}` : ''].filter(Boolean).join('\n');
  });
  await sendMsg(chatId, [`📦 <b>KHO</b> — "${escapeHtml(query)}"`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...lines].join('\n'));
}

// ─── /creds ─────────────────────────────────────────────────

async function handleCreds(chatId: number, query: string) {
  if (query) {
    const { data: accs } = await supabaseAdmin.from('source_accounts')
      .select('id, email, max_slots, used_slots, expires_at, notes, reserved_nicks, provider, account_id, product_ids, created_at, purchase_cost_vnd, purchase_date, purchase_source')
      .eq('account_id', BOT_ACCOUNT_ID).ilike('email', `%${query}%`).is('deleted_at', null).limit(5);
    if (accs?.length) { for (const acc of accs) await formatAndSendCreds(chatId, acc); return; }
    await sendMsg(chatId, `❌ Không tìm thấy: <code>${escapeHtml(query)}</code>`); return;
  }
  const { data: allAccounts } = await supabaseAdmin.from('source_accounts').select('id, product_ids').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null);
  const pMap = new Map<string, number>();
  for (const acc of allAccounts ?? []) {
    const pids = (acc.product_ids ?? []) as string[];
    if (!pids.length) pMap.set('__none__', (pMap.get('__none__') ?? 0) + 1);
    for (const pid of pids) pMap.set(pid, (pMap.get(pid) ?? 0) + 1);
  }
  const pIds = [...pMap.keys()].filter(k => k !== '__none__');
  const nMap = new Map<string, string>();
  if (pIds.length) { const { data: ps } = await supabaseAdmin.from('products').select('id, name').eq('account_id', BOT_ACCOUNT_ID).in('id', pIds); for (const p of ps ?? []) nMap.set(p.id, p.name); }
  const kb: TelegramButton[][] = [];
  for (const [pid, cnt] of pMap) {
    if (pid === '__none__') kb.push([{ text: `📦 Chưa gán (${cnt})`, callback_data: 'creds:prod:__none__' }]);
    else kb.push([{ text: `📦 ${nMap.get(pid) ?? pid.slice(0, 8)} (${cnt})`, callback_data: `creds:prod:${pid}` }]);
  }
  await sendKb(chatId, `🔐 <b>CHỌN SẢN PHẨM</b>\n📊 Tổng: <b>${(allAccounts ?? []).length}</b> TK`, kb);
}

async function handleCredsCallback(chatId: number, data: string) {
  const parts = data.split(':');
  if (parts[1] === 'back') return await handleCreds(chatId, '');
  if (parts[1] === 'search') { setSession(chatId, 'creds_search', 1, { productId: parts[2] }); await sendMsg(chatId, '🔍 Nhập email/nick:\n💡 <code>/cancel</code> để hủy'); return; }
  if (parts[1] === 'acc') {
    const { data: acc } = await supabaseAdmin.from('source_accounts')
      .select('id, account_id, email, provider, max_slots, used_slots, expires_at, reserved_nicks, product_ids, created_at, notes, purchase_cost_vnd, purchase_date, purchase_source')
      .eq('account_id', BOT_ACCOUNT_ID).eq('id', parts[2]).is('deleted_at', null).single();
    if (!acc) { await sendMsg(chatId, '❌ Không tìm thấy.'); return; }
    return await formatAndSendCreds(chatId, acc);
  }
  if (parts[1] === 'prod') {
    const pid = parts[2]; const showAll = parts[3] === 'all';
    let q = supabaseAdmin.from('source_accounts').select('id, email, max_slots, used_slots, expires_at, reserved_nicks').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).order('email').limit(showAll ? 100 : 20);
    if (pid === '__none__') q = q.or('product_ids.is.null,product_ids.eq.{}'); else q = q.contains('product_ids', [pid]);
    const { data: accs } = await q;
    if (!accs?.length) { await sendMsg(chatId, '📭 Không có TK.'); return; }
    const kb: TelegramButton[][] = accs.map(a => [{ text: `📧 ${a.email.length > 22 ? a.email.slice(0, 20) + '..' : a.email} (${a.max_slots - a.used_slots}/${a.max_slots})`, callback_data: `creds:acc:${a.id}` }]);
    const extra: TelegramButton[] = [];
    if (!showAll && accs.length >= 20) extra.push({ text: '📋 Tất cả', callback_data: `creds:prod:${pid}:all` });
    extra.push({ text: '🔍 Tìm', callback_data: `creds:search:${pid}` });
    kb.push(extra); kb.push([{ text: '⬅️ Quay lại', callback_data: 'creds:back' }]);
    await sendKb(chatId, `📦 Danh sách (${accs.length})\n👇 Chọn:`, kb);
  }
}

async function handleCredsSearchWizard(chatId: number, text: string, session: WizardSession) {
  const pid = session.data?.productId as string; clearSession(chatId);
  const sq = text.trim();
  if (!sq) { await sendMsg(chatId, '⚠️ Nhập keyword.'); return; }
  let { data: accs } = await supabaseAdmin.from('source_accounts').select('id, email, max_slots, used_slots').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).ilike('email', `%${sq}%`).limit(20);
  if (!(accs ?? []).length) { const { data: bn } = await supabaseAdmin.from('source_accounts').select('id, email, max_slots, used_slots').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).contains('reserved_nicks', [sq.toLowerCase()]).limit(20); accs = bn; }
  if (!(accs ?? []).length) { await sendKb(chatId, `❌ Không tìm thấy: <code>${escapeHtml(sq)}</code>`, [[{ text: '🔍 Tìm lại', callback_data: `creds:search:${pid}` }]]); return; }
  const kb: TelegramButton[][] = (accs ?? []).map(a => [{ text: `📧 ${a.email} (${a.max_slots - a.used_slots}/${a.max_slots})`, callback_data: `creds:acc:${a.id}` }]);
  kb.push([{ text: '⬅️ Quay lại', callback_data: `creds:prod:${pid}` }]);
  await sendKb(chatId, `🔍 Kết quả (${(accs ?? []).length}):`, kb);
}

async function formatAndSendCreds(chatId: number, acc: Record<string, any>) {
  const free = acc.max_slots - acc.used_slots;
  const nicks = (acc.reserved_nicks ?? []) as string[];
  const productIds = (acc.product_ids ?? []) as string[];

  // Decrypt credentials from notes JSONB
  const rawNotes = (typeof acc.notes === 'object' && acc.notes !== null) ? acc.notes : {};
  const notesObj = decryptNotes(rawNotes) as Record<string, any>;
  const password = notesObj.password ?? null;
  const credentials = Array.isArray(notesObj.credentials) ? notesObj.credentials : [];
  const joinLink = notesObj.joinLink ?? notesObj.join_link ?? null;
  const twoFA = notesObj.twoFA ?? notesObj['2fa'] ?? null;
  const extraNotes = notesObj.text ?? notesObj.note ?? null;

  // Get linked customer nicks from order_items
  const { data: linkedItems } = await supabaseAdmin
    .from('order_items')
    .select('customer_nick_used, status, product_name_snapshot')
    .eq('assigned_source_account_id', acc.id)
    .limit(20);
  const activeNicks = (linkedItems ?? [])
    .filter((i: any) => i.customer_nick_used)
    .map((i: any) => `${i.customer_nick_used}${i.product_name_snapshot ? ` (${i.product_name_snapshot})` : ''}`);

  // Get product names for display
  let productNames: string[] = [];
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from('products').select('id, name').eq('account_id', acc.account_id).in('id', productIds);
    productNames = (products ?? []).map((p: any) => p.name);
  }

  // Provider lookup — show name + contacts instead of raw UUID
  let providerDisplay = escapeHtml(acc.provider ?? 'N/A');
  let providerContacts = '';
  if (acc.provider) {
    const { data: matched } = await supabaseAdmin
      .from('providers').select('id, name, contacts')
      .eq('account_id', acc.account_id).eq('id', acc.provider).is('deleted_at', null).maybeSingle();
    if (matched) {
      providerDisplay = escapeHtml(matched.name);
      const contacts = Array.isArray(matched.contacts) ? matched.contacts : [];
      if (contacts.length > 0) {
        const channelEmoji: Record<string, string> = { phone: '📞', telegram: '💬', email: '📧', zalo: '💚', facebook: '📘', line: '🟢' };
        const contactLines = contacts.map((c: any) => {
          const channel = c.channel ?? c.type ?? c.label ?? 'Liên hệ';
          const emoji = channelEmoji[String(channel).toLowerCase()] ?? '📞';
          const value = c.value ?? c.phone ?? c.email ?? c.url ?? '';
          return `   ${emoji} ${escapeHtml(String(channel))}: <code>${escapeHtml(String(value))}</code>`;
        });
        providerContacts = '\n' + contactLines.join('\n');
      }
    }
  }

  // Build message sections
  const sections: string[] = [
    `🔐 <b>THÔNG TIN KHO CHI TIẾT</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📧 <b>Email:</b> <code>${escapeHtml(acc.email)}</code>`,
    `🏢 <b>Provider:</b> ${providerDisplay}${providerContacts}`,
    `📊 <b>Slot:</b> ${acc.used_slots}/${acc.max_slots} (trống: <b>${free}</b>)`,
    `📅 <b>Hạn:</b> ${formatDate(acc.expires_at)} (còn ${daysUntil(acc.expires_at)} ngày)`,
    `📅 <b>Ngày tạo:</b> ${formatDate(acc.created_at)}`,
  ];

  // Reserved nicks
  if (nicks.length > 0) {
    sections.push(`🏷 <b>Nick đã cấp:</b> <code>${escapeHtml(nicks.join(', '))}</code>`);
  }

  // Active customer nicks from order_items
  if (activeNicks.length > 0) {
    sections.push(`👥 <b>Nick khách đang dùng:</b>`);
    for (const n of activeNicks) sections.push(`   • <code>${escapeHtml(n)}</code>`);
  }

  // Products
  if (productNames.length > 0) {
    sections.push(`📦 <b>Sản phẩm:</b>`);
    for (const pn of productNames) sections.push(`   • ${escapeHtml(pn)}`);
  } else if (productIds.length > 0) {
    sections.push(`📦 <b>Sản phẩm:</b> ${productIds.length} loại`);
  }

  // Account ID
  if (acc.account_id) {
    sections.push(`🔑 <b>Account ID:</b> <code>${escapeHtml(acc.account_id)}</code>`);
  }

  // A7: Mask sensitive credentials
  const maskValue = (val: string) => val.length <= 3 ? '***' : val.slice(0, 2) + '•'.repeat(Math.min(val.length - 2, 8));

  // Credentials section (masked by default)
  if (password || credentials.length > 0 || joinLink || twoFA) {
    sections.push(``);
    sections.push(`🔒 <b>CREDENTIALS:</b> <i>(masked)</i>`);
    if (password) sections.push(`   🔑 <b>Password:</b> <code>${maskValue(String(password))}</code>`);
    if (joinLink) sections.push(`   🔗 <b>Link join:</b> <code>${maskValue(String(joinLink))}</code>`);
    if (twoFA) sections.push(`   🛡 <b>2FA:</b> <code>${maskValue(String(twoFA))}</code>`);
    for (const cred of credentials) {
      const label = cred.label || cred.type || 'Info';
      const value = cred.value || '';
      sections.push(`   📌 <b>${escapeHtml(String(label))}:</b> <code>${maskValue(String(value))}</code>`);
    }
  }

  // Purchase info
  if (acc.purchase_cost_vnd || acc.purchase_date || acc.purchase_source) {
    sections.push(``);
    sections.push(`💰 <b>THÔNG TIN MUA:</b>`);
    if (acc.purchase_cost_vnd) sections.push(`   💵 <b>Giá mua:</b> ${formatTelegramCount(Number(acc.purchase_cost_vnd))}đ`);
    if (acc.purchase_date) sections.push(`   📅 <b>Ngày mua:</b> ${formatDate(acc.purchase_date)}`);
    if (acc.purchase_source) sections.push(`   🏪 <b>Nguồn mua:</b> ${escapeHtml(String(acc.purchase_source))}`);
  }

  // Extra notes
  if (extraNotes) {
    sections.push(``);
    sections.push(`📝 <b>Ghi chú:</b> ${escapeHtml(String(extraNotes))}`);
  }

  sections.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Build actionable buttons with reveal option
  const actionBtns: TelegramButton[][] = [];
  // Reveal button
  actionBtns.push([{ text: '👁 Hiện credentials', callback_data: `credreveal:${acc.id}` }]);
  const copyRow: TelegramButton[] = [{ text: '📧 Copy Email', callback_data: `copy:${acc.email}` }];
  if (password) copyRow.push({ text: '🔑 Copy Pass', callback_data: `copy:${String(password)}` });
  actionBtns.push(copyRow);
  if (joinLink) actionBtns.push([{ text: '🔗 Copy Link', callback_data: `copy:${String(joinLink)}` }]);
  if (password) actionBtns.push([{ text: '📋 Copy Login', callback_data: `copy:${acc.email} / ${String(password)}` }]);
  actionBtns.push([{ text: '⬅️ DS SP', callback_data: 'creds:back' }, { text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }]);
  actionBtns.push([{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  await sendKb(chatId, sections.join('\n'), actionBtns);
}

// ─── /duolingo ──────────────────────────────────────────────

async function handleDuolingo(chatId: number, query: string) {
  if (!query) {
    setSession(chatId, 'duolingo_lookup', 1, {});
    await sendMsg(chatId, [
      '🦉 Nhập username hoặc ID Duolingo:',
      '',
      '💡 <b>Hỗ trợ định dạng:</b>',
      '  • <code>username</code> — tra username',
      '  • <code>@username</code> — tự bỏ @',
      '  • <code>123456789</code> — tra bằng ID',
      '  • <code>duolingo.com/profile/xxx</code> — extract URL',
      '',
      '💡 <code>/cancel</code> để hủy',
    ].join('\n'));
    return;
  }

  // Normalize: strip @, extract from URL, detect numeric ID
  const { value: normalized, isNumericId } = normalizeUsername(query);
  if (!normalized) { await sendMsg(chatId, '⚠️ Username không hợp lệ.'); return; }

  await sendMsg(chatId, `🔍 Đang tra cứu <code>${escapeHtml(normalized)}</code>${isNumericId ? ' (by ID)' : ''}...\n⏳ Vui lòng chờ...`);
  try {
    const fields = 'users,id,username,name,totalXp,streak,gems,lingots,hasPlus,plusStatus,currentCourseId,learningLanguage,fromLanguage,creationDate,picture,courses,currentCourse,streakData,roles,privacySettings,motivation,bio,globalAmbassadorStatus,hasObserver';

    const browserHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.duolingo.com/',
      'Origin': 'https://www.duolingo.com',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
    const signal = AbortSignal.timeout(20000);

    let user: any = null;

    // Strategy 1: REST API /2017-06-30/users with full browser headers
    try {
      const apiUrl = isNumericId
        ? `https://www.duolingo.com/2017-06-30/users/${normalized}?fields=${fields}`
        : `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(normalized)}&fields=${fields}`;
      const res = await fetch(apiUrl, { headers: browserHeaders, signal });
      if (res.ok) {
        const data = await res.json();
        user = isNumericId ? data : data.users?.[0];
      }
    } catch { /* Strategy 1 failed — try next */ }

    // Strategy 2: Legacy /api/1/users/show endpoint
    if (!user && !isNumericId) {
      try {
        const res = await fetch(`https://www.duolingo.com/api/1/users/show?username=${encodeURIComponent(normalized)}`, { headers: browserHeaders, signal });
        if (res.ok) {
          const data = await res.json();
          if (data?.id) user = data;
        }
      } catch { /* Strategy 2 failed — try next */ }
    }

    // Strategy 3: Profile page HTML scraping (extract from __NEXT_DATA__)
    if (!user) {
      try {
        const profileUrl = `https://www.duolingo.com/profile/${encodeURIComponent(isNumericId ? normalized : normalized)}`;
        const res = await fetch(profileUrl, {
          headers: { ...browserHeaders, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' },
          signal,
        });
        if (res.ok) {
          const html = await res.text();
          const nextMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/);
          if (nextMatch) {
            try {
              const nextData = JSON.parse(nextMatch[1]);
              const u = nextData?.props?.pageProps?.user ?? nextData?.props?.pageProps?.initialData?.user ?? nextData?.props?.initialProps?.user;
              if (u?.id) user = u;
            } catch { /* JSON parse error */ }
          }
          // Fallback: regex extraction from HTML
          if (!user) {
            const idMatch = html.match(/"id"\s*:\s*(\d{6,15})/);
            const unMatch = html.match(/"username"\s*:\s*"([^"]+)"/);
            if (idMatch) user = { id: parseInt(idMatch[1], 10), username: unMatch?.[1] ?? normalized };
          }
        }
      } catch { /* Strategy 3 failed */ }
    }

    if (!user) {
      await sendKb(chatId, [
        `❌ Không tìm thấy: <code>${escapeHtml(normalized)}</code>`,
        ``,
        `📋 <i>Đã thử ${isNumericId ? '2' : '3'} phương pháp tra cứu — không có kết quả</i>`,
        ``,
        `💡 <b>Gợi ý:</b>`,
        `  • Kiểm tra đúng username (phân biệt hoa/thường)`,
        `  • Thử tra bằng Duolingo ID (số)`,
        `  • Profile có thể bị ẩn (private)`,
      ].join('\n'), [
        [{ text: '🔄 Thử lại', callback_data: 'cmd:duolingo' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]);
      return;
    }

    const isPlusActive = user.hasPlus === true || user.plusStatus === 'PLUS';
    const created = user.creationDate ? formatTelegramDateWithYear(new Date(user.creationDate * 1000)) : 'N/A';
    const totalXp = user.totalXp ?? 0;
    const streak = user.streak ?? 0;
    const gems = user.gems ?? 0;
    const lingots = user.lingots ?? 0;
    const profileUrl = `https://www.duolingo.com/profile/${encodeURIComponent(user.username)}`;
    const avatarUrl = user.picture ? (user.picture.startsWith('http') ? user.picture : `https:${user.picture}/xlarge`) : null;

    // XP Level calculation
    const xpLevel = totalXp < 1000 ? '🥉 Beginner' : totalXp < 5000 ? '🥈 Intermediate' : totalXp < 20000 ? '🥇 Advanced' : totalXp < 50000 ? '💎 Expert' : '👑 Master';

    // Streak fire animation
    const streakFire = streak === 0 ? '❄️' : streak < 7 ? '🔥' : streak < 30 ? '🔥🔥' : streak < 100 ? '🔥🔥🔥' : streak < 365 ? '🔥🔥🔥🔥' : '🔥🔥🔥🔥🔥';

    // Plus status badge
    const plusBadge = isPlusActive ? '✨ SUPER DUOLINGO ACTIVE ✨' : '🆓 Free Plan';

    // Course formatting with flags
    const langFlags: Record<string, string> = { en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', pt: '🇧🇷', it: '🇮🇹', vi: '🇻🇳', ru: '🇷🇺', ar: '🇸🇦', hi: '🇮🇳', th: '🇹🇭', tr: '🇹🇷', nl: '🇳🇱', sv: '🇸🇪', pl: '🇵🇱' };
    const courses = (user.courses ?? []).map((c: any) => {
      const flag = langFlags[c.learningLanguage] ?? '🌐';
      const xp = formatTelegramCount(c.xp ?? 0);
      const crowns = c.crowns ?? 0;
      const bar = '▓'.repeat(Math.min(5, Math.floor(crowns / 10))) + '░'.repeat(Math.max(0, 5 - Math.floor(crowns / 10)));
      return `  ┃ ${flag} <b>${escapeHtml(c.title ?? c.learningLanguage)}</b>\n  ┃    ${bar} ${xp} XP | ${crowns} 👑`;
    });

    // Streak data details
    const streakStart = user.streakData?.currentStreak?.startDate;
    const streakLine = streakStart ? ` (từ ${streakStart})` : '';

    // Days since creation & XP/day
    const daysSince = user.creationDate ? Math.floor((Date.now() - user.creationDate * 1000) / 86_400_000) : 0;
    const xpPerDay = daysSince > 0 ? Math.round(totalXp / daysSince) : 0;

    const lines: string[] = [
      `🦉 <b>╔══ DUOLINGO PROFILE ══╗</b>`,
      `  ┃`,
      `  ┃ 🆔 <b>Duolingo ID:</b>`,
      `  ┃ <code>${user.id}</code>`,
      `  ┃`,
      `  ┃ 👤 <b>Username:</b> <code>${escapeHtml(user.username)}</code>`,
    ];
    if (user.name) lines.push(`  ┃ 📛 <b>Tên:</b> <code>${escapeHtml(user.name)}</code>`);
    if (user.bio) lines.push(`  ┃ 📝 <b>Bio:</b> ${escapeHtml(user.bio)}`);
    if (user.motivation && user.motivation !== 'none') lines.push(`  ┃ 🎯 <b>Mục tiêu:</b> ${escapeHtml(user.motivation)}`);
    lines.push(
      `  ┃`,
      `  ╠══ 💎 SUBSCRIPTION ══`,
      isPlusActive ? `  ┃ 💎 <b>${plusBadge}</b>` : `  ┃ ${plusBadge}`,
    );
    if (user.plusStatus && user.plusStatus !== 'PLUS' && user.plusStatus !== 'NOT_PLUS') {
      lines.push(`  ┃ 📋 Status: <code>${escapeHtml(user.plusStatus)}</code>`);
    }
    lines.push(
      `  ┃`,
      `  ╠══ 📊 STATISTICS ══`,
      `  ┃ ${streakFire} <b>Streak:</b> <code>${streak}</code> ngày${streakLine}`,
      `  ┃ ⭐ <b>Tổng XP:</b> <code>${formatTelegramCount(totalXp)}</code> (${xpLevel})`,
      `  ┃ 📈 <b>TB/ngày:</b> <code>${xpPerDay}</code> XP`,
      `  ┃ 💎 <b>Gems:</b> <code>${formatTelegramCount(gems)}</code>`,
    );
    if (lingots) lines.push(`  ┃ 🪙 <b>Lingots:</b> <code>${formatTelegramCount(lingots)}</code>`);
    if (courses.length) {
      lines.push(`  ┃`, `  ╠══ 📚 COURSES (${courses.length}) ══`, ...courses);
    }
    lines.push(
      `  ┃`,
      `  ╠══ 🗓 INFO ══`,
      `  ┃ 📅 <b>Ngày tạo:</b> <code>${created}</code> (${daysSince} ngày)`,
    );
    if (user.learningLanguage) {
      lines.push(`  ┃ 🌍 <b>Đang học:</b> ${langFlags[user.learningLanguage] ?? '🌐'} <code>${user.learningLanguage}</code> ← ${langFlags[user.fromLanguage] ?? '🌐'} <code>${user.fromLanguage ?? 'N/A'}</code>`);
    }
    if ((user.roles ?? []).length > 0) lines.push(`  ┃ 🏅 <b>Roles:</b> <code>${user.roles.join(', ')}</code>`);
    if (user.currentCourseId) lines.push(`  ┃ 📚 <b>Course ID:</b> <code>${escapeHtml(user.currentCourseId)}</code>`);
    lines.push(
      `  ┃`,
      `  ╠══ 🔗 LINKS ══`,
      `  ┃ 🌐 <b>Profile:</b>`,
      `  ┃ <code>${escapeHtml(profileUrl)}</code>`,
    );
    if (avatarUrl) {
      lines.push(`  ┃ 🖼 <b>Avatar:</b>`, `  ┃ <code>${escapeHtml(avatarUrl)}</code>`);
    }
    lines.push(
      `  ┃`,
      `  <b>╚══════════════════════╝</b>`,
      ``,
      `📋 <b>COPY NHANH:</b>`,
      `🆔 ID: <code>${user.id}</code>`,
      `👤 Username: <code>${escapeHtml(user.username)}</code>`,
      `🌐 Profile: <code>${escapeHtml(profileUrl)}</code>`,
    );

    // Truncate username for callback_data (Telegram limit: 64 bytes)
    const safeUsername = user.username.slice(0, 55).replace(/[^a-zA-Z0-9_.-]/g, '');
    const safeId = String(user.id).slice(0, 55);
    await sendKb(chatId, lines.filter(Boolean).join('\n'), [
      [{ text: '🌐 Mở Profile Duolingo', url: profileUrl }],
      [{ text: `🆔 Copy ID: ${safeId}`, callback_data: `copy:${safeId}` }, { text: `👤 Copy: ${safeUsername.slice(0, 20) || 'user'}`, callback_data: `copy:${safeUsername}` }],
      [{ text: '🔄 Tra user khác', callback_data: 'cmd:duolingo' }, { text: '📘 Tra FB ID', callback_data: 'cmd:fbid' }],
      [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (e) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`); }
}

// ─── /fbid ──────────────────────────────────────────────────

async function handleFbid(chatId: number, query: string) {
  if (!query) { setSession(chatId, 'fbid_lookup', 1, {}); await sendMsg(chatId, '📘 Nhập URL hoặc username Facebook:\n💡 VD: <code>https://facebook.com/zuck</code> hoặc <code>zuck</code>\n💡 Hỗ trợ <code>@zuck</code> → tự bỏ @\n💡 <code>/cancel</code> để hủy'); return; }

  // Normalize: strip @, extract from URL
  const { value: normalized } = normalizeUsername(query);
  const originalInput = normalized || query.trim();

  await sendMsg(chatId, `🔍 Đang lấy Facebook ID cho <code>${escapeHtml(originalInput)}</code>...\n⏳ Vui lòng chờ...`);
  try {
    let fbUrl = originalInput;
    if (!fbUrl.startsWith('http')) fbUrl = `https://www.facebook.com/${fbUrl}`;

    const formData = new URLSearchParams();
    formData.append('link', fbUrl);
    const res = await fetch('https://id.traodoisub.com/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.id) {
        const fbId = String(data.id);
        const profileUrl = `https://www.facebook.com/${fbId}`;
        const avatarUrl = `https://graph.facebook.com/${fbId}/picture?type=large`;
        const messengerUrl = `https://m.me/${fbId}`;

        await sendKb(chatId, [
          `📘 <b>╔══ FACEBOOK PROFILE ══╗</b>`,
          `  ┃`,
          data.name ? `  ┃ 👤 <b>Tên:</b> <code>${escapeHtml(data.name)}</code>` : '',
          `  ┃`,
          `  ┃ 🆔 <b>Facebook ID:</b>`,
          `  ┃ <code>${escapeHtml(fbId)}</code>`,
          `  ┃`,
          `  ╠══ 🔗 LINKS (nhấn để copy) ══`,
          `  ┃ 🌐 <b>Profile:</b>`,
          `  ┃ <code>www.facebook.com/${escapeHtml(fbId)}</code>`,
          `  ┃`,
          `  ┃ 🖼 <b>Avatar HD:</b>`,
          `  ┃ <code>${escapeHtml(avatarUrl)}</code>`,
          `  ┃`,
          `  ┃ 💬 <b>Messenger:</b>`,
          `  ┃ <code>m.me/${escapeHtml(fbId)}</code>`,
          `  ┃`,
          `  ╠══ 📋 INPUT ══`,
          `  ┃ 🔎 <b>Query:</b> <code>${escapeHtml(originalInput)}</code>`,
          `  ┃ 🔗 <b>URL:</b> <code>${escapeHtml(fbUrl)}</code>`,
          `  ┃`,
          `  <b>╚══════════════════════╝</b>`,
          ``,
          `📋 <b>COPY NHANH:</b>`,
          `🆔 ID: <code>${escapeHtml(fbId)}</code>`,
          `🌐 Link: <code>www.facebook.com/${escapeHtml(fbId)}</code>`,
          `💬 Msg: <code>m.me/${escapeHtml(fbId)}</code>`,
        ].filter(Boolean).join('\n'), [
          [{ text: '🌐 Mở Profile Facebook', url: profileUrl }],
          [{ text: `🆔 Copy ID: ${fbId}`, callback_data: `copy:${fbId}` }, { text: '🖼 Avatar', url: avatarUrl }],
          [{ text: '💬 Messenger', url: messengerUrl }],
          [{ text: '🔄 Tra user khác', callback_data: 'cmd:fbid' }, { text: '🦉 Tra Duolingo', callback_data: 'cmd:duolingo' }],
          [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
        ]);
        return;
      }
      if (data.error) {
        await sendKb(chatId, `❌ Lỗi từ dịch vụ: ${escapeHtml(String(data.error).slice(0, 200))}`, [
          [{ text: '🔄 Thử lại', callback_data: 'cmd:fbid' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
        ]);
        return;
      }
    }

    await sendKb(chatId, [
      `❌ <b>Không lấy được Facebook ID</b>`,
      ``,
      `💡 <b>Gợi ý:</b>`,
      `• Kiểm tra URL/username có đúng không`,
      `• Thử dùng URL đầy đủ: <code>https://facebook.com/username</code>`,
      `• Profile có thể đã bị ẩn (private)`,
    ].join('\n'), [[{ text: '🔄 Thử lại', callback_data: 'cmd:fbid' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]]);
  } catch (e) {
    await sendKb(chatId, `❌ Lỗi tra cứu: ${escapeHtml(e instanceof Error ? e.message : String(e))}`,
      [[{ text: '🔄 Thử lại', callback_data: 'cmd:fbid' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]]);
  }
}

// ─── /tasks ─────────────────────────────────────────────────

async function handleTasks(chatId: number, msgId?: number) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

  // Also fetch overdue tasks (past due, not done)
  const [futureResult, overdueResult] = await Promise.all([
    supabaseAdmin
      .from('reminder_events')
      .select('id, title, due_at, type, is_done, notes')
      .eq('account_id', BOT_ACCOUNT_ID)
      .gte('due_at', todayStart)
      .lte('due_at', weekEnd)
      .order('due_at', { ascending: true })
      .limit(20),
    supabaseAdmin
      .from('reminder_events')
      .select('id, title, due_at, type, is_done, notes')
      .eq('account_id', BOT_ACCOUNT_ID)
      .lt('due_at', todayStart)
      .eq('is_done', false)
      .order('due_at', { ascending: false })
      .limit(10),
  ]);
  const events = futureResult.data ?? [];
  const overdueEvents = overdueResult.data ?? [];

  if (!events.length && !overdueEvents.length) {
    await sendKb(chatId, '✅ Không có task nào!', [
      [{ text: '➕ Tạo task', callback_data: 'cmd:newtask' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const todayTasks = events.filter((e: any) => e.due_at < todayEnd);
  const futureTasks = events.filter((e: any) => e.due_at >= todayEnd);

  // Relative countdown
  const countdown = (dueAt: string) => {
    const diff = new Date(dueAt).getTime() - now.getTime();
    if (diff < 0) { const hrs = Math.abs(Math.floor(diff / 3600000)); return `🔴 quá ${hrs}h`; }
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return `⚡ <${Math.ceil(diff / 60000)} phút`;
    if (hrs < 24) return `⏰ còn ${hrs}h`;
    return `📅 còn ${Math.ceil(hrs / 24)}d`;
  };

  const formatTask = (e: any, i: number) => {
    const icon = e.is_done ? '✅' : e.type === 'renewal' ? '🔄' : e.type === 'debt' ? '💳' : e.type === 'contact' ? '📞' : '📌';
    const done = e.is_done ? ' <s>DONE</s>' : '';
    const time = formatTelegramClock(new Date(e.due_at));
    return `${i + 1}. ${icon} <b>${escapeHtml(e.title)}</b>${done}\n   ${countdown(e.due_at)} | ${time}${e.notes ? ` | 📝 ${escapeHtml(String(e.notes).slice(0, 40))}` : ''}`;
  };

  const sections: string[] = [];
  if (overdueEvents.length > 0) {
    sections.push(`🔴 <b>QUÁ HẠN (${overdueEvents.length}):</b>\n${overdueEvents.map(formatTask).join('\n\n')}`);
  }
  if (todayTasks.length > 0) {
    sections.push(`📌 <b>HÔM NAY (${todayTasks.length}):</b>\n${todayTasks.map(formatTask).join('\n\n')}`);
  }
  if (futureTasks.length > 0) {
    sections.push(`📆 <b>SẮP TỚI (${futureTasks.length}):</b>\n${futureTasks.map(formatTask).join('\n\n')}`);
  }

  // Toggle done buttons for undone tasks (top 5)
  const allTasks = [...overdueEvents, ...todayTasks, ...futureTasks];
  const toggleBtns: TelegramButton[][] = allTasks
    .filter(e => !e.is_done)
    .slice(0, 5)
    .map(e => [{
      text: `${e.is_done ? '🔄' : '✅'} ${e.title.slice(0, 20)}`,
      callback_data: `tdone:${e.id}`,
    }]);

  await sendOrEdit(chatId, [
    `📋 <b>TASKS & LỊCH HẸN</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...sections,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n\n'), [
    ...toggleBtns,
    [{ text: '➕ Tạo task', callback_data: 'cmd:newtask' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ], msgId);
}

// ─── /detail ────────────────────────────────────────────────

async function handleDetail(chatId: number, query: string) {
  if (!query) { await sendMsg(chatId, '⚠️ Nhập mã đơn.\nVD: <code>/detail ORD-2506-001</code>'); return; }
  const order = await getOrderWithItemsByCode(query, BOT_ACCOUNT_ID);
  if (!order) { await sendKb(chatId, `❌ Không tìm thấy: <code>${escapeHtml(query)}</code>`, [[{ text: '🔍 Tìm lại', callback_data: 'cmd:search_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]]); return; }
  const c = order.customer ?? null;
  const items = (order.items ?? []) as any[];
  const remaining = daysUntil(order.expires_at);
  const debt = getOutstandingAmount(order);

  const iLines = items.map((i: any) => {
    const khoEmail = i.assigned_source_account?.email ?? null;
    return [
      `  • ${escapeHtml(i.product_name_snapshot)} ×${i.quantity} | ${formatVnd(i.price_vnd)}`,
      `    Nick: <code>${escapeHtml(i.customer_nick_used ?? 'N/A')}</code>`,
      khoEmail ? `    📦 Kho: <code>${escapeHtml(khoEmail)}</code>` : '    📦 Kho: <i>Chưa gán</i>',
    ].join('\n');
  });

  // Customer contacts
  let contactLines = '';
  const contacts = c?.customer_contacts ?? [];
  if (contacts.length) {
    const channelEmoji: Record<string, string> = { phone: '📞', telegram: '💬', email: '📧', zalo: '💚', facebook: '📘', line: '🟢' };
    contactLines = contacts.map((cc: any) => `  ${channelEmoji[cc.channel] ?? '📞'} ${escapeHtml(cc.channel)}: <code>${escapeHtml(cc.value)}</code>`).join('\n');
  }

  await sendKb(chatId, [
    `📦 <b>CHI TIẾT ĐƠN HÀNG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 Mã: <code>${escapeHtml(order.order_code ?? '')}</code>`,
    `${getStatusLabel(order.status)}`,
    `👤 Khách: <b>${escapeHtml(c?.full_name ?? 'N/A')}</b>`,
    contactLines ? `${contactLines}` : '',
    ``,
    `💰 Tổng: <b>${formatVnd(order.total_amount_vnd)}</b>`,
    `💳 Đã trả: <b>${formatVnd(order.total_paid)}</b>${debt > 0 ? ` | 🔴 Còn nợ: <b>${formatVnd(debt)}</b>` : ` | ✅ Đủ`}`,
    ((order as any).payment_terms || (order as any).payment_method) ? `💳 Phương thức: ${escapeHtml(getTelegramPaymentLabel((order as any).payment_terms ?? (order as any).payment_method))}` : '',
    `📅 Tạo: ${formatDate(order.created_at)} → Hạn: ${formatDate(order.expires_at)}`,
    `   ${remaining > 0 ? `còn <b>${remaining}</b> ngày` : `<b>đã hết hạn</b>`}`,
    iLines.length ? `\n📦 <b>Sản phẩm (${items.length}):</b>\n${iLines.join('\n')}` : '',
    order.sales_note ? `\n📝 <b>Ghi chú bán hàng:</b> ${escapeHtml(String(order.sales_note))}` : '',
    (order as any).notes ? `\n📝 <b>Ghi chú nhanh:</b>\n${escapeHtml(String((order as any).notes)).split('\n').slice(-3).join('\n')}` : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join('\n'), [
    [{ text: '🔄 Đổi status', callback_data: `ostatus:${order.order_code}` }, { text: '💳 Ghi TT', callback_data: `pay:${order.order_code}` }],
    [{ text: '📝 Ghi chú', callback_data: `runcmd:note ${order.order_code}` }, { text: '📋 Copy mã', callback_data: `copy:${order.order_code}` }],
    [{ text: '🔗 Gán kho', callback_data: 'cmd:allocate' }, { text: '📦 Đơn', callback_data: 'cmd:orders' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── /security ──────────────────────────────────────────────

async function handleSecurityStatus(chatId: number, _msgId?: number) {
  const blocked = Array.from(failedAttempts.entries()).filter(([, r]) => r.count >= DEFAULT_BLOCK_CONFIG.maxAttempts);
  const totalAttempts = Array.from(failedAttempts.values()).reduce((s, r) => s + r.count, 0);
  const blockedList = blocked.map(([id, r]) => `  🚫 Chat <code>${id}</code> — ${r.count} lần`).join('\n');
  const now = formatDateCustom(new Date(), undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  await sendKb(chatId, [
    `🔒 <b>BẢO MẬT v6.0</b>  📅 ${now}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>TRẠNG THÁI</b>`,
    `  ${process.env.TELEGRAM_WEBHOOK_SECRET ? '✅' : '❌'} Webhook Secret`,
    `  ✅ Admin: <code>${ADMIN_CHAT_ID}</code>`,
    `  ✅ Silent Mode | Brute-force: ${DEFAULT_BLOCK_CONFIG.maxAttempts}x`,
    `  ✅ Block time: ${DEFAULT_BLOCK_CONFIG.blockDurationMs / 60000} phút`,
    ``,
    `📈 <b>THỐNG KÊ</b>`,
    `  🔢 Tổng attempts: <b>${totalAttempts}</b>`,
    `  🚫 Đang block: <b>${blocked.length}</b>`,
    `  📡 Tracked IPs: <b>${failedAttempts.size}</b>`,
    blockedList ? `\n🚫 <b>BLOCKED:</b>\n${blockedList}` : '',
  ].filter(Boolean).join('\n'), [
    [{ text: '🔄 Refresh', callback_data: 'cmd:security' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── Wizard: New Order (Cart-based, Multi-item) ─────────────

/** Adapter: Convert wizard session data → CreateOrderInput (matches Web schema) */
function buildTelegramOrderInput(d: Record<string, any>): import('@/lib/services/order.service').CreateOrderInput {
  // Support both new cart format and legacy single-product format
  const cartItems = (d.cartItems ?? []) as Array<{
    productId: string; productName: string; price: number;
    nick?: string; quantity: number; note?: string;
  }>;

  // Legacy fallback: if no cartItems, build from single product fields
  const items = cartItems.length > 0
    ? cartItems.map(ci => ({
        productId: ci.productId,
        quantity: ci.quantity || 1,
        sellPriceVnd: ci.price || 0,
        notes: ci.note || undefined,
        customerNickUsed: ci.nick || undefined,
      }))
    : [{
        productId: d.productId as string,
        quantity: (d.quantity as number) || 1,
        sellPriceVnd: (d.price as number) || 0,
        notes: (d.note as string) || undefined,
        customerNickUsed: (d.nick as string) || undefined,
      }];

  return {
    customerId: d.customerId as string,
    items,
    paymentTerms: (d.paymentTerms as string) || undefined,
    paymentMethod: toLegacyPaymentMethod((d.paymentTerms as string) || undefined) || undefined,
    salesNote: (d.note as string) || undefined,
    contactSnapshot: (d.contactSnapshot as string) || undefined,
    // Always inject current timestamp so expiresAt and order_code suffix are accurate
    registeredAt: new Date().toISOString(),
  };
}

/** Format cart summary for display in Telegram messages */
function formatCartSummary(cartItems: Array<{ productName: string; price: number; quantity: number; nick?: string }>, showRemoveHint = false): string {
  if (cartItems.length === 0) return '';
  const lines = cartItems.map((ci, i) =>
    `  ${i + 1}. ${escapeHtml(ci.productName)} ×${ci.quantity} — ${formatVnd(ci.price * ci.quantity)}${ci.nick ? ` 🏷${escapeHtml(ci.nick)}` : ''}`
  );
  const total = cartItems.reduce((s, ci) => s + ci.price * ci.quantity, 0);
  return [
    `🛒 <b>Giỏ hàng (${cartItems.length} SP):</b>`,
    ...lines,
    `💰 Tạm tính: <b>${formatVnd(total)}</b>`,
    showRemoveHint && cartItems.length > 0 ? `<i>💡 Bấm ❌ bên dưới để xóa SP</i>` : '',
  ].filter(Boolean).join('\n');
}

/** Auto-capture contact snapshot from customer's contacts for traceability */
async function captureContactSnapshot(customerId: string): Promise<string | undefined> {
  try {
    const { data } = await supabaseAdmin.from('customer_contacts')
      .select('channel, value').eq('customer_id', customerId).limit(3);
    if (!data?.length) return undefined;
    return data.map(c => `${c.channel}:${c.value}`).join(' | ');
  } catch { return undefined; }
}

async function handleNewOrderStart(chatId: number) {
  setSession(chatId, 'neworder', 0, { cartItems: [] });
  const channelEmoji: Record<string, string> = { phone: '📞', zalo: '💚', telegram: '💬', facebook: '📘', email: '📧' };
  const typeIcon: Record<string, string> = { retail: '🛒', wholesale: '🏭', agency: '🏢' };
  const [{ data: rawCusts }, { count: totalCount }] = await Promise.all([
    supabaseAdmin.from('customers')
      .select('id, full_name, type, created_at')
      .eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('customers')
      .select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
  ]);
  const total = totalCount ?? 0;
  const contactMap = await loadTelegramCustomerContacts((rawCusts ?? []).map((c: any) => c.id));
  const custs = attachTelegramCustomerContacts((rawCusts ?? []) as Array<{ id: string; full_name: string; type: string | null; created_at: string | null }>, contactMap);
  const kb: TelegramButton[][] = custs.map((c: any) => {
    const contacts = (c.customer_contacts ?? []) as any[];
    const primary = contacts[0];
    const contactStr = primary ? `${channelEmoji[primary.channel] ?? '📱'} ${primary.value}` : '';
    const dateStr = c.created_at ? formatTelegramDateOnly(c.created_at) : '';
    const icon = typeIcon[c.type] ?? '👤';
    return [{ text: `${icon} ${c.full_name}${contactStr ? ` | ${contactStr}` : ''}${dateStr ? ` · ${dateStr}` : ''}`, callback_data: `no:cust:${c.id}` }];
  });
  kb.push([
    { text: '➕ Tạo KH mới', callback_data: 'no:newcust' },
    { text: '🔍 Tìm KH', callback_data: 'no:searchcust' },
  ]);
  kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);
  await sendKb(chatId, [
    `🆕 <b>TẠO ĐƠN HÀNG MỚI</b>  ${progressBar(1, 8)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Bước 1/8:</b> Chọn khách hàng (${total} KH)`,
    ``,
    `👇 Chọn KH hoặc tạo mới / tìm kiếm:`,
    `💡 Gõ <code>/cancel</code> để hủy bất kỳ lúc nào`,
  ].join('\n'), kb);
}

async function handleNewOrderCallback(chatId: number, data: string) {
  const parts = data.split(':');
  const _session = getSession(chatId);

  // Customer search from order wizard — preserve existing cart
  if (parts[1] === 'searchcust') {
    const prevSession = getSession(chatId);
    setSession(chatId, 'neworder', 0, { searchMode: true, cartItems: prevSession?.data?.cartItems ?? [] });
    await sendMsg(chatId, [
      `🔍 <b>Tìm khách hàng</b>`,
      ``,
      `Nhập tên, SĐT, hoặc thông tin liên hệ:`,
      `<i>Ví dụ: Nguyễn Văn A, 0987654321, zalo...</i>`,
    ].join('\n'));
    return;
  }

  // Create new customer — preserve existing cart
  if (parts[1] === 'newcust') {
    const prevSession = getSession(chatId);
    setSession(chatId, 'neworder', 10, { cartItems: prevSession?.data?.cartItems ?? [] });
    await sendMsg(chatId, [
      `➕ <b>TẠO KHÁCH HÀNG MỚI</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📝 Nhập tên đầy đủ khách hàng:`,
      `<i>Ví dụ: Nguyễn Văn A</i>`,
    ].join('\n'));
    return;
  }

  // Customer type selected → ask phone (preserve all session data including cart)
  if (parts[1] === 'custtype') {
    const custType = parts[2];
    const typeLabels: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
    const s = getSession(chatId); if (!s) return;
    setSession(chatId, 'neworder', 12, { ...s.data, newCustType: custType });
    await sendMsg(chatId, [
      `✅ Loại: <b>${typeLabels[custType] ?? custType}</b>`,
      ``,
      `💚 <b>Nhập Zalo khách hàng (liên hệ chính):</b>`,
      `<i>Ví dụ: 0987654321 hoặc username/link Zalo</i>`,
      `Gõ <code>skip</code> để bỏ qua`,
    ].join('\n'));
    return;
  }

  // Quick contact channel selected → ask value
  if (parts[1] === 'quickcontact') {
    const channel = parts[2];
    const channelLabels: Record<string, string> = { phone: '📞 SĐT phụ', facebook: '📘 Facebook', telegram: '💬 Telegram', email: '📧 Email' };
    const s = getSession(chatId); if (!s) return;
    setSession(chatId, 'neworder', 14, { ...s.data, quickContactChannel: channel });
    await sendMsg(chatId, [
      `📱 Kênh: <b>${channelLabels[channel] ?? channel}</b>`,
      ``,
      `📌 Nhập thông tin liên hệ:`,
      `<i>VD: @username, link profile, hoặc số điện thoại</i>`,
    ].join('\n'));
    return;
  }

  // Skip contact → create customer directly
  if (parts[1] === 'skipcontact') {
    const s = getSession(chatId); if (!s) return;
    return await createOrderCustomer(chatId, s.data);
  }

  if (parts[1] === 'addmorecontact') {
    const s = getSession(chatId); if (!s) return;
    await showNewOrderExtraContactPicker(chatId, s.data);
    return;
  }

  if (parts[1] === 'donecontacts') {
    const s = getSession(chatId); if (!s) return;
    return await createOrderCustomer(chatId, s.data);
  }

  if (parts[1] === 'cust') {
    // Fetch customer name + auto-capture contact snapshot
    const prevSession = getSession(chatId);
    const existingCart = prevSession?.data?.cartItems ?? [];
    const [{ data: cust }, contactSnapshot] = await Promise.all([
      supabaseAdmin.from('customers').select('full_name').eq('account_id', BOT_ACCOUNT_ID).eq('id', parts[2]).single(),
      captureContactSnapshot(parts[2]),
    ]);
    if (!cust) { await sendMsg(chatId, 'Customer not found.'); return; }
    // Initialize cart-based session — preserve existing cart if re-selecting customer
    setSession(chatId, 'neworder', 2, {
      customerId: parts[2], customerName: cust?.full_name ?? 'N/A',
      cartItems: existingCart, contactSnapshot,
    });
    await showProductSelection(chatId, `✅ KH: <b>${escapeHtml(cust?.full_name ?? 'N/A')}</b>`);
  } else if (parts[1] === 'prod') {
    const s = getSession(chatId); if (!s) return;
    // Fetch product details including duration for expiry calculation
    const { data: prod } = await supabaseAdmin.from('products')
      .select('name, sell_price_vnd, duration_type, duration_value')
      .eq('account_id', BOT_ACCOUNT_ID)
      .eq('id', parts[2]).single();
    if (!prod) { await sendMsg(chatId, 'Product not found.'); return; }
    // Store as currentItem (temp, will be added to cart after qty)
    setSession(chatId, 'neworder', 3, {
      ...s.data,
      currentItem: {
        productId: parts[2], price: parseInt(parts[3]) || 0, productName: prod?.name ?? 'N/A',
        durationType: prod?.duration_type ?? 'days', durationValue: prod?.duration_value ?? 30,
      },
    });
    const cartLen = (s.data.cartItems ?? []).length;
    await sendKb(chatId, [
      `✅ SP: <b>${escapeHtml(prod?.name ?? 'N/A')}</b> | ${formatVnd(parseInt(parts[3]) || 0)}`,
      cartLen > 0 ? `🛒 Giỏ: ${cartLen} SP` : '',
      ``,
      `📌 Nhập nick/username khách hàng`,
      `<i>Ví dụ: duolingo_nick hoặc facebook_username</i>`,
    ].filter(Boolean).join('\n'), [
      [{ text: '⏭ Bỏ qua nick', callback_data: 'no:skipnick' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'skipnick') {
    // Skip nick input entirely → go straight to quantity
    const s = getSession(chatId); if (!s) return;
    setSession(chatId, 'neworder', 5, s.data);
    await sendKb(chatId, [
      `⏭ Nick: <i>bỏ qua</i>`,
      ``,
      `📌 Nhập số lượng`,
      `<i>Mặc định: 1. Nhập số hoặc gõ</i> <code>1</code>`,
    ].join('\n'), [
      [{ text: '1️⃣ SL = 1', callback_data: 'no:quickqty:1' }, { text: '2️⃣ SL = 2', callback_data: 'no:quickqty:2' }],
      [{ text: '3️⃣ SL = 3', callback_data: 'no:quickqty:3' }, { text: '5️⃣ SL = 5', callback_data: 'no:quickqty:5' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'skiplookup') {
    // Skip Duolingo/FBID lookup → go to quantity
    const s = getSession(chatId); if (!s) return;
    setSession(chatId, 'neworder', 5, s.data);
    await sendKb(chatId, [
      `📌 Nhập số lượng`,
      `<i>Mặc định: 1. Nhập số hoặc gõ</i> <code>1</code>`,
    ].join('\n'), [
      [{ text: '1️⃣ SL = 1', callback_data: 'no:quickqty:1' }, { text: '2️⃣ SL = 2', callback_data: 'no:quickqty:2' }],
      [{ text: '3️⃣ SL = 3', callback_data: 'no:quickqty:3' }, { text: '5️⃣ SL = 5', callback_data: 'no:quickqty:5' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'quickqty') {
    // Quick quantity selection via button
    const s = getSession(chatId); if (!s) return;
    const qty = parseInt(parts[2]) || 1;
    const ci = s.data.currentItem;
    const updatedItem = ci ? { ...ci, quantity: qty } : { quantity: qty };
    const cartItems = (s.data.cartItems ?? []) as any[];
    setSession(chatId, 'neworder', 5, { ...s.data, currentItem: updatedItem, quantity: qty });
    const itemSummary = ci
      ? `📦 ${escapeHtml(ci.productName ?? 'N/A')} ×${qty} — ${formatVnd((ci.price ?? 0) * qty)}${ci.nick ? ` 🏷${escapeHtml(ci.nick)}` : ''}`
      : `📦 ×${qty}`;
    await sendKb(chatId, [
      `✅ Số lượng: <b>${qty}</b>`,
      itemSummary,
      cartItems.length > 0 ? `\n${formatCartSummary(cartItems)}` : '',
      ``,
      `👇 Thêm SP vào giỏ hoặc thanh toán:`,
    ].filter(Boolean).join('\n'), [
      [{ text: '➕ Thêm SP khác', callback_data: 'no:addcart' }, { text: '💳 Thanh toán', callback_data: 'no:checkout' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'lookup_duo') {
    const s = getSession(chatId); if (!s) return;
    const nick = s.data.currentItem?.nick ?? s.data.nick;
    if (nick) {
      // Non-blocking: fire lookup in background, move wizard forward immediately
      sendMsg(chatId, `⏳ Đang tra Duolingo: <code>${escapeHtml(nick)}</code>...`)
        .then(() => handleDuolingo(chatId, nick))
        .catch(() => { /* non-critical */ });
    }
    // Move to qty step immediately instead of waiting
    setSession(chatId, 'neworder', 5, s.data);
    await sendKb(chatId, [
      `📌 Nhập số lượng (kết quả Duolingo sẽ hiện bên dưới)`,
      `<i>Mặc định: 1. Nhập số hoặc gõ</i> <code>1</code>`,
    ].join('\n'), [
      [{ text: '1️⃣ SL = 1', callback_data: 'no:quickqty:1' }, { text: '2️⃣ SL = 2', callback_data: 'no:quickqty:2' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'lookup_fb') {
    const s = getSession(chatId); if (!s) return;
    const nick = s.data.currentItem?.nick ?? s.data.nick;
    if (nick) {
      // Non-blocking: fire lookup in background, move wizard forward immediately
      sendMsg(chatId, `⏳ Đang tra Facebook ID: <code>${escapeHtml(nick)}</code>...`)
        .then(() => handleFbid(chatId, nick))
        .catch(() => { /* non-critical */ });
    }
    // Move to qty step immediately
    setSession(chatId, 'neworder', 5, s.data);
    await sendKb(chatId, [
      `📌 Nhập số lượng (kết quả FBID sẽ hiện bên dưới)`,
      `<i>Mặc định: 1. Nhập số hoặc gõ</i> <code>1</code>`,
    ].join('\n'), [
      [{ text: '1️⃣ SL = 1', callback_data: 'no:quickqty:1' }, { text: '2️⃣ SL = 2', callback_data: 'no:quickqty:2' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'addcart') {
    // Add current item to cart → return to product selection
    const s = getSession(chatId); if (!s) return;
    const d = s.data;
    const ci = d.currentItem;
    if (!ci) { await sendMsg(chatId, '⚠️ Chưa có SP để thêm.'); return; }
    const cartItems = [...(d.cartItems ?? [])];
    const MAX_CART = 5;
    if (cartItems.length >= MAX_CART) {
      await sendMsg(chatId, `⚠️ Giỏ hàng tối đa ${MAX_CART} sản phẩm.`);
      // Go to checkout instead
      setSession(chatId, 'neworder', 6, { ...d, currentItem: undefined });
      await sendKb(chatId, [
        formatCartSummary(cartItems),
        ``,
        `📌 Phương thức thanh toán`,
      ].join('\n'), [
        [{ text: '💰 Trả trước', callback_data: 'no:pay:prepaid' }, { text: '📝 Công nợ', callback_data: 'no:pay:credit' }],
        [{ text: '🚚 COD / Trực tiếp', callback_data: 'no:pay:cod' }],
        [{ text: '⏩ Bỏ qua', callback_data: 'no:pay:skip' }],
        [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
      ]);
      return;
    }
    cartItems.push({
      productId: ci.productId, productName: ci.productName, price: ci.price,
      nick: ci.nick, quantity: ci.quantity || 1, note: ci.note,
      durationType: ci.durationType, durationValue: ci.durationValue,
    });
    setSession(chatId, 'neworder', 2, { ...d, cartItems, currentItem: undefined });
    await showProductSelection(chatId, [
      `✅ Đã thêm <b>${escapeHtml(ci.productName)}</b> vào giỏ`,
      formatCartSummary(cartItems),
    ].join('\n'));
  } else if (parts[1] === 'removecart') {
    // Remove item from cart by index
    const s = getSession(chatId); if (!s) return;
    const idx = parseInt(parts[2]) || 0;
    const cartItems = [...(s.data.cartItems ?? [])] as any[];
    if (idx >= 0 && idx < cartItems.length) {
      const removed = cartItems.splice(idx, 1)[0];
      setSession(chatId, 'neworder', 2, { ...s.data, cartItems, currentItem: undefined });
      await showProductSelection(chatId, [
        `🗑 Đã xóa <b>${escapeHtml(removed.productName)}</b>`,
        cartItems.length > 0 ? formatCartSummary(cartItems) : '🛒 Giỏ hàng trống',
      ].join('\n'));
    }
  } else if (parts[1] === 'checkout') {
    // Finish adding products → go to payment
    const s = getSession(chatId); if (!s) return;
    const d = s.data;
    const cartItems = [...(d.cartItems ?? [])] as any[];
    // If currentItem exists but hasn't been added, add it now
    if (d.currentItem?.productId) {
      cartItems.push({
        productId: d.currentItem.productId, productName: d.currentItem.productName, price: d.currentItem.price,
        nick: d.currentItem.nick, quantity: d.currentItem.quantity || 1, note: d.currentItem.note,
        durationType: d.currentItem.durationType, durationValue: d.currentItem.durationValue,
      });
    }
    if (cartItems.length === 0) {
      await sendMsg(chatId, '⚠️ Giỏ hàng trống. Hãy chọn ít nhất 1 sản phẩm.');
      return;
    }
    setSession(chatId, 'neworder', 6, { ...d, cartItems, currentItem: undefined });
    // Build remove buttons for each cart item
    const removeButtons: TelegramButton[][] = cartItems.map((ci: any, i: number) =>
      [{ text: `❌ Xóa: ${ci.productName}`, callback_data: `no:removecart:${i}` }]
    );
    await sendKb(chatId, [
      formatCartSummary(cartItems, true),
      ``,
      `📌 Phương thức thanh toán`,
    ].join('\n'), [
      ...removeButtons,
      [{ text: '💰 Trả trước', callback_data: 'no:pay:prepaid' }, { text: '📝 Công nợ', callback_data: 'no:pay:credit' }],
      [{ text: '🚚 COD / Trực tiếp', callback_data: 'no:pay:cod' }],
      [{ text: '⏩ Bỏ qua PTTT', callback_data: 'no:pay:skip' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  } else if (parts[1] === 'pay') {
    // Payment method selected → ask notes
    const s = getSession(chatId); if (!s) return;
    const pm = parts[2] === 'skip' ? null : parts[2];
    setSession(chatId, 'neworder', 7, { ...s.data, paymentTerms: pm });
    if (pm) await sendMsg(chatId, `✅ PTTT: <b>${getTelegramPaymentLabel(pm)}</b>`);
    await sendMsg(chatId, [
      `📌 Ghi chú đơn hàng`,
      `<i>Gõ ghi chú hoặc</i> <code>skip</code> <i>để bỏ qua</i>`,
      `<i>Ví dụ: KH hẹn TT cuối tuần, cần giao gấp</i>`,
    ].join('\n'));
  } else if (parts[1] === 'confirm') {
    const s = getSession(chatId); if (!s) return; const d = s.data; clearSession(chatId);
    try {
      await sendMsg(chatId, '⏳ Đang tạo đơn...');
      // Use adapter to build consistent input (with registeredAt)
      const orderInput = buildTelegramOrderInput(d);
      const result = await createOrderWithItems(BOT_ACCOUNT_ID, orderInput);
      await createOrderStatusHistory({
        order_id: result.order.id,
        old_status: null,
        new_status: result.order.status,
        changed_by: "Telegram bot",
        change_reason: "Tạo đơn từ Telegram bot",
        metadata: {
          source: "telegram-bot",
          items_count: result.items.length,
          payment_terms: orderInput.paymentTerms ?? orderInput.paymentMethod ?? null,
        },
      });

      const order = result.order;
      const cartItems = (d.cartItems ?? []) as Array<{ productName: string; price: number; quantity: number; nick?: string }>;
      const statusLabel = getStatusLabel(order.status);
      const expiresDate = order.expires_at ? new Date(order.expires_at) : null;
      const totalPrice = orderInput.items.reduce((s, i) => s + (i.sellPriceVnd ?? 0) * i.quantity, 0);

      // Build items display (supports both cart and legacy single-item)
      const itemsDisplay = cartItems.length > 0
        ? cartItems.map((ci, i) => `  ${i + 1}. ${escapeHtml(ci.productName)} ×${ci.quantity} — ${formatVnd(ci.price * ci.quantity)}${ci.nick ? ` 🏷${escapeHtml(ci.nick)}` : ''}`).join('\n')
        : `  📦 ${escapeHtml(d.productName ?? 'N/A')} ×${d.quantity || 1} — ${formatVnd(totalPrice)}${d.nick ? ` 🏷${escapeHtml(d.nick)}` : ''}`;

      await sendKb(chatId, [
        `✅ <b>ĐÃ TẠO ĐƠN HÀNG!</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 Mã: <code>${escapeHtml(order.order_code ?? '')}</code>`,
        `${statusLabel}`,
        `👤 KH: <b>${escapeHtml(d.customerName ?? 'N/A')}</b>`,
        `📦 <b>Sản phẩm:</b>`,
        itemsDisplay,
        `💰 Tổng: <b>${formatVnd(totalPrice)}</b>`,
        d.paymentTerms ? `💳 PTTT: ${getTelegramPaymentLabel(d.paymentTerms)}` : '',
        d.note ? `📝 Ghi chú: ${escapeHtml(d.note)}` : '',
        expiresDate ? `📅 Hết hạn: ${formatTelegramDateWithYear(expiresDate)}` : '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Tiếp theo: /allocate để gán kho`,
      ].filter(Boolean).join('\n'), [
        [{ text: '🔗 Gán kho ngay', callback_data: 'cmd:allocate' }, { text: '📋 Chi tiết', callback_data: `detail:${order.order_code}` }],
        [{ text: '➕ Tạo thêm đơn', callback_data: 'cmd:neworder' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]);
    } catch (e) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`); }
  }
}

/** Helper: Create customer with contacts from order wizard data, then show product selection */
async function createOrderCustomer(chatId: number, d: Record<string, any>) {
  await sendMsg(chatId, '⏳ Đang tạo khách hàng...');
  try {
    const custName = d.newCustName as string;
    if (!custName) { await sendMsg(chatId, '❌ Không tìm thấy tên KH. Gõ /neworder để bắt đầu lại.'); return; }
    const typeMap: Record<string, string> = { retail: 'retail', wholesale: 'wholesale', agency: 'agency' };
    const dbType = typeMap[d.newCustType] ?? 'retail';
    const { data: newCust, error } = await supabaseAdmin.from('customers').insert({
      full_name: custName, type: dbType, account_id: BOT_ACCOUNT_ID,
    }).select('id, full_name, type').single();
    if (error) throw new Error(error.message ?? JSON.stringify(error));

    // Insert contacts: primary Zalo + optional additional contacts
    const contacts: Array<{channel: string; value: string}> = [];
    if (d.newCustZalo) contacts.push({ channel: 'zalo', value: d.newCustZalo });
    if (Array.isArray(d.quickContacts)) {
      contacts.push(...(d.quickContacts as Array<{ channel: string; value: string }>));
    }
    // Legacy compatibility for old in-flight sessions
    if (d.newCustPhone) contacts.push({ channel: 'phone', value: d.newCustPhone });
    if (d.quickContactChannel && d.quickContactValue) {
      contacts.push({ channel: d.quickContactChannel, value: d.quickContactValue });
    }
    if (contacts.length > 0) {
      const { error: contactError } = await supabaseAdmin.from('customer_contacts').insert(
        contacts.map((c) => ({ customer_id: newCust.id, channel: c.channel, value: c.value }))
      );
      if (contactError) console.error('[Bot] Contact insert error:', contactError);
    }

    const typeLabels: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
    const contactSummary = contacts.slice(0, 2).map(c => `${c.channel}: ${c.value}`).join(', ');
    const header = [
      `✅ Đã tạo KH: <b>${escapeHtml(newCust.full_name)}</b>`,
      `   ${typeLabels[newCust.type] ?? newCust.type}${contactSummary ? ` | ${escapeHtml(contactSummary)}` : ''}`,
    ].join('\n');

    // Preserve existing cart + auto-capture contact snapshot
    const contactSnap = contacts.slice(0, 2).map(c => `${c.channel}:${c.value}`).join(' | ') || undefined;
    setSession(chatId, 'neworder', 2, {
      customerId: newCust.id, customerName: newCust.full_name,
      cartItems: d.cartItems ?? [], contactSnapshot: contactSnap,
    });
    await showProductSelection(chatId, header);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await sendMsg(chatId, `❌ Lỗi tạo KH: ${escapeHtml(errMsg.slice(0, 200))}`);
  }
}

/** Helper: Show optional extra contact picker in new-order customer creation */
async function showNewOrderExtraContactPicker(chatId: number, data: Record<string, any>) {
  const quickContacts = (data.quickContacts ?? []) as Array<{ channel: string; value: string }>;
  const addedChannels = new Set(quickContacts.map(c => c.channel));

  const options = [
    { text: '📞 SĐT phụ', channel: 'phone' },
    { text: '📘 Facebook', channel: 'facebook' },
    { text: '💬 Telegram', channel: 'telegram' },
    { text: '📧 Email', channel: 'email' },
  ].filter(opt => !addedChannels.has(opt.channel));

  const keyboard: TelegramButton[][] = [];
  if (options[0] || options[1]) {
    keyboard.push([
      ...(options[0] ? [{ text: options[0].text, callback_data: `no:quickcontact:${options[0].channel}` }] : []),
      ...(options[1] ? [{ text: options[1].text, callback_data: `no:quickcontact:${options[1].channel}` }] : []),
    ]);
  }
  if (options[2] || options[3]) {
    keyboard.push([
      ...(options[2] ? [{ text: options[2].text, callback_data: `no:quickcontact:${options[2].channel}` }] : []),
      ...(options[3] ? [{ text: options[3].text, callback_data: `no:quickcontact:${options[3].channel}` }] : []),
    ]);
  }

  keyboard.push([{ text: '✅ Xong - Tạo KH', callback_data: 'no:donecontacts' }]);
  keyboard.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);

  const summary = quickContacts.length > 0
    ? `📋 Đã thêm: ${quickContacts.map(c => c.channel).join(', ')}`
    : '📋 Chưa có liên hệ phụ';

  await sendKb(chatId, [
    `📱 <b>Thêm liên hệ khác (tùy chọn):</b>`,
    `<i>Zalo đã là liên hệ chính.</i>`,
    summary,
  ].join('\n'), keyboard);
}

/** Helper: Show product selection inline keyboard with slot availability + cart summary */
async function showProductSelection(chatId: number, header: string) {
  const s = getSession(chatId);
  const cartItems = (s?.data?.cartItems ?? []) as Array<{ productName: string; price: number; quantity: number; nick?: string }>;

  const [{ data: prods }, { data: khoAccs }] = await Promise.all([
    supabaseAdmin.from('products')
      .select('id, name, sell_price_vnd').eq('account_id', BOT_ACCOUNT_ID)
      .eq('is_active', true).is('deleted_at', null).order('name').limit(20),
    supabaseAdmin.from('source_accounts')
      .select('product_ids, max_slots, used_slots, expires_at')
      .eq('account_id', BOT_ACCOUNT_ID)
      .is('deleted_at', null),
  ]);
  if (!prods?.length) { clearSession(chatId); await sendMsg(chatId, '❌ Chưa có sản phẩm. Tạo SP trước: /newproduct'); return; }
  // Count available slots per product
  const slotMap = new Map<string, number>();
  for (const sa of khoAccs ?? []) {
    if (sa.expires_at && new Date(sa.expires_at) < new Date()) continue;
    const free = sa.max_slots - sa.used_slots;
    if (free <= 0) continue;
    for (const pid of (sa.product_ids ?? []) as string[]) slotMap.set(pid, (slotMap.get(pid) ?? 0) + free);
  }
  const kb: TelegramButton[][] = prods.map(p => {
    const slots = slotMap.get(p.id) ?? 0;
    const slotBadge = slots > 0 ? ` 🟢${slots} slot` : ' 🔴hết slot';
    return [{ text: `📦 ${p.name} — ${formatVnd(p.sell_price_vnd)}${slotBadge}`, callback_data: `no:prod:${p.id}:${p.sell_price_vnd}` }];
  });
  // If cart has items, show checkout button
  if (cartItems.length > 0) {
    kb.push([{ text: `💳 Thanh toán (${cartItems.length} SP)`, callback_data: 'no:checkout' }]);
  }
  kb.push([
    { text: '⬅️ Quay lại', callback_data: 'cmd:neworder' },
    { text: '❌ Hủy', callback_data: 'cmd:cancel' },
  ]);
  await sendKb(chatId, [
    header,
    ``,
    `📌 Chọn sản phẩm${cartItems.length > 0 ? ' (hoặc nhấn Thanh toán)' : ''}`,
    `👇 Bấm SP cần mua (🟢= có slot, 🔴= hết):`,
  ].join('\n'), kb);
}

async function handleNewOrderWizard(chatId: number, text: string, session: WizardSession) {
  const input = text.trim();

  // Step 0 with searchMode: user typed a search query
  if (session.step === 0 && session.data?.searchMode) {
    const q = input;
    if (!q) { await sendMsg(chatId, '⚠️ Vui lòng nhập tên hoặc thông tin KH.'); return; }
    // Vietnamese accent-insensitive normalize helper
    const vnNorm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
    const qNorm = vnNorm(q);
    const qWords = qNorm.split(/\s+/).filter(w => w.length > 0);

    // Similarity score: how well a name matches the query (0-100)
    const scoreName = (name: string): number => {
      const nNorm = vnNorm(name);
      const nWords = nNorm.split(/\s+/);
      // Exact full match
      if (nNorm === qNorm) return 100;
      // Full substring match
      if (nNorm.includes(qNorm)) return 90;
      // All query words found in name
      if (qWords.every(w => nNorm.includes(w))) return 80;
      // Any query word found in name words (word-level match)
      const wordMatches = qWords.filter(w => nWords.some(nw => nw.includes(w) || w.includes(nw)));
      if (wordMatches.length > 0) return 40 + (wordMatches.length / qWords.length) * 30;
      // Character-level similarity (Levenshtein-lite: shared chars ratio)
      const shared = [...new Set(qNorm)].filter(c => nNorm.includes(c)).length;
      const ratio = shared / Math.max(new Set(qNorm).size, 1);
      if (ratio > 0.6) return Math.round(ratio * 30);
      return 0;
    };

    // Fetch all customers once for smart matching
    const { data: rawCusts } = await supabaseAdmin.from('customers')
      .select('id, full_name, type, created_at, nicks_registry')
      .eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(200);
    const pool = rawCusts ?? [];

    // Score and rank ALL customers
    const scored = pool.map(c => ({ ...c, score: scoreName(c.full_name ?? '') }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    // Split: exact matches (score >= 40) vs suggestions (score < 40)
    let results = scored.filter(c => c.score >= 40).slice(0, 10);

    // Also search by contact value if no name matches
    if (!results.length) {
      const { data: contactRows } = await supabaseAdmin.from('customer_contacts')
        .select('customer_id, channel, value')
        .ilike('value', `%${q}%`).limit(10);
      if (contactRows?.length) {
        const contactCustomerMap = await loadTelegramCustomerMap(
          [...new Set(contactRows.map((c: any) => c.customer_id))],
          'id, full_name, type, created_at, nicks_registry',
        );
        results = [...contactCustomerMap.values()].map((c) => ({ ...c, score: 70 })) as any[];
      }
    }

    // If still nothing, show suggestions (lower score matches)
    const suggestions = scored.filter(c => c.score > 0 && c.score < 40).slice(0, 5);

    if (!results.length && !suggestions.length) {
      await sendKb(chatId, `❌ Không tìm thấy KH: <code>${escapeHtml(q)}</code>`, [
        [{ text: '🔍 Tìm lại', callback_data: 'no:searchcust' }, { text: '➕ Tạo KH', callback_data: 'no:newcust' }],
        [{ text: '⬅️ Quay lại', callback_data: 'cmd:neworder' }, { text: '❌ Hủy', callback_data: 'cmd:cancel' }],
      ]);
      return;
    }

    // If no exact match but have suggestions, show them
    if (!results.length && suggestions.length) {
      results = suggestions;
    }
    const resultContactMap = await loadTelegramCustomerContacts(results.map((c: any) => c.id));
    results = attachTelegramCustomerContacts(results as Array<{ id: string; full_name: string; type?: string | null; created_at?: string | null }>, resultContactMap) as any[];
    const channelEmoji: Record<string, string> = { phone: '📞', zalo: '💚', telegram: '💬', facebook: '📘', email: '📧' };
    const typeIcon: Record<string, string> = { retail: '🛒', wholesale: '🏭', agency: '🏢' };
    const kb: TelegramButton[][] = results.map((c: any) => {
      const contacts = (c.customer_contacts ?? []) as any[];
      const primary = contacts[0];
      const contactStr = primary ? `${channelEmoji[primary.channel] ?? '📱'} ${primary.value}` : '';
      const dateStr = c.created_at ? formatTelegramDateOnly(c.created_at) : '';
      const icon = typeIcon[c.type] ?? '👤';
      return [{ text: `${icon} ${c.full_name}${contactStr ? ` | ${contactStr}` : ''}${dateStr ? ` · ${dateStr}` : ''}`, callback_data: `no:cust:${c.id}` }];
    });
    kb.push([
      { text: '🔍 Tìm lại', callback_data: 'no:searchcust' },
      { text: '⬅️ Quay lại', callback_data: 'cmd:neworder' },
    ]);
    kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);
    const isSuggestion = results.every((c: any) => (c.score ?? 0) < 40);
    const headerText = isSuggestion
      ? `💡 Có phải bạn tìm? (${results.length} gợi ý cho "<code>${escapeHtml(q)}</code>")`
      : `🔍 Kết quả: <b>${results.length}</b> KH cho "<code>${escapeHtml(q)}</code>"`;
    await sendKb(chatId, [
      headerText,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Chọn KH để tiếp tục:`,
    ].join('\n'), kb);
    return;
  }

  // Step 10: Receive new customer name → ask type
  if (session.step === 10) {
    if (!input) { await sendMsg(chatId, '⚠️ Tên không được để trống.'); return; }
    setSession(chatId, 'neworder', 11, { newCustName: input });
    await sendKb(chatId, [
      `👤 Tên: <b>${escapeHtml(input)}</b>`,
      ``, `📌 Chọn loại khách hàng:`,
    ].join('\n'), [
      [{ text: '🛒 Cá nhân', callback_data: 'no:custtype:retail' }, { text: '🏭 Buôn sỉ', callback_data: 'no:custtype:wholesale' }],
      [{ text: '🏢 Đại lý', callback_data: 'no:custtype:agency' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Step 12: Receive phone → ask quick contact
  if (session.step === 12) {
    const zalo = input.toLowerCase() === 'skip' ? null : input;
    if (zalo) {
      const validation = validateContactInput('zalo', zalo);
      if (!validation.ok) {
        await sendMsg(chatId, `⚠️ ${escapeHtml(validation.error ?? 'Zalo không hợp lệ.')}`);
        return;
      }
      const normalizedZalo = validation.normalizedValue ?? zalo;
      setSession(chatId, 'neworder', 13, { ...session.data, newCustZalo: normalizedZalo });
      await sendMsg(chatId, `✅ Zalo: <code>${escapeHtml(normalizedZalo)}</code>`);
      await showNewOrderExtraContactPicker(chatId, { ...session.data, newCustZalo: normalizedZalo });
      return;
    }
    setSession(chatId, 'neworder', 13, { ...session.data, newCustZalo: null });
    await showNewOrderExtraContactPicker(chatId, { ...session.data, newCustZalo: null });
    return;
  }

  // Step 14: Receive contact value → create customer
  if (session.step === 14) {
    const channel = session.data.quickContactChannel as string;
    const validation = validateContactInput(channel, input);
    if (!validation.ok) {
      await sendMsg(chatId, `⚠️ ${escapeHtml(validation.error ?? 'Liên hệ không hợp lệ.')}`);
      return;
    }
    const normalizedChannel = validation.normalizedChannel ?? (channel as 'phone' | 'email' | 'zalo' | 'facebook' | 'telegram' | 'other');
    const normalizedValue = validation.normalizedValue ?? input;
    const quickContacts = (session.data.quickContacts ?? []) as Array<{ channel: string; value: string }>;
    const mergedContacts = appendUniqueContact(quickContacts, { channel: normalizedChannel, value: normalizedValue });
    setSession(chatId, 'neworder', 13, { ...session.data, quickContacts: mergedContacts, quickContactChannel: undefined });
    await sendKb(chatId, [
      `✅ Đã thêm liên hệ: <b>${escapeHtml(normalizedChannel)}</b>`,
      `<code>${escapeHtml(normalizedValue)}</code>`,
      `📋 Tổng liên hệ phụ: ${mergedContacts.length}`,
      `👇 Tiếp tục thêm hoặc tạo KH`,
    ].join('\n'), [
      [{ text: '➕ Thêm liên hệ khác', callback_data: 'no:addmorecontact' }],
      [{ text: '✅ Xong - Tạo KH', callback_data: 'no:donecontacts' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Step 3: Receive nick → store in currentItem, show lookup options
  if (session.step === 3) {
    const ci = session.data.currentItem;
    const updatedItem = ci ? { ...ci, nick: input } : { nick: input };
    setSession(chatId, 'neworder', 4, { ...session.data, currentItem: updatedItem, nick: input });
    await sendKb(chatId, [
      `✅ Nick: <code>${escapeHtml(input)}</code>`,
      ``,
      `📌 Tra cứu thông tin nick`,
      `<i>Tra Duolingo hoặc FBID để xác minh nick KH</i>`,
    ].join('\n'), [
      [{ text: '🦉 Tra Duolingo', callback_data: 'no:lookup_duo' }, { text: '📘 Tra FBID', callback_data: 'no:lookup_fb' }],
      [{ text: '⏭ Bỏ qua → Số lượng', callback_data: 'no:skiplookup' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Step 5: Receive quantity → update currentItem, show "Add more" or "Checkout"
  if (session.step === 5) {
    const qty = parseInt(input) || 1;
    if (qty < 1 || qty > 100) { await sendMsg(chatId, '⚠️ Số lượng phải từ 1–100.'); return; }
    const ci = session.data.currentItem;
    const updatedItem = ci ? { ...ci, quantity: qty } : { quantity: qty };
    const cartItems = (session.data.cartItems ?? []) as any[];
    setSession(chatId, 'neworder', 5, { ...session.data, currentItem: updatedItem, quantity: qty });

    const itemSummary = ci
      ? `📦 ${escapeHtml(ci.productName ?? 'N/A')} ×${qty} — ${formatVnd((ci.price ?? 0) * qty)}${ci.nick ? ` 🏷${escapeHtml(ci.nick)}` : ''}`
      : `📦 ×${qty}`;

    await sendKb(chatId, [
      `✅ Số lượng: <b>${qty}</b>`,
      itemSummary,
      cartItems.length > 0 ? `\n${formatCartSummary(cartItems)}` : '',
      ``,
      `👇 Thêm SP vào giỏ hoặc thanh toán:`,
    ].filter(Boolean).join('\n'), [
      [{ text: '➕ Thêm SP khác', callback_data: 'no:addcart' }, { text: '💳 Thanh toán', callback_data: 'no:checkout' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Step 7: Receive notes → show confirmation with full cart
  if (session.step === 7) {
    const note = input.toLowerCase() === 'skip' ? '' : input;
    const d: Record<string, any> = { ...session.data, note };
    const cartItems = (d.cartItems ?? []) as Array<{ productName: string; price: number; quantity: number; nick?: string }>;
    setSession(chatId, 'neworder', 8, d);

    // Calculate total from cart or legacy single-item
    const totalPrice = cartItems.length > 0
      ? cartItems.reduce((s, ci) => s + ci.price * ci.quantity, 0)
      : (d.price || 0) * (d.quantity || 1);

    // Build items display
    const itemsDisplay = cartItems.length > 0
      ? cartItems.map((ci, i) => `  ${i + 1}. ${escapeHtml(ci.productName)} ×${ci.quantity} — ${formatVnd(ci.price * ci.quantity)}${ci.nick ? ` 🏷${escapeHtml(ci.nick)}` : ''}`).join('\n')
      : `  📦 ${escapeHtml(d.productName ?? d.currentItem?.productName ?? 'N/A')} ×${d.quantity || 1}`;

    await sendKb(chatId, [
      `📌 <b>XÁC NHẬN ĐƠN HÀNG</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 KH: <b>${escapeHtml(d.customerName ?? 'N/A')}</b>`,
      `📦 <b>Sản phẩm:</b>`,
      itemsDisplay,
      `💰 Tổng: <b>${formatVnd(totalPrice)}</b>`,
      d.paymentTerms ? `💳 PTTT: ${getTelegramPaymentLabel(d.paymentTerms)}` : '',
      note ? `📝 Ghi chú: ${escapeHtml(note)}` : `📝 Ghi chú: <i>không</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ Bấm OK để tạo đơn:`,
    ].filter(Boolean).join('\n'), [
      [{ text: '✅ Xác nhận tạo đơn', callback_data: 'no:confirm' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  }
}

// ─── Wizard: Allocate ───────────────────────────────────────

async function handleAllocateStart(chatId: number) {
  const { data: rawOrders } = await supabaseAdmin.from('orders')
    .select('id, customer_id, order_code, product_name_snapshot')
    .eq('account_id', BOT_ACCOUNT_ID).in('status', ['active', 'paid']).order('created_at', { ascending: false }).limit(15);
  if (!rawOrders?.length) { await sendMsg(chatId, '❌ Không có đơn để gán.'); return; }
  const customerMap = await loadTelegramCustomerMap([...new Set(rawOrders.map(o => o.customer_id).filter((id): id is string => Boolean(id)))], 'id, full_name');
  const orders = attachTelegramOrderCustomers(rawOrders as TelegramOrderBaseRow[], customerMap);
  const kb: TelegramButton[][] = orders.map(o => { const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as any; return [{ text: `📦 ${o.order_code} | ${c?.full_name ?? 'N/A'}`, callback_data: `alloc:order:${o.id}` }]; });
  kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);
  await sendKb(chatId, [
    `🔗 <b>GÁN KHO HÀNG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📦 Chọn đơn cần gán kho (${orders.length} đơn):`,
  ].join('\n'), kb);
}

async function handleAllocateCallback(chatId: number, data: string) {
  const parts = data.split(':');
  if (parts[1] === 'order') {
    const { data: accs } = await supabaseAdmin.from('source_accounts')
      .select('id, email, max_slots, used_slots')
      .eq('account_id', BOT_ACCOUNT_ID)
      .is('deleted_at', null)
      .limit(15);
    const avail = (accs ?? []).filter(a => a.used_slots < a.max_slots);
    if (!avail.length) { await sendMsg(chatId, '❌ Không có kho trống.'); return; }
    const kb: TelegramButton[][] = avail.map(a => [{ text: `📧 ${a.email.length > 22 ? a.email.slice(0, 20) + '..' : a.email} (✅${a.max_slots - a.used_slots}/${a.max_slots})`, callback_data: `alloc:assign:${parts[2]}:${a.id}` }]);
    kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);
    await sendKb(chatId, `🔗 Chọn kho (${avail.length} còn trống):`, kb);
  } else if (parts[1] === 'assign') {
    try {
      const [{ data: orderRow }, { data: targetAccount }] = await Promise.all([
        supabaseAdmin.from('orders')
          .select('order_code')
          .eq('account_id', BOT_ACCOUNT_ID)
          .eq('id', parts[2])
          .maybeSingle(),
        supabaseAdmin.from('source_accounts')
          .select('id')
          .eq('account_id', BOT_ACCOUNT_ID)
          .eq('id', parts[3])
          .is('deleted_at', null)
          .maybeSingle(),
      ]);
      if (!orderRow || !targetAccount) {
        await sendMsg(chatId, 'Order or warehouse account not found in current tenant.');
        return;
      }
      // Gán kho cho TẤT CẢ order_items chưa được gán (không chỉ item đầu tiên)
      const { data: items } = await supabaseAdmin.from('order_items')
        .select('id').eq('order_id', parts[2])
        .is('assigned_source_account_id', null);
      if (items?.length) {
        await supabaseAdmin.from('order_items')
          .update({ assigned_source_account_id: parts[3] })
          .in('id', items.map(i => i.id));
      }
      const assignedCount = items?.length ?? 0;
      const oc = orderRow?.order_code;
      await sendKb(chatId, `✅ Gán kho thành công! (Đã gán ${assignedCount} items)`, [
        oc ? [{ text: '📋 Chi tiết đơn', callback_data: `detail:${oc}` }, { text: '🔗 Gán tiếp', callback_data: 'cmd:allocate' }] : [{ text: '🔗 Gán tiếp', callback_data: 'cmd:allocate' }],
        [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]);
    } catch (e) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`); }
  }
}

// ─── Wizard: New Task (5 bước chi tiết) ─────────────────────

async function handleNewTaskStart(chatId: number) {
  setSession(chatId, 'newtask', 0, {});
  await sendKb(chatId, [
    `📌 <b>TẠO TASK / LỊCH HẸN MỚI</b>  ${progressBar(1, 5)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Bước 1/5:</b> Chọn loại task`,
    ``,
    `👇 Bấm chọn loại:`,
    `💡 Gõ <code>/cancel</code> để hủy`,
  ].join('\n'), [
    [{ text: '🔄 Gia hạn (renewal)', callback_data: 'task:type:renewal' }],
    [{ text: '💳 Thu nợ (debt)', callback_data: 'task:type:debt' }],
    [{ text: '📞 Liên hệ KH (contact)', callback_data: 'task:type:contact' }],
    [{ text: '📌 Chung (general)', callback_data: 'task:type:general' }],
    [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
  ]);
}

/** Parse Vietnamese date format dd/mm/yyyy or yyyy-mm-dd */
function parseVietnameseDate(input: string): Date | null {
  const vnMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vnMatch) {
    const [, dd, mm, yyyy] = vnMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 9, 0, 0);
    if (!isNaN(d.getTime()) && d.getDate() === Number(dd)) return d;
  }
  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 9, 0, 0);
    if (!isNaN(d.getTime()) && d.getDate() === Number(dd)) return d;
  }
  return null;
}

async function handleNewTaskCallback(chatId: number, data: string) {
  const parts = data.split(':');
  const session = getSession(chatId);

  // Step 1: Type selected → ask title
  if (parts[1] === 'type') {
    const taskType = parts[2];
    const typeIcon: Record<string, string> = { renewal: '🔄', debt: '💳', contact: '📞', general: '📌' };
    setSession(chatId, 'newtask', 1, { taskType });
    await sendMsg(chatId, [
      `${typeIcon[taskType] ?? '📌'} Loại: <b>${escapeHtml(taskType)}</b>`,
      ``,
      `📌 <b>Bước 2/5:</b> Nhập tiêu đề task`,
      `<i>Ví dụ: Gia hạn cho Nguyễn Văn A</i>`,
      `<i>Hoặc: Nhắc thanh toán đơn ORD-2603-001</i>`,
    ].join('\n'));
    return;
  }

  // Step 3: Customer link
  if (parts[1] === 'linkcust') {
    if (!session) return;
    const custId = parts[2];
    const { data: cust } = await supabaseAdmin.from('customers').select('full_name').eq('id', custId).single();
    setSession(chatId, 'newtask', 3, { ...session.data, linkedCustomerId: custId, linkedCustomerName: cust?.full_name ?? 'N/A' });
    await sendMsg(chatId, [
      `✅ Liên kết KH: <b>${escapeHtml(cust?.full_name ?? 'N/A')}</b>`,
      ``,
      `📌 <b>Bước 4/5:</b> Nhập ghi chú`,
      `<i>Gõ ghi chú hoặc</i> <code>skip</code> <i>để bỏ qua</i>`,
      `<i>Ví dụ: KH hẹn thanh toán cuối tuần</i>`,
    ].join('\n'));
    return;
  }

  if (parts[1] === 'skipcust') {
    if (!session) return;
    setSession(chatId, 'newtask', 3, session.data);
    await sendMsg(chatId, [
      `⏭ Bỏ qua liên kết KH`,
      ``,
      `📌 <b>Bước 4/5:</b> Nhập ghi chú`,
      `<i>Gõ ghi chú hoặc</i> <code>skip</code> <i>để bỏ qua</i>`,
    ].join('\n'));
    return;
  }

  // Date selection
  if (parts[1] === 'date') {
    const d: Record<string, any> = { ...session?.data };
    const dateChoice = parts[2];

    if (dateChoice === 'custom') {
      setSession(chatId, 'newtask', 5, d);
      await sendMsg(chatId, [
        `📝 <b>Nhập ngày hẹn:</b>`,
        ``, `Định dạng: <code>dd/mm/yyyy</code>`,
        `<i>Ví dụ: 25/03/2026</i>`,
      ].join('\n'));
      return;
    }

    const now = new Date();
    let dueDate: Date;
    switch (dateChoice) {
      case 'today': dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0); break;
      case 'tomorrow': dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0); break;
      case 'in3days': dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 9, 0, 0); break;
      case 'in5days': dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 9, 0, 0); break;
      case 'nextweek': dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9, 0, 0); break;
      case 'in2weeks': dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 9, 0, 0); break;
      case 'nextmonth': dueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 9, 0, 0); break;
      case 'weekend': {
        // Next Saturday
        const daysToSat = (6 - now.getDay() + 7) % 7 || 7;
        dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSat, 9, 0, 0);
        break;
      }
      case 'endmonth': dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 9, 0, 0); break;
      default: dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    }
    await createTaskAndNotify(chatId, d, dueDate);
    return;
  }
}

/** Create task in DB and send confirmation to Telegram */
async function createTaskAndNotify(chatId: number, d: Record<string, any>, dueDate: Date) {
  await sendMsg(chatId, '⏳ Đang tạo task...');
  try {
    const taskNotes = d.taskNotes && d.taskNotes !== 'skip' ? d.taskNotes : null;
    const insertData: Record<string, any> = {
      account_id: BOT_ACCOUNT_ID,
      title: d.taskTitle,
      type: d.taskType,
      due_at: dueDate.toISOString(),
      is_done: false,
      has_reminder: true,
      notes: taskNotes,
    };
    // Link customer if provided
    if (d.linkedCustomerId) insertData.customer_id = d.linkedCustomerId;

    const { data: _newTask, error } = await supabaseAdmin.from('reminder_events').insert(insertData).select('id, title, due_at, type').single();

    if (error) throw new Error(error.message || JSON.stringify(error));

    clearSession(chatId);
    const dueStr = formatDateCustom(dueDate, undefined, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const typeIcon = d.taskType === 'renewal' ? '🔄' : d.taskType === 'debt' ? '💳' : d.taskType === 'contact' ? '📞' : '📌';

    await sendKb(chatId, [
      `✅ <b>ĐÃ TẠO TASK!</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `${typeIcon} Loại: <b>${escapeHtml(d.taskType)}</b>`,
      `📋 Tiêu đề: <b>${escapeHtml(d.taskTitle)}</b>`,
      d.linkedCustomerName ? `👤 KH: <b>${escapeHtml(d.linkedCustomerName)}</b>` : '',
      `📅 Ngày hẹn: <b>${dueStr}</b>`,
      taskNotes ? `📝 Ghi chú: ${escapeHtml(taskNotes)}` : '',
      `🔔 Nhắc nhở: <b>✅ Bật</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Xem tasks: /tasks`,
    ].filter(Boolean).join('\n'), [
      [{ text: '📋 Tasks', callback_data: 'cmd:tasks' }, { text: '➕ Thêm task', callback_data: 'cmd:newtask' }],
      [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    await sendMsg(chatId, `❌ Lỗi tạo task: ${escapeHtml(msg)}`);
  }
}

async function handleNewTaskWizard(chatId: number, text: string, session: WizardSession) {
  const input = text.trim();

  // Step 1: Receive title → show customer link
  if (session.step === 1) {
    if (!input) { await sendMsg(chatId, '⚠️ Tiêu đề không được trống.'); return; }
    setSession(chatId, 'newtask', 2, { ...session.data, taskTitle: input });
    // Fetch recent customers for linking
    const { data: custs } = await supabaseAdmin.from('customers').select('id, full_name').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).order('full_name').limit(10);
    const kb: TelegramButton[][] = (custs ?? []).map(c => [{ text: `👤 ${c.full_name}`, callback_data: `task:linkcust:${c.id}` }]);
    kb.push([{ text: '⏭ Bỏ qua', callback_data: 'task:skipcust' }]);
    kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);
    await sendKb(chatId, [
      `✅ Tiêu đề: <b>${escapeHtml(input)}</b>`,
      ``,
      `📌 <b>Bước 3/5:</b> Liên kết khách hàng`,
      `<i>Chọn KH liên quan hoặc bỏ qua</i>`,
    ].join('\n'), kb);
    return;
  }

  // Step 3: Receive notes → show date picker
  if (session.step === 3) {
    const d = { ...session.data, taskNotes: input };
    setSession(chatId, 'newtask', 4, d);
    await sendKb(chatId, [
      input !== 'skip' ? `✅ Ghi chú: ${escapeHtml(input)}` : `⏭ Bỏ qua ghi chú`,
      ``, `📌 <b>Bước 5/5:</b> Chọn ngày hẹn`,
    ].join('\n'), [
      [{ text: '📅 Hôm nay', callback_data: 'task:date:today' }, { text: '📅 Ngày mai', callback_data: 'task:date:tomorrow' }],
      [{ text: '📅 3 ngày', callback_data: 'task:date:in3days' }, { text: '📅 5 ngày', callback_data: 'task:date:in5days' }],
      [{ text: '📅 Tuần sau', callback_data: 'task:date:nextweek' }, { text: '📅 2 tuần', callback_data: 'task:date:in2weeks' }],
      [{ text: '📅 Cuối tuần', callback_data: 'task:date:weekend' }, { text: '📅 Cuối tháng', callback_data: 'task:date:endmonth' }],
      [{ text: '📅 1 tháng', callback_data: 'task:date:nextmonth' }, { text: '📝 Nhập ngày', callback_data: 'task:date:custom' }],
    ]);
    return;
  }

  // Step 5: Receive custom date input (dd/mm/yyyy or yyyy-mm-dd)
  if (session.step === 5) {
    const parsed = parseVietnameseDate(input);
    if (!parsed) {
      await sendMsg(chatId, [
        `❌ Sai định dạng ngày!`,
        ``, `Vui lòng nhập theo: <code>dd/mm/yyyy</code>`,
        `<i>Ví dụ: 25/03/2026</i>`,
      ].join('\n'));
      return;
    }
    await createTaskAndNotify(chatId, session.data, parsed);
    return;
  }
}

// ─── Wizard: New Product (3 bước) ───────────────────────────

async function handleNewProductStart(chatId: number) {
  setSession(chatId, 'newproduct', 1, {});
  await sendMsg(chatId, [
    `🏷 <b>TẠO SẢN PHẨM MỚI</b>  ${progressBar(1, 3)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Bước 1/3:</b> Nhập tên sản phẩm`,
    ``,
    `<i>Ví dụ: Duolingo Super 12 tháng</i>`,
    `<i>Hoặc: Netflix Premium 1 tháng</i>`,
    `💡 Gõ <code>/cancel</code> để hủy`,
  ].join('\n'));
}

async function handleNewProductCallback(chatId: number, data: string) {
  const parts = data.split(':');
  const session = getSession(chatId);
  if (!session) return;

  if (parts[1] === 'confirm') {
    const d = session.data; clearSession(chatId);
    try {
      await sendMsg(chatId, '⏳ Đang tạo sản phẩm...');
      const { data: prod, error } = await supabaseAdmin.from('products').insert({
        account_id: BOT_ACCOUNT_ID, name: d.productName, sell_price_vnd: d.price, buy_price_vnd: d.price, is_active: true,
      }).select('id, name, sell_price_vnd').single();
      if (error) throw error;
      await sendKb(chatId, [
        `✅ <b>ĐÃ TẠO SẢN PHẨM!</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏷 Tên: <b>${escapeHtml(prod.name)}</b>`,
        `💰 Giá: <b>${formatVnd(prod.sell_price_vnd)}</b>`,
        `✅ Trạng thái: Hoạt động`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Tạo đơn hàng: /neworder`,
      ].join('\n'), [
        [{ text: '📦 Tạo đơn ngay', callback_data: 'cmd:neworder' }, { text: '🏷 Thêm SP', callback_data: 'cmd:newproduct' }],
        [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]);
    } catch (e) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`); }
  }
}

async function handleNewProductWizard(chatId: number, text: string, session: WizardSession) {
  const input = text.trim();

  // Step 1: Receive product name
  if (session.step === 1) {
    if (!input || input.length < 2) { await sendMsg(chatId, '⚠️ Tên SP tối thiểu 2 ký tự.'); return; }
    setSession(chatId, 'newproduct', 2, { productName: input });
    await sendMsg(chatId, [
      `✅ Tên: <b>${escapeHtml(input)}</b>`,
      ``,
      `📌 <b>Bước 2/3:</b> Nhập giá (VNĐ)`,
      `<i>Chỉ nhập số, không cần dấu chấm</i>`,
      `<i>Ví dụ: 150000 hoặc 1500000</i>`,
    ].join('\n'));
    return;
  }

  // Step 2: Receive price → show confirmation
  if (session.step === 2) {
    const price = parseInt(input.replace(/[.,\s]/g, '')) || 0;
    if (price <= 0) { await sendMsg(chatId, '⚠️ Giá phải > 0. Nhập lại:'); return; }
    setSession(chatId, 'newproduct', 3, { ...session.data, price });
    await sendKb(chatId, [
      `📌 <b>Bước 3/3: XÁC NHẬN SẢN PHẨM</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏷 Tên: <b>${escapeHtml(session.data.productName)}</b>`,
      `💰 Giá: <b>${formatVnd(price)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ Bấm OK để tạo:`,
    ].join('\n'), [
      [{ text: '✅ Xác nhận tạo SP', callback_data: 'np:confirm' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
  }
}

// ─── Wizard: New Kho (5 bước) ───────────────────────────────

async function handleNewKhoStart(chatId: number) {
  setSession(chatId, 'newkho', 1, {});
  await sendMsg(chatId, [
    `📦 <b>TẠO KHO HÀNG MỚI</b>  ${progressBar(1, 5)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Bước 1/5:</b> Nhập email tài khoản kho`,
    ``,
    `<i>Ví dụ: premium_account@gmail.com</i>`,
    `💡 Gõ <code>/cancel</code> để hủy`,
  ].join('\n'));
}

async function handleNewKhoCallback(chatId: number, data: string) {
  const parts = data.split(':');
  const session = getSession(chatId);
  if (!session) return;

  // Product selected
  if (parts[1] === 'prod') {
    const productId = parts[2];
    const current = (session.data.productIds ?? []) as string[];
    const currentNames = (session.data.productNames ?? []) as string[];
    const { data: prod } = await supabaseAdmin.from('products')
      .select('name')
      .eq('account_id', BOT_ACCOUNT_ID)
      .eq('id', productId).single();
    if (!prod) { await sendMsg(chatId, 'Product not found.'); return; }
    current.push(productId);
    currentNames.push(prod?.name ?? 'N/A');
    setSession(chatId, 'newkho', 2, { ...session.data, productIds: current, productNames: currentNames });
    await sendKb(chatId, [
      `✅ Đã thêm: <b>${escapeHtml(prod?.name ?? 'N/A')}</b>`,
      `📦 SP đã chọn (${current.length}): ${currentNames.map(n => escapeHtml(n)).join(', ')}`,
      ``,
      `👇 Thêm SP khác hoặc tiếp tục:`,
    ].join('\n'), [
      [{ text: '⏭ Tiếp → Max slots', callback_data: 'nk:doneprod' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Done selecting products → ask max slots
  if (parts[1] === 'doneprod') {
    setSession(chatId, 'newkho', 3, session.data);
    await sendMsg(chatId, [
      `📌 <b>Bước 3/5:</b> Nhập số slot tối đa`,
      `<i>Ví dụ: 5 hoặc 6</i>`,
    ].join('\n'));
    return;
  }

  // Expiry date quick-select
  if (parts[1] === 'exp') {
    const choice = parts[2];
    const now = new Date();
    let expiresAt: string | null = null;
    switch (choice) {
      case '1m': expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString(); break;
      case '3m': expiresAt = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString(); break;
      case '6m': expiresAt = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()).toISOString(); break;
      case '1y': expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString(); break;
      case 'none': expiresAt = null; break;
    }
    const d = { ...session.data, expiresAt };
    setSession(chatId, 'newkho', 5, d);
    await showKhoConfirmation(chatId, d);
    return;
  }

  if (parts[1] === 'confirm') {
    const d = session.data; clearSession(chatId);
    try {
      await sendMsg(chatId, '⏳ Đang tạo kho hàng...');
      const insertData: Record<string, any> = {
        account_id: BOT_ACCOUNT_ID, email: d.khoEmail, max_slots: d.maxSlots, used_slots: 0,
        product_ids: d.productIds ?? [],
      };
      if (d.expiresAt) insertData.expires_at = d.expiresAt;
      const { data: kho, error } = await supabaseAdmin.from('source_accounts').insert(insertData).select('id, email, max_slots').single();
      if (error) throw error;
      const prodStr = (d.productNames ?? []).map((n: string) => escapeHtml(n)).join(', ') || 'Chưa gán';
      await sendKb(chatId, [
        `✅ <b>ĐÃ TẠO KHO HÀNG!</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📧 Email: <code>${escapeHtml(kho.email ?? '')}</code>`,
        `🔗 Slots: <b>${kho.max_slots}</b>`,
        `📦 SP: ${prodStr}`,
        d.expiresAt ? `📅 Hạn: <b>${formatDate(d.expiresAt)}</b>` : '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Gán kho: /allocate | Xem kho: /warehouse`,
      ].filter(Boolean).join('\n'), [
        [{ text: '🔗 Gán kho ngay', callback_data: 'cmd:allocate' }, { text: '📦 Thêm kho', callback_data: 'cmd:newkho' }],
        [{ text: '📦 Kho hàng', callback_data: 'kho:stats' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]);
    } catch (e) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`); }
  }
}

async function handleNewKhoWizard(chatId: number, text: string, session: WizardSession) {
  const input = text.trim();

  // Step 1: Receive email
  if (session.step === 1) {
    if (!input || !input.includes('@')) { await sendMsg(chatId, '⚠️ Email không hợp lệ. Nhập lại:'); return; }
    // Check duplicate
    const { data: existing } = await supabaseAdmin.from('source_accounts')
      .select('id')
      .eq('account_id', BOT_ACCOUNT_ID)
      .eq('email', input)
      .is('deleted_at', null)
      .limit(1);
    if (existing?.length) { await sendMsg(chatId, `⚠️ Email <code>${escapeHtml(input)}</code> đã tồn tại! Nhập email khác:`); return; }
    setSession(chatId, 'newkho', 2, { khoEmail: input });
    // Show product selection
    const { data: prods } = await supabaseAdmin.from('products').select('id, name').eq('account_id', BOT_ACCOUNT_ID).eq('is_active', true).is('deleted_at', null).order('name').limit(15);
    if (!prods?.length) {
      setSession(chatId, 'newkho', 3, { khoEmail: input, productIds: [], productNames: [] });
      await sendMsg(chatId, [
        `✅ Email: <code>${escapeHtml(input)}</code>`,
        `⚠️ Chưa có SP nào. Bỏ qua bước chọn SP.`,
        ``,
        `📌 <b>Bước 3/5:</b> Nhập số slot tối đa`,
        `<i>Ví dụ: 5 hoặc 6</i>`,
      ].join('\n'));
      return;
    }
    const kb: TelegramButton[][] = prods.map(p => [{ text: `📦 ${p.name}`, callback_data: `nk:prod:${p.id}` }]);
    kb.push([{ text: '⏭ Bỏ qua → Max slots', callback_data: 'nk:doneprod' }]);
    kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);
    await sendKb(chatId, [
      `✅ Email: <code>${escapeHtml(input)}</code>`,
      ``,
      `📌 <b>Bước 2/5:</b> Chọn sản phẩm gán cho kho`,
      `<i>Bấm SP để thêm (có thể chọn nhiều)</i>`,
    ].join('\n'), kb);
    return;
  }

  // Step 3: Receive max slots
  if (session.step === 3) {
    const maxSlots = parseInt(input) || 0;
    if (maxSlots < 1 || maxSlots > 100) { await sendMsg(chatId, '⚠️ Số slot phải từ 1–100.'); return; }
    setSession(chatId, 'newkho', 4, { ...session.data, maxSlots });
    await sendKb(chatId, [
      `✅ Max slots: <b>${maxSlots}</b>`,
      ``,
      `📌 <b>Bước 4/5:</b> Ngày hết hạn kho`,
      `<i>Chọn nhanh hoặc nhập dd/mm/yyyy</i>`,
    ].join('\n'), [
      [{ text: '📅 1 tháng', callback_data: 'nk:exp:1m' }, { text: '📅 3 tháng', callback_data: 'nk:exp:3m' }],
      [{ text: '📅 6 tháng', callback_data: 'nk:exp:6m' }, { text: '📅 1 năm', callback_data: 'nk:exp:1y' }],
      [{ text: '⏭ Không hạn', callback_data: 'nk:exp:none' }],
    ]);
    return;
  }

  // Step 4: Receive custom date → show confirm (for typed date input)
  if (session.step === 4) {
    const parsed = parseVietnameseDate(input);
    if (!parsed) { await sendMsg(chatId, '❌ Sai định dạng. Nhập: <code>dd/mm/yyyy</code>'); return; }
    const d = { ...session.data, expiresAt: parsed.toISOString() };
    setSession(chatId, 'newkho', 5, d);
    await showKhoConfirmation(chatId, d);
  }
}

/** Helper: Show kho confirmation summary */
async function showKhoConfirmation(chatId: number, d: Record<string, any>) {
  const prodStr = (d.productNames ?? []).map((n: string) => escapeHtml(n)).join(', ') || 'Chưa gán';
  await sendKb(chatId, [
    `📌 <b>Bước 5/5: XÁC NHẬN KHO HÀNG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📧 Email: <code>${escapeHtml(d.khoEmail)}</code>`,
    `📦 SP: ${prodStr}`,
    `🔗 Max slots: <b>${d.maxSlots}</b>`,
    d.expiresAt ? `📅 Hạn: <b>${formatDate(d.expiresAt)}</b>` : `📅 Hạn: <i>Không hạn</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ Bấm OK để tạo:`,
  ].join('\n'), [
    [{ text: '✅ Xác nhận tạo kho', callback_data: 'nk:confirm' }],
    [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
  ]);
}

// ─── Edit & Delete Customer Handlers ────────────────────────

async function handleEditCustomer(chatId: number, custId: string) {
  const { data: cust } = await supabaseAdmin.from('customers')
    .select('id, full_name, type, notes').eq('id', custId).eq('account_id', BOT_ACCOUNT_ID)
    .is('deleted_at', null).single();
  if (!cust) { await sendMsg(chatId, '❌ Không tìm thấy khách hàng.'); return; }
  const typeLabels: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
  setSession(chatId, 'editcustomer', 0, { custId: cust.id, current: cust });
  await sendKb(chatId, [
    `✏️ <b>SỬA KHÁCH HÀNG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 Tên: <b>${escapeHtml(cust.full_name)}</b>`,
    `🏷 Loại: ${typeLabels[cust.type] ?? cust.type}`,
    cust.notes ? `📝 Ghi chú: ${escapeHtml(String(cust.notes).slice(0, 100))}` : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Chọn mục cần sửa:`,
  ].filter(Boolean).join('\n'), [
    [{ text: '✏️ Đổi tên', callback_data: `ec:name:${custId}` }],
    [{ text: '🛒 Cá nhân', callback_data: `ec:type:${custId}:retail` }, { text: '🏭 Buôn sỉ', callback_data: `ec:type:${custId}:wholesale` }, { text: '🏢 Đại lý', callback_data: `ec:type:${custId}:agency` }],
    [{ text: '📝 Sửa ghi chú', callback_data: `ec:notes:${custId}` }],
    [{ text: '↩️ Quay lại', callback_data: `runcmd:customer ${custId}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

async function handleDeleteCustomer(chatId: number, custId: string) {
  const { data: cust } = await supabaseAdmin.from('customers')
    .select('id, full_name').eq('id', custId).eq('account_id', BOT_ACCOUNT_ID)
    .is('deleted_at', null).single();
  if (!cust) { await sendMsg(chatId, '❌ Không tìm thấy khách hàng.'); return; }
  // Check dependencies
  const { count: orderCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).eq('customer_id', custId);
  await sendKb(chatId, [
    `🗑 <b>XÓA KHÁCH HÀNG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>${escapeHtml(cust.full_name)}</b>`,
    orderCount ? `⚠️ KH này có <b>${orderCount}</b> đơn hàng liên quan!` : '',
    ``,
    `Bạn có chắc chắn muốn xóa?`,
    `<i>(Soft-delete — có thể khôi phục)</i>`,
  ].filter(Boolean).join('\n'), [
    [{ text: '⚠️ Xác nhận xóa', callback_data: `ec:delete:${custId}` }],
    [{ text: '↩️ Hủy', callback_data: `runcmd:customer ${custId}` }],
  ]);
}

// ─── Edit Customer Callbacks ────────────────────────────────

async function handleEditCustomerCallback(chatId: number, data: string) {
  const parts = data.split(':');
  // ec:type:custId:newType → instant update
  if (parts[1] === 'type') {
    const custId = parts[2], newType = parts[3];
    const typeLabels: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
    const { error } = await supabaseAdmin.from('customers').update({ type: newType, updated_at: new Date().toISOString() }).eq('id', custId).eq('account_id', BOT_ACCOUNT_ID);
    if (error) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(error.message)}`); return; }
    await sendMsg(chatId, `✅ Đã đổi loại KH thành: <b>${typeLabels[newType] ?? newType}</b>`);
    return await handleCustomerProfile(chatId, custId);
  }
  // ec:name:custId → set session for name input
  if (parts[1] === 'name') {
    const custId = parts[2];
    setSession(chatId, 'editcustomer', 1, { custId, field: 'name' });
    await sendMsg(chatId, `✏️ Nhập tên mới cho khách hàng:`);
    return;
  }
  // ec:notes:custId → set session for notes input
  if (parts[1] === 'notes') {
    const custId = parts[2];
    setSession(chatId, 'editcustomer', 1, { custId, field: 'notes' });
    await sendMsg(chatId, `📝 Nhập ghi chú mới (hoặc <code>clear</code> để xóa):`);
    return;
  }
  // ec:delete:custId → do soft delete
  if (parts[1] === 'delete') {
    const custId = parts[2];
    const { error } = await supabaseAdmin.from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', custId).eq('account_id', BOT_ACCOUNT_ID);
    if (error) { await sendMsg(chatId, `❌ Lỗi xóa: ${escapeHtml(error.message)}`); return; }
    await sendKb(chatId, `✅ Đã xóa khách hàng (soft-delete).`, [
      [{ text: '👤 DS Khách hàng', callback_data: 'cmd:customer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }
}

/** Handle text input for editcustomer session */
async function handleEditCustomerWizard(chatId: number, text: string, session: WizardSession) {
  const d = session.data;
  const custId = d.custId as string;
  const field = d.field as string;
  clearSession(chatId);

  if (field === 'name') {
    const newName = text.trim();
    if (!newName || newName.length < 2) { await sendMsg(chatId, '⚠️ Tên phải ít nhất 2 ký tự.'); return; }
    const { error } = await supabaseAdmin.from('customers')
      .update({ full_name: newName, updated_at: new Date().toISOString() })
      .eq('id', custId).eq('account_id', BOT_ACCOUNT_ID);
    if (error) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(error.message)}`); return; }
    await sendMsg(chatId, `✅ Đã đổi tên thành: <b>${escapeHtml(newName)}</b>`);
  } else if (field === 'notes') {
    const newNotes = text.trim().toLowerCase() === 'clear' ? null : text.trim().slice(0, 500);
    const { error } = await supabaseAdmin.from('customers')
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq('id', custId).eq('account_id', BOT_ACCOUNT_ID);
    if (error) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(error.message)}`); return; }
    await sendMsg(chatId, newNotes ? `✅ Đã cập nhật ghi chú.` : `✅ Đã xóa ghi chú.`);
  }
  return await handleCustomerProfile(chatId, custId);
}

// ─── Suggest Similar Commands ───────────────────────────────

async function suggestSimilarCommands(chatId: number, input: string) {
  const suggestions = findSimilarCommands(input);
  if (suggestions.length) {
    const kb: TelegramButton[][] = suggestions.map(s => [{ text: s.cmd, callback_data: `runcmd:${s.cmd.slice(1)}` }]);
    kb.push([{ text: '❓ Help', callback_data: 'cmd:help_detail' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
    await sendKb(chatId, `❓ <code>${escapeHtml(input)}</code> không hợp lệ.\n💡 Có phải bạn muốn:`, kb);
  } else {
    await sendKb(chatId, `❓ <code>${escapeHtml(input)}</code> không hợp lệ.\n💡 Gõ /help để xem danh sách.`, [
      [{ text: '❓ Help', callback_data: 'cmd:help_detail' }, { text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  }
}


// ─── /customer — Customer Profile ───────────────────────────

async function handleCustomerProfile(chatId: number, query: string, msgId?: number, page = 0) {
  // Safety: ensure BOT_ACCOUNT_ID is available
  if (!BOT_ACCOUNT_ID) {
    await sendMsg(chatId, '⚠️ BOT_ACCOUNT_ID chưa được cấu hình. Kiểm tra biến môi trường TELEGRAM_BOT_ACCOUNT_ID.');
    return;
  }

  if (!query) {
    const PAGE_SIZE = 10;
    const offset = page * PAGE_SIZE;
    try {
      // Get total count
      const { count: totalCount, error: countErr } = await supabaseAdmin.from('customers')
        .select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null);
      if (countErr) { await sendMsg(chatId, `❌ Lỗi count: ${escapeHtml(countErr.message)}`); return; }
      const total = totalCount ?? 0;
      // Get page of customers with contacts
      const { data: rawCusts, error: listErr } = await supabaseAdmin.from('customers')
        .select('id, full_name, type, created_at')
        .eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (listErr) { await sendMsg(chatId, `❌ Lỗi query: ${escapeHtml(listErr.message)}`); return; }
      if (!rawCusts?.length && page === 0) {
        await sendKb(chatId, [
          `📭 Chưa có khách hàng.`,
          `💡 Bấm \u003cb\u003eTạo KH\u003c/b\u003e để thêm mới`,
        ].join('\n'), [
          [{ text: '➕ Tạo KH', callback_data: 'cmd:newcustomer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
        ]);
        return;
      }
      if (!rawCusts?.length) { await sendMsg(chatId, '📭 Không còn khách hàng nào.'); return; }
      const custContactMap = await loadTelegramCustomerContacts((rawCusts ?? []).map((c: any) => c.id));
      const custs = attachTelegramCustomerContacts((rawCusts ?? []) as Array<{ id: string; full_name: string; type: string | null; created_at: string | null }>, custContactMap);

    const typeIcon: Record<string, string> = { retail: '🛒', wholesale: '🏭', agency: '🏢' };
    const channelEmoji: Record<string, string> = { phone: '📞', zalo: '💚', telegram: '💬', facebook: '📘', email: '📧' };

    const kb: TelegramButton[][] = custs.map((c: any) => {
      const contacts = (c.customer_contacts ?? []) as any[];
      // Find primary contact, fallback to first contact
      const primary = contacts[0];
      const contactStr = primary ? `${channelEmoji[primary.channel] ?? '📱'} ${primary.value}` : '';
      const dateStr = c.created_at ? formatTelegramDateOnly(c.created_at) : '';
      const icon = typeIcon[c.type] ?? '👤';
      return [{ text: `${icon} ${c.full_name}${contactStr ? ` | ${contactStr}` : ''}${dateStr ? ` · ${dateStr}` : ''}`, callback_data: `runcmd:customer ${c.id}` }];
    });

    // Pagination buttons
    const navRow: TelegramButton[] = [];
    if (page > 0) navRow.push({ text: `⬅️ Trang ${page}`, callback_data: `custpage:${page - 1}` });
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (page + 1 < totalPages) navRow.push({ text: `Trang ${page + 2} ➡️`, callback_data: `custpage:${page + 1}` });
    if (navRow.length) kb.push(navRow);

    kb.push([
      { text: '➕ Tạo KH', callback_data: 'cmd:newcustomer' },
      { text: '🔍 Tìm KH', callback_data: 'cmd:search_prompt' },
      { text: '🏠 Menu', callback_data: 'cmd:start' },
    ]);

    const pageInfo = totalPages > 1 ? ` | Trang ${page + 1}/${totalPages}` : '';
    await sendOrEdit(chatId, [
      `👤 <b>KHÁCH HÀNG</b> (${total})${pageInfo}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Chọn KH hoặc gõ: <code>/customer tên</code>`,
    ].join('\n'), kb, msgId);
    return;
    } catch (e) {
      await sendMsg(chatId, `❌ Lỗi tải KH: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
      return;
    }
  }

  // --- Search by UUID or name/contact ---
  let customers: any[] | null = null;
  if (query.match(/^[0-9a-f-]{36}$/i)) {
    const { data } = await supabaseAdmin.from('customers').select('*').eq('id', query).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null);
    customers = data;
  }
  if (!customers?.length) {
    // Vietnamese normalize helper for accent-insensitive search
    const vnNorm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
    const qNorm = vnNorm(query);
    const qWords = qNorm.split(/\s+/).filter(w => w.length > 0);

    // Fuzzy scoring - same engine as order wizard
    const scoreName = (name: string): number => {
      const nNorm = vnNorm(name);
      const nWords = nNorm.split(/\s+/);
      if (nNorm === qNorm) return 100;
      if (nNorm.includes(qNorm)) return 90;
      if (qWords.every(w => nNorm.includes(w))) return 80;
      const wordMatches = qWords.filter(w => nWords.some(nw => nw.includes(w) || w.includes(nw)));
      if (wordMatches.length > 0) return 40 + (wordMatches.length / qWords.length) * 30;
      const shared = [...new Set(qNorm)].filter(c => nNorm.includes(c)).length;
      const ratio = shared / Math.max(new Set(qNorm).size, 1);
      if (ratio > 0.6) return Math.round(ratio * 30);
      return 0;
    };

    // Fetch all and score
    const { data: allCusts } = await supabaseAdmin.from('customers')
      .select('*').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(200);
    const scored = (allCusts ?? []).map(c => ({ ...c, score: scoreName(c.full_name ?? '') }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);
    customers = scored.filter(c => c.score >= 40).slice(0, 10);

    // If no name match, try contact search
    if (!customers?.length) {
      const digits = query.replace(/\D/g, '');
      const variants = new Set<string>([query]);
      if (digits.length >= 9) {
        variants.add(digits);
        if (digits.startsWith('84')) variants.add(`0${digits.slice(2)}`);
        if (digits.startsWith('0')) variants.add(`84${digits.slice(1)}`);
      }

      const contactMatchResults = await Promise.all(
        Array.from(variants).slice(0, 3).map(v =>
          supabaseAdmin.from('customer_contacts')
            .select('customer_id, channel, value')
            .ilike('value', `%${v}%`)
            .limit(10)
        )
      );
      const contactMatches = contactMatchResults.flatMap(r => r.data ?? []);
      if (contactMatches?.length) {
        const contactCustomerMap = await loadTelegramCustomerMap(
          [...new Set(contactMatches.map((c: any) => c.customer_id))],
          'id, full_name, type, created_at, nicks_registry',
        );
        customers = [...contactCustomerMap.values()];
      }
    }

    // Show suggestions if no exact match
    if (!customers?.length) {
      const suggestions = scored.filter(c => c.score > 0 && c.score < 40).slice(0, 5);
      if (suggestions.length) { customers = suggestions; }
    }
  }
  if (!customers?.length) { await sendKb(chatId, `❌ Không tìm thấy KH: <code>${escapeHtml(query)}</code>`, [[{ text: '🏠 Menu', callback_data: 'cmd:start' }]]); return; }
  const customerIds = customers.map(c => c.id);
  const [contactsResult, ordersResult] = await Promise.all([
    supabaseAdmin.from('customer_contacts').select('customer_id, channel, value').in('customer_id', customerIds),
    supabaseAdmin.from('orders')
      .select('id, customer_id, order_code, status, total_amount_vnd, total_paid, product_name_snapshot, created_at')
      .eq('account_id', BOT_ACCOUNT_ID)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const contactsRows = (contactsResult.data ?? []) as Array<{ customer_id: string; channel: string; value: string }>;
  const allOrdersRows = (ordersResult.data ?? []) as Array<{
    id: string;
    customer_id: string;
    order_code: string;
    status: string;
    total_amount_vnd: number;
    total_paid: number;
    product_name_snapshot: string;
    created_at: string;
  }>;

  const contactsByCustomer = new Map<string, Array<{ channel: string; value: string }>>();
  for (const c of contactsRows) {
    const list = contactsByCustomer.get(c.customer_id) ?? [];
    list.push({ channel: c.channel, value: c.value });
    contactsByCustomer.set(c.customer_id, list);
  }

  const ordersByCustomer = new Map<string, typeof allOrdersRows>();
  const orderIdToCustomer = new Map<string, string>();
  for (const o of allOrdersRows) {
    const list = ordersByCustomer.get(o.customer_id) ?? [];
    list.push(o);
    ordersByCustomer.set(o.customer_id, list);
    orderIdToCustomer.set(o.id, o.customer_id);
  }

  const orderIdsForNickLookup = allOrdersRows.slice(0, 300).map(o => o.id);
  const { data: nickRows } = orderIdsForNickLookup.length
    ? await supabaseAdmin.from('order_items')
        .select('order_id, customer_nick_used')
        .in('order_id', orderIdsForNickLookup)
        .not('customer_nick_used', 'is', null)
        .limit(300)
    : { data: [] as Array<{ order_id: string; customer_nick_used: string }> };

  const nicksByCustomer = new Map<string, Set<string>>();
  for (const n of (nickRows ?? [])) {
    const customerId = orderIdToCustomer.get(n.order_id);
    if (!customerId || !n.customer_nick_used) continue;
    const set = nicksByCustomer.get(customerId) ?? new Set<string>();
    set.add(n.customer_nick_used);
    nicksByCustomer.set(customerId, set);
  }

  for (const cust of customers) {
    const customerOrders = ordersByCustomer.get(cust.id) ?? [];
    const totalOrders = customerOrders.length;
    const paidOrders = customerOrders.filter(o => o.status === 'paid').length;
    const activeOrders = customerOrders.filter(o => ['active', 'paid', 'pending_payment', 'provisioning'].includes(o.status)).length;
    const totalSpent = customerOrders.reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);
    const totalDebt = customerOrders.reduce((sum, order) => sum + (isDebtTrackedOrder(order) ? getOutstandingAmount(order) : 0), 0);
    const recentOrders = customerOrders.slice(0, 5);
    const nicks = [...(nicksByCustomer.get(cust.id) ?? new Set<string>())];
    const channelEmoji: Record<string, string> = { phone: '📞', telegram: '💬', email: '📧', zalo: '💚', facebook: '📘' };
    const typeLabelsProfile: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
    const contacts = contactsByCustomer.get(cust.id) ?? [];

    // A6: Customer tags
    const tags: string[] = [];
    if (totalSpent >= 1_000_000) tags.push('⭐ VIP');
    if (totalOrders >= 10) tags.push('🔥 Thường xuyên');
    if (totalDebt > 0) tags.push('🔴 Nợ');
    if (cust.type === 'wholesale' || cust.type === 'agency') tags.push('👑 Premium');
    if (totalOrders === 0) tags.push('🆕 Mới');

    // Last activity
    const lastOrder = recentOrders?.[0];
    const lastActivity = lastOrder
      ? `📅 Hoạt động: ${formatDate(lastOrder.created_at ?? '')} (${escapeHtml(lastOrder.order_code)})`
      : '📅 Chưa có đơn nào';

    const primaryContact = getPrimaryTelegramContact(contacts as Array<{ channel: string; value: string }>);
    const sections: string[] = [
      `👤 <b>HỒ SƠ KHÁCH HÀNG</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📛 <b>${escapeHtml(cust.full_name)}</b>${tags.length ? '  ' + tags.join(' ') : ''}`,
      primaryContact ? `${primaryContact.channel === 'zalo' ? '💚' : '📞'} <code>${escapeHtml(primaryContact.value)}</code>` : '',
      `🏷 ${typeLabelsProfile[cust.type] ?? cust.type ?? 'retail'}`,
      cust.notes ? `📝 ${escapeHtml(String(cust.notes).slice(0, 100))}` : '',
      lastActivity,
      ``,
      `📊 <b>THỐNG KÊ</b>`,
      `  📦 <b>${totalOrders}</b> đơn | 💳 <b>${paidOrders}</b> paid | 🟢 <b>${activeOrders}</b> active`,
      `  💰 Tổng chi: <b>${formatVnd(totalSpent)}</b>`,
      totalDebt > 0 ? `  🔴 Nợ: <b>${formatVnd(totalDebt)}</b>` : `  ✅ Không nợ`,
    ];
    if (contacts.length) {
      sections.push(``, `📧 <b>LIÊN HỆ:</b>`);
      for (const cc of contacts) sections.push(`  ${channelEmoji[cc.channel] ?? '📞'} ${escapeHtml(cc.channel)}: <code>${escapeHtml(cc.value)}</code>`);
    }
    if (nicks.length) sections.push(``, `🏷 <b>Nicks:</b> <code>${escapeHtml(nicks.join(', '))}</code>`);
    if (recentOrders?.length) {
      sections.push(``, `📦 <b>ĐƠN GẦN NHẤT:</b>`);
      for (const o of recentOrders) sections.push(`  ${getStatusEmoji(o.status)} <code>${escapeHtml(o.order_code)}</code> ${escapeHtml(o.product_name_snapshot ?? '')} ${formatVnd(o.total_amount_vnd)}`);
    }
    sections.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Quick actions with customer context
    const actionBtns: TelegramButton[][] = [
      [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '📝 Tạo task', callback_data: 'cmd:newtask' }],
    ];
    if (totalDebt > 0) {
      actionBtns.push([{ text: `💳 Thu nợ ${formatVnd(totalDebt)}`, callback_data: 'cmd:debt' }]);
    }
    if (recentOrders?.length) {
      actionBtns.push(recentOrders.slice(0, 2).map(o => ({
        text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}`,
      })));
    }
    actionBtns.push([{ text: '✏️ Sửa KH', callback_data: `editcust:${cust.id}` }, { text: '🗑 Xóa KH', callback_data: `delcust:${cust.id}` }]);
    actionBtns.push([{ text: '👤 DS Khách hàng', callback_data: 'cmd:customer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
    await sendOrEdit(chatId, sections.filter(Boolean).join('\n'), actionBtns, msgId);
  }
}

// ─── /debt — Debt Tracker ───────────────────────────────────

async function handleDebt(chatId: number, _msgId?: number, page = 0) {
  const { data: debtOrders } = await supabaseAdmin.from('orders')
    .select('id, order_code, status, total_amount_vnd, total_paid, payment_method, payment_terms, customer_id, product_name_snapshot')
    .eq('account_id', BOT_ACCOUNT_ID).not('status', 'in', '(draft,refunded)')
    .order('created_at', { ascending: false });
  if (!debtOrders?.length) {
    await sendKb(chatId, `✅ <b>Tuyệt vời!</b> Không có KH nào còn nợ! 🎉`, [
      [{ text: '📊 Dashboard', callback_data: 'cmd:stats' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]); return;
  }
  const customerMap = await loadTelegramCustomerMap(
    [...new Set(debtOrders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)))],
    'id, full_name',
  );
  const custDebt = new Map<string, { name: string; total: number; orders: number; items: string[] }>();
  for (const o of debtOrders) {
    const debt = getOutstandingAmount(o);
    if (!isDebtTrackedOrder(o) || debt <= 0) continue;
    const c = o.customer_id ? customerMap.get(o.customer_id) ?? null : null;
    const custId = o.customer_id ?? 'unknown';
    const existing = custDebt.get(custId) ?? { name: c?.full_name ?? 'N/A', total: 0, orders: 0, items: [] as string[] };
    existing.total += debt;
    existing.orders++;
    existing.items.push(`  • <code>${escapeHtml(o.order_code ?? '')}</code> | ${escapeHtml(o.product_name_snapshot ?? '')} | nợ <b>${formatVnd(debt)}</b>`);
    custDebt.set(custId, existing);
  }
  const total = custDebt.size;
  if (!total) { await sendKb(chatId, `✅ Không có khách nợ!`, [[{ text: '🏠 Menu', callback_data: 'cmd:start' }]]); return; }
  const sorted = [...custDebt.entries()].sort((a, b) => b[1].total - a[1].total);
  const grandTotal = sorted.reduce((s, [, v]) => s + v.total, 0);
  
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (!paginated.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  
  const lines: string[] = [
    `💳 <b>DANH SÁCH NỢ</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔴 Tổng nợ: <b>${formatVnd(grandTotal)}</b> | ${total} KH`,
    ``,
  ];
  for (let i = 0; i < paginated.length; i++) {
    const [, info] = paginated[i];
    lines.push(`${page * PAGE_SIZE + i + 1}. 👤 <b>${escapeHtml(info.name)}</b> | 💰 <b>${formatVnd(info.total)}</b> (${info.orders}đ)`);
  }
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trước', callback_data: `cmd:debt:page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `cmd:debt:page:${page + 1}` });

  // Quick-action buttons cho top 3 KH nợ nhiều nhất trong trang hiện tại
  const debtBtns: TelegramButton[][] = paginated.slice(0, 3).map(([custId, info]) => [
    { text: `👤 ${info.name.slice(0, 12)}`, callback_data: `runcmd:customer ${custId}` },
    { text: `💳 ${formatVnd(info.total)}`, callback_data: `runcmd:customer ${custId}` },
  ]);

  const btns = [
    ...debtBtns,
    navRow,
    [{ text: '📤 Export nợ', callback_data: 'runcmd:export debt' }, { text: '📝 Tạo task thu nợ', callback_data: 'cmd:newtask' }],
    [{ text: '📊 Dashboard', callback_data: 'cmd:stats' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  await sendKb(chatId, lines.join('\n'), btns);
}

// ─── /summary — Daily Summary Report ────────────────────────

async function handleSummary(chatId: number, _msgId?: number) {
  try {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const [todayOrders, yesterdayOrders, todayRev, yesterdayRev, todayCusts, yesterdayCusts, todayTasks, todayDoneTasks, todayKho, todayPaidOrders] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', yesterdayStart).lt('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null),
    supabaseAdmin.from('reminder_events').select('id', { count: 'exact', head: true }).gte('due_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).eq('is_done', false),
    supabaseAdmin.from('reminder_events').select('id', { count: 'exact', head: true }).gte('due_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).eq('is_done', true),
    supabaseAdmin.from('source_accounts').select('id', { count: 'exact', head: true }).eq('account_id', BOT_ACCOUNT_ID).gte('created_at', todayStart).is('deleted_at', null),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).eq('status', 'paid'),
  ]);
  const tRevToday = (todayRev.data ?? []).reduce((s: number, o: any) => s + (o.total_amount_vnd ?? 0), 0);
  const tRevYesterday = (yesterdayRev.data ?? []).reduce((s: number, o: any) => s + (o.total_amount_vnd ?? 0), 0);
  const tOrdToday = todayOrders.count ?? 0;
  const tOrdYesterday = yesterdayOrders.count ?? 0;
  const tCustToday = todayCusts.count ?? 0;
  const tCustYesterday = yesterdayCusts.count ?? 0;
  const compare = (today: number, yesterday: number): string => {
    if (yesterday === 0) return today > 0 ? '🆕' : '—';
    const pct = Math.round(((today - yesterday) / yesterday) * 100);
    return pct > 0 ? `📈 +${pct}%` : pct < 0 ? `📉 ${pct}%` : '➡️ 0%';
  };
  const dateStr = formatDateCustom(now, undefined, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  await sendKb(chatId, [
    `📊 <b>BÁO CÁO NGÀY</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📅 ${dateStr}`,
    ``,
    `💰 <b>DOANH THU</b>`,
    `  Hôm nay: <b>${formatVnd(tRevToday)}</b>  ${compare(tRevToday, tRevYesterday)}`,
    `  Hôm qua: ${formatVnd(tRevYesterday)}`,
    ``,
    `📦 <b>ĐƠN HÀNG</b>`,
    `  Tạo mới: <b>${tOrdToday}</b>  ${compare(tOrdToday, tOrdYesterday)}`,
    `  Đã TT: <b>${todayPaidOrders.count ?? 0}</b> | Hôm qua: ${tOrdYesterday}`,
    ``,
    `👥 <b>KHÁCH HÀNG</b>`,
    `  KH mới: <b>${tCustToday}</b>  ${compare(tCustToday, tCustYesterday)}`,
    ``,
    `📋 <b>TASKS</b>`,
    `  ✅ Done: <b>${todayDoneTasks.count ?? 0}</b> | ⏳ Pending: <b>${todayTasks.count ?? 0}</b>`,
    ``,
    `📦 KHO mới: <b>${todayKho.count ?? 0}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n'), [
    [{ text: '📊 Stats', callback_data: 'cmd:stats' }, { text: '📦 Đơn', callback_data: 'orders:today' }, { text: '💳 Nợ', callback_data: 'cmd:debt' }],
    [{ text: '📋 Tasks', callback_data: 'cmd:tasks' }, { text: '📤 Export', callback_data: 'runcmd:export orders' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
  } catch (e) {
    await sendMsg(chatId, `❌ Lỗi tải báo cáo: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
  }
}

// ─── /products — Product Catalog ────────────────────────────

async function handleProducts(chatId: number, _msgId?: number, page = 0) {
  const { data: products } = await supabaseAdmin.from('products')
    .select('id, name, sell_price_vnd, is_active')
    .eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).order('name');
  const total = products?.length ?? 0;
  if (!total) {
    await sendKb(chatId, `📭 Chưa có SP.\n💡 /newproduct để tạo`, [
      [{ text: '🏷 Tạo SP', callback_data: 'cmd:newproduct' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]); return;
  }
  
  const paginated = products!.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (!paginated.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  
  const { data: orderItems } = await supabaseAdmin.from('order_items')
    .select('product_id').in('product_id', paginated.map(p => p.id));
  const ocMap = new Map<string, number>();
  for (const oi of orderItems ?? []) ocMap.set(oi.product_id, (ocMap.get(oi.product_id) ?? 0) + 1);
  
  // Count available slots per product (exclude expired kho)
  const { data: khoAccounts } = await supabaseAdmin.from('source_accounts')
    .select('product_ids, max_slots, used_slots, expires_at').eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null);
  const kcMap = new Map<string, number>(); // total kho count
  const slotMap = new Map<string, number>(); // free slots
  for (const sa of khoAccounts ?? []) {
    const expired = sa.expires_at && new Date(sa.expires_at) < new Date();
    for (const pid of (sa.product_ids ?? []) as string[]) {
      kcMap.set(pid, (kcMap.get(pid) ?? 0) + 1);
      if (!expired) {
        const free = sa.max_slots - sa.used_slots;
        if (free > 0) slotMap.set(pid, (slotMap.get(pid) ?? 0) + free);
      }
    }
  }
  
  const lines = paginated.map((p, i) => {
    const orders = ocMap.get(p.id) ?? 0;
    const freeSlots = slotMap.get(p.id) ?? 0;
    const st = p.is_active ? '🟢' : '🔴';
    const slotBadge = freeSlots > 0 ? `🟢${freeSlots}slot` : '🔴hết';
    return `${page * PAGE_SIZE + i + 1}. ${st} <b>${escapeHtml(p.name)}</b> ${formatVnd(p.sell_price_vnd)} | 📦${orders}đơn | ${slotBadge}`;
  });
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trước', callback_data: `cmd:products:page:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `cmd:products:page:${page + 1}` });

  // Interactive buttons per product
  const prodBtns: TelegramButton[][] = paginated.slice(0, 5).map(p => {
    const slots = slotMap.get(p.id) ?? 0;
    const label = `📦 ${p.name.length > 15 ? p.name.slice(0, 13) + '..' : p.name} (${slots} slot)`;
    return [{ text: label, callback_data: `prodview:${p.id}` }];
  });
  
  await sendKb(chatId, [
    `🏷 <b>SẢN PHẨM</b> (${total})`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...lines,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n'), [
    ...prodBtns,
    navRow,
    [{ text: '🏷 Tạo SP', callback_data: 'cmd:newproduct' }, { text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }],
    [{ text: '📦 Kho hàng', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── Task Done Toggle ───────────────────────────────────────

async function handleTaskDoneToggle(chatId: number, data: string) {
  const taskId = data.replace('tdone:', '');
  try {
    const { data: task } = await supabaseAdmin.from('reminder_events')
      .select('id, title, is_done').eq('id', taskId).single();
    if (!task) { await sendMsg(chatId, '❌ Task không tồn tại.'); return; }
    const newStatus = !task.is_done;
    await supabaseAdmin.from('reminder_events').update({ is_done: newStatus }).eq('id', taskId);
    await sendKb(chatId, [
      `${newStatus ? '✅' : '🔄'} <b>${escapeHtml(task.title)}</b>`,
      newStatus ? `→ <b>HOÀN THÀNH</b> ✅` : `→ <b>CHƯA XONG</b> 🔄`,
    ].join('\n'), [
      [{ text: '📋 Xem tasks', callback_data: 'cmd:tasks' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (e) { await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`); }
}

// ─── /search — Advanced Search Engine ───────────────────────

async function handleAdvancedSearch(chatId: number, query: string) {
  if (!query) {
    await sendKb(chatId, [
      `🔍 <b>TÌM KIẾM CHUYÊN SÂU</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📝 <b>Cú pháp:</b>`,
      `  <code>/search [filter] [keyword]</code>`,
      ``,
      `🏷 <b>Filter trạng thái:</b>`,
      `  <code>status:active</code> — đơn đang hoạt động`,
      `  <code>status:pending_payment</code> — chờ thanh toán`,
      `  <code>status:paid</code> — đã ghi nhận thanh toán`,
      `  <code>status:expired</code> — đơn hết hạn`,
      ``,
      `💳 <b>Filter tài chính:</b>`,
      `  <code>payment_state:unpaid</code> — chưa thanh toán`,
      `  <code>payment_state:partial</code> — còn nợ`,
      `  <code>payment_state:paid</code> — đã đủ tiền`,
      ``,
      `📅 <b>Lọc theo ngày:</b>`,
      `  <code>today</code> — đơn hôm nay`,
      `  <code>7d</code> — 7 ngày qua`,
      `  <code>30d</code> — 30 ngày qua`,
      ``,
      `💰 <b>Lọc theo tiền:</b>`,
      `  <code>>500k</code> — trên 500.000đ`,
      `  <code><1m</code> — dưới 1 triệu`,
      ``,
      `💡 <b>Ví dụ:</b>`,
      `  <code>/search status:active hoang</code>`,
      `  <code>/search payment_state:unpaid 7d</code>`,
      `  <code>/search >500k</code>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n'), [
      [{ text: '🟢 Active', callback_data: 'sf:status:active' }, { text: '🟠 Chờ TT', callback_data: 'sf:status:pending_payment' }],
      [{ text: '🟡 Chưa TT', callback_data: 'sf:payment_state:unpaid' }, { text: '🟠 Còn nợ', callback_data: 'sf:payment_state:partial' }],
      [{ text: '📅 Hôm nay', callback_data: 'sf:today' }, { text: '📅 7 ngày', callback_data: 'sf:7d' }],
      [{ text: '📅 30 ngày', callback_data: 'sf:30d' }, { text: '🔍 Tìm nhanh', callback_data: 'cmd:search_prompt' }],
      [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }


  // Parse filters from query
  const tokens = query.split(/\s+/);
  let statusFilter: string | null = null;
  let paymentStateFilter: string | null = null;
  let dateFilter: string | null = null;
  let amountGt: number | null = null;
  let amountLt: number | null = null;
  const keywords: string[] = [];

  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (tl.startsWith('status:')) {
      const mapped = mapLegacyStatusAlias(tl.slice('status:'.length));
      if (mapped.status) statusFilter = mapped.status;
      if (mapped.paymentState) paymentStateFilter = mapped.paymentState;
    } else if (tl.startsWith('payment_state:')) {
      const raw = tl.slice('payment_state:'.length);
      if ((PAYMENT_STATE_VALUES as readonly string[]).includes(raw)) paymentStateFilter = raw;
    } else if (TELEGRAM_SEARCHABLE_ORDER_STATUSES.has(tl)) {
      statusFilter = tl;
    } else if (mapLegacyStatusAlias(tl).paymentState) {
      paymentStateFilter = mapLegacyStatusAlias(tl).paymentState ?? null;
    } else if (['today', '7d', '30d', '90d'].includes(tl)) {
      dateFilter = tl;
    } else if (tl.match(/^>[0-9]+[km]?$/)) {
      const raw = tl.slice(1).replace('k', '000').replace('m', '000000');
      amountGt = parseInt(raw) || null;
    } else if (tl.match(/^<[0-9]+[km]?$/)) {
      const raw = tl.slice(1).replace('k', '000').replace('m', '000000');
      amountLt = parseInt(raw) || null;
    } else {
      keywords.push(tl);
    }
  }

  // Build Supabase query
  let q = supabaseAdmin.from('orders')
    .select('id, customer_id, product_id, order_code, status, total_amount_vnd, total_paid, payment_method, payment_terms, product_name_snapshot, created_at')
    .eq('account_id', BOT_ACCOUNT_ID);

  if (statusFilter) q = q.eq('status', statusFilter);
  if (dateFilter) {
    const now = new Date();
    let since: Date;
    switch (dateFilter) {
      case 'today': since = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case '7d': since = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': since = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': since = new Date(now.getTime() - 90 * 86400000); break;
      default: since = new Date(now.getTime() - 30 * 86400000);
    }
    q = q.gte('created_at', since.toISOString());
  }
  if (amountGt) q = q.gte('total_amount_vnd', amountGt);
  if (amountLt) q = q.lte('total_amount_vnd', amountLt);
  if (keywords.length) {
    // Sanitize keywords: strip SQL wildcards and special PostgREST chars
    const kw = keywords.join(' ').replace(/[%_,()]/g, '');
    if (kw) q = q.or(`order_code.ilike.%${kw}%,product_name_snapshot.ilike.%${kw}%`);
  }

  const { data: rawResults } = await q.order('created_at', { ascending: false }).limit(60);
  const customerMap = await loadTelegramCustomerMap(
    [...new Set((rawResults ?? []).map((order) => order.customer_id).filter((id): id is string => Boolean(id)))],
    'id, full_name',
  );
  const results = attachTelegramOrderCustomers((rawResults ?? []) as TelegramOrderBaseRow[], customerMap)
    .filter((order) => !paymentStateFilter || buildFinancialSummary(order).payment_state === paymentStateFilter)
    .slice(0, 20);

  if (!results?.length) {
    const filterDesc = [
      statusFilter ? `trạng thái: ${statusFilter}` : '',
      paymentStateFilter ? `payment_state: ${paymentStateFilter}` : '',
      dateFilter ? `thời gian: ${dateFilter}` : '',
      amountGt ? `> ${formatVnd(amountGt)}` : '',
      amountLt ? `< ${formatVnd(amountLt)}` : '',
      keywords.length ? `keyword: ${keywords.join(' ')}` : '',
    ].filter(Boolean).join(', ');
    await sendKb(chatId, `❌ Không tìm thấy đơn hàng\n🔎 Filter: <i>${escapeHtml(filterDesc || 'không có')}</i>`, [
      [{ text: '🔍 Thử lại', callback_data: 'cmd:search' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const totalAmount = results.reduce((s, o) => s + (o.total_amount_vnd ?? 0), 0);

  const lines: string[] = [
    `🔍 <b>KẾT QUẢ TÌM KIẾM</b> (${results.length})`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  // Show active filters
  const activeFilters: string[] = [];
  if (statusFilter) activeFilters.push(`📌 ${statusFilter}`);
  if (paymentStateFilter) activeFilters.push(`💳 ${paymentStateFilter}`);
  if (dateFilter) activeFilters.push(`📅 ${dateFilter}`);
  if (amountGt) activeFilters.push(`💰 >${formatVnd(amountGt)}`);
  if (amountLt) activeFilters.push(`💰 <${formatVnd(amountLt)}`);
  if (keywords.length) activeFilters.push(`🔤 ${keywords.join(' ')}`);
  if (activeFilters.length) lines.push(`Filter: ${activeFilters.join(' | ')}`, ``);

  lines.push(`💰 Tổng: <b>${formatVnd(totalAmount)}</b>`, ``);

  for (const o of results.slice(0, 15)) {
    const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as any;
    const debt = getOutstandingAmount(o);
    lines.push(
      `${getStatusEmoji(o.status)} <b>${escapeHtml(o.order_code ?? '')}</b> | ${escapeHtml(o.product_name_snapshot ?? '')}`,
      `  👤 ${escapeHtml(c?.full_name ?? 'N/A')} | ${formatVnd(o.total_amount_vnd ?? 0)}${debt > 0 ? ` | 🔴 nợ ${formatVnd(debt)}` : ''}`,
    );
  }
  if (results.length > 15) lines.push(``, `... và ${results.length - 15} đơn nữa`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const kb: TelegramButton[][] = results.slice(0, 5).map(o => [
    { text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` },
  ]);
  kb.push(
    [{ text: '🟢 Active', callback_data: 'sf:status:active' }, { text: '🟠 Chờ TT', callback_data: 'sf:status:pending_payment' }, { text: '🟡 Chưa TT', callback_data: 'sf:payment_state:unpaid' }],
    [{ text: '🔍 Tìm mới', callback_data: 'cmd:search' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  );

  await sendKb(chatId, lines.join('\n'), kb);
}

// ─── Search Filter Callback ────────────────────────────────

async function handleSearchFilter(chatId: number, data: string) {
  const filter = data.replace('sf:', '');
  return await handleAdvancedSearch(chatId, filter);
}

// ─── /active_accounts — Active Kho Accounts ────────────────

async function handleActiveAccounts(chatId: number, msgId?: number, page = 0) {

  // Get total count first
  const { count: totalCount } = await supabaseAdmin.from('source_accounts')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('account_id', BOT_ACCOUNT_ID);
  const total = totalCount ?? 0;

  if (total === 0) {
    await sendKb(chatId, `📭 Chưa có tài khoản kho nào.`, [
      [{ text: '📦 Tạo kho', callback_data: 'cmd:newkho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const from = safePage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: accounts } = await supabaseAdmin.from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, product_ids, created_at')
    .is('deleted_at', null)
    .eq('account_id', BOT_ACCOUNT_ID)
    .order('expires_at', { ascending: true })
    .range(from, to);

  if (!accounts?.length) {
    await sendKb(chatId, `📭 Không có dữ liệu trang ${safePage + 1}.`, [
      [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  // Get product names for mapping
  const allPids = [...new Set(accounts.flatMap(a => (a.product_ids ?? []) as string[]))];
  const { data: prods } = allPids.length
    ? await supabaseAdmin.from('products').select('id, name').eq('account_id', BOT_ACCOUNT_ID).in('id', allPids)
    : { data: [] };
  const prodMap = new Map((prods ?? []).map(p => [p.id, p.name]));

  // Categorize
  const active30plus: typeof accounts = [];
  const active7to30: typeof accounts = [];
  const active0to7: typeof accounts = [];
  const noExpiry: typeof accounts = [];
  const expired: typeof accounts = [];

  for (const acc of accounts) {
    if (!acc.expires_at) {
      noExpiry.push(acc);
    } else {
      const d = daysUntil(acc.expires_at);
      if (d < 0) expired.push(acc);
      else if (d <= 7) active0to7.push(acc);
      else if (d <= 30) active7to30.push(acc);
      else active30plus.push(acc);
    }
  }

  // Stats for current page context
  const totalSlots = accounts.reduce((s, a) => s + (a.max_slots ?? 0), 0);
  const usedSlots = accounts.reduce((s, a) => s + (a.used_slots ?? 0), 0);
  const freeSlots = totalSlots - usedSlots;
  const totalActive = active30plus.length + active7to30.length + active0to7.length + noExpiry.length;

  const lines: string[] = [
    `🟢 <b>TÀI KHOẢN KHO</b>  📄 Trang ${safePage + 1}/${totalPages} (${total} TK)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 Trang này: <b>${accounts.length}</b> | Còn hạn: <b>${totalActive}</b> | Hết hạn: <b>${expired.length}</b>`,
    `🔗 Slots: <b>${usedSlots}/${totalSlots}</b> | Trống: <b>${freeSlots}</b>`,
    ``,
  ];

  const renderGroup = (title: string, emoji: string, group: typeof accounts) => {
    if (!group.length) return;
    lines.push(`${emoji} <b>${title}</b> (${group.length})`);
    for (const acc of group) {
      const free = (acc.max_slots ?? 0) - (acc.used_slots ?? 0);
      const prodNames = ((acc.product_ids ?? []) as string[]).map(pid => prodMap.get(pid) ?? '?').join(', ');
      const expiryStr = acc.expires_at ? `📅 ${formatDate(acc.expires_at)} (${daysUntil(acc.expires_at)}d)` : '♾ Vĩnh viễn';
      lines.push(
        `  📧 <code>${escapeHtml(acc.email ?? '')}</code>`,
        `  ${expiryStr} | 🔗 ${acc.used_slots}/${acc.max_slots} (${free} trống)${prodNames ? ` | 📦 ${escapeHtml(prodNames)}` : ''}`,
      );
    }
    lines.push(``);
  };

  renderGroup('SẮP HẾT HẠN (≤7 ngày)', '🔴', active0to7);
  renderGroup('CÒN 7-30 NGÀY', '🟡', active7to30);
  renderGroup('CÒN >30 NGÀY', '🟢', active30plus);
  renderGroup('VĨNH VIỄN', '♾', noExpiry);

  if (expired.length) {
    lines.push(`⚫ <b>ĐÃ HẾT HẠN</b> (${expired.length})`);
    for (const acc of expired) {
      lines.push(`  📧 <code>${escapeHtml(acc.email ?? '')}</code> | 📅 Hết hạn ${formatDate(acc.expires_at!)}`);
    }
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Build pagination + action buttons
  const navRow: TelegramButton[] = [];
  if (safePage > 0) navRow.push({ text: `◀️ Tr.${safePage}`, callback_data: `cmd:active_accounts:page:${safePage - 1}` });
  navRow.push({ text: `📄 ${safePage + 1}/${totalPages}`, callback_data: `cmd:active_accounts:page:${safePage}` });
  if (safePage < totalPages - 1) navRow.push({ text: `Tr.${safePage + 2} ▶️`, callback_data: `cmd:active_accounts:page:${safePage + 1}` });

  const kb: TelegramButton[][] = [
    navRow,
    [{ text: '🔐 Credentials', callback_data: 'cmd:creds' }, { text: '🔗 Slot trống', callback_data: 'kho:slots' }],
    [{ text: '📦 Tạo kho', callback_data: 'cmd:newkho' }, { text: '📊 Thống kê', callback_data: 'kho:stats' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  if (msgId) {
    await editMessageText(String(chatId), msgId, lines.join('\n'), kb);
  } else {
    await sendKb(chatId, lines.join('\n'), kb);
  }
}

// ─── B1: Quick Order Status Change ──────────────────────────

async function handleOrderStatusPicker(chatId: number, data: string) {
  const orderCode = data.replace('ostatus:', '');
  const { data: order } = await supabaseAdmin.from('orders')
    .select('id, order_code, status').ilike('order_code', `%${orderCode}%`).limit(1).maybeSingle();
  if (!order) { await sendMsg(chatId, '❌ Đơn không tồn tại.'); return; }
  const statuses = [
    { emoji: '🟢', label: 'Active', value: 'active' },
    { emoji: '💳', label: 'Paid', value: 'paid' },
    { emoji: '🟠', label: 'Pending Payment', value: 'pending_payment' },
    { emoji: '🔵', label: 'Provisioning', value: 'provisioning' },
    { emoji: '🔴', label: 'Expired', value: 'expired' },
    { emoji: '🟣', label: 'Refunded', value: 'refunded' },
  ].filter(s => s.value !== order.status);
  const kb: TelegramButton[][] = statuses.map(s => [{
    text: `${s.emoji} ${s.label}`,
    callback_data: `setstatus:${order.order_code}:${s.value}`,
  }]);
  kb.push([{ text: '❌ Hủy', callback_data: `detail:${order.order_code}` }]);
  await sendKb(chatId, `🔄 <b>ĐỔI TRẠNG THÁI</b>\n📋 ${escapeHtml(order.order_code)}\nHiện tại: <b>${order.status}</b>\n\n👇 Chọn trạng thái mới:`, kb);
}

async function handleOrderStatusSet(chatId: number, data: string) {
  const parts = data.replace('setstatus:', '').split(':');
  const orderCode = parts[0];
  const newStatus = parts[1];
  try {
    const { error } = await supabaseAdmin.from('orders').update({ status: newStatus }).ilike('order_code', `%${orderCode}%`);
    if (error) throw error;
    await sendKb(chatId, `✅ Đã cập nhật <b>${escapeHtml(orderCode)}</b> → <b>${newStatus}</b>`, [
      [{ text: '📋 Xem lại', callback_data: `detail:${orderCode}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (e) {
    await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
  }
}

// ─── B2: Quick Payment Recording ────────────────────────────

async function handlePaymentStart(chatId: number, data: string) {
  const orderCode = data.replace('pay:', '');
  const { data: order } = await supabaseAdmin.from('orders')
    .select('id, order_code, total_amount_vnd, total_paid')
    .ilike('order_code', `%${orderCode}%`).limit(1).maybeSingle();
  if (!order) { await sendMsg(chatId, '❌ Đơn không tồn tại.'); return; }
  const debt = (order.total_amount_vnd ?? 0) - (order.total_paid ?? 0);
  if (debt <= 0) {
    await sendKb(chatId, `✅ Đơn <b>${escapeHtml(order.order_code)}</b> đã thanh toán đủ!`, [
      [{ text: '📋 Chi tiết', callback_data: `detail:${order.order_code}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }
  setSession(chatId, 'record_payment', 1, { orderCode: order.order_code, orderId: order.id, debt, totalPaid: order.total_paid });
  await sendKb(chatId, [
    `💳 <b>GHI NHẬN THANH TOÁN</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 Đơn: <b>${escapeHtml(order.order_code)}</b>`,
    `💰 Tổng: <b>${formatVnd(order.total_amount_vnd)}</b>`,
    `💳 Đã trả: <b>${formatVnd(order.total_paid)}</b>`,
    `🔴 Còn nợ: <b>${formatVnd(debt)}</b>`,
    ``,
    `👇 Nhập số tiền thanh toán (VND):`,
    `💡 Gõ <code>${Math.round(debt)}</code> để thanh toán hết`,
  ].join('\n'), [
    [{ text: `💳 TT hết ${formatVnd(debt)}`, callback_data: `payfull:${order.order_code}:${debt}` }],
    [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
  ]);
}

async function handlePaymentWizard(chatId: number, text: string, session: WizardSession) {
  const amount = parseInt(text.replace(/[.,đ\s]/g, ''), 10);
  if (isNaN(amount) || amount <= 0) {
    await sendMsg(chatId, '⚠️ Số tiền không hợp lệ. Nhập số nguyên (VND).');
    return;
  }
  clearSession(chatId);
  const { orderCode, orderId, totalPaid } = session.data as { orderCode: string; orderId: string; totalPaid: number };
  try {
    const newPaid = (totalPaid ?? 0) + amount;
    const { error } = await supabaseAdmin.from('orders').update({ total_paid: newPaid }).eq('id', orderId);
    if (error) throw error;
    await sendKb(chatId, [
      `✅ <b>THANH TOÁN THÀNH CÔNG</b>`,
      `📋 Đơn: <b>${escapeHtml(orderCode)}</b>`,
      `💳 Số tiền: <b>+${formatVnd(amount)}</b>`,
      `💰 Tổng đã trả: <b>${formatVnd(newPaid)}</b>`,
    ].join('\n'), [
      [{ text: '📋 Chi tiết', callback_data: `detail:${orderCode}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (e) {
    await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
  }
}

// ─── B6: Quick Remind ───────────────────────────────────────

async function handleQuickRemind(chatId: number, arg: string) {
  if (!arg) {
    await sendMsg(chatId, [
      '⏰ <b>NHẮC NHANH</b>',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Cú pháp: <code>/remind [thời gian] [nội dung]</code>',
      '',
      '💡 Ví dụ:',
      '  <code>/remind 2h Gọi KH Hoàng</code>',
      '  <code>/remind 30m Check đơn ORD-2603</code>',
      '  <code>/remind 1d Gia hạn kho</code>',
    ].join('\n'));
    return;
  }
  const match = arg.match(/^(\d+)(m|h|d)\s+(.+)$/i);
  if (!match) {
    await sendMsg(chatId, '⚠️ Sai cú pháp. VD: <code>/remind 2h Gọi KH</code>');
    return;
  }
  const [, numStr, unit, title] = match;
  const num = parseInt(numStr, 10);
  const msMap: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  const dueAt = new Date(Date.now() + num * msMap[unit.toLowerCase()]).toISOString();
  try {
    await supabaseAdmin.from('reminder_events').insert({
      title: title.trim(),
      due_at: dueAt,
      type: 'general',
      is_done: false,
      account_id: BOT_ACCOUNT_ID,
    });
    const unitLabel: Record<string, string> = { m: 'phút', h: 'giờ', d: 'ngày' };
    await sendKb(chatId, [
      `✅ <b>ĐÃ TẠO NHẮC NHỞ</b>`,
      `📝 ${escapeHtml(title.trim())}`,
      `⏰ Sau ${num} ${unitLabel[unit.toLowerCase()]}`,
      `📅 ${formatDateCustom(new Date(dueAt))}`,
    ].join('\n'), [
      [{ text: '📋 Xem tasks', callback_data: 'cmd:tasks' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (e) {
    await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
  }
}

// ─── A7: Credential Reveal ──────────────────────────────────

async function handleCredReveal(chatId: number, data: string) {
  const accId = data.replace('credreveal:', '');
  const { data: acc } = await supabaseAdmin.from('source_accounts')
    .select('id, email, notes')
    .eq('account_id', BOT_ACCOUNT_ID)
    .eq('id', accId).is('deleted_at', null).single();
  if (!acc) { await sendMsg(chatId, '❌ Không tìm thấy.'); return; }
  const rawNotes = (typeof acc.notes === 'object' && acc.notes !== null) ? acc.notes : {};
  const notesObj = decryptNotes(rawNotes) as Record<string, any>;
  const password = notesObj.password ?? null;
  const joinLink = notesObj.joinLink ?? notesObj.join_link ?? null;
  const twoFA = notesObj.twoFA ?? notesObj['2fa'] ?? null;
  const credentials = Array.isArray(notesObj.credentials) ? notesObj.credentials : [];
  const lines: string[] = [
    `👁 <b>CREDENTIALS (revealed)</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📧 Email: <code>${escapeHtml(acc.email)}</code>`,
  ];
  if (password) lines.push(`🔑 Password: <code>${escapeHtml(String(password))}</code>`);
  if (joinLink) lines.push(`🔗 Link: <code>${escapeHtml(String(joinLink))}</code>`);
  if (twoFA) lines.push(`🛡 2FA: <code>${escapeHtml(String(twoFA))}</code>`);
  for (const cred of credentials) {
    lines.push(`📌 ${escapeHtml(String(cred.label || 'Info'))}: <code>${escapeHtml(String(cred.value || ''))}</code>`);
  }
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚠️ <i>Thông tin nhạy cảm — cẩn thận khi chia sẻ</i>`);
  await sendKb(chatId, lines.join('\n'), [
    [{ text: '🔒 Ẩn lại', callback_data: `creds:acc:${accId}` }],
    [{ text: '📋 Copy Login', callback_data: `copy:${acc.email} / ${String(password ?? '')}` }],
    [{ text: '⬅️ Quay lại', callback_data: 'creds:back' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── B4: Export Data ────────────────────────────────────────

async function handleExport(chatId: number, arg: string) {
  const type = arg?.toLowerCase().trim();
  if (!type || !['orders', 'customers', 'kho', 'debt'].includes(type)) {
    await sendKb(chatId, [
      '📤 <b>XUẤT DỮ LIỆU</b>',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Chọn loại dữ liệu cần xuất:',
    ].join('\n'), [
      [{ text: '📦 Đơn hôm nay', callback_data: 'runcmd:export orders' }],
      [{ text: '👤 Khách hàng', callback_data: 'runcmd:export customers' }],
      [{ text: '📦 Kho hàng', callback_data: 'runcmd:export kho' }],
      [{ text: '💳 Danh sách nợ', callback_data: 'runcmd:export debt' }],
      [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  await sendMsg(chatId, '⏳ Đang xuất dữ liệu...');

  try {
    if (type === 'orders') {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const { data: rawOrders } = await supabaseAdmin.from('orders')
        .select('order_code, status, total_amount_vnd, total_paid, product_name_snapshot, customer_id')
        .gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).order('created_at', { ascending: false }).limit(50);
      if (!rawOrders?.length) { await sendMsg(chatId, '📭 Không có đơn hôm nay.'); return; }
      const customerMap = await loadTelegramCustomerMap(
        [...new Set(rawOrders.map((o) => o.customer_id).filter((id): id is string => Boolean(id)))],
        'id, full_name',
      );
      const orders = attachTelegramOrderCustomers(rawOrders as TelegramOrderBaseRow[], customerMap);
      const lines = orders.map((o, i) => {
        const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as { full_name: string } | null;
        const debt = (o.total_amount_vnd ?? 0) - (o.total_paid ?? 0);
        return `${i + 1}. ${o.order_code} | ${c?.full_name ?? 'N/A'} | ${o.product_name_snapshot ?? ''} | ${formatVnd(o.total_amount_vnd ?? 0)} | ${o.status}${debt > 0 ? ` | nợ ${formatVnd(debt)}` : ''}`;
      });
      await sendMsg(chatId, `📦 <b>ĐƠN HÔM NAY (${orders.length})</b>\n\n<code>${lines.join('\n')}</code>`);
    } else if (type === 'customers') {
      const { data: rawCusts } = await supabaseAdmin.from('customers')
        .select('id, full_name, type, created_at')
        .eq('account_id', BOT_ACCOUNT_ID).is('deleted_at', null).order('created_at', { ascending: false }).limit(50);
      if (!rawCusts?.length) { await sendMsg(chatId, '📭 Chưa có KH.'); return; }
      const contactMap = await loadTelegramCustomerContacts((rawCusts ?? []).map((c: any) => c.id));
      const custs = attachTelegramCustomerContacts((rawCusts ?? []) as Array<{ id: string; full_name: string; type: string | null; created_at: string | null }>, contactMap);
      const typeL: Record<string, string> = { retail: 'Cá nhân', wholesale: 'Buôn sỉ', agency: 'Đại lý' };
      const lines = custs.map((c: any, i: number) => {
        const primaryContact =
          (c.customer_contacts ?? []).find((cc: any) => cc.channel === 'zalo')?.value
          ?? (c.customer_contacts ?? []).find((cc: any) => cc.channel === 'phone')?.value
          ?? 'N/A';
        return `${i + 1}. ${c.full_name} | ${primaryContact} | ${typeL[c.type] ?? c.type ?? 'retail'}`;
      });
      await sendMsg(chatId, `👤 <b>KHÁCH HÀNG (${custs.length})</b>\n\n<code>${lines.join('\n')}</code>`);
    } else if (type === 'kho') {
      const { data: accs } = await supabaseAdmin.from('source_accounts')
        .select('email, max_slots, used_slots, expires_at')
        .eq('account_id', BOT_ACCOUNT_ID)
        .is('deleted_at', null).order('email').limit(50);
      if (!accs?.length) { await sendMsg(chatId, '📭 Chưa có kho.'); return; }
      const lines = accs.map((a, i) => `${i + 1}. ${a.email} | ${a.used_slots}/${a.max_slots} slots | hạn ${formatDate(a.expires_at)} | còn ${daysUntil(a.expires_at)}d`);
      await sendMsg(chatId, `📦 <b>KHO HÀNG (${accs.length})</b>\n\n<code>${lines.join('\n')}</code>`);
    } else if (type === 'debt') {
      const { data: rawDebtOrders } = await supabaseAdmin.from('orders')
        .select('order_code, status, total_amount_vnd, total_paid, payment_method, payment_terms, customer_id')
        .eq('account_id', BOT_ACCOUNT_ID).not('status', 'in', '(draft,refunded)').limit(50);
      const customerMap = await loadTelegramCustomerMap(
        [...new Set((rawDebtOrders ?? []).map((order) => order.customer_id).filter((id): id is string => Boolean(id)))],
        'id, full_name',
      );
      const debtList = attachTelegramOrderCustomers((rawDebtOrders ?? []) as TelegramOrderBaseRow[], customerMap)
        .filter(o => isDebtTrackedOrder(o));
      if (!debtList.length) { await sendMsg(chatId, '✅ Không có nợ.'); return; }
      const totalDebt = debtList.reduce((sum, order) => sum + getOutstandingAmount(order), 0);
      const lines = debtList.map((o, i) => {
        const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as { full_name: string } | null;
        return `${i + 1}. ${o.order_code} | ${c?.full_name ?? 'N/A'} | nợ ${formatVnd(getOutstandingAmount(o))}`;
      });
      await sendMsg(chatId, `💳 <b>DANH SÁCH NỢ (${debtList.length})</b>\nTổng: <b>${formatVnd(totalDebt)}</b>\n\n<code>${lines.join('\n')}</code>`);
    }
  } catch (e) {
    await sendMsg(chatId, `❌ Lỗi: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
  }
}

// ─── /note — Quick Order Note ───────────────────────────────

async function handleQuickNote(chatId: number, arg: string) {
  if (!arg) {
    await sendMsg(chatId, [
      '📝 <b>GHI CHÚ NHANH</b>',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Cú pháp: <code>/note ORD-xxx Nội dung ghi chú</code>',
      '',
      '💡 VD: <code>/note ORD-001 KH yêu cầu đổi nick</code>',
    ].join('\n'));
    return;
  }
  const match = arg.match(/^(ORD-[A-Z0-9-]+)\s+(.+)$/i);
  if (!match) {
    await sendMsg(chatId, '⚠️ Sai cú pháp.\nVD: <code>/note ORD-001 Ghi chú nội dung</code>');
    return;
  }
  const [, orderCode, note] = match;
  const { data: order } = await supabaseAdmin.from('orders')
    .select('id, notes').ilike('order_code', `%${orderCode}%`).eq('account_id', BOT_ACCOUNT_ID).limit(1).maybeSingle();
  if (!order) { await sendMsg(chatId, `❌ Không tìm thấy đơn: <code>${escapeHtml(orderCode)}</code>`); return; }

  const now = formatDateCustom(new Date(), undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  const existingNotes = order.notes ? String(order.notes) : '';
  const newNotes = existingNotes ? `${existingNotes}\n[${now}] ${note}` : `[${now}] ${note}`;

  await supabaseAdmin.from('orders').update({ notes: newNotes }).eq('id', order.id);
  await sendKb(chatId, [
    `✅ Đã thêm ghi chú cho <b>${escapeHtml(orderCode)}</b>`,
    `📝 <i>${escapeHtml(note)}</i>`,
  ].join('\n'), [
    [{ text: '📋 Chi tiết', callback_data: `detail:${orderCode}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── /pin — Pin Message ─────────────────────────────────────

async function handlePinMessage(chatId: number, arg: string) {
  if (!arg) {
    await sendMsg(chatId, [
      '📌 <b>GHIM TIN NHẮN</b>',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      'Cú pháp: <code>/pin Nội dung cần ghim</code>',
      '',
      '💡 VD: <code>/pin Nhớ gia hạn 5 đơn cuối tháng</code>',
    ].join('\n'));
    return;
  }
  try {
    const now = formatDateCustom(new Date(), undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const msgText = [
      `📌 <b>GHIM</b> — ${now}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      escapeHtml(arg),
    ].join('\n');
    // Send message via direct API to get message_id
    const sendRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msgText, parse_mode: 'HTML' }),
    });
    const sendData = await sendRes.json() as any;
    if (sendData?.ok && sendData?.result?.message_id) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: sendData.result.message_id, disable_notification: false }),
      });
    }
  } catch (e) {
    await sendMsg(chatId, `❌ Lỗi ghim: ${escapeHtml(e instanceof Error ? e.message : String(e))}`);
  }
}

// ─── /recent — Last 10 Orders Quick View ────────────────────

async function handleRecent(chatId: number, _msgId?: number) {
  const { data: rawOrders } = await supabaseAdmin.from('orders')
    .select('id, customer_id, order_code, status, total_amount_vnd, created_at, product_name_snapshot')
    .eq('account_id', BOT_ACCOUNT_ID).order('created_at', { ascending: false }).limit(10);
  if (!rawOrders?.length) { await sendMsg(chatId, '📭 Chưa có đơn nào.'); return; }
  const customerMap = await loadTelegramCustomerMap([...new Set(rawOrders.map(o => o.customer_id).filter((id): id is string => Boolean(id)))], 'id, full_name');
  const orders = attachTelegramOrderCustomers(rawOrders as TelegramOrderBaseRow[], customerMap);
  const lines = orders.map(o => {
    const c = (Array.isArray(o.customers) ? o.customers[0] : o.customers) as { full_name: string } | null;
    const time = o.created_at ? formatTelegramDateOnly(new Date(o.created_at)) : '';
    return `${getStatusEmoji(o.status)} <code>${escapeHtml(o.order_code ?? '')}</code> ${escapeHtml(c?.full_name ?? 'N/A').slice(0, 12)} ${formatVnd(o.total_amount_vnd ?? 0)} ${time}`;
  });
  const detailBtns: TelegramButton[][] = orders.slice(0, 5).map(o => [
    { text: `📋 ${o.order_code}`, callback_data: `detail:${o.order_code}` },
  ]);
  await sendKb(chatId, [`📋 <b>10 ĐƠN GẦN NHẤT</b>`, `━━━━━━━━━━━━━━━━━━━━━━━━━`, ...lines].join('\n'), [
    ...detailBtns,
    [{ text: '📦 Menu đơn', callback_data: 'cmd:orders' }, { text: '➕ Tạo đơn', callback_data: 'cmd:neworder' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

// ─── Smart Text Router (Module 6) ──────────────────────────

async function smartTextRouter(chatId: number, text: string) {
  const trimmed = text.trim();

  // Auto-detect ORD-xxxx pattern → show detail
  const ordMatch = trimmed.match(/^(ORD-[A-Z0-9-]+)$/i);
  if (ordMatch) return await handleDetail(chatId, ordMatch[1]);

  // Auto-detect email → search kho
  const emailMatch = trimmed.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
  if (emailMatch) {
    const email = emailMatch[0].toLowerCase();
    const { data: khoResults } = await supabaseAdmin.from('source_accounts')
      .select('id, email, max_slots, used_slots, expires_at')
      .eq('account_id', BOT_ACCOUNT_ID)
      .is('deleted_at', null).ilike('email', `%${email}%`).limit(5);
    if (khoResults?.length) {
      const lines = [
        `📧 <b>KHO HÀNG TÌM THEO EMAIL</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];
      for (const k of khoResults) {
        const free = (k.max_slots ?? 0) - (k.used_slots ?? 0);
        lines.push(
          `📧 <code>${escapeHtml(k.email ?? '')}</code>`,
          `  🔗 ${k.used_slots}/${k.max_slots} (${free} trống)${k.expires_at ? ` | 📅 ${formatDate(k.expires_at)}` : ''}`,
        );
      }
      const kb: TelegramButton[][] = khoResults.map(k => [
        { text: `🔐 Creds: ${k.email}`, callback_data: `creds:view:${k.id}` },
      ]);
      kb.push([{ text: '🏠 Menu', callback_data: 'cmd:start' }]);
      await sendKb(chatId, lines.join('\n'), kb);
      return;
    }
  }

  // Auto-detect phone number → search customer
  const phoneMatch = trimmed.match(/^(0|\+84|84)[0-9]{8,10}$/);
  if (phoneMatch) return await handleCustomerProfile(chatId, trimmed);

  // Auto-detect Duolingo URL (profile link or API URL)
  if (/duolingo\.com\/(profile\/|2017-06-30\/users\/)/i.test(trimmed)) {
    const { value } = normalizeUsername(trimmed);
    if (value) return await handleDuolingo(chatId, value);
  }

  // Auto-detect Facebook URL (m., mbasic., web., www.)
  if (/(?:m\.|mbasic\.|web\.|www\.)?facebook\.com\//i.test(trimmed)) {
    const { value } = normalizeUsername(trimmed);
    if (value) return await handleFbid(chatId, value);
  }

  // Fallback: general search
  return await handleFind(chatId, trimmed);
}

// ─── Wizard: New Customer (5 bước) ──────────────────────────

async function handleNewCustomerStart(chatId: number) {
  setSession(chatId, 'newcustomer', 0, {});
  await sendMsg(chatId, [
    `👤 <b>TẠO KHÁCH HÀNG MỚI</b>  ${progressBar(1, 5)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Bước 1/5:</b> Nhập họ tên đầy đủ`,
    ``,
    `<i>Ví dụ: Nguyễn Văn A</i>`,
    `💡 Gõ <code>/cancel</code> để hủy`,
  ].join('\n'));
}

async function handleNewCustomerCallback(chatId: number, data: string) {
  const parts = data.split(':');
  const session = getSession(chatId);

  // Type selected → go to contact picker (step 2)
  if (parts[1] === 'type') {
    if (!session) return;
    const custType = parts[2];
    const typeLabels: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
    setSession(chatId, 'newcustomer', 3, { ...session.data, custType, contactChannel: 'zalo' });
    await sendMsg(chatId, `✅ Loại: <b>${typeLabels[custType] ?? custType}</b>`);
    await sendMsg(chatId, [
      `📌 <b>Bước 3/5:</b> Thêm thông tin liên hệ`,
      `💚 Gợi ý nhanh: Nhập Zalo khách hàng`,
      `<i>VD: 0987654321, username hoặc link Zalo</i>`,
      `<i>(Hoặc gõ <code>skip</code> để chọn kênh khác)</i>`,
    ].join('\n'));
    return;
  }

  // Contact channel selected → ask value (step 3)
  if (parts[1] === 'contact') {
    if (!session) return;
    const channel = parts[2];
    const channelLabels: Record<string, string> = { phone: '📞 SĐT', telegram: '💬 Telegram', zalo: '💚 Zalo', facebook: '📘 Facebook', email: '📧 Email' };
    setSession(chatId, 'newcustomer', 3, { ...session.data, contactChannel: channel });
    const placeholder: Record<string, string> = {
      phone: 'VD: 0987654321',
      telegram: 'VD: @username',
      zalo: 'VD: 0987654321 hoặc tên Zalo',
      facebook: 'VD: link profile hoặc tên FB',
      email: 'VD: email@example.com',
    };
    await sendMsg(chatId, [
      `📱 Kênh: <b>${channelLabels[channel] ?? channel}</b>`,
      ``,
      `📌 <b>Bước 3/5 (tiếp):</b> Nhập giá trị liên hệ:`,
      `<i>${placeholder[channel] ?? 'Nhập giá trị'}</i>`,
      `<i>(Hoặc gõ <code>skip</code> để hủy bỏ nhập kênh này)</i>`,
    ].join('\n'));
    return;
  }

  // Done with contacts → ask notes (step 4)
  if (parts[1] === 'done') {
    if (!session) return;
    const contacts = (session.data.contacts ?? []) as Array<{channel: string; value: string}>;
    if (contacts.length === 0) {
      await sendMsg(chatId, '⚠️ Lỗi: Khách hàng phải có ít nhất 1 thông tin liên hệ.');
      return showContactChannelPicker(chatId);
    }
    setSession(chatId, 'newcustomer', 4, session.data);
    await sendKb(chatId, [
      `📋 Đã chốt ${contacts.length} liên hệ`,
      ``,
      `📝 <b>Bước 4/5:</b> Ghi chú khách hàng`,
      `<i>Nhập ghi chú (nếu có) hoặc bỏ qua:</i>`,
    ].join('\n'), [
      [{ text: '⏩ Bỏ qua - Tạo ngay', callback_data: 'nc:skipnotes' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Skip notes → save immediately
  if (parts[1] === 'skipnotes') {
    if (!session) return;
    return await saveNewCustomer(chatId, session.data);
  }

  // Add more contacts → show picker again
  if (parts[1] === 'addmore') {
    if (!session) return;
    await showContactChannelPicker(chatId);
    return;
  }
}

async function handleNewCustomerWizard(chatId: number, text: string, session: WizardSession) {
  const input = text.trim();

  // Step 0: Receive name → ask type
  if (session.step === 0) {
    if (!input || input.length < 2) { await sendMsg(chatId, '⚠️ Tên phải ít nhất 2 ký tự.'); return; }
    setSession(chatId, 'newcustomer', 1, { custName: input });
    await sendKb(chatId, [
      `✅ Tên: <b>${escapeHtml(input)}</b>`,
      ``,
      `📌 <b>Bước 2/5:</b> Chọn loại khách hàng`,
    ].join('\n'), [
      [{ text: '🛒 Cá nhân', callback_data: 'nc:type:retail' }, { text: '🏭 Buôn sỉ', callback_data: 'nc:type:wholesale' }],
      [{ text: '🏢 Đại lý', callback_data: 'nc:type:agency' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Step 3: Receive contact value → save + ask more
  if (session.step === 3) {
    const channel = session.data.contactChannel as string;
    if (input.toLowerCase() === 'skip') {
      setSession(chatId, 'newcustomer', 2, { ...session.data, contactChannel: undefined });
      return showContactChannelPicker(chatId);
    }

    const validation = validateContactInput(channel, input);
    if (!validation.ok) {
      await sendMsg(chatId, `⚠️ ${escapeHtml(validation.error ?? 'Liên hệ không hợp lệ.')}`);
      return;
    }
    const normalizedChannel = validation.normalizedChannel ?? (channel as 'phone' | 'email' | 'zalo' | 'facebook' | 'telegram' | 'other');
    const normalizedValue = validation.normalizedValue ?? input;
    const contacts = (session.data.contacts ?? []) as Array<{channel: string; value: string}>;
    const mergedContacts = appendUniqueContact(contacts, { channel: normalizedChannel, value: normalizedValue });
    setSession(chatId, 'newcustomer', 2, { ...session.data, contacts: mergedContacts, contactChannel: undefined });
    const channelEmoji: Record<string, string> = { phone: '📞', telegram: '💬', zalo: '💚', facebook: '📘', email: '📧' };
    await sendKb(chatId, [
      `✅ Đã thêm: ${channelEmoji[normalizedChannel] ?? '📱'} ${escapeHtml(normalizedChannel)}: <code>${escapeHtml(normalizedValue)}</code>`,
      ``,
      `📋 Đã có ${mergedContacts.length} kênh liên hệ (cần $\\geq$ 1)`,
      ``,
      `👇 Thêm kênh khác hoặc hoàn tất:`,
    ].join('\n'), [
      [{ text: '➕ Thêm kênh liên hệ', callback_data: 'nc:addmore' }],
      [{ text: '✅ Hoàn tất → Ghi chú', callback_data: 'nc:done' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // Step 4: Receive notes → save customer (step 5)
  if (session.step === 4) {
    const notes = input.length > 0 ? input.slice(0, 500) : undefined;
    return await saveNewCustomer(chatId, { ...session.data, notes });
  }
}

/** Show contact channel picker for new customer wizard */
async function showContactChannelPicker(chatId: number) {
  const session = getSession(chatId);
  const contacts = ((session?.data?.contacts ?? []) as Array<{channel: string; value: string}>);
  const added = contacts.map(c => c.channel);

  // Decide label for Phone (if no Zalo or Phone in 'added', it's primary Phone)
  const phoneLabel = added.includes('zalo') || added.includes('phone') ? '📞 SĐT phụ' : '📞 SĐT';

  // Build rows, disable already-added channels
  const channels = [
    { text: '💚 Zalo', cb: 'nc:contact:zalo', key: 'zalo' },
    { text: phoneLabel, cb: 'nc:contact:phone', key: 'phone' },
    { text: '💬 Telegram', cb: 'nc:contact:telegram', key: 'telegram' },
    { text: '📘 Facebook', cb: 'nc:contact:facebook', key: 'facebook' },
    { text: '📧 Email', cb: 'nc:contact:email', key: 'email' },
  ].filter(ch => !added.includes(ch.key));

  const row1 = channels.slice(0, 3).map(ch => ({ text: ch.text, callback_data: ch.cb }));
  const row2 = channels.slice(3).map(ch => ({ text: ch.text, callback_data: ch.cb }));

  const kb: TelegramButton[][] = [];
  if (row1.length) kb.push(row1);
  if (row2.length) kb.push(row2);

  // Only allow Done if at least 1 contact added
  if (contacts.length > 0) {
    kb.push([{ text: '✅ Xong → Ghi chú', callback_data: 'nc:done' }]);
  }
  kb.push([{ text: '❌ Hủy', callback_data: 'cmd:cancel' }]);

  await sendKb(chatId, [
    `📌 <b>Bước 3/5:</b> Thêm thông tin liên hệ`,
    contacts.length > 0 
      ? `📋 Đã thêm: ${contacts.map(c => `${c.channel}`).join(', ')}`
      : `⚠️ Yêu cầu: Khách hàng phải có ít nhất 1 liên hệ`,
    `<i>Chọn nhanh một kênh bên dưới:</i>`,
  ].filter(Boolean).join('\n'), kb);
}

/** Save new customer to database with contacts */
async function saveNewCustomer(chatId: number, d: Record<string, any>) {
  await sendMsg(chatId, '⏳ Đang tạo khách hàng...');
  try {
    // Map wizard type to DB enum: retail | wholesale | agency
    const typeMap: Record<string, string> = { retail: 'retail', wholesale: 'wholesale', agency: 'agency' };
    const dbType = typeMap[d.custType] ?? 'retail';

    const { data: newCust, error } = await supabaseAdmin.from('customers').insert({
      full_name: d.custName,
      type: dbType,
      notes: d.notes ?? null,
      account_id: BOT_ACCOUNT_ID,
    }).select('id, full_name, type, notes').single();
    if (error) throw new Error(error.message ?? JSON.stringify(error));

    // Insert contacts (phone is now unified with other channels)
    const contacts = (d.contacts ?? []) as Array<{channel: string; value: string}>;
    // Filter to valid channels only
    const validChannels = ['phone', 'email', 'zalo', 'facebook', 'telegram', 'other'];
    const validContacts = contacts.filter(c => validChannels.includes(c.channel));
    if (validContacts.length > 0) {
      const { error: contactError } = await supabaseAdmin.from('customer_contacts').insert(
        validContacts.map((c) => ({ customer_id: newCust.id, channel: c.channel, value: c.value }))
      );
      if (contactError) console.error('[Bot] Contact insert error:', contactError);
    }

    clearSession(chatId);
    const typeLabels: Record<string, string> = { retail: '🛒 Cá nhân', wholesale: '🏭 Buôn sỉ', agency: '🏢 Đại lý' };
    const channelEmoji: Record<string, string> = { telegram: '💬', zalo: '💚', facebook: '📘', email: '📧', phone: '📞' };
    const contactLines = validContacts.map(c => `  ${channelEmoji[c.channel] ?? '📱'} ${escapeHtml(c.channel)}: <code>${escapeHtml(c.value)}</code>`);

    await sendKb(chatId, [
      `✅ <b>ĐÃ TẠO KHÁCH HÀNG!</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Tên: <b>${escapeHtml(newCust.full_name)}</b>`,
      `🏷 Loại: <b>${typeLabels[newCust.type] ?? newCust.type}</b>`,
      contactLines.length > 0 ? `\n📱 <b>Liên hệ (${contactLines.length}):</b>\n${contactLines.join('\n')}` : '',
      newCust.notes ? `\n📝 Ghi chú: <i>${escapeHtml(newCust.notes)}</i>` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Tạo đơn cho KH này: /neworder`,
    ].filter(Boolean).join('\n'), [
      [
        { text: '📦 Tạo đơn ngay', callback_data: 'cmd:neworder' },
        { text: `👤 ${newCust.full_name}`, callback_data: `runcmd:customer ${newCust.id}` },
      ],
      [{ text: '➕ Tạo thêm KH', callback_data: 'cmd:newcustomer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  } catch (err) {
    clearSession(chatId);
    const errMsg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err));
    await sendKb(chatId, `❌ Lỗi tạo KH: ${escapeHtml(errMsg.slice(0, 200))}`, [
      [{ text: '🔄 Thử lại', callback_data: 'cmd:newcustomer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  }
}

// ─── Product View (drill-down per product) ──────────────────

async function handleProductView(chatId: number, data: string) {
  const productId = data.replace('prodview:', '');
  const { data: product } = await supabaseAdmin.from('products')
    .select('id, name, sell_price_vnd, is_active, sku, description')
    .eq('account_id', BOT_ACCOUNT_ID)
    .eq('id', productId).single();
  if (!product) { await sendMsg(chatId, '❌ SP không tồn tại.'); return; }

  // Get all kho accounts linked to this product
  const { data: khoAccs } = await supabaseAdmin.from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, reserved_nicks')
    .eq('account_id', BOT_ACCOUNT_ID)
    .is('deleted_at', null)
    .contains('product_ids', [productId])
    .order('expires_at', { ascending: false })
    .limit(30);

  const now = new Date();
  const active = (khoAccs ?? []).filter(k => !k.expires_at || new Date(k.expires_at) > now);
  const expired = (khoAccs ?? []).filter(k => k.expires_at && new Date(k.expires_at) <= now);
  const withSlots = active.filter(k => k.used_slots < k.max_slots);
  const totalFree = withSlots.reduce((s, k) => s + (k.max_slots - k.used_slots), 0);

  // Count orders
  const { data: orderItemRows } = await supabaseAdmin.from('order_items')
    .select('id, order_id')
    .eq('product_id', productId);
  const orderIds = [...new Set((orderItemRows ?? []).map((row: any) => row.order_id).filter((id): id is string => Boolean(id)))];
  const orderMap = await loadTelegramOrderMap(orderIds, 'id');
  const orderCount = (orderItemRows ?? []).filter((row: any) => row.order_id && orderMap.has(row.order_id)).length;

  const sections: string[] = [
    `📦 <b>CHI TIẾT SẢN PHẨM</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷 <b>${escapeHtml(product.name)}</b> ${product.is_active ? '🟢' : '🔴'}`,
    `💰 Giá: <b>${formatVnd(product.sell_price_vnd)}</b>`,
    product.sku ? `📋 SKU: <code>${escapeHtml(product.sku)}</code>` : '',
    product.description ? `📝 ${escapeHtml(String(product.description).slice(0, 100))}` : '',
    `📦 Đơn hàng: <b>${orderCount ?? 0}</b>`,
    ``,
    `━━━ 📊 KHO HÀNG ━━━━━━━━━`,
    `📧 Tổng kho: <b>${(khoAccs ?? []).length}</b> | Còn hạn: <b>${active.length}</b> | Hết hạn: <b>${expired.length}</b>`,
    `🔗 Slot trống tổng: <b>${totalFree}</b> (${withSlots.length} kho có slot)`,
  ];

  // List kho with slots
  if (withSlots.length > 0) {
    sections.push(``, `🟢 <b>KHO CÒN SLOT (${withSlots.length}):</b>`);
    for (const k of withSlots.slice(0, 10)) {
      const free = k.max_slots - k.used_slots;
      const expStr = k.expires_at ? ` | 📅 ${formatDate(k.expires_at)} (${daysUntil(k.expires_at)}d)` : ' | ♾ Vĩnh viễn';
      const nicks = (k.reserved_nicks ?? []) as string[];
      sections.push(`  📧 <code>${escapeHtml(k.email)}</code>`);
      sections.push(`     🔗 ${k.used_slots}/${k.max_slots} (trống: <b>${free}</b>)${expStr}`);
      if (nicks.length > 0) sections.push(`     🏷 Nicks: <code>${escapeHtml(nicks.slice(0, 5).join(', '))}</code>`);
    }
  }

  // List expired kho
  if (expired.length > 0 && expired.length <= 5) {
    sections.push(``, `🔴 <b>KHO HẾT HẠN (${expired.length}):</b>`);
    for (const k of expired.slice(0, 5)) {
      sections.push(`  📧 <code>${escapeHtml(k.email)}</code> | hết ${formatDate(k.expires_at)}`);
    }
  } else if (expired.length > 5) {
    sections.push(``, `🔴 Kho hết hạn: <b>${expired.length}</b> TK`);
  }

  sections.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Action buttons — show credentials for each available kho
  const credBtns: TelegramButton[][] = withSlots.slice(0, 6).map(k => {
    const free = k.max_slots - k.used_slots;
    const emailTrunc = k.email.length > 20 ? k.email.slice(0, 18) + '..' : k.email;
    return [{ text: `🔐 ${emailTrunc} (${free} slot)`, callback_data: `creds:acc:${k.id}` }];
  });

  await sendKb(chatId, sections.filter(Boolean).join('\n'), [
    ...credBtns,
    [{ text: '📦 Tạo đơn SP này', callback_data: 'cmd:neworder' }, { text: '🔗 Gán kho', callback_data: 'cmd:allocate' }],
    [{ text: '🏷 DS Sản phẩm', callback_data: 'cmd:products' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ]);
}

