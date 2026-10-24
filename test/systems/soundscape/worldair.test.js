// WORLD-AIR (2026-10-24, the owner: "... and whatever else we could improve"; bible/08-Audio/Audio.md SOUNDSCAPE): THE OPEN
// WORLD'S AIR past DFU's four presets (systems/soundscape/worldAir.js). The shore: the surf's reach and its breaker's
// clock, the lap close in on a quiet sea. The wild: each climate's voices by day and by night as the weather, the winter
// and a town's walls leave them; a marsh's insects. The town: its murmur by the hour, its size and the weather; a smith
// at work; a tavern's evening. The driver against a fake engine and seeded dice: the surf at the edge and a crash as each
// wave breaks, nothing past its reach; the wild's calls `far` where its voices are; the town's beds made of the player's
// own people (never shipped) and its anvil at the smithy's door by day only; stop lets everything go.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  surfReach, breakerAt, surfGain, surfEdgeGain, lapGain, wildVoicesFor, marshGain, murmurGain, smithAtWork, tavernGain, createWorldAir, ensureTownBeds,
  SURF, LAP, MARSH, MURMUR, MURMUR_WEATHER, SMITHY, TAVERN, BREAKER_CURL_S, CRASH_REACH, TOWN_WILD_GAP, WORLD_FAR, WILD,
} from '../../../src/systems/soundscape/worldAir.js';
import { SCAPE_SFX } from '../../../src/systems/soundscape/soundscapeSfx.js';
import { _resetMade } from '../../../src/systems/soundscape/soundBeds.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';
import { PEOPLE_RECORDS } from '../../../src/systems/arena/arenaSound.js';

const dice = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r3 = (v) => Math.round(v * 1000) / 1000;
/** A voice's kind and its gap, for a table. */
const brief = (list) => list.map((v) => `${v.kind}:${v.gap[0]}-${v.gap[1]}`);

function fakeEngine({ people = true } = {}) {
  const e = {
    beds: new Map(), beds3d: new Map(), shots: [], faded: [], registered: new Map(),
    registerSamples(key, samples, rate) { e.registered.set(key, [samples.length, rate]); return true; },
    samplesOf(i) { return people && PEOPLE_RECORDS.includes(i) ? Float32Array.from({ length: 4000 }, (_, k) => Math.sin(k * (0.05 + i * 1e-4)) * 0.3) : null; },
    setBed(name, clip, o = {}) { if (clip == null) e.beds.delete(name); else e.beds.set(name, { clip, ...o }); },
    setBed3d(name, clip, pos, o = {}) { if (clip == null) e.beds3d.delete(name); else e.beds3d.set(name, { clip, pos, ...o }); },
    play3d(clip, pos, volume, o) { e.shots.push({ clip, pos, volume, ...o }); return 1; },
    fadeFar(tag) { e.faded.push(tag); },
  };
  return e;
}
const LAND = Object.freeze({ ear: [0, 0, 0], climate: CLIMATES.Woodlands, night: false, hour: 12, weather: 'sunny', wind: 0.4, winter: false, inTown: false, townBlocks: 1, shore: null, smithies: [], taverns: [], paused: false });
const run = (air, seconds, w, dt = 1 / 30) => { for (let k = 0; k < Math.round(seconds / dt); k++) air.frame(dt, w); };

// ── the shore ─────────────────────────────────────────────────────────

test('WORLD-AIR THE SURF\'S REACH: whole within 8 m of the edge, falling away past it, eased to nothing over the last 40 m of its 220 - never a step - and none past it; the breaker curling up from the surf\'s floor to its crash at BREAKER_CURL_S, running back to the floor (mutants: the reach; the full; the ease; the curl\'s length; the floor)', () => {
  assert.deepEqual([SURF.reach, SURF.full, SURF.floor, SURF.max, BREAKER_CURL_S], [220, 8, 0.22, 0.3, 0.9]);
  assert.deepEqual([0, 8, 20, 50, 100, 180, 200, 219.9, 220, 500, NaN].map((d) => r3(surfReach(d))), [1, 1, 0.75, 0.315, 0.124, 0.053, 0.022, 0, 0, 0, 0]);
  let was = surfReach(0);
  for (let d = 0.5; d < 230; d += 0.5) { const v = surfReach(d); assert.ok(v <= was + 1e-12, `falling at ${d}`); assert.ok(was - v < 0.06, `no step at ${d}`); was = v; }
  assert.equal(r3(breakerAt(0, 9)), SURF.floor);
  assert.equal(r3(breakerAt(BREAKER_CURL_S, 9)), 1, 'the crash');
  assert.ok(breakerAt(0.45, 9) > SURF.floor && breakerAt(0.45, 9) < 0.5, 'curling up');
  assert.ok(breakerAt(3, 9) < 0.5 && breakerAt(8.9, 9) - SURF.floor < 0.02, 'running back to the floor');
  assert.equal(r3(surfGain(5, 1, 1)), SURF.max);
  assert.equal(r3(surfGain(5, 0, 1)), r3(SURF.max * 0.4), 'a calm sea breaks gently');
  assert.equal(surfEdgeGain(SURF.reach, 1, 1), 0);
  assert.equal(r3(surfEdgeGain(30, 1, 1)), SURF.max, 'at the edge the panner takes the distance');
  assert.equal(lapGain(5, 0.7), 0, 'a heavy sea, no lap');
  assert.equal(lapGain(LAP.reach, 0.1), 0);
  assert.equal(r3(lapGain(0, 0)), LAP.max);
});

