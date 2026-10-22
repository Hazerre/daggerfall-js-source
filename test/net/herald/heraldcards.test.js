// HERALD-CARDS (2026-10-22, the owner: "I want to overhaul our discord world event notification system to be more
// organized"): THE HERALDS' ONE CARD. The law (net/herald/heraldCard.js: the card's shape, its bounds, the families'
// colours, the door's thread), every herald's every post read as a card of its family, and the hub routing each family
// to its own thread (server/src/index.js `_heraldOf`, `_heraldSend`; the relay settings gateThread, serpentThread,
// sdThread and egThread - net/relayCfg.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HERALD_FAMILIES, heraldCard, heraldCss, heraldThread, heraldPostUrl, heraldWho, heraldWhen, heraldEmbedSize, heraldWebhook, heraldRole, heraldName, heraldStamp, heraldList,
  HERALD_EMBED_MAX, HERALD_TITLE_MAX, HERALD_TEXT_MAX, HERALD_FIELDS_MAX, HERALD_FIELD_VALUE_MAX, HERALD_CONTENT_MAX, HERALD_FOOTER_MAX,
} from '../../../src/net/herald/heraldCard.js';
import * as gateHerald from '../../../src/net/gate/gateHerald.js';
import { serpentOmenPost, serpentFellPost } from '../../../src/net/serpent/serpentHerald.js';
import { sdHeraldPost } from '../../../src/net/superDungeon/sdHerald.js';
import { egHeraldPost } from '../../../src/net/eliteGates/egHerald.js';
import { SERPENT_RING_MAP_CSS } from '../../../src/ui/serpentMapMark.js';
import { SD_RING_MAP_CSS } from '../../../src/ui/superDungeon/sdMapMark.js';
import { EG_ARCH_RING_CSS } from '../../../src/ui/eliteGates/egArchMapMark.js';
import { GATE_PLACE_MAX, SOCIAL_ROOM, SD_KEY } from '../../../src/net/wire.js';
import { RELAY_VERSION } from '../../../src/net/wire.js';
import { relayCfgSupported, RELAY_CFG_KEY_MIN } from '../../../src/net/relayCfg.js';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { fakeRoom } from '../../fakeRoom.mjs';
import { cardOf, cardWords } from '../../heraldCards.mjs';

const ROLE = '112233445566778899';
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const T_GATE = '200000000000000001', T_SEA = '200000000000000002', T_EG = '200000000000000004';
const LOUD_NAME = '**@everyone** <@&1> https://evil.io/x [a](b) `c` ~d~ |e|';

// ═══ THE CARD ════════════════════════════════════════════════════════════════════════════════════════════════════

test('HERALD-CARDS the card: one embed - its family\'s name and colour, the title, the text, the fields that have a value (inline unless they say not), the moment its footer; content only when it pings, the role and the line beside it; Discord may ping that role and nothing else (mutants: content on a quiet card; every mention allowed; an empty field posted; the family\'s colour another\'s)', () => {
  const c = heraldCard({ family: 'serpent', moment: 'Bells', title: 'T', text: 'x', fields: [['A', 'a'], ['B', null], ['C', 'c', false], ['D', '']], role: ROLE, ping: 'P' });
  assert.deepEqual(c, {
    content: `<@&${ROLE}> P`,
    allowed_mentions: { roles: [ROLE] },
    embeds: [{ author: { name: 'The Sea Serpent' }, title: 'T', color: 0x3fd6c6, description: 'x',
      fields: [{ name: 'A', value: 'a', inline: true }, { name: 'C', value: 'c', inline: false }], footer: { text: 'Bells' } }],
  });
  assert.equal(heraldCard({ family: 'gate', moment: 'M', title: 'T', role: ROLE }).content, `<@&${ROLE}> T`, 'no ping line: the title beside the role');
  for (const bad of ['@everyone', `<@&${ROLE}>`, '', null, undefined, 'Gate Watchers', '1234']) {
    const q = heraldCard({ family: 'gate', moment: 'M', title: 'T', role: bad });
    assert.equal(q.content, undefined, `${bad}: no content - the card is the post`);
    assert.deepEqual(q.allowed_mentions, { parse: [] }, `${bad}: nobody`);
  }
  const bare = heraldCard({ family: 'abyss', moment: 'M', title: 'T' }).embeds[0];
  assert.ok(!('description' in bare) && !('fields' in bare), 'no text, no fields: neither key');
  assert.equal(heraldCard({ family: 'nonesuch', moment: 'M', title: 'T' }).embeds[0].author.name, 'Dagon\'s Breach', 'a family the table lacks: the gate\'s, never a throw on the hub\'s alarm');
  assert.deepEqual(Object.keys(HERALD_FAMILIES), ['gate', 'serpent', 'abyss', 'spire']);
  assert.deepEqual(Object.values(HERALD_FAMILIES).map((f) => f.name), ['Dagon\'s Breach', 'The Sea Serpent', 'The Abyss Dungeon', 'The Battlespire']);
});

