"use client";

import { useId, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { formatMoney } from "@/lib/utils";

interface TimeTab<T extends string = string> {
  value: T;
  label: string;
  short: string;
}

interface RevenueChartProps<T extends string = string> {
  timeRange: T;
  setTimeRange: (range: T) => void;
  chartData: Array<{ name: string; revenue: number; orders: number }>;
  timeTabs: TimeTab<T>[];
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 360;
const PADDING = {
  top: 24,
  right: 24,
  bottom: 56,
  left: 64,
} as const;

function formatCompactValue(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  }

  return `${Math.round(value)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function RevenueChart<T extends string = string>({
  timeRange,
  setTimeRange,
  chartData,
  timeTabs,
}: RevenueChartProps<T>) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;
    const maxRevenue = Math.max(1, ...chartData.map((item) => item.revenue));
    const stepCount = 4;

    const points = chartData.map((item, index) => {
      const x =
        chartData.length <= 1
          ? PADDING.left + plotWidth / 2
          : PADDING.left + (index / (chartData.length - 1)) * plotWidth;
      const y = PADDING.top + (1 - item.revenue / maxRevenue) * plotHeight;

      return {
        ...item,
        x,
        y,
      };
    });

    const linePath = points.length
      ? points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ")
      : "";

    const baselineY = SVG_HEIGHT - PADDING.bottom;
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : "";

    const yTicks = Array.from({ length: stepCount + 1 }, (_, index) => {
      const ratio = index / stepCount;
      const value = maxRevenue * (1 - ratio);

      return {
        value,
        y: PADDING.top + plotHeight * ratio,
      };
    });

    return {
      areaPath,
      baselineY,
      linePath,
      maxRevenue,
      plotHeight,
      plotWidth,
      points,
      yTicks,
    };
  }, [chartData]);

  const activeIndex =
    hoveredIndex !== null
      ? hoveredIndex
      : geometry.points.length > 0
        ? geometry.points.length - 1
        : null;

  const activePoint =
    activeIndex !== null && geometry.points[activeIndex]
      ? geometry.points[activeIndex]
      : geometry.points[geometry.points.length - 1];

  const activeSummary = activePoint
    ? {
        revenue: formatMoney(activePoint.revenue),
        orders: activePoint.orders,
        label: activePoint.name,
      }
    : null;

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (geometry.points.length === 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const index = Math.round(ratio * (geometry.points.length - 1));
    setHoveredIndex(index);
  }

  function handleMouseLeave() {
    setHoveredIndex(null);
  }

  return (
    <div className="lg:col-span-2 glass-card rounded-ios border border-[var(--border-soft)] shadow-[var(--accent)]/5 overflow-hidden flex flex-col hover:shadow-[var(--accent)]/10 transition-shadow">
      <div className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">Biểu đồ Doanh Thu</h3>
            <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">
              {timeTabs.find((tab) => tab.value === timeRange)?.short ?? ""} gần nhất
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-app)] p-1">
            {timeTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTimeRange(tab.value)}
                className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
                  timeRange === tab.value
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex-1 p-6">
        {geometry.points.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/30 text-center text-[13px] text-[var(--fg-muted)]">
            Chưa có dữ liệu doanh thu cho khoảng thời gian này.
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Điểm đang xem</p>
                <p className="truncate text-[14px] font-bold text-[var(--fg-base)]">{activeSummary?.label ?? ""}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Doanh thu</p>
                <p className="text-[18px] font-black text-[var(--accent)]">{activeSummary?.revenue ?? formatMoney(0)}</p>
                <p className="text-[11px] font-medium text-[var(--fg-muted)]">{activeSummary?.orders ?? 0} đơn</p>
              </div>
            </div>

            <div className="relative h-[350px] rounded-2xl border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.35))] p-2">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="h-full w-full overflow-visible"
                preserveAspectRatio="none"
                role="img"
                aria-label="Biểu đồ doanh thu"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                {geometry.yTicks.map((tick) => (
                  <g key={tick.y}>
                    <line
                      x1={PADDING.left}
                      x2={SVG_WIDTH - PADDING.right}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="var(--border-soft)"
                      strokeDasharray="3 3"
                      opacity={0.7}
                    />
                    <text
                      x={PADDING.left - 12}
                      y={tick.y + 4}
                      textAnchor="end"
                      fill="var(--fg-muted)"
                      fontSize="11"
                      fontWeight="700"
                    >
                      {formatCompactValue(tick.value)}
                    </text>
                  </g>
                ))}

                <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
                <path
                  d={geometry.linePath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {geometry.points.map((point, index) => {
                  const isActive = index === (activeIndex ?? geometry.points.length - 1);

                  return (
                    <g key={point.name}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isActive ? 6 : 4}
                        fill="var(--accent)"
                        opacity={isActive ? 1 : 0.85}
                        stroke="white"
                        strokeWidth={isActive ? 3 : 2}
                      />
                      <text
                        x={point.x}
                        y={SVG_HEIGHT - 18}
                        textAnchor="middle"
                        fill="var(--fg-muted)"
                        fontSize="11"
                        fontWeight="700"
                        opacity={geometry.points.length > 10 && index % 2 === 1 ? 0.45 : 1}
                      >
                        {point.name}
                      </text>
                    </g>
                  );
                })}

                <rect
                  x={PADDING.left}
                  y={PADDING.top}
                  width={geometry.plotWidth}
                  height={geometry.plotHeight}
                  fill="transparent"
                />
              </svg>

              {activePoint ? (
                <div
                  className="pointer-events-none absolute rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)]/95 px-3 py-2 shadow-xl backdrop-blur-md"
                  style={{
                    left: `${clamp(activePoint.x, PADDING.left + 24, SVG_WIDTH - PADDING.right - 88)}px`,
                    top: `${Math.max(activePoint.y - 68, 12)}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{activePoint.name}</p>
                  <p className="text-[14px] font-black text-[var(--fg-base)]">{formatMoney(activePoint.revenue)}</p>
                  <p className="text-[11px] font-medium text-[var(--fg-muted)]">{activePoint.orders} đơn hàng</p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
