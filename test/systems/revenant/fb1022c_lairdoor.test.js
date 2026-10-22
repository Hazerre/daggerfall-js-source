// FIELD BUGS 2026-10-22c LAIR-DOOR (bible/01-Overview/bugs/Field-Bugs-2026-10-22c.md, report 4): fogs, on Zenako's behalf -
// "the Revenant lair designated on the Revenants page is inaccessible -- there are no interactable doors, hatches or
// openings to the marked dungeon ... The Stuvam Graveyard, south of Ceriburea ... approximate coordinates 565, 427". A
// revenant's lair (RVN7, Revenants.md 18.1) is one of the game's own dungeons in the boards' ring about a deed - and 28 of
// the graveyards MAPS.BSA flags with a dungeon lay a block (GRVEAS10, GRVEAS36) that places no dungeon-entrance door: the
// Stuvam Graveyard is one. Pinned: the blocks' law; the host's door (only enterable dungeons offered; the test kept a
// pixel, a model's mesh read once); the lair kept only while enterable; the mend of a lair already held (moved to the
// nearest enterable den, known as it was; none, it roams); and, on the player's data, the 28 and the Stuvam Graveyard.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const F = await import('../../../src/systems/revenant/revenantFeud.js');
const { blocksPlaceEntrance, createLairDoor, LAIR_MEND_PX } = await import('../../../src/scenes/lairHost.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { LOCATION_TYPES } = await import('../../../src/formats/mapsFile.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-lairdoor') => ({ isPlayer: true, name: 'Zenako', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const D = (px, py, name, region = 0) => ({ px, py, name, region });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(1440 + 120);
});

// A tiny world: model 56 carries a dungeon-entrance door (archive 56), model 74 a building door, model 9 none.
const meshes = {
  56: { subMeshes: [{ textureArchive: 56, textureRecord: 0, planes: [{}] }] },
  74: { subMeshes: [{ textureArchive: 74, textureRecord: 0, planes: [{}] }] },
  9: { subMeshes: [{ textureArchive: 9, textureRecord: 3, planes: [{}] }] },
};
const fakeArch = (reads) => ({ getRecordIndex: (id) => (meshes[id] ? id : -1), getMesh: (i) => { reads.push(i); return meshes[i]; } });
const block = (...ids) => ({ layout: { models: ids.map((modelIdNum) => ({ modelIdNum })) } });

test('LAIR-DOOR the blocks\' law: a door on any model is an entrance; every model read and none a door is none; a model not to be had and no door is not judged; an enhanced-only model only on the enhanced skin (mutants: unread read as none; the enhanced-only door always counted)', () => {
  const of = (id) => (meshes[id] ? [56].includes(id) : null);
  assert.equal(blocksPlaceEntrance([block(9, 74), block(56)], of), true);
  assert.equal(blocksPlaceEntrance([block(9, 74)], of), false, 'a building door is no way down');
  assert.equal(blocksPlaceEntrance([block(9, 1234)], of), null, 'a model the archive lacks: not judged');
  assert.equal(blocksPlaceEntrance([block(9, 1234, 56)], of), true);
  const enh = [{ layout: { models: [{ modelIdNum: 56, enhancedOnly: true }, { modelIdNum: 9 }] } }];
  assert.equal(blocksPlaceEntrance(enh, of, false), false, 'the classic skin stands no enhanced-only model');
  assert.equal(blocksPlaceEntrance(enh, of, true), true);
  assert.equal(blocksPlaceEntrance([], of), false);
});

test('LAIR-DOOR the host\'s door: the ring\'s dungeons the player can go down into, each with its region; the test itself answered; a place laid once and a model read once; one the host cannot lay is not judged (mutants: the ring unfiltered; the region dropped; the pixel not kept)', () => {
  // three dungeons in the ring about (100, 100): a keep with a door, a graveyard without, a crypt with
  const places = new Map([['106,100', { name: 'East Keep', blocks: [block(9, 56)] }], ['94,100', { name: 'Doorless Graveyard', blocks: [block(9, 74)] }], ['100,94', { name: 'North Crypt', blocks: [block(56)] }], ['100,106', { name: 'Unlaid', blocks: null }], ['100,104', { name: 'Unread Ruin', blocks: [block(9, 1234)] }]]);
  const laid = [], reads = [];
  const keys = [...places.keys()];
  const lairAt = createLairDoor({
    maps: {}, blocks: {}, arch: fakeArch(reads),
    locations: new Map(keys.map((k) => [k, { key: k, exterior: { exteriorData: {} } }])),
    dungeons: new Map(keys.map((k) => [k, places.get(k).name])),
    regions: new Map(keys.map((k) => [k, k === '106,100' ? 7 : 3])),
    here: () => ({ x: 100, y: 100 }), enhanced: () => false,
    layout: (loc) => { laid.push(loc.key); const b = places.get(loc.key).blocks; if (!b) throw new Error('no block'); return { blocks: b }; },
  });
  const at = lairAt();
  assert.deepEqual(lairAt({ x: 100, y: 100 }).dungeons, at.dungeons, 'my pixel, or the one asked');
  assert.equal(at.px, 100); assert.equal(at.py, 100);
  assert.deepEqual(at.dungeons.map((d) => [d.name, d.region]).sort(), [['East Keep', 7], ['North Crypt', 3], ['Unlaid', 3], ['Unread Ruin', 3]], 'the doorless graveyard is no lair; one the host cannot lay, or whose model the archive lacks, stays one');
  assert.equal(at.enterable(94, 100), false);
  assert.equal(at.enterable(106, 100), true);
  assert.equal(at.enterable(500, 500), true, 'no place known there: not judged');
  // the mend's den: the enterable dungeon nearest a pixel, never the pixel itself - from the doorless graveyard, the crypt
  // and the keep both 6 px off (the larger axis), the first found; from the keep, the crypt
  assert.deepEqual(at.nearest(94, 100), { px: 100, py: 94, name: 'North Crypt', region: 3 });
  assert.deepEqual(at.nearest(106, 100), { px: 100, py: 94, name: 'North Crypt', region: 3 });
  assert.equal(at.nearest(400, 400), null, 'none within reach');
  lairAt({ x: 101, y: 100 });
  assert.equal(laid.filter((k) => k === '94,100').length, 1, 'a place laid once a session');
  assert.equal(reads.filter((i) => i === 56).length, 1, 'a model\'s mesh read once');
});

