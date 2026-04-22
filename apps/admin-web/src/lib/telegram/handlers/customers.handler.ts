import type { BotHandler } from '../bot-router';
import { editMsg, escapeHtml, formatDate, formatVnd, modernHeader, modernList, sendKb, sendMsg, type TelegramButton } from '../shared';
import { getTelegramCustomerDetail, getTelegramCustomerOrders, getTelegramDebtPage } from '@/domains/telegram';
import { listCustomers } from '@/lib/supabase/repositories/customers.repo';

function parseCustomerId(ctx: Parameters<BotHandler>[0]): string {
  const raw = ctx.args?.trim() || ctx.callbackData || '';
  if (!raw) return '';
  if (raw.startsWith('customer:')) return raw.replace('customer:', '').trim();
  if (raw.startsWith('runcmd:customer')) return raw.replace('runcmd:customer', '').trim();
  return raw;
}

function isEditContext(ctx: Parameters<BotHandler>[0]): boolean {
  return Boolean(ctx.messageId && ctx.callbackQueryId);
}

async function respond(ctx: Parameters<BotHandler>[0], text: string, keyboard: TelegramButton[][]) {
  if (isEditContext(ctx)) {
    await editMsg(ctx.chatId, ctx.messageId!, text, keyboard);
    return;
  }
  await sendKb(ctx.chatId, text, keyboard);
}

