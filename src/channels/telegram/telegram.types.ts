import type { MediaKind } from '../../core/events';

/* ── Telegram Bot API payloads (the subset this service touches) ───────────── */

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideo extends TelegramDocument {
  width: number;
  height: number;
  duration: number;
}

export interface TelegramAudio extends TelegramDocument {
  duration: number;
  performer?: string;
  title?: string;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  emoji?: string;
  set_name?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  video?: TelegramVideo;
  audio?: TelegramAudio;
  voice?: TelegramVoice;
  sticker?: TelegramSticker;
  location?: { latitude: number; longitude: number };
  contact?: { phone_number: string; first_name: string; last_name?: string };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

/* ── Service inputs (what controllers hand the service) ────────────────────── */

export type ParseMode = 'MarkdownV2' | 'HTML' | 'Markdown';

/** A file uploaded as multipart, held in memory. */
export interface UploadedFile {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
}

export interface SendTextInput {
  chatId: string;
  text: string;
  parseMode?: ParseMode;
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  replyMarkup?: unknown;
}

/**
 * Exactly one media source must be present:
 *  - file   = multipart upload, streamed on to Telegram
 *  - url    = public URL that Telegram fetches itself
 *  - fileId = a file_id Telegram already holds, so the re-send costs no upload
 */
export interface SendMediaInput {
  chatId: string;
  file?: UploadedFile;
  url?: string;
  fileId?: string;
  caption?: string;
  parseMode?: ParseMode;
  /** Overrides the filename shown to the recipient on documents and audio. */
  fileName?: string;
  durationSeconds?: number;
  disableNotification?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  replyMarkup?: unknown;
}

export interface SetWebhookInput {
  url?: string;
  secretToken?: string;
  allowedUpdates?: string[];
  dropPendingUpdates?: boolean;
  maxConnections?: number;
}

export interface MediaMethodSpec {
  method: string;
  field: string;
}

/** Maps a channel-agnostic media kind onto the Bot API method and field name. */
export const MEDIA_METHODS: Record<MediaKind, MediaMethodSpec> = {
  photo: { method: 'sendPhoto', field: 'photo' },
  document: { method: 'sendDocument', field: 'document' },
  video: { method: 'sendVideo', field: 'video' },
  audio: { method: 'sendAudio', field: 'audio' },
  voice: { method: 'sendVoice', field: 'voice' },
};