test('LAIR-DOOR the lair after a deed: a kept lair the host says no one can enter is chosen again about the deed; one it can, or a host that cannot say, keeps it (mutants: the kept lair never asked; asked and kept anyway)', () => {
  const ring = [D(106, 100, 'East Keep', 3)];
  const kept = D(94, 100, 'The Stuvam Graveyard', 0);
  const no = (px, py) => !(px === 94 && py === 100);
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, { px: 100, py: 100, dungeons: ring, enterable: no }), D(106, 100, 'East Keep', 3), 'chosen again');
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, { px: 100, py: 100, dungeons: ring, enterable: () => true }), kept, 'enterable: kept');
  assert.deepEqual(F.lairAfter({ id: 'a', lair: kept }, { px: 100, py: 100, dungeons: ring }), kept, 'a host that cannot say: kept');
  assert.equal(F.lairAfter({ id: 'a', lair: kept }, { px: 100, py: 100, dungeons: [], enterable: no }), null, 'none in the ring: it roams');
});

test('LAIR-DOOR the mend: a living revenant holding a lair no one can enter moves to the nearest enterable dungeon about it, still known - the page, the map\'s circle and the hunt read the new one; asked once a session; none in reach, it roams unheard of; a host that cannot say asks again (mutants: never mended; mended to the farther; known forgotten on a move; asked every read)', () => {
  const p = me();
  const foe = { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' };
  // its lair chosen before the door asked about doors: the Stuvam Graveyard
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: () => ({ px: 559, py: 427, dungeons: [D(565, 427, 'The Stuvam Graveyard', 0)] }) });
  const r = N.revenantDeed(p, foe, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.deepEqual(r.lair, D(565, 427, 'The Stuvam Graveyard', 0));
  r.lairKnown = true;
  // the host now knows doors: about the graveyard, two enterable dungeons, the nearer to the south
  const asked = [];
  setPlayerDoor({
    foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {},
    lairHere: (at) => { asked.push(at); return { px: at.x, py: at.y, dungeons: [D(565, 433, 'The Cujem Hold', 0), D(575, 427, 'Far Keep', 0)], enterable: (x, y) => !(x === 565 && y === 427) }; },
  });
  const rev = r.rev;
  assert.deepEqual(N.revenantMapMarks().map((m) => [m.cx, m.cy]), [[565.5, 433.5]], 'the map\'s circle at the den it moved to');
  assert.deepEqual(r.lair, D(565, 433, 'The Cujem Hold', 0), 'the nearest enterable');
  assert.equal(r.lairKnown, true, 'known as it was known');
  assert.ok(r.rev > rev, 'a revision, so the mirror keeps it');
  assert.match(N.revenantHuntEntries({ px: 560, py: 430 })[0].messages[0][1].text, /The Cujem Hold/);
  assert.deepEqual(asked, [{ x: 565, y: 427 }, { x: 565, y: 433 }], 'each held lair asked once: the old, then the new');
  N.revenantMapMarks(); N.revenantHuntEntries();
  assert.equal(asked.length, 2, 'never again this session');
  // the world host's door names the nearest itself (scenes/lairHost.js nearest) - past the ring, within a rumour's reach
  r.lair = D(300, 300, 'Another Graveyard', 0); r.lairKnown = true;
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {},
    lairHere: (at) => ({ px: at.x, py: at.y, dungeons: [], enterable: (x, y) => !(x === 300 && y === 300), nearest: () => D(561, 441, "Morarker's Nest", 0) }) });
  assert.equal(N.mendRevenantLairs(), 1);
  assert.deepEqual(r.lair, D(561, 441, "Morarker's Nest", 0)); assert.equal(r.lairKnown, true);
  // none in reach: it roams, unheard of
  r.lair = D(10, 10, 'Lonely Graveyard', 0); r.lairKnown = true;
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: (at) => ({ px: at.x, py: at.y, dungeons: [], enterable: () => false }) });
  assert.equal(N.mendRevenantLairs(), 1);
  assert.equal(r.lair, null); assert.equal(r.lairKnown, false);
  // a host that cannot say (underground: no `enterable`) asks again later
  r.lair = D(20, 20, 'Somewhere', 0);
  let calls = 0;
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: () => { calls++; return { underground: D(1, 1, 'Below') }; } });
  assert.equal(N.mendRevenantLairs(), 0); assert.equal(N.mendRevenantLairs(), 0);
  assert.equal(calls, 2, 'asked again');
  assert.deepEqual(r.lair, D(20, 20, 'Somewhere', 0));
});

