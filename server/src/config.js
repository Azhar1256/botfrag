import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const port = Number(process.env.PORT) || 5000;

export default {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port,
  // Where the site is reached in the browser; used for OAuth redirect URLs.
  // In dev that's the Vite server, which proxies /api to this one.
  publicUrl: (process.env.PUBLIC_URL || (isProd ? `http://localhost:${port}` : 'http://localhost:5173')).replace(/\/$/, ''),
  mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/botfrag',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || 'uploads'),
  clientDist: path.resolve(root, '../client/dist'),
  igdbClientId: process.env.IGDB_CLIENT_ID || '',
  igdbClientSecret: process.env.IGDB_CLIENT_SECRET || '',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  twitchClientId: process.env.TWITCH_CLIENT_ID || '',
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
