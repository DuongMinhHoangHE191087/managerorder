// ============================================================
// FRAUD DETECTOR — Short Link Anti-Fraud Engine
// Detects suspicious click patterns and alerts via Telegram
// ============================================================

import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatDateCustom } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

export interface ClickInfo {
  shortLinkId: string;
  ipAddress: string;
  userAgent: string | null;
  referer: string | null;
}

interface FraudAlert {
  linkId: string;
  slug: string;
  reason: string;
  details: string;
}

// ─── Device Detection ───────────────────────────────────────

const BOT_PATTERNS = /bot|spider|crawler|curl|wget|python|httpie|postman|insomnia|zalo|facebookexternalhit|facebot|telegrambot|twitterbot|discordbot|linkedinbot|whatsapp|preview|slurp|ia_archiver/i;
const MOBILE_PATTERNS = /mobile|android|iphone|ipad|ipod|opera mini|iemobile/i;
const TABLET_PATTERNS = /tablet|ipad|nexus 7|nexus 10|kindle/i;

export function detectDeviceType(ua: string | null): string {
  if (!ua) return 'unknown';
  if (BOT_PATTERNS.test(ua)) return 'bot';
  // Check tablet first because mobile patterns often include 'ipad' or 'android' generically
  if (TABLET_PATTERNS.test(ua)) return 'tablet';
  if (MOBILE_PATTERNS.test(ua)) return 'mobile';
  return 'desktop';
}

// ─── IP Extraction ──────────────────────────────────────────

export function extractIP(headers: Headers): string {
  // Priority: CF-Connecting-IP > X-Real-IP > X-Forwarded-For > fallback
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.split(',')[0].trim();

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return '0.0.0.0';
}

// ─── Click Logger (Async, non-blocking) ─────────────────────

export async function logClick(info: ClickInfo): Promise<void> {
  const deviceType = detectDeviceType(info.userAgent);
  const isSuspicious = deviceType === 'bot' || !info.userAgent;
  const suspiciousReason = !info.userAgent ? 'empty_user_agent' : deviceType === 'bot' ? 'bot_user_agent' : null;

  try {
    await supabaseAdmin.from('short_link_clicks').insert({
      short_link_id: info.shortLinkId,
      ip_address: info.ipAddress,
      user_agent: info.userAgent,
      referer: info.referer,
      device_type: deviceType,
      is_suspicious: isSuspicious,
      suspicious_reason: suspiciousReason,
    });

    // Run fraud checks (async, don't await in redirect path)
    runFraudChecks(info.shortLinkId, info.ipAddress, info.referer).catch(console.error);

    // Send click notification if enabled for this link
    sendClickNotification(info, deviceType, isSuspicious).catch(console.error);
  } catch (err) {
    // Never block redirect for logging errors
    console.error('[fraud-detector] logClick error:', err);
  }
}

// ─── Click Notification (Per-Click Alert) ───────────────────

