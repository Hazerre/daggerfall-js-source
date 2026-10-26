// AUDIT GATHER (2026-10-26, Mac: "Audit the harvesting and gathering systems ensuring perfection and that nothing is
// broken"; bible/06-Systems/Professions-Arc.md section 55): THE AUDIT'S CLIENT PINS, each failing on the code before its
// fix. The service's two (F2 the Motherlode's clock, F3 the school's bound) are test/net/auditgather_service.test.js.
//   F1 - a CARRIED harvest refused at the seat (progress-seat, trade-held) is kept, asked again with its own rid; one
//        that is not carried, and a carried one refused for anything else, is let go as before.
//   F4 - the profession picker's slot: a picker the slot replaced is gone, not open.
//   F5 - an act on yesterday's node ends at the UTC day's turn: nothing asked, nothing worn, said.
//   F6 - the tug's window is the attribute band's too.
//   F7 - rain wets the herbs: rain or thunder falling narrows the steady hand's window x0.8.
//   F8 - an honest peer's beat a pose is heard at every refresh.
//   F10 - the glow's shimmer squared by hand, never pow of a negative base.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOON, OUTDOORS, rig, arrive, tick } from '../gatherRig.mjs';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { createProfBook, SEAT_REFUSALS } from '../../src/net/profBook.js';
import { MINE_ACT, HERB_ACT, tugWindow, actBand } from '../../src/net/professionLaw.js';
import { utcDayOfMs, parseNodeKey } from '../../src/net/nodeLaw.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';
import { ACT_STOPPED_LINE } from '../../src/scenes/gatherHost.js';
import { createFishAct } from '../../src/systems/fishAct.js';
import { createHerbAct } from '../../src/systems/herbAct.js';
import { herbsWet, herbKind } from '../../src/scenes/herbHost.js';
import { setHeardWeather } from '../../src/systems/weather/weatherSim.js';
import { PeerGatherSounds, GATHER_POSE_ACTS, GATHER_POSE_BEATS, PEER_GATHER_CUE_MS } from '../../src/net/peer/peerGather.js';
import { NODE_GLOW_FS } from '../../src/render/nodeGlow.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A book whose door answers `answers` in turn (the last again), carrying (a bag's hands) or not. */
function bookOf(answers, { carried = true } = {}) {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let t = 1_800_000_000_000, n = 0;
  const asked = [];
  const door = { account: () => 'acct1', harvest: async (b) => { asked.push(b); return answers[Math.min(asked.length - 1, answers.length - 1)]; } };
  const carry = {
    held: () => 0, room: () => 100,
    mint: (k, q) => ({ bag: q, pack: 0, left: 0 }), give: (k, q) => ({ bag: q, pack: 0, over: 0 }), take: () => ({ taken: 0, back: () => {} }),
  };
  const book = createProfBook({ door, storage, character: () => 'rchar1', now: () => t, rid: () => `pRID${String(++n).padStart(12, '0')}`, sleep: async () => {}, ...(carried ? { carry } : {}) });
  const harvest = () => book.harvest({ node: 'herb:300:200:20833:0', kind: 'herbs', climate: 231, region: 59, act: {}, at: Math.floor(t / 1000), material: 'p1:18' });
  return { book, asked, harvest, later: (ms) => { t += ms; } };
}

test('AUDIT GATHER F1: a CARRIED harvest the seat refuses (progress-seat, trade-held) is kept and asked again with its own rid - it may have landed with its answer lost; a harvest not carried, and a carried one refused for its own sake, is let go (mutants: the seat\'s refusals unread; the carry unasked)', async () => {
  assert.deepEqual([...SEAT_REFUSALS], ['progress-seat', 'trade-held']);
  for (const error of SEAT_REFUSALS) {
    const b = bookOf([{ ok: false, error, status: 403 }]);
    const r = await b.harvest();
    assert.deepEqual([r.ok, r.kept, r.error], [false, true, error], `${error}: kept`);
    assert.equal(b.book.pendingHarvests, 1);
    b.later(60_000);
    await b.book.pump(() => {});
    assert.equal(b.asked.length, 2, `${error}: asked again`);
    assert.equal(b.asked[1].rid, b.asked[0].rid, 'with its own rid - a landed one is answered as made');
    const plain = bookOf([{ ok: false, error, status: 403 }], { carried: false });
    const p = await plain.harvest();
    assert.deepEqual([p.ok, p.kept, plain.book.pendingHarvests], [false, undefined, 0], `${error}: a harvest not carried is the service's no`);
  }
  const own = bookOf([{ ok: false, error: 'prof-rank' }]);
  assert.equal((await own.harvest()).kept, undefined);
  assert.equal(own.book.pendingHarvests, 0, 'a carried harvest refused for its own sake is let go');
});

