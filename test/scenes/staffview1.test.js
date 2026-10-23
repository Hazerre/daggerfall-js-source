// STAFF-VIEW1 (2026-10-23, mob: "np player esp in staff panel?", "i need staff panel to have esp", "i told you to add the
// opther parts to the menu?", "wtf u had all this build"; design doc "DFO Staff Panel: design", In game: the staff view) -
// THE STAFF TAGS, driven headless: scenes/staffViewHost.js over a fake follow (the page's, scenes/staffFollowHost.js
// staffFollowOnPage's shape) and ui/staffTags.js over a fake document of this file's own - test/net/name1_bubbles.test.js's
// shape, COPIED rather than shared, with the same write counter, because "one element per player, moved and never
// rebuilt" and "a still frame writes nothing" are claims only a counter can hold. Then the five seams the host wires,
// pinned over the source. (The flat map is slice 2's, and none of it is here.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStaffViewHost, staffTagWords, STAFF_TAGS_MAX, STAFF_TAGS_ASK_MS, STAFF_FIND_WAIT_MS, STAFF_LINES_MAX, STAFF_TAG_HEAD_M } from '../../src/scenes/staffViewHost.js';
import { createStaffTags } from '../../src/ui/staffTags.js';
import { validTags, NAMEPLATE_DIST } from '../../src/net/staffHook.js';
import { ID_RE } from '../../src/net/identityToken.js';
import { NAME_RANGE, sightBlockedBy } from '../../src/net/remotePlayers.js';
import { Collider } from '../../src/player/collider.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';

// ── THE FAKE DOCUMENT (test/net/name1_bubbles.test.js's shape, copied - not shared; and a press, and a canvas) ──────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {}, writes: 0, on: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; doc.writes++; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; doc.structure++; },
    addEventListener(k, f) { (n.on[k] ??= []).push(f); },
    fire(k) { const e = { stopped: false, stopPropagation() { e.stopped = true; }, preventDefault() {} }; for (const f of n.on[k] ?? []) f(e); return e; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.writes++; doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); n.writes++; doc.writes++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; n.writes++; doc.writes++; return true; } });
  if (tag === 'canvas') {
    n.width = 300; n.height = 150;
    n.ops = [];
    const g = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? (...a) => n.ops.push([k, ...a]) : undefined), set: () => true });
    n.getContext = () => g;
  }
  return n;
}
function fakeDocument() {
  const doc = { writes: 0, structure: 0, built: 0 };
  doc.createElement = (tag) => { doc.built++; return fakeNode(tag, doc); };
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.zero = () => { doc.writes = 0; doc.structure = 0; doc.built = 0; };
  return doc;
}
/** Every node under `n` (itself too). */
const all = (n) => [n, ...n.children.flatMap(all)];
const tagsIn = (doc) => all(doc.body).filter((x) => x.attrs['data-staff-tag'] != null && !x.removed);

// ── THE FRAME, THE PAGE'S FOLLOW, THE WORLD ─────────────────────────────────────────────────────────────

const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
const EYE = [0, 1.7, 0];
const CANVAS = { clientWidth: 1600, clientHeight: 900 };
const ORIGIN = 'https://game.test';

/** A peer as a session's drawable() hands it: an id, a name, a pose (the world frame is the scene's here). */
const peer = (id, x, z, more = {}) => ({ id, name: more.name ?? id, shown: { x, y: 0, z, yaw: 0, pitch: 0, mv: 0, ...(more.cv ? { cv: more.cv } : {}) }, ...(more.sub ? { sub: more.sub } : {}) });

