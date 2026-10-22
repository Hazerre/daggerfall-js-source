// CRAFT-WRITS (2026-10-22) - THE CLIENT'S HALF: the host's goods out of the pack inside the realm act (scenes/
// craftWritHost.js - the plain bottles before the Potent, a dish's own pieces, all back on a refusal), the book's
// delivery (net/profBook.js craftDeliver) and the Work tab's crafting-writ cards (ui/noticeWindow.js) - what each asks,
// pays and holds, Deliver waiting with its reason, a press said and the list read again - and the wiring.
// bible/06-Systems/Professions-Arc.md section 49.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { createCraftWritHost } from '../../src/scenes/craftWritHost.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { writPotionKey } from '../../src/net/craftWritLaw.js';
import { GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const KEY = writPotionKey('potion:healing');
const bottle = (n, extra = {}) => ({ group: 'UselessItems1', templateIndex: 205, potionRecipeKey: KEY, stackCount: n, value: 50, ...extra });
const HEALING = { id: 'k:20383:r0123456789abcdef0123:0', product: 'potion:healing', kind: 'potion', tier: 1, faction: 33, qty: 4, pay: 42, xp: 84, renown: 63, track: 'provisioning', expiresAt: 20384 * 86400, state: 'open', brewed: 4 };
/** a realm session the realm act asks through (systems/realmSaves.js realmGoldAct's own shape) */
const session = () => ({ transact: async (fn) => fn({ id: 'r0123456789abcdef0123', lease: 'l'.repeat(32), seq: 3 }), abandon() {} });

test('CRAFT-WRITS client: the host holds a potion writ ready only when the pack\'s bottles and the brews both cover it; a press takes the plain bottles before the Potent out as the service is first asked, and puts every one back on a refusal (mutants: the pick\'s order; the put back; the brews read)', async () => {
  const player = { items: [bottle(3, { potent: 25 }), { name: 'Torch' }, bottle(2)] };
  const asked = [];
  let answer = { ok: false, error: 'craft-unbrewed' };
  const book = { craftDeliver: async (id, pieces, at) => { asked.push([id, pieces, at.seq, player.items.map((it) => it.stackCount ?? 1)]); return answer; } };
  let checkpoints = 0, saves = 0;
  const host = createCraftWritHost({ player: () => player, session: () => session(), checkpoint: () => { checkpoints++; }, saved: () => { saves++; }, book: () => book });
  assert.deepEqual(host.held(HEALING), { pack: 5, made: 4, ready: true });
  assert.deepEqual(host.held({ ...HEALING, brewed: 3 }), { pack: 5, made: 3, ready: false }, 'the brews short');
  assert.deepEqual(host.held({ ...HEALING, qty: 6, brewed: 9 }).ready, false, 'the pack short');
  const no = await host.deliver(HEALING);
  assert.deepEqual([no.ok, no.error], [false, 'craft-unbrewed']);
  assert.deepEqual(asked, [[HEALING.id, null, 3, [1, 1]]], 'asked with the plain two and two of the Potent three out');
  assert.deepEqual(player.items.map((it) => it.stackCount ?? 1), [3, 1, 2], 'every bottle back on the refusal');
  assert.equal(saves, 0);
  answer = { ok: true, data: { pay: 42, xp: 84, renown: { credited: 63 } } };
  const ok = await host.deliver(HEALING);
  assert.equal(ok.ok, true);
  assert.deepEqual(player.items.map((it) => [it.name ?? 'bottle', it.stackCount ?? 1, it.potent ?? 0]), [['bottle', 1, 25], ['Torch', 1, 0]], 'the plain two gone whole, the Potent stack two less');
  assert.deepEqual([saves, checkpoints >= 4], [1, true], 'checkpointed before and after each act');
  assert.deepEqual(await createCraftWritHost({ player: () => player, session: () => null, checkpoint() {}, saved() {}, book: () => book }).deliver(HEALING), { ok: false, error: 'realm-needed' }, 'offline: no realm act');
});

test('CRAFT-WRITS client: a dish writ\'s pieces are the service\'s own list in pack order - one short holds it back (craft-pieces) before anything is asked; filled, the pieces leave the pack (mutants: the service\'s list unread)', async () => {
  const P = ['0123456789abcdef', '1123456789abcdef', '2123456789abcdef', '3123456789abcdef'];
  const dish = (pv, recipe = 'stew:north') => ({ templateIndex: 685, provenance: pv, recipe, name: 'Hunter\'s Stew' });
  const player = { items: [dish(P[3]), dish(P[0]), dish(P[1], 'stew:south'), dish(P[2])] };
  const asked = [];
  const book = { craftDeliver: async (id, pieces) => { asked.push(pieces); return { ok: true, data: { pay: 20 } }; } };
  const host = createCraftWritHost({ player: () => player, session: () => session(), checkpoint() {}, saved() {}, book: () => book });
  const w = { id: 'k:1:r0123456789abcdef0123:1', product: 'dish:stew', kind: 'dish', qty: 3, pieces: [P[0], P[1], P[2]] };
  assert.deepEqual(host.held(w), { pack: 4, made: 3, ready: true }, 'P[3] is in the pack but not the service\'s - bought, or another\'s');
  assert.deepEqual(await host.deliver({ ...w, pieces: [P[0], P[1]] }), { ok: false, error: 'craft-pieces' });
  assert.deepEqual(asked, [], 'nothing asked');
  assert.equal((await host.deliver(w)).ok, true);
  assert.deepEqual(asked, [[P[0], P[1], P[2]]]);
  assert.deepEqual(player.items.map((it) => it.provenance), [P[3]]);
});

test('CRAFT-WRITS client: the Work tab - the character\'s crafting writs under their own head with the day\'s count, each the guild\'s ask, what fills it, its pay and what is held; Deliver waiting with its reason on the card; a press delivers, takes the balance and Renown as a Court writ\'s, says the guild\'s thanks and reads the list again (mutants: the head; the card\'s lines; the waiting; the press)', async () => {
  const crafts = { writs: [HEALING, { ...HEALING, id: 'k:20383:r0123456789abcdef0123:1', product: 'dish:stew', kind: 'dish', faction: GUILD_FACTION_IDS.FightersGuild, qty: 3, pay: 20, xp: 40, renown: 30, pieces: [] }], today: { filled: 1, max: 3 } };
  let reads = 0;
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 0,
    writs: async () => { reads++; return { data: { writs: [], receipts: [], merit: [], chapters: [], today: { filled: 0, max: 3 }, crafts }, error: null, stale: false }; },
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const delivered = [], taken = [];
  const held = (w) => (w.kind === 'potion' ? { pack: 5, made: 4, ready: true } : { pack: 0, made: 1, ready: false });
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, nowS: () => 20383 * 86400 + 3600,
    work: { book, region: 17, regionName: 'Anticlere', countName: (k, n) => `${n} ${k}`, onTaken: (r) => { taken.push(r.data.pay); return 'court words'; },
      crafts: { held, deliver: async (w) => { delivered.push(w.id); return { ok: true, data: { pay: 42, xp: 84, renown: { credited: 63 } } }; } } } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(byClass(host, 'notice-section').map((n) => n.textContent), ['Crafting writs - 1 of 3 today', 'Court and guild writs']);
  const cards = byClass(host, 'notice-craft');
  assert.equal(cards.length, 2);
  assert.deepEqual(['writ-kind', 'writ-need', 'writ-made', 'writ-pay'].map((c) => byClass(cards[0], c)[0].textContent), [
    'Crafting writ', 'The Temple of Stendarr asks you for 4 Potions of Healing', 'Of your own brewing - the bottles leave your pack.', 'Pays 42 silver, 84 Provisioning experience, 63 Renown and standing with the Temple of Stendarr']);
  assert.match(byClass(cards[0], 'writ-take')[0].textContent, /4 brewed by you, 5 in your pack/);
  const stew = cards[1].querySelector('button');
  assert.deepEqual([stew.disabled, stew.title, byClass(cards[1], 'writ-walled')[0].textContent], [true, 'Make 2 more yourself - pieces you bought or sold do not count', 'Make 2 more yourself - pieces you bought or sold do not count.']);
  const go = cards[0].querySelector('button');
  assert.equal(go.disabled, false);
  const before = reads;
  go.click();
  for (let i = 0; i < 5; i++) await tick();
  assert.deepEqual([delivered, taken], [[HEALING.id], [42]]);
  assert.ok(reads > before, 'the list read again');
  assert.match(host.textContent, /The Temple of Stendarr thanks you: 42 silver, 84 Provisioning experience and 63 Renown\./);
});

test('CRAFT-WRITS client: the wiring - the host made once in world.js and named on the Work tab; the door posts the realm and the pieces; the book asks it once (the realm act asks again); the service\'s route and its progress line (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const craftWrits = createCraftWritHost\(\{ player: \(\) => playerEntity, session: \(\) => realmSession, checkpoint: \(\) => onlineCheckpoint\(\), saved: \(\) => saveSoon\.changed\(\), book: \(\) => profBook \}\);/);
  assert.match(w, /onTaken: \(r\) => profWritTaken\(r\),\n\s+crafts: craftWrits,/);
  assert.match(src('src/net/accountClient.js'), /craftWrit: \(character, id, rid, realm, pieces = null\) => post\('\/v1\/writs\/craft', \{ character, id, rid, realm, \.\.\.\(pieces \? \{ pieces \} : \{\}\) \}\),/);
  assert.match(src('src/net/profBook.js'), /async craftDeliver\(writId, pieces = null, realm = null\) \{[^]*?door\.craftWrit\(c, writId, m\.id, realm, pieces\)/);
  const ix = src('server-account/src/index.js');
  assert.match(ix, /'\/v1\/writs\/craft': \(\) => deliverCraftWrit\(\{ \.\.\.ctx, bucket: env\.SAVES \}, who\.player, env, body\),/);
  assert.match(ix, /\.\.\.\(await craftWritBoard\(ctx, who\.player, env, body\)\) \};/);
  assert.match(src('server-account/src/progress.js'), /'\/v1\/writs\/craft': Object\.freeze\(\['prof', true\]\),/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/writs\/craft',\n/);
});
