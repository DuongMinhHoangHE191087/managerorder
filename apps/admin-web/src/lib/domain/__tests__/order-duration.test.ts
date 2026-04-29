import { describe, expect, it } from "vitest";
import {
  addOrderDuration,
  formatOrderDurationLabel,
  resolveOrderDuration,
  toDurationDays,
} from "@/lib/domain/order-duration";

describe("order-duration", () => {
  it("resolves product fallback duration when item has no overrides", () => {
    const duration = resolveOrderDuration(undefined, {
      durationType: "months",
      durationValue: 12,
    });

    expect(duration).toEqual({
      durationType: "months",
      durationValue: 12,
      bonusDurationValue: 0,
      effectiveDurationValue: 12,
    });
  });

  it("supports promotional bonus duration on top of the sold package", () => {
    const duration = resolveOrderDuration({
      durationType: "months",
      durationValue: 12,
      bonusDurationValue: 1,
    });

    expect(duration.effectiveDurationValue).toBe(13);
    expect(formatOrderDurationLabel(duration, { includeBonus: true })).toBe("12 + 1 = 13 tháng");
    expect(toDurationDays(duration)).toBe(390);
  });

  it("falls back to safe whole numbers when overrides are blank or invalid", () => {
    const duration = resolveOrderDuration(
      {
        durationValue: Number.NaN,
        bonusDurationValue: Number.NaN,
      },
      {
        durationType: "months",
        durationValue: 12,
      },
    );

    expect(duration).toEqual({
      durationType: "months",
      durationValue: 12,
      bonusDurationValue: 0,
      effectiveDurationValue: 12,
    });
  });

  it("truncates decimal durations and clamps negative bonus values", () => {
    const duration = resolveOrderDuration({
      durationType: "days",
      durationValue: 15.9,
      bonusDurationValue: -4,
    });

    expect(duration).toEqual({
      durationType: "days",
      durationValue: 15,
      bonusDurationValue: 0,
      effectiveDurationValue: 15,
    });
  });

  it("adds the effective duration to the order registration date", () => {
    const expiresAt = addOrderDuration(
      new Date("2026-01-15T00:00:00.000Z"),
      resolveOrderDuration({
        durationType: "months",
        durationValue: 12,
        bonusDurationValue: 1,
      }),
    );

    expect(expiresAt.toISOString().slice(0, 10)).toBe("2027-02-15");
  });
});
