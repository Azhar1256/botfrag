// API tests against an in-memory MongoDB. Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
// Keep tests offline even when server/.env has real IGDB keys (dotenv won't override these).
process.env.IGDB_CLIENT_ID = '';
process.env.IGDB_CLIENT_SECRET = '';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'botfrag-uploads-'));
const { default: app } = await import('../src/app.js');

let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

const api = () => request(app);
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const signup = (username) =>
  api().post('/api/auth/signup').send({ username, email: `${username}@example.com`, password: 'password123' });

let ana, ben, postId;

test('sign up returns a session and never the password or email', async () => {
  const res = await signup('ana_frag').expect(201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.username, 'ana_frag');
  assert.equal(res.body.user.passwordHash, undefined);
  assert.equal(res.body.user.email, undefined);
  ana = res.body.token;
  ben = (await signup('ben').expect(201)).body.token;
});

test('sign up rejects duplicates, short passwords and bad usernames', async () => {
  await signup('ana_frag').expect(409);
  await api().post('/api/auth/signup').send({ username: 'carl', email: 'c@example.com', password: 'short' }).expect(400);
  await api().post('/api/auth/signup').send({ username: 'no spaces!', email: 'd@example.com', password: 'password123' }).expect(400);
});

test('login works with username or email and checks the password', async () => {
  await api().post('/api/auth/login').send({ login: 'ana_frag', password: 'nope' }).expect(401);
  await api().post('/api/auth/login').send({ login: 'ANA_frag@example.com', password: 'password123' }).expect(200);
  const me = await api().get('/api/auth/me').set(bearer(ana)).expect(200);
  assert.equal(me.body.user.username, 'ana_frag');
});

test('writes need a valid token', async () => {
  await api().post('/api/posts').send({ type: 'moment', title: 'x', game: 'Valorant' }).expect(401);
  await api().post('/api/posts').set(bearer('forged.token.here')).send({}).expect(401);
});

test('reviews need a rating; moments drop any rating', async () => {
  await api().post('/api/posts').set(bearer(ana)).send({ type: 'review', title: 'Great', game: 'Hades II' }).expect(400);
  const m = await api().post('/api/posts').set(bearer(ana))
    .send({ type: 'moment', title: '1v5 clutch', game: 'Valorant', rating: 9, tags: '#Clutch, ace' }).expect(201);
  assert.equal(m.body.post.rating, null);
  assert.deepEqual(m.body.post.tags, ['clutch', 'ace']);
  assert.equal(m.body.post.game.slug, 'valorant');
  postId = m.body.post.id;
});

