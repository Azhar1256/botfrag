import jwt from 'jsonwebtoken';
import config from '../config.js';
import { HttpError } from '../lib/http.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const readUserId = (req) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, config.jwtSecret).sub;
  } catch {
    throw new HttpError(401, 'Your session has expired, please sign in again');
  }
};

export const requireAuth = (req, _res, next) => {
  req.userId = readUserId(req);
  if (!req.userId) throw new HttpError(401, 'Sign in to do that');
  next();
};

// Attaches req.userId when a valid token is present but lets anonymous requests through.
export const optionalAuth = (req, _res, next) => {
  try {
    req.userId = readUserId(req);
  } catch {
    req.userId = null;
  }
  next();
};