/** The page's follow (staffFollowOnPage's returns), plain. */
function fakeFollow({ panel = true, locked = false, eye = [], room = [], tags = null, mode = 'exterior', refuse = null } = {}) {
  const f = {
    spoke: panel, isLocked: locked, eyePeers: eye, roomPeers: room, answer: tags, modeNow: mode, followed: [], asks: 0,
    panel: () => f.spoke, locked: () => f.isLocked, peers: () => f.eyePeers, main: () => ({ drawable: () => f.roomPeers }),
    toScene: (p) => [p.x, p.y, p.z], mode: () => f.modeNow, tags: () => f.answer, askTags: () => { f.asks++; },
    follow: (sub) => { if (!f.spoke || typeof sub !== 'string' || !ID_RE.test(sub) || sub === refuse) return false; f.followed.push(sub); return true; },
  };
  return f;
}
/** A layer that records what the host hands it. */
function fakeLayer() {
  const l = { renders: [], lineSets: [], hidden: 0, onPick: null };
  l.make = ({ onPick }) => { l.onPick = onPick; return { render: (g, n) => l.renders.push({ groups: g, n }), strokes: (s) => l.lineSets.push(s), hide: () => { l.hidden++; }, dispose() {}, size: () => 0 }; };
  l.last = () => l.renders.at(-1);
  l.members = () => (l.last()?.groups ?? []).flatMap((g) => g.members);
  return l;
}
function rig({ glyphs = ['dev'], follow = fakeFollow(), links = null, book = [], foes = [], up = false, doc = null, layer = fakeLayer(), origin = ORIGIN } = {}) {
  const said = [], posted = [], toggled = [];
  let t = 1_000_000;
  const win = { location: { origin }, postMessage: (m, o) => posted.push([m, o]) };
  const state = { glyphs, up, links };
  const host = createStaffViewHost({
    follow, glyphs: () => state.glyphs, links: () => state.links, book: { live: () => book }, foes: { foes }, overworld: () => toggled.push(1),
    up: () => state.up, canvas: CANVAS, say: (s) => said.push(s), win, doc: doc ?? fakeDocument(), now: () => t,
    ...(doc ? {} : { makeTags: layer.make }),
  });
  const frame = (covered = false) => host.frame(PROJ, VIEW, EYE, covered);
  return { host, follow, layer, said, posted, toggled, state, frame, tick: (ms) => { t += ms; } };
}

// ── THE GATE ───────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 the gate: no layer, no ask and no element for a player\'s glyphs ([]) or a Dungeon Master\'s, and none for staff before a Staff Panel has spoken on the page; an Admin\'s or a Moderator\'s once one has (mutants: the gate without the glyphs, the gate without the panel)', () => {
  for (const [glyphs, panel] of [[[], true], [['dm'], true], [['mod'], false], [['dev'], false], [null, true]]) {
    const doc = fakeDocument();
    const follow = fakeFollow({ panel, room: [peer('p1', 0, -20)] });
    const r = rig({ glyphs, follow, doc });
    r.frame(); r.frame();
    assert.equal(doc.built, 0, `${JSON.stringify(glyphs)} panel ${panel}: no element made`);
    assert.equal(follow.asks, 0, 'and nothing asked of the panel');
    assert.equal(r.host.marks(null), null);
  }
  for (const glyphs of [['mod'], ['shadowfang'], ['dev', 'dm']]) {
    const doc = fakeDocument();
    const follow = fakeFollow({ room: [peer('p1', 0, -20)] });
    const r = rig({ glyphs, follow, doc });
    r.frame();
    assert.equal(tagsIn(doc).length, 1, `${glyphs}: tagged`);
    assert.equal(follow.asks, 1, 'the flags asked as the view turns on');
  }
});

test('STAFF-VIEW1 the flags: asked when the view turns on, then every STAFF_TAGS_ASK_MS while it is on, and again as it turns on after a spell off; nothing asked while off (mutants: the minute\'s ask dropped)', () => {
  const r = rig();
  r.frame();
  assert.equal(r.follow.asks, 1);
  r.tick(STAFF_TAGS_ASK_MS - 1); r.frame();
  assert.equal(r.follow.asks, 1, 'not before the minute');
  r.tick(1); r.frame();
  assert.equal(r.follow.asks, 2, 'the minute\'s');
  r.follow.spoke = false; r.frame(); r.tick(5 * STAFF_TAGS_ASK_MS); r.frame();
  assert.equal(r.follow.asks, 2, 'off: nothing');
  assert.equal(r.layer.hidden, 1, 'and the tags hidden once');
  r.follow.spoke = true; r.frame();
  assert.equal(r.follow.asks, 3, 'on again: asked at once');
});

