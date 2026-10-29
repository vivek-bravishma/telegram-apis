import type { Response } from 'express';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function ok<T>(res: Response, data: T, status = 200): Response<SuccessEnvelope<T>> {
  return res.status(status).json({ success: true, data });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response<ErrorEnvelope> {
  const error: ErrorEnvelope['error'] = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}
