/* eslint-disable */
/**
 * ============================================================
 * K6 LOAD TEST — Inventory API
 *
 * Simulates concurrent users performing inventory operations:
 * - GET /api/inventory (list)
 * - GET /api/inventory/dashboard (aggregated metrics)
 * - GET /api/inventory/profit-report
 * - POST /api/inventory/allocate (allocation)
 *
 * Run: k6 run k6/inventory-load-test.js
 *
 * Prerequisites:
 *   1. `npm install -g k6` (or brew install k6)
 *   2. Set K6_BASE_URL and K6_AUTH_TOKEN env vars
 * ============================================================
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom Metrics ──────────────────────────────────────────
const errorRate = new Rate("error_rate");
const dashboardDuration = new Trend("dashboard_duration", true);
const listDuration = new Trend("list_duration", true);
const profitReportDuration = new Trend("profit_report_duration", true);
const allocateDuration = new Trend("allocate_duration", true);

// ── Configuration ───────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "test-token";

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${AUTH_TOKEN}`,
};

// ── Load Stages ─────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up
    inventory_browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },  // Ramp up to 10 users
        { duration: "1m", target: 10 },   // Stay at 10 users
        { duration: "30s", target: 25 },  // Ramp up to 25 users
        { duration: "1m", target: 25 },   // Stay at 25 users
        { duration: "30s", target: 0 },   // Ramp down
      ],
      gracefulRampDown: "10s",
    },

    // Scenario 2: Spike test
    allocation_spike: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      stages: [
        { duration: "10s", target: 5 },   // 5 req/s
        { duration: "10s", target: 20 },  // Spike to 20 req/s
        { duration: "10s", target: 5 },   // Back to normal
      ],
      gracefulStop: "10s",
    },
  },

  thresholds: {
    http_req_duration: ["p(95)<2000"],    // 95% of requests < 2s
    error_rate: ["rate<0.05"],            // Error rate < 5%
    dashboard_duration: ["p(95)<500"],    // Dashboard p95 < 500ms
    list_duration: ["p(95)<300"],         // List p95 < 300ms
    profit_report_duration: ["p(95)<1000"], // Profit report p95 < 1s
    allocate_duration: ["p(95)<2000"],    // Allocation p95 < 2s
  },
};

// ── Default Test Function ───────────────────────────────────
export default function () {

  // ─ Group 1: Browse Inventory ─────────────────────────────
  group("Browse Inventory", () => {
    // List license keys
    const listRes = http.get(`${BASE_URL}/api/inventory`, { headers });
    listDuration.add(listRes.timings.duration);
    check(listRes, {
      "list status 200": (r) => r.status === 200,
      "list has data": (r) => JSON.parse(r.body).data !== undefined,
    }) || errorRate.add(1);

    sleep(0.5);

    // Dashboard
    const dashRes = http.get(`${BASE_URL}/api/inventory/dashboard`, { headers });
    dashboardDuration.add(dashRes.timings.duration);
    check(dashRes, {
      "dashboard status 200": (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.5);
  });

  // ─ Group 2: Reports ──────────────────────────────────────
  group("View Reports", () => {
    const profitRes = http.get(`${BASE_URL}/api/inventory/profit-report`, { headers });
    profitReportDuration.add(profitRes.timings.duration);
    check(profitRes, {
      "profit report status 200": (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);
  });

  // ─ Group 3: Allocation (write operations) ────────────────
  group("Allocation Suggestion", () => {
    const payload = JSON.stringify({
      orderId: "test-order-" + Math.random().toString(36).substr(2, 9),
      action: "suggest",
    });

    const allocRes = http.post(`${BASE_URL}/api/inventory/allocate`, payload, { headers });
    allocateDuration.add(allocRes.timings.duration);
    check(allocRes, {
      "allocate status is valid": (r) => [200, 400, 404].includes(r.status),
    }) || errorRate.add(1);

    sleep(1);
  });

  sleep(1); // Think time between iterations
}