// ── WHO IS TAGGED ──────────────────────────────────────────────────────────────────────────────────

/** A real Collider with a real wall in it: a quad at z = -5 spanning x -2..2, y 0..5 (name1_bubbles' own, copied). */
function walled() {
  const c = new Collider();
  c.addMesh('wall', [-2, 0, -5, 2, 0, -5, 2, 5, -5, -2, 5, -5], [0, 1, 2, 0, 2, 3], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  return c;
}

test('STAFF-VIEW1 through walls: a player past NAME_RANGE and behind a wall - whose name play would never draw - is still tagged, a concealed one by their true name with a small \'concealed\'', () => {
  const far = peer('p-far', 0, -80, { name: 'Bran' }), hid = peer('p-hid', 20, -60, { name: 'Ghost', cv: 1 });
  const r = rig({ follow: fakeFollow({ room: [far, hid] }) });
  const head = [0, STAFF_TAG_HEAD_M, -80];
  assert.ok(Math.hypot(head[0] - EYE[0], head[2] - EYE[2]) > NAME_RANGE, 'past the names\' own reach');
  assert.equal(sightBlockedBy(walled(), EYE, head), true, 'and the wall stands between');
  r.frame();
  const m = r.layer.members();
  assert.deepEqual(m.map((x) => x.id).sort(), ['p-far', 'p-hid']);
  assert.deepEqual(m.find((x) => x.id === 'p-hid'), { id: 'p-hid', name: 'Ghost', line: 'concealed', level: '' });
});

test('STAFF-VIEW1 the ground\'s reach: the nameplate distance from the panel\'s answer (100 m while it has said none), the nearest STAFF_TAGS_MAX, the rest a +N; behind the eye and the eye\'s own (a follow\'s target) none (mutants: no distance cut, the answer\'s distance unread, no cap, the eye\'s own tagged)', () => {
  const follow = fakeFollow({ room: [peer('near', 0, -90), peer('mid', 5, -150), peer('behind', 0, 30), peer('target', 0, -0.5)] });
  const r = rig({ follow });
  r.frame();
  assert.equal(NAMEPLATE_DIST, 100);
  assert.deepEqual(r.layer.members().map((m) => m.id), ['near'], '100 m: the one at 150 m cut, the one behind none, the eye\'s own none');
  follow.answer = validTags({ dist: 200, list: [] });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), ['near', 'mid'], '200 m');
  follow.answer = validTags({ dist: 50, list: [] });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), [], '50 m');
  // forty within reach, spread across the screen: the nearest 32, eight more
  follow.answer = null;
  follow.roomPeers = Array.from({ length: 40 }, (_, i) => peer(`p${String(i).padStart(2, '0')}`, -44 + 2.25 * i, -50));
  r.frame();
  assert.equal(STAFF_TAGS_MAX, 32);
  const shown = r.layer.members();
  assert.equal(shown.length, STAFF_TAGS_MAX);
  assert.equal(r.layer.last().n, 8, '+8');
  const d = (id) => Math.abs(-44 + 2.25 * Number(id.slice(1)));
  assert.ok(Math.max(...shown.map((m) => d(m.id))) <= Math.min(...follow.roomPeers.filter((p) => !shown.some((m) => m.id === p.id)).map((p) => d(p.id))), 'the nearest');
});

test('STAFF-VIEW1 a locked follow reads the hook\'s peers - the followed room\'s - never the host\'s own room (left while it is locked); let go, the room\'s again (mutants: the room read while locked)', () => {
  const follow = fakeFollow({ locked: true, eye: [peer('theirs', 0, -20)], room: [peer('mine', 3, -20)] });
  const r = rig({ follow });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), ['theirs']);
  follow.isLocked = false;
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), ['mine']);
});

test('STAFF-VIEW1 crowds: tags this near on the screen are one box of every member, keyed apart from a lone tag', () => {
  const r = rig({ follow: fakeFollow({ room: [peer('a1', 0, -40), peer('a2', 0.2, -40), peer('b1', 10, -40)] }) });
  r.frame();
  const g = r.layer.last().groups;
  assert.deepEqual(g.map((x) => [x.key, x.members.map((m) => m.id)]), [['crowd:a1', ['a1', 'a2']], ['b1', ['b1']]]);
});

