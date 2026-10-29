import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import path from 'path';
import { BaseChannelService } from '../../core/BaseChannelService';
import { ChannelNotConfiguredError, UpstreamError } from '../../core/errors';
import type { MediaKind } from '../../core/events';
import { saveToUploads, StoredFile } from '../../utils/media';
import { telegramConfig, missingTelegramConfig } from './telegram.config';
import {
  toSendMediaPayload,
  toSendMessagePayload,
  toSetWebhookPayload,
} from './telegram.mapper';
import {
  MEDIA_METHODS,
  SendMediaInput,
  SendTextInput,
  SetWebhookInput,
  TelegramApiResponse,
  TelegramFile,
  TelegramMessage,
  TelegramUser,
  TelegramWebhookInfo,
  UploadedFile,
} from './telegram.types';

/** Drops undefined keys so the Bot API never sees a null it did not ask for. */
function prune(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

/**
 * Telegram Bot API client. The only file in the project that knows the Bot API
 * wire format; controllers call these methods and never build payloads.
 */
class TelegramService extends BaseChannelService {
  readonly channel = telegramConfig.name;

  private readonly fileHttp: AxiosInstance;

  constructor() {
    super({
      baseURL: `${telegramConfig.apiBaseUrl}/bot${telegramConfig.botToken}`,
      timeoutMs: telegramConfig.timeoutMs,
    });

    this.fileHttp = axios.create({
      baseURL: `${telegramConfig.fileApiBaseUrl}/file/bot${telegramConfig.botToken}`,
      timeout: telegramConfig.timeoutMs,
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      validateStatus: () => true,
    });
  }

  private assertConfigured(): void {
    const missing = missingTelegramConfig();
    if (missing.length > 0) throw new ChannelNotConfiguredError(this.channel, missing);
  }

  /** A Bot API error_code is about our call, so 401/404 must not leak to the caller as-is. */
  private statusFor(errorCode?: number): number {
    if (errorCode === 429) return 429;
    if (errorCode === 400) return 400;
    if (errorCode === 403) return 403;
    return 502;
  }

  private unwrap<T>(method: string, body: TelegramApiResponse<T>): T {
    if (!body?.ok) {
      throw new UpstreamError(
        `telegram ${method} failed: ${body?.description ?? 'unknown Bot API error'}`,
        this.statusFor(body?.error_code),
        { method, errorCode: body?.error_code, parameters: body?.parameters },
      );
    }
    return body.result as T;
  }

  /** JSON call to any Bot API method. */
  async call<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
    this.assertConfigured();

    const { data } = await this.request<TelegramApiResponse<T>>({
      url: `/${method}`,
      method: 'POST',
      data: prune(payload),
    });

    return this.unwrap<T>(method, data);
  }

  /** Multipart call, used when a media file is uploaded rather than referenced. */
  async callMultipart<T>(
    method: string,
    fields: Record<string, unknown>,
    file: { field: string; upload: UploadedFile },
  ): Promise<T> {
    this.assertConfigured();

    const form = new FormData();

    for (const [key, value] of Object.entries(prune(fields))) {
      // The Bot API expects nested structures as JSON strings in multipart.
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }

    form.append(file.field, file.upload.buffer, {
      filename: file.upload.fileName,
      contentType: file.upload.contentType,
    });

    const { data } = await this.request<TelegramApiResponse<T>>({
      url: `/${method}`,
      method: 'POST',
      data: form,
      headers: form.getHeaders(),
    });

    return this.unwrap<T>(method, data);
  }

  /* ── Bot ─────────────────────────────────────────────────────────────────── */

  getMe(): Promise<TelegramUser> {
    return this.call<TelegramUser>('getMe');
  }

  /* ── Webhook management ──────────────────────────────────────────────────── */

  setWebhook(input: SetWebhookInput): Promise<boolean> {
    const url = input.url ?? telegramConfig.defaultWebhookUrl;
    const secretToken = input.secretToken ?? (telegramConfig.webhookSecretToken || undefined);

    return this.call<boolean>('setWebhook', toSetWebhookPayload({ ...input, secretToken }, url));
  }

  deleteWebhook(dropPendingUpdates?: boolean): Promise<boolean> {
    return this.call<boolean>('deleteWebhook', { drop_pending_updates: dropPendingUpdates });
  }

  getWebhookInfo(): Promise<TelegramWebhookInfo> {
    return this.call<TelegramWebhookInfo>('getWebhookInfo');
  }

  /* ── Sending ─────────────────────────────────────────────────────────────── */

  sendText(input: SendTextInput): Promise<TelegramMessage> {
    return this.call<TelegramMessage>('sendMessage', toSendMessagePayload(input));
  }

  /**
   * Sends any supported media kind. The source is an upload, a public URL, or a
   * file_id Telegram already holds — all three land on the same Bot API field.
   */
  sendMedia(kind: MediaKind, input: SendMediaInput): Promise<TelegramMessage> {
    const { method, field } = MEDIA_METHODS[kind];
    const payload = toSendMediaPayload(kind, input);

    if (input.file) {
      const upload: UploadedFile = {
        ...input.file,
        fileName: input.fileName ?? input.file.fileName,
      };
      return this.callMultipart<TelegramMessage>(method, payload, { field, upload });
    }

    const reference = input.fileId ?? input.url;
    return this.call<TelegramMessage>(method, { ...payload, [field]: reference });
  }

  /* ── Receiving media ─────────────────────────────────────────────────────── */

  /** Resolves a file_id to Bot API file metadata, including its download path. */
  getFile(fileId: string): Promise<TelegramFile> {
    return this.call<TelegramFile>('getFile', { file_id: fileId });
  }

  /** Public download URL for a resolved file. Contains the bot token. */
  buildFileUrl(filePath: string): string {
    return `${telegramConfig.fileApiBaseUrl}/file/bot${telegramConfig.botToken}/${filePath}`;
  }

  /**
   * Pulls an inbound file off Telegram and stores it under storage/uploads,
   * returning a URL this service serves — no bot token in it.
   */
  async downloadFile(fileId: string): Promise<StoredFile & { fileId: string; telegramPath: string }> {
    const file = await this.getFile(fileId);

    if (!file.file_path) {
      throw new UpstreamError(`telegram getFile returned no file_path for ${fileId}`, 502, { fileId });
    }

    const response = await this.fileHttp.get<ArrayBuffer>(`/${file.file_path}`);

    if (response.status !== 200) {
      throw new UpstreamError(
        `telegram file download failed with status ${response.status}`,
        502,
        { fileId, filePath: file.file_path },
      );
    }

    const stored = saveToUploads(Buffer.from(response.data), path.basename(file.file_path));

    return { ...stored, fileId, telegramPath: file.file_path };
  }
}

export const telegramService = new TelegramService();
