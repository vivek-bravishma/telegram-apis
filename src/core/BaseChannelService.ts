import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { UpstreamError } from './errors';
import { createLogger, Logger } from '../utils/logger';

export interface ChannelServiceOptions {
  baseURL: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Shared HTTP plumbing for provider clients: one axios instance per channel
 * plus uniform transport-error translation. Channel services add the provider's
 * own methods on top and keep all provider knowledge inside their own folder.
 */
export abstract class BaseChannelService {
  abstract readonly channel: string;

  protected readonly http: AxiosInstance;
  protected readonly log: Logger;

  protected constructor(options: ChannelServiceOptions) {
    this.http = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 15_000,
      headers: options.headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      // Provider error bodies carry the useful detail, so let us read them
      // instead of letting axios throw before we can.
      validateStatus: () => true,
    });
    this.log = createLogger(this.constructor.name);
  }

  /** Performs the request and returns the raw response body. */
  protected async request<T>(cfg: AxiosRequestConfig): Promise<{ status: number; data: T }> {
    try {
      const response = await this.http.request<T>(cfg);
      return { status: response.status, data: response.data };
    } catch (error) {
      throw this.toTransportError(error, cfg);
    }
  }

  /** Network/timeout failures — an HTTP error status never lands here. */
  private toTransportError(error: unknown, cfg: AxiosRequestConfig): UpstreamError {
    const axiosError = error as AxiosError;
    const target = `${cfg.method?.toUpperCase() ?? 'GET'} ${cfg.url ?? ''}`;

    if (axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT') {
      return new UpstreamError(`${this.channel}: request to ${target} timed out`, 504, {
        channel: this.channel,
        code: axiosError.code,
      });
    }

    return new UpstreamError(
      `${this.channel}: request to ${target} failed — ${axiosError?.message ?? 'unknown error'}`,
      502,
      { channel: this.channel, code: axiosError?.code },
    );
  }
}
