import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const env = process.env.NODE_ENV ?? 'development';
const port = num(process.env.PORT, 6600);
const publicBaseUrl = stripTrailingSlash(process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`);
const root = path.resolve(__dirname, '..', '..');
const storageDir = path.join(root, 'storage');

export const config = {
  env,
  isProduction: env === 'production',
  port,
  logLevel: process.env.LOG_LEVEL ?? 'info',

  /** Public origin of this service. Media URLs and webhook URLs are built from it. */
  publicBaseUrl,

  http: {
    bodyLimit: process.env.REQUEST_BODY_LIMIT ?? '5mb',
    allowedOrigins: list(process.env.ALLOWED_ORIGINS, ['*']),
  },

  uploads: {
    /** Max multipart upload size in bytes. */
    maxBytes: num(process.env.MAX_UPLOAD_MB, 50) * 1024 * 1024,
    /** URL path the uploads directory is served from. */
    publicPath: '/uploads',
  },

  paths: {
    root,
    storage: storageDir,
    uploads: path.join(storageDir, 'uploads'),
  },
} as const;

/** Shared env helpers so each channel config file parses the same way. */
export const envUtil = {
  num,
  list,
  stripTrailingSlash,
  str(value: string | undefined, fallback = ''): string {
    return value?.trim() ? value.trim() : fallback;
  },
  bool(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value.trim() === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  },
};
