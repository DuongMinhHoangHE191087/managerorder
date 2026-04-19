// ============================================================
// CRON: WEBHOOK RETRY
// ============================================================
// Retries pending webhook deliveries.
// Runs every 5 minutes via Vercel Cron.

import { NextRequest, NextResponse } from 'next/server';
import { retryPendingWebhooks } from '@/lib/services/event-bus.service';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await retryPendingWebhooks();

    if (stats.retried > 0) {
      console.log(`[Cron WebhookRetry] Retried ${stats.retried}, delivered ${stats.delivered}, failed ${stats.failed}`);
    }

    return NextResponse.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Webhook retry error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
