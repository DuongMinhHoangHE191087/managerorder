/* eslint-disable @typescript-eslint/no-explicit-any */
// Dashboard handler: /start, /stats, /summary, /help, create menu, utilities
import type { BotHandler } from '../bot-router';
import { getCache, setCache } from '@/lib/redis/client';
import {
  supabaseAdmin,
  sendMsg as _sendMsg, sendKb, sendKbMenu, formatVnd, getGreeting,
  setMyCommands,
  modernHeader, modernList, modernDetail, MODERN_SEPARATOR,
  type TelegramButton, type TelegramReplyButton, type BotCommand,
} from '../shared';
import { formatDateCustom } from "@/lib/utils";

const DASHBOARD_CACHE_TTL_SECONDS = 12;

function sumRevenueRows(rows: Array<{ total_amount_vnd?: number | null }>) {
  let total = 0;
  for (const row of rows ?? []) {
    total += row.total_amount_vnd ?? 0;
  }
  return total;
}

function sumDebtRows(rows: Array<{ total_amount_vnd?: number | null; total_paid?: number | null }>) {
  let total = 0;
  for (const row of rows ?? []) {
    total += (row.total_amount_vnd ?? 0) - (row.total_paid ?? 0);
  }
  return total;
}

function summarizeSlotUsage(rows: Array<{ max_slots?: number | null; used_slots?: number | null }>) {
  let totalSlots = 0;
  let usedSlots = 0;

  for (const row of rows ?? []) {
    totalSlots += row.max_slots ?? 0;
    usedSlots += row.used_slots ?? 0;
  }

  return {
    totalSlots,
    usedSlots,
    slotPct: totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0,
  };
}

