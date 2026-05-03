import { fetcher, type HttpError } from "@/lib/api/fetcher";

export type RecoverableDetail<T> = T & {
  data: T;
  softDeleted: boolean;
};

function appendIncludeDeleted(url: string) {
  return url.includes("?") ? `${url}&include_deleted=1` : `${url}?include_deleted=1`;
}

function isHttpStatusError(error: unknown, status: number): error is HttpError {
  return !!error
    && typeof error === "object"
    && "status" in error
    && typeof (error as { status?: unknown }).status === "number"
    && (error as { status?: number }).status === status;
}

function inferSoftDeleted(value: unknown, fallback: boolean) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  if ("deleted_at" in record) {
    const deletedAt = record.deleted_at;
    if (typeof deletedAt === "string") {
      return deletedAt.trim().length > 0;
    }
    if (typeof deletedAt === "boolean") {
      return deletedAt;
    }
    return false;
  }

  if ("deletedAt" in record) {
    const deletedAt = record.deletedAt;
    if (typeof deletedAt === "string") {
      return deletedAt.trim().length > 0;
    }
    if (typeof deletedAt === "boolean") {
      return deletedAt;
    }
    return false;
  }

  if ("is_deleted" in record) {
    const isDeleted = record.is_deleted;
    if (typeof isDeleted === "boolean") {
      return isDeleted;
    }
    if (typeof isDeleted === "string") {
      return isDeleted.trim().length > 0;
    }
    return Boolean(isDeleted);
  }

  if ("isDeleted" in record) {
    const isDeleted = record.isDeleted;
    if (typeof isDeleted === "boolean") {
      return isDeleted;
    }
    if (typeof isDeleted === "string") {
      return isDeleted.trim().length > 0;
    }
    return Boolean(isDeleted);
  }

  return fallback;
}

export async function fetchRecoverableDetail<T>(
  url: string,
  includeDeleted = false,
): Promise<RecoverableDetail<T>> {
  const requestUrl = includeDeleted ? appendIncludeDeleted(url) : url;

  try {
    const data = await fetcher<T>(requestUrl);
    return Object.assign({}, data as object, {
      data,
      softDeleted: inferSoftDeleted(data, includeDeleted),
    }) as RecoverableDetail<T>;
  } catch (error) {
    if (!includeDeleted && isHttpStatusError(error, 404)) {
      const deletedData = await fetcher<T>(appendIncludeDeleted(url));
      return Object.assign({}, deletedData as object, {
        data: deletedData,
        softDeleted: inferSoftDeleted(deletedData, true),
      }) as RecoverableDetail<T>;
    }

    throw error;
  }
}
