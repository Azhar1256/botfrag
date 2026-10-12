import crypto from 'node:crypto';
import fs from 'node:fs';
import multer from 'multer';
import config from '../config.js';
import { HttpError } from '../lib/http.js';

const TYPES = {
  'image/jpeg': ['image', '.jpg'],
  'image/png': ['image', '.png'],
  'image/gif': ['image', '.gif'],
  'image/webp': ['image', '.webp'],
  'video/mp4': ['video', '.mp4'],
  'video/webm': ['video', '.webm'],
  'video/quicktime': ['video', '.mov'],
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

fs.mkdirSync(config.uploadDir, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + TYPES[file.mimetype][1]),
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (TYPES[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, 'Only JPG, PNG, GIF, WebP, MP4, WebM or MOV files can be uploaded'));
  },
});

export const kindOf = (mimetype) => TYPES[mimetype]?.[0];
