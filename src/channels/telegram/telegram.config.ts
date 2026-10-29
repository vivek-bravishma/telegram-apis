import { config, envUtil } from '../../config';

const { str, bool, num, stripTrailingSlash } = envUtil;

/**
 * All Telegram credentials and knobs live here. Nothing outside this folder
 * reads TELEGRAM_* env vars.
 */
export const telegramConfig = {
  name: 'telegram' as const,
  enabled: bool(process.env.TELEGRAM_ENABLED, true),

  botToken: str(process.env.TELEGRAM_BOT_TOKEN),

  apiBaseUrl: stripTrailingSlash(str(process.env.TELEGRAM_API_BASE_URL, 'https://api.telegram.org')),
  fileApiBaseUrl: stripTrailingSlash(
    str(process.env.TELEGRAM_FILE_API_BASE_URL, 'https://api.telegram.org'),
  ),

  /** Sent to Telegram on setWebhook and required back on every inbound update. */
  webhookSecretToken: str(process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN),

  /** Default target for POST /webhook/set when the caller omits a url. */
  get defaultWebhookUrl(): string {
    return str(process.env.TELEGRAM_WEBHOOK_URL, `${config.publicBaseUrl}/api/telegram/webhook`);
  },

  /** Testing aid: mirror every inbound message back to the sender. */
  echoInbound: bool(process.env.TELEGRAM_ECHO_INBOUND, true),

  timeoutMs: num(process.env.TELEGRAM_TIMEOUT_MS, 20_000),
};

/** Env vars that are required but missing. Consumed by the channel registry. */
export function missingTelegramConfig(): string[] {
  const missing: string[] = [];
  if (!telegramConfig.botToken) missing.push('TELEGRAM_BOT_TOKEN');
  return missing;
}
