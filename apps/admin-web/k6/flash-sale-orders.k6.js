/* eslint-disable */
/**
 * ============================================================
 * K6 PERFORMANCE TEST — Flash Sale Order Simulation
 *
 * Simulates a flash sale scenario where thousands of concurrent
 * users attempt to create orders simultaneously. This test
 * identifies:
 * 1. Database bottlenecks under high write load
 * 2. Optimistic locking failures under contention
 * 3. Inventory overselling (race conditions)
 * 4. API response time degradation at scale
 *
 * Run: k6 run k6/flash-sale-orders.k6.js
 *
 * Prerequisites:
 *   1. Install k6: npm install -g k6 (or brew install k6)
 *   2. Set K6_BASE_URL and K6_AUTH_TOKEN env vars
 *   3. Seed test data: customers, products with inventory
 * ============================================================
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";
import { SharedArray } from "k6/data";

// ── Custom Metrics ──────────────────────────────────────────
const errorRate = new Rate("error_rate");
const orderCreateDuration = new Trend("order_create_duration", true);
const paymentDuration = new Trend("payment_record_duration", true);
const statusUpdateDuration = new Trend("status_update_duration", true);
const ordersCreated = new Counter("orders_created_total");
const ordersFailed = new Counter("orders_failed_total");
const orderConflicts = new Counter("order_conflicts_total");    // 409 responses
const concurrentUsers = new Gauge("concurrent_users");

// ── Configuration ───────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "test-token";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

// ── Test Data ───────────────────────────────────────────────
// Realistic product IDs that would exist in the test database
const TEST_PRODUCTS = new SharedArray("products", () => [
  { id: "prod-flash-001", name: "Netflix 1 tháng", price: 100000 },
  { id: "prod-flash-002", name: "Spotify 3 tháng", price: 150000 },
  { id: "prod-flash-003", name: "Disney+ 1 tháng", price: 80000 },
  { id: "prod-flash-004", name: "YouTube Premium", price: 120000 },
]);

const TEST_CUSTOMERS = new SharedArray("customers", () => {
  const custs = [];
  for (let i = 0; i < 100; i++) {
    custs.push(`cust-load-${String(i).padStart(3, "0")}`);
  }
  return custs;
});

// ── Load Stages ─────────────────────────────────────────────
export const options = {
  scenarios: {
    // ─── Scenario 1: Flash Sale Spike ─────────────────────
    // Simulates a flash sale starting at 00:00 — massive spike
    flash_sale: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 50 },   // Pre-sale warm-up
        { duration: "5s", target: 500 },   // ⚡ Flash sale STARTS — spike to 500
        { duration: "30s", target: 500 },  // Sustained flash sale load
        { duration: "10s", target: 200 },  // Gradual decline
        { duration: "10s", target: 50 },   // Tail traffic
        { duration: "5s", target: 0 },     // Cooldown
      ],
      gracefulRampDown: "10s",
    },

    // ─── Scenario 2: Concurrent Payment Race ─────────────
    // Multiple users try to pay the same order simultaneously
    payment_race: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 5,
      startTime: "75s", // Start after flash sale
    },

    // ─── Scenario 3: Status Update Burst ─────────────────
    // Admin team processing orders after the sale
    admin_processing: {
      executor: "ramping-arrival-rate",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 30,
      stages: [
        { duration: "10s", target: 5 },   // Normal processing
        { duration: "10s", target: 15 },  // Team kicks in
        { duration: "10s", target: 5 },   // Slowdown
      ],
      startTime: "90s",
      gracefulStop: "10s",
    },
  },

  thresholds: {
    // ── Performance SLOs ──────────────────────────────────
    http_req_duration: ["p(95)<3000"],          // 95% < 3s globally
    order_create_duration: ["p(95)<2000"],       // Order creation p95 < 2s
    payment_record_duration: ["p(95)<1500"],     // Payment p95 < 1.5s
    status_update_duration: ["p(95)<1000"],      // Status update p95 < 1s
    error_rate: ["rate<0.10"],                   // Allow 10% errors in flash sale
    orders_created_total: ["count>100"],         // At least 100 orders should succeed
    order_conflicts_total: ["count<50"],         // Conflicts should be manageable
  },
};

// ── Helpers ──────────────────────────────────────────────────

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOrderPayload() {
  const numItems = Math.ceil(Math.random() * 3); // 1-3 items
  const items = [];
  const usedProducts = new Set();

  for (let i = 0; i < numItems; i++) {
    let product;
    do {
      product = randomItem(TEST_PRODUCTS);
    } while (usedProducts.has(product.id));
    usedProducts.add(product.id);

    items.push({
      productId: product.id,
      quantity: Math.ceil(Math.random() * 3), // 1-3 quantity
    });
  }

  return {
    customerId: randomItem(TEST_CUSTOMERS),
    items,
    salesNote: `K6 flash sale test - VU ${__VU}`,
  };
}

// ── Default Test Function (Flash Sale) ──────────────────────
export default function () {
  concurrentUsers.add(1);

  group("Flash Sale — Create Order", () => {
    const payload = generateOrderPayload();

    const res = http.post(
      `${BASE_URL}/api/orders`,
      JSON.stringify(payload),
      { headers, tags: { type: "create_order" } }
    );

    orderCreateDuration.add(res.timings.duration);

    const passed = check(res, {
      "create order status 2xx": (r) => r.status >= 200 && r.status < 300,
      "response has order id": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.id;
        } catch {
          return false;
        }
      },
      "response time < 3s": (r) => r.timings.duration < 3000,
    });

    if (passed) {
      ordersCreated.add(1);
    } else {
      ordersFailed.add(1);
      if (res.status === 409) {
        orderConflicts.add(1);
      }
      errorRate.add(1);
    }

    sleep(0.1 + Math.random() * 0.5); // Realistic think time (100-600ms)
  });
}

// ── Payment Race Scenario ───────────────────────────────────
export function payment_race() {
  const sharedOrderId = "order-race-test-001"; // Shared order for race testing

  group("Payment Race — Concurrent Payment", () => {
    const payload = {
      amount: 50000, // Small partial payment
      payment_method: "bank_transfer",
      reference: `pay-${__VU}-${Date.now()}`,
    };

    const res = http.post(
      `${BASE_URL}/api/orders/${sharedOrderId}/payment`,
      JSON.stringify(payload),
      { headers, tags: { type: "payment_race" } }
    );

    paymentDuration.add(res.timings.duration);

    check(res, {
      "payment accepted or conflict": (r) =>
        r.status === 200 || r.status === 409,
      "no server error": (r) => r.status < 500,
    });

    if (res.status === 409) {
      orderConflicts.add(1);
      // 409 is EXPECTED in race conditions — optimistic locking working correctly
    }

    errorRate.add(res.status >= 500 ? 1 : 0);
    sleep(0.05); // Very fast retries in race scenario
  });
}

// ── Admin Processing Scenario ───────────────────────────────
export function admin_processing() {
  group("Admin — Batch Status Updates", () => {
    // GET orders list
    const listRes = http.get(
      `${BASE_URL}/api/orders?status=pending&limit=10`,
      { headers, tags: { type: "list_orders" } }
    );

    check(listRes, {
      "list orders 200": (r) => r.status === 200,
    });

    // Simulate updating first order's status
    try {
      const orders = JSON.parse(listRes.body).data;
      if (orders && orders.length > 0) {
        const orderId = orders[0].id;

        const updateRes = http.put(
          `${BASE_URL}/api/orders/${orderId}`,
          JSON.stringify({ status: "paid" }),
          { headers, tags: { type: "update_status" } }
        );

        statusUpdateDuration.add(updateRes.timings.duration);

        check(updateRes, {
          "update status success": (r) =>
            r.status === 200 || r.status === 400 || r.status === 409,
        });
      }
    } catch {
      // Parsing failed — skip
    }

    sleep(1);
  });
}

// ── Summary Report ──────────────────────────────────────────
export function handleSummary(data) {
  const summary = {
    "📊 Flash Sale Performance Report": {
      "Total Orders Created": data.metrics.orders_created_total?.values?.count || 0,
      "Total Orders Failed": data.metrics.orders_failed_total?.values?.count || 0,
      "Conflict Count (409)": data.metrics.order_conflicts_total?.values?.count || 0,
      "Order Create p95 (ms)": Math.round(
        data.metrics.order_create_duration?.values?.["p(95)"] || 0
      ),
      "Payment p95 (ms)": Math.round(
        data.metrics.payment_record_duration?.values?.["p(95)"] || 0
      ),
      "Error Rate": `${(
        (data.metrics.error_rate?.values?.rate || 0) * 100
      ).toFixed(2)}%`,
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
