import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../lib/http.js';
import { authorizeUrl, fetchProfile, isEnabled, oauthFetch, providers, redirectUri } from '../lib/oauth.js';
import { loginUrl as steamLoginUrl, steamApi, verifyLogin as verifySteamLogin } from '../lib/steam.js';
import config from '../config.js';

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

  // Same message for every failure so the endpoint does not reveal which accounts exist.
  if (!user?.passwordHash || !(await bcrypt.compare(String(password ?? ''), user.passwordHash))) {
    throw new HttpError(401, 'Wrong username/email or password. If you joined with Discord or Twitch, use those buttons.');
  }
  res.json(session(user));
});

// ---------- Sign in with Discord / Twitch / Steam ----------

const STATE_COOKIE = 'bf_oauth';
const STATE_MS = 10 * 60 * 1000;

const safeReturnTo = (p) => (typeof p === 'string' && /^\/(?!\/)/.test(p) && !p.startsWith('/login') && !p.startsWith('/signup') ? p : '/');

const readCookie = (req, name) =>
  (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1] ?? null;

const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/api/auth', maxAge: STATE_MS };

router.get('/providers', (_req, res) => {
  res.json(Object.fromEntries(Object.keys(providers).map((name) => [name, isEnabled(name)])));
});

const knownProvider = (req) => {
  const { provider } = req.params;
  if (!providers[provider]) throw new HttpError(404, 'Not found');
  return provider;
};

// A signed-in user asks for a short-lived ticket, then opens /:provider/start?link=<ticket>
// to connect that provider to their existing account. (The start page is a plain browser
// navigation, so it can't carry the usual Authorization header.)
router.post('/link-ticket', requireAuth, (req, res) => {
  res.json({ ticket: jwt.sign({ sub: req.userId, purpose: 'link' }, config.jwtSecret, { expiresIn: '5m' }) });
});

router.get('/:provider/start', (req, res) => {
  const provider = knownProvider(req);
  const label = providers[provider].label;
  if (!isEnabled(provider)) return res.redirect(`/login?error=${encodeURIComponent(`${label} sign-in is not set up yet`)}`);

  let link = null;
  if (req.query.link) {
    try {
      const ticket = jwt.verify(String(req.query.link), config.jwtSecret);
      if (ticket.purpose !== 'link') throw new Error('wrong purpose');
      link = ticket.sub;
    } catch {
      return res.redirect(`/settings?error=${encodeURIComponent('That link expired. Please try again.')}`);
    }
  }

  // The nonce lives in an httpOnly cookie and inside the signed state, so a callback
  // only completes in the browser that started it (protects against login CSRF).
  const nonce = crypto.randomBytes(16).toString('hex');
  const returnTo = link ? '/settings' : safeReturnTo(req.query.returnTo);
  const state = jwt.sign({ nonce, provider, returnTo, link }, config.jwtSecret, { expiresIn: STATE_MS / 1000 });
  res.cookie(STATE_COOKIE, nonce, cookieOptions);

  if (providers[provider].openid) {
    return res.redirect(steamLoginUrl(`${redirectUri(provider)}?${new URLSearchParams({ state })}`, config.publicUrl));
  }
  return res.redirect(authorizeUrl(provider, state));
});