test('HERALD-CARDS the bounds: every part of a card is cut to Discord\'s own bound, never refused - a body past one would be refused whole and let go (mutants: a bound lifted; the cut without its ellipsis)', () => {
  const long = heraldCard({ family: 'spire', moment: 'm'.repeat(3000), title: 't'.repeat(300), text: 'x'.repeat(5000), fields: Array.from({ length: 30 }, (_, i) => [`f${i}`, 'v'.repeat(2000)]), role: ROLE, ping: 'p'.repeat(3000) });
  const e = long.embeds[0];
  assert.deepEqual([e.title.length, e.description.length, e.fields.length, e.footer.text.length, long.content.length], [HERALD_TITLE_MAX, HERALD_TEXT_MAX, HERALD_FIELDS_MAX, HERALD_FOOTER_MAX, HERALD_CONTENT_MAX]);
  assert.ok(e.fields.every((f) => f.value.length === HERALD_FIELD_VALUE_MAX && f.value.endsWith('\u2026')));
  assert.ok(e.title.endsWith('\u2026') && e.description.endsWith('\u2026'));
  assert.deepEqual([HERALD_TITLE_MAX, HERALD_TEXT_MAX, HERALD_FIELDS_MAX, HERALD_FIELD_VALUE_MAX, HERALD_FOOTER_MAX, HERALD_CONTENT_MAX, HERALD_EMBED_MAX], [256, 4096, 25, 1024, 2048, 2000, 6000], 'Discord\'s own');
});

