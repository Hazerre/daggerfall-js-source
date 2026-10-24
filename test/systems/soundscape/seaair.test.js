// SEA-AIR (2026-10-24, the owner: "different music and ambience sounds for sailing"; bible/08-Audio/Audio.md SOUNDSCAPE):
// THE DECK'S AIR AT SEA (systems/soundscape/seaAir.js). The laws: the sea state of the wind and the weather; the swell's
// clock; the three beds' levels and pitches (the swell's floor and gale, the wash nothing until she has way, the rigging
// only in a strong wind or a storm); the events' laws (the luff, the gulls' weather, the spray's chance, the creaks'
// gaps); the watch bells - the count each half hour of a watch, struck in pairs. The driver against a fake engine and
// seeded dice: the beds named and stopped, a slap at a crest played beside the ear and `far`, nothing on the first
// frame aboard, the luff only with sail set head to wind, the gulls only by day in fair weather with land near, the
// bells at the world's own pace only - a half hour crossed (midnight too), never a jump, never at x5, never twice in
// a minute of real time.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seaState, swellAt, swellBed, washBed, riggingBed, luffs, gullsAbout, sprayChance, creakGap, ropeGap, watchBells, bellStrokes,
  createSeaAir, SEA_BEDS, SEA_FAR, SWELL_WAVES, SWELL_CREST, SEA_STATE_FLOOR, BELL_CLIP, BELL_PITCH, BELL_MIN_REAL_S, CREAK_GAP_S, ROPE_GAP_S,
} from '../../../src/systems/soundscape/seaAir.js';
import { SCAPE_SFX } from '../../../src/systems/soundscape/soundscapeSfx.js';
import { _resetMade } from '../../../src/systems/soundscape/soundBeds.js';

/** mulberry32 - the tests' dice */
const dice = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** An engine that records: beds by name, one-shots in order, the far tags let go. */
function fakeEngine() {
  const e = {
    beds: new Map(), shots: [], faded: [], registered: new Set(),
    registerSamples(key) { e.registered.add(key); return true; },
    setBed(name, clip, o = {}) { if (clip == null) e.beds.delete(name); else e.beds.set(name, { clip, ...o }); },
    setBed3d() {},
    play3d(clip, pos, volume, o) { e.shots.push({ clip, pos, volume, ...o }); return 1; },
    fadeFar(tag) { e.faded.push(tag); },
  };
  return e;
}
const DECK = Object.freeze({ ear: [0, 0, 0], fwd: [0, 0, 1], way: 0, sailsUp: false, inIrons: false, wind: 0.4, gust: 0.7, weather: 'sunny', night: false, nearLand: false, minute: 600, timeScale: 1, paused: false });
const run = (air, seconds, s, dt = 1 / 30) => { for (let k = 0; k < Math.round(seconds / dt); k++) air.frame(dt, typeof s === 'function' ? s(k * dt) : s); };

// ── the laws ──────────────────────────────────────────────────────────

test('SEA-AIR THE SEA STATE: the floor in a flat calm, seven tenths of the wind over it, the weather\'s own - a rain\'s squalls, a storm\'s seas, snow - held to 0..1 (mutants: the floor dropped; the storm\'s share; the wind\'s share; the clamp)', () => {
  assert.equal(SEA_STATE_FLOOR, 0.15);
  const rows = [[0, 'sunny'], [0.5, 'sunny'], [1, 'sunny'], [0.5, 'rain'], [0.5, 'thunder'], [0.5, 'snow'], [1, 'thunder'], [-2, 'fog'], [NaN, 'cloudy']];
  assert.deepEqual(rows.map(([w, x]) => Math.round(seaState(w, x) * 1000) / 1000), [0.15, 0.5, 0.85, 0.62, 0.85, 0.56, 1, 0.15, 0.15]);
});

