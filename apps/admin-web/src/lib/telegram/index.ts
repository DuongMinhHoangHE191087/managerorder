import { BotRouter } from './bot-router';
import type { BotHandler } from './bot-router';
import { errorMiddleware } from './middleware/error.middleware';
import { typingMiddleware } from './middleware/typing.middleware';
import { callbackAckMiddleware } from './middleware/callback-ack.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { sessionMiddleware } from './middleware/session.middleware';
import { perfMiddleware } from './middleware/perf.middleware';
import { handleOrdersCommand, handleTodayAction, handleExpiringAction, handleExpiredAction, handleDetailCommand } from './handlers/orders.handler';
import { handleKhoCommand, handleWarehouseAction, handleSlotsAction } from './handlers/inventory.handler';
import {
  handleStartCommand, handleStatsCommand, handleSummaryCommand, handleHelpCommand,
  handleSearchPrompt, handleUtilitiesMenu, handleCreateMenu, handleWebApp,
} from './handlers/dashboard.handler';
import { handleFindCommand, handleSmartTextRouter } from './handlers/find.handler';
import {
  handleDuolingoCommand, handleFbidCommand, handleProductsListCommand, handleSecurityCommand,
  handleCredsCommand, handleCredsCallback, handleScopedProductViewCallback,
} from './handlers/utility.handler';
import { handleTasksCommand, handleTaskDoneAction } from './handlers/task.handler';
import { handleShortLinksCommand, handleNewLinkCommand, handleShortLinkDetailCallback, handleFullCreateWizard } from './handlers/shortlinks.handler';
import { handleCustomerCommand, handleCustomerDetail, handleCustomerOrdersAction, handleDebtCommand } from './handlers/customers.handler';
import { sendMsg, answerCallbackQuery } from './shared';
import * as legacy from '@/lib/services/telegram-bot.service';

export const bot = new BotRouter();

const legacyBridge: BotHandler = async (ctx) => {
  await legacy.handleBotUpdate(ctx.update);
};

// ═══════════════════════════════════════════════════════════════
// 1. GLOBAL MIDDLEWARE CHAIN (order matters)
// ═══════════════════════════════════════════════════════════════
bot.use(errorMiddleware);       // Catches all errors, sends user-friendly message
bot.use(typingMiddleware);      // Shows "typing..." indicator for instant feedback
bot.use(callbackAckMiddleware); // Auto-dismisses loading spinner on inline buttons
bot.use(authMiddleware);        // Admin chat verification + rate limiting
bot.use(sessionMiddleware);     // Wizard session state management
bot.use(perfMiddleware);        // Logs slow update handlers for perf diagnostics

// ═══════════════════════════════════════════════════════════════
// 2. DASHBOARD & NAVIGATION
// ═══════════════════════════════════════════════════════════════
bot.command('start', handleStartCommand);
bot.command('stats', handleStatsCommand);
bot.command('summary', handleSummaryCommand);
bot.command('help', handleHelpCommand);

bot.action('cmd:start', handleStartCommand);
bot.action('cmd:stats', handleStatsCommand);
bot.action('cmd:summary', handleSummaryCommand);
bot.action('cmd:help_detail', handleHelpCommand);
bot.action('cmd:search_prompt', handleSearchPrompt);
bot.action('cmd:utilities', handleUtilitiesMenu);
bot.action('cmd:create_menu', handleCreateMenu);
bot.action('cmd:webapp', handleWebApp);
bot.action('cmd:search', handleSearchPrompt);

// Bridge still-unmigrated menu actions directly to legacy handlers
bot.action('cmd:neworder', legacyBridge);
bot.action('cmd:allocate', legacyBridge);
bot.action('cmd:newtask', legacyBridge);
bot.action('cmd:newproduct', legacyBridge);
bot.action('cmd:newkho', legacyBridge);
bot.action('cmd:newcustomer', legacyBridge);
bot.action('cmd:active_accounts', legacyBridge);