async function sendClickNotification(
  info: ClickInfo,
  deviceType: string,
  isSuspicious: boolean,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!botToken || !chatId) return;

  // Check if this link has notifications enabled
  const { data: link } = await supabaseAdmin
    .from('short_links')
    .select('slug, title, notify_clicks, current_clicks, max_clicks')
    .eq('id', info.shortLinkId)
    .single();

  if (!link || !link.notify_clicks) return;

  // Parse browser from UA
  const browser = parseBrowser(info.userAgent);
  const refDomain = parseRefererDomain(info.referer);
  // NOTE: current_clicks hasn't been incremented yet at this point, so add 1
  const clickCount = (link.current_clicks ?? 0) + 1;
  const progressPct = link.max_clicks > 0 ? Math.round((clickCount / link.max_clicks) * 100) : 0;
  const progressBar = buildProgressBar(progressPct);

  const deviceEmoji: Record<string, string> = {
    mobile: '📱', desktop: '🖥️', tablet: '📟', bot: '🤖', unknown: '❓',
  };

  const timestamp = formatDateCustom(new Date(), { timeZone: 'Asia/Ho_Chi_Minh' }, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const msg = [
    `${isSuspicious ? '🚨' : '🔔'} <b>Click ${isSuspicious ? 'NGHI NGỜ' : 'mới'}</b> — <code>${escapeHtml(link.slug)}</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    link.title ? `📌 <b>${escapeHtml(link.title)}</b>` : '',
    ``,
    `${deviceEmoji[deviceType] ?? '❓'} <b>Thiết bị:</b> ${deviceType}`,
    `🌐 <b>IP:</b> <code>${info.ipAddress}</code>`,
    `🔍 <b>Trình duyệt:</b> ${browser}`,
    `🔗 <b>Nguồn:</b> ${refDomain}`,
    ``,
    `📊 <b>Click:</b> ${clickCount}/${link.max_clicks} (${progressPct}%)`,
    `${progressBar}`,
    ``,
    `⏰ ${timestamp}`,
  ].filter(Boolean).join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        disable_notification: !isSuspicious,
      }),
    });
  } catch (err) {
    console.error('[fraud-detector] Click notification failed:', err);
  }
}

/** Build visual progress bar for Telegram */
function buildProgressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return `${'▓'.repeat(filled)}${'░'.repeat(empty)} ${pct}%`;
}

/** Parse browser name from User-Agent */
function parseBrowser(ua: string | null): string {
  if (!ua) return 'Không rõ';
  const patterns: [RegExp, string][] = [
    [/Zalo\//i, 'Zalo'],
    [/TelegramBot/i, 'Telegram Bot'],
    [/FBAN|FBAV/i, 'Facebook App'],
    [/Edg\//i, 'Edge'],
    [/OPR\/|Opera/i, 'Opera'],
    [/Chrome\/[\d.]+.*Safari/i, 'Chrome'],
    [/Version\/[\d.]+.*Safari/i, 'Safari'],
    [/Firefox\//i, 'Firefox'],
    [/curl|wget|python|httpie|postman/i, 'CLI/Bot'],
  ];
  for (const [re, name] of patterns) {
    if (re.test(ua)) return name;
  }
  return 'Khác';
}

/** Parse referer domain */
function parseRefererDomain(ref: string | null): string {
  if (!ref) return '🎯 Trực tiếp';
  try { return new URL(ref).hostname; } catch { return ref.slice(0, 40); }
}

/** Escape HTML for Telegram */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Fraud Detection Engine ─────────────────────────────────

// Rate limiter: Track last alert time per link to avoid Telegram spam
const fraudAlertCooldown = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MAX_COOLDOWN_ENTRIES = 100;

/** Cleanup stale entries to prevent memory leak */
function cleanupCooldownMap() {
  if (fraudAlertCooldown.size <= MAX_COOLDOWN_ENTRIES) return;
  const now = Date.now();
  for (const [key, time] of fraudAlertCooldown) {
    if (now - time > ALERT_COOLDOWN_MS * 2) fraudAlertCooldown.delete(key);
  }
}

async function runFraudChecks(linkId: string, currentIp: string, referer?: string | null): Promise<void> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();

  // Check 1: Multi-IP (3+ unique IPs in 1 hour)
  const { data: recentClicks } = await supabaseAdmin
    .from('short_link_clicks')
    .select('ip_address')
    .eq('short_link_id', linkId)
    .gte('clicked_at', oneHourAgo);

  if (recentClicks) {
    const uniqueIPs = new Set(recentClicks.map(c => c.ip_address));
    if (uniqueIPs.size >= 3) {
      await flagSuspicious(linkId, 'multi_ip', `${uniqueIPs.size} unique IPs in 1h: ${[...uniqueIPs].join(', ')}`);
    }
  }

  // Check 2: Rapid clicks (5+ in 1 minute from same IP)
  const { count: rapidCount } = await supabaseAdmin
    .from('short_link_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('short_link_id', linkId)
    .eq('ip_address', currentIp)
    .gte('clicked_at', oneMinuteAgo);

  if ((rapidCount ?? 0) >= 5) {
    await flagSuspicious(linkId, 'rapid_clicks', `${rapidCount} clicks in 1min from IP ${currentIp}`);
  }

  // Check 3: Suspicious referer (self-referrer or known spam domains)
  if (referer) {
    const SPAM_DOMAINS = /semalt\.com|buttons-for-website|darodar|ilovevitaly|makemoneyonline|7makemoneyonline/i;
    try {
      const refHost = new URL(referer).hostname;
      if (SPAM_DOMAINS.test(refHost)) {
        await flagSuspicious(linkId, 'spam_referer', `Spam referer: ${refHost}`);
      }
    } catch { /* invalid referer URL, ignore */ }
  }
}

// ─── Flag & Alert ───────────────────────────────────────────

async function flagSuspicious(linkId: string, reason: string, details: string): Promise<void> {
  // Mark recent clicks as suspicious
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('short_link_clicks')
    .update({ is_suspicious: true, suspicious_reason: reason })
    .eq('short_link_id', linkId)
    .gte('clicked_at', oneHourAgo)
    .eq('is_suspicious', false);

  // Rate limit: max 1 alert per link per 5 minutes
  const lastAlert = fraudAlertCooldown.get(linkId);
  if (lastAlert && Date.now() - lastAlert < ALERT_COOLDOWN_MS) return;
  fraudAlertCooldown.set(linkId, Date.now());
  cleanupCooldownMap();

  // Get link info for alert
  const { data: link } = await supabaseAdmin
    .from('short_links')
    .select('slug, target_url, account_id')
    .eq('id', linkId)
    .single();

  if (link) {
    await sendFraudAlert({
      linkId,
      slug: link.slug,
      reason,
      details,
    });
  }
}

// ─── Telegram Alert ─────────────────────────────────────────

async function sendFraudAlert(alert: FraudAlert): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  
  if (!botToken || !chatId) return;

  const reasonEmoji: Record<string, string> = {
    multi_ip: '🌐',
    rapid_clicks: '⚡',
    bot_user_agent: '🤖',
    spam_referer: '🔗',
    empty_user_agent: '👻',
  };

  const msg = [
    `🚨 <b>FRAUD ALERT — Short Link</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${reasonEmoji[alert.reason] ?? '⚠️'} <b>Reason:</b> ${alert.reason}`,
    `🔗 <b>Slug:</b> <code>${alert.slug}</code>`,
    `📋 <b>Details:</b> ${alert.details}`,
    ``,
    `📅 ${formatDateCustom(new Date(), { timeZone: 'Asia/Ho_Chi_Minh' }, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('[fraud-detector] Alert send failed:', err);
  }
}

// ─── Analytics Query ────────────────────────────────────────

export async function getClickAnalytics(linkId: string) {
  // 1. Get actual total count from DB (not limited by fetch)
  const { count: totalAllTime } = await supabaseAdmin
    .from('short_link_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('short_link_id', linkId);

  const { count: totalRedirectClicks, error: redirectCountError } = await supabaseAdmin
    .from('short_link_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('short_link_id', linkId)
    .eq('event_type', 'redirect_click');

  // 2. Fetch recent clicks with all details
  const { data: clicks, error } = await supabaseAdmin
    .from('short_link_clicks')
    .select('*')
    .eq('short_link_id', linkId)
    .order('clicked_at', { ascending: false })
    .limit(100);

  if (error) return { clicks: [], stats: null };

  const allClicks = clicks ?? [];
  const redirectClicks = allClicks.filter((click) => (click.event_type ?? 'redirect_click') === 'redirect_click');

  // 3. Build rich stats
  const uniqueIPs = new Set(redirectClicks.map(c => c.ip_address));
  const suspicious = allClicks.filter(c => c.is_suspicious).length;

  // Device breakdown
  const devices: Record<string, number> = {};
  // Browser breakdown
  const browsers: Record<string, number> = {};
  // IP frequency map (for identifying repeat visitors)
  const ipFrequency: Record<string, number> = {};
  // Referer domains
  const referers: Record<string, number> = {};
  // Geolocation & IP Version
  const countries: Record<string, number> = {};
  const cities: Record<string, number> = {};
  const ipVersions: Record<string, number> = {};

  for (const c of redirectClicks) {
    // Device
    const d = c.device_type ?? 'unknown';
    devices[d] = (devices[d] ?? 0) + 1;

    // Browser
    const b = parseBrowser(c.user_agent);
    browsers[b] = (browsers[b] ?? 0) + 1;

    // IP frequency
    const ip = c.ip_address ?? 'unknown';
    ipFrequency[ip] = (ipFrequency[ip] ?? 0) + 1;

    // Referer domain extraction
    if (c.referer) {
      try {
        const domain = new URL(c.referer).hostname;
        referers[domain] = (referers[domain] ?? 0) + 1;
      } catch {
        referers['direct'] = (referers['direct'] ?? 0) + 1;
      }
    } else {
      referers['direct'] = (referers['direct'] ?? 0) + 1;
    }

    // Geolocation
    if (c.country) countries[c.country] = (countries[c.country] ?? 0) + 1;
    if (c.city) cities[c.city] = (cities[c.city] ?? 0) + 1;
    if (c.ip_version) ipVersions[c.ip_version] = (ipVersions[c.ip_version] ?? 0) + 1;
  }

  // Sort IP frequency (most active first)
  const topIPs = Object.entries(ipFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  // Hourly timeline (last 24h)
  const now = Date.now();
  const hourlyTimeline: { hour: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now - i * 3600_000);
    const hourEnd = new Date(now - (i - 1) * 3600_000);
    const label = formatDateCustom(hourStart, { timeZone: 'Asia/Ho_Chi_Minh' }, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const count = allClicks.filter(c => {
      const t = new Date(c.clicked_at).getTime();
      return t >= hourStart.getTime() && t < hourEnd.getTime();
    }).length;
    hourlyTimeline.push({ hour: label, count });
  }

  // Daily timeline (last 7 days)
  const dailyTimeline: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * 86400_000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400_000);
    const label = formatDateCustom(dayStart, { timeZone: 'Asia/Ho_Chi_Minh' }, { day: '2-digit', month: '2-digit' });
    const count = allClicks.filter(c => {
      const t = new Date(c.clicked_at).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    dailyTimeline.push({ day: label, count });
  }

  return {
    clicks: allClicks,
    stats: {
      totalClicks: totalRedirectClicks ?? (redirectCountError ? totalAllTime : redirectClicks.length),
      uniqueIPs: uniqueIPs.size,
      suspiciousCount: suspicious,
      devices,
      browsers,
      topIPs,
      referers,
      countries,
      cities,
      ipVersions,
      hourlyTimeline,
      dailyTimeline,
    },
  };
}