// ── the wild ──────────────────────────────────────────────────────────

test('WORLD-AIR THE WILD BY CLIMATE: the woods\' crows by day and owls and a far wolf by night, the mountains\' wolves more often, the haunted woods\' crows often, the swamp\'s and the rainforest\'s frogs (a chorus at night), the desert\'s far howl at night, nothing over the ocean (mutants: a climate\'s row; the chorus; the desert\'s day)', () => {
  const at = (climate, night) => brief(wildVoicesFor(climate, { night, weather: 'sunny', winter: false, inTown: false }));
  assert.deepEqual(at(CLIMATES.Woodlands, false), ['crow:25-70']);
  assert.deepEqual(at(CLIMATES.Woodlands, true), ['owl:25-60', 'howl:90-240']);
  assert.deepEqual(at(CLIMATES.Mountain, true), ['howl:45-120', 'owl:60-150']);
  assert.deepEqual(at(CLIMATES.HauntedWoodlands, false), ['crow:14-40']);
  assert.deepEqual(at(CLIMATES.Swamp, false), ['frog:8-25']);
  assert.deepEqual(at(CLIMATES.Swamp, true), ['frog:1.5-6', 'owl:60-150']);
  assert.deepEqual(at(CLIMATES.Desert, false), []);
  assert.deepEqual(at(CLIMATES.Desert2, true), ['jackal:120-300']);
  assert.deepEqual(at(CLIMATES.Ocean, true), []);
  assert.equal(WILD[CLIMATES.Swamp].night[0].chorus, 3);
  assert.deepEqual(wildVoicesFor(CLIMATES.Woodlands, { night: true, weather: 'sunny', winter: false, inTown: false }).map((v) => v.id), ['night:0', 'night:1']);
});

test('WORLD-AIR THE WEATHER, THE WINTER AND THE WALLS: rain quiets the crows and the owls and makes the frogs croak twice as often, the wolf still howls; a storm leaves only the frogs; snow and the winter take the frogs; inside a town no wolf and no frog, and the rest TOWN_WILD_GAP times further between (mutants: the rain\'s frogs; the storm\'s wolf; the winter\'s frogs; the town\'s gap)', () => {
  const v = (climate, now) => brief(wildVoicesFor(climate, { night: false, weather: 'sunny', winter: false, inTown: false, ...now }));
  assert.deepEqual(v(CLIMATES.Woodlands, { weather: 'rain' }), []);
  assert.deepEqual(v(CLIMATES.Woodlands, { weather: 'rain', night: true }), ['howl:90-240']);
  assert.deepEqual(v(CLIMATES.Swamp, { weather: 'rain', night: true }), ['frog:0.75-3']);
  assert.deepEqual(v(CLIMATES.Woodlands, { weather: 'thunder', night: true }), []);
  assert.deepEqual(v(CLIMATES.Swamp, { weather: 'thunder', night: true }), ['frog:0.75-3']);
  assert.deepEqual(v(CLIMATES.Swamp, { night: true, winter: true }), ['owl:60-150']);
  assert.deepEqual(v(CLIMATES.Swamp, { night: true, weather: 'snow' }), ['owl:60-150']);
  assert.equal(TOWN_WILD_GAP, 3);
  assert.deepEqual(v(CLIMATES.Woodlands, { night: true, inTown: true }), ['owl:75-180']);
  assert.deepEqual(v(CLIMATES.Woodlands, { inTown: true }), ['crow:75-210']);
  assert.deepEqual(v(CLIMATES.Desert, { night: true, inTown: true }), []);
  assert.deepEqual([MARSH.day, MARSH.night], [0.08, 0.13]);
  const m = (climate, now) => r3(marshGain(climate, { night: false, weather: 'sunny', winter: false, inTown: false, ...now }));
  assert.deepEqual([m(CLIMATES.Swamp, {}), m(CLIMATES.Rainforest, { night: true }), m(CLIMATES.Swamp, { inTown: true }), m(CLIMATES.Swamp, { winter: true }), m(CLIMATES.Swamp, { weather: 'thunder' }), m(CLIMATES.Woodlands, {})], [0.08, 0.13, 0, 0, 0.032, 0]);
});

