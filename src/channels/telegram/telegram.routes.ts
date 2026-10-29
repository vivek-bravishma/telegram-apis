import { Router } from 'express';
import { MEDIA_KINDS } from '../../core/events';
import { uploadSingle } from '../../middlewares/upload';
import { validateBody, validateParams } from '../../middlewares/validate';
import { telegramController } from './telegram.controller';
import { verifyWebhookSecret } from './telegram.middleware';
import {
  deleteWebhookSchema,
  fileIdParamsSchema,
  sendMediaSchema,
  sendTextSchema,
  setWebhookSchema,
} from './telegram.validation';

const router = Router();

/* ── Bot ─────────────────────────────────────────────────────────────────────
 * GET  /api/telegram/me
 */
router.get('/me', telegramController.getMe);

/* ── Webhook management ─────────────────────────────────────────────────────
 * POST /api/telegram/webhook/set
 * POST /api/telegram/webhook/delete
 * GET  /api/telegram/webhook/info
 *
 * These must stay ABOVE the /webhook/:botId route below, which would otherwise
 * swallow "set" and "delete" as a bot id.
 */
router.post('/webhook/set', validateBody(setWebhookSchema), telegramController.setWebhook);
router.post('/webhook/delete', validateBody(deleteWebhookSchema), telegramController.deleteWebhook);
router.get('/webhook/info', telegramController.getWebhookInfo);

/* ── Inbound ────────────────────────────────────────────────────────────────
 * POST /api/telegram/webhook
 * POST /api/telegram/webhook/:botId   (reserved: multi-bot support later)
 */
router.post('/webhook', verifyWebhookSecret, telegramController.handleWebhook);
router.post('/webhook/:botId', verifyWebhookSecret, telegramController.handleWebhook);

/* ── Sending ────────────────────────────────────────────────────────────────
 * POST /api/telegram/messages/text
 * POST /api/telegram/messages/{photo|document|video|audio|voice}
 *
 * Media accepts either multipart (field "file") or JSON with "url"/"fileId".
 */
router.post('/messages/text', validateBody(sendTextSchema), telegramController.sendText);

for (const kind of MEDIA_KINDS) {
  router.post(
    `/messages/${kind}`,
    uploadSingle('file'),
    validateBody(sendMediaSchema),
    telegramController.sendMedia(kind),
  );
}

/* ── Receiving media ────────────────────────────────────────────────────────
 * GET  /api/telegram/files/:fileId            metadata + Telegram URL
 * POST /api/telegram/files/:fileId/download   copy into storage/uploads
 */
router.get('/files/:fileId', validateParams(fileIdParamsSchema), telegramController.getFileInfo);
router.post(
  '/files/:fileId/download',
  validateParams(fileIdParamsSchema),
  telegramController.downloadFile,
);

export const telegramRoutes = router;
