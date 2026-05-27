import type { BotMiddleware } from '../bot-router';
import { isAuthorized, DEFAULT_BLOCK_CONFIG } from '@/lib/services/telegram-bot.helpers';
import { resolveTelegramBotAccount } from "@/lib/bot-manager/runtime-account";
import { setLegacyBotAccountId } from "@/lib/services/telegram-bot.service";
import { sendTelegramMessage, escapeHtml, resolveTelegramAdminChatId } from '@/lib/utils/telegram';
import { incrementCounter, getCache, setCache } from '@/lib/redis/client';

const ADMIN_CHAT_ID = resolveTelegramAdminChatId();
const BOT_CONFIG_WARNING_TTL_SECONDS = 5 * 60;

export const authMiddleware: BotMiddleware = async (ctx, next) => {
  const { chatId } = ctx;

  // 1. Check strict Authorization
  if (!ADMIN_CHAT_ID) {
    console.error('[Bot Security] TELEGRAM_ADMIN_CHAT_ID is not configured! Bot is locked.');
    return; // Fail-closed
  }
  
  if (!isAuthorized(chatId, ADMIN_CHAT_ID)) {
    // 2. Rate Limit & Block logic for unauthorized users
    const user = ctx.update.message?.from || ctx.update.callback_query?.from;
    if (!user) return;

    const blockKey = `telegram:block:${chatId}`;
    const attemptsKey = `telegram:attempts:${chatId}`;

    // Check if currently blocked
    const isBlocked = await getCache<boolean>(blockKey);
    if (isBlocked) {
      return; // Silently drop
    }

    // Increment failed attempts
    const ttlSeconds = Math.floor(DEFAULT_BLOCK_CONFIG.blockDurationMs / 1000);
    const count = await incrementCounter(attemptsKey, ttlSeconds);

    console.warn(
      `[Bot Security] ⚠️ Unauthorized attempt #${count} | ` +
      `Chat: ${chatId} | User: ${user.first_name} ${user.last_name ?? ''} ` +
      `(@${user.username ?? 'no-username'}) | ID: ${user.id}`
    );

    if (count >= DEFAULT_BLOCK_CONFIG.maxAttempts) {
      // Mark as blocked
      await setCache(blockKey, true, ttlSeconds);
      
      // Notify Admin
      if (ADMIN_CHAT_ID) {
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
            `🔒 Đã tự động block user này ${Math.floor(ttlSeconds / 60)} phút.`,
          ].join('\n'),
          { chatId: ADMIN_CHAT_ID }
        ).catch(() => { /* non-critical */ });
      }
    }
    
    return; // Stop processing for unauthorized chat
  }

  // Inject accountId to context for downstream handlers
  const botAccount = await resolveTelegramBotAccount();
  if (!botAccount.accountId) {
    console.error(
      `[Bot Security] Unable to resolve bot account for Telegram runtime: ${botAccount.warnings.join(" | ")}`
    );

    const warningCacheKey = `telegram:config-warning:${chatId}`;
    const warnedRecently = await getCache<boolean>(warningCacheKey);
    if (!warnedRecently) {
      await setCache(warningCacheKey, true, BOT_CONFIG_WARNING_TTL_SECONDS);
      await sendTelegramMessage(
        [
          `⚠️ <b>BOT CHƯA GẮN ĐÚNG ACCOUNT</b>`,
          `━━━━━━━━━━━━━━━━━━━`,
          `Bot chưa resolve được tenant làm việc nên đã dừng xử lý để tránh trả sai dữ liệu.`,
          ``,
          `Cần cấu hình <code>TELEGRAM_BOT_ACCOUNT_ID</code> hoặc giữ <code>admin_users</code> chỉ có 1 account_id duy nhất.`,
          ``,
          ...botAccount.warnings.map((warning) => `• ${escapeHtml(warning)}`),
        ].join("\n"),
        { chatId: String(chatId) }
      ).catch(() => { /* non-critical */ });
    }
    return;
  }
  ctx.accountId = botAccount.accountId;
  ctx.state.botAccountResolution = botAccount;
  process.env.TELEGRAM_BOT_ACCOUNT_ID = botAccount.accountId;
  setLegacyBotAccountId(botAccount.accountId);

  // User is authorized, proceed to next
  await next();
};
