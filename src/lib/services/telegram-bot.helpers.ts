// ============================================================
// TELEGRAM BOT HELPERS — Pure functions for testing
// ============================================================
// Extracted from telegram-bot.service.ts for testability.
// All functions are pure (no side-effects, no external deps).
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ──────────────────────────────────────────────────

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface WizardSession {
  command: string;
  step: number;
  data: Record<string, any>;
  createdAt: number;
}

export interface FailedAttemptRecord {
  count: number;
  lastAttempt: number;
}

export interface BlockConfig {
  maxAttempts: number;
  blockDurationMs: number;
}

export const DEFAULT_BLOCK_CONFIG: BlockConfig = {
  maxAttempts: 5,
  blockDurationMs: 60 * 60 * 1000, // 1 hour
};

export const SESSION_TTL = 10 * 60 * 1000; // 10 min
export const PAGE_SIZE = 10;

// ─── Known Commands ─────────────────────────────────────────

export const KNOWN_COMMANDS = [
  '/start', '/help', '/stats', '/orders', '/find', '/kho',
  '/duolingo', '/fbid', '/tasks', '/neworder', '/allocate',
  '/newtask', '/newproduct', '/newkho', '/today', '/expiring',
  '/expired', '/warehouse', '/slots', '/inventory', '/creds',
  '/detail', '/security', '/customer', '/debt', '/summary',
  '/products', '/search', '/active_accounts', '/newcustomer',
  // Aliases
  '/kh', '/no', '/sp', '/tk', '/duo', '/nick', '/tim',
  '/lookup', '/report', '/revenue', '/cancel',
] as const;

// ─── Auth Check ─────────────────────────────────────────────

/**
 * Check if a chat ID is authorized to use the bot.
 * Returns false if adminChatId is not configured (fail-closed).
 */
export function isAuthorized(chatId: number, adminChatId: string): boolean {
  if (!adminChatId) return false;
  return String(chatId) === adminChatId;
}

/**
 * Check if a chat ID is currently blocked due to failed attempts.
 * Returns true if blocked, false if not blocked or block expired.
 */
export function isBlocked(
  chatId: number,
  failedAttempts: Map<number, FailedAttemptRecord>,
  config: BlockConfig = DEFAULT_BLOCK_CONFIG,
): boolean {
  const record = failedAttempts.get(chatId);
  if (!record) return false;
  if (record.count >= config.maxAttempts) {
    const elapsed = Date.now() - record.lastAttempt;
    if (elapsed < config.blockDurationMs) return true;
    failedAttempts.delete(chatId); // Block expired
  }
  return false;
}

/**
 * Record a failed authorization attempt.
 * Returns the updated record count.
 */
