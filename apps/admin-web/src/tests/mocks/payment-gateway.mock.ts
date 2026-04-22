// ============================================================
// MOCK: Payment Gateway Simulator
//
// Factory functions creating mock responses for 3rd party payment
// gateway integrations. Used to test how the order system handles
// various gateway outcomes without hitting real payment APIs.
//
// WHY MOCK?
// 1. Real gateways charge money for test transactions
// 2. Network latency makes tests slow and flaky
// 3. We can simulate edge cases (timeouts, tampering) deterministically
// 4. Tests must be repeatable — real gateways aren't
//
// HOW IT WORKS:
// Each factory returns a mock response object matching the shape
// a real payment gateway (e.g. Stripe, VNPay, MoMo) would return.
// The test code uses these to mock the HTTP client layer.
// ============================================================

export type GatewayStatus = "approved" | "declined" | "timeout" | "error";

export interface GatewayResponse {
  status: GatewayStatus;
  transactionId: string;
  amount: number;
  currency: string;
  message: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayError {
  status: GatewayStatus;
  errorCode: string;
  message: string;
  retryable: boolean;
}

// ── Checksum simulation ──────────────────────────────────────
// Real gateways sign responses with HMAC. We simulate this with a
// simple hash to test checksum verification logic.
function computeChecksum(data: string, secret: string): string {
  // Simplified checksum for testing — real implementation would use HMAC-SHA256
  let hash = 0;
  const combined = data + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

const MOCK_SECRET = "test-gateway-secret-key";

// ── Success Response ─────────────────────────────────────────
/**
 * Simulates a successful payment approval from the gateway.
 * The transaction is complete and funds have been captured.
 */
export function createSuccessResponse(
  amount: number,
  overrides?: Partial<GatewayResponse>
): GatewayResponse {
  const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data = JSON.stringify({ txnId, amount, status: "approved" });

  return {
    status: "approved",
    transactionId: txnId,
    amount,
    currency: "VND",
    message: "Transaction approved successfully",
    checksum: computeChecksum(data, MOCK_SECRET),
    metadata: { processingTime: 150, gateway: "mock" },
    ...overrides,
  };
}

// ── Decline Response ─────────────────────────────────────────
/**
 * Simulates a declined payment. Common reasons:
 * - insufficient_funds: Card has no balance
 * - card_declined: Issuer rejected the transaction
 * - fraud_detected: Anti-fraud system flagged it
 * - expired_card: Card expiration date passed
 */
export function createDeclineResponse(
  amount: number,
  reason:
    | "insufficient_funds"
    | "card_declined"
    | "fraud_detected"
    | "expired_card" = "card_declined"
): GatewayError {
  const reasonMessages: Record<string, string> = {
    insufficient_funds: "Số dư không đủ để thực hiện giao dịch",
    card_declined: "Thẻ bị từ chối bởi ngân hàng phát hành",
    fraud_detected: "Giao dịch bị từ chối do nghi ngờ gian lận",
    expired_card: "Thẻ đã hết hạn",
  };

  return {
    status: "declined",
    errorCode: reason,
    message: reasonMessages[reason],
    retryable: reason === "insufficient_funds", // Only retryable if balance issue
  };
}

// ── Timeout Response ─────────────────────────────────────────
/**
 * Simulates a gateway timeout. This is the most dangerous scenario:
 * the payment MAY or MAY NOT have been processed. The system must:
 * 1. NOT assume payment succeeded (don't update order status)
 * 2. NOT assume payment failed (don't show "failed" to user)
 * 3. Queue a reconciliation check to verify later
 *
 * Real-world: happens during network issues, gateway maintenance,
 * or flash sales overloading the gateway.
 */
export function createTimeoutResponse(
  timeoutMs: number = 30000
): GatewayError {
  return {
    status: "timeout",
    errorCode: "GATEWAY_TIMEOUT",
    message: `Gateway không phản hồi sau ${timeoutMs / 1000}s. Trạng thái thanh toán chưa xác định.`,
    retryable: true,
  };
}

// ── Checksum Error Response ──────────────────────────────────
/**
 * Simulates a response where the checksum doesn't match.
 * This indicates response tampering (man-in-the-middle attack)
 * or a bug in the gateway's signing logic.
 *
 * The system MUST:
 * 1. REJECT the payment data entirely
 * 2. Log a security event for investigation
 * 3. NOT update any order/payment status
 */
export function createChecksumErrorResponse(
  amount: number
): GatewayResponse {
  return {
    status: "approved", // Looks approved but checksum is wrong!
    transactionId: `txn_tampered_${Date.now()}`,
    amount,
    currency: "VND",
    message: "Transaction approved", // Potentially fake
    checksum: "INVALID_CHECKSUM_00", // Deliberately wrong
    metadata: {
      warning: "This response has been tampered with",
      expectedChecksum: computeChecksum(
        JSON.stringify({ amount, status: "approved" }),
        MOCK_SECRET
      ),
    },
  };
}

// ── Verify Checksum ──────────────────────────────────────────
/**
 * Verifies a gateway response's checksum integrity.
 * Returns true if the checksum matches the expected value.
 */
export function verifyGatewayChecksum(
  response: GatewayResponse,
  secret: string = MOCK_SECRET
): boolean {
  const data = JSON.stringify({
    txnId: response.transactionId,
    amount: response.amount,
    status: response.status,
  });
  const expected = computeChecksum(data, secret);
  return response.checksum === expected;
}

// ── Delay Simulator ──────────────────────────────────────────
/**
 * Wraps a gateway response with simulated network latency.
 * Useful for testing timeout handling and loading states.
 */
export function withLatency<T>(
  response: T,
  delayMs: number = 200
): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(response), delayMs));
}
