// Unit tests for the IGDB client, with Twitch and IGDB faked at the fetch level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIgdb, coverUrl, normalizeTitle } from '../src/lib/igdb.js';

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

function fakeFetch(handlers) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: String(init.body), auth: init.headers.Authorization });
    return handlers(url, String(init.body), calls.length);
  };
  return { fetch, calls };
}

const eldenRow = {
  id: 119133, name: 'Elden Ring', slug: 'elden-ring', first_release_date: 1645747200,
  cover: { image_id: 'co4jni' }, genres: [{ name: 'Role-playing (RPG)' }], platforms: [{ abbreviation: 'PC' }, { name: 'Xbox Series X|S' }],
  total_rating: 95.4, total_rating_count: 300,
};

test('is disabled without credentials and makes no requests', async () => {
  const { fetch, calls } = fakeFetch(() => json(200, []));
  const igdb = createIgdb({ clientId: '', clientSecret: '', fetch });
  assert.equal(igdb.enabled, false);
  assert.deepEqual(await igdb.search('elden'), []);
  assert.equal(calls.length, 0);
});

test('fetches one token, reuses it, and flattens results', async () => {
  const { fetch, calls } = fakeFetch((url) => (url.includes('oauth2') ? json(200, { access_token: 'tok', expires_in: 3600 }) : json(200, [eldenRow])));
  const igdb = createIgdb({ clientId: 'id', clientSecret: 'secret', fetch });
  const [g] = await igdb.search('elden "ring"');
  await igdb.search('another');
  assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 1);
  assert.ok(calls[1].body.startsWith('search "elden  ring"'), 'quotes in the search term are stripped');
  assert.match(calls[1].body, /game_type = \(0,4,8,9,10\)/);
  assert.equal(calls[1].auth, 'Bearer tok');
  assert.deepEqual(g, {
    igdbId: 119133, name: 'Elden Ring', slug: 'elden-ring', summary: '', releaseDate: new Date('2022-02-25T00:00:00Z'),
    cover: 'co4jni', screenshots: [], genres: ['Role-playing (RPG)'], platforms: ['PC', 'Xbox Series X|S'], igdbRating: 95,
  });
});

test('caches identical queries', async () => {
  const { fetch, calls } = fakeFetch((url) => (url.includes('oauth2') ? json(200, { access_token: 't', expires_in: 3600 }) : json(200, [eldenRow])));
  const igdb = createIgdb({ clientId: 'id', clientSecret: 's', fetch });
  await igdb.byId(119133);
  await igdb.byId(119133);
  assert.equal(calls.filter((c) => c.url.includes('igdb.com')).length, 1);
});

test('refreshes the token once on a 401', async () => {
  let tokens = 0;
  const { fetch } = fakeFetch((url, _body) => {
    if (url.includes('oauth2')) return json(200, { access_token: `t${++tokens}`, expires_in: 3600 });
    return tokens === 1 ? json(401, {}) : json(200, [eldenRow]);
  });
  const igdb = createIgdb({ clientId: 'id', clientSecret: 's', fetch });
  assert.equal((await igdb.byId(1)).name, 'Elden Ring');
  assert.equal(tokens, 2);
});

test('match only accepts an exact title', async () => {
  const { fetch } = fakeFetch((url) => (url.includes('oauth2') ? json(200, { access_token: 't', expires_in: 3600 }) : json(200, [eldenRow])));
  const igdb = createIgdb({ clientId: 'id', clientSecret: 's', fetch });
  assert.equal((await igdb.match('ELDEN RING')).slug, 'elden-ring');
  assert.equal(await igdb.match('elden'), null);
});

test('builds image URLs', () => {
  assert.equal(coverUrl('abc'), 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg');
  assert.equal(coverUrl(''), '');
});

test('title normalisation ignores case, punctuation and Roman numerals', () => {
  assert.equal(normalizeTitle("Baldur's Gate III"), normalizeTitle('baldurs gate 3'));
  assert.equal(normalizeTitle('Counter-Strike 2'), 'counter strike 2');
  assert.notEqual(normalizeTitle('Elden'), normalizeTitle('Elden Ring'));
  assert.equal(normalizeTitle('Civilization VI'), 'civilization 6');
});

test('search ranks rated games above unrated stubs, otherwise keeping IGDB order', async () => {
  const rows = [
    { id: 1, name: 'Stub', slug: 'stub' },
    { id: 2, name: 'Real', slug: 'real', total_rating: 90, total_rating_count: 50 },
    { id: 3, name: 'Other stub', slug: 'other-stub' },
  ];
  const { fetch } = fakeFetch((url) => (url.includes('oauth2') ? json(200, { access_token: 't', expires_in: 3600 }) : json(200, rows)));
  const igdb = createIgdb({ clientId: 'id', clientSecret: 's', fetch });
  assert.deepEqual((await igdb.search('x')).map((g) => g.name), ['Real', 'Stub', 'Other stub']);
});
