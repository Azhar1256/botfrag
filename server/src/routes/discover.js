import { Router } from 'express';
import Post from '../models/Post.js';
import { HttpError, escapeRegex } from '../lib/http.js';

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
  {
    $project: {
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

router.get('/games', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 48));
  const match = req.query.q ? { 'game.name': new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i') } : {};
  res.json({ games: await Post.aggregate(gameStats(match, limit)) });
});

router.get('/games/:slug', async (req, res) => {
  const [game] = await Post.aggregate(gameStats({ 'game.slug': req.params.slug }, 1));
  if (!game) throw new HttpError(404, 'No posts about this game yet');

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