// ── WHAT A TAG SAYS ────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 the flag fold: one account\'s rows fold to the most urgent (the highest level wins, with its words) and a watch on any; a Moderator\'s WATCH reads alone; the words joined (mutants: the fold kept the last row)', () => {
  const t = validTags({ dist: 100, list: [{ sub: 'acct-a', level: 'low', why: '1 report' }, { sub: 'acct-a', level: 'high', why: '4 reports' }, { sub: 'acct-a', level: 'medium', why: 'market' }, { sub: 'acct-a', watch: true }, { sub: 'acct-w', watch: true }] });
  assert.deepEqual(t.flags.get('acct-a'), { level: 'high', why: '4 reports', watch: true });
  assert.deepEqual(t.flags.get('acct-w'), { level: null, why: '', watch: true });
  assert.equal(staffTagWords(t.flags.get('acct-a'), 8, true), '4 reports · WATCH · 8 monsters · concealed');
  assert.equal(staffTagWords(t.flags.get('acct-w'), 0, false), 'WATCH');
  assert.equal(staffTagWords(null, 1, false), '1 monster');
  assert.equal(staffTagWords(null, 0, false), '');
  // a Moderator's tags: the service's role-filtered flags (a report, WATCH), never a monster, whatever the puppets say
  const follow = fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-w' }), peer('p2', 10, -20, { sub: 'acct-r' })], tags: validTags({ dist: 100, list: [{ sub: 'acct-w', watch: true }, { sub: 'acct-r', level: 'high', why: '2 reports' }] }) });
  const r = rig({ glyphs: ['mod'], follow, foes: [{ puppet: 'p1', ai: { feet: [0, 0, -21] } }, { puppet: 'p2', ai: { feet: [10, 0, -21] } }] });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => [m.id, m.line, m.level]), [['p1', 'WATCH', ''], ['p2', '2 reports', 'high']]);
});

test('STAFF-VIEW1 an Admin\'s monsters: the game\'s own puppets by their sender - a count on the ground tag, a line to their owner on the Overworld (STAFF_LINES_MAX at most), none for a Moderator; the dead uncounted (mutants: monsters for every staff member, the lines uncapped)', () => {
  const foes = [{ puppet: 'p1', ai: { feet: [2, 0, -30] } }, { puppet: 'p1', ai: { feet: [-2, 0, -30] } }, { puppet: 'p1', dead: true, ai: { feet: [0, 0, -30] } }, { puppet: null, ai: { feet: [0, 0, -10] } }];
  const follow = fakeFollow({ room: [peer('p1', 0, -30)] });
  const r = rig({ follow, foes });
  r.frame();
  assert.equal(r.layer.members()[0].line, '2 monsters');
  assert.deepEqual(r.layer.lineSets.at(-1), [], 'the ground: the count alone');
  r.state.up = true;
  r.frame();
  assert.equal(r.layer.lineSets.at(-1).length, 2, 'the Overworld: a line each');
  assert.deepEqual(r.layer.last().groups, [], 'its tags the travel view\'s marks');
  r.state.glyphs = ['mod'];
  r.frame();
  assert.deepEqual(r.layer.lineSets.at(-1), [], 'a Moderator: none');
  r.state.up = false; r.frame();
  assert.equal(r.layer.members()[0].line, '', 'nor a count');
  r.state.glyphs = ['dev']; r.state.up = true;
  foes.length = 0;
  for (let i = 0; i < 250; i++) foes.push({ puppet: 'p1', ai: { feet: [i % 20 - 10, 0, -30 - (i % 7)] } });
  r.frame();
  assert.equal(r.layer.lineSets.at(-1).length, STAFF_LINES_MAX);
});