test('media must be an upload or a YouTube link', async () => {
  const body = { type: 'moment', title: 'clip', game: 'Valorant' };
  await api().post('/api/posts').set(bearer(ana)).send({ ...body, media: [{ kind: 'image', url: 'https://evil.example/x.png' }] }).expect(400);
  const ok = await api().post('/api/posts').set(bearer(ana))
    .send({ ...body, media: [{ kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' }] }).expect(201);
  assert.deepEqual(ok.body.post.media, [{ kind: 'youtube', url: 'dQw4w9WgXcQ' }]);
});

test('uploads accept images and reject other files', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  const res = await api().post('/api/uploads').set(bearer(ana)).attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
  assert.match(res.body.url, /^\/uploads\/[a-f0-9]{32}\.png$/);
  assert.equal(res.body.kind, 'image');
  await api().get(res.body.url).expect(200);
  await api().post('/api/uploads').set(bearer(ana)).attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
});

test('only the author can edit or delete a post', async () => {
  await api().patch(`/api/posts/${postId}`).set(bearer(ben)).send({ title: 'hacked' }).expect(403);
  await api().delete(`/api/posts/${postId}`).set(bearer(ben)).expect(403);
  const res = await api().patch(`/api/posts/${postId}`).set(bearer(ana)).send({ title: '1v5 clutch on Bind' }).expect(200);
  assert.equal(res.body.post.title, '1v5 clutch on Bind');
});

test('likes toggle and show up for the viewer', async () => {
  let res = await api().post(`/api/posts/${postId}/like`).set(bearer(ben)).expect(200);
  assert.deepEqual(res.body, { liked: true, likeCount: 1 });
  const seen = await api().get(`/api/posts/${postId}`).set(bearer(ben)).expect(200);
  assert.equal(seen.body.post.liked, true);
  res = await api().post(`/api/posts/${postId}/like`).set(bearer(ben)).expect(200);
  assert.deepEqual(res.body, { liked: false, likeCount: 0 });
  await api().post(`/api/posts/${postId}/like`).set(bearer(ben)).expect(200);
});

test('comments: add, count, and delete permissions', async () => {
  const c = await api().post(`/api/posts/${postId}/comments`).set(bearer(ben)).send({ body: 'insane' }).expect(201);
  assert.equal(c.body.comment.author.username, 'ben');
  await api().post(`/api/posts/${postId}/comments`).send({ body: 'anon' }).expect(401);
  const list = await api().get(`/api/posts/${postId}/comments`).expect(200);
  assert.equal(list.body.comments.length, 1);
  assert.equal((await api().get(`/api/posts/${postId}`)).body.post.commentCount, 1);
  // The post owner can moderate comments on their post.
  await api().delete(`/api/posts/${postId}/comments/${c.body.comment.id}`).set(bearer(ana)).expect(204);
  assert.equal((await api().get(`/api/posts/${postId}`)).body.post.commentCount, 0);
});

test('feed filters, search and sorting', async () => {
  await api().post('/api/posts').set(bearer(ben)).send({ type: 'review', title: 'A masterpiece', game: 'Hades II', rating: 9, tags: ['roguelike'] }).expect(201);
  await api().post('/api/posts').set(bearer(ana)).send({ type: 'review', title: 'Good but grindy', game: 'Hades II', rating: 7 }).expect(201);

  const all = await api().get('/api/posts').expect(200);
  assert.equal(all.body.total, 4);
  assert.equal((await api().get('/api/posts?type=review')).body.total, 2);
  assert.equal((await api().get('/api/posts?game=hades-ii')).body.total, 2);
  assert.equal((await api().get('/api/posts?tag=clutch')).body.total, 1);
  assert.equal((await api().get('/api/posts?author=ben')).body.total, 1);
  assert.equal((await api().get('/api/posts?q=bind')).body.total, 1);
  assert.equal((await api().get('/api/posts?q=.*')).body.total, 0, 'search input is not treated as a regex');
  const top = await api().get('/api/posts?sort=top').expect(200);
  assert.equal(top.body.posts[0].id, postId);
});

test('follow toggles and powers the following feed', async () => {
  await api().get('/api/posts?feed=following').expect(401);
  const f = await api().post('/api/users/ana_frag/follow').set(bearer(ben)).expect(200);
  assert.equal(f.body.user.isFollowing, true);
  assert.equal(f.body.user.followerCount, 1);
  const feed = await api().get('/api/posts?feed=following').set(bearer(ben)).expect(200);
  assert.ok(feed.body.posts.length > 0 && feed.body.posts.every((p) => p.author.username === 'ana_frag'));
  await api().post('/api/users/ben/follow').set(bearer(ben)).expect(400);
});

test('profiles show stats and can be edited', async () => {
  const p = await api().get('/api/users/ana_frag').expect(200);
  assert.deepEqual(p.body.stats, { moments: 2, reviews: 1, likesReceived: 1 });
  const e = await api().patch('/api/users/me').set(bearer(ana))
    .send({ displayName: 'Ana', bio: 'Duelist main', platforms: ['PC', 'Nope'], favoriteGames: ['Valorant'] }).expect(200);
  assert.equal(e.body.user.displayName, 'Ana');
  assert.deepEqual(e.body.user.platforms, ['PC']);
  await api().patch('/api/users/me').set(bearer(ana)).send({ avatarUrl: 'javascript:alert(1)' }).expect(400);
  await api().get('/api/users/nobody').expect(404);
});

test('game pages aggregate posts and ratings', async () => {
  const games = await api().get('/api/games').expect(200);
  assert.deepEqual(games.body.games.map((g) => g.slug), ['hades-ii', 'valorant'], 'ties go to the most recently active game');
  const hades = await api().get('/api/games/hades-ii').expect(200);
  assert.equal(hades.body.game.avgRating, 8);
  assert.equal(hades.body.game.reviews, 2);
  assert.equal(hades.body.game.distribution[8], 1);
  await api().get('/api/games/unknown').expect(404);
  const tags = await api().get('/api/tags/trending').expect(200);
  assert.ok(tags.body.tags.some((t) => t.tag === 'clutch'));
});

test('deleting a post removes its comments', async () => {
  await api().post(`/api/posts/${postId}/comments`).set(bearer(ben)).send({ body: 'gg' }).expect(201);
  await api().delete(`/api/posts/${postId}`).set(bearer(ana)).expect(204);
  await api().get(`/api/posts/${postId}`).expect(404);
  await api().get(`/api/posts/${postId}/comments`).expect(404);
  assert.equal(await mongoose.model('Comment').countDocuments({ post: postId }), 0);
});

test('IGDB: picking a game links its metadata, typed names match it, and outages fall back', async () => {
  const { setIgdb } = await import('../src/lib/games.js');
  const witcher = {
    igdbId: 1942, name: 'The Witcher 3: Wild Hunt', slug: 'the-witcher-3-wild-hunt', summary: 'Geralt.',
    releaseDate: new Date('2015-05-19'), cover: 'co1wyy', screenshots: [], genres: ['RPG'], platforms: ['PC'], igdbRating: 93,
  };
  let up = true;
  const calls = [];
  setIgdb({
    enabled: true,
    search: async (q) => { calls.push(['search', q]); if (!up) throw new Error('down'); return [witcher]; },
    byId: async (id) => { calls.push(['byId', id]); return id === 1942 ? witcher : null; },
    match: async (name) => { if (!up) throw new Error('down'); return name.toLowerCase() === 'the witcher 3: wild hunt' ? witcher : null; },
  });

  try {
    const picked = await api().post('/api/posts').set(bearer(ana))
      .send({ type: 'review', title: 'Still the best', game: { name: 'witcher', igdbId: 1942 }, rating: 10 }).expect(201);
    assert.deepEqual(picked.body.post.game, { name: 'The Witcher 3: Wild Hunt', slug: 'the-witcher-3-wild-hunt' });

    // A differently-cased typed name lands on the same game page without another IGDB lookup by id.
    const typed = await api().post('/api/posts').set(bearer(ben))
      .send({ type: 'moment', title: 'Gwent win', game: 'THE WITCHER 3: wild hunt' }).expect(201);
    assert.equal(typed.body.post.game.slug, 'the-witcher-3-wild-hunt');
    assert.equal(calls.filter(([c]) => c === 'byId').length, 1);

    const page = await api().get('/api/games/the-witcher-3-wild-hunt').expect(200);
    assert.equal(page.body.game.meta.igdbRating, 93);
    assert.deepEqual(page.body.game.meta.genres, ['RPG']);
    assert.match(page.body.game.cover, /images\.igdb\.com.*co1wyy\.jpg$/);

    const search = await api().get('/api/games/search?q=witch').expect(200);
    assert.equal(search.body.results[0].slug, 'the-witcher-3-wild-hunt', 'games already on Botfrag come first');
    assert.equal(search.body.results[0].posts, 2);
    assert.equal(search.body.results.length, 1, 'IGDB duplicates of local games are dropped');

    up = false;
    const offline = await api().post('/api/posts').set(bearer(ben))
      .send({ type: 'moment', title: 'Offline post', game: 'Some Indie Game' }).expect(201);
    assert.equal(offline.body.post.game.slug, 'some-indie-game');
  } finally {
    setIgdb({ enabled: false, search: async () => [], byId: async () => null, match: async () => null });
  }
});

test('unknown API routes return JSON 404', async () => {
  const res = await api().get('/api/nope').expect(404);
  assert.equal(res.body.message, 'Not found');
});