bot.text('🛒 Sản phẩm', handleProductsListCommand);
bot.text('📝 Tạo đơn', handleCreateMenu);
bot.text('📦 Đơn hàng', handleOrdersCommand);
bot.text('ℹ️ Hỗ trợ', handleHelpCommand);
bot.text('💰 Doanh thu', handleSummaryCommand);
bot.text('🔗 Shortlinks', handleShortLinksCommand);
bot.text('📦 Kho', handleKhoCommand);
bot.text('📋 Tasks', handleTasksCommand);

// ═══════════════════════════════════════════════════════════════
// 3. ORDERS (commands + actions + pagination callbacks)
// ═══════════════════════════════════════════════════════════════
bot.command('orders', handleOrdersCommand);
bot.command('today', handleTodayAction);       // Direct command alias
bot.command('expiring', handleExpiringAction);  // Direct command alias
bot.command('search', handleFindCommand);       // Alias for /find
bot.command(['customer', 'kh'], handleCustomerCommand);
bot.command(['debt', 'no'], handleDebtCommand);

bot.action('cmd:orders', handleOrdersCommand);
bot.action('orders:today', handleTodayAction);
bot.action('orders:expiring', handleExpiringAction);
bot.action('orders:expired', handleExpiredAction);
bot.action('orders:today:*', handleTodayAction);
bot.action('orders:expiring:*', handleExpiringAction);
bot.action('orders:expired:*', handleExpiredAction);
bot.action('detail:*', handleDetailCommand);    // Inline detail buttons
bot.action('noop', async (ctx) => {
  if (ctx.callbackQueryId) await answerCallbackQuery(ctx.callbackQueryId);
});

// ═══════════════════════════════════════════════════════════════
// 4. INVENTORY & WAREHOUSE
// ═══════════════════════════════════════════════════════════════
bot.command('kho', handleKhoCommand);
bot.command('warehouse', handleWarehouseAction); // Direct command
bot.command('inventory', handleCredsCommand);    // Alias → creds browser

bot.action('cmd:kho', handleKhoCommand);
bot.action('kho:stats', handleWarehouseAction);
bot.action('kho:slots', handleSlotsAction);          // Exact match BEFORE kho:*
bot.action('kho:creds', handleCredsCommand);           // Exact match BEFORE kho:*
bot.action('kho:slots:page:*', handleSlotsAction);     // Pagination prefix
bot.action('kho:*', handleWarehouseAction);            // Catch-all for remaining kho: callbacks

// ═══════════════════════════════════════════════════════════════
// 5. SEARCH & DETAIL
// ═══════════════════════════════════════════════════════════════
bot.command(['find', 'lookup', 'tim'], handleFindCommand);
bot.command('detail', handleDetailCommand);
bot.action('cmd:customer', handleCustomerCommand);
bot.action('customer:*', handleCustomerDetail);
bot.action('runcmd:customer:*', handleCustomerDetail);
bot.action('cmd:customer_orders:*', handleCustomerOrdersAction);
bot.action('cmd:debt', handleDebtCommand);
bot.action('cmd:debt:*', handleDebtCommand);

// ═══════════════════════════════════════════════════════════════
// 6. UTILITIES (duolingo, fbid, creds, products, security)
// ═══════════════════════════════════════════════════════════════
bot.command('duolingo', handleDuolingoCommand);
bot.command('fbid', handleFbidCommand);
bot.command('products', handleProductsListCommand);
bot.command('security', handleSecurityCommand);
bot.command('creds', handleCredsCommand);
bot.command('active_accounts', handleCredsCommand); // Alias → creds

