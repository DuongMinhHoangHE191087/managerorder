// ============================================================
// TELEGRAM AUTO-SETUP — Bot commands & menu registration
// ============================================================
// Configures bot commands, menu button, and bot description on
// first request. WEBHOOK is NOT set here — must be set manually
// via CLI/script or POST /api/telegram/setup.
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { formatDateLabel } from "@/lib/utils";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

// Cache: only setup once per cold start
let isConfigured = false;

/**
 * Bot commands visible in Telegram menu.
 * Telegram allows max 100 commands; we'll register ~24.
 */
const BOT_COMMANDS = [
  // ── Dashboard & Overview ──
  { command: 'start', description: '🏠 Menu chính + Dashboard' },
  { command: 'stats', description: '📊 Thống kê + Doanh thu' },
  { command: 'summary', description: '📊 Báo cáo cuối ngày' },

  // ── Orders ──
  { command: 'orders', description: '📦 Menu đơn hàng' },
  { command: 'today', description: '📋 Đơn hôm nay' },
  { command: 'expiring', description: '⏰ Đơn sắp hết hạn' },
  { command: 'find', description: '🔍 Tìm kiếm thông minh' },
  { command: 'detail', description: '📄 Chi tiết đơn hàng' },

  // ── Inventory ──
  { command: 'kho', description: '📦 Kho hàng interactive' },
  { command: 'warehouse', description: '📊 Thống kê kho tổng hợp' },
  { command: 'creds', description: '🔐 Credentials kho' },
  { command: 'inventory', description: '📧 Tra kho theo email' },
  { command: 'products', description: '🏷 Danh sách sản phẩm' },

  // ── Customers & Finance ──
  { command: 'customer', description: '👤 Hồ sơ khách hàng' },
  { command: 'debt', description: '💳 Danh sách nợ / thu nợ' },

  // ── Create (Wizards) ──
  { command: 'neworder', description: '➕ Tạo đơn hàng mới' },
  { command: 'allocate', description: '🔗 Gán kho cho đơn' },
  { command: 'newtask', description: '📝 Tạo task / lịch hẹn' },
  { command: 'newproduct', description: '🏷 Tạo sản phẩm mới' },
  { command: 'newkho', description: '📦 Tạo kho hàng mới' },
  { command: 'newcustomer', description: '👤 Tạo khách hàng mới' },

  // ── Utilities ──
  { command: 'tasks', description: '📋 Danh sách tasks' },
  { command: 'search', description: '🔍 Tìm kiếm chuyên sâu đơn hàng' },
  { command: 'active_accounts', description: '🟢 Tài khoản kho còn hạn' },
  { command: 'duolingo', description: '🦉 Tra cứu Duolingo' },
  { command: 'fbid', description: '📘 Lấy Facebook ID' },
  { command: 'security', description: '🔒 Trạng thái bảo mật' },
  { command: 'shortlinks', description: '🔗 Quản lý short links' },
  { command: 'newlink', description: '🔗 Tạo short link mới' },
  { command: 'help', description: '❓ Hướng dẫn sử dụng' },
  { command: 'cancel', description: '❌ Hủy thao tác hiện tại' },
];

/**
 * Canonical site URL for menu button (NOT for webhook).
 * Priority: NEXT_PUBLIC_SITE_URL > NEXT_PUBLIC_APP_URL > fallback
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || 'https://duongminhhoang.id.vn';

/**
 * Call Telegram Bot API
 */
