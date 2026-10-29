/**
 * The channel-agnostic inbound contract.
 *
 * Every channel's mapper converts its native webhook payload into this shape,
 * so anything downstream (an echo, a bot flow, a relay) is written once and
 * works for every channel that gets added later.
 */

export type InboundType =
  | 'text'
  | 'photo'
  | 'document'
  | 'video'
  | 'audio'
  | 'voice'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'other';

/** Media kinds this service can both receive and send. */
export const MEDIA_KINDS = ['photo', 'document', 'video', 'audio', 'voice'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

export interface InboundAttachment {
  kind: MediaKind;
  /** Provider-side handle. For Telegram this is file_id and can be re-sent as-is. */
  fileId: string;
  fileUniqueId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
}

export interface InboundSender {
  id: string;
  username?: string;
  displayName?: string;
}

export interface NormalizedInbound {
  channel: string;
  /** Stable per-event id, e.g. "telegram:update:123456". */
  eventId: string;
  /** Where to reply. For Telegram this is the chat id. */
  conversationId: string;
  messageId?: string;
  sender: InboundSender;
  type: InboundType;
  text?: string;
  caption?: string;
  attachments: InboundAttachment[];
  receivedAt: string;
  /** Untouched provider payload, for debugging. */
  raw: unknown;
}
