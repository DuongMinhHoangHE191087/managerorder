// ============================================================
// VERCEL CRON → Telegram Daily Reminder
// Runs at 6AM & 9PM (Asia/Ho_Chi_Minh) via vercel.json
// Sends a beautiful summary of today's events to a Telegram group
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listAllTodayReminderEvents, type ReminderRowWithCustomers } from '@/lib/supabase/repositories/calendar.repo';
import { sendTelegramMessage, escapeHtml } from '@/lib/utils/telegram';
import { formatDateCustom, formatDateKey } from '@/lib/utils';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/* ─── Type label mapping ─────────────────────────────────── */
const TYPE_EMOJI: Record<string, string> = {
  reminder: '📝',
  renewal: '⏳',
  follow_up: '📞',
  meeting: '🤝',
  payment: '💳',
  debt: '💰',
};

const TYPE_LABEL: Record<string, string> = {
  reminder: 'Nhắc nhở',
  renewal: 'Gia hạn',
  follow_up: 'Chăm sóc',
  meeting: 'Cuộc hẹn',
  payment: 'Thu tiền',
  debt: 'Công nợ',
};

/* ─── Format one event into HTML block ───────────────────── */
function formatEvent(evt: ReminderRowWithCustomers, index: number): string {
  const emoji = TYPE_EMOJI[evt.type] ?? '📌';
  const label = TYPE_LABEL[evt.type] ?? evt.type;
  const time = evt.due_at?.slice(11, 16);
  const timeDisplay = (!time || time === '00:00') ? 'Cả ngày' : time;

  const lines: string[] = [];
  lines.push(`${emoji} <b>${index}. ${escapeHtml(evt.title)}</b>`);
  lines.push(`    ⏰ ${timeDisplay}  ·  <i>${label}</i>`);

  if (evt._customers && evt._customers.length > 0) {
    const names = evt._customers.map(c => {
      const contacts = c.customer_contacts ?? [];
      const primary =
        contacts.find(ct => ct.is_verified)
        ?? contacts.find(ct => ct.channel === 'phone' || ct.channel === 'zalo' || ct.channel === 'telegram')
        ?? contacts[0];
      const contactStr = primary ? ` — ${primary.value}` : '';
      return `<b>${escapeHtml(c.full_name)}</b>${escapeHtml(contactStr)}`;
    });
    lines.push(`    👤 ${names.join(', ')}`);
  }

  if (evt.notes) {
    const truncated = evt.notes.length > 80 ? evt.notes.slice(0, 80) + '…' : evt.notes;
    lines.push(`    📋 <i>${escapeHtml(truncated)}</i>`);
  }

  return lines.join('\n');
}

/* ─── Build full Telegram message ────────────────────────── */
function buildMessage(events: ReminderRowWithCustomers[], dateStr: string, timeLabel: string): string {
  const header = [
    `🗓 <b>LỊCH NHẮC NHỞ CRM</b>`,
    `📅 ${dateStr}  ·  ${timeLabel}`,
    `━━━━━━━━━━━━━━━━━━━`,
    '',
  ].join('\n');

  if (events.length === 0) {
    return header + '✅ <i>Không có sự kiện nào hôm nay. Thong thả nhé!</i> 🎉';
  }

  const body = events.map((evt, i) => formatEvent(evt, i + 1)).join('\n\n');

  const footer = [
    '',
    `━━━━━━━━━━━━━━━━━━━`,
    `📊 Tổng: <b>${events.length}</b> sự kiện  ·  Chúc bạn làm việc hiệu quả! 💪`,
  ].join('\n');

  return header + body + footer;
}

/* ─── GET handler (called by Vercel Cron) ────────────────── */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel injects this header)
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get today in Vietnam timezone
    const now = new Date();
    const dateStr = formatDateKey(now, { timeZone: 'Asia/Ho_Chi_Minh' });
    const hour = Number(formatDateCustom(now, { timeZone: 'Asia/Ho_Chi_Minh' }, {
      hour: '2-digit',
      hourCycle: 'h23',
    }));
    const timeLabel = hour < 12 ? '🌅 Buổi sáng' : '🌙 Buổi tối';

    // Fetch all today's reminder events (across all accounts)
    const events = await listAllTodayReminderEvents(dateStr);

    // Build and send message
    const message = buildMessage(events, dateStr, timeLabel);
    const sent = await sendTelegramMessage(message);

    return NextResponse.json({
      success: sent,
      date: dateStr,
      eventsCount: events.length,
      message: sent ? 'Notification sent' : 'Failed or missing config',
    });
  } catch (error) {
    console.error('[Cron] Telegram reminder error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
