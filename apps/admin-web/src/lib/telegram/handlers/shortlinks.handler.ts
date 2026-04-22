/* eslint-disable @typescript-eslint/no-explicit-any */

// Supabase short_links row shape (includes columns not yet in generated types)
interface ShortLinkRow {
  id: string;
  slug: string;
  title: string | null;
  target_url: string;
  max_clicks: number;
  current_clicks: number;
  status: string;
  expires_at: string | null;
  require_token: boolean;
  access_token: string | null;
  locked_ip: string | null;
  locked_ipv6: string | null;
  created_at: string;
  account_id: string;
  order_id: string | null;
  customer_id: string | null;
  notify_clicks: boolean;
  updated_at: string | null;
}
// ============================================================
// SHORT LINKS HANDLER — Full CRUD via Telegram
// Quick Create (5 clicks) + Full Wizard + Edit/Delete/Toggle
// ============================================================
import type { BotHandler } from '../bot-router';
import {
  supabaseAdmin,
  sendMsg, sendKb, editMsg, escapeHtml, formatDate,
  type TelegramButton,
} from '../shared';
import { getClickAnalytics } from '@/lib/services/fraud-detector';
import { formatDateCustom } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
const SLUG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function genSlug(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => SLUG_CHARS[b % SLUG_CHARS.length]).join('');
}

function genToken(len = 12): string { return genSlug(len); }

function _maskUrl(url: string, max = 50): string {
  return url.length > max ? url.slice(0, max) + '...' : url;
}

// ─── /shortlinks — List all short links ────────────────────