test('LAIR-DOOR by source: the world host\'s door is scenes/lairHost.js over its own index, asked of my pixel or the one asked; every reader of a lair mends first (mutants: unwired)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /lairHere: createLairDoor\(\{ maps, blocks, arch, locations: locationIndex, dungeons: _bountyDungeonPixels, regions: _dungeonRegionPixels, here: playerTravelPixel \}\),/);
  assert.match(w, /import \{ createLairDoor \} from '\.\/lairHost\.js';/);
  const rv = read('src/systems/revenant/revenant.js');
  for (const fn of ['revenantRumor', 'revenantMapMarks', 'revenantHuntEntries']) {
    assert.match(rv, new RegExp(`export function ${fn}\\([^\\n]*\\{\\n(?:[^\\n]*\\n){1,3}?\\s*mendRevenantLairs\\(\\);`), `${fn} mends first`);
  }
  assert.match(rv, /export function revenantsFor\(player\) \{ ensureMirror\(player\); mendRevenantLairs\(\); return allRevenants\(\); \}/);
});

// ─── THE PLAYER'S DATA ──────────────────────────────────────────────────────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA')) && existsSync(join(ARENA2, 'ARCH3D.BSA'));
test('LAIR-DOOR on the player\'s data: of the dungeons the world host indexes, exactly the 28 graveyards on GRVEAS10 or GRVEAS36 place no entrance - The Stuvam Graveyard (565, 427) among them - and every one has an enterable dungeon within a rumour\'s reach for the mend (the Stuvam Graveyard alone none in its ring)', { skip: HAS ? false : 'no ARENA2 (ARENA2_PATH)' }, async () => {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  // the world host's index (scenes/world.js's boot pass): the game's own rows; a dungeon a board may name, never a town's
  const locs = new Map(), dungeons = new Map(), regions = new Map(), types = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    const base = maps.baseLocationCount(r);
    for (let l = 0; l < Math.min(base, region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.exterior?.exteriorData) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      const k = `${p.x},${p.y}`;
      locs.set(k, loc);
      const lt = loc.mapTableData.locationType;
      if (loc.hasDungeon && lt !== LOCATION_TYPES.TownCity && lt !== LOCATION_TYPES.TownHamlet && lt !== LOCATION_TYPES.TownVillage) { dungeons.set(k, String(loc.name)); regions.set(k, r); types.set(k, lt); }
    }
  }
  const lairAt = createLairDoor({ maps, blocks, arch, locations: locs, dungeons, regions, here: () => ({ x: 0, y: 0 }), enhanced: () => false });
  const { enterable } = lairAt();
  const none = [...dungeons.keys()].filter((k) => { const [x, y] = k.split(',').map(Number); return !enterable(x, y); });
  assert.equal(none.length, 28);
  assert.ok(none.every((k) => types.get(k) === LOCATION_TYPES.Graveyard), 'graveyards, every one');
  assert.ok(none.includes('565,427') && dungeons.get('565,427') === 'The Stuvam Graveyard', 'the report\'s');
  // the mend's den: every one has an enterable dungeon within a rumour's reach; all but the Stuvam Graveyard in its own
  // ring - nothing else stands within 13 px of it, and Morarker's Nest is 14 px south
  const ringless = [];
  for (const k of none) {
    const [x, y] = k.split(',').map(Number);
    const at = lairAt({ x, y });
    assert.ok(at.nearest(x, y), `${dungeons.get(k)}: a den to move to`);
    assert.ok(at.enterable(at.nearest(x, y).px, at.nearest(x, y).py));
    if (!at.dungeons.length) ringless.push(dungeons.get(k));
  }
  assert.deepEqual(ringless, ['The Stuvam Graveyard']);
  assert.deepEqual(lairAt({ x: 565, y: 427 }).nearest(565, 427), { px: 561, py: 441, name: "Morarker's Nest", region: regions.get('561,441') });
  // the report's own ground: from Ceriburea (562, 421), 6 px north of it, the graveyard is never offered as a lair
  assert.ok(lairAt({ x: 562, y: 421 }).dungeons.every((d) => d.name !== 'The Stuvam Graveyard'), 'never offered as a lair');
  assert.equal(LAIR_MEND_PX, 20);
});
