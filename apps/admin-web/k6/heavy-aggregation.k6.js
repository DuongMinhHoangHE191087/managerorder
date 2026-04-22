/* eslint-disable */
/**
 * ============================================================
 * K6 PERFORMANCE TEST — Dashboard Heavy Aggregation
 *
 * Simulates real-world dashboard load scenarios:
 * 1. Morning Rush: 100 admins open dashboard simultaneously
 * 2. Heavy Query: Sustained load on 365-day stats endpoint
 * 3. Time Filter Spam: Rapid switching between time ranges
 *
 * SLOs:
 *   - Dashboard stats p95 < 3s
 *   - Orders stats p95 < 2s
 *   - Error rate < 1%
 *
 * Run: k6 run k6/heavy-aggregation.k6.js
 *
 * Prerequisites:
 *   1. Install k6: npm install -g k6 (or brew install k6)
 *   2. Set K6_BASE_URL and K6_AUTH_TOKEN env vars
 *   3. App running with seeded test data
 * ============================================================
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";

// ── Custom Metrics ──────────────────────────────────────────
const errorRate = new Rate("dashboard_error_rate");
const dashboardStatsDuration = new Trend("dashboard_stats_duration", true);
const ordersStatsDuration = new Trend("orders_stats_duration", true);
const inventoryDashboardDuration = new Trend("inventory_dashboard_duration", true);
const cacheHitRate = new Rate("cache_hit_rate");
const totalRequests = new Counter("total_dashboard_requests");
const concurrentAdmins = new Gauge("concurrent_admins");

// ── Configuration ───────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "test-token";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

const TIME_RANGES = [7, 30, 90, 365];

// ── Load Scenarios ──────────────────────────────────────────
export const options = {
  scenarios: {
    // ─── Scenario 1: Morning Rush ─────────────────────────
    // 100 admins open dashboard at 9:00 AM
    morning_rush: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 20 },   // Early birds
        { duration: "5s", target: 100 },   // 🚀 9:00 AM — everyone opens dashboard
        { duration: "20s", target: 100 },  // Sustained morning load
        { duration: "10s", target: 50 },   // People start working
        { duration: "5s", target: 0 },     // Cooldown
      ],
      gracefulRampDown: "5s",
    },

    // ─── Scenario 2: Heavy 365-Day Query ──────────────────
    // Sustained load on the most expensive query (full year stats)
    heavy_yearly: {
      executor: "constant-vus",
      vus: 50,
      duration: "30s",
      startTime: "55s",
      exec: "heavyYearlyQuery",
    },

    // ─── Scenario 3: Time Filter Spam ─────────────────────
    // Admins rapidly switching between time ranges: 7→30→90→365
    filter_spam: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 4, // Each VU clicks through all 4 time ranges
      startTime: "90s",
      exec: "timeFilterSpam",
    },
  },

  thresholds: {
    // ── Performance SLOs ──────────────────────────────────
    dashboard_stats_duration: ["p(95)<3000"],       // Dashboard p95 < 3s
    orders_stats_duration: ["p(95)<2000"],           // Orders stats p95 < 2s
    inventory_dashboard_duration: ["p(95)<2000"],    // Inventory p95 < 2s
    dashboard_error_rate: ["rate<0.01"],              // Error rate < 1%
    http_req_duration: ["p(95)<3000"],               // Global p95 < 3s
  },
};

// ── Helpers ──────────────────────────────────────────────────

function randomTimeRange() {
  return TIME_RANGES[Math.floor(Math.random() * TIME_RANGES.length)];
}

function fetchDashboardStats(days) {
  const res = http.get(
    `${BASE_URL}/api/dashboard/stats?days=${days}`,
    { headers, tags: { endpoint: "dashboard_stats", days: String(days) } }
  );

  dashboardStatsDuration.add(res.timings.duration);
  totalRequests.add(1);

  const isOk = check(res, {
    "dashboard stats 200": (r) => r.status === 200,
    "has totalRevenue": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && typeof body.data.totalRevenue === "number";
      } catch {
        return false;
      }
    },
    "response < 3s": (r) => r.timings.duration < 3000,
  });

  errorRate.add(isOk ? 0 : 1);

  // Check cache header (if server returns cache info)
  const cacheHeader = res.headers["X-Cache"] || res.headers["x-cache"];
  cacheHitRate.add(cacheHeader === "HIT" ? 1 : 0);

  return res;
}

function fetchOrdersStats(params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const res = http.get(
    `${BASE_URL}/api/orders/stats${query ? `?${query}` : ""}`,
    { headers, tags: { endpoint: "orders_stats" } }
  );

  ordersStatsDuration.add(res.timings.duration);
  totalRequests.add(1);

  check(res, {
    "orders stats 200": (r) => r.status === 200,
    "has total_orders": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && typeof body.data.total_orders === "number";
      } catch {
        return false;
      }
    },
  });

  errorRate.add(res.status >= 400 ? 1 : 0);

  return res;
}

function fetchInventoryDashboard() {
  const res = http.get(
    `${BASE_URL}/api/inventory/dashboard`,
    { headers, tags: { endpoint: "inventory_dashboard" } }
  );

  inventoryDashboardDuration.add(res.timings.duration);
  totalRequests.add(1);

  check(res, {
    "inventory dashboard 200": (r) => r.status === 200,
    "has totalSlots": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.totalSlots === "number";
      } catch {
        return false;
      }
    },
  });

  errorRate.add(res.status >= 400 ? 1 : 0);

  return res;
}

// ── Default Scenario: Morning Rush ──────────────────────────
export default function () {
  concurrentAdmins.add(1);

  group("Morning Rush — Dashboard Load", () => {
    // Step 1: Admin opens dashboard → fires stats request
    const days = randomTimeRange();
    fetchDashboardStats(days);

    // Step 2: Sidebar also loads orders stats
    fetchOrdersStats();

    // Step 3: Inventory widget loads
    fetchInventoryDashboard();

    // Think time: admin reads the dashboard
    sleep(2 + Math.random() * 3); // 2-5 seconds reading

    // Step 4: Some admins switch time range
    if (Math.random() < 0.4) {
      const newDays = randomTimeRange();
      fetchDashboardStats(newDays);
      sleep(1);
    }
  });
}

// ── Scenario 2: Heavy Yearly Query ──────────────────────────
export function heavyYearlyQuery() {
  group("Heavy Query — 365-Day Stats", () => {
    // Full year aggregation — most expensive query
    fetchDashboardStats(365);

    // Also fetch with status filter
    fetchOrdersStats({ status: "paid", date_from: "2024-01-01" });

    sleep(1 + Math.random());
  });
}

// ── Scenario 3: Time Filter Spam ────────────────────────────
export function timeFilterSpam() {
  group("Filter Spam — Rapid Time Switching", () => {
    // Simulate admin clicking through all time tabs rapidly
    for (const days of TIME_RANGES) {
      fetchDashboardStats(days);
      sleep(0.3); // Very fast tab switching — 300ms between clicks
    }
  });
}

// ── Summary Report ──────────────────────────────────────────
export function handleSummary(data) {
  const metrics = data.metrics;

  const summary = {
    "📊 Dashboard Performance Report": {
      "Total Requests": metrics.total_dashboard_requests?.values?.count || 0,
      "Error Rate": `${(
        (metrics.dashboard_error_rate?.values?.rate || 0) * 100
      ).toFixed(2)}%`,
      "Dashboard Stats p95 (ms)": Math.round(
        metrics.dashboard_stats_duration?.values?.["p(95)"] || 0
      ),
      "Orders Stats p95 (ms)": Math.round(
        metrics.orders_stats_duration?.values?.["p(95)"] || 0
      ),
      "Inventory Dashboard p95 (ms)": Math.round(
        metrics.inventory_dashboard_duration?.values?.["p(95)"] || 0
      ),
      "Cache Hit Rate": `${(
        (metrics.cache_hit_rate?.values?.rate || 0) * 100
      ).toFixed(1)}%`,
    },
    "⚡ SLO Check": {
      "Dashboard p95 < 3s": (metrics.dashboard_stats_duration?.values?.["p(95)"] || 0) < 3000 ? "✅ PASS" : "❌ FAIL",
      "Orders p95 < 2s": (metrics.orders_stats_duration?.values?.["p(95)"] || 0) < 2000 ? "✅ PASS" : "❌ FAIL",
      "Error Rate < 1%": (metrics.dashboard_error_rate?.values?.rate || 0) < 0.01 ? "✅ PASS" : "❌ FAIL",
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
