// FIELD BUGS 2026-10-24 (bible/01-Overview/bugs/Field-Bugs-2026-10-24.md) - "players seeing other players underneath the
// ground", and the foes those players spawn out of reach, mostly at world events outside the breach portals with a crowd
// about. A pose and a foe record carry a height on their sender's own ground, so two clients that build one pixel on two
// grounds see each other sunk or floating. Two of a client's own beliefs moved the ground on the same build:
//   GROUND-AGREE - a spawned dungeon levels its whole pixel (DFU's BlendLocationTerrain), and whether one stands is each
//     client's clocks at the moment it built the pixel; the ground now follows the roll alone (world.js groundLocationAt);
//   GATE-AGREE - a clearing (the gate's, every Elite Breach arch this client believes, each fallen star) refused a World of
//     Daggerfall site at its pick, and the pick is what levels the ground; a clearing now holds the site's objects alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../src/world/terrain/terrainSampler.js';
import { locationFootprintRect } from '../../src/world/terrain/terrainTiles.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { LocationSession, pickLocations } from '../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { gateClearFor, gateSiteTest, GATE_CLEAR_M } from '../../src/world/gate/gateClearance.js';
import { wodSiteClear } from '../../src/world/road/roadClearance.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';
import { hostText } from '../hostText.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const WORLD = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
const woods = new WoodsFile();
woods.load(syntheticWoodsBytes());
const METRES = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const climates = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(CLIMATES.Mountain);
/** The most two grounds part anywhere in the pixel, metres. */
const most = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]) * METRES); return m; };
const ground = (px, py, job = {}) => generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Mountain, climates, landform: true, ...job }).samples;

