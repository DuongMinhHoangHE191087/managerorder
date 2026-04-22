// ============================================================
// CRON: AUTO-ESCALATION
// ============================================================
// Evaluates escalation rules against overdue orders.
// Runs daily via Vercel Cron (0 1 * * * = 8AM VN).

import { NextRequest, NextResponse } from 'next/server';
import { processAllEscalations } from '@/lib/services/escalation.service';

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
    const result = await processAllEscalations();

    console.log(`[Cron AutoEscalation] Processed ${result.processedOrders} orders, ${result.actionsExecuted} actions`);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Auto-escalation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
