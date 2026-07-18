import type { PaginationMeta } from "./pagination.schema";

export function wrapSuccessList<T>(
  data: T[],
  pagination: PaginationMeta,
): { data: T[]; pagination: PaginationMeta } {
  return { data, pagination };
}

export function wrapSuccessItem<T>(data: T): { data: T } {
  return { data };
}

export function wrapError(
  code: string,
  message: string,
  requestId: string,
): {
  error: { code: string; message: string; requestId: string; timestamp: string };
} {
  return {
    error: {
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
