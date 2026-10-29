import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function mimeFromFileName(fileName: string): string {
  return MIME_BY_EXT[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
}

/** Strips directories and anything that could escape the uploads folder. */
export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^A-Za-z0-9._-]/g, '_');
  const trimmed = base.replace(/^\.+/, '').slice(0, 120);
  return trimmed || 'file';
}

export interface StoredFile {
  fileName: string;
  absolutePath: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

/**
 * Writes a buffer into storage/uploads under a collision-proof name and
 * returns the URL it is served from.
 */
export function saveToUploads(buffer: Buffer, desiredFileName: string): StoredFile {
  ensureDir(config.paths.uploads);

  const safe = sanitizeFileName(desiredFileName);
  const ext = path.extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${stem}${ext}`;
  const absolutePath = path.join(config.paths.uploads, fileName);

  fs.writeFileSync(absolutePath, buffer);

  return {
    fileName,
    absolutePath,
    publicUrl: `${config.publicBaseUrl}${config.uploads.publicPath}/${fileName}`,
    size: buffer.length,
    mimeType: mimeFromFileName(fileName),
  };
}
