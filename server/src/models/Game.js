import mongoose from 'mongoose';

// Metadata for a game, cached from IGDB and/or Giant Bomb. Posts reference games by slug;
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
    // Giant Bomb: a fallback when IGDB has no match, and a link on the game page.
    gbGuid: String,
    gbUrl: String,
    deck: String,
    imageUrl: String, // absolute URL, used when there's no IGDB cover
    gbCheckedAt: Date, // last Giant Bomb lookup, so misses aren't retried on every page view
  },
  { timestamps: true }
);

export default mongoose.model('Game', gameSchema);