test('AUDIT GATHER F4: the profession picker answers again once the slot replaced it (the death screen over it) - with no window up the old one is gone, not open; a picker that is up still holds the slot (source pin: profChoose is bootWorld\'s own)', () => {
  const w = src('src/scenes/world.js');
  const at = w.indexOf('const profChoose = (rows, pick) => {');
  assert.ok(at > 0, 'profChoose stands');
  const line = w.slice(at, w.indexOf('\n', w.indexOf('\n', at) + 1));
  assert.match(line, /if \(!listPickerArtLoaded\(\) \|\| \(_profPicker && gamePaused\(\)\)\) return false;/);
  assert.doesNotMatch(line, /\|\| _profPicker\) return false/, 'a picker kept by name alone refused every one after it');
});

test('AUDIT GATHER F5: an act on yesterday\'s node ends at the UTC day\'s turn - nothing asked, the Pick-Axe unworn, the stop said; struck to its end it wore the tool and the service refused it (`prof-day`) (mutants: the day\'s turn ends nothing; the act left standing)', async () => {
  const asked = [];
  const t = await rig({ answer: (b) => { asked.push(b); return { ok: false, error: 'prof-day' }; } });
  const midnight = (Math.floor(NOON / 86_400) + 1) * 86_400;
  t.clock.ms = (midnight - 1) * 1000;   // a second before the turn
  t.host.tick(0.016);
  for (let i = 0; i < 6; i++) await tick();
  const vein = t.host.nodesOf(405, 150).find((n) => n.kind === 'mine' && n.what === 'vein');
  await arrive(t, vein);
  const pick = t.entity.items.find((it) => it.templateIndex === FT.PickAxe);
  assert.equal(parseNodeKey(vein.key).day, utcDayOfMs(t.clock.ms), 'today\'s vein');
  assert.equal(t.host.press(), true);
  for (let n = 0; n < 20 && t.host.acting(); n++) {
    t.input.v = { held: false, attack: false, choice: false };
    t.clock.ms += (MINE_ACT.swingS + 0.01) * 1000;
    t.host.tick(MINE_ACT.swingS + 0.01);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
  }
  t.input.v = { held: false, attack: false, choice: false };
  for (let i = 0; i < 10; i++) { t.host.tick(0.05); await tick(); }
  assert.equal(utcDayOfMs(t.clock.ms), parseNodeKey(vein.key).day + 1, 'the day turned under the act');
  assert.equal(t.host.acting(), false);
  t.gate.answers.forEach((f) => f());
  for (let i = 0; i < 10; i++) await tick();
  assert.deepEqual([asked.length, t.gate.answers.length], [0, 0], 'nothing asked');
  assert.equal(pick.currentCondition, 50, 'the Pick-Axe unworn');
  assert.ok(t.said.includes(ACT_STOPPED_LINE), 'the stop said');
});

test('AUDIT GATHER F6: the tug\'s window is the attribute band\'s - FORAGE0 14.4-14.5, "within 600 ms x the band" - as the haul\'s tension band already was (mutant: the band unread)', () => {
  for (const band of [actBand(0), 1, actBand(100)]) {
    for (const angler of [false, true]) assert.equal(createFishAct({ band, angler }).state.tugS, tugWindow(angler) * band, `band ${band}${angler ? ', an Angler' : ''}`);
  }
  assert.ok(createFishAct({ band: actBand(100) }).state.tugS > createFishAct({ band: actBand(0) }).state.tugS, 'a quick hand\'s window the longer');
});