test('GROUND-AGREE the ground\'s place, lifted and run: what stands, else online the spawn the roll stands with its clocks never asked - none offline, past the Veil, in the open zone or where the roll stands none (mutants: the stood ignored; the clocks asked; offline; past the Veil; in the zone; the roll transposed)', () => {
  const line = /\n {2}(const groundLocationAt = [^\n]*;)\n/.exec(WORLD);
  assert.ok(line, 'the boot declares it');
  const made = (o = {}) => {
    const asked = [];
    const d = {
      online: true, etherSea: true, ether: () => false, mask: null, inside: () => false, rolls: (x, y) => x === 7 && y === 3,
      ...o,
    };
    const fn = new Function('params', 'etherSea', 'inEther', 'wildMaskOf', 'wildInside', 'maps', 'spawnsDungeon', '_spawnSalt', 'tvSpawnAt', `${line[1]}\nreturn groundLocationAt;`)(
      { has: (k) => k === 'online' && d.online }, d.etherSea, d.ether, () => d.mask, (m, x, y) => d.inside(x, y), {},
      (salt, x, y) => { asked.push(['roll', salt, x, y]); return d.rolls(x, y); }, 9,
      (x, y, clocks) => { asked.push(['stand', x, y, clocks]); return { name: `Spawn ${x},${y}` }; });
    return { fn, asked };
  };
  const town = { name: 'Town' };
  let h = made();
  assert.equal(h.fn(7, 3, town), town, 'what stands is the ground\'s place');
  assert.deepEqual(h.asked, [], 'and no roll is asked of a pixel where something stands');
  assert.deepEqual(h.fn(7, 3, null), { name: 'Spawn 7,3' }, 'a pixel nothing stands on: the roll\'s spawn - alive or dead');
  assert.deepEqual(h.asked, [['roll', 9, 7, 3], ['stand', 7, 3, false]], 'the roll asked of this pixel, its stand asked with the clocks OFF');
  assert.equal(h.fn(3, 7, undefined), null, 'the mirror pixel rolls none');
  h = made({ online: false });
  assert.equal(h.fn(7, 3, null), null, 'offline no spawn stands, so none shapes the ground');
  h = made({ ether: (x, y) => x === 7 && y === 3 });
  assert.equal(h.fn(7, 3, null), null, 'past the Veil the isles stand their own places (_locationToBuild\'s etherPlaceAt)');
  h = made({ etherSea: false, ether: () => true });
  assert.deepEqual(h.fn(7, 3, null), { name: 'Spawn 7,3' }, 'with no Eltheric Ocean the box is the Bay\'s');
  h = made({ mask: {}, inside: (x, y) => x === 7 && y === 3 });
  assert.equal(h.fn(7, 3, null), null, 'in the open zone only a hall stands (spawnedDungeonAt\'s own law), and a hall is `stood`');
  // the same gates as the feature that stands the spawn - spawnedDungeonAt asks the zone, then the roll, the sea and the plateau
  assert.match(WORLD, /\{ const _wm = wildMaskOf\(maps\); if \(_wm && wildInside\(_wm, px, py\)\) return wildHallStandOf\(_wm, px, py\); \}/, 'spawnedDungeonAt\'s zone');
  assert.match(WORLD, /if \(!spawnsDungeon\(_spawnSalt, px, py\) \|\| maps\.getClimateIndex\(px, py\) === CLIMATES\.Ocean \|\| !_spawnGround\(px, py\)\) return null;/, 'and its roll, its sea and its plateau, which tvSpawnAt asks as well');
  assert.match(WORLD, /function _locationToBuild\(px, py\) \{\n\s*if \(etherSea && inEther\(px, py\)\) return etherPlaceAt\(px, py\);/, 'and the Veil, as _locationToBuild asks it');
});

test('GROUND-AGREE by source: the pixel build shapes its ground - the blend, the tiles, World of Daggerfall\'s pick, the woods\' and the jungle\'s clearings - for the ground\'s place, and stands only what stands; the lift reads the same place (mutants: the build shapes the stood; the rect the stood\'s; the pick the stood\'s)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const dfLocation = _locationToBuild\(px, py\) \|\| null;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const groundLocation = groundLocationAt\(px, py, dfLocation\);/, 'asked once, beside what stands');
  assert.match(w, /if \(groundLocation\) locationRect = setLocationTiles\(groundLocation, maps, blocks, seedTilemap\);/, 'the rect and the tiles');
  assert.equal(w.match(/hasLocation: !!groundLocation/g)?.length, 2, 'World of Daggerfall\'s pick and the kernel\'s blend');
  assert.doesNotMatch(w, /hasLocation: !!dfLocation/, 'nothing shapes ground by what stands alone');
  assert.equal(w.match(/FOREST_HIDDEN_LOCATION_TYPES\.has\(groundLocation\?\.mapTableData\?\.locationType\)/g)?.length, 2, 'the woods\' and the jungle\'s clearings');
  assert.match(w, /location: dfLocation \? dfLocation\.name : null,/, 'what stands is still the clocks\' (tvSpawnGone reads it)');
  assert.match(w, /_livingPatrons, _locationToBuild, groundLocationAt, _lptSway,/, 'the host hands the build its ground\'s place');
  assert.match(w, /const _liftLocationAt = \(x, y\) => groundLocationAt\(x, y, locationIndex\.get\(`\$\{x\},\$\{y\}`\)\);/, 'and the lift reads it for a pixel not built yet');
  assert.match(w, /function tvSpawnAt\(px, py, clocks = true\) \{\n\s*if \(maps\.getClimateIndex\(px, py\) === CLIMATES\.Ocean \|\| !_spawnGround\(px, py\) \|\| \(clocks && tvSpawnGone\(px, py\)\)\) return null;/, 'the clocks the one gate the ground does not ask');
});

test('GROUND-AGREE on the real producer: a ruin\'s blend moves its pixel\'s ground by metres - a client that built the pixel with its spawn dead stood every peer there sunk or floating - and the ground is now the same whether it stands or not', () => {
  const ruin = { exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RUIN'] } }, mapTableData: { locationType: 10 } };
  const rect = locationFootprintRect(ruin);
  const bare = ground(350, 230), level = ground(350, 230, { hasLocation: true, locationRect: rect });
  const m = most(bare, level);
  assert.ok(m > 1.7, `the blend moves the ground ${m.toFixed(1)} m on a mountain pixel - past a sword's reach of a foe stood on the other ground`);
  // the build hands the kernel the ground's place alive or dead (above), so both clients' jobs are this one
  assert.deepEqual([...ground(350, 230, { hasLocation: true, locationRect: rect })], [...level], 'one job, one ground');
});

test('GATE-AGREE on the real producer: a clearing holds a whole site\'s objects and keeps its pick, so the ground under it is the same with the clearing or without; the old law - refused at its pick - moved it (mutants: the clearing decides the pick; a held pick stands; held picks off the ground)', () => {
  const camp = { width: 16, height: 16, obj: [{ pos: { x: 0, y: 0, z: 0 } }, { pos: { x: 30, y: 0, z: 0 } }] };
  const session = new LocationSession();
  session.appendRegion(1, {
    count: 1, worldX: [350], worldY: [230], terrainX: [40], terrainY: [64], type: [2], locationID: [1], name: ['a'], prefab: ['WOD_BanditCamp_01'],
  });
  const tile = { mapPixelX: 350, mapPixelY: 230, hasLocation: false, worldHeight: 10 };
  // an arch's clearing over the camp's first object (tile 40, 64 is 256, 409.6 m) - believed by one client, not by another
  const clear = gateClearFor({ day: 1, px: 350, py: 230, spot: [256 + GATE_CLEAR_M / 2, 409.6] });
  const road = (n, pf, r) => wodSiteClear(null, 350, 230, n, pf, r);
  const kernelOf = (picks) => ground(350, 230, { wod: picks.length ? { picks: picks.map((p) => ({ flatten: p.flatten, rect: p.rect, hide: true })) } : null });
  // the host's composition (scenes/pixelBuild.js): the road alone picks; the clearing asks each pick
  const picked = pickLocations(tile, session, () => camp, null, road);
  const believed = { refused: false, reach: [] }, unaware = { refused: false, reach: [] };
  const heldThere = picked.map((p) => !gateSiteTest(clear, 350, 230, believed)(session.prefab[p.index], p.prefab, p.rect));
  const heldHere = picked.map((p) => !gateSiteTest(null, 350, 230, unaware)(session.prefab[p.index], p.prefab, p.rect));
  assert.deepEqual([heldThere, heldHere], [[true], [false]], 'the client that believes the arch holds the camp; the other stands it');
  assert.equal(believed.refused, true, 'and remembers the clearing cost it a site (the sweep stands it again when the arch goes)');
  // both clients hand the kernel every pick, held or not (the host's `wod: wodPicks ?` - test/world/gate/gateclear.test.js),
  // so both stand the ground kernelOf(picked) makes
  // the old law: the clearing refused the camp at its pick, so the client that believed the arch built no flatten
  const oldPicks = pickLocations(tile, session, () => camp, null, (n, pf, r) => road(n, pf, r) && gateSiteTest(clear, 350, 230, { refused: false, reach: [] })(n, pf, r));
  assert.deepEqual(oldPicks, [], 'refused at its pick');
  const m = most(kernelOf(picked), kernelOf(oldPicks));
  assert.ok(m > 1.7, `and the two clients' grounds parted by ${m.toFixed(1)} m in the camp's pixel`);
});
