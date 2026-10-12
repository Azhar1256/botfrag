import mongoose from 'mongoose';

// Metadata for a game, cached from IGDB. Posts reference games by slug;
// a game without a document here simply has no artwork or details.
const gameSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    igdbId: { type: Number, index: true },
    summary: String,
    releaseDate: Date,
    cover: String, // IGDB image id
    screenshots: [String],
    genres: [String],
    platforms: [String],
    igdbRating: Number,
  },
  { timestamps: true }
);

export default mongoose.model('Game', gameSchema);
