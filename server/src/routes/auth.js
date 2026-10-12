import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../lib/http.js';

const router = Router();

const session = (user) => ({ token: signToken(user), user: user.toPublic() });

router.post('/signup', async (req, res) => {
  const { username, displayName, email, password } = req.body ?? {};
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const taken = await User.findOne({
    $or: [{ email: String(email).toLowerCase().trim() }, { username: String(username).toLowerCase().trim() }],
  });
  if (taken) {
    throw new HttpError(409, taken.email === String(email).toLowerCase().trim()
      ? 'An account with that email already exists'
      : 'That username is taken');
  }

  const user = await User.create({
    username,
    displayName: displayName || username,
    email,
    passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json(session(user));
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body ?? {};
  const id = String(login ?? '').toLowerCase().trim();
  const user = await User.findOne(id.includes('@') ? { email: id } : { username: id }).select('+passwordHash');

  // Same message either way so the endpoint does not reveal which accounts exist.
  if (!user || !(await bcrypt.compare(String(password ?? ''), user.passwordHash))) {
    throw new HttpError(401, 'Wrong username/email or password');
  }
  res.json(session(user));
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ user: user.toPublic() });
});

export default router;
