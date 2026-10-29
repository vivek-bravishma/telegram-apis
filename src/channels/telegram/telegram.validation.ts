import { z } from 'zod';

const chatId = z
  .union([z.string().trim().min(1), z.number()])
  .transform((value) => String(value));

const parseMode = z.enum(['MarkdownV2', 'HTML', 'Markdown']).optional();

/** Multipart fields arrive as strings, so booleans and numbers are coerced. */
const flag = z.coerce.boolean().optional();
const int = z.coerce.number().int().optional();

/** Accepts a keyboard object, or the JSON string form a multipart field carries. */
const replyMarkup = z
  .union([z.record(z.unknown()), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  });

export const sendTextSchema = z.object({
  chatId,
  text: z.string().min(1).max(4096),
  parseMode,
  disableWebPagePreview: flag,
  disableNotification: flag,
  protectContent: flag,
  replyToMessageId: int,
  replyMarkup,
});

/**
 * One of url / fileId / an uploaded file is required, but the file is not part
 * of the body — the controller enforces that once it can see both.
 */
export const sendMediaSchema = z.object({
  chatId,
  url: z.string().url().optional(),
  fileId: z.string().trim().min(1).optional(),
  caption: z.string().max(1024).optional(),
  parseMode,
  fileName: z.string().trim().min(1).max(200).optional(),
  durationSeconds: int,
  disableNotification: flag,
  protectContent: flag,
  replyToMessageId: int,
  replyMarkup,
});

export const setWebhookSchema = z.object({
  url: z.string().url().optional(),
  secretToken: z.string().trim().min(1).max(256).optional(),
  allowedUpdates: z.array(z.string()).optional(),
  dropPendingUpdates: flag,
  maxConnections: z.coerce.number().int().min(1).max(100).optional(),
});

export const deleteWebhookSchema = z.object({
  dropPendingUpdates: flag,
});

export const fileIdParamsSchema = z.object({
  fileId: z.string().trim().min(1),
});

export type SendTextBody = z.infer<typeof sendTextSchema>;
export type SendMediaBody = z.infer<typeof sendMediaSchema>;
export type SetWebhookBody = z.infer<typeof setWebhookSchema>;
export type DeleteWebhookBody = z.infer<typeof deleteWebhookSchema>;
