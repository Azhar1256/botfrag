import config from '../config.js';
import Game from '../models/Game.js';
import { createIgdb, coverUrl } from './igdb.js';
import { createGiantBomb } from './giantbomb.js';
import { escapeRegex, slugify } from './http.js';

let igdb = createIgdb({ clientId: config.igdbClientId, clientSecret: config.igdbClientSecret });
let giantBomb = createGiantBomb({ apiKey: config.giantBombApiKey });

// Let tests swap in fake clients.
export const setIgdb = (client) => {
  igdb = client;
};
export const setGiantBomb = (client) => {
  giantBomb = client;
};
export const igdbEnabled = () => igdb.enabled;

const GB_RECHECK_MS = 7 * 864e5;

const saveMeta = (meta) =>
  Game.findOneAndUpdate({ slug: meta.slug }, { $set: meta }, { upsert: true, new: true, setDefaultsOnInsert: true });

const findLocal = (name) => Game.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });

// IGDB and Giant Bomb are nice-to-haves: if it is down or slow, posting still works with the typed name.
const safely = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.warn('[games]', err.message);
    return null;
  }
};

/**
 * Turns what the client sent ({ name, igdbId } or a plain name) into the { name, slug }
 * stored on a post. Known games are matched to IGDB so "valorant" and "VALORANT" end up
 * on the same game page, with IGDB's canonical title and artwork.
 */
export async function resolveGame(input) {
  const name = String(input?.name ?? input ?? '').trim();
  const igdbId = Number(input?.igdbId) || null;

  if (igdbId) {
    const known = await Game.findOne({ igdbId });
    if (known) return { name: known.name, slug: known.slug };
    const meta = await safely(() => igdb.byId(igdbId));
    if (meta) {
      await saveMeta(meta);
      return { name: meta.name, slug: meta.slug };
    }
  }

  if (!name) return { name, slug: '' };

  const local = await findLocal(name);
  if (local) return { name: local.name, slug: local.slug };

  if (igdb.enabled) {
    const meta = await safely(() => igdb.match(name));
    if (meta) {
      await saveMeta(meta);
      return { name: meta.name, slug: meta.slug };
    }
  }
  if (giantBomb.enabled) {
    const gb = await safely(() => giantBomb.match(name));
    if (gb) {
      const slug = slugify(gb.name);
      await saveMeta({ ...gb, slug, gbCheckedAt: new Date() });
      return { name: gb.name, slug };
    }
  }
  return { name, slug: slugify(name) };
}

// Metadata for a game page. Looks the game up on IGDB the first time, and on Giant Bomb
// (at most weekly) to fill gaps and get its Giant Bomb link.
export async function gameMeta(slug, name) {
  let game = await Game.findOne({ slug });
  if (!game && igdb.enabled && name) {
    const meta = await safely(() => igdb.match(name));
    // Only adopt the IGDB entry when it lands on the same page, so slugs never shift under existing posts.
    if (meta && meta.slug === slug) game = await saveMeta(meta);
  }

  const due = !game?.gbGuid && (!game?.gbCheckedAt || Date.now() - game.gbCheckedAt > GB_RECHECK_MS);
  if (giantBomb.enabled && name && due) {
    const gb = await safely(() => giantBomb.match(game?.name ?? name));
    const update = { gbCheckedAt: new Date() };
    if (gb) {
      Object.assign(update, { gbGuid: gb.gbGuid, gbUrl: gb.gbUrl, deck: gb.deck, imageUrl: gb.imageUrl });
      // Fill only what IGDB didn't give us.
      if (!game?.releaseDate && gb.releaseDate) update.releaseDate = gb.releaseDate;
      if (!game?.platforms?.length && gb.platforms.length) update.platforms = gb.platforms;
    }
    if (game || gb) game = await saveMeta({ slug, name: game?.name ?? name, ...update });
  }
  return game;
}

export async function searchGames(q, localGames) {
  const remote = (await safely(() => igdb.search(q))) ?? [];
  const seen = new Set(localGames.map((g) => g.slug));
  return [
    ...localGames,
    ...remote
      .filter((g) => !seen.has(g.slug))
      .map((g) => ({
        igdbId: g.igdbId,
        name: g.name,
        slug: g.slug,
        year: g.releaseDate?.getUTCFullYear() ?? null,
        coverUrl: coverUrl(g.cover, 'cover_small'),
        posts: 0,
      })),
  ];
}

// IGDB box art when we have it, otherwise Giant Bomb's image.
export const artUrl = (g) => (g?.cover ? coverUrl(g.cover) : g?.imageUrl || '');

export const publicMeta = (g) =>
  g && {
    igdbId: g.igdbId ?? null,
    summary: g.summary || g.deck || '',
    releaseDate: g.releaseDate ?? null,
    coverUrl: artUrl(g),
    giantBombUrl: g.gbUrl || null,
    screenshots: (g.screenshots ?? []).map((id) => coverUrl(id, 'screenshot_big')),
    genres: g.genres ?? [],
    platforms: g.platforms ?? [],
    igdbRating: g.igdbRating ?? null,
  };
