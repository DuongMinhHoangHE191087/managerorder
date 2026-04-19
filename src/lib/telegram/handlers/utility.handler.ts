/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================
// UTILITY HANDLER — duolingo, fbid, products, security, creds
// Migrated from legacy telegram-bot.service.ts
// ============================================================
import type { BotHandler } from '../bot-router';
import {
  supabaseAdmin,
  sendMsg, sendKb, editMsg, escapeHtml, formatVnd, formatDate, daysUntil,
  normalizeUsername, decryptNotes,
  type TelegramButton,
  type BotContext,
  modernHeader, modernList, modernDetail, PAGE_SIZE,
} from '../shared';
import { formatDateLabel, formatDateShort, formatNumber } from "@/lib/utils";
import { getTelegramProductPage } from '@/lib/services/telegram-query.service';

const DEFAULT_BLOCK_CONFIG = { maxAttempts: 5, blockDurationMs: 30 * 60 * 1000 };

// ─── Duolingo Multi-Strategy Lookup ─────────────────────────

const DUO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const LANG_FLAGS: Record<string, string> = {
  en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', ja: '🇯🇵', ko: '🇰🇷',
  zh: '🇨🇳', pt: '🇧🇷', it: '🇮🇹', vi: '🇻🇳', ru: '🇷🇺', ar: '🇸🇦',
  hi: '🇮🇳', tr: '🇹🇷', nl: '🇳🇱', sv: '🇸🇪', pl: '🇵🇱', uk: '🇺🇦',
  id: '🇮🇩', th: '🇹🇭', ro: '🇷🇴', cs: '🇨🇿', el: '🇬🇷', hu: '🇭🇺',
  he: '🇮🇱', ga: '🇮🇪', cy: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', la: '🏛️', hv: '🐉', tlh: '🖖',
};

