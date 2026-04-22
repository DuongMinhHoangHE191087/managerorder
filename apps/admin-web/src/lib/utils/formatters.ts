export interface FormatOptions {
  locale?: string | null;
  timeZone?: string | null;
  currency?: string | null;
}

function resolveFormatOptions(options?: FormatOptions) {
  return {
    locale: options?.locale?.trim() || "vi-VN",
    timeZone: options?.timeZone?.trim() || "Asia/Ho_Chi_Minh",
    currency: options?.currency?.trim()?.toUpperCase() || "VND",
  };
}

function isLegacyVietnameseFormatting(options?: FormatOptions) {
  const resolved = resolveFormatOptions(options);
  return (
    resolved.locale.toLowerCase().startsWith("vi") &&
    resolved.timeZone === "Asia/Ho_Chi_Minh"
  );
}

function getDatePartMap(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

function formatLegacyVietnameseDate(
  date: Date,
  options: FormatOptions | undefined,
  includeTime: boolean
) {
  const resolved = resolveFormatOptions(options);
  const parts = getDatePartMap(date, resolved.timeZone);
  const base = `${parts.day}/${parts.month}/${parts.year}`;

  if (!includeTime) {
    return base;
  }

  return `${base} ${parts.hour}:${parts.minute}`;
}

function parseDate(date: string | Date | undefined | null): Date | null {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

export function formatMoney(amount: number, options?: FormatOptions) {
  const resolved = resolveFormatOptions(options);
  return new Intl.NumberFormat(resolved.locale, {
    style: "currency",
    currency: resolved.currency,
    maximumFractionDigits: resolved.currency === "VND" ? 0 : 2,
  }).format(amount);
}

export function formatNumber(amount: number, options?: Omit<FormatOptions, "timeZone" | "currency">) {
  const resolved = resolveFormatOptions(options);
  return new Intl.NumberFormat(resolved.locale).format(amount);
}

export function formatDate(date: string | Date | undefined | null, options?: FormatOptions) {
  const parsedDate = parseDate(date);
  if (!parsedDate) return "N/A";

  try {
    if (isLegacyVietnameseFormatting(options)) {
      return formatLegacyVietnameseDate(parsedDate, options, true);
    }

    const resolved = resolveFormatOptions(options);
    return new Intl.DateTimeFormat(resolved.locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: resolved.timeZone,
    }).format(parsedDate);
  } catch {
    return "Invalid Date";
  }
}

export function formatDateShort(date: string | Date | undefined | null, options?: FormatOptions) {
  const parsedDate = parseDate(date);
  if (!parsedDate) return "N/A";

  try {
    if (isLegacyVietnameseFormatting(options)) {
      return formatLegacyVietnameseDate(parsedDate, options, false);
    }

    const resolved = resolveFormatOptions(options);
    return new Intl.DateTimeFormat(resolved.locale, {
      dateStyle: "short",
      timeZone: resolved.timeZone,
    }).format(parsedDate);
  } catch {
    return "Invalid Date";
  }
}

export function formatDateCustom(
  date: string | Date | undefined | null,
  options?: FormatOptions,
  dateTimeOptions?: Intl.DateTimeFormatOptions
) {
  const parsedDate = parseDate(date);
  if (!parsedDate) return "N/A";

  try {
    const resolved = resolveFormatOptions(options);
    return new Intl.DateTimeFormat(resolved.locale, {
      ...dateTimeOptions,
      timeZone: dateTimeOptions?.timeZone ?? resolved.timeZone,
    }).format(parsedDate);
  } catch {
    return "Invalid Date";
  }
}

export function formatDateKey(date: string | Date | undefined | null, options?: FormatOptions): string {
  const parsedDate = parseDate(date);
  if (!parsedDate) return "N/A";

  try {
    const resolved = resolveFormatOptions(options);
    const parts = getDatePartMap(parsedDate, resolved.timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return "Invalid Date";
  }
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Invalid Date";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function formatDateLabel(date: string | Date | undefined | null, options?: FormatOptions): string {
  return formatDate(date, options);
}

export function formatRelativeTime(date: string | Date | undefined | null, options?: FormatOptions): string {
  const parsedDate = parseDate(date);
  if (!parsedDate) return "N/A";

  try {
    const resolved = resolveFormatOptions(options);
    const diffSeconds = Math.round((Date.now() - parsedDate.getTime()) / 1000);
    const absSeconds = Math.abs(diffSeconds);
    const isFuture = diffSeconds < 0;

    if (resolved.locale.toLowerCase().startsWith("vi")) {
      if (absSeconds < 60) {
        return "v\u1eeba xong";
      }

      if (absSeconds < 3600) {
        const value = Math.round(absSeconds / 60);
        return isFuture ? `sau ${value} ph\u00fat` : `${value} ph\u00fat tr\u01b0\u1edbc`;
      }

      if (absSeconds < 86_400) {
        const value = Math.round(absSeconds / 3600);
        return isFuture ? `sau ${value} gi\u1edd` : `${value} gi\u1edd tr\u01b0\u1edbc`;
      }

      if (absSeconds < 2_592_000) {
        const value = Math.round(absSeconds / 86_400);
        return isFuture ? `sau ${value} ng\u00e0y` : `${value} ng\u00e0y tr\u01b0\u1edbc`;
      }

      return formatDateShort(parsedDate, options);
    }

    const rtf = new Intl.RelativeTimeFormat(resolved.locale, { numeric: "auto" });

    if (absSeconds < 3600) {
      return rtf.format(Math.round(-diffSeconds / 60), "minute");
    }

    if (absSeconds < 86_400) {
      return rtf.format(Math.round(-diffSeconds / 3600), "hour");
    }

    if (absSeconds < 2_592_000) {
      return rtf.format(Math.round(-diffSeconds / 86_400), "day");
    }

    return formatDateShort(parsedDate, options);
  } catch {
    return "N/A";
  }
}