/** Every post every herald makes, at its widest: the longest place the wire takes, the most names, a hostile name. */
function everyPost() {
  const place = `${'Copperham Wrothgarian Mountains '.repeat(4)}`.slice(0, GATE_PLACE_MAX).trim();
  const many = Array.from({ length: 8 }, (_, i) => `${LOUD_NAME}${i}`);
  const rec = { s: 3, r: 17, fb: LOUD_NAME, top: LOUD_NAME, n: 16, until: 1.8e12, next: 1.8e12 + 3_600_000 };
  const city = { ...rec, s: 4, r: -1 };
  const out = [];
  for (const day of [538, 700, 112]) {
    out.push(['gate', 'Omen', true, gateHerald.omenPost({ day, place, role: ROLE })], ['gate', 'Omen', false, gateHerald.omenPost({ day })]);
    out.push(['gate', 'Slain', false, gateHerald.fellPost({ day, place, top: many, n: 99 })], ['gate', 'Rite broken', false, gateHerald.ritePost({ place, by: many, n: 99 })]);
  }
  for (const day of [5, 40]) out.push(['serpent', 'Bells', true, serpentOmenPost({ day, place: LOUD_NAME, role: ROLE })], ['serpent', 'Slain', false, serpentFellPost({ day, place: LOUD_NAME, top: many, n: 99 })]);
  for (const r of [rec, city]) {
    out.push(['abyss', 'Risen', true, sdHeraldPost('rise', r, ROLE)], ['abyss', 'Found', true, sdHeraldPost('found', r, ROLE)]);
    out.push(['abyss', 'Hour broken', false, sdHeraldPost('fell', r, ROLE)], ['abyss', 'Faded', false, sdHeraldPost('fade', r, ROLE)]);
  }
  for (const p of [{ kind: 'rd', o: LOUD_NAME, n: 1, w: 19_990, h: 99_950, t: 7 * 86_400, ew: 19_000 }, { kind: 'rd', o: LOUD_NAME, n: 8, w: 20, h: 100, t: 1 },
    { kind: 'first', o: LOUD_NAME, n: 8, by: many, w: 10, h: 50, t: 7 * 86_400, ew: 9 }, { kind: 'lb', n: LOUD_NAME, lk: 'ilthys', c: 8 },
    { kind: 'top', br: 2, by: many, o: LOUD_NAME, h: 99_999, td: 7 * 86_400 }, { kind: 'seal', band: 3, o: LOUD_NAME, n: 1 }]) {
    out.push(['spire', { rd: 'Redoubt', first: 'First of the Spire', lb: 'The Lone Beacon', top: 'Descent record', seal: 'Seal lifted' }[p.kind], false, egHeraldPost(p)]);
  }
  return out;
}