// ── the town ──────────────────────────────────────────────────────────

test('WORLD-AIR THE TOWN\'S HOURS: the murmur from half past six, rising to the busy hours (10 to 17), falling to half past nine and none after, as loud as the root of the town\'s size (16 blocks its whole) and the weather leaves the street; a smith at the anvil from 7 to 19; a tavern\'s evening from 17 to 2 (mutants: the open; the busy hours; the size\'s root; the rain; the smith\'s day; the tavern\'s evening)', () => {
  assert.deepEqual([MURMUR.max, MURMUR.open, MURMUR.close, [...MURMUR.busy], MURMUR.blocks], [0.22, 6.5, 21.5, [10, 17], 16]);
  assert.deepEqual([5, 6.5, 8, 10, 13, 17, 19, 21.4, 21.5, 23].map((h) => r3(murmurGain(h, 16, 'sunny'))), [0, 0, 0.094, 0.22, 0.22, 0.22, 0.122, 0.005, 0, 0]);
  assert.equal(r3(murmurGain(12, 4, 'sunny')), r3(0.22 * 0.5), 'a quarter the blocks, half the people');
  assert.equal(r3(murmurGain(12, 64, 'sunny')), 0.22, 'a city at its whole, no louder');
  assert.deepEqual(MURMUR_WEATHER, { rain: 0.45, thunder: 0.2, snow: 0.6 });
  assert.equal(r3(murmurGain(12, 16, 'rain')), r3(0.22 * 0.45));
  assert.equal(r3(murmurGain(36, 16, 'sunny')), 0.22, 'the hour wraps');
  assert.deepEqual([6.9, 7, 12, 18.9, 19, 23].map(smithAtWork), [false, true, true, true, false, false]);
  assert.deepEqual([12, 16.9, 17, 23, 1.9, 2, 3].map(tavernGain), [TAVERN.day, TAVERN.day, TAVERN.night, TAVERN.night, TAVERN.night, TAVERN.day, TAVERN.day]);
  assert.deepEqual([SMITHY.reach, TAVERN.reach], [45, 35]);
});

// ── the driver ────────────────────────────────────────────────────────

test('WORLD-AIR THE DRIVER\'S SHORE: the surf a bed AT the edge when its bearing is known (flat when it is not, never both), breaking on its clock with a crash at the edge while it is near, nothing past its reach; the lap close in on a quiet day (mutants: the crash\'s reach; both beds at once; the surf past its reach)', () => {
  _resetMade();
  const e = fakeEngine();
  const air = createWorldAir({ engine: e, rand: dice(5) });
  run(air, 40, { ...LAND, shore: { dist: 30, dir: [1, 0] }, wind: 0.9, weather: 'rain' });
  const surf = e.beds3d.get(SURF.name);
  assert.ok(surf && surf.clip === SURF.bed && surf.pos[0] === 30 && surf.pos[2] === 0 && surf.volume > 0, JSON.stringify(surf));
  assert.equal(e.beds.has(SURF.name), false, 'never flat and at the edge at once');
  const crashes = e.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip));
  assert.ok(crashes.length >= 3 && crashes.length <= 7, `a wave every 5 to 11 s: ${crashes.length}`);
  assert.ok(crashes.every((s) => s.pos[0] === 30 && s.far === WORLD_FAR));
  e.shots.length = 0;
  assert.equal(CRASH_REACH, 90);
  run(air, 30, { ...LAND, shore: { dist: 120, dir: [1, 0] } });
  assert.equal(e.shots.filter((s) => SCAPE_SFX.shoreCrash.includes(s.clip)).length, 0, 'too far for the crash to be told from the surf');
  run(air, 2, { ...LAND, shore: { dist: 150, dir: null } });
  assert.ok(e.beds.get(SURF.name)?.volume > 0 && !e.beds3d.has(SURF.name), 'no bearing: flat');
  run(air, 2, { ...LAND, shore: { dist: 400, dir: [1, 0] } });
  assert.equal(e.beds.has(SURF.name) || e.beds3d.has(SURF.name), false, 'past the reach: none');
  run(air, 2, { ...LAND, shore: { dist: 3, dir: [0, 1] }, wind: 0 });
  assert.ok(e.beds.get(LAP.name)?.volume > 0, 'close in on a quiet sea: the lap');
});

