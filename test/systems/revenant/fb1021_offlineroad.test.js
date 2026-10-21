// FIELD BUGS 2026-10-21 OFFLINE-ROAD (bible/01-Overview/bugs/Field-Bugs-2026-10-21.md), the Discord's #feature-feedback,
// Shines: "I understand not letting fast travel or loitering allow for the instant spamming of missions, but I'd like to
// see them at least progress on the real time bar when offline. It'd be a nice thing to send my single buddy out for when
// logging off to deal with IRL." Online an errand ran on the lived step alone (AUDIT RVN F1): the character's own clock
// stands while they are away, so a sworn one sent off at a logout came back no nearer. It keeps the WORLD's time now
// (revenantErrands.js errandOnWorld): its `due` is the world's minute it is back, and the world's clock runs on the wall
// whoever plays - so time away carries it on, and a rest, a Loiter or a journey (a raise of the character's own clock)
// still never does. Until the relay's clock is heard the lived step carries it, as before (rvnerrand.test.js F1).
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const E = await import('../../../src/systems/revenant/revenantErrands.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const WT = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { ONLINE_MINUTES_PER_MS } = await import('../../../src/net/wire.js');
const { MINUTES_PER_DAY } = await import('../../../src/systems/gameDate.js');
const { drawCompanionsPage, _resetCompanionRosterForTests, _setCompanionRosterIconForTests } = await import('../../../src/ui/companionRoster.js');

const DAY = 1440, T0 = DAY * 10;
let me;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); WT.setSharedClock(null);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-offlineroad', level: 12, health: 100, maxHealth: 100, items: [], goldPieces: 0 };
  RC.setRetinuePlayer(me);
  WT.setWorldMinutes(T0);
  N.setRevenantPresenter(() => true);
});
function sworn({ rank = 5, state = 'away', loyalty = 95 } = {}) {
  const r = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank;
  const s = N.revenantSpared(me, { revenant: { id: r.id } }, { state });
  s.companion.loyalty = loyalty;
  return s;
}
const rec = (r) => N.revenantById(r.id);
const party = () => RC.revenantParty();
const own = () => Math.floor(WT.ownMinutes());
/** Online, the relay's clock heard (worldTick.js hearSharedClock - trustedWorldMinutes answers from then). */
function online(clock) { WT.setSharedClock(() => clock.world); WT.hearSharedClock(); }

test('OFFLINE-ROAD THE LAW: an errand on the world\'s time - its minute as many past the character\'s as the world has left to its `due`; one with no `due` takes its minutes left from the world\'s now; held to its road\'s days from the world\'s now, and never before it set out; sent online it carries its `due`, and a save keeps it (mutants: the due unread; the clamp gone; the due unkept)', () => {
  const r = sworn();
  const e = E.newErrand(rec(r), 'Hammerfell', 'plunder', T0, 1, T0 + 500);
  assert.deepEqual([e.until - e.at, e.due], [DAY, T0 + 500 + DAY], 'the world\'s minute it is back');
  assert.equal(E.newErrand(rec(r), 'Hammerfell', 'plunder', T0, 1).due, undefined, 'offline none');
  assert.deepEqual(E.sanitizeErrand(JSON.parse(JSON.stringify(e))).due, e.due, 'the save keeps it');
  // the character's clock raised ten days, the world's an hour on: an hour less to go, whatever the raise
  assert.deepEqual(E.errandOnWorld(e, T0 + 10 * DAY, T0 + 560), { due: e.due, until: T0 + 10 * DAY + DAY - 60 });
  // the world past it: back now
  assert.deepEqual(E.errandOnWorld(e, T0 + 5, e.due + 3000), { due: e.due, until: T0 + 5 });
  // no `due` (sent before the relay's clock was heard): its minutes left from the world's now
  const old = { ...e }; delete old.due;
  assert.deepEqual(E.errandOnWorld({ ...old, until: T0 + 900 }, T0 + 100, 7000), { due: 7800, until: T0 + 900 });
  // a `due` past its road's days from the world's now (a clock behind it) is held to them
  assert.deepEqual(E.errandOnWorld({ ...e, due: T0 + 9 * DAY }, T0, T0), { due: T0 + DAY, until: T0 + DAY });
  // never before it set out (the character's clock behind its own start)
  assert.equal(E.errandOnWorld(e, T0 - 400, e.due - 100).until, T0, 'a hundred minutes left, from four hundred before its start');
});