test('HERALD-CARDS every herald\'s every post is a card of its family: the gate\'s omen, kill and rite; the serpent\'s bells and kill; the Abyss Dungeon\'s rise, find, fall and fade; the Spire\'s Redoubt, First of the Spire, Lone Beacon, Descent and seal - each its family\'s name and colour and its moment\'s footer, a title, within Discord\'s bounds at its widest, pinging the role where it pings and nobody elsewhere, and no player\'s name carrying a mention, a link or markdown (mutants: a post left as text; a family miscoloured; a ping on a quiet post; a name taken raw)', () => {
  const posts = everyPost();
  assert.equal(posts.length, 30);
  const moments = new Set();
  for (const [family, moment, pings, p] of posts) {
    const c = cardOf(p), F = HERALD_FAMILIES[family];
    const why = `${family}/${moment}: ${c.title}`;
    assert.deepEqual([c.author, c.colour, c.footer], [F.name, F.colour, moment], why);
    assert.ok(c.title && c.title.length <= HERALD_TITLE_MAX, why);
    assert.ok(heraldEmbedSize(p) <= HERALD_EMBED_MAX, `${why}: ${heraldEmbedSize(p)}`);
    assert.equal(p.embeds.length, 1, why);
    if (pings) {
      assert.deepEqual(p.allowed_mentions, { roles: [ROLE] }, why);
      assert.ok(p.content.startsWith(`<@&${ROLE}> `) && p.content.length <= HERALD_CONTENT_MAX, why);
    } else {
      assert.deepEqual(p.allowed_mentions, { parse: [] }, why);
      assert.ok(!('content' in p), `${why}: a quiet post has no content`);
    }
    // a player's words never reach Discord as anything but words - the stamps (<t:...>) and the herald's own bold alone
    const words = cardWords(p).replace(/<t:\d+:[tR]>/g, '').replace(/<@&\d+> /, '').replace(/\*\*the [A-Za-z-]+\*\*/g, '');
    assert.ok(!/[@<>*`~|[\]]|https?:/.test(words), `${why}: ${words}`);
    moments.add(`${family}/${moment}`);
  }
  assert.equal(moments.size, 14, 'fourteen moments, each its own footer');
});

test('HERALD-CARDS the colours: each family\'s is its marker in the Timers - the gate\'s red the timers sheet reads from this table, the others their rings on the map (mutants: a colour drifted from its ring)', () => {
  assert.equal(heraldCss('gate'), '#e2554c');
  assert.equal(heraldCss('serpent'), SERPENT_RING_MAP_CSS);
  assert.equal(heraldCss('abyss'), SD_RING_MAP_CSS);
  assert.equal(heraldCss('spire'), EG_ARCH_RING_CSS);
});

test('HERALD-CARDS the door and the words: a thread is a Discord id or nothing; a card goes to the webhook, into the thread when one is named; who did it is the first names through heraldName and the rest counted; a moment in the reader\'s clock and how soon; the gate\'s herald says the card\'s own door and words again, the same functions (mutants: a thread taken raw; the thread dropped from the URL; the others miscounted)', () => {
  assert.equal(heraldThread(T_GATE), T_GATE);
  assert.equal(heraldThread(` ${T_GATE}\n`), T_GATE);
  for (const bad of [undefined, null, '', `<#${T_GATE}>`, `https://discord.com/channels/1/${T_GATE}`, 'world-events', '1234', '1'.repeat(22)]) assert.equal(heraldThread(bad), null, String(bad));
  assert.equal(heraldPostUrl(HOOK, null), HOOK);
  assert.equal(heraldPostUrl(HOOK, T_GATE), `${HOOK}?thread_id=${T_GATE}`);
  assert.equal(heraldWho(['Ann', 'Bran'], 5), 'Ann, Bran and 3 others');
  assert.equal(heraldWho(['Ann'], 2), 'Ann and 1 other');
  assert.equal(heraldWho(['Ann'], 'x'), 'Ann', 'a count that is no count: none');
  assert.equal(heraldWho(['***', ''], 9), '', 'no name left: nothing - never "and 9 others" alone');
  assert.equal(heraldWho('Ann', 1), '');
  assert.equal(heraldWhen(1_790_605_950_000), '<t:1790605950:t> (<t:1790605950:R>)');
  for (const [k, f] of Object.entries({ heraldWebhook, heraldRole, heraldName, heraldStamp, heraldList })) assert.equal(gateHerald[k], f, `${k}: one export, said again`);
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
/** The hub with Discord stubbed: `posts` is every URL and body the herald sent. */
async function withHub(fn, env) {
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const r = fakeRoom(SOCIAL_ROOM);
  Object.assign(r.env, { GATE_DISCORD_WEBHOOK: HOOK, ...env });
  r.store.set(SD_KEY, { s: 0, ph: 'gone', r: -1, at: clock, until: clock, next: clock + 10 * 365 * 86_400_000 });
  const posts = [];
  globalThis.fetch = async (url, init) => { posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 204 }; };
  try { await quiet(() => fn({ r, posts, tick: (ms) => { clock += ms; } })); } finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('HERALD-CARDS relay: each family posts to its own thread when the operator names one, else the gate\'s, else the channel itself - the gate\'s omen, the serpent\'s bells, the Abyss Dungeon\'s rise and the Spire\'s Redoubt each to theirs (mutants: every family to the gate\'s thread; a family\'s own thread ignored; the gate\'s not the fallback)', async () => {
  await withHub(async ({ r, posts }) => {
    assert.deepEqual(r.room._heraldOf().threads, { gate: null, serpent: null, abyss: null, spire: null }, 'none named: the channel itself');
    await r.room._heraldSend(gateHerald.omenPost({ day: 538 }));
    assert.equal(posts.at(-1).url, HOOK, 'as before');
  }, {});
  await withHub(async ({ r, posts }) => {
    assert.deepEqual(r.room._heraldOf().threads, { gate: T_GATE, serpent: T_SEA, abyss: T_GATE, spire: T_EG });
    await r.room._heraldSend(gateHerald.omenPost({ day: 538 }));
    await r.room._heraldSend(serpentOmenPost({ day: 5 }), 'serpent');
    await r.room._heraldSend(sdHeraldPost('rise', { s: 3, r: 17, until: 1.8e12, next: 1.8e12 }), 'abyss');
    await r.room._heraldSend(egHeraldPost({ kind: 'rd', o: 'Mac', w: 10, h: 50, t: 1 }), 'spire');
    assert.deepEqual(posts.map((p) => [p.url, cardOf(p.body).author]), [
      [`${HOOK}?thread_id=${T_GATE}`, 'Dagon\'s Breach'],
      [`${HOOK}?thread_id=${T_SEA}`, 'The Sea Serpent'],
      [`${HOOK}?thread_id=${T_GATE}`, 'The Abyss Dungeon'],
      [`${HOOK}?thread_id=${T_EG}`, 'The Battlespire'],
    ]);
  }, { GATE_DISCORD_THREAD: T_GATE, SERPENT_DISCORD_THREAD: T_SEA, SD_DISCORD_THREAD: 'not-an-id', EG_DISCORD_THREAD: T_EG });
});

test('HERALD-CARDS relay: a thread is a setting a developer changes at run time - an id taken and in force at once, a link or a name refused in words /relay shows and nothing kept, `-` handing it back to the var (mutants: a thread kept unchecked; the herald\'s threads read once for ever)', async () => {
  await withHub(async ({ r, tick }) => {
    const dev = r.connect(); tick(300); await r.hello(dev, 'dev-0001', null, { glyphs: ['dev'] });
    // the hub hears a developer's setting at most so often - each said a while after the last, as auditscale2_relay.test.js says them
    const say = async (k, v) => { tick(5000); await r.raw(dev, JSON.stringify({ t: 'cfg', k, v })); return dev.sent.filter((f) => f.t === 'cfg').at(-1); };
    for (const k of ['gateThread', 'serpentThread', 'sdThread', 'egThread']) {
      for (const bad of [`<#${T_SEA}>`, `https://discord.com/channels/1/${T_SEA}`, 'world-events']) {
        const a = await say(k, bad);
        assert.match(a.error, /Discord thread's id/, `${k} ${bad}`);
      }
    }
    assert.equal(r.room._heraldOf().threads.serpent, T_GATE, 'nothing kept: the gate\'s');
    assert.deepEqual(await say('serpentThread', T_SEA), { t: 'cfg', k: 'serpentThread', v: T_SEA });
    assert.equal(r.room._heraldOf().threads.serpent, T_SEA, 'in force at once');
    assert.deepEqual(await say('serpentThread', null), { t: 'cfg', k: 'serpentThread', v: '' }, 'handed back to the var - unset');
    assert.equal(r.room._heraldOf().threads.serpent, T_GATE);
  }, { GATE_DISCORD_THREAD: T_GATE });
});

test('HERALD-CARDS the client says a thread setting only to a relay that knows it - an older one finds no such name and closes the hub link on the frame; the roles and every older setting as before (mutants: a thread said to world242; the floor read for every setting)', async () => {
  assert.deepEqual(RELAY_CFG_KEY_MIN, { gateThread: 243, serpentThread: 243, sdThread: 243, egThread: 243 });
  assert.ok(relayCfgSupported(RELAY_VERSION, 'gateThread'), 'this relay knows them');
  assert.deepEqual([relayCfgSupported('world242'), relayCfgSupported('world242', 'gateThread'), relayCfgSupported('world243', 'egThread'), relayCfgSupported('world242', 'gateRole'), relayCfgSupported('world191', 'gateRole')], [true, false, true, true, false]);
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand: () => 0, presence: false });
    s.join('chat:world');
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world242', now: 1_000_000 });
    assert.equal(s.sendRelayCfg({ k: 'serpentThread', v: T_SEA }), false, 'world242 has no such setting');
    assert.equal(s.sendRelayCfg({ k: 'gateRole', v: ROLE }), true, 'a role, as before');
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world243', now: 1_000_000 });
    assert.equal(s.sendRelayCfg({ k: 'serpentThread', v: T_SEA }), true);
    assert.deepEqual(JSON.parse(sockets[0].sent.at(-1)), { t: 'cfg', k: 'serpentThread', v: T_SEA });
  });
});
