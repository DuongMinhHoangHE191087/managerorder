// ============================================================
// API TESTS: Payment Gateway Integration
//
// Tests how the order system handles different payment gateway
// responses using the mock factory from payment-gateway.mock.ts.
//
// Scenarios:
//  1. Gateway approves → order is marked as paid
//  2. Gateway declines → order stays pending, error displayed
//  3. Gateway timeout → graceful handling, no state change
//  4. Checksum mismatch → reject + security alert
//
// NOTE: This is a unit-level integration test using mocks.
// For real E2E gateway testing, use a sandbox/staging environment.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  createSuccessResponse,
  createDeclineResponse,
  createTimeoutResponse,
  createChecksumErrorResponse,
  verifyGatewayChecksum,
  withLatency,
  type GatewayResponse,
  type GatewayError,
} from "@/tests/mocks/payment-gateway.mock";

// ── Gateway Response Handling Logic ──────────────────────────
// This simulates the order system's response handler that would
// process gateway callbacks/webhooks in production.

interface PaymentResult {
  success: boolean;
  shouldUpdateOrder: boolean;
  newStatus?: string;
  errorMessage?: string;
  securityAlert?: boolean;
  retryable?: boolean;
}

function handleGatewayResponse(
  response: GatewayResponse | GatewayError,
  currentOrderStatus: string
): PaymentResult {
  // Check for error-type responses (decline, timeout)
  if ("errorCode" in response) {
    const error = response as GatewayError;

    if (error.status === "timeout") {
      return {
        success: false,
        shouldUpdateOrder: false, // NEVER update on timeout — state is unknown
        errorMessage: error.message,
        retryable: true,
      };
    }

    return {
      success: false,
      shouldUpdateOrder: false,
      errorMessage: error.message,
      retryable: error.retryable,
    };
  }

  // Check checksum integrity (prevent tampered responses)
  const gatewayResponse = response as GatewayResponse;
  if (!verifyGatewayChecksum(gatewayResponse)) {
    return {
      success: false,
      shouldUpdateOrder: false, // NEVER trust tampered data
      errorMessage: "Checksum verification failed — possible tampering detected",
      securityAlert: true,
    };
  }

  // Valid success response
  if (gatewayResponse.status === "approved") {
    return {
      success: true,
      shouldUpdateOrder: true,
      newStatus:
        currentOrderStatus === "pending_payment" ? "paid" : currentOrderStatus,
    };
  }

  return {
    success: false,
    shouldUpdateOrder: false,
    errorMessage: "Unknown gateway response status",
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("Payment Gateway Integration", () => {
  // ─── Scenario 1: Gateway Approves ────────────────────────
  describe("Gateway approves payment", () => {
    it("marks order as paid when gateway approves", () => {
      const response = createSuccessResponse(200000);
      const result = handleGatewayResponse(response, "pending_payment");

      expect(result.success).toBe(true);
      expect(result.shouldUpdateOrder).toBe(true);
      expect(result.newStatus).toBe("paid");
    });

    it("preserves current status if order is not pending_payment", () => {
      const response = createSuccessResponse(50000);
      const result = handleGatewayResponse(response, "paid");

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe("paid"); // Already paid, no change
    });

    it("success response includes transaction ID and amount", () => {
      const response = createSuccessResponse(100000);
      expect(response.transactionId).toBeTruthy();
      expect(response.amount).toBe(100000);
      expect(response.currency).toBe("VND");
    });

    it("success response has valid checksum", () => {
      const response = createSuccessResponse(150000);
      expect(verifyGatewayChecksum(response)).toBe(true);
    });
  });

  // ─── Scenario 2: Gateway Declines ───────────────────────
  describe("Gateway declines payment", () => {
    it("keeps order pending when card is declined", () => {
      const response = createDeclineResponse(200000, "card_declined");
      const result = handleGatewayResponse(response, "pending_payment");

      expect(result.success).toBe(false);
      expect(result.shouldUpdateOrder).toBe(false);
      expect(result.errorMessage).toContain("từ chối");
    });

    it.each([
      { reason: "insufficient_funds" as const, retryable: true },
      { reason: "card_declined" as const, retryable: false },
      { reason: "fraud_detected" as const, retryable: false },
      { reason: "expired_card" as const, retryable: false },
    ])("decline reason=$reason → retryable=$retryable", ({ reason, retryable }) => {
      const response = createDeclineResponse(100000, reason);
      const result = handleGatewayResponse(response, "pending_payment");

      expect(result.retryable).toBe(retryable);
    });

    it("insufficient_funds includes Vietnamese error message", () => {
      const response = createDeclineResponse(100000, "insufficient_funds");
      expect(response.message).toContain("Số dư không đủ");
    });
  });

  // ─── Scenario 3: Gateway Timeout ────────────────────────
  describe("Gateway timeout", () => {
    it("does NOT update order status on timeout (state unknown)", () => {
      const response = createTimeoutResponse(30000);
      const result = handleGatewayResponse(response, "pending_payment");

      expect(result.success).toBe(false);
      expect(result.shouldUpdateOrder).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it("timeout message includes duration info", () => {
      const response = createTimeoutResponse(15000);
      expect(response.message).toContain("15s");
    });

    it("timeout is always retryable", () => {
      const response = createTimeoutResponse();
      expect(response.retryable).toBe(true);
    });
  });

  // ─── Scenario 4: Checksum Mismatch (Tampered Response) ──
  describe("Checksum mismatch — tampered response", () => {
    it("rejects payment with INVALID checksum → security alert", () => {
      const response = createChecksumErrorResponse(200000);
      const result = handleGatewayResponse(response, "pending_payment");

      expect(result.success).toBe(false);
      expect(result.shouldUpdateOrder).toBe(false);
      expect(result.securityAlert).toBe(true);
      expect(result.errorMessage).toContain("Checksum");
    });

    it("tampered response has status=approved but wrong checksum", () => {
      const response = createChecksumErrorResponse(100000);
      // It LOOKS like it's approved...
      expect(response.status).toBe("approved");
      // ...but the checksum is INVALID
      expect(verifyGatewayChecksum(response)).toBe(false);
    });
  });

  // ─── Network Latency Simulation ─────────────────────────
  describe("Network latency simulation", () => {
    it("withLatency wraps response with delay", async () => {
      const response = createSuccessResponse(100000);
      const start = Date.now();
      const delayed = await withLatency(response, 100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow small timing variance
      expect(delayed).toEqual(response);
    });
  });
});