test('SEA-AIR THE SWELL\'S CLOCK: three long waves (8.3, 12.7 and 5.1 s) whose shares are the whole, summed to 0..1 about a half - no two swells alike (mutants: a wave\'s period; a share; the half dropped)', () => {
  assert.deepEqual(SWELL_WAVES.map((w) => [...w]), [[8.3, 0.55, 0], [12.7, 0.3, 1.3], [5.1, 0.15, 0.4]]);
  assert.ok(near(SWELL_WAVES.reduce((a, [, s]) => a + s, 0), 1));
  const expect = (t) => 0.5 + 0.5 * (0.55 * Math.sin((2 * Math.PI * t) / 8.3) + 0.3 * Math.sin((2 * Math.PI * t) / 12.7 + 1.3) + 0.15 * Math.sin((2 * Math.PI * t) / 5.1 + 0.4));
  for (const t of [0, 1.7, 4.2, 9.9, 33.3, 120]) assert.ok(near(swellAt(t), expect(t)), `t ${t}`);
  let lo = 1, hi = 0, crests = 0, was = swellAt(0);
  for (let t = 0.05; t < 600; t += 0.05) { const v = swellAt(t); lo = Math.min(lo, v); hi = Math.max(hi, v); if (was < SWELL_CREST && v >= SWELL_CREST) crests++; was = v; }
  assert.ok(lo >= 0 && hi <= 1 && hi > SWELL_CREST && lo < 0.2, `${lo} ${hi}`);
  assert.ok(crests > 40 && crests < 110, `a crest every 5 to 15 s over ten minutes: ${crests}`);
});

test('SEA-AIR THE BEDS: the swell from its floor in a calm to its gale\'s, riding the swell; the wash nothing until she has way and all of it at full way; the rigging nothing below a strong wind, a storm adding its own, breathing with the gust (mutants: the swell\'s depth; the wash\'s threshold; the rigging\'s threshold; the storm\'s share)', () => {
  const { min, max, depth } = SEA_BEDS.swell;
  assert.deepEqual([min, max, depth], [0.05, 0.26, 0.55]);
  const t = 3.1, s = swellAt(t);
  assert.ok(near(swellBed(0, t).volume, min * (1 - depth + depth * s)));
  assert.ok(near(swellBed(1, t).volume, max * (1 - depth + depth * s)));
  assert.ok(swellBed(0.6, 0).pitch > swellBed(0.1, 0).pitch, 'a heavier sea rolls deeper and wider');
  assert.deepEqual([SEA_BEDS.wash.max, SEA_BEDS.wash.from, SEA_BEDS.wash.full], [0.2, 0.4, 7]);
  assert.equal(washBed(0, 0.5, 2).volume, 0, 'no way, no wash');
  assert.equal(washBed(0.3, 0.5, 2).volume, 0, 'steerage way is not yet a wash');
  assert.equal(washBed(SEA_BEDS.wash.from, 0.5, 2).volume, 0, 'the threshold itself is silent');
  assert.ok(washBed(SEA_BEDS.wash.full, 1, 1.7).volume > washBed(3, 1, 1.7).volume && washBed(3, 1, 1.7).volume > 0);
  assert.ok(near(washBed(SEA_BEDS.wash.full, 1, 1.7).volume, SEA_BEDS.wash.max * (0.75 + 0.25 * swellAt(0))), 'full way: the max, riding the swell a beat behind');
  assert.equal(riggingBed(0.5, 1, 'sunny').volume, 0, 'a fresh breeze does not moan in the lines');
  assert.ok(riggingBed(0.5, 1, 'thunder').volume > 0, 'a storm does');
  assert.ok(near(riggingBed(1, 1, 'sunny').volume, SEA_BEDS.rigging.max), 'a full gale at its height: the max');
  assert.ok(riggingBed(1, 0, 'sunny').volume < riggingBed(1, 1, 'sunny').volume, 'the gust');
});

test('SEA-AIR THE EVENTS\' LAWS: the canvas luffs with sail set head to wind, or with no way in a wind to shake it; the gulls by day out of rain, storm and snow with land near; spray at speed through a sea; the timbers more often as the sea gets up, the ropes with sail set (mutants: the irons arm; the gulls\' rain; the spray\'s way; the creak\'s storm gap; the ropes furled)', () => {
  assert.deepEqual([
    luffs({ sailsUp: true, inIrons: true, way: 5, wind: 0 }), luffs({ sailsUp: true, inIrons: false, way: 0.2, wind: 0.5 }),
    luffs({ sailsUp: true, inIrons: false, way: 3, wind: 0.5 }), luffs({ sailsUp: false, inIrons: true, way: 0, wind: 1 }),
    luffs({ sailsUp: true, inIrons: false, way: 0.2, wind: 0.1 }),
  ], [true, true, false, false, false]);
  assert.deepEqual(['sunny', 'cloudy', 'fog', 'rain', 'thunder', 'snow'].map((weather) => gullsAbout({ nearLand: true, night: false, weather })), [true, true, true, false, false, false]);
  assert.equal(gullsAbout({ nearLand: true, night: true, weather: 'sunny' }), false);
  assert.equal(gullsAbout({ nearLand: false, night: false, weather: 'sunny' }), false);
  assert.equal(sprayChance(2.5, 1), 0);
  assert.equal(sprayChance(8, 0.3), 0);
  assert.ok(near(sprayChance(5.5, 0.8), 0.5 * 0.8));
  assert.equal(sprayChance(20, 1), 1);
  assert.deepEqual([creakGap(0), creakGap(1), creakGap(0.5)].map((g) => Math.round(g * 1e6) / 1e6), [16, 3.2, 9.6]);
  assert.deepEqual([CREAK_GAP_S.calm, CREAK_GAP_S.storm], [16, 3.2]);
  assert.deepEqual([ropeGap(true, 0), ropeGap(true, 1), ropeGap(false, 1)].map((g) => Math.round(g * 1e6) / 1e6), [12, 3.5, 30]);
  assert.deepEqual([ROPE_GAP_S.calm, ROPE_GAP_S.gale, ROPE_GAP_S.furled], [12, 3.5, 30]);
});

