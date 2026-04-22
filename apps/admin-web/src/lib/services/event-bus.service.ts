// ============================================================
// EVENT BUS SERVICE — Webhook/Events System
// ============================================================
// Emits events to registered webhook endpoints.
// Uses HMAC-SHA256 for payload signing.
// Fire-and-forget with DB queue for retry.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createHmac, randomBytes } from "crypto";

// ─── Types ────────────────────────────────────────────────────

export type EventType =
  | 'order.created'
  | 'order.status_changed'
  | 'payment.received'
  | 'subscription.expired'
  | 'refund.completed';

export const ALL_EVENT_TYPES: EventType[] = [
  'order.created',
  'order.status_changed',
  'payment.received',
  'subscription.expired',
  'refund.completed',
];

interface WebhookEndpoint {
  id: string;
  account_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  consecutive_failures: number;
}

interface WebhookEvent {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
}

export interface EmitResult {
  eventsCreated: number;
  deliveredImmediately: number;
  errors: string[];
}

// ─── Security Helpers ─────────────────────────────────────────

/**
 * Block internal/private IP ranges to prevent SSRF
 */
function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and common internal ranges
    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
    ];

    if (blocked.includes(hostname)) return true;

    // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => !isNaN(Number(p)))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true; // Link-local
    }

    return false;
  } catch {
    return true; // Invalid URL = blocked
  }
}

/**
 * Validate webhook URL: must be HTTPS, not internal
 */
