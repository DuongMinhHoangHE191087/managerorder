/* eslint-disable */
/**
 * ============================================================
 * K6 STRESS TEST — Order API CRUD Operations
 *
 * Sustained stress test for all order CRUD endpoints to find
 * the breaking point of the system under continuous load.
 *
 * Unlike flash-sale (spike test), this maintains steady pressure
 * to identify:
 * - Memory leaks over time
 * - Connection pool exhaustion
 * - Database lock contention
 * - Response time degradation under sustained load
 *
 * Run: k6 run k6/order-api-stress.k6.js
 *
 * Prerequisites:
 *   1. Install k6: npm install -g k6 (or brew install k6)
 *   2. Set K6_BASE_URL and K6_AUTH_TOKEN env vars
 * ============================================================
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom Metrics ──────────────────────────────────────────
const errorRate = new Rate("error_rate");
const listOrderDuration = new Trend("list_order_duration", true);
const getOrderDuration = new Trend("get_order_duration", true);
const createOrderDuration = new Trend("create_order_duration", true);
const updateOrderDuration = new Trend("update_order_duration", true);
const deleteOrderDuration = new Trend("delete_order_duration", true);
const totalRequests = new Counter("total_requests");

// ── Configuration ───────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "test-token";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

// ── Load Stages ─────────────────────────────────────────────
export const options = {
  scenarios: {
    // Gradual ramp-up → sustained load → ramp down
    stress_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },   // Warm-up
        { duration: "1m", target: 25 },    // Normal load
        { duration: "2m", target: 50 },    // Medium stress
        { duration: "2m", target: 100 },   // High stress
        { duration: "1m", target: 50 },    // Scale down
        { duration: "30s", target: 0 },    // Cooldown
      ],
      gracefulRampDown: "15s",
    },
  },

  thresholds: {
    // ── SLOs ───────────────────────────────────────────────
    http_req_duration: ["p(95)<2000", "p(99)<5000"],  // p95 < 2s, p99 < 5s
    list_order_duration: ["p(95)<500"],                // List p95 < 500ms
    get_order_duration: ["p(95)<300"],                 // Get p95 < 300ms
    create_order_duration: ["p(95)<2000"],             // Create p95 < 2s
    update_order_duration: ["p(95)<1000"],             // Update p95 < 1s
    error_rate: ["rate<0.05"],                         // Error rate < 5%
  },
};

// ── Default Test Function ───────────────────────────────────
export default function () {
  let createdOrderId = null;

  // ─── READ: List Orders ──────────────────────────────────
  group("GET /api/orders (list)", () => {
    const page = Math.ceil(Math.random() * 5); // Random page 1-5
    const res = http.get(
      `${BASE_URL}/api/orders?page=${page}&limit=20`,
      { headers, tags: { type: "list" } }
    );

    listOrderDuration.add(res.timings.duration);
    totalRequests.add(1);

    const passed = check(res, {
      "list status 200": (r) => r.status === 200,
      "list has data array": (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data);
        } catch {
          return false;
        }
      },
      "list response < 500ms": (r) => r.timings.duration < 500,
    });

    if (!passed) errorRate.add(1);
    sleep(0.5);
  });

  // ─── READ: Get Single Order ─────────────────────────────
  group("GET /api/orders/:id (detail)", () => {
    // Get an order ID from the list first
    const listRes = http.get(
      `${BASE_URL}/api/orders?limit=1`,
      { headers }
    );

    try {
      const data = JSON.parse(listRes.body).data;
      if (data && data.length > 0) {
        const orderId = data[0].id;

        const res = http.get(
          `${BASE_URL}/api/orders/${orderId}`,
          { headers, tags: { type: "detail" } }
        );

        getOrderDuration.add(res.timings.duration);
        totalRequests.add(1);

        check(res, {
          "detail status 200": (r) => r.status === 200,
          "detail has order data": (r) => {
            try {
              return JSON.parse(r.body).data?.id === orderId;
            } catch {
              return false;
            }
          },
          "detail response < 300ms": (r) => r.timings.duration < 300,
        }) || errorRate.add(1);
      }
    } catch {
      // Parsing failed
    }

    sleep(0.3);
  });

  // ─── WRITE: Create Order ────────────────────────────────
  group("POST /api/orders (create)", () => {
    const payload = {
      customerId: `cust-stress-${Math.random().toString(36).substr(2, 6)}`,
      items: [
        {
          productId: "prod-stress-001",
          quantity: 1,
        },
      ],
      salesNote: `Stress test VU ${__VU} iter ${__ITER}`,
    };

    const res = http.post(
      `${BASE_URL}/api/orders`,
      JSON.stringify(payload),
      { headers, tags: { type: "create" } }
    );

    createOrderDuration.add(res.timings.duration);
    totalRequests.add(1);

    const passed = check(res, {
      "create status 2xx or 4xx": (r) => r.status < 500,
      "create response < 2s": (r) => r.timings.duration < 2000,
    });

    if (!passed) errorRate.add(1);

    // Store created order ID for subsequent operations
    try {
      if (res.status >= 200 && res.status < 300) {
        createdOrderId = JSON.parse(res.body).data?.id;
      }
    } catch {
      // Parsing failed
    }

    sleep(1);
  });

  // ─── WRITE: Update Order Status ─────────────────────────
  if (createdOrderId) {
    group("PUT /api/orders/:id (update)", () => {
      const res = http.put(
        `${BASE_URL}/api/orders/${createdOrderId}`,
        JSON.stringify({ status: "paid" }),
        { headers, tags: { type: "update" } }
      );

      updateOrderDuration.add(res.timings.duration);
      totalRequests.add(1);

      check(res, {
        "update status valid": (r) => r.status < 500,
        "update response < 1s": (r) => r.timings.duration < 1000,
      }) || errorRate.add(1);

      sleep(0.5);
    });

    // ─── DELETE: Clean up test order ──────────────────────
    group("DELETE /api/orders/:id (delete)", () => {
      const res = http.del(
        `${BASE_URL}/api/orders/${createdOrderId}`,
        null,
        { headers, tags: { type: "delete" } }
      );

      deleteOrderDuration.add(res.timings.duration);
      totalRequests.add(1);

      check(res, {
        "delete status valid": (r) => r.status < 500,
      }) || errorRate.add(1);

      sleep(0.5);
    });
  }

  sleep(1 + Math.random()); // Think time 1-2s
}

// ── Summary Report ──────────────────────────────────────────
export function handleSummary(data) {
  const summary = {
    "📊 Order API Stress Test Report": {
      "Total Requests": data.metrics.total_requests?.values?.count || 0,
      "Error Rate": `${(
        (data.metrics.error_rate?.values?.rate || 0) * 100
      ).toFixed(2)}%`,
      "List p95 (ms)": Math.round(
        data.metrics.list_order_duration?.values?.["p(95)"] || 0
      ),
      "Detail p95 (ms)": Math.round(
        data.metrics.get_order_duration?.values?.["p(95)"] || 0
      ),
      "Create p95 (ms)": Math.round(
        data.metrics.create_order_duration?.values?.["p(95)"] || 0
      ),
      "Update p95 (ms)": Math.round(
        data.metrics.update_order_duration?.values?.["p(95)"] || 0
      ),
      "Delete p95 (ms)": Math.round(
        data.metrics.delete_order_duration?.values?.["p(95)"] || 0
      ),
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
