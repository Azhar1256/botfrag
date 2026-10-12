import config from '../config.js';
import Game from '../models/Game.js';
import { createIgdb, coverUrl } from './igdb.js';
import { escapeRegex, slugify } from './http.js';

let igdb = createIgdb({ clientId: config.igdbClientId, clientSecret: config.igdbClientSecret });

// Lets tests swap in a fake IGDB client.
export const setIgdb = (client) => {
  igdb = client;
};
export const igdbEnabled = () => igdb.enabled;

const saveMeta = (meta) =>
  Game.findOneAndUpdate({ slug: meta.slug }, { $set: meta }, { upsert: true, new: true, setDefaultsOnInsert: true });

const findLocal = (name) => Game.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });

// IGDB is a nice-to-have: if it is down or slow, posting still works with the typed name.
const safely = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.warn('[igdb]', err.message);
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
  return { name, slug: slugify(name) };
}

// Metadata for a game page; looks it up on IGDB the first time if we don't have it yet.
export async function gameMeta(slug, name) {
  const existing = await Game.findOne({ slug });
  if (existing || !igdb.enabled || !name) return existing;
  const meta = await safely(() => igdb.match(name));
  // Only adopt the IGDB entry when it lands on the same page, so slugs never shift under existing posts.
  return meta && meta.slug === slug ? saveMeta(meta) : null;
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

export const publicMeta = (g) =>
  g && {
    igdbId: g.igdbId ?? null,
    summary: g.summary ?? '',
    releaseDate: g.releaseDate ?? null,
    coverUrl: coverUrl(g.cover),
    screenshots: (g.screenshots ?? []).map((id) => coverUrl(id, 'screenshot_big')),
    genres: g.genres ?? [],
    platforms: g.platforms ?? [],
    igdbRating: g.igdbRating ?? null,
  };