// ── A TAG CLICK ────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 a tag click: the account by the socket in order - the room\'s word, the chat links\' rooms, the hub\'s list, the region\'s travellers, then the hub\'s search matched by socket - followed at once, and the panel handed its card to this page\'s own origin only once the follow took (mutants: each door skipped or put first, a search\'s row matched by name, the act to \'*\', the act without a follow)', () => {
  const room = peer('p1', 0, -20, { name: 'Bran', sub: 'acct-room' });
  const links = new Map([['region', { peers: new Map([['p1', { id: 'p1', sub: 'acct-link' }]]), hubOnline: new Map() }], ['world', { peers: new Map(), hubOnline: new Map([['p1', { id: 'p1', sub: 'acct-hub' }]]) }]]);
  const book = [{ id: 'p1', name: 'Bran', sub: 'acct-book' }];
  const follow = fakeFollow({ room: [room] });
  const r = rig({ follow, links, book });
  r.frame();
  const click = () => r.layer.onPick('p1');
  click();
  assert.deepEqual(follow.followed, ['acct-room'], 'the room\'s own word first');
  assert.deepEqual(r.posted.at(-1), [{ dfoStaff: 'act', act: 'follow', sub: 'acct-room', name: 'Bran' }, ORIGIN]);
  delete room.sub; click();
  assert.equal(follow.followed.at(-1), 'acct-link', 'then a chat link\'s room');
  links.get('region').peers.clear(); click();
  assert.equal(follow.followed.at(-1), 'acct-hub', 'then the hub\'s list');
  links.get('world').hubOnline.clear(); click();
  assert.equal(follow.followed.at(-1), 'acct-book', 'then the region\'s travellers');
  book.length = 0;
  // the hub's search: the box's ask, its answer matched by the socket, never the name
  const hub = links.get('world');
  hub.asks = [];
  hub.askFind = (q) => { hub.asks.push(q); return true; };
  click();
  assert.deepEqual(hub.asks, ['Bran']);
  assert.equal(follow.followed.length, 4, 'nothing followed while it is asked');
  hub.hubFound = { q: 'bran', l: [{ id: 'p-other', name: 'Bran', sub: 'acct-other' }, { id: 'p1', name: 'Bran', sub: 'acct-find' }] };
  r.frame();
  assert.equal(follow.followed.at(-1), 'acct-find', 'the row with their socket');
  hub.hubFound = null;
  click();
  assert.equal(follow.followed.at(-1), 'acct-find', 'found once, known after');
  assert.equal(hub.asks.length, 1, 'never searched again');
  // a yes the hub already gave (another tag's search of the name) is taken at once
  const r2 = rig({ follow: fakeFollow({ room: [peer('p9', 0, -20, { name: 'Tess' })] }), links: new Map([['world', { peers: new Map(), hubOnline: new Map(), hubFound: { q: 'tess', l: [{ id: 'p9', sub: 'acct-tess' }] }, askFind: () => assert.fail('no ask needed') }]]) });
  r2.frame(); r2.layer.onPick('p9');
  assert.deepEqual(r2.follow.followed, ['acct-tess']);
  // a follow that did not take hands the panel nothing; a page with no origin of its own nothing either
  const r3 = rig({ follow: fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-nope' })], refuse: 'acct-nope' }) });
  r3.frame(); r3.layer.onPick('p1');
  assert.deepEqual(r3.posted, []);
  const r4 = rig({ follow: fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-room' })] }), origin: 'null' });
  r4.frame(); r4.layer.onPick('p1');
  assert.deepEqual([r4.follow.followed, r4.posted], [['acct-room'], []], 'followed, and no card asked of a page with no origin');
});

test('STAFF-VIEW1 no account, no follow - never by name: no door knows them, no name to search, the hub\'s no (one that came after the ask), or no answer in STAFF_FIND_WAIT_MS (an ask refused too) - each said, nobody followed, nothing posted (mutants: the name followed, a stale no taken)', () => {
  const lonely = () => peer('p1', 0, -20, { name: 'Bran' });
  let r = rig({ follow: fakeFollow({ room: [lonely()] }) });
  r.frame(); r.layer.onPick('p1');
  assert.deepEqual([r.follow.followed, r.posted, r.said.length], [[], [], 1], 'no link at all');
  assert.match(r.said[0], /no account found for Bran - not followed/);
  // a nameless player: no search can go
  r = rig({ follow: fakeFollow({ room: [peer('p1', 0, -20, { name: '' })] }), links: new Map([['world', { peers: new Map(), hubOnline: new Map(), askFind: () => assert.fail('no name, no search') }]]) });
  r.frame(); r.layer.onPick('p1');
  assert.deepEqual([r.follow.followed, r.said], [[], ['Staff view: no account found for that player - not followed.']]);
  // a no from before the ask is no answer; the one after it is
  const stale = { q: 'bran', l: [] };
  const hub = { peers: new Map(), hubOnline: new Map(), hubFound: stale, askFind: () => true };
  r = rig({ follow: fakeFollow({ room: [lonely()] }), links: new Map([['world', hub]]) });
  r.frame(); r.layer.onPick('p1'); r.frame();
  assert.deepEqual([r.follow.followed, r.said], [[], []], 'waiting: the no it holds is older than the ask');
  hub.hubFound = { q: 'bran', l: [{ id: 'p-other', name: 'Bran', sub: 'acct-other' }] };
  r.frame();
  assert.deepEqual([r.follow.followed, r.posted, r.said.length], [[], [], 1], 'the hub\'s no: another Bran is not them');
  // no answer at all - the box's ask refused (its own clock, a relay with no search) is waited on the same
  hub.hubFound = null; hub.askFind = () => false;
  r = rig({ follow: fakeFollow({ room: [lonely()] }), links: new Map([['world', hub]]) });
  r.frame(); r.layer.onPick('p1');
  r.tick(STAFF_FIND_WAIT_MS - 1); r.frame();
  assert.equal(r.said.length, 0);
  r.tick(1); r.frame();
  assert.deepEqual([r.follow.followed, r.said.length], [[], 1], 'the wait out: said');
});

// ── SHIFT+M ────────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 Shift+M is staff only: a trusted Shift+M with no other modifier is the Overworld\'s (up or down) and asks the flags, its held repeat nothing; a player\'s, an untrusted one, another chord, and indoors with the view down are the automap\'s (mutants: a player\'s taken, an untrusted one taken, indoors taken, the repeat toggling)', () => {
  const press = (more = {}) => ({ code: 'KeyM', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, isTrusted: true, repeat: false, ...more });
  const player = rig({ glyphs: [] });
  assert.equal(player.host.key(press()), false);
  const panelless = rig({ follow: fakeFollow({ panel: false }) });
  assert.equal(panelless.host.key(press()), false);
  assert.deepEqual([player.toggled, panelless.toggled], [[], []]);
  const r = rig({ glyphs: ['mod'] });
  assert.equal(r.host.key(press()), true);
  assert.deepEqual([r.toggled.length, r.follow.asks], [1, 1], 'up, and the flags asked');
  assert.equal(r.host.key(press({ repeat: true })), true, 'a repeat is still its own');
  assert.equal(r.toggled.length, 1, 'and toggles nothing');
  for (const e of [press({ isTrusted: false }), press({ ctrlKey: true }), press({ altKey: true }), press({ metaKey: true }), press({ shiftKey: false }), press({ code: 'KeyN' }), null]) assert.equal(r.host.key(e), false, JSON.stringify(e));
  r.follow.modeNow = 'interior';
  assert.equal(r.host.key(press()), false, 'indoors: the automap');
  r.state.up = true;
  assert.equal(r.host.key(press()), true, 'the view up: down again');
  assert.equal(r.toggled.length, 2);
});

