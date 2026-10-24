// SOUNDSCAPE (2026-10-24, the owner: "enhancing sound and ambience, different music and ambience sounds for sailing ... and
// whatever else we could improve"; bible/08-Audio/Audio.md SOUNDSCAPE): THE SOUNDSCAPE'S HOST HALF (scenes/soundscapeHost.js).
// The shore's edge found on rings and bearings of the sea's depth, placed by halvings; land near a map pixel for the
// gulls, the sea beside one for a far surf; a door's building type off its block; the winter's climates. The host
// against fakes: nothing with Enhanced Sounds off (the classic skin, the switch); aboard, the deck's air and none of
// the land's; at a helm the sea's songs registered once and played, held before the director and let go by a fade the
// frame I sail no more; on land the world's air, the smithies' and taverns' doors read off the host's own list. And the
// world host's own text: the three calls where they belong - the frame after the listener is set, the stop on the
// modal frame beside the wind's, the score in the music's chain after the arena's.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  shoreEdge, landNear, seaBeside, doorBuildingType, winterIn, createSoundscapeHost, SHORE_RADII, SHORE_BEARINGS, SHORE_DEPTH, SHORE_FAR_M, GULL_RING, DOORS_REACH_M,
} from '../../src/scenes/soundscapeHost.js';
import { seaScoreSongs, SEA_SONGS } from '../../src/systems/soundscape/seaScore.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { uiSkin, setUiSkin } from '../../src/systems/uiSkin.js';
import { _resetSoundscapeSounds } from '../../src/systems/soundscape/soundscapeSfx.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

test('SOUNDSCAPE THE SHORE\'S EDGE: the nearest water deeper than SHORE_DEPTH, on SHORE_BEARINGS bearings at each of SHORE_RADII, nearest ring first, placed along its bearing by halvings to within a metre; standing in it, distance nought and no bearing; no water within the last ring, none (mutants: the depth\'s threshold; the halvings; the rings\' order; the first bearing taken for the nearest; the standing arm)', () => {
  assert.deepEqual([[...SHORE_RADII], SHORE_BEARINGS, SHORE_DEPTH], [[6, 14, 28, 50, 85, 130, 200], 12, 0.3]);
  const beach = (x0) => (x) => (x > x0 ? 2 : x > x0 - 3 ? 0.2 : null);   // a beach running along z: shallows 3 m wide, then the deep
  const e = shoreEdge([0, 0, 0], beach(37));
  assert.ok(e && Math.abs(e.dist - 37) < 1, `the edge at 37 m: ${e?.dist}`);
  assert.ok(Math.abs(e.dir[0] - 1) < 1e-9 && Math.abs(e.dir[1]) < 1e-9, 'its bearing: square to the shore, the nearest of the bearings that met it (one at 60 degrees meets it at 43 m)');
  assert.ok(Math.abs(shoreEdge([0, 0, 0], beach(4)).dist - 4) < 1, 'inside the first ring');
  assert.deepEqual(shoreEdge([0, 0, 0], () => 5), { dist: 0, dir: null }, 'in the sea');
  assert.equal(shoreEdge([0, 0, 0], beach(260)), null, 'no sea within the last ring');
  assert.equal(shoreEdge([0, 0, 0], () => 0.25), null, 'the shallows are not the sea');
  assert.equal(shoreEdge([0, 0, 0], () => NaN), null);
});

test('SOUNDSCAPE THE MAP\'S WORD: land near a map pixel - one within GULL_RING that is not the sea; the sea beside one - its own or one of its eight; a door\'s building type off its block\'s own list, -1 without one; a winter where the climate has one (mutants: the ring; the eight; the record\'s index; the desert\'s winter)', () => {
  assert.equal(GULL_RING, 2);
  const islandAt = (ix, iy) => (x, y) => !(x === ix && y === iy);
  assert.deepEqual([landNear(10, 10, islandAt(12, 12)), landNear(10, 10, islandAt(13, 10)), landNear(10, 10, () => true), landNear(10, 10, () => false)], [true, false, false, true]);
  const seaAt = (sx, sy) => (x, y) => x === sx && y === sy;
  assert.deepEqual([seaBeside(5, 5, seaAt(6, 6)), seaBeside(5, 5, seaAt(5, 5)), seaBeside(5, 5, seaAt(7, 5)), seaBeside(5, 5, () => false)], [true, true, false, false]);
  const block = { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: BUILDING_TYPES.Tavern }, { buildingType: BUILDING_TYPES.WeaponSmith }] } } };
  assert.deepEqual([doorBuildingType({ dfBlock: block, recordIndex: 1 }), doorBuildingType({ dfBlock: block, recordIndex: 0 }), doorBuildingType({ dfBlock: block, recordIndex: 4 }), doorBuildingType({}), doorBuildingType(null)], [BUILDING_TYPES.WeaponSmith, BUILDING_TYPES.Tavern, -1, -1, -1]);
  assert.deepEqual([CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.Desert, CLIMATES.Desert2, CLIMATES.Rainforest, CLIMATES.Subtropical, CLIMATES.Swamp].map((c) => winterIn(c, true)), [true, true, false, false, false, false, true]);
  assert.equal(winterIn(CLIMATES.Woodlands, false), false);
});