function extractDuoUsername(raw: string): string | null {
  let u = raw.trim();
  u = u.replace(/^https?:\/\/(www\.)?duolingo\.com\/profile\//i, "");
  u = u.replace(/[/?#].*$/, "");
  if (u.startsWith("@")) u = u.substring(1);
  if (!u || !/^[a-zA-Z0-9._\-]{1,50}$/.test(u)) return null;
  return u;
}

/** Safe Fetch with Timeout Helper */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}


/** Strategy 1: API — lấy FULL data (không filter fields) */
async function duoStrategy1(username: string): Promise<any | null> {
  try {
    const url = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": DUO_UA,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.duolingo.com/",
        Origin: "https://www.duolingo.com",
      },
      cache: "no-store",
    }, 10000);
    if (!res.ok) {
      console.log(`[DuoBot] Strategy 1 failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    let user = users.find((u: any) => String(u.username ?? "").toLowerCase() === username.toLowerCase());
    
    // Fallback: take first match if exists
    if (!user && users.length > 0) user = users[0];

    if (user?.id) return user;
  } catch (err: any) {
    console.log(`[DuoBot] Strategy 1 error:`, err.message);
  }
  return null;
}

/** Strategy 2: duome.eu — chỉ lấy được ID */
async function duoStrategy2(username: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(`https://duome.eu/${encodeURIComponent(username)}`, {
      headers: {
        "User-Agent": DUO_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }, 10000);
    if (!res.ok) return null;
    const html = await res.text();

    // Strategy A: Avatar URL ID
    const m = html.match(/simg-ssl\.duolingo\.com\/(?:ssr-)?avatars\/(\d+)\//);
    if (m) return { id: parseInt(m[1], 10), username, _source: 'duome' };

    // Strategy B: data-id attribute
    const m2 = html.match(/data-(?:duo-)?id=['"](\d+)['"]/i);
    if (m2) return { id: parseInt(m2[1], 10), username, _source: 'duome' };

    // Strategy C: Generic avatars path ID
    const m3 = html.match(/\/avatars\/(\d+)\//);
    if (m3) return { id: parseInt(m3[1], 10), username, _source: 'duome' };
  } catch (err: any) {
    console.log(`[DuoBot] Strategy 2 error:`, err.message);
  }
  return null;
}

/** Strategy 3: Profile page scrape */
async function duoStrategy3(username: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.duolingo.com/profile/${encodeURIComponent(username)}`,
      { headers: { "User-Agent": DUO_UA, Accept: "text/html,*/*;q=0.8" } },
      10000
    );
    if (!res.ok) return null;
    const html = await res.text();
    const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (ndMatch) {
      try {
        const nd = JSON.parse(ndMatch[1]);
        const user = nd?.props?.pageProps?.initialData?.user ?? nd?.props?.pageProps?.user;
        if (user?.id && user.id > 0) return user;
      } catch { /* parse failed */ }
    }
    const aMatch = html.match(/simg-ssl\.duolingo\.com\/(?:ssr-)?avatars\/(\d+)\//);
    if (aMatch) return { id: parseInt(aMatch[1], 10), username, _source: 'scrape' };
  } catch { /* fall through */ }
  return null;
}

/** Strategy 4: CORS Proxy fallback (bypasses Cloudflare WAF on cloud hosting) */
async function duoStrategy4(username: string): Promise<any | null> {
  try {
    const duoUrl = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}`;
    const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(duoUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, {
      headers: { "User-Agent": DUO_UA },
      cache: "no-store",
    }, 15000);
    if (!res.ok) {
      console.log(`[DuoBot] Strategy 4 failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    let user = users.find((u: any) => String(u.username ?? "").toLowerCase() === username.toLowerCase());
    if (!user && users.length > 0) user = users[0];
    if (user?.id) return user;
  } catch (err: any) {
    console.log(`[DuoBot] Strategy 4 error:`, err.message);
  }
  return null;
}

/** Multi-strategy lookup */
async function lookupDuolingo(username: string): Promise<any | null> {
  return (
    (await duoStrategy1(username)) ??
    (await duoStrategy2(username)) ??
    (await duoStrategy3(username)) ??
    (await duoStrategy4(username))
  );
}

/** Format full Duolingo profile cho Telegram */
function formatDuoProfile(user: any): string {
  const id = user.id;
  const uname = user.username ?? 'N/A';
  const name = user.name || '';
  const bio = user.bio || '';

  // Subscription
  const isPlusActive = user.hasPlus === true || user.plusStatus === 'PLUS';
  const planLabel = isPlusActive ? '✨ <b>SUPER DUOLINGO</b>' : '🆓 Free Plan';

  // XP & Level
  const totalXp = user.totalXp ?? 0;
  const xpLevel = totalXp < 1000 ? '🥉 Beginner' : totalXp < 5000 ? '🥈 Intermediate' : totalXp < 20000 ? '🥇 Advanced' : totalXp < 50000 ? '💎 Expert' : '👑 Master';

  // Streak
  const streak = user.streak ?? 0;
  const streakFire = streak === 0 ? '❄️' : streak < 7 ? '🔥' : streak < 30 ? '🔥🔥' : streak < 100 ? '🔥🔥🔥' : '🔥🔥🔥🔥';
  const sd = user.streakData?.currentStreak;
  const streakRange = sd ? `${sd.startDate} → ${sd.endDate}` : '';

  // Account age
  const created = user.creationDate ? formatDateShort(new Date(user.creationDate * 1000)) : 'N/A';
  const daysSince = user.creationDate ? Math.floor((Date.now() - user.creationDate * 1000) / 86_400_000) : 0;
  const xpPerDay = daysSince > 0 ? Math.round(totalXp / daysSince) : 0;

  // Languages
  const fromLang = user.fromLanguage ?? '';
  const learningLang = user.learningLanguage ?? '';
  const fromFlag = LANG_FLAGS[fromLang] ?? '🌐';
  const learnFlag = LANG_FLAGS[learningLang] ?? '🌐';

  // Courses
  const courses = (user.courses ?? []).map((c: any) => {
    const flag = LANG_FLAGS[c.learningLanguage] ?? '🌐';
    const xp = c.xp ?? 0;
    const crowns = c.crowns ?? 0;
    const title = c.title ?? c.learningLanguage ?? '?';
    return `  ${flag} <b>${escapeHtml(title)}</b> — ${formatNumber(xp)} XP${crowns ? ` | 👑 ${crowns}` : ''}`;
  });

  // Connected accounts
  const connectedParts: string[] = [];
  if (user.hasGoogleId) connectedParts.push('Google');
  if (user.hasFacebookId) connectedParts.push('Facebook');
  if (user.hasPhoneNumber) connectedParts.push('📱 Phone');
  if (user.emailVerified) connectedParts.push('📧 Email ✓');
  const connected = connectedParts.length ? connectedParts.join(' · ') : 'Không có';

  // Motivation
  const motiveMap: Record<string, string> = {
    school: '🎓 Học ở trường', work: '💼 Công việc', travel: '✈️ Du lịch',
    family: '👨‍👩‍👧 Gia đình', brain: '🧠 Rèn trí', culture: '🎭 Văn hóa',
    other: '📌 Khác',
  };
  const motivation = user.motivation ? (motiveMap[user.motivation] ?? `📌 ${user.motivation}`) : '';

  // Roles
  const roles = (user.roles ?? []).filter((r: string) => r !== 'users');
  const rolesStr = roles.length ? roles.join(', ') : '';

  // Build message
  const lines: string[] = [
    `<blockquote><b>🦉 DUOLINGO PROFILE</b>`,
    ``,
    `🆔 <b>ID:</b> <code>${id}</code>`,
    `👤 <b>Username:</b> <code>${escapeHtml(uname)}</code>`,
  ];

  if (name) lines.push(`📛 <b>Tên:</b> ${escapeHtml(name)}`);
  if (bio) lines.push(`📝 <b>Bio:</b> <i>${escapeHtml(bio)}</i>`);

  lines.push(``, `━━━ 📊 <b>THỐNG KÊ</b> ━━━`);
  lines.push(`${planLabel}`);
  lines.push(`${streakFire} <b>Streak:</b> <code>${streak}</code> ngày`);
  if (streakRange) lines.push(`   📅 <code>${streakRange}</code>`);
  lines.push(`⭐ <b>XP:</b> <code>${formatNumber(totalXp)}</code> (${xpLevel})`);
  lines.push(`📈 <b>TB/ngày:</b> <code>${xpPerDay}</code> XP`);

  lines.push(``, `━━━ 🌍 <b>NGÔN NGỮ</b> ━━━`);
  lines.push(`🗣️ <b>Ngôn ngữ gốc:</b> ${fromFlag} <code>${fromLang}</code>`);
  lines.push(`📖 <b>Đang học:</b> ${learnFlag} <code>${learningLang}</code>`);

  if (courses.length) {
    lines.push(``, `📚 <b>KHÓA HỌC (${courses.length})</b>`);
    lines.push(...courses);
  }

  lines.push(``, `━━━ 🔧 <b>TÀI KHOẢN</b> ━━━`);
  lines.push(`📅 <b>Ngày tạo:</b> <code>${created}</code> (${daysSince} ngày)`);
  lines.push(`🔗 <b>Liên kết:</b> ${connected}`);
  if (motivation) lines.push(`🎯 <b>Mục đích:</b> ${motivation}`);
  if (rolesStr) lines.push(`🏷️ <b>Roles:</b> <code>${rolesStr}</code>`);
  if (user.profileCountry) lines.push(`🌏 <b>Quốc gia:</b> ${escapeHtml(JSON.stringify(user.profileCountry))}`);

  lines.push(`</blockquote>`);

  // Copy section
  lines.push(``, `📋 <b>COPY NHANH:</b>`);
  lines.push(`🆔 ID: <code>${id}</code>`);
  lines.push(`👤 Username: <code>${escapeHtml(uname)}</code>`);

  // Note if data is partial (from fallback strategies)
  if (user._source) {
    lines.push(``, `⚠️ <i>Dữ liệu giới hạn (nguồn: ${user._source})</i>`);
  }

  return lines.join('\n');
}

// ─── /duolingo — Tra cứu Duolingo chi tiết ──────────────────

export const handleDuolingoCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const query = ctx.args?.trim() || '';

  if (!query) {
    if (ctx.state.setSession) await ctx.state.setSession('duolingo_lookup', 1, {});
    const msg = [
      '<blockquote>🦉 <b>TRA CỨU DUOLINGO</b>',
      'Nhập username hoặc link profile Duolingo:',
      '', '💡 <b>Hỗ trợ định dạng:</b>',
      '  • <code>username</code> — tra trực tiếp',
      '  • <code>@username</code> — tự bỏ @',
      '  • <code>duolingo.com/profile/xxx</code> — extract URL</blockquote>',
      '', '💡 <i>Nhắn <code>/cancel</code> để hủy</i>',
    ].join('\n');
    const kb: TelegramButton[][] = [[{ text: '🏠 Menu', callback_data: 'cmd:start' }]];
    if (ctx.messageId && ctx.callbackQueryId) await editMsg(chatId, ctx.messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }

  if (/^\d+$/.test(query) || /^(?:ID|id)\s*:\s*\d+$/.test(query)) {
    const idMsg = `⚠️ <b>Tra cứu bằng ID không khả dụng.</b>\n\nVui lòng nhập <b>Username</b> hoặc <b>Link Profile</b>.`;
    if (ctx.messageId && ctx.callbackQueryId) await editMsg(chatId, ctx.messageId, idMsg);
    else await sendMsg(chatId, idMsg);
    return;
  }

  const username = extractDuoUsername(query);
  if (!username) {
    await sendMsg(chatId, '⚠️ Username không hợp lệ. Chỉ chứa chữ, số, dấu chấm, gạch dưới.');
    return;
  }

  const tmpMsgId = await sendMsg(chatId, `<blockquote>⏳ <b>Đang tra cứu Duolingo...</b>\n\n🔍 Username: <code>${escapeHtml(username)}</code></blockquote>`);

  const user = await lookupDuolingo(username);

  if (!user) {
    const failMsg = [
      `❌ Không tìm thấy: <code>${escapeHtml(username)}</code>`,
      '',
      `💡 <b>Gợi ý:</b>`,
      `  • Kiểm tra chính tả username`,
      `  • Profile có thể đang Private`,
      `  • Thử lại sau vài phút`,
    ].join('\n');
    const failKb: TelegramButton[][] = [[{ text: '🔄 Thử lại', callback_data: 'cmd:duolingo' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]];
    if (typeof tmpMsgId === 'number') await editMsg(chatId, tmpMsgId, failMsg, failKb);
    else await sendKb(chatId, failMsg, failKb);
    return;
  }

  const profileUrl = `https://www.duolingo.com/profile/${encodeURIComponent(user.username ?? username)}`;
  const safeUsername = (user.username ?? username).slice(0, 55).replace(/[^a-zA-Z0-9_.-]/g, '');

  const finalMsg = formatDuoProfile(user);
  const finalKb: TelegramButton[][] = [
    [{ text: '🌐 Mở Profile', url: profileUrl }],
    [{ text: `🆔 Copy ID: ${user.id}`, callback_data: `copy:${String(user.id).slice(0, 55)}` }, { text: `👤 Copy: ${safeUsername.slice(0, 20) || 'user'}`, callback_data: `copy:${safeUsername}` }],
    [{ text: '🔄 Tra user khác', callback_data: 'cmd:duolingo' }, { text: '📘 Tra FB ID', callback_data: 'cmd:fbid' }],
    [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];
  if (typeof tmpMsgId === 'number') await editMsg(chatId, tmpMsgId, finalMsg, finalKb);
  else await sendKb(chatId, finalMsg, finalKb);
};

// ─── /fbid — Facebook ID lookup ─────────────────────────────

export const handleFbidCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const query = ctx.args?.trim() || '';

  if (!query) {
    if (ctx.state.setSession) await ctx.state.setSession('fbid_lookup', 1, {});
    const msg = '<blockquote>📘 <b>TRA CỨU FACEBOOK</b>\nNhập URL hoặc username Facebook:\n💡 VD: <code>https://facebook.com/zuck</code> hoặc <code>zuck</code></blockquote>\n💡 <i>Nhắn <code>/cancel</code> để hủy</i>';
    const kb: TelegramButton[][] = [[{ text: '🏠 Menu', callback_data: 'cmd:start' }]];
    if (ctx.messageId && ctx.callbackQueryId) await editMsg(chatId, ctx.messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }

  const { value: normalized } = normalizeUsername(query);
  const originalInput = normalized || query.trim();
  const tmpMsgId = await sendMsg(chatId, `<blockquote>⏳ <b>Đang gọi API m.facebook.com...</b>\n\n🔍 Tìm kiếm UID cho <code>${escapeHtml(originalInput)}</code>...</blockquote>`);

  let fbUrl = originalInput;
  if (!fbUrl.startsWith('http')) fbUrl = `https://www.facebook.com/${fbUrl}`;

  const formData = new URLSearchParams();
  formData.append('link', fbUrl);
  const res = await fetchWithTimeout('https://id.traodoisub.com/api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  }, 10000);

  if (res.ok) {
    const data = await res.json();
    if (data.id) {
      const fbId = String(data.id);
      const profileUrl = `https://www.facebook.com/${fbId}`;
      const avatarUrl = `https://graph.facebook.com/${fbId}/picture?type=large`;
      const messengerUrl = `https://m.me/${fbId}`;
      const finalMsg = [
        `<blockquote><b>📘 FACEBOOK PROFILE</b>`,
        data.name ? `👤 <b>Tên:</b> <code>${escapeHtml(data.name)}</code>` : '',
        `🆔 <b>Facebook ID:</b>\n<code>${escapeHtml(fbId)}</code>`,
        `🌐 <code>www.facebook.com/${escapeHtml(fbId)}</code>`,
        `💬 <code>m.me/${escapeHtml(fbId)}</code></blockquote>`,
        `📋 <b>COPY NHANH:</b>`,
        `🆔 ID: <code>${escapeHtml(fbId)}</code>`,
        `🌐 Link: <code>www.facebook.com/${escapeHtml(fbId)}</code>`,
      ].filter(Boolean).join('\n');
      const finalKb: TelegramButton[][] = [
        [{ text: '🌐 Mở Profile Facebook', url: profileUrl }],
        [{ text: `🆔 Copy ID: ${fbId}`, callback_data: `copy:${fbId}` }, { text: '🖼 Avatar', url: avatarUrl }],
        [{ text: '💬 Messenger', url: messengerUrl }],
        [{ text: '🔄 Tra user khác', callback_data: 'cmd:fbid' }, { text: '🦉 Tra Duolingo', callback_data: 'cmd:duolingo' }],
        [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ];
      if (typeof tmpMsgId === 'number') await editMsg(chatId, tmpMsgId, finalMsg, finalKb);
      else await sendKb(chatId, finalMsg, finalKb);
      return;
    }
    if (data.error) {
      const failMsg = `❌ Lỗi: ${escapeHtml(String(data.error).slice(0, 200))}`;
      const failKb: TelegramButton[][] = [
        [{ text: '🔄 Thử lại', callback_data: 'cmd:fbid' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
      ];
      if (typeof tmpMsgId === 'number') await editMsg(chatId, tmpMsgId, failMsg, failKb);
      else await sendKb(chatId, failMsg, failKb);
      return;
    }
  }
  const failMsg = [
    `❌ <b>Không lấy được Facebook ID</b>`, '',
    `💡 • Kiểm tra URL/username có đúng không`,
    `• Thử URL đầy đủ: <code>https://facebook.com/username</code>`,
  ].join('\n');
  const failKb: TelegramButton[][] = [[{ text: '🔄 Thử lại', callback_data: 'cmd:fbid' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]];
  if (typeof tmpMsgId === 'number') await editMsg(chatId, tmpMsgId, failMsg, failKb);
  else await sendKb(chatId, failMsg, failKb);
};

// ─── /products — Product list ───────────────────────────────

export const handleProductsCommand: BotHandler = async (ctx) => {
  const { chatId, messageId, callbackData } = ctx;
  const scopedAccountId = ctx.accountId ?? process.env.TELEGRAM_BOT_ACCOUNT_ID ?? '';
  const page = callbackData?.startsWith('products:page:')
    ? Math.max(Number.parseInt(callbackData.split(':')[2] ?? '0', 10) || 0, 0)
    : 0;
  let query = supabaseAdmin.from('products')
    .select('id, name, sell_price_vnd, is_active', { count: 'exact' })
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('name');
  if (scopedAccountId) {
    query = query.eq('account_id', scopedAccountId);
  }
  const { data: products } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (!products?.length) {
    const msg = '<blockquote>📭 <b>Chưa có sản phẩm.</b></blockquote>';
    const kb: TelegramButton[][] = [[{ text: '➕ Tạo SP', callback_data: 'cmd:newproduct' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]];
    if (messageId && ctx.callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }
  const active = products.filter(p => p.is_active);
  const inactive = products.filter(p => !p.is_active);
  const lines: string[] = [];
  if (active.length) {
    lines.push(`<blockquote><b>🟢 Đang bán (${active.length})</b>`);
    for (const p of active) lines.push(`🏷 <b>${escapeHtml(p.name)}</b> — ${formatVnd(p.sell_price_vnd)}`);
    lines.push(`</blockquote>`);
  }
  if (inactive.length) {
    lines.push(`<blockquote><b>🔴 Ngừng bán (${inactive.length})</b>`);
    for (const p of inactive) lines.push(`🏷 <s>${escapeHtml(p.name)}</s> — ${formatVnd(p.sell_price_vnd)}`);
    lines.push(`</blockquote>`);
  }
  const kb: TelegramButton[][] = active.slice(0, 6).map(p => [{ text: `📦 ${p.name}`, callback_data: `prodview:${p.id}` }]);
  kb.push([{ text: '➕ Tạo SP', callback_data: 'cmd:newproduct' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);
  const finalMsg = `<blockquote>🏷 <b>DANH SÁCH SẢN PHẨM (${products.length})</b></blockquote>\n\n${lines.join('\n')}`;
  if (messageId && ctx.callbackQueryId) await editMsg(chatId, messageId, finalMsg, kb);
  else await sendKb(chatId, finalMsg, kb);
};

// ─── /security — Security status ────────────────────────────

export const handleSecurityCommand: BotHandler = async (ctx) => {
  const { chatId, messageId } = ctx;
  const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '';
  const now = formatDateLabel(new Date());
  const msg = [
    `<blockquote><b>🔒 BẢO MẬT v10.0</b>\n📅 ${now}</blockquote>`,
    `<blockquote><b>📊 TRẠNG THÁI</b>`,
    `${process.env.TELEGRAM_WEBHOOK_SECRET ? '✅' : '❌'} Webhook Secret`,
    `✅ Admin: <code>${ADMIN_CHAT_ID}</code>`,
    `✅ Silent Mode | Brute-force: ${DEFAULT_BLOCK_CONFIG.maxAttempts}x`,
    `✅ Block time: ${DEFAULT_BLOCK_CONFIG.blockDurationMs / 60000} phút`,
    `✅ Redis-backed rate limiting`,
    `✅ Modular BotRouter middleware chain</blockquote>`,
    `<blockquote><b>🏗 KIẾN TRÚC</b>`,
    `✅ 3-layer security (Webhook + Admin + Rate Limit)`,
    `✅ Error middleware (global catch)`,
    `✅ Callback auto-acknowledge`,
    `✅ Session middleware (wizard state)</blockquote>`,
  ].join('\n');
  const kb: TelegramButton[][] = [
    [{ text: '🔄 Refresh', callback_data: 'cmd:security' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];
  if (messageId && ctx.callbackQueryId) await editMsg(chatId, messageId, msg, kb);
  else await sendKb(chatId, msg, kb);
};

// ─── /creds — Credentials browser ───────────────────────────

export const handleCredsCommand: BotHandler = async (ctx) => {
  const { chatId, args, messageId, accountId } = ctx;
  const query = args?.trim() || '';

  if (query) {
    // Search by email
    const { data: accs } = await supabaseAdmin.from('source_accounts')
      .select('id, email, max_slots, used_slots, expires_at, notes, reserved_nicks, provider, account_id, product_ids, created_at, purchase_cost_vnd, purchase_date, purchase_source')
      .eq('account_id', accountId).ilike('email', `%${query}%`).is('deleted_at', null).limit(5);
    if (accs?.length) {
      for (const acc of accs) await formatAndSendCreds(chatId, acc);
      return;
    }
    await sendMsg(chatId, `❌ Không tìm thấy: <code>${escapeHtml(query)}</code>`);
    return;
  }

  // Show product categories
  const { data: allAccounts } = await supabaseAdmin.from('source_accounts').select('id, product_ids').eq('account_id', accountId).is('deleted_at', null);
  const pMap = new Map<string, number>();
  for (const acc of allAccounts ?? []) {
    const pids = (acc.product_ids ?? []) as string[];
    if (!pids.length) pMap.set('__none__', (pMap.get('__none__') ?? 0) + 1);
    for (const pid of pids) pMap.set(pid, (pMap.get(pid) ?? 0) + 1);
  }
  const pIds = [...pMap.keys()].filter(k => k !== '__none__');
  const nMap = new Map<string, string>();
  if (pIds.length) {
    const { data: ps } = await supabaseAdmin.from('products').select('id, name').eq('account_id', accountId).in('id', pIds);
    for (const p of ps ?? []) nMap.set(p.id, p.name);
  }
  const kb: TelegramButton[][] = [];
  for (const [pid, cnt] of pMap) {
    if (pid === '__none__') kb.push([{ text: `📦 Chưa gán (${cnt})`, callback_data: 'creds:prod:__none__' }]);
    else kb.push([{ text: `📦 ${nMap.get(pid) ?? pid.slice(0, 8)} (${cnt})`, callback_data: `creds:prod:${pid}` }]);
  }
  const msg = `<blockquote><b>🔐 CHỌN SẢN PHẨM</b>\n📊 Tổng: <b>${(allAccounts ?? []).length}</b> TK</blockquote>`;
  if (messageId && ctx.callbackQueryId) await editMsg(chatId, messageId, msg, kb);
  else await sendKb(chatId, msg, kb);
};

// ─── Creds callback router ──────────────────────────────────

export const handleCredsCallback: BotHandler = async (ctx) => {
  const { chatId, messageId, callbackQueryId, callbackData, accountId } = ctx;
  const data = callbackData ?? '';

  // Handle credreveal:ACC_ID — show unmasked credentials
  if (data.startsWith('credreveal:')) {
    const accId = data.replace('credreveal:', '');
    const { data: acc } = await supabaseAdmin.from('source_accounts')
      .select('id, email, notes')
      .eq('account_id', accountId).eq('id', accId).is('deleted_at', null).single();
    if (!acc) {
      await sendMsg(chatId, '❌ Không tìm thấy tài khoản.');
      return;
    }
    const rawNotes = (typeof acc.notes === 'object' && acc.notes !== null) ? acc.notes : {};
    const notesObj = decryptNotes(rawNotes) as Record<string, any>;
    const password = notesObj.password ?? null;
    const joinLink = notesObj.joinLink ?? notesObj.join_link ?? null;
    const twoFA = notesObj.twoFA ?? notesObj['2fa'] ?? null;
    const credentials = Array.isArray(notesObj.credentials) ? notesObj.credentials : [];
    const lines: string[] = [
      modernHeader('CREDENTIALS (REVEALED)', '👁'),
      ``,
      `<blockquote>`,
      modernDetail(`Email`, `<code>${escapeHtml(acc.email)}</code>`, '📧'),
    ];
    if (password) lines.push(modernDetail(`Password`, `<code>${escapeHtml(String(password))}</code>`, '🔑'));
    if (joinLink) lines.push(modernDetail(`Link`, `<code>${escapeHtml(String(joinLink))}</code>`, '🔗'));
    if (twoFA) lines.push(modernDetail(`2FA`, `<code>${escapeHtml(String(twoFA))}</code>`, '🛡'));
    for (const cred of credentials) {
      lines.push(modernDetail(escapeHtml(String(cred.label || 'Info')), `<code>${escapeHtml(String(cred.value || ''))}</code>`, '📌'));
    }
    lines.push(`</blockquote>`);
    lines.push(`\n⚠️ <i>Thông tin nhạy cảm — cẩn thận khi chia sẻ</i>`);
    const kb: TelegramButton[][] = [
      [{ text: '🔒 Ẩn lại', callback_data: `creds:acc:${accId}` }],
      [{ text: '📋 Copy Login', callback_data: `copy:${acc.email} / ${String(password ?? '')}` }],
      [{ text: '⬅️ Quay lại', callback_data: 'creds:back' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
    ];
    if (messageId && callbackQueryId) await editMsg(chatId, messageId, lines.join('\n'), kb);
    else await sendKb(chatId, lines.join('\n'), kb);
    return;
  }

  const parts = data.split(':');

  if (parts[1] === 'back') return handleCredsCommand({ ...ctx, args: '' } as BotContext);
  if (parts[1] === 'search') {
    if (ctx.state.setSession) await ctx.state.setSession('creds_search', 1, { productId: parts[2] });
    const msg = '<blockquote>🔍 <b>TÌM KIẾM CREDENTIALS</b>\nNhập email/nick:</blockquote>\n💡 <i>Nhắn <code>/cancel</code> để hủy</i>';
    const kb: TelegramButton[][] = [[{ text: '⬅️ Quay lại', callback_data: `creds:prod:${parts[2]}` }]];
    if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }
  if (parts[1] === 'acc') {
    const { data: acc } = await supabaseAdmin.from('source_accounts')
      .select('id, account_id, email, provider, max_slots, used_slots, expires_at, reserved_nicks, product_ids, created_at, notes, purchase_cost_vnd, purchase_date, purchase_source')
      .eq('account_id', accountId).eq('id', parts[2]).is('deleted_at', null).single();
    if (!acc) {
      const msg = '<blockquote>❌ <b>Không tìm thấy.</b></blockquote>';
      const kb: TelegramButton[][] = [[{ text: '⬅️ Quay lại', callback_data: 'creds:back' }]];
      if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
      else await sendKb(chatId, msg, kb);
      return;
    }
    return await formatAndSendCreds(chatId, acc, messageId, !!callbackQueryId);
  }
  if (parts[1] === 'prod') {
    const pid = parts[2]; const showAll = parts[3] === 'all';
    let q = supabaseAdmin.from('source_accounts').select('id, email, max_slots, used_slots, expires_at, reserved_nicks').eq('account_id', accountId).is('deleted_at', null).order('email').limit(showAll ? 100 : 20);
    if (pid === '__none__') q = q.or('product_ids.is.null,product_ids.eq.{}'); else q = q.contains('product_ids', [pid]);
    const { data: accs } = await q;
    if (!accs?.length) {
      const msg = '<blockquote>📭 <b>Không có tài khoản.</b></blockquote>';
      const kb: TelegramButton[][] = [[{ text: '⬅️ Quay lại', callback_data: 'creds:back' }]];
      if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
      else await sendKb(chatId, msg, kb);
      return;
    }
    const kb: TelegramButton[][] = accs.map(a => [{ text: `📧 ${a.email.length > 22 ? a.email.slice(0, 20) + '..' : a.email} (${a.max_slots - a.used_slots}/${a.max_slots})`, callback_data: `creds:acc:${a.id}` }]);
    const extra: TelegramButton[] = [];
    if (!showAll && accs.length >= 20) extra.push({ text: '📋 Tất cả', callback_data: `creds:prod:${pid}:all` });
    extra.push({ text: '🔍 Tìm', callback_data: `creds:search:${pid}` });
    kb.push(extra);
    kb.push([{ text: '⬅️ Quay lại', callback_data: 'creds:back' }]);
    const msg = `<blockquote>📦 <b>CÁC TÀI KHOẢN KHO (${accs.length})</b>\n👇 Chọn tài khoản để xem chi tiết:</blockquote>`;
    if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
  }
};

// ─── /prodview callback — Product detail with kho ───────────

export const handleProductViewCallback: BotHandler = async (ctx) => {
  const { chatId, messageId, callbackQueryId, callbackData, accountId } = ctx;
  const data = callbackData ?? '';
  const productId = data.replace('prodview:', '');
  const { data: product } = await supabaseAdmin.from('products')
    .select('id, name, sell_price_vnd, is_active, sku, description').eq('account_id', accountId).eq('id', productId).single();
  if (!product) {
    const msg = '<blockquote>❌ <b>SP không tồn tại.</b></blockquote>';
    const kb: TelegramButton[][] = [[{ text: '⬅️ DS Sản phẩm', callback_data: 'cmd:products' }]];
    if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }

  const { data: khoAccs } = await supabaseAdmin.from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, reserved_nicks')
    .eq('account_id', accountId).is('deleted_at', null).contains('product_ids', [productId]).order('expires_at', { ascending: false }).limit(30);
  const { count: orderCount } = await supabaseAdmin.from('order_items')
    .select('id', { count: 'exact', head: true }).eq('product_id', productId);

  const now = new Date();
  const active = (khoAccs ?? []).filter(k => !k.expires_at || new Date(k.expires_at) > now);
  const withSlots = active.filter(k => k.used_slots < k.max_slots);
  const totalFree = withSlots.reduce((s, k) => s + (k.max_slots - k.used_slots), 0);

  const sections: string[] = [
    modernHeader(`SẢN PHẨM`, '📦'),
    ``,
    `<blockquote><b>${escapeHtml(product.name)}</b> ${product.is_active ? '🟢' : '🔴'}`,
    modernDetail(`Giá`, formatVnd(product.sell_price_vnd ?? 0), '💰'),
    product.sku ? modernDetail(`SKU`, `<code>${escapeHtml(product.sku)}</code>`, '📋') : '',
    modernDetail(`Đơn hàng`, `${orderCount ?? 0}`, '📦'),
    `</blockquote>`,
    ``,
    modernHeader(`KHO HÀNG`, '📊'),
    ``,
    `<blockquote>${modernDetail('Tổng TK', `${(khoAccs ?? []).length}`, '📧')}`,
    modernDetail(`Có slot`, `${withSlots.length}`, '✅'),
    modernDetail(`Slot trống`, `${totalFree}`, '🆓'),
    `</blockquote>`
  ];

  if (withSlots.length > 0) {
    sections.push(``);
    sections.push(modernHeader(`KHO CÒN SLOT (${withSlots.length})`, '🟢'));
    sections.push(``);
    for (const k of withSlots.slice(0, 10)) {
      const free = k.max_slots - k.used_slots;
      const expStr = k.expires_at ? `${formatDate(k.expires_at)}` : '♾';
      sections.push(modernList(
        `<code>${escapeHtml(k.email)}</code>`,
        `Đã dùng: ${k.used_slots}/${k.max_slots} (trống: ${free}) | HSD: ${expStr}`,
        '📧'
      ));
    }
  }

  const credBtns: TelegramButton[][] = withSlots.slice(0, 6).map(k => {
    const emailTrunc = k.email.length > 20 ? k.email.slice(0, 18) + '..' : k.email;
    return [{ text: `🔐 ${emailTrunc} (${k.max_slots - k.used_slots})`, callback_data: `creds:acc:${k.id}` }];
  });
  
  const msg = sections.filter(Boolean).join('\n');
  const kb: TelegramButton[][] = [
    ...credBtns,
    [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🔗 Gán kho', callback_data: 'cmd:allocate' }],
    [{ text: '⬅️ DS Sản phẩm', callback_data: 'cmd:products' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];
  if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
  else await sendKb(chatId, msg, kb);
};

// ─── Helper: format credentials ─────────────────────────────

async function formatAndSendCreds(chatId: number, acc: Record<string, any>, messageId?: number, isCallback?: boolean) {
  const free = acc.max_slots - acc.used_slots;
  const nicks = (acc.reserved_nicks ?? []) as string[];
  const productIds = (acc.product_ids ?? []) as string[];

  const rawNotes = (typeof acc.notes === 'object' && acc.notes !== null) ? acc.notes : {};
  const notesObj = decryptNotes(rawNotes) as Record<string, any>;
  const password = notesObj.password ?? null;
  const credentials = Array.isArray(notesObj.credentials) ? notesObj.credentials : [];
  const joinLink = notesObj.joinLink ?? notesObj.join_link ?? null;
  const twoFA = notesObj.twoFA ?? notesObj['2fa'] ?? null;
  const extraNotes = notesObj.text ?? notesObj.note ?? null;

  const { data: linkedItems } = await supabaseAdmin.from('order_items')
    .select('customer_nick_used, status, product_name_snapshot')
    .eq('assigned_source_account_id', acc.id).limit(20);

  let productNames: string[] = [];
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin.from('products').select('id, name').eq('account_id', acc.account_id).in('id', productIds);
    productNames = (products ?? []).map((p: any) => p.name);
  }

  let providerDisplay = escapeHtml(acc.provider ?? 'N/A');
  if (acc.provider) {
    const { data: matched } = await supabaseAdmin.from('providers').select('id, name').eq('account_id', acc.account_id).eq('id', acc.provider).is('deleted_at', null).maybeSingle();
    if (matched) providerDisplay = escapeHtml(matched.name);
  }

  const maskValue = (val: string) => val.length <= 3 ? '***' : val.slice(0, 2) + '•'.repeat(Math.min(val.length - 2, 8));

  const sections: string[] = [
    `<blockquote><b>🔐 THÔNG TIN KHO CHI TIẾT</b>`,
    `📧 <b>Email:</b> <code>${escapeHtml(acc.email)}</code>`,
    `🏢 <b>Provider:</b> ${providerDisplay}`,
    `📊 <b>Slot:</b> ${acc.used_slots}/${acc.max_slots} (trống: <b>${free}</b>)`,
    `📅 <b>Hạn:</b> ${formatDate(acc.expires_at)} (còn ${daysUntil(acc.expires_at)} ngày)`,
  ];
  if (nicks.length) sections.push(`🏷 <b>Nick:</b> <code>${escapeHtml(nicks.join(', '))}</code>`);
  const activeNicks = (linkedItems ?? []).filter((i: any) => i.customer_nick_used).map((i: any) => i.customer_nick_used);
  if (activeNicks.length) sections.push(`👥 <b>Nick đang dùng:</b> <code>${escapeHtml(activeNicks.join(', '))}</code>`);
  if (productNames.length) sections.push(`📦 <b>SP:</b> ${productNames.map(n => escapeHtml(n)).join(', ')}`);
  sections.push(`</blockquote>`);

  if (password || credentials.length || joinLink || twoFA) {
    sections.push(`<blockquote><b>🔒 CREDENTIALS (masked)</b>`);
    if (password) sections.push(`🔑 <b>Pass:</b> <code>${maskValue(String(password))}</code>`);
    if (joinLink) sections.push(`🔗 <b>Link:</b> <code>${maskValue(String(joinLink))}</code>`);
    if (twoFA) sections.push(`🛡 <b>2FA:</b> <code>${maskValue(String(twoFA))}</code>`);
    for (const cred of credentials) {
      sections.push(`📌 <b>${escapeHtml(cred.label || 'Info')}:</b> <code>${maskValue(String(cred.value || ''))}</code>`);
    }
    sections.push(`</blockquote>`);
  }
  if (extraNotes) sections.push(`<blockquote><b>📝 Ghi chú:</b>\n${escapeHtml(String(extraNotes))}</blockquote>`);

  const actionBtns: TelegramButton[][] = [
    [{ text: '👁 Hiện credentials', callback_data: `credreveal:${acc.id}` }],
    [{ text: '⬅️ DS SP', callback_data: 'creds:back' }, { text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }],
    [{ text: '📦 Kho', callback_data: 'cmd:kho' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];
  
  const msg = sections.join('\n');
  if (messageId && isCallback) await editMsg(chatId, messageId, msg, actionBtns);
  else await sendKb(chatId, msg, actionBtns);
}

export const handleProductsListCommand: BotHandler = async (ctx) => {
  const { chatId, messageId, callbackData } = ctx;
  const scopedAccountId = ctx.accountId ?? process.env.TELEGRAM_BOT_ACCOUNT_ID ?? '';
  const page = callbackData?.startsWith('products:page:')
    ? Math.max(Number.parseInt(callbackData.split(':')[2] ?? '0', 10) || 0, 0)
    : 0;

  const productPage = await getTelegramProductPage(scopedAccountId, page, ctx.args?.trim() || undefined);
  const products = productPage.items;

  if (!products?.length) {
    const msg = '<blockquote><b>Không có sản phẩm phù hợp.</b></blockquote>';
    const kb: TelegramButton[][] = [[{ text: '➕ Tạo SP', callback_data: 'cmd:newproduct' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]];
    if (messageId && ctx.callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }

  const total = productPage.total;
  const totalPages = productPage.total_pages;
  const lines = products.map((product, index) => {
    const status = product.is_active ? '🟢' : '🔴';
    const name = product.is_active ? `<b>${escapeHtml(product.name)}</b>` : `<s>${escapeHtml(product.name)}</s>`;
    return `${page * PAGE_SIZE + index + 1}. ${status} ${name} — ${formatVnd(product.sell_price_vnd ?? 0)}`;
  });

  const kb: TelegramButton[][] = products.map((product) => [
    { text: `${product.is_active ? '📦' : '🚫'} ${product.name}`, callback_data: `prodview:${product.id}` },
  ]);

  const navRow: TelegramButton[] = [];
  if (page > 0) navRow.push({ text: '⬅️ Trang trước', callback_data: `products:page:${page - 1}` });
  navRow.push({ text: `Trang ${page + 1}/${totalPages}`, callback_data: 'noop' });
  if (page + 1 < totalPages) navRow.push({ text: 'Trang sau ➡️', callback_data: `products:page:${page + 1}` });
  kb.push(navRow);
  kb.push([{ text: '➕ Tạo SP', callback_data: 'cmd:newproduct' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]);

  const finalMsg = `<blockquote><b>DANH SÁCH SẢN PHẨM (${total})</b>\nTrang ${page + 1}/${totalPages}</blockquote>\n\n${lines.join('\n')}`;
  if (messageId && ctx.callbackQueryId) await editMsg(chatId, messageId, finalMsg, kb);
  else await sendKb(chatId, finalMsg, kb);
};

export const handleScopedProductViewCallback: BotHandler = async (ctx) => {
  const { chatId, messageId, callbackQueryId, callbackData } = ctx;
  const productId = (callbackData ?? '').replace('prodview:', '');
  const scopedAccountId = ctx.accountId ?? process.env.TELEGRAM_BOT_ACCOUNT_ID ?? '';

  let productQuery = supabaseAdmin
    .from('products')
    .select('id, name, sell_price_vnd, is_active, sku, description')
    .eq('id', productId)
    .is('deleted_at', null);

  if (scopedAccountId) {
    productQuery = productQuery.eq('account_id', scopedAccountId);
  }

  const { data: product } = await productQuery.single();
  if (!product) {
    const msg = '<blockquote><b>Sản phẩm không tồn tại hoặc không thuộc account hiện tại.</b></blockquote>';
    const kb: TelegramButton[][] = [[{ text: '⬅️ DS sản phẩm', callback_data: 'cmd:products' }]];
    if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
    else await sendKb(chatId, msg, kb);
    return;
  }

  let khoQuery = supabaseAdmin
    .from('source_accounts')
    .select('id, email, max_slots, used_slots, expires_at, reserved_nicks')
    .is('deleted_at', null)
    .contains('product_ids', [productId])
    .order('expires_at', { ascending: false })
    .limit(30);

  if (scopedAccountId) {
    khoQuery = khoQuery.eq('account_id', scopedAccountId);
  }

  const [{ data: khoAccs }, { count: orderCount }] = await Promise.all([
    khoQuery,
    supabaseAdmin.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
  ]);

  const now = new Date();
  const active = (khoAccs ?? []).filter((item) => !item.expires_at || new Date(item.expires_at) > now);
  const withSlots = active.filter((item) => item.used_slots < item.max_slots);
  const totalFree = withSlots.reduce((sum, item) => sum + (item.max_slots - item.used_slots), 0);

  const sections: string[] = [
    modernHeader('SẢN PHẨM', '📦'),
    '',
    `<blockquote><b>${escapeHtml(product.name)}</b> ${product.is_active ? '🟢' : '🔴'}`,
    modernDetail('Giá', formatVnd(product.sell_price_vnd ?? 0), '💰'),
    product.sku ? modernDetail('SKU', `<code>${escapeHtml(product.sku)}</code>`, '📋') : '',
    modernDetail('Đơn hàng', `${orderCount ?? 0}`, '🧾'),
    `</blockquote>`,
    '',
    modernHeader('KHO HÀNG', '📊'),
    '',
    `<blockquote>${modernDetail('Tổng TK', `${(khoAccs ?? []).length}`, '📧')}`,
    modernDetail('Có slot', `${withSlots.length}`, '✅'),
    modernDetail('Slot trống', `${totalFree}`, '🆓'),
    `</blockquote>`,
  ];

  if (withSlots.length > 0) {
    sections.push('', modernHeader(`KHO CÒN SLOT (${withSlots.length})`, '🟢'), '');
    for (const item of withSlots.slice(0, 10)) {
      const free = item.max_slots - item.used_slots;
      const expStr = item.expires_at ? formatDate(item.expires_at) : '∞';
      sections.push(modernList(
        `<code>${escapeHtml(item.email)}</code>`,
        `Đã dùng: ${item.used_slots}/${item.max_slots} (trống: ${free}) | HSD: ${expStr}`,
        '📧',
      ));
    }
  }

  const credBtns: TelegramButton[][] = withSlots.slice(0, 6).map((item) => {
    const emailTrunc = item.email.length > 20 ? item.email.slice(0, 18) + '..' : item.email;
    return [{ text: `🔐 ${emailTrunc} (${item.max_slots - item.used_slots})`, callback_data: `creds:acc:${item.id}` }];
  });

  const msg = sections.filter(Boolean).join('\n');
  const kb: TelegramButton[][] = [
    ...credBtns,
    [{ text: '📦 Tạo đơn', callback_data: 'cmd:neworder' }, { text: '🔗 Gán kho', callback_data: 'cmd:allocate' }],
    [{ text: '⬅️ DS sản phẩm', callback_data: 'cmd:products' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  if (messageId && callbackQueryId) await editMsg(chatId, messageId, msg, kb);
  else await sendKb(chatId, msg, kb);
};
