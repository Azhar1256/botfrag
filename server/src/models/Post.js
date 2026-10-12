import mongoose from 'mongoose';
import { PLATFORMS } from './User.js';

const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['image', 'video', 'youtube'], required: true },
    url: { type: String, required: true }, // /uploads/... for files, the video id for youtube
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['moment', 'review'], required: true },
    title: { type: String, required: [true, 'Give your post a title'], trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 5000, default: '' },
    game: {
      name: { type: String, required: [true, 'Which game is this about?'], trim: true, maxlength: 80 },
      slug: { type: String, required: true, index: true },
    },
    platform: { type: String, enum: [...PLATFORMS, ''], default: '' },
    tags: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 30 }],
      validate: [(v) => v.length <= 10, 'Up to 10 tags'],
    },
    media: { type: [mediaSchema], validate: [(v) => v.length <= 6, 'Up to 6 media items'] },
    rating: {
      type: Number,
      min: 1,
      max: 10,
      required: [function needsRating() { return this.type === 'review'; }, 'Reviews need a score from 1 to 10'],
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ likeCount: -1, createdAt: -1 });
postSchema.index({ tags: 1 });

postSchema.pre('validate', function normalise() {
  if (this.type !== 'review') this.rating = undefined;
  this.likeCount = this.likes.length;
});

// Expects `author` to be populated.
postSchema.methods.toPublic = function toPublic(viewerId) {
  const a = this.author;
  return {
    id: this._id,
    type: this.type,
    title: this.title,
    body: this.body,
    game: { name: this.game.name, slug: this.game.slug },
    platform: this.platform,
    tags: this.tags,
    media: this.media,
    rating: this.rating ?? null,
    likeCount: this.likes.length,
    liked: viewerId ? this.likes.some((l) => l.equals(viewerId)) : false,
    commentCount: this.commentCount,
    author: a?.username
      ? { id: a._id, username: a.username, displayName: a.displayName || a.username, avatarUrl: a.avatarUrl }
      : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Post', postSchema);