// ── THE OVERWORLD ──────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 marks(): a player\'s list back untouched; staff\'s player marks take a click and wear the true name (a Stranger\'s too, \'concealed\') and the flag; the players the travel view cut are marked; a mark\'s click is a follow, anything else the view\'s (mutants: a player\'s marks touched, a cut player marked twice, the Stranger\'s mask unsaid)', () => {
  const list = [
    { key: 'place:7', label: 'Daggerfall', kind: 'place', at: [0, 0, 0] },
    { key: 'peer:p1', label: 'Stranger', kind: 'stranger', at: [0, 2, -40] },
    { key: 'trav:t1', label: 'Tess', kind: 'traveller', at: [0, 2, -900], edge: true },
  ];
  const player = rig({ glyphs: [], follow: fakeFollow({ room: [peer('p1', 0, -40, { name: 'Bran' })] }) });
  assert.equal(player.host.marks(list), list, 'the same list');
  assert.equal(player.host.mark('peer:p1'), false);
  const follow = fakeFollow({
    room: [peer('p1', 0, -40, { name: 'Bran', sub: 'acct-bran' }), peer('p2', 300, -40, { name: 'Ghost', cv: 1 })],
    tags: validTags({ dist: 100, list: [{ sub: 'acct-bran', level: 'high', why: '4 reports' }, { sub: 'acct-tess', watch: true }] }),
  });
  const r = rig({ glyphs: ['dev'], follow, book: [{ id: 't1', name: 'Tess', sub: 'acct-tess' }], foes: [{ puppet: 'p1', ai: { feet: [0, 0, -41] } }] });
  const out = r.host.marks(list);
  assert.equal(out[0], list[0], 'a place untouched');
  assert.deepEqual(out[1], { key: 'peer:p1', label: 'Bran', kind: 'stranger', at: [0, 2, -40], pick: true, sub: '4 reports · 1 monster · concealed' });
  assert.deepEqual(out[2], { ...list[2], pick: true, sub: 'WATCH' });
  assert.deepEqual(out.slice(3), [{ key: 'peer:p2', at: [300, STAFF_TAG_HEAD_M, -40], label: 'Ghost', kind: 'traveller', pick: true, sub: 'concealed' }], 'the one it cut');
  assert.equal(r.host.marks([...list, { key: 'peer:p2', label: 'Ghost', at: [0, 0, 0] }]).filter((m) => m.key === 'peer:p2').length, 1, 'never twice');
  assert.equal(r.host.mark('trav:t1'), true);
  assert.deepEqual(follow.followed, ['acct-tess'], 'a far traveller by their mark\'s account');
  assert.equal(r.host.mark('place:7'), false, 'a place is the view\'s');
  assert.equal(r.host.mark('crowd:trav:t1'), false);
});