test('WORLD-AIR THE DRIVER\'S WILD: a woodland night\'s owls near and wolves far, played `far` about the ear at their distances; a swamp night\'s frogs in choruses at the reeds; a woodland day\'s crow; the marsh\'s bed in the swamp alone (mutants: the wolf\'s distance; the chorus; the marsh\'s bed)', () => {
  const e = fakeEngine();
  const air = createWorldAir({ engine: e, rand: dice(11) });
  run(air, 600, { ...LAND, night: true, hour: 23 });
  const owls = e.shots.filter((s) => SCAPE_SFX.owl.includes(s.clip)), wolves = e.shots.filter((s) => SCAPE_SFX.howl.includes(s.clip));
  assert.ok(owls.length >= 6, `owls: ${owls.length}`);
  assert.ok(wolves.length >= 2, `wolves: ${wolves.length}`);
  for (const s of owls) assert.ok(Math.hypot(s.pos[0], s.pos[2]) <= 55 && s.far === WORLD_FAR);
  for (const s of wolves) assert.ok(Math.hypot(s.pos[0], s.pos[2]) >= 160 && s.refDistance === 60);
  assert.equal(e.beds.has(MARSH.name), false, 'no marsh in the woods');
  e.shots.length = 0;
  run(air, 60, { ...LAND, climate: CLIMATES.Swamp, night: true, hour: 23 });
  const frogs = e.shots.filter((s) => SCAPE_SFX.frog.includes(s.clip));
  assert.ok(frogs.length >= 15, `a chorus: ${frogs.length}`);
  assert.ok(frogs.every((s) => s.pos[1] <= 0 && Math.hypot(s.pos[0], s.pos[2]) <= 37), 'at the reeds');
  assert.ok(e.beds.get(MARSH.name)?.volume > 0, 'the marsh hums');
  e.shots.length = 0;
  run(air, 400, LAND);
  assert.ok(e.shots.filter((s) => SCAPE_SFX.crow.includes(s.clip)).length >= 3, 'the woods by day: crows');
  assert.equal(e.shots.filter((s) => SCAPE_SFX.owl.includes(s.clip)).length, 0, 'and no owl');
});

test('WORLD-AIR THE DRIVER\'S TOWN: the murmur and the tavern made of the player\'s own people (none without them - never shipped), the murmur by day in the town, the tavern at its door, the anvil at the smithy\'s door in bouts by day and never at night; stop lets every bed and far shot go (mutants: the smith at night; the tavern\'s place; the murmur out of town; a bed left at stop)', () => {
  _resetMade();
  const quiet = fakeEngine({ people: false });
  assert.equal(ensureTownBeds(quiet, { idle: null }), false, 'no archive: no town beds');
  const e = fakeEngine();
  const air = createWorldAir({ engine: e, rand: dice(13) });
  const smithy = [20, 0, 5], tavern = [-10, 0, 8];
  run(air, 30, { ...LAND, inTown: true, townBlocks: 16, hour: 11, smithies: [smithy], taverns: [tavern] });
  assert.ok(e.registered.has(MURMUR.key) && e.registered.has(TAVERN.key), 'made of the people');
  assert.ok(e.beds.get(MURMUR.name)?.volume > 0.2, 'the street at midday');
  const t = e.beds3d.get(TAVERN.name);
  assert.ok(t && t.pos[0] === -10 && t.pos[1] === 1 && t.volume === TAVERN.day, JSON.stringify(t));
  const blows = e.shots.filter((s) => s.clip === SCAPE_SFX.anvil[0]);
  assert.ok(blows.length >= 6, `the smith at work: ${blows.length}`);
  assert.ok(blows.every((s) => s.pos[0] === 20 && s.pos[1] === 1 && s.pos[2] === 5));
  e.shots.length = 0;
  run(air, 30, { ...LAND, inTown: true, townBlocks: 16, hour: 22, night: true, smithies: [smithy], taverns: [tavern] });
  assert.equal(e.shots.filter((s) => SCAPE_SFX.anvil.includes(s.clip)).length, 0, 'no smith at night');
  assert.equal(e.beds.has(MURMUR.name), false, 'the street gone home');
  assert.equal(e.beds3d.get(TAVERN.name)?.volume, TAVERN.night, 'the tavern in the evening');
  run(air, 2, { ...LAND, inTown: false, hour: 12, smithies: [smithy], taverns: [tavern] });
  assert.equal(e.beds.has(MURMUR.name) || e.beds3d.has(TAVERN.name), false, 'out of town, none of it');
  run(air, 2, { ...LAND, inTown: true, hour: 12, shore: { dist: 10, dir: [1, 0] } });
  air.stop();
  assert.deepEqual([[...e.beds.keys()], [...e.beds3d.keys()], e.faded], [[], [], [WORLD_FAR]]);
});
