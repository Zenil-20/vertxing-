/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/common.types.ts
 * Layer:   Shared / Contracts
 * Purpose: Transport-level primitives shared by every endpoint — the success
 *          envelope, the error envelope, and pagination metadata. The API's
 *          TransformInterceptor wraps all responses in `ApiSuccess<T>`, so the
 *          web client can rely on a single, predictable shape.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Successful response envelope. `data` carries the typed payload. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  /** ISO-8601 server timestamp, useful for client-side clock skew handling. */
  timestamp: string;
}

/** Error response envelope emitted by the global exception filter. */
export interface ApiError {
  success: false;
  error: {
    /** HTTP status code, duplicated in the body for non-2xx fetch flows. */
    statusCode: number;
    /** Stable machine-readable code, e.g. "AUTH_INVALID_CREDENTIALS". */
    code: string;
    /** Human-readable message safe to surface to end users. */
    message: string;
    /** Optional field-level validation details. */
    details?: Record<string, string[]>;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Cursor/offset pagination request parameters. */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

/** Paginated list payload. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
