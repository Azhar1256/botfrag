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
    // Optional for accounts created through Discord/Twitch that didn't share an email.
    email: {
      type: String,
      required: [function needsEmail() { return !this.hasConnection(); }, 'Email is required'],
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email'],
    },
    // Absent for accounts that only sign in with Discord or Twitch.
    passwordHash: { type: String, select: false },
    connections: {
      discord: { id: String, username: String },
      twitch: { id: String, username: String },
    },
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

userSchema.index({ 'connections.discord.id': 1 }, { unique: true, sparse: true });
userSchema.index({ 'connections.twitch.id': 1 }, { unique: true, sparse: true });

userSchema.methods.hasConnection = function hasConnection() {
  return Boolean(this.connections?.discord?.id || this.connections?.twitch?.id);
};

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
    connections: {
      discord: this.connections?.discord?.username ?? null,
      twitch: this.connections?.twitch?.username ?? null,
    },
    joinedAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