test('SEA-AIR THE WATCH BELLS: one at the half hour after a watch begins (the watches turning at 0, 4, 8, 12, 16 and 20), one more each half hour, eight as it ends; struck in pairs, an odd bell alone at the end (mutants: the watch\'s length; the eight at the turn; the pair\'s gap)', () => {
  const day = Array.from({ length: 48 }, (_, h) => watchBells(h * 30));
  assert.deepEqual(day.slice(0, 9), [8, 1, 2, 3, 4, 5, 6, 7, 8]);
  for (let w = 0; w < 6; w++) assert.deepEqual(day.slice(w * 8, w * 8 + 8), [8, 1, 2, 3, 4, 5, 6, 7], `watch ${w}`);
  assert.equal(watchBells(1439), 7, 'the middle watch\'s last half hour');
  assert.equal(watchBells(-30), 7, 'a minute before the day wraps');
  assert.deepEqual(bellStrokes(5).map((t) => Math.round(t * 100) / 100), [0, 0.42, 1.15, 1.57, 2.3]);
  assert.deepEqual(bellStrokes(8).length, 8);
  assert.deepEqual(bellStrokes(0), []);
  assert.deepEqual([BELL_CLIP, BELL_PITCH, BELL_MIN_REAL_S], [107, 1.22, 60]);
});

// ── the driver ────────────────────────────────────────────────────────

test('SEA-AIR THE DRIVER\'S BEDS: the swell, the wash and the rigging named on the engine and made first (soundBeds.js), their levels the laws\'; stop lets every bed go and the deck\'s far shots with it, once (mutants: a bed never let go; the far shots kept; a second stop)', () => {
  _resetMade();
  const e = fakeEngine();
  const air = createSeaAir({ engine: e, rand: dice(1) });
  run(air, 2, { ...DECK, way: 6, wind: 1, weather: 'thunder' });
  assert.deepEqual([...e.beds.keys()].sort(), ['sea:rigging', 'sea:swell', 'sea:wash']);
  assert.ok([...e.registered].includes('sea:swell'));
  assert.equal(e.beds.get('sea:swell').clip, 'sea:swell');
  air.stop();
  assert.deepEqual([...e.beds.keys()], [], 'every bed let go');
  assert.deepEqual(e.faded, [SEA_FAR]);
  air.stop();
  assert.deepEqual(e.faded, [SEA_FAR], 'a second stop sends nothing');
  run(air, 1, { ...DECK, way: 0, wind: 0.2 });
  assert.equal(e.beds.has('sea:wash'), false, 'no way, no wash bed at all');
  assert.equal(e.beds.has('sea:rigging'), false, 'a light wind, no rigging');
});

