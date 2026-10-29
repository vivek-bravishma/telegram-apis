import type { NormalizedInbound } from '../../core/events';
import { createLogger } from '../../utils/logger';
import { telegramConfig } from './telegram.config';
import { toNormalizedInbound } from './telegram.mapper';
import { telegramService } from './telegram.service';
import type { TelegramUpdate } from './telegram.types';

const log = createLogger('telegram:webhook');

export interface ProcessResult {
  handled: boolean;
  reason?: string;
  inbound?: NormalizedInbound;
}

/**
 * Echoes an inbound message back to its sender.
 *
 * This is the placeholder for whatever should eventually consume inbound
 * messages (a bot flow, a relay, a queue). Everything it needs comes from the
 * channel-agnostic NormalizedInbound, so a replacement works for every channel.
 */
async function echo(inbound: NormalizedInbound): Promise<void> {
  const attachment = inbound.attachments[0];

  if (attachment) {
    // Re-sending by file_id costs no upload: Telegram already holds the bytes.
    await telegramService.sendMedia(attachment.kind, {
      chatId: inbound.conversationId,
      fileId: attachment.fileId,
      caption: inbound.caption ? `Echo: ${inbound.caption}` : `Echo: ${attachment.kind}`,
    });
    return;
  }

  const text =
    inbound.type === 'text' && inbound.text
      ? `Echo: ${inbound.text}`
      : `Echo: received a ${inbound.type} message.`;

  await telegramService.sendText({ chatId: inbound.conversationId, text });
}

/**
 * Handles one Telegram update. Never throws: an inbound webhook must always be
 * acknowledged, or Telegram retries the same update indefinitely.
 */
export async function processUpdate(update: TelegramUpdate): Promise<ProcessResult> {
  const inbound = toNormalizedInbound(update);

  if (!inbound) {
    log.debug('Ignoring update with no message', { updateId: update?.update_id });
    return { handled: false, reason: 'unsupported_update' };
  }

  const message = update.message ?? update.edited_message;
  if (message?.from?.is_bot) {
    log.debug('Ignoring message from a bot', { eventId: inbound.eventId });
    return { handled: false, reason: 'sender_is_bot', inbound };
  }

  log.info('Inbound message', {
    eventId: inbound.eventId,
    conversationId: inbound.conversationId,
    type: inbound.type,
    hasAttachment: inbound.attachments.length > 0,
  });

  if (telegramConfig.echoInbound) {
    try {
      await echo(inbound);
    } catch (error) {
      log.error('Echo failed', {
        eventId: inbound.eventId,
        error: error instanceof Error ? error.message : error,
      });
      return { handled: true, reason: 'echo_failed', inbound };
    }
  }

  return { handled: true, inbound };
}
