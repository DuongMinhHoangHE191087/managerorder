// ============================================================
// CRON: REVENUE REPORT
// ============================================================
// Sends daily/weekly revenue summary to Telegram.
// Daily: 8AM VN every day. Weekly: Monday 8AM VN.
// Uses query param ?type=weekly for weekly report.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendTelegramMessage, formatVnd } from '@/lib/utils/telegram';
import { addDaysToDateKey, formatDateKey, formatDateShort } from '@/lib/utils';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

interface RevenueStats {
  totalRevenue: number;
  newOrders: number;
  paidOrders: number;
  newDebt: number;
  activeOrders: number;
}

/* ─── Query revenue stats for a date range ─────────────────── */
async function getRevenueStats(fromDate: string, toDate: string): Promise<RevenueStats> {
  // Count orders and sum revenue in the date range
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('status, total_amount_vnd, total_paid')
    .gte('created_at', fromDate)
    .lt('created_at', toDate);

  if (error) throw error;

  const stats: RevenueStats = {
    totalRevenue: 0,
    newOrders: 0,
    paidOrders: 0,
    newDebt: 0,
    activeOrders: 0,
  };

  for (const o of (orders ?? [])) {
    stats.newOrders++;
    const amount = Number(o.total_amount_vnd ?? 0);
    const paid = Number(o.total_paid ?? 0);

    stats.totalRevenue += amount;

    if (o.status === 'paid' || o.status === 'active' || o.status === 'provisioning') {
      stats.paidOrders++;
    }

    if (paid < amount) {
      stats.newDebt += (amount - paid);
    }

    if (o.status === 'active') {
      stats.activeOrders++;
    }
  }

  return stats;
}

/* ─── Query previous period for comparison ──────────────────── */
async function getPreviousPeriodRevenue(fromDate: string, toDate: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('total_amount_vnd')
    .gte('created_at', fromDate)
    .lt('created_at', toDate);

  if (error) return 0;
  return (data ?? []).reduce((sum, o) => sum + Number(o.total_amount_vnd ?? 0), 0);
}

/* ─── Format percentage change ──────────────────────────────── */
function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '📈 Mới bắt đầu' : '➖ Không có dữ liệu';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  const emoji = change >= 0 ? '📈' : '📉';
  return `${emoji} So với kỳ trước: <b>${sign}${change.toFixed(1)}%</b>`;
}

/* ─── Build Telegram message ────────────────────────────────── */
function buildReportMessage(
  stats: RevenueStats,
  prevRevenue: number,
  dateLabel: string,
  reportType: string
): string {
  const typeLabel = reportType === 'weekly' ? '📅 BÁO CÁO TUẦN' : '📊 BÁO CÁO DOANH THU';
  const changeStr = formatPercentChange(stats.totalRevenue, prevRevenue);

  return [
    `${typeLabel}`,
    `<b>${dateLabel}</b>`,
    `━━━━━━━━━━━━━━━━━━━`,
    `├ 💰 Doanh thu: <b>${formatVnd(stats.totalRevenue)}</b>`,
    `├ 📦 Đơn mới: <b>${stats.newOrders}</b>`,
    `├ ✅ Đã thanh toán: <b>${stats.paidOrders}</b>`,
    `├ 💳 Công nợ mới: <b>${formatVnd(stats.newDebt)}</b>`,
    `└ ${changeStr}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `<i>Chúc bạn làm việc hiệu quả! 💪</i>`,
  ].join('\n');
}

/* ─── GET handler ──────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const reportType = request.nextUrl.searchParams.get('type') ?? 'daily';
    const now = new Date();
    const todayKey = formatDateKey(now, { timeZone: 'Asia/Ho_Chi_Minh' });

    let fromDate: string;
    let toDate: string;
    let prevFromDate: string;
    let prevToDate: string;
    let dateLabel: string;

    if (reportType === 'weekly') {
      // Last 7 days
      const weekAgoKey = addDaysToDateKey(todayKey, -7);
      const twoWeeksAgoKey = addDaysToDateKey(todayKey, -14);

      fromDate = `${weekAgoKey}T00:00:00+07:00`;
      toDate = `${todayKey}T00:00:00+07:00`;

      // Previous 7 days for comparison
      prevFromDate = `${twoWeeksAgoKey}T00:00:00+07:00`;
      prevToDate = fromDate;

      dateLabel = `${formatDateShort(weekAgoKey, { timeZone: 'Asia/Ho_Chi_Minh' })} - ${formatDateShort(todayKey, { timeZone: 'Asia/Ho_Chi_Minh' })}`;
    } else {
      // Yesterday
      const yStr = addDaysToDateKey(todayKey, -1);

      fromDate = `${yStr}T00:00:00+07:00`;
      toDate = `${yStr}T23:59:59+07:00`;

      // Day before yesterday for comparison
      const dbStr = addDaysToDateKey(todayKey, -2);
      prevFromDate = `${dbStr}T00:00:00+07:00`;
      prevToDate = `${dbStr}T23:59:59+07:00`;

      dateLabel = formatDateShort(yStr, { timeZone: 'Asia/Ho_Chi_Minh' });
    }

    // Fetch stats
    const [stats, prevRevenue] = await Promise.all([
      getRevenueStats(fromDate, toDate),
      getPreviousPeriodRevenue(prevFromDate, prevToDate),
    ]);

    // Build and send message
    const message = buildReportMessage(stats, prevRevenue, dateLabel, reportType);
    const sent = await sendTelegramMessage(message);

    return NextResponse.json({
      success: sent,
      reportType,
      dateLabel,
      stats,
      message: sent ? 'Report sent' : 'Failed or missing Telegram config',
    });
  } catch (error) {
    console.error('[Cron] Revenue report error:', error);

    // Try to send error notification
    sendTelegramMessage(
      `⚠️ <b>Lỗi tạo báo cáo doanh thu</b>\n<i>${error instanceof Error ? error.message : 'Unknown error'}</i>`
    ).catch(() => {});

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
