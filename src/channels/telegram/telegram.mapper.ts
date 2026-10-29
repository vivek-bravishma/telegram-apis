import type { InboundAttachment, InboundType, MediaKind, NormalizedInbound } from '../../core/events';
import type {
  SendMediaInput,
  SendTextInput,
  SetWebhookInput,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from './telegram.types';

const CHANNEL = 'telegram';

function displayName(user?: TelegramUser): string | undefined {
  if (!user) return undefined;
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.username;
}

/** Telegram sends several photo sizes; the last one is the largest. */
function largestPhoto(message: TelegramMessage) {
  return message.photo?.[message.photo.length - 1];
}

function extractAttachment(message: TelegramMessage): { kind: MediaKind; attachment: InboundAttachment } | undefined {
  const photo = largestPhoto(message);
  if (photo) {
    return {
      kind: 'photo',
      attachment: {
        kind: 'photo',
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        mimeType: 'image/jpeg',
        fileSize: photo.file_size,
      },
    };
  }

  if (message.document) {
    const { document } = message;
    return {
      kind: 'document',
      attachment: {
        kind: 'document',
        fileId: document.file_id,
        fileUniqueId: document.file_unique_id,
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSize: document.file_size,
      },
    };
  }

  if (message.video) {
    const { video } = message;
    return {
      kind: 'video',
      attachment: {
        kind: 'video',
        fileId: video.file_id,
        fileUniqueId: video.file_unique_id,
        fileName: video.file_name,
        mimeType: video.mime_type,
        fileSize: video.file_size,
        durationSeconds: video.duration,
      },
    };
  }

  if (message.audio) {
    const { audio } = message;
    return {
      kind: 'audio',
      attachment: {
        kind: 'audio',
        fileId: audio.file_id,
        fileUniqueId: audio.file_unique_id,
        fileName: audio.file_name,
        mimeType: audio.mime_type,
        fileSize: audio.file_size,
        durationSeconds: audio.duration,
      },
    };
  }

  if (message.voice) {
    const { voice } = message;
    return {
      kind: 'voice',
      attachment: {
        kind: 'voice',
        fileId: voice.file_id,
        fileUniqueId: voice.file_unique_id,
        mimeType: voice.mime_type ?? 'audio/ogg',
        fileSize: voice.file_size,
        durationSeconds: voice.duration,
      },
    };
  }

  return undefined;
}

function resolveType(message: TelegramMessage, mediaKind?: MediaKind): InboundType {
  if (mediaKind) return mediaKind;
  if (message.sticker) return 'sticker';
  if (message.location) return 'location';
  if (message.contact) return 'contact';
  if (typeof message.text === 'string') return 'text';
  return 'other';
}

/**
 * Native update to the channel-agnostic inbound event. Returns null for
 * updates this service does not handle, so the caller can 200 and move on.
 */
export function toNormalizedInbound(update: TelegramUpdate): NormalizedInbound | null {
  const message =
    update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;

  if (!message) return null;

  const media = extractAttachment(message);
  const type = resolveType(message, media?.kind);

  return {
    channel: CHANNEL,
    eventId: `${CHANNEL}:update:${update.update_id}`,
    conversationId: String(message.chat.id),
    messageId: String(message.message_id),
    sender: {
      id: String(message.from?.id ?? message.chat.id),
      username: message.from?.username,
      displayName: displayName(message.from) ?? message.chat.title,
    },
    type,
    text: message.text,
    caption: message.caption,
    attachments: media ? [media.attachment] : [],
    receivedAt: new Date(message.date * 1000).toISOString(),
    raw: update,
  };
}

/* ── Outbound: service input to Bot API field names ────────────────────────── */

export function toSendMessagePayload(input: SendTextInput): Record<string, unknown> {
  return {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode,
    link_preview_options:
      input.disableWebPagePreview === undefined
        ? undefined
        : { is_disabled: input.disableWebPagePreview },
    disable_notification: input.disableNotification,
    protect_content: input.protectContent,
    reply_to_message_id: input.replyToMessageId,
    reply_markup: input.replyMarkup,
  };
}

/** Everything except the media field itself, which the service attaches. */
export function toSendMediaPayload(kind: MediaKind, input: SendMediaInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    chat_id: input.chatId,
    caption: input.caption,
    parse_mode: input.parseMode,
    disable_notification: input.disableNotification,
    protect_content: input.protectContent,
    reply_to_message_id: input.replyToMessageId,
    reply_markup: input.replyMarkup,
  };

  // Only the timed kinds accept a duration.
  if (kind === 'video' || kind === 'audio' || kind === 'voice') {
    payload.duration = input.durationSeconds;
  }

  return payload;
}

export function toSetWebhookPayload(input: SetWebhookInput, url: string): Record<string, unknown> {
  return {
    url,
    secret_token: input.secretToken,
    allowed_updates: input.allowedUpdates,
    drop_pending_updates: input.dropPendingUpdates,
    max_connections: input.maxConnections,
  };
}