test('OFFLINE-ROAD THE ROAD WHILE AWAY: online, sent at a logout and loaded again a real day later, a one-day errand is back at the first frame - the world\'s minutes while the character\'s clock stood; half away, half left; ten days raised carry it on not a minute (mutants: the world unread online; the lived step kept once heard)', () => {
  const clock = { world: T0 };
  online(clock);
  WT.setOwnMinutes(T0);
  const r = sworn();
  assert.equal(RC.sendOnErrand(r.id, 'Hammerfell', 'plunder', { now: T0, seed: 1 }), null);
  assert.equal(rec(r).companion.errand.due, T0 + DAY, 'sent online: its world\'s minute');
  // a rest, a Loiter or a journey: the character's clock raised ten days, the world's not moved - not a minute carried
  for (let d = 0; d < 10; d++) { WT.advanceOwnMinutes(DAY); party().wake(own()); }
  assert.equal(rec(r).companion.state, 'errand', 'ten days raised: still abroad');
  assert.equal(rec(r).companion.errand.until - own(), DAY, 'a whole day still to go');
  // the logout: the save as it stands; away half a real day (the world's clock on, the character's standing)
  const saved = JSON.parse(JSON.stringify(modSaveRecords())), ownAtSave = own();
  RC.forgetSwornMember(null);   // the load forgets the last wake's reading
  clock.world += DAY / 2;
  WT.setSharedClock(null); online(clock);   // a new session: the relay's clock heard again
  restoreModSaveRecords(saved); WT.setOwnMinutes(ownAtSave);
  party().wake(own());
  assert.equal(rec(r).companion.state, 'errand', 'half away: still abroad');
  assert.equal(rec(r).companion.errand.until - own(), DAY / 2, 'half the road left');
  // the other half away
  RC.forgetSwornMember(null);
  clock.world += DAY / 2;
  restoreModSaveRecords(saved); WT.setOwnMinutes(ownAtSave);
  party().wake(own());
  assert.notEqual(rec(r).companion.state, 'errand', 'a real day away: back at the first frame');
  assert.equal(rec(r).companion.errand, null);
});

test('OFFLINE-ROAD BEFORE THE RELAY IS HEARD the lived step carries an errand, as AUDIT RVN F1 did - and once heard the world\'s minute it takes is its minutes left then', () => {
  const clock = { world: T0 };
  WT.setSharedClock(() => clock.world);   // installed, not yet heard
  WT.setOwnMinutes(T0);
  const r = sworn();
  RC.sendOnErrand(r.id, 'Hammerfell', 'plunder', { now: T0, seed: 1 });
  assert.equal(rec(r).companion.errand.due, undefined, 'no trusted world: no due');
  party().wake(own());
  WT.advanceOwnMinutes(3 * DAY); party().wake(own());
  assert.equal(rec(r).companion.errand.until - own(), DAY, 'a raise pushed back whole');
  WT.hearSharedClock();
  party().wake(own());
  assert.equal(rec(r).companion.errand.due, clock.world + DAY, 'heard: its day left, on the world\'s clock');
});

test('OFFLINE-ROAD THE PAGE: online the sheet says a mission keeps real time - on while away, two real hours a day abroad (the wire\'s rate), no rest speeding it; offline it says nothing of it', () => {
  assert.equal(MINUTES_PER_DAY / ONLINE_MINUTES_PER_MS / 3_600_000, 2, 'a day abroad: two real hours');
  _resetCompanionRosterForTests();
  _setCompanionRosterIconForTests(() => ({ src: 'data:x', w: 30, h: 40 }));
  globalThis.document = undefined;
  sworn({ state: 'with' });
  const draw = () => { const d = el('div', 'px-qdetail'); drawCompanionsPage(d, () => {}, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('div', 'px-meter', `${n}/${m}`), here: () => null, kindName: () => 'Orc' }); return d; };
  buttons(draw(), 'Mission')[0].onclick();
  assert.doesNotMatch(draw().textContent, /real time/, 'offline: DFU\'s one clock');
  online({ world: T0 });
  assert.match(draw().textContent, /Online, a mission keeps real time: it goes on while you're away, two real hours for each day abroad\. Resting, waiting or traveling doesn't speed it up\./);
});

// ── the page's fake document (rvnerrand.test.js's) ────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
function el(t, cls, text) { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function buttons(root, label) { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; }
