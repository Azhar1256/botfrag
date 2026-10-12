import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: [true, 'Comment cannot be empty'], trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// Expects `author` to be populated.
commentSchema.methods.toPublic = function toPublic() {
  const a = this.author;
  return {
    id: this._id,
    post: this.post,
    body: this.body,
    author: { id: a._id, username: a.username, displayName: a.displayName || a.username, avatarUrl: a.avatarUrl },
    createdAt: this.createdAt,
  };
};

export default mongoose.model('Comment', commentSchema);