/// ─── /start (Dashboard) ────────────────────────────────────
export const handleStartCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  const cacheKey = `telegram:dashboard:start:${accountId}`;

  const cached = await getCache<{ msg: string; keyboard: TelegramButton[][] }>(cacheKey);
  if (cached) {
    const bottomMenu: TelegramReplyButton[][] = [
      [{ text: '🛒 Sản phẩm' }, { text: '📦 Đơn hàng' }, { text: '💰 Doanh thu' }],
      [{ text: '📦 Kho' }, { text: '📋 Tasks' }, { text: '🔗 Shortlinks' }],
      [{ text: '📝 Tạo đơn' }, { text: 'ℹ️ Hỗ trợ' }],
    ];
    await sendKbMenu(chatId, cached.msg, cached.keyboard, bottomMenu);
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekLater = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const [ordersToday, ordersExpiring, ordersExpired, tasksCount, accountsData, revTodayData, revWeekData, revMonthData, debtData, newCustsToday, expSoonAccounts] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', accountId).gte('expires_at', now.toISOString()).lte('expires_at', weekLater),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'expired').eq('account_id', accountId),
    supabaseAdmin.from('reminder_events').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('is_done', false),
    supabaseAdmin.from('source_accounts').select('id, max_slots, used_slots').eq('account_id', accountId).is('deleted_at', null),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', weekAgo).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', monthStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd, total_paid').eq('account_id', accountId).in('status', ['active', 'pending_payment']),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('source_accounts').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).lte('expires_at', weekLater).gte('expires_at', now.toISOString()),
  ]);

  const revToday = sumRevenueRows(revTodayData.data ?? []);
  const revWeek = sumRevenueRows(revWeekData.data ?? []);
  const _revMonth = sumRevenueRows(revMonthData.data ?? []);
  const totalDebt = sumDebtRows(debtData.data ?? []);
  const greeting = getGreeting();
  const tdy = ordersToday.count ?? 0, exp = ordersExpiring.count ?? 0, expd = ordersExpired.count ?? 0;
  const tsk = tasksCount.count ?? 0;
  const accounts = accountsData.data ?? [];
  const kho = accounts.length, newCusts = newCustsToday.count ?? 0, expSoon = expSoonAccounts.count ?? 0;
  const { totalSlots, usedSlots, slotPct: khoPct } = summarizeSlotUsage(accounts);
  const _dateStr = formatDateCustom(now, { timeZone: "Asia/Ho_Chi_Minh" }, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = formatDateCustom(now, { timeZone: "Asia/Ho_Chi_Minh" }, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  // Vibrant alert badges
  const alerts: string[] = [];
  if (exp > 0) alerts.push(modernDetail(exp + ' đơn sắp hạn', '', '⚡'));
  if (expd > 0) alerts.push(modernDetail(expd + ' đơn quá hạn', '', '🔴'));
  if (totalDebt > 0) alerts.push(modernDetail('Công nợ', formatVnd(totalDebt), '💳'));
  if (expSoon > 0) alerts.push(modernDetail(expSoon + ' kho sắp hết hạn', '', '⚠️'));

  const msg = [
    `💎 <b>BẢNG ĐIỀU KHIỂN HỆ THỐNG</b> 💎`,
    `<i>${greeting} Sếp Hoàng! • ${timeStr}</i>`,
    MODERN_SEPARATOR,
    ``,
    alerts.length > 0
      ? `🚨 <b>CẢNH BÁO</b>\n${alerts.join('\n')}\n`
      : '',
    modernHeader('TỔNG QUAN HÔM NAY', '▶️'),
    modernList('Đơn mới:', tdy, '⏩'),
    newCusts > 0 ? modernDetail('Khách mới:', newCusts, '»') : '',
    modernList('Sắp hạn:', exp, '⏩'),
    modernDetail('Quá hạn:', expd, '»'),
    modernList('Tasks pending:', tsk, '⏩'),
    ``,
    modernHeader('TÀI CHÍNH', '▶️'),
    modernList('Hôm nay:', formatVnd(revToday), '⏩'),
    modernDetail('Tuần này:', formatVnd(revWeek), '»'),
    modernDetail('Công nợ:', formatVnd(totalDebt), totalDebt > 0 ? '🔴' : '✅'),
    ``,
    modernHeader('KHO TÀI KHOẢN', '▶️'),
    modernList('Tài khoản:', kho, '⏩'),
    modernDetail('Slots:', `${usedSlots}/${totalSlots}`, '»'),
    modernDetail('Lấp đầy:', `${khoPct}%`, '»'),
  ].filter(Boolean).join('\n');

  const keyboard: TelegramButton[][] = [
    [{ text: `📊 Dashboard`, callback_data: 'cmd:stats' }, { text: `📦 Đơn (${tdy})`, callback_data: 'cmd:orders' }],
    [{ text: `⏰ Sắp hạn (${exp})`, callback_data: 'orders:expiring' }, { text: `📋 Tasks (${tsk})`, callback_data: 'cmd:tasks' }],
    [{ text: '👤 Khách hàng', callback_data: 'cmd:customer' }, { text: `🟢 Kho hạn (${kho})`, callback_data: 'cmd:active_accounts' }],
  ];
  if (totalDebt > 0) {
    keyboard.push([{ text: `🔴 Công nợ ${formatVnd(totalDebt)}`, callback_data: 'cmd:debt' }, { text: '📊 Báo cáo', callback_data: 'cmd:summary' }]);
  } else {
    keyboard.push([{ text: '📊 Báo cáo', callback_data: 'cmd:summary' }, { text: '🔍 Tìm kiếm', callback_data: 'cmd:search' }]);
  }
  keyboard.push(
    [{ text: '➕ Tạo nhanh', callback_data: 'cmd:create_menu' }, { text: '⚙️ Tiện ích', callback_data: 'cmd:utilities' }],
    [{ text: '🌐 Mở Web App', callback_data: 'cmd:webapp' }, { text: '❓ Trợ giúp', callback_data: 'cmd:help_detail' }],
  );
  // Bottom reply keyboard (always-visible quick menu)
  const bottomMenu: TelegramReplyButton[][] = [
    [{ text: '🛒 Sản phẩm' }, { text: '📦 Đơn hàng' }, { text: '💰 Doanh thu' }],
    [{ text: '📦 Kho' }, { text: '📋 Tasks' }, { text: '🔗 Shortlinks' }],
    [{ text: '📝 Tạo đơn' }, { text: 'ℹ️ Hỗ trợ' }],
  ];
  // Send inline KB + bottom menu in one flow
  await setCache(cacheKey, { msg, keyboard }, DASHBOARD_CACHE_TTL_SECONDS);
  await sendKbMenu(chatId, msg, keyboard, bottomMenu);
};

// ─── /stats ─────────────────────────────────────────────────
export const handleStatsCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  const cacheKey = `telegram:dashboard:stats:${accountId}`;
  const cached = await getCache<{ msg: string; keyboard: TelegramButton[][] }>(cacheKey);
  if (cached) {
    await sendKb(chatId, cached.msg, cached.keyboard);
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekLater = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const [ordersToday, ordersWeek, ordersActive, accountsTotal, accountsExpiring, revTodayD, revWeekD, revMonthD, debtD, totalOrders, paidOrders, custsTotal] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('account_id', accountId),
    supabaseAdmin.from('source_accounts').select('id, max_slots, used_slots').eq('account_id', accountId).is('deleted_at', null),
    supabaseAdmin.from('source_accounts').select('id', { count: 'exact', head: true }).eq('account_id', accountId).is('deleted_at', null).lte('expires_at', weekLater).gte('expires_at', now.toISOString()),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', weekAgo).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', monthStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd, total_paid').eq('account_id', accountId).in('status', ['active', 'pending_payment']),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('account_id', accountId).in('status', ['paid', 'active']),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
  ]);

  const revToday = sumRevenueRows(revTodayD.data ?? []);
  const revWeek = sumRevenueRows(revWeekD.data ?? []);
  const revMonth = sumRevenueRows(revMonthD.data ?? []);
  const totalDebt = sumDebtRows(debtD.data ?? []);
  const allAccs = (accountsTotal.data ?? []) as { max_slots: number; used_slots: number }[];
  const { totalSlots, usedSlots, slotPct: _slotPct } = summarizeSlotUsage(allAccs);
  const payRate = (totalOrders.count ?? 0) > 0 ? Math.round(((paidOrders.count ?? 0) / (totalOrders.count ?? 0)) * 100) : 0;

  const msg = [
    `💎 <b>THỐNG KÊ CHI TIẾT</b> 💎`,
    MODERN_SEPARATOR,
    ``,
    modernHeader('ĐƠN HÀNG', '▶️'),
    modernList('Hôm nay:', ordersToday.count ?? 0, '⏩'),
    modernDetail('Tuần này:', ordersWeek.count ?? 0, '»'),
    modernDetail('Đang hoạt động:', ordersActive.count ?? 0, '»'),
    modernDetail('Tổng đơn:', totalOrders.count ?? 0, '»'),
    modernDetail('Tỷ lệ TT:', `${payRate}%`, '»'),
    ``,
    modernHeader('DOANH THU & CÔNG NỢ', '▶️'),
    modernList('Hôm nay:', formatVnd(revToday), '⏩'),
    modernDetail('Tuần này:', formatVnd(revWeek), '»'),
    modernDetail('Tháng này:', formatVnd(revMonth), '»'),
    totalDebt > 0 ? modernDetail('Công nợ chưa thu:', formatVnd(totalDebt), '🔴') : modernDetail('Công nợ chưa thu:', '0đ', '✅'),
    ``,
    modernHeader('KHO HÀNG & KHÁCH', '▶️'),
    modernList('Tổng kho:', allAccs.length, '⏩'),
    modernDetail('Sắp hết hạn:', accountsExpiring.count ?? 0, '»'),
    modernDetail('Khách hàng:', custsTotal.count ?? 0, '»'),
  ].join('\n');
  const keyboard: TelegramButton[][] = [
    [{ text: '📋 Đơn hôm nay', callback_data: 'orders:today' }, { text: '⏰ Sắp hạn', callback_data: 'orders:expiring' }],
    [{ text: '📦 Kho hàng chi tiết', callback_data: 'cmd:kho' }, { text: '🏠 Trở về Menu', callback_data: 'cmd:start' }],
  ];
  await setCache(cacheKey, { msg, keyboard }, DASHBOARD_CACHE_TTL_SECONDS);
  await sendKb(chatId, msg, keyboard);
};

