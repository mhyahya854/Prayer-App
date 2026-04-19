import { z } from 'zod';

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, options?: { statusCode?: number; code?: string; details?: unknown; cause?: unknown }) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code ?? (this.statusCode >= 500 ? 'internal_error' : 'bad_request');
    this.details = options?.details;
    if (options?.cause) {
      // preserve optional cause for downstream logging
      (this as any).cause = options.cause;
    }
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', code = 'bad_request', details?: unknown) {
    super(message, { statusCode: 400, code, details });
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'unauthorized', details?: unknown) {
    super(message, { statusCode: 401, code, details });
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'forbidden', details?: unknown) {
    super(message, { statusCode: 403, code, details });
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', code = 'not_found', details?: unknown) {
    super(message, { statusCode: 404, code, details });
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Too many API requests. Please try again shortly.', options?: { max?: number; retryAfterMs?: number }) {
    const details: Record<string, number> = {};
    if (typeof options?.max === 'number') details.max = options!.max;
    if (typeof options?.retryAfterMs === 'number') details.retryAfterMs = options!.retryAfterMs;
    super(message, { statusCode: 429, code: 'rate_limited', details: Object.keys(details).length ? details : undefined });
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable', code = 'service_unavailable', details?: unknown) {
    super(message, { statusCode: 503, code, details });
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function throwIfInvalid<T>(result: z.SafeParseReturnType<any, T>, options?: { code?: string; message?: string }): T {
  if (result.success) {
    return result.data;
  }

  const flattened = result.error.flatten();
  const message = options?.message ?? 'Invalid request payload.';
  const code = options?.code ?? 'validation_error';

  throw new BadRequestError(message, code, flattened.fieldErrors);
}
