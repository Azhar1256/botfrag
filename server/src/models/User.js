import mongoose from 'mongoose';

export const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Other'];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Pick a username'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]{3,20}$/, 'Username must be 3–20 letters, numbers or underscores'],
    },
    displayName: { type: String, trim: true, maxlength: 40 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email'],
    },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, maxlength: 280, default: '' },
    platforms: [{ type: String, enum: PLATFORMS }],
    favoriteGames: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      validate: [(v) => v.length <= 8, 'Up to 8 favourite games'],
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// The shape every API response uses for a user. Never includes email or password.
userSchema.methods.toPublic = function toPublic(viewerId) {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName || this.username,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    platforms: this.platforms,
    favoriteGames: this.favoriteGames,
    followerCount: this.followers.length,
    followingCount: this.following.length,
    isFollowing: viewerId ? this.followers.some((f) => f.equals(viewerId)) : false,
    joinedAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