test('AUDIT GATHER F7: rain wets the herbs (5.3) - rain or thunder FALLING narrows the steady hand\'s window x0.8; a turn the dry window takes bruises a wet herb; the word is the street\'s, never the sim\'s over a dry spell (mutants: the wet unread; the window unscaled; thunder dry)', () => {
  assert.equal(HERB_ACT.wet, 0.8);
  assert.deepEqual(['rain', 'thunder', 'clear', 'cloudy', 'overcast', 'fog', 'snow'].map((w) => herbsWet(w)), [true, true, false, false, false, false, false]);
  setHeardWeather('rain');
  assert.equal(herbsWet(), true, 'the street\'s rain');
  setHeardWeather('cloudy');
  assert.equal(herbsWet(), false, 'a dry spell under the sim\'s rain is dry');
  const dry = createHerbAct({ kind: 'steady' }), wet = createHerbAct({ kind: 'steady', wet: true });
  assert.equal(wet.state.window, dry.state.window * HERB_ACT.wet);
  const turn = (a, deg) => { a.tick(0.1, { view: { yaw: 0, pitch: 0 } }); a.tick(0.1, { view: { yaw: deg, pitch: 0 } }); return a.state.bruised; };
  const between = (HERB_ACT.steadyDeg + HERB_ACT.steadyDeg * HERB_ACT.wet) / 2;
  assert.deepEqual([turn(createHerbAct({ kind: 'steady' }), between), turn(createHerbAct({ kind: 'steady', wet: true }), between)], [false, true]);
  assert.equal(turn(createHerbAct({ kind: 'steady', wet: true, gentle: true }), 90), false, 'Gentle Acts still bruise nothing');
  // the host's own act: Herbalism's kind reads the fall when the Sickle's steady hand begins
  setForagingHost({ world: () => OUTDOORS });
  const kind = herbKind({ book: { track: () => ({ specs: {} }) } });
  const entity = { items: [{ templateIndex: FT.Sickle, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const begun = (word) => { setHeardWeather(word); return kind.start({ tier: 2, herb: 3, key: 'herb:1:1:1:0' }, { harvest: 'herbs' }, { entity, rank: () => 0 }).act.state.window; };
  assert.equal(begun('rain'), begun('clear') * HERB_ACT.wet, 'the patch\'s act begun in the rain');
});

/** A peer tracing a hide, a new beat every pose (sent at >= 100 ms on its own 60 Hz frames), heard on a receiver drawing
 *  at `hz` - the drawn pose the newest sent at or before the frame. */
function beatsHeard(hz, poses = 120) {
  let t = 0;
  const heard = [];
  const ears = new PeerGatherSounds({ audio: { play3d: (key) => heard.push(key) }, on: () => false, install: false, now: () => t, rand: () => 0.5 });
  const sentAt = [];
  for (let f = 0, last = -Infinity; sentAt.length < poses; f++) { const now = f * (1000 / 60); if (now - last >= 100) { sentAt.push(now); last = now; } }
  const trace = GATHER_POSE_ACTS.indexOf('trace') + 1, slice = GATHER_POSE_BEATS.indexOf('slice');
  for (let f = 0; ; f++) {
    t = 3.3 + f * (1000 / hz);
    let i = -1; while (i + 1 < sentAt.length && sentAt[i + 1] <= t) i++;
    if (i >= sentAt.length - 1 && t > sentAt[sentAt.length - 1] + 200) break;
    ears.update('p', i < 0 ? { yaw: 0 } : { yaw: 0, ga: trace, gb: ((i % 255) + 1) * 16 + slice }, [0, 0, 0], true);
  }
  return { sent: sentAt.length - 1, heard: heard.length };
}

test('AUDIT GATHER F8: an honest peer\'s beat a pose is heard at every refresh - the floor a whole pose dropped one in two at 75 Hz, measured on the receiver\'s own frames (mutant: the floor a pose again)', () => {
  assert.ok(PEER_GATHER_CUE_MS < 100);
  for (const hz of [60, 75, 120, 144, 165]) {
    const r = beatsHeard(hz);
    assert.equal(r.heard, r.sent, `${hz} Hz: ${r.heard} of ${r.sent}`);
  }
});

test('AUDIT GATHER F10: the glow\'s shimmer is squared by hand - pow of a negative base is undefined in GLSL ES 3.00 (8.2) and NaN on a driver that takes exp2(y log2 x) (mutant: pow again)', () => {
  assert.match(NODE_GLOW_FS, /float bq = \(fract\(qy - tm \* [\d.]+ \+ uSeed\) - 0\.5\) \* 8\.0;/);
  assert.match(NODE_GLOW_FS, /float band = exp\(-bq \* bq\) \* across \* up \* \(1\.0 - uStill\);/);
  for (const m of NODE_GLOW_FS.matchAll(/pow\(([^,]+),/g)) assert.match(m[1], /^max\(/, `pow's base never negative: pow(${m[1]}, ...)`);
});
