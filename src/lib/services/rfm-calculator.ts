// ============================================================
// RFM CALCULATOR — Pure functions for customer segmentation
// Recency, Frequency, Monetary scoring (1-5 scale)
// ============================================================

import type { CustomerSegment } from "@/lib/domain/types";

export interface RfmInput {
  customerId: string;
  lastOrderDate: string | null;
  totalOrders: number;
  totalSpentVnd: number;
}

export interface RfmResult {
  recency: number; // 1-5
  frequency: number; // 1-5
  monetary: number; // 1-5
  score: number; // weighted average (0-100)
  segment: CustomerSegment;
}

// Scoring thresholds (configurable per business)
const RECENCY_THRESHOLDS_DAYS = [7, 30, 60, 90]; // <7d=5, <30d=4, <60d=3, <90d=2, else=1
const FREQUENCY_THRESHOLDS = [10, 5, 3, 1]; // >=10=5, >=5=4, >=3=3, >=1=2, 0=1
const MONETARY_THRESHOLDS_VND = [5_000_000, 2_000_000, 500_000, 100_000]; // >=5M=5 ...

/**
 * Score a single value against descending thresholds.
 * Returns 5 if value exceeds highest threshold, 1 if below all.
 */
function scoreAgainstThresholds(
  value: number,
  thresholds: number[],
): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) return 5 - i;
  }
  return 1;
}

/**
 * Calculate recency score based on days since last order.
 * More recent = higher score.
 */
function scoreRecency(daysSinceLastOrder: number | null): number {
  if (daysSinceLastOrder === null) return 1; // Never ordered
  // Invert: fewer days = higher score
  for (let i = 0; i < RECENCY_THRESHOLDS_DAYS.length; i++) {
    if (daysSinceLastOrder <= RECENCY_THRESHOLDS_DAYS[i]) return 5 - i;
  }
  return 1;
}

/**
 * Calculate the RFM scores and determine segment.
 */
export function calculateRfm(input: RfmInput, now?: Date): RfmResult {
  const currentDate = now ?? new Date();

  // New customer: no orders at all → segment "new"
  if (input.totalOrders === 0 && !input.lastOrderDate) {
    return { recency: 1, frequency: 1, monetary: 1, score: 20, segment: "new" };
  }

  // Recency: days since last order
  let daysSinceLastOrder: number | null = null;
  if (input.lastOrderDate) {
    const lastDate = new Date(input.lastOrderDate);
    daysSinceLastOrder = Math.floor(
      (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const recency = scoreRecency(daysSinceLastOrder);
  const frequency = scoreAgainstThresholds(input.totalOrders, FREQUENCY_THRESHOLDS);
  const monetary = scoreAgainstThresholds(input.totalSpentVnd, MONETARY_THRESHOLDS_VND);

  // Weighted score (R=35%, F=30%, M=35%) → 0-100 scale
  const score = Math.round(((recency * 0.35 + frequency * 0.3 + monetary * 0.35) / 5) * 100);

  const segment = determineSegment(recency, frequency, monetary);

  return { recency, frequency, monetary, score, segment };
}

/**
 * Map RFM scores to a business segment.
 * Uses a priority-based rule engine for clear classification.
 */
export function determineSegment(
  r: number,
  f: number,
  m: number,
): CustomerSegment {
  // VIP: High on all dimensions
  if (r >= 4 && f >= 4 && m >= 4) return "vip";

  // Churned: Very low recency, low frequency
  if (r <= 1 && f <= 2) return "churned";

  // At Risk: Used to buy frequently but haven't returned
  if (r <= 2 && f >= 3) return "at_risk";

  // Loyal: Good across most dimensions
  if (r >= 3 && f >= 3 && m >= 3) return "loyal";

  // Regular: Everyone else
  return "regular";
}