export function recordFailedAttempt(
  chatId: number,
  failedAttempts: Map<number, FailedAttemptRecord>,
): FailedAttemptRecord {
  const record = failedAttempts.get(chatId) ?? { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  failedAttempts.set(chatId, record);
  return record;
}

// ─── Session Management ─────────────────────────────────────

/**
 * Get active wizard session. Returns null if expired or not found.
 */
export function getSession(
  chatId: number,
  sessions: Map<number, WizardSession>,
  ttl: number = SESSION_TTL,
): WizardSession | null {
  const s = sessions.get(chatId);
  if (!s) return null;
  if (Date.now() - s.createdAt > ttl) {
    sessions.delete(chatId);
    return null;
  }
  return s;
}

/**
 * Set a new wizard session for the given chat.
 */
export function setSession(
  chatId: number,
  sessions: Map<number, WizardSession>,
  command: string,
  step: number,
  data: Record<string, any>,
): void {
  sessions.set(chatId, { command, step, data, createdAt: Date.now() });
}

/**
 * Clear an active wizard session.
 */
export function clearSession(
  chatId: number,
  sessions: Map<number, WizardSession>,
): void {
  sessions.delete(chatId);
}

/**
 * Clean up all expired sessions from the map.
 * Returns the number of expired sessions removed.
 */
export function cleanupExpiredSessions(
  sessions: Map<number, WizardSession>,
  ttl: number = SESSION_TTL,
): number {
  let cleaned = 0;
  const now = Date.now();
  for (const [chatId, session] of sessions) {
    if (now - session.createdAt > ttl) {
      sessions.delete(chatId);
      cleaned++;
    }
  }
  return cleaned;
}

// ─── String Utilities ───────────────────────────────────────

/**
 * Levenshtein distance between two strings.
 * Used for fuzzy command matching.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Parse a command text into command and argument.
 * Example: "/find hello world" → { cmd: "/find", arg: "hello world" }
 */
export function parseCommand(text: string): { cmd: string; arg: string } {
  const trimmed = text.trim();
  const [cmd, ...args] = trimmed.split(/\s+/);
  return { cmd: cmd?.toLowerCase() ?? '', arg: args.join(' ') };
}

/**
 * Suggest similar commands based on Levenshtein distance.
 * Returns up to `maxResults` suggestions with distance <= `maxDistance`.
 */
export function findSimilarCommands(
  input: string,
  commands: readonly string[] = KNOWN_COMMANDS,
  maxDistance: number = 3,
  maxResults: number = 3,
): Array<{ cmd: string; distance: number }> {
  return commands
    .map((c) => ({ cmd: c, distance: levenshtein(input, c) }))
    .filter((s) => s.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
}

// ─── Time & Date Helpers ────────────────────────────────────

/**
 * Get Vietnamese greeting based on current UTC+7 hour.
 */
export function getGreeting(nowMs: number = Date.now()): string {
  const h = new Date(nowMs + 7 * 3600_000).getUTCHours();
  if (h < 6) return '🌙 Chào buổi khuya';
  if (h < 12) return '☀️ Chào buổi sáng';
  if (h < 18) return '🌤 Chào buổi chiều';
  return '🌆 Chào buổi tối';
}

/**
 * Calculate days until a given date string.
 * Returns 0 for null or past dates.
 */
export function daysUntil(d: string | null, nowMs: number = Date.now()): number {
  if (!d) return 0;
  return Math.max(0, Math.ceil((new Date(d).getTime() - nowMs) / 86_400_000));
}

/**
 * Fixed-width step progress bar for wizard/slot progress.
 * Example: progressBar(3, 5) → "▓▓▓░░ 3/5"
 */
export function progressBar(current: number, total: number): string {
  const width = 5;
  const safeTotal = Math.max(0, total);
  const safeCurrent = Math.max(0, safeTotal > 0 ? Math.min(current, safeTotal) : current);
  const filled = safeTotal > 0
    ? Math.round((safeCurrent / safeTotal) * width)
    : 0;
  const bar = '▓'.repeat(filled) + '░'.repeat(width - filled);
  return `${bar} ${safeCurrent}/${safeTotal}`;
}

/**
 * Premium section header with decorative Unicode.
 * Example: premiumHeader('📊', 'TỔNG QUAN') → "◈━━━ 📊 TỔNG QUAN ━━━◈"
 */
export function premiumHeader(icon: string, title: string): string {
  return `◈━━━ ${icon} <b>${title.toUpperCase()}</b> ━━━◈`;
}

// ─── Contact Validation Helpers ─────────────────────────────

export interface ContactValidationResult {
  ok: boolean;
  normalizedValue?: string;
  normalizedChannel?: 'phone' | 'email' | 'zalo' | 'facebook' | 'telegram' | 'other';
  extractedId?: string;
  error?: string;
}

/**
 * Validate Vietnamese mobile number formats:
 * - 0xxxxxxxxx
 * - 84xxxxxxxxx
 * - +84xxxxxxxxx
 */
export function isValidVietnamesePhone(input: string): boolean {
  const digits = input.replace(/\s|\.|-/g, '');
  return /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/.test(digits);
}

/**
 * Normalize Vietnamese phone to 0xxxxxxxxx format.
 */
export function normalizeVietnamesePhone(input: string): string {
  const cleaned = input.replace(/\s|\.|-/g, '');
  if (cleaned.startsWith('+84')) return `0${cleaned.slice(3)}`;
  if (cleaned.startsWith('84')) return `0${cleaned.slice(2)}`;
  return cleaned;
}

/**
 * Extract Facebook identity from URL.
 * Returns profile ID for profile.php?id=... or username/path slug.
 */
export function extractFacebookIdentity(input: string): { normalizedUrl: string; idOrUsername: string } | null {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes('facebook.com') && !host.includes('fb.com')) return null;

  const profileId = parsed.searchParams.get('id');
  if (profileId && /^\d{5,}$/.test(profileId)) {
    return {
      normalizedUrl: `https://www.facebook.com/profile.php?id=${profileId}`,
      idOrUsername: profileId,
    };
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (pathParts.length === 0) return null;

  // Common formats:
  // /username
  // /people/name/1000xxxx
  const tail = pathParts[pathParts.length - 1];
  const usernameOrId = /^[a-zA-Z0-9.\-_]{3,}$/.test(tail) ? tail : '';
  if (!usernameOrId) return null;

  return {
    normalizedUrl: `https://www.facebook.com/${usernameOrId}`,
    idOrUsername: usernameOrId,
  };
}

/**
 * Validate and normalize contact value by channel.
 */
export function validateContactInput(channel: string, rawValue: string): ContactValidationResult {
  const value = rawValue.trim();
  if (!value) return { ok: false, error: 'Giá trị liên hệ không được để trống.' };

  if (channel === 'phone') {
    if (!isValidVietnamesePhone(value)) {
      return { ok: false, error: 'SĐT không hợp lệ theo chuẩn Việt Nam.' };
    }
    return {
      ok: true,
      normalizedChannel: 'phone',
      normalizedValue: normalizeVietnamesePhone(value),
    };
  }

  if (channel === 'facebook') {
    const fb = extractFacebookIdentity(value);
    if (!fb) {
      return {
        ok: false,
        error: 'Facebook phải là link hợp lệ (ví dụ: https://facebook.com/... hoặc profile.php?id=...).',
      };
    }
    return {
      ok: true,
      normalizedChannel: 'facebook',
      normalizedValue: `${fb.normalizedUrl} | id:${fb.idOrUsername}`,
      extractedId: fb.idOrUsername,
    };
  }

  if (channel === 'email') {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!ok) return { ok: false, error: 'Email không hợp lệ.' };
    return { ok: true, normalizedChannel: 'email', normalizedValue: value.toLowerCase() };
  }

  if (channel === 'zalo') {
    const isPhone = isValidVietnamesePhone(value);
    const isZaloLink = /^https?:\/\/(zalo\.me|zaloapp\.com)\//i.test(value);
    const isHandle = /^@[a-zA-Z0-9._-]{3,}$/.test(value);
    if (!isPhone && !isZaloLink && !isHandle) {
      return { ok: false, error: 'Zalo cần là SĐT VN, @username hoặc link zalo.me hợp lệ.' };
    }
    return {
      ok: true,
      normalizedChannel: 'zalo',
      normalizedValue: isPhone ? normalizeVietnamesePhone(value) : value,
    };
  }

  if (channel === 'telegram') {
    const isHandle = /^@[a-zA-Z0-9_]{3,}$/.test(value);
    const isLink = /^https?:\/\/t\.me\/[a-zA-Z0-9_]{3,}$/i.test(value);
    if (!isHandle && !isLink) {
      return { ok: false, error: 'Telegram cần là @username hoặc link t.me hợp lệ.' };
    }
    return { ok: true, normalizedChannel: 'telegram', normalizedValue: value };
  }

  return { ok: true, normalizedChannel: 'other', normalizedValue: value };
}

/**
 * Append contact with dedup by channel+value.
 */
export function appendUniqueContact(
  contacts: Array<{ channel: string; value: string }>,
  next: { channel: string; value: string },
): Array<{ channel: string; value: string }> {
  const exists = contacts.some(c => c.channel === next.channel && c.value === next.value);
  if (exists) return contacts;
  return [...contacts, next];
}

/**
 * Modern UI layout helpers based on the requested vibrant style.
 */
export function modernHeader(title: string, icon = '🌟'): string {
  return `<b>${icon} ${title.toUpperCase()}</b>`;
}

export function modernList(label: string, value: string | number, icon = '💠'): string {
  return `${icon} <i>${label}</i> <b>${value}</b>`;
}

export function modernDetail(label: string, value: string | number, icon = ' ↪️'): string {
  return `${icon} <i>${label}</i> <b>${value}</b>`;
}

export const MODERN_SEPARATOR = `━━━━━━━━━━━━━━━━━━━━━`;

/**
 * Inline stat badge for compact display.
 * Example: miniStat('📦', 'Đơn', 12) → "📦 Đơn: <b>12</b>"
 */
export function miniStat(icon: string, label: string, value: string | number): string {
  return `${icon} ${label}: <b>${value}</b>`;
}

/**
 * Section separator — premium thin line.
 */
export const SEPARATOR = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

/**
 * Premium header bar — thick decorative line.
 */
export const HEADER_LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

/**
 * Validate callback_data format and length.
 * Telegram limits callback_data to 64 bytes.
 */
export function isValidCallbackData(data: string | undefined): boolean {
  if (!data) return false;
  if (data.length > 64) return false;
  // Only allow safe characters
  return /^[a-zA-Z0-9:_\-. @]+$/.test(data);
}
