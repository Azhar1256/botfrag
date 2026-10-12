import { Router } from 'express';
import User, { PLATFORMS } from '../models/User.js';
import Post from '../models/Post.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../lib/http.js';

const router = Router();

const isSafeAvatar = (url) => url === '' || /^\/uploads\/[a-f0-9]{32}\.(jpg|png|gif|webp)$/.test(url) || /^https:\/\/\S+$/.test(url);

router.get('/:username', optionalAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw new HttpError(404, 'Player not found');

  const [stats] = await Post.aggregate([
    { $match: { author: user._id } },
    {
      $group: {
        _id: null,
        moments: { $sum: { $cond: [{ $eq: ['$type', 'moment'] }, 1, 0] } },
        reviews: { $sum: { $cond: [{ $eq: ['$type', 'review'] }, 1, 0] } },
        likesReceived: { $sum: '$likeCount' },
      },
    },
  ]);

  res.json({
    user: user.toPublic(req.userId),
    stats: { moments: stats?.moments ?? 0, reviews: stats?.reviews ?? 0, likesReceived: stats?.likesReceived ?? 0 },
  });
});

router.patch('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');

  const { displayName, bio, avatarUrl, platforms, favoriteGames } = req.body ?? {};
  if (displayName !== undefined) user.displayName = String(displayName).trim() || user.username;
  if (bio !== undefined) user.bio = String(bio);
  if (avatarUrl !== undefined) {
    if (!isSafeAvatar(String(avatarUrl))) throw new HttpError(400, 'Avatar must be an uploaded image or an https link');
    user.avatarUrl = String(avatarUrl);
  }
  if (Array.isArray(platforms)) user.platforms = [...new Set(platforms.filter((p) => PLATFORMS.includes(p)))];
  if (Array.isArray(favoriteGames)) {
    user.favoriteGames = [...new Set(favoriteGames.map((g) => String(g).trim()).filter(Boolean))];
  }

  await user.save();
  res.json({ user: user.toPublic(req.userId) });
});

// Toggles following. Returns the target's updated public profile.
router.post('/:username/follow', requireAuth, async (req, res) => {
  const target = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!target) throw new HttpError(404, 'Player not found');
  if (target._id.equals(req.userId)) throw new HttpError(400, "You can't follow yourself");

  const following = target.followers.some((f) => f.equals(req.userId));
  const op = following ? '$pull' : '$addToSet';
  await User.updateOne({ _id: req.userId }, { [op]: { following: target._id } });
  const updated = await User.findByIdAndUpdate(target._id, { [op]: { followers: req.userId } }, { new: true });

  res.json({ user: updated.toPublic(req.userId) });
});

export default router;
