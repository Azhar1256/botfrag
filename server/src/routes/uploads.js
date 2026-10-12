import fs from 'node:fs/promises';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upload, kindOf, MAX_IMAGE_BYTES } from '../middleware/upload.js';
import { HttpError } from '../lib/http.js';

const router = Router();

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a file to upload');
  const kind = kindOf(req.file.mimetype);
  if (kind === 'image' && req.file.size > MAX_IMAGE_BYTES) {
    await fs.unlink(req.file.path).catch(() => {});
    throw new HttpError(400, 'Images can be up to 10 MB');
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}`, kind });
});

export default router;