async function telegramApi(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; description?: string }> {
  if (!BOT_TOKEN) return { ok: false, description: 'BOT_TOKEN missing' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Ensure bot is configured. Safe to call multiple times —
 * only executes once per cold start (serverless instance).
 */
export async function ensureWebhookConfigured(): Promise<{
  alreadyConfigured: boolean;
  commands: boolean;
  menuButton: boolean;
  description: boolean;
  webhookInfo: string;
  errors: string[];
}> {
  if (isConfigured) {
    return { alreadyConfigured: true, commands: true, menuButton: true, description: true, webhookInfo: 'cached', errors: [] };
  }

  const errors: string[] = [];

  // 1. Check webhook status (read-only, never modify)
  let webhookInfo = 'unknown';
  try {
    const info = await telegramApi('getWebhookInfo', {});
    const url = (info as any)?.result?.url ?? '';
    webhookInfo = url || 'NOT_SET';
    if (!url) errors.push('Webhook URL is empty! Set it via POST /api/telegram/setup');
  } catch { webhookInfo = 'check_failed'; }

  // 2. Set Bot Commands (menu in Telegram)
  const cmdResult = await telegramApi('setMyCommands', { commands: BOT_COMMANDS });
  if (!cmdResult.ok) errors.push(`Commands: ${cmdResult.description}`);
  else console.log(`[Auto-Setup] ✅ ${BOT_COMMANDS.length} commands registered`);

  // 3. Set Chat Menu Button (webapp link — opens as Telegram WebApp)
  let menuOk = false;
  const menuResult = await telegramApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🌐 Mở Web App',
      web_app: { url: SITE_URL },
    },
  });
  menuOk = menuResult.ok;
  if (!menuResult.ok) errors.push(`Menu: ${menuResult.description}`);
  else console.log(`[Auto-Setup] ✅ Menu button → ${SITE_URL}`);

  // 4. Set Bot Description (shown when user opens bot info)
  let descOk = false;
  const descResult = await telegramApi('setMyDescription', {
    description: '🤖 ManagerOrder Bot — Quản lý đơn hàng, kho hàng, khách hàng và tài chính. Truy cập nhanh mọi dữ liệu qua Telegram.',
  });
  descOk = descResult.ok;
  if (!descResult.ok) errors.push(`Description: ${descResult.description}`);

  // 5. Set Bot Short Description (shown in chat list)
  const shortDescResult = await telegramApi('setMyShortDescription', {
    short_description: '📦 Quản lý đơn hàng & kho hàng thông minh',
  });
  if (!shortDescResult.ok) errors.push(`ShortDesc: ${shortDescResult.description}`);

  isConfigured = cmdResult.ok;

  return {
    alreadyConfigured: false,
    commands: cmdResult.ok,
    menuButton: menuOk,
    description: descOk,
    webhookInfo,
    errors,
  };
}

/**
 * Force reconfigure (bypass cache). Use when URL changes or
 * after deploying new commands.
 */
export async function forceReconfigure() {
  isConfigured = false;
  return ensureWebhookConfigured();
}

// ─── AUTO-REGISTER WEBHOOK (called by instrumentation.ts) ────

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const ADMIN_CHAT_ID = (process.env.TELEGRAM_ADMIN_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID ?? '').trim();

/**
 * Automatically register the Telegram webhook on server cold start.
 * This ensures the bot starts working immediately after every deploy/restart
 * without requiring manual API calls.
 *
 * Called from: src/instrumentation.ts → register()
 */
export async function autoRegisterWebhook(): Promise<void> {
  if (!BOT_TOKEN) {
    console.warn('[Auto-Setup] ⚠️ TELEGRAM_BOT_TOKEN not set — skipping webhook registration.');
    return;
  }

  // Resolve the production URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.SITE_URL
    || '';

  if (!siteUrl) {
    console.error(
      '[Auto-Setup] ❌ Cannot auto-register webhook: NEXT_PUBLIC_SITE_URL is not configured!\n' +
      '  → Add NEXT_PUBLIC_SITE_URL=https://your-domain.com to .env.local (or server env)'
    );
    return;
  }

  const webhookUrl = `${siteUrl.replace(/\/+$/, '')}/api/telegram/webhook`;

  console.log(`[Auto-Setup] 🔗 Registering webhook → ${webhookUrl}`);

  // 1. Set Webhook with Telegram API
  const params: Record<string, unknown> = {
    url: webhookUrl,
    max_connections: 40,
    allowed_updates: ['message', 'callback_query'],
  };
  if (WEBHOOK_SECRET) {
    params.secret_token = WEBHOOK_SECRET;
  }

  const webhookResult = await telegramApi('setWebhook', params);

  if (webhookResult.ok) {
    console.log(`[Auto-Setup] ✅ Webhook registered successfully: ${webhookUrl}`);
  } else {
    console.error(`[Auto-Setup] ❌ setWebhook failed: ${webhookResult.description}`);
    return; // Don't proceed if webhook failed
  }

  // 2. Reconfigure bot (commands, menu button, description)
  const configResult = await forceReconfigure();
  if (configResult.errors.length > 0) {
    console.warn('[Auto-Setup] ⚠️ Config warnings:', configResult.errors);
  }

  // 3. Notify admin that bot has started
  if (ADMIN_CHAT_ID) {
    const startTime = formatDateLabel(new Date());

    try {
      await telegramApi('sendMessage', {
        chat_id: ADMIN_CHAT_ID,
        parse_mode: 'HTML',
        text: [
          `🚀 <b>Bot đã khởi động!</b>`,
          `━━━━━━━━━━━━━━━━━━━`,
          `⏰ ${startTime}`,
          `🔗 Webhook: <code>${webhookUrl}</code>`,
          `✅ Commands: ${configResult.commands ? 'OK' : '❌'}`,
          `✅ Menu: ${configResult.menuButton ? 'OK' : '❌'}`,
          ``,
          `Gõ /start để bắt đầu.`,
        ].join('\n'),
      });
    } catch {
      // Non-critical — don't block startup
      console.warn('[Auto-Setup] Could not send startup notification.');
    }
  }
}
