// STAFF-PANEL5-HIDDEN (2026-10-22, mob: "no tag no faint outline nothing just nothing", "true invis not lattys invis", "we
// want the player to have no idea we are wathcing them"; design doc "DFO Staff Panel: design", Invisible follow and Flat
// map's Hide me) - THE ACCOUNT SERVICE'S HALF (server-account/src/staffHidden.js), driven through the real Worker on the
// node:sqlite database every account pin stands on (test/accountDb.mjs): Hide me on by default and Show myself; the game's
// own token mint, for an Admin or a Moderator holding a live staff session while hidden, minting the spectator's token
// (`hd: 1`, a subject of the session's, no name of the account's) with an audit row each; a hide order pushed to the
// relay's door when the mark lapses; and the relay's signed note of a private home entered. tools/mutants/staff-panel5-hidden.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { HIDDEN_ROUTES, HIDDEN_NAME, HIDDEN_GLYPHS, hiddenSubOf } from '../../server-account/src/staffHidden.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { verifyToken, verifyOrder, mintToken, mintHideOrder, mintOrder, claimsValid, orderValid, ORDER_KINDS } from '../../src/net/identityToken.js';
import { sealHiddenSeen, hiddenSeenValid, openHiddenSeen, HIDDEN_SEEN_PATH, HIDDEN_SEEN_SIG_HEADER, HIDDEN_SEEN_V, HIDDEN_SEEN_AGE_MAX_MS, HIDDEN_SEEN_MAX_BYTES } from '../../src/net/hiddenSeen.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const claimsOf = (tok) => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up (test/server/staffpanel2.test.js's own), the relay's door recorded: mob (an Admin and
 *  owner) signed in, Asynian and Tabbyvish (Moderators) invited and signed in, and Troll and Sylvia, two players. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY,
  });
  const pushed = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url) === RELAY) { pushed.push(JSON.parse(init.body).order); return Response.json({ ok: true }); } return real(url, init); };
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const game = {};
  for (const h of ['SirMcMobdon', 'Asynian', 'Tabbyvish', 'Troll', 'Sylvia']) game[h] = await s.registered(h);
  const raw = s.env.DB._raw;
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const enrol = async (handle) => {
    const inv = await staff('/v1/staff/invite', { handle }, mob.session);
    const key = await extensionKey();
    const r = await staff('/v1/staff/enroll', { handle, password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', handle)) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const asy = await enrol('Asynian');
  const tab = await enrol('Tabbyvish');
  /** The game's own mint, for `h`'s game session. */
  const mint = async (h) => (await s.call('/v1/auth/token', {}, game[h].secret));
  /** The hidden subjects `h`'s staff sessions mint - every one, newest first. */
  const subsOf = async (h) => Promise.all(raw.prepare('SELECT token_hash FROM staff_sessions WHERE player_id = ? ORDER BY created_at DESC').all(game[h].id).map((r) => hiddenSubOf(r.token_hash, subtle)));
  const audits = (act) => raw.prepare('SELECT * FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  return { ...s, raw, staff, mob, mobKey, asy, tab, game, mint, subsOf, audits, enrol, pushed, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL5-HIDDEN: the door is listed among the staff panel\'s and opens for no game session; the claim and the order are the token module\'s own law (mutants: the route unlisted; `hd` any value; a hide order with more; `hd` on another order)', async () => {
  assert.deepEqual([...HIDDEN_ROUTES], ['/v1/staff/hide']);
  for (const r of HIDDEN_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  assert.equal(HIDDEN_NAME, 'Staff member');
  assert.deepEqual([...HIDDEN_GLYPHS], ['dev', 'mod', 'dm', 'shadowfang']);
  assert.ok(ORDER_KINDS.includes('hide'));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const t = nowS();
  const base = { s: 'gH0st5ubAAAAAAAAAAAAAAAA', n: 'Staff member', k: 'linked', i: t, e: t + 60 };
  assert.equal(claimsValid({ ...base, hd: 1 }), true, 'the mark');
  for (const hd of [0, 2, true, '1', null]) assert.equal(claimsValid({ ...base, hd }), false, `hd ${JSON.stringify(hd)}`);
  const tok = await mintToken({ s: base.s, n: base.n, k: 'linked', hd: 1 }, kp.privateKey, { subtle, nowS: t });
  assert.equal((await verifyToken(tok, kp.publicKey, { subtle, nowS: t })).claims.hd, 1, 'minted and verified with it');
  assert.equal(claimsOf(await mintToken({ s: base.s, n: base.n, k: 'linked' }, kp.privateKey, { subtle, nowS: t })).hd, undefined, 'and without it, none');
  const order = await mintHideOrder({ s: base.s }, kp.privateKey, { subtle, nowS: t });
  assert.deepEqual(claimsOf(order), { o: 'hide', s: base.s, hd: 0, i: t, e: t + 60 }, 'the hide order\'s exact shape');
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: t, kind: 'hide' })).ok, true);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: t, kind: 'mute' })).ok, false, 'never another kind');
  assert.equal(orderValid({ o: 'hide', s: base.s, hd: 0, i: t, e: t + 60, mu: 5 }), false, 'nothing more on it');
  assert.equal(orderValid({ o: 'hide', s: base.s, hd: 1, i: t, e: t + 60 }), false, 'its hd is 0');
  assert.equal(orderValid({ o: 'hide', s: base.s, i: t, e: t + 60 }), false, 'and said');
  assert.equal(orderValid({ o: 'mute', s: base.s, mu: t + 5, hd: 0, i: t, e: t + 60 }), false, 'no other order wears it');
  assert.equal(orderValid(claimsOf(await mintOrder({ s: base.s, mu: t + 5 }, kp.privateKey, { subtle, nowS: t }))), true, 'a mute is as it was');
  const s = await stand();
  try {
    assert.deepEqual([(await s.staff('/v1/staff/hide', {})).status, (await s.staff('/v1/staff/hide', {})).body], [401, { error: 'staff-session' }]);
    assert.equal((await s.staff('/v1/staff/hide', { on: false }, s.game.Troll.secret)).status, 401, 'a game secret is no staff session');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: HIDE ME, ON BY DEFAULT - an Admin\'s and a Moderator\'s game mint while their staff session is live is the spectator\'s token: `hd`, the session\'s own subject (never the account\'s), "Staff member", the staff glyphs alone, every mint a `hidden-token` row written before it (mutants: the switch unread; the session unread; the account\'s subject; the account\'s name; a cosmetic glyph; the row after the token or never)', async () => {
  const s = await stand();
  try {
    for (const [h, session] of [['SirMcMobdon', s.mob.session], ['Asynian', s.asy.session]]) {
      assert.deepEqual((await s.staff('/v1/staff/hide', {}, session)).body, { hidden: true }, `${h}: Hide me, on by default`);
      const r = await s.mint(h);
      assert.equal(r.status, 200);
      const [sub] = await s.subsOf(h);
      const c = (await verifyToken(r.body.token, s.identityPublic, { subtle, nowS: nowS() })).claims;
      assert.equal(c.hd, 1, `${h}: the spectator's mark`);
      assert.equal(c.s, sub, 'its subject the staff session\'s');
      assert.notEqual(c.s, s.game[h].id, 'never the account\'s');
      assert.equal(c.n, HIDDEN_NAME, 'and never its name');
      assert.equal(c.t, undefined, 'no title');
      for (const g of c.g ?? []) assert.ok(HIDDEN_GLYPHS.includes(g), `a staff glyph alone (${g})`);
      assert.equal(r.body.hidden, 1); assert.equal(r.body.sub, sub); assert.equal(r.body.name, HIDDEN_NAME);
      assert.equal(r.body.accountName, h, 'the staff member\'s own page still knows who it is');
      for (const k of ['title', 'guild', 'aura', 'icon', 'ribbon', 'house', 'level', 'xp']) assert.equal(r.body[k], null, k);
      const again = await s.mint(h);
      assert.equal(claimsOf(again.body.token).s, sub, 'the same subject for every socket of one session');
    }
    const rows = s.audits('hidden-token');
    assert.equal(rows.length, 4, 'every hidden token minted is a row');
    const mobSub = (await s.subsOf('SirMcMobdon'))[0];
    assert.equal(rows[0].actor, s.game.SirMcMobdon.id, 'the real account, in the audit log alone');
    assert.deepEqual(JSON.parse(rows[0].detail), { sub: mobSub });
    assert.equal(rows[0].role, 'admin'); assert.equal(rows[2].role, 'moderator');
    assert.ok(rows[0].key_id, 'with the key its session signed in by');
    // every other account: the token it always minted
    for (const h of ['Troll', 'Sylvia']) {
      const c = claimsOf((await s.mint(h)).body.token);
      assert.equal(c.hd, undefined, `${h}: no mark`); assert.equal(c.s, s.game[h].id);
    }
    // a staff member with no live staff session: a player's token
    s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(s.game.Tabbyvish.id);
    const tab = claimsOf((await s.mint('Tabbyvish')).body.token);
    assert.equal(tab.hd, undefined, 'a session gone idle hides nobody');
    assert.equal(tab.s, s.game.Tabbyvish.id);
    s.raw.prepare('UPDATE staff_sessions SET expires_at = 0 WHERE player_id = ?').run(s.game.Asynian.id);
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, undefined, 'nor one expired');
    assert.equal(s.audits('hidden-token').length, 4, 'and writes no row');
    // a member the role lists no longer name, their session row still standing: a player's token
    const mods = s.env.MODERATOR_HANDLES;
    s.env.MODERATOR_HANDLES = 'Tabbyvish';
    s.raw.prepare('UPDATE staff_sessions SET expires_at = ?, last_act = ? WHERE player_id = ?').run(nowS() + 600, nowS(), s.game.Asynian.id);
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, undefined, 'no role, no mark');
    s.env.MODERATOR_HANDLES = mods;
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, 1, 'named again, hidden again');
    // an owner's session by a key the config no longer names stands no more (staff.js staffSession's law)
    const keys = s.env.OWNER_KEYS;
    s.env.OWNER_KEYS = 'SirMcMobdon:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).hd, undefined, 'a key out of the config hides nobody');
    s.env.OWNER_KEYS = keys;
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).hd, 1, 'and back in it, hidden again');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: SHOW MYSELF - the switch off is written with its row, the hidden sockets\' subjects are each pushed a hide order, and the next mint is the account\'s own; on again hides the same session again (mutants: the switch unwritten; the row unwritten; no order pushed; the order for the account\'s id)', async () => {
  const s = await stand();
  try {
    const [sub] = await s.subsOf('SirMcMobdon');
    assert.equal((await s.staff('/v1/staff/hide', { on: 'no' }, s.mob.session)).body.error, 'body');
    assert.deepEqual((await s.staff('/v1/staff/hide', { on: false }, s.mob.session)).body, { hidden: false });
    assert.equal(s.raw.prepare('SELECT staff_hide FROM players WHERE id = ?').get(s.game.SirMcMobdon.id).staff_hide, 0);
    assert.deepEqual(s.audits('hide').map((r) => [r.actor, JSON.parse(r.detail)]), [[s.game.SirMcMobdon.id, { on: false }]]);
    assert.equal(s.pushed.length, 1, 'one hide order, for the one session');
    const o = await verifyOrder(s.pushed[0], s.identityPublic, { subtle, nowS: nowS(), kind: 'hide' });
    assert.equal(o.ok, true); assert.equal(o.claims.s, sub, 'naming the session\'s hidden subject');
    assert.deepEqual((await s.staff('/v1/staff/hide', {}, s.mob.session)).body, { hidden: false });
    const shown = claimsOf((await s.mint('SirMcMobdon')).body.token);
    assert.equal(shown.hd, undefined, 'shown'); assert.equal(shown.s, s.game.SirMcMobdon.id);
    assert.deepEqual((await s.staff('/v1/staff/hide', { on: true }, s.mob.session)).body, { hidden: true });
    assert.equal(s.pushed.length, 1, 'Hide me pushes nothing');
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).s, sub, 'hidden again, as the same session');
    assert.deepEqual(s.audits('hide').map((r) => JSON.parse(r.detail).on), [false, true]);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: THE MARK LAPSES WITH THE SESSION - a sign-out (one session or all), a key forgotten, an owner\'s cut and a Moderator removed each push a hide order for the subjects of the sessions they end, and the next mint shows the account (mutants: each door\'s push dropped; a sign-out of one pushing all)', async () => {
  const s = await stand();
  try {
    const verify = async (o) => (await verifyOrder(o, s.identityPublic, { subtle, nowS: nowS(), kind: 'hide' })).claims?.s;
    // a sign-out of one session
    const [asySub] = await s.subsOf('Asynian');
    await s.staff('/v1/staff/logout', {}, s.asy.session);
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [asySub], 'the sign-out\'s session');
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, undefined, 'and the next mint shows her');
    // a cut
    const [tabSub] = await s.subsOf('Tabbyvish');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/cut', { handle: 'Tabbyvish' }, s.mob.session)).status, 200);
    // the cut member's hide order, beside the cut's own (STAFF-PANEL2-FIX's staffcut, which closes their visible sockets)
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [tabSub, undefined], 'the cut member\'s');
    assert.equal((await verifyOrder(s.pushed[1], s.identityPublic, { subtle, nowS: nowS(), kind: 'staffcut' })).claims?.s, s.raw.prepare('SELECT id FROM players WHERE handle = ?').get('Tabbyvish').id);
    // a Moderator the panel added, then removed
    assert.equal((await s.staff('/v1/staff/mod/add', { handle: 'Sylvia' }, s.mob.session)).status, 200);
    await s.enrol('Sylvia');
    assert.equal(claimsOf((await s.mint('Sylvia')).body.token).hd, 1, 'a panel Moderator is hidden too');
    const [sylSub] = await s.subsOf('Sylvia');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/mod/remove', { handle: 'Sylvia' }, s.mob.session)).status, 200);
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [sylSub], 'the removed Moderator\'s');
    assert.equal(claimsOf((await s.mint('Sylvia')).body.token).hd, undefined, 'no staff, no mark');
    // a key forgotten: its sessions' subjects
    const keys = (await s.staff('/v1/staff/keys', {}, s.mob.session)).body.keys;
    const [mobSub] = await s.subsOf('SirMcMobdon');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/key/forget', { id: keys[0].id }, s.mob.session)).status, 200);
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [mobSub], 'the forgotten key\'s session');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: A SIGN-OUT of one session pushes its order alone; of every session, one for each (mutants: one read as all; all read as one)', async () => {
  const s = await stand();
  try {
    const login = async () => (await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await s.mobKey.proof('login', 'SirMcMobdon')) })).body.session;
    const subs = async () => new Set(await s.subsOf('SirMcMobdon'));
    const one = await subs();
    const two = await login();
    const both = await subs();
    assert.equal(both.size, 2, 'two sessions, two subjects');
    await s.staff('/v1/staff/logout', {}, two);
    assert.deepEqual(s.pushed.map((o) => claimsOf(o).s), [...both].filter((x) => !one.has(x)), 'the one session\'s subject alone');
    s.pushed.length = 0;
    await login();
    const again = await subs();
    assert.equal(again.size, 2);
    await s.staff('/v1/staff/logout', { all: true }, s.mob.session);
    assert.deepEqual(new Set(s.pushed.map((o) => claimsOf(o).s)), again, 'every session\'s');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: A PRIVATE HOME ENTERED - the relay\'s signed note is a `hidden-home` row as the staff member whose session minted the subject, once a minute; a note unsigned, forged, stale or of another shape is refused (mutants: the signature unread; the age unread; the subject unmatched; the row never written)', async () => {
  const s = await stand();
  try {
    const [sub] = await s.subsOf('SirMcMobdon');
    const room = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:17.200`;
    const note = (o = {}) => ({ v: HIDDEN_SEEN_V, id: '0123456789abcdef', at: Date.now(), s: sub, r: room, ...o });
    assert.equal(hiddenSeenValid(note()), true);
    for (const bad of [note({ v: 'x' }), note({ id: 'xyz' }), note({ r: 'world:1,2' }), note({ s: 'a b' }), { ...note(), extra: 1 }, null]) assert.equal(hiddenSeenValid(bad), false, JSON.stringify(bad));
    const post = async (body, sig) => s.fetch(`https://accounts.invalid${HIDDEN_SEEN_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { [HIDDEN_SEEN_SIG_HEADER]: sig } : {}) }, body });
    const sealed = await sealHiddenSeen(note(), s.gatePriv, { subtle });
    assert.ok(sealed);
    assert.equal((await post(sealed.body, null)).status, 401, 'unsigned');
    const forger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const forged = await sealHiddenSeen(note(), forger.privateKey, { subtle });
    assert.equal((await post(forged.body, forged.sig)).status, 401, 'forged');
    const stale = await sealHiddenSeen(note({ at: Date.now() - HIDDEN_SEEN_AGE_MAX_MS - 60_000 }), s.gatePriv, { subtle });
    assert.equal((await post(stale.body, stale.sig)).status, 400, 'stale');
    assert.equal((await s.fetch(`https://accounts.invalid${HIDDEN_SEEN_PATH}`, { method: 'GET' })).status, 405);
    assert.equal((await post(new Uint8Array(HIDDEN_SEEN_MAX_BYTES + 1), sealed.sig)).status, 413);
    assert.equal(s.audits('hidden-home').length, 0, 'nothing refused is written');
    const res = await post(sealed.body, sealed.sig);
    assert.equal(res.status, 202);
    const again = await sealHiddenSeen(note({ id: 'fedcba9876543210' }), s.gatePriv, { subtle });
    assert.equal((await post(again.body, again.sig)).status, 202);
    const rows = s.audits('hidden-home');
    assert.equal(rows.length, 1, 'once a minute a room');
    assert.equal(rows[0].actor, s.game.SirMcMobdon.id, 'as the staff member whose session minted it');
    assert.deepEqual(JSON.parse(rows[0].detail), { sub, room });
    // a subject no session minted any more: the subject alone
    const lone = await sealHiddenSeen(note({ s: 'nOb0dyAAAAAAAAAAAAAAAAAA' }), s.gatePriv, { subtle });
    assert.equal((await post(lone.body, lone.sig)).status, 202);
    assert.equal(s.audits('hidden-home').at(-1).actor, null);
    assert.equal(JSON.parse(s.audits('hidden-home').at(-1).detail).sub, 'nOb0dyAAAAAAAAAAAAAAAAAA');
    // the opener's own laws
    assert.deepEqual(await openHiddenSeen(sealed.body, sealed.sig, null, { subtle, nowMs: Date.now() }), { error: 'seen-closed' });
    assert.equal((await openHiddenSeen(new Uint8Array(0), sealed.sig, forger.publicKey, { subtle, nowMs: Date.now() })).error, 'seen-shape');
  } finally { s.restore(); }
});
