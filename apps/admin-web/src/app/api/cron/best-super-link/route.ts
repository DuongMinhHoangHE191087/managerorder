// ============================================================
// CRON: BEST SUPER LINK — Daily report of longest-expiry links
// Schedule: 8:00 AM daily (configured in vercel.json)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendTelegramMessage, escapeHtml, formatDateVn } from '@/lib/utils/telegram';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch active premium accounts with join links and available slots
    const { data: accounts, error } = await supabaseAdmin
      .from('premium_accounts')
      .select('id, primary_email, total_slots, used_slots, subscription_expiry_date, join_link, status')
      .eq('status', 'active')
      .not('join_link', 'is', null)
      .is('deleted_at', null)
      .order('subscription_expiry_date', { ascending: false });

    if (error) {
      console.error('[BestSuperLink] DB error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Filter: only accounts with available slots
    const available = (accounts ?? []).filter(a => a.used_slots < a.total_slots);

    if (available.length === 0) {
      console.log('[BestSuperLink] No accounts with available slots');
      return NextResponse.json({ message: 'No accounts with slots available', count: 0 });
    }

    const now = new Date();
    const top = available.slice(0, 15);

    const lines = top.map((acc, i) => {
      const freeSlots = acc.total_slots - acc.used_slots;
      const expiry = new Date(acc.subscription_expiry_date ?? '');
      const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return [
        `${i + 1}. <b>${escapeHtml(acc.primary_email)}</b>`,
        `   🔗 <code>${escapeHtml(acc.join_link ?? '')}</code>`,
        `   📊 Trống: <b>${freeSlots}</b>/${acc.total_slots} slot`,
        `   📅 Hạn: ${formatDateVn(acc.subscription_expiry_date ?? '')} (còn <b>${daysRemaining}</b> ngày)`,
      ].join('\n');
    });

    const message = [
      `🔗 <b>BÁO CÁO SUPER LINK HÀNG NGÀY</b>`,
      `📅 ${formatDateVn(now.toISOString())}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📊 <b>Tổng link khả dụng:</b> ${available.length}`,
      `📊 <b>Hiển thị top:</b> ${top.length}`,
      ``,
      ...lines,
      ``,
      `━━━━━━━━━━━━━━━━━━━`,
      `💡 <i>Gõ /slots trên bot để tra cứu trực tiếp</i>`,
    ].join('\n');

    const sent = await sendTelegramMessage(message);

    return NextResponse.json({
      success: sent,
      total_available: available.length,
      reported: top.length,
    });
  } catch (error) {
    console.error('[BestSuperLink] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
