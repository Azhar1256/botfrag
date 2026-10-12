// Minimal Giant Bomb API client (https://www.giantbomb.com/api/). Used as a second source of
// game details when IGDB has no match, and for "More on Giant Bomb" links on game pages.
import { normalizeTitle } from './igdb.js';

const FIELDS = 'guid,name,deck,image,original_release_date,expected_release_year,platforms,site_detail_url';

export const toGbMeta = (g) => ({
  gbGuid: g.guid,
  gbUrl: g.site_detail_url || '',
  name: g.name,
  deck: g.deck || '',
  imageUrl: g.image?.super_url || g.image?.medium_url || g.image?.original_url || '',
  releaseDate: g.original_release_date ? new Date(`${g.original_release_date.slice(0, 10)}T00:00:00Z`) : null,
  platforms: (g.platforms ?? []).map((p) => p.abbreviation || p.name).filter(Boolean),
});

export function createGiantBomb({ apiKey, fetch = globalThis.fetch, now = Date.now }) {
  const enabled = Boolean(apiKey);
  const cache = new Map();
  const CACHE_MS = 12 * 3600e3; // Giant Bomb allows ~200 requests per resource per hour

  async function call(path, params) {
    const url = `https://www.giantbomb.com/api/${path}/?${new URLSearchParams({ api_key: apiKey, format: 'json', field_list: FIELDS, ...params })}`;
    const hit = cache.get(url);
    if (hit && now() - hit.at < CACHE_MS) return hit.data;
    // Giant Bomb rejects requests without a descriptive User-Agent.
    const res = await fetch(url, { headers: { 'User-Agent': 'Botfrag/2.0 (game community site)', Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Giant Bomb ${path} failed (${res.status})`);
    const data = await res.json();
    if (data.status_code !== 1) throw new Error(`Giant Bomb ${path}: ${data.error}`);
    if (cache.size > 500) cache.clear();
    cache.set(url, { at: now(), data });
    return data;
  }

  return {
    enabled,

    async search(q, limit = 8) {
      const term = String(q).trim().slice(0, 80);
      if (!enabled || !term) return [];
      const data = await call('search', { query: term, resources: 'game', limit: String(limit) });
      return (data.results ?? []).map(toGbMeta);
    },

    // Same strict title rule as IGDB: never attach a near-miss.
    async match(name) {
      const wanted = normalizeTitle(name);
      if (!wanted) return null;
      return (await this.search(name, 10)).find((g) => normalizeTitle(g.name) === wanted) ?? null;
    },
  };
}
