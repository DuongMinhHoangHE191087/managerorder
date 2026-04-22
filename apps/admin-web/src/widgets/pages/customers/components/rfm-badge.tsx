"use client";

import type { CustomerSegment } from "@/lib/domain/types";
import { Crown, Diamond, Circle, AlertTriangle, XCircle, UserPlus } from "lucide-react";
import type { ComponentType } from "react";

interface SegmentConfig {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  class: string;
}

const SEGMENT_CONFIG: Record<CustomerSegment, SegmentConfig> = {
  vip: {
    label: "VIP",
    Icon: Crown,
    class: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border-amber-300",
  },
  loyal: {
    label: "Trung thành",
    Icon: Diamond,
    class: "bg-blue-100 text-blue-700 border-blue-300",
  },
  regular: {
    label: "Thường",
    Icon: Circle,
    class: "bg-[var(--border-soft)] text-[var(--fg-muted)] border-[var(--border-soft)]",
  },
  at_risk: {
    label: "Có rủi ro",
    Icon: AlertTriangle,
    class: "bg-orange-100 text-orange-700 border-orange-300",
  },
  churned: {
    label: "Đã rời",
    Icon: XCircle,
    class: "bg-red-100 text-red-700 border-red-300",
  },
  new: {
    label: "Mới",
    Icon: UserPlus,
    class: "bg-sky-100 text-sky-700 border-sky-300",
  },
};

interface RfmBadgeProps {
  segment?: CustomerSegment;
  rfmScore?: number;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
}

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-[11px]",
  lg: "px-4 py-1.5 text-[12px]",
} as const;

const ICON_SIZES = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
} as const;

export function RfmBadge({ segment, rfmScore, size = "sm", showScore = false }: RfmBadgeProps) {
  if (!segment) return null;

  const config = SEGMENT_CONFIG[segment] ?? SEGMENT_CONFIG.regular;
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full border tracking-wider uppercase ${config.class} ${SIZE_CLASSES[size]}`}
      aria-label={`Phân khúc: ${config.label}`}
    >
      <Icon className={ICON_SIZES[size]} aria-hidden="true" />
      <span>{config.label}</span>
      {showScore && rfmScore !== undefined && (
        <span className="opacity-70 ml-0.5">({rfmScore})</span>
      )}
    </span>
  );
}

export function getSegmentLabel(segment?: CustomerSegment): string {
  if (!segment) return "Chưa phân loại";
  return SEGMENT_CONFIG[segment]?.label ?? "Thường";
}
