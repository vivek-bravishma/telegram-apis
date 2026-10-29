import type { RequestHandler } from 'express';
import { AppError } from '../../core/errors';
import { createLogger } from '../../utils/logger';
import { telegramConfig } from './telegram.config';

const log = createLogger('telegram:webhook');

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Rejects inbound updates that do not carry the secret token we registered with
 * setWebhook. Skipped when no secret is configured, since Telegram then sends
 * no header at all.
 */
export const verifyWebhookSecret: RequestHandler = (req, _res, next) => {
  const expected = telegramConfig.webhookSecretToken;

  if (!expected) {
    next();
    return;
  }

  const received = req.header(SECRET_HEADER);

  if (received !== expected) {
    log.warn('Rejected webhook with bad secret token', { ip: req.ip });
    next(new AppError('Invalid webhook secret token', 401, 'INVALID_WEBHOOK_SECRET'));
    return;
  }

  next();
};