test('SEA-AIR THE DRIVER\'S EVENTS: nothing on the first frame aboard; a crest\'s slap beside the ear below the rail, `far`; the timbers over a minute in a heavy sea; spray only at speed; the luff only with sail set head to wind; the ropes only with sail set; the gulls only with land near by day in fair weather (mutants: the clocks unseeded; the slap\'s side; the luff\'s law; the gulls\' law)', () => {
  const e = fakeEngine();
  const air = createSeaAir({ engine: e, rand: dice(7) });
  air.frame(1 / 30, { ...DECK, wind: 1, weather: 'thunder', sailsUp: true, inIrons: true, nearLand: true });
  assert.deepEqual(e.shots, [], 'the first frame aboard plays nothing');
  run(air, 90, { ...DECK, wind: 1, weather: 'thunder', way: 0 });
  const of = (group) => e.shots.filter((s) => SCAPE_SFX[group].includes(s.clip));
  assert.ok(of('seaSlap').length >= 6, `slaps at the crests: ${of('seaSlap').length}`);
  for (const s of of('seaSlap')) {
    assert.equal(s.far, SEA_FAR);
    assert.ok(near(s.pos[1], -1.6, 1e-9) && Math.abs(s.pos[0]) >= 2.5 && Math.abs(s.pos[0]) <= 4 && near(s.pos[2], 0, 1e-9), `beside the ear, under the rail: ${s.pos}`);
  }
  assert.ok(of('seaCreak').length >= 10, `the timbers in a storm: ${of('seaCreak').length}`);
  assert.equal(of('seaSpray').length, 0, 'no way, no spray');
  assert.equal(of('seaLuff').length, 0, 'no sail set, no luff');
  assert.equal(of('seaRope').length, 0, 'no sail set, no ropes');
  assert.equal(of('gull').length, 0, 'no land near, no gulls');
  e.shots.length = 0;
  run(air, 60, { ...DECK, wind: 0.9, weather: 'sunny', way: 9, sailsUp: true, inIrons: true, nearLand: true });
  assert.ok(of('seaSpray').length >= 1, 'at speed through a sea');
  assert.ok(of('seaLuff').length >= 15, `head to wind the canvas shakes: ${of('seaLuff').length}`);
  for (const s of of('seaLuff')) assert.ok(s.pos[1] >= 4 && s.pos[1] <= 7, 'aloft');
  assert.ok(of('seaRope').length >= 4, `the ropes with sail set: ${of('seaRope').length}`);
  assert.ok(of('gull').length >= 2, `the gulls: ${of('gull').length}`);
  for (const s of of('gull')) assert.ok(s.pos[1] >= 12 && s.pos[1] <= 30 && Math.hypot(s.pos[0], s.pos[2]) >= 22 && Math.hypot(s.pos[0], s.pos[2]) <= 70, 'over the water, off the ship');
  e.shots.length = 0;
  run(air, 120, { ...DECK, night: true, nearLand: true });
  assert.equal(of('gull').length, 0, 'none at night');
  run(air, 120, { ...DECK, weather: 'rain', nearLand: true });
  assert.equal(of('gull').length, 0, 'none in the rain');
});

test('SEA-AIR THE DRIVER\'S BELLS: a half hour of the world\'s clock crossed at its own pace strikes the watch\'s count on Daggerfall\'s bell, ahead of the ear and aloft, in pairs; midnight\'s eight; none at a time dial past x1, none for a jump, none twice inside BELL_MIN_REAL_S (mutants: the wrap; the dial\'s gate; the jump\'s gate; the real-time gap)', () => {
  const strokes = (frames) => {
    const e = fakeEngine();
    const air = createSeaAir({ engine: e, rand: dice(3) });
    for (const [minute, timeScale = 1, secs = 4] of frames) run(air, secs, { ...DECK, minute, timeScale });
    return e.shots.filter((s) => s.clip === BELL_CLIP);
  };
  const one = strokes([[29.9], [30.1]]);
  assert.equal(one.length, 1, 'the half hour after the watch began: one bell');
  assert.deepEqual([one[0].pitch, one[0].far, one[0].pos[2] > 0, one[0].pos[1]], [BELL_PITCH, SEA_FAR, true, 2.5]);
  assert.equal(strokes([[239.5], [240.2]]).length, 8, 'the watch ends at four: eight bells');
  assert.equal(strokes([[1439.5], [0.4]]).length, 8, 'midnight wraps the minute of the day and still strikes eight');
  assert.equal(strokes([[89.5, 5], [90.5, 5]]).length, 0, 'a time dial past x1 rings nothing');
  assert.equal(strokes([[30.5], [150.5]]).length, 0, 'a jump of the clock is not a half hour struck');
  assert.equal(strokes([[29.9, 1, 1], [30.1, 1, 1], [59.9, 1, 1], [60.1, 1, 4]]).length, 1, 'never twice inside a minute of real time');
  assert.equal(strokes([[29.9, 1, 1], [30.1, 1, 61], [59.9, 1, 1], [60.1, 1, 4]]).length, 3, 'a minute on: the next half hour\'s two');
});
