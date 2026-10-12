import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export default {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/botfrag',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || 'uploads'),
  clientDist: path.resolve(root, '../client/dist'),
  igdbClientId: process.env.IGDB_CLIENT_ID || '',
  igdbClientSecret: process.env.IGDB_CLIENT_SECRET || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
