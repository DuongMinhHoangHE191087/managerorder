import type { BotContext } from '../bot-router';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendKb, editMsg, escapeHtml, type TelegramButton, modernHeader, modernList, modernDetail, progressBar } from '../shared';
import { daysUntil } from '@/lib/services/telegram-bot.helpers';

const PAGE_SIZE = 10;

/** Show free slots with pagination — handles kho:slots and kho:slots:page:N */
export async function handleSlotsAction(ctx: BotContext) {
  const { chatId, callbackData, messageId, callbackQueryId, accountId } = ctx;

  // Parse page from callback data: "kho:slots" or "kho:slots:page:2"
  let page = 0;
  const data = callbackData ?? '';
  const pageMatch = data.match(/page:(\d+)/);
  if (pageMatch) page = parseInt(pageMatch[1], 10);

  const { data: accounts } = await supabaseAdmin.from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, provider')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('expires_at', { ascending: false });

  const now = new Date();
  const avail = (accounts ?? []).filter(
    (a) => a.used_slots < a.max_slots && (!a.expires_at || new Date(a.expires_at) > now),
  );
  const total = avail.length;

  if (!total) {
    const msg = '❌ Không có slot trống.';
    const kb: TelegramButton[][] = [
      [{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ];
    if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const paginated = avail.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const lines = paginated.map((a, i) => {
    const free = a.max_slots - a.used_slots;
    const exp = a.expires_at ? `${daysUntil(a.expires_at)}d` : '∞';
    return modernList(
      `${safePage * PAGE_SIZE + i + 1}. <code>${escapeHtml(a.email)}</code>`,
      `Trống: ${free}/${a.max_slots} | HSD: ${exp}`,
      '🔑'
    );
  });

  const navRow: TelegramButton[] = [];
  if (safePage > 0) navRow.push({ text: '◀️ Trước', callback_data: `kho:slots:page:${safePage - 1}` });
  navRow.push({ text: `${safePage + 1}/${totalPages}`, callback_data: 'noop' });
  if (safePage < totalPages - 1) navRow.push({ text: 'Tiếp ▶️', callback_data: `kho:slots:page:${safePage + 1}` });

  const msg = [
    modernHeader(`SLOT TRỐNG (${total} TK)`, '🔗'),
    ``,
    ...lines
  ].join('\n');
  const kb: TelegramButton[][] = [
    navRow,
    [{ text: '🔐 Credentials', callback_data: 'kho:creds' }, { text: '🔗 Gán kho', callback_data: 'cmd:allocate' }],
    [{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
  else await sendKb(chatId, msg, kb);
}

export async function handleKhoCommand(ctx: BotContext) {
  const { chatId, messageId } = ctx;
  const msg = `${modernHeader('KHO HÀNG', '📦')}\n\n<blockquote>Chọn chức năng quản lý bên dưới:</blockquote>`;
  const kb = [
    [{ text: '📊 Thống kê kho', callback_data: 'kho:stats' }],
    [{ text: '🔗 Slot trống', callback_data: 'kho:slots' }],
    [{ text: '🔐 Credentials', callback_data: 'kho:creds' }],
    [{ text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  if (messageId && ctx.callbackQueryId) {
    await editMsg(chatId, messageId, msg, kb);
  } else {
    await sendKb(chatId, msg, kb);
  }
}

export async function handleWarehouseAction(ctx: BotContext) {
  const { chatId, accountId, messageId } = ctx;
  const { data: accounts } = await supabaseAdmin.from('source_accounts')
    .select('id, max_slots, used_slots, expires_at')
    .eq('account_id', accountId)
    .is('deleted_at', null);
  const all = accounts ?? [];
  const totalSlots = all.reduce((s, a) => s + a.max_slots, 0);
  const usedSlots = all.reduce((s, a) => s + a.used_slots, 0);
  const freeSlots = totalSlots - usedSlots;
  const pct = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
  
  const expSoon = all.filter(a => a.expires_at && daysUntil(a.expires_at) <= 7 && daysUntil(a.expires_at) > 0).length;
  const expired = all.filter(a => a.expires_at && new Date(a.expires_at) < new Date()).length;
  
  const msg = [
    modernHeader('THỐNG KÊ KHO', '📦'),
    ``,
    `<blockquote>🗄 <b>TỔNG QUAN DUNG LƯỢNG</b>`,
    modernDetail(`Tài khoản nguồn`, `${all.length}`, '•'),
    modernDetail(`Slot đã dùng`, `${usedSlots}/${totalSlots}`, '•'),
    modernDetail(`Slot trống`, `${freeSlots}`, '•'),
    ``,
    `📈 Tỷ lệ lấp đầy: <b>${pct}%</b>`,
    `[${progressBar(usedSlots, totalSlots)}]</blockquote>`,
    ``,
    `<blockquote>⚠️ <b>CẢNH BÁO</b>`,
    modernDetail(`Sắp hết hạn (7 ngày)`, `${expSoon} TK`, '•'),
    modernDetail(`Đã hết hạn`, `${expired} TK`, '•'),
    `</blockquote>`,
  ].join('\n');

  const kb = [
    [{ text: '🔗 Xem slot trống', callback_data: 'kho:slots' }, { text: '🔐 Credentials', callback_data: 'kho:creds' }],
    [{ text: '⬅️ Quay lại', callback_data: 'cmd:kho' }, { text: '🏠 Menu chính', callback_data: 'cmd:start' }],
  ];

  if (messageId && ctx.callbackQueryId) {
    await editMsg(chatId, messageId, msg, kb);
  } else {
    await sendKb(chatId, msg, kb);
  }
}