const usernameFrom = async (raw) => {
  let base = String(raw || 'player').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
  if (base.length < 3) base = `${base}player`.slice(0, 16);
  if (!(await User.exists({ username: base }))) return base;
  for (;;) {
    const candidate = `${base}_${crypto.randomInt(100, 10000)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
};

// Finds the Botfrag account for a provider profile, linking or creating one as needed.
export async function userForProfile(provider, profile) {
  const key = `connections.${provider}`;
  const linked = await User.findOne({ [`${key}.id`]: profile.id });
  if (linked) return linked;

  const connection = { id: profile.id, username: profile.username };
  // Only a provider-verified email may attach to an existing account; otherwise anyone could
  // claim someone else's account by putting their address on a Discord profile.
  const email = profile.email?.toLowerCase();
  if (email && profile.emailVerified) {
    const existing = await User.findOne({ email });
    if (existing) {
      existing.set(key, connection);
      if (!existing.avatarUrl && profile.avatarUrl) existing.avatarUrl = profile.avatarUrl;
      return existing.save();
    }
  }

  return User.create({
    username: await usernameFrom(profile.username),
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    email: email && profile.emailVerified ? email : undefined,
    connections: { [provider]: connection },
  });
}

// Connects a provider account to an existing Botfrag account.
async function linkToUser(userId, provider, profile) {
  const key = `connections.${provider}`;
  const owner = await User.findOne({ [`${key}.id`]: profile.id });
  if (owner && !owner._id.equals(userId)) {
    throw new HttpError(409, `That ${providers[provider].label} account is already connected to another Botfrag account`);
  }
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Account not found');
  user.set(key, { id: profile.id, username: profile.username });
  if (!user.avatarUrl && profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
  return user.save();
}

// Steam's OpenID response, checked with Steam, turned into the same profile shape as the others.
async function steamProfile(req) {
  const expectedReturnTo = `${redirectUri('steam')}?${new URLSearchParams({ state: String(req.query.state) })}`;
  const steamId = await verifySteamLogin(req.query, expectedReturnTo, oauthFetch);
  if (!steamId) throw new Error('Steam could not confirm this sign-in');
  let player = null;
  try {
    player = await steamApi().player(steamId);
  } catch (err) {
    console.warn('[steam]', err.message); // the profile is a bonus; the sign-in itself is verified
  }
  return {
    id: steamId,
    username: player?.name || `steam_${steamId.slice(-5)}`,
    displayName: player?.name || 'Steam player',
    avatarUrl: player?.avatarUrl || '',
    email: null,
    emailVerified: false,
  };
}

router.get('/:provider/callback', async (req, res) => {
  const provider = knownProvider(req);
  const label = providers[provider].label;
  const nonce = readCookie(req, STATE_COOKIE);
  res.clearCookie(STATE_COOKIE, { ...cookieOptions, maxAge: undefined });

  let state;
  try {
    state = jwt.verify(String(req.query.state), config.jwtSecret);
  } catch {
    state = null;
  }
  const fail = (message) => res.redirect(`${state?.link ? '/settings' : '/login'}?error=${encodeURIComponent(message)}`);

  if (req.query.error || req.query['openid.mode'] === 'cancel') return fail(`${label} sign-in was cancelled`);
  if (!state) return fail('That sign-in link expired. Please try again.');
  if (!nonce || state.nonce !== nonce || state.provider !== provider) return fail('Sign-in could not be verified. Please try again.');

  try {
    const profile = providers[provider].openid ? await steamProfile(req) : await fetchProfile(provider, String(req.query.code ?? ''));
    const user = state.link ? await linkToUser(state.link, provider, profile) : await userForProfile(provider, profile);
    // The token goes in the URL fragment, which browsers never send to servers or put in Referer headers.
    return res.redirect(`/auth/callback#${new URLSearchParams({ token: signToken(user), next: state.returnTo })}`);
  } catch (err) {
    console.warn(`[oauth:${provider}]`, err.message);
    return fail(err.status === 409 ? err.message : `Could not sign in with ${label}. Please try again.`);
  }
});

// Disconnects a provider, as long as the account keeps another way to sign in.
router.delete('/connections/:provider', requireAuth, async (req, res) => {
  const provider = knownProvider(req);
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Account not found');
  const others = Object.keys(providers).filter((p) => p !== provider && user.connections?.[p]?.id);
  if (!user.passwordHash && others.length === 0) {
    throw new HttpError(400, `${providers[provider].label} is your only way to sign in, so it can't be disconnected`);
  }
  user.set(`connections.${provider}`, undefined);
  await user.save();
  res.json({ user: user.toPublic(req.userId) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ user: user.toPublic() });
});

export default router;
