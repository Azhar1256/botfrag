// Fills the database with demo players, moments, reviews, likes and comments.
// Usage: npm run seed   (wipes existing users, posts and comments first)
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import config from './config.js';
import User from './models/User.js';
import Post from './models/Post.js';
import Comment from './models/Comment.js';
import Game from './models/Game.js';
import { igdbEnabled, resolveGame } from './lib/games.js';

if (config.isProd) {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const players = [
  { username: 'nightowl', displayName: 'NightOwl', bio: 'Duelist main. Clips at 3am.', platforms: ['PC'], favoriteGames: ['Valorant', 'Counter-Strike 2'] },
  { username: 'pixelpaladin', displayName: 'Pixel Paladin', bio: 'RPG completionist and long-review writer.', platforms: ['PlayStation', 'PC'], favoriteGames: ['Elden Ring', "Baldur's Gate 3"] },
  { username: 'rocketqueen', displayName: 'RocketQueen', bio: 'Diamond in Rocket League, bronze at life.', platforms: ['Xbox', 'PC'], favoriteGames: ['Rocket League', 'Apex Legends'] },
  { username: 'cozycrit', displayName: 'Cozy Crit', bio: 'Indies, roguelikes and anything with a cat.', platforms: ['Switch', 'PC'], favoriteGames: ['Hades II', 'Stardew Valley'] },
  { username: 'fragmachine', displayName: 'FragMachine', bio: 'FPS only. Aim trainer enjoyer.', platforms: ['PC'], favoriteGames: ['Counter-Strike 2', 'Apex Legends'] },
];

const posts = [
  ['nightowl', 'moment', 'Valorant', 'PC', '1v4 clutch on Ascent with 12 HP', 'Jett dash into a triple, then the last guy whiffed his Op shot. Hands were shaking.', ['clutch', 'jett']],
  ['nightowl', 'review', 'Valorant', 'PC', 'Five years in, still my main game', 'The gunplay is still the sharpest of any tactical shooter. Matchmaking in high Plat can be rough and the agent pool is getting crowded, but nothing scratches the itch the same way.', ['tactical', 'competitive'], 8],
  ['pixelpaladin', 'review', 'Elden Ring', 'PlayStation', 'The open world every other game is chasing', "Every ridge hides something. The bosses are brutal but fair, and the moment you walk out into Limgrave for the first time stays with you. The only real flaw is a late game that leans hard on reused bosses.", ['soulslike', 'open-world'], 10],
  ['pixelpaladin', 'moment', 'Elden Ring', 'PlayStation', 'Finally beat Malenia after 87 tries', 'No summons, no Mimic. Waterfowl Dance stopped scaring me somewhere around try 60.', ['boss', 'no-summons']],
  ['pixelpaladin', 'review', "Baldur's Gate 3", 'PC', 'A tabletop campaign that actually reacts to you', 'I have never seen a game account for this many player choices. Act 3 performance is still shaky on older PCs, but the writing and companions make up for all of it.', ['rpg', 'story'], 9],
  ['rocketqueen', 'moment', 'Rocket League', 'Xbox', 'Ceiling shot double tap in overtime', 'Ranked 2s, overtime, my teammate had already typed "gg". Not anymore.', ['aerial', 'overtime']],
  ['rocketqueen', 'review', 'Apex Legends', 'PC', 'Best movement in any battle royale, weakest onboarding', 'Once it clicks, the movement and gunfeel are unmatched. New players get thrown into lobbies with predators, though, and the store is aggressive.', ['battle-royale'], 7],
  ['rocketqueen', 'moment', 'Apex Legends', 'PC', 'Third-partied the third party', 'Two squads fighting in Fragment, we rolled in on Wraith portal and took the whole thing.', ['squad', 'wraith']],
  ['cozycrit', 'review', 'Hades II', 'PC', 'Somehow even better than the first', "Melinoë's magick system adds a whole layer the first game didn't have. Supergiant's art and music remain absurdly good. Runs feel distinct every time.", ['roguelike', 'indie'], 9],
  ['cozycrit', 'moment', 'Hades II', 'Switch', 'Cleared the Surface with a fear-10 run', 'Hestia + Apollo omega casts is broken and I will not be taking questions.', ['roguelike', 'build']],
  ['cozycrit', 'review', 'Stardew Valley', 'Switch', 'The comfort game that never gets old', 'Came back for the 1.6 update and lost another 60 hours. Multiplayer with friends is the best way to play.', ['cozy', 'farming'], 9],
  ['fragmachine', 'moment', 'Counter-Strike 2', 'PC', 'Deagle 4k through smoke on Mirage', 'Heard the footsteps, pre-fired the window, the rest is history.', ['deagle', 'ace']],
  ['fragmachine', 'review', 'Counter-Strike 2', 'PC', 'Great core, still missing polish', 'Sub-tick feels better than at launch and the smokes are a real upgrade. Cheaters in lower trust factor and fewer maps than CS:GO hold it back.', ['tactical', 'fps'], 7],
  ['fragmachine', 'moment', 'Valorant', 'PC', 'Operator flick across Haven garage', 'Peeked, flicked, dropped. My aim trainer hours finally paid off.', ['operator', 'flick']],
  ['nightowl', 'moment', 'Counter-Strike 2', 'PC', 'Ninja defuse with 0.2 seconds left', 'The whole enemy team was celebrating on A site. Oops.', ['ninja', 'defuse']],
];

const comments = [
  'That is filthy 🔥', 'No way that was real', 'Clip of the week', 'Teach me your ways', 'Agree with every word of this',
  'Hard disagree on the score but fair points', 'The timing on that was perfect', 'GG', 'Saving this one',
];

await mongoose.connect(config.mongoUrl);
await Promise.all([User.deleteMany({}), Post.deleteMany({}), Comment.deleteMany({}), Game.deleteMany({})]);

// With IGDB keys set, each game is matched to IGDB for cover art and details.
const games = {};
for (const name of new Set(posts.map((p) => p[2]))) games[name] = await resolveGame(name);

const passwordHash = await bcrypt.hash('password123', 12);
const users = await User.insertMany(players.map((p) => ({ ...p, email: `${p.username}@example.com`, passwordHash })));
const byName = Object.fromEntries(users.map((u) => [u.username, u]));

// Everyone follows a couple of other players.
for (const [i, u] of users.entries()) {
  const targets = [users[(i + 1) % users.length], users[(i + 2) % users.length]];
  u.following = targets.map((t) => t._id);
  targets.forEach((t) => t.followers.push(u._id));
}
await Promise.all(users.map((u) => u.save()));

const now = Date.now();
for (const [i, [author, type, game, platform, title, body, tags, rating]] of posts.entries()) {
  const createdAt = new Date(now - (posts.length - i) * 5.5 * 3600e3);
  const likers = users.filter((_, j) => (i * 7 + j * 3) % 5 < 3 && users[j].username !== author);
  const post = await Post.create({
    author: byName[author]._id, type, title, body, platform, tags, rating,
    game: games[game],
    likes: likers.map((u) => u._id),
    createdAt, updatedAt: createdAt,
  });

  const n = i % 3;
  for (let k = 0; k < n; k++) {
    const commenter = users[(i + k + 1) % users.length];
    await Comment.create({ post: post._id, author: commenter._id, body: comments[(i + k) % comments.length] });
  }
  post.commentCount = n;
  await post.save({ timestamps: false });
}

console.log(`IGDB: ${igdbEnabled() ? `linked ${await Game.countDocuments()} of ${Object.keys(games).length} games` : 'not configured, games have no artwork'}`);
console.log(`Seeded ${users.length} players and ${posts.length} posts. Sign in as any of them with password "password123", e.g. nightowl.`);
await mongoose.disconnect();