// ── THE LAYER ──────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 the layer: one button a player under a root that takes no pointer, its words written when they change; a still frame writes nothing; a crowd\'s box lists its members, each row a pick; under a window hidden, kept (mutants: every word written every frame)', () => {
  const doc = fakeDocument();
  const follow = fakeFollow({ room: [peer('p1', 0, -30, { name: 'Bran', sub: 'acct-bran' }), peer('p2', 10, -30, { name: 'Ash' })], tags: validTags({ dist: 100, list: [{ sub: 'acct-bran', level: 'high', why: '4 reports' }] }) });
  const r = rig({ follow, doc, glyphs: ['mod'] });
  r.frame();
  const root = doc.body.children[0];
  assert.equal(root.attrs['data-staff-tags'], '');
  assert.match(root.style.cssText, /pointer-events:none;z-index:12/);
  const tags = tagsIn(doc);
  assert.equal(tags.length, 2);
  const bran = tags.find((n) => n.attrs['data-staff-tag'] === 'p1');
  assert.equal(bran.tagName, 'BUTTON');
  assert.match(bran.style.cssText, /pointer-events:auto/);
  assert.deepEqual(bran.children.map((c) => c.textContent), ['Bran', '4 reports']);
  doc.zero();
  r.frame();
  assert.deepEqual([doc.writes, doc.structure, doc.built], [0, 0, 0], 'a still frame writes nothing');
  follow.roomPeers[0].shown = { ...follow.roomPeers[0].shown, x: 1 };
  r.frame();
  assert.equal(doc.built, 0, 'moved, never rebuilt');
  assert.ok(doc.writes > 0 && doc.writes <= 2, `the transform alone (${doc.writes})`);
  const press = bran.fire('click');
  assert.equal(press.stopped, true, 'the world under it hears nothing of it');
  assert.deepEqual(follow.followed, ['acct-bran']);
  // a crowd
  follow.roomPeers.push(peer('p3', 10.1, -30, { name: 'Cole', sub: 'acct-cole' }));
  r.frame();
  const box = tagsIn(doc).find((n) => n.attrs['data-staff-tag'] === 'crowd:p2');
  assert.equal(box.children[0].textContent, '2 players here');
  const rows = box.children[1].children;
  assert.deepEqual(rows.map((b) => b.children[0].textContent), ['Ash', 'Cole']);
  rows[1].fire('click');
  assert.equal(follow.followed.at(-1), 'acct-cole');
  doc.zero(); r.frame();
  assert.deepEqual([doc.writes, doc.built], [0, 0], 'a still crowd writes nothing');
  r.frame(true);
  assert.equal(root.style.display, 'none', 'under a window: hidden');
  doc.zero(); r.frame();
  assert.deepEqual([root.style.display, doc.built], ['', 0], 'back, the same elements');
});

