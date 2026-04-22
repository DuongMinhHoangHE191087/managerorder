// ============================================================
// FIND HANDLER — Smart multi-entity search
// ============================================================
import type { BotHandler } from '../bot-router';
import {
  escapeHtml,
  formatVnd,
  modernHeader,
  modernList,
  sendKb,
  type TelegramButton,
} from '../shared';
import { formatDateShort } from '@/lib/utils';
import { searchTelegramEntities } from '@/domains/telegram';
import { handleDetailCommand } from './orders.handler';

const STATUS_EMOJI: Record<string, string> = {
  active: '🟢',
  paid: '💳',
  pending_payment: '🟠',
  provisioning: '🛠',
  expired: '🔴',
  refunded: '🟣',
  draft: '⬜',
};

export const handleFindCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const query = ctx.args?.trim() || ctx.text?.trim() || '';
  const accountId = ctx.accountId ?? '';

  if (!query || query === '/find' || query === '/lookup' || query === '/tim') {
    await sendKb(
      chatId,
      [
        `🔍 <b>TÌM KIẾM THÔNG MINH</b>`,
        ``,
        `<blockquote>Gõ bất kỳ từ khóa để tìm:`,
        ``,
        `📦 <b>Đơn hàng:</b> mã đơn, tên SP`,
        `👤 <b>Khách hàng:</b> tên, SĐT, email`,
        `🏷 <b>Nick:</b> nick game, nick dịch vụ`,
        `📧 <b>Kho:</b> email kho hàng`,
        `🛍 <b>Sản phẩm:</b> tên sản phẩm</blockquote>`,
        ``,
        `💡 VD: <code>/find hoang</code> hoặc <code>0987654321</code>`,
        `💡 Gõ text bất kỳ (không cần /find) → tự tìm`,
      ].join('\n'),
      [
        [{ text: '📦 Đơn hôm nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }],
        [{ text: '👤 Khách hàng', callback_data: 'cmd:customer' }, { text: '💳 Công nợ', callback_data: 'cmd:debt' }],
        [{ text: '📦 Kho hàng', callback_data: 'cmd:kho' }, { text: '🏷 Sản phẩm', callback_data: 'cmd:products' }],
        [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]
    );
    return;
  }

  const data = await searchTelegramEntities(query, accountId);
  const results: string[] = [];
  const actionButtons: TelegramButton[][] = [];
  const totalFound =
    data.orders.length +
    data.customers.length +
    data.nickMatches.length +
    data.warehouses.length +
    data.products.length;

  if (data.orders.length) {
    results.push(modernHeader(`ĐƠN HÀNG (${data.orders.length})`, '📦'), '');
    for (const order of data.orders) {
      results.push(
        modernList(
          `${STATUS_EMOJI[order.status ?? ''] ?? '⚪'} <code>${escapeHtml(order.order_code ?? '')}</code>`,
          `👤 ${escapeHtml(order.customer?.full_name ?? 'N/A').slice(0, 15)} | 💰 ${formatVnd(order.total_amount_vnd ?? 0)}`,
          '•'
        )
      );
      if (order.order_code) {
        actionButtons.push([{ text: `📋 ${order.order_code}`, callback_data: `detail:${order.order_code}` }]);
      }
    }
  }

  if (data.customers.length) {
    const typeLabels: Record<string, string> = { retail: '🛒', wholesale: '🏭', agency: '🏢' };
    results.push('', modernHeader(`KHÁCH HÀNG (${data.customers.length})`, '👤'), '');
    for (const customer of data.customers) {
      const nicks = customer.nicks_registry?.slice(0, 3).join(', ') ?? '';
      const contact = customer.matched_contact ?? customer.primary_contact ?? '';
      results.push(
        modernList(
          `<b>${escapeHtml(customer.full_name)}</b>`,
          `📦 ${customer.order_count} đơn${contact ? ` | ${escapeHtml(contact)}` : ''}${nicks ? `\n  🏷 Nick: ${escapeHtml(nicks)}` : ''}`,
          typeLabels[customer.type] ?? '👤'
        )
      );
      actionButtons.push([{ text: `👤 ${customer.full_name}`, callback_data: `customer:${customer.id}` }]);
    }
  }

  if (data.nickMatches.length) {
    results.push('', modernHeader(`NICK (${data.nickMatches.length})`, '🏷'), '');
    for (const item of data.nickMatches) {
      results.push(
        modernList(
          `<code>${escapeHtml(item.customer_nick_used ?? '')}</code>`,
          `📋 ${escapeHtml(item.order?.order_code ?? '')} | 👤 ${escapeHtml(item.order?.customer?.full_name ?? 'N/A')}`,
          '•'
        )
      );
      if (item.order?.order_code) {
        actionButtons.push([{ text: `📋 ${item.order.order_code}`, callback_data: `detail:${item.order.order_code}` }]);
      }
    }
  }

  if (data.warehouses.length) {
    results.push('', modernHeader(`KHO HÀNG (${data.warehouses.length})`, '📦'), '');
    for (const warehouse of data.warehouses) {
      const freeSlots = warehouse.max_slots - warehouse.used_slots;
      const provider = warehouse.provider ? ` | 🏢 ${escapeHtml(warehouse.provider)}` : '';
      const expiresAt = warehouse.expires_at ? ` | Hạn: ${formatDateShort(warehouse.expires_at)}` : '';
      results.push(
        modernList(
          `<code>${escapeHtml(warehouse.email)}</code>`,
          `🟢 ${freeSlots}/${warehouse.max_slots} slot trống${provider}${expiresAt}`,
          '•'
        )
      );
    }
  }

  if (data.products.length) {
    results.push('', modernHeader(`SẢN PHẨM (${data.products.length})`, '🛍'), '');
    for (const product of data.products) {
      results.push(
        modernList(
          `<b>${escapeHtml(product.name)}</b>`,
          `${formatVnd(product.sell_price_vnd ?? 0)}`,
          '•'
        )
      );
    }
  }

  if (!results.length) {
    await sendKb(
      chatId,
      [
        `❌ Không tìm thấy: <code>${escapeHtml(query)}</code>`,
        ``,
        `💡 <b>Thử:</b>`,
        `  • Tên KH, SĐT, email`,
        `  • Mã đơn (ORD-xxxx)`,
        `  • Nick game, email kho`,
        `  • Tên sản phẩm`,
      ].join('\n'),
      [
        [{ text: '👤 Tìm KH', callback_data: 'cmd:customer' }, { text: '📦 Xem đơn', callback_data: 'cmd:orders' }],
        [{ text: '📦 Xem kho', callback_data: 'cmd:kho' }, { text: '🏷 Sản phẩm', callback_data: 'cmd:products' }],
        [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]
    );
    return;
  }

  const buttons = actionButtons.slice(0, 5);
  buttons.push(
    [{ text: '🔍 Tìm lại', callback_data: 'cmd:search_prompt' }, { text: '👤 Tìm KH', callback_data: 'cmd:customer' }],
    [{ text: '📦 Xem đơn', callback_data: 'cmd:orders' }, { text: '📦 Xem kho', callback_data: 'cmd:kho' }],
    [{ text: '🏷 Sản phẩm', callback_data: 'cmd:products' }, { text: '➕ Tạo nhanh', callback_data: 'cmd:create_menu' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }]
  );

  await sendKb(
    chatId,
    [modernHeader(`KẾT QUẢ TÌM KIẾM — "${escapeHtml(query)}" (${totalFound})`, '🔍'), '', ...results].join('\n'),
    buttons
  );
};

export const handleSmartTextRouter: BotHandler = async (ctx) => {
  const text = ctx.text?.trim() ?? '';
  if (!text) return;

  if (/^ORD-\d+/i.test(text)) {
    ctx.args = text;
    return handleDetailCommand(ctx);
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    ctx.args = text;
    return handleFindCommand(ctx);
  }

  if (/^0\d{9,10}$/.test(text)) {
    ctx.args = text;
    return handleFindCommand(ctx);
  }

  if (/duolingo\.com\/profile\//i.test(text)) {
    const match = text.match(/duolingo\.com\/profile\/([^/?#\s]+)/i);
    if (match) {
      ctx.args = match[1];
      const { handleDuolingoCommand } = await import('./utility.handler');
      return handleDuolingoCommand(ctx);
    }
  }

  if (/facebook\.com\//i.test(text)) {
    ctx.args = text;
    const { handleFbidCommand } = await import('./utility.handler');
    return handleFbidCommand(ctx);
  }

  ctx.args = text;
  return handleFindCommand(ctx);
};
