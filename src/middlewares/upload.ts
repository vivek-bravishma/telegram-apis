import multer from 'multer';
import type { RequestHandler } from 'express';
import { config } from '../config';

/**
 * Multipart uploads are held in memory and streamed straight to the provider,
 * so an outbound send never touches disk.
 */
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
});

/** Accepts an optional single file; media can also be given as a URL or file id. */
export function uploadSingle(field = 'file'): RequestHandler {
  return memoryUpload.single(field);
}
