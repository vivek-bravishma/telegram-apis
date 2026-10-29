import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError, isAppError } from '../core/errors';
import { fail } from '../core/response';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('http');

export const notFoundHandler: RequestHandler = (req, res) => {
  fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appError: AppError;

  if (isAppError(err)) {
    appError = err;
  } else if (err instanceof multer.MulterError) {
    appError = new AppError(err.message, 400, `UPLOAD_${err.code}`, { field: err.field });
  } else if (err instanceof SyntaxError && 'body' in err) {
    appError = new AppError('Malformed JSON body', 400, 'INVALID_JSON');
  } else {
    appError = new AppError(
      err instanceof Error ? err.message : 'Unexpected error',
      500,
      'INTERNAL_ERROR',
    );
  }

  const level = appError.status >= 500 ? 'error' : 'warn';
  log[level](`${req.method} ${req.originalUrl} → ${appError.status} ${appError.code}`, {
    message: appError.message,
    details: appError.details,
    stack: config.isProduction ? undefined : (err as Error)?.stack,
  });

  fail(res, appError.status, appError.code, appError.message, appError.details);
};