// ─── /summary ───────────────────────────────────────────────
export const handleSummaryCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  const cacheKey = `telegram:dashboard:summary:${accountId}`;
  const cached = await getCache<{ msg: string; keyboard: TelegramButton[][] }>(cacheKey);
  if (cached) {
    await sendKb(chatId, cached.msg, cached.keyboard);
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

  const [todayOrders, yesterdayOrders, todayRev, yesterdayRev, todayCusts, yesterdayCusts, todayTasks, todayDoneTasks, todayKho, todayPaidOrders] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('orders').select('total_amount_vnd').gte('created_at', yesterdayStart).lt('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart).eq('account_id', accountId),
    supabaseAdmin.from('reminder_events').select('id', { count: 'exact', head: true }).gte('due_at', todayStart).eq('account_id', accountId).eq('is_done', false),
    supabaseAdmin.from('reminder_events').select('id', { count: 'exact', head: true }).gte('due_at', todayStart).eq('account_id', accountId).eq('is_done', true),
    supabaseAdmin.from('source_accounts').select('id', { count: 'exact', head: true }).eq('account_id', accountId).gte('created_at', todayStart).is('deleted_at', null),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart).eq('account_id', accountId).eq('status', 'paid'),
  ]);

  const tRevToday = sumRevenueRows(todayRev.data ?? []);
  const tRevYesterday = sumRevenueRows(yesterdayRev.data ?? []);
  const tOrdToday = todayOrders.count ?? 0, tOrdYesterday = yesterdayOrders.count ?? 0;
  const tCustToday = todayCusts.count ?? 0, tCustYesterday = yesterdayCusts.count ?? 0;
  const compare = (today: number, yesterday: number) => {
    if (yesterday === 0) return today > 0 ? '🆕' : '—';
    const pct = Math.round(((today - yesterday) / yesterday) * 100);
    return pct > 0 ? `+${pct}% 📈` : pct < 0 ? `${pct}% 📉` : '➡️ 0%';
  };
  const dateStr = formatDateCustom(now, { timeZone: "Asia/Ho_Chi_Minh" }, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const msg = [
    `💎 <b>BÁO CÁO NGÀY</b> 💎`,
    `<i>${dateStr}</i>`,
    MODERN_SEPARATOR,
    ``,
    modernHeader('DOANH THU', '▶️'),
    modernList('Hôm nay:', `${formatVnd(tRevToday)} ${compare(tRevToday, tRevYesterday)}`, '⏩'),
    modernDetail('Hôm qua:', formatVnd(tRevYesterday), '»'),
    ``,
    modernHeader('ĐƠN HÀNG', '▶️'),
    modernList('Tạo mới:', `${tOrdToday} ${compare(tOrdToday, tOrdYesterday)}`, '⏩'),
    modernDetail('Hôm qua:', tOrdYesterday, '»'),
    modernDetail('Đã thanh toán:', todayPaidOrders.count ?? 0, '»'),
    ``,
    modernHeader('KHÁCH HÀNG & NHIỆM VỤ', '▶️'),
    modernList('Khách mới:', `${tCustToday} ${compare(tCustToday, tCustYesterday)}`, '⏩'),
    modernDetail('Kho thêm mới:', todayKho.count ?? 0, '»'),
    modernDetail('Tasks pending:', todayTasks.count ?? 0, '»'),
    modernDetail('Tasks done:', todayDoneTasks.count ?? 0, '✅'),
  ].join('\n');
  const keyboard: TelegramButton[][] = [
    [{ text: '📊 Xem Thống kê chung', callback_data: 'cmd:stats' }, { text: '📦 Xem Đơn đã tạo', callback_data: 'orders:today' }],
    [{ text: '💳 Danh sách Công nợ', callback_data: 'cmd:debt' }, { text: '📋 Quản lý Tasks', callback_data: 'cmd:tasks' }],
    [{ text: '🏠 Về Menu chính', callback_data: 'cmd:start' }],
  ];
  await setCache(cacheKey, { msg, keyboard }, DASHBOARD_CACHE_TTL_SECONDS);
  await sendKb(chatId, msg, keyboard);
};

