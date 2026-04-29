const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;

function stripVietnameseAccents(value: string) {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS_REGEX, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
}

export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return stripVietnameseAccents(String(value))
    .toLowerCase()
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

export function hasSearchTokens(query: string): boolean {
  return tokenizeSearchQuery(query).length > 0;
}

function flattenSearchValue(value: unknown, result: string[]) {
  if (value === null || value === undefined) {
    return;
  }

  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
  ) {
    result.push(String(value));
    return;
  }

  if (value instanceof Date) {
    result.push(value.toISOString());
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => flattenSearchValue(item, result));
    return;
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => flattenSearchValue(item, result));
  }
}

export function buildSearchIndex(...values: unknown[]): string {
  const flattened: string[] = [];
  values.forEach((value) => flattenSearchValue(value, flattened));
  return normalizeSearchText(flattened.join(" "));
}

export function matchesSearchQuery(query: string, ...values: unknown[]): boolean {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) {
    return true;
  }

  const haystack = buildSearchIndex(...values);
  return tokens.every((token) => haystack.includes(token));
}

export function filterRowsBySearchQuery<T>(
  rows: T[],
  query: string,
  getValues: (row: T) => unknown[],
): T[] {
  if (!hasSearchTokens(query)) {
    return rows;
  }

  return rows.filter((row) => matchesSearchQuery(query, ...getValues(row)));
}

export function paginateRows<T>(rows: T[], page: number, limit: number) {
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || 1);
  const offset = (safePage - 1) * safeLimit;
  const count = rows.length;

  return {
    data: rows.slice(offset, offset + safeLimit),
    count,
    page: safePage,
    limit: safeLimit,
    totalPages: count ? Math.ceil(count / safeLimit) : 0,
  };
}
