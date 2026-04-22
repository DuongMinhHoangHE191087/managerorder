type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isMissingRelationError(error: unknown, relationName?: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as ErrorLike;
  const haystack = [
    toText(candidate.code),
    toText(candidate.message),
    toText(candidate.details),
    toText(candidate.hint),
  ]
    .filter(Boolean)
    .join(" ");

  if (!haystack) {
    return false;
  }

  const relation = relationName?.trim().toLowerCase();
  const mentionsRelation = !relation
    || haystack.includes(relation)
    || haystack.includes(`public.${relation}`)
    || haystack.includes(`"${relation}"`)
    || haystack.includes(`'${relation}'`);

  if (!mentionsRelation) {
    return false;
  }

  return (
    haystack.includes("42p01")
    || haystack.includes("pgrst205")
    || haystack.includes("relation")
    || haystack.includes("does not exist")
  );
}

export function isMissingColumnError(
  error: unknown,
  columnName?: string,
  tableName?: string,
): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as ErrorLike;
  const haystack = [
    toText(candidate.code),
    toText(candidate.message),
    toText(candidate.details),
    toText(candidate.hint),
  ]
    .filter(Boolean)
    .join(" ");

  if (!haystack) {
    return false;
  }

  const column = columnName?.trim().toLowerCase();
  const table = tableName?.trim().toLowerCase();

  const mentionsColumn = !column
    || haystack.includes(column)
    || haystack.includes(`"${column}"`)
    || haystack.includes(`'${column}'`);
  const mentionsTable = !table
    || haystack.includes(table)
    || haystack.includes(`"${table}"`)
    || haystack.includes(`'${table}'`);

  if (!mentionsColumn || !mentionsTable) {
    return false;
  }

  return (
    haystack.includes("pgrst204")
    || haystack.includes("42703")
    || haystack.includes("could not find the")
    || haystack.includes("column")
    || haystack.includes("does not exist")
  );
}