export const handleShortLinksCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';

  let page = 0;
  if (ctx.callbackData?.startsWith('slpage:')) {
    page = parseInt(ctx.callbackData.split(':')[1], 10) || 0;
  }
  const PAGE_SIZE = 5;

  const { data: allLinks, error } = await supabaseAdmin
    .from('short_links')
    .select('id, slug, title, target_url, max_clicks, current_clicks, status, expires_at, require_token, access_token, locked_ip, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error || !allLinks?.length) {
    const msgText = [
      `◈━━━ 🔗 <b>SHORT LINKS</b> ━━━◈\n`,
      `<blockquote>📭 Chưa có link nào.`,
      ``,
      `💡 Tạo nhanh: <code>/newlink URL</code></blockquote>`,
    ].join('\n');
    const kb: TelegramButton[][] = [
      [{ text: '⚡ Tạo nhanh', callback_data: 'sl:quick_prompt' }, { text: '📝 Tạo đầy đủ', callback_data: 'sl:full_prompt' }],
      [{ text: '🌐 Web App', callback_data: 'cmd:webapp' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ];
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  // Stats overview
  const activeCount = allLinks.filter(l => l.status === 'active').length;
  const totalClicks = allLinks.reduce((s, l) => s + l.current_clicks, 0);
  const protectedCount = allLinks.filter(l => (l as ShortLinkRow).require_token).length;

  const statusIcon: Record<string, string> = { active: '🟢', expired: '🔴', disabled: '⚫' };
  const lines: string[] = [
    `◈━━━ 🔗 <b>SHORT LINKS</b> (${allLinks.length}) ━━━◈\n`,
    `<blockquote>📊 Active: <b>${activeCount}</b>  •  Clicks: <b>${totalClicks}</b>  •  🔐 Bảo mật: <b>${protectedCount}</b></blockquote>`,
    ``,
  ];

  const domainOnly = SITE_URL.replace(/^https?:\/\//, '');
  const pageLinks = allLinks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  for (const link of pageLinks) {
    const icon = statusIcon[link.status] ?? '⚪';
    const used = `${link.current_clicks}/${link.max_clicks}`;
    const title = link.title ? escapeHtml(link.title.slice(0, 25)) : escapeHtml(link.slug);
    const badges: string[] = [];
    const typedLink = link as ShortLinkRow;
    if (typedLink.require_token) badges.push('🔐');
    if (typedLink.locked_ip) badges.push('🔒');

    const tokenVal = typedLink.access_token;
    const requireToken = typedLink.require_token;
    const fullUrl = requireToken && tokenVal ? `${SITE_URL}/s/${link.slug}?t=${tokenVal}` : `${SITE_URL}/s/${link.slug}`;
    
    lines.push(
      `<blockquote>${icon} <b>${title}</b> ${badges.join('')}`,
      `📊 ${used} clicks | <a href="${fullUrl}">${domainOnly}/s/${link.slug}</a></blockquote>`,
    );
  }

  // Keyboard: detail buttons
  const kb: TelegramButton[][] = pageLinks.map(l => [{
    text: `📋 ${(l.title || l.slug).slice(0, 28)} (${l.current_clicks}/${l.max_clicks})`,
    callback_data: `sl:detail:${l.id}`,
  }]);

  // Pagination row
  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: `⬅️ Trang ${page}`, callback_data: `slpage:${page - 1}` });
  const totalPages = Math.ceil(allLinks.length / PAGE_SIZE);
  if (page + 1 < totalPages) navRow.push({ text: `Trang ${page + 2} ➡️`, callback_data: `slpage:${page + 1}` });
  if (navRow.length > 0) kb.push(navRow);

  kb.push([
    { text: '⚡ Tạo nhanh', callback_data: 'sl:quick_prompt' },
    { text: '📝 Tạo đầy đủ', callback_data: 'sl:full_prompt' },
  ]);
  kb.push([{ text: '🌐 Web App', callback_data: 'cmd:webapp' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);

  if (ctx.messageId && ctx.callbackQueryId) {
    await editMsg(chatId, ctx.messageId, lines.join('\n'), kb);
  } else {
    await sendKb(chatId, lines.join('\n'), kb);
  }
};

// ─── /newlink — Quick create (5 clicks, no token) ──────────

export const handleNewLinkCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  const url = ctx.args?.trim() || '';

  if (!url) {
    if (ctx.state.setSession) await ctx.state.setSession('newlink', 1, {});
    await sendMsg(chatId, [
      '⚡ <b>TẠO NHANH SHORT LINK</b>',
      '',
      'Nhập URL đích (max 5 clicks, không token):',
      '',
      '💡 VD: <code>/newlink https://netflix.com/...</code>',
      '💡 <code>/cancel</code> để hủy',
    ].join('\n'));
    return;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    await sendMsg(chatId, '⚠️ URL phải bắt đầu bằng <code>http://</code> hoặc <code>https://</code>');
    return;
  }

  await createLink(chatId, accountId, { target_url: url, max_clicks: 5, require_token: false });
};

// ─── Full Create Wizard (multi-step) ────────────────────────

export const handleFullCreateWizard: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const session = ctx.state.session;

  if (!session || session.command !== 'newlink_full') return;

  const text = ctx.text?.trim() || ctx.args?.trim() || '';
  const step = session.step;
  const data = session.data || {};

  switch (step) {
    case 1: {
      // Step 1: Enter URL
      if (!text.startsWith('http://') && !text.startsWith('https://')) {
        await sendMsg(chatId, '⚠️ URL phải bắt đầu bằng <code>http://</code> hoặc <code>https://</code>');
        return;
      }
      data.target_url = text;
      if (ctx.state.setSession) await ctx.state.setSession('newlink_full', 2, data);
      await sendMsg(chatId, [
        '📝 <b>BƯỚC 2/5</b> — Tên / Tiêu đề',
        '',
        'Nhập tên cho link (VD: Netflix Slot 3):',
        '',
        '💡 Gõ <code>-</code> để bỏ qua',
      ].join('\n'));
      return;
    }

    case 2: {
      // Step 2: Title
      data.title = text === '-' ? null : text;
      if (ctx.state.setSession) await ctx.state.setSession('newlink_full', 3, data);
      await sendKb(chatId, [
        '🔢 <b>BƯỚC 3/5</b> — Max clicks',
        '',
        'Chọn số lần click tối đa:',
      ].join('\n'), [
        [{ text: '1 click', callback_data: 'slw:clicks:1' }, { text: '3 clicks', callback_data: 'slw:clicks:3' }, { text: '5 clicks', callback_data: 'slw:clicks:5' }],
        [{ text: '10 clicks', callback_data: 'slw:clicks:10' }, { text: '50 clicks', callback_data: 'slw:clicks:50' }, { text: '999', callback_data: 'slw:clicks:999' }],
        [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
      ]);
      return;
    }

    case 4: {
      // Step 4 is handled via callback (expiry selection)
      return;
    }

    case 6: {
      // Final confirmation already handled via callback
      return;
    }

    default:
      return;
  }
};

// ─── All shortlink callbacks ────────────────────────────────

export const handleShortLinkDetailCallback: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  const data = ctx.callbackData ?? '';

  // ── Quick Create prompt ──
  if (data === 'sl:quick_prompt') {
    if (ctx.state.setSession) await ctx.state.setSession('newlink', 1, {});
    await sendMsg(chatId, [
      '⚡ <b>TẠO NHANH</b> (5 clicks, không token)',
      '',
      'Nhập URL cần rút gọn:',
      '💡 <code>/cancel</code> để hủy',
    ].join('\n'));
    return;
  }

  // ── Full Create prompt ──
  if (data === 'sl:full_prompt') {
    if (ctx.state.setSession) await ctx.state.setSession('newlink_full', 1, {});
    await sendMsg(chatId, [
      '📝 <b>TẠO ĐẦY ĐỦ SHORT LINK</b>',
      '',
      '<b>BƯỚC 1/5</b> — Nhập URL đích:',
      '',
      '💡 VD: <code>https://netflix.com/invite/...</code>',
      '💡 <code>/cancel</code> để hủy',
    ].join('\n'));
    return;
  }

  // ── Wizard: Max clicks selection ──
  if (data.startsWith('slw:clicks:')) {
    const clicks = parseInt(data.replace('slw:clicks:', ''), 10) || 5;
    const session = ctx.state.session;
    if (!session) return;
    const sd = { ...(session.data || {}), max_clicks: clicks };
    if (ctx.state.setSession) await ctx.state.setSession('newlink_full', 4, sd);
    await sendKb(chatId, [
      '⏰ <b>BƯỚC 4/5</b> — Thời hạn',
      '',
      'Chọn thời hạn link:',
    ].join('\n'), [
      [{ text: '1 giờ', callback_data: 'slw:exp:1h' }, { text: '6 giờ', callback_data: 'slw:exp:6h' }, { text: '24 giờ', callback_data: 'slw:exp:24h' }],
      [{ text: '7 ngày', callback_data: 'slw:exp:7d' }, { text: '30 ngày', callback_data: 'slw:exp:30d' }, { text: '♾️ Không giới hạn', callback_data: 'slw:exp:none' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // ── Wizard: Expiry selection ──
  if (data.startsWith('slw:exp:')) {
    const expVal = data.replace('slw:exp:', '');
    const session = ctx.state.session;
    if (!session) return;
    const expiryMap: Record<string, number> = {
      '1h': 3600_000, '6h': 6 * 3600_000, '24h': 24 * 3600_000,
      '7d': 7 * 86400_000, '30d': 30 * 86400_000,
    };
    const expiresAt = expVal === 'none' ? null : new Date(Date.now() + (expiryMap[expVal] || 0)).toISOString();
    const sd = { ...(session.data || {}), expires_at: expiresAt };
    if (ctx.state.setSession) await ctx.state.setSession('newlink_full', 5, sd);

    await sendKb(chatId, [
      '🛡️ <b>BƯỚC 5/5</b> — Anti-Fraud',
      '',
      'Bật bảo vệ Anti-Fraud (Token + IP Lock)?',
      '',
      '🔐 Token: Tạo mã truy cập riêng',
      '🔒 IP Lock: Khoá IP người click đầu tiên',
    ].join('\n'), [
      [{ text: '✅ BẬT Anti-Fraud', callback_data: 'slw:af:on' }],
      [{ text: '⏭️ Bỏ qua (Không bảo vệ)', callback_data: 'slw:af:off' }],
      [{ text: '❌ Hủy', callback_data: 'cmd:cancel' }],
    ]);
    return;
  }

  // ── Wizard: Anti-Fraud selection → CREATE ──
  if (data.startsWith('slw:af:')) {
    const requireToken = data === 'slw:af:on';
    const session = ctx.state.session;
    if (!session) return;
    const sd = session.data || {};

    if (ctx.state.clearSession) await ctx.state.clearSession();

    await createLink(chatId, accountId, {
      target_url: sd.target_url,
      title: sd.title || null,
      max_clicks: sd.max_clicks || 5,
      expires_at: sd.expires_at || null,
      require_token: requireToken,
    });
    return;
  }

  // ── Link Detail ──
  if (data.startsWith('sl:detail:')) {
    const linkId = data.replace('sl:detail:', '');
    const { data: rawLink } = await supabaseAdmin.from('short_links')
      .select('*').eq('id', linkId).single();
    const link = rawLink as ShortLinkRow | null;

    if (!link) { 
      if (ctx.messageId) await editMsg(chatId, ctx.messageId, '❌ Link không tồn tại.');
      else await sendMsg(chatId, '❌ Link không tồn tại.');
      return; 
    }

    const statusIcon: Record<string, string> = { active: '🟢 Active', expired: '🔴 Expired', disabled: '⚫ Disabled' };
    const domainOnly = SITE_URL.replace(/^https?:\/\//, '');
    const fullUrl = `${SITE_URL}/s/${link.slug}`;
    const remaining = link.max_clicks - link.current_clicks;
    const tokenVal = link.access_token;
    const requireToken = link.require_token;
    const lockedIp = link.locked_ip;

    const lines = [
      `◈━━━ 🔗 <b>CHI TIẾT SHORT LINK</b> ━━━◈\n`,
      `<blockquote>${statusIcon[link.status] ?? link.status}`,
      link.title ? `📌 <b>Tiêu đề:</b> ${escapeHtml(link.title)}` : '',
      `🔗 <b>URL ngắn gọn:</b>`,
      tokenVal && requireToken
        ? `<a href="${SITE_URL}/s/${link.slug}?t=${tokenVal}">${domainOnly}/s/${link.slug}</a>`
        : `<a href="${SITE_URL}/s/${link.slug}">${domainOnly}/s/${link.slug}</a>`,
      ``,
      `🎯 <b>Đích:</b>\n<code>${escapeHtml(link.target_url)}</code>`,
      ``,
      `📊 <b>Clicks:</b> ${link.current_clicks}/${link.max_clicks} (còn <b>${remaining}</b>)`,
      requireToken ? `🔐 <b>Token:</b> <code>${tokenVal || 'N/A'}</code>` : '',
      lockedIp ? `🔒 <b>IP Lock:</b> <code>${lockedIp}</code>` : '',
      link.expires_at ? `📅 <b>Hết hạn:</b> ${formatDate(link.expires_at)}` : '',
      `📅 <b>Ngày tạo:</b> ${formatDate(link.created_at)}</blockquote>`,
    ];

    const kb: TelegramButton[][] = [
      [{ text: '📊 Analytics', callback_data: `sl:analytics:${link.id}` }],
      [
        { text: link.status === 'active' ? '⏸ Tắt' : '▶️ Bật', callback_data: `sl:toggle:${link.id}` },
        { text: '🗑 Xoá', callback_data: `sl:delete_ask:${link.id}` },
      ],
    ];

    if (lockedIp) {
      kb.push([{ text: '🔓 Mở khoá IP', callback_data: `sl:unlock:${link.id}` }]);
    }

    if (requireToken && tokenVal) {
      kb.push([{ text: '📋 Copy Full URL', callback_data: `copy:${fullUrl}?t=${tokenVal}` }]);
    } else {
      kb.push([{ text: '📋 Copy Link', callback_data: `copy:${fullUrl}` }]);
    }

    kb.push([
      { text: '✏️ Sửa max clicks', callback_data: `sl:edit_clicks:${link.id}` },
    ]);
    kb.push([
      { text: '🔗 Danh sách', callback_data: 'cmd:shortlinks' },
      { text: '➕ Tạo mới', callback_data: 'sl:quick_prompt' },
    ]);
    kb.push([{ text: '🏠 Menu', callback_data: 'cmd:start' }]);

    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, lines.filter(Boolean).join('\n'), kb);
    } else {
      await sendKb(chatId, lines.filter(Boolean).join('\n'), kb);
    }
    return;
  }

  // ── Toggle status (active ↔ disabled) ──
  if (data.startsWith('sl:toggle:')) {
    const linkId = data.replace('sl:toggle:', '');
    const { data: link } = await supabaseAdmin.from('short_links')
      .select('status, slug').eq('id', linkId).single();

    if (!link) { 
      if (ctx.messageId) await editMsg(chatId, ctx.messageId, '❌ Link không tồn tại.'); 
      else await sendMsg(chatId, '❌ Link không tồn tại.'); 
      return; 
    }

    const newStatus = link.status === 'active' ? 'disabled' : 'active';
    await supabaseAdmin.from('short_links')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', linkId);

    const icon = newStatus === 'active' ? '▶️' : '⏸';
    const msgText = `${icon} Link <code>${escapeHtml(link.slug)}</code> → <b>${newStatus}</b>`;
    const kb: TelegramButton[][] = [[{ text: '📋 Chi tiết', callback_data: `sl:detail:${linkId}` }, { text: '🔗 Danh sách', callback_data: 'cmd:shortlinks' }]];
    
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  // ── Delete confirmation ──
  if (data.startsWith('sl:delete_ask:')) {
    const linkId = data.replace('sl:delete_ask:', '');
    const msgText = '⚠️ <b>XÁC NHẬN XÓA</b>\n\nBạn chắc chắn muốn xoá link này? Thao tác không thể hoàn tác.';
    const kb: TelegramButton[][] = [[{ text: '🗑 Xoá luôn', callback_data: `sl:delete_yes:${linkId}` }, { text: '❌ Hủy', callback_data: `sl:detail:${linkId}` }]];
    
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  // ── Delete confirmed ──
  if (data.startsWith('sl:delete_yes:')) {
    const linkId = data.replace('sl:delete_yes:', '');
    const { error: delErr } = await supabaseAdmin.from('short_links')
      .delete().eq('id', linkId).eq('account_id', accountId);

    if (delErr) {
      if (ctx.messageId) await editMsg(chatId, ctx.messageId, `❌ Lỗi xoá: ${escapeHtml(delErr.message)}`);
      else await sendMsg(chatId, `❌ Lỗi xoá: ${escapeHtml(delErr.message)}`);
      return;
    }

    const msgText = '✅ Đã xoá link thành công.';
    const kb: TelegramButton[][] = [[{ text: '🔗 Danh sách', callback_data: 'cmd:shortlinks' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]];
    
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  // ── Unlock IP ──
  if (data.startsWith('sl:unlock:')) {
    const linkId = data.replace('sl:unlock:', '');
    await supabaseAdmin.from('short_links')
      .update({ locked_ip: null, updated_at: new Date().toISOString() })
      .eq('id', linkId);

    const msgText = '🔓 Đã mở khoá IP. Link có thể truy cập từ mọi IP.';
    const kb: TelegramButton[][] = [[{ text: '📋 Chi tiết', callback_data: `sl:detail:${linkId}` }, { text: '🔗 Danh sách', callback_data: 'cmd:shortlinks' }]];
    
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  // ── Edit max clicks prompt ──
  if (data.startsWith('sl:edit_clicks:')) {
    const linkId = data.replace('sl:edit_clicks:', '');
    const msgText = '✏️ <b>Chọn max clicks mới:</b>';
    const kb: TelegramButton[][] = [
      [{ text: '1', callback_data: `sl:set_clicks:${linkId}:1` }, { text: '3', callback_data: `sl:set_clicks:${linkId}:3` }, { text: '5', callback_data: `sl:set_clicks:${linkId}:5` }],
      [{ text: '10', callback_data: `sl:set_clicks:${linkId}:10` }, { text: '50', callback_data: `sl:set_clicks:${linkId}:50` }, { text: '999', callback_data: `sl:set_clicks:${linkId}:999` }],
      [{ text: '◀️ Quay lại', callback_data: `sl:detail:${linkId}` }],
    ];
    
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  // ── Set max clicks ──
  if (data.startsWith('sl:set_clicks:')) {
    const parts = data.replace('sl:set_clicks:', '').split(':');
    const linkId = parts[0];
    const newMax = parseInt(parts[1], 10) || 5;

    await supabaseAdmin.from('short_links')
      .update({ max_clicks: newMax, updated_at: new Date().toISOString() })
      .eq('id', linkId);

    await sendKb(chatId, `✅ Đã cập nhật max clicks → <b>${newMax}</b>`, [
      [{ text: '📋 Chi tiết', callback_data: `sl:detail:${linkId}` }, { text: '🔗 Danh sách', callback_data: 'cmd:shortlinks' }],
    ]);
    return;
  }

  // ── Click Analytics ──
  if (data.startsWith('sl:analytics:')) {
    const linkId = data.replace('sl:analytics:', '');
    const { clicks, stats } = await getClickAnalytics(linkId);

    if (!stats || stats.totalClicks === 0) {
      const msgText = [
        `◈━━━ 📊 <b>CLICK ANALYTICS</b> ━━━◈\n`,
        `<blockquote>📭 Chưa có click nào.</blockquote>`,
      ].join('\n');
      const kb: TelegramButton[][] = [
        [{ text: '◀️ Quay lại', callback_data: `sl:detail:${linkId}` }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ];
      if (ctx.messageId && ctx.callbackQueryId) {
        await editMsg(chatId, ctx.messageId, msgText, kb);
      } else {
        await sendKb(chatId, msgText, kb);
      }
      return;
    }

    const deviceLines = Object.entries(stats.devices)
      .map(([d, count]) => {
        const icon: Record<string, string> = { mobile: '📱', desktop: '💻', tablet: '📟', bot: '🤖', unknown: '❓' };
        return `  ${icon[d] ?? '❓'} ${d}: <b>${count}</b>`;
      });

    const recentClicks = clicks.slice(0, 8).map((c: any) => {
      const time = formatDateCustom(c.clicked_at, { timeZone: 'Asia/Ho_Chi_Minh' }, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23' });
      const flag = c.is_suspicious ? '🚨' : '✅';
      const dev: Record<string, string> = { mobile: '📱', desktop: '💻', tablet: '📟', bot: '🤖' };
      return `  ${flag} ${time} | ${dev[c.device_type] ?? '❓'} | <code>${c.ip_address}</code>`;
    });

    const hasGeo = stats && Object.keys(stats.countries || {}).length > 0;
    const geoBlock = hasGeo ? [
      ``,
      `<blockquote>🌍 <b>VỊ TRÍ & IP</b>`,
      ...Object.entries(stats.countries).slice(0, 5).map(([c, count]) => `  📍 ${c}: <b>${count}</b>`),
      ...Object.entries(stats.ipVersions).map(([v, count]) => `  🌐 ${v}: <b>${count}</b>`),
      `</blockquote>`
    ] : [];

    const msgText = [
      `◈━━━ 📊 <b>CLICK ANALYTICS</b> ━━━◈\n`,
      `<blockquote>📈 <b>Tổng clicks:</b> ${stats.totalClicks}`,
      `🌐 <b>Unique IPs:</b> ${stats.uniqueIPs}`,
      stats.suspiciousCount > 0 ? `🚨 <b>Nghi vấn:</b> ${stats.suspiciousCount}</blockquote>` : `✅ <b>Nghi vấn:</b> 0</blockquote>`,
      ``,
      `<blockquote>📱 <b>THIẾT BỊ</b>`,
      ...deviceLines,
      `</blockquote>`,
      ...geoBlock,
      ``,
      `<blockquote>🕐 <b>LỊCH SỬ GẦN ĐÂY</b>`,
      ...recentClicks,
      `</blockquote>`,
    ].join('\n');
    
    const kb: TelegramButton[][] = [
      [{ text: '◀️ Chi tiết link', callback_data: `sl:detail:${linkId}` }],
      [{ text: '🔗 Danh sách', callback_data: 'cmd:shortlinks' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ];

    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }
};

// ─── Shared: Create link (used by both quick + wizard) ──────

async function createLink(
  chatId: number,
  accountId: string,
  opts: {
    target_url: string;
    title?: string | null;
    max_clicks?: number;
    expires_at?: string | null;
    require_token?: boolean;
  }
) {
  await sendMsg(chatId, '⏳ Đang tạo short link...');

  const slug = genSlug();
  const requireToken = opts.require_token ?? false;
  const token = requireToken ? genToken() : null;

  const { data: link, error } = await supabaseAdmin.from('short_links').insert({
    account_id: accountId,
    slug,
    target_url: opts.target_url,
    title: opts.title ?? null,
    max_clicks: opts.max_clicks ?? 5,
    expires_at: opts.expires_at ?? null,
    order_id: null,
    customer_id: null,
    require_token: requireToken,
    access_token: token,
  } as Partial<ShortLinkRow>).select().single();

  if (error) {
    await sendKb(chatId, `❌ Lỗi: ${escapeHtml(error.message)}`, [
      [{ text: '🔄 Thử lại', callback_data: 'sl:quick_prompt' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ]);
    return;
  }

  const domainOnly = SITE_URL.replace(/^https?:\/\//, '');
  const shortUrlActual = `${SITE_URL}/s/${link.slug}`;
  const fullUrlActual = token ? `${shortUrlActual}?t=${token}` : shortUrlActual;

  const lines = [
    `◈━━━ ✅ <b>ĐÃ TẠO SHORT LINK!</b> ━━━◈\n`,
    `<blockquote>🔗 <b>Short URL:</b>`,
    `<a href="${fullUrlActual}">${escapeHtml(`${domainOnly}/s/${link.slug}`)}</a>`,
    ``,
    `🎯 <b>Target:</b>\n<code>${escapeHtml(opts.target_url)}</code>`,
    `📊 Max clicks: <b>${opts.max_clicks ?? 5}</b>`,
    `🆔 Slug: <code>${escapeHtml(link.slug)}</code>`,
  ];

  if (token) {
    lines.push(
      ``,
      `🔐 <b>Token:</b> <code>${token}</code>`,
      `🔒 <b>Anti-Fraud:</b> Bật (IP Lock khi click đầu tiên)</blockquote>`,
    );
  } else {
    lines.push(`</blockquote>`);
  }

  if (opts.expires_at) {
    lines.push(`<blockquote>📅 <b>Hết hạn:</b> ${formatDate(opts.expires_at)}</blockquote>`);
  }

  const kb: TelegramButton[][] = [
    [{ text: '📋 Copy Link', callback_data: `copy:${fullUrlActual}` }],
  ];

  if (token) {
    kb.push([{ text: '🔐 Copy Token', callback_data: `copy:${token}` }]);
  }

  kb.push([
    { text: '🔗 Xem tất cả', callback_data: 'cmd:shortlinks' },
    { text: '➕ Tạo thêm', callback_data: 'sl:quick_prompt' },
  ]);
  kb.push([{ text: '🏠 Menu', callback_data: 'cmd:start' }]);

  await sendKb(chatId, lines.join('\n'), kb);
}