export const handleHelpCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const _siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://duongminhhoang.id.vn';
  await sendKb(chatId, [
    `🎓 <b>DANH MỤC LỆNH HỆ THỐNG</b> 🎓`,
    `<i>Trợ lý ảo Dương Minh Hoàng System Bot</i>`,
    MODERN_SEPARATOR,
    ``,
    modernHeader('TRANG CHỦ & BÁO CÁO', '🏠'),
    modernDetail('/start', 'Dashboard tổng quan'),
    modernDetail('/stats', 'Báo cáo toàn diện'),
    modernDetail('/summary', 'Báo cáo doanh thu ngày'),
    ``,
    modernHeader('QUẢN LÝ ĐƠN HÀNG', '📦'),
    modernDetail('/orders', 'Menu phân loại đơn'),
    modernDetail('/today', 'Đơn tạo hôm nay'),
    modernDetail('/expiring', 'Đơn sắp hết hạn'),
    modernDetail('/search', 'Tìm kiếm chuyên sâu'),
    ``,
    modernHeader('KHO HÀNG & BẢO MẬT', '🗄'),
    modernDetail('/kho', 'Quản lý Kho nguồn'),
    modernDetail('/inventory', 'Tra cứu nguồn theo Email'),
    modernDetail('/creds', 'Quản lý Creds an toàn'),
    modernDetail('/active_accounts', 'Lọc TK còn hoạt động'),
    ``,
    modernHeader('KHÁCH & TÀI CHÍNH', '👤'),
    modernDetail('/customer', 'Tra cứu lịch sử'),
    modernDetail('/debt', 'Công nợ & Nhắc nhở'),
    ``,
    modernHeader('CÔNG CỤ TẠO MỚI', '➕'),
    modernDetail('/neworder', 'Tạo đơn <b>SIÊU TỐC</b>'),
    modernDetail('/newcustomer', 'Hồ sơ Khách mới'),
    modernDetail('/newkho', 'Nạp TK Kho nguồn'),
    modernDetail('/newproduct', 'Khai báo Sản phẩm'),
    modernDetail('/newtask', 'Tạo nhắc nhở Todo'),
    ``,
    modernHeader('CÔNG CỤ MỞ RỘNG', '⚙️'),
    modernDetail('/duolingo', 'Tra cứu ID & XP'),
    modernDetail('/fbid', 'Lấy FB Profile UID'),
    modernDetail('/shortlinks', 'Phân tích URL'),
    modernDetail('/security', 'Audit bảo mật'),
    ``,
    modernHeader('TÌM KIẾM AI', '⚡'),
    `<i>Gõ từ khóa tự do không cần lệnh (Mã đơn, SĐT, Email, Link) để bot tự nhận diện. Bấm /cancel để hủy nhập liệu.</i>`,
  ].join('\n'), [
    [{ text: '📊 Dashboard', callback_data: 'cmd:stats' }, { text: '📦 Đơn hàng', callback_data: 'cmd:orders' }],
    [{ text: '🗄 Kho hàng', callback_data: 'cmd:kho' }, { text: '➕ Tạo nhanh', callback_data: 'cmd:create_menu' }],
    [{ text: '⚙️ Tiện ích', callback_data: 'cmd:utilities' }, { text: '🌐 Web App', callback_data: 'cmd:webapp' }],
    [{ text: '🏠 Về Menu chính', callback_data: 'cmd:start' }],
  ]);
};

