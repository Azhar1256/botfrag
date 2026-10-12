import { Router } from 'express';
import Post from '../models/Post.js';
import { HttpError, escapeRegex } from '../lib/http.js';
import { artUrl, gameMeta, igdbEnabled, publicMeta, searchGames } from '../lib/games.js';

const router = Router();

// One row per game, built from the posts that mention it.
const gameStats = (match, limit) => [
  { $match: match },
  { $sort: { createdAt: -1 } },
  {
    $group: {
      _id: '$game.slug',
      name: { $first: '$game.name' },
      posts: { $sum: 1 },
      moments: { $sum: { $cond: [{ $eq: ['$type', 'moment'] }, 1, 0] } },
      reviews: { $sum: { $cond: [{ $eq: ['$type', 'review'] }, 1, 0] } },
      avgRating: { $avg: '$rating' },
      likes: { $sum: '$likeCount' },
      lastActivity: { $max: '$createdAt' },
      // Any uploaded image from the game's posts makes a cover.
      cover: {
        $max: {
          $let: {
            vars: { img: { $first: { $filter: { input: '$media', cond: { $eq: ['$$this.kind', 'image'] } } } } },
            in: '$$img.url',
          },
        },
      },
    },
  },
  { $sort: { posts: -1, lastActivity: -1 } },
  { $limit: limit },
  { $lookup: { from: 'games', localField: '_id', foreignField: 'slug', as: 'meta' } },
  {
    $project: {
      art: { $first: '$meta' },
      genres: { $ifNull: [{ $first: '$meta.genres' }, []] },
      _id: 0,
      slug: '$_id',
      name: 1,
      posts: 1,
      moments: 1,
      reviews: 1,
      likes: 1,
      lastActivity: 1,
      cover: 1,
      avgRating: { $round: ['$avgRating', 1] },
    },
  },
];

// IGDB or Giant Bomb art when we have it, otherwise any image uploaded to one of the game's posts.
const withArt = ({ art, ...g }) => ({ ...g, cover: artUrl(art) || g.cover || null });

const nameFilter = (q) => ({ 'game.name': new RegExp(escapeRegex(String(q).slice(0, 80)), 'i') });

router.get('/games', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 48));
  const games = await Post.aggregate(gameStats(req.query.q ? nameFilter(req.query.q) : {}, limit));
  res.json({ games: games.map(withArt) });
});

// Autocomplete for the post form: games already on Botfrag first, then IGDB results.
router.get('/games/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ results: [], igdb: igdbEnabled() });
  const local = (await Post.aggregate(gameStats(nameFilter(q), 5))).map(withArt).map((g) => ({
    igdbId: null,
    name: g.name,
    slug: g.slug,
    year: null,
    coverUrl: g.cover,
    posts: g.posts,
  }));
  res.json({ results: (await searchGames(q, local)).slice(0, 10), igdb: igdbEnabled() });
});

router.get('/games/:slug', async (req, res) => {
  const [stats] = await Post.aggregate(gameStats({ 'game.slug': req.params.slug }, 1));
  if (!stats) throw new HttpError(404, 'No posts about this game yet');
  const meta = await gameMeta(stats.slug, stats.name);
  const game = { ...withArt({ ...stats, art: meta }), meta: publicMeta(meta) };

  const buckets = await Post.aggregate([
    { $match: { 'game.slug': req.params.slug, type: 'review' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const distribution = Array.from({ length: 10 }, (_, i) => buckets.find((b) => b._id === i + 1)?.count ?? 0);

  res.json({ game: { ...game, distribution } });
});

router.get('/tags/trending', async (_req, res) => {
  const tags = await Post.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 15 },
    { $project: { _id: 0, tag: '$_id', count: 1 } },
  ]);
  res.json({ tags });
});

export default router;
