import { formatMoney } from "@/lib/utils";

export function parseActivityDetailValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

export function humanizeActivityDetailKey(key: string, labelMap?: Record<string, string>): string {
  if (labelMap?.[key]) {
    return labelMap[key];
  }

  return key.replace(/_/g, " ");
}

export function formatActivityPrimitive(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number" && /amount|price|cost|total|paid|profit/i.test(key)) {
    return formatMoney(value);
  }

  if (typeof value === "boolean") {
    return value ? "Có" : "Không";
  }

  return String(value);
}
