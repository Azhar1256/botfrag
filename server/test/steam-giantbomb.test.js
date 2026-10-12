// Unit tests for the Steam and Giant Bomb clients, with the network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSteam, loginUrl, verifyLogin } from '../src/lib/steam.js';
import { createGiantBomb } from '../src/lib/giantbomb.js';

const res = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => String(body) });

const RETURN_TO = 'http://localhost:5173/api/auth/steam/callback?state=abc';
const ID = '76561197960287930';
const assertion = (over = {}) => ({
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.mode': 'id_res',
  'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
  'openid.claimed_id': `https://steamcommunity.com/openid/id/${ID}`,
  'openid.identity': `https://steamcommunity.com/openid/id/${ID}`,
  'openid.return_to': RETURN_TO,
  'openid.sig': 'sig',
  state: 'abc',
  ...over,
});

test('steam login URL asks Steam to pick the identity and return here', () => {
  const url = new URL(loginUrl(RETURN_TO, 'http://localhost:5173'));
  assert.equal(url.searchParams.get('openid.mode'), 'checkid_setup');
  assert.equal(url.searchParams.get('openid.return_to'), RETURN_TO);
  assert.equal(url.searchParams.get('openid.realm'), 'http://localhost:5173');
  assert.match(url.searchParams.get('openid.identity'), /identifier_select$/);
});

test('steam OpenID: Steam must confirm, and only openid.* fields are sent back', async () => {
  let sent;
  const fetch = async (_url, init) => {
    sent = new URLSearchParams(String(init.body));
    return res('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n');
  };
  assert.equal(await verifyLogin(assertion(), RETURN_TO, fetch), ID);
  assert.equal(sent.get('openid.mode'), 'check_authentication');
  assert.equal(sent.get('state'), null);

  const invalid = async () => res('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n');
  assert.equal(await verifyLogin(assertion(), RETURN_TO, invalid), null);
});

test('steam OpenID: rejects responses that are wrong before asking Steam', async () => {
  let asked = 0;
  const fetch = async () => {
    asked += 1;
    return res('is_valid:true');
  };
  const bad = [
    { 'openid.return_to': 'https://evil.example/cb' },
    { 'openid.op_endpoint': 'https://evil.example/openid' },
    { 'openid.claimed_id': 'https://evil.example/openid/id/76561197960287930' },
    { 'openid.identity': 'https://steamcommunity.com/openid/id/76561197960287931' },
    { 'openid.mode': 'cancel' },
  ];
  for (const over of bad) assert.equal(await verifyLogin(assertion(over), RETURN_TO, fetch), null, JSON.stringify(over));
  assert.equal(asked, 0);
});

test('steam web API: profile and playtime by game title', async () => {
  const urls = [];
  const fetch = async (url) => {
    urls.push(new URL(url));
    if (url.includes('GetPlayerSummaries')) {
      return res({ response: { players: [{ personaname: 'Gabe', avatarfull: 'https://a/full.jpg', profileurl: 'https://steamcommunity.com/id/gabe/' }] } });
    }
    return res({ response: { games: [{ appid: 1086940, name: "Baldur's Gate 3", playtime_forever: 7260 }, { appid: 730, name: 'Counter-Strike 2', playtime_forever: 0 }] } });
  };
  const steam = createSteam({ apiKey: 'k', fetch });
  assert.deepEqual(await steam.player(ID), { name: 'Gabe', avatarUrl: 'https://a/full.jpg', profileUrl: 'https://steamcommunity.com/id/gabe/' });
  assert.equal(urls[0].searchParams.get('steamids'), ID);
  assert.equal(urls[0].searchParams.get('key'), 'k');

  assert.deepEqual(await steam.playtime(ID, "Baldur's Gate III"), { appid: 1086940, minutes: 7260 }, 'IGDB-style title still matches');
  assert.deepEqual(await steam.playtime(ID, 'counter-strike 2'), { appid: 730, minutes: 0 });
  assert.equal(await steam.playtime(ID, 'Elden Ring'), null);
  assert.equal(urls.filter((u) => u.pathname.includes('GetOwnedGames')).length, 1, 'owned games are cached');
});

test('steam web API: private profiles and missing keys give nothing', async () => {
  const steam = createSteam({ apiKey: 'k', fetch: async () => res({ response: {} }) });
  assert.deepEqual(await steam.ownedGames(ID), []);
  const off = createSteam({ apiKey: '', fetch: async () => assert.fail('no requests without a key') });
  assert.equal(off.enabled, false);
  assert.equal(await off.player(ID), null);
  assert.equal(await off.playtime(ID, 'x'), null);
});

test('giant bomb: search sends a User-Agent and maps results', async () => {
  let call;
  const fetch = async (url, init) => {
    call = { url: new URL(url), init };
    return res({
      status_code: 1,
      results: [{
        guid: '3030-36765', name: 'Hades', deck: 'A god-like rogue-like.', site_detail_url: 'https://www.giantbomb.com/hades/3030-36765/',
        image: { super_url: 'https://www.giantbomb.com/a/super.jpg' }, original_release_date: '2020-09-17', platforms: [{ abbreviation: 'PC' }, { name: 'Nintendo Switch' }],
      }],
    });
  };
  const gb = createGiantBomb({ apiKey: 'k', fetch });
  const [hades] = await gb.search('hades');
  assert.equal(call.url.pathname, '/api/search/');
  assert.equal(call.url.searchParams.get('resources'), 'game');
  assert.match(call.init.headers['User-Agent'], /Botfrag/);
  assert.deepEqual(hades, {
    gbGuid: '3030-36765', gbUrl: 'https://www.giantbomb.com/hades/3030-36765/', name: 'Hades', deck: 'A god-like rogue-like.',
    imageUrl: 'https://www.giantbomb.com/a/super.jpg', releaseDate: new Date('2020-09-17T00:00:00Z'), platforms: ['PC', 'Nintendo Switch'],
  });
  assert.equal((await gb.match('HADES')).gbGuid, '3030-36765');
  assert.equal(await gb.match('Hades II'), null);
});

test('giant bomb: API errors surface instead of returning junk', async () => {
  const gb = createGiantBomb({ apiKey: 'bad', fetch: async () => res({ status_code: 100, error: 'Invalid API Key' }) });
  await assert.rejects(gb.search('x'), /Invalid API Key/);
  const off = createGiantBomb({ apiKey: '', fetch: async () => assert.fail('no requests without a key') });
  assert.deepEqual(await off.search('x'), []);
});
