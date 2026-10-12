// Minimal IGDB client (https://api-docs.igdb.com). Auth is a Twitch app token,
// fetched with the client-credentials flow and cached until shortly before it expires.

const GAME_FIELDS =
  'name,slug,summary,first_release_date,cover.image_id,genres.name,platforms.abbreviation,platforms.name,screenshots.image_id,total_rating,total_rating_count';

export const coverUrl = (imageId, size = 'cover_big') =>
  imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : '';

// IGDB returns nested objects; flatten them into what Botfrag stores.
export const toGameMeta = (g) => ({
  igdbId: g.id,
  name: g.name,
  slug: g.slug,
  summary: g.summary ?? '',
  releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000) : null,
  cover: g.cover?.image_id ?? '',
  screenshots: (g.screenshots ?? []).slice(0, 6).map((s) => s.image_id),
  genres: (g.genres ?? []).map((x) => x.name),
  platforms: (g.platforms ?? []).map((p) => p.abbreviation || p.name).filter(Boolean),
  igdbRating: g.total_rating_count ? Math.round(g.total_rating) : null,
});

const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

// "Baldur's Gate III" and "baldurs gate 3" compare equal; "Elden" and "Elden Ring" do not.
export const normalizeTitle = (s) =>
  String(s)
    .toLowerCase()
    .replace(/['’"]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w)
    .join(' ');

const escapeQuery = (s) => String(s).replace(/["\\]/g, ' ').trim().slice(0, 80);

export function createIgdb({ clientId, clientSecret, fetch = globalThis.fetch, now = Date.now }) {
  let token = null;
  let tokenExpires = 0;
  let pendingToken = null;
  const cache = new Map(); // query body -> { at, data }
  const CACHE_MS = 6 * 3600e3;

  const enabled = Boolean(clientId && clientSecret);

  async function getToken() {
    if (token && now() < tokenExpires) return token;
    pendingToken ??= (async () => {
      const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
      });
      if (!res.ok) throw new Error(`Twitch token request failed (${res.status})`);
      const data = await res.json();
      token = data.access_token;
      tokenExpires = now() + (data.expires_in - 300) * 1000;
      return token;
    })().finally(() => {
      pendingToken = null;
    });
    return pendingToken;
  }

  async function query(endpoint, body, retried = false) {
    const key = `${endpoint}:${body}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.data;

    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${await getToken()}`, Accept: 'application/json' },
      body,
    });
    if (res.status === 401 && !retried) {
      token = null; // revoked or expired early
      return query(endpoint, body, true);
    }
    if (!res.ok) throw new Error(`IGDB ${endpoint} failed (${res.status})`);
    const data = await res.json();
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: now(), data });
    return data;
  }

  return {
    enabled,

    async search(q, limit = 8) {
      const term = escapeQuery(q);
      if (!enabled || !term) return [];
      // Main games, standalone expansions, remakes and remasters; no mods, DLC, updates or editions.
      const rows = await query(
        'games',
        `search "${term}"; fields ${GAME_FIELDS}; where version_parent = null & game_type = (0,4,8,9,10); limit ${limit};`
      );
      // Keep IGDB's relevance order, but put games players have actually rated ahead of empty stub entries.
      const rated = (g) => (g.total_rating_count ? 0 : 1);
      return rows.map((g, i) => [g, i]).sort(([a, i], [b, j]) => rated(a) - rated(b) || i - j).map(([g]) => toGameMeta(g));
    },

    async byId(id) {
      if (!enabled || !Number.isInteger(Number(id))) return null;
      const [row] = await query('games', `fields ${GAME_FIELDS}; where id = ${Number(id)};`);
      return row ? toGameMeta(row) : null;
    },

    // Best IGDB match for a name typed by hand: the same title up to case, punctuation and
    // Roman numerals, so a typo or partial name never gets attached to the wrong game.
    async match(name) {
      const wanted = normalizeTitle(name);
      if (!wanted) return null;
      const results = await this.search(name, 10);
      return results.find((g) => normalizeTitle(g.name) === wanted) ?? null;
    },
  };
}
