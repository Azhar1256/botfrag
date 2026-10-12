// "Sign in with Discord / Twitch" using the OAuth 2.0 authorization-code flow.
import config from '../config.js';

const form = (fields) => new URLSearchParams(fields);

async function readJson(res, what) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${data.error_description || data.message || data.error || ''}`);
  return data;
}

export const providers = {
  discord: {
    label: 'Discord',
    clientId: () => config.discordClientId,
    clientSecret: () => config.discordClientSecret,
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    scope: 'identify email',
    async profile(fetch, code, redirectUri) {
      const { access_token: token } = await readJson(
        await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form({ client_id: this.clientId(), client_secret: this.clientSecret(), grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
        }),
        'Discord token exchange'
      );
      const u = await readJson(await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } }), 'Discord profile');
      return {
        id: u.id,
        username: u.username,
        displayName: u.global_name || u.username,
        avatarUrl: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256` : '',
        email: u.email || null,
        emailVerified: u.verified === true,
      };
    },
  },

  twitch: {
    label: 'Twitch',
    // The Twitch app registered for IGDB works for sign-in too.
    clientId: () => config.twitchClientId || config.igdbClientId,
    clientSecret: () => config.twitchClientSecret || config.igdbClientSecret,
    authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
    scope: 'user:read:email',
    async profile(fetch, code, redirectUri) {
      const { access_token: token } = await readJson(
        await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form({ client_id: this.clientId(), client_secret: this.clientSecret(), grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
        }),
        'Twitch token exchange'
      );
      const { data } = await readJson(
        await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${token}`, 'Client-Id': this.clientId() } }),
        'Twitch profile'
      );
      const u = data?.[0];
      if (!u) throw new Error('Twitch returned no user');
      return {
        id: u.id,
        username: u.login,
        displayName: u.display_name || u.login,
        avatarUrl: u.profile_image_url || '',
        email: u.email || null,
        // Twitch only returns an email address once the user has verified it.
        emailVerified: Boolean(u.email),
      };
    },
  },
};

export const isEnabled = (name) => Boolean(providers[name]?.clientId() && providers[name]?.clientSecret());

export const redirectUri = (name) => `${config.publicUrl}/api/auth/${name}/callback`;

export const authorizeUrl = (name, state) => {
  const p = providers[name];
  return `${p.authorizeUrl}?${form({ client_id: p.clientId(), redirect_uri: redirectUri(name), response_type: 'code', scope: p.scope, state })}`;
};

let fetchImpl = (...args) => globalThis.fetch(...args);
// Lets tests fake Discord and Twitch.
export const setOAuthFetch = (fn) => {
  fetchImpl = fn;
};

export const fetchProfile = (name, code) => providers[name].profile(fetchImpl, code, redirectUri(name));
