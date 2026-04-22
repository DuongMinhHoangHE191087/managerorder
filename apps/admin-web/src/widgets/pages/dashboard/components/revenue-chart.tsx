"use client";

import { useId, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

interface TimeTab<T extends string = string> {
  value: T;
  label: string;
  short: string;
}

interface RevenueChartProps<T extends string = string> {
  timeRange: T;
  setTimeRange: (range: T) => void;
  chartData: Array<{ name: string; revenue: number; cost: number; orders: number }>;
  timeTabs: readonly TimeTab<T>[];
}

type ChartPoint = {
  name: string;
  revenue: number;
  cost: number;
  orders: number;
  x: number;
  revenueY: number;
  costY: number;
};

const SVG_WIDTH = 800;
const SVG_HEIGHT = 360;
const PADDING = {
  top: 24,
  right: 24,
  bottom: 56,
  left: 64,
} as const;

const COST_STROKE = "#f59e0b";

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

function buildLinePath(points: ChartPoint[], valueKey: "revenueY" | "costY") {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point[valueKey]}`)
    .join(" ");
}

function buildAreaPath(
  points: ChartPoint[],
  valueKey: "revenueY" | "costY",
  baselineY: number
) {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildLinePath(points, valueKey);
  return `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

export function RevenueChart<T extends string = string>({
  timeRange,
  setTimeRange,
  chartData,
  timeTabs,
}: RevenueChartProps<T>) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const text = vi.dashboard.revenueChart;

  const geometry = useMemo(() => {
    const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;
    const maxValue = Math.max(
      1,
      ...chartData.flatMap((item) => [item.revenue, item.cost])
    );
    const stepCount = 4;

    const points: ChartPoint[] = chartData.map((item, index) => {
      const x =
        chartData.length <= 1
          ? PADDING.left + plotWidth / 2
          : PADDING.left + (index / (chartData.length - 1)) * plotWidth;

      return {
        ...item,
        x,
        revenueY: PADDING.top + (1 - item.revenue / maxValue) * plotHeight,
        costY: PADDING.top + (1 - item.cost / maxValue) * plotHeight,
      };
    });

    const revenueLinePath = buildLinePath(points, "revenueY");
    const revenueAreaPath = buildAreaPath(points, "revenueY", SVG_HEIGHT - PADDING.bottom);
    const costLinePath = buildLinePath(points, "costY");

    const yTicks = Array.from({ length: stepCount + 1 }, (_, index) => {
      const ratio = index / stepCount;
      const value = maxValue * (1 - ratio);

      return {
        value,
        y: PADDING.top + plotHeight * ratio,
      };
    });

    return {
      baselineY: SVG_HEIGHT - PADDING.bottom,
      costLinePath,
      maxValue,
      plotHeight,
      plotWidth,
      points,
      revenueAreaPath,
      revenueLinePath,
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
        cost: formatMoney(activePoint.cost),
        profit: formatMoney(activePoint.revenue - activePoint.cost),
        margin: activePoint.revenue > 0 ? Math.round(((activePoint.revenue - activePoint.cost) / activePoint.revenue) * 100) : 0,
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
    <div className="glass-card flex flex-col overflow-hidden rounded-ios border border-[var(--border-soft)] shadow-[var(--accent)]/5 transition-shadow hover:shadow-[var(--accent)]/10 lg:col-span-2">
      <div className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{text.title}</h3>
            <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">
              {timeTabs.find((tab) => tab.value === timeRange)?.short ?? ""} {text.titleSuffix}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[11px] font-bold text-[var(--accent)]">
              <span className="size-2 rounded-full bg-[var(--accent)]" />
              Doanh thu
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[11px] font-bold text-amber-600">
              <span className="size-2 rounded-full bg-amber-500" />
              Vốn nhập
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
      </div>

      <div className="relative flex-1 p-6">
        {geometry.points.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/30 text-center text-[13px] text-[var(--fg-muted)]">
            {text.empty}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{text.revenue}</p>
                <p className="mt-1 text-[18px] font-black text-[var(--accent)]">{activeSummary?.revenue ?? formatMoney(0)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Vốn nhập</p>
                <p className="mt-1 text-[18px] font-black text-amber-600">{activeSummary?.cost ?? formatMoney(0)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lợi nhuận gộp</p>
                <p className="mt-1 text-[18px] font-black text-emerald-600">{activeSummary?.profit ?? formatMoney(0)}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                  Biên {activeSummary ? `${activeSummary.margin}%` : "0%"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{text.orders}</p>
                <p className="mt-1 text-[18px] font-black text-[var(--fg-base)]">{activeSummary?.orders ?? 0}</p>
              </div>
            </div>

            <div className="relative h-[350px] rounded-2xl border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.35))] p-2">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="h-full w-full overflow-visible"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${text.ariaLabel} và vốn`}
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

                <path d={geometry.revenueAreaPath} fill={`url(#${gradientId})`} />
                <path
                  d={geometry.revenueLinePath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d={geometry.costLinePath}
                  fill="none"
                  stroke={COST_STROKE}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="7 6"
                />

                {geometry.points.map((point, index) => {
                  const isActive = index === (activeIndex ?? geometry.points.length - 1);

                  return (
                    <g key={point.name}>
                      <circle
                        cx={point.x}
                        cy={point.revenueY}
                        r={isActive ? 6 : 4}
                        fill="var(--accent)"
                        opacity={isActive ? 1 : 0.85}
                        stroke="white"
                        strokeWidth={isActive ? 3 : 2}
                      />
                      <circle
                        cx={point.x}
                        cy={point.costY}
                        r={isActive ? 5 : 3.5}
                        fill={COST_STROKE}
                        opacity={isActive ? 1 : 0.8}
                        stroke="white"
                        strokeWidth={isActive ? 3 : 1.5}
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
                    top: `${Math.max(activePoint.revenueY - 92, 12)}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{activePoint.name}</p>
                  <p className="text-[14px] font-black text-[var(--fg-base)]">{formatMoney(activePoint.revenue)}</p>
                  <p className="text-[11px] font-medium text-[var(--fg-muted)]">
                    Vốn {formatMoney(activePoint.cost)} • {activePoint.orders} {text.orders}
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