/** The fakes: an engine that records, a music service that records, a deck and a helm the test moves. */
function rig({ boat = null, helm = null, depth = null, inRect = false, doors = [], people = false } = {}) {
  const calls = { beds: new Map(), beds3d: new Map(), shots: [], music: [], registered: new Set() };
  const audio = {
    listenerPose: () => ({ pos: [0, 0, 0], fwd: [0, 0, 1] }),
    registerSamples(key) { calls.registered.add(key); return true; },
    registerSound: async () => true,
    samplesOf: (i) => (people && i >= 441 && i <= 450 ? Float32Array.from({ length: 3000 }, (_, k) => Math.sin(k * 0.07) * 0.3) : null),
    setBed(name, clip, o = {}) { if (clip == null) calls.beds.delete(name); else calls.beds.set(name, { clip, ...o }); },
    setBed3d(name, clip, pos, o = {}) { if (clip == null) calls.beds3d.delete(name); else calls.beds3d.set(name, { clip, pos, ...o }); },
    play3d(clip, pos, volume, o) { calls.shots.push({ clip, pos, volume, ...o }); return 1; },
    fadeFar() {},
  };
  const music = { current: null, registerSong(name) { calls.music.push(['register', name]); }, playSong(name) { music.current = name; calls.music.push(['play', name]); }, fadeOut() { music.current = null; calls.music.push(['fade']); } };
  const state = { boat, helm };
  const host = createSoundscapeHost({
    audio, music, boat: () => state.boat, csa: { helmPanelState: () => state.helm, IsNearPort: () => false }, fight: () => false,
    pixel: () => ({ x: 100, y: 100 }), seaPixel: () => true, dw: depth ? { rawColumnAt: (x, z) => ({ depth: depth(x, z) }) } : null,
    inRect: () => inRect, towns: () => new Map([[100 * 1000 + 100, { blocks: 9 }]]), doors, doorAt: (e) => e.door,
  });
  return { host, calls, state, music };
}
const F = Object.freeze({ wd: { on: true, strength01: 0.5, gust: 0.7 }, weather: 'sunny', minute: 720, climate: CLIMATES.Woodlands, winter: false, timeScale: 1, paused: false });

test('SOUNDSCAPE THE HOST: nothing with Enhanced Sounds off - the classic skin, or the switch; aboard, the deck\'s air and none of the land\'s; on land the world\'s air - a far surf off the map\'s coast where the sea\'s depth is not there to ask - and none of the deck\'s; stop silences both (mutants: the switch unread; the deck and the land at once; the far surf)', () => {
  const skin = uiSkin();
  _resetSoundscapeSounds();
  try {
    setUiSkin('classic'); setPref('soundEnhancements', true);
    const off = rig({ boat: {} });
    for (let k = 0; k < 30; k++) off.host.frame(1 / 30, F);
    assert.deepEqual([off.calls.beds.size, off.calls.shots.length], [0, 0], 'the classic skin hears what DFU plays');
    setUiSkin('enhanced'); setPref('soundEnhancements', false);
    for (let k = 0; k < 30; k++) off.host.frame(1 / 30, F);
    assert.deepEqual([off.calls.beds.size, off.calls.shots.length], [0, 0], 'the switch off');
    setPref('soundEnhancements', true);
    const r = rig({ boat: {}, helm: { way: 4, sailsUp: true, inIrons: false } });
    for (let k = 0; k < 60; k++) r.host.frame(1 / 30, F);
    assert.ok(r.calls.beds.has('sea:swell') && r.calls.beds.has('sea:wash'), [...r.calls.beds.keys()].join());
    assert.equal(r.calls.beds.has('shore:surf') || r.calls.beds.has('town:murmur'), false, 'no land\'s air on a deck');
    r.state.boat = null;
    for (let k = 0; k < 60; k++) r.host.frame(1 / 30, F);
    assert.equal(r.calls.beds.has('sea:swell'), false, 'ashore: the deck\'s air let go');
    assert.ok(r.calls.beds.get('shore:surf')?.volume > 0, `the map's coast, the sea's depth not there to ask: a far surf (${SHORE_FAR_M} m)`);
    r.host.stop();
    assert.deepEqual([...r.calls.beds.keys()], []);
  } finally { setUiSkin(skin); setPref('soundEnhancements', true); }
});