export const handleCustomerCommand: BotHandler = async (ctx) => {
  if (ctx.args?.trim()) {
    return handleCustomerDetail(ctx);
  }

  const accountId = ctx.accountId ?? '';
  const customers = (await listCustomers(accountId)).slice(0, 10);

  if (!customers.length) {
    await respond(
      ctx,
      [
        modernHeader('KHÁCH HÀNG', '👤'),
        '',
        'Chưa có khách hàng nào trong account hiện tại.',
      ].join('\n'),
      [
        [{ text: '🔍 Tìm khách hàng', callback_data: 'cmd:search_prompt' }, { text: '➕ Tạo mới', callback_data: 'cmd:newcustomer' }],
        [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
      ]
    );
    return;
  }

  const lines = [
    modernHeader('KHÁCH HÀNG GẦN NHẤT', '👤'),
    '',
    ...customers.map((customer, index) =>
      modernList(
        `<b>${index + 1}.</b> ${escapeHtml(customer.full_name)}`,
        `${escapeHtml(customer.type)}${customer.contacts?.[0] ? ` | <code>${escapeHtml(customer.contacts[0].value)}</code>` : ''}`,
        '•'
      )
    ),
  ];

  const buttons: TelegramButton[][] = customers.map((customer) => [
    { text: `👤 ${customer.full_name}`, callback_data: `customer:${customer.id}` },
  ]);
  buttons.push(
    [{ text: '🔍 Tìm khách hàng', callback_data: 'cmd:search_prompt' }, { text: '💳 Công nợ', callback_data: 'cmd:debt' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }]
  );

  await respond(ctx, lines.join('\n'), buttons);
};

export const handleCustomerDetail: BotHandler = async (ctx) => {
  const customerId = parseCustomerId(ctx);
  if (!customerId) {
    await sendMsg(ctx.chatId, '⚠️ Thiếu ID khách hàng.');
    return;
  }

  const detail = await getTelegramCustomerDetail(customerId, ctx.accountId ?? '');
  if (!detail) {
    await respond(ctx, '❌ Không tìm thấy thông tin khách hàng.', [
      [{ text: '🔍 Tìm', callback_data: 'cmd:search_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const contactLines = detail.contacts.slice(0, 4).map((contact) =>
    modernList(
      `<b>${escapeHtml(contact.channel)}</b>`,
      `<code>${escapeHtml(contact.value)}</code>`,
      '•'
    )
  );

  const orderLines = detail.recent_orders.map((order) =>
    modernList(
      `<code>${escapeHtml(order.order_code ?? '')}</code>`,
      `${formatVnd(order.total_amount_vnd ?? 0)} | ${escapeHtml(order.status ?? 'N/A')}`,
      '•'
    )
  );

  const sections = [
    modernHeader('KHÁCH HÀNG', '👤'),
    '',
    `<blockquote><b>Tên:</b> <code>${escapeHtml(detail.full_name)}</code>`,
    `Phân loại: <b>${escapeHtml(detail.type)}</b>`,
    `Công nợ: <b>${formatVnd(detail.debt_amount_vnd ?? 0)}</b>`,
    `Ngày tạo: ${formatDate(detail.created_at)}`,
    detail.notes ? `Ghi chú: ${escapeHtml(detail.notes.slice(0, 120))}` : '',
    `</blockquote>`,
    ...(contactLines.length ? ['', modernHeader(`LIÊN HỆ (${contactLines.length})`, '📞'), '', ...contactLines] : []),
    ...(orderLines.length ? ['', modernHeader(`GIAO DỊCH GẦN ĐÂY (${orderLines.length})`, '📋'), '', ...orderLines] : []),
  ].filter(Boolean);

  const buttons: TelegramButton[][] = [
    [{ text: '📦 Xem đơn KH này', callback_data: `cmd:customer_orders:${detail.id}` }],
    [{ text: '🔍 Tìm mới', callback_data: 'cmd:search_prompt' }, { text: '👥 Danh sách KH', callback_data: 'cmd:customer' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  await respond(ctx, sections.join('\n'), buttons);
};

export const handleCustomerOrdersAction: BotHandler = async (ctx) => {
  const accountId = ctx.accountId ?? '';
  const customerId = (ctx.callbackData ?? '').replace('cmd:customer_orders:', '').trim() || ctx.args?.trim() || '';
  if (!customerId) {
    await sendMsg(ctx.chatId, '⚠️ Thiếu ID khách hàng.');
    return;
  }

  const [detail, orders] = await Promise.all([
    getTelegramCustomerDetail(customerId, accountId),
    getTelegramCustomerOrders(customerId, accountId),
  ]);

  if (!detail) {
    await respond(ctx, '❌ Không tìm thấy khách hàng.', [
      [{ text: '👥 Danh sách KH', callback_data: 'cmd:customer' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const lines = [
    modernHeader(`ĐƠN CỦA ${detail.full_name.toUpperCase()}`, '📦'),
    '',
    ...(orders.length
      ? orders.map((order) =>
          modernList(
            `<code>${escapeHtml(order.order_code ?? '')}</code>`,
            `${escapeHtml(order.product_name_snapshot ?? 'N/A')} | ${formatVnd(order.total_amount_vnd ?? 0)} | ${escapeHtml(order.status ?? 'N/A')}`,
            '•'
          )
        )
      : ['Khách hàng này chưa có đơn nào.']),
  ];

  const buttons: TelegramButton[][] = orders
    .filter((order) => order.order_code)
    .slice(0, 6)
    .map((order) => [{ text: `📋 ${order.order_code}`, callback_data: `detail:${order.order_code}` }]);
  buttons.push(
    [{ text: '↩️ Quay lại KH', callback_data: `customer:${customerId}` }, { text: '👥 Danh sách KH', callback_data: 'cmd:customer' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }]
  );

  await respond(ctx, lines.join('\n'), buttons);
};

export const handleDebtCommand: BotHandler = async (ctx) => {
  const callbackData = ctx.callbackData ?? '';
  const page = callbackData.startsWith('cmd:debt:page:')
    ? Math.max(Number.parseInt(callbackData.split(':').pop() ?? '0', 10) || 0, 0)
    : 0;

  const debtPage = await getTelegramDebtPage(ctx.accountId ?? '', page);
  if (!debtPage.total) {
    await respond(ctx, '✅ Không có khách hàng nào còn nợ.', [
      [{ text: '📊 Dashboard', callback_data: 'cmd:stats' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const lines = [
    modernHeader('DANH SÁCH NỢ', '💳'),
    '',
    `🔴 Tổng nợ: <b>${formatVnd(debtPage.grand_total_vnd)}</b> | ${debtPage.total} KH`,
    '',
    ...debtPage.items.map((item, index) =>
      modernList(
        `<b>${debtPage.page * 10 + index + 1}.</b> ${escapeHtml(item.customer_name)}`,
        `${formatVnd(item.total_debt_vnd)} | ${item.order_count} đơn`,
        '•'
      )
    ),
  ];

  const buttons: TelegramButton[][] = debtPage.items.slice(0, 3).map((item) => [
    { text: `👤 ${item.customer_name.slice(0, 12)}`, callback_data: `customer:${item.customer_id}` },
    { text: `💳 ${formatVnd(item.total_debt_vnd)}`, callback_data: `customer:${item.customer_id}` },
  ]);

  const navRow: TelegramButton[] = [];
  if (debtPage.page > 0) {
    navRow.push({ text: '◀️ Trước', callback_data: `cmd:debt:page:${debtPage.page - 1}` });
  }
  navRow.push({ text: `${debtPage.page + 1}/${debtPage.total_pages}`, callback_data: 'noop' });
  if (debtPage.page + 1 < debtPage.total_pages) {
    navRow.push({ text: 'Tiếp ▶️', callback_data: `cmd:debt:page:${debtPage.page + 1}` });
  }

  buttons.push(
    navRow,
    [{ text: '🔍 Tìm khách hàng', callback_data: 'cmd:search_prompt' }, { text: '📊 Dashboard', callback_data: 'cmd:stats' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }]
  );

  await respond(ctx, lines.join('\n'), buttons);
};
