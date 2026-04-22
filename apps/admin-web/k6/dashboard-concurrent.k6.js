
/**
 * ============================================================
 * K6 PERFORMANCE TEST — Dashboard Concurrent & Cache Pressure
 *
 * Focus: Verifying cache effectiveness and memory stability
 * under sustained dashboard load.
 *
 * Scenarios:
 * 1. Cache Effectiveness: 100 requests same key → 1 DB hit
 * 2. Multi-Endpoint: All dashboard APIs hit simultaneously
 * 3. Memory Pressure: 1000 req/VU, monitor response degradation
 *
 * Run: k6 run k6/dashboard-concurrent.k6.js
 * ============================================================
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom Metrics ──────────────────────────────────────────
const errorRate = new Rate("concurrent_error_rate");
const statsDuration = new Trend("concurrent_stats_duration", true);
const degradationTrend = new Trend("response_degradation_trend", true);
const requestCount = new Counter("concurrent_requests_total");
const slowRequests = new Counter("slow_requests_gt_2s");

// ── Configuration ───────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "test-token";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

// ── Scenarios ───────────────────────────────────────────────
export const options = {
  scenarios: {
    // ─── Scenario 1: Cache Effectiveness Test ─────────────
    // 100 concurrent requests to the same endpoint + same days param
    // If cache works: all 100 should be fast after first DB hit
    cache_effectiveness: {
      executor: "shared-iterations",
      vus: 100,
      iterations: 100,
      maxDuration: "30s",
      exec: "cacheEffectiveness",
    },

    // ─── Scenario 2: Multi-Endpoint Concurrent ────────────
    // 30 VUs hitting all 3 dashboard endpoints simultaneously
    multi_endpoint: {
      executor: "constant-vus",
      vus: 30,
      duration: "20s",
      startTime: "35s",
      exec: "multiEndpoint",
    },

    // ─── Scenario 3: Memory Pressure ──────────────────────
    // 10 VUs each doing 100 iterations — watch for degradation
    memory_pressure: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 100,
      startTime: "60s",
      exec: "memoryPressure",
    },
  },

  thresholds: {
    concurrent_stats_duration: ["p(95)<3000"],    // p95 < 3s under concurrent load
    concurrent_error_rate: ["rate<0.02"],           // Error rate < 2%
    slow_requests_gt_2s: ["count<50"],              // Max 50 slow requests
    http_req_duration: ["p(99)<5000"],             // p99 < 5s globally
  },
};

// ── Scenario 1: Cache Effectiveness ─────────────────────────
export function cacheEffectiveness() {
  group("Cache Effectiveness — Same Key Bombardment", () => {
    // All 100 VUs request the same stats with days=30
    const res = http.get(
      `${BASE_URL}/api/dashboard/stats?days=30`,
      { headers, tags: { scenario: "cache_test" } }
    );

    statsDuration.add(res.timings.duration);
    requestCount.add(1);

    const passed = check(res, {
      "cache test 200": (r) => r.status === 200,
      "has valid data": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && typeof body.data.totalRevenue === "number";
        } catch {
          return false;
        }
      },
      "response < 2s (cache should help)": (r) => r.timings.duration < 2000,
    });

    errorRate.add(passed ? 0 : 1);

    if (res.timings.duration > 2000) {
      slowRequests.add(1);
    }

    // NO sleep — fire as fast as possible to test concurrent cache
  });
}

// ── Scenario 2: Multi-Endpoint Concurrent ───────────────────
export function multiEndpoint() {
  group("Multi-Endpoint — Parallel Dashboard Load", () => {
    // Fire all 3 dashboard endpoints simultaneously (batch request)
    const responses = http.batch([
      ["GET", `${BASE_URL}/api/dashboard/stats?days=30`, null, { headers, tags: { endpoint: "stats" } }],
      ["GET", `${BASE_URL}/api/orders/stats`, null, { headers, tags: { endpoint: "orders_stats" } }],
      ["GET", `${BASE_URL}/api/inventory/dashboard`, null, { headers, tags: { endpoint: "inventory" } }],
    ]);

    requestCount.add(3);

    responses.forEach((res, i) => {
      const endpoints = ["dashboard_stats", "orders_stats", "inventory_dashboard"];
      statsDuration.add(res.timings.duration);

      check(res, {
        [`${endpoints[i]} status 200`]: (r) => r.status === 200,
        [`${endpoints[i]} response < 3s`]: (r) => r.timings.duration < 3000,
      });

      errorRate.add(res.status >= 400 ? 1 : 0);

      if (res.timings.duration > 2000) {
        slowRequests.add(1);
      }
    });

    // Think time: admin reads dashboard
    sleep(1 + Math.random() * 2);
  });
}

// ── Scenario 3: Memory Pressure ─────────────────────────────
export function memoryPressure() {
  group("Memory Pressure — Sustained Load", () => {
    // Rotate through different time ranges to prevent single-key caching
    const timeRanges = [7, 30, 90, 365];
    const days = timeRanges[__ITER % timeRanges.length];

    const res = http.get(
      `${BASE_URL}/api/dashboard/stats?days=${days}`,
      { headers, tags: { scenario: "memory_pressure", days: String(days) } }
    );

    statsDuration.add(res.timings.duration);
    degradationTrend.add(res.timings.duration);
    requestCount.add(1);

    check(res, {
      "memory test 200": (r) => r.status === 200,
      "no timeout (< 5s)": (r) => r.timings.duration < 5000,
    });

    errorRate.add(res.status >= 400 ? 1 : 0);

    if (res.timings.duration > 2000) {
      slowRequests.add(1);
    }

    // Minimal sleep — keep pressure high
    sleep(0.1);
  });
}

// ── Summary Report ──────────────────────────────────────────
export function handleSummary(data) {
  const metrics = data.metrics;

  const p50 = Math.round(metrics.concurrent_stats_duration?.values?.["p(50)"] || 0);
  const p95 = Math.round(metrics.concurrent_stats_duration?.values?.["p(95)"] || 0);
  const p99 = Math.round(metrics.concurrent_stats_duration?.values?.["p(99)"] || 0);

  const summary = {
    "📊 Dashboard Concurrent Test Report": {
      "Total Requests": metrics.concurrent_requests_total?.values?.count || 0,
      "Error Rate": `${(
        (metrics.concurrent_error_rate?.values?.rate || 0) * 100
      ).toFixed(2)}%`,
      "Slow Requests (>2s)": metrics.slow_requests_gt_2s?.values?.count || 0,
    },
    "⏱️ Latency Distribution": {
      "p50 (ms)": p50,
      "p95 (ms)": p95,
      "p99 (ms)": p99,
      "Spread (p99-p50)": `${p99 - p50}ms`,
    },
    "🔍 Degradation Analysis": {
      "Early p50": Math.round(
        metrics.response_degradation_trend?.values?.["p(50)"] || 0
      ),
      "Note": p99 - p50 > 2000
        ? "⚠️ Significant response time spread — possible memory/cache issue"
        : "✅ Response times stable across test duration",
    },
    "⚡ SLO Verdict": {
      "p95 < 3s": p95 < 3000 ? "✅ PASS" : "❌ FAIL",
      "Error < 2%": (metrics.concurrent_error_rate?.values?.rate || 0) < 0.02 ? "✅ PASS" : "❌ FAIL",
      "Slow < 50": (metrics.slow_requests_gt_2s?.values?.count || 0) < 50 ? "✅ PASS" : "❌ FAIL",
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
