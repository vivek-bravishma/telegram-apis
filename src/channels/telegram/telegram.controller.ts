import type { Request, RequestHandler } from 'express';
import { ValidationError } from '../../core/errors';
import type { MediaKind } from '../../core/events';
import { ok } from '../../core/response';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { mimeFromFileName } from '../../utils/media';
import { createLogger } from '../../utils/logger';
import { telegramService } from './telegram.service';
import { processUpdate } from './telegram.webhook';
import type { SendMediaInput, TelegramUpdate, UploadedFile } from './telegram.types';
import type {
  DeleteWebhookBody,
  SendMediaBody,
  SendTextBody,
  SetWebhookBody,
} from './telegram.validation';

const log = createLogger('telegram:controller');

/** Multer puts the parsed upload on req.file; normalise it for the service. */
function toUploadedFile(req: Request): UploadedFile | undefined {
  const file = req.file;
  if (!file) return undefined;

  return {
    buffer: file.buffer,
    fileName: file.originalname || 'upload',
    contentType: file.mimetype || mimeFromFileName(file.originalname || 'upload'),
  };
}

/** Enforces the one-source rule that the body schema alone cannot see. */
function resolveMediaInput(req: Request, body: SendMediaBody): SendMediaInput {
  const file = toUploadedFile(req);
  const sources = [file ? 'file' : null, body.url ? 'url' : null, body.fileId ? 'fileId' : null].filter(
    Boolean,
  );

  if (sources.length === 0) {
    throw new ValidationError(
      'A media source is required: upload a multipart "file", or send "url" or "fileId".',
    );
  }

  if (sources.length > 1) {
    throw new ValidationError('Provide exactly one media source.', { provided: sources });
  }

  return { ...body, file };
}

export const telegramController = {
  /* ── Inbound ───────────────────────────────────────────────────────────── */

  /**
   * Telegram retries any non-2xx, so this always answers 200 — processing
   * problems are logged and reported in the body, not in the status.
   */
  handleWebhook: asyncHandler(async (req, res) => {
    const update = req.body as TelegramUpdate;
    const result = await processUpdate(update);

    ok(res, {
      received: true,
      handled: result.handled,
      reason: result.reason,
      eventId: result.inbound?.eventId,
    });
  }),

  /* ── Webhook management ────────────────────────────────────────────────── */

  setWebhook: asyncHandler(async (req, res) => {
    const body = req.body as SetWebhookBody;
    const registered = await telegramService.setWebhook(body);
    const info = await telegramService.getWebhookInfo();

    log.info('Webhook registered', { url: info.url });
    ok(res, { registered, webhook: info });
  }),

  deleteWebhook: asyncHandler(async (req, res) => {
    const body = req.body as DeleteWebhookBody;
    const deleted = await telegramService.deleteWebhook(body.dropPendingUpdates);

    log.info('Webhook deleted');
    ok(res, { deleted });
  }),

  getWebhookInfo: asyncHandler(async (_req, res) => {
    ok(res, await telegramService.getWebhookInfo());
  }),

  getMe: asyncHandler(async (_req, res) => {
    ok(res, await telegramService.getMe());
  }),

  /* ── Sending ───────────────────────────────────────────────────────────── */

  sendText: asyncHandler(async (req, res) => {
    const body = req.body as SendTextBody;
    const message = await telegramService.sendText(body);

    ok(res, { messageId: message.message_id, chatId: String(message.chat.id), message }, 201);
  }),

  /** One handler per media kind, bound at route-registration time. */
  sendMedia(kind: MediaKind): RequestHandler {
    return asyncHandler(async (req, res) => {
      const input = resolveMediaInput(req, req.body as SendMediaBody);
      const message = await telegramService.sendMedia(kind, input);

      ok(
        res,
        { kind, messageId: message.message_id, chatId: String(message.chat.id), message },
        201,
      );
    });
  },

  /* ── Receiving media ───────────────────────────────────────────────────── */

  /** File metadata plus the Telegram-hosted URL (which embeds the bot token). */
  getFileInfo: asyncHandler(async (req, res) => {
    const { fileId } = req.params as { fileId: string };
    const file = await telegramService.getFile(fileId);

    ok(res, {
      fileId: file.file_id,
      fileSize: file.file_size,
      telegramPath: file.file_path,
      telegramUrl: file.file_path ? telegramService.buildFileUrl(file.file_path) : undefined,
    });
  }),

  /** Downloads the file into storage/uploads and returns a token-free URL. */
  downloadFile: asyncHandler(async (req, res) => {
    const { fileId } = req.params as { fileId: string };
    const stored = await telegramService.downloadFile(fileId);

    log.info('Downloaded inbound media', { fileId, fileName: stored.fileName });
    ok(res, {
      fileId: stored.fileId,
      fileName: stored.fileName,
      size: stored.size,
      mimeType: stored.mimeType,
      url: stored.publicUrl,
      telegramPath: stored.telegramPath,
    }, 201);
  }),
};