test('SOUNDSCAPE THE SEA\'S SONGS: at a helm the six songs registered once, by their names, and the law\'s song played - the sea holding the music before the director; standing on a deck at no helm, the director\'s; leaving the helm, the music let go by a fade, once (mutants: the songs registered every frame; the hold kept ashore; the cut)', () => {
  const skin = uiSkin();
  try {
    setUiSkin('enhanced'); setPref('soundEnhancements', true);
    const r = rig({ boat: {}, helm: { way: 4, sailsUp: true, inIrons: false } });
    assert.equal(r.host.scoreFrame(0), false, 'before any frame: nothing held');
    r.host.frame(1 / 30, F);
    assert.equal(r.host.scoreFrame(1), true, 'at a helm the sea holds the music');
    assert.equal(r.host.scoreFrame(2), true);
    const reg = r.calls.music.filter(([k]) => k === 'register').map(([, n]) => n);
    assert.deepEqual(reg, Object.values(seaScoreSongs()).map((s) => s.name), 'registered once');
    assert.deepEqual(new Set(reg), new Set(Object.values(SEA_SONGS)));
    assert.ok(r.calls.music.some(([k, n]) => k === 'play' && Object.values(SEA_SONGS).includes(n)), 'a sea song played');
    r.state.helm = null;
    r.host.frame(1 / 30, F);
    assert.equal(r.host.scoreFrame(3), false, 'aboard at no helm: the director\'s');
    assert.deepEqual(r.calls.music.at(-1), ['fade'], 'let go by a fade');
    const n = r.calls.music.length;
    assert.equal(r.host.scoreFrame(4), false);
    assert.equal(r.calls.music.length, n, 'once');
  } finally { setUiSkin(skin); setPref('soundEnhancements', true); }
});

test('SOUNDSCAPE THE HOST ON LAND: the shore found on the sea\'s depth and the surf stood at its edge; a town\'s rect and its size off the living towns\' index (its murmur the root of nine blocks in sixteen); the smithies\' and the taverns\' doors read off the host\'s own list, their types off their blocks - the tavern\'s noise at the tavern\'s door, the anvil at the armourer\'s, a house silent (mutants: a smithy taken for a tavern; the town\'s size unread)', () => {
  const skin = uiSkin();
  try {
    setUiSkin('enhanced'); setPref('soundEnhancements', true);
    const block = { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: BUILDING_TYPES.Tavern }, { buildingType: BUILDING_TYPES.Armorer }, { buildingType: BUILDING_TYPES.House1 }] } } };
    const door = (x, z, recordIndex) => ({ dfBlock: block, recordIndex, door: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1] } });
    assert.equal(DOORS_REACH_M, 70);
    const doors = [door(10, 10, 0), door(-12, 4, 1), door(5, 5, 2), door(200, 0, 1)];
    const quiet = rig({ depth: (x) => (x > 40 ? 3 : 0), inRect: true, doors });
    for (let k = 0; k < 60; k++) quiet.host.frame(1 / 30, { ...F, minute: 11 * 60 });
    assert.equal(quiet.calls.beds3d.get('town:tavern'), undefined, 'the town\'s beds wait on the people (no archive)');
    const r = rig({ depth: (x) => (x > 40 ? 3 : 0), inRect: true, doors, people: true });
    for (let k = 0; k < 400; k++) r.host.frame(1 / 30, { ...F, minute: 11 * 60 });
    const surf = r.calls.beds3d.get('shore:surf');
    assert.ok(surf && Math.abs(surf.pos[0] - 40) < 1, `the surf at the edge: ${surf?.pos}`);
    const tavern = r.calls.beds3d.get('town:tavern');
    assert.ok(tavern && tavern.pos[0] === 10 && tavern.pos[2] === 10, `the tavern's noise at its door: ${tavern?.pos}`);
    const blows = r.calls.shots.filter((x) => x.clip === 'town-anvil-1');
    assert.ok(blows.length >= 4 && blows.every((x) => x.pos[0] === -12 && x.pos[2] === 4), `the anvil at the armourer's door: ${blows.length}`);
    assert.ok(Math.abs(r.calls.beds.get('town:murmur')?.volume - 0.22 * 0.75) < 1e-9, `nine blocks: ${r.calls.beds.get('town:murmur')?.volume}`);
  } finally { setUiSkin(skin); setPref('soundEnhancements', true); }
});

test('SOUNDSCAPE THE WORLD HOST: constructed once beside the Deadlands\' air with the world\'s own doors as they are; its frame on the exterior frame after the listener is set and beside the wind; its stop on the modal frame beside the wind\'s; its score in the music\'s chain after the arena\'s, before the director (mutants: the frame before the listener; the stop dropped; the score ahead of the gate\'s)', () => {
  const made = W.indexOf('const soundscape = createSoundscapeHost({');
  assert.ok(made > W.indexOf('const deadlandsAir = createDeadlandsAir(audio);'));
  assert.equal(W.split('createSoundscapeHost(').length - 1, 1, 'once');
  const listener = W.indexOf('audio.setListener(cam.pos, tvf ? [viewFwd[0], 0, viewFwd[2]] : fwd);');
  const frame = W.indexOf('soundscape.frame(dt, {');
  assert.ok(listener > 0 && frame > listener && frame - W.indexOf('windAudio.update(wd, dt, windSoundOn());') < 1200, 'after the listener, beside the wind');
  assert.match(W, /^      windAudio\.stop\(\); soundscape\.stop\(\);   \/\/ WIND3/m, 'the modal frame silences it with the wind, on the wind\'s own line (DISC6 reads the lines after it)');
  assert.match(W, /if \(!hourScoreFrame\(\) && !gateScoreFrame\(\) && !arenaScoreFrame\(\) && !soundscape\.scoreFrame\(\)\) musicDirector\.update\(\{/);
});