test('STAFF-VIEW1 the layer\'s lines: one canvas, drawn only when a line moved; +N said once', () => {
  const doc = fakeDocument();
  const tags = createStaffTags({ doc, onPick: () => {} });
  tags.strokes([], 100, 100);
  assert.equal(all(doc.body).some((n) => n.tagName === 'CANVAS'), false, 'no line, no canvas');
  tags.strokes([[1, 2, 3, 4], [5, 6, 7, 8]], 100, 100);
  const cv = all(doc.body).find((n) => n.tagName === 'CANVAS');
  assert.equal(cv.ops.filter((o) => o[0] === 'lineTo').length, 2);
  assert.equal(cv.ops.filter((o) => o[0] === 'arc').length, 2, 'a dot at each monster');
  const n = cv.ops.length;
  tags.strokes([[1, 2, 3, 4], [5, 6, 7, 8]], 100, 100);
  assert.equal(cv.ops.length, n, 'unmoved: not drawn again');
  tags.strokes([], 100, 100);
  assert.equal(cv.ops.at(-1)[0], 'clearRect', 'gone: cleared');
  tags.render([], 3);
  const more = all(doc.body).find((x) => /more players/.test(x.textContent));
  assert.equal(more.textContent, '+3 more players in range');
  doc.zero(); tags.render([], 3);
  assert.equal(doc.writes, 0);
});

// ── THE FIVE SEAMS ─────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 host: the five seams - made after the follow with its getters, the names pass\'s frame, the travel view\'s marks and mark click, and Shift+M past the key ladder\'s latch (KEY-BOOT) and before its actions', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const made = w.search(/const staffView = createStaffViewHost\(\{\n\s*follow: staffFollow, glyphs: staffGlyphs, links: \(\) => chatLinks, book: travellerBook, foes: exteriorFoes,\n\s*overworld: travelViewKey, up: \(\) => !!travelView\?\.active, canvas, say: townTalk\.say,\n\s*\}\);/);
  assert.ok(made > w.indexOf('const staffFollow = staffFollowOnPage('), 'made, after the follow it reads');
  assert.match(w, /const namesOff = covered \|\| !!travelView\?\.active;\n\s*staffView\.frame\(proj, view, eye, covered\);/, 'the names pass, every mode');
  assert.match(w, /marks: \(\) => staffView\.marks\(travelViewMarks\(\)\),/);
  assert.match(w, /onMark: \(key, e\) => staffView\.mark\(key\) \|\| onTravelViewMark\(key, e\),/);
  assert.match(w, /if \(!_worldKeysLive\) return;[^\n]*\n\s*if \(\(!e\.repeat && !gamePaused\(\) && egClient\?\.key\(e\)\) \|\| \(!gamePaused\(\) && staffView\.key\(e\)\)\) \{ e\.preventDefault\(\); return; \}/, 'Shift+M, past the latch');
  assert.doesNotMatch(readFileSync(new URL('../../src/systems/inputActions.js', import.meta.url), 'utf8'), /StaffView|ShiftLeft\+KeyM/, 'no InputManager action and no default chord: a player\'s Shift is no modifier');
});
