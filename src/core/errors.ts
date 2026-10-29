/**
 * Single error type the whole app throws. The error middleware turns it into
 * the response envelope, so controllers never build error responses by hand.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Caller sent something we cannot use. */
export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/** A provider API (Telegram, …) rejected or failed the call. */
export class UpstreamError extends AppError {
  constructor(message: string, status = 502, details?: unknown) {
    super(message, status, 'UPSTREAM_ERROR', details);
  }
}

/** Channel exists but its credentials are missing. */
export class ChannelNotConfiguredError extends AppError {
  constructor(channel: string, missing: string[]) {
    super(
      `Channel "${channel}" is not configured. Missing: ${missing.join(', ')}`,
      503,
      'CHANNEL_NOT_CONFIGURED',
      { channel, missing },
    );
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
