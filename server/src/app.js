import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import config from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import discoverRoutes from './routes/discover.js';
import uploadRoutes from './routes/uploads.js';
import { HttpError } from './lib/http.js';

const app = express();

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'blob:'],
        'frame-src': ['https://www.youtube-nocookie.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  })
);
if (!config.isProd) app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

const limiter = (limit) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => config.isTest });

app.use('/api/auth', limiter(30), authRoutes);
app.use('/api/uploads', limiter(100), uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', discoverRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', () => {
  throw new HttpError(404, 'Not found');
});

app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true, index: false }));

// In production the API also serves the built React app.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors)[0]?.message || 'Invalid input';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Videos can be up to 100 MB' : err.message;
  } else if (err.code === 11000) {
    status = 409;
    message = 'That already exists';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Something went wrong on our side';
  }
  res.status(status).json({ message });
});

export default app;