export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    if (isInternalUrl(url)) {
      return { valid: false, error: 'Internal/private URLs are not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sign a payload using HMAC-SHA256
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Generate a cryptographically random webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

// ─── Core Event Emission ──────────────────────────────────────

/**
 * Emit an event to all matching webhook endpoints for an account.
 * Creates webhook_events records and attempts immediate delivery.
 */
export async function emitEvent(
  accountId: string,
  eventType: EventType,
  payload: Record<string, unknown>
): Promise<EmitResult> {
  const result: EmitResult = {
    eventsCreated: 0,
    deliveredImmediately: 0,
    errors: [],
  };

  try {
    // Find all active endpoints that subscribe to this event type
    const { data: endpoints, error: epErr } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (epErr) {
      result.errors.push(`Query endpoints: ${epErr.message}`);
      return result;
    }

    if (!endpoints || endpoints.length === 0) return result;

    // Create webhook_events for each endpoint
    for (const ep of endpoints as WebhookEndpoint[]) {
      // Skip endpoints with too many consecutive failures
      if (ep.consecutive_failures >= 10) continue;

      const eventPayload = {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        account_id: accountId,
        data: payload,
      };

      const { data: evt, error: insertErr } = await supabaseAdmin
        .from('webhook_events')
        .insert({
          account_id: accountId,
          endpoint_id: ep.id,
          event_type: eventType,
          payload: eventPayload,
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
        })
        .select('id')
        .single();

      if (insertErr) {
        result.errors.push(`Insert event for ${ep.url}: ${insertErr.message}`);
        continue;
      }

      result.eventsCreated++;

      // Fire-and-forget immediate delivery attempt
      deliverWebhook(ep, {
        id: evt.id,
        endpoint_id: ep.id,
        event_type: eventType,
        payload: eventPayload,
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
      }).catch(() => {
        // Silently fail — cron will retry
      });
    }
  } catch (err) {
    result.errors.push(`emitEvent: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// ─── Webhook Delivery ─────────────────────────────────────────

/**
 * Deliver a single webhook event to its endpoint.
 * Updates the webhook_events record with the result.
 */
export async function deliverWebhook(
  endpoint: WebhookEndpoint,
  event: WebhookEvent
): Promise<boolean> {
  const payloadStr = JSON.stringify(event.payload);
  const signature = signPayload(payloadStr, endpoint.secret);
  const timestamp = new Date().toISOString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event.event_type,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Id': event.id,
        'User-Agent': 'ManagerOrder-Webhook/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    });

    const responseBody = await res.text().catch(() => '');

    if (res.ok) {
      // Success
      await supabaseAdmin
        .from('webhook_events')
        .update({
          status: 'delivered',
          attempts: event.attempts + 1,
          last_attempt_at: timestamp,
          response_status: res.status,
          response_body: responseBody.slice(0, 500), // Truncate
        })
        .eq('id', event.id);

      // Reset consecutive failures
      await supabaseAdmin
        .from('webhook_endpoints')
        .update({
          consecutive_failures: 0,
          last_success_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', endpoint.id);

      return true;
    } else {
      // HTTP error
      await markEventFailed(event, endpoint, `HTTP ${res.status}: ${responseBody.slice(0, 200)}`);
      return false;
    }
  } catch (err) {
    const errorMsg = err instanceof Error
      ? (err.name === 'AbortError' ? 'Timeout (10s)' : err.message)
      : String(err);

    await markEventFailed(event, endpoint, errorMsg);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mark an event as failed and update endpoint consecutive failures.
 */
async function markEventFailed(
  event: WebhookEvent,
  endpoint: WebhookEndpoint,
  errorMessage: string
): Promise<void> {
  const newAttempts = event.attempts + 1;
  const isFinalAttempt = newAttempts >= event.max_attempts;

  // Exponential backoff for retry: 1min, 5min, 30min
  const retryDelays = [60, 300, 1800]; // seconds
  const nextRetryDelay = retryDelays[Math.min(newAttempts - 1, retryDelays.length - 1)] ?? 1800;
  const nextRetryAt = new Date(Date.now() + nextRetryDelay * 1000).toISOString();

  await supabaseAdmin
    .from('webhook_events')
    .update({
      status: isFinalAttempt ? 'failed' : 'pending',
      attempts: newAttempts,
      last_attempt_at: new Date().toISOString(),
      next_retry_at: isFinalAttempt ? null : nextRetryAt,
      error_message: errorMessage,
    })
    .eq('id', event.id);

  // Increment endpoint consecutive failures
  await supabaseAdmin
    .from('webhook_endpoints')
    .update({
      consecutive_failures: endpoint.consecutive_failures + 1,
      last_failure_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', endpoint.id);
}

// ─── Retry Pending Events ─────────────────────────────────────

/**
 * Retry all pending webhook events. Called by the webhook-retry cron.
 */
export async function retryPendingWebhooks(): Promise<{ retried: number; delivered: number; failed: number }> {
  const stats = { retried: 0, delivered: 0, failed: 0 };

  const now = new Date().toISOString();

  // Fetch pending events that are ready for retry
  const { data: events, error } = await supabaseAdmin
    .from('webhook_events')
    .select('id, endpoint_id, event_type, payload, status, attempts, max_attempts')
    .eq('status', 'pending')
    .lt('next_retry_at', now)
    .lt('attempts', 3) // max_attempts
    .limit(50);

  if (error || !events) return stats;

  const endpointIds = [...new Set(events.map((event) => event.endpoint_id).filter(Boolean))];
  const { data: endpoints, error: endpointsError } = await supabaseAdmin
    .from('webhook_endpoints')
    .select('id, url, secret, events, is_active, consecutive_failures, account_id')
    .in('id', endpointIds);

  if (endpointsError) throw endpointsError;
  const endpointMap = new Map((endpoints ?? []).map((row) => [row.id, row] as const));

  for (const raw of events) {
    const endpoint = endpointMap.get(raw.endpoint_id) as unknown as WebhookEndpoint | undefined;
    if (!endpoint?.is_active || endpoint.consecutive_failures >= 10) {
      // Auto-skip disabled or problematic endpoints
      await supabaseAdmin
        .from('webhook_events')
        .update({ status: 'skipped' })
        .eq('id', raw.id);
      continue;
    }

    stats.retried++;

    const success = await deliverWebhook(endpoint, {
      id: raw.id,
      endpoint_id: raw.endpoint_id,
      event_type: raw.event_type,
      payload: raw.payload as Record<string, unknown>,
      status: raw.status,
      attempts: raw.attempts,
      max_attempts: raw.max_attempts,
    });

    if (success) stats.delivered++;
    else stats.failed++;
  }

  return stats;
}
