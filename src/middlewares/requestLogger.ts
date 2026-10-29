import type { RequestHandler } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('http');

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    log.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};