export const handleSearchPrompt: BotHandler = async (ctx) => {
  await sendKb(ctx.chatId, [
    `💎 <b>TÌM KIẾM THÔNG MINH</b> 💎`,
    `<i>Nhận diện ngữ cảnh và lệnh tự động.</i>`,
    MODERN_SEPARATOR,
    ``,
    modernHeader('HƯỚNG DẪN', '🔍'),
    modernDetail('Đơn hàng:', 'Mã đơn (ORD-...), Tên gói'),
    modernDetail('Khách hàng:', 'Tên KH, Email, SĐT'),
    modernDetail('Nick/Profile:', 'Username khách dùng'),
    modernDetail('Nguồn Kho:', 'Email kho nguồn'),
    ``,
    `💡 <i>Gõ từ khóa trực tiếp vào chat, không cần lệnh. Ví dụ: hoang, ORD-2603, 0394...</i>`,
  ].join('\n'), [
    [{ text: '📦 Đơn hôm nay', callback_data: 'orders:today' }, { text: '⏰ Đơn sắp hạn', callback_data: 'orders:expiring' }],
    [{ text: '🏠 Trở về Menu chính', callback_data: 'cmd:start' }],
  ]);
};

export const handleUtilitiesMenu: BotHandler = async (ctx) => {
  await sendKb(ctx.chatId, [
    `💎 <b>TRUNG TÂM TIỆN ÍCH</b> 💎`,
    `<i>Bộ công cụ mở rộng và quản trị hệ thống.</i>`,
    MODERN_SEPARATOR,
  ].join('\n'), [
    [{ text: '🦉 Tra ID Duolingo', callback_data: 'cmd:duolingo' }, { text: '📘 Lấy Facebook UID', callback_data: 'cmd:fbid' }],
    [{ text: '🔐 Quản lý Credentials', callback_data: 'cmd:creds' }, { text: '🔒 Trạng thái Bảo mật', callback_data: 'cmd:security' }],
    [{ text: '📦 Báo cáo Kho hàng', callback_data: 'kho:stats' }, { text: '🔗 Phân tích Short Links', callback_data: 'cmd:shortlinks' }],
    [{ text: '🏷 Danh mục Sản phẩm', callback_data: 'cmd:products' }, { text: '📊 Doanh thu sinh lời', callback_data: 'cmd:summary' }],
    [{ text: '🌐 Mở Cổng Web App', callback_data: 'cmd:webapp' }, { text: '🏠 Trở về Menu chính', callback_data: 'cmd:start' }],
  ]);
};