bot.action('cmd:duolingo', handleDuolingoCommand);
bot.action('cmd:fbid', handleFbidCommand);
bot.action('cmd:products', handleProductsListCommand);
bot.action('products:page:*', handleProductsListCommand);
bot.action('cmd:security', handleSecurityCommand);
bot.action('cmd:creds', handleCredsCommand);
bot.action('creds:*', handleCredsCallback);
bot.action('prodview:*', handleScopedProductViewCallback);
bot.action('credreveal:*', handleCredsCallback);
bot.action('copy:*', async (ctx) => {
  // Copy-to-clipboard is client-side; just acknowledge
  await sendMsg(ctx.chatId, `📋 Đã copy: <code>${ctx.callbackData?.replace('copy:', '') ?? ''}</code>`);
});

// ═══════════════════════════════════════════════════════════════
// 7. TASKS & REMINDERS
// ═══════════════════════════════════════════════════════════════
bot.command('tasks', handleTasksCommand);
bot.action('cmd:tasks', handleTasksCommand);
bot.action('tdone:*', handleTaskDoneAction);

// ═══════════════════════════════════════════════════════════════
// 8. SHORT LINKS (NEW)
// ═══════════════════════════════════════════════════════════════
bot.command('shortlinks', handleShortLinksCommand);
bot.command('newlink', handleNewLinkCommand);
bot.action('cmd:shortlinks', handleShortLinksCommand);
bot.action('slpage:*', handleShortLinksCommand); // Pagination MUST be before sl:*
bot.action('slw:*', handleShortLinkDetailCallback); // Wizard MUST be before sl:*
bot.action('sl:*', handleShortLinkDetailCallback);

// Catch-all for still-unmigrated menu callbacks.
bot.action('cmd:*', legacyBridge);

// ═══════════════════════════════════════════════════════════════
// 9. CANCEL — clears any active wizard session
// ═══════════════════════════════════════════════════════════════
bot.command('cancel', async (ctx) => {
  if (ctx.state.clearSession) ctx.state.clearSession();
  await sendMsg(ctx.chatId, '❌ Đã hủy thao tác. Gõ /start để quay lại menu.');
});
bot.action('cmd:cancel', async (ctx) => {
  if (ctx.state.clearSession) ctx.state.clearSession();
  await sendMsg(ctx.chatId, '❌ Đã hủy thao tác. Gõ /start để quay lại menu.');
});

// ═══════════════════════════════════════════════════════════════
// 10. LEGACY FALLBACK — wizards & unmigrated callbacks
// ═══════════════════════════════════════════════════════════════
bot.fallback(async (ctx) => {
  const text = ctx.text?.trim() ?? '';
  if (text && !text.startsWith('/')) {
    // ─── 1. Check Redis session (BotRouter-managed wizards) ───
    const session = ctx.state.session;
    if (session) {
      if (session.command === 'newlink') {
        ctx.args = text;
        await handleNewLinkCommand(ctx);
        if (ctx.state.clearSession) await ctx.state.clearSession();
        return;
      }
      if (session.command === 'newlink_full') {
        ctx.args = text;
        await handleFullCreateWizard(ctx);
        return;
      }
      if (session.command === 'duolingo_lookup') {
        ctx.args = text;
        await handleDuolingoCommand(ctx);
        if (ctx.state.clearSession) await ctx.state.clearSession();
        return;
      }
      // Other Redis-based sessions → delegate to legacy
      await legacy.handleBotUpdate(ctx.update);
      return;
    }

    // ─── 2. Check legacy in-memory session (newcustomer, neworder, etc.) ───
    // Legacy wizards store session in an in-memory Map, NOT Redis.
    // We MUST check this before smart-search, otherwise wizard text
    // input (e.g. customer name) gets routed to search.
    if (legacy.hasLegacySession(ctx.chatId)) {
      await legacy.handleBotUpdate(ctx.update);
      return;
    }

    // ─── 3. No active wizard → Smart text search ───
    await handleSmartTextRouter(ctx);
    return;
  }
  // All other commands/callbacks → legacy
  await legacy.handleBotUpdate(ctx.update);
});

// ═════════════════════════════════════════════════════════════════
// 11. AUTO-SETUP: Register / menu commands on module load
// ═════════════════════════════════════════════════════════════════
