import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Comment from '../models/Comment.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { HttpError, escapeRegex, youtubeId } from '../lib/http.js';
import { resolveGame } from '../lib/games.js';
import config from '../config.js';

const router = Router();
const UPLOAD_PATH = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|gif|webp|mp4|webm|mov)$/;
const PERIODS = { day: 1, week: 7, month: 30, year: 365 };

const AUTHOR_FIELDS = 'username displayName avatarUrl';

const findPost = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Post not found');
  const post = await Post.findById(id);
  if (!post) throw new HttpError(404, 'Post not found');
  return post;
};

const parseTags = (tags) => {
  const list = Array.isArray(tags) ? tags : String(tags ?? '').split(',');
  return [...new Set(list.map((t) => String(t).toLowerCase().replace(/^#/, '').trim().replace(/\s+/g, '-')).filter(Boolean))];
};

const parseMedia = (media) => {
  if (!Array.isArray(media)) return [];
  return media.map((m) => {
    if (m?.kind === 'youtube') {
      const id = youtubeId(m.url);
      if (!id) throw new HttpError(400, 'That YouTube link is not valid');
      return { kind: 'youtube', url: id };
    }
    if ((m?.kind === 'image' || m?.kind === 'video') && UPLOAD_PATH.test(m.url)) return { kind: m.kind, url: m.url };
    throw new HttpError(400, 'Media must be an uploaded file or a YouTube link');
  });
};

// Copies only the fields a client may set, so author/likes/counters can't be forged.
const applyInput = async (post, body = {}) => {
  if (body.type !== undefined) post.type = body.type;
  if (body.title !== undefined) post.title = body.title;
  if (body.body !== undefined) post.body = body.body;
  if (body.game !== undefined) post.game = await resolveGame(body.game);
  if (body.platform !== undefined) post.platform = body.platform;
  if (body.tags !== undefined) post.tags = parseTags(body.tags);
  if (body.media !== undefined) post.media = parseMedia(body.media);
  if (body.rating !== undefined && body.rating !== null && body.rating !== '') post.rating = Number(body.rating);
};

router.get('/', optionalAuth, async (req, res) => {
  const { type, game, tag, author, q, sort = 'latest', period, feed } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));

  const filter = {};
  if (type === 'moment' || type === 'review') filter.type = type;
  if (game) filter['game.slug'] = String(game);
  if (tag) filter.tags = String(tag).toLowerCase();
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
    filter.$or = [{ title: rx }, { body: rx }, { 'game.name': rx }, { tags: rx }];
  }
  if (author) {
    const u = await User.findOne({ username: String(author).toLowerCase() }).select('_id');
    if (!u) return res.json({ posts: [], page, pages: 0, total: 0 });
    filter.author = u._id;
  }
  if (feed === 'following') {
    if (!req.userId) throw new HttpError(401, 'Sign in to see your following feed');
    const me = await User.findById(req.userId).select('following');
    filter.author = { $in: me?.following ?? [] };
  }
  if (sort === 'top' && PERIODS[period]) {
    filter.createdAt = { $gte: new Date(Date.now() - PERIODS[period] * 864e5) };
  }

  const order = sort === 'top' ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };
  const [posts, total] = await Promise.all([
    Post.find(filter).sort(order).skip((page - 1) * limit).limit(limit).populate('author', AUTHOR_FIELDS),
    Post.countDocuments(filter),
  ]);

  res.json({ posts: posts.map((p) => p.toPublic(req.userId)), page, pages: Math.ceil(total / limit), total });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const post = await findPost(req.params.id);
  await post.populate('author', AUTHOR_FIELDS);
  res.json({ post: post.toPublic(req.userId) });
});

router.post('/', requireAuth, async (req, res) => {
  const post = new Post({ author: req.userId });
  await applyInput(post, req.body);
  await post.save();
  await post.populate('author', AUTHOR_FIELDS);
  res.status(201).json({ post: post.toPublic(req.userId) });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post.author.equals(req.userId)) throw new HttpError(403, 'You can only edit your own posts');
  await applyInput(post, req.body);
  await post.save();
  await post.populate('author', AUTHOR_FIELDS);
  res.json({ post: post.toPublic(req.userId) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post.author.equals(req.userId)) throw new HttpError(403, 'You can only delete your own posts');

  await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post._id })]);
  // Best effort: remove the post's uploaded files from disk.
  await Promise.all(
    post.media
      .filter((m) => m.kind !== 'youtube')
      .map((m) => fs.unlink(path.join(config.uploadDir, path.basename(m.url))).catch(() => {}))
  );
  res.status(204).end();
});

router.post('/:id/like', requireAuth, async (req, res) => {
  const post = await findPost(req.params.id);
  const liked = post.likes.some((l) => l.equals(req.userId));
  const updated = await Post.findByIdAndUpdate(
    post._id,
    liked
      ? { $pull: { likes: req.userId }, $inc: { likeCount: -1 } }
      : { $addToSet: { likes: req.userId }, $inc: { likeCount: 1 } },
    { new: true }
  );
  res.json({ liked: !liked, likeCount: updated.likes.length });
});

router.get('/:id/comments', async (req, res) => {
  const post = await findPost(req.params.id);
  const comments = await Comment.find({ post: post._id }).sort({ createdAt: 1 }).limit(500).populate('author', AUTHOR_FIELDS);
  res.json({ comments: comments.map((c) => c.toPublic()) });
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const post = await findPost(req.params.id);
  const comment = await Comment.create({ post: post._id, author: req.userId, body: req.body?.body });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  await comment.populate('author', AUTHOR_FIELDS);
  res.status(201).json({ comment: comment.toPublic() });
});

router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!mongoose.isValidObjectId(req.params.commentId)) throw new HttpError(404, 'Comment not found');
  const comment = await Comment.findOne({ _id: req.params.commentId, post: post._id });
  if (!comment) throw new HttpError(404, 'Comment not found');
  // Comment authors and the post's owner can remove a comment.
  if (!comment.author.equals(req.userId) && !post.author.equals(req.userId)) {
    throw new HttpError(403, 'You can only delete your own comments');
  }
  await comment.deleteOne();
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: -1 } });
  res.status(204).end();
});

export default router;