export const handleCreateMenu: BotHandler = async (ctx) => {
  await sendKb(ctx.chatId, [
    `💎 <b>TRÌNH TẠO HỆ THỐNG</b> 💎`,
    `<i>Wizards sẽ tự động điều hướng workflow tuần tự.</i>`,
    MODERN_SEPARATOR,
    ``,
    modernHeader('ĐỐI TƯỢNG', '➕'),
    modernDetail('Đơn hàng:', 'Tạo đơn & gán tự động'),
    modernDetail('Sản phẩm:', 'Khai báo mẫu & giá'),
    modernDetail('Kho hàng:', 'Nạp account nguồn'),
    modernDetail('Nhắc việc:', 'Todo liên hệ gia hạn'),
    modernDetail('Khách hàng:', 'Cấu hình hồ sơ CRM'),
  ].join('\n'), [
    [{ text: '📦 🪄 Đơn hàng Tốc độ', callback_data: 'cmd:neworder' }, { text: '🔗 🪄 Gán Kho nguồn', callback_data: 'cmd:allocate' }],
    [{ text: '🏷 Sản phẩm Mới', callback_data: 'cmd:newproduct' }, { text: '📧 Khai báo Kho', callback_data: 'cmd:newkho' }],
    [{ text: '📝 Nhắc việc / Nhiệm vụ', callback_data: 'cmd:newtask' }, { text: '👤 Hồ sơ CRM', callback_data: 'cmd:newcustomer' }],
    [{ text: '🔍 Tìm kiếm khẩn cấp', callback_data: 'cmd:search_prompt' }],
    [{ text: '🏠 Trở về Menu chính', callback_data: 'cmd:start' }],
  ]);
};

// ─── Web App ────────────────────────────────────────────────
export const handleWebApp: BotHandler = async (ctx) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://duongminhhoang.id.vn';
  await sendKb(ctx.chatId, [
    `💎 <b>CỔNG WEB APP</b> 💎`,
    MODERN_SEPARATOR,
    ``,
    modernHeader('MỞ TRÌNH DUYỆT', '🌐'),
    `<i>Sử dụng toàn bộ công cụ với giao diện tối ưu nhất cho desktop và iPad:</i>`,
    `👉 <a href="${siteUrl}">${siteUrl}</a>`,
  ].join('\n'), [
    [{ text: '🌐 Mở Web App ngay', url: siteUrl }],
    [{ text: '🏠 Trở về Menu', callback_data: 'cmd:start' }],
  ]);
};

// ─── Setup Bot Commands (/ menu) ────────────────────────────

export async function setupBotCommands(): Promise<void> {
  const commands: BotCommand[] = [
    { command: 'start', description: '🏠 Dashboard — Tổng quan hệ thống' },
    { command: 'orders', description: '📦 Quản lý đơn hàng' },
    { command: 'kho', description: '📦 Kho hàng & tài khoản' },
    { command: 'tasks', description: '📋 Tasks & Lịch hẹn' },
    { command: 'shortlinks', description: '🔗 Quản lý Short Links' },
    { command: 'products', description: '🛒 Danh mục sản phẩm' },
    { command: 'stats', description: '📊 Thống kê chi tiết' },
    { command: 'summary', description: '💰 Báo cáo doanh thu' },
    { command: 'find', description: '🔍 Tìm kiếm thông minh' },
    { command: 'help', description: 'ℹ️ Hướng dẫn sử dụng' },
    { command: 'duolingo', description: '🦉 Tra cứu Duolingo ID' },
    { command: 'creds', description: '🔐 Quản lý Credentials' },
    { command: 'cancel', description: '❌ Hủy thao tác hiện tại' },
  ];
  await setMyCommands(commands);
  console.log('[Bot] ✅ Bot commands registered');
}
