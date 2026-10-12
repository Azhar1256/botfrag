// Steam: "Sign in through Steam" (OpenID 2.0) and the Steam Web API (profile, owned games).
// OpenID needs no keys. The Web API needs a key from https://steamcommunity.com/dev/apikey.
import config from '../config.js';
import { normalizeTitle } from './igdb.js';

const OPENID = 'https://steamcommunity.com/openid/login';
const NS = 'http://specs.openid.net/auth/2.0';
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function loginUrl(returnTo, realm) {
  return `${OPENID}?${new URLSearchParams({
    'openid.ns': NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': `${NS}/identifier_select`,
    'openid.claimed_id': `${NS}/identifier_select`,
  })}`;
}

/**
 * Checks a Steam OpenID response and returns the SteamID64, or null if it isn't genuine.
 * `query` is the callback's query string; `expectedReturnTo` is the exact return_to we sent.
 * Steam itself confirms the signature (check_authentication), so a forged response fails.
 */
export async function verifyLogin(query, expectedReturnTo, fetch) {
  if (query['openid.mode'] !== 'id_res') return null;
  // The assertion must be for this site's callback, or it could be replayed from another site.
  if (query['openid.return_to'] !== expectedReturnTo) return null;
  if (query['openid.op_endpoint'] !== OPENID) return null;
  const match = CLAIMED_ID.exec(query['openid.claimed_id'] ?? '');
  if (!match || query['openid.identity'] !== query['openid.claimed_id']) return null;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (k.startsWith('openid.')) params.set(k, String(v));
  params.set('openid.mode', 'check_authentication');

  const res = await fetch(OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const text = await res.text();
  return res.ok && /^is_valid\s*:\s*true\s*$/m.test(text) ? match[1] : null;
}

export function createSteam({ apiKey, fetch = globalThis.fetch, now = Date.now }) {
  const enabled = Boolean(apiKey);
  const cache = new Map();
  const CACHE_MS = 30 * 60 * 1000;

  async function call(path, params) {
    const url = `https://api.steampowered.com/${path}/?${new URLSearchParams({ key: apiKey, format: 'json', ...params })}`;
    const hit = cache.get(url);
    if (hit && now() - hit.at < CACHE_MS) return hit.data;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Steam ${path} failed (${res.status})`);
    const data = await res.json();
    if (cache.size > 500) cache.clear();
    cache.set(url, { at: now(), data });
    return data;
  }

  return {
    enabled,

    async player(steamId) {
      if (!enabled) return null;
      const data = await call('ISteamUser/GetPlayerSummaries/v2', { steamids: steamId });
      const p = data.response?.players?.[0];
      return p ? { name: p.personaname, avatarUrl: p.avatarfull || '', profileUrl: p.profileurl } : null;
    },

    // Empty when the user's game details are private on Steam.
    async ownedGames(steamId) {
      if (!enabled) return [];
      const data = await call('IPlayerService/GetOwnedGames/v1', {
        steamid: steamId,
        include_appinfo: 'true',
        include_played_free_games: 'true',
      });
      return (data.response?.games ?? []).map((g) => ({ appid: g.appid, name: g.name, minutes: g.playtime_forever ?? 0 }));
    },

    // Minutes the user has played `gameName` on Steam, or null if they don't own it (or it's private).
    async playtime(steamId, gameName) {
      const wanted = normalizeTitle(gameName);
      if (!wanted) return null;
      const game = (await this.ownedGames(steamId)).find((g) => normalizeTitle(g.name) === wanted);
      return game ? { appid: game.appid, minutes: game.minutes } : null;
    },
  };
}

// The app-wide Steam Web API client (tests swap in a fake).
let instance = createSteam({ apiKey: config.steamApiKey });
export const steamApi = () => instance;
export const setSteam = (client) => {
  instance = client;
};
