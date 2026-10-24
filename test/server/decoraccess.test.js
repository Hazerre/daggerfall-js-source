// DECOR-ACCESS: a container and a station open for the owner, and for who the owner named.
// A guest's claim is not a key. Goods move once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { r2, seatRealm, recordOf, layRecord, realmAt } from '../realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
    assert.equal((await call('POST', '/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one', ...ACCEPTED })).status, 200);
    return guest.secret;
  };
  return { env, call, registered };
}
const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const RICH = (name, items = []) => ({ name, level: 9, goldPieces: 10_000_000, items, bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const piece = (extra = {}) => ({ id: 'p1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 180, ...extra });
const RUBY = { uid: '0123456789abcdef', name: 'Ruby', stackCount: 1 };
const home = (character, realm) => ({ ...HOME, region: 17, character, price: 42000, layout: null, realm });

test('DECOR-ACCESS a chest and a station stay the owner\'s until the owner names who else, and a good moves once', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric', [{ ...RUBY }]));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara', [{ ...RUBY, uid: 'fedcba9876543210' }]));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece() }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece({ id: 's1', storage: false, station: 'alchemy', pos: [2, 0, 2] }) }, aldric)).status, 200);
  const forged = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', kind: 'storage', item: { ...RUBY, uid: 'fedcba9876543210' }, friend: true, guild: true }, mara);
  assert.equal(forged.body.error, 'decor-shut');
  assert.equal(recordOf(env, M.id).items.length, 1, 'a refused deposit leaves the good where it was');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  const craft = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 's1' }, mara);
  assert.equal(craft.body.error, 'decor-shut');
  const named = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, aldric);
  assert.deepEqual(named.body.names, ['Mara']);
  assert.equal(named.body.player, undefined, 'the answer carries no account id');
  const station = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 's1', kind: 'station', mode: 'chosen_friends', names: ['Mara'] }, aldric);
  assert.equal(station.status, 200, JSON.stringify(station.body));
  const put = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', item: { ...RUBY, uid: 'fedcba9876543210' } }, mara);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(recordOf(env, M.id).items.length, 0);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1);
  const again = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, realm: realmAt(env, M.id), op: 'deposit', id: 'p1', item: { ...RUBY, uid: 'fedcba9876543210' } }, mara);
  assert.equal(again.body.repeat, true);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1);
  const ownerCraft = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'craft', id: 's1' }, aldric);
  assert.equal(ownerCraft.body.ok, true);
  const friendCraft = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 's1' }, mara);
  assert.equal(friendCraft.body.ok, true);
  const dropped = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: [] }, aldric);
  assert.equal(dropped.status, 200);
  const shut = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'withdraw', id: 'p1', uid: 'fedcba9876543210', realm: realmAt(env, M.id) }, mara);
  assert.equal(shut.body.error, 'decor-shut');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 1, 'a shut withdraw leaves the good in the chest');
  const back = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'withdraw', id: 'p1', uid: 'fedcba9876543210' }, aldric);
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal(recordOf(env, A.id).items.some((it) => it.uid === 'fedcba9876543210'), true);
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM decor_bin').get().n, 0);
  const twice = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, realm: realmAt(env, A.id), op: 'withdraw', id: 'p1', uid: 'fedcba9876543210' }, aldric);
  assert.equal(twice.body.error, 'no-item');
  assert.equal(recordOf(env, A.id).items.filter((it) => it.uid === 'fedcba9876543210').length, 1);
  const copy = await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'open', id: 'p2', kind: 'storage' }, mara);
  assert.equal(copy.body.error, 'decor-shut', 'another piece does not inherit this one\'s names');
});

test('DECOR-ACCESS a guildmate may, and may not after they leave', async () => {
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  const A = await seatRealm(env, aldric, 'Aldric', RICH('Aldric'));
  const M = await seatRealm(env, mara, 'Mara', RICH('Mara'));
  assert.equal((await call('POST', '/v1/homes/claim', home(A.id, A.at()), aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/place', { ...HOME, character: A.id, realm: realmAt(env, A.id), piece: piece({ storage: false, station: 'alchemy' }) }, aldric)).status, 200);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(HOME.mapId).player;
  const mate = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('mara').id;
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 0, \'Aldric\', 1)').run(owner, A.id);
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 1, \'Mara\', 1)').run(mate, M.id);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'set', id: 'p1', kind: 'station', mode: 'guild', names: ['not-a-friend'] }, aldric)).status, 200);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 'p1' }, mara)).body.ok, true);
  env.DB._raw.prepare('DELETE FROM guild_members WHERE player = ?').run(mate);
  assert.equal((await call('POST', '/v1/homes/decor/use', { ...HOME, character: M.id, op: 'craft', id: 'p1' }, mara)).body.error, 'decor-shut');
  const kept = await call('POST', '/v1/homes/decor/use', { ...HOME, character: A.id, op: 'grants' }, aldric);
  assert.ok(kept.body.station.includes('p1'), 'the owner still may');
});
