import type { BotContext } from '../bot-router';
import { supabaseAdmin, sendMsg, sendKb, editMsg, escapeHtml, formatVnd, formatDate, modernHeader, modernList, type TelegramButton } from '../shared';
import { PAGE_SIZE, daysUntil } from '@/lib/services/telegram-bot.helpers';
import { formatDateCustom } from "@/lib/utils";
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';
import { getTelegramOrderDetail } from '@/domains/telegram';

type TelegramCustomerRow = {
  id: string;
  full_name: string;
};

async function loadTelegramOrderCustomerMap(accountId: string, customerIds: string[]) {
  return loadRowsByIds<TelegramCustomerRow>(
    supabaseAdmin,
    'customers',
    accountId,
    customerIds,
    'id, full_name',
  );
}

export async function handleOrdersCommand(ctx: BotContext) {
  const { chatId } = ctx;
  const BOT_ACCOUNT_ID = ctx.accountId ?? '';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekLater = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  
  const [tdy, exp, expd] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now.toISOString()).lte('expires_at', weekLater),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID),
  ]);

  const tdyC = tdy.count ?? 0, expC = exp.count ?? 0, expdC = expd.count ?? 0;
  
  const msgText = [
    `◈━━━ 📦 <b>QUẢN LÝ ĐƠN HÀNG</b> ━━━◈`,
    ``,
    `<blockquote>` +
    `📋 Hôm nay: <b>${tdyC}</b> đơn\n` +
    `⏰ Sắp hạn 7 ngày: <b>${expC}</b>\n` +
    `❌ Đã hết hạn: <b>${expdC}</b></blockquote>`,
    ``,
    `👇 <i>Chọn danh mục bên dưới:</i>`,
  ].join('\n');
  
  const btns: TelegramButton[][] = [
    [{ text: `📋 Hôm nay (${tdyC})`, callback_data: 'orders:today' }],
    [{ text: `⏰ Sắp hạn (${expC})`, callback_data: 'orders:expiring' }],
    [{ text: `❌ Hết hạn (${expdC})`, callback_data: 'orders:expired' }],
    [{ text: '🔍 Tìm đơn', callback_data: 'cmd:search_prompt' }, { text: '➕ Tạo đơn mới', callback_data: 'cmd:neworder' }],
    [{ text: '🔗 Gán kho', callback_data: 'cmd:allocate' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  if (ctx.messageId && ctx.callbackQueryId) {
    await editMsg(chatId, ctx.messageId, msgText, btns);
  } else {
    await sendKb(chatId, msgText, btns);
  }
}

export async function handleTodayAction(ctx: BotContext) {
  const { chatId, callbackData } = ctx;
  const BOT_ACCOUNT_ID = ctx.accountId ?? '';
  let page = 0;
  if (callbackData && callbackData.includes(':page:')) {
    page = parseInt(callbackData.split(':page:')[1] ?? '0');
  }

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const { count: totalCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID);
  
  const total = totalCount ?? 0;
  if (!total) { await sendMsg(chatId, '📭 Chưa có đơn hôm nay.'); return; }
  
  const { data: orders } = await supabaseAdmin.from('orders')
    .select('id, order_code, status, total_amount_vnd, created_at, product_name_snapshot, customer_id')
    .gte('created_at', todayStart).eq('account_id', BOT_ACCOUNT_ID).order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
  if (!orders?.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  
  const statusE: Record<string, string> = { active: '🟢', paid: '💳', pending_payment: '🟠', provisioning: '🛠', expired: '🔴', refunded: '🟣', draft: '⬜' };
  const customerMap = await loadTelegramOrderCustomerMap(
    BOT_ACCOUNT_ID,
    [...new Set(orders.map((order) => order.customer_id).filter(Boolean))],
  );

  const lines = orders.map((o, i) => {
    const c = customerMap.get(o.customer_id) ?? null;
    const time = formatDateCustom(o.created_at, { timeZone: "Asia/Ho_Chi_Minh" }, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const statusText = (o.status || '').toUpperCase();
    return `<b>${page * PAGE_SIZE + i + 1}.</b> ${statusE[o.status] ?? '⚪'} <code>${escapeHtml(o.order_code ?? '')}</code>\n<blockquote>👤 <b>${escapeHtml(c?.full_name ?? 'N/A')}</b>\n📦 ${escapeHtml(o.product_name_snapshot ?? '')}\n💰 <b>${formatVnd(o.total_amount_vnd)}</b>\n⏰ ${time} | ${statusText}</blockquote>`;
  });
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trang trước', callback_data: `orders:today:page:${page - 1}` });
  navRow.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Trang tiếp ▶️', callback_data: `orders:today:page:${page + 1}` });
  
  const btns: TelegramButton[][] = [navRow];
  btns.push([{ text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  
  const msgText = [`◈━━━ 📋 <b>ĐƠN HÔM NAY</b> (${total}) ━━━◈`, ``, ...lines].join('\n\n');
  if (ctx.messageId && ctx.callbackQueryId) {
    await editMsg(chatId, ctx.messageId, msgText, btns);
  } else {
    await sendKb(chatId, msgText, btns);
  }
}

export async function handleExpiringAction(ctx: BotContext) {
  const { chatId, callbackData } = ctx;
  const BOT_ACCOUNT_ID = ctx.accountId ?? '';
  let page = 0;
  if (callbackData && callbackData.includes(':page:')) {
    page = parseInt(callbackData.split(':page:')[1] ?? '0');
  }

  const now = new Date().toISOString();
  const weekLater = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { count: totalCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now).lte('expires_at', weekLater);
  
  const total = totalCount ?? 0;
  if (!total) { await sendMsg(chatId, '✅ Không có đơn sắp hạn trong 7 ngày.'); return; }
  
  const { data: orders } = await supabaseAdmin.from('orders')
    .select('id, order_code, expires_at, product_name_snapshot, customer_id')
    .eq('status', 'active').eq('account_id', BOT_ACCOUNT_ID).gte('expires_at', now).lte('expires_at', weekLater).order('expires_at')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
  if (!orders?.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  
  const customerMap = await loadTelegramOrderCustomerMap(
    BOT_ACCOUNT_ID,
    [...new Set(orders.map((order) => order.customer_id).filter(Boolean))],
  );

  const lines = orders.map((o, i) => {
    const c = customerMap.get(o.customer_id) ?? null;
    const remaining = daysUntil(o.expires_at);
    const urgency = remaining <= 2 ? '🔴' : remaining <= 4 ? '🟠' : '🟡';
    return `<b>${page * PAGE_SIZE + i + 1}.</b> ${urgency} <code>${escapeHtml(o.order_code ?? '')}</code>\n<blockquote>👤 <b>${escapeHtml(c?.full_name ?? 'N/A')}</b>\n📦 ${escapeHtml(o.product_name_snapshot ?? '')}\n⏰ Còn <b>${remaining} ngày</b> | Hết hạn: ${formatDate(o.expires_at)}</blockquote>`;
  });
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trang trước', callback_data: `orders:expiring:page:${page - 1}` });
  navRow.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Trang tiếp ▶️', callback_data: `orders:expiring:page:${page + 1}` });
  
  const btns: TelegramButton[][] = [navRow];
  btns.push([{ text: '📋 Hôm nay', callback_data: 'orders:today' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  
  const msgText = [`◈━━━ ⏰ <b>SẮP HẾT HẠN</b> (${total}) ━━━◈`, ``, ...lines].join('\n\n');
  if (ctx.messageId && ctx.callbackQueryId) {
    await editMsg(chatId, ctx.messageId, msgText, btns);
  } else {
    await sendKb(chatId, msgText, btns);
  }
}

export async function handleExpiredAction(ctx: BotContext) {
  const { chatId, callbackData } = ctx;
  const BOT_ACCOUNT_ID = ctx.accountId ?? '';
  let page = 0;
  if (callbackData && callbackData.includes(':page:')) {
    page = parseInt(callbackData.split(':page:')[1] ?? '0');
  }

  const { count: totalCount } = await supabaseAdmin.from('orders')
    .select('id', { count: 'exact', head: true }).eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID);

  const total = totalCount ?? 0;
  if (!total) { await sendMsg(chatId, '✅ Không có đơn hết hạn.'); return; }

  const { data: orders } = await supabaseAdmin.from('orders')
    .select('id, order_code, expires_at, product_name_snapshot, customer_id')
    .eq('status', 'expired').eq('account_id', BOT_ACCOUNT_ID).order('expires_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
  if (!orders?.length) { await sendMsg(chatId, '📭 Hết dữ liệu.'); return; }
  
  const customerMap = await loadTelegramOrderCustomerMap(
    BOT_ACCOUNT_ID,
    [...new Set(orders.map((order) => order.customer_id).filter(Boolean))],
  );

  const lines = orders.map((o, i) => {
    const c = customerMap.get(o.customer_id) ?? null;
    return `<b>${page * PAGE_SIZE + i + 1}.</b> 🔴 <code>${escapeHtml(o.order_code ?? '')}</code>\n<blockquote>👤 ${escapeHtml(c?.full_name ?? 'N/A')}\n⏰ Hết hạn: ${formatDate(o.expires_at)}</blockquote>`;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Trang trước', callback_data: `orders:expired:page:${page - 1}` });
  navRow.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages - 1) navRow.push({ text: 'Trang tiếp ▶️', callback_data: `orders:expired:page:${page + 1}` });
  
  const btns: TelegramButton[][] = [navRow];
  btns.push([{ text: '📋 Hôm nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }]);
  btns.push([{ text: '📦 Đơn hàng', callback_data: 'cmd:orders' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);

  const msgText = [`◈━━━ ❌ <b>ĐÃ HẾT HẠN</b> (${total}) ━━━◈`, ``, ...lines].join('\n');
  if (ctx.messageId && ctx.callbackQueryId) {
    await editMsg(chatId, ctx.messageId, msgText, btns);
  } else {
    await sendKb(chatId, msgText, btns);
  }
}

export async function handleDetailCommand(ctx: BotContext) {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  let code = ctx.args?.trim() || '';

  if (!code && ctx.callbackData) {
    code = ctx.callbackData.replace('detail:', '').trim();
  }

  if (!code) {
    await sendMsg(chatId, '⚠️ Nhập mã đơn.\nVD: <code>/detail ORD-2603001</code>');
    return;
  }

  try {
    const result = await getTelegramOrderDetail(code, accountId);

    if (result.kind === 'missing') {
      await sendKb(chatId, `❌ Không tìm thấy: <code>${escapeHtml(code)}</code>`, [
        [{ text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]);
      return;
    }

    if (result.kind === 'candidates') {
      const lines = [
        modernHeader('NHIỀU ĐƠN KHỚP', '📋'),
        '',
        `Tìm thấy nhiều đơn gần khớp với <code>${escapeHtml(code)}</code>. Chọn đúng đơn bên dưới:`,
        '',
        ...result.candidates.map((candidate, index) =>
          modernList(
            `<b>${index + 1}.</b> <code>${escapeHtml(candidate.order_code ?? '')}</code>`,
            `👤 ${escapeHtml(candidate.customer?.full_name ?? 'N/A')} | 💰 ${formatVnd(candidate.total_amount_vnd ?? 0)}`,
            '•'
          )
        ),
      ];

      const buttons: TelegramButton[][] = result.candidates
        .filter((candidate) => candidate.order_code)
        .map((candidate) => [{ text: `📋 ${candidate.order_code}`, callback_data: `detail:${candidate.order_code}` }]);
      buttons.push([{ text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);

      const text = lines.join('\n');
      if (ctx.messageId && ctx.callbackQueryId) {
        await editMsg(chatId, ctx.messageId, text, buttons);
      } else {
        await sendKb(chatId, text, buttons);
      }
      return;
    }

    const order = result.order;
    const statusLabels: Record<string, string> = {
      active: '🟢 Active',
      paid: '💳 Đã TT',
      pending_payment: '🟠 Chờ TT',
      provisioning: '🛠 Cấp kho',
      expired: '🔴 Hết hạn',
      refunded: '🟣 Hoàn tiền',
      draft: '⬜ Nháp',
    };
    const productLabel = order.product_labels.join(', ') || 'N/A';

    const sections: string[] = [
      modernHeader('CHI TIẾT ĐƠN', '📋'),
      '',
      `<blockquote>📦 <b>Mã (Code):</b> <code>${escapeHtml(order.order_code ?? '')}</code>`,
      `Trạng thái: <b>${statusLabels[order.status ?? ''] ?? order.status ?? 'N/A'}</b>`,
      `👤 <b>Khách:</b> ${escapeHtml(order.customer?.full_name ?? 'N/A')}`,
      `🏷 <b>Sản phẩm:</b> ${escapeHtml(productLabel)}`,
      `💰 <b>Tổng:</b> ${formatVnd(order.total_amount_vnd ?? 0)}`,
      `💳 <b>Đã TT:</b> ${formatVnd(order.total_paid ?? 0)}${order.outstanding_amount_vnd > 0 ? ` | 🔴 Công nợ: <b>${formatVnd(order.outstanding_amount_vnd)}</b>` : ''}`,
      `📅 <b>Ngày tạo:</b> ${formatDate(order.created_at)}`,
      order.expires_at ? `⏰ <b>Hạn:</b> ${formatDate(order.expires_at)} (còn ${daysUntil(order.expires_at)} ngày)` : '',
      `</blockquote>`,
    ];

    if (order.customer?.contacts.length) {
      sections.push('', modernHeader(`LIÊN HỆ (${order.customer.contacts.length})`, '📞'), '');
      for (const contact of order.customer.contacts.slice(0, 4)) {
        sections.push(modernList(
          `<b>${escapeHtml(contact.channel)}</b>`,
          `<code>${escapeHtml(contact.value)}</code>`,
          '•'
        ));
      }
    }

    if (order.items.length) {
      sections.push('', modernHeader(`ITEMS (${order.items.length})`, '🏷'), '');
      for (const item of order.items) {
        sections.push(modernList(
          `<code>${escapeHtml(item.customer_nick_used ?? 'N/A')}</code>`,
          `${escapeHtml(item.product_name_snapshot ?? productLabel)}${item.source_account_email ? ` | Kho: <code>${escapeHtml(item.source_account_email)}</code>` : ' | Chưa cấp kho'}`,
          '•'
        ));
      }
    }

    if (order.notes) {
      sections.push(`\n<blockquote>📝 <b>Ghi chú:</b>\n${escapeHtml(String(order.notes).slice(0, 200))}</blockquote>`);
    }

    const buttons: TelegramButton[][] = [
      [{ text: '💳 Thanh toán', callback_data: `pay:${order.order_code}` }, { text: '📊 Đổi status', callback_data: `ostatus:${order.order_code}` }],
      [{ text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '📦 Đơn', callback_data: 'cmd:orders' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ];

    const text = sections.filter(Boolean).join('\n');
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, text, buttons);
    } else {
      await sendKb(chatId, text, buttons);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Orders Handler] Error fetching order ${code}:`, error);
    await sendKb(chatId, `❌ Lỗi khi truy vấn đơn hàng: <code>${escapeHtml(message)}</code>`, [
      [{ text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
  }
}

